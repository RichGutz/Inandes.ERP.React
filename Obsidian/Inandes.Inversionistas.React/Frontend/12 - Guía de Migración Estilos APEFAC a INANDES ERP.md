# 12: Guía de Migración de Estilos APEFAC Risk Core a INANDES ERP React

**Fecha de Creación**: 15 de Agosto de 2026  
**Proyecto Origen**: APEFAC Risk Core (Geeksoft Engine)  
**Proyecto Destino**: INANDES ERP React (`C:\Users\rguti\Inandes.ERP.React`)  
**Estado**: Guía Técnica Oficial de Portabilidad UI/UX  

---

## 🧠 1. Visión General de la Arquitectura UI/UX

El sistema de diseño de **APEFAC Risk Core** es 100% modular, ultraliviano y no depende de frameworks pesados de componentes (como Material-UI o Ant Design). Utiliza una paleta corporativa de alta visibilidad, componentes en tarjetas ejecutivas de bordes suavizados (`12px`), tipografía híbrida (*Inter* + *JetBrains Mono*) e iconografía vectorial pura con `lucide-react`.

### 💎 Principios Fundamentales del Look & Feel:
1. **Cero Dependencia Compleja**: Basado en variables de CSS puras (`index.css`) + React V18 + Tailwind / Style Tokens.
2. **Tarjeta Ejecutiva Canónica (Executive Card)**:
   ```css
   background: #ffffff;
   border: 1px solid #e2e8f0;
   border-radius: 12px;
   padding: 20px 24px;
   box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
   ```
3. **Jerarquía Visual Extra BOLD**: Títulos de pestañas y botones de acción con `font-weight: 800 (Extra Bold)` de alto contraste (`#0f172a` y `#0284c7`).
4. **Respuesta en 0ms**: Transición entre vistas en memoria sin recargas de página.

---

## 🎨 2. Paleta de Colores y Tokens Oficiales

```css
:root {
  /* Fondos */
  --bg-app: #f8fafc;
  --bg-card: #ffffff;
  --bg-subtle: #f1f5f9;
  
  /* Colores de Marca */
  --color-primary: #0284c7;       /* Sky Blue APEFAC */
  --color-primary-hover: #0369a1;
  --color-dark: #0f172a;          /* Deep Slate Header */
  --color-success: #059669;       /* Emerald Green Vigente */
  --color-warning: #d97706;       /* Amber Mora 16-30d */
  --color-danger: #e11d48;        /* Rose Mora Crítica */
  
  /* Textos y Bordes */
  --text-main: #0f172a;
  --text-muted: #64748b;
  --border-light: #e2e8f0;
  
  /* Tipografías */
  --font-sans: 'Inter', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
}
```

---

## 🛠️ 3. Paso a Paso para la Migración en 15 Minutos

### 📦 Paso 1: Instalación de Dependencias de Iconos y Gráficos en INANDES ERP
Ejecutar en la terminal de `c:\Users\rguti\Inandes.ERP.React`:
```bash
npm install lucide-react echarts echarts-for-react
```

### 📄 Paso 2: Importar Variables Globals en `index.css`
Copiar las reglas de fuentes de Google Fonts e importar las variables CSS de APEFAC en el `src/index.css` de Inandes ERP:
```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@500;700;800&display=swap');

body {
  margin: 0;
  background-color: #f8fafc;
  font-family: 'Inter', sans-serif;
  color: #0f172a;
  -webkit-font-smoothing: antialiased;
}
```

### 🧱 Paso 3: Plantilla del Header Corporativo Superior (`Header.tsx`)
Reemplazar el Header antiguo de Inandes por la estructura limpia de APEFAC:
```tsx
import React from 'react';
import { Building2, LogOut } from 'lucide-react';

export default function Header({ user, onLogout }) {
  return (
    <header style={{
      background: '#ffffff',
      borderBottom: '1px solid #e2e8f0',
      padding: '0 24px',
      height: '74px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      position: 'sticky',
      top: 0,
      zIndex: 100,
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
    }}>
      {/* Izquierda: Branding */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <img src="/assets/logo_inandes.png" alt="Inandes ERP" style={{ height: '44px', objectFit: 'contain' }} />
        <div style={{ width: '1px', height: '32px', backgroundColor: '#e2e8f0' }} />
        <span style={{ fontSize: '12px', fontWeight: '800', color: '#0f172a' }}>INANDES FACTORING</span>
      </div>

      {/* Derecha: Usuario y Salir */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '4px 12px', background: '#f8fafc', borderRadius: '24px', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '12px', fontWeight: '800', color: '#0f172a' }}>{user?.name || 'Usuario Inandes'}</div>
        </div>
        <button onClick={onLogout} style={{ background: '#fef2f2', border: '1px solid #fecdd3', color: '#e11d48', padding: '7px 10px', borderRadius: '8px', cursor: 'pointer', fontWeight: '700' }}>
          <LogOut size={14} /> Salir
        </button>
      </div>
    </header>
  );
}
```

---

## 📊 4. Conclusión & Facilidad de Adopción

* **Follón Zero**: El sistema de diseño es **completamente autónomo**, libre de dependencias complejas y con componentes modulares desacoplados.
* **Resultado**: INANDES ERP adoptará la misma estética ultra ejecutiva, con tarjetas bordeadas en `#e2e8f0`, botones BOLD en `#0284c7` e iconografía `lucide-react` en menos de 15 minutos.
