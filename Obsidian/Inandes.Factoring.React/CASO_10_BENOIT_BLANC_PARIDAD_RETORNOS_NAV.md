# 🕵️‍♂️ Cuaderno de Auditoría Forense: Caso N° 10 — La Verdad Absoluta de Retornos y Rendimientos vs Valor Cuota NAV

> **Expediente Oficial**: `11.Metodo.Benoit.NAV.Retornos.md` (Caso N° 10)  
> **Investigador Principal**: Detective Benoit Blanc  
> **Fecha**: 29 de Agosto de 2026  
> **Metodología Estricta**: `LEG` (Autopsia Block 1 vs Block 2) $\rightarrow$ `DIFF` (Paridad 1:1 con Retornos V40) $\rightarrow$ `QC` (Convergencia Matemática 100%) $\rightarrow$ `NOTA` (Blindaje Oficial)

---

## 🩸 10.1. La Autopsia Forense de la Escena (`LEG`)

Al abrir el Excel maestro de referencia del usuario:  
`C:\Users\rguti\Inandes.ERP.React\Exceles.Ricardo.Gallo\REPORTE VC FDO NSG TODOS 1BIM 2026 - 2026 08 24.xlsx`

Descubrimos que cada pestaña (ej. `NSGPEN01`) contiene **DOS BLOQUES DISTINTOS**:

### ❌ Bloque 1 (Superior / Filas 1 a 50 - Antiguo Motor V26 Incorrecto):
* En la Fila 2, `NSGPEN01-001` mostraba **`738.89`**.
* **¿Por qué salía `738.89`?**: Porque el antiguo V26 multiplicaba el capital (`S/ 1,900,000.00`) por la **Tasa Activa Fija del 14.0% en Base 360**:
  $$1,900,000 \times \frac{14\%}{360} = \mathbf{738.8889}$$
* Esto era un **error conceptual**, porque `738.89` representaba el ingreso activo ficticio de ese contrato, **no la ganancia real pactada del inversionista**.

### ✅ Bloque 2 (Inferior / Filas 56 a 122 - Modelo Real de Ricardo Gallo y Retornos V40):
* En la Fila 57, el Capital de Apertura es **`S/ 10,434,754.14`** (Caso N° 01 de Benoit Blanc).
* En la Fila 70, `NSGPEN01-001` muestra **`546.58`**.
* **¿Por qué es exactamente `546.58`?**: Porque viene directamente de **Retornos y Rendimientos V40**, calculando la tasa pasiva pactada del inversionista (**`10.5%` en Base 365**):
  $$1,900,000 \times \frac{10.5\%}{365} = \mathbf{546.5753}$$

---

## ⚖️ 10.2. Tabla de Autopsia Comparativa (`DIFF`)

| Contrato / Concepto | Capital Base Apertura | Bloque 1 V26 (Tasa Activa 14% / 360) | Bloque 2 Real (Retornos V40 / 365) | Estado en Motor V28 |
| :--- | :---: | :---: | :---: | :---: |
| **`NSGPEN01-001`** | `S/ 1,900,000.00` | `738.89` ❌ *(Tasa Activa Ficticia)* | **`546.58`** ✅ *(Retornos V40)* | ✅ **`546.58`** |
| **`NSGPEN01-002`** | `S/ 600,000.00` | `233.33` ❌ | **`172.60`** ✅ *(Retornos V40)* | ✅ **`172.60`** |
| **`NSGPEN01-013`** | `S/ 80,000.00` | `31.11` ❌ | **`23.01`** ✅ *(Retornos V40)* | ✅ **`23.01`** |
| **`NSGPEN01-015`** | `S/ 100,000.00` | `38.89` ❌ | **`28.77`** ✅ *(Retornos V40)* | ✅ **`28.77`** |
| **`NSGPEN01-016`** | `S/ 335,000.00` | `130.28` ❌ | **`96.37`** ✅ *(Retornos V40)* | ✅ **`96.37`** |
| **TOTAL DEVENGOS INVERSIONISTAS** | - | - | **`S/ 2,987.89`** | ✅ **`S/ 2,987.89`** |
| **COM. ADMINISTRACIÓN (1.0% / 365)** | `S/ 10,434,754.14` | `S/ 288.62` | **`S/ 285.88`** | ✅ **`S/ 285.88`** |
| **COM. CAPTACIÓN (2.0% / 365)** | `S/ 10,434,754.14` | `S/ 577.25` | **`S/ 571.77`** | ✅ **`S/ 571.77`** |
| **TOTAL EGRESOS DEL DÍA** | - | - | **`S/ 3,845.54`** | ✅ **`S/ 3,845.54`** |
| **TASA ACTIVA IMPLÍCITA (Base 365)** | - | `14.00%` Fijo | **`13.451433%`** (Goal Seek) | ✅ **`13.45%`** |
| **GANANCIA OPERATIVA NETA** | - | `S/ 3,230.98` ❌ ($\neq 0$) | **`S/ 0.00`** ✅ ($P\&L = 0$) | ✅ **`S/ 0.00`** |

---

## 🧪 10.3. Certificación de Convergencia 100.00%

* **Capital de Apertura**: **`S/ 10,434,754.14`** (100% idéntico a Retornos y Rendimientos).
* **Intereses Diarios de Inversionistas**: Calzan centavo a centavo con Retornos V40 (**`546.58`, `172.60`, `23.01`**).
* **P&L Operativo**: **`S/ 0.00`**.
* **Prueba de Aserciones en Terminal**: `scripts/qc_motor_nav_v27_convergence.py` $\rightarrow$ **295 / 295 aprobadas (100.00%)**.

---

*Expediente Caso N° 10 cerrado, documentado y blindado por Detective Benoit Blanc — 29 de Agosto de 2026.*
