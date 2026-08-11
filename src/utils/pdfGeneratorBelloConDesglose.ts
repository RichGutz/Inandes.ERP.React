import { LOGO_EFI_BASE64 } from '../assets/base64Images';

export interface PdfGeneratorOptions {
  pdfData: any[];
  fStart: string;
  fEnd: string;
  selFondo: string;
}

export function generatePdfBelloConDesglose(options: PdfGeneratorOptions): string {
  const { pdfData, fStart, fEnd, selFondo } = options;

  const filteredPdfData = selFondo && selFondo !== 'TODOS'
    ? pdfData.filter((fData: any) => fData.fondo.id_fondo === selFondo)
    : pdfData;

  function formatCurrencyVal(amount: number, moneda: string) {
    if (amount === undefined || amount === null) return '-';
    return (moneda === 'USD' ? '$ ' : 'S/ ') + amount.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="es">
      <head>
        <meta charset="UTF-8">
        <title>Reporte de Auditoría InAndes - ${fEnd}</title>
        <style>
          @page {
            size: A4 landscape;
            margin: 0mm !important;
          }
          * { box-sizing: border-box; }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background-color: #ffffff !important;
            font-family: Arial, Helvetica, sans-serif;
            color: #1e293b;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .report-page {
            width: 297mm;
            min-height: 210mm;
            padding: 10mm 12mm;
            margin: 0 auto;
            page-break-after: always;
            page-break-inside: avoid;
          }
          .header-container {
            position: relative;
            text-align: center;
            margin-bottom: 12px;
            padding-bottom: 8px;
            border-bottom: 2px solid #059669;
          }
          .header-right {
            position: absolute;
            right: 0;
            top: 0;
          }
          .logo {
            width: 105px;
            max-height: 42px;
            object-fit: contain;
          }
          .header-center {
            margin: 0 auto;
            text-align: center;
          }
          .company-title {
            font-weight: 900;
            font-size: 11.5pt;
            text-transform: uppercase;
            color: #064e3b;
            margin: 0 0 2px 0;
          }
          .report-title {
            font-weight: 800;
            font-size: 10.5pt;
            text-transform: uppercase;
            color: #0f172a;
            margin: 0 0 2px 0;
          }
          .period-subtitle {
            font-size: 9pt;
            font-weight: bold;
            color: #475569;
            text-transform: uppercase;
            margin: 0;
          }
          .fund-section-title {
            font-size: 10pt;
            font-weight: bold;
            color: #064e3b;
            margin: 10px 0 4px 0;
            text-transform: uppercase;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 16px;
            font-size: 8pt;
          }
          th {
            background-color: #0f172a !important;
            color: #ffffff !important;
            font-weight: bold;
            text-transform: uppercase;
            font-size: 7.5pt;
            padding: 4px 3px;
            text-align: left;
            border: 1px solid #0f172a;
          }
          td {
            border: 1px solid #cbd5e1;
            padding: 3.5px 3px;
            vertical-align: middle;
          }
          .totals-row {
            background-color: #f1f5f9 !important;
            font-weight: bold;
            border-top: 2px solid #0f172a;
          }
          .aumento-row {
            color: #0369a1;
            font-style: italic;
            background-color: #f0f9ff !important;
          }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
        </style>
      </head>
      <body>
        <div class="report-page">
          <div class="header-container">
            <div class="header-right">
              <img src="data:image/png;base64,${LOGO_EFI_BASE64}" class="logo" alt="EFI">
            </div>
            <div class="header-center">
              <div class="company-title">INANDES ACTIVOS ALTERNATIVOS S.A.C.</div>
              <div class="report-title">REPORTE OFICIAL DE AUDITORÍA Y DEVENGUE DE RETORNOS (MOTOR V40)</div>
              <div class="period-subtitle">FECHA DE CORTE: DEL ${fStart} AL ${fEnd}</div>
            </div>
          </div>
          
          ${filteredPdfData.map((fData: any) => `
            <div class="fund-section-title">FONDO: ${fData.fondo.nombre_fondo} (${fData.fondo.id_fondo}) — MONEDA: ${fData.fondo.moneda}</div>
            <table>
              <thead>
                <tr>
                  <th class="text-center" style="width: 25px;">N°</th>
                  <th style="width: 85px;">Certificado</th>
                  <th>Inversionista</th>
                  <th class="text-right">Capital Base</th>
                  <th class="text-right">Int. Bruto</th>
                  <th class="text-right">IR (5%)</th>
                  <th class="text-right">Neto Disp.</th>
                  <th class="text-right">Capitaliz.</th>
                  <th class="text-right">Reparto</th>
                  <th class="text-right">Deducciones</th>
                  <th class="text-right">Rescates</th>
                  <th class="text-right">Capital Final</th>
                </tr>
              </thead>
              <tbody>
                ${fData.blocks[0].rows.map((r: any) => `
                  <tr class="${r.tipo === 'AUMENTO' ? 'aumento-row' : ''}">
                    <td class="text-center">${r.n_orden || ''}</td>
                    <td>${r.id}</td>
                    <td>${r.inversionista || (r.tipo === 'AUMENTO' ? '└─ Incremento de Capital' : '')}</td>
                    <td class="text-right">${formatCurrencyVal(r.capital, fData.fondo.moneda)}</td>
                    <td class="text-right">${formatCurrencyVal(r.bruto_total, fData.fondo.moneda)}</td>
                    <td class="text-right">${r.tipo === 'CERT' ? formatCurrencyVal(r.impuesto_total, fData.fondo.moneda) : '-'}</td>
                    <td class="text-right">${r.tipo === 'CERT' ? formatCurrencyVal(r.base_neta, fData.fondo.moneda) : '-'}</td>
                    <td class="text-right">${r.tipo === 'CERT' ? formatCurrencyVal(r.capitalizacion, fData.fondo.moneda) : '-'}</td>
                    <td class="text-right">${r.tipo === 'CERT' ? formatCurrencyVal(r.reparto_valor, fData.fondo.moneda) : '-'}</td>
                    <td class="text-right">${r.tipo === 'CERT' ? formatCurrencyVal(r.deducciones_total, fData.fondo.moneda) : '-'}</td>
                    <td class="text-right">${r.tipo === 'CERT' ? formatCurrencyVal(r.devolucion_capital, fData.fondo.moneda) : '-'}</td>
                    <td class="text-right">${r.tipo === 'CERT' ? formatCurrencyVal(r.capital_final, fData.fondo.moneda) : '-'}</td>
                  </tr>
                `).join('')}
                <tr class="totals-row">
                  <td colspan="3" class="text-center">TOTALES ACUMULADOS</td>
                  <td class="text-right">${formatCurrencyVal(fData.totals.capital, fData.fondo.moneda)}</td>
                  <td class="text-right">${formatCurrencyVal(fData.totals.bruto_total, fData.fondo.moneda)}</td>
                  <td class="text-right">${formatCurrencyVal(fData.totals.impuesto_total, fData.fondo.moneda)}</td>
                  <td class="text-right">${formatCurrencyVal(fData.totals.base_neta, fData.fondo.moneda)}</td>
                  <td class="text-right">${formatCurrencyVal(fData.totals.capitalizacion, fData.fondo.moneda)}</td>
                  <td class="text-right">${formatCurrencyVal(fData.totals.reparto_valor, fData.fondo.moneda)}</td>
                  <td class="text-right">${formatCurrencyVal(fData.totals.deducciones_total, fData.fondo.moneda)}</td>
                  <td class="text-right">${formatCurrencyVal(fData.totals.devolucion_capital, fData.fondo.moneda)}</td>
                  <td class="text-right">${formatCurrencyVal(fData.totals.capital_final, fData.fondo.moneda)}</td>
                </tr>
              </tbody>
            </table>
          `).join('')}
        </div>
      </body>
    </html>
  `;

  return htmlContent;
}
