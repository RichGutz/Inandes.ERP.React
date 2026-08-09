# Arquitectura y Guia Definitiva: Generacion y Visores de Documentos en Caliente (Estilo Forecast)
# Estado: IMPLEMENTADO Y EN PRODUCCION (100% FUNCIONAL)
# Fecha: 2026-08-08
# Objetivo: Guia canonica para replicar visores de alta resolucion instantaneos sin bloqueos ni pantallas oscuras.

---

## 1. LOS 3 ERRORES CLASICOS QUE ROMPEN EL PDF

### ERROR 1: Iframe con src al backend (genera tile negro y tarda 80 segundos)
```html
<!-- MAL -->
<iframe src="https://api.../eecc/FONDO/2025-07-31" />
```
WeasyPrint compila HTML+CSS+fuentes+imagenes: 15-40s por documento.
Con 2 visores en paralelo con async def en FastAPI: hasta 80s bloqueados.

### ERROR 2: CSS del htmlDoc con fondo oscuro y .sheet con max-width (el efecto TILE)
```css
/* MAL - WeasyPrint renderiza esto LITERALMENTE: */
body { background: #0f172a; }
.sheet { max-width: 780px; margin: 0 auto; box-shadow: 0 8px 30px rgba(0,0,0,0.3); border-radius: 8px; }
/* RESULTADO: cuadro blanco de 780px flotando en A4 negro = TILE */
```

### ERROR 3: Parchear el HTML con regex antes de enviar al backend
```tsx
/* MAL - el override CSS no garantiza ganar en WeasyPrint */
let html = htmlDoc.replace(/background: #0f172a/g, 'background: #ffffff');
```
La causa raiz debe corregirse EN EL CSS FUENTE del useMemo, no con parches.

---

## 2. LA SOLUCION MAESTRA (2 partes inseparables)

### PARTE A: CSS Print-Ready desde la Fuente del useMemo

FORECAST hace esto (LiquidationsExecutivePdfAudit.tsx lineas 508-525):
```css
@page { size: A4 landscape; margin: 0; }
body {
    font-family: 'Courier New', Courier, monospace;
    font-size: 11.5px;
    margin: 0;
    padding: 3mm;
    background: #ffffff;   /* SIEMPRE BLANCO */
}
.paper-container {
    max-width: 100%;       /* SIEMPRE 100%, sin centering */
    background: #ffffff;
}
```

INANDES ERP debe hacer esto (CSS CORRECTO en InversionistasPage.tsx):
```css
/* EECC useMemo - linea ~417 */
@page { size: A4 portrait; margin: 2.0cm 2.0cm 2.0cm 2.0cm; }
body { font-family: 'Helvetica', 'Arial', sans-serif; font-size: 10pt;
       line-height: 1.4; color: #1e293b; margin: 0; padding: 0;
       background: #f1f5f9; }
.sheet { background: #ffffff; padding: 40px; margin: 0 0 30px 0;
         max-width: 100%; width: 100%; box-shadow: none;
         border-radius: 0; border: none; page-break-after: always;
         box-sizing: border-box; }

/* Retenciones useMemo - linea ~631 */
@page { size: A4 portrait; margin: 1.5cm 2cm 2.5cm 2cm; }
body { font-family: 'Helvetica', 'Arial', sans-serif; font-size: 11pt;
       line-height: 1.5; color: #1e293b; margin: 0; padding: 0;
       background: #f1f5f9; }
.sheet { background: #ffffff; padding: 45px 50px; margin: 0 0 30px 0;
         max-width: 100%; width: 100%; box-shadow: none;
         border-radius: 0; border: none; page-break-after: always;
         box-sizing: border-box; }
```
Nota: background #f1f5f9 (gris muy claro) en body para que el visor iframe
muestre espaciado entre hojas. WeasyPrint usa los margenes de @page, no el padding del body.

---

### PARTE B: Extraccion + Reconstruccion del HTML (patron EXACTO Forecast lineas 663-667)

