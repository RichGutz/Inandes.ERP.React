# 📄 Especificación y Diagnóstico: REPORTE BELLO CON DESGLOSE

> **Nota Hija de [00.A — Módulo de Inversionistas](file:///C:/Users/rguti/Inandes.ERP.React/Obsidian/Inandes.Inversionistas.React/00.A.INVERSIONISTAS.md)**  
> **Fecha:** 11 de Agosto de 2026  
> **Safe Point Relacionado:** `LAST.TIME.BELLO.SIN.DESGLOSE` (Commit `af4f092`)

---

## 1. 🎯 Objetivo del Requerimiento

El objetivo es lograr un **Único Generador Oficial de PDF** en el módulo de Inversionistas que cumpla con los siguientes criterios intangibles:

1. **Clonación 1:1 del Formato Bello Original (`commit 589aa52` / `217a682`):**
   - **Cabecera:** `INANDES ACTIVOS ALTERNATIVOS S.A.C.` | `REPORTE OFICIAL DE AUDITORÍA Y DEVENGUE DE RETORNOS (MOTOR V40)` | `FECHA DE CORTE: DEL [fStart] AL [fEnd]`.
   - **Logo Izquierdo:** Logo **Geeksoft** ampliado al doble (`56px`).
   - **Logo Derecho:** Logo oficial **InAndes** (`LOGO_INANDES_BASE64`) en reemplazo de EFI.
   - **Paginación Troceada Estricta:** Máximo **25 filas por hoja** (`ROWS_PER_PAGE = 25`) con subtítulo `(Parte X de Y)`.
   - **Tabla Contable:** Estilo Navy `#0f172a`, Int. Bruto azul `#0284c7`, IR (5%) rojo `#dc2626`, Reparto verde `#059669`, Rescates rojo `#dc2626` y Capital Final azul marino `#1e3a8a`.
   - **Pie de Página Legal:** `INANDES GRUPO FINANCIERO & GEEKSOFT — AUDITORÍA Y CONTROL DE CALIDAD OFICIAL` | `Página X de Y`.

2. **Desglose de Aumentos de Capital:**
   - Inserción de sub-filas desglosadas en itálica azul `└─ Incremento de Capital` únicamente debajo de aquellos certificados que registraron aumentos de capital dentro del período (ej. `NSGPEN01-090`).

3. **Universalidad (TODOS vs. FONDO ÚNICO):**
   - Funcionar de forma idéntica e impecable tanto al seleccionar **"TODOS LOS FONDOS"** como al filtrar **"UN SOLO FONDO INDIVIDUAL"**.

---

## 🔍 2. Diagnóstico Profundo: Lo que Funcionó y Lo Curado

### ✅ Curado 1: Atajo Estático de Febrero Eliminado
* **Causa Raíz:** En `InversionistasPage.tsx` (línea 1564), dentro del evento `onClick` del botón PDF existía la condición hardcodeada:
  `if (fEnd === '2026-02-28') window.open('/Reportes_Auditoria_2026-02-28/REPORTE_OFICIAL_CIERRE_AUDITORIA_2026-02-28.pdf', '_blank')`.
  Esto hacía que al seleccionar la fecha del 28/Feb (tanto para TODOS los fondos como para UN FONDO INDIVIDUAL), la aplicación ignorara el cálculo dinámico y abriera el archivo PDF estático pre-grabado en el servidor.
* **Solución:** Se eliminó la condición del botón de PDF en `InversionistasPage.tsx`, haciendo que cualquier clic invoque siempre la función dinámica `handleExportPDFV40()`.

### ✅ Curado 2: Corrección y Crecimiento de Logos Corporativos
* **Logo Izquierda (Geeksoft):** Se duplicó el tamaño visual en CSS de `.logo-geeksoft` pasando de `28px` a `56px`.
* **Logo Derecha (InAndes):** Se reemplazó la constante `LOGO_EFI_BASE64` por `LOGO_INANDES_BASE64` en el encabezado HTML e importación de assets.

### ✅ Curado 3: Rescate de 30,000 USD en `NSLCON01-003.20220720` (Cierre 31/03/2026)
* **Causa Raíz:** `financialCalculator.ts` agrupaba historial por `e.id_certificado` (`NSLCON01-003.20220720.20251231`) y consultaba `crm_cronograma_deducciones_rescates` filtrando por `id_certificado`. Como en Supabase `crm_cronograma_deducciones_rescates` almacena `id_contrato = 'NSLCON01-003.20220720'`, la consulta SQL devolvía 0 filas.
* **Solución:** Se ajustó el agrupador del Paso 4 y la consulta del Paso 5 para filtrar por `id_contrato`, vinculando el rescate de **30,000 USD** al 31/03/2026.

---

## 🛠️ 3. Protocolo de Despliegue (Regla 11)

1. `npm run build`
2. `python deploy_vps.py`
3. `git add .` -> `git commit -m "..."` -> `git push origin main`
