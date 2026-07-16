"""
Liquidation Table Generator
---------------------------
Generates the Master Audit Table (DataFrame) for a factoring operation.
Uses the 'liquidation_rules' engine for calculations.
"""

import pandas as pd
from datetime import date, timedelta
from typing import List, Dict
from core.liquidation_rules import calcular_interes_compuesto, aplicar_pago_parcial

def generar_tabla_maestra_auditoria(
    capital_original: float,
    tasa_mensual: float,
    tasa_moratoria: float,
    fecha_desembolso: date,
    fecha_vencimiento: date,
    pagos: List[Dict],
    dias_proyeccion: int = 30,
    com_est: float = 0.0,
    igv_com_est: float = 0.0,
    com_afi: float = 0.0,
    igv_com_afi: float = 0.0,
    monto_desembolsado: float = 0.0,
    int_min_originacion: float = 0.0,
    capital_financiado: float = 0.0
) -> pd.DataFrame:
    """
    Generates the day-by-day audit table handling partial payments, min interest, etc.
    """
    
    # Defaults
    if capital_financiado <= 0:
        capital_financiado = capital_original

    # 1. Determine End Date
    if pagos:
        fecha_ultimo_pago = max(p['fecha'] for p in pagos)
        fecha_fin = max(fecha_ultimo_pago, fecha_vencimiento) + timedelta(days=dias_proyeccion)
    else:
        fecha_fin = fecha_vencimiento + timedelta(days=dias_proyeccion)
    
    pagos_por_fecha = {p['fecha']: p['monto'] for p in pagos}
    
    # 2. State Variables
    tabla = []
    capital_remanente = capital_original
    fecha_actual = fecha_desembolso + timedelta(days=1)
    fecha_ultimo_pago_realizado = fecha_desembolso
    es_primer_pago = True
    
    # Active debts
    com_est_activa = com_est
    com_afi_activa = com_afi
    
    # Int Min Logic
    if int_min_originacion > 0:
        int_min_activo = int_min_originacion
    else:
        int_min_activo = calcular_interes_compuesto(capital_financiado, tasa_mensual, 15)
        
    int_mora_acum = 0.0
    
    # 3. Simulate Day-by-Day
    while fecha_actual <= fecha_fin:
        if capital_remanente <= 0.01 and not pagos_por_fecha.get(fecha_actual):
             # Stop if debt is cleared and no pending payments today
             # But usually allow run until end of view
             pass

        dia_desde_desembolso = (fecha_actual - fecha_desembolso).days
        dias_desde_ultimo_pago = (fecha_actual - fecha_ultimo_pago_realizado).days
        
        # Hybrid Base: Before first payment use Contract Capital (Financiado). After, use Remnant.
        base_calculo_interes = capital_financiado if es_primer_pago else capital_remanente

        pago_hoy = pagos_por_fecha.get(fecha_actual, None)
        
        # --- A. Interest Calculation ---
        
        # Min Interest (Period 0-15 days from last payment event)
        # Note: The rule is usually 15 days from Disbursement specifically for Min Interest
        # If we are in first payment cycle:
        if int_min_activo > 0 and dias_desde_ultimo_pago <= 15:
            # Check if today is a payment that clears it
            if pago_hoy:
                 # Calculate total needed to clear
                 total_fees = int_min_activo*1.18 + com_est_activa*1.18 + com_afi_activa*1.18
                 if pago_hoy >= (capital_remanente + total_fees):
                     # Full liquidation early -> Proportional Min Int
                     int_min = calcular_interes_compuesto(base_calculo_interes, tasa_mensual, dias_desde_ultimo_pago)
                 else:
                     int_min = int_min_activo
            else:
                int_min = int_min_activo
        else:
            int_min = 0.0
            
        # Devengado Interest (Day 16+)
        int_dev = 0.0
        if dia_desde_desembolso > 15:
            if int_min_activo == 0:
                # Min Int was already paid/cleared. Normal Interest resumes from last cutoff.
                # Cutoff is max(last_payment, day_15_Global)
                day_15_global = fecha_desembolso + timedelta(days=15)
                fecha_base = max(fecha_ultimo_pago_realizado, day_15_global)
                dias_curr = max(0, (fecha_actual - fecha_base).days)
                if dias_curr > 0:
                    int_dev = calcular_interes_compuesto(capital_remanente, tasa_mensual, dias_curr) # Always remanente here
            else:
                 # Min Int still active (unpaid). Devengado tracks global accumulation to compare
                 int_dev = calcular_interes_compuesto(base_calculo_interes, tasa_mensual, dia_desde_desembolso)
        
        # Moratorio
        if fecha_actual > fecha_vencimiento:
            mora_diaria = capital_remanente * (tasa_moratoria / 30.0)
            int_mora_acum += mora_diaria
            
        # --- B. Record Row State ---
        igv_int = (int_min + int_dev) * 0.18
        igv_mora = int_mora_acum * 0.18
        
        total_deuda_real = (
            capital_remanente + 
            int_min + int_dev + igv_int +
            int_mora_acum + igv_mora +
            com_est_activa*1.18 + com_afi_activa*1.18
        )
        
        tabla.append({
            'Fecha': fecha_actual,
            'Fecha_Str': fecha_actual.strftime('%d/%m/%Y'),
            'Día': dia_desde_desembolso,
            'Saldo Base': base_calculo_interes,
            'CapitalRemanente': capital_remanente, # Actual Debt Principal
            'Pagos': pago_hoy,
            'Int.Mínimo (15d)': int_min,
            'Int.Devengado': int_dev,
            'Int.Mora Acum': int_mora_acum,
            'IGV Devengado': igv_int,
            'IGV Mora': igv_mora,
            'raw_comision_est': com_est_activa,
            'raw_comision_afi': com_afi_activa,
            'TotalDeudaREAL': total_deuda_real,
            'Es Pago Real': pago_hoy is not None,
            'Zona': 'Vencimiento' if fecha_actual >= fecha_vencimiento else 'Normal'
        })
        
        # --- C. Apply Payment ---
        if pago_hoy:
            res = aplicar_pago_parcial(
                monto_pago=pago_hoy,
                capital_remanente=capital_remanente,
                int_min_acum=int_min,
                int_dev_acum=int_dev,
                int_mora_acum=int_mora_acum,
                com_est=com_est_activa,
                com_afi=com_afi_activa,
                es_primer_pago=es_primer_pago
            )
            (capital_remanente, _, _, new_mora, new_com1, new_com2, _) = res
            
            # Update state
            int_mora_acum = new_mora
            com_est_activa = new_com1
            com_afi_activa = new_com2
            
            fecha_ultimo_pago_realizado = fecha_actual
            es_primer_pago = False
            
            # If min int was active, update what remains (if it wasn't fully wiped, though usually it is if paid enough)
            # Simplification: If paid, we assume MinInt requirement is satisfied or carried as remnant logic handled by waterfall
            # Here we just mark that we passed the first payment milestone
            int_min_activo = 0.0 # Standard logic: Post-payment we switch to standard devengado usually
            
            if capital_remanente <= 0.01:
                break
                
        fecha_actual += timedelta(days=1)

    return pd.DataFrame(tabla)

