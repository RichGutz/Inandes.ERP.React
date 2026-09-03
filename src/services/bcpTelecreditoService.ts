// src/services/bcpTelecreditoService.ts
import ExcelJS from 'exceljs';

export interface BcpTransferItem {
  nOrden: number;
  idContrato: string;
  inversionistaId: string;
  inversionistaNombre: string;
  tipoDoc: string; // 'DNI', 'RUC', 'CE', 'PASAPORTE'
  numDoc: string;
  banco: string;
  numeroCuenta: string;
  cci: string;
  montoTransferencia: number;
  moneda: 'PEN' | 'USD';
  fondoId?: string;
  estadoCuenta: 'BCP' | 'INTERBANCARIO' | 'SIN_CUENTA';
  // Campos especiales para auditoría de Renovaciones (#0XX) y Diferencial de Capital
  tipoLiquidacion?: 'RENDIMIENTO_REGULAR' | 'ROLLOVER_TOTAL' | 'ROLLOVER_PARCIAL' | 'EXTINCION_TOTAL';
  comentarioRollover?: string;
  capitalAnterior?: number;
  capitalNuevo?: number;
  diferencialCapital?: number;
  interesNeto?: number;
}

export interface BcpBatchConfig {
  fechaProceso: string; // 'YYYY-MM-DD' o 'YYYYMMDD'
  tipoCuentaOrigen: 'CCT' | 'SCA' | 'DET';
  moneda: 'PEN' | 'USD';
  numeroCuentaOrigen: string;
  referenciaLote: string;
  validacionIdc?: 'S' | 'N';
}

export interface BcpGeneratedFile {
  filename: string;
  content: string;
  totalRegistros: number;
  montoTotal: number;
  totalBcp: number;
  totalCci: number;
  totalSinCuenta: number;
  items: BcpTransferItem[];
}

/**
 * Remueve tildes, diacríticos y caracteres no ASCII para cumplimiento bancario estricto.
 */
export const sanitizeTextForBcp = (text: string, maxLength: number): string => {
  if (!text) return ''.padEnd(maxLength, ' ');
  const normalized = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Quitar tildes
    .replace(/[Ññ]/g, 'N')           // Normalizar Ñ
    .replace(/[^a-zA-Z0-9\s.-]/g, '')// Solo alfanuméricos y espacios
    .toUpperCase()
    .trim();

  return normalized.slice(0, maxLength).padEnd(maxLength, ' ');
};

/**
 * Formatea un número a formato de 15 dígitos con 2 decimales implícitos (ceros a la izquierda).
 */
export const formatAmountForBcp = (amount: number): string => {
  const cleanAmount = Math.max(0, Math.round(amount * 100)); // En centavos
  return String(cleanAmount).padStart(15, '0');
};

/**
 * Mapea el tipo de documento del ERP al código oficial BCP (1 char):
 * 1 = DNI, 6 = RUC, 4 = Carnet de Extranjería, 7 = Pasaporte
 */
export const mapDocTypeToBcp = (tipoDoc: string, numDoc: string): string => {
  const cleanType = (tipoDoc || '').toUpperCase().trim();
  const cleanNum = (numDoc || '').replace(/\D/g, '');

  if (cleanType.includes('RUC') || cleanNum.length === 11) return '6';
  if (cleanType.includes('CE') || cleanType.includes('EXTRANJER')) return '4';
  if (cleanType.includes('PASAPORTE')) return '7';
  return '1';
};

/**
 * Genera el string plano en formato Telecrédito BCP (Abonos Masivos a Terceros).
 */
