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

  const pagesHtml: string[] = [];

  filteredReports.forEach((rep) => {
    const f = rep.fondo;
    rep.blocks.forEach((block, bIdx) => {
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

      pagesHtml.push(`
        <div class="report-page">
          <div>
            <!-- Top Header -->
            <table class="top-header-table">
              <tr>
                <td style="width: 130px;">
                  <img src="/Logo.Geeksoft.png" class="logo-geeksoft" alt="Geeksoft">
                </td>
                <td class="text-center">
                  <div class="report-main-title">REPORTE MAESTRO DE VALOR CUOTA · MOTOR NAV V27</div>
                  <div class="report-sub-title">Período: ${fStart} al ${fEnd} · Año ${anio} · Base 365 / 360 Homologada</div>
                </td>
                <td style="width: 130px;" class="text-right">
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
                <span>MES: <strong>${block.monthName.toUpperCase()}</strong> (Pág ${bIdx + 1} de ${rep.blocks.length})</span>
              </div>
            </div>

            <!-- Month Table -->
            <div class="table-container">
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
          </div>

          <!-- Footer -->
          <div class="page-footer">
            <span>InAndes ERP · Sistema Oficial de Valor Cuota NAV V27 · Balance P&L = 0</span>
            <span>Fecha de Emisión: ${new Date().toLocaleDateString('es-PE')} ${new Date().toLocaleTimeString('es-PE')}</span>
          </div>
        </div>
      `);
    });
  });

  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <title>Reporte Valor Cuota NAV V27</title>
      <style>
        @page {
          size: A4 landscape;
          margin: 0mm !important;
        }
        * {
          box-sizing: border-box;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        html, body {
          margin: 0 !important;
          padding: 0 !important;
          background-color: #ffffff !important;
          font-family: Arial, Helvetica, sans-serif;
          color: #0f172a;
        }
        .report-page {
          width: 297mm;
          min-height: 209mm;
          max-height: 209mm;
          padding: 7mm 9mm;
          margin: 0 auto;
          page-break-after: always;
          page-break-inside: avoid;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }
        .top-header-table {
          width: 100%;
          border-collapse: collapse;
          border-bottom: 2px solid #0f172a;
          padding-bottom: 3px;
          margin-bottom: 4px;
        }
        .top-header-table td {
          vertical-align: middle;
          border: none;
          padding: 1px 4px;
        }
        .logo-geeksoft {
          height: 22px;
          object-fit: contain;
        }
        .logo-inandes {
          height: 22px;
          object-fit: contain;
        }
        .report-main-title {
          font-size: 10.5pt;
          font-weight: 900;
          color: #0f172a;
          letter-spacing: 0.3px;
          text-transform: uppercase;
        }
        .report-sub-title {
          font-size: 7pt;
          font-weight: 600;
          color: #475569;
        }
        .fund-banner {
          background: #0f172a;
          color: #ffffff;
          padding: 3px 6px;
          border-radius: 3px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 7pt;
          margin-bottom: 4px;
        }
        .fund-title {
          font-weight: 700;
        }
        .fund-params {
          display: flex;
          gap: 10px;
          font-size: 6.5pt;
        }
        .table-container {
          width: 100%;
          border: 1px solid #cbd5e1;
          border-radius: 3px;
          overflow: hidden;
        }
        .matrix-table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
          font-size: 5.5pt;
          font-family: 'Consolas', monospace;
        }
        .matrix-table th, .matrix-table td {
          border: 1px solid #cbd5e1;
          padding: 1.5px 1px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .matrix-table thead th {
          background: #1e293b;
          color: #ffffff;
          font-weight: 800;
          font-size: 5.5pt;
          text-align: center;
        }
        .col-item {
          text-align: left !important;
          width: 120px !important;
          min-width: 120px;
          max-width: 120px;
          padding-left: 3px !important;
        }
        .col-day {
          text-align: right;
          width: calc((100% - 120px) / 31);
        }
        .row-label {
          text-align: left;
          font-family: Arial, sans-serif;
          font-weight: 600;
          color: #1e293b;
          background: #f8fafc;
          padding-left: 3px !important;
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
          margin-top: 3px;
          padding-top: 2px;
          border-top: 1px solid #cbd5e1;
          display: flex;
          justify-content: space-between;
          font-size: 5.5pt;
          color: #64748b;
        }
      </style>
    </head>
    <body>
      ${pagesHtml.join('')}
    </body>
    </html>
  `;
}
