# 📓 Bitácora de Despliegue y Rediseño — InAndes ERP React

Esta nota documenta de manera detallada el trabajo de desarrollo, auditoría financiera e infraestructura para el Frontend en React del CRM de **InAndes Inversiones**.

---

## 🚀 1. Scaffolding y Arquitectura React (TypeScript)
Se estructuró el proyecto bajo el siguiente stack tecnológico:
* **Vite v8.1** + **React 19.2** + **TypeScript 6.0**.
* **Dependencias Críticas**:
  * `@supabase/supabase-js` (REST API & WebSockets).
  * `lucide-react` (iconografía vectorial).
  * `tslib` (soporte runtime de Supabase).
  * `xlsx` / `openpyxl` (generación de libros contables de auditoría).

---

## 🎨 2. Integración de Tailwind CSS v4 & Master Template
Se implementó el diseño corporativo claro de referencia provisto en `MasterTemplate.tsx`:
* **Logotipos Oficiales**:
  * 🔹 **Geeksoft (Partner Tecnológico):** Escalado a proporción +30% (`height: 62px; max-width: 220px;`).
  * 🔹 **InAndes Inversiones (Firma Financiera):** Calibrado a proporción -30% (`height: 34px; max-width: 120px;`).
* **Estructura del Componente Layout** (`MasterTemplate.tsx`):
  * **Cabecera**: Logotipos oficiales en Base64, título de módulo interactivo, botones superiores de exportación a Excel y PDF y avatar con las iniciales dinámicas del operador Jorge Parra (`JP`).
  * **Navegación Noot-Router (Tabs SPA)**: Control local de la pestaña activa en `App.tsx` enlazado al Sidebar (Dashboard, Inversionistas, Inversiones, Fondos, Asesores, Calculadora).
  * **Light/Dark Mode**: Interruptor nativo de tema persistido en `localStorage`.

---

## 🗄️ 3. Conectividad a Supabase y Persistencia Oficial
* Conexión a la base de datos oficial en Supabase (`https://egvcinsbyropumybatdf.supabase.co`).
* Manejo de llaves de servicio para la inserción y consulta de las tablas maestras (`crm_inversionistas`, `crm_contratos`, `crm_fondos`, `crm_certificados_eventos`).

---

## 🏆 4. Auditoría Financiera y Cierre Contable al 28/02/2026 (100.00% Convergencia)

Se auditó, cerró y certificó centavo a centavo toda la cartera de inversiones al **28 de Febrero de 2026 (59 Días)** contra el libro maestro de Ricardo Gallo (`COMPLETO_2026-02-28 (1).xlsx`):

| Fondo | Moneda | Contratos Totales | Coincidencias al Centavo | % Convergencia | Estado de Auditoría |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **`NSGPEN01`** | **PEN** | 34 | 34 | **100.0%** | 🟢 **100% AUDITADO Y CERTIFICADO** |
| **`NSGPEN02`** | **PEN** | 25 | 25 | **100.0%** | 🟢 **100% AUDITADO Y CERTIFICADO** |
| **`NSGPEN03`** | **PEN** | 72 | 72 | **100.0%** | 🟢 **100% AUDITADO Y CERTIFICADO** |
| **`NSGUSD01`** | **USD** | 9 | 9 | **100.0%** | 🟢 **100% AUDITADO Y CERTIFICADO** |
| **`NSGUSD02`** | **USD** | 45 | 45 | **100.0%** | 🟢 **100% AUDITADO Y CERTIFICADO** |
| **TOTAL GLOBAL** | — | **185** | **185** | **100.0%** | 🏆 **CONVERGENCIA ABSOLUTA** |

### 🔑 Fórmulas Contables Validadas con Cero Error:
1. **Año Financiero Base 365 días:** `interes_diario = (capital * (tasa / 365.0))` con 59 días para el bimestre Ene-Feb.
2. **Fecha de Emisión Exacta:** Contratos nuevos incorporados en 2026 devengan proporcionalmente desde su día de inicio (`dias = 2026-02-28 - fecha_inicio + 1`).
3. **Aumentos de Capital:** Devengan día a día desde la fecha valor del abono bancario.
4. **Rescates al 28/02/2026:** Aplicados en la liquidación del cierre llevando el capital vigente a **0.00**.
5. **Impuesto a la Renta de 2da Categoría (5%):** Retención exacta `IR = round(INT_BRUTO * 0.05, 2)`.
6. **Ecuación de Reparto:** Cumplimiento exacto de $\text{Base Neta} = \text{Capitalización} + \text{Reparto en Efectivo}$.

---

## 📑 5. Entregables Oficiales de Auditoría

1. 📊 **Libro Excel Maestro Pulido:**
   📁 `AUDITORIA_OFICIAL_SISTEMA_2026-02-28_PULIDO.xlsx`
   * Banner de título corporativo, subtítulo informativo y espaciado de respiración de 14pt.
   * Formato numérico monetario y separador de miles `#,##0.00` en todas las columnas.
   * Cero contaminación o filas intermedias; fila de `TOTALES` inmediatamente después del último partícipe.
2. 📄 **Reporte PDF Ejecutivo Certificado:**
   📁 `REPORTE_OFICIAL_CIERRE_AUDITORIA_2026-02-28.pdf` (10 páginas en A4 Landscape).
   * Logos oficiales Geeksoft e InAndes integrados en Base64.
   * Paginación estricta de 25 filas máximas por tabla.
   * Tarjetas métricas superiores y desglose por fondo y moneda.
