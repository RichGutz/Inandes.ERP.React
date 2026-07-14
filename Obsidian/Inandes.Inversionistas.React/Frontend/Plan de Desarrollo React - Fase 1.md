# 💻 Plan de Desarrollo React - Fase 1: Shell y Carga de Datos

Esta nota detalla el plan de implementación física del Frontend en **React + Vite (TypeScript)** para la migración del ERP de InAndes. Esta primera fase establece el "Shell" (contenedor de navegación) de la aplicación y la conexión SSL segura al Sandbox de base de datos Supabase.

---

## 🛠️ 1. Estructura Física del Proyecto (Worktree Creado)
Se ha inicializado y estructurado el directorio del proyecto con el siguiente esquema de carpetas y archivos base de configuración:

```
src/
├── assets/                  # Logos e imágenes de firmas locales
│   ├── logos/               # Directorio para logotipos de InAndes / EFI
│   └── firmas/              # Placeholders de firmas autorizadas de compliance
├── components/              # Componentes visuales reutilizables
│   ├── ui/                  # Componentes atómicos (Botones, Tablas Premium, Inputs)
│   └── layout/              # Estructura de la aplicación (Sidebar, Header)
├── context/                 # Estado global y contextos (Roles y Autenticación)
├── features/                # Módulos del CRM del ERP
│   ├── dashboard/           # KPIs del Patrimonio y AUM de Fondos
│   ├── inversionistas/      # Ficha del partícipe y tab de retornos
│   ├── contratos/           # Contratos, certificados y ledger de eventos
│   ├── fondos/              # Fondos, tasas y cálculo de Valor Cuota V25
│   ├── asesores/            # Comisión de captación y mantenimiento V2
│   └── calculadora/         # Simulador de cotización financiera
├── hooks/                   # Custom hooks de react
├── services/                # Conexiones SSL HTTPS a la API de Supabase
├── styles/                  # Estilos globales y tokens de diseño en Vanilla CSS
│   ├── variables.css        # Tokens HSL (Paleta de color premium y tipografías)
│   └── global.css           # Clases comunes (Glass panels, botones y tablas premium)
└── utils/                   # Utilidades del Core Financiero y matemático
    ├── mathHelpers.ts       # Redondeos contables estrictos y formateo de divisas
    └── dateHelpers.ts       # Diferencia de días y cálculo de cortes contables (getClosestCutAfter)
```

---

## 🚀 2. Componentes a Desarrollar en la Fase 1

Para establecer la base funcional del nuevo frontend, crearemos los siguientes archivos clave:

### A. Capa de Servicios y Conexión de Datos (Supabase)
*   **`src/services/inversionistasService.ts`**: Servicio en TypeScript que encapsula las llamadas HTTPS seguras (SSL) al cliente Supabase. Implementará las siguientes funciones:
    *   `getInversionistas()`: Obtiene todos los partícipes de la tabla `crm_inversionistas` ordenados alfabéticamente por primer apellido.
    *   `getInversionistaById(id)`: Devuelve los detalles individuales de compliance, datos personales y cuentas bancarias (PEN/USD).
    *   `upsertInversionista(payload)`: Guarda o actualiza los datos de la ficha personal del partícipe.

### B. Capa de Interfaz y Navegación (Shell Layout)
*   **`src/components/layout/Sidebar.tsx`**: Menú lateral dinámico que permite navegar entre las diferentes secciones del CRM utilizando el estado activo (`activeTab`). Renderiza iconos vectoriales interactivos (`lucide-react`).
*   **`src/components/layout/Header.tsx`**: Barra superior de la aplicación. Presenta el título del módulo activo, el perfil del usuario activo (ej. `jparra@inandes.com`) y un indicador de estado visual de la conexión SSL a la base de datos de Supabase (Verde si hay conexión exitosa).
*   **`src/components/layout/Layout.tsx`**: Componente estructurador que utiliza Grid CSS para envolver el `Sidebar` a la izquierda y el `Header` con el contenido a la derecha.

### C. Módulo de Vista de Partícipes
*   **`src/features/inversionistas/InversionistasPage.tsx`**: Página de visualización del portafolio de clientes. Al montarse:
    1.  Llama al método `getInversionistas()` del servicio de datos.
    2.  Muestra un loader visual en lo que se resuelve la promesa.
    3.  Presenta la lista de inversionistas en una **tabla premium** interactiva utilizando los estilos del Design System en Vanilla CSS.

### D. Enrutamiento y Punto de Entrada
*   **`src/App.tsx`**: Importa los estilos globales `global.css`, maneja el estado local del tab activo, provee los placeholders para las pantallas que se desarrollarán en fases posteriores y monta el contenedor `Layout`.
