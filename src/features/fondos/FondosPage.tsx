// src/features/fondos/FondosPage.tsx
import React, { useEffect, useState } from 'react';
import { 
  getFondos, 
  upsertFondos, 
  calculateValorCuotaV31,
  getValorCuotaEvents,
  fetchValorCuotaDashboard,
  oficializarCierreValorCuota,
  rollbackCierreValorCuota
} from '../../services/fondosService';
import { getApiBaseUrl } from '../../config/apiConfig';
import type { Fondo, V26FondoReport } from '../../services/fondosService';
import * as XLSX from 'xlsx';
// @ts-ignore
import html2pdf from 'html2pdf.js';
import { LOGO_INANDES_BASE64, LOGO_GEEKSOFT_BASE64 } from '../../assets/base64Images';
import { 
  Loader2, AlertCircle, RefreshCw, Edit2, FileSpreadsheet, FileText, CheckCircle, ChevronRight,
  Plus, Search, Building2, X, Calendar, Trash2
} from 'lucide-react';
import { generatePdfValorCuotaV32 } from '../../utils/pdfGeneratorValorCuotaV32';
import { generateValorCuotaExcelV31 } from '../../utils/excelGeneratorValorCuotaV31';
import { downloadReportPdf } from '../../utils/pdfDownloadHelper';



