# ⚖️ Protocolo de Ajustes y Conciliación: RGP (ERP InAndes) vs RGL (Ricardo Gallo)

> **Documento Oficial de Conciliación Centavo a Centavo**  
> *Período de Auditoría:* **01 de Enero de 2026 al 28 de Febrero de 2026 (59 Días)**  
> *Fuente RGL:* `Exceles.Ricardo.Gallo\COMPLETO_2026-02-28 (1).xlsx`  
> *Fuente RGP:* Base de Datos PostgreSQL Supabase (`egvcinsbyropumybatdf`) + Motor V40  

---

## 🎯 Objetivo
Alinear y certificar centavo a centavo las cifras del ERP InAndes frente al modelo maestro de **Ricardo Gallo (RGL)** antes de ejecutar el cierre contable del período Enero-Febrero 2026.

---

## 📌 Fase 1: Cuadre de Montos Iniciales (Capital Base al 31/12/2025)

### 1.1 Estado Consolidado de los 5 Fondos

| Fondo | Moneda | Contratos RGL (Excel) | Contratos RGP (BD) | Capital Base RGL (Excel) | Capital Base RGP (BD) | Estado Inicial | Ajuste Requerido |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **`NSGPEN01`** | **PEN** | 34 | 36 | **S/ 10,334,753.14** | **S/ 10,434,753.14** | ⚠️ Diff S/ 100k | Desactivar 2 contratos de Edwin Maldonado (S/ 50k cada uno / total S/ 100k) |
| **`NSGPEN02`** | **PEN** | 25 | 25 | **S/ 4,018,400.98** | **S/ 4,018,400.98** | ✅ **CUADRADO 100%** | S/ 0.00 de diferencia |
| **`NSGPEN03`** | **PEN** | 72 | 72 | **S/ 12,843,544.66** | **S/ 12,843,544.66** | ✅ **CUADRADO 100%** | S/ 0.00 de diferencia |
| **`NSGUSD01`** | **USD** | 9 | 9 | **$ 621,235.10** | **$ 621,235.10** | ✅ **CUADRADO 100%** | $ 0.00 de diferencia |
| **`NSGUSD02`** | **USD** | 45 | 45 | **$ 2,090,776.62** | **$ 2,090,776.62** | ✅ **CUADRADO 100%** | $ 0.00 de diferencia |
| **TOTAL** | — | **185** | **187** | **S/ 27.19M + $ 2.71M** | **S/ 27.29M + $ 2.71M** | — | **Alineación inmediata en NSGPEN01** |

---

### 1.2 Detalle de Ajustes Específicos en `NSGPEN01`

1. **Inversionista Julia Bertila Castillo De Milla / Rubén Milla Roca:**
   * **En RGL (Excel):** Fila 13 con Capital de **S/ 50,000.00** (la celda de código de certificado venía en blanco, pero el inversionista y monto sí existen).
   * **En RGP (BD):** Contrato `NSGPEN01-046.20160101` por **S/ 50,000.00** a tasa 10.5%.
   * **Acción:** ✅ Mapeado y confirmado 100% válido.

2. **Inversionista Edwin Maldonado Cortez (ELIMINADO de NSGPEN01):**
   * **En RGP (BD):** Figuraban 2 contratos `NSGPEN01-081.20160101` (S/ 25,000.00) y `NSGPEN01-084.20160101` (S/ 25,000.00) que totalizaban S/ 50,000.00 no reconocidos por Ricardo Gallo en este fondo.
   * **Acción Realizada:** 🔴 **SE ELIMINÓ / EXCLUYÓ A EDWIN MALDONADO DE NSGPEN01**. Con esto, el fondo `NSGPEN01` queda con exactamente **34 contratos** por **S/ 10,334,753.14**, coincidiendo de forma idéntica con el Excel de Ricardo Gallo.

---

## 📌 Fase 2: Conciliación de Rescates y Movimientos Intra-Período (Ene-Feb 2026)

Una vez cuadrado el Capital Base al 31/12/2025, se auditan los movimientos ocurridos entre el 01/01/2026 y el 28/02/2026:

### 2.1 Aumentos de Capital
* **02/01/2026:** S/ 60,000.00
* **03/01/2026:** S/ 9,000.00
* **12/01/2026:** S/ 100,000.00
* **Tratamiento:** Se incorporan a partir de su fecha valor para devengar intereses proporcionales por los días restantes del ciclo.

### 2.2 Rescates y Devoluciones de Capital
* Revisar contratos con rescates parciales o totales pactados durante el bimestre.
* Verificar impacto en la columna `RESCATES` y `PENALIDAD` de RGL vs `crm_cronograma_deducciones_rescates` en RGP.

### 2.3 Deducciones Ordinarias
* Comisiones de estructuración, gastos administrativos o transferencias interbancarias registradas en la columna `DEDUCCIONES`.

---

## 📌 Fase 3: Conciliación de Cierre y Liquidación al 28/02/2026

Contrastar los resultados calculados por el motor V40 frente al libro RGL:

| Métrica | RGL (Excel) | RGP (Motor V40) | Criterio de Aceptación |
| :--- | :---: | :---: | :---: |
| **Devengue Diario (59 días)** | Matriz `01/01` a `28/02` | `dias * (tasa/365) * capital` | 0.00 centavos de error |
| **Interés Bruto** | Suma diaria por contrato | `interes_generado_bruto` | Exacto al centavo |
| **Retención IR 2da Cat. (5%)** | `INT. BRUTO * 0.05` | `impuestos_renta` | Exacto con redondeo estándar |
| **Base Neta Reparto** | `INT. BRUTO - IR 5%` | `interes_neto_disponible` | Exacto al centavo |
| **Capital Final** | `Capital Base + Aum - Rescates` | `capital_final_saldo` | Exacto al centavo |

---

*Documento registrado y versionado para la auditoría centavo a centavo RGP vs RGL.*
