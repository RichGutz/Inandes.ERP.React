import { createClient } from '@supabase/supabase-js';
import ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';

const SUPABASE_URL = 'https://egvcinsbyropumybatdf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVndmNpbnNieXJvcHVteWJhdGRmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDA0NDczNCwiZXhwIjoyMDk5NjIwNzM0fQ.28T_xQmSRJO1O1scio61JU0KHhEQfzSS94qYka8TrcA';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const startDate = new Date(2026, 0, 1, 0, 0, 0, 0); // 2026-01-01
const endDate = new Date(2026, 1, 28, 0, 0, 0, 0);   // 2026-02-28
const startDateStr = '2026-01-01';
const endDateStr = '2026-02-28';

async function generateStyledNavExcel() {
  console.log('========================================================');
  console.log('GENERANDO EXCEL PROFESIONAL CON ESTILOS (MOTOR NAV ENE-FEB 2026)');
  console.log('========================================================');

  // 1. Cargar Fondos
  const { data: fondosData, error: fErr } = await supabase
    .from('crm_fondos')
    .select('*')
    .order('nombre_fondo', { ascending: true });

  if (fErr) throw fErr;

  const fondosMap = {};
  for (const f of fondosData) {
    if (!fondosMap[f.id_fondo]) {
      fondosMap[f.id_fondo] = f;
    }
  }

  // 2. Cargar Contratos de Inversión
  const { data: rawContratos, error: cErr } = await supabase
    .from('crm_contratos')
    .select('*')
    .in('estado', ['emitido', 'cerrado_por_rescate', 'cerrado_fin_contrato'])
    .order('id_contrato', { ascending: true });

  if (cErr) throw cErr;

  const allCids = rawContratos.map(c => c.id_contrato);

  // 3. Cargar Eventos Ledger
  const { data: allEvents, error: eErr } = await supabase
    .from('crm_certificados_eventos')
    .select('*')
    .in('id_contrato', allCids)
    .order('fecha_periodo_fin', { ascending: true });

  if (eErr) throw eErr;

  const eventsByCid = {};
  for (const ev of (allEvents || [])) {
    const cid = ev.id_contrato || ev.id_certificado;
    if (!eventsByCid[cid]) eventsByCid[cid] = [];
    eventsByCid[cid].push(ev);
  }

  // 4. Generar lista de días continuos Ene-Feb 2026 (59 días)
  const diasPeriodo = [];
  let curr = new Date(startDate);
  while (curr <= endDate) {
    diasPeriodo.push(new Date(curr));
    curr.setDate(curr.getDate() + 1);
  }

  const allDayLabels = diasPeriodo.map(d => {
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${day}/${month}`;
  });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'INANDES GRUPO FINANCIERO';
  workbook.lastModifiedBy = 'Antigravity QC Engine';
  workbook.created = new Date();
  workbook.modified = new Date();

  const priorityFondos = ["NSGPEN01", "NSGPEN02", "NSGPEN03", "NSGUSD01", "NSGUSD02", "NSLCON01"];
  const fondosToProcess = priorityFondos.filter(id => fondosMap[id]);

  for (const fondoId of fondosToProcess) {
    const fondo = fondosMap[fondoId];
    const tActiva = Number(fondo.tasa_activa || 14.0) / 100;
    const pAdmin = Number(fondo.comision_administracion_fondo || 1.0) / 100;
    const pCap = Number(fondo.comision_captacion_fondo || 2.0) / 100;
    const pMisc = Number(fondo.comision_miscelaneos_fondo || 0.0) / 100;

    const certsFondo = rawContratos.filter(c => {
      if (c.id_fondo !== fondoId) return false;
      const fIni = c.fecha_inicio ? c.fecha_inicio.split('T')[0] : '2000-01-01';
      return fIni <= endDateStr;
    });

    if (certsFondo.length === 0) continue;

    certsFondo.sort((a, b) => {
      const m1 = a.id_contrato.match(/[.-](\d+)/);
      const m2 = b.id_contrato.match(/[.-](\d+)/);
      const idx1 = m1 ? parseInt(m1[1], 10) : 999;
      const idx2 = m2 ? parseInt(m2[1], 10) : 999;
      return idx1 - idx2;
    });

    const certRows = [];
    for (const c of certsFondo) {
      const cid = c.id_contrato;
      const evs = eventsByCid[cid] || [];
      
      const closingEvents = evs.filter(e => 
        ['cierre_fin_ciclo', 'cierre_fin_contrato', 'emision_inicial', 'emision'].includes(e.tipo_evento) &&
        e.fecha_periodo_fin &&
        new Date(e.fecha_periodo_fin.split('T')[0] + 'T00:00:00') < startDate
      );

      let capIni = 0;
      if (closingEvents.length > 0) {
        closingEvents.sort((a, b) => String(a.fecha_periodo_fin).localeCompare(String(b.fecha_periodo_fin)));
        const lastClosure = closingEvents[closingEvents.length - 1];
        capIni = (lastClosure.capital_final_saldo !== null && lastClosure.capital_final_saldo !== undefined)
          ? Number(lastClosure.capital_final_saldo)
          : Number(lastClosure.capital_base || 0);
      } else {
        capIni = Number(c.monto_inversion || 0);
      }

      const fIni = new Date((c.fecha_inicio || '2026-01-01').split('T')[0] + 'T00:00:00');

      const aumentos = [];
      for (const e of evs) {
        if (['aumento_capital', 'reinvierte_interes'].includes(e.tipo_evento)) {
          const rawF = e.fecha_evento || e.fecha_periodo_fin || '2020-01-01';
          const fEv = new Date(rawF.split('T')[0] + 'T00:00:00');
          if (fEv >= startDate && fEv <= endDate) {
            const montoAum = Number(e.capital_final_saldo || 0) - Number(e.capital_base || 0);
            if (montoAum > 0) {
              aumentos.push({ fecha: fEv, monto: montoAum });
            }
          }
        }
      }

      if (capIni <= 0 && aumentos.length === 0) continue;

      certRows.push({
        tipo: 'CERT',
        id: cid,
        capital: capIni,
        cuotas: capIni,
        emision: fIni,
        interes_acum: 0.0,
        valores_dia: [],
        aumentos: aumentos,
        hijos: []
      });
    }

    let patAyer = certRows.reduce((sum, c) => sum + c.capital, 0);
    let cuotasAyer = certRows.reduce((sum, c) => sum + c.cuotas, 0);
    let fInvOrigAcum = patAyer;
    let valCuotaAyer = 1.0;

    let totalGananciaBrutaAcum = 0.0;
    let totalAdminAcum = 0.0;
    let totalCapAcum = 0.0;
    let totalMiscAcum = 0.0;
    let totalUtilidadNetaAcum = 0.0;

    const summaryRows = {
      'TOTAL CAPITAL (Apertura)': [],
      '(+) CAPITAL ADICIONAL (Hoy)': [],
      '(=) CAPITAL ACUMULADO': [],
      'CUOTAS APERTURA': [],
      '(+) CUOTAS ADICIONALES (Hoy)': [],
      '(=) CUOTAS TOTALES CIERRE': [],
      'VAL CUOTA INICIAL': [],
      'GANANCIA TOTAL BRUTA (Base 360)': [],
      'GANANCIA TOTAL ACUMULADA': [],
      'PATRIMONIO TOTAL (Pre-Aportes)': [],
      'COM. ADMIN (-) (Base 365)': [],
      'COM. ADMIN ACUM. (-)': [],
      'COM. CAPT. (-) (Base 365)': [],
      'COM. CAPT. ACUM. (-)': [],
      'COM. MISC. (-)': [],
      'COM. MISC. ACUM. (-)': [],
      'GANANCIA OPERATIVA (Neta)': [],
      'GANANCIA OPERATIVA ACUMULADA': [],
      'PATRIMONIO TOTAL CIERRE': [],
      'VAL CUOTA FINAL': []
    };

    for (let dayIdx = 0; dayIdx < diasPeriodo.length; dayIdx++) {
      const d = diasPeriodo[dayIdx];
      const dStr = d.toISOString().split('T')[0];

      const ingresoBrutoDia = patAyer * (tActiva / 360.0);
      const gastoAdmin = patAyer * (pAdmin / 365.0);
      const gastoCap = patAyer * (pCap / 365.0);
      const gastoMisc = patAyer * (pMisc / 365.0);
      const utilidadNetaDia = ingresoBrutoDia - (gastoAdmin + gastoCap + gastoMisc);

      totalGananciaBrutaAcum += ingresoBrutoDia;
      totalAdminAcum += gastoAdmin;
      totalCapAcum += gastoCap;
      totalMiscAcum += gastoMisc;
      totalUtilidadNetaAcum += utilidadNetaDia;

      const patPre = patAyer + utilidadNetaDia;
      const valCuotaHoy = cuotasAyer > 0 ? (patPre / cuotasAyer) : 1.0;

      for (const row of certRows) {
        const isEmitted = d >= row.emision;
        const intDia = isEmitted ? row.capital * (tActiva / 360.0) : 0.0;
        row.valores_dia.push(intDia);
        row.interes_acum += intDia;

        for (const h of row.hijos) {
          const isHijoEmitted = d >= h.fecha;
          const intHijoDia = isHijoEmitted ? h.monto * (tActiva / 360.0) : 0.0;
          h.valores_dia.push(intHijoDia);
          h.interes_acum += intHijoDia;
        }
      }

      let aportesDia = 0.0;
      let nuevasCuotasDia = 0.0;

      if (dStr !== startDateStr) {
        for (const row of certRows) {
          const aumsHoy = row.aumentos.filter(a => a.fecha.toISOString().split('T')[0] === dStr);
          for (const a of aumsHoy) {
            const nuevasCuotas = a.monto / valCuotaHoy;
            const nuevoHijo = {
              tipo: 'AUMENTO',
              id: `Aumento (${String(a.fecha.getDate()).padStart(2,'0')}/${String(a.fecha.getMonth()+1).padStart(2,'0')})`,
              monto: a.monto,
              fecha: a.fecha,
              cuotas: nuevasCuotas,
              valores_dia: new Array(dayIdx).fill(0.0),
              interes_acum: 0.0
            };
            row.hijos.push(nuevoHijo);
            row.capital += a.monto;
            row.cuotas += nuevasCuotas;
            aportesDia += a.monto;
            nuevasCuotasDia += nuevasCuotas;
          }
        }
      }

      fInvOrigAcum += aportesDia;
      const patCierre = patPre + aportesDia;
      const cuotaCierre = cuotasAyer + nuevasCuotasDia;

      summaryRows['TOTAL CAPITAL (Apertura)'].push(patAyer);
      summaryRows['(+) CAPITAL ADICIONAL (Hoy)'].push(aportesDia);
      summaryRows['(=) CAPITAL ACUMULADO'].push(fInvOrigAcum);
      summaryRows['CUOTAS APERTURA'].push(cuotasAyer);
      summaryRows['(+) CUOTAS ADICIONALES (Hoy)'].push(nuevasCuotasDia);
      summaryRows['(=) CUOTAS TOTALES CIERRE'].push(cuotaCierre);
      summaryRows['VAL CUOTA INICIAL'].push(valCuotaAyer);
      summaryRows['GANANCIA TOTAL BRUTA (Base 360)'].push(ingresoBrutoDia);
      summaryRows['GANANCIA TOTAL ACUMULADA'].push(totalGananciaBrutaAcum);
      summaryRows['PATRIMONIO TOTAL (Pre-Aportes)'].push(patPre);
      summaryRows['COM. ADMIN (-) (Base 365)'].push(gastoAdmin);
      summaryRows['COM. ADMIN ACUM. (-)'].push(totalAdminAcum);
      summaryRows['COM. CAPT. (-) (Base 365)'].push(gastoCap);
      summaryRows['COM. CAPT. ACUM. (-)'].push(totalCapAcum);
      summaryRows['COM. MISC. (-)'].push(gastoMisc);
      summaryRows['COM. MISC. ACUM. (-)'].push(totalMiscAcum);
      summaryRows['GANANCIA OPERATIVA (Neta)'].push(utilidadNetaDia);
      summaryRows['GANANCIA OPERATIVA ACUMULADA'].push(totalUtilidadNetaAcum);
      summaryRows['PATRIMONIO TOTAL CIERRE'].push(patCierre);
      summaryRows['VAL CUOTA FINAL'].push(valCuotaHoy);

      patAyer = patCierre;
      cuotasAyer = cuotaCierre;
      valCuotaAyer = valCuotaHoy;
    }

    // ====================================================================
    // CREAR HOJA EXCEL CON ESTILOS RICOS (EXCELJS)
    // ====================================================================
    const ws = workbook.addWorksheet(fondoId.slice(0, 31), {
      views: [{ state: 'frozen', xSplit: 1, ySplit: 1 }] // Inmovilizar Columna A y Fila 1
    });

    // 1. Cabecera (Fila 1)
    const headerRowValues = ['ITEM', ...allDayLabels];
    const headerRow = ws.addRow(headerRowValues);
    headerRow.height = 28;

    headerRow.eachCell((cell, colNumber) => {
      cell.font = { name: 'Consolas', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: colNumber === 1 ? 'FF0F172A' : 'FF1E293B' } // Slate 900 / Slate 800
      };
      cell.alignment = { vertical: 'middle', horizontal: colNumber === 1 ? 'left' : 'center' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF334155' } },
        bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
        left: { style: 'thin', color: { argb: 'FF334155' } },
        right: { style: 'thin', color: { argb: 'FF334155' } }
      };
    });

    // 2. Filas de Certificados y Aumentos
    for (const r of certRows) {
      const rowVals = [r.id, ...r.valores_dia];
      const addedRow = ws.addRow(rowVals);
      addedRow.height = 20;

      addedRow.eachCell((cell, colNumber) => {
        if (colNumber === 1) {
          cell.font = { name: 'Consolas', size: 9.5, bold: false, color: { argb: 'FF1E293B' } };
          cell.alignment = { vertical: 'middle', horizontal: 'left' };
        } else {
          cell.numFmt = '#,##0.00';
          cell.font = { name: 'Consolas', size: 9.5, color: { argb: 'FF334155' } };
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
        }
        cell.border = {
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFF1F5F9' } }
        };
      });

      for (const h of r.hijos) {
        const hijoVals = [`   ${h.id}`, ...h.valores_dia];
        const hijoRow = ws.addRow(hijoVals);
        hijoRow.height = 19;

        hijoRow.eachCell((cell, colNumber) => {
          if (colNumber === 1) {
            cell.font = { name: 'Consolas', size: 9, italic: true, bold: true, color: { argb: 'FF059669' } };
            cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
          } else {
            cell.numFmt = '#,##0.00';
            cell.font = { name: 'Consolas', size: 9, italic: true, color: { argb: 'FF059669' } };
            cell.alignment = { vertical: 'middle', horizontal: 'right' };
          }
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDF4' } }; // Soft green
          cell.border = {
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFF1F5F9' } }
          };
        });
      }
    }

    // 3. Filas de Resumen y Totales
    for (const [label, vals] of Object.entries(summaryRows)) {
      const isVc = label.includes('VAL CUOTA');
      const isAporte = label.includes('(+)');
      const isComision = label.includes('COM.');
      const isPatrimonioCierre = label === 'PATRIMONIO TOTAL CIERRE';
      const isCapitalApertura = label === 'TOTAL CAPITAL (Apertura)';
      const isGananciaOperativa = label.includes('GANANCIA OPERATIVA');

      const sRowVals = [label, ...vals];
      const addedSRow = ws.addRow(sRowVals);
      addedSRow.height = isPatrimonioCierre || isVc ? 24 : 21;

      // Definir paleta de color para la fila de resumen
      let bgColor = 'FFF8FAFC'; // Soft Slate 50
      let fontColor = 'FF0F172A';
      let isBold = true;

      if (isCapitalApertura) {
        bgColor = 'FFF1F5F9';
        fontColor = 'FF0F172A';
      } else if (isAporte) {
        bgColor = 'FFECFDF5'; // Soft Green
        fontColor = 'FF047857';
      } else if (isComision) {
        bgColor = 'FFFEF2F2'; // Soft Red
        fontColor = 'FFB91C1C';
      } else if (isGananciaOperativa) {
        bgColor = 'FFEFF6FF'; // Soft Blue
        fontColor = 'FF1D4ED8';
      } else if (isPatrimonioCierre) {
        bgColor = 'FFFEF3C7'; // Soft Gold / Amber
        fontColor = 'FF78350F';
      } else if (isVc) {
        bgColor = 'FFDBEAFE'; // Soft Blue Accent
        fontColor = 'FF1E40AF';
      }

      addedSRow.eachCell((cell, colNumber) => {
        if (colNumber === 1) {
          cell.font = { name: 'Consolas', size: 10, bold: isBold, color: { argb: fontColor } };
          cell.alignment = { vertical: 'middle', horizontal: 'left' };
        } else {
          cell.numFmt = isVc ? '0.000000' : '#,##0.00';
          cell.font = { name: 'Consolas', size: 9.5, bold: isBold, color: { argb: fontColor } };
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
        }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
        cell.border = {
          top: isPatrimonioCierre ? { style: 'thin', color: { argb: 'FFD97706' } } : { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: isPatrimonioCierre ? { style: 'double', color: { argb: 'FFD97706' } } : { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        };
      });
    }

    // Configurar anchos de columna automáticos
    ws.getColumn(1).width = 40; // Columna ITEM
    for (let c = 2; c <= allDayLabels.length + 1; c++) {
      ws.getColumn(c).width = 15; // Columnas de Días
    }
  }

  // Guardar archivo Excel con manejo de bloqueo
  const reportsDir = path.join(process.cwd(), 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  let finalExportPath = path.join(reportsDir, 'Reporte_NAV_QC_Ene_Feb_2026_Styled.xlsx');
  try {
    await workbook.xlsx.writeFile(finalExportPath);
  } catch (err) {
    if (err.code === 'EBUSY') {
      finalExportPath = path.join(reportsDir, `Reporte_NAV_QC_Ene_Feb_2026_Styled_${Date.now()}.xlsx`);
      await workbook.xlsx.writeFile(finalExportPath);
    } else {
      throw err;
    }
  }

  console.log(`\n EXCEL ESTILIZADO GENERADO CON ÉXITO: ${finalExportPath}`);
  return finalExportPath;
}

generateStyledNavExcel().catch(err => {
  console.error('ERROR FATAL:', err);
  process.exit(1);
});
