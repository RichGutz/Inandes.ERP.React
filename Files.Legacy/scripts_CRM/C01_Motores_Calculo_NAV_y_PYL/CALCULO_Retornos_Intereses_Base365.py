import os
import sys
from datetime import date, timedelta
from collections import defaultdict

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

def generate_retornos_v19(codigo_fondo=None, return_data=False):
    """
    Motor de Retornos v19 - Lógica Financiera BASE 365 + AUMENTOS + DEVENGUE CONSOLIDADO
    Layout: Columna ID Certificado +9px, Capital Base -9px, Intereses Diarios 8.5pt.
    """
    supabase = get_supabase_client()

    fecha_inicio = date(2026, 1, 1)
    fecha_fin    = date(2026, 2, 28)
    dias_periodo = [fecha_inicio + timedelta(days=i)
                    for i in range((fecha_fin - fecha_inicio).days + 1)]

    print(f"Generando Reporte de Retornos v19 (Layout Final)...")

    # 1. Fondos
    fondos_res = supabase.table('crm_fondos').select('*').execute()
    fondos_map = {f['id_fondo']: f for f in fondos_res.data}

    # 2. Inversionistas
    inv_res = supabase.table('crm_inversionistas').select('documento_identidad, nombre_1, apellido_1').execute()
    inv_map = {i['documento_identidad']: f"{i['apellido_1']} {i['nombre_1']}" for i in inv_res.data}

    # 3. Certificados + Contratos
    cert_res = supabase.table('crm_certificados').select(
        'id_certificado, id_contrato, fecha_emision, monto_inversion, '
        'crm_contratos(id_fondo, moneda, id_inversionista_1, porcentaje_reparto)'
    ).eq('estado', 'emitido').execute()
    all_certs_data = cert_res.data

    # 4. Aumentos (Eventos)
    cert_ids = [c['id_certificado'] for c in all_certs_data]
    aum_res = supabase.table('crm_certificados_eventos').select('*').in_('id_certificado', cert_ids).eq('tipo_evento', 'aumento_capital').execute()
    aum_map = defaultdict(list)
    for a in aum_res.data:
        f_ing = date.fromisoformat(a['fecha_periodo_origen'].split('T')[0])
        monto = float(a.get('capital_final_saldo') or 0) - float(a.get('capital_base') or 0)
        aum_map[a['id_certificado']].append({"fecha": f_ing, "monto": monto})

    reporte_fondos = []
    
    for f_code, fondo in fondos_map.items():
        if codigo_fondo and f_code != codigo_fondo: continue
        
        tasa_pasiva = float(fondo.get('tasa') or 0) / 100
        certs_fondo = [c for c in all_certs_data if c.get('crm_contratos', {}).get('id_fondo') == f_code]
        if not certs_fondo: continue

        cert_rows_data = []
        acum_cert = defaultdict(float)

        for c in certs_fondo:
            inv_id = c.get('crm_contratos', {}).get('id_inversionista_1')
            reparto_pct = float(c.get('crm_contratos', {}).get('porcentaje_reparto') or 0) / 100
            
            # Obtener monto de inversion de 'crm_contratos' preferentemente si no lo tiene guardado, como V20 validaba
            capital = float(c.get('monto_inversion') or c.get('crm_contratos', {}).get('monto_inversion') or 0)
            
            # Formatear el ID de certificado dinámicamente según V20 logic si es necesario o usar crudo
            raw_id = c.get('id_certificado', '')
            
            # Aumentos (Hijos)
            hijos = []
            for a in aum_map.get(raw_id, []):
                # Solo si no es el Birth del 01/01 (que ya está en el capital base)
                if a["fecha"] > date(2026, 1, 1):
                    hijos.append({
                        "tipo": "AUMENTO",
                        "id": f"Aumento ({a['fecha'].strftime('%d/%m')})",
                        "fecha": a["fecha"],
                        "monto": a["monto"],
                        "interes_acum": 0.0,
                        "valores_dia": []
                    })

            cert_rows_data.append({
                "id": raw_id,
                "inversionista": inv_map.get(inv_id, ""),
                "capital": capital,
                "emision": date.fromisoformat(c['fecha_emision']) if isinstance(c['fecha_emision'], str) else c['fecha_emision'],
                "porcentaje_reparto": reparto_pct,
                "valores_dia": [],
                "hijos": hijos,
                "capital_aumentos_total": sum(h["monto"] for h in hijos)
            })
            
        # Ordenar certificados por ID para presentación limpia
        cert_rows_data.sort(key=lambda x: x["id"])

        # Bucle de Días
        for d in dias_periodo:
            for row in cert_rows_data:
                # Interés del capital base
                int_dia_padre = 0.0
                if d >= row["emision"]:
                    int_dia_padre = row["capital"] * (tasa_pasiva / 365.0)
                    acum_cert[row["id"]] += int_dia_padre
                
                # Interés de los Aumentos (Hijos)
                int_dia_total_hijos = 0.0
                for h in row["hijos"]:
                    int_dia_hijo = 0.0
                    if d >= h["fecha"]:
                        int_dia_hijo = h["monto"] * (tasa_pasiva / 365.0)
                        h["interes_acum"] += int_dia_hijo
                        acum_cert[row["id"]] += int_dia_hijo
                        int_dia_total_hijos += int_dia_hijo
                    # Guardamos valor diario INDIVIDUAL para el hijo
                    h["valores_dia"].append(int_dia_hijo)

                # Guardamos valor diario CONSOLIDADO (Padre + Hijos) para el padre
                row["valores_dia"].append(int_dia_padre + int_dia_total_hijos)

        # Paginación mensual
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
            cert_counter = 0 # Para Numero de Orden
            for r in cert_rows_data:
                cert_counter += 1
                bruto_final = acum_cert[r["id"]] # FIX: Ahora es el acumulado real de todo el periodo
                impuesto = round(bruto_final * 0.05, 2)
                base_neta = round(bruto_final - impuesto, 2)
                
                # REGLAS v13 (Definidas por el usuario)
                capitalizacion = round(base_neta * (1 - r["porcentaje_reparto"]), 2)
                reparto_valor = round(base_neta * r["porcentaje_reparto"], 2)
                
                deducciones = 0.0 
                devolucion_capital = 0.0
                penalidad_rescate = 0.0 # Nuevo campo de penalidad
                
                # NETO FINAL = LO QUE SE PAGA (RETORNO)
                neto_total = round(base_neta - capitalizacion - deducciones, 2)
                
                # CAPITAL FINAL = SALDO REAL (Capital Base + Aumentos + Capitalización - Rescate - Penalidad)
                capital_contribuido = r["capital"] + sum(h["monto"] for h in r["hijos"])
                capital_final = round(capital_contribuido + capitalizacion - devolucion_capital - penalidad_rescate, 2)

                # APLANAR: Añadir padre y luego hijos al bloque
                rows_paged.append({
                    "tipo": "CERT",
                    "n_orden": cert_counter,
                    "id": r["id"], "inversionista": r["inversionista"], 
                    "capital": r["capital"],
                    "aumentos": r["capital_aumentos_total"],
                    "valores": r["valores_dia"][s:e],
                    "bruto_total": bruto_final,
                    "impuesto_total": impuesto,
                    "base_neta": base_neta,
                    "capitalizacion": capitalizacion,
                    "reparto_valor": reparto_valor,
                    "deducciones_total": deducciones,
                    "neto_total": neto_total,
                    "devolucion_capital": devolucion_capital,
                    "penalidad_rescate": penalidad_rescate,
                    "capital_final": capital_final
                })

                for h in r["hijos"]:
                    rows_paged.append({
                        "tipo": "AUMENTO",
                        "id": h["id"],
                        "capital": h["monto"],
                        "valores": h["valores_dia"][s:e]
                    })

            period_blocks.append({
                "idx": idx + 1,
                "month_name": f"{get_month_name(key[1])} {key[0]}",
                "days": [d.strftime('%d/%m') for d in dias_periodo[s:e]],
                "is_last": is_last_page,
                "rows": rows_paged
            })

        reporte_fondos.append({
            "fondo": fondo,
            "vars": {"pasiva": f"{tasa_pasiva*100:.2f}"},
            "blocks": period_blocks
        })

    def format_num(v):
        try:
            if v is None or v == 0: return "-"
            return "{:,.2f}".format(float(v))
        except: return str(v)

    report_context = {
        "fondos": reporte_fondos, "print_date": date.today().strftime('%d/%m/%Y'),
        "format_num": format_num
    }

    if return_data: return reporte_fondos

    print("Renderizando PDF v19...")
    pdf_bytes = _generate_pdf_in_memory("reporte_intereses_transpuesto_v19.html", report_context)
    
    output_path = os.path.join(project_root, "reports", "reporte_maestro_intereses_v19_transpuesto.pdf")
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "wb") as f: f.write(pdf_bytes)

    print(f"Exito! v19 en: {output_path}")
    return output_path

if __name__ == "__main__":
    generate_retornos_v19(codigo_fondo="NSGPEN01")
