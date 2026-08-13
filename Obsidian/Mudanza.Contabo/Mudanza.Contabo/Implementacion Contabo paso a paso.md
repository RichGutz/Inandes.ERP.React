# 🛠️ Implementación Contabo Paso a Paso

> **BITÁCORA Y REGISTRO EN TIEMPO REAL DE EJECUCIÓN:** Registro detallado paso a paso de cada comando, fase, script y resultado ejecutado durante la migración del ERP InAndes al VPS Contabo (`169.58.168.107`).

---

## 📌 Datos de Infraestructura Objetivo
- **Proveedor:** Contabo (Cloud VPS Plus 6 - Hub Europe)
- **IP Pública:** `169.58.168.107`
- **Recursos:** 11 GB RAM / 290 GB SSD NVMe / 4 vCPU
- **Sistema Operativo:** Ubuntu 22.04 LTS (Kernel 6.8.0 64-bit)
- **Dashboard Coolify:** `http://169.58.168.107:8000`
- **Credenciales Privadas:** `C:\Users\rguti\.gemini\antigravity-ide\scratch\contabo_credentials.json` (Fuera de Git)

---

## 🗓️ Bitácora de Pasos Ejecutados

### ✅ Paso 1: Configuración de Reglas y Almacén de Credenciales
- **Fecha:** 13 de Agosto de 2026
- **Acciones:**
  - Se agregó la **Regla 12** en `.agents/AGENTS.md` definiendo la ubicación centralizada de credenciales.
  - Se creó el archivo privado `C:\Users\rguti\.gemini\antigravity-ide\scratch\contabo_credentials.json` para alojar claves SSH y accesos del panel sin exponerlos en Git.
  - Se actualizó el procedimiento de despliegue en `Obsidian/Inandes.Factoring.React/06. Procedimientos de Despliegue y Base de Datos.md`.

### ✅ Paso 2: Reinstalación Limpia de Ubuntu 22.04 LTS en Contabo
- **Acciones:**
  - Se seleccionó instalación limpia de `Ubuntu 22.04 LTS` sin paneles comerciales (Plain OS).
  - Se estableció la contraseña de root y se verificó la conectividad SSH vía script `test_contabo_ssh.py`.

### ✅ Paso 3: Hardening del Sistema Operativo & Memoria SWAP (8GB)
- **Script Ejecutado:** `setup_contabo_vps.py`
- **Acciones:**
  - Creación y activación de memoria SWAP de 8GB (`/swapfile`).
  - Configuración de `vm.swappiness=20` en `/etc/sysctl.conf` para optimizar rendimiento de base de datos y contenedores.
  - Verificación de espacio libre: 290 GB SSD (2.2 GB utilizados).

### ✅ Paso 4: Configuración del Firewall (UFW)
- **Acciones:**
  - Instalación de paquetes de red (`ufw`, `curl`, `wget`, `git`, `htop`).
  - Apertura de puertos esenciales:
    - `22/tcp` (Conexión SSH segura)
    - `80/tcp` (Tráfico HTTP web)
    - `443/tcp` (Tráfico HTTPS cifrado SSL)
    - `8000/tcp` (Panel de Administración Coolify)
  - Activación del Firewall UFW.

### ✅ Paso 5: Instalación de Coolify v4 (Docker + Traefik Engine)
- **Acciones:**
  - Ejecución del script oficial de Coolify (`curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash`).
  - Instalación y verificación del motor **Docker v29.7.2**.
  - Despliegue y salud de la suite **Coolify v4.3.2**.
  - Dashboard web activo y escuchando en `http://169.58.168.107:8000`.

### ✅ Paso 6: Registro de Cuenta Administrador en Coolify
- **Acciones:**
  - Creación de cuenta de Administrador Principal en `http://169.58.168.107:8000`.
  - Configuración del servidor local (`This machine`) como host principal de despliegue.

### ✅ Paso 7 & 8: Inicio de Despliegue de Supabase Self-Hosted (1-Click)
- **Acciones:**
  - Creación del proyecto `InAndes-ERP` en Coolify.
  - Selección e instalación del servicio integrado **Supabase Self-Hosted**.
  - Descarga y despliegue de la pila Compose (15 microservicios).

