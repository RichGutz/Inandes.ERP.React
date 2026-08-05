# 🏛️ Bienvenido — Principios del Proyecto Inandes.ERP.React

> **LEER ANTES DE TOCAR CUALQUIER CÓDIGO.**

---

## 🎯 ¿Qué estamos haciendo?

Estamos **reemplazando únicamente la interfaz de usuario (UI)** del sistema Inandes ERP.

| Antes | Ahora |
|-------|-------|
| UI en **Streamlit** (`https://inandesh.geeksoft.tech`) | UI en **React** (`https://inandes.react.geeksoft.tech`) |
| Backend Python en `mini_erp_v2_antigravity` | **El mismo backend. Intacto.** |
| FastAPI en `src/api/` | **El mismo FastAPI. Expuesto en `https://api-factoring.geeksoft.tech`** |

---

## 🚫 Regla de Oro — NO Reinventar la Rueda

> **El backend de Streamlit YA FUNCIONA. No se rehace.**

- El parseo de PDFs → ya existe en `pdf_parser.py` → expuesto vía `/api/originacion/parse-invoices`
- Los cálculos financieros → ya existen en `factoring_calculator.py` → expuestos vía `/calcular_desembolso_lote`
- La generación de PDFs → ya existe en `pdf_generators.py` → expuesta vía `/api/originacion/generate-pdfs`
- La subida a Google Drive → ya existe en `google_integration.py` → expuesta vía `/api/originacion/formalize`

**React solo consume estos endpoints. No duplica lógica Python.**

---

## 🏗️ Arquitectura

```
USUARIO
  │
  ▼
React (Browser)
https://inandes.react.geeksoft.tech
  │
  ├── Supabase (Auth + Datos)
  │   └── egvcinsbyropumybatdf
  │
  └── FastAPI (Lógica de negocio)
      https://api-factoring.geeksoft.tech
      └── /var/www/inandesh/src/api/
          ├── parse-invoices    ← pdfplumber
          ├── calcular_desembolso_lote ← factoring_calculator.py
          ├── generate-pdfs     ← pdf_generators.py
          └── formalize         ← google_integration.py
```

---

## 📋 Estado y Especificaciones Estrictas de Módulos (React vs FastAPI)

| Sub-Módulo | Componente React Oficial | Endpoint FastAPI Backend | Especificaciones Intangibles & Reglas |
|------------|-------------------------|--------------------------|---------------------------------------|
| **01. Registro** | `RegistroTab.tsx` | Supabase `EMISORES.ACEPTANTES` | ✅ Rolodex A-Z por inicial de Razón Social, Ordenamiento A-Z/Z-A, Exportación Excel/PDF. |
| **02. Originación** | `OriginacionTab.tsx` | `/api/originacion/parse-invoices`, `/calcular_desembolso_lote`, `/formalize` | ✅ Secciones 2.1 a 2.4 explícitas sin abreviaturas, Goal Seek con techo en tasa grabada y redondeo a múltiplos de S/ 10. |
| **03. Aprobaciones** | `AprobacionesTab.tsx` | `/api/originacion/operaciones`, `/api/aprobacion/aprobar` | 🔴 **PROHIBIDO USAR `AprobacionTab.tsx`**. Usar únicamente `AprobacionesTab.tsx`. **Selector Alfabético A-Z exclusivo por Emisor**, **Badges de Est. Cavali** (ACEPTADA/PENDIENTE) y **Est. Letra** (FIRMADA/PENDIENTE), **Master Checkbox "Seleccionar Todo"**, y **Checkbox de "Aprobación Forzada"** (ignorar Cavali/Letra). Sin columna redundante 'Operación'. |
| **04. Desembolsos** | `DesembolsosTab.tsx` | `/api/desembolsos/pendientes`, `/api/desembolsos/procesar` | ✅ Pickers de fecha individual por factura, Voucher PDF 1 página. |
| **05. Liquidaciones** | `LiquidacionesTab.tsx` | `/api/liquidacion/...` | 🟠 En migración |
| **07. Repositorio** | `RepositorioTab.tsx` | `/api/repositorio/...` | ✅ Integración Google Drive |

