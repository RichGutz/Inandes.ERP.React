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

---

## ⏳ Próximos Pasos Pendientes (Fases Siguientes)

- [ ] **Paso 12:** Configurar e iniciar el contenedor de **FastAPI Backend** (`Dockerfile` Python 3.11 con `poppler-utils`).
- [ ] **Paso 13:** Asignación de dominios FQDN (`inandes.react.geeksoft.tech` / `api-factoring.geeksoft.tech`) y certificados SSL Let's Encrypt.
- [ ] **Paso 14:** Pruebas QA de regresión en Staging y conmutación final de DNS.

---
