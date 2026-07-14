# 💻 Plan de Desarrollo React - Fase 3: Gestión de Asesores y Comisiones

Esta nota detalla el plan de implementación técnica y diseño de interfaz para la **Fase 3** de la migración del CRM InAndes a **React + Vite (TypeScript)**. En esta fase, implementaremos la gestión de asesores de venta y el motor contable de proyección y liquidación de comisiones en TypeScript.

---

## 🎨 1. Estructura de la Interfaz (2 Sub-pestañas)

El módulo de asesores se estructurará internamente utilizando pestañas de navegación dinámicas:

### Pestaña A: 📋 Datos Asesores
* **Visualización**: Grid de Tarjetas (Cards) en 3 columnas. Cada tarjeta mostrará las iniciales del asesor, su nombre completo (`Apellido_1 Apellido_2 Nombre_1 Nombre_2`), número de DNI/RUC, correo y teléfono.
* **Acciones rápidas**:
  * Botón para abrir el formulario de **Registrar Nuevo** (vacío).
  * Botón **Editar** en cada tarjeta que precarga el formulario con los datos correspondientes.
* **Formulario de Registro (Modal)**:
  Se estructurará internamente en 5 pestañas de edición:
  1. **Identidad**: Tipo y N° de documento, celular, nombre completo (o Razón Social), fecha de nacimiento, nacionalidad, email, estado civil y profesión.
  2. **Ubicación**: Dirección fiscal, distrito, provincia, departamento, código postal, país de residencia y checkbox de residente fiscal en Perú.
  3. **Cónyuge**: Nombre completo, tipo de documento y número de documento del cónyuge.
  4. **Laboral/PEP**: Ocupación, centro laboral, cargo, antigüedad laboral (número de años), checkbox PEP y detalle PEP.
  5. **Bancario**: Cuentas en Soles PEN (Banco, N° Cuenta, CCI) y Dólares USD (Banco, N° Cuenta, CCI).

---

### Pestaña B: 💰 Cálculo de Comisiones
* **Panel de Filtros**:
  * Selector de Asesor (dropdown con autocompletado + opción de "TODOS los asesores").
  * Año objetivo (2025 / 2026).
* **Tabla de Proyección**:
  * Presenta un grid estructurado mostrando para cada contrato: Fondo, ID Certificado, Tasa de Captación (antiguo), Tasa de Mantenimiento (antiguo), Tasa Única (2026), Capital y 12 columnas correspondientes a los meses del año (`Ene-26`, `Feb-26`, etc.).
  * Los meses que coinciden con los cortes del fondo y el estado de la inversión mostrarán el monto devengado. Los demás meses mostrarán `-`.
* **Exportación y Liquidación**:
  * **Descargar Tabla (Excel)**: Genera y descarga un libro de Excel. Si se selecciona "TODOS los asesores", SheetJS creará de forma inteligente pestañas independientes por asesor además de la pestaña de resumen consolidada.
  * **Generar Liquidación PDF**: Abre una plantilla HTML premium adaptada para impresión que calcula el resumen consolidado del asesor y permite guardarlo como PDF de forma nativa en el navegador.

---

## 💸 2. Motor de Comisiones en TypeScript (`asesoresService.ts`)

Portaremos el motor de proyección Python `generate_comisiones_asesores_v2.py` a TypeScript en el servicio `src/services/asesoresService.ts`.

### Lógica de Cálculo y Reglas del Core:
1. **Esquema Nuevo 2026** (Emisiones desde 01/01/2026):
   * Se aplica una **Comisión Única** de captación (configurada en `comision_asesor_unica` del fondo, sugerida en $3.5\%$).
   * Se devenga únicamente en el primer corte contable del fondo posterior a la fecha de emisión del certificado. No registra pagos posteriores de mantenimiento.
2. **Esquema Antiguo** (Emisiones anteriores a 2026):
   * **Captación (Año 1)**: Comisión de captación (configurada en `comision_asesor_primer_ano` del fondo, ej. $2.0\%$), pagadera en el primer corte contable tras la emisión.
   * **Periodo de Gracia**: Dura exactamente 12 meses a partir de la fecha del primer pago de captación. En este lapso no se pagan comisiones.
   * **Mantenimiento (Año 2+)**: Inicia tras culminar el año de gracia. Se aplica la tasa anual configurada en `comision_asesor_mantenimiento` del fondo (ej. $1.5\%$) prorrateada y distribuida en los cortes contables del año según la frecuencia del fondo (bimestral = divisor 6, trimestral = divisor 4).
3. **Cortes Teóricos y Lookup**:
   * Las fechas de corte contables del año se generan dinámicamente en base a la frecuencia en meses del fondo (ej. frecuencia 3 = cortes en los meses 3, 6, 9 y 12).
   * La fecha de nacimiento de la inversión se extrae de la cadena del ID de certificado (ej. `NSGPEN01-001.20251212.1` -> `12/12/2025`). En su defecto, se utiliza la fecha de emisión.
   * La función helper `getClosestCutAfter` determina el primer corte contable mayor o igual al nacimiento para disparar la comisión de captación o única.
