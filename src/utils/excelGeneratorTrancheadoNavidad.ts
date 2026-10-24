import ExcelJS from 'exceljs';
import type { ParticipePrincipalItem } from '../services/estadoPosicionService';

export interface TrancheadoExcelOptions {
  items: ParticipePrincipalItem[];
  tipoCambio: number;
  filtroNombre: string;
}

/**
 * Generador Oficial de Excel para el Trancheado de Inversionistas (Regalos de Navidad)
 * Basado en la posicion patrimonial consolidada por Participe Principal
 */
export async function generateTrancheadoNavidadExcel(options: TrancheadoExcelOptions): Promise<void> {
  const { items, tipoCambio, filtroNombre } = options;

  if (!items || items.length === 0) {
    throw new Error('No hay inversionistas para exportar con el filtro seleccionado.');
  }

  const tc = Number(tipoCambio) > 0 ? Number(tipoCambio) : 3.40;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'INANDES GRUPO FINANCIERO';
  workbook.lastModifiedBy = 'InAndes ERP React - Herramientas Estado de Posicion';
  workbook.created = new Date();

  const ws = workbook.addWorksheet('Trancheado Navidad', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 5 }]
  });

  // 1. Fila de Titulo Principal Institucional
  const titleRow = ws.addRow([
    'INANDES GRUPO FINANCIERO — TRANCHEADO DE INVERSIONISTAS (REGALOS DE NAVIDAD)'
  ]);
  titleRow.height = 26;
  titleRow.getCell(1).font = { name: 'Segoe UI', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
  titleRow.getCell(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E1B4B' } // Deep Indigo Navy
  };
  titleRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  ws.mergeCells(1, 1, 1, 8);

  // 2. Fila de Subtitulo
  const subTitleRow = ws.addRow([
    'Reporte Oficial de Posicion Patrimonial Consolidada por Participe Principal'
  ]);
  subTitleRow.height = 18;
  subTitleRow.getCell(1).font = { name: 'Segoe UI', size: 9.5, italic: true, color: { argb: 'FFFFFFFF' } };
  subTitleRow.getCell(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF312E81' } // Indigo
  };
  subTitleRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  ws.mergeCells(2, 1, 2, 8);

  // 3. Fila de Parametros y Metadatos
  const now = new Date();
  const fechaStr = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  const paramRow = ws.addRow([
    `Tipo de Cambio: S/ ${tc.toFixed(2)}  |  Filtro Aplicado: ${filtroNombre}  |  Fecha de Emision: ${fechaStr}  |  Total Participes: ${items.length}`
  ]);
  paramRow.height = 18;
  paramRow.getCell(1).font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF334155' } };
  paramRow.getCell(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF1F5F9' } // Slate 100
  };
  paramRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  ws.mergeCells(3, 1, 3, 8);

  // 4. Fila Vacia de Separacion
  const emptyRow = ws.addRow([]);
  emptyRow.height = 6;

  // 5. Encabezados de Columnas
  const headerCols = [
    'N°',
    'PARTÍCIPE PRINCIPAL',
    'DOCUMENTO',
    'N° CONTRATOS',
    'TOTAL SOLES (PEN)',
    'TOTAL DÓLARES (USD)',
    'CONSOLIDADO SOLES (PEN)',
    'CONSOLIDADO DÓLARES (USD)'
  ];

  const headerRow = ws.addRow(headerCols);
  headerRow.height = 24;
  headerRow.eachCell((cell, colNum) => {
    cell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4338CA' } // Indigo 700
    };
    cell.alignment = {
      vertical: 'middle',
      horizontal: colNum === 1 || colNum === 3 || colNum === 4 ? 'center' : (colNum >= 5 ? 'right' : 'left'),
      indent: colNum === 2 ? 1 : 0
    };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF6366F1' } },
      bottom: { style: 'medium', color: { argb: 'FF312E81' } },
      left: { style: 'thin', color: { argb: 'FF6366F1' } },
      right: { style: 'thin', color: { argb: 'FF6366F1' } }
    };
  });

  // Acumuladores de Totales
  let totalSoles = 0;
  let totalDolares = 0;
  let totalConsolSoles = 0;
  let totalConsolDolares = 0;

  // 6. Llenado de Filas de Datos
  items.forEach((item, idx) => {
    const rowNum = idx + 1;
    totalSoles += item.saldo_pen;
    totalDolares += item.saldo_usd;
    totalConsolSoles += item.consolidado_pen;
    totalConsolDolares += item.consolidado_usd;

    const dataRow = ws.addRow([
      rowNum,
      item.nombre_completo,
      item.documento_identidad,
      item.contratos_count,
      item.saldo_pen,
      item.saldo_usd,
      item.consolidado_pen,
      item.consolidado_usd
    ]);

    dataRow.height = 20;

    const isEven = idx % 2 === 0;
    const bgArgb = isEven ? 'FFFFFFFF' : 'FFF8FAFC'; // Blanco vs Slate 50

    dataRow.eachCell((cell, colNum) => {
      cell.font = { name: 'Segoe UI', size: 9, color: { argb: 'FF0F172A' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: bgArgb }
      };

      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
      };

      if (colNum === 1 || colNum === 3 || colNum === 4) {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      } else if (colNum === 2) {
        cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
        cell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF1E293B' } };
      } else if (colNum === 5 || colNum === 7) {
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
        cell.numFmt = '"S/ "#,##0.00';
      } else if (colNum === 6 || colNum === 8) {
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
        cell.numFmt = '"$ "#,##0.00';
      }
    });
  });

  // 7. Fila de Totales
  const totalRow = ws.addRow([
    '',
    'TOTAL GENERAL',
    '',
    items.reduce((acc, it) => acc + it.contratos_count, 0),
    totalSoles,
    totalDolares,
    totalConsolSoles,
    totalConsolDolares
  ]);

  totalRow.height = 22;
  totalRow.eachCell((cell, colNum) => {
    cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF0F172A' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE2E8F0' } // Slate 200
    };

    cell.border = {
      top: { style: 'thin', color: { argb: 'FF94A3B8' } },
      bottom: { style: 'double', color: { argb: 'FF0F172A' } },
      left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
    };

    if (colNum === 2) {
      cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    } else if (colNum === 4) {
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    } else if (colNum === 5 || colNum === 7) {
      cell.alignment = { vertical: 'middle', horizontal: 'right' };
      cell.numFmt = '"S/ "#,##0.00';
    } else if (colNum === 6 || colNum === 8) {
      cell.alignment = { vertical: 'middle', horizontal: 'right' };
      cell.numFmt = '"$ "#,##0.00';
    }
  });

  // Configuración de anchos de columnas
  ws.getColumn(1).width = 6;   // N°
  ws.getColumn(2).width = 40;  // Partícipe Principal
  ws.getColumn(3).width = 16;  // Documento
  ws.getColumn(4).width = 14;  // N° Contratos
  ws.getColumn(5).width = 22;  // Total Soles
  ws.getColumn(6).width = 22;  // Total Dólares
  ws.getColumn(7).width = 25;  // Consolidado Soles
  ws.getColumn(8).width = 25;  // Consolidado Dólares

  // Descarga del buffer en navegador
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;

  const cleanFiltro = filtroNombre.replace(/[^a-zA-Z0-9]/g, '_');
  const dateSuffix = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}`;
  a.download = `TRANCHEADO_INVERSIONISTAS_NAVIDAD_TC_${tc.toFixed(2)}_${cleanFiltro}_${dateSuffix}.xlsx`;

  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}
