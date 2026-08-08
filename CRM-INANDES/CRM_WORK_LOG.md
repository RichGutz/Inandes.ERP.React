# CRM Development Log

## 2026-01-19 - Initial Setup & Migration Analysis
- **Context**: CRM modules were successfully integrated into the main application navigation (`modules/15_CRM...`, `16_...`, `17_...`).
- **Objective**: Focus on "Gestión de Partícipes" and validateg the Google Sheets migration process.
- **Current Status**:
    - Modules moved to `modules/`.
    - Graphviz dependency fixed.
    - User indicated `17_CRM_Participes.py` contains the migration logic.

## Tasks
- [x] Analyze `modules/17_CRM_Participes.py` for GSheets migration logic.
    - *Finding*: It relies on `src.utils.migration_participes`.
- [x] Locate and restore `migration_participes.py` from `CRM-INANDES/src/utils/`.
- [x] Push backend logic to Production (Main).
- [x] Verify Supabase table structure for participants (Next Step).
    - *Finding*: Table `crm_participes` has 131 records.
    - *Columns Detected*: `id`, `documento_identidad`, `nombre_completo`, `email`, `telefono`, `banco_nombre`, `origen_datos`, etc.
    - *Source*: Data comes from `MIGRACION_USD01`, etc.
- [ ] Execute/Verify migration via UI (Next Step).

## 2026-01-19 - Investments Module (Depósitos)
- **Objective**: Implement `crm_inversiones` table and management logic.
- **Reference**: `modules/16_CRM_Logic_DB.py` (Diagram).
- **Tasks**:
    - [x] Analyze Logic Diagram for `crm_inversiones` schema.
    - [x] Check if `crm_inversiones` exists in Supabase. (Result: Missing)
    - [x] Create/Update SQL schema for investments (`CRM-INANDES/sql/01_create_crm_tables.sql`).
    - [ ] Notify User to execute SQL.

## 2026-01-19 - Legacy Data Migration (Excel Analysis)
- **Objective**: Analyze structure of "Monstrous" historical Excel files.
- **Files**:
    - `FDO NSG MIPYME PEN 01 - Control de Fondos 2025 12.xlsx`
    - `FDO NSG MIPYME USD 01 - Control de Fondos 2025 12.xlsx`
- **Tasks**:
    - [x] List Worksheet names (Tabs).
        - **Findings**: `OpAct`, `RegPart`.
    - [ ] Sample headers from main sheets. (Skipped per user instruction)
    - [x] Inspect `RegPart` starting at row 4880.
        - *User Guide*: Col A (Date), Col B (Rate), Col T (Amount > 0).
        - **Conclusion**: GSheet is INCOMPLETE/NEW. (User Overruled: "Forget Excel").
    - [x] Update `migrate_legacy_investments.py` to inspect GSheets.
    - [x] Verify GSheet Data Range (Row 4+).
    - [x] Create `migrate_gsheet_investments.py`.
    - [x] Execute Migration Script (GSheet Source).
    - **Results (2026-01-19)**:
        - Total Inversiones Migradas: **114**.
        - **INCIDENT**: User reports total data mismatch (Amounts wrong, IDs unwelcome).
        - **Status**: DEBUGGING.

## 2026-01-19 - Debugging Migration Crisis
- **Objective**: Fix data integrity issues.
- **Tasks**:
    - [ ] Compare Raw GSheet vs DB (Side-by-side).
    - [ ] Fix Column Mapping (Index Z might be shifted).
    - [x] Fix IDs (User wants DNI/Tab Name stored directly?).

## 2026-01-19 - Inversiones UI Implementation
- **Objective**: Create Interface to view/manage investments.
- **Module**: `modules/18_CRM_Inversiones.py`.
- **Tasks**:
    - [ ] Create `modules/18_CRM_Inversiones.py`.
    - [ ] Implement Backend Query (Join Inversiones + Participes).
    - [ ] Implement Filters (Fondo, Moneda, Participe).
    - [x] Implement Backend Query (Join Inversiones + Participes).
    - [x] Implement Filters (Fondo, Moneda, Participe).
    - [x] Implementation Grid logic.

## 2026-01-19 - Migration Quality Control
- **Objective**: Fix business logic and verify totals.
- **Tasks**:
    - [x] Remove "Auto-Liquidated" logic (Force 'ACTIVO').
    - [ ] Sanity Check: Compare GSheet Column Z Totals vs DB Sums.
    - [ ] Re-run Migration with fixes.

