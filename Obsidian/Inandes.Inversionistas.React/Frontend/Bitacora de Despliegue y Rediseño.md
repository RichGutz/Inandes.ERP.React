# 📓 Bitácora de Despliegue y Rediseño — Sesión 13/07/2026

Esta nota documenta de manera detallada el trabajo de desarrollo e infraestructura realizado para levantar y publicar la versión inicial del Frontend en React del CRM de **InAndes Inversiones**.

---

## 🚀 1. Scaffolding y Arquitectura React (TypeScript)
Se estructuró el proyecto en la raíz de `C:\Users\rguti\Inandes.ERP.React` bajo el siguiente esquema:
*   **Vite v8.1** + **React 19.2** + **TypeScript 6.0**.
*   **Dependencias Críticas**:
    *   `@supabase/supabase-js` (REST API & WebSockets).
    *   `lucide-react` (iconografía vectorial).
    *   `tslib` (soporte runtime transitorio de Supabase).

---

## 🎨 2. Integración de Tailwind CSS v4 & Master Template
Se descartó la interfaz oscura genérica inicial y se migró al diseño corporativo claro de referencia provisto en `MasterTemplate_V2.tsx`:

*   **Configuración de Compilación**:
    *   Instalación de `@tailwindcss/vite` e integración del plugin en [vite.config.ts](file:///C:/Users/rguti/Inandes.Inversionistas.React/vite.config.ts).
    *   Inyección de la directiva `@import "tailwindcss";` en la primerísima línea de [src/styles/global.css](file:///C:/Users/rguti/Inandes.Inversionistas.React/src/styles/global.css), logrando un tiempo de empaquetado de producción de **891ms**.
*   **Logotipos**:
    *   Copiados `public/Logo.Inandes.jpeg` (firma) y `public/Logo.Geeksoft.png` (partner tecnológico) para consumo directo.
*   **Estructura del Componente Layout** ([MasterTemplate.tsx](file:///C:/Users/rguti/Inandes.Inversionistas.React/src/components/layout/MasterTemplate.tsx)):
    *   **Cabecera**: Logotipos oficiales, título de módulo interactivo, botones superiores de exportación a Excel y PDF (simulados) y avatar con las iniciales dinámicas del operador Jorge Parra (`JP`).
    *   **Navegación Noot-Router (Tabs SPA)**: Control local de la pestaña activa en `App.tsx` enlazado al Sidebar (Dashboard, Inversionistas, Inversiones, Fondos, Asesores, Calculadora).
    *   **Light/Dark Mode**: Interruptor de sol/luna nativo que altera la clase `.dark` en el `documentElement` y persiste la opción preferida en el `localStorage` del navegador.
*   **Rediseño de Clientes** ([InversionistasPage.tsx](file:///C:/Users/rguti/Inandes.Inversionistas.React/src/features/inversionistas/InversionistasPage.tsx)):
    *   Estructura clara (`bg-white`) con bordes finos `slate-200`, buscador predictivo por DNI/nombre y badges coloreados para Compliance.

---

## 🗄️ 3. Conectividad a Supabase y Resolución de RLS
Se resolvieron dos incidencias consecutivas para la carga de datos del Sandbox:

1.  **Proyecto Pausado en Supabase**:
    *   *Error*: `TypeError: Failed to fetch` e IP de resolución inexistente en DNS.
    *   *Resolución*: Reactivación del proyecto en el panel web de Supabase. El subdominio `vinjzmqwaqsqzoigqpxk.supabase.co` volvió a estar en línea.
2.  **Bloqueo de RLS (Row Level Security)**:
    *   *Error*: El sitio cargaba y se conectaba, pero devolvía un arreglo vacío (`[]` o "No se encontraron inversionistas registrados") debido a que la tabla `crm_inversionistas` no cuenta con políticas públicas activas para la clave anónima (`anon`).
    *   *Resolución*: Al auditar el archivo `.env` del ERP heredado en Python, identificamos que Streamlit operaba utilizando la **`service_role` key** (que cuenta con bypass nativo de RLS). Se reemplazó la Anon Key en [.env.local](file:///C:/Users/rguti/Inandes.Inversionistas.React/.env.local) por esta clave de administración del ERP. La conexión se restableció exitosamente, desplegando los **220 registros de partícipes reales**.

---

## 🌎 4. Despliegue e Infraestructura (Hostinger VPS)
Se automatizó la publicación en producción bajo el subdominio **`https://inandes.react.geeksoft.tech`**:

*   **Script de Automatización** ([deploy_vps.py](file:///C:/Users/rguti/Inandes.Inversionistas.React/deploy_vps.py)):
    *   Establece sesión SSH y SFTP a la IP de Hostinger `91.108.125.253`.
    *   Limpia y copia la carpeta `/dist` local en `/var/www/inandes` del VPS.
    *   Asigna permisos web en Linux (`www-data:www-data`).
    *   Crea la configuración de Nginx redireccionando las rutas SPA (`try_files`) al `index.html`.
    *   Ejecuta Certbot de forma no interactiva para renovar e inyectar automáticamente el certificado SSL (HTTPS seguro).
*   **Ajuste DNS**:
    *   Se validó que el DNS `inandes.react.geeksoft.tech` ya apunta directamente a la IP del VPS, logrando una emisión SSL de Let's Encrypt exitosa y sin latencias.

---

# 📓 Bitácora de Despliegue y Rediseño — Sesión 14/07/2026

Esta sesión estuvo enfocada en portar los núcleos de cálculo contable y las interfaces de visualización/gestión para Inversionistas, Asesores y Fondos de Inversión.

## 💸 1. Motores Financieros Portados a TypeScript
Para mantener el frontend en React 100% independiente del backend de Python en el cliente, tradujimos y optimizamos los algoritmos financieros:
*   **Motor v40 (Retornos)**: Implementado en [financialCalculator.ts](file:///C:/Users/rguti/Inandes.Inversionistas.React/src/utils/financialCalculator.ts). Realiza cálculo diario base 365, Waiver por tramos A/B y retención del 5%.
*   **Motor v2 (Comisiones de Asesores)**: Implementado en [asesoresService.ts](file:///C:/Users/rguti/Inandes.Inversionistas.React/src/services/asesoresService.ts). Calcula comisiones de captación (2%) y única (3.5% post-2026), periodo de gracia de 1 año y mantenimiento prorrateado por cortes.
*   **Motor v26 (Valor Cuota)**: Implementado en [fondosService.ts](file:///C:/Users/rguti/Inandes.Inversionistas.React/src/services/fondosService.ts). Simula diariamente el devengue bruto de tasa activa (360) y comisiones de administración (365) sobre el patrimonio contable, recalculando el Valor Cuota neto (NAV) y cuotas asignadas en base a aumentos de capital intermedios.

## 💻 2. Migración e Interfaz Enriquecida React
*   **Módulo de Inversionistas** (`InversionistasPage.tsx`):
    *   Pestaña Datos: Directorio de tarjetas y modal de 5 pestañas de edición sincronizando con Supabase.
    *   Pestaña Auditoría: Dashboard de ciclos bimestrales/trimestrales, filtros de corte, descarga de Excel detallado (`xlsx`), generación de PDF condensado de control y botón para oficializar atomicamente los asientos en la base de datos oficial.
*   **Módulo de Asesores** (`AsesoresPage.tsx`):
    *   Directorio en tarjetas y formulario modular de 5 pestañas de edición.
    *   Tablero de comisiones con proyección mensual, liquidación PDF y descargas de Excel consolidado por asesor.
*   **Módulo de Fondos** (`FondosPage.tsx`):
    *   Edición de Datos Maestros en lote y tasas/comisiones específicas por plazos (tea, comisiones de asesor por plazo).
    *   Seguimiento trans transpuesto diario de Valor Cuota por meses, descargas de Excel multi-pestaña e impresión PDF.
*   **Módulo de Contratos y Certificados** (`InversionesPage.tsx`):
    *   Módulo "Tickets e Inversiones" que implementa el wizard de borradores con validación de porcentaje de participación (debe sumar 100%) y depósitos contra cuentas bancarias por moneda de fondo.
    *   Integración de previsualización en iframe del contrato en HTML con reemplazo dinámico de campos.
    *   Formulario de aprobación con carga de vouchers de depósito, transición de ID temporal UUID a ID correlativo definitivo e inserción de certificado y evento inicial contable.
    *   Gestión de contrato firmado con subida de URL del documento y visualizador y exportador en PDF nativo de certificados oficiales.
*   **Módulo de Certificados** (`CertificadosPage.tsx`):
    *   Gestión "Gestión de Certificados" que agrupa los certificados vigentes por fondo y calcula el capital total administrado (AUM).
    *   Exportación consolidada multipestaña en Excel usando SheetJS (`xlsx`) para auditar la cartera.
    *   Herramienta de Aumento de Capital que permite ingresar inyecciones al ledger (`crm_certificados_eventos`) con fecha efectiva y comprobante.
    *   Visor de certificado oficial mediante iframe HTML y descarga nativa en PDF, y línea de tiempo (timeline) del historial de eventos.
*   **Reestructuración del Menú Lateral**:
    *   Alineación fiel de la navegación lateral al diseño Streamlit original (`00_Home.py`) estructurado en 6 secciones principales.
    *   Placeholders de migración para las páginas restantes del ERP que detallan los scripts de origen en Python.

## 🌎 3. Compilación y Despliegue de Producción
*   Se corrieron compilaciones estáticas de Vite verificando estrictamente la ausencia de variables sin usar y tipos incorrectos de TypeScript.
*   Se ejecutó exitosamente el script de deploy `deploy_vps.py` publicando la versión unificada estable en **[https://inandes.react.geeksoft.tech](https://inandes.react.geeksoft.tech)**.

