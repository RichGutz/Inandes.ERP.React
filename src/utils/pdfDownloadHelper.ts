import { getApiBaseUrl } from '../config/apiConfig';

export async function downloadReportPdf(
  htmlDoc: string, 
  filename: string, 
  _orientation: 'portrait' | 'landscape' = 'portrait'
): Promise<void> {
  // 1. Limpieza de estilos y body para el motor WeasyPrint del servidor
  const bodyContent = htmlDoc
    .replace(/^[\s\S]*?<body[^>]*>/i, '')
    .replace(/<\/body>[\s\S]*$/i, '');
  const headStyles = (htmlDoc.match(/<style[\s\S]*?<\/style>/gi) || []).join('\n');
  const printHtml = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">${headStyles}</head><body>${bodyContent}</body></html>`;

  // 2. Llamada directa al Worker Oficial de WeasyPrint en el Backend FastAPI
  const API_BASE = getApiBaseUrl();
  const response = await fetch(`${API_BASE}/api/inversionistas/generate-pdf`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ html: printHtml, filename })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Error al generar PDF en el servidor (HTTP ${response.status}): ${errText}`);
  }

  // 3. Descarga binaria del archivo PDF (.pdf) directamente al disco
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