## 2026-01-19 - Google Sheets Data Source
- **Objective**: Switch from Excel to GSheets as the primary source for migration.
- **Source**: `CRM-INANDES/DB_PARTICIPES_DESIGN/links_gsheets.txt`.
- **Tasks**:
    - [x] Locate links file.
    - [x] Extract GIDs for all funds (PEN/USD). (Confirmed match with `migration_participes.py`).
    - [x] Inspect GSheet Headers & Data Range (Rows 4880+).
    - [x] Inspect GSheet Headers & Data Range (Rows 4880+).
    - [x] Create `CRM-INANDES/DATA_MAPPING.md`.
    - [ ] Resolve Structure Mismatch (User Decision needed).
    - [ ] Execute Migration Script.

---

## 2026-01-21 - CRM Participes: 6 Mejoras Críticas + PDF/Excel Export

### Sesión 1: Fixes en Gestión de Partícipes
**Objetivo**: Resolver bugs y mejorar UX del módulo de partícipes.

**Problemas identificados:**
1. Nombres en orden incorrecto (Nombre Apellido → debe ser Apellido Nombre)
2. Error NULL constraint en `tipo_doc` al editar
3. Tab "Cuentas & Asesor" muy cargado
4. Falta soporte para 2 cuentas bancarias (PEN + USD)
5. Sin validación de monedas duplicadas

**Implementación (6 fixes):**
- [x] Fix: Orden de nombres corregido (Apellido1 Apellido2 Nombre1 Nombre2)
- [x] Fix: Display dinámico en lista usando función `format_display_name()`
- [x] Feature: Tabs separados ("💰 Cuentas Bancarias" + "👔 Asesor Asignado")
- [x] Feature: Soporte para 2 cuentas (campos `_1` y `_2`)
- [x] Feature: Validación de monedas únicas
- [x] Debug: Logging temporal para investigar error tipo_doc

**Scripts SQL ejecutados:**
- `sql/14_add_dual_bank_accounts.sql` - Renombrar campos bancarios con sufijos `_1` y `_2`

**Verification:**
- `verify_bank_columns.py` - Confirmó estructura correcta

**Deployment:**
- Commit: `77b13eb - feat: CRM Participes - 6 mejoras críticas`
- Push: `railway/main`

---

### Sesión 2: Debugging y Limpieza de BD

**Problemas identificados:**
1. Orden alfabético incorrecto en lista de partícipes
2. Error tipo_doc NULL constraint al guardar

**Análisis (WORKING WITH RICH methodology):**
- [x] Investigación: `debug_tipo_doc.py` reveló campos duplicados
- [x] Hallazgo: Tabla tiene `tipo_doc` Y `tipo_doc_P1` (ambos)
- [x] Verificación: `verify_migration_complete.py` - 131 registros, 100% migrados
- [x] Decisión: Eliminar campos legacy (seguros de eliminar)

**Implementación:**
- [x] Script SQL: `sql/15_drop_legacy_fields.sql`
  - DROP COLUMN: `tipo_doc`, `documento_identidad`, `nombre_completo`, `email`, `telefono`
- [x] Verificación: `verify_deletion_success.py` - Confirmó eliminación exitosa
- [x] Fix código: ORDER BY cambiado de `nombre_completo_P1` → `"Apellido_1_P1"`
- [x] Fix código: Removido debug logging (ya no necesario)

**Deployment:**
- Commit: `9e9e422 - fix: Orden alfabético y eliminación de campos legacy`
- Push: `railway/main`

---

### Sesión 3: Bug Fixes Menores

**Bug: Moneda por defecto causaba validación incorrecta**
- Problema: Selectbox de moneda defaulteaba a "PEN" en ambas cuentas
- Validación se activaba erróneamente (detectaba 2 cuentas en PEN)
- Solución:
  - [x] Agregado placeholder "-- Seleccionar --" en selectbox
  - [x] Validación solo se activa si ambas monedas están seleccionadas
  - [x] Guardar NULL si moneda no fue seleccionada

**Deployment:**
- Commit: `092199e - fix: Moneda por defecto`
- Push: `railway/main`

---

### Sesión 4: PDF Export + Excel Ordenado

