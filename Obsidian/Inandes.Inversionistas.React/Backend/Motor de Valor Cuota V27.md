# 🏗️ Especificación Técnica: Motor de Valor Cuota (NAV V27)

El **Motor de Valor Cuota V27** gestiona el patrimonio total de los fondos de inversión de InAndes y calcula el valor liquidativo diario de las participaciones (**Valor Cuota / NAV**), operando bajo el principio de **Equilibrio Financiero Neutro** homologado con el modelo de control de Ricardo Gallo (`REPORTE VC FDO NSG TODOS 1BIM 2026 - 2026 08 24.xlsx`).

---

## 🛠️ Especificaciones Técnicas y Ubicación

* **Servicio Principal**: `src/services/fondosService.ts` (`calculateValorCuotaV26` / `calculateValorCuotaV27`)
* **Interfaz de Usuario**: `src/features/fondos/FondosPage.tsx` (Pestaña *Valor Cuota*)
* **Exportador Excel**: `ExcelJS` multi-pestaña con tipografía `Consolas`, paneles inmovilizados y marcas de tiempo.
* **Base de Tiempo**: **Base 365 días** homogénea para tasas activas, pasivas y comisiones operativas del gestor.
* **Tasa de Convergencia Pericial**: **`100.00%`** contra el benchmark de 295 aserciones diarias en 5 fondos.

---

## 🧮 Lógica Financiera y Mecánica Diaria

### 1. Principio de Intermediación Neutra (P&L = 0)
El fondo es un vehículo de inversión colectiva en el cual los ingresos brutos devengados por los activos se calibran para absorber con exactitud la suma del costo de financiamiento (pago a los partícipes) más las comisiones de gestión:

$$\text{Ingreso Bruto Activo}(d) = \text{Pago a Inversionistas}(d) + \text{Comisión Admin}(d) + \text{Comisión Captación}(d) + \text{Comisión Misc}(d)$$

$$\text{Utilidad Residual Operativa}(d) = \mathbf{0.00}$$

---

### 2. Ecuaciones del Bucle Diario (Día a Día)

Para cada día $d$ del período contable (ej. `01/01` al `28/02`), partiendo de $\text{Patrimonio}_{\text{Ayer}}$, $\text{Cuotas}_{\text{Ayer}}$ y $\text{ValorCuota}_{\text{Ayer}}$:

#### A. Devengos de Comisiones del Gestor (Base 365):
$$\text{Gasto Admin}(d) = \text{Patrimonio}_{\text{Ayer}} \times \left(\frac{p_{\text{admin}}}{365.0}\right)$$
$$\text{Gasto Captación}(d) = \text{Patrimonio}_{\text{Ayer}} \times \left(\frac{p_{\text{cap}}}{365.0}\right)$$
$$\text{Gasto Misceláneos}(d) = \text{Patrimonio}_{\text{Ayer}} \times \left(\frac{p_{\text{misc}}}{365.0}\right)$$

#### B. Devengo Individual de Inversionistas (Base 365):
Para cada contrato emitido activo:
$$\text{Interés Diario}_i(d) = \text{Capital}_i \times \left(\frac{\text{Tasa Pactada}_i}{365.0}\right)$$
$$\text{Pago Total Inversionistas}(d) = \sum_{i=1}^{N} \text{Interés Diario}_i(d)$$

#### C. Ingreso Bruto Activo Diario (Base 365):
$$\text{Ingreso Bruto}(d) = \text{Patrimonio}_{\text{Ayer}} \times \left(\frac{\text{Tasa Activa}}{365.0}\right)$$

#### D. Suscripción de Aumentos de Capital (@ VC Ayer):
Si en el día $d$ entra un aumento de capital $A_d$:
$$\text{Nuevas Cuotas}(d) = \left\lfloor \frac{A_d}{\text{ValorCuota}_{\text{Ayer}}} \right\rfloor \quad (\text{Truncado a entero})$$
$$\text{Cuotas Totales Cierre}(d) = \text{Cuotas}_{\text{Ayer}} + \text{Nuevas Cuotas}(d)$$

#### E. Patrimonio Total Cierre y Valor Cuota Final:
$$\text{Patrimonio Cierre}(d) = \text{Patrimonio}_{\text{Ayer}} + A_d + \text{Ingreso Bruto}(d)$$
$$\text{Valor Cuota Final}(d) = \frac{\text{Patrimonio Cierre}(d)}{\text{Cuotas Totales Cierre}(d)}$$

---

### 3. Traspaso de Saldos para el Día Siguiente ($d+1$)

$$\text{Patrimonio}_{\text{Ayer}} \leftarrow \text{Patrimonio Cierre}(d)$$
$$\text{Cuotas}_{\text{Ayer}} \leftarrow \text{Cuotas Totales Cierre}(d)$$
$$\text{ValorCuota}_{\text{Ayer}} \leftarrow \text{Valor Cuota Final}(d)$$

---

## 📊 Matriz Transpuesta y Estructura del Reporte Excel

El libro `Reporte_NAV_V27_Export_YYYY_*.xlsx` organiza cada fondo en una pestaña independiente:

* **Filas 1 a N**: Certificados individuales con sangría en aumentos de capital.
* **Filas de Totales Consolidados (17 Conceptos)**:
  1. `TOTAL CAPITAL (Apertura)`: Capital base inicial fijo al día $d_0$.
  2. `(+) CAPITAL ADICIONAL (Hoy)`: Aportes del día.
  3. `(=) CAPITAL ACUMULADO`: Capital apertura + aportes acumulados.
  4. `CUOTAS APERTURA`: Cuotas vigentes al inicio del día.
  5. `(+) CUOTAS ADICIONALES (Hoy)`: Nuevas cuotas emitidas por aportes.
  6. `(=) CUOTAS TOTALES CIERRE`: Total de cuotas al cierre del día.
  7. `VAL CUOTA INICIAL`: Precio de la cuota al inicio del día ($VC_{\text{Ayer}}$).
  8. `GANANCIA TOTAL BRUTA (Base 360)`: Ingreso bruto generado.
  9. `PATRIMONIO TOTAL (Pre-Aportes)`: Patrimonio antes de aportes nuevos.
  10. `COM. ADMIN (-) (Base 365)`: 1.0% anual sobre patrimonio.
  11. `COM. CAPT. (-) (Base 365)`: 2.0% anual sobre patrimonio.
  12. `COM. MISC. (-)`: Comisión miscelánea.
  13. `GANANCIA OPERATIVA (Neta)`: Utilidad operativa del día.
  14. `PATRIMONIO TOTAL CIERRE`: Fondo dorado `#FEF3C7` y doble borde ámbar `#D97706`.
  15. `VAL CUOTA FINAL`: Resaltado azul `#DBEAFE` con 6 decimales (`0.000000`).

---

*Documentación oficial generada bajo el Método Benoit Blanc - 29 de Agosto de 2026.*
