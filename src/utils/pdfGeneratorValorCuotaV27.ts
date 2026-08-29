import { LOGO_INANDES_BASE64 } from '../assets/base64Images';
import type { V26FondoReport } from '../services/fondosService';

export interface VcPdfOptions {
  reports: V26FondoReport[];
  fStart: string;
  fEnd: string;
  selFondo: string;
  anio: number;
}

export function generatePdfValorCuotaV27(options: VcPdfOptions): string {
  const { reports, fStart, fEnd, selFondo, anio } = options;

  const filteredReports = selFondo && selFondo !== 'TODOS'
    ? reports.filter(r => r.fondo.id_fondo === selFondo)
    : reports;

  const formatNumber = (val: any, isVc: boolean = false) => {
    if (val === undefined || val === null || val === '') return '-';
    const n = Number(val);
    if (isNaN(n) || Math.abs(n) < 0.0000001) return '-';
    if (isVc) {
      return n.toLocaleString('es-PE', { minimumFractionDigits: 6, maximumFractionDigits: 6 });
    }
    return n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const pagesHtml = filteredReports.map((rep, fundIdx) => {
    const f = rep.fondo;
    const blocksHtml = rep.blocks.map((block) => {
      const days = block.days;

      const rowsHtml = block.rows.map((row) => {
        if (row.tipo === 'SPACER') {
          return `<tr class="spacer-row"><td colspan="${days.length + 1}"></td></tr>`;
        }

        const isVc = row.id === 'VAL CUOTA INICIAL' || row.id === 'VAL CUOTA FINAL';
        const isHighlight = row.id === 'PATRIMONIO TOTAL CIERRE' || row.id === '(=) CUOTAS TOTALES CIERRE' || row.id === 'GANANCIA TOTAL BRUTA (Base 360)';
        const isCert = row.tipo === 'CERT';

        const rowClass = isVc
          ? 'row-vc'
          : isHighlight
          ? 'row-highlight'
          : isCert
          ? 'row-cert'
          : 'row-standard';

        const cellsHtml = (row.cells || []).map((c) => {
          const valStr = formatNumber(c.val, isVc);
          const cellClass = isVc ? 'cell-vc' : isHighlight ? 'cell-highlight' : '';
          return `<td class="text-right ${cellClass}">${valStr}</td>`;
        }).join('');

        return `
          <tr class="${rowClass}">
            <td class="row-label ${row.label_class || ''}">
              ${row.tipo === 'AUMENTO' ? '&nbsp;&nbsp;↳ ' : ''}${row.id}
            </td>
            ${cellsHtml}
          </tr>
        `;
      }).join('');

      return `
        <div class="month-block">
          <div class="month-header">
            <span>📅 BLOQUE CONTABLE: ${block.monthName.toUpperCase()}</span>
            <span class="dias-badge">${days.length} DÍAS AUDITADOS</span>
          </div>
          <table class="matrix-table">
            <thead>
              <tr>
                <th class="col-item">CONCEPTO / DÍA</th>
                ${days.map(d => `<th class="text-right col-day">${d}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </div>
      `;
    }).join('');

    return `
      <div class="report-page ${fundIdx > 0 ? 'page-break' : ''}">
        <!-- Top Header -->
        <table class="top-header-table">
          <tr>
            <td style="width: 140px;">
              <img src="/Logo.Geeksoft.png" class="logo-geeksoft" alt="Geeksoft">
            </td>
            <td class="text-center">
              <div class="report-main-title">REPORTE OFICIAL DE VALOR CUOTA · MOTOR NAV V27</div>
              <div class="report-sub-title">Período: ${fStart} al ${fEnd} · Año Contable ${anio} · Base 365 / 360 Homologada</div>
            </td>
            <td style="width: 140px;" class="text-right">
              <img src="data:image/jpeg;base64,${LOGO_INANDES_BASE64}" class="logo-inandes" alt="InAndes">
            </td>
          </tr>
        </table>

        <!-- Fund Banner -->
        <div class="fund-banner">
          <div class="fund-title">
            FONDO: <strong>${f.nombre_fondo.toUpperCase()}</strong> (${f.id_fondo}) &nbsp;|&nbsp; MONEDA: <strong>${f.moneda || 'PEN'}</strong>
          </div>
          <div class="fund-params">
            <span>TASA ACTIVA: <strong>${rep.vars.activa}%</strong></span>
            <span>COM. ADMIN: <strong>${rep.vars.admin}%</strong></span>
            <span>BALANCE: <strong>P&L = 0 (EQUILIBRIO NEUTRO)</strong></span>
          </div>
        </div>

        <!-- Matrix Content -->
        ${blocksHtml}

        <!-- Footer -->
        <div class="page-footer">
          <span>InAndes ERP · Sistema Oficial de Valor Cuota NAV V27 · APEFAC & SMV Compliant</span>
          <span>Fecha de Emisión: ${new Date().toLocaleDateString('es-PE')} ${new Date().toLocaleTimeString('es-PE')}</span>
        </div>
      </div>
    `;
  }).join('');

  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <title>Reporte Valor Cuota NAV V27</title>
      <style>
        @page {
          size: A4 landscape;
          margin: 8mm 8mm 8mm 8mm;
        }
        * {
          box-sizing: border-box;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        body {
          font-family: 'Helvetica Neue', Arial, sans-serif;
          font-size: 7pt;
          line-height: 1.15;
          color: #0f172a;
          background: #ffffff;
          margin: 0;
          padding: 0;
        }
        .page-break {
          page-break-before: always;
          margin-top: 15px;
        }
        .report-page {
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .top-header-table {
          width: 100%;
          border-collapse: collapse;
          border-bottom: 2px solid #0f172a;
          padding-bottom: 4px;
          margin-bottom: 4px;
        }
        .top-header-table td {
          vertical-align: middle;
          border: none;
          padding: 2px 4px;
        }
        .logo-geeksoft {
          height: 24px;
          object-fit: contain;
        }
        .logo-inandes {
          height: 24px;
          object-fit: contain;
        }
        .report-main-title {
          font-size: 11pt;
          font-weight: 900;
          color: #0f172a;
          letter-spacing: 0.5px;
          text-transform: uppercase;
        }
        .report-sub-title {
          font-size: 7.5pt;
          font-weight: 600;
          color: #475569;
          margin-top: 1px;
        }
        .fund-banner {
          background: #0f172a;
          color: #ffffff;
          padding: 4px 8px;
          border-radius: 4px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 7.5pt;
        }
        .fund-title {
          font-weight: 600;
          letter-spacing: 0.3px;
        }
        .fund-params {
          display: flex;
          gap: 12px;
          font-size: 7pt;
        }
        .month-block {
          margin-top: 4px;
          border: 1px solid #cbd5e1;
          border-radius: 4px;
          overflow: hidden;
        }
        .month-header {
          background: #f1f5f9;
          color: #0f172a;
          font-size: 7pt;
          font-weight: 800;
          padding: 3px 6px;
          border-bottom: 1px solid #cbd5e1;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .dias-badge {
          background: #e2e8f0;
          padding: 1px 4px;
          border-radius: 3px;
          font-size: 6.5pt;
          font-family: 'Consolas', monospace;
        }
        .matrix-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 6pt;
          font-family: 'Consolas', monospace;
        }
        .matrix-table th, .matrix-table td {
          border: 1px solid #e2e8f0;
          padding: 2px 3px;
          white-space: nowrap;
        }
        .matrix-table thead th {
          background: #1e293b;
          color: #ffffff;
          font-weight: 800;
          font-size: 6pt;
        }
        .col-item {
          text-align: left;
          width: 180px;
          max-width: 180px;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .col-day {
          text-align: right;
          min-width: 32px;
        }
        .row-label {
          text-align: left;
          font-family: 'Helvetica Neue', Arial, sans-serif;
          font-weight: 600;
          color: #1e293b;
          background: #f8fafc;
        }
        .row-vc {
          background: #eff6ff !important;
          font-weight: 900;
        }
        .cell-vc {
          color: #1d4ed8;
          font-weight: 900;
          background: #dbeafe !important;
        }
        .row-highlight {
          background: #f1f5f9;
          font-weight: 700;
        }
        .cell-highlight {
          color: #0f172a;
          font-weight: 800;
        }
        .row-cert {
          color: #334155;
        }
        .spacer-row td {
          background: #f8fafc;
          height: 3px;
          border-top: 1px solid #cbd5e1;
          border-bottom: 1px solid #cbd5e1;
        }
        .text-right {
          text-align: right;
        }
        .text-center {
          text-align: center;
        }
        .page-footer {
          margin-top: 4px;
          padding-top: 3px;
          border-top: 1px solid #cbd5e1;
          display: flex;
          justify-content: space-between;
          font-size: 6pt;
          color: #64748b;
        }
      </style>
    </head>
    <body>
      ${pagesHtml}
    </body>
    </html>
  `;
}