**Regression Fix: Gestión de Inversiones**
- **Error reportado:** `column crm_participes.nombre_completo does not exist`
- **Causa:** El campo `nombre_completo` fue eliminado en la limpieza de BD, pero `18_CRM_Inversiones.py` lo seguía usando.
- **Solución:** Actualizado `18_CRM_Inversiones.py` para usar `nombre_completo_P1`, `documento_identidad_P1` y `tipo_doc_P1`.
- **Commit:** `fix(inversiones): Use _P1 fields instead of legacy columns`

**Feature 1: Exportar PDF**
**Objetivo**: Generar formularios imprimibles de partícipes.

**Implementación:**
- [x] Creado: `modules/pdf_generator.py` (utility separada, código limpio)
  - Librería: `reportlab`
  - Función: `generate_participants_pdf(participants_list)`
  - Formato: Una página por partícipe (131 páginas total)
- [x] Integrado en UI: Botón "📄 Exportar PDF" al lado de "📥 Exportar Excel"
- [x] Layout ajustado: 3 columnas (Nuevo Cliente | Excel | PDF)

**Prueba local:**
- Script: `test_pdf_export.py`
- Resultado: 180.20 KB, 131 páginas ✅

**Feature 2: Excel con Columnas Ordenadas**
**Problema**: Columnas del Excel estaban desordenadas (no seguían orden lógico de tabs).

**Solución (Opción A - Sin modificar BD):**
- [x] Modificada función `to_excel()` en `17_CRM_Participes.py`
- [x] Orden implementado:
  1. Sistema (id, created_at, updated_at, origen)
  2. P1 - Identidad y Contacto (18 campos)
  3. P1 - Dirección (2 campos)
  4. P1 - Cónyuge (7 campos)
  5. P1 - Laboral (5 campos)
  6. P2, P3, P4 (mismo orden que P1)
  7. Cuentas Bancarias (9 campos)
  8. Asesor (2 campos)
  9. Campos legacy al final

**Scripts creados:**
- `upload_participants_excel.py` - Para subir Excel llenado por usuarios
  - Uso: `python upload_participants_excel.py participes_db.xlsx`
  - Features: UPSERT en batches de 50, confirmación antes de proceder

**Deployment:**
- Commit: `96a3b9c - feat: Export PDF + Excel ordenado por tabs`
- Fix: `df52284 - fix: Add reportlab dependency`
- Push: `railway/main`

---

## Estado Actual (2026-01-21)

### ✅ Completado
- 6 mejoras críticas en Gestión de Partícipes
- Orden alfabético corregido
- Campos legacy eliminados (limpieza de BD)
- Export PDF funcional (131 páginas)
- Export Excel con columnas ordenadas
- Script de carga Excel-to-Supabase

### 📊 Estadísticas
- Total partícipes: 131
- Campos por partícipe: ~140
- Tabs del formulario: 6 (P1, P2, P3, P4, Cuentas, Asesor)

### 📝 Archivos Importantes
- `modules/17_CRM_Participes.py` - Módulo principal (UI + lógica)
- `modules/pdf_generator.py` - Generador de PDF
- `upload_participants_excel.py` - Carga masiva desde Excel
- `sql/14_add_dual_bank_accounts.sql` - Schema dual cuentas
- `sql/15_drop_legacy_fields.sql` - Limpieza de campos legacy

### 🔄 Workflow para Usuario
1. Descargar Excel ordenado desde UI
2. Llenar datos manualmente
3. Cargar: `python upload_participants_excel.py participes_db.xlsx`

### 🎯 Próximos Pasos Potenciales
- [ ] Import masivo UI (subir Excel desde interfaz)
- [ ] Validaciones de negocio en formulario
- [ ] Reportes de partícipes (filtros, búsquedas)
- [ ] Integración con módulo de Inversiones

---

### Sesión 5: Maintenance & Fixes

**Bug: Rango de Fechas de Nacimiento**
- **Problema:** Error "Date set outside allowed range"
- **Solución:**
  - `st.date_input`: Added `min_value` (1900-01-01) and `max_value` (today)
  - `modules/17_CRM_Participes.py`

---

### Sesión 6: Inversiones UI V3 (Mock)

**Objetivo:** Implementar nueva estructura de 3 Tabs y Mock funcional para alta/baja de tickets.

**Cambios:**
- Refactor total de `modules/18_CRM_Inversiones.py`
- **Tab 1: Portafolio**: Mantiene grid actual y bot.
- **Tab 2: Nuevos / Rescates (Mock)**:
  - Selector "Alta" vs "Baja".
  - **Alta**: Formulario completo (Fondo, Plazo, Tasa, Monto).
  - **Baja**: Buscador de partícipes (Real) -> Tabla de Tickets (Mock) -> Formulario de Rescate.