FORECAST:
```tsx
const handlePrintPdf = async () => {
    const bodyContent = htmlDoc
        .replace(/^[\s\S]*?<body[^>]*>/i, '')
        .replace(/<\/body>[\s\S]*$/i, '');
    const headStyles = (htmlDoc.match(/<style[\s\S]*?<\/style>/gi) || []).join('\n');
    const printHtml = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">${headStyles}</head><body>${bodyContent}</body></html>`;

    const response = await fetch(`${apiBase}/utils/generate-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html: printHtml, filename: 'archivo.pdf' }),
    });
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'archivo.pdf';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 10000);
};
```

INANDES ERP (handleDownloadFastPdf en InversionistasPage.tsx):
```tsx
const handleDownloadFastPdf = async (htmlDoc: string, filename: string) => {
    setDownloadingPdf(filename);
    try {
        const bodyContent = htmlDoc
            .replace(/^[\s\S]*?<body[^>]*>/i, '')
            .replace(/<\/body>[\s\S]*$/i, '');
        const headStyles = (htmlDoc.match(/<style[\s\S]*?<\/style>/gi) || []).join('\n');

        // Override de seguridad adicional despues de los estilos fuente
        const pdfOverride = `<style>
            body { background: #ffffff !important; margin: 0 !important; padding: 20px !important; }
            .sheet { max-width: 100% !important; width: 100% !important;
                     margin: 0 !important; box-shadow: none !important;
                     border: none !important; border-radius: 0 !important; }
        </style>`;

        const printHtml = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">${headStyles}${pdfOverride}</head><body>${bodyContent}</body></html>`;

        const response = await fetch('https://inandes.react.geeksoft.tech/api/inversionistas/generate-pdf', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ html: printHtml, filename })
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = filename;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (err: any) {
        alert(`Error descargando PDF: ${err.message}`);
    } finally { setDownloadingPdf(null); }
};
```

---

## 3. VISOR INSTANTANEO: iframe con srcDoc (NUNCA src)

FORECAST:
```tsx
<iframe
    srcDoc={htmlDoc}
    className="w-full min-h-[700px] h-full border-none bg-white"
/>
```

INANDES ERP:
```tsx
<iframe
    key={`eecc-frame-${docReloadKey}-${docFondo}-${fEnd}`}
    srcDoc={htmlEeccDoc}
    className="w-full h-[800px] rounded-lg border-none bg-slate-950"
    title="Visor Integrado EECC"
/>
```

---

## 4. IMAGENES EN EL HTML

FORECAST: importa como assets de React (se convierten a data URLs en build automaticamente):
```tsx
import logoPetral from '../../assets/Logo.Petral.png';
// En htmlDoc:
`<img src="${logoPetral}" style="height: 50px;" />`
```

INANDES ERP: usa rutas relativas /logo_inandes.png que el iframe resuelve, pero
WeasyPrint en VPS no puede. El backend las reemplaza con Base64:
```python
# inversionistas.py - startup
LOGO_BASE64 = base64.b64encode(open("/opt/erp_inandes/backend/static/logo_inandes.png","rb").read()).decode()
FIRMA_BASE64 = base64.b64encode(open("/opt/erp_inandes/backend/static/firma_responsable.png","rb").read()).decode()

# En generate_pdf:
html = html.replace('src="/logo_inandes.png"', f'src="data:image/png;base64,{LOGO_BASE64}"')
html = html.replace('src="/firma_responsable.png"', f'src="data:image/png;base64,{FIRMA_BASE64}"')
```

---

## 5. BACKEND FastAPI: generate-pdf

Regla de Oro: usar def SINCRONO (nunca async def con WeasyPrint):
```python
# CORRECTO: FastAPI delega a AnyIO ThreadPool sin bloquear event loop
@router.post("/generate-pdf")
def generate_pdf_from_html(request: PdfRequest):
    html_content = request.html
    html_content = html_content.replace('src="/logo_inandes.png"',
                                        f'src="data:image/png;base64,{LOGO_BASE64}"')
    html_content = html_content.replace('background: #0f172a', 'background: #ffffff')
    pdf_bytes = HTML(string=html_content, base_url="/").write_pdf()
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={request.filename}"}
    )
```

- Servicio systemd: inandes-api.service
- Puerto: 8010
- VPS: /opt/erp_inandes/backend/routers/inversionistas.py
- URL: https://inandes.react.geeksoft.tech/api/inversionistas/generate-pdf

---

## 6. ARCHIVOS FUENTE DE REFERENCIA

- Forecast (referencia original):
  C:\Users\rguti\PETRAL.SMART.DASHBOARD\Desarrollo.Profesional\Geeksoft_Frontend\src\components\CommercialForecast\LiquidationsExecutivePdfAudit.tsx
- InAndes ERP (implementacion):
  C:\Users\rguti\Inandes.ERP.React\src\features\inversionistas\InversionistasPage.tsx
- Backend:
  C:\Users\rguti\Inandes.ERP.React\backend\routers\inversionistas.py

---

## 7. CHECKLIST ANTES DE CADA RELEASE

- body en htmlDoc tiene background claro (blanco o #f1f5f9), NUNCA #0f172a
- .sheet tiene max-width: 100% y width: 100%, NUNCA max-width: 780px con margin: 0 auto
- .sheet tiene box-shadow: none, border-radius: 0, border: none
- handleDownloadFastPdf extrae body y styles antes de enviar (patron Forecast lineas 663-667)
- Backend endpoint es def sincrono (no async def)
- Backend reemplaza rutas /logo_inandes.png con Base64 antes de WeasyPrint
- iframe usa srcDoc={htmlDoc} (no src=)

---

## 8. PROTOCOLO DE DESPLIEGUE

```powershell
npm run build
python deploy_vps.py
git add .
git commit -m "FIX.PDF.EECC.RETENCIONES.A4.COMPLETO"
git push origin main
```
