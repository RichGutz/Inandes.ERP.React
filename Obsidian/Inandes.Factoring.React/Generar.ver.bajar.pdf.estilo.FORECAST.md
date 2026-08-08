# 🏛️ Plan de Arquitectura: Generación y Visualización de PDFs Estilo Forecast
# Estado: APROBADO PARA IMPLEMENTACIÓN
# Fecha: 2026-08-08
# Objetivo: Implementar el nuevo sub-tab "EECC / Retenciones / 2 Visores" en el Módulo Inversionistas

---

## 🎯 1. Visión General y Lección de Forecast

En **Forecast** (`forecast.geeksoft.tech/liquidations-pdf-audit`), la generación y auditoría de documentos de 30+ páginas funciona de forma instantánea (1-2 segundos) y dentro de la misma interfaz mediante **visores integrados en caliente**.

### ¿Por qué funciona la receta de Forecast?
1. **Visor Directo dentro de la Pantalla:** El usuario no lidia con ventanas emergentes bloqueadas por el navegador ni con pestañas perdidas; el documento se renderiza en un visor embebido de alta resolución dentro del propio dashboard.
2. **Transmisión de Binario Puro (`application/pdf`):** El frontend no maqueta HTML pesado con JavaScript ni usa `document.write()`. Simplemente monta un contenedor `<iframe src="..." />` que delega el renderizado al motor nativo C++ de Chrome (PDFium).
3. **Persistencia en Caché de Disco (Cache-First en VPS):** La primera vez que se consulta el periodo cerrado, WeasyPrint compila el PDF en Linux y lo guarda en disco (`cache_reports/`). Las siguientes consultas o cambios de vista responden en **0.05 segundos** mediante `FileResponse`.

---

## 🏗️ 2. Arquitectura del Nuevo Sub-Tab: "EECC / Retenciones / 2 Visores"

En el módulo **Inversionistas** (`InversionistasPage.tsx`), la barra de navegación secundaria quedará estructurada así:

```
[ 📋 Inversionistas ] [ 📈 Retornos y Devengue ] [ 🔍 Auditoría y Cierre ] [ 📄 EECC / Retenciones / 2 Visores ]
```

### 2.1 Maquetación de la Vista Dual (2 Visores en Caliente)

La pantalla se dividirá en:
1. **Barra Superior de Control y Filtros:**
   - **Fondo:** Selector (`TODOS`, `NSGPEN01`, `NSGUSD01`, `NSGPEN02`, etc.).
   - **Año / Ciclo / Periodo:** Selectores automáticos que calculan `fStart` y `fEnd` (ej. `2026-01-01` al `2026-02-28`).
   - **Badge de Estado Contable:** Indicador verde (`PERÍODO OFICIALIZADO`) o amarillo (`BORRADOR`).
   - **Selector de Modo de Visualización:**
     - 🔲 **Vista Dividida (Split 50/50):** Los 2 visores lado a lado en pantalla ancha.
     - 📑 **Visor EECC Completo (100%):** Maximiza el Estado de Cuenta.
     - 📜 **Visor Retenciones Completo (100%):** Maximiza el Certificado de Retención IR 5%.
   - **Botón "⚡ Regenerar en Caliente":** Permite forzar re-compilación fresca desde la base de datos ignorando la caché.

