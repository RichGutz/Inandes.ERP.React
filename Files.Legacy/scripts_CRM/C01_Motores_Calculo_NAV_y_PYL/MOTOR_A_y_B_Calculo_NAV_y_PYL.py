import os
import sys
import math
from datetime import date, timedelta
from collections import defaultdict
import re

# Add project root to path
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from src.data.supabase_client import get_supabase_client
from src.utils.pdf_generators import _generate_pdf_in_memory

def get_month_name(month_idx):
    names = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", 
             "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
    return names[month_idx - 1]

def get_v25_calculation_data(codigo_fondo=None):
    """
    Motor V26 - Optimizado para NAV (Sin columna total acumulado).
    """
    supabase = get_supabase_client()
    print(f"🚀 Ejecutando Motor V26 (Enfoque NAV)")

    # 1. Fondos y Tasas
    query = supabase.table('crm_fondos').select('*')
    if codigo_fondo: query = query.eq('id_fondo', codigo_fondo)
    fondos = query.execute().data
    
    # 2. Certificados
    cert_res = supabase.table('crm_certificados').select(
        'id_certificado, id_contrato, fecha_emision, monto_inversion, valor_cuota, '
        'crm_contratos(id_fondo, tasa_pactada, moneda)'
    ).eq('estado', 'emitido').execute()
    all_certs = cert_res.data

    # 3. Aumentos
    cert_ids = [c['id_certificado'] for c in all_certs]
    aum_res = supabase.table('crm_certificados_eventos').select('*').in_('id_certificado', cert_ids).eq('tipo_evento', 'aumento_capital').execute()
    aum_map = defaultdict(list)
    for a in aum_res.data:
        f_ing = date.fromisoformat(a['fecha_periodo_origen'].split('T')[0])
        # Usamos la diferencia de capitales de la base de datos en lugar de parsear notas
        monto = float(a.get('capital_final_saldo') or 0) - float(a.get('capital_base') or 0)
        aum_map[a['id_certificado']].append({"fecha": f_ing, "monto": monto})

    fondos_reportes = []

    for fondo in fondos:
        fid = fondo['id_fondo']
        t_activa = float(fondo.get('tasa_activa') or 0) / 100
        p_admin  = float(fondo.get('comision_administracion_fondo') or 0) / 100
        p_cap    = float(fondo.get('comision_captacion_fondo') or 0) / 100
        p_misc   = float(fondo.get('comision_miscelaneos_fondo') or 0) / 100

        fecha_inicio = date(2026, 1, 1)
        fecha_fin    = date(2026, 2, 28)
        dias_periodo = [fecha_inicio + timedelta(days=i) for i in range((fecha_fin - fecha_inicio).days + 1)]

        certs_fondo = [c for c in all_certs if c['crm_contratos']['id_fondo'] == fid]
        if not certs_fondo: continue
        
        def get_sort_key(cid):
            m = re.search(r'[.-](\d+)', cid)
            return int(m.group(1)) if m else 999
        
        certs_fondo.sort(key=lambda x: get_sort_key(x['id_certificado']))

        # Estructura de Filas de Certificados
        cert_rows = [] 
        for c in certs_fondo:
            v_ini = float(c.get('valor_cuota') or 1.0)
            if v_ini <= 0: v_ini = 1.0
            
            # Buscamos el Capital Inicial a partir del evento 1.1.26 (Birth)
            cid = c['id_certificado']
            birth_events = [a for a in aum_map.get(cid, []) if a["fecha"] == date(2026, 1, 1)]
            capital_inicial = sum(a["monto"] for a in birth_events)
            
            # Si no hay evento Birth, usamos el monto_inversion como fallback
            if not birth_events:
                capital_inicial = float(c['monto_inversion'])
            
            row = {
                "tipo": "CERT", "id": cid, "capital": capital_inicial,
                "cuotas": capital_inicial / v_ini, "emision": date.fromisoformat(c['fecha_emision']),
                "interes_acum": 0.0, "valores_dia": [], "hijos": []
            }
            cert_rows.append(row)

        # Filas de Totales (V20 Style)
        def create_total_row(label, is_summary=True, is_comision=False, is_vc=False):
            return {"tipo": "TOTAL", "id": label, "capital": None, "cuotas": None, "valores_dia": [], "interes_acum": None, "is_summary": is_summary, "is_comision": is_comision, "is_vc": is_vc}

        r_tot_cap = create_total_row("TOTAL CAPITAL")
        r_tot_cap["capital"] = sum(c["capital"] for c in cert_rows)

        r_inv_orig = create_total_row("INVERSIONES ORIGINALES")
        r_inv_acum = create_total_row("INV. ORIGINALES ACUMULADAS")
        r_cuo_orig = create_total_row("CUOTAS ORIGINALES")
        r_cuo_acum = create_total_row("CUOTAS ORIGINALES ACUMULADAS")
        r_val_cuo_ini = create_total_row("VAL CUOTA INICIAL", is_vc=True)
        r_gb_tot = create_total_row("GANANCIA TOTAL BRUTA")
        r_gb_acum = create_total_row("GANANCIA TOTAL ACUMULADA")
        r_pat_tot = create_total_row("PATRIMONO TOTAL")
        r_cadmin_dia = create_total_row("COM. ADMIN (-)", is_comision=True)
        r_cadmin_acu = create_total_row("COM. ADMIN ACUM. (-)", is_comision=True)
        r_ccapt_dia = create_total_row("COM. CAPT. (-)", is_comision=True)
        r_ccapt_acu = create_total_row("COM. CAPT. ACUM. (-)", is_comision=True)
        r_cmisc_dia = create_total_row("COM. MISC. (-)", is_comision=True)
        r_cmisc_acu = create_total_row("COM. MISC. ACUM. (-)", is_comision=True)
        r_gop_dia = create_total_row("GANANCIA OPERATIVA")
        r_gop_acu = create_total_row("GANANCIA OPERATIVA ACUMULADA")
        r_pat_cie = create_total_row("PATRIMONIO TOTAL CIERRE")
        r_cuo_cie = create_total_row("CUOTA TOTAL CIERRE")
        r_val_fin = create_total_row("VAL CUOTA FINAL", is_vc=True)

        summary_rows = [
            r_tot_cap, {"tipo": "SPACER"},
            r_inv_orig, r_inv_acum, r_cuo_orig, r_cuo_acum, r_val_cuo_ini, {"tipo": "SPACER"},
            r_gb_tot, r_gb_acum, r_pat_tot, {"tipo": "SPACER"},
            r_cadmin_dia, r_cadmin_acu, r_ccapt_dia, r_ccapt_acu, r_cmisc_dia, r_cmisc_acu, {"tipo": "SPACER"},
            r_gop_dia, r_gop_acu, {"tipo": "SPACER"},
            r_pat_cie, r_cuo_cie, r_val_fin
        ]

        # Simulación de Periodo
        patrimonio_ayer = sum(c["capital"] for c in cert_rows)
        cuotas_ayer = sum(c["cuotas"] for c in cert_rows)
        f_acum_utilidad = 0.0
        f_acum_admin = 0.0
        f_acum_cap = 0.0
        f_acum_misc = 0.0
        
        # Inversiones y cuotas acumuladas
        f_total_inv_orig_acum = patrimonio_ayer 
        f_total_cuo_orig_acum = cuotas_ayer
        val_cuota_ayer = 1.0 

        for d in dias_periodo:
            # A) RENTABILIDAD DEL DÍA (ANTES DE SUSCRIPCIONES)
            ingreso_bruto_dia = patrimonio_ayer * (t_activa / 360)
            gasto_admin = patrimonio_ayer * (p_admin / 365)
            gasto_cap   = patrimonio_ayer * (p_cap / 365)
            gasto_misc  = patrimonio_ayer * (p_misc / 365)
            utilidad_neta_dia = ingreso_bruto_dia - (gasto_admin + gasto_cap + gasto_misc)
            
            f_acum_utilidad += ingreso_bruto_dia 
            f_acum_admin    += gasto_admin
            f_acum_cap      += gasto_cap
            f_acum_misc     += gasto_misc

            pat_pre = patrimonio_ayer + utilidad_neta_dia
            v_cuota_hoy = pat_pre / cuotas_ayer if cuotas_ayer > 0 else 1.0
            
            # B) DEVENGUE INDIVIDUAL DIARIO (INCLUYE AUMENTOS ACTIVOS)
            interes_total_dia_certs = 0.0
            for row in cert_rows:
                int_dia_padre = 0.0
                if d >= row["emision"]:
                    # Interés del capital base original
                    int_dia_padre = row["capital"] * (t_activa / 360)
                    row["interes_acum"] += int_dia_padre
                row["valores_dia"].append(int_dia_padre)
                interes_total_dia_certs += int_dia_padre
                
                for hijo in row["hijos"]:
                    int_dia_hijo = 0.0
                    if d >= hijo["fecha_ingreso"]:
                        # Aumentos generan interés a la MISMA TASA
                        int_dia_hijo = hijo["monto"] * (t_activa / 360)
                        hijo["interes_acum"] += int_dia_hijo
                    hijo["valores_dia"].append(int_dia_hijo)
                    interes_total_dia_certs += int_dia_hijo

            # C) SUSCRIPCIONES (AL CIERRE)
            aportes_dia = 0.0
            for row in cert_rows:
                for a in aum_map.get(row["id"], []):
                    # Solo procesamos si d > 1.1.26 (para no duplicar el Birth)
                    if a["fecha"] == d and d > date(2026, 1, 1):
                        monto_aum = a["monto"]
                        nuevas_cuotas = monto_aum / v_cuota_hoy
                        hijo = {
                            "tipo": "AUMENTO", "id": f"Aumento ({a['fecha'].strftime('%d/%m')})",
                            "monto": monto_aum, "cuotas": nuevas_cuotas, "fecha_ingreso": a["fecha"],
                            "interes_acum": 0.0, "valores_dia": [0.0] * (len(row["valores_dia"]) - 1) + [0.0]
                        }
                        row["hijos"].append(hijo)
                        row["capital"] += monto_aum
                        row["cuotas"] += nuevas_cuotas
                        aportes_dia += monto_aum

            # D) ACTUALIZAR FILAS DE RESUMEN
            f_total_inv_orig_acum += aportes_dia
            nuevas_cuotas_dia = aportes_dia / v_cuota_hoy if aportes_dia > 0 else 0
            f_total_cuo_orig_acum += nuevas_cuotas_dia
            
            r_inv_orig["valores_dia"].append(aportes_dia)
            r_inv_acum["valores_dia"].append(f_total_inv_orig_acum)
            r_cuo_orig["valores_dia"].append(nuevas_cuotas_dia)
            r_cuo_acum["valores_dia"].append(f_total_cuo_orig_acum)
            r_val_cuo_ini["valores_dia"].append(val_cuota_ayer)
            
            r_gb_tot["valores_dia"].append(ingreso_bruto_dia)
            r_gb_acum["valores_dia"].append(f_acum_utilidad)
            r_pat_tot["valores_dia"].append(f_total_inv_orig_acum + f_acum_utilidad)
            
            r_cadmin_dia["valores_dia"].append(gasto_admin)
            r_cadmin_acu["valores_dia"].append(f_acum_admin)
            r_ccapt_dia["valores_dia"].append(gasto_cap)
            r_ccapt_acu["valores_dia"].append(f_acum_cap)
            r_cmisc_dia["valores_dia"].append(gasto_misc)
            r_cmisc_acu["valores_dia"].append(f_acum_misc)
            
            r_gop_dia["valores_dia"].append(utilidad_neta_dia)
            r_gop_acu["valores_dia"].append(f_acum_utilidad - f_acum_admin - f_acum_cap - f_acum_misc)
            
            pat_total_cierre = pat_pre + aportes_dia
            cuotas_total_cierre = cuotas_ayer + nuevas_cuotas_dia
            
            r_pat_cie["valores_dia"].append(pat_total_cierre)
            r_cuo_cie["valores_dia"].append(cuotas_total_cierre)
            r_val_fin["valores_dia"].append(v_cuota_hoy) # VC hoy refleja el rendimiento antes de aportes

            # E) PREPARAR MAÑANA
            patrimonio_ayer = pat_total_cierre
            cuotas_ayer = cuotas_total_cierre
            val_cuota_ayer = v_cuota_hoy

        # Flatenizar filas para el template
        block_rows_meta = []
        for i, r in enumerate(cert_rows, 1):
            r["num"] = i
            block_rows_meta.append(r)
            for hijo in r["hijos"]: block_rows_meta.append(hijo)
        block_rows_meta.extend(summary_rows)

        # Agrupar por meses
        blocks = []
        months = defaultdict(list)
        for i, d in enumerate(dias_periodo): months[(d.year, d.month)].append(i)
        
        for (y, m), idxs in sorted(months.items()):
            s, e = idxs[0], idxs[-1]+1
            block_data = {
                "idx": len(blocks) + 1,
                "month_name": f"{get_month_name(m)} {y}",
                "days": [dias_periodo[i].strftime('%d/%m') for i in idxs],
                "rows": []
            }
            for r in block_rows_meta:
                if r["tipo"] == "SPACER":
                    block_data["rows"].append({"tipo": "SPACER"})
                    continue
                
                brow = {
                    "tipo": r["tipo"], "id": r["id"], "num": r.get("num", ""),
                    "is_summary": r.get("is_summary", False), "is_comision": r.get("is_comision", False), "is_vc": r.get("is_vc", False),
                    "capital": r.get("capital") if r["tipo"] == "CERT" else r.get("monto"),
                    "cuotas": r.get("cuotas"),
                    "valores": r["valores_dia"][s:e],
                    "interes_acum": r.get("interes_acum")
                }
                block_data["rows"].append(brow)
            blocks.append(block_data)

        fondos_reportes.append({
            "fondo": fondo, "blocks": blocks,
            "vars": {"activa": f"{t_activa*100:.2f}", "admin": f"{p_admin*100:.2f}"}
        })

    return fondos_reportes

def generate_ledger_report_v25(codigo_fondo=None):
    data = get_v25_calculation_data(codigo_fondo)
    if not data: return None
    
    def format_num(v, p=2):
        if v is None: return ""
        try:
            fv = float(v)
            if fv == 0.0: return "-"
            fmt = "{:,.%df}" % p
            return fmt.format(fv)
        except: return str(v)

    report_context = {
        "fondos": data, "format_num": format_num,
        "print_date": date.today().strftime('%d/%m/%Y'), "version": "v26"
    }
    
    from datetime import datetime
    suffix = datetime.now().strftime('%H%M%S')
    pdf_bytes = _generate_pdf_in_memory("reporte_cuotas_transpuesto_v26.html", report_context)
    output_path = os.path.join(project_root, "reports", f"Reporte_V26_{suffix}.pdf")
    with open(output_path, "wb") as f: f.write(pdf_bytes)
    return output_path

if __name__ == "__main__":
    path = generate_ledger_report_v25("NSGPEN01")
    print(f"✅ Reporte generado: {path}")