### ✅ Paso 9: Vinculación Exitosa de GitHub App
- **Fecha:** 13 de Agosto de 2026
- **Acciones:**
  - Creación y autorización de la GitHub App en Coolify.
  - Permisos otorgados al repositorio oficial `RichGutz/Inandes.ERP.React`.
  - Auto-Deploy por Webhook en `git push origin main` 100% configurado.

### ✅ Paso 10: Migración Completa de Esquemas y Datos (`pg_dump` ➔ Contabo Postgres)
- **Fecha:** 13 de Agosto de 2026
- **Acciones:**
  - Se extrajeron las **22 tablas de producción** desde Supabase Cloud (`egvcinsbyropumybatdf`).
  - **Conteo de Registros Migrados 1:1:**
    - `propuestas`: 159 registros
    - `crm_inversionistas`: 220 registros
    - `crm_contratos`: 187 registros
    - `crm_certificados_eventos`: 377 registros
    - `EMISORES.ACEPTANTES`: 68 registros
    - `crm_asesores`: 19 registros
    - `crm_fondos`: 17 registros
    - `authorized_users`: 3 registros
    - `auditoria_eventos`: 21 registros
  - Se generó y ejecutó el dump SQL (`1.37 MB`, `1,114` sentencias SQL) dentro del contenedor de PostgreSQL en Contabo.
  - Verificación exitosa: Las 22 tablas existen y están cargadas en el esquema `public` de Contabo.

---

### ✅ Paso 11: Inicio del Despliegue de React 19 en Coolify (CI/CD Auto-Deploy)
- **Fecha:** 13 de Agosto de 2026
- **Acciones:**
  - Creación del recurso de aplicación en Coolify vinculado a `RichGutz/Inandes.ERP.React` (Rama `main`).
  - Ejecución del primer Build y Deploy automático en el VPS de Contabo (`169.58.168.107`).
  - Compilación e inyección de assets estáticos React 19 + Vite.

### ✅ Paso 13 & 14: Asignación de Subdominio HTTPS y Verificación (200 OK)
- **Fecha:** 13 de Agosto de 2026
- **Acciones:**
  - Creación de Registro DNS Tipo A `inandes` ➔ `169.58.168.107` (TTL 300s).
  - Configuración FQDN en Coolify: `https://inandes.geeksoft.tech`.
  - Certificado SSL Let's Encrypt generado y emitido automáticamente por Traefik.
  - **Verificación Exitosa (200 OK):** La aplicación React 19 responde en `https://inandes.geeksoft.tech` con HTML e íconos oficial de Geeksoft.

---

### ✅ Paso 12 (Fase Preparatoria & Código): Dockerización del Backend FastAPI (`inandes-api`)
- **Fecha:** 13 de Agosto de 2026
- **Acciones Realizadas:**
  1. **Dockerfiles:** Creación de `Dockerfile` en raíz y `backend/Dockerfile` con Python 3.11-slim, dependencias de sistema (`poppler-utils`, `ghostscript`, `tesseract-ocr`, `libpango-1.0-0`, `libpangoft2-1.0-0`, `libffi-dev`, `libpq-dev`).
  2. **Protección de Archivos Legacy:** Creación de `.dockerignore` para garantizar que carpetas como `Files.Legacy`, `Exceles.Ricardo.Gallo`, `CRM-INANDES`, `backups`, etc., queden excluidas de la imagen Docker.
  3. **Limpieza de Dependencias:** Incorporación de `jinja2`, `weasyprint` y `gspread` a `backend/requirements.txt`.
  4. **Resiliencia de Imports:** Envolver importaciones de `streamlit` en `try...except ImportError` en `utils/latency.py`, `google_integration.py`, `email_integration.py` e `invoice_tracking_helpers.py`.
  5. **Codificación Windows/ASCII:** Limpieza de caracteres emojis no-ASCII en `google_integration.py` (evitando `UnicodeEncodeError`).
  6. **Importación de Routers:** Corrección de la estructura de imports en `backend/main.py` y `backend/routers/liquidaciones.py`.
  7. **Base de Datos Coolify:** Configuración de `ports_exposes = '8010'` y FQDN en la tabla de aplicaciones de Coolify.
  8. **Git Sync:** Todo guardado, probado y sincronizado en `origin/main` (commit `a5fb319`).

---