2. **Panel Visor 1 (Izquierda): Estados de Cuenta (EECC)**
   - Cabecera con título, fondo seleccionado, botón para abrir en pestaña externa y botón de descarga directa.
   - Contenedor con altura dinámica (`h-[750px]` o `h-[85vh]`):
     ```tsx
     <iframe
       src={`https://inandes.react.geeksoft.tech/api/inversionistas/eecc/${docFondo}/${fEnd}`}
       className="w-full h-full rounded-xl border border-slate-200 dark:border-slate-800 shadow-inner bg-slate-900"
       title="Visor EECC"
     />
     ```

3. **Panel Visor 2 (Derecha): Certificados de Retención (5% IR)**
   - Cabecera con título tributario, fecha de corte, botón de pestaña externa y botón de descarga directa.
   - Contenedor con altura dinámica (`h-[750px]` o `h-[85vh]`):
     ```tsx
     <iframe
       src={`https://inandes.react.geeksoft.tech/api/inversionistas/retenciones/${docFondo}/${fEnd}`}
       className="w-full h-full rounded-xl border border-slate-200 dark:border-slate-800 shadow-inner bg-slate-900"
       title="Visor Retenciones"
     />
     ```

---

## ⚙️ 3. Backend FastAPI: Estrategia Cache-First y Persistencia

### 3.1 Endpoints Oficiales en Producción

| Endpoint | Método | Entrada | Salida | Estrategia de Caché |
|---|---|---|---|---|
| `/api/inversionistas/eecc/{id_fondo}/{fecha_fin}` | `GET` | `id_fondo`, `fecha_fin`, `force` (opcional) | `application/pdf` | Si existe en `/opt/erp_inandes/backend/cache_reports/`, responde en **0.05s**. Si no, compila con WeasyPrint y persiste en disco. |
| `/api/inversionistas/retenciones/{id_fondo}/{fecha_fin}` | `GET` | `id_fondo`, `fecha_fin`, `force` (opcional) | `application/pdf` | Si existe en `/opt/erp_inandes/backend/cache_reports/`, responde en **0.05s**. Si no, compila con WeasyPrint y persiste en disco. |

### 3.2 Lógica Python en `backend/routers/inversionistas.py`

```python
cache_dir = os.path.join(backend_root, 'cache_reports')
os.makedirs(cache_dir, exist_ok=True)

cache_file = os.path.join(cache_dir, f"EECC_{id_fondo}_{fecha_fin}.pdf")
filename = f"EECC_{id_fondo}_{fecha_fin}.pdf"

# 1. Retorno instantáneo si ya fue compilado previamente
if os.path.exists(cache_file) and not force:
    return FileResponse(
        cache_file,
        media_type="application/pdf",
        headers={"Content-Disposition": f"inline; filename={filename}"}
    )

# 2. Si no existe o se pide force=true, se compila con WeasyPrint y se guarda en disco
HTML(string=html_out, base_url=backend_root).write_pdf(target=cache_file)

return FileResponse(
    cache_file,
    media_type="application/pdf",
    headers={"Content-Disposition": f"inline; filename={filename}"}
)
```

---

## 📋 4. Plan de Ejecución Paso a Paso

### Paso 1: Backend FastAPI (Cache-First + Parámetro Force)
- Actualizar `backend/routers/inversionistas.py` con el manejo de caché persistente y parámetro `force: bool = False`.
- Subir el archivo al VPS (`/opt/erp_inandes/backend/routers/inversionistas.py`) y reiniciar `inandes-api.service`.

### Paso 2: Frontend React (`InversionistasPage.tsx`)
- Renombrar y configurar el sub-tab a **`documentos`** con etiqueta oficial **`EECC / Retenciones / 2 Visores`**.
- Implementar el diseño responsivo con selector de visualización (Split Dual 50/50, EECC 100%, Retenciones 100%).
- Conectar los `<iframe />` directamente a los endpoints del backend.
- Agregar botones de acción rápida en la cabecera de cada visor:
  - 🔄 *Recargar visor individual*
  - ↗️ *Abrir en pestaña completa*
  - ⬇️ *Descargar PDF*

### Paso 3: Compilación y Despliegue en VPS
- Ejecutar `npm run build` en local.
- Ejecutar `python deploy_vps.py` para subir los archivos a `/var/www/inandes` y actualizar la configuración de Nginx.
- Pre-calentar la caché de los periodos cerrados en el VPS.

---

## ✅ 5. Criterios de Aceptación (QC Final)

1. **Visores Integrados:** Al ingresar al tab **EECC / Retenciones / 2 Visores**, ambos documentos se visualizan directamente embebidos en la pantalla sin abrir modales bloqueantes ni ventanas emergentes.
2. **Velocidad Instantánea:** Tras la primera carga, cualquier cambio de filtro o recarga responde en menos de 1 segundo (Cache-First).
3. **Calidad y Formato Oficial:**
   - EECC con balance contable, logo corporativo, retención 5% y firmas.
   - Retenciones con certificado tributario oficial, firma de Ricardo Gallo y montos en letras y números.
4. **Compatibilidad:** Visor nativo con controles de zoom, navegación por páginas y descarga en Chrome, Edge y Firefox.
