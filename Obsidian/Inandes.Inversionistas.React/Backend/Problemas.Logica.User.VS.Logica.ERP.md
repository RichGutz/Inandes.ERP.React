# 🧩 Problemas de Lógica de Negocio: Usuario Pre-ERP vs. Lógica ERP

> **Documento Técnico y de Auditoría de Datos**  
> **Ubicación:** `Obsidian/Inandes.Inversionistas.React/Backend/Problemas.Logica.User.VS.Logica.ERP.md`  
> **Fecha:** 2026-08-23  

---

## 1. El Conflicto Conceptual: La Lógica del "Cajón de Sastre" (Pre-ERP)

En la operativa manual previa a la implementación del nuevo ERP, existía una práctica administrativa de **reciclaje de correlativos de contratos**:

1. **El "Cajón de Sastre":** Cuando un contrato finalizaba (por rescate total o vencimiento), su código correlativo se enviaba a un repositorio de números "disponibles".
2. **Reutilización Aleatoria:** Al ingresar una nueva colocación o contrato de un inversionista distinto, el operador o software heredado tomaba el primer número de contrato cerrado disponible en el fondo para reutilizarlo en la nueva operación.
3. **El Problema en el ERP:** En una base de datos relacional y un Ledger Contable moderno, **un identificador de contrato debe ser inmutable, único e históricamente trazable**. Reutilizar un correlativo genera colisiones conceptuales, confusión en reportes históricos y riesgo de mezclar saldos de distintos inversionistas en el mismo código base.

---

## 2. Caso de Estudio: Inversionista Temoche Silva Jorge Arturo

### Diagnóstico de la Colisión Detectada:
* **Contrato Histórico Preexistente (`050`):**  
  * Código: `NSGPEN03-050.20240219`  
  * Titular: **Perales Bazalar María Agueda** (`DNI09180253`)  
  * Monto: S/ 200,000.00 PEN (Plazo 24m)  
  * Estado: `cerrado_por_rescate` (Rescatado al 2026-02-28).
* **Nuevo Contrato Emitido por Reciclaje (`050`):**  
  * Código original: `NSGPEN03-050.20260813`  
  * Titulares: **Temoche Silva Jorge Arturo** (`DNI07546408`, 50%) y **Temoche Silva Luis Ricardo** (`DNI07543693`, 50%)  
  * Monto: S/ 112,000.00 PEN (Fondo NSGPEN03-60, 60 meses, Tasa 10%)  
  * Fecha de Inicio: 2026-08-13 | Fecha de Fin: 2031-08-31  

### Solución Solicitada en Fase ETL:
Reasignar el correlativo de la nueva inversión de Temoche Silva de **`050`** a **`052`** (`NSGPEN03-052.20260813`), garantizando que `NSGPEN03-050` quede exclusivamente como el registro histórico cerrado de la Sra. Perales Bazalar.

---

## 3. Caso de Estudio 2: Traspaso de Fondos y Eliminación Prematura de Contratos Cerrados (Edwin Maldonado)

### Diagnóstico de la Casuística:
* **Fondo Origen (`NSGPEN01`):**  
  El inversionista **Maldonado Cortez Edwin** (`DNI 07765525`) poseía dos contratos históricos:
  * `NSGPEN01-081.20160101` $\rightarrow$ S/ 25,000.00 PEN
  * `NSGPEN01-084.20160101` $\rightarrow$ S/ 25,000.00 PEN
  * Ambos contratos fueron liquidados mediante **Rescate Total** al **28 de Febrero de 2026** (Salidas registradas en los Eventos Ledger `792` y `794`).
* **Fondo Destino (`NSGPEN02`):**  
  Al día siguiente (**01 de Marzo de 2026**), el inversionista traspasó y reinvirtió el total de su capital (**S/ 50,000.00 PEN**) en el nuevo contrato:
  * `NSGPEN02-018.20260301` (Vigente en `crm_contratos`, Evento Ledger `3231`).

