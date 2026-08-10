// src/features/fondos/FondosPage.tsx
import React, { useEffect, useState } from 'react';
import { getFondos, upsertFondos, calculateValorCuotaV26 } from '../../services/fondosService';
import type { Fondo, V26FondoReport } from '../../services/fondosService';
import * as XLSX from 'xlsx';
import { 
  Loader2, AlertCircle, RefreshCw, Edit2, FileSpreadsheet, FileText, CheckCircle, ChevronRight
} from 'lucide-react';

export const FondosPage: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<'variables' | 'valorCuota'>('variables');

  // Navegación interna de la pestaña Variables ('list', 'detail', 'edit_plazo')
  const [variablesView, setVariablesView] = useState<'list' | 'detail' | 'edit_plazo'>('list');
  const [selectedFondoCode, setSelectedFondoCode] = useState<string | null>(null);
  const [selectedPlazoId, setSelectedPlazoId] = useState<string | null>(null);

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

  // Agrupar plazos por id_fondo para la vista list
  const groupedFondos: Record<string, Fondo[]> = {};
  for (const f of fondos) {
    const code = f.id_fondo || 'UNKNOWN';
    if (!groupedFondos[code]) groupedFondos[code] = [];
    groupedFondos[code].push(f);
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

  // Exportar Valor Cuota v26 a Excel
  const handleExportVcExcel = () => {
    if (vcReportData.length === 0) {
      alert("No hay datos de Valor Cuota para exportar.");
      return;
    }

    const wb = XLSX.utils.book_new();
    for (const report of vcReportData) {
      const sheetName = report.fondo.id_fondo.slice(0, 31);
      const flatRows: any[] = [];

      for (const block of report.blocks) {
        flatRows.push({ ITEM: `--- ${block.monthName.toUpperCase()} ---` });

        for (const r of block.rows) {
          if (r.tipo === 'SPACER') continue;
          
          const label = r.num !== undefined ? `(${r.num}) ${r.id}` : r.id;
          const excelRow: Record<string, any> = { ITEM: label };

          block.days.forEach((day, idx) => {
            excelRow[day] = r.cells[idx]?.val ?? '-';
          });

          if (r.interes_acum !== undefined) {
            excelRow.TOTAL = r.interes_acum;
          }

          flatRows.push(excelRow);
        }
        flatRows.push({}); // Línea vacía entre bloques mensuales
      }

      const ws = XLSX.utils.json_to_sheet(flatRows);
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    }

    XLSX.writeFile(wb, `Reporte_NAV_V26_Export_${vcSelYear}.xlsx`);
  };

  // Imprimir Valor Cuota PDF (Print Window)
  const handleExportVcPdf = () => {
    if (vcReportData.length === 0) {
      alert("No hay datos de Valor Cuota para imprimir.");
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("Por favor habilita las ventanas emergentes (popups) para imprimir.");
      return;
    }

    const htmlContent = `
      <html>
        <head>
          <title>Seguimiento de Valor Cuota v26 - InAndes</title>
          <style>
            body { font-family: 'Outfit', 'Inter', sans-serif; color: #1e293b; margin: 20px; font-size: 8px; }
            h2 { color: #1e3a8a; margin-bottom: 2px; text-transform: uppercase; font-size: 14px; border-bottom: 2px solid #3b82f6; padding-bottom: 4px; }
            .meta { font-size: 9px; color: #64748b; margin-bottom: 10px; }
            .block-title { font-size: 10px; font-weight: bold; color: #1e293b; margin-top: 15px; margin-bottom: 5px; text-transform: uppercase; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; page-break-inside: avoid; }
            th { background-color: #1e293b; color: white; font-weight: bold; font-size: 7px; padding: 4px 2px; text-align: left; }
            td { border-bottom: 1px solid #e2e8f0; padding: 3px 2px; }
            .summary-row { background-color: #f8fafc; font-weight: bold; }
            .vc-cell { background-color: #eff6ff; font-weight: bold; }
            .spacer-row { height: 4px; background-color: #f1f5f9; }
            .text-right { text-align: right; }
            .aumento-row { color: #64748b; font-style: italic; }
          </style>
        </head>
        <body>
          <h2>INANDES CRM - SEGUIMIENTO DE VALOR CUOTA v26</h2>
          <div class="meta">Fondo: ${vcSelFondo} | Año: ${vcSelYear} | Periodo: ${vcSelTipo} N° ${vcSelNum}</div>
          
          ${vcReportData.map(rep => `
            <h3 style="color:#2563eb; font-size:12px; margin-top:20px; margin-bottom:5px;">Fondo: ${rep.fondo.nombre_fondo} (${rep.fondo.id_fondo})</h3>
            <div class="meta" style="margin-bottom:10px;">TEA Activa: ${rep.vars.activa}% | Com. Admin: ${rep.vars.admin}%</div>
            
            ${rep.blocks.map(block => `
              <div class="block-title">${block.monthName}</div>
              <table>
                <thead>
                  <tr>
                    <th>ITEM</th>
                    ${block.days.map(d => `<th class="text-right">${d}</th>`).join('')}
                    <th class="text-right">TOTAL</th>
                  </tr>
                </thead>
                <tbody>
                  ${block.rows.map(r => {
                    if (r.tipo === 'SPACER') {
                      return `<tr class="spacer-row"><td colspan="${block.days.length + 2}"></td></tr>`;
                    }
                    const rowClass = r.css_class || (r.is_vc ? 'vc-cell' : '');
                    const label = r.num !== undefined ? `(${r.num}) ${r.id}` : r.id;
                    return `
                      <tr class="${rowClass} ${r.tipo === 'AUMENTO' ? 'aumento-row' : ''}">
                        <td style="font-weight: ${r.tipo === 'TOTAL' ? 'bold' : 'normal'}">${label}</td>
                        ${block.days.map((_, i) => {
                          const cellVal = r.cells[i]?.val ?? '-';
                          const displayVal = cellVal === '-' ? '-' : Number(cellVal).toLocaleString('es-PE', { minimumFractionDigits: 4 });
                          return `<td class="text-right">${displayVal}</td>`;
                        }).join('')}
                        <td class="text-right" style="font-weight:bold">${r.interes_acum !== undefined ? Number(r.interes_acum).toLocaleString('es-PE', { minimumFractionDigits: 2 }) : '-'}</td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            `).join('')}
          `).join('')}
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 500);
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
              
              {/* Botones de acción general */}
              <div className="flex items-center justify-between gap-4 w-full bg-slate-50/50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-tight">Directorio Maestro</span>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    className="h-9 text-xs font-bold flex items-center gap-1.5 px-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-650 dark:text-slate-300 cursor-pointer transition-colors shadow-sm"
                    onClick={handleExportMaestroExcel}
                    disabled={fondos.length === 0}
                  >
                    <FileSpreadsheet size={13} className="text-emerald-600" />
                    <span>Exportar Excel</span>
                  </button>
                  <button 
                    className="h-9 text-xs font-bold flex items-center gap-1.5 px-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-650 dark:text-slate-300 cursor-pointer transition-colors shadow-sm"
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
                  <AlertCircle className="text-rose-650" size={40} />
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
                      className="rounded text-emerald-600 focus:ring-emerald-650 h-4 w-4"
                      checked={maestroFormData.activo ?? true}
                      onChange={(e) => setMaestroFormData(prev => ({ ...prev, activo: e.target.checked }))}
                    />
                    <label htmlFor="activo_maestro" className="text-xs font-bold text-slate-650 dark:text-slate-400">¿Fondo Activo (Visible)?</label>
                  </div>

                  <div className="col-span-full flex items-center justify-end gap-2.5 mt-2">
                    {maestroSubmitError && (
                      <span className="text-[11px] font-semibold text-rose-650">{maestroSubmitError}</span>
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
                              className="w-full h-8 text-[10px] font-bold flex items-center justify-center gap-1 bg-slate-50 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200 dark:bg-slate-800 dark:hover:bg-emerald-950/30 dark:hover:text-emerald-450 border border-slate-200 dark:border-slate-800 rounded-lg cursor-pointer transition-colors text-slate-650 dark:text-slate-300"
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
                      <span className="text-[11px] font-semibold text-rose-650">{plazoSubmitError}</span>
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
          
          {/* Panel de Filtros de Periodo */}
          <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-wrap gap-4 items-end shadow-sm">
            <div className="flex flex-col gap-1.5 min-w-[200px] flex-1">
              <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">🎯 Fondo</label>
              <select
                className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-lg py-1.5 px-3 text-xs font-semibold focus:outline-none"
                value={vcSelFondo}
                onChange={(e) => setVcSelFondo(e.target.value)}
              >
                <option value="TODOS">TODOS los fondos</option>
                {Object.keys(groupedFondos).map(code => (
                  <option key={code} value={code}>{code}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5 w-[100px]">
              <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Año</label>
              <select
                className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-lg py-1.5 px-3 text-xs font-semibold focus:outline-none"
                value={vcSelYear}
                onChange={(e) => setVcSelYear(Number(e.target.value))}
              >
                <option value={2024}>2024</option>
                <option value={2025}>2025</option>
                <option value={2026}>2026</option>
                <option value={2027}>2027</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5 w-[120px]">
              <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Ciclo</label>
              <select
                className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-lg py-1.5 px-3 text-xs font-semibold focus:outline-none"
                value={vcSelTipo}
                onChange={(e) => setVcSelTipo(e.target.value as any)}
              >
                <option value="Bimestre">Bimestre</option>
                <option value="Trimestre">Trimestre</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5 w-[140px]">
              <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">N° Periodo</label>
              <select
                className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-lg py-1.5 px-3 text-xs font-semibold focus:outline-none"
                value={vcSelNum}
                onChange={(e) => setVcSelNum(Number(e.target.value))}
              >
                {vcSelTipo === 'Bimestre' ? (
                  <>
                    <option value={1}>1: Ene-Feb</option>
                    <option value={2}>2: Mar-Abr</option>
                    <option value={3}>3: May-Jun</option>
                    <option value={4}>4: Jul-Ago</option>
                    <option value={5}>5: Sep-Oct</option>
                    <option value={6}>6: Nov-Dic</option>
                  </>
                ) : (
                  <>
                    <option value={1}>1: Ene-Mar</option>
                    <option value={2}>2: Abr-Jun</option>
                    <option value={3}>3: Jul-Sep</option>
                    <option value={4}>4: Oct-Dic</option>
                  </>
                )}
              </select>
            </div>
            
            <div className="flex gap-2">
              <button
                className="h-8.5 text-xs font-bold bg-emerald-650 hover:bg-emerald-700 text-white px-4 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer shadow transition-colors disabled:opacity-50"
                onClick={handleExportVcExcel}
                disabled={vcLoading || vcReportData.length === 0}
              >
                <FileSpreadsheet size={13} />
                <span>Excel v26</span>
              </button>

              <button
                className="h-8.5 text-xs font-bold bg-blue-650 hover:bg-blue-700 text-white px-4 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer shadow transition-colors disabled:opacity-50"
                onClick={handleExportVcPdf}
                disabled={vcLoading || vcReportData.length === 0}
              >
                <FileText size={13} />
                <span>PDF v26</span>
              </button>
            </div>
          </div>

          {/* Reporte Maestro Valor Cuota */}
          <div className="flex flex-col gap-6">
            {vcLoading ? (
              <div className="flex flex-col items-center justify-center py-24 text-center gap-3">
                <Loader2 className="animate-spin text-emerald-600" size={30} />
                <p className="text-xs text-slate-450 dark:text-slate-500 font-bold uppercase tracking-wider">Simulando Valor Cuota v26...</p>
              </div>
            ) : vcReportData.length > 0 ? (
              vcReportData.map((report) => (
                <div key={report.fondo.id_fondo} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm flex flex-col gap-4 overflow-hidden">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800/80 pb-3">
                    <div className="flex flex-col gap-0.5">
                      <h3 className="text-sm font-black text-blue-650 dark:text-blue-400 uppercase tracking-tight">
                        📈 Fondo: {report.fondo.nombre_fondo} ({report.fondo.id_fondo})
                      </h3>
                      <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                        TEA Activa Empresa: {report.vars.activa}% | Comisión Administración: {report.vars.admin}%
                      </span>
                    </div>
                  </div>

                  {report.blocks.map((block) => (
                    <div key={block.idx} className="flex flex-col gap-2">
                      <span className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider bg-slate-50 dark:bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-850">
                        🗓️ {block.monthName}
                      </span>
                      
                      <div className="overflow-x-auto w-full border border-slate-150 dark:border-slate-800 rounded-lg">
                        <table className="w-full text-left border-collapse text-[9px] whitespace-nowrap">
                          <thead>
                            <tr className="bg-slate-50/50 dark:bg-slate-850/30 border-b border-slate-200 dark:border-slate-800">
                              <th className="font-bold text-slate-400 dark:text-slate-500 px-3 py-2 uppercase tracking-wider">ITEM</th>
                              {block.days.map(d => (
                                <th key={d} className="font-bold text-slate-450 dark:text-slate-500 px-2 py-2 text-right">{d}</th>
                              ))}
                              <th className="font-bold text-slate-400 dark:text-slate-500 px-3 py-2 text-right uppercase tracking-wider">TOTAL</th>
                            </tr>
                          </thead>
                          <tbody>
                            {block.rows.map((r, rIdx) => {
                              if (r.tipo === 'SPACER') {
                                return (
                                  <tr key={rIdx} className="spacer-row h-2 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-150 dark:border-slate-800/60">
                                    <td colSpan={block.days.length + 2}></td>
                                  </tr>
                                );
                              }
                              const isTotal = r.tipo === 'TOTAL';
                              const label = r.num !== undefined ? `(${r.num}) ${r.id}` : r.id;
                              
                              let rowClass = r.css_class || '';
                              if (r.is_vc) rowClass += ' bg-blue-50/50 dark:bg-blue-950/20';

                              return (
                                <tr key={rIdx} className={`hover:bg-slate-50/30 dark:hover:bg-slate-850/20 border-b border-slate-150 dark:border-slate-800/50 transition-colors ${rowClass} ${r.tipo === 'AUMENTO' ? 'italic text-slate-500' : ''}`}>
                                  <td className={`px-3 py-2 ${isTotal ? 'font-bold text-slate-800 dark:text-slate-200' : 'text-slate-700 dark:text-slate-350'} ${r.tipo === 'AUMENTO' ? 'pl-5' : ''}`}>
                                    {label}
                                  </td>
                                  
                                  {block.days.map((_, dIdx) => {
                                    const cell = r.cells[dIdx];
                                    const cellVal = cell?.val ?? '-';
                                    const isVcCell = r.is_vc;
                                    const cellDisplay = cellVal === '-' ? '-' : Number(cellVal).toLocaleString('es-PE', { 
                                      minimumFractionDigits: isVcCell ? 4 : 2,
                                      maximumFractionDigits: isVcCell ? 4 : 2
                                    });
                                    
                                    return (
                                      <td 
                                        key={dIdx} 
                                        className={`px-2 py-2 text-right font-mono ${isVcCell ? 'font-black text-blue-650 dark:text-blue-450' : ''} ${cellVal !== '-' && !isVcCell ? 'text-slate-700 dark:text-slate-300' : 'text-slate-300 dark:text-slate-700'}`}
                                      >
                                        {cellDisplay}
                                      </td>
                                    );
                                  })}

                                  <td className="px-3 py-2 text-right font-mono font-bold text-slate-800 dark:text-slate-200">
                                    {r.interes_acum !== undefined ? Number(r.interes_acum).toLocaleString('es-PE', { minimumFractionDigits: 2 }) : '-'}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}

                </div>
              ))
            ) : (
              <div className="py-16 text-center text-slate-400 font-bold uppercase tracking-wider border border-dashed border-slate-200 dark:border-slate-850 rounded-2xl bg-white dark:bg-slate-900">
                No se encontraron datos para simular en el periodo seleccionado.
              </div>
            )}
          </div>

        </div>
      )}

    </div>
  );
};
