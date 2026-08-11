# 📄 Especificación y Plan: EQUIPARACIÓN DE FONDOS & TASAS (VARIABLES DE FONDO)

> **Nota Hija de [00.A — Módulo de Inversionistas](file:///C:/Users/rguti/Inandes.ERP.React/Obsidian/Inandes.Inversionistas.React/00.A.INVERSIONISTAS.md)**  
> **Fecha:** 11 de Agosto de 2026  
> **Safe Point Relacionado:** `UI.INVERSIONISTAS.OK` (Commit `be459a5`)

---

## 1. 🎯 Objetivo del Requerimiento

Equiparar al **100%** las funcionalidades del submódulo **Variables de Fondo (Fondos & Tasas)** de React con el sistema Legacy (`19_CRM_Fondos.py`), resolviendo las omisiones detectadas y elevando la calidad visual del catálogo de fondos.

---

## 🔍 2. Auditoría Integral y Diagnóstico (Legacy vs. React)

Tras auditar el código fuente legacy (`modules/19_CRM_Fondos.py`) y el esquema de la tabla `crm_fondos` en Supabase (25 columnas), se determinaron 5 áreas clave de equiparación:

| # | Característica / Funcionalidad | Legacy (`19_CRM_Fondos.py`) | React Actual (`FondosPage.tsx`) | Diagnóstico & Acción |
| :-: | :--- | :--- | :--- | :--- |
| **1** | **Creación de Nuevo Fondo** | `➕ Nuevo Fondo` (Formulario maestro con auto-generación de plazos `12`, `24`, `36` y `ND`) | ❌ Ausente | **Falta implementar**: Modal/Vista `➕ Nuevo Fondo` con autogeneración de plazos |
| **2** | **Reporte e Impresión PDF Oficial** | `📄 Exportar PDF` (`generate_fondos_pdf` con matriz de tasas 12/24/36/ND) | ❌ Ausente | **Falta implementar**: `handleExportMaestroPdf` en formato Bello Bello |
| **3** | **Filtros de Búsqueda y Moneda** | Filtro por Moneda (`Todas`, `PEN`, `USD`) y Vigencia de Tasa | ❌ Ausente | **Falta implementar**: Búsqueda rápida por nombre/código/RUC y filtro select por Moneda |
| **4** | **Ficha de Edición por Plazo Individual** | 9 variables por variante (`tasa`, `tasa_activa`, `penalidad_rescate`, `plazo_rescate_meses`, `plazo_opcion_de_rescate_dias`, `valor_cuota_inicial`, 3 comisiones asesor) | Parcial | **A equiparar**: Formulario modal/tarjeta completo para cada plazo |
| **5** | **Datos Maestros del Fondo Padre** | 11 variables globales (`nombre_fondo`, `moneda`, `ruc_fondo`, `tamanho_maximo_fondo`, `fecha_cierre_fondo`, `frecuencia_cupones_meses`, `comision_administracion_fondo`, `comision_captacion_fondo`, `comision_miscelaneos_fondo`, `monto_minimo_inversion`, `vigencia_tasa`, `activo`) | Parcial | **A equiparar**: Formulario maestro completo con comisión de misceláneos y 4 decimales |

---

## 🛠️ 3. Plan de Acción Técnico (Pasos a Ejecutar)

1. **Añadir Botón y Modal `➕ Nuevo Fondo`:**
   - Formulario para crear un nuevo fondo con código (`id_fondo`), nombre, moneda, RUC, tamaño máximo y comisiones globales.
   - Creación automática en lote de sus variantes estándar de plazos (`12`, `24`, `36`, `ND`).

2. **Implementar Exportación PDF Oficial (`handleExportMaestroPdf`):**
   - Función que genera e imprime en PDF el directorio completo de fondos con sus datos corporativos y resumen de tasas por plazo.

3. **Agregar Barra de Filtros en el Directorio:**
   - Input de búsqueda por nombre/código/RUC y filtro select por Moneda (`TODAS`, `PEN`, `USD`).

4. **Completar Todos los Campos de Edición por Plazo:**
   - Asegurar que la vista `edit_plazo` permita editar todas las tasas (`tasa`, `tasa_activa`), penalidades (`penalidad_rescate`), plazos de rescate, valor cuota inicial y comisiones de asesores.

5. **Pruebas, Compilación y Despliegue (Regla 11):**
   - `npm run build`
   - `python deploy_vps.py`
   - `git add .` -> `git commit -m "..."` -> `git push origin main`
