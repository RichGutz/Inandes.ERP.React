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
 * Generador Oficial de Reporte PDF para Valor Cuota NAV V32 (Homologado con "El Bello")
 * - Encabezado institucional de 3 columnas (GeekSoft izq, Título centro, InAndes der).
 * - Banner azul oficial del fondo.
 * - Burbujas KPI únicamente en la Página 1 (Quincena 1) con Tasa Activa a 4 decimales y comisiones en % y monto acumulado.
 * - Grilla con altura compacta (-2%) para ajuste perfecto en 1 hoja por quincena.
 * - Pie de página formal institucional.
 */
export function generatePdfValorCuotaV32(options: VcPdfOptions): string {
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

  const fmtCurrency = (n: number, mon: string) => {
    const prefix = mon === 'USD' ? '$ ' : 'S/ ';
    return `${prefix}${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  let pagesHtml = '';
  let globalPageIdx = 0;

  // Contar total de páginas para numeración en footer
  let totalPagesOverall = 0;
  for (const rep of filteredReports) {
    for (const _blk of rep.blocks) {
      totalPagesOverall += 2; // Quincena 1 y Quincena 2
    }
  }

  for (const report of filteredReports) {
    const moneda = report.fondo.moneda || (report.fondo.id_fondo.includes('USD') ? 'USD' : 'PEN');

    for (const block of report.blocks) {
      const totalDays = block.days.length;
      const midPoint = Math.min(15, totalDays);

      // Obtener el VC de cierre oficial del bloque
      const vcRow = block.rows.find((r: any) => r.is_vc || (r.id && r.id.includes('VAL CUOTA FINAL')));
      let finalVcStr = '-';
      if (vcRow && vcRow.cells && vcRow.cells.length > 0) {
        const lastVal = vcRow.cells[vcRow.cells.length - 1];
        const numVal = parseFloat(String(lastVal).replace(/,/g, ''));
        if (!isNaN(numVal)) {
          finalVcStr = numVal.toLocaleString('en-US', { minimumFractionDigits: 6, maximumFractionDigits: 6 });
        }
      }

      // Obtener montos monetarios acumulados de comisiones del período completo
      const getAcumRowVal = (exactLabel: string) => {
        const r = block.rows.find((x: any) => x.id === exactLabel);
        if (!r || !r.cells || r.cells.length === 0) return 0;
        const lastVal = r.cells[r.cells.length - 1];
        const num = parseFloat(String(lastVal).replace(/,/g, '').replace('$', '').replace('S/', '').trim());
        return isNaN(num) ? 0 : num;
      };

      const totAdminMoney = getAcumRowVal('COM. ADMIN ACUM. (-)');
      const totCapMoney = getAcumRowVal('COM. CAPT. ACUM. (-)');
      const totMiscMoney = getAcumRowVal('COM. MISC. ACUM. (-)');

      const renderPagePart = (
        startDayIdx: number,
        endDayIdx: number,
        partTitle: string,
        isSecondPart: boolean
      ) => {
        globalPageIdx++;
        const partDays = block.days.slice(startDayIdx, endDayIdx);
        const pMiscPct = ((Number(report.fondo.comision_miscelaneos_fondo) || 0)).toFixed(2);
        const pAdminPct = ((Number(report.vars.admin) || 0)).toFixed(2);
        const pActivaPct = ((Number(report.vars.activa) || 0)).toFixed(4); // 4 decimales exactos

        let tableHeaders = `
          <thead>
            <tr>
              <th style="width: 22px;" class="text-center">#</th>
              <th style="width: 145px; text-align: left;">CERTIFICADO / CONCEPTO</th>
        `;
        for (const day of partDays) {
          tableHeaders += `<th style="text-align: right;">${day}</th>`;
        }
        if (isSecondPart) {
          tableHeaders += `<th style="width: 65px; text-align: right; background: #0F172A !important; color: #FFFFFF !important;">TOTAL</th>`;
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
          const isTotalApertura = row.id === 'TOTAL CAPITAL' || row.id === 'CUOTAS APERTURA' || row.id === 'PATRIMONIO TOTAL';

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
          tableBody += `<td class="concepto-cell ${isAumento ? 'text-emerald' : ''}">${isAumento ? `&nbsp;&nbsp;&rdsh; ${row.id}` : row.id}</td>`;

          for (const cellVal of rowCells) {
            tableBody += `<td class="text-right">${formatNumber(cellVal, isVc, isGananciaOp)}</td>`;
          }

          if (isSecondPart) {
            tableBody += `<td class="text-right total-col-cell">${formatNumber(totalHorizVal, isVc, isGananciaOp)}</td>`;
          }

          tableBody += `</tr>`;
        }
        tableBody += '</tbody>';

        // Cajas KPI: solo en la Página 1 (Quincena 1)
        const kpiCardsHtml = !isSecondPart ? `
          <table class="kpi-cards-table">
            <tr>
              <td class="kpi-card">
                <div class="kpi-title">TASA ACTIVA IMPLÍCITA</div>
                <div class="kpi-value kpi-value-blue">${pActivaPct}% <span style="font-size: 4.5pt; font-weight: 700; color: #64748b;">(Base 365)</span></div>
              </td>
              <td class="kpi-card">
                <div class="kpi-title">COM. ADMINISTRACIÓN</div>
                <div class="kpi-value">${pAdminPct}% <span class="kpi-money">(${fmtCurrency(totAdminMoney, moneda)})</span></div>
              </td>
              <td class="kpi-card">
                <div class="kpi-title">COM. CAPTACIÓN</div>
                <div class="kpi-value">2.00% <span class="kpi-money">(${fmtCurrency(totCapMoney, moneda)})</span></div>
              </td>
              <td class="kpi-card">
                <div class="kpi-title">COM. MISCELÁNEOS</div>
                <div class="kpi-value">${pMiscPct}% <span class="kpi-money">(${fmtCurrency(totMiscMoney, moneda)})</span></div>
              </td>
              <td class="kpi-card">
                <div class="kpi-title">GANANCIA OPERATIVA (P&amp;L)</div>
                <div class="kpi-value kpi-value-green">$ 0.00 <span style="font-size: 4.5pt; font-weight: 700; color: #059669;">(CERO NEUTRO)</span></div>
              </td>
              <td class="kpi-card">
                <div class="kpi-title">VALOR CUOTA CIERRE</div>
                <div class="kpi-value kpi-value-darkblue">${finalVcStr}</div>
              </td>
            </tr>
          </table>
        ` : '';

        return `
          <div class="report-page">
            <!-- 1. Encabezado Superior Institucional (Idéntico a El Bello) -->
            <table class="top-header-table">
              <tr>
                <td style="width: 180px; text-align: left; vertical-align: middle;">
                  <img src="data:image/png;base64,${LOGO_GEEKSOFT_BASE64}" class="logo-geeksoft" alt="Geeksoft">
                </td>
                <td class="text-center" style="vertical-align: middle;">
                  <div class="report-main-title">REPORTE OFICIAL DE VALOR CUOTA Y PATRIMONIO</div>
                  <div class="report-sub-title">Período: ${fStart} al ${fEnd} (${block.monthName} &mdash; ${partTitle})</div>
                </td>
                <td style="width: 180px; text-align: right; vertical-align: middle;">
                  <img src="data:image/png;base64,${LOGO_INANDES_BASE64}" class="logo-inandes" alt="InAndes">
                </td>
              </tr>
            </table>

            <!-- 2. Banner Oficial del Fondo -->
            <div class="fund-badge-banner">
              FONDO ${report.fondo.nombre_fondo || report.fondo.id_fondo} (${report.fondo.id_fondo}) &mdash; MONEDA: ${moneda} &nbsp;|&nbsp; MOTOR NAV V31 (GOAL SEEK P&amp;L = 0.00) &nbsp;|&nbsp; ${partTitle.toUpperCase()}
            </div>

            <!-- 3. Cajas KPI de Parámetros del Fondo (Exclusivas de Página 1) -->
            ${kpiCardsHtml}

            <!-- 4. Grilla Contable Oficial (-2% altura compacta) -->
            <table class="data-table">
              ${tableHeaders}
              ${tableBody}
            </table>

            <!-- 5. Pie de Página Institucional -->
            <div class="page-footer">
              <div style="display: table-cell; text-align: left;">InAndes ERP &copy; 2026 &mdash; Sistema de Gestión de Inversiones y Factoring</div>
              <div style="display: table-cell; text-align: center;">Página ${globalPageIdx} de ${totalPagesOverall} &bull; Pass-Through Neutro</div>
              <div style="display: table-cell; text-align: right;">Generado: ${new Date().toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' })}</div>
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
        <title>REPORTE OFICIAL DE VALOR CUOTA Y PATRIMONIO</title>
        <style>
          @page {
            size: A4 landscape;
            margin: 3.2mm 5mm !important;
          }
          * { 
            box-sizing: border-box; 
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; 
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          html, body {
            margin: 0 !important; 
            padding: 0 !important; 
            background-color: #ffffff !important; 
            color: #0f172a; 
            font-size: 5.2pt;
            line-height: 1.08;
          }
          .report-page {
            width: 100%;
            margin: 0;
            padding: 0;
            page-break-after: always;
            page-break-inside: avoid;
            box-sizing: border-box;
          }
          .report-page:last-child {
            page-break-after: avoid;
          }
          .top-header-table {
            width: 100%; border-collapse: collapse; margin-bottom: 1.2px;
          }
          .top-header-table td { border: none; padding: 0; vertical-align: middle; }
          .logo-geeksoft { height: 30px; width: auto; object-fit: contain; }
          .logo-inandes { height: 24px; width: auto; object-fit: contain; }
          .report-main-title {
            font-weight: 900; font-size: 9.2pt; color: #0f172a; margin: 0; text-transform: uppercase; text-align: center; letter-spacing: 0.2px; line-height: 1.05;
          }
          .report-sub-title {
            font-size: 6.2pt; font-weight: 700; color: #334155; text-align: center; margin-top: 0.5px;
          }
          .fund-badge-banner {
            background-color: #0284c7; color: #ffffff; font-weight: 800; font-size: 6.5pt; text-transform: uppercase; padding: 1.2px 8px; border-radius: 3px; text-align: center; margin: 1.2px auto 1.8px auto; width: fit-content; max-width: 95%; letter-spacing: 0.2px;
          }
          
          /* Cajas KPI Inteligentes */
          table.kpi-cards-table {
            width: 100%; border-collapse: separate; border-spacing: 2.5px 0; margin-bottom: 2px; table-layout: fixed;
          }
          table.kpi-cards-table td.kpi-card {
            background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 3px; padding: 1.2px 2px; text-align: center; vertical-align: middle;
          }
          .kpi-title {
            font-size: 4.4pt; font-weight: 800; color: #475569; text-transform: uppercase; margin-bottom: 0.8px; letter-spacing: 0.1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          }
          .kpi-value {
            font-size: 6.5pt; font-weight: 900; color: #0f172a; white-space: nowrap;
          }
          .kpi-money {
            font-size: 5.2pt; font-weight: 700; color: #475569;
          }
          .kpi-value-green { color: #059669; }
          .kpi-value-red { color: #dc2626; }
          .kpi-value-blue { color: #0284c7; }
          .kpi-value-darkblue { color: #1e3a8a; }

          /* Tabla Contable Oficial (-2% Altura Compacta) */
          table.data-table {
            width: 100%; border-collapse: collapse; margin-bottom: 1.5px; font-size: 5.2pt; line-height: 1.08; table-layout: fixed;
          }
          table.data-table th {
            background-color: #0f172a !important; color: #ffffff !important; font-weight: 800; text-transform: uppercase; font-size: 5.0pt; padding: 1.6px 1.2px; border: 0.5px solid #0f172a; text-align: center; letter-spacing: 0.05px;
          }
          table.data-table td {
            border: 0.5px solid #cbd5e1; padding: 0.95px 1.5px; vertical-align: middle; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
          }
          .concepto-cell {
            font-weight: 600;
            color: #1e293b;
          }
          table.data-table tr:nth-child(even) { background-color: #f8fafc; }
          table.data-table tr.aumento-row { color: #0284c7; font-style: italic; background-color: #f0f9ff !important; }
          table.data-table tr.total-row { background-color: #f1f5f9 !important; font-weight: 700; }
          table.data-table tr.vc-row { background-color: #eef2ff !important; font-weight: 800; color: #1d4ed8; }
          table.data-table tr.spacer-row td {
            height: 2px;
            background: #ffffff;
            border: none;
          }
          .total-col-cell {
            background: #f8fafc;
            font-weight: 800;
            border-left: 1px solid #0f172a !important;
          }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
          .text-emerald { color: #059669; font-style: italic; }

          /* Pie de Página Oficial */
          .page-footer {
            width: 100%; margin-top: 1px; border-top: 1px solid #cbd5e1; padding-top: 1px; font-size: 4.8pt; font-weight: 700; color: #64748b; display: table; table-layout: fixed;
          }
        </style>
      </head>
      <body>
        ${pagesHtml}
      </body>
    </html>
  `;
}
