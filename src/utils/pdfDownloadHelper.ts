import { getApiBaseUrl } from '../config/apiConfig';
import html2pdf from 'html2pdf.js';

export async function downloadReportPdf(
  htmlDoc: string, 
  filename: string, 
  orientation: 'portrait' | 'landscape' = 'portrait'
): Promise<void> {
  // 1. Intentar Backend FastAPI Weasyprint (si responde en <2s)
  const API_BASE = getApiBaseUrl();
  if (API_BASE) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
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
      console.warn("Backend PDF no disponible. Usando generador binario local:", err);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // 2. Motor Binario Client-Side (html2pdf.js) - CERO Sharing Violation en Windows
  // Renderiza en contenedor aislado e inyecta la descarga directa del archivo binario .pdf
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '0';
  container.style.top = '0';
  container.style.width = orientation === 'landscape' ? '1122px' : '794px';
  container.style.zIndex = '-99999';
  container.style.opacity = '0.01';
  container.style.pointerEvents = 'none';
  container.innerHTML = htmlDoc;
  document.body.appendChild(container);

  try {
    // Esperar a que el motor DOM procese estilos y tablas
    await new Promise(r => setTimeout(r, 350));

    const opt = {
      margin: 0,
      filename: filename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { 
        scale: 2, 
        useCORS: true, 
        letterRendering: true, 
        logging: false,
        windowWidth: orientation === 'landscape' ? 1122 : 794
      },
      jsPDF: { unit: 'mm', format: 'a4', orientation: orientation }
    };

    await (html2pdf() as any).set(opt).from(container).save();
  } catch (clientErr) {
    console.error("Error en renderizado PDF cliente:", clientErr);
    throw clientErr;
  } finally {
    if (container.parentNode) {
      document.body.removeChild(container);
    }
  }
}
