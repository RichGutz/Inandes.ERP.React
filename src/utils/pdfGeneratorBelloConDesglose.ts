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

  function fmtVal(val: number | undefined | null) {
    if (val === undefined || val === null || val === 0) return '-';
    return val.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  @page {
    size: A4 landscape;
    margin: 10mm 10mm 10mm 10mm;
  }
  body {
    font-family: Arial, sans-serif;
    color: #1e293b;
    margin: 0;
    padding: 0;
    font-size: 8pt;
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
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 2px solid #0f172a;
    padding-bottom: 6px;
    margin-bottom: 10px;
  }
  .title {
    font-size: 13pt;
    font-weight: bold;
    color: #0f172a;
    text-transform: uppercase;
  }
  .subtitle {
    font-size: 8.5pt;
    color: #64748b;
    margin-top: 2px;
  }
  .badge {
    background: #0284c7;
    color: white;
    padding: 3px 8px;
    border-radius: 4px;
    font-size: 8pt;
    font-weight: bold;
  }
  .summary-cards {
    display: table;
    width: 100%;
    margin-bottom: 10px;
    border-spacing: 4px 0;
  }
  .card {
    display: table-cell;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    padding: 5px 8px;
    border-radius: 4px;
    text-align: center;
    vertical-align: middle;
  }
  .card-label {
    font-size: 6.5pt;
    color: #64748b;
    text-transform: uppercase;
    font-weight: bold;
  }
  .card-val {
    font-size: 9.5pt;
    font-weight: bold;
    color: #0f172a;
    margin-top: 1px;
  }
  table.data-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 10px;
  }
  table.data-table th {
    background: #0f172a;
    color: white;
    font-size: 6.8pt;
    padding: 4px 4px;
    text-align: right;
    font-weight: bold;
    border: 1px solid #0f172a;
    text-transform: uppercase;
  }
  table.data-table th.left {
    text-align: left;
  }
  table.data-table td {
    padding: 2.5px 4px;
    font-size: 6.8pt;
    border: 1px solid #cbd5e1;
    text-align: right;
    vertical-align: middle;
  }
  table.data-table td.left {
    text-align: left;
  }
  table.data-table tr:nth-child(even) {
    background: #f8fafc;
  }
  .tot-row {
    background: #e2e8f0 !important;
    font-weight: bold;
  }
  .tot-row td {
    font-size: 7.2pt;
    font-weight: bold;
    color: #0f172a;
    border-top: 2px solid #0f172a;
    border-bottom: 3px double #0f172a;
  }
  .page-footer-text {
    width: 100%;
    margin-top: 6px;
    border-top: 1px solid #cbd5e1;
    padding-top: 3px;
    font-size: 6.5pt;
    color: #64748b;
    display: table;
    table-layout: fixed;
  }
  .page-footer-left { display: table-cell; text-align: left; font-weight: bold; }
  .page-footer-right { display: table-cell; text-align: right; font-weight: bold; }
</style>
</head>
<body>

