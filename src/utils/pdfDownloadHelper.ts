import { getApiBaseUrl } from '../config/apiConfig';
// @ts-ignore
import html2pdf from 'html2pdf.js';

export async function downloadReportPdf(
  htmlDoc: string, 
  filename: string, 
  orientation: 'portrait' | 'landscape' = 'portrait'
): Promise<void> {
  // 1. Intentar Backend FastAPI de alta velocidad (si existe y responde en <2.5s)
  const API_BASE = getApiBaseUrl();
  if (API_BASE) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);
    try {
      const response = await fetch(`${API_BASE}/api/inversionistas/generate-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html: htmlDoc, filename }),
        signal: controller.signal
      });

      if (response.ok) {
        clearTimeout(timeoutId);
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 10000);
        return;
      }
    } catch (err) {
      console.warn("Backend PDF endpoint no disponible. Activando motor local con iframe:", err);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // 2. Motor Local en Cliente: Iframe aislado que garantiza 100% render de estilos, fuentes e imagenes
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.left = '0';
  iframe.style.top = '0';
  iframe.style.width = orientation === 'landscape' ? '1200px' : '850px';
  iframe.style.height = '1000px';
  iframe.style.zIndex = '-99999';
  iframe.style.opacity = '0.01';
  iframe.style.pointerEvents = 'none';
  document.body.appendChild(iframe);

  try {
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc) throw new Error("No se pudo inicializar el motor de renderizado PDF.");

    iframeDoc.open();
    iframeDoc.write(htmlDoc);
    iframeDoc.close();

    // Esperar a que el navegador procese los estilos y assets base64
    await new Promise(r => setTimeout(r, 400));

    const targetEl = iframeDoc.body;
    const opt = {
      margin: orientation === 'landscape' ? [5, 5, 5, 5] : [8, 8, 8, 8],
      filename: filename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { 
        scale: 2, 
        useCORS: true, 
        letterRendering: true, 
        logging: false,
        windowWidth: orientation === 'landscape' ? 1200 : 850
      },
      jsPDF: { unit: 'mm', format: 'a4', orientation: orientation }
    };

    await (html2pdf() as any).set(opt).from(targetEl).save();
  } catch (clientErr) {
    console.error("Error en renderizado PDF local:", clientErr);
    throw clientErr;
  } finally {
    if (iframe.parentNode) {
      document.body.removeChild(iframe);
    }
  }
}


