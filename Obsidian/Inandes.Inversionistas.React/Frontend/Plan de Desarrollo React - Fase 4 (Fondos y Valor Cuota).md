# 💻 Plan de Desarrollo React - Fase 4: Gestión de Fondos y Valor Cuota v26

Esta nota detalla el plan de implementación técnica y diseño de interfaz para la **Fase 4** de la migración del CRM InAndes a **React + Vite (TypeScript)**. En esta fase, implementaremos la administración de Fondos y Plazos de Inversión y el cálculo diario de Valor Cuota v26 en TypeScript.

---

## 🎨 1. Estructura de la Interfaz (2 Sub-pestañas)

El módulo se estructurará internamente utilizando pestañas de navegación dinámicas:

### Pestaña A: 🏦 Variables Fondos
Esta pestaña gestiona los fondos de inversión y sus tasas. Consta de 3 vistas de navegación interna controladas por estado:
1. **Directorio de Fondos (List)**:
   * Grid de tarjetas con los fondos agrupados por `id_fondo`.
   * Muestra el RUC, moneda, vigencia, tamaño máximo, comisiones macro (Admin %, Captación %) y la cantidad de plazos activos.
   * Botón para abrir el formulario de **Nuevo Fondo** (crear).
   * Botón **PDF** (reporte consolidado) y **Excel** de descarga rápida de la tabla maestra.
   * Botón **VER Y GESTIONAR PLAZOS** para navegar al detalle del fondo.
2. **Variantes de Plazo (Detail)**:
   * **Sección Datos Maestros (Formulario)**: Permite editar el nombre, moneda, RUC, tamaño máximo, fecha de cierre, frecuencia de cupones y comisiones de administración/captación del fondo padre. Al guardar, las modificaciones se actualizan en lote a todas las filas de plazos hijas de ese fondo.
   * **Sección Plazos de Inversión (Cards Grid)**: Muestra cada plazo como un producto independiente (ej. 12 Meses, 24 Meses, etc.), indicando su Tasa TEA %, Tasa Activa %, Penalidad de Rescate %, Plazo de Rescate (meses) y Opción de Rescate (días).
   * Botón **EDITAR CONDICIÓN** para modificar el plazo en particular.
3. **Edición de Plazo (Edit Plazo)**:
   * Formulario dedicado para modificar las tasas de rentabilidad y comisiones de incentivo (Mantenimiento Asesor %, Comisión primer año %, Comisión única %) exclusivas para el plazo seleccionado.

---

### Pestaña B: 📊 Valor Cuota
* **Panel de Filtros**:
  * Selector de Fondo ( dropdown de fondos únicos + opción "TODOS").
  * Año de consulta (2024 a 2027).
  * Ciclo (Bimestre o Trimestre).
  * Número de periodo contable (1 a 6 o 1 a 4).
* **Tabla de Devengue Diario (Reporte Maestro)**:
  * Presenta de forma transpuesta la matriz contable día a día del periodo seleccionado, agrupada por bloques mensuales (por ejemplo, bloque Enero 2026 y bloque Febrero 2026).
  * Las columnas corresponden a los días del mes (`01/01`, `02/01`, etc.).
  * Las filas muestran los certificados emitidos (`CERT`) y sus aumentos de capital correspondientes (`Aumento`).
  * Filas de Resumen Contable:
    * `TOTAL CAPITAL`: Sumatoria del capital diario.
    * `INVERSIONES ORIGINALES`: Aportes de capital fresco del día.
    * `INV. ORIGINALES ACUMULADAS`: Suma acumulada de capital.
    * `VAL CUOTA INICIAL`: Valor de cuota al inicio del día.
    * `GANANCIA TOTAL BRUTA`: Devengue de intereses diario (Tasa Activa / 360).
    * `GANANCIA OPERATIVA`: Interés bruto menos comisiones de administración (Tasa Admin / 365).
    * `PATRIMONIO TOTAL CIERRE`: Patrimonio neto al finalizar el día.
    * `VAL CUOTA FINAL`: Valor de cuota final del día (NAV).
* **Exportaciones**:
  * **Excel v25/26**: Genera y descarga un libro con pestañas por cada fondo (`id_fondo`), unificando los bloques mensuales en filas de auditoría detalladas.
  * **PDF v25/26**: Genera una vista premium de impresión HTML con la matriz transpuesta y abre el modal de impresión nativo del navegador.

---

## 💸 2. Motor de Valor Cuota v26 en TypeScript (`fondosService.ts`)

Portaremos el motor contable `generate_cuotas_v26.py` a TypeScript. La lógica realizará una simulación día a día del periodo:

### Reglas Contables del Core:
1. **Días del Periodo**: Se calcula de forma dinámica en base al año y ciclo seleccionados.
2. **Fórmulas Diarias**:
   * $\text{Interés Bruto Diario} = \text{Patrimonio\_Ayer} \times \frac{t_{\text{activa}}}{360}$
   * $\text{Gasto Admin Diario} = \text{Patrimonio\_Ayer} \times \frac{t_{\text{admin}}}{365}$
   * $\text{Utilidad Neta Diaria} = \text{Interés\_Bruto} - \text{Gasto\_Admin}$
   * $\text{Valor Cuota Final} = \frac{\text{Patrimonio\_Ayer} + \text{Utilidad\_Neta}}{\text{Cuotas\_Ayer}}$
3. **Aumentos de Capital**:
   * Si en el día $d$ del periodo ocurre un evento `aumento_capital`, se incrementa el capital del contrato y se asignan nuevas cuotas:
     $$\text{Nuevas\_Cuotas} = \frac{\text{Monto\_Aumento}}{\text{Valor\_Cuota\_Final}}$$
   * Se recalculan los saldos de cuotas y patrimonio acumulado para el día siguiente.
4. **Agrupación y Rendimiento**:
   * Agrupa los días por mes natural en bloques de visualización.
   * Evita bucles excesivos pre-indexando los eventos de aumento de capital por ID de contrato en mapas hash.
