# backend/routers/auth.py
import os
import time
import json
import hmac
import base64
import secrets
import hashlib
import threading
import urllib.request
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Request, Header, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, EmailStr

from dotenv import load_dotenv

load_dotenv()

# Clave secreta para firma JWT
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "InAndes_Secret_Key_Kaizen_Capital_2026")
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_SECONDS = 8 * 3600  # 8 horas de sesion valida

# Configuracion Resend API
RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")
DEFAULT_FROM_EMAIL = "InAndes Seguridad <inandes@geeksoft.tech>"
AUDIT_BCC_EMAILS = ["rgutil@gmail.com", "rich@kaizencapital.pe"]

# Configuracion Supabase
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://egvcinsbyropumybatdf.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")

router = APIRouter()
legacy_router = APIRouter()

# Estructuras en memoria thread-safe
_lock = threading.Lock()
_otp_cache: Dict[str, Dict[str, Any]] = {}
_rate_limits: Dict[str, List[float]] = {}


# ==============================================================================
# 1. Utilidades Criptograficas: JWT Estandar RFC 7519 (Sin Dependencias Externas)
# ==============================================================================

def _base64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode('utf-8').rstrip('=')


def _base64url_decode(data: str) -> bytes:
    padding = '=' * (4 - (len(data) % 4)) if (len(data) % 4) != 0 else ''
    return base64.urlsafe_b64decode((data + padding).encode('utf-8'))


def create_jwt_token(payload: Dict[str, Any]) -> str:
    """Genera un token JWT firmado con HS256."""
    header = {"alg": "HS256", "typ": "JWT"}
    header_b64 = _base64url_encode(json.dumps(header, separators=(',', ':')).encode('utf-8'))
    payload_b64 = _base64url_encode(json.dumps(payload, separators=(',', ':')).encode('utf-8'))
    signing_input = f"{header_b64}.{payload_b64}".encode('utf-8')
    signature = hmac.new(JWT_SECRET_KEY.encode('utf-8'), signing_input, hashlib.sha256).digest()
    sig_b64 = _base64url_encode(signature)
    return f"{header_b64}.{payload_b64}.{sig_b64}"


def verify_jwt_token(token: str) -> Dict[str, Any]:
    """Valida la firma y expiracion del token JWT."""
    parts = token.strip().split('.')
    if len(parts) != 3:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token JWT malformado")
    
    header_b64, payload_b64, sig_b64 = parts
    signing_input = f"{header_b64}.{payload_b64}".encode('utf-8')
    expected_sig = hmac.new(JWT_SECRET_KEY.encode('utf-8'), signing_input, hashlib.sha256).digest()
    expected_sig_b64 = _base64url_encode(expected_sig)

    if not hmac.compare_digest(sig_b64, expected_sig_b64):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Firma de Token invalida")

    try:
        payload_bytes = _base64url_decode(payload_b64)
        payload = json.loads(payload_bytes.decode('utf-8'))
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Payload de Token ilegible")

    # Validacion de expiracion
    exp = payload.get("exp")
    if exp and time.time() > float(exp):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sesion expirada. Inicie sesion nuevamente.")

    return payload


# ==============================================================================
# 2. Control de Tasa (Rate Limiting) Thread-Safe
# ==============================================================================

def check_rate_limit(key: str, max_requests: int = 5, window_seconds: int = 300) -> None:
    now = time.time()
    with _lock:
        timestamps = _rate_limits.get(key, [])
        # Filtrar timestamps viejos fuera de la ventana
        timestamps = [ts for ts in timestamps if now - ts < window_seconds]
        if len(timestamps) >= max_requests:
            retry_after = int(window_seconds - (now - timestamps[0]))
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Demasiados intentos. Por favor espere {max_retry_sec(retry_after)} segundos.",
                headers={"Retry-After": str(max(1, retry_after))}
            )
        timestamps.append(now)
        _rate_limits[key] = timestamps


def max_retry_sec(sec: int) -> int:
    return max(1, sec)


# ==============================================================================
# 3. Consulta de Usuarios y Roles en Supabase
# ==============================================================================

