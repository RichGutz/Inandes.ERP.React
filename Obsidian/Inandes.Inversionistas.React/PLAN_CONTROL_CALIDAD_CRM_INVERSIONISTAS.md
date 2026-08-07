# 📋 Plan de Control de Calidad y Auditoría Integral — CRM Inversionistas

> **Documento Oficial de Especificación y Protocolo de Auditoría Centavo a Centavo**
> 
> *Basado en la transcripción de requerimientos de dirección y control de calidad (Agosto 2026)*

---

## 🎯 Contexto y Objetivo General

Se retoma el ciclo final de **Control de Calidad y Auditoría Financiera Centavo a Centavo** del CRM Inversionistas en la arquitectura **React 19 + Supabase**.

El objetivo es validar y auditar el cálculo de retornos, devengue de cuotas y saldos de los fondos bimestrales y trimestrales, contrastando los resultados generados por el ERP contra el modelo maestro en Excel de **Ricardo Gallo (Director/Dueño)**.

---

## 📊 Fases de Ejecución del Protocolo de Calidad

```mermaid
graph TD
    F1[Fase 1: Reset y Rollback al 31/12/2025] --> F2[Fase 2: Cierre y Auditoría Ene-Feb 2026]
    F2 --> F3[Fase 3: Corridas Progresivas Mar-Ago 2026]
    F3 --> F4[Fase 4: Certificación y Emisión de PDF Finales]
```

### 📍 FASE 1: Reset y Retorno de Estado al 31 de Diciembre de 2025
* **Objetivo:** Regresar el ledger de eventos (`crm_certificados_eventos`) y la base de datos al estado exacto del **31/12/2025**.
* **Acción Técnica:**
  - Analizar e invocar la función de reseteo contable de la base de datos (`regresar_todo` / rollback de asientos).
  - Verificar que todos los contratos inscritos al 31/12/2025 tengan su correlativo natural e inicialización limpia en `crm_certificados`.

---

### 📍 FASE 2: Cierre Bimestral/Trimestral (01/01/2026 ➔ 28/02/2026)
* **Objetivo:** Correr el cierre de ciclo para todos los fondos bimestrales y el fondo trimestral con fecha de corte **28 de Febrero de 2026**.
* **Acción Técnica:**
  - Ejecutar el motor de cálculo V40 (`financialCalculator.ts` / `inversionistasService.ts`).
  - Procesar la distribución de interés bruto, retención fiscal del 5% de Impuesto a la Renta de Segunda Categoría, y evaluar la modalidad (*Pagar Cupón* vs *Capitalizar*).
  - **Auditoría Comparativa:** Cruzar los saldos devengados y valor cuota al 28/02/2026 contra la hoja de trabajo oficial en Excel de **Ricardo Gallo**.

---

### 📍 FASE 3: Corridas Progresivas Mensuales (Marzo ➔ Agosto 2026)
* **Objetivo:** Avanzar progresivamente en el tiempo ejecutando los cierres de ciclo correspondientes a los meses de **Marzo, Abril, Mayo, Junio, Julio y Agosto de 2026**.
* **Acción Técnica:**
  - Correr cierre de Marzo 2026 ➔ Comparar vs Excel Ricardo Gallo.
  - Correr cierre de Abril 2026 ➔ Comparar vs Excel Ricardo Gallo.
  - Continuar iterativamente hasta completar el corte a **Finales de Agosto de 2026**.
  - Verificar que el loop de retroalimentación de capitalización (*feedback loop*) genere correctamente los eventos `aumento_capital` en Supabase a valor cuota del día.

---

### 📍 FASE 4: Certificación Final y Emisión de Reportes
* **Objetivo:** Emisión oficial de los documentos de cierre contable y verificación de cero discrepancias.
* **Entregables:**
  - Estados de Cuenta en PDF por cada partícipe.
  - Certificados de Retención de 2da Categoría.
  - Cuadro de Mapeo de Auditoría Centavo a Centavo (React vs Excel).

---

## 🛠️ Herramientas y Componentes Involucrados

| Componente | Archivo / Función | Responsabilidad |
|------------|-------------------|-----------------|
| **Función Reset** | `regresar_todo` / `inversionistasService.ts` | Retorno de base de datos al 31/12/2025 |
| **Motor V40** | `financialCalculator.ts` | Cálculo in-memory de intereses, waiver e impuestos |
| **Persistencia** | `inversionistasService.ts` | Inserción de eventos en `crm_certificados_eventos` |
| **Base de Datos** | Supabase (`egvcinsbyropumybatdf`) | Ledger inmutable de transacciones |
| **Reportes PDF** | WeasyPrint Engine | Generación de Estados de Cuenta y Certificados |

---

*Última actualización: 2026-08-06 (Generado a partir de la transcripción oficial Whisper)*
