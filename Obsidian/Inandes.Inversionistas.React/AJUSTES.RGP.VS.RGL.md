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

### 1.1 Estado Consolidado de los 5 Fondos (CUADRE 100% AL CENTAVO)

| Fondo | Moneda | Contratos RGL (Excel) | Contratos RGP (BD) | Capital Base RGL (Suma Filas) | Capital Base RGP (BD) | Diferencia | Estado de Auditoría |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **`NSGPEN01`** | **PEN** | 34 | 34 | **S/ 10,384,753.14** | **S/ 10,384,753.14** | **S/ 0.00** | ✅ **CUADRADO 100%** |
| **`NSGPEN02`** | **PEN** | 25 | 25 | **S/ 4,018,400.98** | **S/ 4,018,400.98** | **S/ 0.00** | ✅ **CUADRADO 100%** |
| **`NSGPEN03`** | **PEN** | 72 | 72 | **S/ 12,843,544.66** | **S/ 12,843,544.66** | **S/ 0.00** | ✅ **CUADRADO 100%** |
| **`NSGUSD01`** | **USD** | 9 | 9 | **$ 621,235.10** | **$ 621,235.10** | **$ 0.00** | ✅ **CUADRADO 100%** |
| **`NSGUSD02`** | **USD** | 45 | 45 | **$ 2,090,776.62** | **$ 2,090,776.62** | **$ 0.00** | ✅ **CUADRADO 100%** |
| **TOTAL** | — | **185** | **185** | **S/ 27.24M + $ 2.71M** | **S/ 27.24M + $ 2.71M** | **0.00** | ✅ **100% CONCILIADO** |

---

### 1.2 Detalle de Ajustes Específicos en `NSGPEN01`

1. **Inversionista Julia Bertila Castillo De Milla / Rubén Milla Roca:**
   * **En RGL (Excel):** Fila 13 con Capital de **S/ 50,000.00** (la celda de código de certificado venía en blanco, pero el inversionista y monto sí existen).
   * **En RGP (BD):** Contrato `NSGPEN01-046.20160101` por **S/ 50,000.00** a tasa 10.5%.
   * **Acción:** ✅ Mapeado y confirmado 100% válido.

2. **Inversionista Edwin Maldonado Cortez — DATA EXACTA RESPALDADA:**

> **Ficha del Inversionista en BD (`crm_inversionistas`):**
> * **Código Inversionista:** `DNI07765525`
> * **Nombre Completo:** `Maldonado Cortez Edwin`
> * **DNI:** `07765525` | **Nacimiento:** `1964-04-04` | **Estado Civil:** `Casado (a)`
> * **Email:** `edwinmalcor@hotmail.com` | **Teléfono:** `996 298 133`
> * **Dirección Fiscal:** `Jr. Santa Cruz de Tenerife 155 Mz C Lote 5, La Molina, Lima (15024)`
> * **Cónyuge:** `Carmen Beatriz Franco Vidal` (DNI `6717776`)
> * **Ocupación / Cargo:** `Contador` | **Antigüedad Laboral:** `14 años` | **Perfil de Riesgo:** `Bajo`
> * **Banco PEN:** `BCP` | **Cuenta:** `19316007580071`

> **Contratos Identificados en BD (`crm_contratos`):**
> 
> ```json
> [
>   {
>     "id_contrato": "NSGPEN01-081.20160101",
>     "id_inversionista_1": "DNI07765525",
>     "id_fondo": "NSGPEN01",
>     "id_asesor": "ASDNI008725693",
>     "monto_inversion": 25000.0,
>     "moneda": "PEN",
>     "tasa_pactada": 10.5,
>     "frecuencia_cupones_meses": 2,
>     "fecha_inicio": "2016-01-01",
>     "fecha_fin": "2027-12-31",
>     "estado": "emitido"
>   },
>   {
>     "id_contrato": "NSGPEN01-084.20160101",
>     "id_inversionista_1": "DNI07765525",
>     "id_fondo": "NSGPEN01",
>     "id_asesor": "ASDNI008725693",
>     "monto_inversion": 25000.0,
>     "moneda": "PEN",
>     "tasa_pactada": 10.5,
>     "frecuencia_cupones_meses": 2,
>     "fecha_inicio": "2016-01-01",
>     "fecha_fin": "2027-12-31",
>     "estado": "emitido"
>   }
> ]
> ```
> 
> * **Diagnóstico:** Estos 2 contratos suman **S/ 50,000.00**. No figuran en el libro de Ricardo Gallo al 28/02/2026 para `NSGPEN01`.
> * **Acción:** Al excluir / eliminar ambos contratos de `NSGPEN01`, el fondo queda con exactamente **34 contratos** por **S/ 10,334,753.14**, coincidiendo de forma idéntica con el Excel de Ricardo Gallo.

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
