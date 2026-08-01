# Indice y Arquitectura: Modulo Factoring (Legacy) a React

Esta boveda de Obsidian es la unica fuente de verdad para la migracion del modulo de Factoring desde Streamlit hacia la arquitectura moderna en React.

Metodologia: **Entender a fondo -> Documentar -> Aprobar -> Codificar.**

---

## Estado General de la Migracion

| Modulo Streamlit | Tab React | Estado | Nota |
|---|---|---|---|
| `01_Registro.py` | Registro | ✅ Implementado y desplegado | Ver [[04. Modulo Registro - Implementacion]] |
| `02_Originacion.py` | Originacion | 🟠 QC en progreso | Ver [[07. QC Loops - Streamlit vs React - Originacion]] |
| `03_Aprobacion.py` | Aprobaciones | 🔴 Placeholder | Pendiente |
| `04_Desembolso.py` | Desembolsos | 🔴 Placeholder | Pendiente |
| `05_Liquidacion.py` | Liquidaciones | 🔴 Placeholder | Pendiente |
| `07_Repositorio.py` | Repositorio | 🔴 Placeholder | Pendiente |
| `06_Reporte.py` | Dashboard | 🔴 Placeholder | Pendiente |

---

## Mapa de Pilares

### Pilar 1. Entendimiento de la Base de Datos (Supabase)
**Estado:** ✅ Completado
Ver: [[01. Entendimiento de la Base de Datos]]

Hallazgos clave:
- Supabase de React: Proyecto `egvcinsbyropumybatdf` (distinto al de Streamlit `vinjzmqwaqsqzoigqpxk`)
- La tabla maestra de contrapartes es `EMISORES.ACEPTANTES` (prod) en ambas Supabase
- Existen 3 versiones de la tabla: BETA (schema completo), ACEPTANTES (prod simplificado), ORIGINAL (backup)
- La tabla de prod fue enriquecida: paso de 29 a 73 columnas adoptando los campos de BETA

### Pilar 2. Flujo Operativo y Backend (Streamlit Legacy)
**Estado:** 🟡 En proceso
- `01_Registro.py` → analizado y replicado en React ✅
- `02_Originacion.py` a `07_Repositorio.py` → pendientes de analisis fiel

### Pilar 3. Frontend y UI React
**Estado:** 🟡 En progreso
Ver: [[03. Diseño del Frontend (React)]]
- `FactoringPage.tsx` con 7 tabs implementados (1 operativo, 6 placeholder)
- Navegacion integrada en `MasterTemplate.tsx` como boton "Factoring"

---

## Infraestructura

| Item | Valor |
|---|---|
| URL React (VPS) | https://inandes.react.geeksoft.tech |
| URL Streamlit (VPS) | https://inandesh.geeksoft.tech |
| Supabase React | `egvcinsbyropumybatdf` |
| Supabase Streamlit | `vinjzmqwaqsqzoigqpxk` |
| Deploy React | `python deploy_vps.py` en raiz del proyecto |
| Deploy Streamlit Factoring | `python deploy_factoring_vps.py` en `mini_erp_v2_antigravity` |

---

## QC Loops Activos

| Nota | Módulo | Estado |
|------|--------|--------|
| [[07. QC Loops - Streamlit vs React - Originacion]] | Originación | 🟠 En progreso — 30 facturas de prueba |

---

## Proximos Pasos
1. Ejecutar QC Loop #001 con `E001-859.pdf` (Streamlit → React → comparar)
2. Conectar backend Python de parseo a Originación React
3. Continuar con `03_Aprobacion.py` en React
