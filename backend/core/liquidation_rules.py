"""
Liquidation Rules Engine
------------------------
Contains the pure mathematical logic and payment application rules for the Liquidation Module.
This module is stateless and only performs calculations based on inputs.
"""

from typing import Tuple, Dict

def calcular_interes_compuesto(capital: float, tasa_mensual: float, dias: int) -> float:
    """
    Calculates compound interest using the formula: ((1 + rate/30)^days - 1) * capital
    """
    if dias <= 0:
        return 0.0
    return ((1 + tasa_mensual / 30) ** dias - 1) * capital

def aplicar_pago_parcial(
    monto_pago: float,
    capital_remanente: float,
    int_min_acum: float,
    int_dev_acum: float,
    int_mora_acum: float,
    com_est: float,
    com_afi: float,
    es_primer_pago: bool
) -> Tuple[float, float, float, float, float, float, Dict]:
    """
    Applies a partial payment following the strict waterfall logic.
    
    Waterfall Priority:
    1. Mora (if applicable/posting second payment) -> Logic depends on First vs Subsequent
    
    Logic First Payment (Day <= 15 typically):
    1. Interes (Min or Dev) + IGV
    2. Comisiones + IGV
    3. Mora (if any)
    4. Capital
    
    Logic Subsequent Payments:
    1. Mora + IGV
    2. Interes + IGV
    3. Capital
    
    Returns:
        (new_capital, int_min_rem, int_dev_rem, int_mora_rem, com_est_rem, com_afi_rem, payment_details)
    """
    IGV_RATE = 0.18
    pago_restante = monto_pago
    detalles = {
        'capital_pagado': 0.0,
        'int_min_pagado': 0.0,
        'int_dev_pagado': 0.0,
        'int_mora_pagado': 0.0,
        'igv_int_pagado': 0.0,
        'igv_mora_pagado': 0.0,
        'com_est_pagada': 0.0,
        'com_afi_pagada': 0.0,
        'igv_com_pagado': 0.0
    }
    
    # Calculate current IGV amounts associated with the debts
    igv_int = (int_min_acum + int_dev_acum) * IGV_RATE
    igv_mora = int_mora_acum * IGV_RATE
    igv_com_est = com_est * IGV_RATE
    igv_com_afi = com_afi * IGV_RATE
    
    if es_primer_pago:
        # === PRIMER PAGO CAUSA ===
        # Priority: Interest -> Commissions -> Mora -> Capital
        
        # 1. Pay Interest (Min or Dev) + IGV
        total_intereses = int_min_acum + int_dev_acum + igv_int
        if pago_restante >= total_intereses:
            pago_restante -= total_intereses
            detalles['int_min_pagado'] += int_min_acum
            detalles['int_dev_pagado'] += int_dev_acum
            detalles['igv_int_pagado'] += igv_int
            
            int_min_acum = 0.0
            int_dev_acum = 0.0
        else:
            # Insufficient to cover even interest
            # Logic: We don't partial pay interest on first payment usually blocks, but here we return remainder
            # For simplicity/robustness, we reduce none and return
            return (capital_remanente, int_min_acum, int_dev_acum, int_mora_acum, com_est, com_afi, detalles)
        
        # 2. Pay Commissions + IGV
        total_comisiones = com_est + igv_com_est + com_afi + igv_com_afi
        if pago_restante >= total_comisiones:
            pago_restante -= total_comisiones
            detalles['com_est_pagada'] += com_est
            detalles['com_afi_pagada'] += com_afi
            detalles['igv_com_pagado'] += (igv_com_est + igv_com_afi)
            
            com_est = 0.0
            com_afi = 0.0
        else:
            return (capital_remanente, int_min_acum, int_dev_acum, int_mora_acum, com_est, com_afi, detalles)
            
        # 2.5 Pay Mora (if any exists on first payment day - rare but possible)
        total_mora = int_mora_acum + igv_mora
        if total_mora > 0:
            if pago_restante >= total_mora:
                pago_restante -= total_mora
                detalles['int_mora_pagado'] += int_mora_acum
                detalles['igv_mora_pagado'] += igv_mora
                int_mora_acum = 0.0
            else:
                proporcion = pago_restante / total_mora
                detalles['int_mora_pagado'] += int_mora_acum * proporcion
                detalles['igv_mora_pagado'] += igv_mora * proporcion
                int_mora_acum *= (1 - proporcion)
                return (capital_remanente, int_min_acum, int_dev_acum, int_mora_acum, 0.0, 0.0, detalles)

        # 3. Capital
        capital_pagado = min(capital_remanente, pago_restante)
        detalles['capital_pagado'] = capital_pagado
        nuevo_capital = capital_remanente - capital_pagado
        
    else:
        # === PAGOS POSTERIORES ===
        # Priority: Mora -> Interest -> Capital
        
        # 1. Pay Mora + IGV
        total_mora = int_mora_acum + igv_mora
        if pago_restante >= total_mora:
            pago_restante -= total_mora
            detalles['int_mora_pagado'] += int_mora_acum
            detalles['igv_mora_pagado'] += igv_mora
            int_mora_acum = 0.0
        else:
            proporcion = pago_restante / total_mora
            detalles['int_mora_pagado'] += int_mora_acum * proporcion
            detalles['igv_mora_pagado'] += igv_mora * proporcion
            int_mora_acum *= (1 - proporcion)
            pago_restante = 0.0
            return (capital_remanente, int_min_acum, int_dev_acum, int_mora_acum, 0.0, 0.0, detalles)
        
        # 2. Pay Compensatory Interest + IGV
        # Note: Subsequent payments usually deal with generated devengado
        total_compensatorio = int_dev_acum + (int_dev_acum * IGV_RATE)
        # Note: 'int_min_acum' should essentially be 0 here if first payment passed logic, but handled if exists
        
        if pago_restante >= total_compensatorio:
            pago_restante -= total_compensatorio
            detalles['int_dev_pagado'] += int_dev_acum
            detalles['igv_int_pagado'] += (int_dev_acum * IGV_RATE)
            int_dev_acum = 0.0
        else:
            if total_compensatorio > 0:
                proporcion = pago_restante / total_compensatorio
                detalles['int_dev_pagado'] += int_dev_acum * proporcion
                detalles['igv_int_pagado'] += (int_dev_acum * IGV_RATE) * proporcion
                int_dev_acum *= (1 - proporcion)
            pago_restante = 0.0
            return (capital_remanente, int_min_acum, int_dev_acum, int_mora_acum, 0.0, 0.0, detalles)
        
        # 3. Capital
        capital_pagado = min(capital_remanente, pago_restante)
        detalles['capital_pagado'] = capital_pagado
        nuevo_capital = capital_remanente - capital_pagado
    
    return (nuevo_capital, 0.0, 0.0, 0.0, 0.0, 0.0, detalles)
