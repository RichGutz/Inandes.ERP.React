# 💻 Plan de Desarrollo React - Fase 2: Gestión de Inversionistas y Motor v40

Esta nota detalla el plan de implementación técnica y diseño de interfaz para la **Fase 2** de la migración del CRM InAndes a **React + Vite (TypeScript)**. En esta fase, enriqueceremos la vista de Inversionistas y portaremos el motor contable financiero `v40` para operar del lado del cliente.

---

## 🎨 1. Estructura de la Interfaz (3 Sub-pestañas)

La página `InversionistasPage.tsx` se estructurará internamente utilizando pestañas de navegación dinámicas:

### Pestaña A: 👥 Datos Inversionistas
* **Visualización**: Grid de Tarjetas (Cards) en 3 columnas. Cada tarjeta mostrará las iniciales o foto de perfil del partícipe, su nombre formateado (`Apellido_1 Apellido_2 Nombre_1 Nombre_2`), número de DNI/RUC y correo electrónico.
* **Acciones rápidas**:
  * Botón para abrir el formulario de **Nuevo Registro** (vacío).
  * Botón **Editar** en cada tarjeta que precarga el formulario con los datos correspondientes.
* **Formulario de Registro (Modal / Panel Deslizable)**:
  Se estructurará internamente en 5 pestañas de edición:
  1. **Identidad**: Tipo de documento (DNI, CEX, PASAPORTE, RUC), número de documento, nombres y apellidos completos, fecha de nacimiento (con DatePicker), estado civil, nacionalidad, residencia (checkbox), correo, teléfono, dirección fiscal y código postal.
  2. **Cónyuge**: Nombre completo, tipo de documento y número de documento del cónyuge (solo visible/habilitado si el estado civil es "Casado(a)" o "Conviviente").
  3. **Laboral**: Ocupación, centro de labores, cargo y antigüedad laboral (número de años).
  4. **Bancario**: Cuentas en Soles PEN (Banco, N° Cuenta, CCI) y Dólares USD (Banco, N° Cuenta, CCI).
  5. **Compliance (Cumplimiento)**: Marcador PEP (Persona Expuesta Políticamente) con cuadro de detalles, perfil de riesgo (Bajo, Medio, Alto), estado de compliance (Borrador, Solicitado, Aprobado, Rechazado), fecha de solicitud y caja de observaciones.

---

### Pestaña B: 💹 Retornos y Rendimientos (Auditoría v40)
* **Dashboard Global de Auditoría (Tiles)**:
  * Presenta 6 columnas para ciclos Bimestrales (B1 a B6) y 4 columnas para ciclos Trimestrales (Q1 a Q4).
  * Cada celda carga de forma reactiva los códigos de los fondos que registran cierres en ese ciclo durante el año seleccionado (ej. `NSGPEN01` en B1, `NSGUSD02` en Q3).
* **Panel de Filtros**:
  * Selector de Fondo (obtenido de `crm_fondos` + opción "TODOS").
  * Año (2024 a 2027).
  * Tipo de Ciclo (Bimestre / Trimestre) con cálculo por defecto según la frecuencia del fondo.
  * Número de Periodo (1 a 6 para bimestre, 1 a 4 para trimestre).
* **Control de Periodos y Guardia**:
  * Informa el periodo calculado (`f_start` al `f_end`).
  * Realiza una validación de colisión consultando Supabase para comprobar si ya existen registros del ledger en el fin del periodo seleccionado. Muestra un aviso de bloqueo en rojo si detecta colisión.
* **Acciones de Auditoría**:
  * **Ejecutar Cálculo (Excel Completo)**: Llama al motor financiero local en JS/TS, genera los datos en memoria por pestañas y descarga un archivo Excel estructurado usando la librería `xlsx`.
  * **Generar PDF Condensado**: Genera y despliega una vista detallada optimizada para impresión (que el navegador permite guardar directamente como PDF).
* **Oficialización del Ledger**:
  * El botón **"Registrar Permanente en DB"** permanecerá bloqueado hasta que el usuario haya descargado el Excel y el PDF (requerimiento estricto de auditoría).
  * Al activarse, procesa la inserción masiva en `crm_certificados_eventos`, actualiza los contratos maestros a `cerrado_fin_contrato` o `cerrado_por_rescate`, y marca los cronogramas como `PROCESADO`.
* **Herramienta de Rollback**:
  * Permite eliminar todos los asientos del ledger de un periodo y revertir el estado de contratos a `emitido` y cronogramas a `PENDIENTE` en caso de errores contables.

---

### Pestaña C: 📄 Generación Documentos
* **Propósito**: Emisión masiva en lote (batch) de documentos de clientes.
* **Flujo**:
  1. Filtra por fondo.
  2. Ejecuta el motor local para obtener la matriz consolidada.
  3. Prepara los contextos del cliente (mapeo de DNI, dirección e importes).
  4. Habilita los botones de descarga masiva para:
     * **Estados de Cuenta (EECC)** en PDF.
     * **Certificados de Retención** de Renta en PDF.

---

## 💸 2. Motor Financiero en TypeScript (`financialCalculator.ts`)

Para independizar el frontend de dependencias de API Python y lograr reactividad total, traduciremos el script `CALCULO_Retornos_Intereses_v40.py` a TypeScript.

### Lógica Matemática y Reglas del Core:
1. **Base de Días**: 365 días reales en el año.
2. **Day-by-Day Interest Loop**: Cómputo del interés devengado diariamente para cada certificado de participación.
3. **Manejo de Rescates y Waiver**:
   * Si un certificado tiene un rescate programado en el periodo, se aplica la tasa de penalización (castigo) para el capital inicial hasta la fecha del rescate.
   * A partir de esa fecha, el capital remanente continúa devengando intereses a la tasa pactada original hasta el fin del periodo (regla Tramo A / Tramo B).
4. **Impuesto a la Renta (IR)**: Retención fija del 5% sobre el interés bruto generado.
5. **Capitalización / Reparto**:
   * El interés neto resultante se multiplica por el porcentaje de reparto del contrato para determinar el efectivo a pagar.
   * El remanente se destina a aumento de capital por capitalización de intereses, sumándose al capital final.
6. **Filtración por Ciclo**:
   * Un fondo solo procesa cálculos si el mes de la fecha de corte (`fecha_fin`) es divisible por la frecuencia en meses del fondo (`frecuencia_cupones_meses`). De lo contrario, se omite el procesamiento.
