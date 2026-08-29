import ExcelJS from 'exceljs';
import type { V26FondoReport } from '../services/fondosService';

export interface GenerateValorCuotaExcelParams {
  reports: V26FondoReport[];
  fStart: string;
  fEnd: string;
  selFondo?: string;
  anio?: number;
}

/**
 * Generador Oficial de Excel Maestro para Valor Cuota NAV V27
 * Utiliza ExcelJS para construir la matriz diaria transpuesta completa con formatos contables,
 * columnas de días inmovilizadas y estilos institucionales InAndes.
 */
export async function generateValorCuotaExcelV27(params: GenerateValorCuotaExcelParams): Promise<Blob> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'InAndes ERP - Valor Cuota NAV V27';
  workbook.lastModifiedBy = 'Detective Benoit Blanc';
  workbook.created = new Date();
  workbook.modified = new Date();

  const { reports, fStart, fEnd } = params;

  reports.forEach((fData) => {
    const fid = fData.fondo.id_fondo;
    const fName = fData.fondo.nombre_fondo || fid;
    const moneda = fData.fondo.moneda || (fid.includes('USD') ? 'USD' : 'PEN');

    fData.blocks.forEach((block) => {
      const sheetName = `${fid.slice(0, 10)}_${block.monthName.replace(/\s+/g, '_').slice(0, 18)}`;
      // Limitar a 31 caracteres max para nombres de pestaña en Excel
      const cleanSheetName = sheetName.slice(0, 31);
      
      const ws = workbook.addWorksheet(cleanSheetName, {
        views: [{ state: 'frozen', xSplit: 3, ySplit: 2 }] // Inmovilizar #, Certificado, Tipo y 2 filas de cabecera
      });

      // Agrupación horizontal
      ws.properties.outlineProperties = {
        summaryBelow: false,
        summaryRight: true
      };

      // Fila 1: Banner de Título Institucional
      const titleText = `VALOR CUOTA NAV V27 — ${fName} (${fid}) | PERÍODO: ${block.monthName.toUpperCase()} (${fStart} al ${fEnd}) | MONEDA: ${moneda}`;
      const titleRow = ws.addRow([titleText]);
      titleRow.height = 26;
      titleRow.getCell(1).font = { name: 'Consolas', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      titleRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0284C7' } };
      titleRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

      // Encabezados de Columnas (Fila 2)
      const headers = [
        "#",
        "CERTIFICADO / CONCEPTO",
        "TIPO",
        ...block.days,
        "TOTAL / CIERRE"
      ];

      const headerRow = ws.addRow(headers);
      headerRow.height = 24;

      const dailyStartIndex = 4;
      const dailyEndIndex = dailyStartIndex + block.days.length - 1;
      const totalColIndex = dailyEndIndex + 1;

      // Merge de la fila 1 sobre todas las columnas
      ws.mergeCells(1, 1, 1, totalColIndex);

      headerRow.eachCell((cell, colNumber) => {
        cell.font = { name: 'Consolas', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: colNumber <= 3 ? 'FF0F172A' : (colNumber === totalColIndex ? 'FF1E3A8A' : 'FF334155') }
        };
        cell.alignment = { vertical: 'middle', horizontal: colNumber <= 3 ? 'center' : 'right' };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF334155' } },
          bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
          left: { style: 'thin', color: { argb: 'FF334155' } },
          right: { style: 'thin', color: { argb: 'FF334155' } }
        };
      });

      // Filas de Datos
      block.rows.forEach((r) => {
        if (r.tipo === 'SPACER') {
          const spacerRow = ws.addRow(new Array(totalColIndex).fill(''));
          spacerRow.height = 8;
          spacerRow.eachCell((cell) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
          });
          return;
        }

        const isAumento = r.tipo === 'AUMENTO';
        const isVc = r.is_vc === true || r.id === 'VAL CUOTA INICIAL' || r.id === 'VAL CUOTA FINAL';
        const isTotal = r.tipo === 'TOTAL';
        const numVal = isAumento ? '-' : (r.num || '-');

        const dailyVals = (r.cells || []).map((c: any) => c.val || 0);
        
        // Suma o valor de cierre para la última columna
        let totalVal = 0;
        if (isVc) {
          totalVal = dailyVals.length > 0 ? dailyVals[dailyVals.length - 1] : 1.0;
        } else if (r.id === 'PATRIMONIO TOTAL CIERRE' || r.id === '(=) CAPITAL ACUMULADO' || r.id === '(=) CUOTAS TOTALES CIERRE') {
          totalVal = dailyVals.length > 0 ? dailyVals[dailyVals.length - 1] : 0;
        } else {
          totalVal = dailyVals.reduce((acc: number, v: number) => acc + (Number(v) || 0), 0);
        }

        const rowValues = [
          numVal,
          r.id,
          r.tipo,
          ...dailyVals,
          totalVal
        ];

        const addedRow = ws.addRow(rowValues);
        addedRow.height = isVc ? 22 : (isTotal ? 20 : 18);

        addedRow.eachCell((cell, colNumber) => {
          // Formato y fuentes según tipo de fila
          if (colNumber === 1) {
            cell.font = { name: 'Consolas', size: 9, color: { argb: 'FF64748B' } };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
          } else if (colNumber === 2) {
            cell.font = { 
              name: 'Consolas', 
              size: isTotal ? 9.5 : 9, 
              bold: isTotal || isVc, 
              italic: isAumento,
              color: { argb: isAumento ? 'FF059669' : (isVc ? 'FF1E3A8A' : (isTotal ? 'FF0F172A' : 'FF1E293B')) } 
            };
            cell.alignment = { vertical: 'middle', horizontal: 'left', indent: isAumento ? 1 : 0 };
          } else if (colNumber === 3) {
            cell.font = { name: 'Consolas', size: 8.5, color: { argb: 'FF64748B' } };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
          } else {
            // Celdas numéricas
            if (isVc) {
              cell.numFmt = '0.000000'; // 6 decimales para Valor Cuota
              cell.font = { name: 'Consolas', size: 9.5, bold: true, color: { argb: 'FF1E3A8A' } };
            } else {
              cell.numFmt = '#,##0.00';
              cell.font = { 
                name: 'Consolas', 
                size: 9, 
                bold: isTotal, 
                italic: isAumento,
                color: { argb: isAumento ? 'FF059669' : (isTotal ? 'FF0F172A' : 'FF334155') } 
              };
            }
            cell.alignment = { vertical: 'middle', horizontal: 'right' };
          }

          // Fondos según tipo
          if (isVc) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } }; // Azul claro
          } else if (isAumento) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDF4' } }; // Verde suave
          } else if (isTotal) {
            if (r.id === 'PATRIMONIO TOTAL CIERRE' || r.id === 'GANANCIA OPERATIVA (Neta)') {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFECFDF5' } }; // Verde éxito
            } else if (r.id.includes('COM.') || r.id.includes('(-)') ) {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF1F2' } }; // Rojo suave
            } else {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
            }
          }

          // Bordes
          cell.border = {
            bottom: { style: isVc ? 'medium' : 'thin', color: { argb: isVc ? 'FF2563EB' : 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFF1F5F9' } }
          };
        });
      });

      // Anchos de columna
      ws.getColumn(1).width = 6;   // #
      ws.getColumn(2).width = 36;  // Certificado / Concepto
      ws.getColumn(3).width = 12;  // Tipo
      
      for (let c = dailyStartIndex; c <= dailyEndIndex; c++) {
        ws.getColumn(c).width = 13;
      }
      ws.getColumn(totalColIndex).width = 18; // Total / Cierre
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
