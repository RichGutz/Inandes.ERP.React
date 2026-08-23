# 🕵️‍♂️ Casuística de Errores del Usuario en Stress Test: Rescate Certificado 37

> **Documento Técnico de Diagnóstico y Resolución**  
> **Ubicación:** `Obsidian/Inandes.Inversionistas.React/Backend/Casuistica_errores_USER_por_STRESS.TEST.md`  
> **Fecha:** 2026-08-23  

---

## 1. El Incidente Reportado por el Usuario

### Reporte Textual (DIXIT):
> *"certificado 37. Ya he solicitado dos veces el rescate total para el 30 de junio y el ERP no quiere obedecer a la petición de rescate."*

### Evidencia Visual:
En la grilla del ciclo **Mayo – Junio 2026 (Corte 30 de Junio de 2026)**:
* Contrato: `NSGUSD02-037.20240701` (Inversionista: *Vera Tudela Ugás Victor Juan*)
* Capital Base: **USD 20,000.00**
* Rescate de Capital: **` - ` (Vacío)**
* Saldo Final al 30 de junio: **USD 20,000.00** (No se amortizó ni se extinguió a 0.00).

---

## 2. Investigación Forense en la Base de Datos

Al realizar el análisis en las tablas de Supabase, se descubrió la causa raíz:

### A. Registros en `crm_cronograma_deducciones_rescates`:
Se encontraron **dos solicitudes duplicadas** ingresadas por el usuario:
1. `RES-NSGUSD02-037.20240701.260822.260228-C.1/1` (Creada: 2026-08-22 02:06:50 UTC)
   * `fecha_proyectada_cobro`: **`2026-02-28`** ⚠️ *(28 de Febrero de 2026)*
2. `RES-NSGUSD02-037.20240701.260823.260228-C.1/1` (Creada: 2026-08-23 00:46:45 UTC)
   * `fecha_proyectada_cobro`: **`2026-02-28`** ⚠️ *(28 de Febrero de 2026)*

### B. ¿Por qué ocurrió esto en la UI (`DeduccionesPage.tsx`)?
* En la pestaña de **Programar Rescate**, el selector desplegable de armadas inicializaba por defecto con la primera fecha del año contable (`validDates[0]` $\rightarrow$ `28 feb. 2026`).
* El usuario marcó el checkbox **☑ Rescate Total (Extinción Completa)** asumiendo que el sistema lo programaría automáticamente para la fecha de fin de contrato (`2026-06-30`), pero el formulario mantuvo la fecha por defecto de febrero.
* Al notar que en junio no aparecía, el usuario repitió el proceso generando un segundo rescate en febrero.

### C. Comportamiento del Motor Financiero:
* El motor financiero evalúa el período bimestral `2026-05-01` a `2026-06-30`.
* Como ambas solicitudes estaban registradas con fecha de cobro **`2026-02-28`**, el ciclo de junio las ignoró completamente, manteniendo el capital en USD 20,000.00 y devengando intereses normales.

---

## 3. Correcciones Aplicadas

### 1. Saneamiento en Base de Datos (Supabase)
* Se eliminaron las dos cuotas duplicadas y desfasadas con fecha `2026-02-28`.
* Se insertó la cuota única y definitiva de Rescate Total:
  * **`id_cuota`:** `RES-NSGUSD02-037.20240701.260823.260630-C.1/1`
  * **`id_contrato`:** `NSGUSD02-037.20240701`
  * **`tipo_cargo`:** `RESCATE_CAPITAL`
  * **`monto_cobrar`:** `USD 20,000.00`
  * **`fecha_proyectada_cobro`:** **`2026-06-30`**
  * **`estado`:** `PENDIENTE`

### 2. Blindaje en la Interfaz de Usuario (`src/features/deducciones/DeduccionesPage.tsx`)
* Se programó una reactividad inteligente en el formulario de rescates:
  * Al activar el checkbox **☑ Rescate Total**, el sistema busca automáticamente la fecha de corte de fin de mes que coincida con la `fecha_fin` del contrato seleccionado (`selectedContrato.fecha_fin`).
  * De este modo, la armada se preselecciona automáticamente en la fecha correcta (`30 jun. 2026`), eliminando el error humano de selección manual.

---

## 4. Validación Técnica
* **Compilación de Producción:** Ejecutada con `npm run build` (`tsc -b && vite build`) $\rightarrow$ **0 errores de TypeScript**, compilación en 3.29s.
* **Integridad del Ledger:** El próximo corte de Junio reconocerá inmediatamente el rescate de USD 20,000.00, extinguiendo el saldo del contrato a USD 0.00.

---

## 5. Preguntas Frecuentes de Arquitectura y Negocio (Q&A)

### ❓ Pregunta del Usuario:
> *«¿Y qué pasaría si el usuario quiere hacer el rescate ANTES de la fecha de cierre del contrato?»*

### 💡 Respuesta Técnica y de Negocio:

Si el usuario decide ejecutar un rescate antes del vencimiento natural del contrato (ya sea un **Rescate Parcial** o un **Rescate Total Anticipado**), el sistema responde de forma integral en 3 niveles:

