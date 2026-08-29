import { LOGO_INANDES_BASE64, LOGO_GEEKSOFT_BASE64 } from '../assets/base64Images';
import type { V26FondoReport } from '../services/fondosService';

export interface VcPdfOptions {
  reports: V26FondoReport[];
  fStart: string;
  fEnd: string;
  selFondo: string;
  anio: number;
}

/**
 * Generador Oficial de Reporte PDF para Valor Cuota NAV V27
 * Estilo Institucional InAndes "El Bello" (Paridad con Retornos y Rendimientos)
 * Divide cada mes en 2 páginas horizontales A4 Landscape (Días 1-15 y Días 16-31 + Cierre)
 * para garantizar máxima legibilidad, oxigenación y nitidez en WeasyPrint.
 */
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
      return n.toLocaleString('en-US', { minimumFractionDigits: 6, maximumFractionDigits: 6 });
    }
    // Si el número tiene 6 o 7 dígitos enteros (>= 100,000), omitir centavos
    if (Math.abs(n) >= 100000) {
      return Math.round(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    }
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const pagesHtml: string[] = [];

  filteredReports.forEach((rep) => {
    const f = rep.fondo;
    const moneda = f.moneda || (f.id_fondo.includes('USD') ? 'USD' : 'PEN');

    rep.blocks.forEach((block) => {
      const allDays = block.days; // ej. ["01/01", "02/01", ..., "31/01"]
      
      // Partición Inteligente Quincenal (2 páginas horizontales por mes)
      const DAYS_PAGE_1 = 15;
      const chunksDays: { days: string[]; startIdx: number; endIdx: number; parteStr: string }[] = [];

      if (allDays.length <= 16) {
        chunksDays.push({
          days: allDays,
          startIdx: 0,
          endIdx: allDays.length,
          parteStr: ''
        });
      } else {
        chunksDays.push({
          days: allDays.slice(0, DAYS_PAGE_1),
          startIdx: 0,
          endIdx: DAYS_PAGE_1,
          parteStr: ' · PARTE 1 (DÍAS 01 AL 15)'
        });
        chunksDays.push({
          days: allDays.slice(DAYS_PAGE_1),
          startIdx: DAYS_PAGE_1,
          endIdx: allDays.length,
          parteStr: ` · PARTE 2 (DÍAS 16 AL ${allDays.length})`
        });
      }

      chunksDays.forEach((chunk, chunkIdx) => {
        const isSecondPart = chunkIdx === 1 || chunk.parteStr.includes('PARTE 2');
        const chunkDays = chunk.days;

        const rowsHtml = block.rows.map((row) => {
          if (row.tipo === 'SPACER') {
            return `<tr class="spacer-row"><td colspan="${chunkDays.length + (isSecondPart ? 3 : 2)}"></td></tr>`;
          }

          const isAumento = row.tipo === 'AUMENTO';
          const isVc = row.id === 'VAL CUOTA INICIAL' || row.id === 'VAL CUOTA FINAL';
          const isTotal = row.tipo === 'TOTAL';
          const isComision = row.id.includes('COM.') || row.id.includes('(-)');
          const isPatrimonioCierre = row.id === 'PATRIMONIO TOTAL CIERRE';
          const isGananciaOperativa = row.id === 'GANANCIA OPERATIVA (Neta)';
          const isCapitalApertura = row.id === 'TOTAL CAPITAL (Apertura)' || row.id === 'CUOTAS APERTURA' || row.id === 'PATRIMONIO TOTAL (Pre-Aportes)';
          const numVal = isAumento ? '-' : (row.num || '');

          const dailyCells = (row.cells || []).slice(chunk.startIdx, chunk.endIdx);
          
          // Cálculo del acumulado / total de cierre para la última columna en la Parte 2
          let totalCierreVal: any = '-';
          if (isSecondPart) {
            const allVals = (row.cells || []).map((c: any) => Number(c.val) || 0);
            if (isVc) {
              totalCierreVal = allVals.length > 0 ? allVals[allVals.length - 1] : 1.0;
            } else if (isCapitalApertura) {
              // No tiene sentido sumar saldos de apertura horizontalmente
              totalCierreVal = '-';
            } else if (isPatrimonioCierre || row.id === '(=) CAPITAL ACUMULADO' || row.id === '(=) CUOTAS TOTALES CIERRE') {
              // Mostrar el saldo exacto de cierre al final del mes
              totalCierreVal = allVals.length > 0 ? allVals[allVals.length - 1] : 0;
            } else {
              totalCierreVal = allVals.reduce((acc: number, v: number) => acc + v, 0);
            }
          }

          let rowClass = 'data-row';
          if (isAumento) rowClass += ' aumento-row';
          if (isTotal) rowClass += ' totals-row';
          if (isComision) rowClass += ' comision-row';
          if (isGananciaOperativa) rowClass += ' ganancia-row';
          if (isPatrimonioCierre) rowClass += ' patrimonio-row';
          if (isVc) rowClass += ' vc-row';

          const cellsHtml = dailyCells.map((c) => {
            const valStr = formatNumber(c.val, isVc);
            return `<td class="text-right ${isVc ? 'font-bold text-blue-700' : ''}">${valStr}</td>`;
          }).join('');

          return `
            <tr class="${rowClass}">
              <td class="text-center col-num">${numVal}</td>
              <td class="col-id ${isAumento ? 'aumento-id' : ''}">
                ${isAumento ? '↳ ' : ''}${row.id}
              </td>
              ${cellsHtml}
              ${isSecondPart ? `
                <td class="text-right font-bold col-total ${isVc ? 'text-blue-800' : (isPatrimonioCierre ? 'text-amber-900' : '')}">
                  ${totalCierreVal === '-' ? '-' : formatNumber(totalCierreVal, isVc)}
                </td>
              ` : ''}
            </tr>
          `;
        }).join('');

        pagesHtml.push(`
          <div class="report-page">
            <!-- 1. Encabezado Superior Institucional -->
            <table class="top-header-table">
              <tr>
                <td style="width: 180px; text-align: left; vertical-align: middle;">
                  <img src="data:image/png;base64,${LOGO_GEEKSOFT_BASE64}" class="logo-geeksoft" alt="Geeksoft">
                </td>
                <td class="text-center" style="vertical-align: middle;">
                  <div class="report-main-title">REPORTE MAESTRO DE VALOR CUOTA NAV V27</div>
                  <div class="report-sub-title">Período: ${block.monthName.toUpperCase()} (${fStart} al ${fEnd}) · Año ${anio} · Base 365 / 360 Homologada</div>
                </td>
                <td style="width: 180px; text-align: right; vertical-align: middle;">
                  <img src="data:image/png;base64,${LOGO_INANDES_BASE64}" class="logo-inandes" alt="InAndes">
                </td>
              </tr>
            </table>

            <!-- 2. Banner Oficial del Fondo -->
            <div class="fund-badge-banner">
              FONDO ${f.nombre_fondo || f.id_fondo} (${f.id_fondo}) — MONEDA: ${moneda} &nbsp;|&nbsp; TASA ACTIVA: ${rep.vars.activa}% &nbsp;|&nbsp; COM. ADMIN: ${rep.vars.admin}%${chunk.parteStr}
            </div>

            <!-- 3. Matriz Contable Diaria Transpuesta -->
            <table class="matrix-table">
              <thead>
                <tr>
                  <th class="text-center" style="width: 24px;">#</th>
                  <th class="text-left" style="width: 180px;">CERTIFICADO / CONCEPTO</th>
                  ${chunkDays.map(d => `<th class="text-right col-day">${d}</th>`).join('')}
                  ${isSecondPart ? `<th class="text-right col-total-header" style="width: 65px;">TOTAL / CIERRE</th>` : ''}
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>

            <!-- 4. Pie de Página Institucional -->
            <div class="page-footer">
              <div style="display: table-cell; text-align: left;">InAndes ERP &copy; 2026 &mdash; Sistema de Gestión de Inversiones y Valor Cuota NAV V27</div>
              <div style="display: table-cell; text-align: center;">${block.monthName} ${chunk.parteStr}</div>
              <div style="display: table-cell; text-align: right;">Generado: ${new Date().toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' })}</div>
            </div>
          </div>
        `);
      });
    });
  });

  return `
    <!DOCTYPE html>
    <html lang="es">
      <head>
        <meta charset="UTF-8">
        <title>REPORTE MAESTRO DE VALOR CUOTA NAV V27</title>
        <style>
          @page {
            size: A4 landscape;
            margin: 3.5mm 5mm !important;
          }
          * { 
            box-sizing: border-box; 
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; 
          }
          html, body {
            margin: 0 !important; 
            padding: 0 !important; 
            background-color: #ffffff !important; 
            color: #0f172a; 
            font-size: 5.4pt;
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
            width: 100%; border-collapse: collapse; margin-bottom: 1.5px;
          }
          .top-header-table td { border: none; padding: 0; vertical-align: middle; }
          .logo-geeksoft { height: 28px; width: auto; object-fit: contain; }
          .logo-inandes { height: 24px; width: auto; object-fit: contain; }
          .report-main-title {
            font-weight: 900; font-size: 9.2pt; color: #0f172a; margin: 0; text-transform: uppercase; text-align: center; letter-spacing: 0.2px; line-height: 1.1;
          }
          .report-sub-title {
            font-size: 6.2pt; font-weight: 700; color: #334155; text-align: center; margin-top: 1px;
          }
          .fund-badge-banner {
            background-color: #0284c7; color: #ffffff; font-weight: 800; font-size: 6.5pt; text-transform: uppercase; padding: 1.2px 8px; border-radius: 3px; text-align: center; margin: 1.2px auto 2px auto; width: fit-content; max-width: 95%; letter-spacing: 0.2px;
          }
          
          /* Tabla Matriz Diaria Oxigenada (Reducida 7% en Altura) */
          table.matrix-table {
            width: 100%; border-collapse: collapse; margin-bottom: 1.5px; font-size: 5.4pt; line-height: 1.10; table-layout: fixed;
          }
          table.matrix-table th {
            background-color: #0f172a !important; color: #ffffff !important; font-weight: 800; text-transform: uppercase; font-size: 5pt; padding: 1.6px 1.2px; border: 1px solid #0f172a;
          }
          table.matrix-table td {
            border: 1px solid #cbd5e1; padding: 1.1px 1.8px; vertical-align: middle; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          }
          table.matrix-table tr:nth-child(even) { background-color: #f8fafc; }
          
          /* Filas Especiales */
          .col-num { font-weight: 800; background: #f1f5f9; }
          .col-id { font-family: monospace; font-weight: 700; font-size: 5.2pt; }
          .aumento-row { color: #059669; font-style: italic; background-color: #f0fdf4 !important; }
          .aumento-id { padding-left: 6px !important; color: #059669 !important; border-left: 2.5px solid #10b981; }
          .totals-row { background-color: #f8fafc !important; font-weight: 800; border-top: 1px solid #94a3b8; }
          .totals-row td { color: #0f172a; font-weight: 800; }
          .comision-row td { color: #dc2626 !important; background-color: #fff1f2 !important; }
          .ganancia-row td { color: #059669 !important; background-color: #ecfdf5 !important; }
          .patrimonio-row { background-color: #fef3c7 !important; border-top: 1.5px solid #d97706; border-bottom: 1.5px solid #d97706; }
          .patrimonio-row td { color: #78350f !important; font-weight: 900; font-size: 5.8pt; }
          .vc-row { background-color: #eff6ff !important; border-top: 1.5px solid #2563eb; border-bottom: 1.5px solid #2563eb; }
          .vc-row td { color: #1e3a8a !important; font-weight: 900; font-size: 5.8pt; }
          .col-total-header { background-color: #1e3a8a !important; }
          .col-total { background-color: #f1f5f9; }
          .spacer-row td { height: 4px; background: #f8fafc; border: none; }

          .text-right { text-align: right; }
          .text-center { text-align: center; }
          .text-left { text-align: left; }

          /* Pie de Página Oficial */
          .page-footer {
            width: 100%; margin-top: 1px; border-top: 1px solid #cbd5e1; padding-top: 1px; font-size: 5pt; font-weight: 700; color: #64748b; display: table; table-layout: fixed;
          }
        </style>
      </head>
      <body>
        ${pagesHtml.join('')}
      </body>
    </html>
  `;
}
