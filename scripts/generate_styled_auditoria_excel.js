import { createClient } from '@supabase/supabase-js';
import ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';

const SUPABASE_URL = 'https://egvcinsbyropumybatdf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVndmNpbnNieXJvcHVteWJhdGRmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDA0NDczNCwiZXhwIjoyMDk5NjIwNzM0fQ.28T_xQmSRJO1O1scio61JU0KHhEQfzSS94qYka8TrcA';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const BASE_DIAS = 365.0;
const PRIORITY_FONDOS = ["NSGPEN01", "NSGPEN02", "NSGPEN03", "NSGUSD01", "NSGUSD02", "NSLCON01"];

const formatDateMD = (d) => {
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}`;
};

async function generateStyledAuditoriaExcelWithGrouping() {
  console.log('========================================================');
  console.log('GENERANDO EXCEL OFICIAL AUDITORIA CON DIAS COLAPSADOS [+]/[-]');
  console.log('========================================================');

  const fStart = new Date(2026, 0, 1, 0, 0, 0, 0);
  const fechaFin = new Date(2026, 1, 28, 0, 0, 0, 0);
  const fStartStr = '2026-01-01';
  const fEndStr = '2026-02-28';

  const diasPeriodo = [];
  let current = new Date(fStart);
  while (current <= fechaFin) {
    diasPeriodo.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  const columnasFechas = diasPeriodo.map(d => formatDateMD(d));

  // 1. Inversionistas
  const { data: invData } = await supabase.from('crm_inversionistas').select('*');
  const invMap = {};
  for (const i of (invData || [])) {
    const fullName = i.nombre_completo || `${i.nombre_1 || ''} ${i.apellido_1 || ''}`.trim();
    for (const key of ['id', 'uuid', 'documento_identidad', 'codigo_inversionista']) {
      if (i[key]) invMap[String(i[key]).toLowerCase()] = fullName;
    }
  }

  // 2. Fondos
  const { data: fondosData } = await supabase.from('crm_fondos').select('*');
  const fondosMap = {};
  for (const f of (fondosData || [])) {
    if (!fondosMap[f.id_fondo]) fondosMap[f.id_fondo] = f;
  }

  // 3. Contratos
  const { data: rawContratosMaster } = await supabase
    .from('crm_contratos')
    .select('*')
    .in('estado', ['emitido', 'cerrado_por_rescate', 'cerrado_fin_contrato']);

  const allCids = (rawContratosMaster || []).map(c => c.id_contrato);

  // 4. Eventos
  const { data: events } = await supabase
    .from('crm_certificados_eventos')
    .select('*')
    .in('id_contrato', allCids)
    .order('fecha_periodo_fin', { ascending: true });

  const eventsByContrato = {};
  for (const e of (events || [])) {
    const cid = e.id_contrato || e.id_certificado;
    if (!eventsByContrato[cid]) eventsByContrato[cid] = [];
    eventsByContrato[cid].push(e);
  }

  // 5. Cronograma
  const { data: cronItems } = await supabase
    .from('crm_cronograma_deducciones_rescates')
    .select('*')
    .in('id_contrato', allCids);

  const cronDedMap = {};
  const cronRescMap = {};
  for (const item of (cronItems || [])) {
    const cid = item.id_contrato || item.id_certificado;
    const fP = new Date(item.fecha_proyectada_cobro.split('T')[0] + 'T00:00:00');
    if (fP >= fStart && fP <= fechaFin) {
      if (item.tipo_cargo === 'RESCATE_CAPITAL') {
        if (!cronRescMap[cid]) cronRescMap[cid] = [];
        cronRescMap[cid].push({
          id_registro: item.id_cuota,
          fecha: fP,
          monto: Number(item.monto_cobrar),
          tasa: Number(item.tasa || 0) / 100
        });
      } else {
        if (!cronDedMap[cid]) cronDedMap[cid] = [];
        cronDedMap[cid].push(item);
      }
    }
  }

  const contratosMaster = (rawContratosMaster || []).filter(c => {
    const fIniStr = c.fecha_inicio ? c.fecha_inicio.split('T')[0] : '2000-01-01';
    if (fIniStr > fEndStr) return false;
    return true;
  });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'INANDES GRUPO FINANCIERO';
  workbook.lastModifiedBy = 'InAndes React CRM';
  workbook.created = new Date();

  // Columnas maestras: Base + Días + Cierre
  const headersFondo = [
    "#", "Certificado", "Inversionista", "Capital Base",
    ...columnasFechas,
    "INT. BRUTO", "IR (5%)", "BASE NETA", "CAPITALIZACION", "REPARTO",
    "DEDUCCIONES", "PENALIDAD", "NETO FINAL", "RESCATES", "TRANSFERENCIAS", "CAPITAL FINAL"
  ];

  const dailyStartIndex = 5; // Columna 5 (1-based) es 01/01
  const dailyEndIndex = dailyStartIndex + columnasFechas.length - 1; // Columna 63 es 28/02

  for (const fid of PRIORITY_FONDOS) {
    const fondo = fondosMap[fid];
    if (!fondo) continue;

    const certsFondo = contratosMaster.filter(c => c.id_fondo === fid);
    if (certsFondo.length === 0) continue;

    certsFondo.sort((a, b) => {
      const m1 = a.id_contrato.match(/[.-](\d+)/);
      const m2 = b.id_contrato.match(/[.-](\d+)/);
      const idx1 = m1 ? parseInt(m1[1], 10) : 999;
      const idx2 = m2 ? parseInt(m2[1], 10) : 999;
      return idx1 - idx2;
    });

    const ws = workbook.addWorksheet(`Fondo_${fid.slice(0, 24)}`, {
      views: [{ state: 'frozen', xSplit: 3, ySplit: 1 }] // Inmovilizar #, Certificado, Inversionista y Fila 1
    });

    // Configurar propiedades de agrupación
    ws.properties.outlineProperties = {
      summaryBelow: false,
      summaryRight: true
    };

    // Cabecera Fila 1
    const headerRow = ws.addRow(headersFondo);
    headerRow.height = 28;
    headerRow.eachCell((cell, colNumber) => {
      cell.font = { name: 'Consolas', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: colNumber <= 3 ? 'FF0F172A' : (colNumber <= dailyEndIndex ? 'FF334155' : 'FF1E293B') }
      };
      cell.alignment = { vertical: 'middle', horizontal: colNumber <= 3 ? 'center' : 'right' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF334155' } },
        bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
        left: { style: 'thin', color: { argb: 'FF334155' } },
        right: { style: 'thin', color: { argb: 'FF334155' } }
      };
    });

    let totCap = 0, totBruto = 0, totIr = 0, totBaseNeta = 0, totCapz = 0, totReparto = 0, totDed = 0, totPen = 0, totNetoFin = 0, totResc = 0, totTransf = 0, totCapFin = 0;
    const totDias = new Array(diasPeriodo.length).fill(0.0);
    let nOrden = 1;

    for (const c of certsFondo) {
      const cid = c.id_contrato;
      const evs = eventsByContrato[cid] || [];
      const closingEvents = evs.filter(e => 
        ['cierre_fin_ciclo', 'cierre_fin_contrato', 'emision_inicial', 'emision'].includes(e.tipo_evento) &&
        e.fecha_periodo_fin &&
        new Date(e.fecha_periodo_fin.split('T')[0] + 'T00:00:00') < fStart
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

      const invName = [c.id_inversionista_1, c.id_inversionista_2, c.id_inversionista_3]
        .filter(Boolean)
        .map(id => invMap[String(id).toLowerCase()])
        .filter(Boolean)
        .join(' / ') || c.id_inversionista_1 || 'N/A';

      const tasa = Number(c.tasa_pactada || 10.0) / 100;
      const pctReparto = Number(c.porcentaje_reparto ?? 100) / 100;
      const fEmision = new Date((c.fecha_inicio || '2026-01-01').split('T')[0] + 'T00:00:00');

      // Calcular vector diario de intereses
      const vDiasPadre = [];
      let intBrutoPadre = 0.0;
      for (let dayIdx = 0; dayIdx < diasPeriodo.length; dayIdx++) {
        const d = diasPeriodo[dayIdx];
        const isEmitted = d >= fEmision;
        const intDia = isEmitted ? (capIni * tasa) / BASE_DIAS : 0.0;
        vDiasPadre.push(intDia);
        intBrutoPadre += intDia;
        totDias[dayIdx] += intDia;
      }

      // Buscar aumentos de capital en el período
      const aumentos = [];
      for (const e of evs) {
        if (['aumento_capital', 'reinvierte_interes'].includes(e.tipo_evento)) {
          const rawF = e.fecha_evento || e.fecha_periodo_fin || '2020-01-01';
          const fEv = new Date(rawF.split('T')[0] + 'T00:00:00');
          if (fEv >= fStart && fEv <= fechaFin) {
            const montoAum = Number(e.capital_final_saldo || 0) - Number(e.capital_base || 0);
            if (montoAum > 0) {
              aumentos.push({ fecha: fEv, monto: montoAum });
            }
          }
        }
      }

      let totAumMonto = 0;
      let totAumBruto = 0;
      const hijosRows = [];

      for (const a of aumentos) {
        const vDiasHijo = [];
        let intBrutoHijo = 0.0;
        for (let dayIdx = 0; dayIdx < diasPeriodo.length; dayIdx++) {
          const d = diasPeriodo[dayIdx];
          const isAumEmitted = d >= a.fecha;
          const intDiaH = isAumEmitted ? (a.monto * tasa) / BASE_DIAS : 0.0;
          vDiasHijo.push(intDiaH);
          intBrutoHijo += intDiaH;
          totDias[dayIdx] += intDiaH;
        }
        totAumMonto += a.monto;
        totAumBruto += intBrutoHijo;

        hijosRows.push({
          id: `Aumento (${formatDateMD(a.fecha)})`,
          monto: a.monto,
          vDias: vDiasHijo,
          intBruto: intBrutoHijo
        });
      }

      const totalIntBrutoContrato = intBrutoPadre + totAumBruto;
      const isExento = (c.tipo_persona || '').toUpperCase().includes('JURIDICA');
      const ir = isExento ? 0 : totalIntBrutoContrato * 0.05;
      const baseNeta = totalIntBrutoContrato - ir;
      const reparto = baseNeta * pctReparto;
      const capz = baseNeta * (1 - pctReparto);

      const deds = cronDedMap[cid] || [];
      const totDeducciones = deds.reduce((sum, d) => sum + Number(d.monto_cobrar || 0), 0);

      const rescates = cronRescMap[cid] || [];
      const totRescates = rescates.reduce((sum, r) => sum + Number(r.monto || 0), 0);
      const penalidad = 0;

      const netoFinal = Math.round((reparto - totDeducciones) * 100) / 100;
      const rescatesNetos = Math.round((totRescates - penalidad) * 100) / 100;
      const transferencia = Math.round((netoFinal + rescatesNetos) * 100) / 100;
      const capitalFinal = Math.round((capIni + totAumMonto + capz - totRescates) * 100) / 100;

      totCap += (capIni + totAumMonto);
      totBruto += totalIntBrutoContrato;
      totIr += ir;
      totBaseNeta += baseNeta;
      totCapz += capz;
      totReparto += reparto;
      totDed += totDeducciones;
      totPen += penalidad;
      totNetoFin += netoFinal;
      totResc += totRescates;
      totTransf += transferencia;
      totCapFin += capitalFinal;

      // Fila Padre
      const rowVals = [
        nOrden++,
        cid,
        invName,
        capIni,
        ...vDiasPadre,
        intBrutoPadre,
        ir,
        baseNeta,
        capz,
        reparto,
        totDeducciones,
        penalidad,
        netoFinal,
        totRescates,
        transferencia,
        capitalFinal
      ];

      const addedRow = ws.addRow(rowVals);
      addedRow.height = 20;

      addedRow.eachCell((cell, colNumber) => {
        if (colNumber === 1) {
          cell.font = { name: 'Consolas', size: 9.5, color: { argb: 'FF64748B' } };
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        } else if (colNumber === 2) {
          cell.font = { name: 'Consolas', size: 9.5, bold: true, color: { argb: 'FF1E293B' } };
          cell.alignment = { vertical: 'middle', horizontal: 'left' };
        } else if (colNumber === 3) {
          cell.font = { name: 'Consolas', size: 9.5, color: { argb: 'FF1E293B' } };
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

      // Filas Hijas (Aumentos)
      for (const h of hijosRows) {
        const hijoRowVals = [
          "-",
          h.id,
          "   └─ Incremento de Capital",
          h.monto,
          ...h.vDias,
          h.intBruto,
          0, 0, 0, 0, 0, 0, 0, 0, 0, 0
        ];

        const addedHijoRow = ws.addRow(hijoRowVals);
        addedHijoRow.height = 19;

        addedHijoRow.eachCell((cell, colNumber) => {
          if (colNumber === 1) {
            cell.font = { name: 'Consolas', size: 9, color: { argb: 'FF64748B' } };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
          } else if (colNumber === 2) {
            cell.font = { name: 'Consolas', size: 9, italic: true, bold: true, color: { argb: 'FF059669' } };
            cell.alignment = { vertical: 'middle', horizontal: 'left' };
          } else if (colNumber === 3) {
            cell.font = { name: 'Consolas', size: 9, italic: true, color: { argb: 'FF059669' } };
            cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
          } else {
            cell.numFmt = '#,##0.00';
            cell.font = { name: 'Consolas', size: 9, italic: true, color: { argb: 'FF059669' } };
            cell.alignment = { vertical: 'middle', horizontal: 'right' };
          }
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDF4' } };
          cell.border = {
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFF1F5F9' } }
          };
        });
      }
    }

    // Fila Totales
    const totalRowVals = [
      "TOTALES",
      `${fid} (${fondo.moneda})`,
      "",
      totCap,
      ...totDias,
      totBruto, totIr, totBaseNeta, totCapz, totReparto, totDed, totPen, totNetoFin, totResc, totTransf, totCapFin
    ];

    const totalRow = ws.addRow(totalRowVals);
    totalRow.height = 24;

    totalRow.eachCell((cell, colNumber) => {
      if (colNumber <= 2) {
        cell.font = { name: 'Consolas', size: 10, bold: true, color: { argb: 'FF78350F' } };
        cell.alignment = { vertical: 'middle', horizontal: colNumber === 1 ? 'center' : 'left' };
      } else if (colNumber === 3) {
        cell.font = { name: 'Consolas', size: 10, bold: true, color: { argb: 'FF78350F' } };
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      } else {
        cell.numFmt = '#,##0.00';
        cell.font = { name: 'Consolas', size: 10, bold: true, color: { argb: 'FF78350F' } };
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
      }

      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFD97706' } },
        bottom: { style: 'double', color: { argb: 'FFD97706' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
      };
    });

    // Configurar anchos de columna y AGRUPAMIENTO [+]/[-]
    ws.getColumn(1).width = 8;   // #
    ws.getColumn(2).width = 32;  // Certificado
    ws.getColumn(3).width = 42;  // Inversionista
    ws.getColumn(4).width = 16;  // Capital Base

    // Agrupar y colapsar las 59 columnas diarias
    for (let c = dailyStartIndex; c <= dailyEndIndex; c++) {
      const col = ws.getColumn(c);
      col.width = 14;
      col.outlineLevel = 1;
      col.hidden = true; // Colapsado por defecto con botón [+] en Excel
    }

    // Columnas de liquidación
    for (let c = dailyEndIndex + 1; c <= headersFondo.length; c++) {
      ws.getColumn(c).width = 16;
    }
  }

  const reportsDir = path.join(process.cwd(), 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const finalPath = path.join(reportsDir, 'AUDITORIA_OFICIAL_SISTEMA_2026-02-28_CON_DIAS_COLAPSADOS.xlsx');
  await workbook.xlsx.writeFile(finalPath);

  console.log(`\n EXCEL DE AUDITORIA CON DIAS AGRUPADOS/COLAPSADOS GENERADO CON EXITO: ${finalPath}`);
  return finalPath;
}

generateStyledAuditoriaExcelWithGrouping().catch(err => {
  console.error('ERROR FATAL:', err);
  process.exit(1);
});
