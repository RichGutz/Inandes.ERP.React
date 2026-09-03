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

# Directivos Destinatarios Fijos
PHONE_RICARDO_GALLO = "51992778175"   # Juan Ricardo Gallo Pizarro (GG)
PHONE_YANNETH_PARRA = "51979781204"   # Gladys Yanneth Parra Forero (GC)


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
        fallback_url = f"https://inandes.geeksoft.tech/wa-api/message/sendText/{INSTANCE_NAME}"
        try:
            req_fb = urllib.request.Request(fallback_url, data=json.dumps(payload).encode("utf-8"), headers=headers, method="POST")
            with urllib.request.urlopen(req_fb, timeout=15) as resp_fb:
                return resp_fb.status in (200, 201)
        except Exception as fb_err:
            print(f"[WARN] Error dispatching WhatsApp to {clean_phone}: {e} | Fallback: {fb_err}")
            return False


def get_already_alerted_today(today_str: str) -> set:
    url = f"{SUPABASE_URL}/rest/v1/auditoria_eventos?accion=eq.WHATSAPP_ALERTA_VENCIMIENTO&select=entidad_id,timestamp"
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


def log_expiration_alert_event(contract_id: str, success_count: int, total_dest: int, details: dict):
    url = f"{SUPABASE_URL}/rest/v1/auditoria_eventos"
    payload = {
        "usuario_id": "CRON_BOT_VENCIMIENTOS",
        "entidad_id": str(contract_id),
        "accion": "WHATSAPP_ALERTA_VENCIMIENTO",
        "estado_anterior": "PENDIENTE",
        "estado_nuevo": "ENVIADO" if success_count > 0 else "ERROR_ENVIO",
        "detalles_adicionales": json.dumps(details, ensure_ascii=False)
    }
    req = urllib.request.Request(url, data=json.dumps(payload).encode("utf-8"), headers=get_headers(), method="POST")
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            pass
    except Exception as e:
        print(f"[WARN] Error recording auditoria_eventos for {contract_id}: {e}")