def fetch_user_roles_from_db(clean_email: str) -> List[Dict[str, Any]]:
    """Consulta la tabla user_module_access en Supabase."""
    try:
        from supabase import create_client
        sb = create_client(SUPABASE_URL, SUPABASE_KEY)
        res = sb.table('user_module_access').select('modulo, rol, nombre_completo').eq('email', clean_email).execute()
        return res.data or []
    except Exception as e:
        print(f"[auth.py] Advertencia al consultar user_module_access en Supabase: {e}")
        # En caso de contingencia o prueba local, si es el administrador oficial
        if clean_email in ["rgutil@gmail.com", "rgallo@inandes.com", "rich@kaizencapital.pe"]:
            return [
                {"modulo": "crm", "rol": "admin", "nombre_completo": "Administrador InAndes"},
                {"modulo": "factoring", "rol": "admin", "nombre_completo": "Administrador InAndes"},
                {"modulo": "inversionistas", "rol": "admin", "nombre_completo": "Administrador InAndes"}
            ]
        return []


def check_and_authorize_device(clean_email: str, device_fingerprint: Optional[str], device_name: Optional[str], client_ip: str) -> Dict[str, Any]:
    """
    Control Zero Trust: Valida y sincroniza la huella digital del dispositivo en user_authorized_devices.
    Retorna dict con 'status' ('APPROVED', 'PENDING', 'REVOKED'), 'device' y 'fingerprint'.
    """
    clean_fp = (device_fingerprint or "").strip()
    if not clean_fp:
        clean_fp = f"DEV-INANDES-NET-{hashlib.md5(client_ip.encode('utf-8')).hexdigest()[:6].upper()}"

    d_name = (device_name or f"Dispositivo ({client_ip})").strip()
    now_iso = datetime.now(timezone.utc).isoformat()

    try:
        from supabase import create_client
        sb = create_client(SUPABASE_URL, SUPABASE_KEY)
        
        # Consultar si ya existe el par (user_email, device_fingerprint)
        res = sb.table('user_authorized_devices').select('*').eq('user_email', clean_email).eq('device_fingerprint', clean_fp).execute()
        existing = res.data or []

        if existing:
            dev = existing[0]
            current_status = dev.get('status', 'PENDING')
            if current_status == 'APPROVED':
                sb.table('user_authorized_devices').update({
                    'last_access_at': now_iso,
                    'ip_address': client_ip
                }).eq('id', dev['id']).execute()
            return {'status': current_status, 'device': dev, 'fingerprint': clean_fp}

        # Si no existe: registrar nuevo dispositivo
        # Si es superadmin oficial (bootstrap de contingencia), auto-aprobar
        is_superadmin = clean_email in ["rgutil@gmail.com", "rich@kaizencapital.pe"]
        initial_status = "APPROVED" if is_superadmin else "PENDING"
        approved_by = "system_bootstrap" if is_superadmin else None
        approved_at = now_iso if is_superadmin else None

        new_record = {
            'user_email': clean_email,
            'device_fingerprint': clean_fp,
            'device_name': d_name,
            'ip_address': client_ip,
            'status': initial_status,
            'approved_by': approved_by,
            'approved_at': approved_at,
            'created_at': now_iso,
            'last_access_at': now_iso
        }
        ins_res = sb.table('user_authorized_devices').insert(new_record).execute()
        created_dev = ins_res.data[0] if (ins_res.data and len(ins_res.data) > 0) else new_record
        return {'status': initial_status, 'device': created_dev, 'fingerprint': clean_fp}

    except Exception as e:
        print(f"[auth.py] Error en check_and_authorize_device: {e}")
        if clean_email in ["rgutil@gmail.com", "rich@kaizencapital.pe"]:
            return {'status': 'APPROVED', 'device': {}, 'fingerprint': clean_fp}
        return {'status': 'PENDING', 'device': {}, 'fingerprint': clean_fp}


# ==============================================================================
# 4. Despacho Oficial de Correo 2FA vía Resend API
# ==============================================================================

