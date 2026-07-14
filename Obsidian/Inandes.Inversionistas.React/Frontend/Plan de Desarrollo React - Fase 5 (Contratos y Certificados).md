# 💻 Plan de Desarrollo React - Fase 5: Gestión de Contratos y Certificados

Esta nota detalla el plan de implementación técnica y diseño de interfaz para la **Fase 5** de la migración del CRM InAndes a **React + Vite (TypeScript)**. En esta fase, implementaremos el flujo completo de emisión, firma y control de contratos y certificados.

---

## 🎨 1. Estructura de la Interfaz (4 Vistas)

El módulo estará montado bajo la pestaña **Tickets e Inversiones** (`inversiones`) en `App.tsx` y usará un estado de navegación interno:

### Vista 1: 📋 Directorio de Contratos (List)
* **Tabs por Estado**:
  1. **Borradores**: Contratos en estado `borrador` o `propuesto`. Permite editar o "Solicitar Aprobación".
  2. **Por Aprobar**: Contratos en estado `pendiente_aprobacion`. Permite revisar y aprobar.
  3. **Vigentes**: Contratos en estado `aprobado`, `vigente` o `emitido`. Ofrece filtros de búsqueda por titular e ID de contrato y multiselección de fondos en el sidebar. Se agrupan los contratos en listas colapsables por fondo.
  4. **Cerrados / Rescates**: Muestra contratos históricos finalizados o cancelados.
* **Descarga Excel**: Genera un archivo Excel (`export_contratos_excel`) plano con el listado unificado de contratos enriquecidos.
* **Botón "Nuevo"**: Redirige al formulario de creación.

---

### Vista 2: 📝 Formulario de Borrador / Wizard (Create/Edit)
Consta de 4 secciones secuenciales para el ingreso y validación de datos:
1. **Sección 1: El Fondo**: Selección de fondo e identificación del plazo de inversión disponible.
2. **Sección 2: Condiciones**: Monto, Plazo (meses), % Reparto, Asesor asignado y Fecha del Contrato.
   * Si se selecciona el plazo `'ND'`, lee la fecha de cierre de fondo y calcula de forma reactiva los meses restantes (`nd_calculated_months`).
   * Calcula y muestra reactivamente la fecha de inicio contable (alineada a periodos mensuales o bimestrales según corresponda) y la fecha de vencimiento.
3. **Sección 3: Partícipes (Inversionistas)**:
   * Selector múltiple de inversionistas (hasta 4 personas).
   * Selección de dirección contractual (extrae y unifica direcciones de los participantes seleccionados).
   * Matriz de porcentajes de participación (debe sumar 100%) y de depósitos (valida que los receptores tengan cuentas bancarias registradas en la moneda del fondo).
4. **Sección 4: Vista Previa**: Muestra el contrato en HTML dinámico reemplazando marcadores de plantilla en tiempo real.

---

### Vista 3: ✅ Revisar y Aprobar (Approve)
* Formulario de aprobación de depósitos:
  * Selector de Fecha Real del Voucher.
  * Selector / Carga de Archivo del Voucher (PDF o imagen).
* Pestañas de revisión preliminar:
  * **Contrato**: El contrato en HTML.
  * **Certificado**: El certificado de participación preliminar (con cláusula 2.2).
* Botón **Aprobar y Guardar**:
  1. Consulta en DB el último correlativo para generar el ID definitivo (ej. `NSGPEN01-055.20260714`).
  2. Inserta el nuevo registro definitivo en `crm_contratos` en estado `'emitido'`.
  3. Elimina el borrador original de la base de datos.
  4. Inserta el registro oficial del certificado en `crm_certificados`.
  5. Inserta el evento de emisión inicial en `crm_certificados_eventos`.

---

### Vista 4: 📂 Gestionar Contrato Vigente (Active Detail)
* **Sección Documentos**:
  * Muestra el contrato definitivo generado en HTML y permite descargarlo en PDF.
  * Permite subir la copia firmada digitalmente del contrato o pegar su URL en la nube (Drive/SharePoint), actualizando el campo `contrato_firmado_url` en DB.
* **Sección Certificado**:
  * Presenta una vista previa del certificado oficial emitido con firmas digitales e iconografía de InAndes y del fondo.
  * Botón para descargar el certificado en PDF.

---

## 🗄️ 2. Estructura de la Tabla `crm_contratos`
Campos del esquema oficial mapeados en TypeScript:
* `id_contrato` (PK): Natural o UUID borrador.
* `id_inversionista_1`, `id_inversionista_2`, `id_inversionista_3`, `id_inversionista_4`.
* `porcentaje_participacion_1` a `4`, `porcentaje_deposito_1` a `4`.
* `id_fondo`, `id_fondo_plazo`, `id_asesor`.
* `monto_inversion`, `moneda`, `plazo_meses`, `tasa_pactada`, `frecuencia_cupones_meses`.
* `fecha_inicio`, `fecha_fin`, `domicilio_contractual`.
* `voucher_deposito_url`, `contrato_firmado_url`.
* `estado` (`borrador`, `propuesto`, `pendiente_aprobacion`, `emitido`, `cerrado_fin_contrato`, `cerrado_por_rescate`).
