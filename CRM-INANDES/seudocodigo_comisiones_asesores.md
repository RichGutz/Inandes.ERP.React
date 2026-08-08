# Pseudocódigo: Motor de Cálculo de Comisiones de Asesores v2 (Inandes)

Este documento detalla la lógica REFINADA para el submódulo de comisiones, centrada en hitos de pago (Fechas de Corte) y ventanas temporales de antigüedad.

## 1. Reglas de Negocio v2 (Refinadas)

### A. Detección y Disparador (Trigger)
1. **Detección**: El sistema debe identificar nuevos `crm_certificados` (hijos de `crm_contratos`, relación 1:1).
2. **Primer Pago**: Se identifica la **siguiente fecha de corte** del fondo (bimestral, trimestral, etc.) inmediata a la `fecha_emision` del certificado.
3. **Monto Base**: Las comisiones se calculan sobre el capital del certificado en el momento del pago.

### B. Esquemas de Pago
| Esquema | Tipo | Tasa | Lógica de Tiempo |
| :--- | :--- | :--- | :--- |
| **Antiguo** | **Captación** | 2.0% | Se paga en el 1er corte. Dura **1 año completo** desde ese 1er pago. |
| **Antiguo** | **Mantenimiento** | 1.5% | Inicia **después** del 1er año de captación. Se paga /6 o /4 según el fondo. |
| **Nuevo (2026)** | **Comisión Única**| 3.5% | Se paga en el 1er corte. **No tiene mantenimiento posterior.** |

---

## 2. Lógica del Algoritmo (Refinada)

```python
PARA CADA Certificado EMITIDO:
    1. Obtener contrato relacionado -> id_asesor, id_fondo, fecha_emision, capital.
    2. Obtener fechas de corte del fondo (Frecuencia: Bimestral=6/año, Trimestral=4/año).
    
    3. Identificar 'Fecha_Primer_Pago':
       Primer fecha de corte del fondo >= fecha_emision.
    
    4. Determinar Esquema (Fecha_Emision >= 2026-01-01 ? NUEVO : ANTIGUO):

    SI ESQUEMA == "NUEVO":
        SI Fecha_Corte_Actual == Fecha_Primer_Pago:
            Pagar COMISION_UNICA (3.5% sobre capital).
            Estado = Finalizado.
            
    SI ESQUEMA == "ANTIGUO":
        # Ventana de Captación: 12 meses desde el primer pago
        Fecha_Fin_Captacion = Fecha_Primer_Pago + 12 meses.
        
        SI Fecha_Corte_Actual == Fecha_Primer_Pago:
             Pagar CAPTACIÓN (2.0% sobre capital).
             
        SI Fecha_Corte_Actual > Fecha_Primer_Pago Y Fecha_Corte_Actual <= Fecha_Fin_Captacion:
             # Nota: Se define si hay pagos intermedios o es pago único al inicio.
             # Según audio: "Pagas captación en esa fecha... luego cuentas un año".
             Pagar CAPTACIÓN (Seguimiento).

        SI Fecha_Corte_Actual > Fecha_Fin_Captacion:
             # Fase de Mantenimiento
             divisor = (6 SI fondo=='Bimestral' SINO 4)
             tasa_armada = 0.015 / divisor
             Pagar MANTENIMIENTO (tasa_armada sobre capital).
```

## 3. Consideraciones Técnicas
- **Relación 1 a 1**: Certificado <-> Contrato.
- **Persistencia**: Necesitamos marcar qué comisiones ya fueron "Pagadas" en la base de datos para evitar duplicidad.
- **Reporte**: Generar resumen por Asesor con el detalle de qué hito (1er Pago, Captación mes X, Mantenimiento) se está liquidando.
