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

## 📋 Estado de Módulos

| Módulo Streamlit | Tab React | Estado |
|-----------------|-----------|--------|
| `01_Registro.py` | Registro | ✅ Implementado |
| `02_Originacion.py` | Originación | 🟠 QC en progreso |
| `03_Aprobacion.py` | Aprobaciones | 🔴 Placeholder |
| `04_Desembolso.py` | Desembolsos | 🔴 Placeholder |
| `05_Liquidacion.py` | Liquidaciones | 🔴 Placeholder |
| `07_Repositorio.py` | Repositorio | 🔴 Placeholder |

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

*Ver también: [[00_Indice_y_Arquitectura]] | [[00.A.REGISTRO]] | [[00.B. ORIGINACION]] | [[07. QC Loops - Streamlit vs React - Originacion]]*