### La Lógica Pre-ERP vs. La Falla Relacional en el ERP:
1. **La Acción del Usuario Pre-ERP:** Al crear el nuevo contrato en `NSGPEN02`, el operador **eliminó manualmente las dos fichas de `crm_contratos`** (`NSGPEN01-081` y `084`), asumiendo que "como ya estaban extintas, no debían ocupar espacio en el padrón de contratos".
2. **El Síntoma en el ERP:** En la pantalla de deducciones/rescates, las cuotas históricas del 28 de Febrero seguían figurando en el cronograma, pero al hacer el lookup referencial en `crm_contratos`, arrojaba el error visual: **`Inversionista No Identificado`**.

### La Regla de Oro del ERP: *Los Contratos Cerrados NUNCA se Eliminan*
En una arquitectura contable relacional:
* Los contratos extintos **deben permanecer registrados en `crm_contratos`** con su estado formal: **`estado = 'cerrado_por_rescate'`** o **`estado = 'cerrado_fin_contrato'`**.
* Borrar una fila de contrato destruye la integridad referencial con los asientos contables históricos de `crm_certificados_eventos`.

---

## 4. Caso de Estudio 3: Reencarnación de Contrato del Mismo Inversionista (Edgardo Aguinaga Oliver)

### Diagnóstico de la Casuística:
* **Inversionistas Titulares:** 
  * Principal: **Aguinaga Oliver Edgardo** (`DNI04641802`)
  * Cotitulares (25% c/u): **Aguinaga Salcedo Rodrigo Edgardo** (`DNI70006502`), **Aguinaga Salcedo Kalina Del Carmen** (`DNI70006505`), **Aguinaga Salcedo Milka Patricia** (`DNI70006504`).
* **Contrato Histórico Inicial (`004`):**  
  * Código: `NSGPEN02-004.20230501`  
  * Monto: S/ 100,000.00 PEN (Fondo `NSGPEN02`, Plazo 36m, Tasa 9.5%)  
  * Vigencia: `2023-05-01` al `2026-04-30` (Vencimiento al 30 de abril de 2026).
* **Nuevo Contrato Emitido por Renovación (`020` erróneo):**  
  * Código generado originalmente: `NSGPEN02-020.20260501`  
  * Vigencia: `2026-05-01` al `2029-04-30` (Plazo: 36 meses, S/ 100,000.00 PEN, Tasa 9.5%).

### El Problema Detectado:
Al registrar la renovación que inicia inmediatamente tras el vencimiento (`2026-05-01`), el operador o flujo manual asignó un correlativo nuevo desvinculado (`020`) en lugar de mantener la reencarnación del contrato base del cliente (`004`), fragmentando la historia contable y la correlación del partícipe en el fondo `NSGPEN02`.

### Solución y Corrección Atómica Aplicada en Supabase:
1. **Reasignación en `crm_contratos`:** Se migró el registro `NSGPEN02-020.20260501` a **`NSGPEN02-004.20260501`**.
2. **Reasignación en `crm_certificados_eventos`:** El asiento contable de emisión (Evento `#10785`) se actualizó a `id_contrato = 'NSGPEN02-004.20260501'` e `id_certificado = 'NSGPEN02-004.20260501.20260501'`.
3. **Reasignación en `crm_certificados`:** Se migró el certificado `NSGPEN02-020.20260501.20260501` a `NSGPEN02-004.20260501.20260501`.
4. **Preservación Inmutable:** El contrato histórico primario `NSGPEN02-004.20230501` se mantiene intacto como la primera encarnación histórica del partícipe.

---

## 4. Caso de Estudio 4: Desfase de Fechas en Renovación con Reinversión Continua (Donny Guillén Lara - `NSGPEN03-035`)

* **Partícipe:** Guillén Lara Donny Edwin (`DNI42983181`)
* **Fondo:** `NSGPEN03` (FDO NSG MIPYME PEN 03)
* **Contrato Histórico Previo:**
  * Código: `NSGPEN03-035.20250701`
  * Vigencia: `2025-07-01` al `2026-06-30` (12 meses).
  * Liquidación al 30 de junio de 2026: Capital base S/ 140,770.17 + Interés neto S/ 1,899.72 = **S/ 142,669.89 PEN** (cerrado por rescate total para renovación/reinversión).
