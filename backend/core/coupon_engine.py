import math
from datetime import datetime, date
from typing import Dict, Any

def calculate_coupon_event(
    monto_inicial: float,
    tasa_anual: float,
    fecha_inicio: date,
    fecha_fin: date,
    porcentaje_reparto: float = 0.0,
    deducciones: float = 0.0,
    tax_rate: float = 0.05,
    deducciones_list: list = None
) -> Dict[str, Any]:
    """
    Calculates the interest (cupón) and capitalization for a certificate.
    """
    
    # Calculate days elapsed (Inclusive)
    delta = fecha_fin - fecha_inicio
    dias = max(delta.days, 0) + 1
    
    # Financial calculation
    tasa_diaria = tasa_anual / 360
    interes_bruto = monto_inicial * tasa_diaria * dias
    
    # Tax
    impuesto = interes_bruto * tax_rate
    interes_neto = interes_bruto - impuesto
    
    # Dynamic Deductions
    total_deducido_dinamico = 0.0
    deducciones_log = []
    if deducciones_list:
        from core.coupon_engine import filter_active_deducciones_for_period, apply_deducciones_to_coupon
        activas = filter_active_deducciones_for_period(deducciones_list, fecha_fin)
        total_deducido_dinamico, deducciones_log = apply_deducciones_to_coupon(monto_inicial, interes_neto, activas)
    
    # Total deductions (legacy + dynamic)
    deducciones_totales = deducciones + total_deducido_dinamico
    
    # Payout vs Capitalization
    monto_reparto = interes_neto * (porcentaje_reparto / 100.0)
    monto_capitalizacion = interes_neto - monto_reparto
    
    # Final Result
    monto_resultante = monto_inicial + monto_capitalizacion - deducciones_totales
    
    # Format formula for display
    formula_detalle = f"{monto_inicial:,.2f} * ({tasa_anual*100:.2f}%/360) * {dias} días"
    
    return {
        "dias_transcurridos": dias,
        "interes_bruto": round(interes_bruto, 2),
        "impuesto": round(impuesto, 2),
        "interes_neto": round(interes_neto, 2),
        "monto_reparto": round(monto_reparto, 2),
        "monto_capitalizacion": round(monto_capitalizacion, 2),
        "monto_resultante": round(monto_resultante, 2),
        "formula_detalle": formula_detalle,
        "tasa_aplicada": tasa_anual,
        "deducciones": round(deducciones_totales, 2),
        "deducciones_log": deducciones_log
    }

def filter_active_deducciones_for_period(deducciones: list, fecha_pago: date) -> list:
    """
    Filters a list of deductions to find those active on a specific payment date.
    Handles RANGO, PUNTUAL, and CRONOGRAMA frequencies.
    """
    active_deductions = []
    for d in deducciones:
        if d.get('estado') != 'ACTIVO':
            continue
            
        freq = d.get('frecuencia')
        
        if freq == 'RANGO':
            inicio = datetime.strptime(d['fecha_inicio'], '%Y-%m-%d').date() if d.get('fecha_inicio') else date.min
            fin = datetime.strptime(d['fecha_fin'], '%Y-%m-%d').date() if d.get('fecha_fin') else date.max
            if inicio <= fecha_pago <= fin:
                active_deductions.append(d)
                
        elif freq == 'PUNTUAL':
            inicio = datetime.strptime(d['fecha_inicio'], '%Y-%m-%d').date() if d.get('fecha_inicio') else None
            if inicio == fecha_pago:
                active_deductions.append(d)
                
        elif freq == 'CRONOGRAMA':
            crono = d.get('cronograma_jsonb', {})
            fecha_str = fecha_pago.strftime('%Y-%m-%d')
            if fecha_str in crono:
                d_copy = d.copy()
                try:
                    d_copy['valor'] = float(crono[fecha_str])
                    active_deductions.append(d_copy)
                except (ValueError, TypeError):
                    pass
                    
    return sorted(active_deductions, key=lambda x: x.get('prioridad_orden', 1))

def apply_deducciones_to_coupon(monto_inicial: float, interes_neto: float, deducciones_activas: list) -> tuple:
    """
    Applies active deductions to the net interest or initial capital depending on the setting.
    Returns the (total_deducted, detailed_log)
    """
    total_deducido = 0.0
    log = []
    
    for d in deducciones_activas:
        tipo = d.get('tipo_valor')
        valor = float(d.get('valor', 0.0))
        id_deduc = d.get('id')
        base_calculo = d.get('base_calculo', 'CUPON')
        
        monto_a_restar = 0.0
        if tipo == 'FIJO':
            monto_a_restar = valor
        elif tipo == 'PORCENTUAL':
            if base_calculo == 'CAPITAL':
                monto_a_restar = monto_inicial * (valor / 100.0)
            else:
                monto_a_restar = interes_neto * (valor / 100.0)
            
        total_deducido += monto_a_restar
        log.append({
            'id_deduccion': id_deduc,
            'monto_restado': round(monto_a_restar, 2),
            'tipo': tipo,
            'valor_base': valor,
            'base_calculo': base_calculo
        })
        
    return round(total_deducido, 2), log
