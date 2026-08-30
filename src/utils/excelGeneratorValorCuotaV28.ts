import ExcelJS from 'exceljs';
import type { V26FondoReport } from '../services/fondosService';

export interface VcExcelOptions {
  reports: V26FondoReport[];
  selYear: number;
  fStart: string;
  fEnd: string;
}

/**
 * Generador Oficial de Excel Maestro para Valor Cuota NAV V28
 * Incorpora Goal Seek de Tasa Activa Implícita Mensual (P&L Operativo = 0.00)
 */
export async function generateValorCuotaExcelV28(options: VcExcelOptions): Promise<void> {
  const { reports, selYear, fStart, fEnd } = options;

  if (!reports || reports.length === 0) {
    throw new Error("No hay reportes de Valor Cuota V28 disponibles para exportar.");
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'INANDES GRUPO FINANCIERO';
  workbook.lastModifiedBy = 'InAndes React CRM (Motor NAV V28)';
  workbook.created = new Date();

  for (const report of reports) {
    const fId = (report.fondo.id_fondo || 'FONDO').replace(/[/\\?*:[\]]/g, '_').slice(0, 31);

    // Recopilar todos los días del período
    const allDays: string[] = [];
    for (const block of report.blocks) {
      for (const dayStr of block.days) {
        if (!allDays.includes(dayStr)) {
          allDays.push(dayStr);
        }
      }
    }

    if (allDays.length === 0) continue;

    const ws = workbook.addWorksheet(fId, {
      views: [{ state: 'frozen', xSplit: 2, ySplit: 3 }] // Inmovilizar Columnas A-B y Filas 1-3
    });

    // 1. Fila de Título Institucional
    const titleRow = ws.addRow([
      `FONDO ${report.fondo.nombre_fondo || report.fondo.id_fondo} (${report.fondo.id_fondo}) — MOTOR NAV V28 (P&L = 0)`
    ]);
    titleRow.height = 24;
    titleRow.getCell(1).font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
    titleRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
    titleRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };
    ws.mergeCells(1, 1, 1, allDays.length + 2);

    // 2. Fila de Parámetros del Fondo (Tasa Activa Goal Seek y Comisiones)
    const paramRow = ws.addRow([
      `Período: ${fStart} al ${fEnd} | Tasa Activa Implícita Mes: ${report.vars.activa}% | Com. Admin: ${report.vars.admin}% (Base 365) | P&L = 0.00`
    ]);
    paramRow.height = 20;
    paramRow.getCell(1).font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } };
    paramRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0284C7' } };
    paramRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };
    ws.mergeCells(2, 1, 2, allDays.length + 2);

    // 3. Fila de Encabezados de Columnas
    const headerValues = ['#', 'CERTIFICADO / CONCEPTO', ...allDays];
    const headerRow = ws.addRow(headerValues);
    headerRow.height = 26;

    headerRow.eachCell((cell, colNumber) => {
      cell.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: colNumber <= 2 ? 'FF1E293B' : 'FF334155' }
      };
      cell.alignment = { vertical: 'middle', horizontal: colNumber === 1 ? 'center' : (colNumber === 2 ? 'left' : 'right') };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF0F172A' } },
        bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
        left: { style: 'thin', color: { argb: 'FF0F172A' } },
        right: { style: 'thin', color: { argb: 'FF0F172A' } }
      };
    });

    const sampleBlock = report.blocks[0];
    if (!sampleBlock) continue;

    // 4. Filas de Datos
    for (let rIdx = 0; rIdx < sampleBlock.rows.length; rIdx++) {
      const rowMeta = sampleBlock.rows[rIdx];
      if (rowMeta.tipo === 'SPACER') {
        const spacer = ws.addRow(['', '']);
        spacer.height = 6;
        continue;
      }

      const isAumento = rowMeta.tipo === 'AUMENTO';
      const isTotal = rowMeta.tipo === 'TOTAL';
      const isVc = rowMeta.id.includes('VAL CUOTA');
      const isCapitalApertura = rowMeta.id.includes('TOTAL CAPITAL (Apertura)');
      const isAporte = rowMeta.id.includes('(+) CAPITAL ADICIONAL');
      const isComision = rowMeta.id.includes('COM.') || rowMeta.id.includes('(-)');
      const isPatrimonioCierre = rowMeta.id.includes('PATRIMONIO TOTAL CIERRE');
      const isGananciaOperativa = rowMeta.id.includes('GANANCIA OPERATIVA');

      const numLabel = isAumento ? '' : (rowMeta.num || '');
      const itemLabel = isAumento ? `   ↳ ${rowMeta.id}` : rowMeta.id;
      const rowValues: any[] = [numLabel, itemLabel];

      for (const block of report.blocks) {
        const blockRow = block.rows[rIdx];
        for (let dIdx = 0; dIdx < block.days.length; dIdx++) {
          const cellVal = blockRow?.cells[dIdx]?.val;
          const numericVal = (cellVal === '-' || cellVal === undefined || cellVal === null) ? 0 : Number(cellVal);
          rowValues.push(numericVal);
        }
      }

      const addedRow = ws.addRow(rowValues);
      addedRow.height = isPatrimonioCierre || isVc ? 22 : 19;

      let bgColor = isTotal ? 'FFF8FAFC' : (isAumento ? 'FFF0FDF4' : 'FFFFFFFF');
      let fontColor = 'FF1E293B';
      let isBold = isTotal;

      if (isCapitalApertura) {
        bgColor = 'FFF1F5F9';
        fontColor = 'FF0F172A';
      } else if (isAporte) {
        bgColor = 'FFECFDF5';
        fontColor = 'FF047857';
      } else if (isComision) {
        bgColor = 'FFFEF2F2';
        fontColor = 'FFDC2626';
      } else if (isGananciaOperativa) {
        bgColor = 'FFEFF6FF';
        fontColor = 'FF1D4ED8';
      } else if (isPatrimonioCierre) {
        bgColor = 'FFFEF3C7';
        fontColor = 'FF78350F';
      } else if (isVc) {
        bgColor = 'FFEFF6FF';
        fontColor = 'FF1E3A8A';
      } else if (isAumento) {
        fontColor = 'FF059669';
      }

      addedRow.eachCell((cell, colNumber) => {
        if (colNumber === 1) {
          cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: fontColor } };
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        } else if (colNumber === 2) {
          cell.font = { 
            name: 'Calibri', 
            size: isTotal ? 9.5 : 9, 
            bold: isBold, 
            italic: isAumento, 
            color: { argb: fontColor } 
          };
          cell.alignment = { vertical: 'middle', horizontal: 'left', indent: isAumento ? 1 : 0 };
        } else {
          cell.numFmt = isVc ? '0.000000' : '#,##0.00';
          cell.font = { 
            name: 'Consolas', 
            size: 9, 
            bold: isBold, 
            italic: isAumento, 
            color: { argb: fontColor } 
          };
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
        }

        if (bgColor !== 'FFFFFFFF') {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
        }

        cell.border = {
          top: isPatrimonioCierre ? { style: 'thin', color: { argb: 'FFD97706' } } : { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: isPatrimonioCierre ? { style: 'double', color: { argb: 'FFD97706' } } : { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        };
      });
    }

    // Configurar anchos de columna
    ws.getColumn(1).width = 5;
    ws.getColumn(2).width = 38;
    for (let c = 3; c <= allDays.length + 2; c++) {
      ws.getColumn(c).width = 13.5;
    }
  }

  // Descargar archivo binario Excel
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const nowStamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '_').slice(0, 15);
  a.download = `EXCEL_MAESTRO_VALOR_CUOTA_NAV_V28_${selYear}_${nowStamp}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
