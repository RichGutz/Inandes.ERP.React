# 🏛️ GUÍA TÉCNICA: NEW LOOK INANDES (APEFAC DESIGN SYSTEM)

> **Versión:** 1.0 (Git Tag: `INANDES.NEW.LOOK`)  
> **Ámbito:** InAndes ERP React & Nuevos Desarrollos  
> **Propósito:** Estandarización visual, patrones de interacción, tokens de diseño y componentes UI ejecutivos.

---

## 1. 🎯 Filosofía Visual & Principios de Diseño

El **New Look InAndes** erradica definitivamente las interfaces planas, toscas y monolíticas heredadas de Streamlit, reemplazándolas por un estándar corporativo de grado bancario/institucional (**APEFAC Executive Design**):

1. **Zero Streamlit Look:** Sin cuadros negros toscos, sin botones cuadrados genéricos, sin fuentes desalineadas.
2. **Jerarquía Visual Clara:** Cada pantalla posee un Ribbon de auditoría superior, tarjetas semánticas (`glass-card`) y navegación por sub-tabs cohesiva.
3. **Tipografía Dual Estratégica:**
   - **UI & Texto:** `Inter` (sans-serif moderno, legible y estilizado).
   - **Finanzas & Cifras:** `JetBrains Mono` / `font-mono tabular-nums` (alineación perfecta de números monetarios, fechas de corte y códigos de fondo).
4. **Paleta Cromática Semántica & Armoniosa:** Tonos pasteles suaves para fondos de badges y colores saturados solo en puntos de atención y estados clave.

---

## 2. 🎨 Paleta Cromática Institucional

| Rol | Color Principal | Background Soft | Borde Sutil | Uso en el ERP |
| :--- | :--- | :--- | :--- | :--- |
| **Primary (Sky Blue)** | `#0284c7` (Sky 600) | `#f0f9ff` (Sky 50) | `#bae6fd` (Sky 200) | Identidad APEFAC, Botones PDF, Acciones primarias, Active Tabs |
| **Success (Esmeralda)** | `#059669` (Emerald 600) | `#ecfdf5` (Emerald 50) | `#a7f3d0` (Emerald 200) | Cierres completados, Excel Maestro, Oficializaciones en DB |
| **Soft Crimson (Rose)** | `#e11d48` (Rose 600) | `#fff1f2` (Rose 50) | `#fecdd3` (Rose 200) | Períodos Abiertos, Rechazos, Rollbacks, Alertas de eliminación |
| **Amber (Advertencia)** | `#d97706` (Amber 600) | `#fffbeb` (Amber 50) | `#fde68a` (Amber 200) | Modo Borrador, Simulaciones, Validaciones pendientes |
| **Indigo / Violeta** | `#4f46e5` (Indigo 600) | `#eef2ff` (Indigo 50) | `#c7d2fe` (Indigo 200) | Selector Rolodex A-Z, Tags de fondos concentradores |
| **Neutral Slate** | `#0f172a` (Slate 900) | `#f8fafc` (Slate 50) | `#e2e8f0` (Slate 200) | Textos principales, fondos de tarjetas y controles input |

---

## 3. 🧩 Tokens Globales de CSS (`src/styles/global.css`)

```css
/* Tarjeta Corporativa con Vidrio Satinado */
.glass-card {
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid #e2e8f0;
  border-radius: 1rem; /* rounded-2xl */
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.04), 0 2px 4px -2px rgba(0, 0, 0, 0.04);
}

.dark .glass-card {
  background: rgba(15, 23, 42, 0.88);
  border-color: #334155;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.25);
}

/* Fila de Tabla Interactiva */
.table-row-hover {
  transition: all 0.15s ease-in-out;
}
.table-row-hover:hover {
  background-color: #f8fafc;
}
.dark .table-row-hover:hover {
  background-color: rgba(30, 41, 59, 0.6);
}

/* Cifras Financieras */
.font-mono.tabular-nums {
  font-feature-settings: "tnum";
  font-variant-numeric: tabular-nums;
}
```

---

## 4. 🛠️ Módulo de Estilos & Design System (`src/features/mantenimiento/EstilosPage.tsx`)

Ubicado en la barra lateral bajo **Mantenimiento ➔ Estilos & Temas** (`mantenimiento_estilos`):

- **Conmutador de Modo:** Light Mode vs Dark Mode con persistencia en `localStorage`.
- **Selector de 7 Acentos de Marca:**
  1. `Sky Blue` (`#0284c7`) - Por defecto APEFAC
  2. `Esmeralda` (`#059669`)
  3. `Índigo Real` (`#4f46e5`)
  4. `Violeta Ejecutivo` (`#7c3aed`)
  5. `Carmesí Soft` (`#e11d48`)
  6. `Ámbar Dorado` (`#d97706`)
  7. `Slate Titanio` (`#475569`)
- **Densidad de Tablas:** Cómoda (14px padding) vs Compacta (8px padding).
- **Showcase en Vivo:** Permite probar botones, badges, modales y tablas interactivas en tiempo real.

---

## 5. 🏗️ Arquitectura de Sub-Pestañas (Sub-Tabs)

La navegación interior dentro de cada módulo sigue un formato tipo **Pill Navigation Bar**:

