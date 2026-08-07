# Plan de Desarrollo React - Fase 12: Dashboard y Análisis Gráfico Interactivo (Modelo Geeksoft)

## 📌 Contexto y Propósito
Este documento define la arquitectura y el diseño visual para transformar el módulo de **Dashboard** de `Inandes.ERP.React` en una herramienta de **Análisis Gráfico Interactivo de Alta Fidelidad**, tomando como referencia directa el modelo de **Análisis Gráfico de Geeksoft** (`https://forecast.geeksoft.tech/graphic-analysis` ubicado en `C:\Users\rguti\PETRAL.SMART.DASHBOARD\Desarrollo.Profesional\Geeksoft_Frontend`).

---

## 🎨 Mockup de Texto (Diseño de la Interfaz)

```
+-------------------------------------------------------------------------------------------------------------------+
|  📊 DASHBOARD DE FACTORING - ANÁLISIS GRÁFICO INTERACTIVO                                                        |
|  Gestión visual de volumen operado, rendimiento de cartera y analítica comparativa dinámicas                      |
+-------------------------------------------------------------------------------------------------------------------+
|                                                                                                                   |
|  [ 🎛️ PANEL DE CONTROL DE CONTROLES Y FILTROS GRÁFICOS COMBINADOS ]                                              |
|                                                                                                                   |
|  1. AGRUPAR POR:        [ (•) Empresa Emisora  ( ) Pagador/Aceptante  ( ) Moneda (PEN/USD)  ( ) Estado ]          |
|  2. EJE PRINCIPAL (Y1): [ Monto Neto Abono  ▼ ]   TIPO: [ (•) Barras Apiladas  ( ) Barras Agrupadas  ( ) Línea ]  |
|  3. EJE SECUNDARIO(Y2): [ Tasa Interés Promedio % ▼ ] TIPO: [ (•) Línea Tendencia  ( ) Ninguno ]                  |
|  4. FILTROS RÁPIDOS:    [ Emisor: TODOS ▼ ]  [ Pagador: TODOS ▼ ]  [ Moneda: TODAS ▼ ]                              |
|                         [ Estado: TODOS / ORIGINADA / APROBADA / DESEMBOLSADA / EN PROCESO / LIQUIDADA / EN MORA ▼ ]|
|                                                                                                                   |
+-------------------------------------------------------------------------------------------------------------------+
|                                                                                                                   |
|  [ 📈 GRÁFICO DINÁMICO INTERACTIVO ECHARTS (EJE DUAL) ]                                                           |
|                                                                                                                   |
|   (S/ / $)                                                                                            (%)         |
|   300,000 |-------------------------------------------------------------------------------*------ 3.5%        |
|           |       |███|                                                   |███|         *             |       |
|   200,000 |-------|███|-----------------------*---------------------------|███|------------------ 2.5%        |
|           |       |███|         *            |███|                        |███|                       |       |
|   100,000 |-------|███|--------|███|---------|███|---------*--------------|███|------------------ 1.5%        |
|           |  |███||███|        |███|         |███|        |███|           |███|                       |       |
|         0 +--+---+----+--------+---+---------+---+--------+---+-----------+---+------------------ 0.0%        |
|             Ene 2026            Feb 2026          Mar 2026           Abr 2026           May 2026            |
|                                                                                                                   |
|   LEYENDA DE EMISORES / DENSIDAD:                                                                                |
|   [■ TRANS STAR HERMANOS]  [■ OPERADOR LOGISTICO]  [■ PESQUERA EXALMAR]  [*-- Tasa Interés % (Eje Der)]          |
|                                                                                                                   |
+-------------------------------------------------------------------------------------------------------------------+
|                                                                                                                   |
|  [ 📊 MATRIZ RESUMEN DE INDICADORES CLAVE (KPIS DE PERFORMANCE) ]                                                 |
|  +---------------------------+---------------------------+---------------------------+-------------------------+  |
|  | Volumen Total Operado     | Total Abonos Netos        | Margen Interés Ganado     | Rendimiento Promedio    |  |
|  | S/ 2,450,800.00           | S/ 2,328,260.00           | S/ 73,524.00              | 3.15% Mensual           |  |
|  +---------------------------+---------------------------+---------------------------+-------------------------+  |
+-------------------------------------------------------------------------------------------------------------------+
```

---

## 🎨 Look & Feel y Diseño Visual (Consistencia Corporativa)

