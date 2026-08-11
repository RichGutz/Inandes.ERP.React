import { LOGO_INANDES_BASE64 } from '../assets/base64Images';

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

  function fmtValCurrency(val: number | undefined | null, moneda: string) {
    if (val === undefined || val === null) return '-';
    const symbol = moneda === 'USD' ? '$ ' : 'S/ ';
    return symbol + val.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  let diasBase = 59;
  try {
    const d1 = new Date(fStart + 'T00:00:00');
    const d2 = new Date(fEnd + 'T00:00:00');
    const diffTime = Math.abs(d2.getTime() - d1.getTime());
    diasBase = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  } catch (e) {
    diasBase = 59;
  }

  // Generar páginas troceadas de máximo 25 filas por hoja
  const ROWS_PER_PAGE = 25;
  const pagesHtml: string[] = [];
  let globalPageNum = 1;

  // Calcular total global de páginas
  let totalGlobalPages = 0;
  filteredPdfData.forEach((fData: any) => {
    const allRows = fData.blocks[0].rows || [];
    totalGlobalPages += Math.ceil(allRows.length / ROWS_PER_PAGE) || 1;
  });

  filteredPdfData.forEach((fData: any) => {
    const allRows = fData.blocks[0].rows || [];
    const certCount = allRows.filter((r: any) => r.tipo === 'CERT').length;
    const totals = fData.totals || {};
    const moneda = fData.fondo.moneda || 'PEN';

    const numSubPages = Math.ceil(allRows.length / ROWS_PER_PAGE) || 1;

    for (let pageIdx = 0; pageIdx < numSubPages; pageIdx++) {
      const startRow = pageIdx * ROWS_PER_PAGE;
      const endRow = startRow + ROWS_PER_PAGE;
      const pageRows = allRows.slice(startRow, endRow);
      const isLastSubPage = pageIdx === numSubPages - 1;
      const parteStr = numSubPages > 1 ? ` (Parte ${pageIdx + 1} de ${numSubPages})` : '';

      pagesHtml.push(`
        <div class="report-page">
          <table class="top-header-table">
            <tr>
              <td style="width: 160px;">
                <img src="/Logo.Geeksoft.png" class="logo-geeksoft" alt="Geeksoft">
              </td>
              <td class="text-center">
                <div class="report-main-title">REPORTE INTEGRAL DE LIQUIDACIÓN Y AUDITORÍA</div>
                <div class="report-sub-title">Período: ${fStart} al ${fEnd} (${diasBase} Días Base 365)</div>
              </td>
              <td style="width: 160px;" class="text-right">
                <img src="data:image/jpeg;base64,${LOGO_INANDES_BASE64}" class="logo-inandes" alt="InAndes">
              </td>
            </tr>
          </table>

          <div class="fund-badge-banner">
            FONDO ${fData.fondo.nombre_fondo || fData.fondo.id_fondo} (${fData.fondo.id_fondo}) — MONEDA: ${moneda} &nbsp;|&nbsp; ${certCount} INVERSIONISTAS${parteStr}
          </div>

          <!-- Cajas KPI del BELLO -->
          <div class="kpi-cards-grid">
            <div class="kpi-card">
              <div class="kpi-title">CAPITAL BASE INICIAL</div>
              <div class="kpi-value">${fmtValCurrency(totals.capital, moneda)}</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-title">INTERÉS BRUTO DEVENGADO</div>
              <div class="kpi-value kpi-value-blue">${fmtValCurrency(totals.bruto_total, moneda)}</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-title">RETENCIÓN IR 5% (2DA CAT)</div>
              <div class="kpi-value kpi-value-red">${fmtValCurrency(totals.impuesto_total, moneda)}</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-title">REPARTO EN EFECTIVO</div>
              <div class="kpi-value kpi-value-green">${fmtValCurrency(totals.reparto_valor, moneda)}</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-title">CAPITAL FINAL VIGENTE</div>
              <div class="kpi-value kpi-value-darkblue">${fmtValCurrency(totals.capital_final, moneda)}</div>
            </div>
          </div>

          <table class="data-table">
            <thead>
              <tr>
                <th class="text-center" style="width: 22px;">#</th>
                <th style="width: 140px;">CERTIFICADO</th>
                <th>INVERSIONISTA</th>
                <th class="text-right">CAPITAL BASE</th>
                <th class="text-right">INT. BRUTO</th>
                <th class="text-right">IR (5%)</th>
                <th class="text-right">BASE NETA</th>
                <th class="text-right">CAPITALIZ.</th>
                <th class="text-right">REPARTO</th>
                <th class="text-right">DEDUCC.</th>
                <th class="text-right">NETO FINAL</th>
                <th class="text-right">RESCATES</th>
                <th class="text-right">CAPITAL FINAL</th>
              </tr>
            </thead>
            <tbody>
              ${pageRows.map((r: any) => {
                if (r.tipo === 'AUMENTO') {
                  return `
                  <tr class="aumento-row">
                    <td class="text-center">-</td>
                    <td style="font-weight: 700;">${r.id}</td>
                    <td>└─ Incremento de Capital</td>
                    <td class="text-right" style="font-weight: 700;">${fmtValCurrency(r.capital, moneda)}</td>
                    <td class="text-right" style="font-weight: 700;">${fmtValCurrency(r.bruto_total, moneda)}</td>
                    <td class="text-right">-</td>
                    <td class="text-right">-</td>
                    <td class="text-right">-</td>
                    <td class="text-right">-</td>
                    <td class="text-right">-</td>
                    <td class="text-right">-</td>
                    <td class="text-right">-</td>
                    <td class="text-right">-</td>
                  </tr>`;
                }

                return `
                <tr>
                  <td class="text-center">${r.n_orden || ''}</td>
                  <td style="font-weight: 700;">${r.id}</td>
                  <td>${r.inversionista}</td>
                  <td class="text-right" style="font-weight: 700;">${fmtValCurrency(r.capital, moneda)}</td>
                  <td class="text-right" style="color: #0284c7; font-weight: 700;">${fmtValCurrency(r.bruto_total, moneda)}</td>
                  <td class="text-right" style="color: #dc2626;">${fmtValCurrency(r.impuesto_total, moneda)}</td>
                  <td class="text-right">${fmtValCurrency(r.base_neta, moneda)}</td>
                  <td class="text-right">${fmtValCurrency(r.capitalizacion, moneda)}</td>
                  <td class="text-right" style="color: #059669; font-weight: 700;">${fmtValCurrency(r.reparto_valor, moneda)}</td>
                  <td class="text-right">${fmtValCurrency(r.deducciones_total, moneda)}</td>
                  <td class="text-right" style="font-weight: 700;">${fmtValCurrency(r.base_neta - (r.deducciones_total || 0), moneda)}</td>
                  <td class="text-right" style="color: #dc2626; font-weight: 700;">${fmtValCurrency(r.devolucion_capital, moneda)}</td>
                  <td class="text-right" style="color: #1e3a8a; font-weight: 800;">${fmtValCurrency(r.capital_final, moneda)}</td>
                </tr>`;
              }).join('')}

              ${isLastSubPage ? `
                <tr class="totals-row">
                  <td colspan="3" class="text-center">TOTALES ${fData.fondo.id_fondo} (${moneda})</td>
                  <td class="text-right">${fmtValCurrency(totals.capital, moneda)}</td>
                  <td class="text-right">${fmtValCurrency(totals.bruto_total, moneda)}</td>
                  <td class="text-right">${fmtValCurrency(totals.impuesto_total, moneda)}</td>
                  <td class="text-right">${fmtValCurrency(totals.base_neta, moneda)}</td>
                  <td class="text-right">${fmtValCurrency(totals.capitalizacion, moneda)}</td>
                  <td class="text-right">${fmtValCurrency(totals.reparto_valor, moneda)}</td>
                  <td class="text-right">${fmtValCurrency(totals.deducciones_total, moneda)}</td>
                  <td class="text-right">${fmtValCurrency(totals.base_neta - (totals.deducciones_total || 0), moneda)}</td>
                  <td class="text-right">${fmtValCurrency(totals.devolucion_capital, moneda)}</td>
                  <td class="text-right">${fmtValCurrency(totals.capital_final, moneda)}</td>
                </tr>
              ` : ''}
            </tbody>
          </table>

          <div class="page-footer">
            <div class="page-footer-left">INANDES GRUPO FINANCIERO & GEEKSOFT — AUDITORÍA Y CONTROL DE CALIDAD OFICIAL</div>
            <div class="page-footer-right">Página ${globalPageNum} de ${totalGlobalPages}</div>
          </div>
        </div>
      `);

      globalPageNum++;
    }
  });

  return `
    <!DOCTYPE html>
    <html lang="es">
      <head>
        <meta charset="UTF-8">
        <title>REPORTE INTEGRAL DE LIQUIDACIÓN Y AUDITORÍA</title>
        <style>
          @page {
            size: A4 landscape;
            margin: 6mm 8mm 8mm 8mm;
          }
          * { box-sizing: border-box; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; }
          body {
            margin: 0; padding: 0; background-color: #ffffff; color: #0f172a; font-size: 7pt;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .report-page {
            width: 100%;
            page-break-after: always;
          }
          .report-page:last-child {
            page-break-after: auto;
          }
          .top-header-table {
            width: 100%; border-collapse: collapse; margin-bottom: 4px;
          }
          .top-header-table td { border: none; padding: 0; vertical-align: middle; }
          .logo-geeksoft { height: 56px; width: auto; }
          .logo-inandes { height: 48px; width: auto; }
          .report-main-title {
            font-weight: 900; font-size: 13pt; color: #0f172a; margin: 0; text-transform: uppercase; text-align: center; letter-spacing: 0.5px;
          }
          .report-sub-title {
            font-size: 8.5pt; font-weight: 700; color: #334155; text-align: center; margin-top: 1px;
          }
          .fund-badge-banner {
            background-color: #0284c7; color: #ffffff; font-weight: 800; font-size: 8.5pt; text-transform: uppercase; padding: 4px 12px; border-radius: 6px; text-align: center; margin: 6px auto 8px auto; width: fit-content; max-width: 95%; letter-spacing: 0.3px;
          }
          
          /* Cajas KPI de EL BELLO */
          .kpi-cards-grid {
            display: table; width: 100%; margin-bottom: 8px; border-spacing: 4px 0; table-layout: fixed;
          }
          .kpi-card {
            display: table-cell; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 4px; padding: 4px 6px; text-align: center; vertical-align: middle;
          }
          .kpi-title {
            font-size: 6pt; font-weight: 800; color: #475569; text-transform: uppercase; margin-bottom: 2px; letter-spacing: 0.2px;
          }
          .kpi-value {
            font-size: 8.5pt; font-weight: 900; color: #0f172a;
          }
          .kpi-value-green { color: #059669; }
          .kpi-value-red { color: #dc2626; }
          .kpi-value-blue { color: #0284c7; }
          .kpi-value-darkblue { color: #1e3a8a; }

          /* Tabla Contable Bello - Exacto 25 Filas por Hoja */
          table.data-table {
            width: 100%; border-collapse: collapse; margin-bottom: 6px; font-size: 6.8pt; line-height: 1.15;
          }
          table.data-table th {
            background-color: #0f172a !important; color: #ffffff !important; font-weight: 800; text-transform: uppercase; font-size: 6.2pt; padding: 4px 2px; border: 1px solid #0f172a; text-align: left; letter-spacing: 0.1px;
          }
          table.data-table td {
            border: 1px solid #cbd5e1; padding: 2.5px 2.5px; vertical-align: middle;
          }
          table.data-table tr:nth-child(even) { background-color: #f8fafc; }
          table.data-table tr.aumento-row { color: #0284c7; font-style: italic; background-color: #f0f9ff !important; }
          table.data-table tr.totals-row { background-color: #ecfdf5 !important; font-weight: bold; border-top: 2px solid #059669; border-bottom: 3px double #059669; }
          table.data-table tr.totals-row td { color: #064e3b; font-size: 7.2pt; font-weight: 900; }
          .text-right { text-align: right; }
          .text-center { text-align: center; }

          /* Pie de Página Oficial */
          .page-footer {
            width: 100%; margin-top: 6px; border-top: 1px solid #cbd5e1; padding-top: 3px; font-size: 6.5pt; font-weight: 700; color: #64748b; display: table; table-layout: fixed;
          }
          .page-footer-left { display: table-cell; text-align: left; text-transform: uppercase; }
          .page-footer-right { display: table-cell; text-align: right; }
        </style>
      </head>
      <body>
        ${pagesHtml.join('')}
      </body>
    </html>
  `;
}
