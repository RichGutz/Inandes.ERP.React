import os
import json
import datetime
import urllib.request
import urllib.parse

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://egvcinsbyropumybatdf.supabase.co")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVndmNpbnNieXJvcHVteWJhdGRmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDA0NDczNCwiZXhwIjoyMDk5NjIwNzM0fQ.28T_xQmSRJO1O1scio61JU0KHhEQfzSS94qYka8TrcA")

EVOLUTION_API_URL = os.environ.get("EVOLUTION_API_URL", "http://127.0.0.1:8080")
EVOLUTION_API_KEY = os.environ.get("EVOLUTION_API_KEY", "InandesSecretWA2026!")
INSTANCE_NAME = os.environ.get("INSTANCE_NAME", "inandes_oficial")


def get_headers():
    return {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json"
    }


def send_whatsapp_message(phone: str, text: str) -> bool:
    clean_phone = "".join(filter(str.isdigit, phone))
    if not clean_phone.startswith("51"):
        clean_phone = f"51{clean_phone}"

    url = f"{EVOLUTION_API_URL}/message/sendText/{INSTANCE_NAME}"
    headers = {
        "apikey": EVOLUTION_API_KEY,
        "Content-Type": "application/json"
    }
    payload = {
        "number": clean_phone,
        "text": text
    }

    req = urllib.request.Request(url, data=json.dumps(payload).encode("utf-8"), headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return resp.status in (200, 201)
    except Exception as e:
        # Fallback to public domain if local fails
        fallback_url = f"https://inandes.geeksoft.tech/wa-api/message/sendText/{INSTANCE_NAME}"
        try:
            req_fb = urllib.request.Request(fallback_url, data=json.dumps(payload).encode("utf-8"), headers=headers, method="POST")
            with urllib.request.urlopen(req_fb, timeout=15) as resp_fb:
                return resp_fb.status in (200, 201)
        except Exception as fb_err:
            print(f"[WARN] Error dispatching WhatsApp to {clean_phone}: {e} | Fallback: {fb_err}")
            return False


def get_already_sent_today(today_str: str) -> set:
    url = f"{SUPABASE_URL}/rest/v1/auditoria_eventos?accion=eq.WHATSAPP_SALUDO_CUMPLEANOS&select=entidad_id,timestamp"
    req = urllib.request.Request(url, headers=get_headers())
    sent_set = set()
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            for row in data:
                ts = row.get("timestamp", "")
                if ts.startswith(today_str):
                    sent_set.add(str(row.get("entidad_id", "")))
    except Exception as e:
        print(f"[WARN] Error fetching auditoria_eventos: {e}")
    return sent_set


def log_birthday_event(inv_doc: str, inv_name: str, phone: str, success: bool, details: dict):
    url = f"{SUPABASE_URL}/rest/v1/auditoria_eventos"
    payload = {
        "usuario_id": "CRON_BOT_AUTOMATICO",
        "entidad_id": str(inv_doc),
        "accion": "WHATSAPP_SALUDO_CUMPLEANOS",
        "estado_anterior": "PENDIENTE",
        "estado_nuevo": "ENVIADO" if success else "ERROR_ENVIO",
        "detalles_adicionales": json.dumps(details, ensure_ascii=False)
    }
    req = urllib.request.Request(url, data=json.dumps(payload).encode("utf-8"), headers=get_headers(), method="POST")
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            pass
    except Exception as e:
        print(f"[WARN] Error recording auditoria_eventos for {inv_doc}: {e}")


def run_birthday_greetings():
    today = datetime.date.today()
    today_str = today.strftime("%Y-%m-%d")
    current_month = today.month
    current_day = today.day

    print(f"[INFO] Running Birthday Cron for Date: {today_str} (Month: {current_month}, Day: {current_day})")

    # 1. Fetch all inversionistas
    url_inv = f"{SUPABASE_URL}/rest/v1/crm_inversionistas?select=*"
    req_inv = urllib.request.Request(url_inv, headers=get_headers())
    with urllib.request.urlopen(req_inv, timeout=20) as resp:
        investors = json.loads(resp.read().decode("utf-8"))

    # 2. Get already sent set
    sent_today = get_already_sent_today(today_str)
    print(f"[INFO] Found {len(sent_today)} greetings already recorded today.")

    # 3. Filter birthday celebrants today
    birthday_list = []
    for inv in investors:
        dob = inv.get("fecha_nacimiento")
        if not dob:
            continue
        try:
            parts = str(dob).split("-")
            if len(parts) == 3:
                b_month = int(parts[1])
                b_day = int(parts[2])
                if b_month == current_month and b_day == current_day:
                    birthday_list.append(inv)
        except Exception:
            continue

    print(f"[INFO] Found {len(birthday_list)} investors with birthday today.")

    # 4. Dispatch greetings
    dispatched_count = 0
    for inv in birthday_list:
        doc = inv.get("documento_identidad") or inv.get("codigo_inversionista")
        if not doc or str(doc) in sent_today:
            print(f"[INFO] Skipping {doc} (already processed today).")
            continue

        full_name = inv.get("nombre_completo") or f"{inv.get('nombre_1', '')} {inv.get('apellido_1', '')}".strip()
        first_name = inv.get("nombre_1") or full_name.split()[0] if full_name else "Estimado/a Partícipe"
        phone = inv.get("telefono") or ""

        clean_phone = "".join(filter(str.isdigit, phone))
        if not clean_phone or len(clean_phone) < 8:
            print(f"[WARN] No valid phone for {full_name} (Doc: {doc}). Recording error.")
            log_birthday_event(doc, full_name, phone, False, {"error": "TELEFONO_INVALIDO", "dob": inv.get("fecha_nacimiento")})
            continue

        message_text = (
            f"🎉 *¡FELIZ CUMPLEAÑOS DE PARTE DE INANDES!* 🎂\n\n"
            f"Estimad@ *{first_name}*,\n\n"
            f"En este día tan especial, todo el equipo directivo y profesional de *InAndes Grupo Financiero* le hace llegar un cálido y afectuoso saludo de cumpleaños. 🌟\n\n"
            f"Agradecemos profundamente su confianza continua como partícipe de nuestra institución y le deseamos un año lleno de salud, bienestar, prosperidad y grandes satisfacciones personales y familiares. 🥂\n\n"
            f"¡Que disfrute un excelente día en compañía de sus seres queridos!\n\n"
            f"Atentamente,\n*InAndes Grupo Financiero*"
        )

        print(f"[DISPATCH] Sending birthday WhatsApp to {full_name} ({clean_phone})...")
        success = send_whatsapp_message(clean_phone, message_text)
        log_birthday_event(doc, full_name, clean_phone, success, {
            "nombre": full_name,
            "telefono": clean_phone,
            "dob": inv.get("fecha_nacimiento"),
            "status": "ENVIADO_OK" if success else "FALLO_RED"
        })

        if success:
            dispatched_count += 1

    print(f"[SUCCESS] Birthday Cron Completed. Dispatched: {dispatched_count}/{len(birthday_list)}.")


if __name__ == "__main__":
    run_birthday_greetings()
