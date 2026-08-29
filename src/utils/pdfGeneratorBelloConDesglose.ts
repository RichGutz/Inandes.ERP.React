import { LOGO_INANDES_BASE64 } from '../assets/base64Images';

export interface CertRow {
  num?: number;
  tipo: 'PADRE' | 'AUMENTO' | 'SPACER' | 'TOTAL';
  id_certificado: string;
  inversionista: string;
  capital: number;
  bruto: number;
  impuesto: number;
  reparto: number;
  capitalizacion: number;
  deducciones: number;
  penalidad: number;
  neto: number;
  rescate: number;
  monto_transferir: number;
  capital_final: number;
  fecha_ingreso_str?: string;
  is_first?: boolean;
}

export interface FundReportData {
  fondo: { id_fondo: string; nombre_fondo?: string; moneda?: string };
  fStart: string;
  fEnd: string;
  diasBase?: number;
  rows: CertRow[];
  totals: {
    capital: number;
    bruto_total: number;
    impuesto_total: number;
    reparto_valor: number;
    capitalizacion_valor: number;
    deducciones_total: number;
    penalidad_rescate: number;
    devolucion_capital: number;
    neto_total: number;
    monto_transferir_total: number;
    capital_final: number;
  };
  blocks?: any[];
}

export interface GeneratePdfBelloParams {
  pdfData: FundReportData[];
  fStart: string;
  fEnd: string;
  selFondo?: string;
  diasBase?: number;
}

export function generatePdfBelloConDesglose(params: GeneratePdfBelloParams): string {
  let fundsToRender = params.pdfData || [];
  if (params.selFondo && params.selFondo !== 'TODOS') {
    fundsToRender = fundsToRender.filter(f => f.fondo.id_fondo === params.selFondo);
  }
  return generateReporteBelloPdfHtml(fundsToRender, params.fStart, params.fEnd, params.diasBase || 59);
}

