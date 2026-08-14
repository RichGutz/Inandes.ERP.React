// src/features/fondos/FondosPage.tsx
import React, { useEffect, useState } from 'react';
import { getFondos, upsertFondos, calculateValorCuotaV26 } from '../../services/fondosService';
import type { Fondo, V26FondoReport } from '../../services/fondosService';
import * as XLSX from 'xlsx';
// @ts-ignore
import html2pdf from 'html2pdf.js';
import { LOGO_INANDES_BASE64, LOGO_GEEKSOFT_BASE64 } from '../../assets/base64Images';
import { 
  Loader2, AlertCircle, RefreshCw, Edit2, FileSpreadsheet, FileText, CheckCircle, ChevronRight,
  Plus, Search, Building2, X
} from 'lucide-react';

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

  // Estados del seguimiento de Valor Cuota
  const [vcSelFondo, setVcSelFondo] = useState<string>('TODOS');
  const [vcSelYear, setVcSelYear] = useState<number>(2026);
  const [vcSelTipo, setVcSelTipo] = useState<'Bimestre' | 'Trimestre'>('Bimestre');
  const [vcSelNum, setVcSelNum] = useState<number>(1);
  const [vcReportData, setVcReportData] = useState<V26FondoReport[]>([]);
  const [vcLoading, setVcLoading] = useState<boolean>(false);
  const [vcPdfLoading, setVcPdfLoading] = useState<boolean>(false);

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

  useEffect(() => {
    fetchFondos();
  }, []);

  // Carga automática del cálculo de Valor Cuota
  const handleCalculateValorCuota = async () => {
    setVcLoading(true);
    try {
      // Calcular rango de fechas contables
      let startMonth = 0;
      let endMonth = 0;
      if (vcSelTipo === 'Bimestre') {
        startMonth = (vcSelNum - 1) * 2;
        endMonth = startMonth + 1;
      } else {
        startMonth = (vcSelNum - 1) * 3;
        endMonth = startMonth + 2;
      }

      const start = new Date(vcSelYear, startMonth, 1, 0, 0, 0, 0);
      const end = new Date(vcSelYear, endMonth + 1, 0, 0, 0, 0, 0);
      
      const filterFondo = vcSelFondo === 'TODOS' ? null : vcSelFondo;
      const reports = await calculateValorCuotaV26(filterFondo, start, end);
      setVcReportData(reports);
    } catch (err: any) {
      console.error(err);
    } finally {
      setVcLoading(false);
    }
  };

  useEffect(() => {
    if (activeSubTab === 'valorCuota') {
      handleCalculateValorCuota();
    }
  }, [activeSubTab, vcSelFondo, vcSelYear, vcSelTipo, vcSelNum]);

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

      const response = await fetch('https://inandes.react.geeksoft.tech/api/inversionistas/generate-pdf', {
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

  // Lista única de fondos en el mismo orden que la pestaña Fondos (Variables)
  const uniqueFondosList = Array.from(
    new Map(
      fondos.map(f => [
        f.id_fondo,
        { id_fondo: f.id_fondo, nombre_fondo: f.nombre_fondo, moneda: f.moneda }
      ])
    ).values()
  );

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

  // Exportar Valor Cuota v26 a Excel (Réplica Literal 1:1 de export_valor_cuota_v25_to_excel.py del Legacy)
  const handleExportVcExcel = () => {
    if (vcReportData.length === 0) {
      alert("No hay datos de Valor Cuota para exportar.");
      return;
    }

    try {
      const wb = XLSX.utils.book_new();

      for (const report of vcReportData) {
        const sheetName = report.fondo.id_fondo.slice(0, 31);
        const excelRows: any[] = [];

        for (const block of report.blocks) {
          for (const r of block.rows) {
            if (r.tipo === 'SPACER') continue;

            // Formato de ITEM exacto al script legacy
            const itemLabel = r.tipo === 'AUMENTO' ? `   ${r.id}` : r.id;
            const excelRow: Record<string, any> = { ITEM: itemLabel };

            block.days.forEach((day, idx) => {
              const val = r.cells[idx]?.val;
              const numericVal = (val === '-' || val === undefined || val === null) ? 0 : Number(val);
              excelRow[day] = numericVal;
            });

            excelRows.push(excelRow);
          }
        }

        const ws = XLSX.utils.json_to_sheet(excelRows);
        
        // Ajuste de ancho de columnas
        const colWidths = [{ wch: 30 }];
        if (report.blocks[0]?.days) {
          report.blocks[0].days.forEach(() => colWidths.push({ wch: 10 }));
        }
        ws['!cols'] = colWidths;

        XLSX.utils.book_append_sheet(wb, ws, sheetName);
      }

      XLSX.writeFile(wb, `Reporte_NAV_V26_Export_${vcSelYear}.xlsx`);
    } catch (err: any) {
      alert(`Error exportando Excel: ${err.message}`);
    }
  };

  // Descargar PDF Oficial de Valor Cuota v26 (Réplica Literal 1:1 de reporte_cuotas_transpuesto_v26.html)
  const handleExportVcPdf = async () => {
    if (vcReportData.length === 0) {
      alert("No hay datos de Valor Cuota para descargar.");
      return;
    }

    setVcPdfLoading(true);
    try {
      const filename = `Reporte_NAV_V26_${vcSelFondo}_${vcSelYear}.pdf`;

      const formatNumVal = (v: any, decimals: number = 2) => {
        if (v === null || v === undefined || v === '') return '';
        const fv = Number(v);
        if (isNaN(fv)) return String(v);
        if (fv === 0) return '-';
        return fv.toLocaleString('es-PE', {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals
        });
      };

      const htmlPrint = `
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <title>Reporte Maestro de Cuotas - V26 (NAV Focused)</title>
            <style>
                @page {
                    size: A3 landscape;
                    margin: 0.8cm;
                }
                body {
                    font-family: 'Arial', sans-serif;
                    font-size: 8pt;
                    color: #333;
                    margin: 0;
                    padding: 0;
                }
                .header {
                    text-align: center;
                    margin-bottom: 8px;
                    border-bottom: 2px solid #01579b;
                    padding-bottom: 4px;
                }
                .header-table {
                    width: 100%;
                    border-collapse: collapse;
                    border: none;
                    margin-bottom: 4px;
                }
                .header-table td {
                    border: none;
                    vertical-align: middle;
                    padding: 0;
                }
                .logo-geeksoft { height: 42px; width: auto; }
                .logo-inandes { height: 28px; width: auto; }
                .header h1 {
                    margin: 0;
                    font-size: 13pt;
                    color: #01579b;
                    font-weight: bold;
                    text-transform: uppercase;
                }
                .repo-subtitle {
                    font-size: 8.5pt;
                    font-weight: bold;
                    color: #333;
                    margin-top: 3px;
                }
                .repo-subtext {
                    font-size: 7.5pt;
                    color: #555;
                    margin-top: 2px;
                }
                table.data-table {
                    width: 100%;
                    border-collapse: collapse;
                    table-layout: fixed;
                    margin-bottom: 10px;
                    page-break-inside: avoid;
                }
                tr {
                    page-break-inside: avoid;
                }
                table.data-table th,
                table.data-table td {
                    border: 1px solid #ccc;
                    padding: 2px;
                    text-align: right;
                    overflow: hidden;
                    white-space: nowrap;
                    font-size: 6.5pt;
                }
                table.data-table th {
                    background-color: #0288d1;
                    color: white;
                    font-weight: bold;
                    text-align: center;
                    font-size: 7pt;
                }
                .num-col {
                    width: 25px;
                    text-align: center;
                    background-color: #f5f5f5;
                    color: #000 !important;
                    font-weight: bold;
                }
                .cert-id-col {
                    width: 160px;
                    text-align: left;
                    font-weight: bold;
                    background-color: #f5f5f5;
                    color: #333 !important;
                    font-size: 6.5pt;
                }
                .cap-col {
                    width: 70px;
                    background-color: #e3f2fd;
                    color: #333 !important;
                    font-size: 7pt;
                }
                .cuotas-col {
                    width: 65px;
                    background-color: #f1f8e9;
                    color: #000 !important;
                    font-size: 6.5pt;
                }
                .day-col {
                    font-size: 6pt;
                }
                .aumento-row td {
                    background-color: #fafafa;
                }
                .aumento-label {
                    padding-left: 10px !important;
                    color: #2e7d32 !important;
                    font-style: italic;
                    font-size: 6pt !important;
                    border-left: 3px solid #43a047;
                }
                .summary-row td {
                    font-weight: bold !important;
                    background-color: #fff9c4 !important;
                    color: #000 !important;
                }
                .comision-row td {
                    color: #c62828 !important;
                    background-color: #ffebee !important;
                }
                .spacer-row td {
                    height: 8px;
                    background-color: #f5f5f5;
                    border: none;
                }
                .page-break {
                    page-break-before: always;
                }
                .vc-highlight {
                    color: #0d47a1 !important;
                    font-weight: bold !important;
                    background-color: #e3f2fd !important;
                }
                .footer {
                    text-align: right;
                    color: #999;
                    font-size: 6.5pt;
                    margin-top: 10px;
                    border-top: 1px solid #e2e8f0;
                    padding-top: 4px;
                }
            </style>
        </head>
        <body>
            ${vcReportData.map((rep, rIdx) => {
              return rep.blocks.map((block, bIdx) => {
                const isFirstPage = rIdx === 0 && bIdx === 0;
                return `
                  <div class="${isFirstPage ? '' : 'page-break'}">
                    <div class="header">
                        <table class="header-table">
                          <tr>
                            <td style="width: 20%; text-align: left;">
                              <img src="data:image/png;base64,${LOGO_GEEKSOFT_BASE64}" class="logo-geeksoft" alt="Geeksoft">
                            </td>
                            <td style="width: 60%; text-align: center;">
                              <h1>REPORTE MAESTRO DE LIQUIDACIÓN V26 (ENFOQUE NAV)</h1>
                              <div class="repo-subtitle">
                                  FONDO: ${rep.fondo.nombre_fondo} (${rep.fondo.id_fondo}) | MONEDA: ${rep.fondo.moneda} |
                                  TASA ACTIVA: ${rep.vars.activa}% | ADMIN: ${rep.vars.admin}%
                              </div>
                              <div class="repo-subtext">
                                  ${block.monthName} | <b>Devengue Diario y Cálculo de Valor Cuota</b>
                              </div>
                            </td>
                            <td style="width: 20%; text-align: right;">
                              <img src="data:image/jpeg;base64,${LOGO_INANDES_BASE64}" class="logo-inandes" alt="InAndes">
                            </td>
                          </tr>
                        </table>
                    </div>

                    <table class="data-table">
                        <thead>
                            <tr>
                                <th class="num-col">N°</th>
                                <th class="cert-id-col">CERTIFICADO / RESUMEN</th>
                                <th class="cap-col">CAPITAL / REF.</th>
                                <th class="cuotas-col">N° CUOTAS</th>
                                ${block.days.map(day => `<th class="day-col">${day}</th>`).join('')}
                            </tr>
                        </thead>
                        <tbody>
                            ${block.rows.map(row => {
                              if (row.tipo === 'SPACER') {
                                return `<tr class="spacer-row"><td colspan="${4 + block.days.length}"></td></tr>`;
                              }

                              const isComision = row.id.includes('COM.');
                              const isSummary = row.tipo === 'TOTAL' && !isComision;
                              const isVc = row.is_vc || row.id.includes('VAL CUOTA');
                              let rowClass = '';
                              if (row.tipo === 'AUMENTO') rowClass = 'aumento-row';
                              else if (isComision) rowClass = 'comision-row';
                              else if (isSummary) rowClass = 'summary-row';

                              const numCell = row.tipo === 'CERT' && row.num !== undefined ? String(row.num) : '';
                              const certLabelClass = row.tipo === 'AUMENTO' ? 'aumento-label' : '';

                              const capDisplay = row.capital !== undefined && row.capital !== null ? formatNumVal(row.capital, 2) : '';
                              const cuotasDecimals = (isVc || row.id.includes('CUOTA')) ? 6 : 2;
                              const cuotasDisplay = row.cuotas !== undefined && row.cuotas !== null ? formatNumVal(row.cuotas, cuotasDecimals) : '';

                              const cellsHtml = block.days.map((_, idx) => {
                                const val = row.cells[idx]?.val;
                                const formattedVal = formatNumVal(val, isVc ? 6 : 2);
                                return `<td class="day-col ${isVc ? 'vc-highlight' : ''}">${formattedVal}</td>`;
                              }).join('');

                              return `<tr class="${rowClass}"><td class="num-col">${numCell}</td><td class="cert-id-col ${certLabelClass}">${row.id}</td><td class="cap-col">${capDisplay}</td><td class="cuotas-col">${cuotasDisplay}</td>${cellsHtml}</tr>`;
                            }).join('')}
                        </tbody>
                    </table>
                  </div>
                `;
              }).join('');
            }).join('')}

            <div class="footer">
                Generado por Motor V26 (Optimizado NAV - Replica 1:1 Legacy) - ${new Date().toLocaleDateString('es-PE')}
            </div>
        </body>
        </html>
      `;

      // Intentar primero con el endpoint FastAPI WeasyPrint oficial
      const response = await fetch('https://inandes.react.geeksoft.tech/api/inversionistas/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html: htmlPrint, filename })
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 10000);
      } else {
        // Fallback si la API no responde: abrir ventana de impresión nativa del navegador
        const printWin = window.open('', '_blank');
        if (printWin) {
          printWin.document.write(htmlPrint);
          printWin.document.close();
          printWin.focus();
          setTimeout(() => {
            printWin.print();
          }, 500);
        } else {
          throw new Error(`HTTP Error ${response.status}`);
        }
      }
    } catch (err: any) {
      alert(`Error generando PDF: ${err.message}`);
    } finally {
      setVcPdfLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full animate-fadeIn">
      
      {/* Selector de sub-pestañas superior */}
      <div className="border-b border-slate-200 dark:border-slate-800 w-full flex items-center justify-between">
        <div className="flex gap-6">
          <button
            className={`py-3 text-xs font-black tracking-wider uppercase border-b-2 cursor-pointer transition-colors ${
              activeSubTab === 'variables' 
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400' 
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-350'
            }`}
            onClick={() => {
              setActiveSubTab('variables');
              setVariablesView('list');
            }}
          >
            🏦 Variables Fondos
          </button>
          <button
            className={`py-3 text-xs font-black tracking-wider uppercase border-b-2 cursor-pointer transition-colors ${
              activeSubTab === 'valorCuota' 
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400' 
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-350'
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
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 w-full bg-slate-50/50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                <div className="flex flex-wrap items-center gap-3 flex-1 w-full sm:w-auto">
                  {/* Búsqueda */}
                  <div className="relative flex-1 max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                    <input
                      type="text"
                      className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg py-1.5 pl-8 pr-3 text-xs font-semibold text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-emerald-600 shadow-sm"
                      placeholder="Buscar por Nombre, Código o RUC..."
                      value={searchFondosTerm}
                      onChange={(e) => setSearchFondosTerm(e.target.value)}
                    />
                  </div>

                  {/* Filtro Moneda */}
                  <select
                    className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg py-1.5 px-3 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none shadow-sm"
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
                    className="h-9 text-xs font-bold flex items-center gap-1.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-sm hover:shadow transition-all"
                    onClick={() => setIsCreateModalOpen(true)}
                  >
                    <Plus size={14} />
                    <span>Nuevo Fondo</span>
                  </button>

                  <button 
                    className="h-9 text-xs font-bold flex items-center gap-1.5 px-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 cursor-pointer transition-colors shadow-sm"
                    onClick={handleExportMaestroPdf}
                    disabled={fondos.length === 0}
                  >
                    <FileText size={13} className="text-indigo-600" />
                    <span>Exportar PDF</span>
                  </button>

                  <button 
                    className="h-9 text-xs font-bold flex items-center gap-1.5 px-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 cursor-pointer transition-colors shadow-sm"
                    onClick={handleExportMaestroExcel}
                    disabled={fondos.length === 0}
                  >
                    <FileSpreadsheet size={13} className="text-emerald-600" />
                    <span>Exportar Excel</span>
                  </button>

                  <button 
                    className="h-9 text-xs font-bold flex items-center gap-1.5 px-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 cursor-pointer transition-colors shadow-sm"
                    onClick={fetchFondos}
                    disabled={loading}
                  >
                    <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
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
      {/* --- SUB-PESTAÑA 2: SEGUIMIENTO DE VALOR CUOTA --- */}
      {activeSubTab === 'valorCuota' && (
        <div className="flex flex-col gap-6 w-full animate-fadeIn">
          
          {/* Panel Ejecutivo de Filtros y Acciones Oficiales */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col gap-6">
            <div className="flex flex-col gap-1 border-b border-slate-100 dark:border-slate-800/80 pb-4">
              <h3 className="text-base font-black text-slate-850 dark:text-slate-100 tracking-tight uppercase flex items-center gap-2">
                <span>📊 Seguimiento y Simulación de Valor Cuota v26 (NAV)</span>
              </h3>
              <p className="text-xs text-slate-450 dark:text-slate-500 font-medium">
                Selecciona el fondo y el periodo para generar y descargar los reportes oficiales transpuestos en PDF o Excel.
              </p>
            </div>

            {/* Filtros de Selección */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-end bg-slate-50/50 dark:bg-slate-950/40 p-4 rounded-xl border border-slate-150 dark:border-slate-800">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">🎯 Fondo</label>
                <select
                  className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg py-2 px-3 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none shadow-xs"
                  value={vcSelFondo}
                  onChange={(e) => setVcSelFondo(e.target.value)}
                >
                  <option value="TODOS">TODOS LOS FONDOS</option>
                  {uniqueFondosList.map(f => (
                    <option key={f.id_fondo} value={f.id_fondo}>
                      {f.nombre_fondo} ({f.id_fondo})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">📅 Año</label>
                <select
                  className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg py-2 px-3 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none shadow-xs"
                  value={vcSelYear}
                  onChange={(e) => setVcSelYear(Number(e.target.value))}
                >
                  <option value={2024}>2024</option>
                  <option value={2025}>2025</option>
                  <option value={2026}>2026</option>
                  <option value={2027}>2027</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">⚙️ Ciclo</label>
                <select
                  className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg py-2 px-3 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none shadow-xs"
                  value={vcSelTipo}
                  onChange={(e) => setVcSelTipo(e.target.value as any)}
                >
                  <option value="Bimestre">Bimestre</option>
                  <option value="Trimestre">Trimestre</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">📌 N° Periodo</label>
                <select
                  className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg py-2 px-3 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none shadow-xs"
                  value={vcSelNum}
                  onChange={(e) => setVcSelNum(Number(e.target.value))}
                >
                  {vcSelTipo === 'Bimestre' ? (
                    <>
                      <option value={1}>1: Ene - Feb</option>
                      <option value={2}>2: Mar - Abr</option>
                      <option value={3}>3: May - Jun</option>
                      <option value={4}>4: Jul - Ago</option>
                      <option value={5}>5: Sep - Oct</option>
                      <option value={6}>6: Nov - Dic</option>
                    </>
                  ) : (
                    <>
                      <option value={1}>1: Ene - Mar</option>
                      <option value={2}>2: Abr - Jun</option>
                      <option value={3}>3: Jul - Sep</option>
                      <option value={4}>4: Oct - Dic</option>
                    </>
                  )}
                </select>
              </div>
            </div>

            {/* Ficha Técnica Metadata en 1 sola línea */}
            {vcLoading ? (
              <div className="flex items-center justify-center py-6 gap-2">
                <Loader2 className="animate-spin text-emerald-600" size={20} />
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Cargando metadata de simulación...</span>
              </div>
            ) : (
              vcReportData.map(rep => (
                <div key={rep.fondo.id_fondo} className="bg-slate-50 dark:bg-slate-950/70 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 overflow-x-auto">
                  <div className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-350 font-medium whitespace-nowrap">
                    <span>Fondo: <strong className="text-slate-900 dark:text-white font-bold">{rep.fondo.nombre_fondo} ({rep.fondo.id_fondo})</strong></span>
                    <span className="text-slate-300 dark:text-slate-700">|</span>
                    <span>Moneda: <strong className="text-emerald-600 dark:text-emerald-400 font-bold">{rep.fondo.moneda}</strong></span>
                    <span className="text-slate-300 dark:text-slate-700">|</span>
                    <span>TASA ACTIVA EMPRESA: <strong className="font-bold">{rep.vars.activa}%</strong></span>
                    <span className="text-slate-300 dark:text-slate-700">|</span>
                    <span>COMISIÓN ADMIN: <strong className="font-bold">{rep.vars.admin}%</strong></span>
                    <span className="text-slate-300 dark:text-slate-700">|</span>
                    <span>COM. CAPTACIÓN: <strong className="font-bold">{rep.fondo.comision_captacion_fondo || 0}%</strong></span>
                    <span className="text-slate-300 dark:text-slate-700">|</span>
                    <span>COM. MISC: <strong className="font-bold">{rep.fondo.comision_miscelaneos_fondo || 0}%</strong></span>
                  </div>
                </div>
              ))
            )}

            {/* Botones Oficiales de Exportación e Impresión */}
            <div className="flex flex-wrap items-center justify-end gap-4 pt-2 border-t border-slate-100 dark:border-slate-800/80">
              <button
                className="h-11 px-6 text-xs font-black uppercase tracking-wider bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-md hover:shadow-lg transition-all disabled:opacity-50"
                onClick={handleExportVcPdf}
                disabled={vcLoading || vcPdfLoading || vcReportData.length === 0}
              >
                {vcPdfLoading ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
                <span>{vcPdfLoading ? 'Generando PDF Oficial...' : '📄 Descargar PDF Oficial v26 (NAV)'}</span>
              </button>

              <button
                className="h-11 px-6 text-xs font-black uppercase tracking-wider bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-md hover:shadow-lg transition-all disabled:opacity-50"
                onClick={handleExportVcExcel}
                disabled={vcLoading || vcReportData.length === 0}
              >
                <FileSpreadsheet size={16} />
                <span>📊 Exportar Matriz a Excel v26</span>
              </button>
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
