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
  - Servidor local vinculado como host principal en Coolify.

---

## ⏳ Próximos Pasos Pendientes (Fases Siguientes)

- [ ] **Paso 7:** Vincular GitHub App con Coolify para habilitar Auto-Deploy en `git push origin main`.
- [ ] **Paso 8:** Desplegar el servicio de **Supabase Self-Hosted (1-Click)** en Coolify.
- [ ] **Paso 9:** Ejecutar `pg_dump` de Supabase Cloud (`egvcinsbyropumybatdf`) y restaurar esquemas/datos en la BD de Contabo.
- [ ] **Paso 10:** Configurar e iniciar el contenedor de **FastAPI Backend** (`Dockerfile` Python 3.11 con `poppler-utils`).
- [ ] **Paso 11:** Configurar e iniciar el contenedor del **Frontend React 19** con Nginx SPA Fallback.
- [ ] **Paso 12:** Pruebas QA en subdominios Staging y Cutover final de DNS en Cloudflare/Hostinger.

---
