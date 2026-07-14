# 🏗️ Motor de Valor Cuota (V25)

El **Motor de Valor Cuota** gestiona el patrimonio total del fondo de inversión y calcula el valor liquidativo diario de las participaciones (Valor Cuota), el cual varía según las ganancias acumuladas (tasa activa del fondo) y las deducciones operativas aplicadas.

---

## 🛠️ Especificaciones Técnicas
*   **Script Maestro**: `scripts_cuotas/generate_cuotas_v25.py`
*   **Script de Exportación**: `scripts_cuotas/export_valor_cuota_v25_to_excel.py`
*   **Ubicación en UI**: Pestaña **"Valor Cuota"** dentro del módulo de Gestión de Fondos.
*   **Base de Tiempo**: Cálculo diario con base 360 días para devengos activos y 365 días para cobro de comisiones del fondo.

---

## 🧮 Lógica de Simulación Diaria (Fondo de Participación)

Para cada día del período de cálculo, el motor evalúa el comportamiento financiero del fondo consolidado a partir de las siguientes variables y comisiones:

### 1. Variables del Fondo
*   `tasa_activa`: Tasa anual de retorno del fondo (ej. $12.0\%$).
*   `comision_administracion_fondo` ($p_{\text{admin}}$): Comisión anual cobrada por operar el fondo (ej. $1.0\%$).
*   `comision_captacion_fondo` ($p_{\text{cap}}$): Comisión por captación de capitales (ej. $2.0\%$).
*   `comision_miscelaneos_fondo` ($p_{\text{misc}}$): Comisión por gastos operativos varios (ej. $0.5\%$).

### 2. Ecuaciones de Flujo Diario
Para un día determinado, partiendo del `patrimonio_ayer` y las `cuotas_ayer` vigentes en el fondo:

*   **Ingreso Bruto Diario**: Generado por la tasa activa del fondo (Base 360):
    $$\text{Ingreso\_Bruto\_Día} = \text{Patrimonio\_Ayer} \times \frac{\text{Tasa\_Activa}}{360.0}$$
*   **Gastos Operativos Diarios (Comisiones del Fondo)**: Calculados sobre base anual de 365 días:
    $$\text{Gasto\_Admin} = \text{Patrimonio\_Ayer} \times \frac{p_{\text{admin}}}{365.0}$$
    $$\text{Gasto\_Captación} = \text{Patrimonio\_Ayer} \times \frac{p_{\text{cap}}}{365.0}$$
    $$\text{Gasto\_Misc} = \text{Patrimonio\_Ayer} \times \frac{p_{\text{misc}}}{365.0}$$
*   **Utilidad Neta Diaria (Ganancia Operativa)**:
    $$\text{Utilidad\_Neta\_Día} = \text{Ingreso\_Bruto\_Día} - (\text{Gasto\_Admin} + \text{Gasto\_Captación} + \text{Gasto\_Misc})$$
*   **Patrimonio Previo a Nuevos Aportes**:
    $$\text{Pat\_Pre} = \text{Patrimonio\_Ayer} + \text{Utilidad\_Neta\_Día}$$
*   **Valor Cuota del Día**: El precio de la cuota del día se actualiza según la utilidad devengada:
    $$\text{Valor\_Cuota\_Hoy} = \frac{\text{Pat\_Pre}}{\text{Cuotas\_Ayer}} \quad (\text{Si } \text{Cuotas\_Ayer} > 0, \text{ de lo contrario } 1.0)$$

### 3. Emisión de Nuevas Cuotas (Suscripciones)
Cuando un inversionista inyecta un nuevo capital (aumento de capital o nuevo certificado) en el día $d$:
1.  Se determina el capital inyectado (`aportes_dia`).
2.  Se emiten y asignan nuevas cuotas al certificado en base al valor cuota calculado ese día:
    $$\text{Nuevas\_Cuotas} = \frac{\text{Aportes\_Día}}{\text{Valor\_Cuota\_Hoy}}$$
3.  Se incrementa el patrimonio al cierre del día y el saldo de cuotas circulantes:
    $$\text{Patrimonio\_Total\_Cierre} = \text{Pat\_Pre} + \text{Aportes\_Día}$$
    $$\text{Cuotas\_Total\_Cierre} = \text{Cuotas\_Ayer} + \text{Nuevas\_Cuotas}$$

Al finalizar el día, se actualizan los valores históricos:
$$\text{Patrimonio\_Ayer} = \text{Patrimonio\_Total\_Cierre}$$
$$\text{Valor\_Cuota\_Ayer} = \text{Valor\_Cuota\_Hoy}$$

---

## 📊 Reportes Generados
*   **Estructura Transpuesta**: En el reporte de salida (PDF/Excel), los certificados y filas de totales consolidados de comisiones se muestran en las filas, mientras que los días del período (ej. `01/01` al `28/02`) se disponen en las columnas, permitiendo realizar auditorías de saldos día por día.
