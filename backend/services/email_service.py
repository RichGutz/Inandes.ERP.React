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
    1. Service Account con Domain-Wide Delegation (inversionistas@inandes.com) [OFICIAL].
    2. OAuth2 Token existente (fallback/desarrollo).
    """
    # 1. Intentar con Service Account DWD oficial
    if GMAIL_SA_PATH.exists():
        try:
            creds = service_account.Credentials.from_service_account_file(
                str(GMAIL_SA_PATH),
                scopes=["https://mail.google.com/"]
            ).with_subject(delegated_email)
            return build('gmail', 'v1', credentials=creds)
        except Exception as e:
            print(f"[email_service] Error inicializando Service Account DWD: {e}")

    # 2. Fallback a Token OAuth2 previo
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


def send_email(
    to_email: str,
    subject: str,
    html_body: str,
    attachments: Optional[List[Dict[str, Any]]] = None,
    cc_email: str = "rgutil@gmail.com",
    sender_email: Optional[str] = None,
    sender_name: str = DEFAULT_SENDER_NAME,
    ribbon_path: Optional[str] = None
) -> Tuple[bool, str]:
    """
    Envía un correo con diseño HTML, imagen embebida (ribbon) y archivos adjuntos (PDFs).
    
    attachments: [
        {"filename": "EECC_XXX.pdf", "content_bytes": b'...'},
        {"filename": "Retencion_XXX.pdf", "content_bytes": b'...'}
    ]
    """
    effective_sender = sender_email or DEFAULT_DELEGATED_EMAIL
    service = get_gmail_service(delegated_email=effective_sender)
    if not service:
        # Fallback a SMTP si no hay Google API
        return _send_via_smtp(to_email, subject, html_body, attachments, cc_email, effective_sender, sender_name)

    try:
        msg = MIMEMultipart("mixed")
        msg["To"] = to_email
        if cc_email:
            msg["Cc"] = cc_email
        
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
        return False, f"Error enviando correo vía Gmail API: {str(e)}"


def _send_via_smtp(
    to_email: str,
    subject: str,
    html_body: str,
    attachments: Optional[List[Dict[str, Any]]] = None,
    cc_email: str = "",
    sender_email: Optional[str] = None,
    sender_name: str = DEFAULT_SENDER_NAME
) -> Tuple[bool, str]:
    """Envío alternativo vía servidor SMTP."""
    smtp_server = os.getenv("SMTP_SERVER", "smtp.gmail.com")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = sender_email or os.getenv("SMTP_USER", "")
    smtp_password = os.getenv("SMTP_PASSWORD", "")

    if not smtp_user or not smtp_password:
        return False, "No se configuraron credenciales SMTP válidas (SMTP_USER / SMTP_PASSWORD)."

    try:
        msg = MIMEMultipart("mixed")
        msg["To"] = to_email
        if cc_email:
            msg["Cc"] = cc_email
        msg["From"] = f"{sender_name} <{smtp_user}>"
        msg["Subject"] = subject

        msg.attach(MIMEText(html_body, "html", "utf-8"))

        if attachments:
            for att in attachments:
                part = MIMEBase("application", "octet-stream")
                part.set_payload(att.get("content_bytes"))
                encoders.encode_base64(part)
                part.add_header("Content-Disposition", f'attachment; filename="{att.get("filename")}"')
                msg.attach(part)

        recipients = [to_email] + ([cc_email] if cc_email else [])
        server = smtplib.SMTP(smtp_server, smtp_port)
        server.starttls()
        server.login(smtp_user, smtp_password)
        server.sendmail(smtp_user, recipients, msg.as_string())
        server.quit()
        return True, f"Correo enviado vía SMTP a {to_email}"
    except Exception as err:
        return False, f"Error enviando correo vía SMTP: {str(err)}"
