# Documento de Mapeo de Datos: Migración de Inversiones CRM

## 1. Fuentes de Datos (Google Sheets Links)
Este esquema define la **Estructura Objetivo** basada en los Google Sheets vinculados.

| Nombre Fondo | Moneda | GID (Tab ID) | Link Ref. |
|:--- |:--- |:--- |:--- |
| **PEN01** | PEN | 45831439 | [Link](https://docs.google.com/spreadsheets/d/1D8tl6nmQlr8MnxbwSAPhQ0WvEhagusgtNds1sJeNJDY/edit?gid=45831439) |
| **PEN02** | PEN | 2008056577 | ... |
| **PEN03** | PEN | 371350526 | ... |
| **USD01** | USD | 896945954 | ... |
| **USD02** | USD | 994684684 | ... |
| **CON01** | USD? | 1315730129 | ... |

---

## 2. Definición de Columnas (Estándar GSheet)
Basado en la inspección de la **Fila 3** del GSheet `PEN01`.

| Col Index | Letra | Nombre Header (GSheet) | Campo CRM Destino (`crm_inversiones`) | Notas / Transformación |
|:---:|:---:|:--- |:--- |:--- |
| 2 | **C** | `FECHA_SUSCRIPCION` | **`fecha_inicio`** | Fecha real de depósito/suscripción. |
| 3 | **D** | `FECHA_TERMINO` | *Calculado* / Metadata | Se usará para calcular `plazo_dias` si es necesario. |
| 8 | **I** | `NO_DOC_P1` | **`participe_id`** | DNI usado para buscar el UUID del partícipe. |
| 18 | **S** | `NO_CERTIFICADO` | `codigo_operacion` | (Campo nuevo sugerido) Para trazabilidad. |
| 20 | **U** | `ASESOR` | `asesor_id` | (Opcional) Si existe en tabla de usuarios. |
| 24 | **Y** | `MONEDA` | **`moneda`** | Validar contra moneda del fondo. |
| 25 | **Z** | `MONTO INVERTIDO` | **`monto_invertido`** | Monto inicial del depósito. |
| 26 | **AA** | `VC` | *Valor Cuota* | Metadata histórica (no se migra a tabla simple). |

**⚠️ Faltantes Críticos en GSheet Header:**
- **TASA**: No existe columna explícita de "Tasa %". ¿Depende del Fondo o del VC?
- **ESTADO**: No hay columna de estado. Se asumirá 'ACTIVO' por defecto o basado en Fecha Término.

---

## 4. Estrategia de Migración (Definitiva: Google Sheets)
Se descarta el Excel histórico. La fuente de verdad son los Google Sheets vinculados.

**Mapeo de Columnas (Desde GSheet Row 4+):**

| Campo BD (`crm_inversiones`) | Columna GSheet | Header | Notas |
|:--- |:--- |:--- |:--- |
| **`fecha_inicio`** | **C** (Index 2) | `FECHA_SUSCRIPCION` | Formato DD-MMM-YY o Date Object. |
| **`monto_invertido`** | **AR** (Index 43) | `MONTO_INVERTIDO` | Validar numérico > 0. (Originalmente Z, corregido a AR). |
| **`participe_id`** | **I** (Index 8) | `NO_DOC_P1` | Lookup en `crm_participes`. |
| **`origen_dato`** | *Tab Name* | *N/A* | Se graba 'PEN01', 'USD02', etc. |
| `plazo_dias` | *Calculado* | `FECHA_TERMINO` (Col D) - `FECHA_SUSCRIPCION` | |
| `tasa_interes_aplicada` | *Default* | *No existe col Tasa* | Se usará la Tasa Base del Fondo (`crm_fondos`). |
| `estado` | *Calculado* | Si `FECHA_TERMINO` < Hoy -> 'LIQUIDADO' | |

**Lógica de Iteración:**
- Ignorar Filas 1-3 (Headers).
- Iterar hasta encontrar fila vacía o fin de datos.
- Validar DNI existente.

