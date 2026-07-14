# 💸 Entendimiento del Backend y Lógica Financiera

El backend del ERP original de InAndes está desarrollado en **Python**. Su responsabilidad primaria es procesar la lógica de negocio y cálculos financieros del fondo, actuando como el cerebro del sistema.

Para facilitar la migración a **React + Vite**, la lógica de backend se ha dividido y documentado de forma individualizada para cada uno de los motores financieros:

---

## 🚀 Motores de Cálculo Financiero (Detalles Individuales)

### 1. 💸 [[Backend/Motor de Retornos V32]] (Rendimientos del Inversionista)
*   Calcula el interés devengado diario simple o compuesto (Base 365) para el inversionista.
*   Deduce impuestos (IR del 5%) y deducciones programadas.
*   Determina la reinversión (capitalización) y el neto final a pagar.
*   Implementa el **Switch de Tasa Penalidad/Waiver** para retiros anticipados de capital.
*   Ver detalle completo: [[Backend/Motor de Retornos V32]]

### 2. 🏗️ [[Backend/Motor de Valor Cuota V25]] (Patrimonio y Participaciones)
*   Calcula la cotización o valor de liquidación diario del fondo (Valor Cuota).
*   Descuenta comisiones de administración (1%), captación (2%) y misceláneos (0.5%) sobre base 365.
*   Emite y asigna nuevas cuotas de participación ante aumentos de capital de los inversionistas.
*   Ver detalle completo: [[Backend/Motor de Valor Cuota V25]]

### 3. 💰 [[Backend/Motor de Comisiones V2]] (Asesores de Ventas)
*   Calcula los incentivos periódicos de la fuerza comercial.
*   Diferencia el **Esquema Antiguo** (comisión de captación del 2%, año de gracia, y comisión de mantenimiento del 1.5% prorrateada) del **Esquema Nuevo 2026** (comisión única del 3.5% pagada al primer corte del fondo).
*   Ver detalle completo: [[Backend/Motor de Comisiones V2]]

---

## 🔁 Procesamiento en Dos Fases
Independientemente del motor de cálculo que se ejecute, el flujo operativo del backend para persistir asientos financieros en la base de datos se divide en dos fases:
*   **Fase 1 (Revisión - Solo lectura)**: Genera y descarga los archivos de auditoría (Excel y PDF) para validación visual de los usuarios financieros en la UI.
*   **Fase 2 (Contabilización - Escritura)**: Invocado a través de un wrapper contable (`registrar_asientos_v32.py`), escribe los resultados oficiales insertando registros en la tabla ledger `crm_certificados_eventos` y actualizando estados a `'cerrado'` en contratos y certificados extintos.
