# 🏢 BITÁCORA DE ARQUITECTURA Y GUÍA DE MIGRACIÓN: STREAMLIT ➜ REACT

Este documento sirve como puente técnico e histórico para cualquier agente de IA o desarrollador que trabaje en la migración del **CRM InAndes** desde Streamlit hacia una SPA moderna en **React + Vite**.

---

## 📌 1. Historia de lo que hemos hecho (Bitácora de Despliegue)

Hoy se realizó la estabilización del entorno de producción en el **VPS de Hostinger** (`inandesh.geeksoft.tech` / IP `91.108.125.253`). Se resolvieron los siguientes conflictos críticos:

### A. Estructura y Confusión de Repositorios
*   **El Origen**: Existen dos repositorios locales:
    1.  `mini_erp_v2_antigravity` (Contiene tanto la lógica unificada de **Factoring** como de **CRM**).
    2.  `ERP_Inandes` (Repositorio exclusivo para el desarrollo del **CRM Independiente**).
*   **El Error**: Se intentó forzar la subida de la rama unificada `FUNCIONAL_PRE_SPLIT.04.04.26` al VPS. Esto sobreescribió la estructura del servidor y rompió el punto de acceso (`ExecStart` de systemd), mezclando las rutas de Factoring con las del CRM.
*   **La Solución**: Volvimos a sincronizar el VPS con la rama **`FUNCIONAL.10.04.2026`** de `ERP_Inandes` (commit `00cd73c`). Esto restauró la arquitectura donde la aplicación corre exclusivamente el CRM aislado a través del script unificado de entrada **`00_Gateway.py`**.

### B. El Laberinto de Supabase y Permisos RLS
*   **El Cambio**: El identificador de base de datos de Supabase migró:
    *   *Antiguo*: `bqyouppbgylodvdbctcf` (en pausa/inactivo).
    *   *Nuevo*: `vinjzmqwaqsqzoigqpxk`.
*   **El Bloqueo RLS**: Al intentar autenticar usuarios nuevos o existentes con la clave anónima (`anon`), las políticas de seguridad a nivel de fila (RLS) rechazaban las inserciones en la tabla `authorized_users` (dando error `42501`).
*   **La Solución**: Se configuraron tanto el `.env` como el `.streamlit/secrets.toml` en el VPS con la nueva URL y la clave de rol de servicio (`service_role`), lo que permite el bypass de RLS para el flujo administrativo de Streamlit. Tu usuario `rgutil@gmail.com` ya quedó registrado y activo como `admin`.

### C. Nginx y el Bloqueo de Google OAuth (COOP)
*   **El Síntoma**: Al hacer clic en "Iniciar Sesión con Google", la ventana emergente (popup) se abría pero se quedaba en blanco y la consola del navegador reportaba:
    `Cross-Origin-Opener-Policy policy would block the window.location call`
*   **El Diagnóstico**: Streamlit inyectaba por defecto cabeceras de aislamiento que impedían a la ventana de Google comunicarse de vuelta con la aplicación web principal.
*   **La Solución**: Modificamos la configuración de Nginx en `/etc/nginx/sites-enabled/erp_inandes` agregando:
    ```nginx
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    add_header Cross-Origin-Opener-Policy "unsafe-none" always;
    add_header Cross-Origin-Embedder-Policy "unsafe-none" always;
    ```
    Esto deshabilitó las restricciones COOP locales en el proxy inverso, habilitando la autenticación de Google de forma limpia.

---

## 🏗️ 2. Arquitectura Actual en Producción (Hostinger VPS)

El estado operativo del CRM en el VPS de Hostinger es el siguiente:
*   **Ruta del Proyecto**: `/opt/erp_inandes`
*   **Servicio Systemd**: `erp_inandes.service`
*   **Configuración del Servicio**:
    *   `WorkingDirectory=/opt/erp_inandes`
    *   `ExecStart=/opt/erp_inandes/venv/bin/streamlit run 00_Gateway.py --server.port=8501`
    *   `EnvironmentFile=/opt/erp_inandes/.env`
