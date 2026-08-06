# Indice y Arquitectura: Modulo Factoring (Legacy) a React

Esta boveda de Obsidian es la unica fuente de verdad para la migracion del modulo de Factoring desde Streamlit hacia la arquitectura moderna en React.

Metodologia: **Entender a fondo -> Documentar -> Aprobar -> Codificar.**

---

## Estado General de la Migracion

| Modulo Streamlit | Tab React | Estado | Nota |
|---|---|---|---|
| `01_Registro.py` | Registro | ✅ Implementado y desplegado | Ver [[04. Modulo Registro - Implementacion]] |
| `02_Originacion.py` | Originacion | ✅ Implementado y desplegado | Ver [[00.B.ORIGINACION]] |
| `03_Aprobacion.py` | Aprobaciones | ✅ Implementado y desplegado | Ver [[00.C.APROBACION]] (Git Tag: `UI.OK.HASTA.DESEMBOLSOS`) |
| `04_Desembolso.py` | Desembolsos | ✅ Implementado y desplegado | Ver [[00.D.DESEMBOLSOS]] (Git Tag: `UI.OK.HASTA.DESEMBOLSOS`) |
| `05_Liquidacion.py` | Liquidaciones | ✅ Implementado y desplegado | Ver [[00.E.LIQUIDACIONES]] (Git Tag: `UI.OK.HASTA.LIQUIDACIONES`) |
| `07_Repositorio.py` | Repositorio | 🔴 Placeholder | Pendiente |
| `06_Reporte.py` | Dashboard | 🔴 Placeholder | Pendiente |

---

## Mapa de Pilares

### Pilar 1. Entendimiento de la Base de Datos (Supabase)
**Estado:** ✅ Completado
Ver: [[01. Entendimiento de la Base de Datos]]

Hallazgos clave:
- Supabase Unificada en Producción: Proyecto `egvcinsbyropumybatdf` (Compartida 100% entre React y Streamlit)
- La tabla maestra de operaciones y propuestas es `public.propuestas`
- La tabla de contrapartes es `EMISORES.ACEPTANTES` (prod) en Supabase

### Pilar 2. Flujo Operativo y Backend (FastAPI + Legacy)
**Estado:** 🟢 Completado hasta Liquidaciones
- `01_Registro.py` → Replicado y conectado a FastAPI ✅
- `02_Originacion.py` → Replicado y conectado a FastAPI ✅
- `03_Aprobacion.py` → Replicado y conectado a FastAPI ✅
- `04_Desembolso.py` → Replicado y conectado a FastAPI ✅
- `05_Liquidacion.py` → Replicado y conectado a FastAPI + Motor Oráculo Oracle PDF ✅

### Pilar 3. Frontend y UI React
**Estado:** 🟢 En progreso continuo
Ver: [[03. Diseño del Frontend (React)]]
- `FactoringPage.tsx` con 7 tabs (5 operativos y validados: Registro, Originación, Aprobaciones, Desembolsos, Liquidaciones)
- Navegacion integrada en `MasterTemplate.tsx` como boton "Factoring"

---

## Infraestructura

| Item | Valor |
|---|---|
| URL React (VPS) | https://inandes.react.geeksoft.tech |
| URL Streamlit (VPS) | https://inandesh.geeksoft.tech |
| FastAPI Backend (VPS) | https://api-factoring.geeksoft.tech |
| Supabase Producción | `egvcinsbyropumybatdf` |

---

## Hitos Git Registrados

| Tag | Descripción |
|---|---|
| `UI.OK.HASTA.DESEMBOLSOS` | Módulos de Registro, Originación, Aprobaciones y Desembolsos validados y aprobados. |
| `UI.OK.HASTA.LIQUIDACIONES` | Módulo de Liquidaciones completo con visor PDF dual branding (Geeksoft + InAndes). |

---

*Última actualización de índice: 2026-08-05 21:25*