def calcular_costos_totales_a_fecha(df: pd.DataFrame, fecha_pago: date) -> Dict:
    """
    Extracts total costs from the dataframe for a specific date row.
    Useful for 'Candado' validation validation.
    """
    # Find row
    row = df[df['Fecha'] == fecha_pago]
    if row.empty:
        # If exact date not in table (e.g. table ended earlier), retry generation or use last
        if not df.empty and df.iloc[-1]['Fecha'] < fecha_pago:
             row = df.iloc[[-1]] # Fallback to last known
        else:
             return {}
    
    r = row.iloc[0]
    
    # Extract components
    i_min = r['Int.Mínimo (15d)']
    i_dev = r['Int.Devengado']
    i_mora = r['Int.Mora Acum']
    c_est = r['raw_comision_est']
    c_afi = r['raw_comision_afi']
    
    igv = (i_min + i_dev + i_mora + c_est + c_afi) * 0.18
    
    total = (i_min + i_dev + i_mora + c_est + c_afi + igv)
    
    return {
        'interes_devengado': max(i_min, i_dev), # Logic: Min subsumes Dev if active, or Dev is Dev
        'interes_moratorio': i_mora,
        'comisiones': c_est + c_afi,
        'igv_total': igv,
        'total_costo_financiero': total
    }
