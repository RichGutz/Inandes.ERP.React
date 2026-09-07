# Bitácora Forense: Depuración de Rescate Erróneo (NSGUSD02-042.20250130)

> **Fecha:** 06 de Septiembre de 2026  
> **Contrato:** `NSGUSD02-042.20250130`  
> **Titulares:** León Vigo Nancy Edelmira / Gutierrez Leon Richard Eduardo  
> **Fondo:** NSGUSD02 | **Monto Original:** $50,000.00 USD | **Tasa:** 8.00% anual  

---

## 1. Diagnóstico del Registro

El 03 de septiembre de 2026 a las 18:08:31 UTC (13:08:31 hora Lima), se ingresó erróneamente un rescate anticipado de capital de **$3,000.00 USD** distribuido en 3 armadas en la tabla `crm_cronograma_deducciones_rescates`:

| ID Cuota | Tipo Cargo | Monto | Fecha Corte Cobro | Tasa Waiver | Estado | `id_evento_ledger` |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `RES-NSGUSD02-042.20250130.260903.260228-C.1/3` | `RESCATE_CAPITAL` | $ 1,000.00 USD | `2026-02-28` | 7.00% | `PENDIENTE` | `null` |
| `RES-NSGUSD02-042.20250130.260903.260430-C.2/3` | `RESCATE_CAPITAL` | $ 1,000.00 USD | `2026-04-30` | 7.00% | `PENDIENTE` | `null` |
| `RES-NSGUSD02-042.20250130.260903.260630-C.3/3` | `RESCATE_CAPITAL` | $ 1,000.00 USD | `2026-06-30` | 7.00% | `PENDIENTE` | `null` |

---

## 2. Impacto Contable y en el Ledger

* **Cierres Pasados (2025-12-31, 2026-02-28, 2026-04-30):**
  * Los cierres oficiales ejecutados el 24 y 25 de agosto mantuvieron `monto_rescate = 0` y capital base íntegro de **$50,000.00 USD**.
  * Ninguno de los 3 registros llegó a vincularse a un asiento contable (`id_evento_ledger = null`).
* **Cierres Futuros (2026-06-30 en adelante):**
  * Si no se eliminaban, el motor habría reducido el capital a **$47,000.00 USD** y recalculado intereses futuros con base menor y tasa waiver del 7%.

---

## 3. Acciones Ejecutadas

1. **Eliminación Física en Base de Datos:**
   * Se ejecutó el borrado de las 3 filas asociadas al agrupador `RES-NSGUSD02-042.20250130.260903` en la tabla `crm_cronograma_deducciones_rescates` del proyecto oficial Supabase (`egvcinsbyropumybatdf`).
2. **Verificación de Integridad:**
   * Registros restantes de rescate para `NSGUSD02-042`: **0**.
   * Capital base activo en el ledger: **$50,000.00 USD** (100% íntegro).
   * Estado del contrato: **`emitido`** (Vigente hasta 2028-02-28).

---

## 4. Estado Final

| Componente | Estado Pre-Depuración | Estado Post-Depuración |
| :--- | :--- | :--- |
| `crm_cronograma_deducciones_rescates` | 3 cuotas pendientes ($3,000 USD) | **0 cuotas (Limpio)** |
| Capital Base del Contrato | $50,000.00 USD (con provisión de -$3,000) | **$50,000.00 USD (Íntegro)** |
| Provisión de Tesorería | $3,000.00 USD fantasma | **$0.00 USD** |
| Cierres Históricos y Futuros | Protegidos | **Normalizados 100%** |