*   **Archivos de Credenciales Activos**:
    *   `/opt/erp_inandes/.env` (Leído por Python a través de `load_dotenv()`).
    *   `/opt/erp_inandes/CRM_Inandes/.streamlit/secrets.toml` (Leído de forma nativa por Streamlit).

---

## 🚀 3. Guía para la Migración de Módulos (Streamlit ➜ React)

El objetivo final es migrar la lógica financiera y operativa del CRM a una aplicación moderna de **React + Vite** (ubicada localmente en `C:\Users\rguti\Inandes.Inversionistas.React`). 

Cualquier nuevo agente debe leer, analizar y traducir los siguientes componentes clave en `/opt/erp_inandes/CRM_Inandes/`:

### A. El Motor de Base de Datos e Integración (Capa de Datos)
*   **Ubicación**: `CRM_Inandes/src/data/supabase_repository.py`
*   **Función**: Contiene todas las consultas SQL y llamadas a Postgres para partícipes, contratos, eventos y estados.
*   **Objetivo React**: Traducir estas consultas a llamadas a través de la SDK de Supabase para JavaScript (`@supabase/supabase-js`), estructuradas en servicios en TypeScript (ej. `src/services/supabaseClient.ts` y `src/services/investorService.ts`).

### B. Los Módulos Clave del Negocio (Capa de Presentación)
Ubicados en `CRM_Inandes/modules/`, deben ser analizados para recrear su flujo en componentes de React:
1.  **`19_CRM_Fondos.py` (Gestión de Fondos)**
    *   *Lógica*: Administra las tasas base, plazos de amortización y las reglas del "Valor Cuota" para los fondos (`NSGPEN01`, `NSGPEN02`, `NSGPEN03`, `NSGUSD01`, `NSGUSD02`, `NSLCON01`).
2.  **`17_CRM_Inversionistas_v40.py` (Gestión de Partícipes)**
    *   *Lógica*: Perfiles, cuentas bancarias en soles y dólares, asesores asignados y la visualización histórica de sus retornos devengados.
3.  **`32_CRM_Contratos.py` (Creación y Aprobación)**
    *   *Lógica*: Flujo de registro del contrato físico, firma y emisión del certificado. Al aprobarse, gatilla el evento inicial en el ledger.
4.  **`33_CRM_Certificados.py` y `34_CRM_Deducciones.py` (El Ledger)**
    *   *Lógica*: Registra los incrementos (Aumentos de Capital) y deducciones (Rescates, Penalizaciones). Es la bitácora financiera transaccional de cada cliente.

### C. El Motor Financiero de Intereses y Cierre (Capa de Negocio)
*   **Ubicación**: `CRM_Inandes/modules/35_CRM_Motor.py` y los scripts dentro de `CRM_Inandes/scripts_cuotas/` (motores de cálculo V25, V26, V32).
*   **Lógica Crítica**:
    *   Cálculo de intereses diarios con base 360.
    *   **Tramo A / Tramo B**: Lógica de cálculo cuando hay un rescate parcial. El Tramo A calcula intereses sobre el capital original usando una tasa de castigo (Waiver) desde el origen hasta el día del rescate. El Tramo B calcula intereses con la tasa pactada original sobre el capital remanente desde el día del rescate hasta el fin del periodo.
    *   Concatena y agrupa múltiples cotitulares (hasta 4 inversionistas por contrato).
*   **Objetivo React**: Migrar este motor a funciones de TypeScript utilitarias puras (ej. `src/utils/financialCalculator.ts`) para simulaciones del lado del cliente, y mantener los cierres masivos ejecutándose en base a datos sólidos del backend.

---

## 🛠️ 5. Reglas del Protocolo de Git

Para evitar volver a mezclar ramas o perder el orden en futuros despliegues al VPS, el flujo de Git para el CRM debe limitarse estrictamente a:
1.  **Trabajar localmente** en tu rama de desarrollo.
2.  **Hacer push** a la rama `FUNCIONAL.10.04.2026` del repositorio `ERP_Inandes`.
3.  **En el VPS**, hacer checkout a esa misma rama y ejecutar:
    ```bash
    git fetch origin
    git reset --hard origin/FUNCIONAL.10.04.2026
    systemctl restart erp_inandes.service
    ```
