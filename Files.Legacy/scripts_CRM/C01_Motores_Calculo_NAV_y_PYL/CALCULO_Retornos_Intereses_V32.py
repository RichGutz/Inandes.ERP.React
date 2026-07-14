import os
import sys
import pandas as pd
from datetime import date, timedelta, datetime
from collections import defaultdict
from openpyxl.styles import Alignment, Font

# Add project root to path
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from src.data.supabase_client import get_supabase_client
from src.utils.pdf_generators import _generate_pdf_in_memory

# --- CONFIGURACIÓN GLOBAL (V32: ESTRUCTURA JERÁRQUICA V21 + FORMATO V31) ---
BASE_DIAS = 365.0
PRIORITY_FONDOS = ["NSGPEN01", "NSGPEN02", "NSGPEN03", "NSGUSD01", "NSGUSD02", "NSLCON01"]

def get_correlativo(cert_id):
    """Extrae el número correlativo para ordenamiento numérico."""
    try:
        parts = cert_id.split('-')
        if len(parts) > 1:
            return int(parts[1].split('.')[0])
        return 999999
    except Exception:
        return 999999


def get_month_name(month_idx):
    names = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", 
             "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
    return names[month_idx - 1]

def generate_retornos_v32(codigo_fondo=None, return_data=False):
    """
    Motor de Retornos v32.0 - LA CÚSPIDE (Híbrido V21/V31).
    - Lógica Jerárquica V21: Cada aumento es una fila independiente debajo del padre.
    - Formato Financiero V31: Separador de miles y alineación profesional.
    - Entorno Railway: Conexión estable a la nueva base de datos.
    """
    supabase = get_supabase_client()
    fecha_inicio = date(2026, 1, 1)
    fecha_fin    = date(2026, 2, 28)
    dias_periodo = [fecha_inicio + timedelta(days=i) for i in range((fecha_fin - fecha_inicio).days + 1)]
    columnas_fechas = [d.strftime('%d/%m') for d in dias_periodo]

    print(f"🚀 Iniciando Motor V32.0 (JERARQUÍA V21 + FORMATO V31)...")

    # 1. Inversionistas
    inv_res = supabase.table('crm_inversionistas').select('*').execute()
    inv_map = {}
    for i in inv_res.data:
        full_name = i.get('nombre_completo') or f"{i.get('nombre_1','')} {i.get('apellido_1','')}".strip()
        for key in ['id', 'uuid', 'documento_identidad', 'id_inversionista', 'codigo_inversionista']:
            val = i.get(key)
            if val: inv_map[str(val).lower()] = full_name
    
    # 2. Fondos
    fondos_res = supabase.table('crm_fondos').select('*').execute()
    fondos_map = {f['id_fondo']: f for f in fondos_res.data}

    # 3. Certificados + Contratos
    cert_res = supabase.table('crm_certificados').select(
        'id_certificado, id_contrato, fecha_emision, monto_inversion, '
        'crm_contratos(id_fondo, moneda, id_inversionista_1, id_inversionista_2, id_inversionista_3, id_inversionista_4, porcentaje_reparto, tasa_pactada)'
    ).eq('estado', 'emitido').execute()
    all_certs_data = cert_res.data

    # 4. Aumentos (Eventos) - LEEMOS DE LA TABLA "LIBRO MAYOR"
    cert_ids = [c['id_certificado'] for c in all_certs_data]
    aum_res = supabase.table('crm_certificados_eventos').select('*').in_('id_certificado', cert_ids).eq('tipo_evento', 'aumento_capital').execute()
    aum_map = defaultdict(list)
    for a in aum_res.data:
        f_str = a.get('fecha_evento') or a.get('fecha_periodo_inicio') or a.get('fecha_periodo_origen')
        if f_str:
            import re as _re
            f_ing = date.fromisoformat(f_str.split('T')[0])
            amt = float(a.get('monto_variacion') or 0)
            if amt == 0:
                amt = float(a.get('capital_final_saldo', 0)) - float(a.get('capital_base', 0))
            if amt == 0:  # Fallback V21: monto en campo notas ("por 50,000.00 ingresado")
                m = _re.search(r'por\s+([\d.,]+)\s+ingresado', a.get('notas', '') or '')
                if m:
                    amt = float(m.group(1).replace(',', ''))
            aum_map[a['id_certificado']].append({"fecha": f_ing, "monto": amt})

    # 5. Deducciones / Rescates (Cronograma)
    cronograma_res = supabase.table('crm_cronograma_deducciones_rescates').select('*').in_('id_certificado', cert_ids).execute()
    cron_deducciones_map = defaultdict(list)
    cron_rescates_map = defaultdict(list)
    for item in cronograma_res.data:
        f_p = date.fromisoformat(item['fecha_proyectada_cobro'])
        if item['tipo_cargo'] == 'RESCATE_CAPITAL':
            cron_rescates_map[item['id_certificado']].append({"fecha": f_p, "tasa_waiver": float(item.get('tasa', 0)) / 100, "monto": float(item['monto_cobrar'])})
        if fecha_inicio <= f_p <= fecha_fin:
            cron_deducciones_map[item['id_certificado']].append(item)

    reporte_fondos_dict = {}
    
    for f_code, fondo in fondos_map.items():
        if codigo_fondo and f_code != codigo_fondo: continue
        tasa_f = float(fondo.get('tasa', 0)) / 100
        certs_f = [c for c in all_certs_data if c.get('crm_contratos', {}).get('id_fondo') == f_code]
        if not certs_f: continue

        # Ordenar numéricamente por certificado
        certs_f.sort(key=lambda x: get_correlativo(x.get('id_certificado', '')))
        cert_rows_data = []

        for c in certs_f:
            contrato = c.get('crm_contratos', {})
            reparto_pct = float(contrato.get('porcentaje_reparto', 0)) / 100
            tasa_p = float(contrato.get('tasa_pactada', 0)) / 100 or tasa_f
            raw_id = c.get('id_certificado', '')
            
            # Mapeo de inversionistas
            inv_ids = [str(contrato.get(f'id_inversionista_{i}')).lower() for i in range(1, 5) if contrato.get(f'id_inversionista_{i}')]
            names = [inv_map.get(iid) for iid in inv_ids if inv_map.get(iid)]
            full_inv_name = " / ".join(names) if names else "N/A"

            # Aumentos (Hijos) - Lógica V21
            hijos = []
            for a in aum_map.get(raw_id, []):
                # Solo aumentos dentro o antes del periodo que generen interés aquí
                hijos.append({
                    "id": f"Aumento ({a['fecha'].strftime('%d/%m')})",
                    "fecha": a["fecha"],
                    "monto": a["monto"],
                    "interes_acum": 0.0,
                    "valores_dia": []
                })

            cert_rows_data.append({
                "id": raw_id,
                "inversionista": full_inv_name,
                "capital_base": float(c.get('monto_inversion', 0)),
                "emision": date.fromisoformat(c['fecha_emision']),
                "porcentaje_reparto": reparto_pct,
                "tasa_pactada": tasa_p,
                "valores_dia": [], # Valores del padre solo
                "hijos": hijos,
                "capital_aumentos_total": sum(h["monto"] for h in hijos),
                "interes_total_acum": 0.0 # Acumulado de padre + hijos
            })
            
        # Bucle de Días (Cálculo Diario Separado)
        for d in dias_periodo:
            for row in cert_rows_data:
                # Lógica de Rescates aplicada al Padre
                rescates = sorted(cron_rescates_map.get(row["id"], []), key=lambda x: x["fecha"])
                r_a = next((r for r in rescates if d <= r["fecha"]), None)
                cap_rem = row["capital_base"] - sum(r["monto"] for r in rescates if d > r["fecha"])
                t_hoy = r_a["tasa_waiver"] if r_a else row["tasa_pactada"]
                base_hoy = row["capital_base"] if r_a else max(0.0, cap_rem)
                
                # Interés del Padre
                int_dia_padre = (base_hoy * (t_hoy / BASE_DIAS)) if d >= row["emision"] else 0.0
                row["valores_dia"].append(int_dia_padre)
                row["interes_total_acum"] += int_dia_padre
                
                # Interés de los Hijos (Aumentos) - Calculado individualmente
                for h in row["hijos"]:
                    int_dia_h = (h["monto"] * (t_hoy / BASE_DIAS)) if d >= h["fecha"] else 0.0
                    h["interes_acum"] += int_dia_h
                    h["valores_dia"].append(int_dia_h)
                    row["interes_total_acum"] += int_dia_h

        # Generación de Filas Finales (Desglose Jerárquico)
        final_rows = []
        global_counter = 1
        for r in cert_rows_data:
            # 1. Fila del Padre
            bruto_total = r["interes_total_acum"] # Para efectos de impuestos usamos el total del certificado
            imp = round(bruto_total * 0.05, 2)
            neta = round(bruto_total - imp, 2)
            cap_z = round(neta * (1 - r["porcentaje_reparto"]), 2)
            rep_v = round(neta * r["porcentaje_reparto"], 2)
            
            ded_ord = sum(float(x['monto_cobrar']) for x in cron_deducciones_map.get(r['id'], []) if x['tipo_cargo'] == 'DEDUCCION_ORDINARIA')
            rescate_sum = sum(float(x['monto_cobrar']) for x in cron_deducciones_map.get(r['id'], []) if x['tipo_cargo'] == 'RESCATE_CAPITAL')
            penalidad_sum = sum(float(x['monto_cobrar']) for x in cron_deducciones_map.get(r['id'], []) if x['tipo_cargo'] == 'PENALIDAD_RESCATE')
            neto_f = round(rep_v - ded_ord, 2)
            
            # Fila Padre
            parent_row = {
                "#": global_counter,
                "Certificado": r["id"],
                "Inversionista": r["inversionista"],
                "Capital Base": r["capital_base"],
            }
            # Agregar valores diarios del padre
            for k, v in enumerate(r["valores_dia"]):
                parent_row[columnas_fechas[k]] = v
            
            # Agregar columnas finales (Totales del certificado en la fila padre)
            parent_row.update({
                "INT. BRUTO": bruto_total,
                "IR (5%)": imp,
                "BASE NETA": neta,
                "CAPITALIZACION": cap_z,
                "REPARTO": rep_v,
                "DEDUCCIONES": ded_ord,
                "NETO FINAL": neto_f,
                "RESCATES": rescate_sum,
                "PENALIDAD": penalidad_sum,
                "AUM. CAPITAL": r["capital_aumentos_total"],
                "CAPITAL FINAL": round(r['capital_base'] + r['capital_aumentos_total'] + cap_z - rescate_sum - penalidad_sum, 2)
            })
            final_rows.append(parent_row)
            global_counter += 1

            # 2. Filas de Aumentos (Hijos) - Estilo V21
            for h in r["hijos"]:
                hijo_row = {
                    "#": "", # Sin número para indicar jerarquía
                    "Certificado": h["id"],
                    "Inversionista": "",
                    "Capital Base": h["monto"],
                }
                for k, v in enumerate(h["valores_dia"]):
                    hijo_row[columnas_fechas[k]] = v
                
                # Columnas finales vacías para los hijos (el total está en el padre)
                for col in ["INT. BRUTO", "IR (5%)", "BASE NETA", "CAPITALIZACION", "REPARTO", "DEDUCCIONES", "NETO FINAL", "RESCATES", "PENALIDAD", "AUM. CAPITAL", "CAPITAL FINAL"]:
                    hijo_row[col] = 0.0
                
                final_rows.append(hijo_row)

        reporte_fondos_dict[f_code] = final_rows


        # --- GENERACIÓN DE ESTRUCTURA PARA PDF (V20/V21 Style PAGINATION) ---
        period_blocks = []
        months_grouped = defaultdict(list)
        for i, d in enumerate(dias_periodo):
            months_grouped[(d.year, d.month)].append(i)
        
        sorted_keys = sorted(months_grouped.keys())
        for idx, key in enumerate(sorted_keys):
            indices = months_grouped[key]
            s, e = indices[0], indices[-1] + 1
            is_last_page = (idx == len(sorted_keys) - 1)
            
            rows_paged = []
            cert_counter = 1
            for r in cert_rows_data:
                bruto_total = r["interes_total_acum"]
                imp = round(bruto_total * 0.05, 2)
                neta = round(bruto_total - imp, 2)
                cap_z = round(neta * (1 - r["porcentaje_reparto"]), 2)
                rep_v = round(neta * r["porcentaje_reparto"], 2)
                ded_ord = sum(float(x['monto_cobrar']) for x in cron_deducciones_map.get(r['id'], []) if x['tipo_cargo'] == 'DEDUCCION_ORDINARIA')
                rescate_sum = sum(float(x['monto_cobrar']) for x in cron_deducciones_map.get(r['id'], []) if x['tipo_cargo'] == 'RESCATE_CAPITAL')
                penalidad_sum = sum(float(x['monto_cobrar']) for x in cron_deducciones_map.get(r['id'], []) if x['tipo_cargo'] == 'PENALIDAD_RESCATE')
                neto_f = round(rep_v - ded_ord, 2)
                capital_final = round(r['capital_base'] + r['capital_aumentos_total'] + cap_z - rescate_sum - penalidad_sum, 2)

                rows_paged.append({
                    "tipo": "CERT",
                    "n_orden": cert_counter,
                    "id": r["id"],
                    "inversionista": r["inversionista"],
                    "capital": r["capital_base"],
                    "aumentos": r["capital_aumentos_total"],
                    "valores": r["valores_dia"][s:e],
                    "bruto_total": bruto_total,
                    "impuesto_total": imp,
                    "base_neta": neta,
                    "capitalizacion": cap_z,
                    "reparto_valor": rep_v,
                    "deducciones_total": ded_ord,
                    "neto_total": neto_f,
                    "devolucion_capital": rescate_sum,
                    "penalidad_rescate": penalidad_sum,
                    "capital_final": capital_final
                })
                
                for h in r["hijos"]:
                    rows_paged.append({
                        "tipo": "AUMENTO",
                        "id": h["id"],
                        "capital": h["monto"],
                        "valores": h["valores_dia"][s:e]
                    })
                cert_counter += 1

            period_blocks.append({
                "idx": idx + 1,
                "month_name": f"{get_month_name(key[1])} {key[0]}",
                "days": [d.strftime('%d/%m') for d in dias_periodo[s:e]],
                "is_last": is_last_page,
                "rows": rows_paged
            })

        if 'reporte_fondos_pdf' not in locals():
            reporte_fondos_pdf = []
        
        reporte_fondos_pdf.append({
            "fondo": fondo,
            "vars": {"pasiva": "V32"},
            "blocks": period_blocks
        })
        # --- FIN ESTRUCTURA PDF ---



    # Reordenamiento de fondos prioritarios
    final_fund_order = [f for f in PRIORITY_FONDOS if f in reporte_fondos_dict] + sorted([f for f in reporte_fondos_dict if f not in PRIORITY_FONDOS])

    # Exportación a Excel con Formato V31
    ts = datetime.now().strftime('%Y%m%d_%H%M%S')
    excel_path = os.path.join(project_root, "reports", f"reporte_maestro_intereses_v32_{ts}.xlsx")
    os.makedirs(os.path.dirname(excel_path), exist_ok=True)
    
    with pd.ExcelWriter(excel_path, engine='openpyxl') as writer:
        for f_id in final_fund_order:
            df_f = pd.DataFrame(reporte_fondos_dict[f_id])
            sheet_name = f"Fondo_{str(f_id)[:24]}"
            
            # Columnas a sumar para totales
            sum_cols = ["Capital Base"] + columnas_fechas + ["INT. BRUTO", "IR (5%)", "BASE NETA", "CAPITALIZACION", "REPARTO", "DEDUCCIONES", "NETO FINAL", "RESCATES", "PENALIDAD", "AUM. CAPITAL", "CAPITAL FINAL"]
            
            # Fila de Totales
            totals = {c: "" for c in df_f.columns}
            totals["Certificado"] = "TOTAL FONDO"
            for col in sum_cols:
                totals[col] = df_f[col].sum()
            
            df_f = pd.concat([df_f, pd.DataFrame([totals])], ignore_index=True)
            df_f.to_excel(writer, index=False, sheet_name=sheet_name)
            
            # Formateo Financiero (Miles, Decimales, Alineación)
            ws = writer.sheets[sheet_name]
            for col_idx, column_name in enumerate(df_f.columns, 1):
                if column_name in sum_cols:
                    for row_idx in range(2, len(df_f) + 2):
                        cell = ws.cell(row=row_idx, column=col_idx)
                        cell.number_format = '#,##0.00'
                        cell.alignment = Alignment(horizontal='right')
                
                # Resaltar fila de Totales
                ws.cell(row=len(df_f)+1, column=col_idx).font = Font(bold=True)
                
            # Congelar paneles para navegabilidad
            ws.freeze_panes = "D2"

    print(f"✅ ¡Éxito Total! Motor V32 Generado EXCEL en: {excel_path}")

    # Exportación a PDF con Formato V20/V21
    def format_num(v):
        try:
            if v is None or v == 0: return "-"
            return "{:,.2f}".format(float(v))
        except: return str(v)

    report_context = {
        "fondos": reporte_fondos_pdf, 
        "print_date": date.today().strftime('%d/%m/%Y'),
        "format_num": format_num,
        "version": "V32"
    }

    if return_data: return reporte_fondos_dict, reporte_fondos_pdf

    return excel_path

if __name__ == "__main__":
    generate_retornos_v32()
