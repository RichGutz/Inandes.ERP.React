import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

const SUPABASE_URL = 'https://egvcinsbyropumybatdf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVndmNpbnNieXJvcHVteWJhdGRmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDA0NDczNCwiZXhwIjoyMDk5NjIwNzM0fQ.28T_xQmSRJO1O1scio61JU0KHhEQfzSS94qYka8TrcA';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const startDate = new Date(2026, 0, 1, 0, 0, 0, 0); // 2026-01-01
const endDate = new Date(2026, 1, 28, 0, 0, 0, 0);   // 2026-02-28
const startDateStr = '2026-01-01';
const endDateStr = '2026-02-28';

async function runNavQC() {
  console.log('========================================================');
  console.log('INICIANDO MOTOR NAV QC - PERIODO ENERO-FEBRERO 2026');
  console.log('========================================================');

  // 1. Cargar Fondos
  const { data: fondosData, error: fErr } = await supabase
    .from('crm_fondos')
    .select('*')
    .order('nombre_fondo', { ascending: true });

  if (fErr) throw fErr;

  // Agrupar por id_fondo para variables maestras
  const fondosMap = {};
  for (const f of fondosData) {
    if (!fondosMap[f.id_fondo]) {
      fondosMap[f.id_fondo] = f;
    }
  }

  // 2. Cargar Contratos de Inversion
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

  // 4. Cargar Cronograma de Rescates y Deducciones
  const { data: allCron, error: cronErr } = await supabase
    .from('crm_cronograma_deducciones_rescates')
    .select('*')
    .in('id_contrato', allCids);

  if (cronErr) throw cronErr;

  const cronRescMap = {};
  for (const item of (allCron || [])) {
    const cid = item.id_contrato || item.id_certificado;
    const fP = new Date(item.fecha_proyectada_cobro.split('T')[0] + 'T00:00:00');
    if (fP >= startDate && fP <= endDate && item.tipo_cargo === 'RESCATE_CAPITAL') {
      if (!cronRescMap[cid]) cronRescMap[cid] = [];
      cronRescMap[cid].push({
        fecha: fP,
        monto: Number(item.monto_cobrar),
        es_total: Boolean(item.es_rescate_total)
      });
    }
  }

  // 5. Generar lista de días continuos Ene-Feb 2026 (59 días)
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

  const wb = XLSX.utils.book_new();
  const summaryQCReport = [];

  // Fondos a procesar en orden oficial
  const priorityFondos = ["NSGPEN01", "NSGPEN02", "NSGPEN03", "NSGUSD01", "NSGUSD02", "NSLCON01"];
  const fondosToProcess = priorityFondos.filter(id => fondosMap[id]);

  for (const fondoId of fondosToProcess) {
    const fondo = fondosMap[fondoId];
    const tActiva = Number(fondo.tasa_activa || 14.0) / 100;
    const pAdmin = Number(fondo.comision_administracion_fondo || 1.0) / 100;
    const pCap = Number(fondo.comision_captacion_fondo || 2.0) / 100;
    const pMisc = Number(fondo.comision_miscelaneos_fondo || 0.0) / 100;

    // Filtrar contratos del fondo
    const certsFondo = rawContratos.filter(c => {
      if (c.id_fondo !== fondoId) return false;
      const fIni = c.fecha_inicio ? c.fecha_inicio.split('T')[0] : '2000-01-01';
      return fIni <= endDateStr;
    });

    if (certsFondo.length === 0) continue;

    // Ordenar por número correlativo
    certsFondo.sort((a, b) => {
      const m1 = a.id_contrato.match(/[.-](\d+)/);
      const m2 = b.id_contrato.match(/[.-](\d+)/);
      const idx1 = m1 ? parseInt(m1[1], 10) : 999;
      const idx2 = m2 ? parseInt(m2[1], 10) : 999;
      return idx1 - idx2;
    });

    // Resolver Capital Inicial de cada contrato (tomando el Ledger al 31/12/2025 o apertura)
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
      let lastClosureDate = null;

      if (closingEvents.length > 0) {
        closingEvents.sort((a, b) => String(a.fecha_periodo_fin).localeCompare(String(b.fecha_periodo_fin)));
        const lastClosure = closingEvents[closingEvents.length - 1];
        capIni = (lastClosure.capital_final_saldo !== null && lastClosure.capital_final_saldo !== undefined)
          ? Number(lastClosure.capital_final_saldo)
          : Number(lastClosure.capital_base || 0);
        lastClosureDate = new Date(lastClosure.fecha_periodo_fin.split('T')[0] + 'T00:00:00');
      } else {
        capIni = Number(c.monto_inversion || 0);
      }

      // Si cerró en 0 antes del periodo y no tiene aumentos, omitir
      const fIni = new Date((c.fecha_inicio || '2026-01-01').split('T')[0] + 'T00:00:00');

      // Buscar aumentos ocurridos en el periodo
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
        cuotas: capIni, // 1 cuota = 1 sol/dólar inicial
        emision: fIni,
        interes_acum: 0.0,
        valores_dia: [],
        aumentos: aumentos,
        hijos: []
      });
    }

    // Inicializar totales del fondo
    let patAyer = certRows.reduce((sum, c) => sum + c.capital, 0);
    let cuotasAyer = certRows.reduce((sum, c) => sum + c.cuotas, 0);
    let fInvOrigAcum = patAyer;
    let valCuotaAyer = 1.0;

    let totalGananciaBrutaAcum = 0.0;
    let totalAdminAcum = 0.0;
    let totalCapAcum = 0.0;
    let totalMiscAcum = 0.0;
    let totalUtilidadNetaAcum = 0.0;

    // Estructura de filas de resumen con distribución clara y profesional
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

    // Bucle diario (01/01 al 28/02)
    for (let dayIdx = 0; dayIdx < diasPeriodo.length; dayIdx++) {
      const d = diasPeriodo[dayIdx];
      const dStr = d.toISOString().split('T')[0];

      // 1. Ingreso Bruto Base 360
      const ingresoBrutoDia = patAyer * (tActiva / 360.0);
      
      // 2. Gastos Comisiones Base 365
      const gastoAdmin = patAyer * (pAdmin / 365.0);
      const gastoCap = patAyer * (pCap / 365.0);
      const gastoMisc = patAyer * (pMisc / 365.0);

      // 3. Utilidad Neta Diaria
      const utilidadNetaDia = ingresoBrutoDia - (gastoAdmin + gastoCap + gastoMisc);

      totalGananciaBrutaAcum += ingresoBrutoDia;
      totalAdminAcum += gastoAdmin;
      totalCapAcum += gastoCap;
      totalMiscAcum += gastoMisc;
      totalUtilidadNetaAcum += utilidadNetaDia;

      // 4. Patrimonio Previo y Valor Cuota de Hoy
      const patPre = patAyer + utilidadNetaDia;
      const valCuotaHoy = cuotasAyer > 0 ? (patPre / cuotasAyer) : 1.0;

      // 5. Devengue por contrato individual
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

      // 6. Suscripciones / Aumentos de Capital de hoy (si d > 2026-01-01)
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

      // 7. Llenar filas de resumen con la nueva distribución clara
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

      // Actualizar para mañana
      patAyer = patCierre;
      cuotasAyer = cuotaCierre;
      valCuotaAyer = valCuotaHoy;
    }

    // 8. Construir filas de la hoja Excel
    const excelRows = [];

    // Filas de Certificados e Hijos
    for (const r of certRows) {
      const rowObj = { "ITEM": r.id };
      for (let i = 0; i < allDayLabels.length; i++) {
        rowObj[allDayLabels[i]] = r.valores_dia[i] || 0.0;
      }
      excelRows.push(rowObj);

      for (const h of r.hijos) {
        const hijoObj = { "ITEM": `   ${h.id}` };
        for (let i = 0; i < allDayLabels.length; i++) {
          hijoObj[allDayLabels[i]] = h.valores_dia[i] || 0.0;
        }
        excelRows.push(hijoObj);
      }
    }

    // Filas de Resumen
    for (const [label, vals] of Object.entries(summaryRows)) {
      const sObj = { "ITEM": label };
      for (let i = 0; i < allDayLabels.length; i++) {
        sObj[allDayLabels[i]] = vals[i] || 0.0;
      }
      excelRows.push(sObj);
    }

    const ws = XLSX.utils.json_to_sheet(excelRows);
    
    // Anchos de columna
    const colWidths = [{ wch: 34 }];
    allDayLabels.forEach(() => colWidths.push({ wch: 11 }));
    ws['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, fondoId.slice(0, 31));

    // Guardar resumen para QC
    const vcFinal = summaryRows['VAL CUOTA FINAL'][summaryRows['VAL CUOTA FINAL'].length - 1];
    const patFinal = summaryRows['PATRIMONIO TOTAL CIERRE'][summaryRows['PATRIMONIO TOTAL CIERRE'].length - 1];
    const patInicial = summaryRows['TOTAL CAPITAL (Apertura)'][0];

    summaryQCReport.push({
      fondo: fondoId,
      nombre: fondo.nombre_fondo,
      moneda: fondo.moneda,
      contratos: certRows.length,
      patrimonio_inicial: patInicial,
      patrimonio_cierre: patFinal,
      ganancia_bruta_acum: totalGananciaBrutaAcum,
      comision_admin_acum: totalAdminAcum,
      comision_capt_acum: totalCapAcum,
      utilidad_neta_acum: totalUtilidadNetaAcum,
      valor_cuota_final: vcFinal
    });
  }

  // Guardar archivo Excel (manejando posible bloqueo si el usuario lo tiene abierto en Excel)
  const reportsDir = path.join(process.cwd(), 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  let exportFilePath = path.join(reportsDir, 'Reporte_NAV_QC_Ene_Feb_2026.xlsx');
  try {
    XLSX.writeFile(wb, exportFilePath);
  } catch (err) {
    if (err.code === 'EBUSY') {
      exportFilePath = path.join(reportsDir, 'Reporte_NAV_QC_Ene_Feb_2026_V2.xlsx');
      XLSX.writeFile(wb, exportFilePath);
      console.log(`\n(Archivo principal en uso. Guardado como versión V2: ${exportFilePath})`);
    } else {
      throw err;
    }
  }

  console.log(`\n EXCEL GENERADO EXITOSAMENTE: ${exportFilePath}`);
  console.log('\n========================================================');
  console.log('RESUMEN DE AUDITORIA Y CONVERGENCIA NAV (ENE-FEB 2026):');
  console.log('========================================================');
  console.table(summaryQCReport);

  return { exportFilePath, summaryQCReport };
}

runNavQC().catch(err => {
  console.error('ERROR FATAL EN QC:', err);
  process.exit(1);
});
