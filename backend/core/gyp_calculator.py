
import pandas as pd
from typing import Dict, Optional

def calculate_gyp_oracle(
    df_maestra: pd.DataFrame, 
    capital_desembolsado: float
) -> Dict:
    """
    Calcula el G&P (Ganancias y Pérdidas) Operativo basado ESTRITAMENTE en la Tabla Oracle.
    
    Lógica de Extracción:
    1. Pagos: Suma de columna 'Pagos' (filas donde EsPago=True).
    2. Comisiones: Se extraen de la PRIMERA fila de pago (se asume cobro inicial).
    3. Intereses: Se recorren TODAS las filas de pago y se suman IntMin/IntDev y IntMora.
    
    Validación (Checksum):
    G&P = UltimoPago - TotalDeudaReal (en el momento del último pago).
    """
    if df_maestra.empty:
        return {"error": "Tabla vacía"}
    
    # 1. Filtrar filas de pago
    pagos_df = df_maestra[df_maestra['EsPago'] == True].copy()
    
    if pagos_df.empty:
         return {
            "ingresos": {"total_pagado": 0.0},
            "egresos": {},
            "resultado": {"saldo_gyp": -capital_desembolsado, "check_pass": True} # Si no hay pagos, se debe todo el capital
        }
    
    # --- INGRESOS ---
    total_pagado = pagos_df['Pagos'].sum()
    
    # --- EGRESOS (Componentes) ---
    
    # A. Capital (Dato de entrada, no de tabla, aunque tabla tiene CapitalRemanente)
    # Usamos el desembolso real como el "Costo" inicial para Inandes
    costo_capital = capital_desembolsado
    
    # B. Comisiones (Solo del primer pago)
    primer_pago_row = pagos_df.iloc[0]
    com_est = primer_pago_row.get('ComEst', 0.0)
    igv_com_est = primer_pago_row.get('IGV_ComEst', 0.0)
    com_afi = primer_pago_row.get('ComAfi', 0.0)
    igv_com_afi = primer_pago_row.get('IGV_ComAfi', 0.0)
    
    total_comisiones = com_est + igv_com_est + com_afi + igv_com_afi
    
    # C. Intereses Compensatorios y Desglose (Recorrer todos los pagos)
    total_int_comp = 0.0
    total_int_min = 0.0
    total_int_dev = 0.0
    
    for _, row in pagos_df.iterrows():
        # Lógica exclusiva: IntMin O IntDev
        int_min = row.get('IntMin', 0.0)
        int_dev = row.get('IntDev', 0.0)
        
        if int_min > 0:
            total_int_min += int_min
            total_int_comp += int_min
        else:
            total_int_dev += int_dev
            total_int_comp += int_dev
            
    # D. Intereses Moratorios (Recorrer todos los pagos)
    total_int_mora = pagos_df['IntMora'].sum()
    
    # E. IGV Intereses (Recorrer todos los pagos y desglosar)
    # Sumamos las columnas de IGV mostradas en el momento del pago
    total_igv_only_int = pagos_df['IGV_Int'].sum()
    total_igv_only_mora = pagos_df['IGV_Mora'].sum()
    total_igv_int = total_igv_only_int + total_igv_only_mora
    
    # TOTAL EGRESOS TEÓRICOS
    total_egresos = (
        costo_capital + 
        total_comisiones + 
        total_int_comp + 
        total_int_mora + 
        total_igv_int
    )
    
    # --- RESULTADO G&P (Método 1: Sumatoria) ---
    saldo_gyp = total_pagado - total_egresos
    
    # --- VALIDACIÓN (Método 2: Checksum Último Pago) ---
    # Checksum = UltimoPago - DeudaTotalEnEseInstante
    ultimo_pago_real = pagos_df.iloc[-1]['Pagos']
    deuda_momento_final = pagos_df.iloc[-1]['TotalDeudaREAL']
    
    checksum_val = ultimo_pago_real - deuda_momento_final
    
    # Diferencia permitida por redondeos (acumulación de float)
    diff = abs(saldo_gyp - checksum_val)
    check_pass = diff < 0.05 # 5 céntimos de tolerancia
    
    return {
        "ingresos": {
            "total_pagado": round(total_pagado, 2)
        },
        "egresos": {
            "capital_prestado": round(costo_capital, 2),
            "interes_compensatorio": round(total_int_comp, 2),
            "interes_moratorio": round(total_int_mora, 2),
            "igv_intereses": round(total_igv_int, 2), # Legacy
            
            # Desglose Granular (Matching Table Columns)
            "interes_minimo": round(total_int_min, 2),
            "interes_devengado": round(total_int_dev, 2),
            "interes_moratorio": round(total_int_mora, 2),
            "igv_interes_comp": round(total_igv_only_int, 2),
            "igv_interes_mora": round(total_igv_only_mora, 2),
            
            "comision_estructuracion": round(com_est, 2),
            "igv_com_estructuracion": round(igv_com_est, 2),
            "comision_afiliacion": round(com_afi, 2),
            "igv_com_afiliacion": round(igv_com_afi, 2),
            
            "comisiones_neto": round(com_est + com_afi, 2), # Legacy
            "igv_comisiones": round(igv_com_est + igv_com_afi, 2), # Legacy
            "comisiones_total": round(total_comisiones, 2), # Legacy support / Validation
            "total_egresos": round(total_egresos, 2)
        },
        "resultado": {
            "saldo_gyp": round(saldo_gyp, 2),
            "checksum_gyp": round(checksum_val, 2),
            "diff": diff,
            "check_pass": check_pass,
            "interpretacion": "DEVOLVER AL CLIENTE" if saldo_gyp > 0 else "CLIENTE TIENE DEUDA / EXACTO"
        },
        "debug": {
            "ultimo_pago": ultimo_pago_real,
            "deuda_final_tabla": deuda_momento_final
        }
    }
