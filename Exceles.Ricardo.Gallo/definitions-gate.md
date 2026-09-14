# Definitions Gate — Malecón Grau 1046

fm-design-micro §1 · 2026-09-08 · **CONGELADO 2026-09-08 por Jorge.** Todo cambio desde aqui requiere Change Memo con radio de impacto enumerado.

Una vez congelado, cualquier cambio requiere Change Memo con radio de impacto enumerado.
No hay "renombres rápidos". Los sinónimos prohibidos los barre `fm-audit` sobre la columna C.

---

## Glosario

| Término (string exacto) | Definición | Tipo | Unidad | Módulo dueño | Sinónimos PROHIBIDOS |
|---|---|---|---|---|---|
| **Unidad Equivalente** | Un departamento más su prorrata de estacionamiento y depósito. El modelo vende 39 unidades equivalentes, no 39 depas + 59 cocheras por separado | entidad | unid | `Vta` | "depa", "unidad", "dpto" a secas |
| **Área Vendible Ajustada** | Área techada vendible + área libre × coeficiente 0.40. Es **4,906.26 m²**, no 4,469.38 | métrica | m² | `Inp-F` | "área vendible", "área techada" |
| **Tramo de Precio** | Uno de 6 niveles de precio ligados a la etapa física de obra. Tramo 0 = preventa; tramo 5 = unidad terminada | etapa | — | `Inp-F` | "fase de precio", "escalón" |
| **Preventa** | Venta realizada **antes del inicio de la excavación** (tramos 0). Definición comercial de Jorge, no contable | etapa | — | `Vta` | "venta en planos" (es solo parte), "venta anticipada" |
| **Unidad Colocada** | Unidad equivalente con contrato firmado y cuota inicial pagada. **No es ingreso contable** | métrica | unid | `Vta` | "unidad vendida", "venta" |
| **Inventario Disponible** | Unidades equivalentes aún no colocadas. Corkscrew que solo decrece (salvo desistimiento) | métrica | unid | `Vta` | "stock", "saldo por vender" |
| **Cuota Inicial** | 20% del valor, pagado por el comprador **en una sola armada al firmar**. El banco exige que este pagada en full para desembolsar el CHIP de esa unidad | métrica | PEN | `Vta` | "inicial", "enganche", "separación" |
| **CHIP** | Crédito hipotecario del comprador, 80% del valor. Lo desembolsa el banco, no el comprador | métrica | PEN | `Vta` | "hipotecario", "crédito comprador", "saldo" |
| **CHIP Embalsado** | CHIP de una unidad colocada cuyo desembolso aún no se libera | métrica | PEN | `Vta` | "CHIP pendiente", "por cobrar" |
| **Activación Bancaria** | Momento en que la preventa acumulada alcanza el umbral del banco y este empieza a liberar CHIPs. Bandera 0/1 | bandera | flag | `Fin` | "gate", "punto de equilibrio", "break-even" |
| **Umbral de Preventa** | Valor de venta acumulado que el banco exige para activar. Se mide contra el **Costo Total Presupuestado** (F20) | métrica | PEN | `Fin` | "preventa requerida", "% de preventa" |
| **Costo Total Presupuestado** | Costo total del proyecto segun el presupuesto fijado en el contrato de credito. **Es la base del Umbral de Preventa y del Aporte Requerido.** Input fijo, no el costo vivo del modelo | metrica | PEN | `Inp-F` | "costo total", "inversion", "costo sin gasto financiero" |
| **Adelanto al Contratista** | Pago inicial al constructor, 20% del contrato, que se amortiza a prorrata en cada valorizacion. **Es caja sin obra** | metrica | PEN | `Obr` | "anticipo" (reservado para el comprador) |
| **Avance Economico** | Desembolso acumulado a la constructora sobre el total del contrato. Incluye el adelanto | metrica | % | `Tie` | "avance", "avance de obra" |
| **Avance Fisico** | Obra efectivamente ejecutada. **Se DERIVA del avance economico**: `Desembolso del periodo / (1 - Tasa de Adelanto)`, cero en el mes del adelanto. Gobierna las banderas de Tramo de Precio | metrica | % | `Tie` | "avance", "avance de obra" |
| **Mes de Inicio de Preventa** | Primer mes en que se puede colocar una unidad. Antes de el, la velocidad es cero aunque el tramo 0 este activo | metrica | mes | `Inp-F` | "inicio de ventas" |
| **Anticipo de Cliente** | Efectivo cobrado por unidades aún no entregadas. **Pasivo**, no ingreso | métrica | PEN | `Vta` | "adelanto", "ingreso diferido", "cobranza" |
| **Ingreso Reconocido** | Venta contable, nace **a la entrega** de la unidad. Distinto de la cobranza y del contrato | métrica | PEN | `Vta` | "venta", "ventas" a secas |
| **Inventario Inmobiliario** | Terreno + obra + costos capitalizables acumulados. **Existencias, no activo fijo. No se deprecia** | métrica | PEN | `Obr` | "activo fijo", "CAPEX", "obra en curso" |
| **Costo de Ventas** | Inventario inmobiliario transferido a resultados a la entrega, proporcional a unidades entregadas | métrica | PEN | `Obr` | "costo", "costo de obra" |
| **IGV Débito Fiscal** | IGV cobrado en la venta. Tasa efectiva 9% (18% sobre 50% del valor; el terreno no grava) | métrica | PEN | `Tx` | "IGV ventas", "IGV cobrado" |
| **IGV Crédito Fiscal** | IGV pagado en compras afectas, 18%. Arrastrable mes a mes | métrica | PEN | `Tx` | "IGV compras", "crédito" |
| **IGV Crédito Atrapado** | Saldo a favor de IGV remanente al cierre del SPV que **no se recupera**. Fuga de caja, no activo | métrica | PEN | `Tx` | "saldo a favor", "crédito remanente" |
| **Aporte Requerido** | Equity que el banco exige: 1/3 del Costo Total Presupuestado | métrica | PEN | `Eq` | "equity", "aporte" a secas |
| **Aporte Acumulado** | Equity efectivamente inyectado hasta la fecha. Corkscrew | métrica | PEN | `Eq` | "capital", "inversión del socio" |
| **Sobreaporte Vigente** | `MAX(0, Aporte Acumulado − Aporte Requerido)`. Equity puesto de más por arrancar obra antes de activar | métrica | PEN | `Eq` | "exceso", "aporte extra" |
| **Devolución de Sobreaporte** | Retiro del sobreaporte que el banco permite al activar. **Sube la TIR sin cambiar utilidad** | métrica | PEN | `Eq` | "retiro", "distribución" |
| **Equity Pico** | Máximo del Aporte Acumulado a lo largo del proyecto. **Es el output, no el input** | métrica | PEN | `Ret` | "aporte total", "inversión requerida" |
| **Utilidad Neta Contable** | Utilidad después de IR. **Es la base del proxy del sector**, y excluye el IGV atrapado | métrica | PEN | `Ret` | "utilidad", "net profit" |
| **Utilidad Neta Caja** | Utilidad Neta Contable − IGV Crédito Atrapado. Lo que realmente queda | métrica | PEN | `Ret` | "utilidad neta" a secas |
| **Fecha de Corte** | Último mes con datos reales cargados. Divide el modelo en Real y Proyección | métrica | fecha | `Ctrl` | "corte", "actual" |
| **Plan** | Serie congelada al cierre financiero. **Nunca se sobreescribe** | serie | — | `Inp-V` | "presupuesto", "base" |
| **Vigente** | Real hasta la Fecha de Corte, re-proyección después | serie | — | `Vta`,`Obr` | "actualizado", "forecast" |

