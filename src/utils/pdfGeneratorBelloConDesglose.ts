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
    const n = Number(val);
    if (isNaN(n) || Math.abs(n) < 0.000001) return '-';
    const symbol = moneda === 'USD' ? '$ ' : 'S/ ';
    return symbol + n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function fmtNum(val: number | undefined | null) {
    if (val === undefined || val === null) return '-';
    const n = Number(val);
    if (isNaN(n) || Math.abs(n) < 0.000001) return '-';
    return n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

      const fStartFund = fData.fStart || fStart;
      const fEndFund = fData.fEnd || fEnd;
      const diasBaseFund = fData.diasBase || fData.blocks?.[0]?.days?.length || diasBase;

      pagesHtml.push(`
        <div class="report-page">
          <table class="top-header-table">
            <tr>
              <td style="width: 160px;">
                <img src="/Logo.Geeksoft.png" class="logo-geeksoft" alt="Geeksoft">
              </td>
              <td class="text-center">
                <div class="report-main-title">REPORTE INTEGRAL DE LIQUIDACIÓN Y AUDITORÍA</div>
                <div class="report-sub-title">Período: ${fStartFund} al ${fEndFund} (${diasBaseFund} Días Base 365)</div>
              </td>
              <td style="width: 160px;" class="text-right">
                <img src="data:image/jpeg;base64,${LOGO_INANDES_BASE64}" class="logo-inandes" alt="InAndes">
              </td>
            </tr>
          </table>

          <div class="fund-badge-banner">
            FONDO ${fData.fondo.nombre_fondo || fData.fondo.id_fondo} (${fData.fondo.id_fondo}) — MONEDA: ${moneda} &nbsp;|&nbsp; ${certCount} INVERSIONISTAS${parteStr}
          </div>

          <!-- Cajas KPI del BELLO (Tabla Nativa para compatibilidad total de renderizado) -->
          <table class="kpi-cards-table">
            <tr>
              <td class="kpi-card">
                <div class="kpi-title">CAPITAL BASE INICIAL</div>
                <div class="kpi-value">${fmtValCurrency(totals.capital, moneda)}</div>
              </td>
              <td class="kpi-card">
                <div class="kpi-title">INTERÉS BRUTO DEVENGADO</div>
                <div class="kpi-value kpi-value-blue">${fmtValCurrency(totals.bruto_total, moneda)}</div>
              </td>
              <td class="kpi-card">
                <div class="kpi-title">RETENCIÓN IR 5% (2DA CAT)</div>
                <div class="kpi-value kpi-value-red">${fmtValCurrency(totals.impuesto_total, moneda)}</div>
              </td>
              <td class="kpi-card">
                <div class="kpi-title">REPARTO EN EFECTIVO</div>
                <div class="kpi-value kpi-value-green">${fmtValCurrency(totals.reparto_valor, moneda)}</div>
              </td>
              ${(totals.deducciones_total && totals.deducciones_total > 0) ? `
              <td class="kpi-card">
                <div class="kpi-title">DEDUCCIONES TOTALES</div>
                <div class="kpi-value kpi-value-red">${fmtValCurrency(totals.deducciones_total, moneda)}</div>
              </td>` : ''}
              ${(totals.penalidad_rescate && totals.penalidad_rescate > 0) ? `
              <td class="kpi-card">
                <div class="kpi-title">PENALIDADES RESCATE</div>
                <div class="kpi-value kpi-value-red">${fmtValCurrency(totals.penalidad_rescate, moneda)}</div>
              </td>` : ''}
              ${(totals.devolucion_capital && totals.devolucion_capital > 0) ? `
              <td class="kpi-card">
                <div class="kpi-title">DEVOLUCIÓN DE CAPITAL</div>
                <div class="kpi-value kpi-value-red">${fmtValCurrency(totals.devolucion_capital, moneda)}</div>
              </td>` : ''}
              <td class="kpi-card">
                <div class="kpi-title">CAPITAL FINAL VIGENTE</div>
                <div class="kpi-value kpi-value-darkblue">${fmtValCurrency(totals.capital_final, moneda)}</div>
              </td>
            </tr>
          </table>

          <table class="data-table">
            <thead>
              <tr>
                <th class="text-center" style="width: 25px;">#</th>
                <th style="width: 105px;">CERTIFICADO</th>
                <th style="width: 170px;">INVERSIONISTA</th>
                <th class="text-right" style="width: 75px;">CAPITAL BASE</th>
                <th class="text-right" style="width: 60px;">INT. BRUTO</th>
                <th class="text-right" style="width: 50px;">IR (5%)</th>
                <th class="text-right" style="width: 60px;">BASE NETA</th>
                <th class="text-right" style="width: 60px;">CAPITALIZ.</th>
                <th class="text-right" style="width: 60px;">REPARTO</th>
                <th class="text-right" style="width: 50px;">DEDUCC.</th>
                <th class="text-right" style="width: 50px;">PENALID.</th>
                <th class="text-right" style="width: 65px;">NETO FINAL</th>
                <th class="text-right" style="width: 60px;">RESCATES</th>
                <th class="text-right" style="width: 70px;">TRANSFER.</th>
                <th class="text-right" style="width: 75px;">CAPITAL FINAL</th>
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
                    <td class="text-right">-</td>
                    <td class="text-right" style="font-weight: 700;">${fmtNum(r.bruto_total)}</td>
                    <td class="text-right">-</td>
                    <td class="text-right">-</td>
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

                const rNetoFinal = r.neto_total !== undefined ? r.neto_total : ((r.reparto_valor || 0) - (r.deducciones_total || 0));
                const rRescatesNetos = (r.devolucion_capital || 0) - (r.penalidad_rescate || 0);
                const rTransferencia = rNetoFinal + rRescatesNetos;

                return `
                <tr>
                  <td class="text-center">${r.n_orden || ''}</td>
                  <td style="font-weight: 700;">${r.id}</td>
                  <td>${r.inversionista}</td>
                  <td class="text-right" style="font-weight: 700;">${fmtNum(r.capital)}</td>
                  <td class="text-right" style="color: #0284c7; font-weight: 700;">${fmtNum(r.bruto_total)}</td>
                  <td class="text-right" style="color: #dc2626;">${fmtNum(r.impuesto_total)}</td>
                  <td class="text-right">${fmtNum(r.base_neta)}</td>
                  <td class="text-right">${fmtNum(r.capitalizacion)}</td>
                  <td class="text-right" style="color: #059669; font-weight: 700;">${fmtNum(r.reparto_valor)}</td>
                  <td class="text-right">${fmtNum(r.deducciones_total)}</td>
                  <td class="text-right" style="color: #e11d48; font-weight: 700;">${fmtNum(r.penalidad_rescate)}</td>
                  <td class="text-right" style="font-weight: 700;">${fmtNum(rNetoFinal)}</td>
                  <td class="text-right" style="color: #dc2626; font-weight: 700;">${fmtNum(r.devolucion_capital)}</td>
                  <td class="text-right" style="color: #059669; font-weight: 900;">${fmtNum(rTransferencia)}</td>
                  <td class="text-right" style="color: #1e3a8a; font-weight: 800;">${fmtNum(r.capital_final)}</td>
                </tr>`;
              }).join('')}

              ${isLastSubPage ? (() => {
                const totNetoFinal = totals.neto_total !== undefined ? totals.neto_total : ((totals.reparto_valor || 0) - (totals.deducciones_total || 0));
                const totRescatesNetos = (totals.devolucion_capital || 0) - (totals.penalidad_rescate || 0);
                const totTransferencia = totNetoFinal + totRescatesNetos;

                return `
                <tr class="totals-row">
                  <td colspan="3" class="text-center">TOTALES ${fData.fondo.id_fondo} (${moneda})</td>
                  <td class="text-right">${fmtNum(totals.capital)}</td>
                  <td class="text-right">${fmtNum(totals.bruto_total)}</td>
                  <td class="text-right">${fmtNum(totals.impuesto_total)}</td>
                  <td class="text-right">${fmtNum(totals.base_neta)}</td>
                  <td class="text-right">${fmtNum(totals.capitalizacion)}</td>
                  <td class="text-right">${fmtNum(totals.reparto_valor)}</td>
                  <td class="text-right">${fmtNum(totals.deducciones_total)}</td>
                  <td class="text-right">${fmtNum(totals.penalidad_rescate)}</td>
                  <td class="text-right">${fmtNum(totNetoFinal)}</td>
                  <td class="text-right">${fmtNum(totals.devolucion_capital)}</td>
                  <td class="text-right" style="font-weight: 900; color: #059669;">${fmtNum(totTransferencia)}</td>
                  <td class="text-right">${fmtNum(totals.capital_final)}</td>
                </tr>
              `;
              })() : ''}
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
            margin: 0mm !important;
          }
          * { 
            box-sizing: border-box; 
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; 
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          html, body {
            margin: 0 !important; 
            padding: 0 !important; 
            background-color: #ffffff !important; 
            color: #0f172a; 
            font-size: 7pt;
          }
          .report-page {
            width: 297mm;
            min-height: 209mm;
            max-height: 209mm;
            padding: 6mm 8mm;
            margin: 0 auto;
            page-break-after: always;
            page-break-inside: avoid;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
          }
          .top-header-table {
            width: 100%; border-collapse: collapse; margin-bottom: 2px;
          }
          .top-header-table td { border: none; padding: 0; vertical-align: middle; }
          .logo-geeksoft { height: 26px; width: auto; object-fit: contain; }
          .logo-inandes { height: 26px; width: auto; object-fit: contain; }
          .report-main-title {
            font-weight: 900; font-size: 11pt; color: #0f172a; margin: 0; text-transform: uppercase; text-align: center; letter-spacing: 0.3px;
          }
          .report-sub-title {
            font-size: 7.5pt; font-weight: 700; color: #334155; text-align: center; margin-top: 1px;
          }
          .fund-badge-banner {
            background-color: #0284c7; color: #ffffff; font-weight: 800; font-size: 7.5pt; text-transform: uppercase; padding: 2px 10px; border-radius: 4px; text-align: center; margin: 3px auto 4px auto; width: fit-content; max-width: 95%; letter-spacing: 0.2px;
          }
          
          /* Cajas KPI de EL BELLO */
          table.kpi-cards-table {
            width: 100%; border-collapse: separate; border-spacing: 3px 0; margin-bottom: 4px; table-layout: fixed;
          }
          table.kpi-cards-table td.kpi-card {
            background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 3px; padding: 2px 3px; text-align: center; vertical-align: middle;
          }
          .kpi-title {
            font-size: 5pt; font-weight: 800; color: #475569; text-transform: uppercase; margin-bottom: 1px; letter-spacing: 0.1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          }
          .kpi-value {
            font-size: 7.2pt; font-weight: 900; color: #0f172a; white-space: nowrap;
          }
          .kpi-value-green { color: #059669; }
          .kpi-value-red { color: #dc2626; }
          .kpi-value-blue { color: #0284c7; }
          .kpi-value-darkblue { color: #1e3a8a; }

          /* Tabla Contable Bello - Exacto 25 Filas por Hoja */
          table.data-table {
            width: 100%; border-collapse: collapse; margin-bottom: 2px; font-size: 6.2pt; line-height: 1.1;
          }
          table.data-table th {
            background-color: #0f172a !important; color: #ffffff !important; font-weight: 800; text-transform: uppercase; font-size: 5.6pt; padding: 2.5px 1.5px; border: 1px solid #0f172a; text-align: left; letter-spacing: 0.05px;
          }
          table.data-table td {
            border: 1px solid #cbd5e1; padding: 1.5px 2px; vertical-align: middle;
          }
          table.data-table tr:nth-child(even) { background-color: #f8fafc; }
          table.data-table tr.aumento-row { color: #0284c7; font-style: italic; background-color: #f0f9ff !important; }
          table.data-table tr.totals-row { background-color: #ecfdf5 !important; font-weight: bold; border-top: 2px solid #059669; border-bottom: 2px solid #059669; }
          table.data-table tr.totals-row td { color: #064e3b; font-size: 6.5pt; font-weight: 900; }
          .text-right { text-align: right; }
          .text-center { text-align: center; }

          /* Pie de Página Oficial */
          .page-footer {
            width: 100%; margin-top: 2px; border-top: 1px solid #cbd5e1; padding-top: 2px; font-size: 6pt; font-weight: 700; color: #64748b; display: table; table-layout: fixed;
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
