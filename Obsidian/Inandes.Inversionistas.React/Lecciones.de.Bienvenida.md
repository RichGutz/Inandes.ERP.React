# 🏛️ Bienvenido — Principios del Proyecto InAndes CRM Inversionistas

> **DOCUMENTO DE REFERENCIA Y LECTURA OBLIGATORIA**

---

## 🎯 ¿Qué estamos haciendo?

Estamos reemplazando la interfaz heredada de **Streamlit** por un **Frontend React 19 + Vite** (`https://inandes.react.geeksoft.tech`), manteniendo intactos los motores de cálculo financiero en Python y la base de datos PostgreSQL en Supabase.

| **Repositorio Git** | `RichGutz/Inandes.ERP.React` | ✅ Repositorio Único Unificado (`origin/main`) |
| **Frontend** | React 19 + TypeScript + Tailwind CSS | ✅ Desplegado en VPS |
| **Backend API** | FastAPI (Python) | ✅ Desplegado en VPS (Puerto 8010/8502) |
| **Base de Datos** | Supabase (`egvcinsbyropumybatdf`) | ✅ Operativa |
| **Motores Financieros** | Motores Python V32, V25 y V2 | ✅ Intactos en `mini_erp_v2_antigravity` |

## 🔒 Regla Intangible de Desarrollo: CLONAR Significa Copia Literal 1:1

Cuando el usuario instruya **"CLONAR [Elemento A] en [Elemento B]"**:
1. **Inspección Previa Obligatoria**: Abrir e inspeccionar el archivo de referencia original y citar el fragmento antes de codificar.
2. **Cero Creatividad / Cero Sustitutos**: Si el original usa `window.open('/ruta.pdf', '_blank')` y un archivo estático en disco, la réplica DEBE usar exactamente la misma técnica. Prohibido usar Blobs, modales (`DocumentoBatchModal`) o iframes.
3. **Cero `await` en `onClick`**: Prohibido anteponer llamadas asíncronas que destruyan el contexto del navegador y cierren pestañas.
4. **Nginx para PDFs**: Los archivos binarios deben servirse con `Content-Type: application/pdf; Content-Disposition: inline;` para abrir el visor nativo de Chrome con fondo oscuro.

---

## 🚫 Regla de Oro — NO Reinventar la Rueda

> **Los motores financieros de Python YA FUNCIONAN. No se duplica su lógica en React.**

- **Motor de Retornos V32/V40:** Calcula intereses devengados, impuestos de 2da categoría y saldos.
- **Motor de Valor Cuota V25:** Gestiona el devengue diario del patrimonio y valor cuota de cada fondo.
- **Motor de Comisiones V2:** Proyecta y liquida los incentivos de la fuerza de ventas.

React consume los endpoints FastAPI o replica la interfaz de usuario con servicios TypeScript que consultan a Supabase.

---

## 🏗️ Arquitectura del Módulo Inversionistas

```
USUARIO (Navegador)
  │
  ▼
React 19 Frontend (https://inandes.react.geeksoft.tech)
  │
  ├── Supabase JS SDK (Auth Google + DB 'egvcinsbyropumybatdf')
  │   ├── inversionistas
  │   ├── contratos_inversion
  │   ├── certificados_participacion
  │   └── asesores / fondos
  │
  └── FastAPI Backend (https://api-factoring.geeksoft.tech)
      └── Motores Python (V32 Retornos, V25 Cuotas, V2 Comisiones)
```

---

## 📋 Módulos del CRM Inversionistas

| Sub-Módulo | Archivo React | Estado |
|------------|---------------|--------|
| **00.A. Inversionistas** | `InversionistasPage.tsx` | ✅ Migrado 100% |
| **00.B. Asesores** | `AsesoresPage.tsx` | ✅ Migrado 100% |
| **00.C. Fondos** | `FondosPage.tsx` | ✅ Migrado 100% |
| **00.D. Inversiones** | `InversionesPage.tsx` | ✅ Migrado 100% |
| **00.E. Certificados** | `CertificadosPage.tsx` | ✅ Migrado 100% |
| **00.F. Deducciones** | `DeduccionesPage.tsx` | ✅ Migrado 100% |

---

## 🔒 Reglas Intangibles de UI

### Selector de Letras A-Z (Módulo Aprobaciones):
- **Archivo:** `AprobacionesTab.tsx`
- **Regla Intangible:** Se debe mostrar **SIEMPRE TODO EL ABECEDARIO** (`TODOS`, `A` - `Z`, `#`).
- **Formato Visual:** Burbujas cuadradas redondeadas con contadores redondeados en la esquina superior derecha (`-top-1.5 -right-1.5`).
- **Filtro y Conteo Exclusivo:** El conteo y el filtrado por letra se realizan **ÚNICAMENTE sobre la inicial del EMISOR (Cedente)** (`op.emisor_nombre`). Queda prohibido evaluar al Aceptante/Pagador.
- **Instrucción para la IA:** Ningún agente o subagente de IA tiene permitido alterar esta estructura o reimplementar este componente sin autorización explícita del usuario.

---

## 🔌 Estrategia de Conexión FastAPI & Resiliencia con Supabase

> **Solución a las Fallas de Conexión con el Backend FastAPI**

Para garantizar disponibilidad al 100% y eliminar los errores de conexión con FastAPI (`https://api-factoring.geeksoft.tech` / `http://127.0.0.1:8010`):

1. **Patrón de Servicio Centralizado (`factoringService.ts` / `inversionistasService.ts`):**
   - Todos los componentes React consumen las capas de servicio centralizadas. Queda estrictamente **prohibido escribir llamadas `fetch('/api/...')` aisladas** dentro de componentes UI.

2. **Estrategia Dual de Tolerancia a Fallos (Fallback Automático):**
   - Las capas de servicio intentan primero consumir la API FastAPI en la nube/VPS.
   - Si FastAPI no responde, arroja error 404/500 o sufre micro-cortes, el servicio **intercepta la falla de inmediato de forma transparente** y ejecuta una consulta nativa directa a las tablas de Supabase.

3. **Incrustación de Variables de Entorno en Compilación (.env & .env.production):**
   - Durante `npm run build`, Vite incrusta las variables `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` y `VITE_API_FACTORING_URL` desde `.env` y `.env.production` directamente en los paquetes JavaScript de producción del VPS (`/var/www/inandes`), evitando caídas de cliente por falta de configuración de entorno.

---

*Última actualización: 2026-08-06 (Arquitectura Resiliente FastAPI + Supabase)*

