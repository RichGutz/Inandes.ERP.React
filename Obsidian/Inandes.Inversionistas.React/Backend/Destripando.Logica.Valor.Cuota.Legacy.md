# 🩸 Destripando la Lógica del Cálculo de Valor Cuota (NAV) de LEGACY

> **Ubicación:** `C:\Users\rguti\Inandes.ERP.React\Obsidian\Inandes.Inversionistas.React\Backend\Destripando.Logica.Valor.Cuota.Legacy.md`  
> **Relacionado con:** [00.A — Módulo de Inversionistas](file:///C:/Users/rguti/Inandes.ERP.React/Obsidian/Inandes.Inversionistas.React/00.A.INVERSIONISTAS.md) | `generate_cuotas_v25.py` | `MOTOR_A_y_B_Calculo_NAV_y_PYL.py`  
> **Fecha:** 11 de Agosto de 2026

---

## 🎯 1. Introducción y Propósito

El cálculo del **Valor Cuota (NAV - Net Asset Value)** determina la variación diaria del valor de las participaciones en los Fondos de Inversión de **InAndes Activos Alternativos S.A.C.**. 

Esta nota documenta la matemática exacta, las bases de cómputo de días y el orden de devengue contable utilizado por el sistema **LEGACY (Python)** para garantizar que la recreación en **React / TypeScript** sea **100% idéntica** en decimales y precisión.

---

## 🧮 2. Formulación Matemática Diario por Día

Para cada día contable $d$ dentro de la ventana de simulación seleccionada:

### 2.1. Rendimiento Bruto del Patrimonio (Base 360)
El fondo devenga intereses activos sobre todo el capital bajo administración utilizando una convención **Base 360**:
$$\text{Ingreso Bruto Diario}_d = \text{Patrimonio}_{d-1} \times \left( \frac{\text{Tasa Activa}}{360} \right)$$

### 2.2. Gastos y Comisiones Operativas del Fondo (Base 365)
Los gastos operativos descontados al fondo se calculan con convención **Base 365**:
$$\text{Gasto Administración}_d = \text{Patrimonio}_{d-1} \times \left( \frac{\text{Comisión Administración}}{365} \right)$$
$$\text{Gasto Captación}_d = \text{Patrimonio}_{d-1} \times \left( \frac{\text{Comisión Captación}}{365} \right)$$
$$\text{Gasto Misceláneos}_d = \text{Patrimonio}_{d-1} \times \left( \frac{\text{Comisión Misceláneos}}{365} \right)$$

### 2.3. Utilidad Neta Diaria (Ganancia Operativa)
$$\text{Utilidad Neta}_d = \text{Ingreso Bruto}_d - (\text{Gasto Admin}_d + \text{Gasto Captación}_d + \text{Gasto Misceláneos}_d)$$

### 2.4. Determinación del Valor Cuota del Día ($\text{VC}_d$)
El precio de la cuota se fija **antes** de procesar las nuevas suscripciones/aumentos del mismo día:
$$\text{Patrimonio Pre-Suscripción}_d = \text{Patrimonio}_{d-1} + \text{Utilidad Neta}_d$$
$$\text{VC}_d = \frac{\text{Patrimonio Pre-Suscripción}_d}{\text{Cuotas Totales}_{d-1}} \quad \text{si } \text{Cuotas}_{d-1} > 0 \quad (\text{si no, } \text{VC}_d = 1.0000)$$

### 2.5. Procesamiento de Suscripciones (Aumentos de Capital)
Si en la fecha $d$ se registra un aporte de capital ($\Delta \text{Capital}_d$):
$$\Delta \text{Cuotas}_d = \frac{\Delta \text{Capital}_d}{\text{VC}_d}$$
$$\text{Patrimonio Cierre}_d = \text{Patrimonio Pre-Suscripción}_d + \Delta \text{Capital}_d$$
$$\text{Cuotas Cierre}_d = \text{Cuotas Totales}_{d-1} + \Delta \text{Cuotas}_d$$

---

## 📊 3. Estructura de Filas del Reporte Transpuesto (Diario / Mensual)

El reporte de Valor Cuota organiza los datos en bloques mensuales mostrando día a día las siguientes filas:

1. **Certificados Emitidos (`CERT`):** Devengue diario de cada contrato/certificado individual `NSGPEN...`
2. **└─ Aumentos de Capital (`AUMENTO`):** Devengue de adiciones de capital por certificado.
3. **TOTAL CAPITAL:** Capital total invertido en el fondo.
4. **INVERSIONES ORIGINALES:** Suscripciones del día.
5. **INV. ORIGINALES ACUMULADAS:** Suma acumulada de aportes.
6. **VAL CUOTA INICIAL:** Precio de la cuota al inicio del día ($\text{VC}_{d-1}$).
7. **GANANCIA TOTAL BRUTA:** Rentabilidad bruta del día.
8. **GANANCIA TOTAL ACUMULADA:** Utilidad acumulada periodo.
9. **PATRIMONIO TOTAL:** Patrimonio pre-gastos.
10. **COM. ADMIN (-):** Descuento administración diario.
11. **COM. CAPT. (-):** Descuento captación diario.
12. **COM. MISC. (-):** Descuento misceláneos diario.
13. **GANANCIA OPERATIVA:** Utilidad neta diaria.
14. **GANANCIA OPERATIVA ACUMULADA:** Utilidad neta acumulada.
15. **PATRIMONIO TOTAL CIERRE:** Patrimonio neto al cierre del día.
16. **CUOTA TOTAL CIERRE:** Número de cuotas emitidas.
17. **VAL CUOTA FINAL:** Precio final de la cuota ($\text{VC}_d$).

---

## 🔍 4. Diagnóstico de Brechas Encontradas en React

1. **Inclusión de `p_cap` y `p_misc`:** En la versión previa de `fondosService.ts`, el motor solo restaba la comisión de administración, omitiendo captación y misceláneos.
2. **Precisiones Decimales:** La celda de Valor Cuota se formatea a **4 decimales** (ej. `1.0084`), mientras que los montos dinerarios se muestran a 2 decimales (`S/ 1,234.56`).

---

## 🛠️ 5. Acción Ejecutativa
Actualizar `src/services/fondosService.ts` en React para incluir el 100% del cálculo de deducciones `pAdmin + pCap + pMisc` en Base 365.