---

## 🔑 URLs y Credenciales Clave

| Recurso | URL / Valor |
|---------|-------------|
| React (prod) | `https://inandes.react.geeksoft.tech` |
| Streamlit (legacy) | `https://inandesh.geeksoft.tech` |
| FastAPI (backend) | `https://api-factoring.geeksoft.tech` |
| Swagger UI | `https://api-factoring.geeksoft.tech/docs` |
| Supabase React | `egvcinsbyropumybatdf` |
| Supabase Streamlit | `vinjzmqwaqsqzoigqpxk` |
| VPS IP | `91.108.125.253` |
| FastAPI en VPS | Puerto `8502`, PM2 nombre `inandes-api` |

---

## 💡 Hallazgos y Soluciones (Desarrollo)

### 1. Migración del Backend a Local / GitHub
El backend original corría acoplado a Streamlit en el VPS. Se extrajo la carpeta `/opt/erp_inandes/backend` y se subió al repositorio oficial de GitHub (`Inandes.ERP.React`).
- **Problema de variables de entorno**: El backend FastAPI requiere estrictamente un archivo `.env` en local (ignorado en git) con las variables `SUPABASE_URL` y `SUPABASE_KEY` (usando las credenciales de React: `egvcinsbyropumybatdf`). Si este archivo falta, cualquier consulta a base de datos tumba el servidor con un Error 500, causando un `Failed to fetch` genérico por CORS en React.

### 2. Optimización de Latencia en Originación (Parseo de PDFs)
- **Problema Inicial**: El parseo demoraba demasiado en local al enviar 2 facturas.
- **Diagnóstico**: Se hacían 3 consultas independientes a Supabase por cada PDF para traer razones sociales y condiciones financieras. En local, esto multiplicaba la latencia geográfica a EEUU.
- **Solución**: Se implementó la función `get_bulk_emisor_data` en `supabase_repository.py`. Ahora el endpoint `parse-invoices` recolecta todos los RUCs de las facturas parseadas y ejecuta **una sola consulta SQL agrupada (`IN (...)`)** trayendo todos los datos del caché de memoria inmediatamente.

### 3. Endpoints Faltantes en FastAPI
- **Problema**: El cálculo de desembolso no funcionaba en React (Error 404).
- **Diagnóstico**: La arquitectura legacy en Streamlit ejecutaba `procesar_lote_desembolso_inicial` en memoria (importación directa de Python). Al construir el frontend en React, se asume que iba a existir el endpoint `/calcular_desembolso_lote`, pero **nadie lo había creado** en FastAPI.
- **Solución**: Se expuso la lógica financiera a través de FastAPI creando el endpoint explícito en `backend/routers/originacion.py` y se actualizó la ruta en React para que apunte ordenadamente a `/api/originacion/calcular_desembolso_lote`.

### 4. Conexión a Google Drive en FastAPI (Falta de inyección de credenciales)
- **Problema**: Al intentar cargar el árbol de Google Drive para seleccionar la carpeta destino, React mostraba "(Sin subcarpetas)" y el backend devolvía Error 500.
- **Diagnóstico**: En el monolito de Streamlit, la autenticación de Google Drive asume un contexto global. En FastAPI, la función `list_folders_with_sa()` fue llamada sin inyectarle explícitamente el objeto `sa_creds` con las credenciales del Service Account, lo que causó que la librería fallara por argumentos faltantes.
- **Solución**: Se actualizó el endpoint `/api/originacion/drive/list` en `routers/originacion.py` para primero obtener las credenciales (`google_integration.get_sa_credentials_dict()`) y pasárselas correctamente a la función list_folders. El endpoint `/formalize` ya lo hacía correctamente, por lo que el guardado no se vió afectado.

---

*Ver también: [[00_Indice_y_Arquitectura]] | [[00.A.REGISTRO]] | [[00.B. ORIGINACION]] | [[07. QC Loops - Streamlit vs React - Originacion]]*