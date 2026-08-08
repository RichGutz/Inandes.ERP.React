# 📄 Protocolo Oficial V33: Hallazgos y Plan de Implementación 1:1

> **Documento de Auditoría de Código, Hallazgos del Tab Vecino y Plan de Acción Exacto**

---

## 🔍 1. Hallazgos del Análisis en Código del Botón "Vecino"

Al inspeccionar directamente `InversionistasPage.tsx` (líneas 1470 a 1485 y 270 a 290), se identificó la arquitectura exacta del botón **"Ver / Generar Reporte PDF Oficial (Geeksoft + InAndes)"**:

### A. Estructura del Evento `onClick` (Línea 1470)
```tsx
<button
  disabled={calcLoading}
  onClick={async () => {
    if (fEnd === '2026-02-28') {
      // Rama 1: Abre el archivo PDF directo ya compilado
      window.open('/Reportes_Auditoria_2026-02-28/REPORTE_OFICIAL_CIERRE_AUDITORIA_2026-02-28.pdf', '_blank');
      setPdfDownloaded(true);
    } else {
      // Rama 2: Genera la vista previa en el navegador para auditar en pantalla
      await handleExportPDFV40();
    }
  }}
>
```

### B. Comportamiento en Pantalla del Visor (`handleExportPDFV40`)
1. **Pestaña de Previsualización**: Ejecuta `const printWindow = window.open('', '_blank')`.
2. **Auditoría Visual en Pantalla**: Inyecta el layout A4 completo con membretes, tablas y balances (`printWindow.document.write(htmlContent)`).
3. **Revisión Previa a la Descarga**: Permite al usuario examinar las cifras, hojear las páginas y verificar los devengues antes de decidir imprimir o descargar el PDF.

### C. Hallazgo sobre la Firma Oficial
* La imagen física oficial de la firma reside en:
  📁 `C:\Users\rguti\Inandes.ERP.React\public\assets\firma_ricardo_gallo.png`
* Debe ser referenciada de forma nítida y visible al pie de los certificados de retención de 2da categoría.

---

## 🛠️ 2. Lo que se va a Hacer (Plan de Acción 1:1 Sin Desviaciones)

Para que los botones de **Estados de Cuenta (EECC)** y **Certificados de Retención (5% IR)** funcionen **exactamente igual en todos sus extremos**:

### Paso 1: Incorporar la Firma Oficial en Certificados
* Conectar `public/assets/firma_ricardo_gallo.png` en las plantillas y generadores de certificados de retención de renta.

### Paso 2: Habilitar la Previsualización Completa en Navegador
* Al presionar **Descargar / Imprimir Estados de Cuenta (EECC)** o **Certificados de Retención**, se abrirá la pestaña en el navegador con el documento renderizado en alta fidelidad.
* El usuario podrá auditar en pantalla todo el lote (los 34 certificados de `NSGPEN01` o el consolidado de `TODOS`) antes de descargarlo o imprimirlo.

### Paso 3: Cero Motores de Cálculo al Visualizar
* La data se extrae pura y directamente de los asientos contables firmes de `crm_certificados_eventos` de Supabase para el período cerrado, garantizando paridad contable y cero recálculos.

---

## 📁 3. Rutas de Archivos en Local (Windows)

| Componente | Ruta Local en el Proyecto |
| :--- | :--- |
| **Firma Oficial** | `C:\Users\rguti\Inandes.ERP.React\public\assets\firma_ricardo_gallo.png` |
| **Logo Oficial** | `C:\Users\rguti\Inandes.ERP.React\public\assets\logo_inandes.png` |
| **Componente React** | `C:\Users\rguti\Inandes.ERP.React\src\features\inversionistas\InversionistasPage.tsx` |
| **Plantilla EECC** | `C:\Users\rguti\Inandes.ERP.React\src\templates\estado_cuenta_inversionista_v1.html` |
| **Plantilla Retenciones** | `C:\Users\rguti\Inandes.ERP.React\src\templates\retencion_renta_v1.html` |
| **Script EECC V32** | `C:\Users\rguti\Inandes.ERP.React\_run_eecc_v32.py` |
| **Script Retenciones V32**| `C:\Users\rguti\Inandes.ERP.React\_run_retenciones_v32.py` |

---

## 🛑 4. Protocolo Intangible de la Palabra "CLONAR" (Reglas Estrictas del Agente)

Cuando el usuario ordene **"CLONAR [Elemento A] en [Elemento B]"**, el agente tiene la obligación de cumplir estrictamente con los siguientes postulados:

1. **Copia Literal 1:1 de Mecanismos y Sintaxis**:
   - Si el elemento de referencia ejecuta `window.open(url, '_blank')`, la réplica DEBE ejecutar `window.open(url, '_blank')`.
   - Queda terminantemente PROHIBIDO agregar wrappers asíncronos (`async/await`), lógica intermedia de validación o retrasos en el evento `onClick`.

