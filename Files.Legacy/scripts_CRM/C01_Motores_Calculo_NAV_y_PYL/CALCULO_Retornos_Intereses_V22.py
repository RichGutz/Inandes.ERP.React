import os
import sys
import pandas as pd
from datetime import date, timedelta, datetime
from collections import defaultdict

# Add project root to path
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from src.data.supabase_client import get_supabase_client

# --- CONFIGURACIÓN GLOBAL ---
BASE_DIAS = 365.0  # <--- FORZADO 365 DÍAS

def generate_retornos_v22(codigo_fondo=None, return_data=False):
    """
    Motor de Retornos v22.7 - DIAGNÓSTICO Y CORRECCIÓN FINAL.
    """
    supabase = get_supabase_client()
    fecha_inicio = date(2026, 1, 1)
    fecha_fin    = date(2026, 2, 28)
    dias_periodo = [fecha_inicio + timedelta(days=i) for i in range((fecha_fin - fecha_inicio).days + 1)]
    csv_headers_fechas = [d.strftime('%d/%m') for d in dias_periodo]

    print(f"🚀 Iniciando Motor V22.7 (BASE DIAS: {BASE_DIAS})...")

    # 1. Inversionistas
    inv_res = supabase.table('crm_inversionistas').select('*').execute()
    inv_map = {}
    print(f"DEBUG: Cargando {len(inv_res.data)} inversionistas...")
    for i in inv_res.data:
        full_name = i.get('nombre_completo') or f"{i.get('nombre_1','')} {i.get('apellido_1','')}".strip()
        # Mapeamos TODO para no fallar
        for key in ['id', 'uuid', 'documento_identidad', 'id_inversionista']:
            val = i.get(key)
            if val: inv_map[str(val).lower()] = full_name
    
    # Debug de llaves de ejemplo
    sample_keys = list(inv_map.keys())[:3]
    print(f"DEBUG: Ejemplo de IDs en Mapa: {sample_keys}")

    # 2. Fondos
    fondos_res = supabase.table('crm_fondos').select('*').execute()
    fondos_map = {f['id_fondo']: f for f in fondos_res.data}

    # 3. Certificados + Contratos
    cert_res = supabase.table('crm_certificados').select(
        'id_certificado, id_contrato, fecha_emision, monto_inversion, '
        'crm_contratos(id_fondo, moneda, id_inversionista_1, id_inversionista_2, id_inversionista_3, id_inversionista_4, porcentaje_reparto, tasa_pactada)'
    ).eq('estado', 'emitido').execute()
    all_certs_data = cert_res.data

    # 4. Aumentos / Deducciones (Simplificado para el debug)
    cert_ids = [c['id_certificado'] for c in all_certs_data]
    aum_res = supabase.table('crm_certificados_eventos').select('*').in_('id_certificado', cert_ids).eq('tipo_evento', 'aumento_capital').execute()
    aum_map = defaultdict(list)
    for a in aum_res.data:
        f_ing = date.fromisoformat(a['fecha_periodo_origen'].split('T')[0])
        amt = float(a.get('capital_final_saldo', 0)) - float(a.get('capital_base', 0))
        aum_map[a['id_certificado']].append({"fecha": f_ing, "monto": amt})

    cronograma_res = supabase.table('crm_cronograma_deducciones_rescates').select('*').in_('id_certificado', cert_ids).eq('estado', 'PENDIENTE').execute()
    cron_deducciones_map = defaultdict(list)
    cron_rescates_map = defaultdict(list)
    for item in cronograma_res.data:
        f_p = date.fromisoformat(item['fecha_proyectada_cobro'])
        if item['tipo_cargo'] == 'RESCATE_CAPITAL':
            cron_rescates_map[item['id_certificado']].append({"fecha": f_p, "tasa_waiver": float(item.get('tasa', 0)) / 100, "monto": float(item['monto_cobrar'])})
        if fecha_inicio <= f_p <= fecha_fin:
            cron_deducciones_map[item['id_certificado']].append(item)

    reporte_fondos = []
    
    for f_code, fondo in fondos_map.items():
        if codigo_fondo and f_code != codigo_fondo: continue
        tasa_f = float(fondo.get('tasa', 0)) / 100
        certs_f = [c for c in all_certs_data if c.get('crm_contratos', {}).get('id_fondo') == f_code]
        if not certs_f: continue

        cert_rows_data = []
        acum_cert = defaultdict(float)

        for c in certs_f:
            contrato = c.get('crm_contratos', {})
            reparto_pct = float(contrato.get('porcentaje_reparto', 0)) / 100
            tasa_p = float(contrato.get('tasa_pactada', 0)) / 100 or tasa_f
            
            raw_id = c.get('id_certificado', '')
            # BUSQUEDA DE NOMBRES CON NORMALIZACION
            inv_ids = [str(contrato.get(f'id_inversionista_{i}')).lower() for i in range(1, 5) if contrato.get(f'id_inversionista_{i}')]
            names = [inv_map.get(iid) for iid in inv_ids if inv_map.get(iid)]
            full_inv_name = " / ".join(names) if names else f"D-INV:({inv_ids[0] if inv_ids else 'N/A'})"

            hijos = []
            for a in aum_map.get(raw_id, []):
                if a["fecha"] > fecha_inicio:
                    hijos.append({"id": f"Aumento ({a['fecha'].strftime('%d/%m')})", "fecha": a["fecha"], "monto": a["monto"], "interes_acum": 0.0, "valores_dia": []})

            cert_rows_data.append({
                "id": raw_id, "inversionista": full_inv_name, "capital_base": float(c.get('monto_inversion', 0)),
                "emision": date.fromisoformat(c['fecha_emision']), "porcentaje_reparto": reparto_pct,
                "tasa_pactada": tasa_p, "valores_dia": [], "hijos": hijos,
                "capital_aumentos_total": sum(h["monto"] for h in hijos)
            })
            
        for d in dias_periodo:
            for row in cert_rows_data:
                rescates = sorted(cron_rescates_map.get(row["id"], []), key=lambda x: x["fecha"])
                r_a = next((r for r in rescates if d <= r["fecha"]), None)
                cap_rem = row["capital_base"] - sum(r["monto"] for r in rescates if d > r["fecha"])
                t_hoy = r_a["tasa_waiver"] if r_a else row["tasa_pactada"]
                base_hoy = row["capital_base"] if r_a else max(0.0, cap_rem)
                
                # CÁLCULO CON BASE VARIABLE GLOBAL
                int_dia_padre = (base_hoy * (t_hoy / BASE_DIAS)) if d >= row["emision"] else 0.0
                
                # DIAGNOSTICO ESPECIFICO
                if "NSGPEN01-001" in str(row["id"]) and d == date(2026, 1, 1):
                    # Solo imprimimos un dia para no saturar
                    print(f"🔍 DIAG: {row['id']} | Cap: {base_hoy} | Tasa: {t_hoy} | Base: {BASE_DIAS} | Int: {int_dia_padre}")

                acum_cert[row["id"]] += int_dia_padre
                row["valores_dia"].append(int_dia_padre)
                for h in row["hijos"]:
                    int_dia_h = (h["monto"] * (t_hoy / BASE_DIAS)) if d >= h["fecha"] else 0.0
                    h["interes_acum"] += int_dia_h
                    acum_cert[row["id"]] += int_dia_h
                    h["valores_dia"].append(int_dia_h)

        final_rows = []
        for r in cert_rows_data:
            bruto = acum_cert[r["id"]]
            imp = round(bruto * 0.05, 2); neta = round(bruto - imp, 2)
            cap_z = round(neta * (1 - r["porcentaje_reparto"]), 2)
            rep_v = round(neta * r["porcentaje_reparto"], 2)
            ded = sum(float(x['monto_cobrar']) for x in cron_deducciones_map.get(r['id'], []) if x['tipo_cargo'] == 'DEDUCCION_ORDINARIA')
            dev = sum(float(x['monto_cobrar']) for x in cron_deducciones_map.get(r['id'], []) if x['tipo_cargo'] == 'RESCATE_CAPITAL')
            pen = sum(float(x['monto_cobrar']) for x in cron_deducciones_map.get(r['id'], []) if x['tipo_cargo'] == 'PENALIDAD_RESCATE')
            
            final_rows.append({
                "Certificado": r["id"], "Inversionista": r["inversionista"], 
                "Capital Base": r["capital_base"], "Aumentos": r["capital_aumentos_total"],
                **{csv_headers_fechas[i]: v for i, v in enumerate(r["valores_dia"])},
                "Bruto Total": bruto, "Impuesto 5%": imp, "Interés Neto": neta, "Capitalización": cap_z, 
                "Reparto Bruto": rep_v, "Deducciones": ded, "Neto Transferencia": round(rep_v - ded, 2), 
                "Capital Final": round(r['capital_base'] + r['capital_aumentos_total'] + cap_z - dev - pen, 2)
            })
        reporte_fondos.append({"f_id": f_code, "data": final_rows})

    ts = datetime.now().strftime('%Y%m%d_%H%M%S')
    excel_path = os.path.join(project_root, "reports", f"reporte_maestro_intereses_v22_{ts}.xlsx")
    os.makedirs(os.path.dirname(excel_path), exist_ok=True)
    with pd.ExcelWriter(excel_path, engine='openpyxl') as writer:
        for rf in reporte_fondos:
            df_f = pd.DataFrame(rf["data"])
            sheet_name = f"Fondo_{str(rf['f_id'])[:24]}"
            sum_cols = ["Capital Base", "Aumentos"] + csv_headers_fechas + ["Bruto Total", "Impuesto 5%", "Interés Neto", "Capitalización", "Reparto Bruto", "Deducciones", "Neto Transferencia", "Capital Final"]
            totals = {c: "" for c in df_f.columns}; totals["Certificado"] = "TOTAL"
            for col in sum_cols: totals[col] = df_f[col].sum()
            df_f = pd.concat([df_f, pd.DataFrame([totals])], ignore_index=True)
            df_f.to_excel(writer, index=False, sheet_name=sheet_name)
    
    print(f"✅ ¡Éxito! Excel V22.7 (Base {BASE_DIAS}) en: {excel_path}")
    return excel_path

if __name__ == "__main__":
    generate_retornos_v22()