export const generateBcpTelecreditoTxt = (
  config: BcpBatchConfig,
  items: BcpTransferItem[]
): BcpGeneratedFile => {
  const validItems = items.filter(it => it.montoTransferencia > 0.00);

  const cleanFecha = config.fechaProceso.replace(/\D/g, '').slice(0, 8) || 
    new Date().toISOString().slice(0, 10).replace(/-/g, '');

  const codMoneda = config.moneda === 'USD' ? '1001' : '0001';
  const ctaOrigen = (config.numeroCuentaOrigen || '19300000000000').slice(0, 20).padEnd(20, ' ');
  const refLote = sanitizeTextForBcp(config.referenciaLote || `LOTE-${config.moneda}-${cleanFecha}`, 40);

  const totalAbonos = validItems.length;
  const montoTotal = validItems.reduce((sum, it) => sum + it.montoTransferencia, 0);

  // 1. Cabecera 'C'
  const headerLine = [
    'C',
    String(totalAbonos).padStart(6, '0'),
    cleanFecha,
    (config.tipoCuentaOrigen || 'CCT').slice(0, 3).padEnd(3, ' '),
    codMoneda,
    ctaOrigen,
    formatAmountForBcp(montoTotal),
    refLote
  ].join('');

  // 2. Detalle 'A'
  let totalBcp = 0;
  let totalCci = 0;
  let totalSinCuenta = 0;

  const detailLines: string[] = [];

  for (const it of validItems) {
    const isBcp = (it.banco || '').toUpperCase().includes('BCP') && Boolean(it.numeroCuenta);
    const hasCci = Boolean(it.cci && it.cci.replace(/\D/g, '').length === 20);

    let tipoCtaDestino = 'CCT';
    let nroCtaDestino = '';

    if (isBcp && it.numeroCuenta) {
      nroCtaDestino = it.numeroCuenta.replace(/\D/g, '').slice(0, 20);
      tipoCtaDestino = nroCtaDestino.startsWith('191') ? 'CCT' : 'SCA';
      totalBcp++;
    } else if (hasCci) {
      nroCtaDestino = it.cci.replace(/\D/g, '').slice(0, 20);
      tipoCtaDestino = 'CND';
      totalCci++;
    } else if (it.numeroCuenta) {
      nroCtaDestino = it.numeroCuenta.replace(/\D/g, '').slice(0, 20);
      totalBcp++;
    } else {
      nroCtaDestino = '00000000000000';
      totalSinCuenta++;
    }

    const ctaDestinoPadded = nroCtaDestino.padEnd(20, ' ');
    const codDoc = mapDocTypeToBcp(it.tipoDoc, it.numDoc);
    const nroDocPadded = (it.numDoc || '').replace(/\D/g, '').slice(0, 15).padEnd(15, ' ');
    const nombrePadded = sanitizeTextForBcp(it.inversionistaNombre, 40);
    const montoFormatted = formatAmountForBcp(it.montoTransferencia);
    const valIdc = config.validacionIdc || 'S';
    const tipoOp = '0000';
    const refCertPadded = sanitizeTextForBcp(it.idContrato, 20);

    const line = [
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

    detailLines.push(line);
  }

  const fullContent = [headerLine, ...detailLines].join('\r\n');
  const filename = `BCP_TELECREDITO_${config.moneda}_${cleanFecha}_${refLote.trim().replace(/\s+/g, '_')}.txt`;

  return {
    filename,
    content: fullContent,
    totalRegistros: validItems.length,
    montoTotal,
    totalBcp,
    totalCci,
    totalSinCuenta,
    items: validItems
  };
};

/**
 * Genera un libro Excel profesional con 1 pestaña por cada Fondo, conteniendo
 * la cabecera BCP, la tabla visual y la columna con la trama plana de 120 caracteres.
 */
export const generateBcpTelecreditoExcel = async (
  config: BcpBatchConfig,
  items: BcpTransferItem[]
): Promise<void> => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'INANDES GRUPO FINANCIERO';
  workbook.lastModifiedBy = 'InAndes React CRM';
  workbook.created = new Date();

  // Agrupar items por fondo
  const fundsMap: Record<string, BcpTransferItem[]> = {};
  for (const it of items) {
    const fId = it.fondoId || (it.idContrato.includes('-') ? it.idContrato.split('-')[0] : 'FONDO');
    if (!fundsMap[fId]) fundsMap[fId] = [];
    fundsMap[fId].push(it);
  }

  const cleanFecha = config.fechaProceso.replace(/\D/g, '').slice(0, 8) || 
    new Date().toISOString().slice(0, 10).replace(/-/g, '');

  for (const [fondoId, fondoItems] of Object.entries(fundsMap)) {
    const validItems = fondoItems.filter(it => it.montoTransferencia > 0.00);
    if (validItems.length === 0) continue;

    const ws = workbook.addWorksheet(`BCP_${fondoId.slice(0, 24)}`, {
      views: [{ state: 'frozen', xSplit: 2, ySplit: 5 }]
    });

    const moneda = validItems[0]?.moneda || config.moneda || 'PEN';
    const codMoneda = moneda === 'USD' ? '1001' : '0001';
    const ctaOrigen = (config.numeroCuentaOrigen || '19300000000000').slice(0, 20).padEnd(20, ' ');
    const refLote = sanitizeTextForBcp(`LOTE-${fondoId}-${cleanFecha}`, 40);
    const totalAbonos = validItems.length;
    const montoTotal = validItems.reduce((sum, it) => sum + it.montoTransferencia, 0);

    const headerTrama = [
      'C',
      String(totalAbonos).padStart(6, '0'),
      cleanFecha,
      (config.tipoCuentaOrigen || 'CCT').slice(0, 3).padEnd(3, ' '),
      codMoneda,
      ctaOrigen,
      formatAmountForBcp(montoTotal),
      refLote
    ].join('');

    // Fila 1: Título
    const r1 = ws.addRow(['INANDES GRUPO FINANCIERO — LOTE TELECRÉDITO BCP (ABONOS MASIVOS)']);
    r1.height = 24;
    r1.getCell(1).font = { name: 'Consolas', size: 12, bold: true, color: { argb: 'FF1E1B4B' } };

    // Fila 2: Subtítulo
    const r2 = ws.addRow([`FONDO: ${fondoId} (${moneda})  |  FECHA PROCESO: ${cleanFecha}  |  TOTAL ABONOS: ${totalAbonos}  |  MONTO TOTAL: ${moneda === 'USD' ? '$' : 'S/'} ${montoTotal.toLocaleString('es-PE', { minimumFractionDigits: 2 })}`]);
    r2.height = 18;
    r2.getCell(1).font = { name: 'Consolas', size: 9.5, bold: true, color: { argb: 'FF4338CA' } };

    ws.addRow([]);

    // Fila 4: Cabecera 'C'
    const r4 = ws.addRow([
      'CABECERA (Reg C):',
      headerTrama,
      '', '', '', '', '', '', '', '', '', '',
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
      'Comentarios de Rollover / Liquidación',
      'TRAMA_TXT_BCP_120_CHARS'
    ];

    const hRow = ws.addRow(detailHeaders);
    hRow.height = 26;
    hRow.eachCell((cell, colNumber) => {
      cell.font = { name: 'Consolas', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: colNumber === 13 ? 'FF312E81' : (colNumber === 12 ? 'FF1E1B4B' : (colNumber <= 2 ? 'FF0F172A' : 'FF1E293B')) }
      };
      cell.alignment = { vertical: 'middle', horizontal: colNumber === 9 ? 'right' : (colNumber === 1 || colNumber === 4 || colNumber === 7 || colNumber === 10 ? 'center' : 'left') };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF334155' } },
        bottom: { style: 'medium', color: { argb: 'FF0F172A' } }
      };
    });

    let nOrden = 1;
    for (const it of validItems) {
      const isBcp = (it.banco || '').toUpperCase().includes('BCP') && Boolean(it.numeroCuenta);
      const hasCci = Boolean(it.cci && it.cci.replace(/\D/g, '').length === 20);

      let tipoCtaDestino = 'CCT';
      let nroCtaDestino = '';

      if (isBcp && it.numeroCuenta) {
        nroCtaDestino = it.numeroCuenta.replace(/\D/g, '').slice(0, 20);
        tipoCtaDestino = nroCtaDestino.startsWith('191') ? 'CCT' : 'SCA';
      } else if (hasCci) {
        nroCtaDestino = it.cci.replace(/\D/g, '').slice(0, 20);
        tipoCtaDestino = 'CND';
      } else if (it.numeroCuenta) {
        nroCtaDestino = it.numeroCuenta.replace(/\D/g, '').slice(0, 20);
      } else {
        nroCtaDestino = '00000000000000';
      }

      const ctaDestinoPadded = nroCtaDestino.padEnd(20, ' ');
      const codDoc = mapDocTypeToBcp(it.tipoDoc, it.numDoc);
      const nroDocPadded = (it.numDoc || '').replace(/\D/g, '').slice(0, 15).padEnd(15, ' ');
      const nombrePadded = sanitizeTextForBcp(it.inversionistaNombre, 40);
      const montoFormatted = formatAmountForBcp(it.montoTransferencia);
      const valIdc = config.validacionIdc || 'S';
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

      const comentarioText = it.comentarioRollover || 'Liquidación Regular de Rendimientos';

      const rowVals = [
        nOrden++,
        it.idContrato,
        it.inversionistaNombre,
        codDoc === '1' ? 'DNI' : (codDoc === '6' ? 'RUC' : 'CE'),
        it.numDoc,
        it.banco || (isBcp ? 'BCP' : 'OTRO'),
        tipoCtaDestino,
        nroCtaDestino,
        it.montoTransferencia,
        valIdc,
        tipoOp,
        comentarioText,
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
          const isRollover = it.tipoLiquidacion === 'ROLLOVER_TOTAL' || it.tipoLiquidacion === 'ROLLOVER_PARCIAL';
          const isExtincion = it.tipoLiquidacion === 'EXTINCION_TOTAL';
          cell.font = { 
            name: 'Consolas', 
            size: 9, 
            bold: isRollover || isExtincion,
            color: { argb: isRollover ? 'FF4338CA' : (isExtincion ? 'FFB45309' : 'FF475569') } 
          };
          cell.alignment = { vertical: 'middle', horizontal: 'left' };
          if (isRollover) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF2FF' } };
          } else if (isExtincion) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
          }
        } else if (colNumber === 13) {
          cell.font = { name: 'Consolas', size: 8.5, color: { argb: 'FF4338CA' } };
          cell.alignment = { vertical: 'middle', horizontal: 'left' };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
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
      `${fondoId} (${moneda})`,
      `${totalAbonos} Abonos Programados`,
      '', '', '', '', '',
      montoTotal,
      '', '', '',
      `Suma Total: ${moneda === 'USD' ? '$' : 'S/'} ${montoTotal.toLocaleString('es-PE', { minimumFractionDigits: 2 })}`
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

    ws.getColumn(1).width = 6;
    ws.getColumn(2).width = 30;
    ws.getColumn(3).width = 40;
    ws.getColumn(4).width = 10;
    ws.getColumn(5).width = 16;
    ws.getColumn(6).width = 12;
    ws.getColumn(7).width = 10;
    ws.getColumn(8).width = 24;
    ws.getColumn(9).width = 18;
    ws.getColumn(10).width = 6;
    ws.getColumn(11).width = 10;
    ws.getColumn(12).width = 65; // Comentarios de Rollover / Liquidación
    ws.getColumn(13).width = 125; // Trama TXT
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `AUDITORIA_LOTES_TELECREDITO_BCP_${cleanFecha}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
};

/**
 * Descarga el archivo de texto plano en el navegador del usuario.
 */
export const downloadBcpTxtFile = (filename: string, content: string): void => {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
};
