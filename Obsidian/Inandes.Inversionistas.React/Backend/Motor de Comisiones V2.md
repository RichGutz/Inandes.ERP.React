# 💰 Motor de Comisiones de Asesores (V2)

El **Motor de Comisiones** calcula y proyecta los pagos mensuales y bimestrales/trimestrales dirigidos a los asesores de ventas, en base al capital levantado de los inversionistas y el mantenimiento de la cartera.

---

## 🛠️ Especificaciones Técnicas
*   **Script Maestro**: `decommissioned_modules_scripts_reports/scripts/generate_comisiones_asesores_v2.py`
*   **Ubicación en UI**: Pestaña **"Cálculo de Comisiones"** en el módulo de Asesores.
*   **Frecuencia de Evaluación**: Depende de la frecuencia de pago de cupones configurada en el fondo (ej. bimestral = 2 meses, trimestral = 3 meses).

---

## 📊 Lógica de Proyección y Esquemas de Comisión

El motor clasifica el cálculo según la fecha de inicio del contrato, diferenciando las inversiones históricas de las nuevas incorporaciones del 2026:

### 1. Esquema Nuevo 2026 (Contratos posteriores a 01/01/2026)
Se utiliza para simplificar el flujo contable. Consiste en una **Comisión Única** de captación sin pagos de mantenimiento posteriores:
*   **Tasa aplicable**: Configurada en el campo `comision_asesor_unica` del fondo (valor base sugerido: $3.5\%$).
*   **Fecha de Pago**: Se paga en su totalidad en el primer corte contable del fondo posterior a la fecha de emisión del certificado.
*   **Ecuación**:
    $$\text{Comisión} = \text{Capital} \times \frac{t_{\text{única}}}{100}$$

### 2. Esquema Antiguo (Contratos emitidos antes del 2026)
Estructura de incentivos por fidelización dividida en dos fases:

*   **Fase A: Comisión de Captación (Año 1)**:
    *   **Tasa**: Configurada en `comision_asesor_primer_ano` del fondo (ej. $2.0\%$).
    *   **Fecha de Pago**: Se paga en el primer corte contable del fondo posterior a la emisión.
    *   **Ecuación**:
        $$\text{Comisión} = \text{Capital} \times \frac{t_{\text{captación}}}{100}$$
*   **Periodo de Gracia (Fase intermedia)**: 
    *   Dura exactamente **1 año** a partir de la fecha de cobro de la comisión de captación. Durante este período de gracia, el asesor **no recibe** comisiones de mantenimiento por esa inversión.
*   **Fase B: Comisión de Mantenimiento (Año 2 en adelante)**:
    *   Inicia inmediatamente después del año de gracia sobre la inversión base remanente (siempre y cuando el contrato no se liquide).
    *   **Tasa anual**: Configurada en `comision_asesor_mantenimiento` del fondo (ej. $1.5\%$).
    *   **Prorrateo por Corte**: El pago anual se prorratea y distribuye únicamente en los meses que coinciden con los cortes del fondo (ej. trimestral = 4 cortes al año):
        $$\text{Divisor} = \frac{12}{\text{Frecuencia\_Meses}}$$
        $$\text{Pago\_Mantenimiento} = \text{Capital} \times \frac{t_{\text{mantenimiento}} / 100}{\text{Divisor}}$$

---

## 📅 Generación de Fechas de Corte
El cálculo de comisiones evalúa de forma prospectiva el año objetivo (`target_year`):
1.  **Cortes Teóricos**: Se listan los meses de corte del año en base a la frecuencia (ej. para un fondo trimestral, los cortes ocurren en Marzo, Junio, Septiembre y Diciembre).
2.  **Lookup de Primer Pago**: La función `get_closest_cut_after` ubica el corte teórico más cercano que sea mayor o igual a la fecha de nacimiento de la inversión.
