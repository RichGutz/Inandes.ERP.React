import React, { useState, useEffect, useMemo } from 'react';
import { 
  getAsesores, calculateComisionesAnuales, PERIODOS_CANONICOS 
} from '../../services/comisionesService';
import type { 
  AsesorComercial, PeriodoComisionGroup 
} from '../../services/comisionesService';
import { downloadReportPdf } from '../../utils/pdfDownloadHelper';
import ExcelJS from 'exceljs';
import { 
  Loader2, FileSpreadsheet, FileText, ChevronDown, ChevronRight, 
  GripVertical, CheckCircle2, Clock, Users, Briefcase, 
  Calendar, User
} from 'lucide-react';
import { LOGO_INANDES_BASE64 } from '../../assets/base64Images';

export const ComisionesAsesoresTab: React.FC = () => {
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [asesoresList, setAsesoresList] = useState<AsesorComercial[]>([]);
  const [selectedAsesorCodigo, setSelectedAsesorCodigo] = useState<string>('TODOS');
  
  const [loading, setLoading] = useState<boolean>(true);
  const [periodosData, setPeriodosData] = useState<PeriodoComisionGroup[]>([]);
  const [expandedPeriodos, setExpandedPeriodos] = useState<Record<string, boolean>>({
    'B1': true,
    'Q1': true,
    'B2': true,
    'B3_Q2': true
  });

  // Drag & Drop
  const [draggedPeriodId, setDraggedPeriodId] = useState<string | null>(null);
  const [dragOverPeriodId, setDragOverPeriodId] = useState<string | null>(null);
  const [periodOrder, setPeriodOrder] = useState<string[]>(PERIODOS_CANONICOS.map(p => p.id));

  // Export States
  const [exportingExcel, setExportingExcel] = useState<boolean>(false);
  const [exportingPdf, setExportingPdf] = useState<boolean>(false);

  // Cargar lista de asesores
  useEffect(() => {
    const fetchAsesores = async () => {
      try {
        const data = await getAsesores();
        setAsesoresList(data);
      } catch (err: any) {
        console.error('Error cargando asesores:', err);
      }
    };
    fetchAsesores();
  }, []);

  // Cargar cálculo de comisiones
  const loadComisiones = async () => {
    setLoading(true);
    try {
      const data = await calculateComisionesAnuales(selectedYear, selectedAsesorCodigo);
      setPeriodosData(data);
    } catch (err: any) {
      console.error('Error calculando comisiones:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadComisiones();
  }, [selectedYear, selectedAsesorCodigo]);

  // Asesor activo seleccionado
  const selectedAsesorObj = useMemo(() => {
    if (selectedAsesorCodigo === 'TODOS') return null;
    return asesoresList.find(a => a.codigo === selectedAsesorCodigo) || null;
  }, [selectedAsesorCodigo, asesoresList]);

  // Lista ordenada de períodos según drag and drop
  const orderedPeriodos = useMemo(() => {
    const map = new Map(periodosData.map(p => [p.id, p]));
    const result: PeriodoComisionGroup[] = [];
    
    periodOrder.forEach(id => {
      const p = map.get(id);
      if (p) result.push(p);
    });

    // Agregar los que no estén en el orden por si acaso
    periodosData.forEach(p => {
      if (!periodOrder.includes(p.id)) result.push(p);
    });

    return result;
  }, [periodosData, periodOrder]);

  // Totales acumulados anuales
  const totalAnual = useMemo(() => {
    let totalPEN = 0;
    let totalUSD = 0;
    let totalCapPEN = 0;
    let totalCapUSD = 0;
    const uniqueParticipes = new Set<string>();
    let totalContratos = 0;

    periodosData.forEach(p => {
      totalPEN += p.totales.comision_pen;
      totalUSD += p.totales.comision_usd;
      totalCapPEN = Math.max(totalCapPEN, p.totales.capital_pen);
      totalCapUSD = Math.max(totalCapUSD, p.totales.capital_usd);
      totalContratos += p.totales.count_contratos;
      p.participes.forEach(part => uniqueParticipes.add(part.inversionista_nombre));
    });

    return {
      comisionPEN: totalPEN,
      comisionUSD: totalUSD,
      maxCapitalPEN: totalCapPEN,
      maxCapitalUSD: totalCapUSD,
      countParticipes: uniqueParticipes.size,
      countContratos: totalContratos
    };
  }, [periodosData]);

  // Alternar acordeón
  const togglePeriodo = (id: string) => {
    setExpandedPeriodos(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Expandir / Colapsar todos
  const toggleAll = (expand: boolean) => {
    const updated: Record<string, boolean> = {};
    PERIODOS_CANONICOS.forEach(p => {
      updated[p.id] = expand;
    });
    setExpandedPeriodos(updated);
  };

  // Handlers Drag & Drop
  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedPeriodId(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverPeriodId !== id) {
      setDragOverPeriodId(id);
    }
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedPeriodId || draggedPeriodId === targetId) {
      setDraggedPeriodId(null);
      setDragOverPeriodId(null);
      return;
    }

    const newOrder = [...periodOrder];
    const fromIdx = newOrder.indexOf(draggedPeriodId);
    const toIdx = newOrder.indexOf(targetId);

    if (fromIdx !== -1 && toIdx !== -1) {
      newOrder.splice(fromIdx, 1);
      newOrder.splice(toIdx, 0, draggedPeriodId);
      setPeriodOrder(newOrder);
    }

    setDraggedPeriodId(null);
    setDragOverPeriodId(null);
  };

  // ==========================================
  // EXPORTADOR A EXCEL MAESTRO CON FÓRMULAS
  // ==========================================
  const handleExportExcel = async () => {
    setExportingExcel(true);
    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'InAndes ERP React';
      workbook.created = new Date();

      const asesorName = selectedAsesorObj ? selectedAsesorObj.nombre_completo : 'TODOS_LOS_ASESORES';

      // Hoja 1: Resumen General
      const sheetSummary = workbook.addWorksheet('Resumen Comisiones');
      sheetSummary.views = [{ showGridLines: true }];

      sheetSummary.addRow(['INANDES GRUPO FINANCIERO - LIQUIDACIÓN DE COMISIONES COMERCIALES']);
      sheetSummary.addRow([`AÑO: ${selectedYear} | ASESOR: ${asesorName.toUpperCase()}`]);
      sheetSummary.addRow([`FECHA DE EMISIÓN: ${new Date().toLocaleDateString('es-PE')}`]);
      sheetSummary.addRow([]);

      sheetSummary.addRow([
        'Cód. Período', 'Mes / Ciclo', 'Rango de Fechas', 'Días', 'Estado BD', 
        'Partícipes', 'Contratos', 'Capital PEN', 'Capital USD', 'Comisión PEN', 'Comisión USD'
      ]);

      const headerRow = sheetSummary.getRow(5);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0284C7' } };
      headerRow.alignment = { horizontal: 'center', vertical: 'middle' };

      orderedPeriodos.forEach(p => {
        const row = sheetSummary.addRow([
          p.id,
          p.mes_nombre,
          `${p.fecha_inicio} al ${p.fecha_fin}`,
          p.dias_periodo,
          p.is_cerrado_bd ? 'AUDITADO EN BD' : 'PROYECCIÓN',
          p.totales.count_participes,
          p.totales.count_contratos,
          p.totales.capital_pen,
          p.totales.capital_usd,
          p.totales.comision_pen,
          p.totales.comision_usd
        ]);

        row.getCell(8).numFmt = '#,##0.00';
        row.getCell(9).numFmt = '#,##0.00';
        row.getCell(10).numFmt = '#,##0.00';
        row.getCell(11).numFmt = '#,##0.00';
      });

      // Hoja 2: Detalle Partícipe por Partícipe
      const sheetDetalle = workbook.addWorksheet('Detalle de Partícipes');
      sheetDetalle.views = [{ showGridLines: true }];

      sheetDetalle.addRow(['DETALLE ANALÍTICO DE DETERMINACIÓN DE COMISIONES']);
      sheetDetalle.addRow([`ASESOR: ${asesorName.toUpperCase()} | AÑO ${selectedYear}`]);
      sheetDetalle.addRow([]);

      sheetDetalle.addRow([
        'Período', 'Corte', 'Inversionista / Partícipe', 'DNI / RUC', 'Certificado / Contrato',
        'Fondo', 'Moneda', 'Capital Administrado', 'Días', '% Tasa Com.', 'Fórmula / Determinación', 'Comisión a Pagar'
      ]);

      const detHeader = sheetDetalle.getRow(4);
      detHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      detHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
      detHeader.alignment = { horizontal: 'center', vertical: 'middle' };

      orderedPeriodos.forEach(p => {
        p.participes.forEach(part => {
          const row = sheetDetalle.addRow([
            p.mes_nombre,
            p.corte_str,
            part.inversionista_nombre,
            part.inversionista_dni,
            part.id_certificado,
            part.id_fondo,
            part.moneda,
            part.capital_base,
            part.dias_devengados,
            part.tasa_comision_asesor / 100.0,
            part.determinacion_texto,
            part.comision_calculada
          ]);

          row.getCell(8).numFmt = '#,##0.00';
          row.getCell(10).numFmt = '0.00%';
          row.getCell(12).numFmt = '#,##0.00';
        });
      });

      // Auto ajustar anchos
      [sheetSummary, sheetDetalle].forEach(sheet => {
        sheet.columns.forEach(col => {
          if (col) {
            col.width = 22;
          }
        });
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `COMISIONES_${selectedYear}_${asesorName.replace(/\s+/g, '_')}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`Error exportando a Excel: ${err.message}`);
    } finally {
      setExportingExcel(false);
    }
  };

  // ==========================================
  // EXPORTADOR A PDF OFICIAL
  // ==========================================
  const handleExportPdf = async () => {
    setExportingPdf(true);
    try {
      const asesorName = selectedAsesorObj ? selectedAsesorObj.nombre_completo : 'TODOS LOS ASESORES';
      const asesorDoc = selectedAsesorObj ? `${selectedAsesorObj.tipo_documento_asesor || 'DNI'}: ${selectedAsesorObj.num_documento_asesor || selectedAsesorObj.codigo}` : 'CONSOLIDADO INSTITUCIONAL';

      const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Liquidación de Comisiones</title>
  <style>
    @page { size: A4 landscape; margin: 8mm; }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 8pt; color: #0f172a; margin: 0; padding: 0; }
    .header { width: 100%; border-bottom: 2px solid #0284c7; padding-bottom: 8px; margin-bottom: 12px; }
    .header table { width: 100%; border-collapse: collapse; }
    .logo { height: 35px; }
    .title { font-size: 13pt; font-weight: 900; color: #0f172a; text-transform: uppercase; margin: 0; }
    .subtitle { font-size: 9pt; color: #64748b; font-weight: 600; margin: 2px 0 0 0; }
    .meta-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px 10px; margin-bottom: 12px; }
    .meta-grid { width: 100%; border-collapse: collapse; }
    .meta-grid td { padding: 2px 6px; font-size: 8pt; }
    .period-card { border: 1px solid #cbd5e1; border-radius: 6px; margin-bottom: 12px; page-break-inside: avoid; overflow: hidden; }
    .period-header { background: #f1f5f9; padding: 6px 10px; border-bottom: 1px solid #cbd5e1; font-weight: bold; font-size: 8.5pt; }
    .data-table { width: 100%; border-collapse: collapse; font-size: 7.5pt; }
    .data-table th { background: #e2e8f0; color: #334155; padding: 4px 6px; text-align: left; font-weight: bold; border-bottom: 1px solid #cbd5e1; }
    .data-table td { padding: 4px 6px; border-bottom: 1px solid #f1f5f9; }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .font-bold { font-weight: bold; }
    .formula { font-family: monospace; font-size: 7pt; color: #0369a1; background: #e0f2fe; padding: 1px 4px; border-radius: 3px; }
    .badge { display: inline-block; padding: 1px 5px; border-radius: 4px; font-size: 6.5pt; font-weight: bold; }
    .badge-closed { background: #dcfce7; color: #15803d; }
    .badge-open { background: #fef9c3; color: #854d0e; }
    .totals-row { background: #f8fafc; font-weight: bold; border-top: 1px solid #cbd5e1; }
    .footer { font-size: 7pt; color: #94a3b8; text-align: center; margin-top: 15px; border-top: 1px solid #e2e8f0; padding-top: 6px; }
  </style>
</head>
<body>
  <div class="header">
    <table>
      <tr>
        <td>
          <h1 class="title">INANDES GRUPO FINANCIERO</h1>
          <p class="subtitle">Liquidación y Determinación Oficial de Comisiones Comerciales (Base 365)</p>
        </td>
        <td class="text-right">
          <img src="data:image/png;base64,${LOGO_INANDES_BASE64}" class="logo" />
        </td>
      </tr>
    </table>
  </div>

  <div class="meta-box">
    <table class="meta-grid">
      <tr>
        <td><strong>Asesor Comercial:</strong> ${asesorName}</td>
        <td><strong>Documento / Código:</strong> ${asesorDoc}</td>
        <td><strong>Año Liquidado:</strong> ${selectedYear}</td>
        <td><strong>Fecha Emisión:</strong> ${new Date().toLocaleDateString('es-PE')}</td>
      </tr>
      <tr>
        <td><strong>Total Comisiones PEN:</strong> PEN ${totalAnual.comisionPEN.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</td>
        <td><strong>Total Comisiones USD:</strong> USD ${totalAnual.comisionUSD.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</td>
        <td><strong>Partícipes Únicos:</strong> ${totalAnual.countParticipes} Partícipes</td>
        <td><strong>Contratos Totales:</strong> ${totalAnual.countContratos} Operaciones</td>
      </tr>
    </table>
  </div>

  ${orderedPeriodos.map(p => `
    <div class="period-card">
      <div class="period-header">
        <table style="width: 100%;">
          <tr>
            <td>
              <span>📅 ${p.mes_nombre.toUpperCase()} ${selectedYear} · ${p.ciclo_label}</span>
              <span style="font-size: 7.5pt; color: #64748b; margin-left: 8px;">(${p.fecha_inicio} al ${p.fecha_fin} · ${p.dias_periodo} días)</span>
            </td>
            <td class="text-right">
              <span class="badge ${p.is_cerrado_bd ? 'badge-closed' : 'badge-open'}">
                ${p.is_cerrado_bd ? '✓ AUDITADO EN BD' : '⚡ PROYECCIÓN'}
              </span>
              <span style="margin-left: 10px; font-weight: bold; color: #0284c7;">
                Subtotal: PEN ${p.totales.comision_pen.toLocaleString('es-PE', { minimumFractionDigits: 2 })} │ USD ${p.totales.comision_usd.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
              </span>
            </td>
          </tr>
        </table>
      </div>

      <table class="data-table">
        <thead>
          <tr>
            <th style="width: 25px;">N°</th>
            <th>Inversionista / Partícipe</th>
            <th>Certificado / Contrato</th>
            <th>Fondo</th>
            <th class="text-right">Capital Base</th>
            <th class="text-center">Días</th>
            <th class="text-center">% Com.</th>
            <th>Fórmula de Determinación</th>
            <th class="text-right">Comisión a Pagar</th>
          </tr>
        </thead>
        <tbody>
          ${p.participes.length === 0 ? `
            <tr>
              <td colspan="9" class="text-center" style="color: #94a3b8; padding: 8px;">
                No se registraron operaciones vigentes para el asesor en este período.
              </td>
            </tr>
          ` : p.participes.map((part, idx) => `
            <tr>
              <td class="text-center">${String(idx + 1).padStart(2, '0')}</td>
              <td class="font-bold">${part.inversionista_nombre}</td>
              <td><code>${part.id_certificado}</code></td>
              <td>${part.id_fondo}</td>
              <td class="text-right font-bold">${part.moneda} ${part.capital_base.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</td>
              <td class="text-center">${part.dias_devengados}</td>
              <td class="text-center font-bold">${part.tasa_comision_asesor.toFixed(2)}%</td>
              <td><span class="formula">${part.determinacion_texto}</span></td>
              <td class="text-right font-bold" style="color: #059669;">
                ${part.moneda} ${part.comision_calculada.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
              </td>
            </tr>
          `).join('')}
        </tbody>
        <tfoot>
          <tr class="totals-row">
            <td colspan="4" class="font-bold">TOTALES DEL PERÍODO (${p.participes.length} Operaciones):</td>
            <td class="text-right">
              ${p.totales.capital_pen > 0 ? `PEN ${p.totales.capital_pen.toLocaleString('es-PE', { minimumFractionDigits: 2 })}` : ''}
              ${p.totales.capital_pen > 0 && p.totales.capital_usd > 0 ? ' / ' : ''}
              ${p.totales.capital_usd > 0 ? `USD ${p.totales.capital_usd.toLocaleString('es-PE', { minimumFractionDigits: 2 })}` : ''}
            </td>
            <td colspan="3"></td>
            <td class="text-right" style="color: #059669; font-size: 8pt;">
              ${p.totales.comision_pen > 0 ? `PEN ${p.totales.comision_pen.toLocaleString('es-PE', { minimumFractionDigits: 2 })}` : ''}
              ${p.totales.comision_pen > 0 && p.totales.comision_usd > 0 ? '<br/>' : ''}
              ${p.totales.comision_usd > 0 ? `USD ${p.totales.comision_usd.toLocaleString('es-PE', { minimumFractionDigits: 2 })}` : ''}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  `).join('')}

  <div class="footer">
    <p>INANDES ACTIVOS ALTERNATIVOS SAC │ Los Tulipanes 147 Of. 306, Santiago de Surco, Lima │ Tel: + (511) 7121700 │ info@inandes.com</p>
  </div>
</body>
</html>`;

      await downloadReportPdf(html, `LIQUIDACION_COMISIONES_${selectedYear}_${asesorName.replace(/\s+/g, '_')}`, 'landscape');
    } catch (err: any) {
      alert(`Error descargando PDF: ${err.message}`);
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-fadeIn pb-12">
      
      {/* 1. BARRA SUPERIOR EJECUTIVA */}
      <div className="bg-white dark:bg-[#0f172a] border border-[#e2e8f0] dark:border-[#1e293b] rounded-2xl p-5 shadow-xs flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        
        {/* Título y Selector de Año */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-2xl border border-indigo-100 dark:border-indigo-900/40">
            <Briefcase size={26} />
          </div>
          <div>
            <h2 className="text-lg font-black text-[#0f172a] dark:text-[#f8fafc] tracking-tight uppercase flex items-center gap-2">
              <span>Liquidación de Comisiones</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 font-bold">
                Base 365
              </span>
            </h2>
            <p className="text-xs text-[#64748b] dark:text-[#94a3b8] font-medium">
              Determinación de comisiones de captación por asesor en los 8 períodos canónicos de cierre
            </p>
          </div>

          {/* Selector de Año */}
          <div className="flex items-center gap-1 bg-[#f1f5f9] dark:bg-[#1e293b] p-1 rounded-xl border border-[#e2e8f0] dark:border-[#334155]">
            <button
              onClick={() => setSelectedYear(y => y - 1)}
              className="px-2 py-1 text-xs font-black text-[#475569] dark:text-[#cbd5e1] hover:bg-white dark:hover:bg-[#0f172a] rounded-lg transition-all"
            >
              ◄
            </button>
            <span className="px-3 py-1 text-xs font-black text-[#0f172a] dark:text-[#f8fafc] font-mono">
              {selectedYear}
            </span>
            <button
              onClick={() => setSelectedYear(y => y + 1)}
              className="px-2 py-1 text-xs font-black text-[#475569] dark:text-[#cbd5e1] hover:bg-white dark:hover:bg-[#0f172a] rounded-lg transition-all"
            >
              ►
            </button>
          </div>
        </div>

        {/* Selector de Asesor y Exportadores */}
        <div className="flex items-center gap-3 flex-wrap w-full lg:w-auto justify-end">
          
          {/* Dropdown de Asesores */}
          <div className="relative min-w-[280px]">
            <select
              value={selectedAsesorCodigo}
              onChange={(e) => setSelectedAsesorCodigo(e.target.value)}
              className="w-full bg-[#f8fafc] dark:bg-[#1e293b] border border-[#cbd5e1] dark:border-[#334155] rounded-xl py-2 px-3 text-xs font-bold text-[#0f172a] dark:text-[#f8fafc] focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="TODOS">👥 TODOS LOS ASESORES ({asesoresList.length} Registrados)</option>
              {asesoresList.map(a => (
                <option key={a.codigo} value={a.codigo}>
                  👤 {a.nombre_completo} ({a.codigo})
                </option>
              ))}
            </select>
          </div>

          {/* Botón Excel */}
          <button
            onClick={handleExportExcel}
            disabled={exportingExcel || loading}
            className="h-9 px-4 text-xs font-black uppercase tracking-wider rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {exportingExcel ? <Loader2 size={15} className="animate-spin" /> : <FileSpreadsheet size={15} />}
            <span>Excel Maestro</span>
          </button>

          {/* Botón PDF */}
          <button
            onClick={handleExportPdf}
            disabled={exportingPdf || loading}
            className="h-9 px-4 text-xs font-black uppercase tracking-wider rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {exportingPdf ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />}
            <span>Liquidación PDF</span>
          </button>
        </div>
      </div>

      {/* 2. TARJETAS RESUMEN EJECUTIVAS DEL ASESOR / CONSOLIDADO */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        
        {/* Asesor Activo */}
        <div className="bg-white dark:bg-[#0f172a] border border-[#e2e8f0] dark:border-[#1e293b] rounded-2xl p-4 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wider">
              Asesor Comercial
            </span>
            <User size={16} className="text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="mt-2">
            <div className="text-sm font-black text-[#0f172a] dark:text-[#f8fafc] truncate" title={selectedAsesorObj ? selectedAsesorObj.nombre_completo : 'TODOS LOS ASESORES'}>
              {selectedAsesorObj ? selectedAsesorObj.nombre_completo : 'CONSOLIDADO GENERAL'}
            </div>
            <div className="text-[11px] font-mono text-[#64748b] dark:text-[#94a3b8]">
              {selectedAsesorObj ? `${selectedAsesorObj.codigo} · ${selectedAsesorObj.email || 'Sin correo'}` : `${asesoresList.length} asesores en cartera`}
            </div>
          </div>
        </div>

        {/* Partícipes & Contratos */}
        <div className="bg-white dark:bg-[#0f172a] border border-[#e2e8f0] dark:border-[#1e293b] rounded-2xl p-4 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wider">
              Cartera Administrada
            </span>
            <Users size={16} className="text-sky-600 dark:text-sky-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-black font-mono text-[#0f172a] dark:text-[#f8fafc]">
              {totalAnual.countParticipes}
            </span>
            <span className="text-xs font-medium text-[#64748b] dark:text-[#94a3b8]">
              Partícipes ({totalAnual.countContratos} Operaciones)
            </span>
          </div>
        </div>

        {/* Comisiones Anuales PEN */}
        <div className="bg-white dark:bg-[#0f172a] border border-[#e2e8f0] dark:border-[#1e293b] rounded-2xl p-4 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wider">
              Comisión Anual PEN
            </span>
            <span className="text-xs font-bold font-mono px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
              Soles
            </span>
          </div>
          <div className="mt-2">
            <div className="text-xl font-black font-mono text-emerald-600 dark:text-emerald-400">
              PEN {totalAnual.comisionPEN.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[10.5px] font-medium text-[#64748b] dark:text-[#94a3b8]">
              Cartera máx: PEN {totalAnual.maxCapitalPEN.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        {/* Comisiones Anuales USD */}
        <div className="bg-white dark:bg-[#0f172a] border border-[#e2e8f0] dark:border-[#1e293b] rounded-2xl p-4 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wider">
              Comisión Anual USD
            </span>
            <span className="text-xs font-bold font-mono px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">
              Dólares
            </span>
          </div>
          <div className="mt-2">
            <div className="text-xl font-black font-mono text-sky-600 dark:text-sky-400">
              USD {totalAnual.comisionUSD.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[10.5px] font-medium text-[#64748b] dark:text-[#94a3b8]">
              Cartera máx: USD {totalAnual.maxCapitalUSD.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>
      </div>

      {/* 3. BARRA DE CONTROL DE ACORDEONES */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-indigo-600 dark:text-indigo-400" />
          <span className="text-xs font-black text-[#0f172a] dark:text-[#f8fafc] uppercase tracking-wider">
            8 Períodos Canónicos de Cierre Contable ({selectedYear})
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => toggleAll(true)}
            className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
          >
            Expandir Todos
          </button>
          <span className="text-slate-300 dark:text-slate-700">|</span>
          <button
            onClick={() => toggleAll(false)}
            className="text-[11px] font-bold text-[#64748b] dark:text-[#94a3b8] hover:underline cursor-pointer"
          >
            Colapsar Todos
          </button>
        </div>
      </div>

      {/* 4. LISTA DE ACORDEONES CON DRAG AND DROP */}
      {loading ? (
        <div className="bg-white dark:bg-[#0f172a] border border-[#e2e8f0] dark:border-[#1e293b] rounded-2xl p-12 text-center flex flex-col items-center justify-center gap-3">
          <Loader2 size={32} className="animate-spin text-indigo-600" />
          <p className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wider">
            Calculando liquidación de comisiones...
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3.5">
          {orderedPeriodos.map((periodo) => {
            const isExpanded = !!expandedPeriodos[periodo.id];
            const isDraggingOver = dragOverPeriodId === periodo.id;

            return (
              <div
                key={periodo.id}
                draggable
                onDragStart={(e) => handleDragStart(e, periodo.id)}
                onDragOver={(e) => handleDragOver(e, periodo.id)}
                onDrop={(e) => handleDrop(e, periodo.id)}
                className={`bg-white dark:bg-[#0f172a] border rounded-2xl shadow-xs transition-all overflow-hidden ${
                  isDraggingOver 
                    ? 'border-indigo-500 ring-2 ring-indigo-500/20 scale-[1.005]' 
                    : 'border-[#e2e8f0] dark:border-[#1e293b] hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                {/* CABECERA DEL ACORDEÓN */}
                <div
                  onClick={() => togglePeriodo(periodo.id)}
                  className="p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 cursor-pointer select-none bg-[#f8fafc]/50 dark:bg-[#1e293b]/20 hover:bg-slate-50 dark:hover:bg-[#1e293b]/40 transition-colors"
                >
                  {/* Lado Izquierdo: Grip, Mes, Ciclo y Fechas */}
                  <div className="flex items-center gap-3">
                    <div 
                      className="cursor-grab active:cursor-grabbing p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      title="Arrastrar para reordenar período"
                    >
                      <GripVertical size={18} />
                    </div>

                    <div className="flex items-center gap-2.5">
                      <span className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 font-mono font-black text-xs flex items-center justify-center border border-indigo-100 dark:border-indigo-900/40">
                        {String(periodo.mes_num).padStart(2, '0')}
                      </span>
                      <div>
                        <div className="text-sm font-black text-[#0f172a] dark:text-[#f8fafc] flex items-center gap-2">
                          <span>{periodo.mes_nombre} {selectedYear}</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                            {periodo.ciclo_label}
                          </span>
                        </div>
                        <div className="text-[11px] font-mono text-[#64748b] dark:text-[#94a3b8]">
                          {periodo.fecha_inicio} al {periodo.fecha_fin} · {periodo.dias_periodo} días contables
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Lado Derecho: Badges de Estado y Subtotales */}
                  <div className="flex items-center gap-4 flex-wrap w-full md:w-auto justify-between md:justify-end">
                    
                    {/* Badge de Auditoría en BD */}
                    <div>
                      {periodo.is_cerrado_bd ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10.5px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/40">
                          <CheckCircle2 size={13} />
                          <span>AUDITADO EN BD</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10.5px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-900/40">
                          <Clock size={13} />
                          <span>PROYECCIÓN</span>
                        </span>
                      )}
                    </div>

                    {/* Partícipes Badge */}
                    <div className="text-right">
                      <div className="text-[10px] font-black uppercase text-[#64748b] dark:text-[#94a3b8]">
                        Partícipes
                      </div>
                      <div className="text-xs font-mono font-bold text-[#0f172a] dark:text-[#f8fafc]">
                        {periodo.totales.count_participes} Inversionistas
                      </div>
                    </div>

                    {/* Comisiones Subtotal */}
                    <div className="text-right pl-3 border-l border-slate-200 dark:border-slate-800">
                      <div className="text-[10px] font-black uppercase text-[#64748b] dark:text-[#94a3b8]">
                        Comisión del Período
                      </div>
                      <div className="text-xs font-mono font-black text-emerald-600 dark:text-emerald-400">
                        {periodo.totales.comision_pen > 0 && `PEN ${periodo.totales.comision_pen.toLocaleString('es-PE', { minimumFractionDigits: 2 })}`}
                        {periodo.totales.comision_pen > 0 && periodo.totales.comision_usd > 0 && ' │ '}
                        {periodo.totales.comision_usd > 0 && `USD ${periodo.totales.comision_usd.toLocaleString('es-PE', { minimumFractionDigits: 2 })}`}
                        {periodo.totales.comision_pen === 0 && periodo.totales.comision_usd === 0 && '0.00'}
                      </div>
                    </div>

                    {/* Botón Chevron */}
                    <div className="p-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500">
                      {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </div>
                  </div>
                </div>

                {/* CUERPO DEL ACORDEÓN: TARJETAS DE PARTÍCIPES & FÓRMULAS */}
                {isExpanded && (
                  <div className="p-5 border-t border-[#e2e8f0] dark:border-[#1e293b] bg-white dark:bg-[#0f172a] flex flex-col gap-3">
                    
                    {periodo.participes.length === 0 ? (
                      <div className="p-8 text-center text-slate-400 text-xs font-medium italic bg-slate-50 dark:bg-slate-900/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                        No existen operaciones ni contratos vigentes para el asesor seleccionado en este período.
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-1 gap-2.5">
                          {periodo.participes.map((part, pIdx) => (
                            <div 
                              key={`${part.id_contrato}_${pIdx}`}
                              className="bg-[#f8fafc] dark:bg-[#1e293b]/40 border border-[#e2e8f0] dark:border-[#334155] rounded-xl p-3.5 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 hover:border-indigo-200 dark:hover:border-indigo-900/50 transition-colors"
                            >
                              {/* Inversionista y Certificado */}
                              <div className="flex items-center gap-3 min-w-[280px]">
                                <span className="text-[10.5px] font-mono font-bold text-slate-400">
                                  {String(pIdx + 1).padStart(2, '0')}
                                </span>
                                <div>
                                  <div className="text-xs font-black text-[#0f172a] dark:text-[#f8fafc]">
                                    {part.inversionista_nombre}
                                  </div>
                                  <div className="text-[10px] font-mono text-[#64748b] dark:text-[#94a3b8] flex items-center gap-1.5 mt-0.5">
                                    <span className="font-bold text-indigo-600 dark:text-indigo-400">{part.id_fondo}</span>
                                    <span>•</span>
                                    <span>Cert: {part.id_certificado}</span>
                                    <span>•</span>
                                    <span>Doc: {part.inversionista_dni}</span>
                                  </div>
                                </div>
                              </div>

                              {/* Capital Cartera & Días */}
                              <div className="flex items-center gap-6">
                                <div className="text-right">
                                  <div className="text-[9px] font-black uppercase text-slate-400">
                                    Capital Base
                                  </div>
                                  <div className="text-xs font-mono font-black text-[#0f172a] dark:text-[#f8fafc]">
                                    {part.moneda} {part.capital_base.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                                  </div>
                                </div>

                                <div className="text-center">
                                  <div className="text-[9px] font-black uppercase text-slate-400">
                                    Tasa Asesor
                                  </div>
                                  <div className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">
                                    {part.tasa_comision_asesor.toFixed(2)}% aa
                                  </div>
                                </div>

                                <div className="text-center">
                                  <div className="text-[9px] font-black uppercase text-slate-400">
                                    Días
                                  </div>
                                  <div className="text-xs font-mono font-bold text-slate-600 dark:text-slate-300">
                                    {part.dias_devengados} d
                                  </div>
                                </div>
                              </div>

                              {/* Pastilla de Determinación Matemática Explícita */}
                              <div className="bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-900/40 rounded-xl px-3 py-1.5 flex items-center gap-2 max-w-full lg:max-w-md">
                                <span className="text-[9.5px] font-mono font-bold text-sky-800 dark:text-sky-300 truncate" title={part.determinacion_texto}>
                                  🧮 {part.determinacion_texto}
                                </span>
                              </div>

                              {/* Monto de Comisión a Pagar */}
                              <div className="text-right min-w-[120px]">
                                <div className="text-[9.5px] font-black uppercase text-slate-400">
                                  Comisión Neta
                                </div>
                                <div className="text-sm font-black font-mono text-emerald-600 dark:text-emerald-400">
                                  {part.moneda} {part.comision_calculada.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Subtotales del Período */}
                        <div className="mt-2 pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between text-xs gap-2">
                          <span className="font-bold text-[#64748b] dark:text-[#94a3b8]">
                            Total {periodo.mes_nombre} ({periodo.participes.length} Operaciones en Cartera)
                          </span>
                          <div className="flex items-center gap-4 font-mono font-black">
                            {periodo.totales.comision_pen > 0 && (
                              <span className="text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-1 rounded-xl border border-emerald-200 dark:border-emerald-900/30">
                                Subtotal PEN: S/ {periodo.totales.comision_pen.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                              </span>
                            )}
                            {periodo.totales.comision_usd > 0 && (
                              <span className="text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/30 px-3 py-1 rounded-xl border border-sky-200 dark:border-sky-900/30">
                                Subtotal USD: $ {periodo.totales.comision_usd.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                              </span>
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
