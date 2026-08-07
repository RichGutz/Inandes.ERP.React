# Arquitectura de Datos: CRM Versión 4 — React (Flujo Ultra-Vertical)

Esta versión es una evolución organizativa y de arquitectura visual basada en la V4 original de Streamlit. Refleja la migración definitiva de la interfaz a **React 19 + Vite (TypeScript)**, manteniendo la disposición vertical de las capas de datos, desde la captación de partícipes hasta el ledger contable.

---

## 📌 Diferenciación de Capas (V4 React)

1. **Capa Maestra (Top)**: Módulos de catálogos y entidades de negocio principales:
   * **Fondos**: `FondosPage.tsx` *(anteriormente `19_CRM_Fondos.py`)*.
   * **Inversionistas**: `InversionistasPage.tsx` *(anteriormente `17_CRM_Inversionistas.py`)*.
   * **Asesores**: `AsesoresPage.tsx` *(anteriormente `23_CRM_Asesores.py`)*.

2. **Capa Transaccional (Middle)**: Gestión de compromisos, inversiones y estado de tickets:
   * **Inversiones y Portafolio**: `InversionesPage.tsx` *(anteriormente `18_CRM_Inversiones.py`)*.
   * **Contratos y Certificados**: `CertificadosPage.tsx` *(anteriormente `32_CRM_Contratos.py` y `33_CRM_Certificados.py`)*.

3. **Capa de Inteligencia y Motores (Process)**:
   * **Motor de Cálculo (In-Memory)**: `financialCalculator.ts` *(anteriormente `35_CRM_Motor.py` / Motor V40)*.
   * **Capa de Servicios y Persistencia**: `inversionistasService.ts` / `factoringService.ts` *(orquestadores de persistencia y disparadores de cambios de estado en Supabase `egvcinsbyropumybatdf`)*.

4. **Capa Inmutable y Operativa (Bottom)**: 
   * **Ledger de Eventos (`crm_certificados_eventos`)**: Fuente de Verdad inmutable del historial contable.
   * **Gestión de Deducciones**: `DeduccionesPage.tsx` *(anteriormente `34_CRM_Deducciones.py`)*. Provee las variables de **Rescates y Penalidades (Waiver)** que `financialCalculator.ts` utiliza para recalcular intereses antes de cada cierre.

---

## 🛠️ Mapeo Oficial de Módulos (Streamlit .py ➔ React .tsx)

| Módulo CRM | Archivo Streamlit Legacy (.py) | Componente / Servicio React (.tsx / .ts) | Estado |
|------------|--------------------------------|------------------------------------------|--------|
| **00.A. Inversionistas** | `17_CRM_Inversionistas.py` | `InversionistasPage.tsx` | ✅ Migrado 100% |
| **00.B. Asesores** | `23_CRM_Asesores.py` | `AsesoresPage.tsx` | ✅ Migrado 100% |
| **00.C. Fondos** | `19_CRM_Fondos.py` | `FondosPage.tsx` | ✅ Migrado 100% |
| **00.D. Inversiones** | `18_CRM_Inversiones.py` | `InversionesPage.tsx` | ✅ Migrado 100% |
| **00.E. Certificados** | `32_CRM_Contratos.py` / `33_CRM_Certificados.py` | `CertificadosPage.tsx` | ✅ Migrado 100% |
| **00.F. Deducciones** | `34_CRM_Deducciones.py` | `DeduccionesPage.tsx` | ✅ Migrado 100% |
| **Motor Financiero** | `35_CRM_Motor.py` | `financialCalculator.ts` | ✅ Migrado 100% |
| **Capa de Conexión** | `CRM_Logic_DB_V4.py` | `inversionistasService.ts` / `supabaseClient.ts` | ✅ Migrado 100% |

---

## 🛠️ Mejoras Visuales en V4 (React)
* **Alineamiento Estricto**: Disposición en cuadrícula y paneles limpios mediante Tailwind CSS v4.
* **Flujo de Gravedad**: La relación `Contrato / Certificado ➔ Ledger` (`CertificadosPage.tsx` ➔ `crm_certificados_eventos`) es el eje central del sistema.
* **Identificación de Módulos**: Cada entidad visual incluye el código del archivo `.tsx` y servicio `.ts` que la gestiona en la arquitectura React.
