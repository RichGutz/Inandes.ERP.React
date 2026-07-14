# 💻 Plan de Desarrollo React - Fase 7: Gestión de Deducciones y Rescates

Esta nota detalla el plan de implementación técnica y diseño de interfaz para la **Fase 7** de la migración del CRM InAndes a **React + Vite (TypeScript)**, portando el script original `34_CRM_Deducciones.py`.

---

## 🎨 1. Estructura de la Interfaz (Buscador y 3 Sub-pestañas)

El módulo está montado bajo la pestaña **Gestión de Deducciones / Rescates** (`crm_deducciones`) del menú lateral `CRM` en `App.tsx` e implementa el siguiente flujo interactivo:

### Buscador Inicial de Contrato Padre
* Entrada predictiva para buscar contratos mediante ID exacto, DNI, RUC o Nombre del inversionista.
* Listado de coincidencias seleccionables. Al elegir uno, se activa la visualización de la ficha y las sub-pestañas.
* **Ficha Resumen del Contrato**: Muestra en un panel el ID del contrato, inversionista titular, fondo asignado, moneda del contrato, monto original de inversión, fecha de fin y el ID del **Certificado Activo** recuperado en caliente desde Supabase.

---

### Pestaña 1: 📋 Cronograma General (Activo)
* Listado unificado en formato tabla de todas las cuotas y asientos de descuento o amortización programados para el Certificado Activo.
* Columnas de control: ID Asiento (cuota), Tipo Cargo (Deducción, Rescate, Penalidad), Glosa de descripción, Moneda, Monto a cobrar, Corte proyectado de cobro, Estado (PENDIENTE / COBRADO) y Prioridad.

---

### Pestaña 2: ➕ Programar Deducción (DED)
* Permite programar cargos fijos o variables al certificado:
  * **Monto Fijo Periódico**: Permite ingresar un importe fijo, seleccionar la fecha del primer descuento (dentro de las fechas válidas de fin de mes bimestrales/trimestrales calculadas dinámicamente) y el número de periodos consecutivos a descontar.
  * **Cronograma Múltiple (Armadas Ajustables)**: Permite ingresar el número total de armadas a generar y renderiza campos de texto de edición independiente para ingresar montos manuales en cada armada.
* Campo de Prioridad de ejecución.
* **Cálculo de Llaves Naturales**: Al confirmarse, se calculan automáticamente las llaves compuestas:
  * Agrupador: `DED-[BASE_CERT].[F_INICIO].[YYMMDD_F_ORIGEN]`
  * ID Cuota: `[AGRUPADOR].[YYMMDD_F_EFECTIVA]-C.[X]/[Y]`
* Inserta el lote de cuotas en `crm_cronograma_deducciones_rescates` en estado `PENDIENTE`.

---

### Pestaña 3: 💸 Programar Rescate (RES)
* Muestra en una tarjeta las reglas del fondo seleccionado: Plazo Mínimo de Permanencia, Plazo Máximo para devolver el capital y Penalidad Base Vigente.
* **Formulario de Rescate**:
  * Glosa de rescate (por defecto "Devolución de Capital Principal por Retiro").
  * Cantidad de armadas de devolución.
  * Tasa de interés de rescate (Waiver) sugerida a partir de la tasa mínima de plazos del fondo.
  * Genera inputs para cada armada: fecha corte, monto a rescatar y la penalidad correspondiente (auto-calculada con el porcentaje del fondo, pero completamente editable por el operador).
* **Flujo Transaccional**: Inserta simultáneamente los registros de tipo `RESCATE_CAPITAL` (prefijo `RES`) y los de `PENALIDAD_RESCATE` (prefijo `PEN.RES` con prioridad alta 1) en el cronograma unificado.

---

## 🗄️ 2. Mapeo de la Tabla de DB
El módulo lee y escribe en:
* `crm_cronograma_deducciones_rescates` (CRUD de cuotas y estados).
* `crm_contratos` (Búsqueda y datos financieros).
* `crm_certificados` (Resolución de certificado activo).
* `crm_fondos` (Reglas y plazos).
* `crm_inversionistas` (Búsqueda de DNI y nombres).