Para garantizar **100% de consistencia visual** con los demás módulos (`Originación`, `Aprobaciones`, `Desembolsos`, `Liquidaciones` y `Repositorio`), el Dashboard utilizará estrictamente los mismos tokens y estilos visuales de Tailwind CSS:

### 1. Paleta de Colores y Tarjetas Corporativas:
- **Contenedores Principales y Tarjetas:** `bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs`.
- **Panel de Filtros y Controles:** `bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs`.
- **Fondos de Controles e Inputs:** `bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl`.
- **Badges de Estado Financiero Unificados:**
  - `Originada`: `bg-amber-100 text-amber-800 border-amber-200`
  - `Aprobada`: `bg-emerald-100 text-emerald-800 border-emerald-200`
  - `Desembolsada`: `bg-blue-100 text-blue-800 border-blue-200`
  - `Liquidada`: `bg-indigo-100 text-indigo-800 border-indigo-200`
  - `🔴 En Mora`: `bg-red-100 text-red-800 border-red-200`

### 2. Tipografía y Jerarquía Visual:
- **Títulos Principales:** `text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider`.
- **Subtítulos y Leyendas:** `text-xs font-bold text-slate-600 dark:text-slate-400`.
- **Valores Monetarios y KPIs:** `text-2xl font-black text-slate-900 dark:text-white font-mono`.

### 3. Estilo del Canvas Gráfico (Apache ECharts):
- **Fondo Transparente Adaptativo:** No usamos cajas rígidas de fondo blanco; se integra dinámicamente tanto en modo claro como en tema oscuro.
- **Grillas Tenues:** Líneas de cuadrícula discretas (`#F1F5F9` en modo claro / `#1E293B` en modo oscuro).
- **Tooltip Flotante Corporativo:** Tarjeta con sombra suave `shadow-xl`, borde sutil y tipografía bold mostrando los valores en formato monetario (`S/` o `$`) y porcentaje (`%`).
- **Paleta de Colores de Series:**
  - Azul Corporativo InAndes (`#0089CF` / `#3B82F6`)
  - Esmeralda Finanzas (`#10B981`)
  - Ámbar Evaluación (`#F59E0B`)
  - Magenta Accent (`#8B5CF6`)
  - Rojo Mora (`#EF4444`)

---

## 🏗️ Arquitectura Técnica de Implementación

1. **Librería Gráfica:**
   - **`echarts-for-react`** y **`echarts`** para renders fluidos de alto rendimiento, escalado vectorial SVG/Canvas, tooltip flotante corporativo y eje dual Y1/Y2.

2. **Componentes a Crear / Actualizar:**
   - [DashboardTab.tsx](file:///c:/Users/rguti/Inandes.ERP.React/src/features/factoring/components/DashboardTab.tsx): Reemplazo de la vista simple por el Dashboard de Análisis Gráfico Completo.
   - `InteractiveFactoringChart.tsx`: Componente de renderizado de ECharts dinámico especializado en métricas financieras de Factoring (Monto Bruto, Abono Neto, Interés de Descuento, Tasa Promedio, Días de Crédito).

3. **Métricas Disponibles en el Panel:**
   - **Eje Y1 (Metricas de Volumen / Monto):**
     - `Monto Neto Abono` (S/ y $)
     - `Monto Bruto Total Facturado` (S/ y $)
     - `Interés de Descuento Ganado` (S/ y $)
     - `Cantidad de Operaciones` (Unidades)
   - **Eje Y2 (Indicadores de Rendimiento / %):**
     - `Tasa de Interés Compensatoria Promedio (%)`
     - `Días Promedio de Crédito / Plazo`
     - `Porcentaje de Mora o Retraso (%)`
     - `Ninguno` (Desactivar Eje Y2)

4. **Filtros Simultáneos:**
   - Agrupamiento dinámico (`vessel`/`emisor`, `aceptante`, `moneda`, `estado`).
   - Rango de Fechas (Filtrado por mes/año).
   - Paleta de Colores HSL adaptativa para empresas y dark mode.

---

## 🎯 Plan de Verificación

1. **Compilación de Código:** Ejecutar `npm run build` en PowerShell para validar 0 errores de compilación TypeScript/React.
2. **Pruebas en Servidor VPS:** Compilar y desplegar a `/var/www/inandes` en el VPS y verificar refresco en `https://inandes.react.geeksoft.tech/`.