### ✅ Paso 17: Diagnóstico y Corrección de Pantalla en Blanco en URL Contabo (`inandes.geeksoft.tech`)
- **Fecha:** 13 de Agosto de 2026
- **Problema Reportado:** La URL `https://inandes.geeksoft.tech` cargaba una página en blanco.
- **Diagnóstico Realizado:**
  - El servidor web respondía HTTP 200 OK y entregaba `index.html` y los paquetes JS.
  - Al revisar el paquete JS compilado por Nixpacks/Coolify (`index-BxssXJVt.js`), las variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` no habían sido inyectadas durante la compilación (`import.meta.env`).
  - En `src/services/supabaseClient.ts`, una instrucción `if (!supabaseUrl) throw new Error(...)` provocaba que la aplicación React colapsara en la fase de arranque del navegador antes de renderizar el árbol DOM en `<div id="root"></div>`.
- **Acciones Realizadas:**
  - Se configuraron valores por defecto (fallback) con las credenciales públicas de Supabase en `src/services/supabaseClient.ts`.
  - Se recompiló localmente con `npm run build` (0 errores).
  - Se realizó `git commit` y `git push origin main` (commit `71e7b85`), disparando el webhook de auto-despliegue en Coolify.
  - Se desplegó en paralelo al VPS Hostinger actual mediante `deploy_vps.py`.
- **Resultado:**
  - Coolify recompiló automáticamente el bundle (`index-CltHXj6o.js`).
  - **Verificación Exitosa (200 OK):** La URL `https://inandes.geeksoft.tech` carga la interfaz React 19 sin errores y mostrando la UI de forma fluida.

---

## 🚩 Red Flags & Lecciones Aprendidas (Mudanza Contabo)

1. **🚩 RED FLAG 1: Variables de Entorno de Vite en TIEMPO DE COMPILACIÓN (*Build Variables*)**
   - **Causa:** Vite evalúa e inyecta las variables de entorno `VITE_*` durante el comando de compilación (`vite build`). Si un servicio de CI/CD como Coolify, Docker o Nixpacks ejecuta `npm run build` sin que las variables estén explícitamente marcadas como **"Build Variables"** (o "Is Build Variable?"), `import.meta.env.VITE_*` resulta `undefined`.
   - **Consecuencia:** Al invocar `createClient(undefined, undefined)` de Supabase, la app colapsa y muestra una pantalla en blanco.
   - **Regla Intangible de Prevención:** `src/services/supabaseClient.ts` DEBE contar SIEMPRE con credenciales fallback por defecto para que la UI jamás sufra un crash blanco por omisión de variables de build.

2. **🚩 RED FLAG 2: Prohibición de `throw Error` síncronos en la carga inicial de módulos React**
   - **Causa:** Lanzar excepciones no capturadas (`throw new Error(...)`) fuera del ciclo de vida de componentes (fuera de `React.Component` o `ErrorBoundary`) detiene de forma irrecuperable el bundle JS.
   - **Regla Intangible de Prevención:** Todo cliente o servicio global (`supabaseClient.ts`, `factoringService.ts`) debe usar fallbacks o degradación elegante para no detener el renderizado del DOM principal.

3. **🚩 RED FLAG 3: Mantener Sincronizados Ambos Entornos Durante el Cutover**
   - Mientras dure la migración a Contabo, todo cambio de código en `main` debe probarse localmente, pushearse a `origin/main` (para auto-deploy en Contabo) y actualizarse en Hostinger con `deploy_vps.py` para evitar divergencias de versión.

---

## ⏳ Tareas Pendientes para la Próxima Sesión

- [ ] **Tarea 1 (Paso 12 - Verificación Backend):**
  - Hacer clic en **Re-deploy** en la aplicación del backend dentro del panel Coolify (`http://169.58.168.107:8000`).
  - Ejecutar verificación por SSH/terminal (`python scratch/check_backend_response.py`) para confirmar la respuesta `{"status":"online"}` en el puerto `8010`.

- [ ] **Tarea 2 (Paso 15 - Conmutación de Variables Frontend):**
  - Actualizar `VITE_SUPABASE_URL` y `VITE_API_FACTORING_URL` en React apuntando al backend local de Contabo tras validación final.

- [ ] **Tarea 3 (Paso 16 - Cutover DNS Final & Desactivación Hostinger):**
  - Apuntar el registro DNS `api-factoring.geeksoft.tech` a la IP `169.58.168.107` (Contabo).
  - Dar de baja / cancelar el servidor antiguo VPS en Hostinger (`91.108.125.253`).

---

