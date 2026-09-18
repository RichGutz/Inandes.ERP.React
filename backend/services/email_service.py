# backend/services/email_service.py
import os
import sys
import json
import base64
import smtplib
from pathlib import Path
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email.mime.image import MIMEImage
from email import encoders
from typing import List, Dict, Any, Optional, Tuple

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google.oauth2 import service_account
from googleapiclient.discovery import build

BACKEND_ROOT = Path(__file__).parent.parent
TEMPLATES_DIR = BACKEND_ROOT / "templates"

GMAIL_TOKEN_PATH = BACKEND_ROOT / "gmail_oauth_token.json"
GMAIL_CREDENTIALS_PATH = BACKEND_ROOT / "gmail_oauth_credentials.json"
GMAIL_SA_PATH = BACKEND_ROOT / "gmail_service_account.json"

DEFAULT_DELEGATED_EMAIL = os.getenv("DELEGATED_EMAIL", "inversionistas@inandes.com")
DEFAULT_SENDER_NAME = os.getenv("SENDER_NAME", "INANDES Inversionistas")
GMAIL_SCOPES = ["https://mail.google.com/", "https://www.googleapis.com/auth/gmail.send"]


def get_gmail_service(delegated_email: str = DEFAULT_DELEGATED_EMAIL):
    """
    Obtiene el servicio de Google Gmail API usando:
    1. Variable de entorno GMAIL_SA_JSON o GMAIL_SA_BASE64.
    2. Archivo Service Account DWD en disco.
    3. OAuth2 Token existente.
    """
    # 1. Intentar con variable de entorno (GMAIL_SA_JSON o GMAIL_SA_BASE64)
    sa_env = os.getenv("GMAIL_SA_JSON") or ""
    sa_b64 = os.getenv("GMAIL_SA_BASE64") or ""
    if sa_b64 and not sa_env:
        try:
            sa_env = base64.b64decode(sa_b64).decode("utf-8")
        except Exception as e:
            print(f"[email_service] Error decodificando GMAIL_SA_BASE64: {e}")

    if sa_env:
        try:
            sa_info = json.loads(sa_env)
            creds = service_account.Credentials.from_service_account_info(
                sa_info,
                scopes=["https://mail.google.com/"]
            ).with_subject(delegated_email)
            return build('gmail', 'v1', credentials=creds)
        except Exception as e:
            print(f"[email_service] Error inicializando Service Account desde env var: {e}")

    # 2. Intentar con Service Account DWD oficial en disco
    candidate_paths = [
        GMAIL_SA_PATH,
        Path("/data/backend_secrets/gmail_service_account.json"),
        Path("/app/gmail_service_account.json")
    ]
    for p in candidate_paths:
        if p.exists():
            try:
                creds = service_account.Credentials.from_service_account_file(
                    str(p),
                    scopes=["https://mail.google.com/"]
                ).with_subject(delegated_email)
                return build('gmail', 'v1', credentials=creds)
            except Exception as e:
                print(f"[email_service] Error inicializando Service Account DWD desde {p}: {e}")

    # 3. Fallback a Token OAuth2 previo
    if GMAIL_TOKEN_PATH.exists():
        try:
            with open(GMAIL_TOKEN_PATH, 'r', encoding='utf-8') as f:
                token_data = json.load(f)
            creds = Credentials.from_authorized_user_info(token_data, scopes=["https://www.googleapis.com/auth/gmail.send"])
            if not creds.valid:
                if creds.expired and creds.refresh_token:
                    creds.refresh(Request())
                    with open(GMAIL_TOKEN_PATH, 'w', encoding='utf-8') as f:
                        f.write(creds.to_json())
            return build('gmail', 'v1', credentials=creds)
        except Exception as e:
            print(f"[email_service] Error inicializando OAuth2 token fallback: {e}")

    return None


MANDATORY_SYSTEM_CC = "inandes@outlook.es"


def _resolve_cc_list(cc_email: Optional[str]) -> str:
    """
    Garantiza que inandes@outlook.es siempre esté incluido como copia (CC)
    en todos los correos enviados por el sistema, preservando destinatarios adicionales.
    """
    cc_set: List[str] = []
    if cc_email:
        for item in cc_email.replace(';', ',').split(','):
            clean = item.strip()
            if clean and clean.lower() not in [x.lower() for x in cc_set]:
                cc_set.append(clean)
    if MANDATORY_SYSTEM_CC.lower() not in [x.lower() for x in cc_set]:
        cc_set.append(MANDATORY_SYSTEM_CC)
    return ", ".join(cc_set)


