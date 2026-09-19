import React, { useState, useEffect, useMemo } from 'react';
import { 
  getAsesores, getFondos, calculateComisionesAnuales, PERIODOS_CANONICOS 
} from '../../services/comisionesService';
import type { 
  AsesorComercial, FondoComercial, PeriodoComisionGroup, ParticipeComisionItem 
} from '../../services/comisionesService';
import { downloadReportPdf } from '../../utils/pdfDownloadHelper';
import ExcelJS from 'exceljs';
import { 
  Loader2, FileSpreadsheet, FileText, ChevronDown, ChevronRight, 
  GripVertical, CheckCircle2, Clock, Users, Briefcase,
  User, Landmark, BarChart3, Table
} from 'lucide-react';
import { ComisionesInteractiveChart, formatShortAdvisorName } from './components/ComisionesInteractiveChart';
import { LOGO_INANDES_BASE64 } from '../../assets/base64Images';

export const ComisionesAsesoresTab: React.FC = () => {
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [asesoresList, setAsesoresList] = useState<AsesorComercial[]>([]);
  const [fondosList, setFondosList] = useState<FondoComercial[]>([]);
  const [selectedAsesorCodigo, setSelectedAsesorCodigo] = useState<string>('TODOS');
  const [selectedPeriodoId, setSelectedPeriodoId] = useState<string>('TODOS');
  const [selectedFondoId, setSelectedFondoId] = useState<string>('TODOS');
  
  const [loading, setLoading] = useState<boolean>(true);
  const [periodosData, setPeriodosData] = useState<PeriodoComisionGroup[]>([]);
  
  // Acordeones jerárquicos: colapsados por defecto
  const [expandedPeriodos, setExpandedPeriodos] = useState<Record<string, boolean>>({});
  const [expandedFondos, setExpandedFondos] = useState<Record<string, boolean>>({});
  const [expandedAsesores, setExpandedAsesores] = useState<Record<string, boolean>>({});

  // Drag & Drop
  const [draggedPeriodId, setDraggedPeriodId] = useState<string | null>(null);
  const [dragOverPeriodId, setDragOverPeriodId] = useState<string | null>(null);
  const [periodOrder, setPeriodOrder] = useState<string[]>(PERIODOS_CANONICOS.map(p => p.id));

  // Export States
  const [exportingExcel, setExportingExcel] = useState<boolean>(false);
  const [exportingPdf, setExportingPdf] = useState<boolean>(false);
  
  // Vista: Tabular (acordeones) vs Grafico ECharts
  const [viewMode, setViewMode] = useState<'table' | 'chart'>('table');

  // Cargar lista de asesores y fondos
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const [asesoresData, fondosData] = await Promise.all([
          getAsesores(),
          getFondos()
        ]);
        setAsesoresList(asesoresData);
        setFondosList(fondosData);
      } catch (err: any) {
        console.error('Error cargando metadatos:', err);
      }
    };
    fetchMetadata();
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

  // Lista unificada y garantizada de fondos para el selector
  const availableFondos = useMemo(() => {
    const map = new Map<string, string>();
    fondosList.forEach(f => {
      if (f.id_fondo) map.set(f.id_fondo, f.nombre_fondo || f.id_fondo);
    });
    periodosData.forEach(p => {
      p.participes.forEach(part => {
        if (part.id_fondo && !map.has(part.id_fondo)) {
          map.set(part.id_fondo, part.nombre_fondo || part.id_fondo);
        }
      });
    });
    return Array.from(map.entries())
      .map(([id, nombre]) => ({ id_fondo: id, nombre_fondo: nombre }))
      .sort((a, b) => a.nombre_fondo.localeCompare(b.nombre_fondo));
  }, [fondosList, periodosData]);

  // Lista unificada y garantizada de asesores para el selector
  const availableAsesores = useMemo(() => {
    const map = new Map<string, AsesorComercial>();
    asesoresList.forEach(a => {
      if (a.codigo) {
        map.set(a.codigo, {
          ...a,
          nombre_completo: formatShortAdvisorName(a.nombre_completo)
        });
      }
    });
    periodosData.forEach(p => {
      p.participes.forEach(part => {
        if (part.id_asesor && !map.has(part.id_asesor)) {
          map.set(part.id_asesor, {
            id: part.id_asesor,
            codigo: part.id_asesor,
            nombre_completo: formatShortAdvisorName(part.nombre_asesor || part.id_asesor)
          });
        }
      });
    });
    return Array.from(map.values())
      .sort((a, b) => a.nombre_completo.localeCompare(b.nombre_completo));
  }, [asesoresList, periodosData]);

  // Asesor activo seleccionado
  const selectedAsesorObj = useMemo(() => {
    if (selectedAsesorCodigo === 'TODOS') return null;
    return availableAsesores.find(a => a.codigo === selectedAsesorCodigo) || null;
  }, [selectedAsesorCodigo, availableAsesores]);

  // Fondo activo seleccionado
  const selectedFondoObj = useMemo(() => {
    if (selectedFondoId === 'TODOS') return null;
    return availableFondos.find(f => f.id_fondo === selectedFondoId) || null;
  }, [selectedFondoId, availableFondos]);

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

  // Períodos filtrados por el selector de Cierre y Fondo
  const displayedPeriodos = useMemo(() => {
    let list = orderedPeriodos;
    if (selectedPeriodoId !== 'TODOS') {
      list = list.filter(p => p.id === selectedPeriodoId);
    }

    return list.map(p => {
      let filteredParts = p.participes;
      if (selectedFondoId !== 'TODOS') {
        filteredParts = filteredParts.filter(part => part.id_fondo === selectedFondoId);
      }
      if (selectedAsesorCodigo !== 'TODOS') {
        filteredParts = filteredParts.filter(part => part.id_asesor === selectedAsesorCodigo);
      }

      const countParts = new Set(filteredParts.map(part => part.inversionista_nombre)).size;
      const capPen = filteredParts.filter(part => part.moneda === 'PEN').reduce((sum, part) => sum + part.capital_base, 0);
      const capUsd = filteredParts.filter(part => part.moneda === 'USD').reduce((sum, part) => sum + part.capital_base, 0);
      const comPen = filteredParts.filter(part => part.moneda === 'PEN').reduce((sum, part) => sum + part.comision_calculada, 0);
      const comUsd = filteredParts.filter(part => part.moneda === 'USD').reduce((sum, part) => sum + part.comision_calculada, 0);

      return {
        ...p,
        participes: filteredParts,
        totales: {
          count_participes: countParts,
          count_contratos: filteredParts.length,
          capital_pen: capPen,
          capital_usd: capUsd,
          comision_pen: comPen,
          comision_usd: comUsd
        }
      };
    });
  }, [orderedPeriodos, selectedPeriodoId, selectedFondoId, selectedAsesorCodigo]);

  // Totales acumulados según períodos visibles (anual o por filtros)
  const totalAnual = useMemo(() => {
    let totalPEN = 0;
    let totalUSD = 0;
    let totalCapPEN = 0;
    let totalCapUSD = 0;
    const uniqueParticipes = new Set<string>();
    let totalContratos = 0;

    displayedPeriodos.forEach(p => {
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
  }, [displayedPeriodos]);

  // Alternar acordeón de Período
  const togglePeriodo = (id: string) => {
    setExpandedPeriodos(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Alternar acordeón de Fondo
  const toggleFondo = (key: string) => {
    setExpandedFondos(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Alternar acordeón de Asesor
  const toggleAsesor = (key: string) => {
    setExpandedAsesores(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Expandir / Colapsar todos
  const toggleAll = (expand: boolean) => {
    if (!expand) {
      setExpandedPeriodos({});
      setExpandedFondos({});
      setExpandedAsesores({});
      return;
    }

    const nextP: Record<string, boolean> = {};
    const nextF: Record<string, boolean> = {};
    const nextA: Record<string, boolean> = {};

    displayedPeriodos.forEach(p => {
      nextP[p.id] = true;
      p.participes.forEach(part => {
        const fKey = `${p.id}_${part.id_fondo}`;
        nextF[fKey] = true;
        const aKey = `${p.id}_${part.id_fondo}_${part.id_asesor}`;
        nextA[aKey] = true;
      });
    });

    setExpandedPeriodos(nextP);
    setExpandedFondos(nextF);
    setExpandedAsesores(nextA);
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
  // EXPORTADOR A EXCEL MAESTRO MULTI-PESTAÑA CON SUBGRUPOS POR FONDO
  // ==========================================
  const handleExportExcel = async () => {
    setExportingExcel(true);
    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'InAndes ERP React';
      workbook.created = new Date();

      const asesorName = selectedAsesorObj ? selectedAsesorObj.nombre_completo : 'TODOS_LOS_ASESORES';
      const fondoName = selectedFondoObj ? selectedFondoObj.nombre_fondo : 'TODOS_LOS_FONDOS';

      // ---------------------------------------------------------
      // HOJA 1: RESUMEN GENERAL CONSOLIDADO
      // ---------------------------------------------------------
      const sheetSummary = workbook.addWorksheet('Resumen General');
      sheetSummary.views = [{ showGridLines: true }];

      // Título y Metadatos
      const titleRow = sheetSummary.addRow(['INANDES GRUPO FINANCIERO - LIQUIDACIÓN DE COMISIONES COMERCIALES (BASE 365)']);
      titleRow.font = { bold: true, size: 13, color: { argb: 'FF0F172A' } };
      
      const metaRow1 = sheetSummary.addRow([`AÑO: ${selectedYear} | ASESOR: ${asesorName.toUpperCase()} | FONDO: ${fondoName.toUpperCase()}`]);
      metaRow1.font = { bold: true, size: 10, color: { argb: 'FF475569' } };
      
      const metaRow2 = sheetSummary.addRow([`FECHA DE EMISIÓN: ${new Date().toLocaleDateString('es-PE')} │ TOTAL OPERACIONES: ${totalAnual.countContratos}`]);
      metaRow2.font = { italic: true, size: 9, color: { argb: 'FF64748B' } };
      sheetSummary.addRow([]);

      // Encabezados Resumen
      sheetSummary.addRow([
        'Cód. Período', 'Mes / Ciclo', 'Rango de Fechas', 'Días', 'Estado BD', 
        'Partícipes', 'Contratos', 'Capital PEN', 'Capital USD', 'Comisión PEN', 'Comisión USD'
      ]);

      const sumHeaderRow = sheetSummary.getRow(5);
      sumHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      sumHeaderRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0284C7' } };
      sumHeaderRow.alignment = { horizontal: 'center', vertical: 'middle' };

      const summaryStartRow = 6;
      displayedPeriodos.forEach(p => {
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

        row.getCell(1).alignment = { horizontal: 'center' };
        row.getCell(4).alignment = { horizontal: 'center' };
        row.getCell(5).alignment = { horizontal: 'center' };
        row.getCell(6).alignment = { horizontal: 'center' };
        row.getCell(7).alignment = { horizontal: 'center' };
        row.getCell(8).numFmt = '#,##0.00';
        row.getCell(9).numFmt = '#,##0.00';
        row.getCell(10).numFmt = '#,##0.00';
        row.getCell(11).numFmt = '#,##0.00';
      });

      const summaryEndRow = summaryStartRow + displayedPeriodos.length - 1;
      
      // Fila de Total Anual Consolidado
      const sumTotalRow = sheetSummary.addRow([
        'TOTAL ANUAL', 'CONSOLIDADO', '', '', '',
        totalAnual.countParticipes,
        totalAnual.countContratos,
        { formula: `SUM(H${summaryStartRow}:H${summaryEndRow})` },
        { formula: `SUM(I${summaryStartRow}:I${summaryEndRow})` },
        { formula: `SUM(J${summaryStartRow}:J${summaryEndRow})` },
        { formula: `SUM(K${summaryStartRow}:K${summaryEndRow})` }
      ]);
      sumTotalRow.font = { bold: true, color: { argb: 'FF0F172A' } };
      sumTotalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
      sumTotalRow.getCell(8).numFmt = '#,##0.00';
      sumTotalRow.getCell(9).numFmt = '#,##0.00';
      sumTotalRow.getCell(10).numFmt = '#,##0.00';
      sumTotalRow.getCell(11).numFmt = '#,##0.00';

      // Ajuste de columnas en Hoja 1
      sheetSummary.columns = [
        { width: 14 }, { width: 18 }, { width: 24 }, { width: 10 }, { width: 18 },
        { width: 14 }, { width: 14 }, { width: 20 }, { width: 20 }, { width: 20 }, { width: 20 }
      ];

      // ---------------------------------------------------------
      // HOJAS 2..N: MULTI-PESTAÑA POR CADA CIERRE (CON SUBGRUPOS POR FONDO)
      // ---------------------------------------------------------
      displayedPeriodos.forEach(p => {
        const safeSheetName = `${p.id} - ${p.mes_nombre}`.replace(/[\/\\?*:[\]]/g, '-').slice(0, 31);
        const sheetPeriodo = workbook.addWorksheet(safeSheetName);
        sheetPeriodo.views = [{ showGridLines: true }];

        // 1. Cabecera del Período
        const pTitle = sheetPeriodo.addRow([`INANDES GRUPO FINANCIERO - LIQUIDACIÓN DE COMISIONES (${p.mes_nombre.toUpperCase()} ${selectedYear})`]);
        pTitle.font = { bold: true, size: 12, color: { argb: 'FF0F172A' } };

        const pMeta1 = sheetPeriodo.addRow([
          `PERÍODO: ${p.ciclo_label.toUpperCase()} (${p.fecha_inicio} al ${p.fecha_fin} · ${p.dias_periodo} días) │ CORTE: ${p.corte_str} │ ESTADO: ${p.is_cerrado_bd ? 'AUDITADO EN BD' : 'PROYECCIÓN'}`
        ]);
        pMeta1.font = { bold: true, size: 9, color: { argb: 'FF334155' } };

        const pMeta2 = sheetPeriodo.addRow([
          `ASESOR: ${asesorName.toUpperCase()} │ FONDO: ${fondoName.toUpperCase()} │ SUB-TOTAL PERÍODO: PEN ${p.totales.comision_pen.toLocaleString('es-PE', { minimumFractionDigits: 2 })} │ USD ${p.totales.comision_usd.toLocaleString('es-PE', { minimumFractionDigits: 2 })}`
        ]);
        pMeta2.font = { italic: true, size: 9, color: { argb: 'FF64748B' } };
        sheetPeriodo.addRow([]); // Fila 4 vacía

        // 2. Agrupar partícipes del período por FONDO
        const fondosGroupMap = new Map<string, typeof p.participes>();
        p.participes.forEach(part => {
          const fKey = part.id_fondo || 'FONDO_GENERAL';
          if (!fondosGroupMap.has(fKey)) {
            fondosGroupMap.set(fKey, []);
          }
          fondosGroupMap.get(fKey)!.push(part);
        });

        if (p.participes.length === 0) {
          const noDataRow = sheetPeriodo.addRow(['No se registraron operaciones vigentes para los filtros seleccionados en este período.']);
          noDataRow.font = { italic: true, color: { argb: 'FF94A3B8' } };
        } else {
          // Iterar cada subgrupo de Fondo
          fondosGroupMap.forEach((partsInFondo, fondoKey) => {
            const fNombre = partsInFondo[0]?.nombre_fondo || fondoKey;
            const fMoneda = partsInFondo[0]?.moneda || 'USD';

            // Fila Sub-encabezado de Fondo (Destacado)
            const fondoBannerRow = sheetPeriodo.addRow([
              `🏦 SUBGRUPO FONDO: ${fNombre.toUpperCase()} (${fondoKey}) │ MONEDA BASE: ${fMoneda} │ OPERACIONES: ${partsInFondo.length}`
            ]);
            fondoBannerRow.font = { bold: true, size: 10, color: { argb: 'FF0369A1' } };
            fondoBannerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0F2FE' } };

            // Encabezados de Tabla de Partícipes del Fondo (Columna I = Capital Inicial Contrato)
            const tableHeaderRow = sheetPeriodo.addRow([
              'N°', 'Asesor Comercial', 'Inversionista / Partícipe', 'DNI / RUC', 'Certificado / Contrato',
              'Moneda', 'Fecha Inicio', 'Fecha Fin', 'Capital Inicial Contrato', 'Días', '% Tasa Com.', 'Fórmula / Determinación', 'Comisión a Pagar'
            ]);
            tableHeaderRow.font = { bold: true, size: 9, color: { argb: 'FFFFFFFF' } };
            tableHeaderRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
            tableHeaderRow.alignment = { horizontal: 'center', vertical: 'middle' };

            const dataStartRow = sheetPeriodo.rowCount + 1;

            partsInFondo.forEach((part, idx) => {
              const row = sheetPeriodo.addRow([
                idx + 1,
                part.nombre_asesor || part.id_asesor,
                part.inversionista_nombre,
                part.inversionista_dni,
                part.id_certificado,
                part.moneda,
                part.fecha_inicio,
                part.fecha_fin,
                part.capital_base, // Columna I: Capital Inicial del Contrato
                part.dias_devengados,
                part.tasa_comision_asesor / 100.0,
                part.determinacion_texto,
                part.comision_calculada
              ]);

              row.getCell(1).alignment = { horizontal: 'center' };
              row.getCell(4).alignment = { horizontal: 'center' };
              row.getCell(6).alignment = { horizontal: 'center' };
              row.getCell(7).alignment = { horizontal: 'center' };
              row.getCell(8).alignment = { horizontal: 'center' };
              row.getCell(9).numFmt = '#,##0.00'; // Columna I Formato Numérico
              row.getCell(10).alignment = { horizontal: 'center' };
              row.getCell(11).numFmt = '0.00%';
              row.getCell(11).alignment = { horizontal: 'center' };
              row.getCell(13).numFmt = '#,##0.00';
              row.getCell(13).font = { bold: true, color: { argb: 'FF059669' } };
            });

            const dataEndRow = sheetPeriodo.rowCount;

            // Fila de Subtotal del Fondo con fórmulas Excel
            const subtotalRow = sheetPeriodo.addRow([
              '', '', '', '', '', '', '',
              `SUBTOTAL ${fondoKey}:`,
              { formula: `SUM(I${dataStartRow}:I${dataEndRow})` }, // Subtotal Columna I
              '', '', '',
              { formula: `SUM(M${dataStartRow}:M${dataEndRow})` }  // Subtotal Columna M
            ]);
            subtotalRow.font = { bold: true, size: 9, color: { argb: 'FF0F172A' } };
            subtotalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
            subtotalRow.getCell(8).alignment = { horizontal: 'right' };
            subtotalRow.getCell(9).numFmt = '#,##0.00';
            subtotalRow.getCell(13).numFmt = '#,##0.00';
            subtotalRow.getCell(13).font = { bold: true, color: { argb: 'FF059669' } };

            sheetPeriodo.addRow([]); // Espacio entre subgrupos de fondo
          });

          // Fila Gran Total del Período al pie de la pestaña
          const periodGrandTotalRow = sheetPeriodo.addRow([
            '', '', '', '', '', '', '',
            `TOTAL GENERAL DEL PERÍODO (${p.participes.length} Ops):`,
            p.totales.capital_pen + p.totales.capital_usd,
            '', '', '',
            p.totales.comision_pen + p.totales.comision_usd
          ]);
          periodGrandTotalRow.font = { bold: true, size: 10, color: { argb: 'FF1E3A8A' } };
          periodGrandTotalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };
          periodGrandTotalRow.getCell(8).alignment = { horizontal: 'right' };
          periodGrandTotalRow.getCell(9).numFmt = '#,##0.00';
          periodGrandTotalRow.getCell(13).numFmt = '#,##0.00';
        }

        // Anchos de columna optimizados para visualización y fórmulas
        sheetPeriodo.columns = [
          { width: 6 },   // A: N°
          { width: 24 },  // B: Asesor
          { width: 32 },  // C: Inversionista
          { width: 14 },  // D: DNI / RUC
          { width: 25 },  // E: Certificado
          { width: 10 },  // F: Moneda
          { width: 13 },  // G: Fecha Inicio
          { width: 13 },  // H: Fecha Fin
          { width: 24 },  // I: Capital Inicial Contrato
          { width: 10 },  // J: Días
          { width: 14 },  // K: % Tasa Com.
          { width: 44 },  // L: Fórmula
          { width: 20 }   // M: Comisión a Pagar
        ];
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
      const fondoName = selectedFondoObj ? selectedFondoObj.nombre_fondo : 'TODOS LOS FONDOS';

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
        <td><strong>Asesor Comercial:</strong> ${asesorName} (${asesorDoc})</td>
        <td><strong>Fondo:</strong> ${fondoName}</td>
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

  ${displayedPeriodos.map(p => `
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
            <th>Fondo</th>
            <th>Asesor</th>
            <th>Inversionista / Partícipe</th>
            <th>Certificado</th>
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
              <td colspan="10" class="text-center" style="color: #94a3b8; padding: 8px;">
                No se registraron operaciones vigentes para los filtros seleccionados en este período.
              </td>
            </tr>
          ` : p.participes.map((part, idx) => `
            <tr>
              <td class="text-center">${String(idx + 1).padStart(2, '0')}</td>
              <td><b>${part.id_fondo}</b></td>
              <td>${part.nombre_asesor || part.id_asesor}</td>
              <td class="font-bold">${part.inversionista_nombre}</td>
              <td><code>${part.id_certificado}</code></td>
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
            <td colspan="5" class="font-bold">TOTALES DEL PERÍODO (${p.participes.length} Operaciones):</td>
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
    <p>INANDES ACTIVOS ALTERNATIVOS SAC │ Av. Javier Prado Este 560 Int 1403 Centro Empresarial Javier Prado, San Isidro, Lima │ Tel: + 51 (1) 712 1700 │ info@inandes.com</p>
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
      
      {/* 1. BARRA SUPERIOR EJECUTIVA CON LOS 4 FILTROS EN LÍNEA */}
      <div className="bg-white dark:bg-[#0f172a] border border-[#e2e8f0] dark:border-[#1e293b] rounded-2xl p-4 shadow-xs flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4">
        
        {/* Lado Izquierdo: Título y Filtros Año, Cierre, Fondo, Asesor */}
        <div className="flex items-center gap-3 flex-wrap w-full xl:w-auto">
          <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl border border-indigo-100 dark:border-indigo-900/40 shrink-0">
            <Briefcase size={22} />
          </div>
          <div>
            <h2 className="text-sm font-black text-[#0f172a] dark:text-[#f8fafc] tracking-tight uppercase flex items-center gap-2">
              <span>Liquidación de Comisiones</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 font-bold">
                Base 365
              </span>
            </h2>
          </div>

          {/* 1. Selector de Año */}
          <div className="flex items-center gap-0.5 bg-[#f1f5f9] dark:bg-[#1e293b] p-0.5 rounded-xl border border-[#e2e8f0] dark:border-[#334155] shrink-0">
            <button
              onClick={() => setSelectedYear(y => y - 1)}
              className="px-2 py-1 text-xs font-black text-[#475569] dark:text-[#cbd5e1] hover:bg-white dark:hover:bg-[#0f172a] rounded-lg transition-all"
            >
              ◄
            </button>
            <span className="px-2.5 py-1 text-xs font-black text-[#0f172a] dark:text-[#f8fafc] font-mono">
              {selectedYear}
            </span>
            <button
              onClick={() => setSelectedYear(y => y + 1)}
              className="px-2 py-1 text-xs font-black text-[#475569] dark:text-[#cbd5e1] hover:bg-white dark:hover:bg-[#0f172a] rounded-lg transition-all"
            >
              ►
            </button>
          </div>

          {/* 2. Selector de Cierre / Mes */}
          <div className="relative min-w-[190px]">
            <select
              value={selectedPeriodoId}
              onChange={(e) => setSelectedPeriodoId(e.target.value)}
              className="w-full bg-[#f8fafc] dark:bg-[#1e293b] border border-[#cbd5e1] dark:border-[#334155] rounded-xl py-1.5 px-2.5 text-xs font-bold text-[#0f172a] dark:text-[#f8fafc] focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="TODOS">📅 TODOS LOS CIERRES (8 Períodos)</option>
              {PERIODOS_CANONICOS.map(p => (
                <option key={p.id} value={p.id}>
                  {p.mes}: {p.label} (Corte {p.corte})
                </option>
              ))}
            </select>
          </div>

          {/* 3. Selector de Fondo (Nuevo filtro a la derecha del mes) */}
          <div className="relative min-w-[200px]">
            <select
              value={selectedFondoId}
              onChange={(e) => setSelectedFondoId(e.target.value)}
              className="w-full bg-[#f8fafc] dark:bg-[#1e293b] border border-[#cbd5e1] dark:border-[#334155] rounded-xl py-1.5 px-2.5 text-xs font-bold text-[#0f172a] dark:text-[#f8fafc] focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="TODOS">🏦 TODOS LOS FONDOS ({availableFondos.length})</option>
              {availableFondos.map(f => (
                <option key={f.id_fondo} value={f.id_fondo}>
                  🏦 {f.nombre_fondo || f.id_fondo}
                </option>
              ))}
            </select>
          </div>

          {/* 4. Selector de Asesores */}
          <div className="relative min-w-[230px]">
            <select
              value={selectedAsesorCodigo}
              onChange={(e) => setSelectedAsesorCodigo(e.target.value)}
              className="w-full bg-[#f8fafc] dark:bg-[#1e293b] border border-[#cbd5e1] dark:border-[#334155] rounded-xl py-1.5 px-2.5 text-xs font-bold text-[#0f172a] dark:text-[#f8fafc] focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="TODOS">👥 TODOS LOS ASESORES ({availableAsesores.length})</option>
              {availableAsesores.map(a => (
                <option key={a.codigo} value={a.codigo}>
                  👤 {a.nombre_completo} ({a.codigo})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Lado Derecho: Botones de Exportacion & Grafico (SOLO ICONOS) */}
        <div className="flex items-center gap-2 shrink-0 self-end xl:self-center">
          {/* Boton Analisis Grafico Apache ECharts (Al lado IZQUIERDO de Excel) */}
          <button
            onClick={() => setViewMode(prev => prev === 'chart' ? 'table' : 'chart')}
            title={viewMode === 'chart' ? "Volver a Vista Tabular de Acordeones" : "Abrir Tablero Grafico ECharts"}
            className={`w-9 h-9 rounded-xl shadow-xs transition-all flex items-center justify-center cursor-pointer ${
              viewMode === 'chart' 
                ? 'bg-purple-600 hover:bg-purple-700 text-white ring-2 ring-purple-400/50' 
                : 'bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 hover:border-purple-400 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/30'
            }`}
          >
            {viewMode === 'chart' ? <Table size={16} /> : <BarChart3 size={16} />}
          </button>

          {/* Boton Excel (Solo Icono) */}
          <button
            onClick={handleExportExcel}
            disabled={exportingExcel || loading}
            title="Exportar Excel Maestro"
            className="w-9 h-9 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-all flex items-center justify-center cursor-pointer disabled:opacity-50"
          >
            {exportingExcel ? <Loader2 size={16} className="animate-spin" /> : <FileSpreadsheet size={16} />}
          </button>

          {/* Boton PDF (Solo Icono) */}
          <button
            onClick={handleExportPdf}
            disabled={exportingPdf || loading}
            title="Exportar Liquidacion PDF"
            className="w-9 h-9 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-all flex items-center justify-center cursor-pointer disabled:opacity-50"
          >
            {exportingPdf ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
          </button>
        </div>
      </div>

      {/* 2. TARJETAS RESUMEN EJECUTIVAS DINÁMICAS (Solo en modo tabla) */}
      {viewMode === 'table' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          
          {/* Asesor / Filtro Activo */}
          <div className="bg-white dark:bg-[#0f172a] border border-[#e2e8f0] dark:border-[#1e293b] rounded-2xl p-4 flex flex-col justify-between shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wider">
                Alcance de Liquidación
              </span>
              <User size={16} className="text-indigo-600 dark:text-indigo-400" />
            </div>
            <div className="mt-2">
              <div className="text-xs font-black text-[#0f172a] dark:text-[#f8fafc] truncate" title={selectedAsesorObj ? selectedAsesorObj.nombre_completo : 'TODOS LOS ASESORES'}>
                {selectedAsesorObj ? selectedAsesorObj.nombre_completo : 'CONSOLIDADO GENERAL'}
              </div>
              <div className="text-[10.5px] font-mono text-[#64748b] dark:text-[#94a3b8] truncate">
                {selectedFondoObj ? selectedFondoObj.nombre_fondo : `${availableFondos.length} fondos`} · {selectedAsesorObj ? selectedAsesorObj.codigo : `${availableAsesores.length} asesores`}
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

          {/* Comisiones PEN */}
          <div className="bg-white dark:bg-[#0f172a] border border-[#e2e8f0] dark:border-[#1e293b] rounded-2xl p-4 flex flex-col justify-between shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wider">
                {selectedPeriodoId === 'TODOS' ? 'Comisión Anual PEN' : 'Comisión Período PEN'}
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

          {/* Comisiones USD */}
          <div className="bg-white dark:bg-[#0f172a] border border-[#e2e8f0] dark:border-[#1e293b] rounded-2xl p-4 flex flex-col justify-between shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wider">
                {selectedPeriodoId === 'TODOS' ? 'Comisión Anual USD' : 'Comisión Período USD'}
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
      )}

      {/* 3. BARRA DE HERRAMIENTAS Y VISTA */}
      {viewMode === 'table' && (
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="text-xs font-black text-[#0f172a] dark:text-[#f8fafc] uppercase tracking-wide flex items-center gap-2">
            <span>CIERRE: {selectedPeriodoId === 'TODOS' ? `AÑO ${selectedYear}` : selectedPeriodoId} ➔ FONDOS ➔ ASESORES</span>
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
      )}

      {/* 4. CONTENIDO: TABLERO GRAFICO ECHARTS O ACORDEONES */}
      {viewMode === 'chart' ? (
        <ComisionesInteractiveChart
          periodosData={periodosData}
          selectedYear={selectedYear}
        />
      ) : loading ? (
        <div className="bg-white dark:bg-[#0f172a] border border-[#e2e8f0] dark:border-[#1e293b] rounded-2xl p-12 text-center flex flex-col items-center justify-center gap-3">
          <Loader2 size={32} className="animate-spin text-indigo-600" />
          <p className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wider">
            Calculando liquidación de comisiones...
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {displayedPeriodos.map((periodo) => {
            // Nivel 1: Período
            const isPeriodoExpanded = !!expandedPeriodos[periodo.id];
            const isDraggingOver = dragOverPeriodId === periodo.id;

            // Agrupar partícipes del período por Fondo
            const fondosMap = new Map<string, {
              id_fondo: string;
              nombre_fondo: string;
              participes: ParticipeComisionItem[];
              totales: {
                comision_pen: number;
                comision_usd: number;
                capital_pen: number;
                capital_usd: number;
                count_participes: number;
                count_contratos: number;
              };
            }>();

            periodo.participes.forEach(part => {
              if (!fondosMap.has(part.id_fondo)) {
                fondosMap.set(part.id_fondo, {
                  id_fondo: part.id_fondo,
                  nombre_fondo: part.nombre_fondo || part.id_fondo,
                  participes: [],
                  totales: { comision_pen: 0, comision_usd: 0, capital_pen: 0, capital_usd: 0, count_participes: 0, count_contratos: 0 }
                });
              }
              const fg = fondosMap.get(part.id_fondo)!;
              fg.participes.push(part);
              if (part.moneda === 'PEN') {
                fg.totales.comision_pen += part.comision_calculada;
                fg.totales.capital_pen += part.capital_base;
              } else {
                fg.totales.comision_usd += part.comision_calculada;
                fg.totales.capital_usd += part.capital_base;
              }
            });

            fondosMap.forEach(fg => {
              fg.totales.count_contratos = fg.participes.length;
              fg.totales.count_participes = new Set(fg.participes.map(p => p.inversionista_nombre)).size;
            });

            const fondosArray = Array.from(fondosMap.values());

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
                {/* CABECERA NIVEL 1: PERÍODO */}
                <div
                  onClick={() => togglePeriodo(periodo.id)}
                  className="p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 cursor-pointer select-none bg-[#f8fafc]/60 dark:bg-[#1e293b]/30 hover:bg-slate-50 dark:hover:bg-[#1e293b]/50 transition-colors"
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
                      {isPeriodoExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </div>
                  </div>
                </div>

                {/* CUERPO NIVEL 1: ACORDEÓN DE FONDOS */}
                {isPeriodoExpanded && (
                  <div className="p-4 sm:p-5 border-t border-[#e2e8f0] dark:border-[#1e293b] bg-[#fafafa] dark:bg-[#0b1329] flex flex-col gap-4">
                    
                    {fondosArray.length === 0 ? (
                      <div className="p-6 text-center text-slate-400 text-xs font-medium italic bg-white dark:bg-[#0f172a] rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                        No se registraron operaciones vigentes para los filtros seleccionados en este período.
                      </div>
                    ) : (
                      fondosArray.map((fondoGroup) => {
                        const fondoKey = `${periodo.id}_${fondoGroup.id_fondo}`;
                        // Si hay un fondo específico seleccionado en la barra, se expande directamente
                        const isFondoExpanded = selectedFondoId !== 'TODOS' || !!expandedFondos[fondoKey];

                        // Agrupar partícipes del fondo por Asesor
                        const asesoresMap = new Map<string, {
                          id_asesor: string;
                          nombre_asesor: string;
                          participes: ParticipeComisionItem[];
                          totales: {
                            comision_pen: number;
                            comision_usd: number;
                            capital_pen: number;
                            capital_usd: number;
                            count_participes: number;
                            count_contratos: number;
                          };
                        }>();

                        fondoGroup.participes.forEach(part => {
                          if (!asesoresMap.has(part.id_asesor)) {
                            asesoresMap.set(part.id_asesor, {
                              id_asesor: part.id_asesor,
                              nombre_asesor: formatShortAdvisorName(part.nombre_asesor || part.id_asesor),
                              participes: [],
                              totales: { comision_pen: 0, comision_usd: 0, capital_pen: 0, capital_usd: 0, count_participes: 0, count_contratos: 0 }
                            });
                          }
                          const ag = asesoresMap.get(part.id_asesor)!;
                          ag.participes.push(part);
                          if (part.moneda === 'PEN') {
                            ag.totales.comision_pen += part.comision_calculada;
                            ag.totales.capital_pen += part.capital_base;
                          } else {
                            ag.totales.comision_usd += part.comision_calculada;
                            ag.totales.capital_usd += part.capital_base;
                          }
                        });

                        asesoresMap.forEach(ag => {
                          ag.totales.count_contratos = ag.participes.length;
                          ag.totales.count_participes = new Set(ag.participes.map(p => p.inversionista_nombre)).size;
                        });

                        const asesoresArray = Array.from(asesoresMap.values());

                        return (
                          <div
                            key={fondoKey}
                            className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xs overflow-hidden"
                          >
                            {/* CABECERA NIVEL 2: FONDO DE INVERSIÓN */}
                            <div
                              onClick={() => toggleFondo(fondoKey)}
                              className="p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 cursor-pointer select-none bg-sky-50/40 dark:bg-sky-950/20 hover:bg-sky-50 dark:hover:bg-sky-950/40 transition-colors"
                            >
                              <div className="flex items-center gap-2.5">
                                <div className="p-2 rounded-xl bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-900/50 shrink-0">
                                  <Landmark size={17} />
                                </div>
                                <div>
                                  <div className="text-xs font-black text-[#0f172a] dark:text-[#f8fafc] flex items-center gap-2 flex-wrap">
                                    <span>{fondoGroup.nombre_fondo}</span>
                                    <span className="text-[9.5px] font-mono font-bold px-2 py-0.5 rounded-md bg-sky-100 dark:bg-sky-900/50 text-sky-800 dark:text-sky-300">
                                      {fondoGroup.id_fondo}
                                    </span>
                                  </div>
                                  <div className="text-[10px] text-[#64748b] dark:text-[#94a3b8] font-medium">
                                    {fondoGroup.totales.count_participes} Inversionistas · {fondoGroup.totales.count_contratos} Operaciones
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-4 self-end sm:self-center">
                                <div className="text-right">
                                  <div className="text-[9px] font-black uppercase text-[#64748b] dark:text-[#94a3b8]">
                                    Subtotal Fondo
                                  </div>
                                  <div className="text-xs font-mono font-black text-emerald-600 dark:text-emerald-400">
                                    {fondoGroup.totales.comision_pen > 0 && `PEN ${fondoGroup.totales.comision_pen.toLocaleString('es-PE', { minimumFractionDigits: 2 })}`}
                                    {fondoGroup.totales.comision_pen > 0 && fondoGroup.totales.comision_usd > 0 && ' │ '}
                                    {fondoGroup.totales.comision_usd > 0 && `USD ${fondoGroup.totales.comision_usd.toLocaleString('es-PE', { minimumFractionDigits: 2 })}`}
                                    {fondoGroup.totales.comision_pen === 0 && fondoGroup.totales.comision_usd === 0 && '0.00'}
                                  </div>
                                </div>
                                <div className="p-1 text-slate-400">
                                  {isFondoExpanded ? <ChevronDown size={17} /> : <ChevronRight size={17} />}
                                </div>
                              </div>
                            </div>

                            {/* CUERPO NIVEL 2: DETALLE DEL FONDO */}
                            {isFondoExpanded && (
                              <div className="p-3 sm:p-4 border-t border-slate-200 dark:border-slate-800 bg-[#fcfcfd] dark:bg-[#090f20] flex flex-col gap-3">
                                {selectedAsesorCodigo !== 'TODOS' ? (
                                  /* Si ya hay un asesor seleccionado en la cabecera, mostramos la tabla directamente sin anidar otro acordeón redundante */
                                  <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a] shadow-2xs">
                                    <table className="w-full text-left border-collapse">
                                      <thead>
                                        <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/60 text-[10px] font-black uppercase text-slate-500 dark:text-slate-400">
                                          <th className="py-2.5 px-3 w-10 text-center">#</th>
                                          <th className="py-2.5 px-3 min-w-[200px]">Inversionista / Certificado</th>
                                          <th className="py-2.5 px-3 text-right w-[130px]">Capital Base</th>
                                          <th className="py-2.5 px-3 text-center w-[90px]">Tasa Asesor</th>
                                          <th className="py-2.5 px-3 text-center w-[65px]">Días</th>
                                          <th className="py-2.5 px-3 min-w-[300px]">Determinación Matemática (Base 365)</th>
                                          <th className="py-2.5 px-3 text-right w-[130px]">Comisión Neta</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                                        {fondoGroup.participes.map((part, pIdx) => (
                                          <tr 
                                            key={`${part.id_contrato}_${pIdx}`}
                                            className="hover:bg-indigo-50/30 dark:hover:bg-indigo-950/20 transition-colors"
                                          >
                                            <td className="py-2.5 px-3 text-center font-mono text-[11px] font-bold text-slate-400">
                                              {String(pIdx + 1).padStart(2, '0')}
                                            </td>
                                            <td className="py-2.5 px-3">
                                              <div className="font-black text-[#0f172a] dark:text-[#f8fafc] text-xs">
                                                {part.inversionista_nombre}
                                              </div>
                                              <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
                                                <span className="font-semibold text-slate-700 dark:text-slate-300">Cert: {part.id_certificado}</span>
                                                <span>·</span>
                                                <span>Doc: {part.inversionista_dni}</span>
                                              </div>
                                            </td>
                                            <td className="py-2.5 px-3 text-right font-mono font-bold text-[#0f172a] dark:text-[#f8fafc] whitespace-nowrap">
                                              {part.moneda} {part.capital_base.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                                            </td>
                                            <td className="py-2.5 px-3 text-center font-mono font-bold text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
                                              {part.tasa_comision_asesor.toFixed(2)}% aa
                                            </td>
                                            <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-600 dark:text-slate-300 whitespace-nowrap">
                                              {part.dias_devengados} d
                                            </td>
                                            <td className="py-2.5 px-3">
                                              <div className="inline-flex items-center px-2.5 py-1 rounded-lg bg-sky-50 dark:bg-sky-950/40 border border-sky-200/80 dark:border-sky-900/40 text-[10px] font-mono font-bold text-sky-800 dark:text-sky-300 whitespace-nowrap">
                                                {part.determinacion_texto}
                                              </div>
                                            </td>
                                            <td className="py-2.5 px-3 text-right font-mono font-black text-emerald-600 dark:text-emerald-400 whitespace-nowrap text-sm">
                                              {part.moneda} {part.comision_calculada.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                ) : (
                                  /* Si seleccionó TODOS los asesores, se muestra el acordeón por cada Asesor */
                                  asesoresArray.map((asesorGroup) => {
                                    const asesorKey = `${fondoKey}_${asesorGroup.id_asesor}`;
                                    const isAsesorExpanded = !!expandedAsesores[asesorKey];

                                    return (
                                      <div
                                        key={asesorKey}
                                        className="bg-white dark:bg-[#0f172a] border border-slate-200/80 dark:border-slate-800/80 rounded-xl overflow-hidden shadow-2xs"
                                      >
                                        {/* CABECERA NIVEL 3: ASESOR COMERCIAL */}
                                        <div
                                          onClick={() => toggleAsesor(asesorKey)}
                                          className="p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 cursor-pointer select-none bg-slate-50/70 dark:bg-slate-900/40 hover:bg-indigo-50/30 dark:hover:bg-indigo-950/20 transition-colors"
                                        >
                                          <div className="flex items-center gap-2">
                                            <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/40 shrink-0">
                                              <User size={14} />
                                            </div>
                                            <div>
                                              <div className="text-xs font-bold text-[#0f172a] dark:text-[#f8fafc] flex items-center gap-2">
                                                <span>{asesorGroup.nombre_asesor}</span>
                                                <span className="text-[9.5px] font-mono text-slate-500 dark:text-slate-400">
                                                  ({asesorGroup.id_asesor})
                                                </span>
                                              </div>
                                              <div className="text-[10px] text-[#64748b] dark:text-[#94a3b8]">
                                                {asesorGroup.totales.count_participes} Partícipes ({asesorGroup.totales.count_contratos} Operaciones)
                                              </div>
                                            </div>
                                          </div>

                                          <div className="flex items-center gap-3 self-end sm:self-center">
                                            <div className="text-right">
                                              <div className="text-[9px] font-black uppercase text-[#64748b] dark:text-[#94a3b8]">
                                                Comisión Asesor
                                              </div>
                                              <div className="text-xs font-mono font-black text-emerald-600 dark:text-emerald-400">
                                                {asesorGroup.totales.comision_pen > 0 && `PEN ${asesorGroup.totales.comision_pen.toLocaleString('es-PE', { minimumFractionDigits: 2 })}`}
                                                {asesorGroup.totales.comision_pen > 0 && asesorGroup.totales.comision_usd > 0 && ' │ '}
                                                {asesorGroup.totales.comision_usd > 0 && `USD ${asesorGroup.totales.comision_usd.toLocaleString('es-PE', { minimumFractionDigits: 2 })}`}
                                              </div>
                                            </div>
                                            <div className="p-1 text-slate-400">
                                              {isAsesorExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                                            </div>
                                          </div>
                                        </div>

                                        {/* CUERPO NIVEL 3: DETALLE DE PARTÍCIPES */}
                                        {isAsesorExpanded && (
                                          <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a]">
                                            <div className="overflow-x-auto rounded-lg border border-slate-200/80 dark:border-slate-800/80">
                                              <table className="w-full text-left border-collapse">
                                                <thead>
                                                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/60 text-[10px] font-black uppercase text-slate-500 dark:text-slate-400">
                                                    <th className="py-2.5 px-3 w-10 text-center">#</th>
                                                    <th className="py-2.5 px-3 min-w-[200px]">Inversionista / Certificado</th>
                                                    <th className="py-2.5 px-3 text-right w-[130px]">Capital Base</th>
                                                    <th className="py-2.5 px-3 text-center w-[90px]">Tasa Asesor</th>
                                                    <th className="py-2.5 px-3 text-center w-[65px]">Días</th>
                                                    <th className="py-2.5 px-3 min-w-[300px]">Determinación Matemática (Base 365)</th>
                                                    <th className="py-2.5 px-3 text-right w-[130px]">Comisión Neta</th>
                                                  </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                                                  {asesorGroup.participes.map((part, pIdx) => (
                                                    <tr 
                                                      key={`${part.id_contrato}_${pIdx}`}
                                                      className="hover:bg-indigo-50/30 dark:hover:bg-indigo-950/20 transition-colors"
                                                    >
                                                      <td className="py-2.5 px-3 text-center font-mono text-[11px] font-bold text-slate-400">
                                                        {String(pIdx + 1).padStart(2, '0')}
                                                      </td>
                                                      <td className="py-2.5 px-3">
                                                        <div className="font-black text-[#0f172a] dark:text-[#f8fafc] text-xs">
                                                          {part.inversionista_nombre}
                                                        </div>
                                                        <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
                                                          <span className="font-semibold text-slate-700 dark:text-slate-300">Cert: {part.id_certificado}</span>
                                                          <span>·</span>
                                                          <span>Doc: {part.inversionista_dni}</span>
                                                        </div>
                                                      </td>
                                                      <td className="py-2.5 px-3 text-right font-mono font-bold text-[#0f172a] dark:text-[#f8fafc] whitespace-nowrap">
                                                        {part.moneda} {part.capital_base.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                                                      </td>
                                                      <td className="py-2.5 px-3 text-center font-mono font-bold text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
                                                        {part.tasa_comision_asesor.toFixed(2)}% aa
                                                      </td>
                                                      <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-600 dark:text-slate-300 whitespace-nowrap">
                                                        {part.dias_devengados} d
                                                      </td>
                                                      <td className="py-2.5 px-3">
                                                        <div className="inline-flex items-center px-2.5 py-1 rounded-lg bg-sky-50 dark:bg-sky-950/40 border border-sky-200/80 dark:border-sky-900/40 text-[10px] font-mono font-bold text-sky-800 dark:text-sky-300 whitespace-nowrap">
                                                          {part.determinacion_texto}
                                                        </div>
                                                      </td>
                                                      <td className="py-2.5 px-3 text-right font-mono font-black text-emerald-600 dark:text-emerald-400 whitespace-nowrap text-sm">
                                                        {part.moneda} {part.comision_calculada.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                                                      </td>
                                                    </tr>
                                                  ))}
                                                </tbody>
                                              </table>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })
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
