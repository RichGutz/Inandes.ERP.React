# 🚀 Plan de Desarrollo React - Fase 11 (Factoring - Originación)

Esta nota detalla el plan de implementación técnica y rediseño de interfaz para la **Fase 11** de la migración del CRM InAndes a React + Vite (TypeScript). En esta fase, abordaremos la construcción completa de la pestaña **Originación** dentro del módulo de Factoring (reemplazando al antiguo script `02_Originacion.py` de Streamlit).

---

## 🎯 1. Objetivo Principal
Transformar el flujo secuencial de originación heredado en una interfaz **React (SPA)** reactiva, rápida y capaz de manejar múltiples facturas en un solo lote ("Batch"). El objetivo final es capturar la información del emisor, aceptante, detalles de las facturas y condiciones de descuento, para finalmente grabar la propuesta en Supabase con estado `ORIGINADO`.

---

## 🎨 2. Arquitectura de la Interfaz (`OriginacionTab.tsx`)

La interfaz estará dividida en tres grandes bloques funcionales (Cards/Paneles):

### Bloque 1: Participantes (Emisor y Aceptante)
*   **Buscador Inteligente:** Inputs con autocompletado (tipo combobox) para seleccionar clientes existentes (Emisores) y pagadores (Aceptantes) desde la base de datos de Factoring en Supabase.
*   **Creación Rápida:** Si el RUC no existe, botón rápido para añadir la razón social en un modal sin perder el contexto.

### Bloque 2: Lote de Facturas (Facturas a Descontar)
*   **Grid Dinámico (Tabla Editable):** Interfaz tipo hoja de cálculo para agregar múltiples facturas.
*   **Columnas Clave:**
    *   N° Factura.
    *   Fecha de Emisión.
    *   Fecha de Vencimiento / Pago Esperado (calcula días de crédito).
    *   Monto Total (Moneda base, usualmente Soles o Dólares).
*   **Carga Masiva (Opcional Futuro):** Lectura de XML de SUNAT para auto-completar el grid (Cavali/Factrack).

### Bloque 3: Condiciones Financieras (La Calculadora)
*   **Inputs Reactivos:**
    *   % Tasa de Avance (ej. 90%).
    *   % Tasa de Interés Mensual (ej. 2.5%).
    *   % Retenciones / Fondo de Garantía.
    *   Comisiones Fijas (Estructuración, Fotografías, etc).
*   **Resumen Financiero (Goal Seek):** Tarjetas de resumen que se actualizan instantáneamente (al estilo *useEffect* de React):
    *   **Monto Bruto Total:** Suma de facturas.
    *   **Monto Neto (Financiado):** Aplicando la tasa de avance.
    *   **Intereses Cobrados:** Calculados según los días al vencimiento ponderados.
    *   **ABONO REAL A DESEMBOLSAR:** Lo que recibe el cliente hoy.

---

## 🛠️ 3. Lógica y Flujo de Datos

### Integración Supabase
1.  **Lectura:** `getClientes()` para llenar los comboboxes.
2.  **Escritura:** Al presionar "Enviar a Aprobación":
    *   Generar un `proposal_id` único.
    *   Insertar un registro maestro en la tabla `factoring_operaciones` con estado `ORIGINADO`.
    *   Insertar registros detalle por cada factura en la tabla `factoring_facturas`.
    *   Registrar el evento en la línea de tiempo (`invoice_tracking_helpers` adaptado al backend o vía RLS).

### Almacenamiento de Documentos (Archivos)
*   Se incluirá una zona "Drag & Drop" para adjuntar el PDF de las facturas, Sustentos, Órdenes de Compra y las Letras.
*   Los archivos serán enviados a **Supabase Storage** (bucket `factoring_docs`), asociando las URLs generadas a la operación.

---

## 🚦 4. Plan de Ejecución Secuencial

1.  **Estructura Base (UI):** Maquetar los 3 bloques principales en `OriginacionTab.tsx` usando Tailwind CSS y componentes de `lucide-react` para iconos.
2.  **Estado Reactivo:** Implementar un estado complejo (ej. `useReducer` o estado anidado) para manejar el array dinámico de facturas y los recálculos en vivo.
3.  **Conexión a Base de Datos:** Crear los servicios `getEmisores()`, `getAceptantes()` y `crearOperacion()` en `factoringService.ts`.
4.  **Pruebas de Cálculo:** Verificar que la matemática del frontend cuadre a la perfección con la lógica financiera usada previamente en el motor monolítico de Python (`procesar_lote_desembolso_inicial`).
5.  **Subida (Upload):** Implementar el botón final de guardado con *loading states* y notificaciones *toast* de éxito.