def send_email(
    to_email: str,
    subject: str,
    html_body: str,
    attachments: Optional[List[Dict[str, Any]]] = None,
    cc_email: Optional[str] = None,
    sender_email: Optional[str] = None,
    sender_name: str = DEFAULT_SENDER_NAME,
    ribbon_path: Optional[str] = None
) -> Tuple[bool, str]:
    """
    Envía un correo con diseño HTML, imagen embebida (ribbon) y archivos adjuntos (PDFs).
    Siempre incluye inandes@outlook.es en copia (CC).
    
    attachments: [
        {"filename": "EECC_XXX.pdf", "content_bytes": b'...'},
        {"filename": "Retencion_XXX.pdf", "content_bytes": b'...'}
    ]
    """
    effective_sender = sender_email or DEFAULT_DELEGATED_EMAIL
    effective_cc = _resolve_cc_list(cc_email)

    service = get_gmail_service(delegated_email=effective_sender)
    if not service:
        return False, "Error: No se pudo conectar al servicio oficial de Google Gmail API (inversionistas@inandes.com). Proceso pausado para reintento."

    try:
        msg = MIMEMultipart("mixed")
        msg["To"] = to_email
        if effective_cc:
            msg["Cc"] = effective_cc
        
        msg["From"] = f"{sender_name} <{effective_sender}>"
        msg["Subject"] = subject

        msg_related = MIMEMultipart("related")
        msg_alternative = MIMEMultipart("alternative")
        msg_alternative.attach(MIMEText(html_body, "html", "utf-8"))
        msg_related.attach(msg_alternative)

        # Embeber cinta/ribbon gráfico de cabecera si existe
        actual_ribbon = ribbon_path or str(TEMPLATES_DIR / "ribbon_inandes.jpg")
        if os.path.exists(actual_ribbon):
            with open(actual_ribbon, "rb") as img_f:
                img_part = MIMEImage(img_f.read())
                img_part.add_header("Content-ID", "<logo_inandes>")
                msg_related.attach(img_part)
        
        msg.attach(msg_related)

        # Adjuntar PDFs
        if attachments:
            for att in attachments:
                fname = att.get("filename", "adjunto.pdf")
                content = att.get("content_bytes")
                if content:
                    part = MIMEBase("application", "octet-stream")
                    part.set_payload(content)
                    encoders.encode_base64(part)
                    part.add_header("Content-Disposition", f'attachment; filename="{fname}"')
                    msg.attach(part)

        raw = base64.urlsafe_b64encode(msg.as_bytes()).decode()
        service.users().messages().send(userId="me", body={"raw": raw}).execute()
        return True, f"Correo enviado exitosamente a {to_email}"

    except Exception as e:
        return False, f"Error enviando correo via Gmail API (inversionistas@inandes.com): {str(e)}"


def fetch_gmail_bounces(max_results: int = 50, delegated_email: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Escanea la bandeja de entrada de Google Workspace (inversionistas@inandes.com)
    buscando notificaciones de rebote (Mailer-Daemon / NDR) y extrae:
    - email_rebotado
    - motivo_rebote
    - fecha_rebote
    - gmail_msg_id
    """
    import re

    effective_sender = delegated_email or DEFAULT_DELEGATED_EMAIL
    service = get_gmail_service(delegated_email=effective_sender)
    if not service:
        print("[email_service] Error: No se pudo conectar a Gmail API para buscar rebotes.")
        return []

    try:
        query = 'from:mailer-daemon OR "Delivery Status Notification" OR "Address not found" OR "Undelivered Mail Returned to Sender"'
        resp = service.users().messages().list(userId="me", q=query, maxResults=max_results).execute()
        messages = resp.get("messages", [])

        bounces: List[Dict[str, Any]] = []
        for m in messages:
            msg_id = m.get("id")
            detail = service.users().messages().get(userId="me", id=msg_id, format="full").execute()
            headers = {h["name"].lower(): h["value"] for h in detail.get("payload", {}).get("headers", [])}

            snippet = detail.get("snippet", "")
            subject = headers.get("subject", "")
            date_str = headers.get("date", "")

            # Extraer direcciones de email dentro del snippet
            found_emails = re.findall(r'[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+', snippet)
            target_emails = [
                em.lower() for em in found_emails 
                if em.lower() not in ["inversionistas@inandes.com", "inandes@outlook.es", "mailer-daemon@googlemail.com"]
            ]

            target_email = target_emails[0] if target_emails else None

            # Fallback en headers
            if not target_email:
                raw_to = headers.get("to", "")
                if "mailer-daemon" not in raw_to.lower() and "@" in raw_to:
                    match_to = re.search(r'[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+', raw_to)
                    if match_to:
                        cand = match_to.group(0).lower()
                        if cand not in ["inversionistas@inandes.com", "inandes@outlook.es"]:
                            target_email = cand

            if target_email:
                bounces.append({
                    "gmail_msg_id": msg_id,
                    "email_rebotado": target_email,
                    "subject": subject,
                    "fecha_rebote": date_str,
                    "snippet": snippet,
                    "motivo_rebote": snippet
                })

        return bounces
    except Exception as e:
        print(f"[email_service] Error obteniendo rebotes de Gmail: {e}")
        return []