* **Nuevo Contrato Emitido por Renovación (`20260822` erróneo):**
  * Código generado originalmente: `NSGPEN03-035.20260822`
  * Vigencia registrada: `2026-08-22` al `2028-08-31` (Plazo: 24 meses, S/ 142,669.89 PEN, Tasa 9.0%).

### El Problema Detectado:
El usuario ingresó como fecha de inicio el día del registro administrativo en el sistema (`2026-08-22`), creando un desfase artificial de 52 días sin devengue en Julio y Agosto. En la realidad financiera, la reinversión y devengue son continuos a partir del día siguiente al vencimiento del contrato anterior (`2026-07-01`).

### Solución y Corrección Atómica Aplicada en Supabase:
1. **Reasignación en `crm_contratos`:**
   * Se migró `NSGPEN03-035.20260822` $\rightarrow$ **`NSGPEN03-035.20260701`**.
   * Se corrigió `fecha_inicio = '2026-07-01'` y `fecha_fin = '2028-06-30'` (24 meses exactos).
2. **Reasignación en `crm_certificados_eventos`:**
   * El asiento contable de emisión (Evento `#11366`) se actualizó con `id_contrato = 'NSGPEN03-035.20260701'`, `id_certificado = 'NSGPEN03-035.20260701.20260701'`, y `fecha_periodo_origen = fecha_periodo_fin = '2026-07-01'`.
3. **Reasignación en `crm_certificados`:**
   * Se migró el certificado a `NSGPEN03-035.20260701.20260701` con fecha de emisión `2026-07-01`.
4. **Limpieza Residual:**
   * Eliminado el registro residual con sufijo `20260822`. El histórico `NSGPEN03-035.20250701` se mantiene inalterado como primera encarnación histórica.

---

## 5. Caso de Estudio 5: Corrección de Fecha de Fin por Error de Digitación (Rodrigo Aravena Elías - `NSGPEN03-049`)

* **Partícipe:** Aravena Elías Rodrigo (`DNI46873804`)
* **Fondo:** `NSGPEN03` (FDO NSG MIPYME PEN 03)
* **Contrato:**
  * Código: `NSGPEN03-049.20230901`
  * Parámetros: S/ 96,270.76 PEN, Plazo: 36 meses, Tasa: 9.50% TEA, 100% Capitalización (0% Reparto), Cupones Bimestrales.
  * Fecha de Inicio: `2023-09-01`
  * Fecha de Fin Registrada Originalmente: `2026-10-31` ⚠️ *(Error de digitación que sumaba 38 meses en lugar de 36)*.

### El Problema Detectado:
Al registrar el contrato con fecha de inicio `2023-09-01` y plazo de 36 meses (3 años), la fecha de vencimiento contractual exacta debió ser el **`2026-08-31`**. Sin embargo, se digitó por error `2026-10-31`, lo que habría provocado que el sistema continúe devengando cupones durante el bimestre Septiembre-Octubre 2026.

### Solución y Corrección Aplicada en Supabase:
1. **Actualización en `crm_contratos`:**
   * Se actualizó `fecha_fin = '2026-08-31'` para el registro `NSGPEN03-049.20230901`.
2. **Impacto Cero en Asientos Históricos:**
   * Los 4 eventos contables existentes en `crm_certificados_eventos` (Emisión inicial y cortes bimestrales Ene-Feb, Mar-Abr, May-Jun 2026) se mantienen inalterados.
   * El ciclo Julio-Agosto 2026 (`2026-07-01` a `2026-08-31`) queda formalmente establecido como el último ciclo de vigencia contractual para su liquidación/renovación.

---

## 6. Auditoría Integral Forense de "Reencarnaciones" y Anomalías

Se ejecutó un escaneo total de integridad sobre los **595 asientos contables** en `crm_certificados_eventos` y los **209 contratos** en `crm_contratos`:

| Casuística de Integridad | Resultado Empírico | Diagnóstico |
|---|:---:|---|
| **Contratos en Ledger sin ficha en `crm_contratos`** | **`2` únicos casos** | Únicamente `NSGPEN01-081.20160101` y `NSGPEN01-084.20160101` (Edwin Maldonado). 0 casos adicionales. |
| **Resurrecciones Contables (Saldo 0 $\rightarrow$ Saldo > 0)** | **`0` casos** | Ningún contrato cerrado resucitó con nuevo capital bajo el mismo código. |
| **Discrepancias de Partícipe en Asientos Ledger** | **`0` casos** | Los 595 asientos del Ledger corresponden al 100% con los titulares registrados. |

---

## 7. Aclaración Arquitectónica: La Tabla `crm_certificados`

### ¿Es necesaria *Sine Qua Non*?
**NO.** La tabla `crm_certificados` es un maestro documental redundante que ha sido desacoplada.

* **Arquitectura Ledger-First del ERP:**  
  Toda la lógica financiera, devengues, cortes bimestrales, liquidaciones y cálculo de patrimonio se sustenta exclusivamente en:
  1. `crm_contratos` (Parámetros, partícipes y condiciones contractuales).
  2. `crm_certificados_eventos` (Ledger contable de eventos financieros con saldos vivos).
* **Evidencia Técnica:**  
  Los más de 370 contratos históricos del fondo operan perfectamente sin registros en `crm_certificados`.

---

## 8. Protocolo para Futuros Casos de Reciclaje ETL

Ante situaciones donde el usuario reporte contratos reciclados o migraciones de fondos:
1. **Verificación de Disponibilidad:** Comprobar que el nuevo correlativo propuesto no exista en ninguna tabla (`crm_contratos`, `crm_certificados_eventos`, `crm_cronograma_deducciones_rescates`).
2. **Reasignación Atómica:**
   - Crear el nuevo registro en `crm_contratos`.
   - Re-apuntar los eventos contables en `crm_certificados_eventos`.
   - Eliminar el contrato previo reciclado para liberar el historial del titular original.
3. **Preservación de Históricos:** Ante rescates y traspasos a nuevos fondos, **mantener siempre el contrato origen en `crm_contratos`** marcado como `cerrado_por_rescate`.
4. **Registro en Bitácora:** Documentar el cambio en los logs de interacción y notas de Obsidian.

---

## 9. Algoritmo Oficial de Reencarnaciones: *"Llenado de Huecos por Menor Muerto Disponible"*

### 📐 Fundamento del Algoritmo:
Para mantener una baraja compacta de contratos sin dejar números abandonados:

1. **Definición de Conjuntos:**
   * Sea $A_{\text{vivos}}$ el conjunto de correlativos numéricos de los contratos actualmente activos/vivos en el fondo (`estado IN ('emitido', 'activo', 'vigente')`).
   * Sea $N_{\max}$ el correlativo numérico más alto registrado históricamente en el fondo.
2. **Evaluación Ascendente de Disponibilidad:**
   * Se evalúa en orden ascendente $k = 1, 2, 3, \dots, N_{\max}$.
   * Si existe un $k \notin A_{\text{vivos}}$ (es decir, el número $k$ está cerrado o no está activo), se selecciona dicho **menor $k$ disponible** (*"muerto libre"*).
3. **Expansión a Techo Nuevo ($N_{\max} + 1$):**
   * Si todos los correlativos $1 \dots N_{\max}$ están actualmente vivos, el nuevo correlativo asignado será **$N_{\max} + 1$**.
4. **Composición de la Llave Natural Inmutable:**
   * La nueva emisión adopta la clave:
     $$\mathbf{[FONDO] - [00K] . [YYYYMMDD]}$$
   * De este modo, la reencarnación nace con su propia llave primaria en Postgres sin colisionar ni sobreescribir la primera encarnación histórica (`[FONDO]-[00K].[FECHA_ANTERIOR]`).