- **Tab 3: Cash Flow (Mock)**:
  - Nueva pestaña para visualizar cupones, capitalizaciones y eventos.
  - Tabla de rastro financiero simulada.
- **Tab 4: Envío de Formatos (Mock)**:
  - Mock de comunicación masiva.
  - Grid de destinatarios filtrable por evento.
- **Tab Configuración**: Eliminada (Movida a `19_CRM_Fondos.py`).
- **Refinamientos UI**:
  - Tab 2: Flujo optimizado (Buscador Libre DNI/Apellido -> Resultados -> Acción).
  - Tab 3: Filtros agregados para Fondo y Moneda.

**Archivos:**
- `modules/18_CRM_Inversiones.py`: +150 líneas de código UI.
- `CRM-INANDES/DESIGN_NOTES_V3.md`: Requerimientos de UI.
- `docs/LOGICA_V3_TICKET_ATOMICO.md`: Lógica de negocio (Backend Future).


---

## 2026-01-22 - Implementación crm_fondos V3 con Vigencia Anual

**Objetivo:** Rediseñar tabla `crm_fondos` para soportar tasas diferenciadas por plazo (12, 24, 36, 60 meses) con vigencia anual.

### Requerimientos (Audio Transcrito)
- Tasas varían según plazo de inversión del cliente
- Tasas cambian cada año (válidas del 1/1 al 31/12)
- Necesidad de 4 campos de tasas + reglas de rescate

### Decisión de Diseño
- **Consolidar** `crm_fondos` y `crm_tasas_fondos` en una sola tabla
- Usar `vigencia_anio` (INTEGER) en lugar de `fecha_inicio`/`fecha_fin`
- Crear nuevas filas cada año para el mismo fondo

### Implementación

**1. Schema de BD:**
- [x] DROP de `crm_tasas_fondos` y `crm_fondos`
- [x] CREATE de `crm_fondos` con 17 campos consolidados:
  - Básicos: `nombre`, `moneda`, `origen_dato`, `vigencia_anio`
  - Tasas: `tasa_12_meses`, `tasa_24_meses`, `tasa_36_meses`, `tasa_60_meses`
  - Reglas de rescate: `plazo_opcion_venta`, `plazo_opcion_devolucion`, `penalidad_rescate`, `plazo_minimo_permanencia`
  - Otros: `descripcion`, `activo`, `created_at`, `updated_at`
- [x] Constraint único: `(nombre, moneda, vigencia_anio)`
- [x] Índices optimizados (vigencia, moneda, activo, nombre+moneda)

**2. Scripts Creados:**
- `CRM-INANDES/sql/03_recreate_crm_fondos_v3.sql` - DROP + CREATE completo
- `CRM-INANDES/verify_crm_fondos_v3.py` - Verificación de estructura
- `CRM-INANDES/insert_fondos_ejemplo.py` - Datos de ejemplo

**3. Módulo UI:**
- [x] Reescrito `modules/19_CRM_Fondos.py` completamente
- [x] Eliminadas funciones obsoletas (get_tasas_db, upsert_tasa_db, delete_tasa_db)
- [x] Simplificada estructura: 2 tabs (Datos Generales + Tasas y Reglas)
- [x] Agregado selector de año de vigencia
- [x] Configuración directa (no historial de periodos)
- [x] Filtro por año con badge visual (🟢 = año actual)

**4. Verificación:**
```
✅ 17 campos verificados
✅ Constraint único funcionando
📊 4 fondos de ejemplo insertados (2025 y 2026)
📅 2 años con configuraciones
```

**5. Deployment:**
- Commit: `feat: Implementación crm_fondos V3 con vigencia anual`
- Merge: `main` (fast-forward)
- Push: `railway/main` (593b3e6..2a53444)

### Archivos Modificados
- `CRM-INANDES/sql/03_recreate_crm_fondos_v3.sql` (nuevo)
- `CRM-INANDES/verify_crm_fondos_v3.py` (nuevo)
- `CRM-INANDES/insert_fondos_ejemplo.py` (nuevo)
- `modules/19_CRM_Fondos.py` (reescritura completa)
- `CRM-INANDES/audio_transcrip/transcribe_audio.py` (fix modelo gemini-2.5-flash)
- `CRM-INANDES/DESIGN_NOTES_V3.md` (merge resuelto)