---

## Regla de misma base (fm-design-micro §1) — métricas que son diferencias

| Métrica | Períodos comparados | Contenido de la línea, por período | ¿Misma base? |
|---|---|---|---|
| Desvío de Unidades Colocadas | Plan vs Vigente | Ambas: unidades equivalentes con contrato firmado + inicial pagada | **SÍ** |
| Desvío de Precio Promedio | Plan vs Vigente | Plan: precio del tramo × mix planificado. Vigente: precio logrado real × mix real | **SÍ, pero sensible al mix** — un desvío de precio puede ser puro efecto mezcla. `DashB` separa efecto precio de efecto mezcla, o el número engaña |
| Desvio de Avance de Obra | Plan vs Vigente | Ambas en **Avance Fisico**, derivado de la misma formula sobre la curva de desembolso | **SI — resuelto (F19)** |

---

## Hallazgos generados en este gate

**F19 — RESUELTO.** El avance fisico y el economico estan amarrados salvo por el adelanto.
Jorge: *"el avance economico manda al avance fisico; el constructor no construye si nadie le
paga."* **No hacen falta dos curvas de input**: el avance fisico se deriva de la de desembolso.
Verificado contra la curva de 18 meses: los pagos de los meses 2-18 suman 0.80 y las
valorizaciones reconstruidas suman exactamente **1.0000**.

