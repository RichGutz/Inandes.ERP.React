// src/utils/pdfGeneratorEstadoPosicion.ts
import { LOGO_INANDES_BASE64, LOGO_GEEKSOFT_BASE64 } from '../assets/base64Images';
import type { InvestorPositionReport } from '../services/estadoPosicionService';

export function generatePdfEstadoPosicion(report: InvestorPositionReport): string {
  const { inversionista, contracts, resumen_pen, resumen_usd, fecha_reporte } = report;

  const fmtCurrency = (n: number, mon: 'PEN' | 'USD' | string) => {
    const prefix = mon === 'USD' ? '$ ' : 'S/ ';
    return `${prefix}${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const fmtDate = (d?: string | null) => {
    if (!d) return '-';
    const parts = d.split('T')[0].split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return d;
  };

  const fmtPct = (p: number) => {
    return `${Number(p || 0).toFixed(2)}%`;
  };

  // Generar sección de tablas de contratos
  let contractsTablesHtml = '';

  contracts.forEach((ct) => {
    const mon = ct.moneda;
    const isPen = mon === 'PEN';
    const accentColor = isPen ? '#0369a1' : '#059669';
    const accentBg = isPen ? '#f0f9ff' : '#ecfdf5';
    const accentBorder = isPen ? '#0284c7' : '#10b981';

    // Filas del ledger
    let ledgerRowsHtml = '';
    if (ct.events.length === 0) {
      ledgerRowsHtml = `
        <tr>
          <td colspan="10" style="text-align: center; color: #94a3b8; padding: 12px;">Sin movimientos de cierre registrados en el ledger a la fecha.</td>
        </tr>
      `;
    } else {
      ct.events.forEach(ev => {
        const isCap = (ev.modalidad_periodo || '').toUpperCase().includes('CAPITALIZA') || ev.capitalizacion_monto > 0;
        const hasRescate = ev.amortizacion_rescate_monto > 0;

        let badgeModalidad = '';
        if (isCap) {
          badgeModalidad = `<span class="badge-cap">100% CAPITALIZACIÓN</span>`;
        } else {
          badgeModalidad = `<span class="badge-rep">100% REPARTO</span>`;
        }

        let rowClass = '';
        if (hasRescate) {
          rowClass = 'highlight-rescate';
        } else if (isCap) {
          rowClass = 'highlight-cap';
        }

        ledgerRowsHtml += `
          <tr class="${rowClass}">
            <td class="text-center font-bold">${fmtDate(ev.fecha_periodo_fin)}</td>
            <td class="text-left font-mono">${ev.tipo_evento.replace(/_/g, ' ')}</td>
            <td class="text-center">${badgeModalidad}</td>
            <td class="text-center font-bold">${fmtPct(ev.tasa_anual_periodo)}</td>
            <td>${fmtCurrency(ev.capital_base, mon)}</td>
            <td class="text-emerald-700">${fmtCurrency(ev.interes_neto, mon)}</td>
            <td class="text-blue-700 font-bold">${ev.capitalizacion_monto > 0 ? fmtCurrency(ev.capitalizacion_monto, mon) : '-'}</td>
            <td class="text-rose-700 font-bold">${ev.amortizacion_rescate_monto > 0 ? fmtCurrency(ev.amortizacion_rescate_monto, mon) : '-'}</td>
            <td class="font-black text-slate-900">${fmtCurrency(ev.capital_final_saldo, mon)}</td>
          </tr>
        `;
      });
    }

    // Filas de rescates programados
    let rescatesHtml = '';
    if (ct.rescates.length > 0) {
      let rescRows = '';
      ct.rescates.forEach(rs => {
        const isAplicado = rs.estado === 'APLICADO';
        const badgeClass = isAplicado ? 'badge-aplicado' : 'badge-pendiente';
        rescRows += `
          <tr>
            <td class="text-center font-mono font-bold">${rs.id_cuota}</td>
            <td class="text-left">${rs.descripcion || rs.tipo.replace(/_/g, ' ')}</td>
            <td class="text-center font-bold">${fmtDate(rs.fecha_programada)}</td>
            <td class="font-bold text-rose-700">${fmtCurrency(rs.monto, rs.moneda)}</td>
            <td class="text-center"><span class="${badgeClass}">${rs.estado}</span></td>
            <td class="text-center">${rs.id_evento_aplicado ? `#${rs.id_evento_aplicado}` : '-'}</td>
          </tr>
        `;
      });

      rescatesHtml = `
        <div style="margin-top: 10px; margin-bottom: 16px;">
          <div style="font-size: 8pt; font-weight: bold; color: #475569; text-transform: uppercase; margin-bottom: 4px;">
            Deducciones & Rescates Vinculados al Contrato
          </div>
          <table class="data-table" style="font-size: 8pt;">
            <thead>
              <tr>
                <th class="text-center" style="width: 25%;">ID Cuota / Rescate</th>
                <th class="text-left" style="width: 30%;">Concepto / Descripción</th>
                <th class="text-center" style="width: 15%;">Fecha Prog.</th>
                <th style="width: 15%;">Monto</th>
                <th class="text-center" style="width: 15%;">Estado</th>
                <th class="text-center" style="width: 10%;">Asiento</th>
              </tr>
            </thead>
            <tbody>
              ${rescRows}
            </tbody>
          </table>
        </div>
      `;
    }

    contractsTablesHtml += `
      <div class="contract-card" style="page-break-inside: avoid; margin-bottom: 22px;">
        <div class="contract-header" style="background-color: ${accentBg}; border-left: 5px solid ${accentBorder};">
          <div style="display: table; width: 100%;">
            <div style="display: table-cell; vertical-align: middle; width: 65%;">
              <div style="font-size: 11pt; font-weight: 900; color: ${accentColor}; letter-spacing: -0.3px;">
                CONTRATO: ${ct.id_contrato} · <span style="font-size: 9pt; font-weight: 700; color: #334155;">${ct.nombre_fondo}</span>
              </div>
              <div style="font-size: 8pt; color: #64748b; margin-top: 2px;">
                Certificado: <b style="color: #0f172a;">${ct.id_certificado}</b> | Moneda: <b>${ct.moneda}</b> | Plazo: <b>${ct.plazo_meses} meses</b> | Vigencia: <b>${fmtDate(ct.fecha_inicio)}</b> al <b>${fmtDate(ct.fecha_fin)}</b>
              </div>
            </div>
            <div style="display: table-cell; vertical-align: middle; text-align: right; width: 35%;">
              <div style="font-size: 7.5pt; color: #64748b; text-transform: uppercase; font-weight: bold;">Saldo de Capital al Corte</div>
              <div style="font-size: 13pt; font-weight: 900; color: #0f172a;">${fmtCurrency(ct.capital_actual, mon)}</div>
            </div>
          </div>
        </div>

        <!-- Mini KPI Strip del Contrato -->
        <div class="contract-kpis">
          <div class="kpi-cell">
            <span class="kpi-label">Inversión Inicial</span>
            <span class="kpi-val">${fmtCurrency(ct.monto_inversion, mon)}</span>
          </div>
          <div class="kpi-cell">
            <span class="kpi-label">Tasa Anual Pactada</span>
            <span class="kpi-val">${fmtPct(ct.tasa_pactada_anual)}</span>
          </div>
          <div class="kpi-cell">
            <span class="kpi-label">Interés Neto Acum.</span>
            <span class="kpi-val" style="color: #047857;">${fmtCurrency(ct.total_interes_neto, mon)}</span>
          </div>
          <div class="kpi-cell">
            <span class="kpi-label">Total Capitalizado</span>
            <span class="kpi-val" style="color: #1d4ed8;">${fmtCurrency(ct.total_capitalizado, mon)}</span>
          </div>
          <div class="kpi-cell">
            <span class="kpi-label">Rescates Aplicados</span>
            <span class="kpi-val" style="color: #b91c1c;">${fmtCurrency(ct.total_rescates, mon)}</span>
          </div>
        </div>

        <!-- Tabla Historial del Ledger -->
        <table class="data-table" style="margin-top: 6px;">
          <thead>
            <tr>
              <th class="text-center" style="width: 11%;">Corte</th>
              <th class="text-left" style="width: 15%;">Tipo Evento</th>
              <th class="text-center" style="width: 17%;">Modalidad</th>
              <th class="text-center" style="width: 7%;">TEA %</th>
              <th style="width: 12%;">Capital Base</th>
              <th style="width: 11%;">Int. Neto</th>
              <th style="width: 11%;">Capitalizado</th>
              <th style="width: 11%;">Rescate</th>
              <th style="width: 14%;">Saldo Final</th>
            </tr>
          </thead>
          <tbody>
            ${ledgerRowsHtml}
          </tbody>
        </table>

        ${rescatesHtml}
      </div>
    `;
  });

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<style>
  @page {
    size: A4 portrait;
    margin: 14mm 14mm 16mm 14mm;
    @bottom-right {
      content: "Página " counter(page) " de " counter(pages);
      font-size: 8pt;
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
      color: #94a3b8;
    }
    @bottom-left {
      content: "INANDES GRUPO FINANCIERO — DOCUMENTO OFICIAL CONFIDENCIAL";
      font-size: 7.5pt;
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
      color: #94a3b8;
      font-weight: bold;
    }
  }

  body {
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    color: #1e293b;
    margin: 0;
    padding: 0;
    font-size: 8.5pt;
    line-height: 1.35;
    background-color: #ffffff;
  }

  .header {
    display: table;
    width: 100%;
    border-bottom: 2.5px solid #0284c7;
    padding-bottom: 8px;
    margin-bottom: 12px;
  }

  .header-left {
    display: table-cell;
    vertical-align: middle;
    text-align: left;
    width: 25%;
  }

  .header-center {
    display: table-cell;
    vertical-align: middle;
    text-align: center;
    width: 50%;
  }

  .header-right {
    display: table-cell;
    vertical-align: middle;
    text-align: right;
    width: 25%;
  }

  .logo-img-left {
    height: 38px;
    object-fit: contain;
  }

  .logo-img-right {
    height: 42px;
    object-fit: contain;
  }

  .doc-title {
    font-size: 16pt;
    font-weight: 900;
    color: #0f172a;
    margin: 0 0 2px 0;
    text-transform: uppercase;
    letter-spacing: -0.5px;
  }

  .doc-subtitle {
    font-size: 7.5pt;
    color: #0284c7;
    margin: 0;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .investor-box {
    background-color: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 10px 14px;
    margin-bottom: 14px;
    display: table;
    width: 100%;
    box-sizing: border-box;
  }

  .investor-col {
    display: table-cell;
    vertical-align: top;
    width: 33.33%;
  }

  .field-label {
    font-size: 7pt;
    color: #64748b;
    text-transform: uppercase;
    font-weight: bold;
    margin-bottom: 1px;
  }

  .field-val {
    font-size: 8.5pt;
    color: #0f172a;
    font-weight: bold;
    margin-bottom: 6px;
  }

  /* RESUMEN GLOBAL CARDS */
  .summary-grid {
    display: table;
    width: 100%;
    margin-bottom: 14px;
  }

  .summary-card-wrapper {
    display: table-cell;
    width: 50%;
    vertical-align: top;
    padding-right: 6px;
  }

  .summary-card-wrapper:last-child {
    padding-right: 0;
    padding-left: 6px;
  }

  .summary-card {
    border-radius: 6px;
    padding: 10px 12px;
    border: 1px solid #e2e8f0;
    box-sizing: border-box;
  }

  .summary-card.pen {
    background-color: #f0f9ff;
    border-color: #bae6fd;
  }

  .summary-card.usd {
    background-color: #ecfdf5;
    border-color: #a7f3d0;
  }

  .summary-title {
    font-size: 9pt;
    font-weight: 900;
    text-transform: uppercase;
    margin-bottom: 6px;
    display: table;
    width: 100%;
  }

  .summary-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 8pt;
  }

  .summary-table td {
    padding: 2.5px 0;
  }

  .summary-table td.val {
    text-align: right;
    font-weight: bold;
  }

  /* CONTRACT CARD */
  .contract-card {
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    overflow: hidden;
    background-color: #ffffff;
  }

  .contract-header {
    padding: 8px 12px;
  }

  .contract-kpis {
    display: table;
    width: 100%;
    background-color: #f8fafc;
    border-top: 1px solid #e2e8f0;
    border-bottom: 1px solid #e2e8f0;
  }

  .kpi-cell {
    display: table-cell;
    width: 20%;
    padding: 6px 10px;
    vertical-align: middle;
    border-right: 1px solid #e2e8f0;
  }

  .kpi-cell:last-child {
    border-right: none;
  }

  .kpi-label {
    display: block;
    font-size: 6.5pt;
    color: #64748b;
    text-transform: uppercase;
    font-weight: bold;
  }

  .kpi-val {
    display: block;
    font-size: 8.5pt;
    font-weight: 900;
    color: #0f172a;
  }

  /* DATA TABLES */
  table.data-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 7.5pt;
  }

  table.data-table th {
    background-color: #0f172a;
    color: #ffffff;
    font-weight: bold;
    text-align: right;
    padding: 5px 6px;
    font-size: 7pt;
    text-transform: uppercase;
  }

  table.data-table th.text-left {
    text-align: left;
  }

  table.data-table th.text-center {
    text-align: center;
  }

  table.data-table td {
    padding: 4px 6px;
    border-bottom: 1px solid #e2e8f0;
    text-align: right;
  }

  table.data-table td.text-left {
    text-align: left;
  }

  table.data-table td.text-center {
    text-align: center;
  }

  table.data-table tr.highlight-cap {
    background-color: #f0fdf4;
  }

  table.data-table tr.highlight-rescate {
    background-color: #fff1f2;
  }

  .badge-cap {
    background-color: #dbeafe;
    color: #1e40af;
    padding: 1.5px 5px;
    border-radius: 3px;
    font-weight: bold;
    font-size: 6.5pt;
    display: inline-block;
  }

  .badge-rep {
    background-color: #dcfce7;
    color: #166534;
    padding: 1.5px 5px;
    border-radius: 3px;
    font-weight: bold;
    font-size: 6.5pt;
    display: inline-block;
  }

  .badge-aplicado {
    background-color: #dcfce7;
    color: #15803d;
    padding: 1px 5px;
    border-radius: 3px;
    font-weight: bold;
    font-size: 6.5pt;
  }

  .badge-pendiente {
    background-color: #fef3c7;
    color: #b45309;
    padding: 1px 5px;
    border-radius: 3px;
    font-weight: bold;
    font-size: 6.5pt;
  }

  .footer-signatures {
    margin-top: 24px;
    display: table;
    width: 100%;
    page-break-inside: avoid;
  }

  .sig-col {
    display: table-cell;
    width: 50%;
    text-align: center;
    vertical-align: top;
    padding: 0 20px;
  }

  .sig-line {
    border-top: 1px solid #94a3b8;
    margin-top: 36px;
    padding-top: 4px;
    font-size: 7.5pt;
    font-weight: bold;
    color: #334155;
  }

  .font-mono {
    font-family: 'Courier New', Courier, monospace;
  }
  .font-bold { font-weight: bold; }
  .font-black { font-weight: 900; }
  .text-emerald-700 { color: #047857; }
  .text-blue-700 { color: #1d4ed8; }
  .text-rose-700 { color: #be123c; }
  .text-slate-900 { color: #0f172a; }
</style>
</head>
<body>

  <!-- HEADER INSTITUCIONAL (GeekSoft Izq · Título Centro · InAndes Der) -->
  <div class="header">
    <div class="header-left">
      <img src="data:image/png;base64,${LOGO_GEEKSOFT_BASE64}" class="logo-img-left" alt="Geeksoft" />
    </div>
    <div class="header-center">
      <div class="doc-title">ESTADO DE POSICIÓN</div>
      <div class="doc-subtitle">Reporte de Auditoría Integral de Contratos & Ledger</div>
    </div>
    <div class="header-right">
      <img src="data:image/png;base64,${LOGO_INANDES_BASE64}" class="logo-img-right" alt="InAndes" />
    </div>
  </div>

  <!-- BOX DATOS DEL INVERSIONISTA -->
  <div class="investor-box">
    <div class="investor-col">
      <div class="field-label">Partícipe / Titular Principal</div>
      <div class="field-val">${inversionista.nombre_completo}</div>

      <div class="field-label">Documento de Identidad</div>
      <div class="field-val">${inversionista.tipo_doc}: ${inversionista.documento_identidad}</div>

      <div class="field-label">Código de Inversionista</div>
      <div class="field-val font-mono">${inversionista.codigo_inversionista}</div>
    </div>

    <div class="investor-col">
      <div class="field-label">Fecha de Emisión del Reporte</div>
      <div class="field-val">${fmtDate(fecha_reporte)}</div>

      <div class="field-label">Asesor Comercial Asignado</div>
      <div class="field-val">${inversionista.asesor_nombre || 'Asesor InAndes'}</div>

      <div class="field-label">Email de Contacto</div>
      <div class="field-val">${inversionista.email}</div>
    </div>

    <div class="investor-col">
      <div class="field-label">Cuentas Bancarias Registradas</div>
      <div class="field-val" style="font-size: 7.5pt; font-weight: normal;">
        <b>PEN:</b> ${inversionista.banco_pen || '-'} ${inversionista.cuenta_pen ? `(${inversionista.cuenta_pen})` : ''}<br/>
        <b>USD:</b> ${inversionista.banco_usd || '-'} ${inversionista.cuenta_usd ? `(${inversionista.cuenta_usd})` : ''}
      </div>

      <div class="field-label">Total de Contratos</div>
      <div class="field-val">${contracts.length} contrato(s) (${resumen_pen.contratos_activos + resumen_usd.contratos_activos} vigentes)</div>
    </div>
  </div>

  <!-- RESUMEN EJECUTIVO CONSOLIDADO POR MONEDA -->
  <div class="summary-grid">
    <!-- SOLES -->
    <div class="summary-card-wrapper">
      <div class="summary-card pen">
        <div class="summary-title" style="color: #0369a1;">
          <span>Posición Consolidada Soles (PEN)</span>
          <span style="float: right; font-size: 7.5pt; font-weight: normal; color: #64748b;">${resumen_pen.contratos_activos} contratos vigentes</span>
        </div>
        <table class="summary-table">
          <tr>
            <td>Inversión Inicial Total:</td>
            <td class="val">${fmtCurrency(resumen_pen.total_inversion_inicial, 'PEN')}</td>
          </tr>
          <tr>
            <td>Interés Neto Total Generado:</td>
            <td class="val text-emerald-700">${fmtCurrency(resumen_pen.total_interes_neto, 'PEN')}</td>
          </tr>
          <tr>
            <td>Capital Total Capitalizado:</td>
            <td class="val text-blue-700">${fmtCurrency(resumen_pen.total_capitalizado, 'PEN')}</td>
          </tr>
          <tr>
            <td>Rescates / Amortizaciones Pagados:</td>
            <td class="val text-rose-700">${fmtCurrency(resumen_pen.total_rescates, 'PEN')}</td>
          </tr>
          <tr style="border-top: 1.5px solid #0284c7;">
            <td style="padding-top: 4px; font-weight: 900; color: #0369a1;">SALDO DE CAPITAL ACTIVO AL CORTE:</td>
            <td class="val text-slate-900" style="padding-top: 4px; font-size: 10.5pt; font-weight: 900;">${fmtCurrency(resumen_pen.total_capital_actual, 'PEN')}</td>
          </tr>
        </table>
      </div>
    </div>

    <!-- DOLARES -->
    <div class="summary-card-wrapper">
      <div class="summary-card usd">
        <div class="summary-title" style="color: #047857;">
          <span>Posición Consolidada Dólares (USD)</span>
          <span style="float: right; font-size: 7.5pt; font-weight: normal; color: #64748b;">${resumen_usd.contratos_activos} contratos vigentes</span>
        </div>
        <table class="summary-table">
          <tr>
            <td>Inversión Inicial Total:</td>
            <td class="val">${fmtCurrency(resumen_usd.total_inversion_inicial, 'USD')}</td>
          </tr>
          <tr>
            <td>Interés Neto Total Generado:</td>
            <td class="val text-emerald-700">${fmtCurrency(resumen_usd.total_interes_neto, 'USD')}</td>
          </tr>
          <tr>
            <td>Capital Total Capitalizado:</td>
            <td class="val text-blue-700">${fmtCurrency(resumen_usd.total_capitalizado, 'USD')}</td>
          </tr>
          <tr>
            <td>Rescates / Amortizaciones Pagados:</td>
            <td class="val text-rose-700">${fmtCurrency(resumen_usd.total_rescates, 'USD')}</td>
          </tr>
          <tr style="border-top: 1.5px solid #059669;">
            <td style="padding-top: 4px; font-weight: 900; color: #047857;">SALDO DE CAPITAL ACTIVO AL CORTE:</td>
            <td class="val text-slate-900" style="padding-top: 4px; font-size: 10.5pt; font-weight: 900;">${fmtCurrency(resumen_usd.total_capital_actual, 'USD')}</td>
          </tr>
        </table>
      </div>
    </div>
  </div>

  <!-- DESGLOSE DETALLADO DE CONTRATOS & HISTORIAL DEL LEDGER -->
  <div style="font-size: 10pt; font-weight: 900; color: #0f172a; text-transform: uppercase; margin-top: 10px; margin-bottom: 10px; border-left: 4px solid #0284c7; padding-left: 8px;">
    Desglose Individual de Contratos & Auditoría del Ledger
  </div>

  ${contractsTablesHtml}

  <!-- FIRMAS INSTITUCIONALES -->
  <div class="footer-signatures">
    <div class="sig-col">
      <div class="sig-line">
        INANDES SOCIEDAD ADMINISTRADORA DE FONDOS<br/>
        <span style="font-weight: normal; color: #64748b;">Área de Operaciones & Custodia Financiera</span>
      </div>
    </div>
    <div class="sig-col">
      <div class="sig-line">
        GEEKSOFT TECHNOLOGY FINANCIAL ENGINE<br/>
        <span style="font-weight: normal; color: #64748b;">Sistema Oficial de Ledger & Auditoría V40</span>
      </div>
    </div>
  </div>

</body>
</html>
`;
}