${filteredPdfData.map((fData: any, pageIdx: number) => {
  const rows = fData.blocks[0].rows || [];
  const numCert = rows.filter((r: any) => r.tipo === 'CERT').length;
  const totals = fData.totals || {};

  return `
  <div class="report-page">
    <div class="header">
      <div>
        <div class="title">INANDES GRUPO FINANCIERO — CIERRE DE AUDITORÍA OFICIAL</div>
        <div class="subtitle">Período: ${fStart} al ${fEnd} (${diasBase} Días) &nbsp;|&nbsp; Base 365 Días</div>
      </div>
      <div style="text-align: right;">
        <span class="badge">FONDO ${fData.fondo.nombre_fondo || fData.fondo.id_fondo} (${fData.fondo.id_fondo}) — MONEDA: ${fData.fondo.moneda}</span>
        <div style="font-size: 8pt; color: #64748b; margin-top: 3px;">${numCert} Inversionistas Auditados</div>
      </div>
    </div>

    <div class="summary-cards">
      <div class="card" style="width: 20%;">
        <div class="card-label">Capital Base Inicial</div>
        <div class="card-val">${fData.fondo.moneda} ${fmtVal(totals.capital)}</div>
      </div>
      <div class="card" style="width: 20%;">
        <div class="card-label">Interés Bruto (${diasBase}d)</div>
        <div class="card-val" style="color: #0284c7;">${fData.fondo.moneda} ${fmtVal(totals.bruto_total)}</div>
      </div>
      <div class="card" style="width: 20%;">
        <div class="card-label">Retención IR 5%</div>
        <div class="card-val" style="color: #dc2626;">${fData.fondo.moneda} ${fmtVal(totals.impuesto_total)}</div>
      </div>
      <div class="card" style="width: 20%;">
        <div class="card-label">Reparto en Efectivo</div>
        <div class="card-val" style="color: #16a34a;">${fData.fondo.moneda} ${fmtVal(totals.reparto_valor)}</div>
      </div>
      <div class="card" style="width: 20%;">
        <div class="card-label">Capital Final Saldo</div>
        <div class="card-val" style="color: #4338ca;">${fData.fondo.moneda} ${fmtVal(totals.capital_final)}</div>
      </div>
    </div>

    <table class="data-table">
      <thead>
        <tr>
          <th class="left" style="width: 20px;">#</th>
          <th class="left" style="width: 140px;">Certificado</th>
          <th class="left">Inversionista</th>
          <th>Capital Base</th>
          <th>Int. Bruto</th>
          <th>IR (5%)</th>
          <th>Base Neta</th>
          <th>Capitaliz.</th>
          <th>Reparto</th>
          <th>Deducc.</th>
          <th>Neto Final</th>
          <th>Rescates</th>
          <th>Capital Final</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map((r: any) => {
          if (r.tipo === 'AUMENTO') {
            return `
            <tr style="background: #f0f9ff !important; color: #0284c7; font-style: italic;">
              <td class="left" style="text-align: center;">-</td>
              <td class="left" style="font-family: monospace; font-size: 6.5pt;">${r.id}</td>
              <td class="left">└─ Incremento de Capital</td>
              <td>${fmtVal(r.capital)}</td>
              <td style="font-weight: bold; color: #0284c7;">${fmtVal(r.bruto_total)}</td>
              <td>-</td>
              <td>-</td>
              <td>-</td>
              <td>-</td>
              <td>-</td>
              <td>-</td>
              <td>-</td>
              <td>-</td>
            </tr>`;
          }

          return `
          <tr>
            <td class="left" style="text-align: center;">${r.n_orden || ''}</td>
            <td class="left" style="font-family: monospace; font-size: 6.5pt;">${r.id}</td>
            <td class="left" style="font-weight: 500;">${r.inversionista}</td>
            <td>${fmtVal(r.capital)}</td>
            <td style="font-weight: bold; color: #0369a1;">${fmtVal(r.bruto_total)}</td>
            <td style="color: #b91c1c;">${fmtVal(r.impuesto_total)}</td>
            <td>${fmtVal(r.base_neta)}</td>
            <td>${fmtVal(r.capitalizacion)}</td>
            <td style="font-weight: bold; color: #15803d;">${fmtVal(r.reparto_valor)}</td>
            <td>${fmtVal(r.deducciones_total)}</td>
            <td style="font-weight: bold;">${fmtVal(r.base_neta - (r.deducciones_total || 0))}</td>
            <td style="color: #c2410c; font-weight: bold;">${fmtVal(r.devolucion_capital)}</td>
            <td style="font-weight: bold; color: #3730a3;">${fmtVal(r.capital_final)}</td>
          </tr>`;
        }).join('')}
        
        <tr class="tot-row">
          <td colspan="3" class="left" style="text-align: center;">TOTALES ${fData.fondo.id_fondo} (${fData.fondo.moneda})</td>
          <td>${fmtVal(totals.capital)}</td>
          <td style="color: #0369a1;">${fmtVal(totals.bruto_total)}</td>
          <td style="color: #b91c1c;">${fmtVal(totals.impuesto_total)}</td>
          <td>${fmtVal(totals.base_neta)}</td>
          <td>${fmtVal(totals.capitalizacion)}</td>
          <td style="color: #15803d;">${fmtVal(totals.reparto_valor)}</td>
          <td>${fmtVal(totals.deducciones_total)}</td>
          <td>${fmtVal(totals.base_neta - (totals.deducciones_total || 0))}</td>
          <td style="color: #c2410c;">${fmtVal(totals.devolucion_capital)}</td>
          <td style="color: #3730a3;">${fmtVal(totals.capital_final)}</td>
        </tr>
      </tbody>
    </table>

    <div class="page-footer-text">
      <div class="page-footer-left">INANDES GRUPO FINANCIERO & GEEKSOFT — AUDITORÍA Y CONTROL DE CALIDAD OFICIAL</div>
      <div class="page-footer-right">Página ${pageIdx + 1} de ${filteredPdfData.length}</div>
    </div>
  </div>`;
}).join('')}

</body>
</html>`;
}
