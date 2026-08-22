import { createClient } from '@supabase/supabase-js';
import ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';

const SUPABASE_URL = 'https://egvcinsbyropumybatdf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVndmNpbnNieXJvcHVteWJhdGRmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDA0NDczNCwiZXhwIjoyMDk5NjIwNzM0fQ.28T_xQmSRJO1O1scio61JU0KHhEQfzSS94qYka8TrcA';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const BASE_DIAS = 365.0;

const sanitizeTextForBcp = (text, maxLength) => {
  if (!text) return ''.padEnd(maxLength, ' ');
  const normalized = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[Ññ]/g, 'N')
    .replace(/[^a-zA-Z0-9\s.-]/g, '')
    .toUpperCase()
    .trim();
  return normalized.slice(0, maxLength).padEnd(maxLength, ' ');
};

const formatAmountForBcp = (amount) => {
  const cleanAmount = Math.max(0, Math.round(amount * 100));
  return String(cleanAmount).padStart(15, '0');
};

const mapDocTypeToBcp = (tipoDoc, numDoc) => {
  const cleanType = (tipoDoc || '').toUpperCase().trim();
  const cleanNum = (numDoc || '').replace(/\D/g, '');
  if (cleanType.includes('RUC') || cleanNum.length === 11) return '6';
  if (cleanType.includes('CE') || cleanType.includes('EXTRANJER')) return '4';
  if (cleanType.includes('PASAPORTE')) return '7';
  return '1';
};

