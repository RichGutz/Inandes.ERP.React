# 🏛️ Arquitectura y Guía Definitiva: Generación y Visores de Documentos en Caliente (Estilo Forecast)
# Estado: IMPLEMENTADO Y EN PRODUCCIÓN (100% FUNCIONAL)
# Fecha: 2026-08-08
# Objetivo: Guía canónica para replicar visores de alta resolución instantáneos (0.01s) sin bloqueos ni pantallas oscuras.

---

## 🎯 1. Diagnóstico: El Error del Enfoque Tradicional vs La Receta de Forecast

### ❌ El Error Clásico (Por qué demoraba una eternidad y se veía oscuro):
1. **Llamar al backend binario PDF al montar el iframe (`<iframe src="https://.../reporte.pdf" />`):**
   - WeasyPrint en el VPS necesita compilar HTML + CSS + fuentes + imágenes y paginar 20 a 50 hojas en C++/Python. Esto toma entre **15 a 40 segundos** por documento.
   - Si la pantalla tiene **2 visores simultáneos** (ej. EECC y Retenciones), el navegador dispara 2 peticiones pesadas en paralelo.
   - Si el endpoint en FastAPI está definido con `async def`, la compilación síncrona de WeasyPrint **bloquea el bucle de eventos (Event Loop) de Python**, encolando todas las peticiones y tardando hasta **80 segundos**.
   - Durante esos 80 segundos, Chrome no recibe nada y el `<iframe />` se muestra como un recuadro **completamente negro o vacío**.

---

### ✅ La Solución Maestra de Forecast (`srcDoc` en Memoria + Descarga On-Demand):
1. **Visor en Caliente Instantáneo (10 milisegundos):**
   - Los datos contables del periodo (`crm_certificados_eventos`) ya existen en la base de datos o en el estado de React.
   - El frontend maqueta las hojas A4 en un string HTML directamente en memoria con JavaScript (`useMemo`).
   - Se inyecta directamente al visor mediante:
     ```tsx
     <iframe srcDoc={htmlDoc} className="w-full min-h-[750px] h-full border-none bg-white rounded-xl shadow-inner" />
     ```
   - El motor del navegador pinta las páginas A4 de inmediato en **0.01 segundos** con hojas blancas, sombras, logos, tipografía nítida y tablas tabuladas.
2. **Descarga de PDF Binario Oficial On-Demand:**
   - La compilación pesada con WeasyPrint en el backend **solo se ejecuta cuando el usuario hace clic en "Descargar PDF"** o "Abrir Pestaña".

---

## 📂 2. Archivos Fuente Originales de Referencia (Forecast)

Los archivos que sirvieron de modelo y contienen el patrón de éxito son:

1. **Componente de Visor Integrado de Forecast:**  
   `C:\Users\rguti\PETRAL.SMART.DASHBOARD\Desarrollo.Profesional\Geeksoft_Frontend\src\components\CommercialForecast\LiquidationsExecutivePdfAudit.tsx`
2. **Página Contenedora de Forecast:**  
   `C:\Users\rguti\PETRAL.SMART.DASHBOARD\Desarrollo.Profesional\Geeksoft_Frontend\src\pages\Tools\LiquidationsAuditPdf_V2.tsx`
3. **URL en Producción de Forecast:**  
   `https://forecast.geeksoft.tech/liquidations-pdf-audit`

---

## 🏗️ 3. Implementación Exacta en InAndes ERP (`InversionistasPage.tsx`)

### 3.1 Ubicación del Código
- **Archivo:** `C:\Users\rguti\Inandes.ERP.React\src\features\inversionistas\InversionistasPage.tsx`
- **Sub-Tab Oficial:** `📄 EECC / RETENCIONES / 2 VISORES`

---

### 3.2 Estructura del Estado en React

```typescript
// 1. Estados de control
const [docFondo, setDocFondo] = useState<string>('TODOS');
const [docViewMode, setDocViewMode] = useState<'dual' | 'eecc' | 'retenciones'>('dual');
const [docReloadKey, setDocReloadKey] = useState<number>(Date.now());
const [docEvents, setDocEvents] = useState<any[]>([]);
const [docLoading, setDocLoading] = useState<boolean>(false);

// 2. Carga reactiva de eventos oficiales de Supabase (crm_certificados_eventos)
useEffect(() => {
  if (activeSubTab === 'documentos') {
    const fetchDocEvents = async () => {
      setDocLoading(true);
      try {
        const { data, error } = await supabase
          .from('crm_certificados_eventos')
          .select('*')
          .eq('fecha_periodo_fin', fEnd);
        if (error) throw error;
        setDocEvents(data || []);
      } catch (err: any) {
        console.error('Error cargando eventos para documentos:', err);
      } finally {
        setDocLoading(false);
      }
    };
    fetchDocEvents();
  }
}, [activeSubTab, fEnd, docReloadKey]);
```