export function generateReporteBelloPdfHtml(
  fundsData: FundReportData[],
  fStart: string,
  fEnd: string,
  diasBase: number = 59
): string {
  const fmtVal = (n: number | undefined | null) => {
    if (n === undefined || n === null || isNaN(n)) return '-';
    if (Math.abs(n) < 0.001) return '-';
    return Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const fmtValCurrency = (n: number | undefined | null, mon: string) => {
    if (n === undefined || n === null || isNaN(n)) return `${mon === 'USD' ? '$' : 'S/'} 0.00`;
    const prefix = mon === 'USD' ? '$ ' : 'S/ ';
    return `${prefix}${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const pagesHtml: string[] = [];

  fundsData.forEach((fData) => {
    const moneda = fData.fondo.moneda || (fData.fondo.id_fondo.includes('USD') ? 'USD' : 'PEN');
    const allRows = fData.rows || [];
    const totals = fData.totals;
    const certCount = allRows.filter(r => r.tipo === 'PADRE').length;

    // Regla de Oro: Exacto 25 filas contables por hoja A4 Landscape
    const ROWS_PER_PAGE = 25;
    const totalPagesFund = Math.max(1, Math.ceil(allRows.length / ROWS_PER_PAGE));

    for (let pageIdx = 0; pageIdx < totalPagesFund; pageIdx++) {
      const pageRows = allRows.slice(pageIdx * ROWS_PER_PAGE, (pageIdx + 1) * ROWS_PER_PAGE);
      const isLastPage = pageIdx === totalPagesFund - 1;
      const parteStr = totalPagesFund > 1 ? ` (PARTE ${pageIdx + 1} DE ${totalPagesFund})` : '';
      const fStartFund = fData.fStart || fStart;
      const fEndFund = fData.fEnd || fEnd;
      const diasBaseFund = fData.diasBase || fData.blocks?.[0]?.days?.length || diasBase;

      pagesHtml.push(`
        <div class="report-page">
          <!-- 1. Encabezado Superior Institucional -->
          <table class="top-header-table">
            <tr>
              <td style="width: 180px; text-align: left; vertical-align: middle;">
                <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-weight: 900; font-size: 13pt; color: #0284c7; letter-spacing: -0.5px; line-height: 1;">
                  GEEK<span style="color: #0f172a;">SOFT</span>
                  <div style="font-size: 5.5pt; font-weight: 800; color: #64748b; letter-spacing: 0.5px; margin-top: 1px;">TECHNOLOGIES</div>
                </div>
              </td>
              <td class="text-center" style="vertical-align: middle;">
                <div class="report-main-title">REPORTE INTEGRAL DE LIQUIDACIÓN Y AUDITORÍA</div>
                <div class="report-sub-title">Período: ${fStartFund} al ${fEndFund} (${diasBaseFund} Días Base 365)</div>
              </td>
              <td style="width: 180px; text-align: right; vertical-align: middle;">
                <img src="data:image/jpeg;base64,${LOGO_INANDES_BASE64}" class="logo-inandes" alt="InAndes">
              </td>
            </tr>
          </table>

          <!-- 2. Banner Oficial del Fondo -->
          <div class="fund-badge-banner">
            FONDO ${fData.fondo.nombre_fondo || fData.fondo.id_fondo} (${fData.fondo.id_fondo}) — MONEDA: ${moneda} &nbsp;|&nbsp; ${certCount} INVERSIONISTAS${parteStr}
          </div>

          <!-- 3. Cajas KPI de Cabecera (Tabla Nativa Compacta) -->
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

          <!-- 4. Grilla Contable Oficial (15 Columnas Estrictas) -->
          <table class="data-table">
            <thead>
              <tr>
                <th class="text-center" style="width: 25px;">#</th>
                <th style="width: 105px;">CERTIFICADO</th>
                <th style="width: 170px;">INVERSIONISTA</th>
                <th class="text-right" style="width: 75px;">CAPITAL BASE</th>
                <th class="text-right" style="width: 60px;">INT. BRUTO</th>
                <th class="text-right" style="width: 55px;">IR (5%)</th>
                <th class="text-right" style="width: 60px;">BASE NETA</th>
                <th class="text-right" style="width: 55px;">CAPITALIZ.</th>
                <th class="text-right" style="width: 60px;">REPARTO</th>
                <th class="text-right" style="width: 50px;">DEDUCC.</th>
                <th class="text-right" style="width: 50px;">PENALID.</th>
                <th class="text-right" style="width: 60px;">NETO FINAL</th>
                <th class="text-right" style="width: 60px;">RESCATES</th>
                <th class="text-right" style="width: 65px;">TRANSFER.</th>
                <th class="text-right" style="width: 75px;">CAPITAL FINAL</th>
              </tr>
            </thead>
            <tbody>
              ${pageRows.map((r) => {
                if (r.tipo === 'AUMENTO') {
                  return `
                    <tr class="aumento-row">
                      <td class="text-center">-</td>
                      <td style="font-family: monospace; font-size: 5.8pt; padding-left: 6px;">&rdsh; AUMENTO ${r.fecha_ingreso_str || ''}</td>
                      <td></td>
                      <td class="text-right" style="color: #64748b;">-</td>
                      <td class="text-right" style="color: #0284c7; font-weight: 700;">${fmtVal(r.bruto)}</td>
                      <td class="text-right" style="color: #dc2626;">${fmtVal(r.impuesto)}</td>
                      <td class="text-right">${fmtVal(r.neto)}</td>
                      <td class="text-right">${fmtVal(r.capitalizacion)}</td>
                      <td class="text-right" style="color: #059669; font-weight: 700;">${fmtVal(r.reparto)}</td>
                      <td class="text-right">${fmtVal(r.deducciones)}</td>
                      <td class="text-right">${fmtVal(r.penalidad)}</td>
                      <td class="text-right" style="font-weight: 700;">${fmtVal(r.neto)}</td>
                      <td class="text-right">${fmtVal(r.rescate)}</td>
                      <td class="text-right">${fmtVal(r.monto_transferir)}</td>
                      <td class="text-right" style="font-weight: 700;">${fmtVal(r.capital_final)}</td>
                    </tr>
                  `;
                }

                return `
                  <tr>
                    <td class="text-center font-bold" style="background: #f8fafc; font-weight: 800;">${r.num || ''}</td>
                    <td class="font-mono font-bold" style="font-weight: 700; font-size: 5.8pt;">${r.id_certificado}</td>
                    <td style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 170px;">${r.inversionista}</td>
                    <td class="text-right font-bold" style="font-weight: 700;">${fmtVal(r.capital)}</td>
                    <td class="text-right text-blue-600" style="color: #0284c7; font-weight: 700;">${fmtVal(r.bruto)}</td>
                    <td class="text-right text-red-600" style="color: #dc2626;">${fmtVal(r.impuesto)}</td>
                    <td class="text-right">${fmtVal(r.bruto && r.impuesto ? r.bruto - r.impuesto : r.neto)}</td>
                    <td class="text-right">${fmtVal(r.capitalizacion)}</td>
                    <td class="text-right text-emerald-600" style="color: #059669; font-weight: 700;">${fmtVal(r.reparto)}</td>
                    <td class="text-right" style="color: #64748b;">${fmtVal(r.deducciones)}</td>
                    <td class="text-right" style="color: #dc2626;">${fmtVal(r.penalidad)}</td>
                    <td class="text-right font-bold" style="font-weight: 700;">${fmtVal(r.neto)}</td>
                    <td class="text-right text-red-600" style="color: #dc2626; font-weight: 700;">${fmtVal(r.rescate)}</td>
                    <td class="text-right text-emerald-600" style="color: #059669; font-weight: 700;">${fmtVal(r.monto_transferir)}</td>
                    <td class="text-right font-bold text-slate-900" style="font-weight: 800;">${fmtVal(r.capital_final)}</td>
                  </tr>
                `;
              }).join('')}

              ${isLastPage ? `
                <tr class="totals-row">
                  <td colspan="3" class="text-right" style="text-align: right; padding-right: 6px; letter-spacing: 0.5px;">TOTALES ${fData.fondo.id_fondo}:</td>
                  <td class="text-right">${fmtVal(totals.capital)}</td>
                  <td class="text-right">${fmtVal(totals.bruto_total)}</td>
                  <td class="text-right">${fmtVal(totals.impuesto_total)}</td>
                  <td class="text-right">${fmtVal(totals.bruto_total - totals.impuesto_total)}</td>
                  <td class="text-right">${fmtVal(totals.capitalizacion_valor)}</td>
                  <td class="text-right">${fmtVal(totals.reparto_valor)}</td>
                  <td class="text-right">${fmtVal(totals.deducciones_total)}</td>
                  <td class="text-right">${fmtVal(totals.penalidad_rescate)}</td>
                  <td class="text-right">${fmtVal(totals.neto_total)}</td>
                  <td class="text-right">${fmtVal(totals.devolucion_capital)}</td>
                  <td class="text-right">${fmtVal(totals.monto_transferir_total)}</td>
                  <td class="text-right">${fmtVal(totals.capital_final)}</td>
                </tr>
              ` : ''}
            </tbody>
          </table>

          <!-- 5. Pie de Página Institucional -->
          <div class="page-footer">
            <div style="display: table-cell; text-align: left;">InAndes ERP &copy; 2026 &mdash; Sistema de Gestión de Inversiones y Factoring</div>
            <div style="display: table-cell; text-align: center;">Página ${pageIdx + 1} de ${totalPagesFund}</div>
            <div style="display: table-cell; text-align: right;">Generado: ${new Date().toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' })}</div>
          </div>
        </div>
      `);
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
            margin: 4mm 6mm !important;
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
            font-size: 7pt;
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
            width: 100%; border-collapse: collapse; margin-bottom: 2px;
          }
          .top-header-table td { border: none; padding: 0; }
          .logo-inandes { height: 24px; width: auto; object-fit: contain; }
          .report-main-title {
            font-weight: 900; font-size: 10pt; color: #0f172a; margin: 0; text-transform: uppercase; text-align: center; letter-spacing: 0.2px; line-height: 1.1;
          }
          .report-sub-title {
            font-size: 6.8pt; font-weight: 700; color: #334155; text-align: center; margin-top: 1px;
          }
          .fund-badge-banner {
            background-color: #0284c7; color: #ffffff; font-weight: 800; font-size: 7.2pt; text-transform: uppercase; padding: 2px 10px; border-radius: 4px; text-align: center; margin: 2px auto 3px auto; width: fit-content; max-width: 95%; letter-spacing: 0.2px;
          }
          
          /* Cajas KPI de EL BELLO */
          table.kpi-cards-table {
            width: 100%; border-collapse: separate; border-spacing: 3px 0; margin-bottom: 3px; table-layout: fixed;
          }
          table.kpi-cards-table td.kpi-card {
            background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 3px; padding: 2px 3px; text-align: center; vertical-align: middle;
          }
          .kpi-title {
            font-size: 4.8pt; font-weight: 800; color: #475569; text-transform: uppercase; margin-bottom: 1px; letter-spacing: 0.1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          }
          .kpi-value {
            font-size: 7pt; font-weight: 900; color: #0f172a; white-space: nowrap;
          }
          .kpi-value-green { color: #059669; }
          .kpi-value-red { color: #dc2626; }
          .kpi-value-blue { color: #0284c7; }
          .kpi-value-darkblue { color: #1e3a8a; }

          /* Tabla Contable Bello - Exacto 25 Filas por Hoja */
          table.data-table {
            width: 100%; border-collapse: collapse; margin-bottom: 2px; font-size: 6pt; line-height: 1.1;
          }
          table.data-table th {
            background-color: #0f172a !important; color: #ffffff !important; font-weight: 800; text-transform: uppercase; font-size: 5.5pt; padding: 2px 1.5px; border: 1px solid #0f172a; text-align: left; letter-spacing: 0.05px;
          }
          table.data-table td {
            border: 1px solid #cbd5e1; padding: 1.2px 2px; vertical-align: middle;
          }
          table.data-table tr:nth-child(even) { background-color: #f8fafc; }
          table.data-table tr.aumento-row { color: #0284c7; font-style: italic; background-color: #f0f9ff !important; }
          table.data-table tr.totals-row { background-color: #ecfdf5 !important; font-weight: bold; border-top: 2px solid #059669; border-bottom: 2px solid #059669; }
          table.data-table tr.totals-row td { color: #064e3b; font-size: 6.2pt; font-weight: 900; }
          .text-right { text-align: right; }
          .text-center { text-align: center; }

          /* Pie de Página Oficial */
          .page-footer {
            width: 100%; margin-top: 2px; border-top: 1px solid #cbd5e1; padding-top: 1.5px; font-size: 5.5pt; font-weight: 700; color: #64748b; display: table; table-layout: fixed;
          }
        </style>
      </head>
      <body>
        ${pagesHtml.join('')}
      </body>
    </html>
  `;
}
