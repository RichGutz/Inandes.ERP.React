import { getApiBaseUrl } from '../config/apiConfig';
// @ts-ignore
import html2pdf from 'html2pdf.js';

export async function downloadReportPdf(
  htmlDoc: string, 
  filename: string, 
  orientation: 'portrait' | 'landscape' = 'portrait'
): Promise<void> {
  // 1. Limpiar y estructurar HTML
  const bodyContent = htmlDoc
    .replace(/^[\s\S]*?<body[^>]*>/i, '')
    .replace(/<\/body>[\s\S]*$/i, '');
  const headStyles = (htmlDoc.match(/<style[\s\S]*?<\/style>/gi) || []).join('\n');
  const printHtml = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">${headStyles}</head><body>${bodyContent}</body></html>`;

  // 2. Intentar backend con Timeout de 2.5 segundos
  let backendSuccess = false;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 2500);

  try {
    const API_BASE = getApiBaseUrl();
    if (API_BASE !== undefined) {
      const response = await fetch(`${API_BASE}/api/inversionistas/generate-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html: printHtml, filename }),
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
        backendSuccess = true;
        return;
      }
    }
  } catch (err) {
    console.warn("Backend PDF endpoint no disponible o excedió timeout (2.5s). Usando motor local html2pdf:", err);
  } finally {
    clearTimeout(timeoutId);
  }

  if (backendSuccess) return;

  // 3. Fallback infalible en cliente con html2pdf.js
  const container = document.createElement('div');
  container.innerHTML = printHtml;
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = orientation === 'landscape' ? '297mm' : '210mm';
  container.style.background = '#ffffff';
  container.style.zIndex = '-9999';
  document.body.appendChild(container);

  try {
    const opt = {
      margin: orientation === 'landscape' ? [5, 5, 5, 5] : [8, 8, 8, 8],
      filename: filename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, letterRendering: true, logging: false },
      jsPDF: { unit: 'mm', format: 'a4', orientation: orientation }
    };
    await (html2pdf() as any).set(opt).from(container).save();
  } catch (clientErr) {
    console.error("Error en motor cliente html2pdf:", clientErr);
    throw clientErr;
  } finally {
    if (container.parentNode) {
      document.body.removeChild(container);
    }
  }
}

