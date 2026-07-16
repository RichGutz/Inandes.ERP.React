
import pandas as pd
import datetime
from datetime import date, timedelta
import math

def calcular_interes_compuesto_diario(capital: float, tasa_mensual: float, dias: int) -> float:
    """
    Calcula interés compuesto usando la fórmula del Excel:
    (1 + tasa_mensual/30)^dias - 1) × capital
    """
    if dias <= 0:
        return 0.0
    # Tasa diaria según convención: tasa_mensual / 30
    return ((1 + tasa_mensual / 30) ** dias - 1) * capital

def generar_tabla_devengamiento(
    capital: float,
    tasa_comp: float,
    tasa_mora: float,
    fecha_desembolso: date,
    fecha_vencimiento: date,
    fecha_pago_real: date,
    dias_minimos: int = 15,
    comision_estructuracion: float = 0.0,
    comision_afiliacion: float = 0.0
) -> pd.DataFrame:
    """
    Genera tabla día a día de devengamiento con interés compuesto.
    Sirve como 'Oracle' para validar liquidaciones.
    """
    # Determinar rango de fechas
    # Se extiende 5 días después del max(pago, vencimiento) para visualización
    fecha_inicio = fecha_desembolso
    fecha_fin = max(fecha_pago_real, fecha_vencimiento) + timedelta(days=5)
    
    # Calcular intereses mínimos (costo fijo por usar el dinero X días mínimos)
    interes_minimo = calcular_interes_compuesto_diario(capital, tasa_comp, dias_minimos)
    
    # IGVs Comisiones
    igv_com_est = comision_estructuracion * 0.18
    igv_com_afi = comision_afiliacion * 0.18
    
    datos = []
    fecha_actual = fecha_inicio
    dia_num = 0
    
    while fecha_actual <= fecha_fin:
        dias_desde_desembolso = (fecha_actual - fecha_desembolso).days
        
        # 1. Intereses compensatorios acumulados (con días reales desde desembolso)
        interes_comp_acum = calcular_interes_compuesto_diario(capital, tasa_comp, dias_desde_desembolso)
        
        # 2. Intereses devengados finales = MAX(reales, mínimos)
        # Nota: El mínimo aplica sobre el TOTAL acumulado. Si el acumulado es menor al mínimo, se cobra el mínimo.
        interes_devengado = max(interes_comp_acum, interes_minimo)
        igv_devengado = interes_devengado * 0.18
        
        # 3. Intereses moratorios acumulados (solo después de vencimiento)
        if fecha_actual > fecha_vencimiento:
            dias_mora = (fecha_actual - fecha_vencimiento).days
            interes_mora_acum = calcular_interes_compuesto_diario(capital, tasa_mora, dias_mora)
        else:
            dias_mora = 0
            interes_mora_acum = 0.0
        
        igv_mora_acum = interes_mora_acum * 0.18

        # 4. Total Comisiones (Fijas)
        # Se asume que se deben desde el día 0
        total_comisiones = comision_estructuracion + comision_afiliacion
        total_igv_comisiones = igv_com_est + igv_com_afi
        
        # Determinar zona para visualización (Tablas UI)
        if fecha_actual < fecha_vencimiento:
            zona = "Normal"
        elif fecha_actual == fecha_vencimiento:
            zona = "Vencimiento"
        elif fecha_actual == fecha_pago_real:
            zona = "Pago Real"
        elif fecha_actual > fecha_vencimiento:
            zona = "Mora"
        else:
            zona = "Normal" # Fallback
        
        datos.append({
            'Día': dia_num,
            'Fecha': fecha_actual,
            'Fecha_Str': fecha_actual.strftime('%Y-%m-%d'),
            'Int.Comp Acum': round(interes_comp_acum, 2),
            'IGV Comp': round(interes_comp_acum * 0.18, 2),
            'Int.Mínimo (15d)': round(interes_minimo, 2),
            'Int.Devengado': round(interes_devengado, 2),
            'IGV Devengado': round(igv_devengado, 2),
            'Int.Mora Acum': round(interes_mora_acum, 2),
            'IGV Mora': round(igv_mora_acum, 2),
            'Comisiones': round(total_comisiones, 2),
            'IGV Comisiones': round(total_igv_comisiones, 2), 
            'Zona': zona,
            'Es Pago Real': (fecha_actual == fecha_pago_real),
            # Datos crudos para cálculos exactos
            'raw_int_devengado': interes_devengado,
            'raw_int_mora': interes_mora_acum,
            'raw_comision_est': comision_estructuracion,
            'raw_comision_afi': comision_afiliacion,
            'raw_igv_total': igv_devengado + igv_mora_acum + total_igv_comisiones
        })
        
        fecha_actual += timedelta(days=1)
        dia_num += 1
    
    return pd.DataFrame(datos)

def calcular_costos_totales_a_fecha(df_oracle: pd.DataFrame, fecha_objetivo: date) -> dict:
    """
    Extrae los costos totales (Interés + Mora + Comisiones + IGV) de la tabla Oracle para una fecha específica.
    Útil para el 'Candado' de validación.
    """
    # Buscar la fila correspondiente a la fecha
    fila = df_oracle[df_oracle['Fecha'] == fecha_objetivo]
    
    if fila.empty:
        # Fallback si fecha fuera de rango
        return {}
    
    registro = fila.iloc[0]
    
    # Costos Componentes
    int_dev = registro['raw_int_devengado']
    int_mora = registro['raw_int_mora']
    comisiones = registro['raw_comision_est'] + registro['raw_comision_afi']
    
    # IGV
    igv_total = registro['raw_igv_total']
    
    # Costo Total Financiero
    total_costo = int_dev + int_mora + comisiones + igv_total
    
    return {
        'interes_devengado': int_dev,
        'interes_moratorio': int_mora,
        'comisiones': comisiones,
        'igv_total': igv_total,
        'total_costo_financiero': total_costo
    }