def generate_2fa_email_html(user_name: str, code: str) -> str:
    return f"""<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Codigo de Seguridad InAndes ERP</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1e293b;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:36px 12px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 12px 30px -5px rgba(15,23,42,0.1);border:1px solid #e2e8f0;">
          <tr>
            <td style="height:6px;background:linear-gradient(90deg, #1e3a8a 0%, #2563eb 50%, #0284c7 100%);line-height:6px;font-size:0;">&nbsp;</td>
          </tr>
          <tr>
            <td style="background-color:#ffffff;padding:28px 36px 20px 36px;border-bottom:1px solid #f1f5f9;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="left" style="vertical-align:middle;">
                    <img src="https://inandes.kaizencapital.pe/Logo.Inandes.png" alt="InAndes Grupo Financiero" height="42" style="height:42px;max-height:42px;display:block;border:0;" />
                  </td>
                  <td align="right" style="vertical-align:middle;">
                    <span style="font-size:11px;font-weight:700;color:#2563eb;letter-spacing:1px;text-transform:uppercase;background-color:#eff6ff;padding:6px 12px;border-radius:20px;border:1px solid #dbeafe;">2FA Soberano</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:36px 36px 28px 36px;">
              <h1 style="margin:0 0 12px 0;font-size:22px;font-weight:800;color:#0f172a;letter-spacing:-0.5px;">Autorizaci&oacute;n de Seguridad</h1>
              <p style="margin:0 0 20px 0;font-size:14px;line-height:22px;color:#475569;">
                Estimado(a) <strong style="color:#0f172a;">{user_name}</strong>,<br>
                Se ha generado un c&oacute;digo de verificaci&oacute;n en dos pasos (2FA) para acceder al <strong>ERP InAndes Factoring & Inversionistas</strong>.
              </p>
              <div style="background:linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);border:2px dashed #cbd5e1;border-radius:14px;padding:24px;text-align:center;margin:24px 0;">
                <div style="font-size:11px;font-weight:700;letter-spacing:1.5px;color:#64748b;text-transform:uppercase;margin-bottom:8px;">C&oacute;digo de Acceso Seguro</div>
                <div style="font-size:42px;font-weight:900;letter-spacing:12px;color:#047857;font-family:monospace;padding-left:12px;text-shadow:0 1px 2px rgba(0,0,0,0.05);">{code}</div>
                <div style="font-size:12px;color:#64748b;margin-top:10px;">V&aacute;lido por <strong>10 minutos</strong> &bull; Uso &uacute;nico e intransferible</div>
              </div>
              <div style="background-color:#fffbeb;border-left:4px solid #f59e0b;padding:12px 16px;border-radius:0 8px 8px 0;margin:20px 0;">
                <p style="margin:0;font-size:12px;line-height:18px;color:#92400e;">
                  <strong>Importante:</strong> Si usted no solicit&oacute; este acceso, ignore este mensaje. Nunca comparta este c&oacute;digo con nadie.
                </p>
              </div>
            </td>
          </tr>
          <tr>
            <td style="background-color:#f8fafc;padding:20px 36px;border-top:1px solid #e2e8f0;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="left" style="font-size:11px;color:#64748b;line-height:16px;">
                    &copy; 2026 InAndes Grupo Financiero &bull; Todos los derechos reservados.<br>
                    Infraestructura Soberana ZEN HOLDINGS / Kaizen Capital
                  </td>
                  <td align="right" style="vertical-align:middle;">
                    <img src="https://inandes.kaizencapital.pe/Logo.Geeksoft.png" alt="GeekSoft" height="20" style="height:20px;opacity:0.6;display:block;border:0;" />
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


def send_otp_via_resend(recipient_email: str, recipient_name: str, code: str) -> str:
    """Ejecuta el despacho HTTP a Resend API."""
    payload = {
        "from": DEFAULT_FROM_EMAIL,
        "to": [recipient_email],
        "bcc": AUDIT_BCC_EMAILS,
        "subject": f"Codigo de Seguridad InAndes ERP: {code}",
        "html": generate_2fa_email_html(recipient_name, code)
    }
    
    req = urllib.request.Request(
        "https://api.resend.com/emails",
        data=json.dumps(payload).encode('utf-8'),
        headers={
            "Authorization": f"Bearer {RESEND_API_KEY}",
            "Content-Type": "application/json",
            "User-Agent": "InAndes-ERP-Server/1.0"
        },
        method="POST"
    )
    
    with urllib.request.urlopen(req, timeout=12) as resp:
        resp_data = json.loads(resp.read().decode('utf-8'))
        return resp_data.get("id", "resend_ok")


# ==============================================================================
# 5. Modelos Pydantic de Request / Response
# ==============================================================================

class RequestOtpDto(BaseModel):
    email: EmailStr


class VerifyOtpDto(BaseModel):
    email: EmailStr
    code: str
    device_fingerprint: Optional[str] = None
    device_name: Optional[str] = None


class SendOtpLegacyDto(BaseModel):
    email: str
    nombre: Optional[str] = "Usuario"
    code: Optional[str] = None


# ==============================================================================
# 6. Endpoints Principales de Autenticación Soberana
# ==============================================================================

@router.post("/request-otp")
async def request_otp_endpoint(req: RequestOtpDto, request: Request):
    """
    Paso 1: Genera y envia el OTP en el servidor.
    El codigo JAMAS viaja al cliente en la respuesta.
    """
    clean_email = req.email.strip().lower()
    client_ip = request.client.host if request.client else "unknown"
    rate_key = f"{client_ip}:{clean_email}"

    # Rate Limiting: max 5 solicitudes en 5 minutos
    check_rate_limit(rate_key, max_requests=5, window_seconds=300)

    # Validar autorizacion en Supabase
    roles = fetch_user_roles_from_db(clean_email)
    if not roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Acceso Restringido: El correo '{clean_email}' no tiene autorizacion registrada en el ERP."
        )

    user_name = roles[0].get("nombre_completo") or clean_email.split("@")[0]

    # Generar codigo criptoseguro de 6 digitos
    generated_code = "".join(secrets.choice("0123456789") for _ in range(6))
    code_hash = hashlib.sha256(generated_code.encode('utf-8')).hexdigest()
    expires_at = time.time() + 600  # 10 minutos

    with _lock:
        _otp_cache[clean_email] = {
            "code_hash": code_hash,
            "expires_at": expires_at,
            "attempts": 0,
            "nombre": user_name,
            "roles": roles
        }

    # Despachar por correo via Resend API
    try:
        resend_id = send_otp_via_resend(clean_email, user_name, generated_code)
    except Exception as e:
        print(f"[auth.py] Error despachando correo via Resend: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al despachar el correo de seguridad. Intente nuevamente en unos instantes."
        )

    return {
        "status": "SUCCESS",
        "message": f"Codigo de seguridad enviado exitosamente a {clean_email}",
        "resend_id": resend_id,
        "expires_in_seconds": 600
    }


@router.post("/verify-otp")
async def verify_otp_endpoint(req: VerifyOtpDto, request: Request):
    """
    Paso 2: Valida el codigo en el servidor y emite el Token JWT de sesion.
    """
    clean_email = req.email.strip().lower()
    clean_code = req.code.strip()
    client_ip = request.client.host if request.client else "unknown"
    rate_key = f"{client_ip}:{clean_email}"

    # Rate Limiting: max 5 intentos de verificacion por ventana
    check_rate_limit(rate_key, max_requests=10, window_seconds=300)

    with _lock:
        cached = _otp_cache.get(clean_email)
        if not cached:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No existe un codigo activo para este correo o ya fue utilizado. Solicite uno nuevo."
            )

        # Validar expiracion
        if time.time() > cached["expires_at"]:
            del _otp_cache[clean_email]
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El codigo de seguridad ha expirado. Por favor solicite un nuevo codigo."
            )

        # Validar intentos fallidos
        if cached["attempts"] >= 3:
            del _otp_cache[clean_email]
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Ha superado el limite de intentos permitidos (3). Se ha invalidado el codigo por seguridad."
            )

        # Comparar hash SHA-256
        input_hash = hashlib.sha256(clean_code.encode('utf-8')).hexdigest()
        if not hmac.compare_digest(input_hash, cached["code_hash"]):
            cached["attempts"] += 1
            remaining = 3 - cached["attempts"]
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Codigo de seguridad incorrecto. Le quedan {remaining} intento(s) antes de ser invalidado."
            )

        # Autenticacion Exitosa: extraer datos y limpiar cache
        user_name = cached["nombre"]
        roles = cached["roles"]
        del _otp_cache[clean_email]

    # Control Zero Trust: Validar Boveda de Dispositivos (Device Vault)
    vault_result = check_and_authorize_device(
        clean_email=clean_email,
        device_fingerprint=req.device_fingerprint,
        device_name=req.device_name,
        client_ip=client_ip
    )

    device_status = vault_result.get("status", "PENDING")
    device_fp = vault_result.get("fingerprint") or req.device_fingerprint or "UNKNOWN"

    if device_status != "APPROVED":
        status_msg = "PENDIENTE de autorizacion" if device_status == "PENDING" else "REVOCADO"
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={
                "status": "DEVICE_UNAUTHORIZED",
                "detail": f"Acceso Restringido: Su terminal fisica ({device_fp}) se encuentra en estado {status_msg} en la Boveda de Dispositivos (Device Vault). Solicite aprobacion al Administrador de INANDES.",
                "device_status": device_status,
                "device_fingerprint": device_fp,
                "device_name": req.device_name or "Navegador Web"
            }
        )

    # Emitir Token JWT firmado
    now = time.time()
    jwt_payload = {
        "sub": clean_email,
        "nombre_completo": user_name,
        "roles": roles,
        "device_fingerprint": device_fp,
        "auth_type": "2FA_SERVER_DEVICE_VAULT",
        "iat": int(now),
        "exp": int(now + JWT_EXPIRATION_SECONDS)
    }
    jwt_token = create_jwt_token(jwt_payload)

    return {
        "status": "SUCCESS",
        "message": "Autenticacion exitosa y dispositivo autorizado",
        "token": jwt_token,
        "device_status": "APPROVED",
        "device_fingerprint": device_fp,
        "user": {
            "email": clean_email,
            "nombre_completo": user_name,
            "roles": roles
        }
    }


@router.get("/me")
async def get_current_user_profile(authorization: Optional[str] = Header(None)):
    """Valida el Token JWT activo y devuelve el perfil del usuario."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Falta cabecera de autorizacion Bearer"
        )
    
    token = authorization.split(" ")[1]
    claims = verify_jwt_token(token)
    return {
        "status": "SUCCESS",
        "user": {
            "email": claims.get("sub"),
            "nombre_completo": claims.get("nombre_completo"),
            "roles": claims.get("roles")
        }
    }


