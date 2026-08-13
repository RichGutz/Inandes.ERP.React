# 🗺️ Plan Maestro de Mudanza: Hostinger & Supabase ➔ Contabo (Coolify)

> **ESTADO DE LA BÓVEDA:** Guía Oficial de Arquitectura y Despliegue  
> **OBJETIVO:** Migrar el ecosistema ERP InAndes (Frontend React, Backend FastAPI, Motores Python y Base de Datos PostgreSQL/Supabase) hacia un VPS dedicado en Contabo administrado con **Coolify v4**.

---

## 🎯 Resumen Ejecutivo

La propuesta inicial presentada por el otro Gemini cubre el **mecanismo de despliegue continuo (CI/CD)** usando Coolify y GitHub Apps. Sin embargo, para un ecosistema crítico financiero como el ERP InAndes, **esa guía está incompleta y causaría interrupción del servicio** si se ejecuta a ciegas.

En esta bóveda hemos estructurado el plan en **6 notas especializadas** que cubren la infraestructura, la migración de datos, la contenedorización de motores Python y la conmutación de DNS sin caída de servicio.

---

## 📚 Estructura de la Bóveda

| # | Nota | Propósito Clave |
|---|---|---|
| 01 | [[01. Diagnóstico y Crítica del Plan Gemini\|01. Diagnóstico y Crítica del Plan Gemini]] | Análisis de lo que falta en la propuesta inicial y riesgos potenciales. |
| 02 | [[02. Infraestructura y Hardening del Server Contabo\|02. Infraestructura y Hardening del Server Contabo]] | Preparación del VPS (Ubuntu, UFW, Swap de memoria, SSH, Docker). |
| 03 | [[03. Migración de Base de Datos Supabase a Postgres-Coolify\|03. Migración de Base de Datos Supabase a Postgres-Coolify]] | Migración de la BD `egvcinsbyropumybatdf` (Dump, Restore, Auth y Storage). |
| 04 | [[04. Despliegue Backend FastAPI y Motores Python\|04. Despliegue Backend FastAPI y Motores Python]] | Dockerización de FastAPI, Motores V32/V25/V2, Poppler/PDFs y volúmenes. |
| 05 | [[05. Despliegue Frontend React 19 + Vite\|05. Despliegue Frontend React 19 + Vite]] | Despliegue de React, proxy reverso Traefik, SSL y variables de entorno. |
| 06 | [[06. Protocolo de Cutover DNS y Plan de Contingencia\|06. Protocolo de Cutover DNS y Plan de Contingencia]] | Pruebas de Staging, cambio de DNS en Cloudflare/Hostinger y Rollback. |
| 07 | [[07. Arquitectura ERP Contabo (Microservicios Docker)\|07. Arquitectura ERP Contabo (Microservicios Docker)]] | Explicación de microservicios Docker, Traefik, Supabase Self-Hosted y latencia < 1ms. |
| 🛠️ | [[Implementacion Contabo paso a paso\|Implementación Contabo paso a paso]] | Bitácora en tiempo real de comandos, scripts ejecutados y estado de implementación. |

---

## ⚠️ Los 4 Pilares Innegociables Antes de Empezar

1. **NO apagar Supabase Cloud ni Hostinger** hasta que la versión en Contabo esté 100% validada en un subdominio de pruebas (Staging).
2. **Configurar SWAP en el VPS de Contabo (Mínimo 4GB - 8GB):** Los procesos de `npm run build` en Coolify suelen agotar la memoria RAM y colapsar el servidor si no existe SWAP habilitado.
3. **Backup Completo con `pg_dump`:** Respaldar esquemas, secuencias, triggers y datos de Supabase antes de cualquier prueba.
4. **Preservar Variables `.env`:** Asegurar que las llaves de JWT, Supabase SDK, credenciales de Google Auth y conexión a BD coincidan perfectamente entre entornos.

---
*Bóveda generada para InAndes ERP - 2026*