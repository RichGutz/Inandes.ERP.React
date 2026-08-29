import { LOGO_INANDES_BASE64, LOGO_GEEKSOFT_BASE64 } from '../assets/base64Images';

export interface CertRow {
  num?: number | string;
  n_orden?: number | string;
  tipo: 'PADRE' | 'AUMENTO' | 'SPACER' | 'TOTAL';
  id?: string;
  id_certificado?: string;
  inversionista?: string;
  titular?: string;
  capital?: number;
  capital_base?: number;
  bruto?: number;
  bruto_total?: number;
  impuesto?: number;
  impuesto_total?: number;
  base_neta?: number;
  reparto?: number;
  reparto_valor?: number;
  capitalizacion?: number;
  capitalizacion_valor?: number;
  deducciones?: number;
  deducciones_total?: number;
  penalidad?: number;
  penalidad_rescate?: number;
  neto?: number;
  neto_total?: number;
  rescate?: number;
  devolucion_capital?: number;
  monto_transferir?: number;
  monto_transferido?: number;
  capital_final?: number;
  fecha_ingreso_str?: string;
  is_first?: boolean;
  is_aumento?: boolean;
}

export interface FundReportData {
  fondo: { id_fondo: string; nombre_fondo?: string; moneda?: string };
  fStart?: string;
  fEnd?: string;
  diasBase?: number;
  rows?: CertRow[];
  totals: {
    capital: number;
    bruto_total: number;
    impuesto_total: number;
    base_neta?: number;
    reparto_valor: number;
    capitalizacion_valor: number;
    deducciones_total: number;
    penalidad_rescate: number;
    devolucion_capital: number;
    neto_total: number;
    monto_transferir_total?: number;
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
    
    // Extraer filas contables: ya sea desde fData.rows o fData.blocks[0].rows
    const allRows: CertRow[] = (fData.rows && fData.rows.length > 0)
      ? fData.rows
      : (fData.blocks?.[0]?.rows || []);

    const totals = fData.totals || {
      capital: 0, bruto_total: 0, impuesto_total: 0, base_neta: 0,
      reparto_valor: 0, capitalizacion_valor: 0, deducciones_total: 0,
      penalidad_rescate: 0, devolucion_capital: 0, neto_total: 0,
      monto_transferir_total: 0, capital_final: 0
    };

    // Cálculos de Paridad Idénticos a Excel Maestro
    const totNetoFinal = totals.neto_total !== undefined 
      ? totals.neto_total 
      : Math.round(((totals.reparto_valor || 0) - (totals.deducciones_total || 0)) * 100) / 100;
    const totRescatesNetos = Math.round(((totals.devolucion_capital || 0) - (totals.penalidad_rescate || 0)) * 100) / 100;
    const totTransferencia = Math.round((totNetoFinal + totRescatesNetos) * 100) / 100;

    const certCount = allRows.filter(r => r.tipo === 'PADRE' || (!r.tipo && !r.is_aumento)).length;

    // 🎯 ALGORITMO COMPAGINADOR INTELIGENTE (<= 40 Filas Útiles por Hoja A4 Landscape)
    const MAX_ROWS_SINGLE_PAGE = 40;
    const ROWS_PER_PAGE_SPLIT = 35; // Cuando supera 40 filas, divide equitativamente

    let chunks: CertRow[][] = [];
    if (allRows.length <= MAX_ROWS_SINGLE_PAGE) {
      chunks = [allRows];
    } else {
      const numPages = Math.ceil(allRows.length / ROWS_PER_PAGE_SPLIT);
      const chunkSize = Math.ceil(allRows.length / numPages);
      for (let i = 0; i < allRows.length; i += chunkSize) {
        chunks.push(allRows.slice(i, i + chunkSize));
      }
    }

    const totalPagesFund = chunks.length;

    for (let pageIdx = 0; pageIdx < totalPagesFund; pageIdx++) {
      const pageRows = chunks[pageIdx];
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
                <img src="data:image/png;base64,${LOGO_GEEKSOFT_BASE64}" class="logo-geeksoft" alt="Geeksoft">
              </td>
              <td class="text-center" style="vertical-align: middle;">
                <div class="report-main-title">REPORTE INTEGRAL DE LIQUIDACIÓN Y AUDITORÍA</div>
                <div class="report-sub-title">Período: ${fStartFund} al ${fEndFund} (${diasBaseFund} Días Base 365)</div>
              </td>
              <td style="width: 180px; text-align: right; vertical-align: middle;">
                <img src="data:image/png;base64,${LOGO_INANDES_BASE64}" class="logo-inandes" alt="InAndes">
              </td>
            </tr>
          </table>

          <!-- 2. Banner Oficial del Fondo -->
          <div class="fund-badge-banner">
            FONDO ${fData.fondo.nombre_fondo || fData.fondo.id_fondo} (${fData.fondo.id_fondo}) — MONEDA: ${moneda} &nbsp;|&nbsp; ${certCount} INVERSIONISTAS${parteStr}
          </div>

          <!-- 3. Cajas KPI de Cabecera Inteligentes (Solo se muestran si tienen valor > 0) -->
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
              ${(totals.impuesto_total && totals.impuesto_total > 0) ? `
              <td class="kpi-card">
                <div class="kpi-title">RETENCIÓN IR 5% (2DA CAT)</div>
                <div class="kpi-value kpi-value-red">${fmtValCurrency(totals.impuesto_total, moneda)}</div>
              </td>` : ''}
              ${(totals.reparto_valor && totals.reparto_valor > 0) ? `
              <td class="kpi-card">
                <div class="kpi-title">REPARTO EN EFECTIVO</div>
                <div class="kpi-value kpi-value-green">${fmtValCurrency(totals.reparto_valor, moneda)}</div>
              </td>` : ''}
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
              ${(totTransferencia && totTransferencia > 0) ? `
              <td class="kpi-card">
                <div class="kpi-title">TOTAL TRANSFERENCIAS</div>
                <div class="kpi-value kpi-value-green">${fmtValCurrency(totTransferencia, moneda)}</div>
              </td>` : ''}
              <td class="kpi-card">
                <div class="kpi-title">CAPITAL FINAL VIGENTE</div>
                <div class="kpi-value kpi-value-darkblue">${fmtValCurrency(totals.capital_final, moneda)}</div>
              </td>
            </tr>
          </table>

          <!-- 4. Grilla Contable Oficial (15 Columnas Estrictas con Alto +10%) -->
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
                const certId = r.id || r.id_certificado || '';
                const titular = r.inversionista || r.titular || '';
                const isAumento = r.tipo === 'AUMENTO' || (r.is_aumento === true);
                const nOrden = r.n_orden || r.num || (isAumento ? '-' : '');
                const capBase = r.capital !== undefined ? r.capital : (r.capital_base || 0);
                const intBruto = r.bruto_total !== undefined ? r.bruto_total : (r.bruto || 0);
                const irImp = r.impuesto_total !== undefined ? r.impuesto_total : (r.impuesto || 0);
                const baseNeta = r.base_neta !== undefined ? r.base_neta : (intBruto && irImp ? intBruto - irImp : (r.neto || 0));
                const capZ = r.capitalizacion !== undefined ? r.capitalizacion : (r.capitalizacion_valor || 0);
                const repVal = r.reparto_valor !== undefined ? r.reparto_valor : (r.reparto || 0);
                const deducTot = r.deducciones_total !== undefined ? r.deducciones_total : (r.deducciones || 0);
                const penResc = r.penalidad_rescate !== undefined ? r.penalidad_rescate : (r.penalidad || 0);
                
                // Mapeo Paritario 1:1 con Excel Maestro
                const rNetoFinal = isAumento ? 0 : (r.neto_total !== undefined ? r.neto_total : Math.round(((repVal || 0) - (deducTot || 0)) * 100) / 100);
                const rDevolucionCap = isAumento ? 0 : (r.devolucion_capital !== undefined ? r.devolucion_capital : (r.rescate || 0));
                const rRescatesNetos = isAumento ? 0 : Math.round(((rDevolucionCap || 0) - (penResc || 0)) * 100) / 100;
                const rTransferencia = isAumento ? 0 : Math.round((rNetoFinal + rRescatesNetos) * 100) / 100;
                const capFin = r.capital_final || 0;

                if (isAumento) {
                  return `
                    <tr class="aumento-row">
                      <td class="text-center">-</td>
                      <td style="font-family: monospace; font-size: 5.5pt; padding-left: 6px;">&rdsh; AUMENTO ${r.fecha_ingreso_str || ''}</td>
                      <td style="font-style: italic; color: #0284c7;">└─ Incremento de Capital</td>
                      <td class="text-right" style="color: #64748b;">-</td>
                      <td class="text-right" style="color: #0284c7; font-weight: 700;">${fmtVal(intBruto)}</td>
                      <td class="text-right" style="color: #64748b;">-</td>
                      <td class="text-right" style="color: #64748b;">-</td>
                      <td class="text-right" style="color: #64748b;">-</td>
                      <td class="text-right" style="color: #64748b;">-</td>
                      <td class="text-right" style="color: #64748b;">-</td>
                      <td class="text-right" style="color: #64748b;">-</td>
                      <td class="text-right" style="color: #64748b;">-</td>
                      <td class="text-right" style="color: #64748b;">-</td>
                      <td class="text-right" style="color: #64748b;">-</td>
                      <td class="text-right" style="color: #64748b;">-</td>
                    </tr>
                  `;
                }

                return `
                  <tr>
                    <td class="text-center font-bold" style="background: #f8fafc; font-weight: 800;">${nOrden}</td>
                    <td class="font-mono font-bold" style="font-weight: 700; font-size: 5.5pt;">${certId}</td>
                    <td style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 170px;">${titular}</td>
                    <td class="text-right font-bold" style="font-weight: 700;">${fmtVal(capBase)}</td>
                    <td class="text-right text-blue-600" style="color: #0284c7; font-weight: 700;">${fmtVal(intBruto)}</td>
                    <td class="text-right text-red-600" style="color: #dc2626;">${fmtVal(irImp)}</td>
                    <td class="text-right">${fmtVal(baseNeta)}</td>
                    <td class="text-right">${fmtVal(capZ)}</td>
                    <td class="text-right text-emerald-600" style="color: #059669; font-weight: 700;">${fmtVal(repVal)}</td>
                    <td class="text-right" style="color: #64748b;">${fmtVal(deducTot)}</td>
                    <td class="text-right" style="color: #dc2626;">${fmtVal(penResc)}</td>
                    <td class="text-right font-bold" style="font-weight: 700;">${fmtVal(rNetoFinal)}</td>
                    <td class="text-right text-red-600" style="color: #dc2626; font-weight: 700;">${fmtVal(rDevolucionCap)}</td>
                    <td class="text-right text-emerald-600" style="color: #059669; font-weight: 700;">${fmtVal(rTransferencia)}</td>
                    <td class="text-right font-bold text-slate-900" style="font-weight: 800;">${fmtVal(capFin)}</td>
                  </tr>
                `;
              }).join('')}

              ${isLastPage ? `
                <tr class="totals-row">
                  <td colspan="3" class="text-right" style="text-align: right; padding-right: 6px; letter-spacing: 0.5px;">TOTALES ${fData.fondo.id_fondo}:</td>
                  <td class="text-right">${fmtVal(totals.capital)}</td>
                  <td class="text-right">${fmtVal(totals.bruto_total)}</td>
                  <td class="text-right">${fmtVal(totals.impuesto_total)}</td>
                  <td class="text-right">${fmtVal(totals.base_neta !== undefined ? totals.base_neta : totals.bruto_total - totals.impuesto_total)}</td>
                  <td class="text-right">${fmtVal(totals.capitalizacion_valor)}</td>
                  <td class="text-right">${fmtVal(totals.reparto_valor)}</td>
                  <td class="text-right">${fmtVal(totals.deducciones_total)}</td>
                  <td class="text-right">${fmtVal(totals.penalidad_rescate)}</td>
                  <td class="text-right">${fmtVal(totNetoFinal)}</td>
                  <td class="text-right">${fmtVal(totals.devolucion_capital)}</td>
                  <td class="text-right">${fmtVal(totTransferencia)}</td>
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
            font-size: 6pt;
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
          .logo-geeksoft { height: 32px; width: auto; object-fit: contain; }
          .logo-inandes { height: 26px; width: auto; object-fit: contain; }
          .report-main-title {
            font-weight: 900; font-size: 9.5pt; color: #0f172a; margin: 0; text-transform: uppercase; text-align: center; letter-spacing: 0.2px; line-height: 1.1;
          }
          .report-sub-title {
            font-size: 6.5pt; font-weight: 700; color: #334155; text-align: center; margin-top: 1px;
          }
          .fund-badge-banner {
            background-color: #0284c7; color: #ffffff; font-weight: 800; font-size: 6.8pt; text-transform: uppercase; padding: 1.5px 8px; border-radius: 3px; text-align: center; margin: 1.5px auto 2px auto; width: fit-content; max-width: 95%; letter-spacing: 0.2px;
          }
          
          /* Cajas KPI Inteligentes de EL BELLO */
          table.kpi-cards-table {
            width: 100%; border-collapse: separate; border-spacing: 2.5px 0; margin-bottom: 2.5px; table-layout: fixed;
          }
          table.kpi-cards-table td.kpi-card {
            background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 3px; padding: 1.5px 2px; text-align: center; vertical-align: middle;
          }
          .kpi-title {
            font-size: 4.5pt; font-weight: 800; color: #475569; text-transform: uppercase; margin-bottom: 1px; letter-spacing: 0.1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          }
          .kpi-value {
            font-size: 6.8pt; font-weight: 900; color: #0f172a; white-space: nowrap;
          }
          .kpi-value-green { color: #059669; }
          .kpi-value-red { color: #dc2626; }
          .kpi-value-blue { color: #0284c7; }
          .kpi-value-darkblue { color: #1e3a8a; }

          /* Tabla Contable Bello - Alto Oxigenado (+20% Total) para Máxima Legibilidad */
          table.data-table {
            width: 100%; border-collapse: collapse; margin-bottom: 2px; font-size: 6.2pt; line-height: 1.22;
          }
          table.data-table th {
            background-color: #0f172a !important; color: #ffffff !important; font-weight: 800; text-transform: uppercase; font-size: 5.5pt; padding: 2.2px 1.5px; border: 1px solid #0f172a; text-align: left; letter-spacing: 0.05px;
          }
          table.data-table td {
            border: 1px solid #cbd5e1; padding: 1.8px 2.5px; vertical-align: middle;
          }
          table.data-table tr:nth-child(even) { background-color: #f8fafc; }
          table.data-table tr.aumento-row { color: #0284c7; font-style: italic; background-color: #f0f9ff !important; }
          table.data-table tr.totals-row { background-color: #ecfdf5 !important; font-weight: bold; border-top: 1.5px solid #059669; border-bottom: 1.5px solid #059669; }
          table.data-table tr.totals-row td { color: #064e3b; font-size: 6.4pt; font-weight: 900; padding: 2px 2.5px; }
          .text-right { text-align: right; }
          .text-center { text-align: center; }

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
