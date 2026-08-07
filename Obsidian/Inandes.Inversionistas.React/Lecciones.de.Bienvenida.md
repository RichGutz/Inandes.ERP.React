# 🏛️ Bienvenido — Principios del Proyecto InAndes CRM Inversionistas

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

## 🏗️ Arquitectura del Módulo Inversionistas

```
USUARIO (Navegador)
  │
  ▼
React 19 Frontend (https://inandes.react.geeksoft.tech)
  │
  ├── Supabase JS SDK (Auth Google + DB 'egvcinsbyropumybatdf')
  │   ├── inversionistas
  │   ├── contratos_inversion
  │   ├── certificados_participacion
  │   └── asesores / fondos
  │
  └── FastAPI Backend (https://api-factoring.geeksoft.tech)
      └── Motores Python (V32 Retornos, V25 Cuotas, V2 Comisiones)
```

---

## 📋 Módulos del CRM Inversionistas

| Sub-Módulo | Archivo React | Estado |
|------------|---------------|--------|
| **00.A. Inversionistas** | `InversionistasPage.tsx` | ✅ Migrado 100% |
| **00.B. Asesores** | `AsesoresPage.tsx` | ✅ Migrado 100% |
| **00.C. Fondos** | `FondosPage.tsx` | ✅ Migrado 100% |
| **00.D. Inversiones** | `InversionesPage.tsx` | ✅ Migrado 100% |
| **00.E. Certificados** | `CertificadosPage.tsx` | ✅ Migrado 100% |
| **00.F. Deducciones** | `DeduccionesPage.tsx` | ✅ Migrado 100% |

---

## 🔒 Reglas Intangibles de UI

### Selector de Letras A-Z (Módulo Aprobaciones):
- **Archivo:** `AprobacionesTab.tsx`
- **Regla Intangible:** Se debe mostrar **SIEMPRE TODO EL ABECEDARIO** (`TODOS`, `A` - `Z`, `#`).
- **Formato Visual:** Burbujas cuadradas redondeadas con contadores redondeados en la esquina superior derecha (`-top-1.5 -right-1.5`).
- **Filtro y Conteo Exclusivo:** El conteo y el filtrado por letra se realizan **ÚNICAMENTE sobre la inicial del EMISOR (Cedente)** (`op.emisor_nombre`). Queda prohibido evaluar al Aceptante/Pagador.
- **Instrucción para la IA:** Ningún agente o subagente de IA tiene permitido alterar esta estructura o reimplementar este componente sin autorización explícita del usuario.

---

## 🛡️ Soluciones Definitivas y Reglas Intangibles del Backend

### 1. Blindaje Total de Logos en PDFs (Base64)
* **Regla Inquebrantable:** Queda estrictamente prohibido usar rutas relativas a disco (`static/...`) o URLs externas.
* **El Único Camino Oficial:** Los logotipos oficiales están codificados en cadenas **Base64** dentro de `pdf_generators.py` y se inyectan en memoria a `template_data` para consumo de las plantillas Jinja2 (`{{ logo_geeksoft }}`, `{{ logo_inandes }}`).

### 2. Arquitectura de Despliegue en VPS
* **Frontend:** `/var/www/inandes/` (servido por Nginx).
* **Backend:** `/opt/erp_inandes/backend/` en puerto `8010` (`/opt/erp_inandes/venv/bin/uvicorn`).
* **Limpieza:** La carpeta obsoleta `/var/www/inandesh/` fue eliminada permanentemente.

### 3. Parseo Seguro de Datos (`safe_parse_json`)
* En FastAPI, siempre usar `safe_parse_json()` para deserializar columnas JSON de Supabase que pueden venir nulas (`None`), evitando excepciones `TypeError: the JSON object must be str, bytes or bytearray, not NoneType`.

---

*Última actualización: 2026-08-07 (Soluciones Definitivas Backend & Logos Base64)*


