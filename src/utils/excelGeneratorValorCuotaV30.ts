import ExcelJS from 'exceljs';
import type { V26FondoReport } from '../services/fondosService';

export interface VcExcelOptions {
  reports: V26FondoReport[];
  selYear: number;
  fStart: string;
  fEnd: string;
}

/**
 * Generador Oficial de Excel Maestro para Valor Cuota NAV V30
 * Incorpora Identidad Cero P&L Diario y Mensual (Ganancia Operativa = $ 0.00)
 */
export async function generateValorCuotaExcelV30(options: VcExcelOptions): Promise<void> {
  const { reports, selYear, fStart, fEnd } = options;

  if (!reports || reports.length === 0) {
    throw new Error("No hay reportes de Valor Cuota V30 disponibles para exportar.");
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'INANDES GRUPO FINANCIERO';
  workbook.lastModifiedBy = 'InAndes React CRM (Motor NAV V30)';
  workbook.created = new Date();

  for (const report of reports) {
    const fId = (report.fondo.id_fondo || 'FONDO').replace(/[/\\?*:[\]]/g, '_').slice(0, 31);

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
      views: [{ state: 'frozen', xSplit: 2, ySplit: 3 }]
    });

    // 1. Fila de Título Institucional
    const titleRow = ws.addRow([
      `FONDO ${report.fondo.nombre_fondo || report.fondo.id_fondo} (${report.fondo.id_fondo}) — MOTOR NAV V30 (P&L = 0.00 IDENTIDAD CERO)`
    ]);
    titleRow.height = 24;
    titleRow.getCell(1).font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    titleRow.getCell(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0F172A' } // Dark Navy
    };
    titleRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    ws.mergeCells(1, 1, 1, allDays.length + 3);

    // 2. Fila de Subtítulo con Parámetros
    const pMiscPct = ((Number(report.fondo.comision_miscelaneos_fondo) || 0)).toFixed(2);
    const subTitleRow = ws.addRow([
      `Período: ${fStart} al ${fEnd} | Tasa Activa Implícita Mes: ${report.vars.activa}% (Base 365) | Com. Admin: ${report.vars.admin}% | Com. Captación: 2.00% | Com. Misc: ${pMiscPct}% | P&L = 0.00`
    ]);
    subTitleRow.height = 18;
    subTitleRow.getCell(1).font = { name: 'Segoe UI', size: 8.5, italic: true, color: { argb: 'FF334155' } };
    subTitleRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    ws.mergeCells(2, 1, 2, allDays.length + 3);

    // 3. Fila de Cabeceras
    const headerCols = ['#', 'CERTIFICADO / CONCEPTO', ...allDays, 'TOTAL ACUM'];
    const headerRow = ws.addRow(headerCols);
    headerRow.height = 22;
    headerRow.eachCell((cell) => {
      cell.font = { name: 'Segoe UI', size: 8, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1E293B' }
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF475569' } },
        left: { style: 'thin', color: { argb: 'FF475569' } },
        bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
        right: { style: 'thin', color: { argb: 'FF475569' } }
      };
    });

    // 4. Filas de Datos
    const primaryBlock = report.blocks[0];
    if (!primaryBlock) continue;

    for (let rIdx = 0; rIdx < primaryBlock.rows.length; rIdx++) {
      const sampleRow = primaryBlock.rows[rIdx];

      if (sampleRow.tipo === 'SPACER') {
        const spRow = ws.addRow([]);
        spRow.height = 6;
        continue;
      }

      const isAumento = sampleRow.id && sampleRow.id.includes('Aumento');
      const isTotal = sampleRow.tipo === 'TOTAL';
      const isVc = sampleRow.is_vc || sampleRow.id.includes('VAL CUOTA');
      const isGananciaOp = sampleRow.id === 'GANANCIA OPERATIVA (Neta)';
      const isTotalApertura = sampleRow.id === 'TOTAL CAPITAL (Apertura)' || sampleRow.id === 'CUOTAS APERTURA' || sampleRow.id === 'PATRIMONIO TOTAL (Pre-Aportes)';

      const dailyValues: (number | string)[] = [];
      let sumHoriz = 0;
      let lastVal = 0;

      for (const block of report.blocks) {
        const matchingRow = block.rows[rIdx];
        if (matchingRow && matchingRow.cells) {
          for (const cellVal of matchingRow.cells) {
            const rawVal = (typeof cellVal === 'object' && cellVal !== null && 'val' in cellVal) ? (cellVal as any).val : cellVal;
            const numVal = parseFloat(String(rawVal).replace(/,/g, '').replace('$', '').trim());
            if (!isNaN(numVal)) {
              dailyValues.push(numVal);
              sumHoriz += numVal;
              lastVal = numVal;
            } else {
              dailyValues.push(String(rawVal));
            }
          }
        }
      }

      let totalHoriz: any = '-';
      if (!isVc && !isTotalApertura) {
        totalHoriz = isGananciaOp ? 0.00 : sumHoriz;
      } else if (isTotalApertura) {
        totalHoriz = '-';
      } else if (isVc) {
        totalHoriz = lastVal || 1.0;
      }

      const rowValues = [
        sampleRow.num || '',
        isAumento ? `   ↳ ${sampleRow.id}` : sampleRow.id,
        ...dailyValues,
        totalHoriz
      ];

      const row = ws.addRow(rowValues);
      row.height = isAumento ? 15 : (isTotal ? 19 : 15);

      row.eachCell((cell, colNumber) => {
        cell.font = { name: 'Segoe UI', size: 8 };

        if (colNumber === 1) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.font = { name: 'Segoe UI', size: 7.5, color: { argb: 'FF64748B' } };
        } else if (colNumber === 2) {
          cell.alignment = { vertical: 'middle', horizontal: 'left' };
          if (isAumento) {
            cell.font = { name: 'Segoe UI', size: 7.5, italic: true, color: { argb: 'FF059669' } };
          } else if (isTotal) {
            cell.font = { name: 'Segoe UI', size: 8, bold: true, color: { argb: 'FF0F172A' } };
          } else {
            cell.font = { name: 'Segoe UI', size: 8, bold: true, color: { argb: 'FF1E293B' } };
          }
        } else {
          cell.alignment = { vertical: 'middle', horizontal: 'right' };

          if (isVc) {
            cell.numFmt = '0.000000';
            cell.font = { name: 'Segoe UI', size: 8, bold: true, color: { argb: 'FF1D4ED8' } };
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFF1F5F9' }
            };
          } else if (isGananciaOp) {
            cell.numFmt = '$#,##0.00;($#,##0.00);"$ 0.00"';
            cell.font = { name: 'Segoe UI', size: 8, bold: true, color: { argb: 'FF059669' } };
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFF0FDF4' }
            };
          } else if (typeof cell.value === 'number') {
            cell.numFmt = '#,##0.00';
            if (isAumento) {
              cell.font = { name: 'Segoe UI', size: 7.5, italic: true, color: { argb: 'FF059669' } };
            } else if (isTotal) {
              cell.font = { name: 'Segoe UI', size: 8, bold: true };
            }
          }

          if (isTotal) {
            if (sampleRow.id === 'TOTAL CAPITAL (Apertura)' || sampleRow.id === 'PATRIMONIO TOTAL CIERRE') {
              cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFE2E8F0' }
              };
              cell.border = {
                top: { style: 'thin', color: { argb: 'FF94A3B8' } },
                bottom: { style: 'double', color: { argb: 'FF0F172A' } }
              };
            }
          }
        }
      });
    }

    ws.getColumn(1).width = 4.5;
    ws.getColumn(2).width = 28;
    for (let c = 3; c <= headerCols.length; c++) {
      ws.getColumn(c).width = 11;
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const now = new Date();
  const timeStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
  a.download = `EXCEL_MAESTRO_VALOR_CUOTA_NAV_V30_${selYear}_${timeStr}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}
