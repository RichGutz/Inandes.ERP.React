import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.application import MIMEApplication
import streamlit as st
import os

def send_email_with_attachments(to_email: str, subject: str, body: str, attachments: list = None, cc_email: str = ""):
    """
    Sends an email with optional attachments using SMTP credentials from st.secrets.
    
    Args:
        to_email (str): Recipient email address (can be comma separated).
        subject (str): Email subject.
        body (str): Email body text.
        attachments (list): List of dicts [{'name': 'filename.pdf', 'bytes': b'...'}]
        cc_email (str): CC email address (can be comma separated).
    
    Returns:
        tuple: (bool, str) -> (Success, Message)
    """
    try:
        # Read SMTP credentials from environment variables
        smtp_server = os.getenv('SMTP_SERVER')
        smtp_port = int(os.getenv('SMTP_PORT', '587'))
        smtp_user = os.getenv('SMTP_USER')
        smtp_password = os.getenv('SMTP_PASSWORD')

        if not all([smtp_server, smtp_user, smtp_password]):
            raise ValueError("Una o más variables de entorno SMTP (SMTP_SERVER, SMTP_USER, SMTP_PASSWORD) no están definidas.")

    except Exception as e:
        return False, f"Configuración SMTP faltante o incorrecta en las variables de entorno: {e}"

    # Helper to clean and split email strings
    def regex_split_emails(email_str):
        if not email_str: return []
        # Replace semicolons with commas and split
        return [e.strip() for e in email_str.replace(';', ',').split(',') if e.strip()]

    to_list = regex_split_emails(to_email)
    cc_list = regex_split_emails(cc_email)
    
    if not to_list:
        return False, "No se ha definido ningún destinatario (TO)."

    msg = MIMEMultipart()
    msg['From'] = smtp_user
    msg['To'] = ", ".join(to_list)
    msg['Subject'] = subject
    
    if cc_list:
        msg['Cc'] = ", ".join(cc_list)

    msg.attach(MIMEText(body, 'plain'))

    if attachments:
        for att in attachments:
            try:
                part = MIMEApplication(att['bytes'], Name=att['name'])
                part['Content-Disposition'] = f'attachment; filename="{att["name"]}"'
                msg.attach(part)
            except Exception as e:
                return False, f"Error adjuntando archivo {att.get('name', 'bqe')}: {e}"

    try:
        # Connect to server
        server = smtplib.SMTP(smtp_server, smtp_port)
        server.starttls()
        server.login(smtp_user, smtp_password)
        text = msg.as_string()
        
        # Envelope recipients must include TO and CC
        recipients = to_list + cc_list
        
        server.sendmail(smtp_user, recipients, text)
        server.quit()
        return True, "Email enviado correctamente."
    except Exception as e:
        return False, f"Error enviando email: {e}"
