import ExcelJS from 'exceljs';
import type { ParticipePrincipalItem } from '../services/estadoPosicionService';

export interface TrancheadoExcelOptions {
  items: ParticipePrincipalItem[];
  tipoCambio: number;
  fechaCorte?: string;
  filtroNombre: string;
}

/**
 * Generador Oficial de Excel para el Trancheado de Inversionistas (Regalos de Navidad)
 * Basado en la posicion patrimonial consolidada por Participe Principal
 * Incluye desglose de Capital Inicial de Periodo, Adiciones y Accruals (devengue diario) a la fecha de corte.
 */
export async function generateTrancheadoNavidadExcel(options: TrancheadoExcelOptions): Promise<void> {
  const { items, tipoCambio, fechaCorte, filtroNombre } = options;

  if (!items || items.length === 0) {
    throw new Error('No hay inversionistas para exportar con el filtro seleccionado.');
  }

  const tc = Number(tipoCambio) > 0 ? Number(tipoCambio) : 3.40;
  const fCorteStr = fechaCorte || new Date().toISOString().split('T')[0];

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
  ws.mergeCells(1, 1, 1, 14);

  // 2. Fila de Subtitulo
  const subTitleRow = ws.addRow([
    'Reporte Oficial de Posicion Patrimonial Consolidada por Participe Principal (Capital Inicial + Adiciones + Accruals)'
  ]);
  subTitleRow.height = 18;
  subTitleRow.getCell(1).font = { name: 'Segoe UI', size: 9.5, italic: true, color: { argb: 'FFFFFFFF' } };
  subTitleRow.getCell(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF312E81' } // Indigo
  };
  subTitleRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  ws.mergeCells(2, 1, 2, 14);

  // 3. Fila de Parametros y Metadatos
  const now = new Date();
  const fechaStr = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  const paramRow = ws.addRow([
    `Fecha de Corte: ${fCorteStr}  |  Tipo de Cambio: S/ ${tc.toFixed(2)}  |  Filtro Aplicado: ${filtroNombre}  |  Fecha de Emision: ${fechaStr}  |  Total Participes: ${items.length}`
  ]);
  paramRow.height = 18;
  paramRow.getCell(1).font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF334155' } };
  paramRow.getCell(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF1F5F9' } // Slate 100
  };
  paramRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  ws.mergeCells(3, 1, 3, 14);

  // 4. Fila Vacia de Separacion
  const emptyRow = ws.addRow([]);
  emptyRow.height = 6;

  // 5. Encabezados de Columnas
  const headerCols = [
    'N°',
    'PARTICIPE PRINCIPAL',
    'DOCUMENTO',
    'N° CONTRATOS',
    'CAP. INICIAL (PEN)',
    'ADICIONES (PEN)',
    'ACCRUALS (PEN)',
    'TOTAL POSICION (PEN)',
    'CAP. INICIAL (USD)',
    'ADICIONES (USD)',
    'ACCRUALS (USD)',
    'TOTAL POSICION (USD)',
    'CONSOLIDADO SOLES (PEN)',
    'CONSOLIDADO DOLARES (USD)'
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
  let totCapIniPen = 0;
  let totAdicPen = 0;
  let totAccrualsPen = 0;
  let totPosPen = 0;

  let totCapIniUsd = 0;
  let totAdicUsd = 0;
  let totAccrualsUsd = 0;
  let totPosUsd = 0;

  let totConsolSoles = 0;
  let totConsolDolares = 0;

  // 6. Llenado de Filas de Datos
  items.forEach((item, idx) => {
    const rowNum = idx + 1;
    totCapIniPen += item.cap_inicial_pen;
    totAdicPen += item.adiciones_pen;
    totAccrualsPen += item.accruals_pen;
    totPosPen += item.total_posicion_pen;

    totCapIniUsd += item.cap_inicial_usd;
    totAdicUsd += item.adiciones_usd;
    totAccrualsUsd += item.accruals_usd;
    totPosUsd += item.total_posicion_usd;

    totConsolSoles += item.consolidado_pen;
    totConsolDolares += item.consolidado_usd;

    const dataRow = ws.addRow([
      rowNum,
      item.nombre_completo,
      item.documento_identidad,
      item.contratos_count,
      item.cap_inicial_pen,
      item.adiciones_pen,
      item.accruals_pen,
      item.total_posicion_pen,
      item.cap_inicial_usd,
      item.adiciones_usd,
      item.accruals_usd,
      item.total_posicion_usd,
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
      } else if ((colNum >= 5 && colNum <= 8) || colNum === 13) {
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
        cell.numFmt = '"S/ "#,##0.00';
      } else if ((colNum >= 9 && colNum <= 12) || colNum === 14) {
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
    totCapIniPen,
    totAdicPen,
    totAccrualsPen,
    totPosPen,
    totCapIniUsd,
    totAdicUsd,
    totAccrualsUsd,
    totPosUsd,
    totConsolSoles,
    totConsolDolares
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
    } else if ((colNum >= 5 && colNum <= 8) || colNum === 13) {
      cell.alignment = { vertical: 'middle', horizontal: 'right' };
      cell.numFmt = '"S/ "#,##0.00';
    } else if ((colNum >= 9 && colNum <= 12) || colNum === 14) {
      cell.alignment = { vertical: 'middle', horizontal: 'right' };
      cell.numFmt = '"$ "#,##0.00';
    }
  });

  // Configuracion de anchos de columnas
  ws.getColumn(1).width = 6;   // N°
  ws.getColumn(2).width = 38;  // Partícipe Principal
  ws.getColumn(3).width = 15;  // Documento
  ws.getColumn(4).width = 13;  // N° Contratos
  ws.getColumn(5).width = 20;  // Cap. Inicial PEN
  ws.getColumn(6).width = 18;  // Adiciones PEN
  ws.getColumn(7).width = 18;  // Accruals PEN
  ws.getColumn(8).width = 22;  // Total Posición PEN
  ws.getColumn(9).width = 20;  // Cap. Inicial USD
  ws.getColumn(10).width = 18; // Adiciones USD
  ws.getColumn(11).width = 18; // Accruals USD
  ws.getColumn(12).width = 22; // Total Posición USD
  ws.getColumn(13).width = 25; // Consolidado Soles
  ws.getColumn(14).width = 25; // Consolidado Dólares

  // Descarga del buffer en navegador
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;

  const cleanFiltro = filtroNombre.replace(/[^a-zA-Z0-9]/g, '_');
  const dateSuffix = fCorteStr.replace(/-/g, '');
  a.download = `TRANCHEADO_INVERSIONISTAS_NAVIDAD_TC_${tc.toFixed(2)}_${cleanFiltro}_${dateSuffix}.xlsx`;

  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}