---

### 3.3 Generadores de HTML en Memoria (`useMemo`)

Los generadores toman los eventos contables y producen el HTML completo listo para `srcDoc`:

```typescript
// Generador en Caliente de Estados de Cuenta (EECC)
const htmlEeccDoc = useMemo(() => {
  const fondosMap = new Map(fondosDisponibles.map(f => [f.id_fondo, f]));
  let filtered = docEvents.filter(e => e.fecha_periodo_fin === fEnd);
  if (docFondo && docFondo !== 'TODOS') {
    filtered = filtered.filter(e => 
      (e.id_certificado && e.id_certificado.startsWith(docFondo)) ||
      (e.id_contrato && e.id_contrato.startsWith(docFondo))
    );
  }

  if (docLoading) {
    return `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:60px;text-align:center;color:#64748b;background:#0f172a;">
      <h3 style="color:#38bdf8;">⚡ Cargando datos del periodo cerrado ${fEnd}...</h3>
    </body></html>`;
  }

  if (filtered.length === 0) {
    return `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:60px;text-align:center;color:#94a3b8;background:#0f172a;">
      <h3 style="color:#f1f5f9;margin-bottom:8px;">No hay asientos contables oficiales para ${docFondo || 'TODOS'} al ${fEnd}</h3>
      <p style="font-size:13px;color:#64748b;">Para visualizar los Estados de Cuenta oficiales, oficialice el periodo en la pestaña Auditoría o seleccione otra fecha.</p>
    </body></html>`;
  }

  // Mapear certificados y construir las hojas A4 (.sheet)
  const certs = filtered.map(e => { ... });

  return `<!DOCTYPE html>
  <html lang="es">
  <head>
    <meta charset="UTF-8">
    <title>Estado de Cuenta</title>
    <style>
      @page { size: A4 portrait; margin: 2.0cm; }
      body { font-family: 'Helvetica', 'Arial', sans-serif; font-size: 10pt; line-height: 1.4; color: #1e293b; margin: 0; padding: 20px; background: #0f172a; }
      .sheet { background: #ffffff; padding: 40px; margin: 0 auto 30px auto; max-width: 780px; box-shadow: 0 8px 30px rgba(0,0,0,0.3); border-radius: 8px; border: 1px solid #334155; page-break-after: always; }
      .header { width: 100%; margin-bottom: 25px; }
      .title-box { text-align: center; margin-bottom: 25px; }
      .fin-table { width: 100%; border-collapse: collapse; }
      .totals-section { border: 2px solid #0f172a; padding: 12px; background: #fafafa; border-radius: 4px; }
      .footer { font-size: 8pt; margin-top: 40px; text-align: center; color: #0d47a1; border-top: 1px solid #e2e8f0; padding-top: 10px; }
    </style>
  </head>
  <body>
    ${certs.map(row => `
      <div class="sheet">
        <!-- Contenido idéntico a estado_cuenta_inversionista_v2.html -->
      </div>
    `).join('')}
  </body>
  </html>`;
}, [docEvents, fondosDisponibles, docFondo, fStart, fEnd, docLoading]);
```

---

### 3.4 Contenedor Visual de los 2 Visores (UI / JSX)

```tsx
<div className={`grid gap-6 ${docViewMode === 'dual' ? 'grid-cols-1 xl:grid-cols-2' : 'grid-cols-1'}`}>
  
  {/* VISOR 1: EECC */}
  {(docViewMode === 'dual' || docViewMode === 'eecc') && (
    <div className="flex flex-col gap-2.5 w-full bg-slate-100 dark:bg-slate-950 p-3.5 rounded-2xl border border-slate-250 dark:border-slate-800 shadow-sm">
      
      {/* Header Oscuro Estilo Forecast */}
      <div className="bg-slate-900 text-white p-3 rounded-xl shadow-sm flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <FileText size={18} className="text-emerald-400" />
          <h4 className="text-xs font-black uppercase tracking-wider text-slate-100">
            ESTADOS DE CUENTA (EECC) — {docFondo || 'TODOS'}
          </h4>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => window.open(`https://inandes.react.geeksoft.tech/api/inversionistas/eecc/${docFondo || 'TODOS'}/${fEnd}`, '_blank')}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-[11px] font-mono font-bold"
          >
            Abrir Pestaña
          </button>
          <a
            href={`https://inandes.react.geeksoft.tech/api/inversionistas/eecc/${docFondo || 'TODOS'}/${fEnd}`}
            download={`EECC_${docFondo || 'TODOS'}_${fEnd}.pdf`}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-mono font-bold shadow-xs"
          >
            Descargar PDF
          </a>
        </div>
      </div>

      {/* Contenedor Iframe con srcDoc */}
      <div className="bg-slate-900 rounded-xl overflow-hidden shadow-inner border border-slate-700/60 p-1">
        <iframe
          key={`eecc-frame-${docReloadKey}-${docFondo}-${fEnd}`}
          srcDoc={htmlEeccDoc}
          className="w-full h-[800px] rounded-lg border-none bg-slate-950"
          title="Visor Integrado EECC"
        />
      </div>

    </div>
  )}

  {/* VISOR 2: RETENCIONES (Estructura idéntica alimentada por htmlRetencionesDoc) */}
  ...
</div>
```

---

## ⚡ 4. Backend FastAPI (WeasyPrint Concurrente en VPS)

### 4.1 Archivo y Endpoints
- **Código Fuente Local:** `C:\Users\rguti\Inandes.ERP.React\backend\routers\inversionistas.py`
- **Ubicación en VPS:** `/opt/erp_inandes/backend/routers/inversionistas.py`
- **Servicio Systemd:** `inandes-api.service` (Puerto 8010, `FastAPI + Uvicorn`)

### 4.2 Regla de Oro del Backend (No usar `async def` para WeasyPrint):
```python
# CORRECTO: 'def' permite a FastAPI delegar WeasyPrint al AnyIO ThreadPool sin bloquear el servidor
@router.get("/eecc/{id_fondo}/{fecha_fin}")
def get_eecc_pdf(id_fondo: str, fecha_fin: str):
    cache_dir = Path("/opt/erp_inandes/backend/cache_reports")
    cache_dir.mkdir(parents=True, exist_ok=True)
    cache_file = cache_dir / f"EECC_{id_fondo}_{fecha_fin}.pdf"
    
    # 1. Si ya existe en disco, servir en 0.05 segundos
    if cache_file.exists():
        return FileResponse(
            path=str(cache_file),
            media_type="application/pdf",
            filename=f"EECC_{id_fondo}_{fecha_fin}.pdf"
        )
    
    # 2. Si no existe, compilar una sola vez y guardar en disco
    html_out = template.render(certs=certs, ...)
    HTML(string=html_out).write_pdf(target=str(cache_file))
    
    return FileResponse(
        path=str(cache_file),
        media_type="application/pdf",
        filename=f"EECC_{id_fondo}_{fecha_fin}.pdf"
    )
```

---

## 📋 5. Receta Paso a Paso para Replicar este Visor en Cualquier Módulo Nuevo

Para agregar un visor dual instantáneo en cualquier módulo nuevo (ej. Factoring, Liquidaciones, Liquidaciones de Letras, Auditoría Contable):

1. **Paso 1: Crear la plantilla HTML de referencia:**
   - Crear el archivo `.html` con `@page { size: A4; margin: ... }` y clases `.sheet` con fondo blanco y sombras.
2. **Paso 2: En el componente React, crear el `useMemo` del HTML:**
   - Usar template literals (`` `...` ``) mapeando la lista de registros para generar los bloques `<div class="sheet">...</div>`.
3. **Paso 3: Incrustar el `<iframe srcDoc={htmlDoc} />`:**
   - Envolver el iframe en un contenedor con fondo oscuro (`bg-slate-900`) y `h-[800px]`.
4. **Paso 4: Agregar la barra de acciones superior:**
   - Botón *"Abrir Pestaña"* (`window.open(url_pdf, '_blank')`).
   - Botón *"Descargar PDF"* (`<a href={url_pdf} download="archivo.pdf">`).
   - Botones de Modo: `🔲 Split Dual 50/50`, `📑 Visor 1 (100%)`, `📜 Visor 2 (100%)`.

---

## 🚀 6. Protocolo de Despliegue Rápido

```powershell
# 1. Compilar Frontend
npm run build

# 2. Desplegar al VPS
python deploy_vps.py

# 3. Guardar en Git (main)
git add .
git commit -m "FEAT.VISORES.DUALES.FORECAST"
git push origin main
```