def run_contract_expirations_cron():
    today = datetime.date.today()
    today_str = today.strftime("%Y-%m-%d")
    print(f"[INFO] Running Expiration Alerts Cron for Date: {today_str}")

    # 1. Fetch inversionistas map
    url_inv = f"{SUPABASE_URL}/rest/v1/crm_inversionistas?select=documento_identidad,codigo_inversionista,nombre_completo,telefono"
    req_inv = urllib.request.Request(url_inv, headers=get_headers())
    with urllib.request.urlopen(req_inv, timeout=20) as resp:
        investors = json.loads(resp.read().decode("utf-8"))

    inv_map = {}
    for i in investors:
        name = i.get("nombre_completo") or "Inversionista"
        if i.get("documento_identidad"):
            inv_map[str(i["documento_identidad"]).strip()] = i
        if i.get("codigo_inversionista"):
            inv_map[str(i["codigo_inversionista"]).strip()] = i

    # 2. Fetch asesores map
    url_as = f"{SUPABASE_URL}/rest/v1/crm_asesores?select=*"
    req_as = urllib.request.Request(url_as, headers=get_headers())
    with urllib.request.urlopen(req_as, timeout=20) as resp:
        asesores = json.loads(resp.read().decode("utf-8"))

    asesor_map = {}
    for a in asesores:
        as_id = str(a.get("id_asesor") or "").strip()
        as_name = str(a.get("nombre_completo") or "").strip()
        if as_id:
            asesor_map[as_id] = a
        if as_name:
            asesor_map[as_name.lower()] = a

    # 3. Fetch active contracts
    url_c = f"{SUPABASE_URL}/rest/v1/crm_contratos?select=*"
    req_c = urllib.request.Request(url_c, headers=get_headers())
    with urllib.request.urlopen(req_c, timeout=20) as resp:
        contracts = json.loads(resp.read().decode("utf-8"))

    # 4. Get already alerted today set
    alerted_today = get_already_alerted_today(today_str)
    print(f"[INFO] Found {len(alerted_today)} contracts already alerted today.")

    # 5. Filter contracts expiring in <= 30 days
    expiring_list = []
    for c in contracts:
        status = str(c.get("estado", "")).lower()
        if status in ("cerrado", "cerrado_por_rescate", "anulado", "borrador"):
            continue

        f_fin = c.get("fecha_fin")
        if not f_fin:
            continue

        try:
            fin_date = datetime.date.fromisoformat(str(f_fin).split("T")[0])
            days_remaining = (fin_date - today).days
            if 0 <= days_remaining <= 30:
                expiring_list.append({
                    "contract": c,
                    "fin_date": fin_date,
                    "days_remaining": days_remaining
                })
        except Exception:
            continue

    print(f"[INFO] Found {len(expiring_list)} contracts expiring within 30 days.")

    # 6. Dispatch Tripartite Alerts
    dispatched_contracts = 0
    for item in expiring_list:
        c = item["contract"]
        cid = c.get("id_contrato")
        if not cid or cid in alerted_today:
            print(f"[INFO] Skipping contract {cid} (already alerted today).")
            continue

        inv_doc = c.get("id_inversionista_1") or ""
        inv_data = inv_map.get(str(inv_doc).strip(), {})
        inv_name = inv_data.get("nombre_completo") or "Inversionista"

        as_key = str(c.get("id_asesor") or "").strip()
        asesor_data = asesor_map.get(as_key) or asesor_map.get(as_key.lower()) or {}
        asesor_name = asesor_data.get("nombre_completo") or c.get("id_asesor") or "Asesor Principal"
        asesor_phone = asesor_data.get("telefono") or ""

        monto_fmt = f"{float(c.get('monto_inversion', 0)):,.2f}"
        moneda = c.get("moneda") or "USD"
        tasa = c.get("tasa_pactada") or "N/D"
        fondo = c.get("id_fondo") or "Fondo"
        f_ini = str(c.get("fecha_inicio", "")).split("T")[0]
        f_fin_str = str(c.get("fecha_fin", "")).split("T")[0]
        days_rem = item["days_remaining"]

        message_text = (
            f"⚠️ *ALERTA DE VENCIMIENTO DE CONTRATO (InAndes CRM)* 🏛️\n\n"
            f"Se informa que el siguiente contrato se encuentra próximo a vencer:\n\n"
            f"📋 *Contrato:* `{cid}`\n"
            f"👤 *Inversionista:* {inv_name} (Doc: {inv_doc})\n"
            f"💰 *Monto de Inversión:* *{moneda} {monto_fmt}*\n"
            f"🏦 *Fondo:* {fondo} | *Tasa:* {tasa}%\n"
            f"📅 *Fecha de Inicio:* {f_ini}\n"
            f"🏁 *Fecha de Vencimiento:* *{f_fin_str}*\n"
            f"⏳ *Tiempo Restante:* *{days_rem} días*\n"
            f"👔 *Asesor Responsable:* {asesor_name}\n\n"
            f"📌 *Acción requerida:* Coordinar gestión comercial de renovación o provisión de rescate."
        )

        # Destinatarios:
        destinations = [
            ("Juan Ricardo Gallo Pizarro (GG)", PHONE_RICARDO_GALLO),
            ("Gladys Yanneth Parra Forero (GC)", PHONE_YANNETH_PARRA)
        ]

        if asesor_phone:
            clean_as_phone = "".join(filter(str.isdigit, asesor_phone))
            if clean_as_phone and len(clean_as_phone) >= 8:
                destinations.append((f"Asesor: {asesor_name}", clean_as_phone))

        success_count = 0
        dest_logs = []
        for name_dest, p_dest in destinations:
            print(f"[DISPATCH] Sending expiration alert for {cid} to {name_dest} ({p_dest})...")
            sent = send_whatsapp_message(p_dest, message_text)
            dest_logs.append({"destinatario": name_dest, "telefono": p_dest, "enviado": sent})
            if sent:
                success_count += 1

        log_expiration_alert_event(cid, success_count, len(destinations), {
            "contrato": cid,
            "inversionista": inv_name,
            "dias_restantes": days_rem,
            "fecha_fin": f_fin_str,
            "destinatarios": dest_logs
        })

        if success_count > 0:
            dispatched_contracts += 1

    print(f"[SUCCESS] Contract Expiration Alerts Cron Completed. Processed: {dispatched_contracts}/{len(expiring_list)}.")


if __name__ == "__main__":
    run_contract_expirations_cron()
