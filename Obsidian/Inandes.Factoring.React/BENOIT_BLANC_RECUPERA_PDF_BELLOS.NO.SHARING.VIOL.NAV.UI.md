# 🕵️‍♂️ Detective Benoit Blanc: Plan Pericial — Valor Cuota NAV V27 (Excel Maestro y PDF WeasyPrint)

> **Expediente Oficial**: `BENOIT_BLANC_RECUPERA_PDF_BELLOS.NO.SHARING.VIOL.NAV.UI.md`  
> **Ubicación**: `Obsidian/Inandes.Factoring.React/BENOIT_BLANC_RECUPERA_PDF_BELLOS.NO.SHARING.VIOL.NAV.UI.md`  
> **Investigador Principal**: Detective Benoit Blanc  
> **Fecha**: 29 de Agosto de 2026  
> **Metodología Estricta**: `LEG` (Autopsia de la Escena) $\rightarrow$ `CLON` (Aislamiento y Sanitización) $\rightarrow$ `DIFF` (Diferencias y Código) $\rightarrow$ `QC` (Control de Calidad Terminal) $\rightarrow$ `NOTA` (Certificación y Cierre)

---

## 🎯 1. La Escena del Crimen (`LEG`)

1. **Botones Inertes (Permanentemente Deshabilitados)**:
   * En `src/features/fondos/FondosPage.tsx`:
     * Botón 1: `Descargar Excel Maestro V27`
     * Botón 2: `Descargar PDF Oficial V27`
   * **Causa Raíz Descubierta**:
     * El estado `vcReportData` se inicializaba en `[]` pero **nunca se ejecutaba `calculateValorCuotaV26` en el montaje ni al cambiar de período**.
     * Los botones tenían la condición `disabled={vcReportData.length === 0}`, manteniéndolos permanentemente mudos y bloqueados.
     * La función `handleExportVcExcel` **ni siquiera estaba implementada en el componente**.

---

## 📋 2. Plan Quirúrgico en 2 Fases (`CLON` & `DIFF`)

### 🟢 FASE 1: Restaurar y Curar el Botón de Excel Maestro V27 (Prioridad Inmediata)
1. **Carga Automática de Datos Contables (`calculateValorCuotaV26`)**:
   * En `FondosPage.tsx`, al cambiar `vcSelYear`, `vcSelTipo`, `vcSelNum` o `vcSelFondo`, invocar `calculateValorCuotaV26(vcSelFondo === 'TODOS' ? null : vcSelFondo, new Date(fStart), new Date(fEnd))` y guardar el resultado en `vcReportData`.
2. **Implementación de `handleExportVcExcel` con `exceljs`**:
   * Generar el Excel Maestro V27 con la matriz transpuesta diaria:
     * Pestaña por cada fondo o consolidado con los días del período en columnas.
     * Filas de certificados con desglose diario de intereses y aumentos.
     * Filas de resumen diario: `TOTAL CAPITAL (Apertura)`, `GANANCIA DIARIA ACTIVA (Base 360)`, `COMISIÓN ADMINISTRACIÓN (360)`, `COMISIÓN CAPTACIÓN (360)`, `MISCELÁNEOS (360)`, `GANANCIA NETA DIARIA`, `VALOR CUOTA CIERRE`.
   * Descarga limpia `.xlsx` directa al cliente con feedback visual (`✓ Excel V27 Listo`).

---

### 🔵 FASE 2: Generador de Reporte PDF Oficial V27 WeasyPrint (Compaginación Ancha)
1. **El Desafío de la Matriz Diaria Ancha (28 a 31 Días)**:
   * A diferencia de Retornos (que totaliza por columnas fijas), el Valor Cuota desglosa **cada día del mes en columnas**.
   * Un mes de 31 días no entra legible en 1 sola hoja A4 Landscape sin reducir la letra a niveles microscópicos.
2. **Estrategia de Compaginación en 2 Páginas Horizontales por Mes**:
   * **Página 1 (Días 1 al 15)**: Bloque de Apertura Quincenal con encabezado oficial, banner del fondo y resumen diario.
   * **Página 2 (Días 16 al 31 + Totales de Cierre)**: Cierre de mes, Valor Cuota final y firmas.
3. **Consumo del Microservicio Backend WeasyPrint**:
   * Enviar HTML limpio mediante [`src/utils/pdfDownloadHelper.ts`](file:///c:/Users/rguti/Inandes.ERP.React/src/utils/pdfDownloadHelper.ts) a `POST /api/inversionistas/generate-pdf`.
   * Integración con la Bóveda Gráfica Base64 Optimizada (`LOGO_INANDES_BASE64` y `LOGO_GEEKSOFT_BASE64`).

---

## 🧪 3. Protocolo de Control de Calidad (`QC`)
1. **Prueba Terminal de Cálculo**:
   * Ejecutar script pericial para validar que `calculateValorCuotaV26` retorne los 5 fondos con sus 2 bloques mensuales (Enero y Febrero) y matrices de 31 y 28 días respectivamente.
2. **Prueba de Descarga Excel**:
   * Validar que el archivo `.xlsx` se genere en $<1.5\text{s}$ y abra con todas las fórmulas y números formateados `#,,##0.00`.
3. **Prueba de Descarga PDF**:
   * Validar que el PDF WeasyPrint compile en $<5\text{s}$ sin corrupción.

---

## 📝 4. Revisión y Aprobación del Usuario
* Por favor revisa este plan pericial. Una vez aprobado, comenzaré de inmediato con la **Fase 1: Curación del botón Excel Maestro V27**.