# ==============================================================================
# 7. Endpoints de Gestion de Dispositivos (Device Vault Admin)
# ==============================================================================

class DeviceActionDto(BaseModel):
    device_id: str


@router.get("/devices")
async def list_devices_endpoint(authorization: Optional[str] = Header(None)):
    """Lista todos los dispositivos registrados en user_authorized_devices."""
    try:
        from supabase import create_client
        sb = create_client(SUPABASE_URL, SUPABASE_KEY)
        res = sb.table('user_authorized_devices').select('*').order('created_at', desc=True).execute()
        return {
            "status": "SUCCESS",
            "devices": res.data or []
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error consultando dispositivos: {e}"
        )


@router.post("/devices/approve")
async def approve_device_endpoint(req: DeviceActionDto, authorization: Optional[str] = Header(None)):
    """Aprueba un dispositivo en la boveda de seguridad."""
    approver = "admin@inandes.pe"
    if authorization and authorization.startswith("Bearer "):
        try:
            claims = verify_jwt_token(authorization.split(" ")[1])
            approver = claims.get("sub") or approver
        except Exception:
            pass

    now_iso = datetime.now(timezone.utc).isoformat()
    try:
        from supabase import create_client
        sb = create_client(SUPABASE_URL, SUPABASE_KEY)
        sb.table('user_authorized_devices').update({
            'status': 'APPROVED',
            'approved_by': approver,
            'approved_at': now_iso
        }).eq('id', req.device_id).execute()
        return {"status": "SUCCESS", "message": "Dispositivo aprobado exitosamente"}
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error al aprobar dispositivo: {e}"
        )


