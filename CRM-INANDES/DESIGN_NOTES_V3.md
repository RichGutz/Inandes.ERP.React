# Notas de Diseño UI - Gestión de Inversiones (V3)
*Fecha: 21 Enero 2026*

## Estructura de Tabs

Según instrucción del usuario, la interfaz se organizará de la siguiente manera:

### 1. Tab: "Portafolio"
*   **Antes llamado**: "Inversiones (Grid)".
*   **Función**: Visualización de inversiones existentes.
*   **Estado**: Se mantiene la funcionalidad actual.

### 2. Tab: "Nuevos tickets / Rescates"
<<<<<<< HEAD
*   **Concepto**: Unificación de alta y baja de inversiones.
*   **Inputs requeridos para "Nuevo Ticket"**:
    *   **Fondo**: (Select) A qué fondo va el dinero.
    *   **Plazo**: (Input/Select) Plazo elegido por el cliente.
    *   **Fecha de Suscripción**: (Date) Cuándo inicia.
    *   **Monto**: (Number) Capital invertido.
    *   **Moneda**: (Select) PEN/USD.
*   **Enfoque de Implementación**:
    *   **MOCK**: Inicialmente será solo texto y controles visuales.
    *   No conectar aún a Base de Datos de Eventos ni Inversiones real.
    *   Priorizar la interfaz visual.
    *   **Sección Rescates**:
        *   **Buscador**: Permitir buscar persona por Nombre/DNI.
        *   **Selector de Ticket**: Mostrar lista de tickets activos de esa persona.
        *   **Acción**: Aplicar rescate (parcial/total) sobre el ticket seleccionado.

### 3. Tab: "Configuración" (Implícito)
*   Gestión de Fondos y Tasas (Maestros).
=======
*   **Concepto**: Flujo Unificado (Buscar -> Accionar).
*   **Flujo Inicial**:
    *   **Buscador Manual**: Input de Texto (DNI o Nombre).
    *   **Acción**: Botón "🔍 Buscar".
    *   **Resultado**: Si hay coincidencias, permitir seleccionar al partícipe.
*   **Acciones (Una vez seleccionado)**:
    *   **Opción A: Nuevo Ticket**:
        *   Formulario: Fondo, Plazo, Fecha, Monto, Moneda.
        *   **% Capitalización**: Input numérico simple (0-100%).
    *   **Opción B: Rescate**:
        *   Selector de Ticket (Lista de activos).
        *   Formulario de retiro.

### 3. Tab: "Cash Flow Cupones / Rescates" (Nuevo)
*   **Propósito**: Visualizar los efectos del Motor de Cálculo.
*   **Filtros**:
    *   **Partícipe**: Buscador (Nombre/DNI).
    *   **Fecha**: Rango (Desde - Hasta).
    *   **Fondo**: Select (e.g., MIPYME).
    *   **Moneda**: Select (PEN/USD).
*   **Contenido (Mock)**:
    *   Tabla de eventos generados:
        *   Cupones (Pago/Capitalización).
        *   Rescates ejecutados.
    *   Permitirá ver el "rastro" financiero de las operaciones.

### 4. Tab: "Envío de Formatos" (Nuevo)
*   **Propósito**: Envío masivo de EECC (Estados de Cuenta).
*   **Lógica de Selección**: Usuarios con eventos recientes (Cupón, Rescate, Recapitalización).
*   **Funcionalidad (Mock)**:
    *   Grid de destinatarios elegibles.
    *   Botón "📧 Enviar Formatos".
>>>>>>> master

---
**Nota General**:
*   No preocuparse por completitud de BD por ahora.
*   Enfoque en UX/UI y flujo visual ("Mock con texto").
