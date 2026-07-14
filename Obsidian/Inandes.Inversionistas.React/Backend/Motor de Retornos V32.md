# 💸 Motor de Retornos y Rendimientos (V32)

El **Motor de Retornos** es el encargado de realizar el cálculo bimestral o trimestral de los intereses devengados por los inversionistas, deduciendo impuestos (IR) y deducciones ordinarias, y calculando los capitales finales de reinversión.

---

## 🛠️ Especificaciones Técnicas
*   **Script Maestro**: `FLOW_CHARTS/scripts_CRM/C01_Motores_Calculo_NAV_y_PYL/CALCULO_Retornos_Intereses_V32.py`
*   **Script de Asientos (Fase 2)**: `registrar_asientos_v32.py` (Script de extensión / Wrapper)
*   **Base de Tiempo**: Diaria, con base de 365 días (`BASE_DIAS = 365.0`).
*   **Rango de Fecha del Periodo**: Por defecto, calcula ventanas fijas bimestrales (ej. del `01/01/2026` al `28/02/2026`).

---

## 🧮 Ecuaciones Financieras (Redondeo a 2 Decimales)

En cada hito de cierre, el motor realiza las siguientes operaciones secuenciales, redondeando el resultado a centavos (`round(valor, 2)`):

### 1. Interés Bruto Diario
Para cada día $d$ del período de cálculo, si el día es mayor o igual a la fecha de emisión del certificado, se devenga el interés diario:
$$\text{Int\_Día} = \text{Base\_Hoy} \times \frac{\text{Tasa\_Hoy}}{365.0}$$

Donde:
*   **`Base_Hoy`**: Es el capital vigente ese día.
*   **`Tasa_Hoy`**: Es la tasa aplicable al certificado.

### 2. Aumentos de Capital
Los aumentos de capital inyectados durante el período se tratan como "hijos" del certificado padre. Cada uno calcula su propio interés diario desde su fecha de depósito hasta el fin del período usando la misma tasa del día. El interés total bruto es la sumatoria de ambos:
$$\text{INT. BRUTO} = \text{Int\_Padre\_Acum} + \sum \text{Int\_Aumento\_Acum}$$

### 3. Distribución del Rendimiento
*   **Impuesto a la Renta (IR - 5%)**:
    $$\text{IR (5\%)} = \text{round}(\text{INT. BRUTO} \times 0.05, 2)$$
*   **Base Neta**:
    $$\text{BASE NETA} = \text{round}(\text{INT. BRUTO} - \text{IR}, 2)$$
*   **Capitalización (Reinversión)**: Determinado por el porcentaje de reparto pactado en el contrato (`porcentaje_reparto` de 0.0 a 1.0):
    $$\text{CAPITALIZACIÓN} = \text{round}(\text{BASE NETA} \times (1 - \text{porcentaje\_reparto}), 2)$$
*   **Reparto (Interés a pagar)**:
    $$\text{REPARTO} = \text{round}(\text{BASE NETA} \times \text{porcentaje\_reparto}, 2)$$

### 4. Neto Final y Conciliación del Capital
*   **Neto Final (Pago al Cliente)**:
    $$\text{NETO FINAL} = \text{round}(\text{REPARTO} - \text{DEDUCCIONES\_ORDINARIAS}, 2)$$
*   **Capital Final (Saldo inicial del próximo mes)**:
    $$\text{CAPITAL FINAL} = \text{round}(\text{Capital\_Base} + \text{Capital\_Aumentos} + \text{CAPITALIZACIÓN} - \text{RESCATES} - \text{PENALIDAD\_RESCATE}, 2)$$

---

## 🔁 Lógica de Rescates y Switch Tasa Waiver
Si un partícipe realiza un retiro anticipado de capital, este se agenda en la tabla `crm_cronograma_deducciones_rescates`. Durante el cálculo diario:
1.  **Días Previos al Rescate**: Se aplica la **Tasa Pactada** sobre el capital original.
2.  **Días Posteriores al Rescate**: Se aplica la **Tasa de Penalidad / Waiver** (ej. 2%) sobre el capital remanente.
3.  **Días con Rescate Activo en el Futuro**: Si hay un rescate programado en el horizonte del período, el capital base diario del cálculo se mantiene en el capital total original (sin descontar el retiro) hasta que la fecha del rescate ocurra formalmente.

---

## 📑 Salidas del Motor
*   **Excel de Auditoría**: Genera un libro Excel con una hoja por fondo, columnas diarias y totales. Congela paneles en `D2` y formatea números en millares con 2 decimales (`#,##0.00`).
*   **PDF de Estado de Cuenta**: Genera el reporte consolidado bimestral/trimestral condensado (A3 Landscape) a través de WeasyPrint.