```tsx
<div className="flex items-center gap-2 p-1.5 bg-slate-100 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800 w-fit">
  {subTabs.map(tab => (
    <button
      key={tab.id}
      onClick={() => setActiveSubTab(tab.id)}
      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
        activeSubTab === tab.id
          ? 'bg-white dark:bg-[#1e293b] text-[#0284c7] dark:text-[#38bdf8] shadow-sm'
          : 'text-[#64748b] hover:text-[#0f172a] dark:text-[#94a3b8] dark:hover:text-[#f8fafc]'
      }`}
    >
      <tab.icon size={15} />
      <span>{tab.label}</span>
      {tab.count !== undefined && (
        <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono font-black bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
          {tab.count}
        </span>
      )}
    </button>
  ))}
</div>
```

---

## 6. 📊 Patrones UI Clave Implementados

### A. Calendario Anual de Cierres de 12 Meses (`retornos_react`)
- **Cabecera:** Ribbon con icono de calendario y selector de año mediante botones tipo pastilla (`[2024] [2025] [2026] [2027]`).
- **Cards de 12 Meses (Ene - Dic):**
  - **Indicador:** `MES 01` al `MES 12` en `font-mono`.
  - **Badges Semánticos:**
    - `● CERRADO`: Verde esmeralda suave (`bg-[#ecfdf5] text-[#059669] border-[#a7f3d0]`).
    - `● ABIERTO`: Carmesí suave no chillón (`bg-[#fff1f2] text-[#e11d48] border-[#fecdd3]`).
  - **Lista de Fondos Completa:** Cada mes muestra todos sus fondos asignados (`NSGPEN01`, `NSGPEN02`, `NSGPEN03`, `NSGUSD01`, `NSGUSD02`, `NSLCON01`).
  - **Selección Activa:** Resalte con borde `border-2 border-[#0284c7]` y sombra `shadow-md shadow-[#0284c7]/20` (sin degradados superiores molestos).

### B. Panel Operativo de Liquidación en 3 Columnas Horizontales
- **Zero Scroll:** Reduce el flujo vertical anterior de más de 600px a una sola fila horizontal de ~170px.
- **Flujo de Trabajo (Workflow):**
  - **Columna 1 (Configuración):** Selectores apilados de Fondo, Ciclo (Bimestre/Trimestre) y N° Período con fecha límite al pie.
  - **Columna 2 (Paso 1 · Auditoría):** Botón *"Descargar Excel Maestro"* (`#059669`) y Botón *"Descargar Reporte PDF"* (`#0284c7`) con spinners integrados.
  - **Columna 3 (Paso 2 · Persistencia):** Badge de estado oficial en DB, Botón *"Oficializar en Base de Datos"* (`#059669`) y Botón de *"Reversión / Rollback Seguro"*.

### C. Visores Duales de Documentos (EECC & Retenciones)
- **Barra de Modos:** Selector de pastillas para conmutar entre:
  - `🔲 Vista Dual 50/50` (dos pantallas lado a lado).
  - `📑 Solo EECC (100%)`.
  - `📜 Solo Retenciones 5% (100%)`.
- **Marcos IFrame:** Enmarcados en tarjetas `.glass-card` con barra de herramientas individual para abrir en nueva pestaña o descargar el PDF.

### D. Ledger Financiero & Timeline de Certificados
- **Historial de Eventos:** Pastillas cromáticas por tipo de movimiento (`APORTE`, `CAPITALIZACION`, `RETIRO`, `DEDUCCION`).
- **Cifras Contables:** Montos en `font-mono font-black tabular-nums text-right`.

---

## 7. 💻 Snippets Reutilizables para Nuevos Proyectos

### 1. Botón Ejecutivo APEFAC Primario
```tsx
<button className="h-10 px-4 rounded-xl text-xs font-black uppercase tracking-wider bg-[#0284c7] hover:bg-[#0369a1] text-white shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50">
  <FileText size={15} />
  <span>Acción Principal</span>
</button>
```

### 2. Botón Éxito / Excel
```tsx
<button className="h-10 px-4 rounded-xl text-xs font-black uppercase tracking-wider bg-[#ecfdf5] dark:bg-[#059669]/15 border border-[#a7f3d0] dark:border-[#059669]/30 text-[#059669] dark:text-[#34d399] hover:bg-[#d1fae5] shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer">
  <FileSpreadsheet size={15} />
  <span>Exportar Excel</span>
</button>
```

### 3. Select / Input Corporativo
```tsx
<div className="flex flex-col gap-1">
  <label className="text-[10px] font-black text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wider">
    Campo de Entrada
  </label>
  <input
    type="text"
    className="bg-white dark:bg-[#1e293b] border border-[#e2e8f0] dark:border-[#334155] rounded-xl py-2 px-3 text-xs font-semibold text-[#0f172a] dark:text-[#f8fafc] focus:outline-none focus:ring-2 focus:ring-[#0284c7]/20 focus:border-[#0284c7] shadow-xs transition-all"
    placeholder="Ingrese valor..."
  />
</div>
```

---

## 8. 📋 Checklist de Certificación para Nuevas Vistas

Antes de publicar cualquier nueva sub-pestaña o vista en el ERP, verificar:

- [ ] ¿Usa contenedores `.glass-card` con bordes `#e2e8f0` / `#334155`?
- [ ] ¿Los números de dinero y saldos usan `.font-mono tabular-nums`?
- [ ] ¿Los botones de Excel usan verde esmeralda `#059669` y los de PDF Sky Blue `#0284c7`?
- [ ] ¿Las píldoras de estado usan colores pasteles semánticos (verde cerrado, rojo suave abierto, ámbar borrador)?
- [ ] ¿El layout es responsivo y optimizado para evitar scroll vertical innecesario?
- [ ] ¿Compila con 0 errores TypeScript (`npm run build`)?
- [ ] ¿Desplegado en el VPS Contabo Coolify vía `git push origin main`?
