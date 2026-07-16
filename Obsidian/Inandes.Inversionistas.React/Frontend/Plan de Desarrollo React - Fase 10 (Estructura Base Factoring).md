# 🚀 Plan de Desarrollo React - Fase 10 (Estructura Base Factoring)

## 📌 Objetivo de la Fase
Establecer la arquitectura fundacional, modular y enrutada del nuevo módulo de **Factoring** dentro de la aplicación React (SPA), reemplazando el esquema heredado de Streamlit (donde cada paso era una página independiente). 

## 🗺️ Visión Arquitectónica (Máquina de Estados)
Se ha diseñado el módulo de Factoring como un "Centro de Control" (Wrapper) basado en **Bandejas (Tabs)** que representan los estados del ciclo de vida de la factura:
1. **Originación:** Simulador en tiempo real.
2. **Aprobación:** Bandeja de pendientes (Estado: `ORIGINADO`).
3. **Desembolso:** Bandeja de tesorería (Estado: `APROBADO`).
4. **Liquidación:** Bandeja de cobranzas (Estado: `DESEMBOLSADO`).

## 🛠️ Trabajos Realizados en esta Fase

### 1. Creación del Servicio de Base de Datos
- **Archivo:** `src/services/factoringService.ts`
- **Detalle:** Se crearon las interfaces TypeScript (`PropuestaFactoring`, `InvoiceStatusRegistry`) para apuntar a la base de datos clonada. Se implementaron los métodos `getPropuestasActivas()` y `getInvoiceStatus(estado)`.

### 2. Implementación de los Componentes Modulares (Pestañas)
- **Ruta:** `src/features/factoring/components/`
- **Archivos Creados (Independientes):**
  - `DashboardTab.tsx`
  - `OriginacionTab.tsx`
  - `AprobacionesTab.tsx`
  - `DesembolsosTab.tsx`
  - `LiquidacionesTab.tsx`
  - `RepositorioTab.tsx`
- **Ventaja:** Cada componente maneja su propia lógica y UI. Un error en Liquidaciones no afecta a la Originación.

### 3. Componente Wrapper (El Cascarón)
- **Archivo:** `src/features/factoring/FactoringPage.tsx`
- **Detalle:** Un cascarón ultra-ligero que utiliza el `<TabView>` global para renderizar las 6 pestañas mencionadas arriba sin recargar la página web.

### 4. Integración al Sistema Central
- **App.tsx:** Se añadió el ruteo hacia `FactoringPage` a través de la variable de estado `factoring_core`.
- **Sidebar.tsx:** Se inyectó el menú principal `Centro de Factoring` dentro de la sección "ERP - Factoring", brindando un acceso rápido.

## 🔜 Próximos Pasos (Fase 11)
- Desarrollar la UI profunda (DataTables con Shadcn) para la bandeja de `AprobacionesTab` y conectar el botón de "Aprobar Factura" con la mutación hacia Supabase.
