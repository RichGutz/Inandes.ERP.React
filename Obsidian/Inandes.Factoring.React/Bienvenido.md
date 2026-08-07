# 🏛️ Bienvenido — Principios del Proyecto InAndes CRM & Factoring

> **DOCUMENTO DE REFERENCIA Y LECTURA OBLIGATORIA**

---

## 🎯 ¿Qué estamos haciendo?

Estamos reemplazando la interfaz heredada de **Streamlit** por un **Frontend React 19 + Vite** (`https://inandes.react.geeksoft.tech`), manteniendo intactos los motores de cálculo financiero en Python y la base de datos PostgreSQL en Supabase.

| Componente | Tecnología | Estado |
|------------|------------|--------|
| **Frontend** | React 19 + TypeScript + Tailwind CSS | ✅ Desplegado en VPS |
| **Backend API** | FastAPI (Python) | ✅ Desplegado en VPS (Puerto 8010/8502) |
| **Base de Datos** | Supabase (`egvcinsbyropumybatdf`) | ✅ Operativa |
| **Motores Financieros** | Motores Python V32, V25 y V2 | ✅ Intactos en `mini_erp_v2_antigravity` |

---

## 🚫 Regla de Oro — NO Reinventar la Rueda

> **Los motores financieros de Python YA FUNCIONAN. No se duplica su lógica en React.**

- **Motor de Retornos V32/V40:** Calcula intereses devengados, impuestos de 2da categoría y saldos.
- **Motor de Valor Cuota V25:** Gestiona el devengue diario del patrimonio y valor cuota de cada fondo.
- **Motor de Comisiones V2:** Proyecta y liquida los incentivos de la fuerza de ventas.

React consume los endpoints FastAPI o replica la interfaz de usuario con servicios TypeScript que consultan a Supabase.

---

## 🔒 Reglas Intangibles de UI

### Selector de Letras A-Z (Módulo Aprobaciones):
- **Archivo:** `AprobacionesTab.tsx`
- **Regla Intangible:** Se debe mostrar **SIEMPRE TODO EL ABECEDARIO** (`TODOS`, `A` - `Z`, `#`). PROHIBIDO ocultar o filtrar botones de letras sin facturas.
- **Formato Visual:** Burbujas cuadradas redondeadas (`w-10 h-10 rounded-xl font-black bg-indigo-600` para activas) con contadores redondeados en la esquina superior derecha (`-top-1.5 -right-1.5`).
- **Filtro y Conteo Exclusivo:** El conteo y el filtrado por letra se realizan **ÚNICAMENTE sobre la inicial del EMISOR (Cedente)** (`op.emisor_nombre`). Queda prohibido evaluar al Aceptante/Pagador.
- **Instrucción para la IA:** Ningún agente o subagente de IA tiene permitido alterar esta estructura o reimplementar este componente sin autorización explícita del usuario.

---

## 🛡️ Soluciones Únicas y Reglas Intangibles del Sistema

### 1. Solución Única para Logos en PDFs (100% Inmune a Borrados)
> **LECCIÓN APRENDIDA:** Queda **TERMINANTEMENTE PROHIBIDO** usar rutas relativas a disco (`static/...`), rutas de Linux (`file:///...`) o URLs externas (`https://...`).
* **El Único Camino Oficial:** Los logotipos oficiales (**Geeksoft**, **InAndes**, **EFI**, **Firma**) están codificados en cadenas **Base64** dentro de `pdf_generators.py` (`LOGO_INANDES_B64`, `LOGO_GEEKSOFT_B64`, etc.).
* En cada generación se inyectan en memoria a `template_data` y las plantillas Jinja2 los consumen vía `<img src="{{ logo_geeksoft }}">` y `<img src="{{ logo_inandes }}">`.
* **Cero dependencias de disco o red:** El PDF compila en memoria con 100% de éxito en cualquier servidor o carpeta.

---

### 2. Arquitectura Única del VPS (Cero Ambigüedades de Directorio)
* **Frontend Web (React):** `/var/www/inandes/` (servido por Nginx en `https://inandes.react.geeksoft.tech`).
* **Backend API (FastAPI):** `/opt/erp_inandes/backend/` en puerto `8010` (`/opt/erp_inandes/venv/bin/uvicorn`).
* **Carpetas Obsoletas:** `/var/www/inandesh/` fue eliminada permanentemente del VPS.

---

### 3. Solución Única a Errores de JSON y Pydantic en Backend
* **Pydantic Model Dump:** En FastAPI con Python 3.10, siempre usar `inv.dict()` en lugar de `dict(inv)`.
* **Protección `safe_parse_json`:** Cuando Supabase entrega campos nulos (`None`), nunca hacer `json.loads(d.get('campo', '{}'))` porque devuelve `None` y lanza `TypeError: the JSON object must be str, bytes or bytearray, not NoneType`. Siempre procesar con `safe_parse_json(val)`.
* **Protección Jinja2:** En todas las plantillas HTML numéricas, proteger variables con `or 0` y `| default(0)` para evitar `UndefinedError`.

---

### 4. Router Oficial de Desembolsos (`/api/desembolsos`)
* **`POST /api/desembolsos/generar-voucher`:** Genera el voucher bancario en PDF Base64.
* **`POST /api/desembolsos/registrar`:** Actualiza el estado en Supabase a `DESEMBOLSADA` y sincroniza las evidencias en Google Drive.

---

### 5. Acordeones y Ciclo de Vida en React (Aprobaciones y Desembolsos)
* **Cero Resets en Re-render:** Prohibido colocar `useEffect` que resetee `setExpandedCompanies(new Set())` en base a mapas computados (`companiesMap`).
* **Colapso por Defecto:** Inician 100% colapsados y se controlan exclusivamente mediante `toggleCompany` y `toggleLote` con updates funcionales (`prev => ...`).

---

*Última actualización: 2026-08-07 (Soluciones Definitivas Backend & Logos Base64)*