### Próximos Pasos
- [ ] Actualizar `18_CRM_Inversiones.py` (función `get_tasa_por_plazo()`)
- [ ] Pruebas manuales de UI
- [ ] Continuar con data mapping de eventos financieros


---

## 2026-01-28 - Implementación: Gestión de Inversionistas (crm_inversionistas)

**Objetivo:** Reemplazar módulo de Partícipes (P1-P4) con Gestión de Inversionistas individuales.

### Trabajo Realizado

#### 1. Base de Datos
- [x] Creada tabla `crm_inversionistas` con 40+ campos
- [x] 7 índices para búsqueda rápida
- [x] Triggers: `update_nombre_completo()`, `update_updated_at_column()`
- [x] Constraints de validación (tipo_doc, estado, longitud)

#### 2. Migración de Datos
- [x] Script `migrate_excel_to_inversionistas.py` creado
- [x] **206 inversionistas migrados** (tasa de éxito 100%)
- [x] 2 duplicados detectados y eliminados
- [x] Transformación P1-P4  registros individuales

#### 3. UI y Código
- [x] Módulo `pages/07_Gestion_Inversionistas.py` creado
- [x] Búsqueda avanzada (nombre, DNI, DNI cónyuge)
- [x] Formularios con 4 tabs (Personal, Cónyuge, Laboral, Compliance)
- [x] Exportación Excel implementada
- [x] Código legacy movido a `decommissioned_modules/07_Gestion_Participes_OLD.py`
- [x] README creado en `decommissioned_modules/`

### Bug Crítico Encontrado y Solucionado

**Problema:** El módulo no aparecía en Railway después del deploy.

**Causa Raíz:** El archivo `pages/07_Gestion_Inversionistas.py` contenía `st.set_page_config()`

**Por qué fallaba:**
- En Streamlit multipage apps, **SOLO** el archivo principal (`Home.py`) puede tener `st.set_page_config()`
- Los archivos en `pages/` **NO DEBEN** tener `st.set_page_config()`
- Si lo tienen, Streamlit los **ignora silenciosamente** (no aparecen en el menú)
- No genera error, simplemente el módulo no se muestra

**Solución:**
- Eliminadas líneas 20-25 con `st.set_page_config()`
- Commit: `93b7902` - "fix: Eliminar st.set_page_config()"
- Módulo ahora visible en Railway

### Lección Aprendida: WORKING WITH RICH

> **REGLA CRÍTICA PARA STREAMLIT MULTIPAGE:**
> 
> -  `Home.py` (archivo principal): **SÍ** puede tener `st.set_page_config()`
> -  `pages/*.py` (módulos): **NO** deben tener `st.set_page_config()`
> -  Si un archivo en `pages/` tiene `st.set_page_config()`, Streamlit lo ignora silenciosamente
> -  Síntoma: El módulo no aparece en el menú lateral de Railway/Streamlit
> -  Solución: Eliminar `st.set_page_config()` del archivo en `pages/`

### Archivos Creados/Modificados
- `sql/04_create_crm_inversionistas.sql` - Script de creación de tabla
- `migrate_excel_to_inversionistas.py` - Script de migración
- `verify_crm_inversionistas.py` - Script de verificación
- `temp_pdf_generator.py` - Generador PDF (recuperado de commit 96a3b9c)
- `pages/07_Gestion_Inversionistas.py` - Módulo UI principal
- `decommissioned_modules/07_Gestion_Participes_OLD.py` - Código legacy preservado
- `decommissioned_modules/README.md` - Documentación de código preservado
- `Home.py` - Actualizado con descripción del nuevo módulo

### Commits
1. `55b320a` - feat: Implementar Gestión de Inversionistas (inicial)
2. `141d4c3` - feat: Reemplazar Gestión de Partícipes con Gestión de Inversionistas
3. `93b7902` - fix: Eliminar st.set_page_config() de 07_Gestion_Inversionistas.py

### Próximos Pasos
- [ ] Implementar exportación PDF (código en `temp_pdf_generator.py`)
- [ ] Testing completo en Railway
- [ ] Validar con usuario final

## 2026-01-29 - Access Control & Export features

