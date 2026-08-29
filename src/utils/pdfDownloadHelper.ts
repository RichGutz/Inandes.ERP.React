import { getApiBaseUrl } from '../config/apiConfig';

export async function downloadReportPdf(
  htmlDoc: string, 
  filename: string, 
  _orientation: 'portrait' | 'landscape' = 'portrait'
): Promise<void> {
  // 1. Intentar Backend FastAPI de alta velocidad (si está disponible y responde en <2s)
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
      console.warn("Backend PDF no disponible. Usando visor/impresor nativo del navegador:", err);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // 2. Motor Nativo del Navegador: Renderizado vectorial 100% fiel a CSS @page y tipografía contable
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert("Por favor habilite las ventanas emergentes (popups) en el navegador para generar el reporte PDF.");
    return;
  }

  printWindow.document.open();
  printWindow.document.write(htmlDoc);
  printWindow.document.close();

  // Esperar a que el navegador procese los estilos e imágenes base64
  setTimeout(() => {
    printWindow.focus();
    try {
      printWindow.print();
    } catch (e) {
      console.error("Error al abrir diálogo de impresión nativo:", e);
    }
  }, 350);
}