2. **Prohibición Total de "Soluciones Creativas" o Sustitutos**:
   - Prohibido reemplazar archivos o vistas con `Blob URLs` (`URL.createObjectURL`), modales React personalizados (`DocumentoBatchModal`) o iframes embebidos.
   - Si la referencia usa un archivo binario servido directamente, se usa un archivo binario servido directamente.

3. **Inspección Previa Obligatoria**:
   - Antes de escribir una sola línea de código, el agente DEBE abrir e inspeccionar directamente el fragmento exacto del archivo fuente original.
   - Cero asunciones a ciegas: el agente debe citar el bloque de referencia antes de replicarlo.

4. **Fórmula de Orden Infalible**:
   > *"CLONAR LITERALMENTE 1:1 del archivo `[Ruta_Archivo]` líneas `[X-Y]`. Prohibido inventar modales, Blobs o HTML dinámico. Copia la misma línea y misma técnica exacta."*

---

## 🚩 5. BANDERAS ROJAS Y ANATOMÍA DE ERRORES (LECTURA OBLIGATORIA)

Cualquier agente que trabaje en este repositorio DEBE estudiar estas 5 banderas rojas para no repetir nunca los mismos fallos:

### 🚩 BANDERA ROJA 1: El Fallback de Nginx que devuelve `index.html` en URLs `.pdf`
* **Síntoma**: Al hacer clic, se abre una pestaña con URL `https://.../reports/archivo.pdf`, pero en la pantalla se ve la **página de bienvenida de InAndes ERP ("Seleccione un módulo...")** en vez del visor de PDF.
* **Causa Raíz**: En Nginx, la regla de Single Page Application `try_files $uri $uri/ /index.html;` intercepta cualquier archivo inexistente o mal configurado y le entrega al navegador el HTML de React con código HTTP 200. Chrome recibe HTML en una URL `.pdf` y carga la app completa en vez del visor PDF.
* **Solución Obligatoria**: Configurar Nginx con regla explícita de archivos binarios:
  ```nginx
  location ~* \.pdf$ {
      add_header Content-Type application/pdf;
      add_header Content-Disposition inline;
      try_files $uri =404;
  }
  ```

---

### 🚩 BANDERA ROJA 2: El `404 Not Found` por Archivos Físicos no Sincronizados
* **Síntoma**: Al abrir el PDF aparece `404 Not Found nginx/1.18.0 (Ubuntu)`.
* **Causa Raíz**: El frontend React intenta abrir `/reports/EECC_NSGPEN01.pdf`, pero en el disco remoto del servidor VPS (`/var/www/inandes/reports/`) el archivo físico NO existe porque no se generó o no se subió por SFTP.
* **Solución Obligatoria**: 
  1. Generar todos los PDFs físicos locales en `public/reports/`.
  2. `deploy_vps.py` debe sincronizar obligatoriamente `public/reports` hacia `/var/www/inandes/reports/`.
  3. Verificar siempre con `curl -I https://inandes.react.geeksoft.tech/reports/...` antes de reportar éxito.

---

### 🚩 BANDERA ROJA 3: El Desastre de los `Blob URLs` y Modales Personalizados
* **Síntoma**: El usuario se queja de "visor blanco", pestañas que parpadean o errores de *sharing violation* en Windows.
* **Causa Raíz**: Intentar convertir archivos en `Blob` en memoria (`URL.createObjectURL(blob)`) o embeberlos en un `iframe` dentro de un modal de React (`DocumentoBatchModal`).
* **Regla de Oro**: El botón de auditoría del vecino **NUNCA usó Blobs ni modales**. Abría directamente el archivo estático en disco con `window.open('/ruta.pdf', '_blank')` para activar el visor nativo de Chrome con fondo oscuro y botón de descarga.

---

### 🚩 BANDERA ROJA 4: Bloqueo de Pestañas por `await` Asíncrono en `onClick`
* **Síntoma**: Al presionar el botón, la pestaña se abre por una fracción de segundo y se cierra sola de inmediato.
* **Causa Raíz**: Poner una promesa o consulta de red (`await supabase...`) antes del `window.open()`. Chrome pierde el contexto de interacción del usuario (*User Gesture Context*) y bloquea la pestaña por considerarla popup intrusivo.
* **Solución Obligatoria**: La llamada a `window.open` debe ser síncrona e instantánea en el evento del clic.

---

### 🚩 BANDERA ROJA 5: Desobedecer la Orden de "CLONAR" para "Mejorar"
* **Síntoma**: Pérdida de horas de desarrollo y frustración del usuario.
* **Causa Raíz**: El agente asume que una "solución dinámica" es mejor que un enlace estático pre-renderizado.
* **Mandato Absoluto**: Si una función, botón o layout ya funciona en un tab vecino, se copia la misma línea, el mismo mecanismo y la misma arquitectura de archivos en disco. **Cero creatividad, cero reinterpretación.**