### Access Control
- **Objective**: Grant access to `jparra@inandes.com` for CRM modules.
- **Changes**:
    - Updated hardcoded allowed list in `modules/18_CRM_Inversiones.py` and `pages/18_CRM_Inversiones.py`.
    - Updated hardcoded allowed list in `modules/19_CRM_Fondos.py` and `pages/19_CRM_Fondos.py`.
    - Added 'jparra' to the `allowed_substrings` list.

### Download Features
- **Objective**: Add download capabilities (PDF/Excel) to specific modules.
- **Changes**:
    - **CRM Logic DB V3 (`modules/24_CRM_Logic_DB_V3.py`)**:
        - Added button to download the Graphviz diagram as PDF.
        - Used `graphviz.Source.pipe(format='pdf')`.
    - **CRM Fondos (`modules/19_CRM_Fondos.py`)**:
        - Added "📥 Excel" button (using `pandas` + `xlsxwriter`).
        - Added "📄 PDF" button (using `reportlab` to generate a table report).

### Commits
- `feat: Grant CRM access to jparra & Add PDF/Excel downloads`

### Bug Fix: Missing Bank & Advisor Columns
- **Issue**: `crm_inversionistas` table was missing bank account columns (`banco_nombre_1`, etc.) and advisor columns (`asesor_nombre`, `asesor_email`), causing save and upload errors.
- **Fix**:
    - Created `sql/06_add_bank_accounts_to_inversionistas.sql` to add bank columns.
    - Created `sql/07_add_advisor_columns.sql` to add advisor columns.
    - Created `upload_inversionistas_excel.py` to handle Excel upload with column mapping (legacy `_P1` format -> new DB schema).
    - Updated `pages/07_Gestion_Inversionistas.py` to add "Asesor" tab and fields.
- **Status**: Verified. Data upload successful and UI updated.

## 2026-01-29 - Critical Directory Cleanup & Standards

### 🚨 CRITICAL RULE: WORKING DIRECTORY
> **ALL CODE CHANGES MUST BE DONE IN `modules/`**
> The directory `CRM-INANDES/pages` is DEPRECATED and was causing confusion.
> Active modules are located in `c:\Users\rguti\mini_erp_v2_antigravity\modules\`.
> `Home.py` loads modules from this directory.

### Directory Cleanup
- **Issue**: Parallel existence of `CRM-INANDES/pages` and `modules/` caused agents to edit the wrong files (inactive copies).
- **Action**:
    - 🗑️ **Deleted** `CRM-INANDES/pages` to prevent future errors.
    - 📦 **Restored & Archived** legacy content to `CRM-INANDES/decommissioned_pages/` to preserve history.
- **Result**: Project structure is now cleaner. `modules/` is the single source of truth for CRM pages.

### Data Cleaning (DNI & Bank Accounts)
- **Issue**: Excel upload introduced format errors (DNIs with `.0` suffix, Bank Accounts with spaces).
- **Fixes**:
    - Created `modules/fix_dni_data.py`: Strips `.0` from DNI and removes duplicates.
    - Created `modules/fix_bank_spaces.py`: Removes spaces from Account Number and CCI.
    - Updated `upload_inversionistas_excel.py`: Auto-cleans data on upload to prevent recurrence.
- **Status**: Database fully cleaned.

---

---

## 2026-02-25 - Módulo 40: Reporte Maestro de Cuotas v15 (Transpuesto)

### Objetivos
- Reorganización de la infraestructura de scripts de reportes.
- Corrección de la lógica de comisiones (v15).
- Transposición del reporte para alineamiento con formato v13.

### Implementación
- [x] Carpeta scripts_cuotas/: Centralización de motores de reporte.
- [x] Lógica de Comisiones (v15): Cálculo diario de Administración (1.0%), Captación (2.0%) y Misceláneos (0.5%) sobre el AUM diario (Capital Total Activo) usando base 360.
- [x] Transposición: Certificados en filas y fechas en columnas.
- [x] Paginación: Bloques de 15 días en A2 Landscape.
- [x] Versionado: Script generate_cuotas_v15.py genera PDF reporte_maestro_cuotas_v4_transpuesto_v15.pdf.

### Archivos
- scripts_cuotas/generate_cuotas_v15.py
- scripts_cuotas/templates/reporte_cuotas_v15.html
- reports/reporte_maestro_cuotas_v4_transpuesto_v15.pdf

### Estado Actual
- ✅ Reporte v15 generado y validado con las 3 comisiones acumuladas correctamente.

