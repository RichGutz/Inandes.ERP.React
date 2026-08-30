import { LOGO_INANDES_BASE64, LOGO_GEEKSOFT_BASE64 } from '../assets/base64Images';
import type { V26FondoReport } from '../services/fondosService';

export interface VcPdfOptions {
  reports: V26FondoReport[];
  fStart: string;
  fEnd: string;
  selFondo: string;
  anio?: number;
}

/**
 * Generador Oficial de Reporte PDF para Valor Cuota NAV V31
 * Incorpora la secuencia contable canónica V26 (Pre-Aportes, Cierre y Goal Seek P&L = 0.00)
 * y partición quincenal en 2 páginas horizontales A4 Landscape.
 */
export function generatePdfValorCuotaV31(options: VcPdfOptions): string {
  const { reports, fStart, fEnd, selFondo } = options;

  const filteredReports = selFondo && selFondo !== 'TODOS'
    ? reports.filter(r => r.fondo.id_fondo === selFondo)
    : reports;

  const formatNumber = (val: any, isVc: boolean = false, isGananciaOp: boolean = false) => {
    if (val === undefined || val === null || val === '') return '-';
    if (isGananciaOp) return '$ 0.00';
    const n = Number(val);
    if (isNaN(n)) return String(val);
    if (Math.abs(n) < 0.0000001) return '$ 0.00';
    if (isVc) {
      return n.toLocaleString('en-US', { minimumFractionDigits: 6, maximumFractionDigits: 6 });
    }
    if (Math.abs(n) >= 100000) {
      return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    }
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  let pagesHtml = '';

  for (const report of filteredReports) {
    for (const block of report.blocks) {
      const totalDays = block.days.length;
      const midPoint = Math.min(15, totalDays);

      const renderPagePart = (
        startDayIdx: number,
        endDayIdx: number,
        partTitle: string,
        isSecondPart: boolean
      ) => {
        const partDays = block.days.slice(startDayIdx, endDayIdx);
        const pMiscPct = ((Number(report.fondo.comision_miscelaneos_fondo) || 0)).toFixed(2);

        let tableHeaders = `
          <thead>
            <tr>
              <th style="width: 22px;">#</th>
              <th style="width: 145px; text-align: left;">CERTIFICADO / CONCEPTO</th>
        `;
        for (const day of partDays) {
          tableHeaders += `<th style="text-align: right;">${day}</th>`;
        }
        if (isSecondPart) {
          tableHeaders += `<th style="width: 65px; text-align: right; background: #0F172A; color: #FFFFFF;">TOTAL</th>`;
        }
        tableHeaders += `</tr></thead>`;

        let tableBody = '<tbody>';
        for (const row of block.rows) {
          if (row.tipo === 'SPACER') {
            tableBody += `
              <tr class="spacer-row">
                <td colspan="${partDays.length + (isSecondPart ? 3 : 2)}"></td>
              </tr>
            `;
            continue;
          }

          const isAumento = Boolean(row.id && row.id.includes('Aumento'));
          const isTotal = row.tipo === 'TOTAL';
          const isVc = Boolean(row.is_vc || (row.id && row.id.includes('VAL CUOTA')));
          const isGananciaOp = Boolean(row.id && row.id.includes('GANANCIA OPERATIVA'));
          const isTotalApertura = row.id === 'TOTAL CAPITAL' || row.id === 'CUOTAS APERTURA' || row.id === 'PATRIMONO TOTAL';

          let trClass = isAumento ? 'aumento-row' : (isTotal ? 'total-row' : 'cert-row');
          if (isVc) trClass += ' vc-row';

          const rowCells = row.cells.slice(startDayIdx, endDayIdx);

          let totalHorizVal: any = '-';
          if (isSecondPart) {
            if (!isVc && !isTotalApertura) {
              if (isGananciaOp) {
                totalHorizVal = 0.00;
              } else {
                let sum = 0;
                for (const c of row.cells) {
                  const numVal = parseFloat(String(c).replace(/,/g, '').replace('$', '').trim());
                  if (!isNaN(numVal)) sum += numVal;
                }
                totalHorizVal = sum;
              }
            } else if (isTotalApertura) {
              totalHorizVal = '-';
            } else if (isVc) {
              const lastCell = row.cells[row.cells.length - 1];
              totalHorizVal = parseFloat(String(lastCell).replace(/,/g, '')) || 1.0;
            }
          }

          tableBody += `<tr class="${trClass}">`;
          tableBody += `<td class="text-center">${row.num || ''}</td>`;
          tableBody += `<td class="concepto-cell ${isAumento ? 'text-emerald' : ''}">${isAumento ? `&nbsp;&nbsp;↳ ${row.id}` : row.id}</td>`;

          for (const cellVal of rowCells) {
            tableBody += `<td class="text-right">${formatNumber(cellVal, isVc, isGananciaOp)}</td>`;
          }

          if (isSecondPart) {
            tableBody += `<td class="text-right total-col-cell">${formatNumber(totalHorizVal, isVc, isGananciaOp)}</td>`;
          }

          tableBody += `</tr>`;
        }
        tableBody += '</tbody>';

        return `
          <div class="sheet-page">
            <div class="header-container">
              <div class="header-left">
                <img src="${LOGO_INANDES_BASE64}" class="logo-inandes" alt="InAndes" />
                <div class="header-text">
                  <div class="header-title">FONDO ${report.fondo.nombre_fondo || report.fondo.id_fondo} (${report.fondo.id_fondo})</div>
                  <div class="header-subtitle">
                    Período: <strong>${fStart} al ${fEnd}</strong> (${block.monthName} - ${partTitle}) | Tasa Activa Implícita Mes: <strong>${report.vars.activa}% (Base 365)</strong> | Com. Admin: <strong>${report.vars.admin}%</strong> | Com. Captación: <strong>2.00%</strong> | Com. Misc: <strong>${pMiscPct}%</strong>
                  </div>
                </div>
              </div>
              <div class="header-right">
                <span class="badge-v31">NAV V31 (P&L = 0.00)</span>
                <img src="${LOGO_GEEKSOFT_BASE64}" class="logo-geeksoft" alt="GeekSoft" />
              </div>
            </div>

            <table class="report-table">
              ${tableHeaders}
              ${tableBody}
            </table>

            <div class="footer-container">
              <span>InAndes Capital S.A.C. • Sistema Oficial ERP • Generado el ${new Date().toLocaleDateString('es-PE')}</span>
              <span>Página de Reporte Institucional • Pass-Through Neutro</span>
            </div>
          </div>
        `;
      };

      pagesHtml += renderPagePart(0, midPoint, 'Quincena 1 (Días 01-15)', false);
      pagesHtml += renderPagePart(midPoint, totalDays, 'Quincena 2 (Días 16-Cierre)', true);
    }
  }

  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <title>Reporte Oficial Valor Cuota NAV V31</title>
      <style>
        @page {
          size: A4 landscape;
          margin: 4mm 5mm;
        }
        * {
          box-sizing: border-box;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          font-size: 5.4pt;
          line-height: 1.10;
          color: #0F172A;
          background: #FFFFFF;
          margin: 0;
          padding: 0;
        }
        .sheet-page {
          page-break-after: always;
          width: 100%;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }
        .sheet-page:last-child {
          page-break-after: auto;
        }
        .header-container {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: #0F172A;
          color: #FFFFFF;
          padding: 4px 8px;
          border-radius: 3px;
          margin-bottom: 3px;
        }
        .header-left {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .logo-inandes {
          height: 20px;
          width: auto;
          object-fit: contain;
        }
        .logo-geeksoft {
          height: 16px;
          width: auto;
          object-fit: contain;
        }
        .header-text {
          display: flex;
          flex-direction: column;
        }
        .header-title {
          font-size: 7.2pt;
          font-weight: 900;
          letter-spacing: 0.3px;
          text-transform: uppercase;
        }
        .header-subtitle {
          font-size: 5.0pt;
          color: #94A3B8;
          margin-top: 1px;
        }
        .header-subtitle strong {
          color: #F8FAFC;
        }
        .header-right {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .badge-v31 {
          background: #10B981;
          color: #FFFFFF;
          padding: 1px 5px;
          border-radius: 2px;
          font-weight: 800;
          font-size: 4.8pt;
          text-transform: uppercase;
        }
        .report-table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
        }
        .report-table th, .report-table td {
          border: 0.5px solid #CBD5E1;
          padding: 1.1px 1.8px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .report-table th {
          background: #1E293B;
          color: #FFFFFF;
          font-size: 5.2pt;
          font-weight: 700;
          text-align: center;
        }
        .concepto-cell {
          font-weight: 600;
          color: #1E293B;
        }
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .text-emerald { color: #059669; font-style: italic; }
        
        .aumento-row {
          background: #F0FDF4;
        }
        .total-row {
          background: #F1F5F9;
          font-weight: 700;
        }
        .vc-row {
          background: #EEF2FF;
          font-weight: 800;
          color: #1D4ED8;
        }
        .spacer-row td {
          height: 3px;
          background: #FFFFFF;
          border: none;
        }
        .total-col-cell {
          background: #F8FAFC;
          font-weight: 800;
          border-left: 1px solid #0F172A !important;
        }
        .footer-container {
          display: flex;
          justify-content: space-between;
          font-size: 4.8pt;
          color: #64748B;
          margin-top: 2px;
          border-top: 0.5px solid #E2E8F0;
          padding-top: 1px;
        }
      </style>
    </head>
    <body>
      ${pagesHtml}
    </body>
    </html>
  `;
}
