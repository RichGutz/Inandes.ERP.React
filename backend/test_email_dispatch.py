# backend/test_email_dispatch.py
"""
Script de prueba para despachar un correo de prueba de EECC + Retención
usando el servicio de Gmail API / OAuth2 previamente configurado.
"""
import os
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from services.email_service import send_email, get_gmail_service

def run_test():
    print("1. Verificando servicio de Gmail API...")
    srv = get_gmail_service()
    if not srv:
        print("[ERROR] No se pudo inicializar el servicio de Gmail.")
        return

    print("2. Conectado exitosamente con Gmail API.")
    print("3. Probando envío de correo de prueba con remitente predeterminado...")
    
    # Destinatario de prueba
    test_target = "rgutil@gmail.com"
    subject = "Prueba de Integración ERP InAndes - Envío de Reportes"
    html_content = """
    <html>
    <body style="font-family: Arial, sans-serif; background-color: #f4f7f6; padding: 20px;">
        <table width="600" align="center" style="background: white; border-radius: 8px; overflow: hidden; border: 1px solid #ddd;">
            <tr>
                <td style="background-color: #004d40; color: white; padding: 20px; text-align: center;">
                    <h2 style="margin: 0;">INANDES - ERP Inversionistas</h2>
                </td>
            </tr>
            <tr>
                <td style="padding: 25px; color: #333;">
                    <p>Hola Richard,</p>
                    <p>Este es un correo de prueba emitido automáticamente desde el nuevo backend unificado del <strong>ERP React + FastAPI</strong>.</p>
                    <p>El sistema ahora cuenta con:</p>
                    <ul>
                        <li>Generación en caliente de Estados de Cuenta (EECC).</li>
                        <li>Generación de Certificados de Retención de Renta de 2da Categoría.</li>
                        <li>Despacho automático vía Gmail API.</li>
                    </ul>
                    <p style="color: #666; font-size: 12px; margin-top: 30px;">
                        Enviado desde el servicio centralizado del ERP InAndes.
                    </p>
                </td>
            </tr>
        </table>
    </body>
    </html>
    """

    ok, msg = send_email(
        to_email=test_target,
        subject=subject,
        html_body=html_content,
        cc_email="",
        sender_name="INANDES ERP Inversionistas"
    )

    if ok:
        print(f"[EXITO] {msg}")
    else:
        print(f"[FALLO] {msg}")

if __name__ == "__main__":
    run_test()
