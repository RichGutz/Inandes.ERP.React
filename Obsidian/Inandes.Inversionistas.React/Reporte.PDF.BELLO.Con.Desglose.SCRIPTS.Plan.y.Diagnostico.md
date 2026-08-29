# 🕵️‍♂️ Bitácora Maestra Benoit Blanc: Reportes PDF, Desglose Contable y Motor Vectorial

> **Nota Maestra de Referencia Obligatoria**: [00.A — Módulo de Inversionistas](file:///C:/Users/rguti/Inandes.ERP.React/Obsidian/Inandes.Inversionistas.React/00.A.INVERSIONISTAS.md) & [00_Fondos_y_tasas.md](file:///C:/Users/rguti/Inandes.ERP.React/Obsidian/Inandes.Factoring.React/00_Fondos_y_tasas.md)  
> **Fecha de Cierre y Blindaje**: 29 de Agosto de 2026  
> **Safe Points Relacionados**: `DESGLOSE.EXCEL.DINAMICO.OFICIAL` (Commit `1c570c6`) y `PDF.BELLO.VECTORIAL.1TO1` (Commit `668e61e`)  
> **Metodología**: Método Benoit Blanc (`LEG` $\rightarrow$ `CLON` $\rightarrow$ `DIFF` $\rightarrow$ `QC` $\rightarrow$ `NOTA`)

---

## 🚨 REGLAS DE ORO INQUEBRANTABLES PARA CUALQUIER AGENTE DE IA

> [!CAUTION]
> **LEER ANTES DE TOCAR CUALQUIER LÍNEA DE CÓDIGO RELACIONADA A GENERACIÓN DE PDFS:**
> 1. **PROHIBIDO EL USO DE `html2pdf.js` / `html2canvas` para reportes contables complejos**:
>    * `html2canvas` no es un motor PDF real. Toma una "captura de pantalla rasterizada" y tiene bugs catastróficos: **ignora `display: table-cell` en `divs`**, apila cajas horizontalmente alineadas como texto suelto vertical, deforma bordes colapsados y rasteriza el texto haciéndolo borroso y no seleccionable.
> 2. **OBLIGATORIO: Usar el Motor Vectorial Nativo del Navegador o WeasyPrint**:
>    * Toda generación en cliente debe realizarse a través del **motor vectorial nativo del navegador** (`window.open` + `document.write` + `print()`), el cual procesa el CSS `@page { size: A4 landscape; margin: 0; }` con 100% de nitidez vectorial, texto real y colores exactos.
> 3. **OBLIGATORIO: Estructura 100% HTML `<table>` Nativa**:
>    * PROHIBIDO simular tablas con `div` y flexbox/grid para documentos PDF. Toda cuadrícula (KPIs y datos) DEBE usar `<table>`, `<tr>`, `<td>` con **anchos fijos en píxeles** en cada `<th>`.

---

## 🩸 1. Autopsia Forense de Errores Históricos (Rondas Benoit Blanc)

A continuación se detallan las fallas críticas ocurridas en sesiones pasadas para evitar su repetición:

### Caso 1: Cuelgue Indefinido de la Interfaz (`Compilando...` infinito)
* **Causa Raíz**: `apiConfig.ts` evaluaba `VITE_API_FACTORING_URL` que en producción resolvía a `http://localhost:8000`. Al estar en `https://inandes.geeksoft.tech`, la llamada `fetch()` apuntaba a la máquina local del usuario o era bloqueada por CORS/Mixed Content.
* **Falta de Timeout**: El `fetch()` no contaba con `AbortSignal`, colgando el hilo por más de 300 segundos.
* **Solución**: Se implementó `AbortController` con timeout estricto de **2.0 segundos** en [`pdfDownloadHelper.ts`](file:///c:/Users/rguti/Inandes.ERP.React/src/utils/pdfDownloadHelper.ts) y conmutación transparente al motor nativo del navegador.

### Caso 2: Descarga de PDFs 100% en Blanco
* **Causa Raíz**: El intento de aislar el renderizado inyectando un `<div>` temporal con `position: fixed; left: -9999px;` colocaba los elementos fuera de las coordenadas visuales del renderizador, provocando que los estilos y fuentes base64 fueran descartados.
* **Solución**: Uso de ventana emergente nativa (`window.open`) y renderizado directo en el DOM del navegador.

### Caso 3: Descuadre Total, Texto Apilado y Columnas Fusionadas (La "Captura Rota")
* **Causa Raíz**: 
  1. Las tarjetas KPI estaban maquetadas como `<div class="kpi-card" style="display: table-cell">`. `html2canvas` ignora `table-cell` en `div`, apilando todos los montos verticalmente como texto plano.
  2. La tabla contable no tenía anchos rígidos en `<th style="width: ...">`, causando que `CAPITAL BASE`, `INT. BRUTO`, `IR 5%` y `NETO` se fusionaran en una sola masa sin bordes.
* **Solución**: Conversión de KPIs a `<table class="kpi-cards-table">` y definición de 15 anchos exactos en píxeles para la tabla de datos en [`pdfGeneratorBelloConDesglose.ts`](file:///c:/Users/rguti/Inandes.ERP.React/src/utils/pdfGeneratorBelloConDesglose.ts).

### Caso 4: Desborde Vertical de Hojas A4 Landscape (Tablas cortadas y páginas huérfanas)
* **Causa Raíz**:
  1. `html2pdf.js` sumaba un margen artificial `margin: [8,8,8,8]` al `padding` interno del CSS, encogiendo la escala y superando los `210mm` de altura de la hoja A4.
  2. Los logos de cabecera medían más de 60px de alto, empujando la tabla contable hacia abajo.
* **Solución**: Logos compactos de 26px, cabecera de 2 líneas, padding estricto de `6mm 8mm` y límite exacto de **25 filas por hoja A4**.

---

## 📊 2. Especificación Técnica: REPORTE BELLO CON DESGLOSE

### 2.1. Arquitectura de Salida (1:1 con Excel Maestro)
Cada página A4 Landscape ($297\text{mm} \times 210\text{mm}$) contiene exactamente:
1. **Cabecera Oficial**:
   * Logo Geeksoft (izq.) + Título + Logo InAndes (der.).
   * Banner de Fondo: `FONDO [NOMBRE] ([ID]) — MONEDA: [PEN/USD] | [N] INVERSIONISTAS (Parte X de Y)`.
2. **Cajas KPI Horizontales (`<table class="kpi-cards-table">`)**:
   * `CAPITAL BASE INICIAL`
   * `INTERÉS BRUTO DEVENGADO`
   * `RETENCIÓN IR 5% (2DA CAT)`
   * `REPARTO EN EFECTIVO`
   * `DEDUCCIONES TOTALES` (condicional)
   * `PENALIDADES RESCATE` (condicional)
   * `DEVOLUCIÓN DE CAPITAL` (condicional)
   * `CAPITAL FINAL VIGENTE`
3. **Tabla Contable con Desglose (Máximo 25 filas por página)**:
   * **15 Columnas Estrictas**:
     * `#` (25px) | `CERTIFICADO` (105px) | `INVERSIONISTA` (170px) | `CAPITAL BASE` (75px) | `INT. BRUTO` (60px) | `IR (5%)` (50px) | `BASE NETA` (60px) | `CAPITALIZ.` (60px) | `REPARTO` (60px) | `DEDUCC.` (50px) | `PENALID.` (50px) | `NETO FINAL` (65px) | `RESCATES` (60px) | `TRANSFER.` (70px) | `CAPITAL FINAL` (75px)
   * **Filas de Desglose de Aumentos de Capital (`aumento-row`)**:
     * Identificadas con `Aumento (DD/MM/YY)` y `└─ Incremento de Capital` en color azul cursiva `#0284C7`.
4. **Pie de Página Oficial**:
   * `INANDES ERP · SISTEMA OFICIAL DE RETORNOS Y RENDIMIENTOS · LIQUIDACIÓN V40`.
   * Fecha y hora exacta de emisión.

---

## 📁 3. Mapa de Archivos del Ecosistema de Reportes

| Archivo | Rol en el Sistema |
| :--- | :--- |
| [`src/utils/pdfGeneratorBelloConDesglose.ts`](file:///c:/Users/rguti/Inandes.ERP.React/src/utils/pdfGeneratorBelloConDesglose.ts) | **Generador HTML Retornos**: Maquetador oficial A4 Landscape con KPIs en tabla nativa y 25 filas/hoja. |
| [`src/utils/pdfGeneratorValorCuotaV27.ts`](file:///c:/Users/rguti/Inandes.ERP.React/src/utils/pdfGeneratorValorCuotaV27.ts) | **Generador HTML Valor Cuota NAV V27**: Maquetador oficial con 1 página independiente por cada mes del bimestre. |
| [`src/utils/pdfDownloadHelper.ts`](file:///c:/Users/rguti/Inandes.ERP.React/src/utils/pdfDownloadHelper.ts) | **Helper Universal**: Conexión a backend FastAPI + fallback a motor de impresión vectorial nativo. |
| [`src/features/inversionistas/InversionistasPage.tsx`](file:///c:/Users/rguti/Inandes.ERP.React/src/features/inversionistas/InversionistasPage.tsx) | **Página de Inversionistas**: Consume `generatePdfBelloConDesglose` y `downloadReportPdf`. |
| [`src/features/fondos/FondosPage.tsx`](file:///c:/Users/rguti/Inandes.ERP.React/src/features/fondos/FondosPage.tsx) | **Página de Fondos y Tasas**: Consume `generatePdfValorCuotaV27` y `downloadReportPdf`. |
| [`backend/routers/inversionistas.py`](file:///c:/Users/rguti/Inandes.ERP.React/backend/routers/inversionistas.py) | **Backend FastAPI**: Endpoint `/api/inversionistas/generate-pdf` con motor WeasyPrint. |

---

## 🛠️ 4. Protocolo de Verificación y Despliegue Obligatorio (Regla 11)

Antes de dar por concluida cualquier modificación a los reportes:
1. **Compilación Limpia**:
   ```powershell
   npm run build
   ```
2. **Commit y Despliegue Exclusivo en MAIN (Regla 9 y 11)**:
   ```powershell
   git add .
   git commit -m "fix(pdf): [descripcion concisa del cambio]"
   git push origin main
   ```
3. **Verificación en Servidor Contabo VPS (`169.58.168.107`)**:
   * Comprobar contenedor activo en Coolify (`inandes.geeksoft.tech`).
   * Probar descarga de PDF en producción con `Ctrl + F5`.

---

*Dossier Pericial cerrado y oficializado por Detective Benoit Blanc - 29 de Agosto de 2026.*