export const FondosPage: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<'variables' | 'valorCuota'>('variables');

  // Navegación interna de la pestaña Variables ('list', 'detail', 'edit_plazo')
  const [variablesView, setVariablesView] = useState<'list' | 'detail' | 'edit_plazo'>('list');
  const [selectedFondoCode, setSelectedFondoCode] = useState<string | null>(null);
  const [selectedPlazoId, setSelectedPlazoId] = useState<string | null>(null);

  // Filtros de búsqueda en directorio
  const [searchFondosTerm, setSearchFondosTerm] = useState<string>('');
  const [filterMoneda, setFilterMoneda] = useState<'TODAS' | 'PEN' | 'USD'>('TODAS');

  // Modal de Creación de Nuevo Fondo
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [createFormData, setCreateFormData] = useState<Partial<Fondo> & {
    tasa12?: number;
    tasa24?: number;
    tasa36?: number;
    tasa60?: number;
    tasaND?: number;
  }>({
    id_fondo: '',
    nombre_fondo: '',
    moneda: 'PEN',
    ruc_fondo: '',
    tamanho_maximo_fondo: 30000000,
    monto_minimo_inversion: 50000,
    frecuencia_cupones_meses: 2,
    comision_administracion_fondo: 1,
    comision_captacion_fondo: 2,
    comision_miscelaneos_fondo: 0,
    vigencia_tasa: '2026',
    activo: true,
    tasa12: 8.5,
    tasa24: 9.0,
    tasa36: 9.5,
    tasa60: 10.0,
    tasaND: 10.5
  });
  const [createSubmitLoading, setCreateSubmitLoading] = useState<boolean>(false);
  const [createSubmitError, setCreateSubmitError] = useState<string | null>(null);

  // Estados de datos de fondos
  const [fondos, setFondos] = useState<Fondo[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Estado del formulario de Datos Maestros (Edición en lote)
  const [maestroFormData, setMaestroFormData] = useState<Partial<Fondo>>({});
  const [maestroSubmitSuccess, setMaestroSubmitSuccess] = useState<boolean>(false);
  const [maestroSubmitError, setMaestroSubmitError] = useState<string | null>(null);

  // Estado del formulario de Plazo Individual
  const [plazoFormData, setPlazoFormData] = useState<Partial<Fondo>>({});
  const [plazoSubmitSuccess, setPlazoSubmitSuccess] = useState<boolean>(false);
  const [plazoSubmitError, setPlazoSubmitError] = useState<string | null>(null);

  // Estados del seguimiento y oficialización de Valor Cuota V27
  const [vcSelFondo, setVcSelFondo] = useState<string>('TODOS');
  const [vcSelYear, setVcSelYear] = useState<number>(2026);
  const [vcSelTipo, setVcSelTipo] = useState<'Bimestre' | 'Trimestre'>('Bimestre');
  const [vcSelNum, setVcSelNum] = useState<number>(1);
  const [vcReportData, setVcReportData] = useState<V26FondoReport[]>([]);
  const [vcLoading, setVcLoading] = useState<boolean>(false);
  const [vcExportingExcel, setVcExportingExcel] = useState<boolean>(false);
  const [vcExcelDownloaded, setVcExcelDownloaded] = useState<boolean>(false);
  const [vcExportingPdf, setVcExportingPdf] = useState<boolean>(false);
  const [vcPdfDownloaded, setVcPdfDownloaded] = useState<boolean>(false);
  const [vcDashboard, setVcDashboard] = useState<any>({ B: {}, Q: {} });
  const [vcClosedCount, setVcClosedCount] = useState<number>(0);
  const [vcOficializarLoading, setVcOficializarLoading] = useState<boolean>(false);
  const [vcRollbackLoading, setVcRollbackLoading] = useState<boolean>(false);
  const [vcSuccessMsg, setVcSuccessMsg] = useState<string | null>(null);

  const handleExportVcExcel = async () => {
    setVcExportingExcel(true);
    try {
      let reportsToUse = vcReportData;
      if (reportsToUse.length === 0) {
        const sParts = fStart.split('-').map(Number);
        const eParts = fEnd.split('-').map(Number);
        const start = new Date(sParts[0], sParts[1] - 1, sParts[2]);
        const end = new Date(eParts[0], eParts[1] - 1, eParts[2]);
        const filterFondo = vcSelFondo === 'TODOS' ? null : vcSelFondo;
        reportsToUse = await calculateValorCuotaV31(filterFondo, start, end);
        if (reportsToUse.length === 0) {
          alert("No hay reportes de valor cuota para exportar en Excel.");
          return;
        }
        setVcReportData(reportsToUse);
      }

      await generateValorCuotaExcelV31({
        reports: reportsToUse,
        selYear: vcSelYear,
        fStart,
        fEnd
      });

      setVcExcelDownloaded(true);
    } catch (err: any) {
      alert(`Error generando Excel Maestro de Valor Cuota V31: ${err.message}`);
    } finally {
      setVcExportingExcel(false);
    }
  };

  const handleExportPDFVc = async () => {
    setVcExportingPdf(true);
    try {
      let reportsToUse = vcReportData;
      if (reportsToUse.length === 0) {
        const sParts = fStart.split('-').map(Number);
        const eParts = fEnd.split('-').map(Number);
        const start = new Date(sParts[0], sParts[1] - 1, sParts[2]);
        const end = new Date(eParts[0], eParts[1] - 1, eParts[2]);
        const filterFondo = vcSelFondo === 'TODOS' ? null : vcSelFondo;
        reportsToUse = await calculateValorCuotaV31(filterFondo, start, end);
        if (reportsToUse.length === 0) {
          alert("No hay reportes de valor cuota calculados para exportar en PDF.");
          return;
        }
        setVcReportData(reportsToUse);
      }

      const htmlContent = generatePdfValorCuotaV32({
        reports: reportsToUse,
        fStart,
        fEnd,
        selFondo: vcSelFondo,
        anio: vcSelYear
      });
      const filename = `REPORTE_VALOR_CUOTA_NAV_V32_${fEnd}.pdf`;
      await downloadReportPdf(htmlContent, filename, 'landscape');
      setVcPdfDownloaded(true);
    } catch (err: any) {
      alert(`Error generando PDF de Valor Cuota V32: ${err.message}`);
    } finally {
      setVcExportingPdf(false);
    }
  };


  const PERIODOS_CIERRE = [
    { id: 'B1', m: 2, mes: 'Febrero', rango: 'Ene - Feb', cycle: 'B1', label: 'Bimestre 1', corte: '28 Feb', cNum: 1, cType: 'Bimestre' as const, funds: ['NSGPEN01', 'NSGPEN02', 'NSGPEN03', 'NSGUSD01', 'NSGUSD02'] },
    { id: 'Q1', m: 3, mes: 'Marzo', rango: 'Ene - Mar', cycle: 'Q1', label: 'Trimestre 1', corte: '31 Mar', cNum: 1, cType: 'Trimestre' as const, funds: ['NSLCON01'] },
    { id: 'B2', m: 4, mes: 'Abril', rango: 'Mar - Abr', cycle: 'B2', label: 'Bimestre 2', corte: '30 Abr', cNum: 2, cType: 'Bimestre' as const, funds: ['NSGPEN01', 'NSGPEN02', 'NSGPEN03', 'NSGUSD01', 'NSGUSD02'] },
    { id: 'B3_Q2', m: 6, mes: 'Junio', rango: 'May - Jun / Q2', cycle: 'B3 / Q2', label: 'Bim. 3 / Q2', corte: '30 Jun', cNum: 3, cType: 'Bimestre' as const, funds: ['NSGPEN01', 'NSGPEN02', 'NSGPEN03', 'NSGUSD01', 'NSGUSD02', 'NSLCON01'] },
    { id: 'B4', m: 8, mes: 'Agosto', rango: 'Jul - Ago', cycle: 'B4', label: 'Bimestre 4', corte: '31 Ago', cNum: 4, cType: 'Bimestre' as const, funds: ['NSGPEN01', 'NSGPEN02', 'NSGPEN03', 'NSGUSD01', 'NSGUSD02'] },
    { id: 'Q3', m: 9, mes: 'Septiembre', rango: 'Jul - Sep', cycle: 'Q3', label: 'Trimestre 3', corte: '30 Sep', cNum: 3, cType: 'Trimestre' as const, funds: ['NSLCON01'] },
    { id: 'B5', m: 10, mes: 'Octubre', rango: 'Sep - Oct', cycle: 'B5', label: 'Bimestre 5', corte: '31 Oct', cNum: 5, cType: 'Bimestre' as const, funds: ['NSGPEN01', 'NSGPEN02', 'NSGPEN03', 'NSGUSD01', 'NSGUSD02'] },
    { id: 'B6_Q4', m: 12, mes: 'Diciembre', rango: 'Nov - Dic / Q4', cycle: 'B6 / Q4', label: 'Bim. 6 / Q4', corte: '31 Dic', cNum: 6, cType: 'Bimestre' as const, funds: ['NSGPEN01', 'NSGPEN02', 'NSGPEN03', 'NSGUSD01', 'NSGUSD02', 'NSLCON01'] }
  ];

  const currentCierre = PERIODOS_CIERRE.find(p => p.cType === vcSelTipo && p.cNum === vcSelNum) || PERIODOS_CIERRE[0];

  const getDates = (y: number, t: 'Bimestre' | 'Trimestre', n: number) => {
    let s_m = 1;
    let e_m = 2;
    if (t === 'Bimestre') {
      s_m = (n - 1) * 2 + 1;
      e_m = s_m + 1;
    } else {
      s_m = (n - 1) * 3 + 1;
      e_m = s_m + 2;
    }
    const formatD = (year: number, month: number, day: number) => {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    };
    const s_d = formatD(y, s_m, 1);
    const lastDay = new Date(y, e_m, 0).getDate();
    const e_d = formatD(y, e_m, lastDay);
    return { fStart: s_d, fEnd: e_d };
  };

  const { fStart, fEnd } = getDates(vcSelYear, vcSelTipo, vcSelNum);

  const fetchFondos = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getFondos();
      setFondos(data);
    } catch (err: any) {
      setError(err.message || 'Error al cargar fondos.');
    } finally {
      setLoading(false);
    }
  };

  const loadVcDashboard = async (year: number) => {
    const dash = await fetchValorCuotaDashboard(year);
    setVcDashboard(dash);
  };

  const checkClosedStatus = async (endDate: string) => {
    const res = await getValorCuotaEvents(endDate);
    setVcClosedCount(res.count);
  };

  useEffect(() => {
    fetchFondos();
  }, []);

  useEffect(() => {
    if (activeSubTab === 'valorCuota') {
      loadVcDashboard(vcSelYear);
      checkClosedStatus(fEnd);
    }
  }, [activeSubTab, vcSelYear, fEnd]);

  const handleCalculateValorCuota = async () => {
    setVcLoading(true);
    try {
      const sParts = fStart.split('-').map(Number);
      const eParts = fEnd.split('-').map(Number);
      const start = new Date(sParts[0], sParts[1] - 1, sParts[2]);
      const end = new Date(eParts[0], eParts[1] - 1, eParts[2]);
      
      const filterFondo = vcSelFondo === 'TODOS' ? null : vcSelFondo;
      const reports = await calculateValorCuotaV31(filterFondo, start, end);
      setVcReportData(reports);
    } catch (err: any) {
      console.error("Error al calcular Valor Cuota V31:", err);
    } finally {
      setVcLoading(false);
    }
  };


  useEffect(() => {
    if (activeSubTab === 'valorCuota') {
      handleCalculateValorCuota();
    }
  }, [activeSubTab, vcSelFondo, vcSelYear, vcSelTipo, vcSelNum]);

  // Handlers para Oficialización y Rollback
  const handleOficializarCierre = async () => {
    if (vcReportData.length === 0) {
      alert("No hay reportes de valor cuota para oficializar.");
      return;
    }
    if (!confirm(`¿Está seguro de oficializar y guardar el cierre de Valor Cuota para el período ${fStart} al ${fEnd}?`)) {
      return;
    }
    setVcOficializarLoading(true);
    setVcSuccessMsg(null);
    try {
      const payloads: any[] = [];
      for (const rep of vcReportData) {
        const f = rep.fondo;
        const bFirst = rep.blocks[0];
        const bLast = rep.blocks[rep.blocks.length - 1];

        const getRowCellVal = (block: any, rowId: string, isLast: boolean = false) => {
          const row = block?.rows?.find((r: any) => r.id === rowId);
          if (!row || !row.cells || row.cells.length === 0) return 0;
          return isLast ? Number(row.cells[row.cells.length - 1]?.val || 0) : Number(row.cells[0]?.val || 0);
        };

        const vcIni = getRowCellVal(bFirst, 'VAL CUOTA INICIAL', false) || 1.0;
        const vcFin = getRowCellVal(bLast, 'VAL CUOTA FINAL', true) || 1.0;
        const patApertura = getRowCellVal(bFirst, 'TOTAL CAPITAL (Apertura)', false);
        const patCierre = getRowCellVal(bLast, 'PATRIMONIO TOTAL CIERRE', true);
        const cuotasApertura = getRowCellVal(bFirst, 'CUOTAS APERTURA', false);
        const cuotasCierre = getRowCellVal(bLast, '(=) CUOTAS TOTALES CIERRE', true);
        const capAdicional = rep.blocks.reduce((acc, b) => {
          const row = b.rows.find((r: any) => r.id === '(+) CAPITAL ADICIONAL (Hoy)');
          return acc + (row ? row.cells.reduce((sum: number, c: any) => sum + Number(c.val || 0), 0) : 0);
        }, 0);
        const ingBrutos = rep.blocks.reduce((acc, b) => {
          const row = b.rows.find((r: any) => r.id === 'GANANCIA TOTAL BRUTA (Base 360)');
          return acc + (row ? row.cells.reduce((sum: number, c: any) => sum + Number(c.val || 0), 0) : 0);
        }, 0);
        const comAdmin = rep.blocks.reduce((acc, b) => {
          const row = b.rows.find((r: any) => r.id === 'COM. ADMIN (-) (Base 365)');
          return acc + (row ? row.cells.reduce((sum: number, c: any) => sum + Number(c.val || 0), 0) : 0);
        }, 0);
        const comCapt = rep.blocks.reduce((acc, b) => {
          const row = b.rows.find((r: any) => r.id === 'COM. CAPT. (-) (Base 365)');
          return acc + (row ? row.cells.reduce((sum: number, c: any) => sum + Number(c.val || 0), 0) : 0);
        }, 0);
        const comMisc = rep.blocks.reduce((acc, b) => {
          const row = b.rows.find((r: any) => r.id === 'COM. MISC. (-)');
          return acc + (row ? row.cells.reduce((sum: number, c: any) => sum + Number(c.val || 0), 0) : 0);
        }, 0);

        payloads.push({
          id_fondo: f.id_fondo,
          nombre_fondo: f.nombre_fondo,
          fecha_corte: fEnd,
          anio: vcSelYear,
          ciclo: vcSelTipo,
          num_periodo: vcSelNum,
          fecha_inicio_periodo: fStart,
          fecha_fin_periodo: fEnd,
          valor_cuota_inicial: vcIni,
          valor_cuota_final: vcFin,
          patrimonio_apertura: patApertura,
          patrimonio_cierre: patCierre,
          cuotas_apertura: cuotasApertura,
          cuotas_totales_cierre: cuotasCierre,
          capital_adicional_periodo: capAdicional,
          ingresos_brutos_periodo: ingBrutos,
          pago_inversionistas_periodo: 0,
          comision_admin_periodo: comAdmin,
          comision_captacion_periodo: comCapt,
          comision_misc_periodo: comMisc,
          tasa_activa_anual: Number(f.tasa_activa || 14.0),
          payload_resumen: { blocksCount: rep.blocks.length }
        });
      }

      await oficializarCierreValorCuota(payloads);
      setVcSuccessMsg(`✓ Período ${fStart} al ${fEnd} oficializado con éxito (${payloads.length} fondos registrados).`);
      await loadVcDashboard(vcSelYear);
      await checkClosedStatus(fEnd);
    } catch (err: any) {
      alert(`Error al oficializar cierre: ${err.message}`);
    } finally {
      setVcOficializarLoading(false);
    }
  };

  const handleRollbackCierre = async () => {
    if (!confirm(`⚠️ ATENCIÓN: ¿Está seguro de eliminar los asientos de Valor Cuota al corte ${fEnd} y reabrir el período? Esta acción es irreversible.`)) {
      return;
    }
    setVcRollbackLoading(true);
    setVcSuccessMsg(null);
    try {
      await rollbackCierreValorCuota(fEnd);
      setVcSuccessMsg(`✓ Período al corte ${fEnd} reabierto con éxito (asientos eliminados).`);
      await loadVcDashboard(vcSelYear);
      await checkClosedStatus(fEnd);
    } catch (err: any) {
      alert(`Error al reabrir período: ${err.message}`);
    } finally {
      setVcRollbackLoading(false);
    }
  };

  const uniqueFondosList = Array.from(
    new Map(fondos.map(f => [f.id_fondo, f])).values()
  );
  const fondosDelCierre = uniqueFondosList.filter(f => currentCierre.funds.includes(f.id_fondo));

  // Crear Nuevo Fondo y auto-generar sus 4 plazos estándar
  const handleCreateFondoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateSubmitError(null);
    setCreateSubmitLoading(true);

    if (!createFormData.id_fondo || !createFormData.nombre_fondo) {
      setCreateSubmitError("Por favor completa el código y el nombre del fondo.");
      setCreateSubmitLoading(false);
      return;
    }

    const code = createFormData.id_fondo.trim().toUpperCase();

    try {
      // Auto-generar plazos estándar configurados: 12, 24, 36, 60, ND
      const plazosConfig = [
        { plazo: '12', tasa: createFormData.tasa12 ?? 8.5 },
        { plazo: '24', tasa: createFormData.tasa24 ?? 9.0 },
        { plazo: '36', tasa: createFormData.tasa36 ?? 9.5 },
        { plazo: '60', tasa: createFormData.tasa60 ?? 10.0 },
        { plazo: 'ND', tasa: createFormData.tasaND ?? 10.5 }
      ];

      const batchNewFondos: Fondo[] = plazosConfig.map(cfg => ({
        id_fondo_plazo: `${code}-${cfg.plazo}`,
        id_fondo: code,
        nombre_fondo: createFormData.nombre_fondo!,
        moneda: createFormData.moneda || 'PEN',
        ruc_fondo: createFormData.ruc_fondo || null,
        tamanho_maximo_fondo: createFormData.tamanho_maximo_fondo || 30000000,
        fecha_cierre_fondo: createFormData.fecha_cierre_fondo || '2030-12-31',
        frecuencia_cupones_meses: createFormData.frecuencia_cupones_meses || 2,
        comision_administracion_fondo: createFormData.comision_administracion_fondo || 1,
        comision_captacion_fondo: createFormData.comision_captacion_fondo || 2,
        comision_miscelaneos_fondo: createFormData.comision_miscelaneos_fondo || 0,
        monto_minimo_inversion: createFormData.monto_minimo_inversion || 50000,
        vigencia_tasa: createFormData.vigencia_tasa || '2026',
        activo: createFormData.activo ?? true,
        plazo_inversion: cfg.plazo,
        tasa: cfg.tasa,
        tasa_activa: 14.0,
        penalidad_rescate: 2.0,
        plazo_rescate_meses: cfg.plazo === 'ND' ? 0 : 12,
        plazo_opcion_de_rescate_dias: 120,
        valor_cuota_inicial: 1.0,
        comision_asesor_mantenimiento: 0,
        comision_asesor_primer_ano: 0,
        comision_asesor_unica: 1.0
      }));

      await upsertFondos(batchNewFondos);
      setIsCreateModalOpen(false);
      fetchFondos();
    } catch (err: any) {
      setCreateSubmitError(err.message || 'Error al registrar el nuevo fondo.');
    } finally {
      setCreateSubmitLoading(false);
    }
  };

  // Exportar / Descargar PDF Oficial de Directorio Maestro de Fondos (Servidor FastAPI Binary)
  const handleExportMaestroPdf = async () => {
    if (fondos.length === 0) return;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>REPORTE MAESTRO DE FONDOS Y TASAS - INANDES</title>
          <style>
            body { font-family: 'Inter', system-ui, sans-serif; color: #0f172a; margin: 25px; font-size: 9pt; }
            .top-header { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
            .top-header td { border: none; vertical-align: middle; }
            .logo-geeksoft { height: 68px; width: auto; }
            .logo-inandes { height: 38px; width: auto; }
            .title { font-size: 13pt; font-weight: 900; color: #0f172a; text-align: center; text-transform: uppercase; margin: 0; }
            .subtitle { font-size: 8.5pt; font-weight: 700; color: #334155; text-align: center; margin-top: 2px; }
            table.data-table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            table.data-table th { background-color: #0f172a; color: white; padding: 6px 8px; font-size: 8pt; font-weight: 800; text-transform: uppercase; text-align: left; }
            table.data-table td { border-bottom: 1px solid #cbd5e1; padding: 6px 8px; font-size: 8.5pt; }
            .badge-usd { background-color: #ecfdf5; color: #047857; font-weight: bold; padding: 2px 6px; border-radius: 4px; }
            .badge-pen { background-color: #eff6ff; color: #1d4ed8; font-weight: bold; padding: 2px 6px; border-radius: 4px; }
            .footer { margin-top: 30px; font-size: 7.5pt; text-align: center; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 8px; }
          </style>
        </head>
        <body>
          <table class="top-header">
            <tr>
              <td style="width: 25%;">
                <img src="data:image/png;base64,${LOGO_GEEKSOFT_BASE64}" class="logo-geeksoft" alt="Geeksoft">
              </td>
              <td style="width: 50%; text-align: center;">
                <div class="title">INANDES ACTIVOS ALTERNATIVOS S.A.C.</div>
                <div class="subtitle">DIRECTORIO MAESTRO DE FONDOS DE INVERSIÓN Y TASAS VIGENTES</div>
              </td>
              <td style="width: 25%; text-align: right;">
                <img src="data:image/jpeg;base64,${LOGO_INANDES_BASE64}" class="logo-inandes" alt="InAndes">
              </td>
            </tr>
          </table>

          <table class="data-table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Nombre del Fondo</th>
                <th>Moneda</th>
                <th>RUC</th>
                <th>Vigencia</th>
                <th>Desglose de Tasas TEA por Plazo</th>
                <th>Com. Admin %</th>
                <th>Com. Capt %</th>
              </tr>
            </thead>
            <tbody>
              ${Object.entries(groupedFondos).map(([code, rows]) => {
                const header = rows[0];
                const tasasStr = rows
                  .sort((a, b) => (a.plazo_inversion === 'ND' ? 99 : parseInt(a.plazo_inversion)) - (b.plazo_inversion === 'ND' ? 99 : parseInt(b.plazo_inversion)))
                  .map(r => `${r.plazo_inversion === 'ND' ? 'ND' : r.plazo_inversion + 'M'}: ${r.tasa ?? 0}%`)
                  .join(' | ');
                const monedaClass = header.moneda === 'USD' ? 'badge-usd' : 'badge-pen';

                return `
                  <tr>
                    <td><strong>${code}</strong></td>
                    <td>${header.nombre_fondo}</td>
                    <td><span class="${monedaClass}">${header.moneda}</span></td>
                    <td>${header.ruc_fondo || '-'}</td>
                    <td>${header.vigencia_tasa || '-'}</td>
                    <td><strong>${tasasStr}</strong></td>
                    <td>${header.comision_administracion_fondo || 0}%</td>
                    <td>${header.comision_captacion_fondo || 0}%</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>

          <div class="footer">
            INANDES GRUPO FINANCIERO &amp; GEEKSOFT — AUDITORÍA Y CONTROL DE CALIDAD DE FONDOS MAESTROS
          </div>
        </body>
      </html>
    `;

    try {
      const bodyContent = htmlContent
        .replace(/^[\s\S]*?<body[^>]*>/i, '')
        .replace(/<\/body>[\s\S]*$/i, '');
      const headStyles = (htmlContent.match(/<style[\s\S]*?<\/style>/gi) || []).join('\n');
      const printHtml = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">${headStyles}</head><body>${bodyContent}</body></html>`;
      const filename = `Directorio_Maestro_Fondos.pdf`;

      const API_BASE = getApiBaseUrl();
      const response = await fetch(`${API_BASE}/api/inversionistas/generate-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html: printHtml, filename })
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (err: any) {
      alert(`Error descargando PDF: ${err.message}`);
    }
  };

  // Agrupar plazos por id_fondo para la vista list con filtrado
  const term = searchFondosTerm.toLowerCase().trim();
  const groupedFondos: Record<string, Fondo[]> = {};
  for (const f of fondos) {
    const code = f.id_fondo || 'UNKNOWN';
    const matchSearch = !term || (
      code.toLowerCase().includes(term) ||
      (f.nombre_fondo && f.nombre_fondo.toLowerCase().includes(term)) ||
      (f.ruc_fondo && f.ruc_fondo.toLowerCase().includes(term))
    );
    const matchMoneda = filterMoneda === 'TODAS' || f.moneda === filterMoneda;

    if (matchSearch && matchMoneda) {
      if (!groupedFondos[code]) groupedFondos[code] = [];
      groupedFondos[code].push(f);
    }
  }

  // Navegar al detalle
  const handleNavigateDetail = (code: string) => {
    setSelectedFondoCode(code);
    const related = groupedFondos[code] || [];
    if (related.length > 0) {
      setMaestroFormData({ ...related[0] });
    }
    setVariablesView('detail');
  };

  // Navegar a la edición de plazo
  const handleNavigateEditPlazo = (plazoId: string) => {
    setSelectedPlazoId(plazoId);
    const item = fondos.find(f => f.id_fondo_plazo === plazoId);
    if (item) {
      setPlazoFormData({ ...item });
    }
    setVariablesView('edit_plazo');
  };

  // Guardar Datos Maestros (Edición en lote para todos los plazos del fondo)
  const handleMaestroSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMaestroSubmitError(null);
    setMaestroSubmitSuccess(false);

    if (!selectedFondoCode) return;
    const relatedPlazos = groupedFondos[selectedFondoCode] || [];
    if (relatedPlazos.length === 0) return;

    try {
      const updates = relatedPlazos.map(p => ({
        ...p,
        nombre_fondo: maestroFormData.nombre_fondo || p.nombre_fondo,
        moneda: maestroFormData.moneda || p.moneda,
        ruc_fondo: maestroFormData.ruc_fondo ?? p.ruc_fondo,
        tamanho_maximo_fondo: maestroFormData.tamanho_maximo_fondo ?? p.tamanho_maximo_fondo,
        fecha_cierre_fondo: maestroFormData.fecha_cierre_fondo ?? p.fecha_cierre_fondo,
        frecuencia_cupones_meses: maestroFormData.frecuencia_cupones_meses ?? p.frecuencia_cupones_meses,
        comision_administracion_fondo: maestroFormData.comision_administracion_fondo ?? p.comision_administracion_fondo,
        comision_captacion_fondo: maestroFormData.comision_captacion_fondo ?? p.comision_captacion_fondo,
        comision_miscelaneos_fondo: maestroFormData.comision_miscelaneos_fondo ?? p.comision_miscelaneos_fondo,
        monto_minimo_inversion: maestroFormData.monto_minimo_inversion ?? p.monto_minimo_inversion,
        vigencia_tasa: maestroFormData.vigencia_tasa ?? p.vigencia_tasa,
        activo: maestroFormData.activo ?? p.activo
      }));

      await upsertFondos(updates);
      setMaestroSubmitSuccess(true);
      fetchFondos();
    } catch (err: any) {
      setMaestroSubmitError(err.message || 'Error al actualizar Datos Maestros.');
    }
  };

  // Guardar Condiciones de Plazo Individual
  const handlePlazoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPlazoSubmitError(null);
    setPlazoSubmitSuccess(false);

    if (!selectedPlazoId) return;

    try {
      await upsertFondos([plazoFormData as Fondo]);
      setPlazoSubmitSuccess(true);
      fetchFondos();
      setTimeout(() => {
        setVariablesView('detail');
      }, 1000);
    } catch (err: any) {
      setPlazoSubmitError(err.message || 'Error al guardar condiciones del plazo.');
    }
  };

  // Exportar lista general de fondos a Excel
  const handleExportMaestroExcel = () => {
    if (fondos.length === 0) return;
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(fondos);
    XLSX.utils.book_append_sheet(wb, ws, 'Maestro Fondos');
    XLSX.writeFile(wb, 'fondos_crm.xlsx');
  };




  return (
    <div className="flex flex-col gap-6 w-full animate-fadeIn">
      
      {/* Selector de sub-pestañas superior Estilo APEFAC */}
      <div className="border-b border-[#e2e8f0] dark:border-[#334155] w-full flex items-center justify-between">
        <div className="flex gap-4">
          <button
            className={`py-3 px-2 text-xs font-black tracking-wider uppercase border-b-[3px] cursor-pointer transition-colors ${
              activeSubTab === 'variables' 
                ? 'border-[#0284c7] text-[#0284c7] dark:text-[#38bdf8]' 
                : 'border-transparent text-[#64748b] hover:text-[#0f172a] dark:text-[#94a3b8] dark:hover:text-[#f8fafc]'
            }`}
            onClick={() => {
              setActiveSubTab('variables');
              setVariablesView('list');
            }}
          >
            🏦 Variables Fondos
          </button>
          <button
            className={`py-3 px-2 text-xs font-black tracking-wider uppercase border-b-[3px] cursor-pointer transition-colors ${
              activeSubTab === 'valorCuota' 
                ? 'border-[#0284c7] text-[#0284c7] dark:text-[#38bdf8]' 
                : 'border-transparent text-[#64748b] hover:text-[#0f172a] dark:text-[#94a3b8] dark:hover:text-[#f8fafc]'
            }`}
            onClick={() => setActiveSubTab('valorCuota')}
          >
            📊 Valor Cuota
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* --- SUB-PESTAÑA 1: VARIABLES FONDOS (DIRECTORIO / CONDICIONES) --- */}
      {activeSubTab === 'variables' && (
        <div className="flex flex-col gap-6 w-full animate-fadeIn">

          {/* VISTA 1: DIRECTORIO DE FONDOS (LIST) */}
          {variablesView === 'list' && (
            <div className="flex flex-col gap-6 w-full animate-fadeIn">
              
              {/* Botones de acción general y barra de búsqueda */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 w-full glass-card p-4">
                <div className="flex flex-wrap items-center gap-3 flex-1 w-full sm:w-auto">
                  {/* Búsqueda */}
                  <div className="relative flex-1 max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                    <input
                      type="text"
                      className="w-full bg-[#f8fafc] dark:bg-[#0b0f19] border border-[#e2e8f0] dark:border-[#334155] rounded-lg py-1.5 pl-8 pr-3 text-xs font-semibold text-[#0f172a] dark:text-[#f8fafc] placeholder-slate-400 focus:outline-none focus:border-[#0284c7] shadow-xs"
                      placeholder="Buscar por Nombre, Código o RUC..."
                      value={searchFondosTerm}
                      onChange={(e) => setSearchFondosTerm(e.target.value)}
                    />
                  </div>

                  {/* Filtro Moneda */}
                  <select
                    className="bg-[#f8fafc] dark:bg-[#0b0f19] border border-[#e2e8f0] dark:border-[#334155] rounded-lg py-1.5 px-3 text-xs font-semibold text-[#0f172a] dark:text-[#f8fafc] focus:outline-none shadow-xs cursor-pointer"
                    value={filterMoneda}
                    onChange={(e) => setFilterMoneda(e.target.value as any)}
                  >
                    <option value="TODAS">TODAS LAS MONEDAS</option>
                    <option value="PEN">Soles (PEN)</option>
                    <option value="USD">Dólares (USD)</option>
                  </select>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button 
                    className="h-9 text-xs font-bold flex items-center gap-1.5 px-4 rounded-lg bg-[#0284c7] hover:bg-[#0369a1] text-white cursor-pointer shadow-xs transition-all"
                    onClick={() => setIsCreateModalOpen(true)}
                  >
                    <Plus size={14} />
                    <span>Nuevo Fondo</span>
                  </button>

                  <button 
                    className="h-9 text-xs font-bold flex items-center gap-1.5 px-3 rounded-lg border border-[#e2e8f0] dark:border-[#334155] bg-white dark:bg-[#1e293b] hover:bg-[#f8fafc] text-[#475569] dark:text-[#cbd5e1] cursor-pointer transition-colors shadow-xs"
                    onClick={handleExportMaestroPdf}
                    disabled={fondos.length === 0}
                  >
                    <FileText size={13} className="text-[#e11d48]" />
                    <span>PDF</span>
                  </button>

                  <button 
                    className="h-9 text-xs font-bold flex items-center gap-1.5 px-3 rounded-lg border border-[#e2e8f0] dark:border-[#334155] bg-white dark:bg-[#1e293b] hover:bg-[#ecfdf5] text-[#475569] dark:text-[#cbd5e1] hover:text-[#059669] cursor-pointer transition-colors shadow-xs"
                    onClick={handleExportMaestroExcel}
                    disabled={fondos.length === 0}
                  >
                    <FileSpreadsheet size={13} className="text-[#059669]" />
                    <span>Excel</span>
                  </button>

                  <button 
                    className="h-9 text-xs font-bold flex items-center gap-1.5 px-3 rounded-lg border border-[#e2e8f0] dark:border-[#334155] bg-white dark:bg-[#1e293b] hover:bg-[#f8fafc] text-[#475569] dark:text-[#cbd5e1] cursor-pointer transition-colors shadow-xs"
                    onClick={fetchFondos}
                    disabled={loading}
                  >
                    <RefreshCw size={13} className={loading ? 'animate-spin text-[#0284c7]' : ''} />
                  </button>
                </div>
              </div>

              {/* Grid de Fondos */}
              {loading ? (
                <div className="flex flex-col items-center justify-center py-24 text-center gap-3">
                  <Loader2 className="animate-spin text-emerald-600" size={35} />
                  <p className="text-xs text-slate-450 dark:text-slate-500 font-bold uppercase tracking-wider">Cargando directorio de fondos...</p>
                </div>
              ) : error ? (
                <div className="max-w-md mx-auto my-12 bg-white dark:bg-slate-800 border border-rose-200 dark:border-rose-950 p-6 rounded-2xl shadow-sm text-center flex flex-col items-center gap-3">
                  <AlertCircle className="text-rose-600" size={40} />
                  <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 tracking-tight uppercase">Error de Conexión</h3>
                  <p className="text-xs text-slate-450 dark:text-slate-400 leading-relaxed">{error}</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full">
                  {Object.entries(groupedFondos).map(([code, rows]) => {
                    const h = rows[0];
                    const isActive = h.activo ?? true;
                    return (
                      <div 
                        key={code}
                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between gap-4"
                      >
                        <div className="flex flex-col gap-1.5 min-h-[50px]">
                          <div className="flex items-center justify-between w-full">
                            <h4 className="text-sm font-bold text-slate-850 dark:text-slate-150 truncate leading-snug">
                              {h.nombre_fondo}
                            </h4>
                            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full shrink-0 ${
                              isActive ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-450' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                            }`}>
                              {isActive ? 'Activo' : 'Inactivo'}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-450 dark:text-slate-550 font-bold uppercase tracking-wider">
                            {h.moneda === 'USD' ? '💵 Dólares (USD)' : '🪙 Soles (PEN)'} | Vigencia {h.vigencia_tasa || 'N/A'}
                          </span>
                        </div>

                        <div className="flex flex-col gap-2 border-t border-slate-100 dark:border-slate-800/50 pt-3">
                          <div className="flex justify-between items-center text-[10px]">
                            <span className="text-slate-400 dark:text-slate-500 font-bold uppercase">RUC del Fondo</span>
                            <span className="font-semibold text-slate-700 dark:text-slate-350">{h.ruc_fondo || 'N/A'}</span>
                          </div>
                          <div className="flex justify-between items-center text-[10px]">
                            <span className="text-slate-400 dark:text-slate-500 font-bold uppercase">Tamaño Máximo</span>
                            <span className="font-mono font-semibold text-slate-700 dark:text-slate-350">
                              {h.tamanho_maximo_fondo ? h.tamanho_maximo_fondo.toLocaleString('es-PE') : 'N/A'}
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-[10px]">
                            <span className="text-slate-400 dark:text-slate-500 font-bold uppercase">Admin / Captación</span>
                            <span className="font-semibold text-slate-750 dark:text-slate-350">
                              {h.comision_administracion_fondo || 0}% / {h.comision_captacion_fondo || 0}%
                            </span>
                          </div>

                          {/* Matriz de Tasas TEA por Plazo */}
                          <div className="bg-slate-50 dark:bg-slate-950/60 p-2.5 rounded-lg border border-slate-150 dark:border-slate-800/80 flex flex-col gap-1.5 my-1">
                            <span className="text-[9px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">
                              📊 Tasas TEA por Plazo
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {rows
                                .sort((a, b) => (a.plazo_inversion === 'ND' ? 99 : parseInt(a.plazo_inversion)) - (b.plazo_inversion === 'ND' ? 99 : parseInt(b.plazo_inversion)))
                                .map((r) => {
                                  const pLabel = r.plazo_inversion === 'ND' ? 'ND' : `${r.plazo_inversion}M`;
                                  return (
                                    <div key={r.id_fondo_plazo || r.plazo_inversion} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-2 py-1 rounded text-[10px] flex items-center gap-1 shadow-2xs">
                                      <span className="font-bold text-slate-500 dark:text-slate-400">{pLabel}:</span>
                                      <span className="font-black text-emerald-600 dark:text-emerald-450">{r.tasa ?? 0}%</span>
                                    </div>
                                  );
                                })}
                            </div>
                          </div>
                        </div>

                        <div className="border-t border-slate-150 dark:border-slate-800/80 pt-4 mt-1">
                          <button
                            className="w-full h-8.5 text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 px-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800 hover:bg-emerald-55 hover:text-white dark:hover:bg-emerald-600 transition-colors cursor-pointer text-slate-655 dark:text-slate-300"
                            onClick={() => handleNavigateDetail(code)}
                          >
                            <span>Gestionar Plazos ({rows.length})</span>
                            <ChevronRight size={12} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

            </div>
          )}

          {/* VISTA 2: GESTION DE VARIANTES Y MAESTRO (DETAIL) */}
          {variablesView === 'detail' && selectedFondoCode && (
            <div className="flex flex-col gap-6 w-full animate-fadeIn">
              
              <div className="flex items-center gap-2">
                <button
                  className="h-8 text-[10px] font-bold px-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer hover:bg-slate-50 transition-colors"
                  onClick={() => setVariablesView('list')}
                >
                  ⬅ Volver al Directorio
                </button>
              </div>

              {/* SECCIÓN 1: DATOS MAESTROS */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm flex flex-col gap-4">
                <div className="flex flex-col gap-0.5">
                  <h3 className="text-xs font-black text-slate-850 dark:text-slate-150 uppercase tracking-tight">🏦 Sección 1: Datos Maestros del Fondo</h3>
                  <p className="text-[10px] text-slate-400">Las modificaciones de esta sección se replicarán en lote para todos los plazos/variantes de este fondo.</p>
                </div>

                <form onSubmit={handleMaestroSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Nombre del Fondo</label>
                    <input
                      type="text"
                      className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                      value={maestroFormData.nombre_fondo || ''}
                      onChange={(e) => setMaestroFormData(prev => ({ ...prev, nombre_fondo: e.target.value }))}
                      required
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Moneda</label>
                    <select
                      className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                      value={maestroFormData.moneda || 'PEN'}
                      onChange={(e) => setMaestroFormData(prev => ({ ...prev, moneda: e.target.value }))}
                    >
                      <option value="PEN">Soles (PEN)</option>
                      <option value="USD">Dólares (USD)</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">RUC del Fondo</label>
                    <input
                      type="text"
                      className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                      value={maestroFormData.ruc_fondo || ''}
                      onChange={(e) => setMaestroFormData(prev => ({ ...prev, ruc_fondo: e.target.value }))}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Tamaño Máximo</label>
                    <input
                      type="number"
                      className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                      value={maestroFormData.tamanho_maximo_fondo || 0}
                      onChange={(e) => setMaestroFormData(prev => ({ ...prev, tamanho_maximo_fondo: Number(e.target.value) || 0 }))}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Fecha Cierre Fondo</label>
                    <input
                      type="date"
                      className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                      value={maestroFormData.fecha_cierre_fondo || ''}
                      onChange={(e) => setMaestroFormData(prev => ({ ...prev, fecha_cierre_fondo: e.target.value }))}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Frecuencia Cupones (Meses)</label>
                    <input
                      type="number"
                      min={1}
                      max={12}
                      className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                      value={maestroFormData.frecuencia_cupones_meses || 1}
                      onChange={(e) => setMaestroFormData(prev => ({ ...prev, frecuencia_cupones_meses: Number(e.target.value) || 1 }))}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Com. Administración Fondo (%)</label>
                    <input
                      type="number"
                      step="any"
                      className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                      value={maestroFormData.comision_administracion_fondo ?? 0}
                      onChange={(e) => setMaestroFormData(prev => ({ ...prev, comision_administracion_fondo: Number(e.target.value) || 0 }))}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Com. Captación Fondo (%)</label>
                    <input
                      type="number"
                      step="any"
                      className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                      value={maestroFormData.comision_captacion_fondo ?? 0}
                      onChange={(e) => setMaestroFormData(prev => ({ ...prev, comision_captacion_fondo: Number(e.target.value) || 0 }))}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Com. Misceláneos (%)</label>
                    <input
                      type="number"
                      step="any"
                      className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                      value={maestroFormData.comision_miscelaneos_fondo ?? 0}
                      onChange={(e) => setMaestroFormData(prev => ({ ...prev, comision_miscelaneos_fondo: Number(e.target.value) || 0 }))}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Inversión Mínima</label>
                    <input
                      type="number"
                      className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                      value={maestroFormData.monto_minimo_inversion || 0}
                      onChange={(e) => setMaestroFormData(prev => ({ ...prev, monto_minimo_inversion: Number(e.target.value) || 0 }))}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Vigencia Tasa (Año)</label>
                    <input
                      type="text"
                      className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                      value={maestroFormData.vigencia_tasa || ''}
                      onChange={(e) => setMaestroFormData(prev => ({ ...prev, vigencia_tasa: e.target.value }))}
                    />
                  </div>

                  <div className="flex items-center gap-2 mt-6">
                    <input
                      type="checkbox"
                      id="activo_maestro"
                      className="rounded text-emerald-600 focus:ring-emerald-600 h-4 w-4"
                      checked={maestroFormData.activo ?? true}
                      onChange={(e) => setMaestroFormData(prev => ({ ...prev, activo: e.target.checked }))}
                    />
                    <label htmlFor="activo_maestro" className="text-xs font-bold text-slate-700 dark:text-slate-400">¿Fondo Activo (Visible)?</label>
                  </div>

                  <div className="col-span-full flex items-center justify-end gap-2.5 mt-2">
                    {maestroSubmitError && (
                      <span className="text-[11px] font-semibold text-rose-600">{maestroSubmitError}</span>
                    )}
                    {maestroSubmitSuccess && (
                      <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
                        <CheckCircle size={12} /> Actualizado con éxito en lote
                      </span>
                    )}
                    <button
                      type="submit"
                      className="h-9 px-6 text-xs font-black uppercase tracking-wider bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg cursor-pointer shadow-sm transition-colors"
                    >
                      💾 Guardar Datos Maestros
                    </button>
                  </div>
                </form>
              </div>

              {/* SECCIÓN 2: PLAZOS DE INVERSIÓN */}
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-0.5">
                  <h3 className="text-xs font-black text-slate-850 dark:text-slate-150 uppercase tracking-tight">⏱️ Sección 2: Plazos de Inversión (Variantes)</h3>
                  <p className="text-[10px] text-slate-400">Cada tarjeta corresponde a un plazo específico configurado para este fondo.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 w-full">
                  {(groupedFondos[selectedFondoCode] || [])
                    .sort((a, b) => {
                      if (a.plazo_inversion === 'ND') return 1;
                      if (b.plazo_inversion === 'ND') return -1;
                      return parseInt(a.plazo_inversion) - parseInt(b.plazo_inversion);
                    })
                    .map((plazoRow) => {
                      const labelPlazo = plazoRow.plazo_inversion === 'ND' ? 'A la Vista (ND)' : `${plazoRow.plazo_inversion} Meses`;
                      return (
                        <div 
                          key={plazoRow.id_fondo_plazo}
                          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm flex flex-col justify-between gap-4"
                        >
                          <div className="flex flex-col gap-2">
                            <span className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase">
                              ⏱️ Plazo: {labelPlazo}
                            </span>
                            <span className="text-[9px] font-mono text-slate-400 dark:text-slate-500">
                              id: `{plazoRow.id_fondo_plazo}`
                            </span>
                            
                            <div className="flex flex-col gap-1.5 border-t border-slate-100 dark:border-slate-800/50 pt-3 mt-1 text-[10px]">
                              <div className="flex justify-between items-center">
                                <span className="text-slate-450 dark:text-slate-500 font-semibold uppercase">Tasa TEA</span>
                                <span className="font-bold text-slate-800 dark:text-slate-350">{plazoRow.tasa || 0}%</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-slate-450 dark:text-slate-500 font-semibold uppercase">Tasa Activa E.</span>
                                <span className="font-bold text-slate-800 dark:text-slate-350">{plazoRow.tasa_activa || 0}%</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-slate-450 dark:text-slate-500 font-semibold uppercase">Penalidad Rescate</span>
                                <span className="font-bold text-slate-800 dark:text-slate-350">{plazoRow.penalidad_rescate || 0}%</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-slate-450 dark:text-slate-500 font-semibold uppercase">Permitido Rescate</span>
                                <span className="font-semibold text-slate-700 dark:text-slate-400">{plazoRow.plazo_rescate_meses || 'N/A'} meses</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-slate-450 dark:text-slate-500 font-semibold uppercase">Opción Rescate</span>
                                <span className="font-semibold text-slate-700 dark:text-slate-400">{plazoRow.plazo_opcion_de_rescate_dias || 0} días</span>
                              </div>
                            </div>
                          </div>

                          <div className="border-t border-slate-150 dark:border-slate-800 pt-3">
                            <button
                              className="w-full h-8 text-[10px] font-bold flex items-center justify-center gap-1 bg-slate-50 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200 dark:bg-slate-800 dark:hover:bg-emerald-950/30 dark:hover:text-emerald-450 border border-slate-200 dark:border-slate-800 rounded-lg cursor-pointer transition-colors text-slate-700 dark:text-slate-300"
                              onClick={() => handleNavigateEditPlazo(plazoRow.id_fondo_plazo || '')}
                            >
                              <Edit2 size={10} />
                              <span>Editar Condición Plazo</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

            </div>
          )}

          {/* VISTA 3: EDICIÓN DE CONDICIONES DE UN PLAZO INDIVIDUAL */}
          {variablesView === 'edit_plazo' && selectedPlazoId && (
            <div className="flex flex-col gap-6 w-full animate-fadeIn">
              
              <div className="flex items-center gap-2">
                <button
                  className="h-8 text-[10px] font-bold px-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer hover:bg-slate-50 transition-colors"
                  onClick={() => setVariablesView('detail')}
                >
                  ⬅ Volver a Plazos
                </button>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm flex flex-col gap-4">
                <div className="flex flex-col gap-0.5">
                  <h3 className="text-xs font-black text-slate-850 dark:text-slate-150 uppercase tracking-tight">✏️ Editando Plazo: {selectedPlazoId}</h3>
                  <p className="text-[10px] text-slate-450">Estas tasas y comisiones son específicas y afectarán únicamente a este plazo de inversión.</p>
                </div>

                <form onSubmit={handlePlazoSubmit} className="flex flex-col gap-6 mt-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Tasa TEA (%)</label>
                      <input
                        type="number"
                        step="any"
                        className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                        value={plazoFormData.tasa ?? 0}
                        onChange={(e) => setPlazoFormData(prev => ({ ...prev, tasa: Number(e.target.value) || 0 }))}
                        required
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Tasa Activa Empresa (%)</label>
                      <input
                        type="number"
                        step="any"
                        className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                        value={plazoFormData.tasa_activa ?? 0}
                        onChange={(e) => setPlazoFormData(prev => ({ ...prev, tasa_activa: Number(e.target.value) || 0 }))}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Penalidad Rescate (%)</label>
                      <input
                        type="number"
                        step="any"
                        className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                        value={plazoFormData.penalidad_rescate ?? 0}
                        onChange={(e) => setPlazoFormData(prev => ({ ...prev, penalidad_rescate: Number(e.target.value) || 0 }))}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Rescate Permitido (Meses)</label>
                      <input
                        type="number"
                        className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                        value={plazoFormData.plazo_rescate_meses ?? 0}
                        onChange={(e) => setPlazoFormData(prev => ({ ...prev, plazo_rescate_meses: Number(e.target.value) || 0 }))}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Opción Rescate (Días)</label>
                      <input
                        type="number"
                        className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                        value={plazoFormData.plazo_opcion_de_rescate_dias ?? 0}
                        onChange={(e) => setPlazoFormData(prev => ({ ...prev, plazo_opcion_de_rescate_dias: Number(e.target.value) || 0 }))}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Valor Cuota Inicial</label>
                      <input
                        type="number"
                        step="any"
                        className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                        value={plazoFormData.valor_cuota_inicial ?? 1.0}
                        onChange={(e) => setPlazoFormData(prev => ({ ...prev, valor_cuota_inicial: Number(e.target.value) || 1.0 }))}
                      />
                    </div>
                  </div>

                  <div className="border-t border-slate-100 dark:border-slate-800/80 pt-4">
                    <h4 className="text-xs font-bold text-slate-805 dark:text-slate-200 uppercase tracking-tight mb-3">Comisiones del Asesor por Plazo</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Com. Mantenimiento Asesor (%)</label>
                        <input
                          type="number"
                          step="any"
                          className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                          value={plazoFormData.comision_asesor_mantenimiento ?? 0}
                          onChange={(e) => setPlazoFormData(prev => ({ ...prev, comision_asesor_mantenimiento: Number(e.target.value) || 0 }))}
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Com. Asesor (1er Año) (%)</label>
                        <input
                          type="number"
                          step="any"
                          className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                          value={plazoFormData.comision_asesor_primer_ano ?? 0}
                          onChange={(e) => setPlazoFormData(prev => ({ ...prev, comision_asesor_primer_ano: Number(e.target.value) || 0 }))}
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Com. Asesor (Única) (%)</label>
                        <input
                          type="number"
                          step="any"
                          className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                          value={plazoFormData.comision_asesor_unica ?? 0}
                          onChange={(e) => setPlazoFormData(prev => ({ ...prev, comision_asesor_unica: Number(e.target.value) || 0 }))}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2.5 mt-2">
                    {plazoSubmitError && (
                      <span className="text-[11px] font-semibold text-rose-600">{plazoSubmitError}</span>
                    )}
                    {plazoSubmitSuccess && (
                      <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
                        <CheckCircle size={12} /> Plazo guardado correctamente.
                      </span>
                    )}
                    <button
                      type="submit"
                      className="h-9 px-6 text-xs font-black uppercase tracking-wider bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg cursor-pointer shadow-sm transition-colors"
                    >
                      💾 Guardar Condiciones Plazo
                    </button>
                  </div>
                </form>
              </div>

            </div>
          )}

        </div>
      )}

      {/* ======================================================== */}
      {/* --- SUB-PESTAÑA 2: SEGUIMIENTO Y CIERRES DE VALOR CUOTA NAV V27 --- */}
      {activeSubTab === 'valorCuota' && (
        <div className="flex flex-col gap-6 w-full animate-fadeIn">
          
          {/* SECCIÓN 1: TABLERO ANUAL DE 12 MESES (CALENDARIO DE CIERRES VALOR CUOTA) */}
          <div className="glass-card p-6 flex flex-col gap-5 border-l-4 border-l-[#0284c7]">
            
            {/* Header del Calendario y Selector de Año */}
            <div className="flex items-center justify-between gap-4 flex-wrap pb-4 border-b border-[#e2e8f0] dark:border-[#334155]">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-[#f0f9ff] text-[#0284c7] dark:bg-[#0284c7]/15 dark:text-[#38bdf8] border border-[#bae6fd] dark:border-[#0284c7]/30 shadow-xs flex items-center justify-center">
                  <Calendar size={22} />
                </div>
                <div>
                  <h3 className="text-xs font-black text-[#0f172a] dark:text-[#f8fafc] uppercase tracking-wider flex items-center gap-2">
                    <span>Cronograma Anual de Cierres · Valor Cuota NAV V27</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#f0f9ff] text-[#0284c7] dark:bg-[#0284c7]/20 dark:text-[#38bdf8] border border-[#bae6fd]">
                      {vcSelYear}
                    </span>
                  </h3>
                  <p className="text-[11px] text-[#64748b] dark:text-[#94a3b8] font-semibold mt-0.5">
                    Supervisión y oficialización de cierres bimestrales (B1-B6) y trimestrales (Q1-Q4) de Valor Cuota.
                  </p>
                </div>
              </div>

              {/* Selector de Año con Pill Buttons */}
              <div className="flex items-center gap-1.5 bg-[#f8fafc] dark:bg-[#0b0f19] p-1 rounded-xl border border-[#e2e8f0] dark:border-[#334155] shadow-xs">
                {[2024, 2025, 2026, 2027].map(year => (
                  <button
                    key={year}
                    type="button"
                    onClick={() => setVcSelYear(year)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                      vcSelYear === year
                        ? 'bg-[#0284c7] text-white shadow-xs'
                        : 'text-[#64748b] hover:text-[#0f172a] dark:text-[#94a3b8] dark:hover:text-[#f8fafc] hover:bg-white dark:hover:bg-[#1e293b]'
                    }`}
                  >
                    {year}
                  </button>
                ))}
              </div>
            </div>

            {/* Grid de 12 Meses Ejecutivo */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
              {[
                { m: 1, name: 'Enero', cycle: null, label: 'Sin Cierres', corte: '-', funds: [] },
                { m: 2, name: 'Febrero', cycle: 'B1', label: 'Bimestre 1', corte: '28 Feb', funds: ['NSGPEN01', 'NSGPEN02', 'NSGPEN03', 'NSGUSD01', 'NSGUSD02'], cNum: 1, cType: 'Bimestre' },
                { m: 3, name: 'Marzo', cycle: 'Q1', label: 'Trimestre 1', corte: '31 Mar', funds: ['NSLCON01'], cNum: 1, cType: 'Trimestre' },
                { m: 4, name: 'Abril', cycle: 'B2', label: 'Bimestre 2', corte: '30 Abr', funds: ['NSGPEN01', 'NSGPEN02', 'NSGPEN03', 'NSGUSD01', 'NSGUSD02'], cNum: 2, cType: 'Bimestre' },
                { m: 5, name: 'Mayo', cycle: null, label: 'Sin Cierres', corte: '-', funds: [] },
                { m: 6, name: 'Junio', cycle: 'B3 / Q2', label: 'Bim. 3 / Q2', corte: '30 Jun', funds: ['NSGPEN01', 'NSGPEN02', 'NSGPEN03', 'NSGUSD01', 'NSGUSD02', 'NSLCON01'], cNum: 3, cType: 'Bimestre' },
                { m: 7, name: 'Julio', cycle: null, label: 'Sin Cierres', corte: '-', funds: [] },
                { m: 8, name: 'Agosto', cycle: 'B4', label: 'Bimestre 4', corte: '31 Ago', funds: ['NSGPEN01', 'NSGPEN02', 'NSGPEN03', 'NSGUSD01', 'NSGUSD02'], cNum: 4, cType: 'Bimestre' },
                { m: 9, name: 'Septiembre', cycle: 'Q3', label: 'Trimestre 3', corte: '30 Sep', funds: ['NSLCON01'], cNum: 3, cType: 'Trimestre' },
                { m: 10, name: 'Octubre', cycle: 'B5', label: 'Bimestre 5', corte: '31 Oct', funds: ['NSGPEN01', 'NSGPEN02', 'NSGPEN03', 'NSGUSD01', 'NSGUSD02'], cNum: 5, cType: 'Bimestre' },
                { m: 11, name: 'Noviembre', cycle: null, label: 'Sin Cierres', corte: '-', funds: [] },
                { m: 12, name: 'Diciembre', cycle: 'B6 / Q4', label: 'Bim. 6 / Q4', corte: '31 Dic', funds: ['NSGPEN01', 'NSGPEN02', 'NSGPEN03', 'NSGUSD01', 'NSGUSD02', 'NSLCON01'], cNum: 6, cType: 'Bimestre' }
              ].map(item => {
                let isClosedInDb = false;
                if (item.m === 2) isClosedInDb = (vcDashboard.B?.[1]?.length || 0) > 0;
                else if (item.m === 3) isClosedInDb = (vcDashboard.Q?.[1]?.length || 0) > 0;
                else if (item.m === 4) isClosedInDb = (vcDashboard.B?.[2]?.length || 0) > 0;
                else if (item.m === 6) isClosedInDb = (vcDashboard.B?.[3]?.length || 0) > 0;
                else if (item.m === 8) isClosedInDb = (vcDashboard.B?.[4]?.length || 0) > 0;
                else if (item.m === 9) isClosedInDb = (vcDashboard.Q?.[3]?.length || 0) > 0;
                else if (item.m === 10) isClosedInDb = (vcDashboard.B?.[5]?.length || 0) > 0;
                else if (item.m === 12) isClosedInDb = (vcDashboard.B?.[6]?.length || 0) > 0;

                const hasCycle = item.funds.length > 0;
                const isSelected = (item.cType === vcSelTipo && item.cNum === vcSelNum);

                return (
                  <div
                    key={item.m}
                    onClick={() => {
                      if (item.cType && item.cNum) {
                        setVcSelTipo(item.cType as any);
                        setVcSelNum(item.cNum);
                        setVcSelFondo('TODOS');
                      }
                    }}
                    className={`rounded-2xl p-3.5 border transition-all flex flex-col justify-between min-h-[160px] ${
                      !hasCycle
                        ? 'bg-slate-50/40 dark:bg-slate-900/20 border-dashed border-[#e2e8f0] dark:border-[#334155] opacity-50'
                        : isSelected
                        ? 'bg-white dark:bg-[#1e293b] border-2 border-[#0284c7] shadow-md shadow-[#0284c7]/20 scale-[1.02] cursor-pointer'
                        : 'bg-white dark:bg-[#1e293b] border border-[#e2e8f0] dark:border-[#334155] hover:border-[#bae6fd] hover:shadow-sm cursor-pointer'
                    }`}
                  >
                    {/* Cabecera del Mes */}
                    <div className="flex items-start justify-between gap-1">
                      <div>
                        <span className="text-[10.5px] font-mono text-[#64748b] dark:text-[#94a3b8] font-bold block">
                          MES {String(item.m).padStart(2, '0')}
                        </span>
                        <span className="text-xs font-black text-[#0f172a] dark:text-[#f8fafc] uppercase tracking-wide">
                          {item.name}
                        </span>
                      </div>

                      {hasCycle && (
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-black uppercase shadow-xs ${
                          isClosedInDb
                            ? 'bg-[#ecfdf5] text-[#059669] border border-[#a7f3d0] dark:bg-[#059669]/20 dark:text-[#34d399]'
                            : 'bg-[#fff1f2] text-[#e11d48] border border-[#fecdd3] dark:bg-[#e11d48]/20 dark:text-[#fb7185]'
                        }`}>
                          {isClosedInDb ? '● REGISTRADO' : '● POR REGISTRAR'}
                        </span>
                      )}
                    </div>

                    {/* Ciclo y Badges de Fondos */}
                    <div className="my-2 flex flex-col gap-1.5">
                      {hasCycle ? (
                        <>
                          <div className="flex items-center justify-between text-[10.5px]">
                            <span className="font-mono font-bold text-[#0284c7] dark:text-[#38bdf8]">
                              {item.cycle}
                            </span>
                            <span className="text-[10px] text-[#64748b] dark:text-[#94a3b8] font-mono font-bold">
                              {item.corte}
                            </span>
                          </div>

                          <div className="flex flex-wrap gap-1">
                            {item.funds.map(f => (
                              <span 
                                key={f} 
                                className="px-1.5 py-0.5 rounded text-[8px] font-mono font-bold bg-slate-100 dark:bg-slate-800/80 text-[#334155] dark:text-[#cbd5e1] border border-slate-200 dark:border-slate-700/60"
                              >
                                {f}
                              </span>
                            ))}
                          </div>
                        </>
                      ) : (
                        <div className="py-2 text-center text-[10px] font-medium text-slate-400 italic">
                          Sin cierres
                        </div>
                      )}
                    </div>

                    {/* Footer del Mes */}
                    <div className="border-t border-[#e2e8f0] dark:border-[#334155] pt-1.5 flex justify-between items-center text-[9.5px] text-[#64748b] dark:text-[#94a3b8] font-bold">
                      <span>{item.label}</span>
                      {hasCycle && (
                        <span className="font-mono text-[#0284c7] dark:text-[#38bdf8]">
                          {isSelected ? '✓ Activo' : 'Seleccionar'}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SECCIÓN 2: PANEL OPERATIVO COMPACTO EN 3 COLUMNAS HORIZONTALES */}
          <div className="glass-card p-5 flex flex-col gap-4">
            
            {/* Header del Panel y Modo Activo */}
            <div className="flex items-center justify-between gap-4 flex-wrap pb-3 border-b border-[#e2e8f0] dark:border-[#334155]">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-black text-[#0f172a] dark:text-[#f8fafc] uppercase tracking-wider">
                  ⚙️ Panel Operativo de Valor Cuota NAV ({fStart} al {fEnd})
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <span className={`px-3 py-1 rounded-lg text-[11px] font-mono font-black tracking-wider uppercase border flex items-center gap-1.5 shadow-xs ${
                  vcClosedCount > 0 
                    ? 'bg-[#ecfdf5] dark:bg-[#059669]/15 text-[#059669] dark:text-[#34d399] border-[#a7f3d0] dark:border-[#059669]/30' 
                    : 'bg-[#fff1f2] dark:bg-[#e11d48]/15 text-[#e11d48] dark:text-[#fb7185] border-[#fecdd3] dark:border-[#e11d48]/30'
                }`}>
                  {vcClosedCount > 0 ? (
                    <>
                      <CheckCircle size={13} />
                      <span>🟢 PERÍODO REGISTRADO ({vcClosedCount} FONDOS OFICIALIZADOS)</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle size={13} />
                      <span>🔴 PERÍODO POR REGISTRAR / SIMULACIÓN</span>
                    </>
                  )}
                </span>
              </div>
            </div>

            {/* Banner de Mensaje de Éxito */}
            {vcSuccessMsg && (
              <div className="bg-[#ecfdf5] dark:bg-[#059669]/15 border border-[#a7f3d0] dark:border-[#059669]/30 rounded-xl p-3 text-xs font-bold text-[#059669] dark:text-[#34d399] flex items-center justify-between">
                <span>{vcSuccessMsg}</span>
                <button onClick={() => setVcSuccessMsg(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                  <X size={14} />
                </button>
              </div>
            )}

            {/* GRID DE 3 COLUMNAS HORIZONTALES (WORKFLOW VALOR CUOTA) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
              
              {/* COLUMNA 1: FILTROS DEL PERÍODO */}
              <div className="p-4 bg-[#f8fafc] dark:bg-[#0b0f19] border border-[#e2e8f0] dark:border-[#334155] rounded-2xl flex flex-col justify-between gap-3 shadow-xs">
                <div className="flex items-center justify-between border-b border-[#e2e8f0] dark:border-[#334155] pb-2">
                  <span className="text-[11px] font-black text-[#0f172a] dark:text-[#f8fafc] uppercase tracking-wider">
                    1. Filtros del Período
                  </span>
                  <span className="text-[9.5px] font-mono font-bold text-[#0284c7] dark:text-[#38bdf8]">
                    {currentCierre.cycle}
                  </span>
                </div>

                <div className="flex flex-col gap-2.5">
                  {/* DESPLEGABLE 1: MES DE CIERRE / PERÍODO */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[9.5px] font-black text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wider">
                      📅 Mes de Cierre / Período
                    </label>
                    <select
                      className="w-full bg-white dark:bg-[#1e293b] border border-[#e2e8f0] dark:border-[#334155] rounded-xl py-2 px-3 text-xs font-bold text-[#0f172a] dark:text-[#f8fafc] focus:outline-none shadow-xs cursor-pointer"
                      value={`${vcSelTipo}_${vcSelNum}`}
                      onChange={(e) => {
                        const val = e.target.value;
                        const found = PERIODOS_CIERRE.find(p => `${p.cType}_${p.cNum}` === val);
                        if (found) {
                          setVcSelTipo(found.cType);
                          setVcSelNum(found.cNum);
                          setVcSelFondo('TODOS');
                        }
                      }}
                    >
                      {PERIODOS_CIERRE.map(p => (
                        <option key={p.id} value={`${p.cType}_${p.cNum}`}>
                          {p.mes} ({p.rango} · {p.label})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* DESPLEGABLE 2: FONDO A LIQUIDAR */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[9.5px] font-black text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wider">
                      🎯 Fondo a Liquidar
                    </label>
                    <select
                      className="w-full bg-white dark:bg-[#1e293b] border border-[#e2e8f0] dark:border-[#334155] rounded-xl py-2 px-3 text-xs font-bold text-[#0f172a] dark:text-[#f8fafc] focus:outline-none shadow-xs cursor-pointer"
                      value={vcSelFondo}
                      onChange={(e) => setVcSelFondo(e.target.value)}
                    >
                      <option value="TODOS">TODOS LOS FONDOS ({fondosDelCierre.length} Fondos)</option>
                      {fondosDelCierre.map(f => (
                        <option key={f.id_fondo} value={f.id_fondo}>
                          {f.nombre_fondo} ({f.id_fondo})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="pt-1 text-[9.5px] font-mono text-[#64748b] dark:text-[#94a3b8] text-right flex justify-between items-center">
                  <span className="text-[9px] text-slate-400 font-mono">
                    {currentCierre.rango}
                  </span>
                  <span>
                    Corte: <strong className="text-[#0284c7] dark:text-[#38bdf8]">{fEnd}</strong>
                  </span>
                </div>
              </div>

              {/* COLUMNA 2: AUDITORÍA & REPORTES */}
              <div className="p-4 bg-[#f8fafc] dark:bg-[#0b0f19] border border-[#e2e8f0] dark:border-[#334155] rounded-2xl flex flex-col justify-between gap-3 shadow-xs">
                <div className="flex items-center justify-between border-b border-[#e2e8f0] dark:border-[#334155] pb-2">
                  <span className="text-[11px] font-black text-[#0f172a] dark:text-[#f8fafc] uppercase tracking-wider">
                    2. Auditoría & Reportes
                  </span>
                  <span className="text-[9.5px] font-mono font-bold text-[#059669] dark:text-[#34d399]">
                    NAV V31 (P&L = 0.00)
                  </span>
                </div>

                <div className="flex flex-col gap-2">
                  <button
                    className="h-11 text-xs font-black uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-xs bg-[#ecfdf5] dark:bg-[#059669]/15 border border-[#a7f3d0] dark:border-[#059669]/30 text-[#059669] dark:text-[#34d399] hover:bg-[#d1fae5] transition-all disabled:opacity-60"
                    disabled={vcLoading || vcExportingExcel || vcReportData.length === 0}
                    onClick={handleExportVcExcel}
                  >
                    {vcExportingExcel ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : vcExcelDownloaded ? (
                      <CheckCircle size={16} className="text-[#059669]" />
                    ) : (
                      <FileSpreadsheet size={16} />
                    )}
                    <span>{vcExcelDownloaded ? '✓ Excel V31 Listo' : 'Descargar Excel Maestro V31'}</span>
                  </button>

                  <button
                    className="h-11 text-xs font-black uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-xs bg-[#0284c7] hover:bg-[#0369a1] text-white transition-all disabled:opacity-60"
                    onClick={handleExportPDFVc}
                    disabled={vcLoading || vcExportingPdf || vcReportData.length === 0}
                  >
                    {vcExportingPdf ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : vcPdfDownloaded ? (
                      <CheckCircle size={16} className="text-white" />
                    ) : (
                      <FileText size={16} />
                    )}
                    <span>{vcPdfDownloaded ? '✓ Reporte PDF Listo' : 'Descargar PDF Oficial V31'}</span>
                  </button>
                </div>

                <div className="pt-1 text-[9.5px] font-mono text-[#64748b] dark:text-[#94a3b8] text-center">
                  Pass-Through Puro · Ganancia Operativa = 0.00 Identidad Cero
                </div>
              </div>


              {/* COLUMNA 3: PERSISTENCIA & ROLLBACK */}
              <div className="p-4 bg-[#f8fafc] dark:bg-[#0b0f19] border border-[#e2e8f0] dark:border-[#334155] rounded-2xl flex flex-col justify-between gap-3 shadow-xs">
                <div className="flex items-center justify-between border-b border-[#e2e8f0] dark:border-[#334155] pb-2">
                  <span className="text-[11px] font-black text-[#0f172a] dark:text-[#f8fafc] uppercase tracking-wider">
                    3. Persistencia & Rollback
                  </span>
                  <span className="text-[9.5px] font-mono font-bold text-[#e11d48] dark:text-[#fb7185]">
                    DB Ledger
                  </span>
                </div>

                <div className="flex flex-col gap-2">
                  <button
                    className="h-11 text-xs font-black uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-xs bg-[#0f172a] hover:bg-[#1e293b] text-white transition-all disabled:opacity-50"
                    disabled={vcLoading || vcOficializarLoading || vcReportData.length === 0 || vcClosedCount > 0}
                    onClick={handleOficializarCierre}
                  >
                    {vcOficializarLoading ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <CheckCircle size={16} className="text-emerald-400" />
                    )}
                    <span>{vcClosedCount > 0 ? '✓ Período Ya Oficializado' : 'Oficializar Cierre Valor Cuota'}</span>
                  </button>

                  <button
                    className="h-11 text-xs font-black uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-xs bg-[#fff1f2] dark:bg-[#e11d48]/15 border border-[#fecdd3] dark:border-[#e11d48]/30 text-[#e11d48] dark:text-[#fb7185] hover:bg-[#ffe4e6] transition-all disabled:opacity-50"
                    disabled={vcRollbackLoading || vcClosedCount === 0}
                    onClick={handleRollbackCierre}
                  >
                    {vcRollbackLoading ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Trash2 size={16} />
                    )}
                    <span>Reabrir Período (Rollback)</span>
                  </button>
                </div>

                <div className="pt-1 text-[9.5px] font-mono text-[#64748b] dark:text-[#94a3b8] text-center">
                  Tabla: <code>crm_valor_cuota_eventos</code>
                </div>
              </div>

            </div>

          </div>

        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL DE CREACIÓN DE NUEVO FONDO CON PLAZOS ESTÁNDAR */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xl max-w-2xl w-full flex flex-col gap-5 my-8">
            <div className="flex items-center justify-between border-b border-slate-150 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Building2 className="text-emerald-600" size={20} />
                <h3 className="text-sm font-black text-slate-850 dark:text-slate-100 uppercase tracking-tight">
                  ➕ Registrar Nuevo Fondo de Inversión
                </h3>
              </div>
              <button 
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateFondoSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Código del Fondo (ID Macro) *</label>
                <input
                  type="text"
                  placeholder="Ej: NSGPEN04"
                  className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-xs font-semibold uppercase focus:outline-none focus:border-emerald-600"
                  value={createFormData.id_fondo || ''}
                  onChange={(e) => setCreateFormData(prev => ({ ...prev, id_fondo: e.target.value.toUpperCase() }))}
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Nombre Completo del Fondo *</label>
                <input
                  type="text"
                  placeholder="Ej: FDO NSG MIPYME PEN 04"
                  className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-xs font-semibold focus:outline-none focus:border-emerald-600"
                  value={createFormData.nombre_fondo || ''}
                  onChange={(e) => setCreateFormData(prev => ({ ...prev, nombre_fondo: e.target.value }))}
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Moneda</label>
                <select
                  className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-xs font-semibold focus:outline-none"
                  value={createFormData.moneda || 'PEN'}
                  onChange={(e) => setCreateFormData(prev => ({ ...prev, moneda: e.target.value }))}
                >
                  <option value="PEN">Soles (PEN)</option>
                  <option value="USD">Dólares (USD)</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">RUC del Fondo</label>
                <input
                  type="text"
                  placeholder="20607995282"
                  className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-xs font-semibold focus:outline-none"
                  value={createFormData.ruc_fondo || ''}
                  onChange={(e) => setCreateFormData(prev => ({ ...prev, ruc_fondo: e.target.value }))}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Tamaño Máximo de Emisión</label>
                <input
                  type="number"
                  className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-xs font-semibold focus:outline-none"
                  value={createFormData.tamanho_maximo_fondo || 30000000}
                  onChange={(e) => setCreateFormData(prev => ({ ...prev, tamanho_maximo_fondo: Number(e.target.value) || 0 }))}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Inversión Mínima</label>
                <input
                  type="number"
                  className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-xs font-semibold focus:outline-none"
                  value={createFormData.monto_minimo_inversion || 50000}
                  onChange={(e) => setCreateFormData(prev => ({ ...prev, monto_minimo_inversion: Number(e.target.value) || 0 }))}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Frecuencia Cupones (Meses)</label>
                <select
                  className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-xs font-semibold focus:outline-none"
                  value={createFormData.frecuencia_cupones_meses || 2}
                  onChange={(e) => setCreateFormData(prev => ({ ...prev, frecuencia_cupones_meses: Number(e.target.value) || 2 }))}
                >
                  <option value={2}>2 Meses (Bimestral)</option>
                  <option value={3}>3 Meses (Trimestral)</option>
                  <option value={1}>1 Mes (Mensual)</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Vigencia Tasa (Año)</label>
                <input
                  type="text"
                  className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-xs font-semibold focus:outline-none"
                  value={createFormData.vigencia_tasa || '2026'}
                  onChange={(e) => setCreateFormData(prev => ({ ...prev, vigencia_tasa: e.target.value }))}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Comisión Administración (%)</label>
                <input
                  type="number"
                  step="any"
                  className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-xs font-semibold focus:outline-none"
                  value={createFormData.comision_administracion_fondo ?? 1}
                  onChange={(e) => setCreateFormData(prev => ({ ...prev, comision_administracion_fondo: Number(e.target.value) || 0 }))}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Comisión Captación (%)</label>
                <input
                  type="number"
                  step="any"
                  className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-xs font-semibold focus:outline-none"
                  value={createFormData.comision_captacion_fondo ?? 2}
                  onChange={(e) => setCreateFormData(prev => ({ ...prev, comision_captacion_fondo: Number(e.target.value) || 0 }))}
                />
              </div>

              {/* Matriz de Tasas por Plazo */}
              <div className="col-span-full border-t border-slate-150 dark:border-slate-800 pt-3 flex flex-col gap-2">
                <span className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-tight">
                  📊 Matriz de Tasas TEA por Plazo (%)
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase">Tasa 12M (%)</label>
                    <input
                      type="number"
                      step="any"
                      className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                      value={createFormData.tasa12 ?? 8.5}
                      onChange={(e) => setCreateFormData(prev => ({ ...prev, tasa12: Number(e.target.value) || 0 }))}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase">Tasa 24M (%)</label>
                    <input
                      type="number"
                      step="any"
                      className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                      value={createFormData.tasa24 ?? 9.0}
                      onChange={(e) => setCreateFormData(prev => ({ ...prev, tasa24: Number(e.target.value) || 0 }))}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase">Tasa 36M (%)</label>
                    <input
                      type="number"
                      step="any"
                      className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                      value={createFormData.tasa36 ?? 9.5}
                      onChange={(e) => setCreateFormData(prev => ({ ...prev, tasa36: Number(e.target.value) || 0 }))}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase">Tasa 60M (%)</label>
                    <input
                      type="number"
                      step="any"
                      className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                      value={createFormData.tasa60 ?? 10.0}
                      onChange={(e) => setCreateFormData(prev => ({ ...prev, tasa60: Number(e.target.value) || 0 }))}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase">Tasa ND (%)</label>
                    <input
                      type="number"
                      step="any"
                      className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                      value={createFormData.tasaND ?? 10.5}
                      onChange={(e) => setCreateFormData(prev => ({ ...prev, tasaND: Number(e.target.value) || 0 }))}
                    />
                  </div>
                </div>
              </div>

              <div className="col-span-full bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900 rounded-xl p-3">
                <p className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300">
                  ℹ️ Al registrar el nuevo fondo, el sistema creará automáticamente sus 4 variantes de plazos estándar (12 Meses, 24 Meses, 36 Meses y ND A la vista).
                </p>
              </div>

              {createSubmitError && (
                <div className="col-span-full text-xs font-semibold text-rose-600">
                  {createSubmitError}
                </div>
              )}

              <div className="col-span-full flex items-center justify-end gap-3 border-t border-slate-150 dark:border-slate-800 pt-3">
                <button
                  type="button"
                  className="h-9 px-4 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer"
                  onClick={() => setIsCreateModalOpen(false)}
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={createSubmitLoading}
                  className="h-9 px-5 text-xs font-black uppercase tracking-wider bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg cursor-pointer shadow-sm transition-all flex items-center gap-2"
                >
                  {createSubmitLoading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  <span>Registrar Fondo en Lote</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
