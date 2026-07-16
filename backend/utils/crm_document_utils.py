import os
import re
from datetime import date
from num2words import num2words

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

def prepare_batch_contexts(reporte_fondos, inv_map, logo_path, firma_path):
    """
    Transforma la data del Motor V20 en contextos listos para HTML
    """
    estado_cuenta_context = []
    retenciones_context = []
    
    # Rango Default (como en orquestador)
    f_inicio_str = "01.01.2026"
    f_fin_str = "28.02.2026"
    
    hoy = date.today()
    dia_hoy = f"{hoy.day:02d}"
    mes_hoy = get_month_name(hoy.month).lower()
    anio_hoy = str(hoy.year)

    for f_data in reporte_fondos:
        fondo_obj = f_data["fondo"]
        nombre_fondo_texto = fondo_obj.get("nombre_fondo", "Fondo Desconocido")
        
        # El motor V20 devuelve bloques. Usamos el último bloque para los totales del periodo.
        last_block = f_data["blocks"][-1]
        
        for row in last_block["rows"]:
            if row.get("tipo") != "CERT": continue # Saltar filas de aumentos (hijos)
            
            raw_id = row["id"]
            
            # Buscamos el inversionista en el mapa por su ID
            # El motor V20 ya trae el nombre, pero el orquestador solía reconstruirlo para las retenciones
            # Para esta fase de auditoría usaremos la data que ya viene pre-calculada y limpia
            
            nombre_inv = row["inversionista"]
            # Intentamos obtener el DNI limpio para las retenciones (asumimos que el ID del certificado contiene pistas o usamos el inv_map si está disponible)
            # En V20, inversionista ya es un string. Necesitamos el DNI original para el certificado de retención.
            
            # Buscamos en el inv_map suplementario
            inv_info = inv_map.get(normalize_id(row.get('id_inversionista_1'))) or {}
            dnis_final = inv_info.get('dni', '')
            domicilio = inv_info.get('domicilio', "Domicilio no registrado")

            moneda = fondo_obj.get('moneda', 'USD') # O del contrato si el motor lo expone
            
            # 1. Contexto Estado de Cuenta
            estado_cuenta_context.append({
                "fondo_nombre": nombre_fondo_texto,
                "id_certificado": raw_id,
                "inversionista_nombre": nombre_inv,
                "moneda": moneda,
                "fecha_inicio_str": f_inicio_str,
                "fecha_fin_str": f_fin_str,
                "capital_inicial": row['capital'],
                "bruto_total": row['bruto_total'],
                "impuesto": -row['impuesto_total'] if row['impuesto_total'] > 0 else 0,
                "deducciones": -row['deducciones_total'] if row['deducciones_total'] > 0 else 0,
                "neto_disponible": row['neto_total'],
                "capitalizacion": row['capitalizacion'],
                "rescates": row['devolucion_capital'],
                "monto_transferido": row['reparto_valor'] + row['devolucion_capital'],
                "capital_final": row['capital_final'],
                "cuotas_final": row.get('cuotas_final', 0) # El motor V20 base no tiene cuotas, se añade luego
            })
            
            # 2. Contexto Retenciones (Solo si hay impuesto)
            if row['impuesto_total'] > 0:
                retenciones_context.append({
                    "nombre_fondo": nombre_fondo_texto,
                    "nombres_participes": nombre_inv,
                    "dni_participes": dnis_final,
                    "direccion_fiscal": domicilio,
                    "moneda": moneda,
                    "monto_impuesto_num": f"{row['impuesto_total']:,.2f}",
                    "monto_impuesto_letras": monto_a_letras(row['impuesto_total']),
                    "f_inicio": f_inicio_str.replace('.', '-'),
                    "f_fin": f_fin_str.replace('.', '-'),
                    "dia_hoy": dia_hoy,
                    "mes_hoy": mes_hoy,
                    "anio_hoy": anio_hoy
                })

    return {
        "estado_cuenta": estado_cuenta_context,
        "retenciones": retenciones_context
    }
