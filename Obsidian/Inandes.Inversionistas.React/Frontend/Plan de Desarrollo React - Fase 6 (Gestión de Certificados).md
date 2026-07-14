# 💻 Plan de Desarrollo React - Fase 6: Gestión de Certificados de Participación

Esta nota detalla el plan de implementación técnica y diseño de interfaz para la **Fase 6** de la migración del CRM InAndes a **React + Vite (TypeScript)**, portando el script original `33_CRM_Certificados.py`.

---

## 🎨 1. Estructura de la Interfaz (3 Pestañas principales)

El módulo está montado bajo la pestaña **Gestión de Certificados** (`crm_certificados`) del menú de navegación lateral `CRM` en `App.tsx` e implementa las siguientes secciones:

### Pestaña 1: ✅ Vigentes
* **Métricas Principales**:
  * **Certificados Vigentes**: Cantidad de certificados con capital actual mayor a 0 y fondo no vencido.
  * **Capital Total Gestionado (AUM)**: Suma consolidada de capital actual agrupada por moneda (USD / PEN).
* **Filtros e Hojas de Cálculo**:
  * Buscador OMNI rápido por titular (1 al 4), DNI o ID de certificado.
  * Selector / pastillas de filtro rápido por Fondos.
  * **Descarga Excel Multihistorial**: Botón que utiliza SheetJS (`xlsx`) para exportar un libro Excel que contiene una hoja general de consolidado ("Todos los Certificados") y una hoja individual por cada fondo con totales automáticos.
* **Agrupamiento Colapsable por Fondo**:
  * Cada fondo se presenta en un panel colapsable indicando el AUM por moneda y cantidad de certificados.
  * Tabla interactiva que lista: Certificado, Titulares (concatenados), Moneda, Inversión Inicial, Capital Actual, Plazo (meses), Último Evento y Fecha.
  * Acción de acceso rápido: Botón "Visor" que redirige al visor del certificado seleccionado.

---

### Pestaña 2: 💰 Aumento de Capital
* **Inyección de Capital**: Permite agregar fondos adicionales a un certificado permanente existente.
* **Buscador OMNI y Selector**: Filtra certificados vigentes y muestra el ID de certificado, titular y capital actual.
* **Formulario de Registro**:
  * Campo de monto de capital agregado (por defecto 5,000).
  * Fecha efectiva del aporte.
  * Carga mockeada de comprobante de depósito.
* **Acción de Ledger**: Inserta un registro en `crm_certificados_eventos` de tipo `'aumento_capital'`, recalculando el saldo final (`capital_final_saldo = capital_previo + aumento`) y agregando notas detalladas.

---

### Pestaña 3: 🖨️ Visor & Ledger
* **Selector de Certificado**: Permite escoger cualquier certificado de la base de datos para auditar.
* **Visualizador en iframe**: Carga la plantilla HTML oficial del certificado (`generateCertificateHtml` en `contractPreviewGenerator.ts`) inyectando datos de titulares, montos y firmas en tiempo real para evitar desbordes CSS del navegador.
* **Botón de Impresión PDF**: Abre la ventana de impresión nativa del navegador para descargar/imprimir el certificado vectorialmente en PDF.
* **Historial Contable (Ledger)**: Despliega una línea de tiempo (timeline) vertical listando cronológicamente de forma descendente todos los eventos ocurridos en el certificado (ej. `emision_inicial`, `aumento_capital`) con sus respectivas bases, intereses, retenciones y saldos de capital resultantes.

---

## 🗄️ 2. Mapeo de DB en Supabase
El módulo interactúa con las siguientes tablas:
* `crm_certificados`: Metadatos del certificado y monto inicial.
* `crm_certificados_eventos`: Ledger de eventos de capital e intereses.
* `crm_contratos`: Condiciones financieras y vinculación.
* `crm_fondos`: Fechas de extinción y monedas del fondo.
* `crm_inversionistas`: Mapeo de nombres completos y documentos de titulares.
