import os
import sys
import re
from datetime import date
import pandas as pd
from num2words import num2words

project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from FLOW_CHARTS.scripts_CRM.C01_Motores_Calculo_NAV_y_PYL.MOTOR_A_y_B_Calculo_NAV_y_PYL import get_v25_calculation_data
from FLOW_CHARTS.scripts_CRM.C01_Motores_Calculo_NAV_y_PYL.CALCULO_Retornos_Intereses_Base365 import generate_retornos_v13
from src.data.supabase_client import get_supabase_client
from src.utils.pdf_generators import _generate_pdf_in_memory

def normalize_id(doc):
    if not doc: return None
    nums = re.sub(r'\D', '', str(doc))
    return nums.lstrip('0')

def monto_a_letras(monto):
    entero = int(monto)
    decimal = int(round((monto - entero) * 100))
    letras = num2words(entero, lang='es')
    return f"{letras} con {decimal:02d}/100"

def get_month_name(month_idx):
    names = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
    return names[month_idx - 1]

def run_integration():
    codigo_fondo = "NSGPEN01"
    print(f"--- INICIANDO ORQUESTADOR DE REPORTES PARA: {codigo_fondo} ---")
    
    # 1. Obtener Data V25 (Motores A y B)
    print("Obteniendo Data de Motores V25 en memoria...")
    data_cuotas = get_v25_calculation_data(codigo_fondo=codigo_fondo)
    if not data_cuotas:
        print("Error: V25 no devolvió datos.")
        return
    fondo_cuotas = data_cuotas[0]
        
    last_block_cuotas = fondo_cuotas["blocks"][-1]
    # En V25 la cuota final está en la fila "VAL CUOTA FINAL" (is_vc=True)
    vc_row = next((r for r in reversed(last_block_cuotas["rows"]) if r.get("is_vc")), None)
    v_cuota_final = vc_row["valores"][-1] if vc_row else 1.0
    
    print(f" > Valor Cuota Final (V25) obtenido: {v_cuota_final}")

    # 2. Obtener Data V13 (Matemática Financiera Intereses)
    print("Obteniendo Data de Retornos V13 en memoria...")
    data_retornos = generate_retornos_v13(codigo_fondo=codigo_fondo, return_data=True)
    if not data_retornos:
        print("Error: V13 no devolvió datos.")
        return
    fondo_retornos = data_retornos[0]
    last_block_retornos = fondo_retornos["blocks"][-1]
    
    # Armar Dataframe V13 (Solo ultimo bloque que tiene los totales)
    df_retornos = pd.DataFrame(last_block_retornos["rows"])
    print(f" > Dataframe Retornos (V13) armado con {len(df_retornos)} certificados.")

    # 3. Obtener Data CRM (Nombres, Domicilios, Datos Generales)
    print("Conectando base CRM Inversionistas...")
    supabase = get_supabase_client()
    
    inv_res = supabase.table('crm_inversionistas').select('codigo_inversionista, documento_identidad, nombre_1, apellido_1, direccion_fiscal').execute()
    inv_map = {}
    for i in inv_res.data:
        k = normalize_id(i.get('codigo_inversionista')) or normalize_id(i.get('documento_identidad'))
        if k:
            n_part = f"{i['nombre_1']} {i.get('apellido_1', '')}".strip()
            inv_map[k] = {
                "nombre": n_part,
                "dni": str(i.get('documento_identidad') or i.get('codigo_inversionista')),
                "domicilio": i.get('direccion_fiscal') or "Domicilio no registrado"
            }

    cert_res = supabase.table('crm_certificados').select(
        'id_certificado, monto_inversion, titulares_resumen, fecha_emision, '
        'crm_contratos!inner(id_fondo, moneda, id_inversionista_1, id_inversionista_2, id_inversionista_3)'
    ).eq('estado', 'emitido').eq('crm_contratos.id_fondo', codigo_fondo).execute()
    
    nombre_fondo_texto = fondo_retornos["fondo"].get("nombre_fondo", codigo_fondo)
    logo_path = os.path.join(project_root, 'CRM-INANDES', 'logo.EFI.png').replace('\\', '/')
    firma_path = os.path.join(project_root, 'CRM-INANDES', 'Firma.Ricardo.GALLO.png').replace('\\', '/')
    
    estado_cuenta_context = []
    retenciones_context = []
    
    # Rango Default (Quemado para esta prueba interactiva como se ha venido usando)
    f_inicio_str = "01.01.2026"
    f_fin_str = "28.02.2026"
    
    hoy = date.today()
    dia_hoy = f"{hoy.day:02d}"
    mes_hoy = get_month_name(hoy.month).lower()
    anio_hoy = str(hoy.year)

    for c in cert_res.data:
        raw_id = c['id_certificado']
        
        # Buscar el row en el DataFrame
        row_v13 = df_retornos[df_retornos['id'] == raw_id]
        if row_v13.empty:
            continue
        row_v13 = row_v13.iloc[0]
        
        c_contrato = c.get('crm_contratos') or {}
        ids_a_buscar = []
        for key in ['id_inversionista_1', 'id_inversionista_2', 'id_inversionista_3']:
            vid = normalize_id(c_contrato.get(key))
            if vid and vid not in ids_a_buscar: ids_a_buscar.append(vid)
            
        titular_res = str(c.get('titulares_resumen', ''))
        extracted = re.findall(r'(?:DNI|CE|PAS|RUC)\s*([A-Za-z0-9]+)', titular_res, flags=re.IGNORECASE)
        for ext_id in extracted:
            norm_id = normalize_id(ext_id)
            if norm_id and norm_id not in ids_a_buscar:
                ids_a_buscar.append(norm_id)
                
        nombres_participes = []
        dnis_str_list = []
        domicilio = "Domicilio no registrado"
        
        for doc_id in ids_a_buscar:
            if doc_id in inv_map:
                nombre = inv_map[doc_id]['nombre']
                if nombre not in nombres_participes:
                    nombres_participes.append(nombre)
                    # Tomar DNI
                    prefijado = inv_map[doc_id]['dni']
                    solo_nums = "".join(filter(str.isdigit, prefijado))
                    if solo_nums not in dnis_str_list:
                         dnis_str_list.append(solo_nums)
                    # Tomar domicilio del primero valido
                    if inv_map[doc_id]['domicilio'] != "Domicilio no registrado":
                        domicilio = inv_map[doc_id]['domicilio']

        nombre_inv = " y ".join(nombres_participes) if nombres_participes else "Inversionista Desconocido"
        dnis_final = " y ".join(dnis_str_list) if dnis_str_list else ""
        
        moneda = c_contrato.get('moneda', 'USD')
        capital_inicial = row_v13['capital']
        bruto_total = row_v13['bruto_total']
        impuesto = row_v13['impuesto_total']
        base_neta = row_v13['base_neta']
        deducciones = row_v13['deducciones_total']
        neto_disponible = base_neta - deducciones
        capitalizacion = row_v13['capitalizacion']
        rescates = row_v13['devolucion_capital']
        monto_transferido = row_v13['reparto_valor'] + rescates
        capital_final = row_v13['capital_final']
        
        cuotas_final = capital_final / v_cuota_final
        
        # 1. Empujar a Estado de Cuenta Múltiple
        estado_cuenta_context.append({
            "fondo_nombre": nombre_fondo_texto,
            "id_certificado": raw_id,
            "inversionista_nombre": nombre_inv,
            "moneda": moneda,
            "fecha_inicio_str": f_inicio_str,
            "fecha_fin_str": f_fin_str,
            "capital_inicial": capital_inicial,
            "bruto_total": bruto_total,
            "impuesto": -impuesto if impuesto > 0 else 0,
            "deducciones": -deducciones if deducciones > 0 else 0,
            "neto_disponible": neto_disponible,
            "capitalizacion": capitalizacion,
            "rescates": rescates,
            "monto_transferido": monto_transferido,
            "capital_final": capital_final,
            "cuotas_final": cuotas_final
        })
        
        # 2. Generar Certificado de Retención de Rentas INDIVIDUAL (Solo si hay impuesto retenido)
        if impuesto > 0:
            ctx_retencion = {
                "nombre_fondo": nombre_fondo_texto,
                "nombres_participes": nombre_inv,
                "dni_participes": dnis_final,
                "direccion_fiscal": domicilio,
                "moneda": moneda,
                "monto_impuesto_num": f"{impuesto:,.2f}",
                "monto_impuesto_letras": monto_a_letras(impuesto),
                "f_inicio": f_inicio_str.replace('.', '-'),
                "f_fin": f_fin_str.replace('.', '-'),
                "dia_hoy": dia_hoy,
                "mes_hoy": mes_hoy,
                "anio_hoy": anio_hoy
            }
            retenciones_context.append(ctx_retencion)

    # ===== BATCH DE ESTADOS DE CUENTA =====
    def format_num(v):
        try:
            if v == "" or v is None: return "0.00"
            if float(v) == 0.0: return "-"
            return "{:,.2f}".format(float(v))
        except: return str(v)

    def format_vc(v):
        try:
            if v == "" or v is None: return "0.00"
            if float(v) == 0.0: return "-"
            return "{:,.2f}".format(float(v))
        except: return str(v)

    report_context = {
        "certs": estado_cuenta_context,
        "format_num": format_num, 
        "format_vc": format_vc,
        "logo_path": logo_path
    }
    
    if estado_cuenta_context:
        print("Renderizando Estado de Cuenta Batch Integrado...")
        pdf_bytes_eecc = _generate_pdf_in_memory("estado_cuenta_inversionista_v1.html", report_context)
        out_eecc = os.path.join(project_root, "reports", f"estado_cuenta_batch_integrado_{codigo_fondo}.pdf")
        with open(out_eecc, "wb") as f: f.write(pdf_bytes_eecc)
        print(f" -> Generado Estados de Cuenta Integrados en: {out_eecc}")
        
    if retenciones_context:
        print("Renderizando Certificados de Retención Batch Integrado...")
        ctx_master = {
            "certificados": retenciones_context,
            "logo_path": logo_path,
            "firma_path": firma_path
        }
        pdf_bytes_ret = _generate_pdf_in_memory("retencion_renta_v1.html", ctx_master)
        out_ret = os.path.join(project_root, "reports", f"retenciones_batch_integrado_{codigo_fondo}.pdf")
        with open(out_ret, "wb") as f: f.write(pdf_bytes_ret)
        print(f" -> Generado Retenciones Integradas en: {out_ret}")
    
    print("\n--- PROCESO TERMINADO ---")

if __name__ == "__main__":
    run_integration()