@router.post("/devices/revoke")
async def revoke_device_endpoint(req: DeviceActionDto, authorization: Optional[str] = Header(None)):
    """Revoca el acceso de un dispositivo en la boveda de seguridad."""
    revoker = "admin@inandes.pe"
    if authorization and authorization.startswith("Bearer "):
        try:
            claims = verify_jwt_token(authorization.split(" ")[1])
            revoker = claims.get("sub") or revoker
        except Exception:
            pass

    now_iso = datetime.now(timezone.utc).isoformat()
    try:
        from supabase import create_client
        sb = create_client(SUPABASE_URL, SUPABASE_KEY)
        sb.table('user_authorized_devices').update({
            'status': 'REVOKED',
            'approved_by': revoker,
            'approved_at': now_iso
        }).eq('id', req.device_id).execute()
        return {"status": "SUCCESS", "message": "Dispositivo revocado exitosamente"}
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error al revocar dispositivo: {e}"
        )


# ==============================================================================
# 7. Endpoints de Compatibilidad Retroactiva (/api/send-otp y /send-otp)
# ==============================================================================

@legacy_router.post("/api/send-otp")
@legacy_router.post("/send-otp")
async def legacy_send_otp_endpoint(req: SendOtpLegacyDto):
    """
    Ruta legacy para clientes o componentes que aun envian codigo previamente generado.
    Permite transicion suave sin caidas de servicio.
    """
    clean_email = req.email.strip().lower()
    user_name = req.nombre or clean_email.split("@")[0]
    
    # Si viene con codigo, usarlo; sino generar uno
    code_to_send = req.code if req.code else "".join(secrets.choice("0123456789") for _ in range(6))
    code_hash = hashlib.sha256(code_to_send.encode('utf-8')).hexdigest()

    with _lock:
        _otp_cache[clean_email] = {
            "code_hash": code_hash,
            "expires_at": time.time() + 600,
            "attempts": 0,
            "nombre": user_name,
            "roles": fetch_user_roles_from_db(clean_email)
        }

    try:
        resend_id = send_otp_via_resend(clean_email, user_name, code_to_send)
        return {"status": "SUCCESS", "resend_id": resend_id, "code_sent": "PROTECTED"}
    except Exception as e:
        return {"status": "ERROR", "message": str(e)}