#### 1. En la Interfaz de Usuario (`DeduccionesPage.tsx`):
* **Selector 100% Libre y Editable:** La auto-selección inteligente únicamente establece una sugerencia inicial conveniente. El desplegable de fechas (`<select>`) mantiene habilitados **todos los cortes bimestrales y trimestrales del calendario** (`28 Feb`, `30 Abr`, `30 Jun`, `31 Ago`, etc.).
* El usuario puede elegir libremente cualquier fecha previa al vencimiento.
* Permite programarlo en **1 sola armada** o fraccionarlo en **múltiples armadas** (hasta 24 cuotas de amortización).

#### 2. En las Reglas del Fondo y Penalidades Financieras:
* **Penalidad por Retiro Anticipado:** Si el rescate se solicita antes del plazo de permanencia mínima del fondo (`fondoRules.plazo_rescate_meses`), el ERP aplica automáticamente la penalidad contractual (`fondoRules.penalidad_rescate`, ej. 3%, 5%, 7%).
* **Cálculo Transparente:** La pantalla calcula en tiempo real el monto neto que efectivamente se le transferirá al cliente:
  $$\text{Neto a Devolver} = \text{Monto Rescatado} - \text{Penalidad}$$
* **Tasa Waiver:** Si la gerencia autoriza una exoneración o tasa especial por retiro, el operador puede registrarla en el campo *Tasa Waiver %*.

#### 3. En el Motor Financiero y Ledger Contable (V40):
Al procesar el corte contable de la fecha elegida:
* **Si es Rescate Parcial:** Se amortiza el capital (`capital_final_saldo = capital_base - monto_rescate`) y para los períodos siguientes el inversionista sigue devengando intereses únicamente sobre el saldo de capital remanente.
* **Si es Rescate Total Anticipado:** Se liquidan los rendimientos devengados hasta esa fecha, el saldo de capital baja a **`USD 0.00`** y el contrato cambia de estado a **`cerrado_por_rescate`**, cesando todo devengue futuro.

---

## 6. Sincronización Bidireccional de Estados: Cierre Oficializado vs. Rollback (Reversión)

### ⚠️ El Conflicto Detectado ("Deceiving"):
1. En **Retornos y Rendimientos**, los períodos `2026-02-28`, `2026-03-31` y `2026-04-30` figuraban como **`CERRADOS / OFICIALIZADOS`** (con sus 185 y 191 asientos en el Ledger `crm_certificados_eventos`).
2. Sin embargo, en el **Cronograma de Deducciones / Rescates**, sus 25 cuotas de amortización figuraban en estado **`PENDIENTE`** y la tarjeta superior de Tesorería seguía indicando: *«PROVISIÓN TOTAL DE CASH PARA RESCATES: S/ 1,076,213.35»*, haciendo creer erróneamente al usuario que el ERP no había liquidado los pagos.

### 🔄 El Ciclo de Vida Simétrico (Cierre $\leftrightarrow$ Rollback):

```
[Cronograma: PENDIENTE]
       │
       ▼ (Al Oficializar Cierre Contable)
[Cronograma: PROCESADO]  ──►  [Ledger: Asientos Contables Insertados]
       │
       ▼ (Al Ejecutar Rollback / Reversión)
[Cronograma: PENDIENTE]  ◄──  [Ledger: Asientos Contables Eliminados]
```

1. **Al Oficializar (Cierre):**
   * El motor V40 genera los asientos en `crm_certificados_eventos`.
   * Cierra los contratos correspondientes en `crm_contratos` (`cerrado_por_rescate`).
   * Actualiza atómicamente las cuotas imputadas en `crm_cronograma_deducciones_rescates` a **`estado = 'PROCESADO'`**.
2. **Al Revertir (Rollback):**
   * Se eliminan los asientos de `crm_certificados_eventos` de ese corte.
   * Se reactivan los contratos a `estado = 'emitido'`.
   * Las cuotas de `crm_cronograma_deducciones_rescates` que estaban en `PROCESADO` revierten automáticamente a **`estado = 'PENDIENTE'`**.

### 🛠️ Correcciones Ejecutadas:
1. **Sincronización en Base de Datos Supabase:**
   * Las 25 cuotas pertenecientes a los cortes cerrados (`2026-02-28`, `2026-03-31`, `2026-04-30`) fueron actualizadas a **`PROCESADO`**.
   * Las 9 cuotas de cortes futuros (`2026-06-30`, `2026-08-31`, `2028-08-31`) permanecen en **`PENDIENTE`**.
2. **Tarjeta KPI Inteligente de Tesorería (`DeduccionesPage.tsx`):**
   * Si el corte seleccionado ya está cerrado y procesado $\rightarrow$ Muestra **`✅ Cash Liquidado / Ejecutado en Rescates`** (badge verde).
   * Si el corte seleccionado es futuro o tiene pendientes $\rightarrow$ Muestra **`💰 Provisión de Cash Requerida`** (badge azul).


