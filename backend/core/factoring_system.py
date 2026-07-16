# factoring_sistema_completo_back_door.py
import datetime
import math
import pandas as pd
import json
from typing import Dict, List, Any, Optional

class SistemaFactoringCompleto:
    """
    SISTEMA INTEGRADO DE FACTORING - VERSIÓN COMPLETA CON BACK DOOR
    Incluye corrección crítica + lógica de liquidación forzada por montos mínimos
    """
    
    def __init__(self):
        # Parámetros financieros fijos
        self.igv_pct = 0.18
        self.dias_ano_comercial = 360
        
        # Configuración BACK DOOR (personalizable)
        self.configuracion_back_door = {
            'monto_minimo_liquidacion': 100.0,
            'costo_transaccional_promedio': 25.0,
            'aplicar_back_door': True,
            'niveles_configuracion': [50.0, 100.0, 150.0, 200.0]
        }
        
        # Log de auditoría
        self.log_auditoria = []
    
    # =========================================================================
    # MÓDULO DE ORIGINACIÓN
    # =========================================================================
    
    def originar_operacion(self, datos_factura: Dict) -> Dict:
        """Originación individual de una factura"""
        resultado_lote = self.procesar_lote_originacion([datos_factura])
        if resultado_lote and resultado_lote.get("resultados_por_factura"):
            return resultado_lote["resultados_por_factura"][0]
        return {}
    
    def procesar_lote_originacion(self, lote_facturas: List[Dict]) -> Dict:
        """Procesamiento de lote con decisión agregada de comisión"""
        if not lote_facturas:
            return {"error": "El lote de facturas está vacío"}
        
        # Validar que todas las facturas tengan los campos requeridos
        campos_requeridos = ['monto_factura_neto', 'tasa_avance', 'tasa_interes_mensual', 'plazo_dias']
        for factura in lote_facturas:
            for campo in campos_requeridos:
                if campo not in factura:
                    return {"error": f"Campo requerido faltante: {campo}"}
        
        # DECISIÓN AGREGADA DE COMISIÓN (a nivel lote)
        capital_total = 0.0
        comision_fija_total = 0.0
        
        for factura in lote_facturas:
            capital_factura = factura.get('monto_factura_neto', 0) * factura.get('tasa_avance', 0)
            capital_total += capital_factura
            comision_fija_total += factura.get('comision_minima', 0)
        
        comision_pct_total = capital_total * lote_facturas[0].get('comision_porcentual', 0)
        
        # Elegir método que genere MAYOR comisión
        if comision_pct_total > comision_fija_total:
            metodo_comision = "PORCENTAJE"
        else:
            metodo_comision = "FIJO"
        
        # PROCESAMIENTO INDIVIDUAL DE FACTURAS
        resultados_originacion = []
        
        for i, factura in enumerate(lote_facturas):
            try:
                capital_operacion = factura.get('monto_factura_neto', 0) * factura.get('tasa_avance', 0)
                
                # Aplicar método de comisión decidido
                if metodo_comision == "PORCENTAJE":
                    comision = capital_operacion * factura.get('comision_porcentual', 0)
                else:
                    comision = factura.get('comision_minima', 0)
                
                # Cálculo detallado
                resultado = self._calcular_desglose_originacion(capital_operacion, comision, factura)
                resultado['id_operacion'] = f"OP-{datetime.datetime.now().strftime('%Y%m%d')}-{i:03d}"
                resultado['metodo_comision'] = metodo_comision
                
                resultados_originacion.append(resultado)
                
            except Exception as e:
                print(f"Error procesando factura {i}: {e}")
                continue
        
        return {
            "metodo_comision_elegido": metodo_comision,
            "resultados_por_factura": resultados_originacion,
            "total_operaciones": len(resultados_originacion),
            "capital_total_lote": round(capital_total, 2)
        }
    
    def _calcular_desglose_originacion(self, capital: float, comision: float, datos: Dict) -> Dict:
        """Cálculo detallado de una operación de originación"""
        tasa_diaria = datos["tasa_interes_mensual"] / 30
        plazo_dias = datos["plazo_dias"]
        
        # Cálculo de intereses compensatorios (fórmula Excel exacta)
        factor_interes = math.pow(1 + tasa_diaria, plazo_dias)
        interes_compensatorio = capital * (factor_interes - 1)
        
        # Cálculo de IGV
        igv_interes = interes_compensatorio * self.igv_pct
        igv_comision = comision * self.igv_pct
        
        # Cálculo de desembolso
        abono_teorico = capital - interes_compensatorio - igv_interes - comision - igv_comision
        
        # Comisión de afiliación (opcional)
        comision_afiliacion = 0.0
        igv_afiliacion = 0.0
        if datos.get("aplica_comision_afiliacion", False):
            comision_afiliacion = datos.get("comision_afiliacion", 0)
            igv_afiliacion = comision_afiliacion * self.igv_pct
            abono_teorico -= (comision_afiliacion + igv_afiliacion)
        
        # Fechas
        fecha_desembolso = datetime.datetime.now().date()
        fecha_vencimiento = fecha_desembolso + datetime.timedelta(days=plazo_dias)
        
        return {
            # Datos financieros
            "capital_operacion": round(capital, 2),
            "interes_compensatorio": round(interes_compensatorio, 2),
            "igv_interes": round(igv_interes, 2),
            "comision_estructuracion": round(comision, 2),
            "igv_comision": round(igv_comision, 2),
            "comision_afiliacion": round(comision_afiliacion, 2),
            "igv_afiliacion": round(igv_afiliacion, 2),
            "monto_desembolsado": math.floor(abono_teorico),
            
            # Datos temporales
            "plazo_dias": plazo_dias,
            "fecha_desembolso": fecha_desembolso,
            "fecha_vencimiento": fecha_vencimiento,
            "tasa_interes_mensual": datos["tasa_interes_mensual"],
            
            # Metadatos
            "fecha_originacion": datetime.datetime.now(),
            "estado": "ORIGINADA"
        }
    
    # =========================================================================
    # MÓDULO DE LIQUIDACIÓN CON BACK DOOR
    # =========================================================================
    
    def liquidar_operacion(self, operacion: Dict, fecha_pago: datetime.datetime, 
                          monto_pagado: float, monto_minimo: Optional[float] = None,
                          dias_minimos_interes: int = 15) -> Dict:
        """
        Liquidación normal (sin BACK DOOR) - Para uso interno
        """
        return self._liquidar_operacion_normal(operacion, fecha_pago, monto_pagado, dias_minimos_interes)
    
    def liquidar_operacion_con_back_door(self, operacion: Dict, fecha_pago: datetime.datetime, 
                                        monto_pagado: float, monto_minimo: Optional[float] = None,
                                        dias_minimos_interes: int = 15) -> Dict:
        """
        Liquidación con BACK DOOR para montos mínimos
        """
        # 1. Liquidación normal
        liquidacion = self._liquidar_operacion_normal(operacion, fecha_pago, monto_pagado, dias_minimos_interes)
        
        # 2. Aplicar BACK DOOR si está activado y corresponde
        if self.configuracion_back_door['aplicar_back_door']:
            monto_minimo_uso = monto_minimo or self.configuracion_back_door['monto_minimo_liquidacion']
            liquidacion = self._aplicar_back_door(liquidacion, monto_minimo_uso)
        
        return liquidacion
    
    def _liquidar_operacion_normal(self, operacion: Dict, fecha_pago: datetime.datetime, 
                                  monto_pagado: float, dias_minimos_interes: int = 15) -> Dict:
        """Liquidación normal sin BACK DOOR"""
        # Validaciones iniciales
        if not operacion or not fecha_pago:
            return {"error": "Datos de liquidación incompletos"}
        
        if 'capital_operacion' not in operacion:
            return {"error": "Operación sin capital_operacion"}
        
        # Cálculo de días transcurridos
        if isinstance(fecha_pago, datetime.datetime):
            fecha_pago_date = fecha_pago.date()
        else:
            fecha_pago_date = fecha_pago
            
        dias_transcurridos = (fecha_pago_date - operacion["fecha_desembolso"]).days
        
        if dias_transcurridos < 0:
            return {"error": "Fecha de pago anterior al desembolso"}
        
        # Aplicar regla de días mínimos para intereses
        dias_para_interes = max(dias_transcurridos, dias_minimos_interes)
        
        # Intereses compensatorios devengados
        interes_devengado = self._calcular_intereses_compensatorios(
            operacion["capital_operacion"], 
            operacion["tasa_interes_mensual"], 
            dias_para_interes
        )
        igv_interes_devengado = interes_devengado * self.igv_pct
        
        # Intereses moratorios (si hay mora)
        interes_moratorio = 0.0
        igv_moratorio = 0.0
        dias_mora = 0
        
        if fecha_pago_date > operacion["fecha_vencimiento"]:
            dias_mora = (fecha_pago_date - operacion["fecha_vencimiento"]).days
            interes_moratorio = self._calcular_intereses_moratorios(
                operacion["capital_operacion"],
                dias_mora,
                operacion.get("tasa_moratoria", 0.04) # Default fallback 4%
            )
            igv_moratorio = interes_moratorio * self.igv_pct
        
        # ✅ CORRECCIÓN CRÍTICA: Delta Capital = Capital Operación - Pago
        delta_intereses = interes_devengado - operacion["interes_compensatorio"]
        delta_igv_intereses = igv_interes_devengado - operacion["igv_interes"]
        delta_capital = operacion["capital_operacion"] - monto_pagado  # ← CORREGIDO
        
        # ✅ COMPENSACIÓN AUTOMÁTICA DE SALDO A FAVOR
        # Consultar saldo a favor acumulado de eventos anteriores
        from data.supabase_repository import get_saldo_favor_acumulado
        saldo_favor_previo = get_saldo_favor_acumulado(operacion.get("id_operacion", ""))
        
        # Calcular saldo a favor generado en ESTE pago (solo si delta_intereses es negativo)
        saldo_favor_generado = max(0.0, -delta_intereses)
        
        # Aplicar compensación si hay nuevos intereses devengados Y hay saldo a favor disponible
        saldo_favor_aplicado = 0.0
        interes_neto_a_cobrar = interes_devengado
        
        if interes_devengado > 0 and saldo_favor_previo > 0:
            # Compensar hasta donde alcance el saldo
            compensacion = min(interes_devengado, saldo_favor_previo)
            interes_neto_a_cobrar = interes_devengado - compensacion
            saldo_favor_aplicado = compensacion
        
        # Calcular saldo a favor restante para futuros pagos
        saldo_favor_restante = saldo_favor_previo + saldo_favor_generado - saldo_favor_aplicado
        
        # Recalcular IGV sobre interés neto (después de compensación)
        igv_interes_neto = interes_neto_a_cobrar * self.igv_pct
        
        # Recalcular delta_igv considerando compensación
        delta_igv_compensado = igv_interes_neto - operacion["igv_interes"]
        
        # Saldo global (suma de todos los componentes CON compensación)
        # CORRECCIÓN: Usar deltas en lugar de intereses completos
        saldo_global = (delta_intereses + delta_igv_compensado + 
                       interes_moratorio + igv_moratorio + delta_capital)
        
        # Clasificación del caso
        estado, accion = self._clasificar_caso_liquidacion(delta_intereses, delta_capital, saldo_global)
        
        return {
            # Datos básicos
            "fecha_liquidacion": fecha_pago_date,
            "dias_transcurridos": dias_transcurridos,
            "dias_para_calculo_interes": dias_para_interes,
            "dias_minimos_aplicados": dias_minimos_interes,
            "dias_mora": dias_mora,
            
            # Intereses devengados
            "interes_devengado": round(interes_devengado, 6),
            "igv_interes_devengado": round(igv_interes_devengado, 6),
            "interes_moratorio": round(interes_moratorio, 6),
            "igv_moratorio": round(igv_moratorio, 6),
            
            # Valores originales de la operación
            "interes_original": operacion.get("interes_compensatorio", 0),
            "igv_original": operacion.get("igv_interes", 0),
            
            # Deltas vs valores originales
            "delta_intereses": round(delta_intereses, 6),
            "delta_igv_intereses": round(delta_igv_intereses, 6),
            "delta_capital": round(delta_capital, 6),
            
            # Resultados finales
            "saldo_global": round(saldo_global, 6),
            "estado_operacion": estado,
            "accion_recomendada": accion,
            
            # Datos de referencia
            "monto_pagado": monto_pagado,
            "capital_operacion": operacion["capital_operacion"],
            "monto_desembolsado": operacion["monto_desembolsado"],
            "id_operacion": operacion.get("id_operacion", "N/A"),
            
            # Flags de control BACK DOOR
            "back_door_aplicado": False,
            "monto_minimo_configurado": 0,
            "reducciones_aplicadas": [],
            "saldo_original": round(saldo_global, 6),
            
            # ✅ NUEVOS: Campos de saldo a favor (compensación automática)
            "saldo_favor_previo": round(saldo_favor_previo, 6),
            "saldo_favor_generado": round(saldo_favor_generado, 6),
            "saldo_favor_aplicado": round(saldo_favor_aplicado, 6),
            "saldo_favor_restante": round(saldo_favor_restante, 6),
            "interes_neto_cobrado": round(interes_neto_a_cobrar, 6),
            "igv_interes_neto": round(igv_interes_neto, 6)
        }
    
    def _calcular_intereses_compensatorios(self, capital: float, tasa_mensual: float, dias: int) -> float:
        """Réplica EXACTA de fórmula Excel: (POWER((1+tasa/30), días)-1)*capital"""
        if dias <= 0:
            return 0.0
        tasa_diaria = tasa_mensual / 30
        factor = math.pow(1 + tasa_diaria, dias)
        return (factor - 1) * capital
    
    def _calcular_intereses_moratorios(self, capital: float, dias_mora: int, 
                                      tasa_moratoria_mensual: float = 0.04) -> float:
        """Cálculo de intereses moratorios con tasa dinámica"""
        if dias_mora <= 0:
            return 0.0
        return self._calcular_intereses_compensatorios(capital, tasa_moratoria_mensual, dias_mora)
    
    # =========================================================================
    # MÓDULO BACK DOOR - LIQUIDACIÓN FORZADA
    # =========================================================================
    
    def _aplicar_back_door(self, liquidacion: Dict, monto_minimo: float) -> Dict:
        """
        Aplicar BACK DOOR: reducción secuencial para montos mínimos
        """
        saldo_global = liquidacion.get('saldo_global', 0)
        
        # Verificar si aplica BACK DOOR
        if saldo_global <= 0 or saldo_global > monto_minimo:
            return liquidacion  # No aplica BACK DOOR
        
        # Verificar lógica de negocio: ¿Vale la pena perseguir?
        if not self._vale_la_pena_perseguir(saldo_global):
            return self._ejecutar_reduccion_secuencial(liquidacion, saldo_global, monto_minimo)
        
        return liquidacion
    
    def _vale_la_pena_perseguir(self, monto_saldo: float) -> bool:
        """
        Lógica de negocio: ¿El costo transaccional justifica perseguir el pago?
        """
        costo_transaccional = self.configuracion_back_door['costo_transaccional_promedio']
        return monto_saldo > costo_transaccional
    
    def _ejecutar_reduccion_secuencial(self, liquidacion: Dict, saldo_original: float, 
                                      monto_minimo: float) -> Dict:
        """
        Secuencia de reducción BACK DOOR: Moratorios → Compensatorios → Capital
        """
        # Guardar valores originales ANTES del backdoor
        liquidacion['delta_capital_original'] = liquidacion.get('delta_capital', 0)
        liquidacion['delta_intereses_original'] = liquidacion.get('delta_intereses', 0)
        liquidacion['delta_igv_intereses_original'] = liquidacion.get('delta_igv_intereses', 0)
        liquidacion['interes_moratorio_original'] = liquidacion.get('interes_moratorio', 0)
        liquidacion['igv_moratorio_original'] = liquidacion.get('igv_moratorio', 0)
        
        reducciones_aplicadas = []
        saldo_restante = saldo_original
        
        # 1. REDUCIR MORATORIOS (Primera prioridad)
        if liquidacion.get('interes_moratorio', 0) > 0:
            reduccion_moratorios = min(saldo_restante, liquidacion['interes_moratorio'])
            valor_antes = liquidacion['interes_moratorio']
            
            if reduccion_moratorios > 0:
                liquidacion['interes_moratorio'] -= reduccion_moratorios
                liquidacion['igv_moratorio'] = liquidacion['interes_moratorio'] * self.igv_pct
                saldo_restante -= reduccion_moratorios
                reducciones_aplicadas.append({
                    'concepto': 'Interés Moratorio',
                    'valor_antes': round(valor_antes, 2),
                    'valor_despues': round(liquidacion['interes_moratorio'], 2),
                    'reduccion': round(reduccion_moratorios, 2),
                    'saldo_resultante': round(saldo_restante, 2)
                })
        
        # 2. REDUCIR COMPENSATORIOS (Segunda prioridad)
        if saldo_restante > 0 and liquidacion.get('delta_intereses', 0) > 0:
            reduccion_compensatorios = min(saldo_restante, liquidacion['delta_intereses'])
            valor_antes = liquidacion['delta_intereses']
            
            if reduccion_compensatorios > 0:
                liquidacion['delta_intereses'] -= reduccion_compensatorios
                liquidacion['delta_igv_intereses'] = liquidacion['delta_intereses'] * self.igv_pct
                saldo_restante -= reduccion_compensatorios
                reducciones_aplicadas.append({
                    'concepto': 'Delta Intereses Compensatorios',
                    'valor_antes': round(valor_antes, 2),
                    'valor_despues': round(liquidacion['delta_intereses'], 2),
                    'reduccion': round(reduccion_compensatorios, 2),
                    'saldo_resultante': round(saldo_restante, 2)
                })
        
        # 3. REDUCIR CAPITAL (Último recurso)
        if saldo_restante > 0 and liquidacion.get('delta_capital', 0) > 0:
            reduccion_capital = min(saldo_restante, liquidacion['delta_capital'])
            valor_antes = liquidacion['delta_capital']
            
            if reduccion_capital > 0:
                liquidacion['delta_capital'] -= reduccion_capital
                saldo_restante -= reduccion_capital
                reducciones_aplicadas.append({
                    'concepto': 'Delta Capital',
                    'valor_antes': round(valor_antes, 2),
                    'valor_despues': round(liquidacion['delta_capital'], 2),
                    'reduccion': round(reduccion_capital, 2),
                    'saldo_resultante': round(saldo_restante, 2)
                })
        
        # Actualizar saldo global
        liquidacion['saldo_global'] = saldo_restante
        
        # Marcar como BACK DOOR y forzar liquidación
        liquidacion['estado_operacion'] = "LIQUIDADO - BACK DOOR"
        liquidacion['accion_recomendada'] = f"Liquidación forzada por monto mínimo (${monto_minimo}). "
        liquidacion['accion_recomendada'] += f"Reducciones aplicadas: {reducciones_aplicadas}"
        liquidacion['back_door_aplicado'] = True
        liquidacion['monto_minimo_configurado'] = monto_minimo
        liquidacion['reducciones_aplicadas'] = reducciones_aplicadas
        liquidacion['saldo_original'] = saldo_original
        
        # Registro de auditoría
        self._registrar_back_door(liquidacion)
        
        return liquidacion
    
    def _registrar_back_door(self, liquidacion: Dict):
        """Registro de auditoría para BACK DOOR"""
        registro = {
            'timestamp': datetime.datetime.now().isoformat(),
            'operacion_id': liquidacion.get('id_operacion', 'N/A'),
            'saldo_original': liquidacion.get('saldo_original', 0),
            'saldo_final': liquidacion.get('saldo_global', 0),
            'monto_minimo': liquidacion.get('monto_minimo_configurado', 0),
            'reducciones': liquidacion.get('reducciones_aplicadas', []),
            'costo_transaccional': self.configuracion_back_door['costo_transaccional_promedio'],
            'usuario': 'sistema_automatico',
            'decision': 'BACK_DOOR_APLICADO'
        }
        
        self.log_auditoria.append(registro)
        print(f"📋 BACK DOOR REGISTRADO: {json.dumps(registro, indent=2, default=str)}")
    
    # =========================================================================
    # CLASIFICACIÓN Y UTILIDADES
    # =========================================================================
    
    def _clasificar_caso_liquidacion(self, delta_intereses: float, delta_capital: float, 
                                    saldo_global: float) -> tuple:
        """Clasificación en los 6 casos según matriz de decisión"""
        if delta_intereses < 0 and delta_capital < 0 and saldo_global < 0:
            return "LIQUIDADO - Caso 1", "Generar notas de crédito, devolver dinero al cliente"
        elif delta_intereses > 0 and delta_capital < 0 and saldo_global < 0:
            return "LIQUIDADO - Caso 2", "Facturar intereses (monto pequeño), devolver exceso de capital (monto mayor)"
        elif delta_intereses < 0 and delta_capital > 0 and saldo_global < 0:
            return "LIQUIDADO - Caso 3", "Generar NC (monto mayor), devolver saldo negativo (monto menor)"
        
        elif delta_intereses < 0 and delta_capital > 0 and saldo_global > 0:
            return "EN PROCESO - Caso 4", "Diferir NC. Ajustar saldo, crear nuevo calendario."
        elif delta_intereses > 0 and delta_capital > 0 and saldo_global > 0:
            return "EN PROCESO - Caso 5", "Diferir Factura Interés. Ajustar saldo, nuevo calendario."
        elif delta_intereses > 0 and delta_capital < 0 and saldo_global > 0:
            return "EN PROCESO - Caso 6", "Diferir Factura. Ajustar saldo/moratorios."
        else:
            return "NO CLASIFICADO", "Revisión manual requerida"
    
    def configurar_back_door(self, monto_minimo: Optional[float] = None, 
                           aplicar: Optional[bool] = None, 
                           costo_transaccional: Optional[float] = None) -> Dict:
        """Configurar parámetros del BACK DOOR"""
        if monto_minimo is not None:
            self.configuracion_back_door['monto_minimo_liquidacion'] = monto_minimo
        if aplicar is not None:
            self.configuracion_back_door['aplicar_back_door'] = aplicar
        if costo_transaccional is not None:
            self.configuracion_back_door['costo_transaccional_promedio'] = costo_transaccional
        
        print(f"⚙️ Configuración BACK DOOR actualizada: {self.configuracion_back_door}")
        return self.configuracion_back_door.copy()
    
    def obtener_metricas_back_door(self) -> Dict:
        """Obtener métricas del BACK DOOR"""
        back_door_aplicados = [log for log in self.log_auditoria if log.get('decision') == 'BACK_DOOR_APLICADO']
        
        if back_door_aplicados:
            montos = [log['saldo_original'] for log in back_door_aplicados]
            monto_promedio = sum(montos) / len(montos)
            ahorro_transaccional = len(back_door_aplicados) * self.configuracion_back_door['costo_transaccional_promedio']
        else:
            monto_promedio = 0
            ahorro_transaccional = 0
        
        return {
            'total_back_door_aplicados': len(back_door_aplicados),
            'monto_promedio_back_door': round(monto_promedio, 2),
            'ahorro_transaccional': round(ahorro_transaccional, 2),
            'configuracion_actual': self.configuracion_back_door.copy()
        }
    
    # =========================================================================
    # VALIDACIÓN Y REPORTES
    # =========================================================================
    
    def validar_con_excel_corregido(self) -> Dict:
        """Validación específica contra el Excel corregido"""
        capital_excel = 17822.00536953091
        tasa_excel = 0.02
        intereses_cobrados_excel = 1202.835048660585
        
        # Liquidación 1: 62 días
        dias_liq1 = 62
        interes_calculado = self._calcular_intereses_compensatorios(capital_excel, tasa_excel, dias_liq1)
        
        return {
            'validacion': {
                'capital_excel': capital_excel,
                'intereses_cobrados_excel': intereses_cobrados_excel,
                'coincide_calculo_intereses': abs(interes_calculado - intereses_cobrados_excel) < 1e-10
            },
            'liquidacion_1': {
                'dias': dias_liq1,
                'interes_calculado': interes_calculado,
                'interes_excel': intereses_cobrados_excel,
                'diferencia': abs(interes_calculado - intereses_cobrados_excel),
                'coincide_exacto': abs(interes_calculado - intereses_cobrados_excel) < 1e-10
            },
            'correccion_aplicada': True,
            'back_door_implementado': True
        }
    
    def generar_reporte_liquidaciones(self, operaciones_liquidadas: List[Dict]) -> pd.DataFrame:
        """Generar reporte consolidado de liquidaciones"""
        if not operaciones_liquidadas:
            return pd.DataFrame()
        
        # Crear DataFrame
        df = pd.DataFrame(operaciones_liquidadas)
        
        # Formatear columnas monetarias
        columnas_monetarias = ['interes_devengado', 'igv_interes_devengado', 'interes_moratorio', 
                             'igv_moratorio', 'delta_intereses', 'delta_igv_intereses', 
                             'delta_capital', 'saldo_global', 'monto_pagado']
        
        for col in columnas_monetarias:
            if col in df.columns:
                df[col] = df[col].round(2)
        
        return df
