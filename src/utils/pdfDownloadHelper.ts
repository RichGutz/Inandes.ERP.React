import { getApiBaseUrl } from '../config/apiConfig';
// @ts-ignore
import html2pdf from 'html2pdf.js';

export async function downloadReportPdf(
  htmlDoc: string, 
  filename: string, 
  orientation: 'portrait' | 'landscape' = 'portrait'
): Promise<void> {
  try {
    // 1. Limpiar y estructurar HTML
    const bodyContent = htmlDoc
      .replace(/^[\s\S]*?<body[^>]*>/i, '')
      .replace(/<\/body>[\s\S]*$/i, '');
    const headStyles = (htmlDoc.match(/<style[\s\S]*?<\/style>/gi) || []).join('\n');
    const printHtml = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">${headStyles}</head><body>${bodyContent}</body></html>`;

    // 2. Intentar generación de alta velocidad en backend FastAPI
    const API_BASE = getApiBaseUrl();
    const response = await fetch(`${API_BASE}/api/inversionistas/generate-pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ html: printHtml, filename })
    });

    if (response.ok) {
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
    console.warn("Backend PDF endpoint no disponible, ejecutando fallback local con html2pdf.js:", err);
  }

  // 3. Fallback infalible en cliente (html2pdf.js)
  const container = document.createElement('div');
  container.innerHTML = htmlDoc;
  document.body.appendChild(container);

  try {
    const opt = {
      margin: orientation === 'landscape' ? [5, 5, 5, 5] : [10, 10, 10, 10],
      filename: filename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, letterRendering: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: orientation }
    };
    await (html2pdf() as any).set(opt).from(container).save();
  } finally {
    if (container.parentNode) {
      document.body.removeChild(container);
    }
  }
}
