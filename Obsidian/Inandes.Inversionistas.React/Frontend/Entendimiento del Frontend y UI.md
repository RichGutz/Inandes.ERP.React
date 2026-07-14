# 💻 Entendimiento del Frontend y UI (Migración de Streamlit a React)

La interfaz original está construida utilizando **Streamlit**, una librería de Python orientada a scripts rápidos de datos. Su migración a **React + Vite** busca ganar dinamismo, reactividad (sin recargas de página completas), mejor control de roles de usuario y una experiencia de usuario (UX) premium.

---

## 🎨 1. Estructura de la UI de Gestión de Inversionistas (tabs)

Basado en las notas de diseño (`DESIGN_NOTES_V3.md`), la pantalla principal del CRM de Inversionistas se estructurará en las siguientes secciones o pestañas principales:

### Tab 1: 📊 Portafolio (Inversiones Vigentes)
*   **Propósito**: Visualización del inventario consolidado de inversiones activas.
*   **Elementos UI**:
    *   Filtros dinámicos por **Fondo**, **Moneda** y **Estado** (Vigente / Cerrado).
    *   Buscador rápido de inversionista (por DNI o Apellidos).
    *   Tabla interactiva de certificados mostrando: Código de Certificado, Inversionista principal, Capital Base, Tasa Pactada y Fecha de Vencimiento.
    *   Enlace rápido para descargar el **Estado de Cuenta en PDF** o exportar el **Grid a Excel**.

### Tab 2: ➕ Nuevos Tickets / Rescates (Flujo Unificado)
Implementa el patrón **"Buscar ➜ Accionar"**:
1.  **Buscador**: Campo de búsqueda reactiva (autocompletar) por DNI o Nombre.
2.  **Partícipe Seleccionado**: Muestra resumen de datos personales y cuentas bancarias.
3.  **Acciones Disponibles**:
    *   **Opción A: Nuevo Ticket (Suscripción)**:
        *   Formulario para seleccionar Fondo, Plazo (meses), Fecha de Suscripción, Monto Invertido y Moneda.
        *   Campo `% Capitalización` (de 0% a 100%) para definir la reinversión de intereses.
    *   **Opción B: Procesar Rescate (Retiros)**:
        *   Selector de ticket activo de la persona seleccionada.
        *   Formulario de retiro indicando: Monto a rescatar, Tasa Penalidad/Waiver aplicable y Fecha de retiro.

### Tab 3: 💸 Cash Flow y Cupones (Visión del Motor)
*   **Propósito**: Visualizar los cobros y pagos de intereses generados por el motor de cálculo.
*   **Elementos UI**:
    *   Filtros por rango de fechas, fondo y partícipe.
    *   Gráfico o tabla cronológica de eventos mostrando el "rastro" contable de los cupones generados, capitalizaciones aplicadas y retenciones de IR realizadas.

### Tab 4: 📧 Envío de Formatos
*   **Propósito**: Envío masivo del Estado de Cuenta mensual (EECC) a los clientes.
*   **Elementos UI**:
    *   Grid con los inversionistas elegibles (aquellos con movimientos o cierres recientes).
    *   Botón para disparar la generación y envío de correos con el PDF adjunto (utiliza la plantilla WeasyPrint del backend).

---

## 🚀 2. Directrices de Diseño y UX para React

Para lograr una experiencia premium en el frontend, se proponen los siguientes lineamientos de desarrollo:

1.  **Reactividad en Formularios**: Utilizar librerías como *React Hook Form* o estados locales para asegurar que al cambiar la moneda de un ticket, se filtren y muestren solo las cuentas bancarias asociadas a esa moneda del inversionista.
2.  **Autocompletado Rápido**: El buscador de inversionistas debe cargar y filtrar dinámicamente sobre la base de datos de partícipes para evitar clicks redundantes.
3.  **Visualización del Ledger**: Los eventos del certificado (`crm_certificados_eventos`) deben ser representados de manera visual mediante una línea de tiempo (Timeline) usando colores codificados:
    *   🟢 **Verde**: `emision_inicial` y `aumento_capital`.
    *   🔵 **Azul**: `cierre_periodico` (detallando intereses e IR).
    *   🔴 **Rojo**: `cierre_por_rescate` o `cierre_final`.
4.  **Auditoría y Simulación**: Mantener una versión del simulador de intereses en el frontend para que el asesor pueda cotizar con el cliente sin necesidad de consultar el backend.