async function generateBcpAuditExcel() {
  console.log('========================================================');
  console.log('GENERANDO EXCEL MULTI-PESTAÑA DE AUDITORIA TELECREDITO BCP');
  console.log('========================================================');

  const fStart = new Date(2026, 0, 1, 0, 0, 0, 0);
  const fechaFin = new Date(2026, 1, 28, 0, 0, 0, 0);
  const fStartStr = '2026-01-01';
  const fEndStr = '2026-02-28';

  // 1. Inversionistas
  const { data: invData } = await supabase.from('crm_inversionistas').select('*');
  const invMap = {};
  for (const i of (invData || [])) {
    for (const key of ['id', 'uuid', 'documento_identidad', 'codigo_inversionista']) {
      if (i[key]) invMap[String(i[key]).toLowerCase()] = i;
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

  const priorityFondos = ["NSGPEN01", "NSGPEN02", "NSGPEN03", "NSGUSD01", "NSGUSD02", "NSLCON01"];

  for (const fid of priorityFondos) {
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

    const transferItems = [];

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

      const invObj = invMap[String(c.id_inversionista_1 || '').toLowerCase()] || {};
      const invName = invObj.nombre_completo || c.id_inversionista_1 || 'N/A';
      const tipoDoc = invObj.tipo_doc || 'DNI';
      const numDoc = invObj.documento_identidad || '';

      const isUsd = (fondo.moneda || '').toUpperCase().includes('USD');
      const banco = isUsd ? (invObj.banco_nombre_usd || '') : (invObj.banco_nombre_pen || '');
      const numCuenta = isUsd ? (invObj.numero_cuenta_usd || '') : (invObj.numero_cuenta_pen || '');
      const cci = isUsd ? (invObj.cci_usd || '') : (invObj.cci_pen || '');

      const tasa = Number(c.tasa_pactada || 10.0) / 100;
      const pctReparto = Number(c.porcentaje_reparto ?? 100) / 100;

      const intBrutoPadre = capIni * tasa * (59.0 / BASE_DIAS);

      let totAumBruto = 0;
      for (const e of evs) {
        if (['aumento_capital', 'reinvierte_interes'].includes(e.tipo_evento)) {
          const rawF = e.fecha_evento || e.fecha_periodo_fin || '2020-01-01';
          const fEv = new Date(rawF.split('T')[0] + 'T00:00:00');
          if (fEv >= fStart && fEv <= fechaFin) {
            const montoAum = Number(e.capital_final_saldo || 0) - Number(e.capital_base || 0);
            if (montoAum > 0) {
              const diffMs = fechaFin.getTime() - fEv.getTime();
              const nDiasAum = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
              totAumBruto += montoAum * tasa * (nDiasAum / BASE_DIAS);
            }
          }
        }
      }

      const totalIntBruto = intBrutoPadre + totAumBruto;
      const isExento = (c.tipo_persona || '').toUpperCase().includes('JURIDICA');
      const ir = isExento ? 0 : totalIntBruto * 0.05;
      const baseNeta = totalIntBruto - ir;
      const reparto = baseNeta * pctReparto;

      const deds = cronDedMap[cid] || [];
      const totDeducciones = deds.reduce((sum, d) => sum + Number(d.monto_cobrar || 0), 0);

      const rescates = cronRescMap[cid] || [];
      const totRescates = rescates.reduce((sum, r) => sum + Number(r.monto || 0), 0);
      const penalidad = 0;

      const netoFinal = Math.round((reparto - totDeducciones) * 100) / 100;
      const rescatesNetos = Math.round((totRescates - penalidad) * 100) / 100;
      const transferencia = Math.round((netoFinal + rescatesNetos) * 100) / 100;

      if (transferencia > 0) {
        transferItems.push({
          idContrato: cid,
          invName,
          tipoDoc,
          numDoc,
          banco,
          numCuenta,
          cci,
          transferencia,
          moneda: fondo.moneda
        });
      }
    }

    if (transferItems.length === 0) continue;

    const ws = workbook.addWorksheet(`BCP_${fid}`, {
      views: [{ state: 'frozen', xSplit: 2, ySplit: 5 }] // Inmovilizar #, Certificado y Cabeceras
    });

    const codMoneda = (fondo.moneda || '').toUpperCase() === 'USD' ? '1001' : '0001';
    const ctaOrigen = '19300000000000'.padEnd(20, ' ');
    const cleanFecha = '20260228';
    const refLote = sanitizeTextForBcp(`LOTE-${fid}-20260228`, 40);
    const totalAbonos = transferItems.length;
    const montoTotal = transferItems.reduce((sum, it) => sum + it.transferencia, 0);

    const headerTrama = [
      'C',
      String(totalAbonos).padStart(6, '0'),
      cleanFecha,
      'CCT',
      codMoneda,
      ctaOrigen,
      formatAmountForBcp(montoTotal),
      refLote
    ].join('');

    // Fila 1: Título de Auditoría
    const r1 = ws.addRow(['INANDES GRUPO FINANCIERO — LOTE TELECRÉDITO BCP (ABONOS MASIVOS)']);
    r1.height = 24;
    r1.getCell(1).font = { name: 'Consolas', size: 12, bold: true, color: { argb: 'FF1E1B4B' } };

    // Fila 2: Subtítulo y Parámetros
    const r2 = ws.addRow([`FONDO: ${fid} (${fondo.moneda})  |  FECHA PROCESO: ${cleanFecha}  |  TOTAL ABONOS: ${totalAbonos}  |  MONTO TOTAL: ${fondo.moneda === 'USD' ? '$' : 'S/'} ${montoTotal.toLocaleString('es-PE', { minimumFractionDigits: 2 })}`]);
    r2.height = 18;
    r2.getCell(1).font = { name: 'Consolas', size: 9.5, bold: true, color: { argb: 'FF4338CA' } };

    // Fila 3: Espacio
    ws.addRow([]);

    // Fila 4: Resumen de Registro 'C' Cabecera
    const r4 = ws.addRow([
      'CABECERA (Reg C):',
      headerTrama,
      '', '', '', '', '', '', '', '', '',
      `Len: ${headerTrama.length} chars`
    ]);
    r4.height = 22;
    r4.eachCell(cell => {
      cell.font = { name: 'Consolas', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E1B4B' } };
    });

    // Fila 5: Encabezados de Detalle
    const detailHeaders = [
      '#',
      'Certificado (Ref ERP)',
      'Inversionista / Razón Social',
      'Tipo Doc',
      'N° Documento',
      'Banco',
      'Tipo Cta',
      'Cuenta / CCI Destino',
      'Monto a Transferir',
      'IDC',
      'Tipo Op',
      'TRAMA_TXT_BCP_120_CHARS'
    ];

    const hRow = ws.addRow(detailHeaders);
    hRow.height = 26;
    hRow.eachCell((cell, colNumber) => {
      cell.font = { name: 'Consolas', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: colNumber === 12 ? 'FF312E81' : (colNumber <= 2 ? 'FF0F172A' : 'FF1E293B') }
      };
      cell.alignment = { vertical: 'middle', horizontal: colNumber === 9 ? 'right' : (colNumber === 1 || colNumber === 4 || colNumber === 7 || colNumber === 10 ? 'center' : 'left') };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF334155' } },
        bottom: { style: 'medium', color: { argb: 'FF0F172A' } }
      };
    });

    // Filas de Detalle
    let nOrden = 1;
    for (const it of transferItems) {
      const isBcp = (it.banco || '').toUpperCase().includes('BCP') && Boolean(it.numCuenta);
      const hasCci = Boolean(it.cci && it.cci.replace(/\D/g, '').length === 20);

      let tipoCtaDestino = 'CCT';
      let nroCtaDestino = '';

      if (isBcp && it.numCuenta) {
        nroCtaDestino = it.numCuenta.replace(/\D/g, '').slice(0, 20);
        tipoCtaDestino = nroCtaDestino.startsWith('191') ? 'CCT' : 'SCA';
      } else if (hasCci) {
        nroCtaDestino = it.cci.replace(/\D/g, '').slice(0, 20);
        tipoCtaDestino = 'CND';
      } else if (it.numCuenta) {
        nroCtaDestino = it.numCuenta.replace(/\D/g, '').slice(0, 20);
      } else {
        nroCtaDestino = '00000000000000';
      }

      const ctaDestinoPadded = nroCtaDestino.padEnd(20, ' ');
      const codDoc = mapDocTypeToBcp(it.tipoDoc, it.numDoc);
      const nroDocPadded = (it.numDoc || '').replace(/\D/g, '').slice(0, 15).padEnd(15, ' ');
      const nombrePadded = sanitizeTextForBcp(it.invName, 40);
      const montoFormatted = formatAmountForBcp(it.transferencia);
      const valIdc = 'S';
      const tipoOp = '0000';
      const refCertPadded = sanitizeTextForBcp(it.idContrato, 20);

      const trama120 = [
        'A',
        tipoCtaDestino.slice(0, 3).padEnd(3, ' '),
        ctaDestinoPadded,
        codDoc,
        nroDocPadded,
        nombrePadded,
        montoFormatted,
        valIdc,
        tipoOp,
        refCertPadded
      ].join('');

      const rowVals = [
        nOrden++,
        it.idContrato,
        it.invName,
        codDoc === '1' ? 'DNI' : (codDoc === '6' ? 'RUC' : 'CE'),
        it.numDoc,
        it.banco || (isBcp ? 'BCP' : 'OTRO'),
        tipoCtaDestino,
        nroCtaDestino,
        it.transferencia,
        valIdc,
        tipoOp,
        trama120
      ];

      const addedRow = ws.addRow(rowVals);
      addedRow.height = 20;

      addedRow.eachCell((cell, colNumber) => {
        if (colNumber === 1) {
          cell.font = { name: 'Consolas', size: 9, color: { argb: 'FF64748B' } };
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        } else if (colNumber === 2) {
          cell.font = { name: 'Consolas', size: 9.5, bold: true, color: { argb: 'FF1E293B' } };
          cell.alignment = { vertical: 'middle', horizontal: 'left' };
        } else if (colNumber === 3) {
          cell.font = { name: 'Consolas', size: 9.5, color: { argb: 'FF1E293B' } };
          cell.alignment = { vertical: 'middle', horizontal: 'left' };
        } else if (colNumber === 9) {
          cell.numFmt = '#,##0.00';
          cell.font = { name: 'Consolas', size: 9.5, bold: true, color: { argb: 'FF059669' } };
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
        } else if (colNumber === 12) {
          cell.font = { name: 'Consolas', size: 8.5, color: { argb: 'FF4338CA' } };
          cell.alignment = { vertical: 'middle', horizontal: 'left' };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF2FF' } }; // Soft Indigo
        } else {
          cell.font = { name: 'Consolas', size: 9, color: { argb: 'FF334155' } };
          cell.alignment = { vertical: 'middle', horizontal: colNumber === 4 || colNumber === 7 || colNumber === 10 ? 'center' : 'left' };
        }
        cell.border = {
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFF1F5F9' } }
        };
      });
    }

    // Fila Totales
    const totalRowVals = [
      'TOTALES',
      `${fid} (${fondo.moneda})`,
      `${totalAbonos} Abonos Programados`,
      '', '', '', '', '',
      montoTotal,
      '', '',
      `Suma Total: ${fondo.moneda === 'USD' ? '$' : 'S/'} ${montoTotal.toLocaleString('es-PE', { minimumFractionDigits: 2 })}`
    ];

    const totRow = ws.addRow(totalRowVals);
    totRow.height = 24;
    totRow.eachCell((cell, colNumber) => {
      cell.font = { name: 'Consolas', size: 10, bold: true, color: { argb: 'FF78350F' } };
      if (colNumber === 9) {
        cell.numFmt = '#,##0.00';
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
      } else {
        cell.alignment = { vertical: 'middle', horizontal: colNumber <= 2 ? 'left' : 'center' };
      }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFD97706' } },
        bottom: { style: 'double', color: { argb: 'FFD97706' } }
      };
    });

    // Configurar anchos de columna
    ws.getColumn(1).width = 6;   // #
    ws.getColumn(2).width = 30;  // Certificado
    ws.getColumn(3).width = 40;  // Inversionista
    ws.getColumn(4).width = 10;  // Tipo Doc
    ws.getColumn(5).width = 16;  // Nro Doc
    ws.getColumn(6).width = 12;  // Banco
    ws.getColumn(7).width = 10;  // Tipo Cta
    ws.getColumn(8).width = 24;  // Cta / CCI
    ws.getColumn(9).width = 18;  // Monto
    ws.getColumn(10).width = 6;  // IDC
    ws.getColumn(11).width = 10; // Tipo Op
    ws.getColumn(12).width = 125;// TRAMA TXT 120
  }

  const reportsDir = path.join(process.cwd(), 'reports');
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });

  const finalExcelPath = path.join(reportsDir, 'AUDITORIA_LOTES_TELECREDITO_BCP_2026-02-28.xlsx');
  await workbook.xlsx.writeFile(finalExcelPath);

  console.log(`\n EXCEL MULTI-PESTAÑA DE AUDITORIA BCP GENERADO CON ÉXITO: ${finalExcelPath}`);
  return finalExcelPath;
}

generateBcpAuditExcel().catch(err => {
  console.error('ERROR:', err);
  process.exit(1);
});