**F21 — El precio promedio unico esconde un sesgo, no ruido.** Ver `mdb-vta.md` §2.

**Supuesto explicito que este gate deja anotado:** el modelo asume el **caso ideal de obra** —
siempre hay caja para pagar al ritmo optimo, porque el equity es el residual que lo garantiza.
Es exactamente lo que Jorge describio del modelo fuente. La consecuencia es que **la obra nunca
se detiene por falta de caja en el caso base**; si el desarrollador no quiere poner ese equity,
la obra se estira — y eso es un escenario que se corre moviendo la curva, no un comportamiento
que el modelo resuelva solo.

## Congelamiento

- [x] Glosario aprobado 2026-09-08
- [x] F19 resuelto 2026-09-08
- [x] Umbral confirmado: **33% del Costo Total Presupuestado**
- [x] F23 resuelto: "prevendido al 100%" = umbral alcanzado en su totalidad

Al congelar, el glosario se escribe en `Cov` (sección inferior) y el Registro de Bloques queda
en estos documentos de diseño, con puntero de una línea en el workbook.

---

## CHANGE MEMO 001 — 2026-09-08

**Que cambia:** el modulo dueno de `Avance Economico` y `Avance Fisico` pasa de `Obr` a `Tie`.
Se agrega el termino `Mes de Inicio de Preventa` (faltaba en el glosario y en `Inp-F`).

**Por que:** las banderas de Tramo de Precio viven en `Tie` (fm-core: Tie posee las banderas) y
se disparan por umbral de Avance Fisico. Si el Avance Fisico se calculara en `Obr`, tendriamos
`Tie -> Obr -> Tie`: **una dependencia circular a nivel de hoja**. El corte natural es que `Tie`
posea el CALENDARIO y sus porcentajes derivados (adimensionales), y `Obr` posea el DINERO
(costo incurrido, inventario inmobiliario) importando la curva desde `Tie`.

**Radio de impacto — enumerado, no estimado:**
- `design/definitions-gate.md`: 2 filas de glosario cambian "Modulo dueno" + 1 termino nuevo
- `design/mdb-vta.md`: sin cambio (ya importaba las banderas de tramo desde `Tie`)
- `design/mdb-fin-eq.md`: sin cambio (no referencia avance)
- `design/mdb-tx.md`: sin cambio
- Construccion: `Obr` importara `Curva de Desembolso` y `Avance Fisico Acumulado` de `Tie`
  en lugar de calcularlos. Ninguna fila de contrato de outputs cambia de nombre.
- `Inp-F`: se agrega `Mes de Inicio de Preventa` (fila nueva, ninguna existente se mueve de
  nombre; el resolver por etiqueta absorbe el corrimiento de filas)

**Migracion:** ninguna formula existente apunta a estas filas todavia (Tie e Inp-V no estan
construidas). Costo de la migracion: cero. Esta es la razon por la que el gate corre antes de
las formulas y no despues.

**Aprobado por:** Jorge (aprobacion de construccion 2026-09-08)
