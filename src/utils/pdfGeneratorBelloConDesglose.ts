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

  function formatCurrencyVal(amount: number, moneda: string) {
    if (amount === undefined || amount === null) return '-';
    return (moneda === 'USD' ? '$ ' : 'S/ ') + amount.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // Calcular número de días del período base 365
  let diasBase = 59;
  try {
    const d1 = new Date(fStart + 'T00:00:00');
    const d2 = new Date(fEnd + 'T00:00:00');
    const diffTime = Math.abs(d2.getTime() - d1.getTime());
    diasBase = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  } catch (e) {
    diasBase = 59;
  }

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="es">
      <head>
        <meta charset="UTF-8">
        <title>Reporte Integral de Liquidación y Auditoría - ${fEnd}</title>
        <style>
          @page {
            size: A4 landscape;
            margin: 8mm 10mm 12mm 10mm;
          }
          * { box-sizing: border-box; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; }
          body {
            margin: 0; padding: 0; background-color: #ffffff; color: #0f172a; font-size: 8pt;
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
            width: 100%; border-collapse: collapse; margin-bottom: 8px;
          }
          .top-header-table td { border: none; padding: 0; vertical-align: middle; }
          .logo-geeksoft { height: 32px; width: auto; }
          .logo-inandes { height: 42px; width: auto; }
          .report-main-title {
            font-weight: 900; font-size: 13pt; color: #0f172a; margin: 0; text-transform: uppercase; text-align: center; letter-spacing: 0.5px;
          }
          .report-sub-title {
            font-size: 8.5pt; font-weight: 700; color: #475569; text-align: center; margin-top: 2px;
          }
          .fund-badge-banner {
            background-color: #0284c7; color: #ffffff; font-weight: 800; font-size: 9pt; text-transform: uppercase; padding: 5px 12px; border-radius: 6px; text-align: center; margin: 8px auto 12px auto; width: fit-content; max-width: 90%; letter-spacing: 0.5px;
          }
          
          /* Cajas de resumen KPI Métricas de EL BELLO */
          .kpi-cards-grid {
            display: table; width: 100%; margin-bottom: 12px; border-spacing: 6px 0; table-layout: fixed;
          }
          .kpi-card {
            display: table-cell; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px 8px; text-align: center; vertical-align: middle;
          }
          .kpi-title {
            font-size: 6.5pt; font-weight: 800; color: #475569; text-transform: uppercase; margin-bottom: 3px; letter-spacing: 0.3px;
          }
          .kpi-value {
            font-size: 9pt; font-weight: 900; color: #0f172a;
          }
          .kpi-value-green { color: #059669; }
          .kpi-value-red { color: #dc2626; }
          .kpi-value-blue { color: #0284c7; }
          .kpi-value-darkblue { color: #1e3a8a; }

          /* Tabla Contable Bello */
          table.data-table {
            width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 7.5pt;
          }
          table.data-table th {
            background-color: #0f172a !important; color: #ffffff !important; font-weight: 800; text-transform: uppercase; font-size: 6.8pt; padding: 5px 3px; border: 1px solid #0f172a; text-align: left; letter-spacing: 0.2px;
          }
          table.data-table td {
            border: 1px solid #cbd5e1; padding: 4.5px 3px; vertical-align: middle;
          }
          table.data-table tr:nth-child(even) { background-color: #f8fafc; }
          table.data-table tr.aumento-row { color: #0284c7; font-style: italic; background-color: #f0f9ff !important; }
          table.data-table tr.totals-row { background-color: #ecfdf5 !important; font-weight: bold; border-top: 2.5px solid #059669; border-bottom: 3px double #059669; }
          table.data-table tr.totals-row td { color: #064e3b; font-size: 8pt; font-weight: 900; }
          .text-right { text-align: right; }
          .text-center { text-align: center; }

          /* Pie de Página Oficial sin firmas */
          .page-footer {
            width: 100%; margin-top: 10px; border-top: 1px solid #cbd5e1; padding-top: 4px; font-size: 7pt; font-weight: 700; color: #64748b; display: table; table-layout: fixed;
          }
          .page-footer-left { display: table-cell; text-align: left; text-transform: uppercase; }
          .page-footer-right { display: table-cell; text-align: right; }
        </style>
      </head>
      <body>
        ${filteredPdfData.map((fData: any, idx: number) => `
          <div class="report-page">
            <table class="top-header-table">
              <tr>
                <td style="width: 140px;">
                  <img src="/Logo.Geeksoft.png" class="logo-geeksoft" alt="Geeksoft">
                </td>
                <td>
                  <div class="report-main-title">REPORTE INTEGRAL DE LIQUIDACIÓN Y AUDITORÍA</div>
                  <div class="report-sub-title">Período: ${fStart} al ${fEnd} (${diasBase} Días Base 365)</div>
                </td>
                <td style="width: 140px;" class="text-right">
                  <img src="data:image/png;base64,${LOGO_INANDES_BASE64}" class="logo-inandes" alt="InAndes">
                </td>
              </tr>
            </table>

            <div class="fund-badge-banner">
              FONDO ${fData.fondo.nombre_fondo} (${fData.fondo.id_fondo}) — MONEDA: ${fData.fondo.moneda} &nbsp;|&nbsp; ${fData.blocks[0].rows.filter((r: any) => r.tipo === 'CERT').length} Inversionistas
            </div>

            <!-- Cajas KPI del BELLO -->
            <div class="kpi-cards-grid">
              <div class="kpi-card">
                <div class="kpi-title">CAPITAL BASE INICIAL</div>
                <div class="kpi-value">${formatCurrencyVal(fData.totals.capital, fData.fondo.moneda)}</div>
              </div>
              <div class="kpi-card">
                <div class="kpi-title">INTERÉS BRUTO DEVENGADO</div>
                <div class="kpi-value kpi-value-blue">${formatCurrencyVal(fData.totals.bruto_total, fData.fondo.moneda)}</div>
              </div>
              <div class="kpi-card">
                <div class="kpi-title">RETENCIÓN IR 5% (2DA CAT)</div>
                <div class="kpi-value kpi-value-red">${formatCurrencyVal(fData.totals.impuesto_total, fData.fondo.moneda)}</div>
              </div>
              <div class="kpi-card">
                <div class="kpi-title">REPARTO EN EFECTIVO</div>
                <div class="kpi-value kpi-value-green">${formatCurrencyVal(fData.totals.reparto_valor, fData.fondo.moneda)}</div>
              </div>
              <div class="kpi-card">
                <div class="kpi-title">CAPITAL FINAL VIGENTE</div>
                <div class="kpi-value kpi-value-darkblue">${formatCurrencyVal(fData.totals.capital_final, fData.fondo.moneda)}</div>
              </div>
            </div>

            <table class="data-table">
              <thead>
                <tr>
                  <th class="text-center" style="width: 25px;">#</th>
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
                ${fData.blocks[0].rows.map((r: any) => `
                  <tr class="${r.tipo === 'AUMENTO' ? 'aumento-row' : ''}">
                    <td class="text-center">${r.n_orden || ''}</td>
                    <td style="font-weight: 700;">${r.id}</td>
                    <td>${r.inversionista || (r.tipo === 'AUMENTO' ? '└─ Incremento de Capital' : '')}</td>
                    <td class="text-right" style="font-weight: 700;">${formatCurrencyVal(r.capital, fData.fondo.moneda)}</td>
                    <td class="text-right" style="color: #0284c7; font-weight: 700;">${formatCurrencyVal(r.bruto_total, fData.fondo.moneda)}</td>
                    <td class="text-right" style="color: #dc2626;">${r.tipo === 'CERT' ? formatCurrencyVal(r.impuesto_total, fData.fondo.moneda) : '-'}</td>
                    <td class="text-right">${r.tipo === 'CERT' ? formatCurrencyVal(r.base_neta, fData.fondo.moneda) : '-'}</td>
                    <td class="text-right">${r.tipo === 'CERT' ? formatCurrencyVal(r.capitalizacion, fData.fondo.moneda) : '-'}</td>
                    <td class="text-right" style="color: #059669; font-weight: 700;">${r.tipo === 'CERT' ? formatCurrencyVal(r.reparto_valor, fData.fondo.moneda) : '-'}</td>
                    <td class="text-right">${r.tipo === 'CERT' ? formatCurrencyVal(r.deducciones_total, fData.fondo.moneda) : '-'}</td>
                    <td class="text-right" style="font-weight: 700;">${r.tipo === 'CERT' ? formatCurrencyVal(r.base_neta - r.deducciones_total, fData.fondo.moneda) : '-'}</td>
                    <td class="text-right" style="color: #dc2626; font-weight: 700;">${r.tipo === 'CERT' ? formatCurrencyVal(r.devolucion_capital, fData.fondo.moneda) : '-'}</td>
                    <td class="text-right" style="color: #1e3a8a; font-weight: 800;">${r.tipo === 'CERT' ? formatCurrencyVal(r.capital_final, fData.fondo.moneda) : '-'}</td>
                  </tr>
                `).join('')}
                <tr class="totals-row">
                  <td colspan="3" class="text-center">TOTALES ${fData.fondo.id_fondo} (${fData.fondo.moneda})</td>
                  <td class="text-right">${formatCurrencyVal(fData.totals.capital, fData.fondo.moneda)}</td>
                  <td class="text-right">${formatCurrencyVal(fData.totals.bruto_total, fData.fondo.moneda)}</td>
                  <td class="text-right">${formatCurrencyVal(fData.totals.impuesto_total, fData.fondo.moneda)}</td>
                  <td class="text-right">${formatCurrencyVal(fData.totals.base_neta, fData.fondo.moneda)}</td>
                  <td class="text-right">${formatCurrencyVal(fData.totals.capitalizacion, fData.fondo.moneda)}</td>
                  <td class="text-right">${formatCurrencyVal(fData.totals.reparto_valor, fData.fondo.moneda)}</td>
                  <td class="text-right">${formatCurrencyVal(fData.totals.deducciones_total, fData.fondo.moneda)}</td>
                  <td class="text-right">${formatCurrencyVal(fData.totals.base_neta - fData.totals.deducciones_total, fData.fondo.moneda)}</td>
                  <td class="text-right">${formatCurrencyVal(fData.totals.devolucion_capital, fData.fondo.moneda)}</td>
                  <td class="text-right">${formatCurrencyVal(fData.totals.capital_final, fData.fondo.moneda)}</td>
                </tr>
              </tbody>
            </table>

            <div class="page-footer">
              <div class="page-footer-left">INANDES GRUPO FINANCIERO & GEEKSOFT — AUDITORÍA Y CONTROL DE CALIDAD OFICIAL</div>
              <div class="page-footer-right">Página ${idx + 1} de ${filteredPdfData.length}</div>
            </div>
          </div>
        `).join('')}
      </body>
    </html>
  `;

  return htmlContent;
}
