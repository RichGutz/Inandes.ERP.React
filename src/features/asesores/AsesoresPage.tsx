// src/features/asesores/AsesoresPage.tsx
import React, { useEffect, useState } from 'react';
import { getAsesores, upsertAsesor, calculateComisionesProyeccion } from '../../services/asesoresService';
import type { Asesor } from '../../services/asesoresService';
import * as XLSX from 'xlsx';
import { 
  Search, Loader2, AlertCircle, RefreshCw, Edit2, UserPlus, 
  FileSpreadsheet, FileText, CheckCircle, X, Briefcase
} from 'lucide-react';

export const AsesoresPage: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<'datos' | 'comisiones'>('datos');

  // Estado del directorio de asesores
  const [asesores, setAsesores] = useState<Asesor[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Estado del formulario modal (5 pestañas)
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [formMode, setFormMode] = useState<'crear' | 'editar'>('crear');
  const [formData, setFormData] = useState<Partial<Asesor>>({});
  const [formActiveTab, setFormActiveTab] = useState<'identidad' | 'ubicacion' | 'conyuge' | 'laboral' | 'bancario'>('identidad');
  const [formSubmitError, setFormSubmitError] = useState<string | null>(null);
  const [formSubmitSuccess, setFormSubmitSuccess] = useState<boolean>(false);

  // Estado de Proyección de Comisiones
  const [selectedAsesor, setSelectedAsesor] = useState<string>('TODOS');
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [projectionData, setProjectionData] = useState<any[]>([]);
  const [projectionLoading, setProjectionLoading] = useState<boolean>(false);

  const fetchAsesores = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAsesores();
      setAsesores(data);
    } catch (err: any) {
      setError(err.message || 'Error al cargar directorio de asesores.');
    } finally {
      setLoading(false);
    }
  };

  const fetchProyeccion = async () => {
    setProjectionLoading(true);
    try {
      const codAsesor = selectedAsesor === 'TODOS' ? null : selectedAsesor;
      const data = await calculateComisionesProyeccion(codAsesor, selectedYear);
      setProjectionData(data);
    } catch (err: any) {
      console.error('Error calculando proyección:', err.message);
    } finally {
      setProjectionLoading(false);
    }
  };

  useEffect(() => {
    fetchAsesores();
  }, []);

  useEffect(() => {
    if (activeSubTab === 'comisiones') {
      fetchProyeccion();
    }
  }, [activeSubTab, selectedAsesor, selectedYear]);

  // Exportar asesores a Excel
  const handleExportAsesoresExcel = () => {
    if (asesores.length === 0) return;
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(asesores);
    XLSX.utils.book_append_sheet(wb, ws, 'Asesores');
    XLSX.writeFile(wb, 'asesores_crm.xlsx');
  };

  // Exportar comisiones a Excel (con pestañas independientes por asesor si es consolidado)
  const handleExportComisionesExcel = () => {
    if (projectionData.length === 0) {
      alert("No hay comisiones proyectadas para exportar.");
      return;
    }

    const wb = XLSX.utils.book_new();
    
    if (selectedAsesor === 'TODOS') {
      // 1. Agregar hoja Consolidado
      const wsCons = XLSX.utils.json_to_sheet(projectionData);
      XLSX.utils.book_append_sheet(wb, wsCons, 'Consolidado');

      // 2. Agrupar por Asesor para crear pestañas independientes
      const groups: Record<string, any[]> = {};
      for (const r of projectionData) {
        const name = r.Asesor || 'Asesor';
        if (!groups[name]) groups[name] = [];
        groups[name].push(r);
      }

      for (const [asName, data] of Object.entries(groups)) {
        // Limpiar nombre de hoja para caracteres inválidos en excel
        const cleanName = asName.replace(/[\\\/*?:\[\]]/g, '').slice(0, 31);
        const wsGroup = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, wsGroup, cleanName || 'Asesor');
      }
    } else {
      const ws = XLSX.utils.json_to_sheet(projectionData);
      XLSX.utils.book_append_sheet(wb, ws, 'Comisiones');
    }

    XLSX.writeFile(wb, `Comisiones_${selectedAsesor === 'TODOS' ? 'CONSOLIDADO' : selectedAsesor.replace(/\s+/g, '_')}_${selectedYear}.xlsx`);
  };

  // Imprimir Liquidación PDF (Print Window)
  const handleExportComisionesPDF = () => {
    if (projectionData.length === 0) {
      alert("No hay comisiones proyectadas para imprimir.");
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("Por favor habilita las ventanas emergentes (popups) para imprimir.");
      return;
    }

    const shortYear = String(selectedYear).slice(-2);
    const meses = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].map(m => `${m}-${shortYear}`);

    const htmlContent = `
      <html>
        <head>
          <title>Liquidación de Comisiones InAndes - ${selectedYear}</title>
          <style>
            body { font-family: 'Outfit', 'Inter', sans-serif; color: #1e293b; margin: 30px; font-size: 11px; }
            h2 { color: #1e3a8a; margin-bottom: 2px; text-transform: uppercase; font-size: 16px; border-bottom: 2px solid #3b82f6; padding-bottom: 4px; }
            .meta { font-size: 10px; color: #64748b; margin-bottom: 15px; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; page-break-inside: avoid; }
            th { background-color: #1e293b; color: white; font-weight: bold; text-transform: uppercase; font-size: 8px; padding: 6px 4px; text-align: left; }
            td { border-bottom: 1px solid #e2e8f0; padding: 5px 4px; }
            .totals-row { background-color: #f1f5f9; font-weight: bold; }
            .text-right { text-align: right; }
          </style>
        </head>
        <body>
          <h2>INANDES CRM - REPORTE DE LIQUIDACIÓN DE COMISIONES</h2>
          <div class="meta">Asesor: ${selectedAsesor === 'TODOS' ? 'CONSOLIDADO' : selectedAsesor} | Año: ${selectedYear}</div>
          
          <table>
            <thead>
              <tr>
                <th>Asesor</th>
                <th>Fondo</th>
                <th>Certificado</th>
                <th class="text-right">Capital</th>
                <th>Capt.</th>
                <th>Mant.</th>
                <th>Unica</th>
                ${meses.map(m => `<th class="text-right">${m}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${projectionData.map((r: any) => `
                <tr>
                  <td>${r.Asesor}</td>
                  <td>${r.Fondo}</td>
                  <td>${r.ID_Certificado}</td>
                  <td class="text-right">${r.Capital.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</td>
                  <td>${r.Captacion || '-'}</td>
                  <td>${r.Mantenimiento || '-'}</td>
                  <td>${r.Unica || '-'}</td>
                  ${meses.map(m => `<td class="text-right">${r[m] === '-' ? '-' : Number(r[m]).toLocaleString('es-PE', { minimumFractionDigits: 2 })}</td>`).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
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

  // Abrir Modal de Edición/Creación
  const handleOpenEditModal = (advisor: Asesor | null) => {
    setFormSubmitError(null);
    setFormSubmitSuccess(false);
    setFormActiveTab('identidad');
    
    if (advisor) {
      setFormMode('editar');
      setFormData({ ...advisor });
    } else {
      setFormMode('crear');
      setFormData({
        tipo_documento: 'DNI',
        documento_identidad: '',
        nombre_completo: '',
        telefono: '',
        nacionalidad: 'Perú',
        email: '',
        estado_civil: 'Soltero',
        profesion: '',
        direccion: '',
        distrito: '',
        provincia: '',
        departamento: '',
        codigo_postal: '',
        pais_residencia: 'Perú',
        es_residente_fiscal: true,
        es_pep: false
      });
    }
    setIsModalOpen(true);
  };

  const handleInputChange = (field: keyof Asesor, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitError(null);
    setFormSubmitSuccess(false);

    if (!formData.documento_identidad || !formData.nombre_completo) {
      setFormSubmitError("Por favor completa los campos obligatorios (N° Documento y Nombre Completo).");
      return;
    }

    try {
      await upsertAsesor(formData);
      setFormSubmitSuccess(true);
      setTimeout(() => {
        setIsModalOpen(false);
        fetchAsesores();
      }, 1000);
    } catch (err: any) {
      setFormSubmitError(err.message || 'Error al guardar el asesor.');
    }
  };

  // Filtrado reactivo en directorio
  const filteredAsesores = asesores.filter(item => {
    const term = searchTerm.toLowerCase();
    return (
      item.nombre_completo.toLowerCase().includes(term) ||
      (item.codigo && item.codigo.toLowerCase().includes(term)) ||
      item.documento_identidad.includes(term)
    );
  });

  return (
    <div className="flex flex-col gap-6 w-full animate-fadeIn">
      
      {/* Selector de sub-pestañas superior */}
      <div className="border-b border-slate-200 dark:border-slate-800 w-full flex items-center justify-between">
        <div className="flex gap-6">
          <button
            className={`py-3 text-xs font-black tracking-wider uppercase border-b-2 cursor-pointer transition-colors ${
              activeSubTab === 'datos' 
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400' 
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-350'
            }`}
            onClick={() => setActiveSubTab('datos')}
          >
            📋 Datos Asesores
          </button>
          <button
            className={`py-3 text-xs font-black tracking-wider uppercase border-b-2 cursor-pointer transition-colors ${
              activeSubTab === 'comisiones' 
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400' 
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-350'
            }`}
            onClick={() => setActiveSubTab('comisiones')}
          >
            💰 Cálculo de Comisiones
          </button>
        </div>
      </div>

      {/* --- PESTAÑA A: DIRECTORIO DE ASESORES --- */}
      {activeSubTab === 'datos' && (
        <div className="flex flex-col gap-6 w-full animate-fadeIn">
          
          {/* Métricas e Indicador */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm flex items-center gap-4">
              <div className="h-10 w-10 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900 text-emerald-600 dark:text-emerald-400 rounded-lg flex items-center justify-center shrink-0">
                <Briefcase size={20} />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">Fuerza de Ventas</span>
                <span className="text-xl font-black text-slate-800 dark:text-slate-100">{asesores.length} Asesores</span>
              </div>
            </div>
          </div>

          {/* Buscador y Botones */}
          <div className="flex flex-wrap items-center justify-between gap-4 w-full bg-slate-50/50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={15} />
              <input
                type="text"
                className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg py-2 pl-9 pr-4 text-xs font-semibold text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-emerald-650 focus:ring-1 focus:ring-emerald-650 transition-all shadow-sm"
                placeholder="Buscar por Nombre o Código..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2">
              <button 
                className="h-9 text-xs font-bold flex items-center gap-1.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-sm hover:shadow transition-all"
                onClick={() => handleOpenEditModal(null)}
              >
                <UserPlus size={14} />
                <span>Registrar Nuevo</span>
              </button>
              
              <button 
                className="h-9 text-xs font-bold flex items-center gap-1.5 px-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-650 dark:text-slate-300 cursor-pointer transition-colors shadow-sm"
                onClick={handleExportAsesoresExcel}
                disabled={asesores.length === 0}
              >
                <FileSpreadsheet size={13} className="text-emerald-600" />
                <span>Exportar Excel</span>
              </button>

              <button 
                className="h-9 text-xs font-bold flex items-center gap-1.5 px-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-650 dark:text-slate-300 cursor-pointer transition-colors shadow-sm"
                onClick={fetchAsesores}
                disabled={loading}
              >
                <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          {/* Cards Directory */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 text-center gap-3">
              <Loader2 className="animate-spin text-emerald-600" size={40} />
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Cargando fuerza de ventas...</p>
            </div>
          ) : error ? (
            <div className="max-w-md mx-auto my-12 bg-white dark:bg-slate-800 border border-rose-200 dark:border-rose-950 p-6 rounded-2xl shadow-sm text-center flex flex-col items-center gap-3">
              <AlertCircle className="text-rose-650" size={40} />
              <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 tracking-tight uppercase">Error de Conexión</h3>
              <p className="text-xs text-slate-450 dark:text-slate-400 leading-relaxed">{error}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 w-full">
              {filteredAsesores.length > 0 ? (
                filteredAsesores.map((a) => {
                  const initials = a.nombre_completo.split(' ').map(x => x.charAt(0)).slice(0, 2).join('').toUpperCase();
                  return (
                    <div 
                      key={a.id}
                      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-xl p-5 shadow-sm hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between gap-4"
                    >
                      <div className="flex items-start gap-4">
                        {/* Avatar */}
                        <div className="h-10 w-10 rounded-full bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 text-blue-600 dark:text-blue-400 font-black text-xs flex items-center justify-center shrink-0">
                          {initials || 'AS'}
                        </div>

                        {/* Detalle */}
                        <div className="flex flex-col min-w-0">
                          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-150 truncate leading-snug" title={a.nombre_completo}>
                            {a.nombre_completo}
                          </h4>
                          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 font-mono tracking-wider mt-0.5">
                            🆔 {a.codigo || 'PENDING'}
                          </span>
                        </div>
                      </div>

                      {/* Contacto */}
                      <div className="flex flex-col gap-1 py-1 border-t border-slate-100 dark:border-slate-800/60 mt-1">
                        <div className="flex justify-between items-center text-[10px] text-slate-500 dark:text-slate-400">
                          <span className="font-semibold truncate max-w-[170px]">{a.email || 'N/A'}</span>
                          <span className="font-mono">{a.telefono || 'N/A'}</span>
                        </div>
                      </div>

                      {/* Botón Editar */}
                      <div className="flex items-center justify-end border-t border-slate-150 dark:border-slate-800/80 pt-3 mt-1">
                        <button
                          className="h-7 text-[10px] font-bold flex items-center gap-1 px-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-250 dark:hover:bg-emerald-950/30 dark:hover:text-emerald-400 dark:hover:border-emerald-900 transition-colors cursor-pointer text-slate-600 dark:text-slate-350"
                          onClick={() => handleOpenEditModal(a)}
                        >
                          <Edit2 size={10} />
                          <span>Editar Ficha</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="col-span-full py-16 text-center text-slate-400 font-bold uppercase tracking-wider border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900">
                  No se encontraron asesores registrados.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* --- PESTAÑA B: CÁLCULO DE COMISIONES --- */}
      {activeSubTab === 'comisiones' && (
        <div className="flex flex-col gap-6 w-full animate-fadeIn">
          
          {/* Selectores de Proyección */}
          <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-wrap gap-4 items-end shadow-sm">
            <div className="flex flex-col gap-1.5 min-w-[250px] flex-1">
              <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Seleccione el asesor para auditar comisiones</label>
              <select
                className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-lg py-1.5 px-3 text-xs font-semibold focus:outline-none"
                value={selectedAsesor}
                onChange={(e) => setSelectedAsesor(e.target.value)}
              >
                <option value="TODOS">TODOS los asesores</option>
                {asesores.map(a => (
                  <option key={a.codigo} value={a.codigo || ''}>{a.nombre_completo}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5 w-[120px]">
              <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Año</label>
              <select
                className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-lg py-1.5 px-3 text-xs font-semibold focus:outline-none"
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
              >
                <option value={2025}>2025</option>
                <option value={2026}>2026</option>
                <option value={2027}>2027</option>
              </select>
            </div>
            
            <div className="flex gap-2">
              <button
                className="h-8.5 text-xs font-bold bg-emerald-650 hover:bg-emerald-700 text-white px-4 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer shadow transition-colors disabled:opacity-50"
                onClick={handleExportComisionesExcel}
                disabled={projectionLoading || projectionData.length === 0}
              >
                <FileSpreadsheet size={13} />
                <span>Descargar Excel</span>
              </button>

              <button
                className="h-8.5 text-xs font-bold bg-blue-650 hover:bg-blue-700 text-white px-4 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer shadow transition-colors disabled:opacity-50"
                onClick={handleExportComisionesPDF}
                disabled={projectionLoading || projectionData.length === 0}
              >
                <FileText size={13} />
                <span>PDF Liquidación</span>
              </button>
            </div>
          </div>

          {/* Tabla de Resultados Proyectados */}
          <div className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
            {projectionLoading ? (
              <div className="flex flex-col items-center justify-center py-24 text-center gap-3">
                <Loader2 className="animate-spin text-emerald-600" size={30} />
                <p className="text-xs text-slate-450 dark:text-slate-500 font-bold uppercase tracking-wider">Proyectando comisiones del periodo...</p>
              </div>
            ) : projectionData.length > 0 ? (
              <div className="overflow-x-auto w-full">
                <table className="w-full text-left border-collapse text-[10px]">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-850/60 border-b border-slate-250 dark:border-slate-800">
                      <th className="font-bold text-slate-400 dark:text-slate-500 px-3 py-2.5 uppercase tracking-wider">Asesor</th>
                      <th className="font-bold text-slate-400 dark:text-slate-500 px-3 py-2.5 uppercase tracking-wider">Fondo</th>
                      <th className="font-bold text-slate-400 dark:text-slate-500 px-3 py-2.5 uppercase tracking-wider">Certificado</th>
                      <th className="font-bold text-slate-400 dark:text-slate-500 px-3 py-2.5 uppercase tracking-wider text-right">Capital</th>
                      <th className="font-bold text-slate-400 dark:text-slate-500 px-3 py-2.5 uppercase tracking-wider">Capt.</th>
                      <th className="font-bold text-slate-400 dark:text-slate-500 px-3 py-2.5 uppercase tracking-wider">Mant.</th>
                      <th className="font-bold text-slate-400 dark:text-slate-500 px-3 py-2.5 uppercase tracking-wider">Unica</th>
                      
                      {/* Columnas Mensuales */}
                      {["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].map(m => (
                        <th key={m} className="font-bold text-slate-400 dark:text-slate-500 px-3 py-2.5 uppercase tracking-wider text-right">
                          {m}-{String(selectedYear).slice(-2)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {projectionData.map((r, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 border-b border-slate-150 dark:border-slate-800/50 transition-colors">
                        <td className="px-3 py-2 font-bold text-slate-700 dark:text-slate-300">{r.Asesor}</td>
                        <td className="px-3 py-2 font-bold text-slate-800 dark:text-slate-100">{r.Fondo}</td>
                        <td className="px-3 py-2 font-mono text-slate-500 dark:text-slate-450">{r.ID_Certificado}</td>
                        <td className="px-3 py-2 font-bold text-slate-800 dark:text-slate-200 text-right">
                          {r.Capital.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-3 py-2 font-semibold text-slate-500 dark:text-slate-450">{r.Captacion}</td>
                        <td className="px-3 py-2 font-semibold text-slate-500 dark:text-slate-450">{r.Mantenimiento}</td>
                        <td className="px-3 py-2 font-semibold text-slate-500 dark:text-slate-450">{r.Unica}</td>
                        
                        {/* Meses Proyectados */}
                        {["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].map(m => {
                          const key = `${m}-${String(selectedYear).slice(-2)}`;
                          const val = r[key];
                          return (
                            <td key={m} className={`px-3 py-2 text-right font-mono ${val !== '-' ? 'font-black text-emerald-650 dark:text-emerald-450' : 'text-slate-300 dark:text-slate-700'}`}>
                              {val === '-' ? '-' : val.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-16 text-center text-slate-400 font-bold uppercase tracking-wider">
                No se encontraron certificados activos para proyectar en este periodo.
              </div>
            )}
          </div>

        </div>
      )}

      {/* --- FORMULARIO MODAL (5 TABS) --- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-3xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">
            
            {/* Cabecera */}
            <div className="p-5 border-b border-slate-150 dark:border-slate-800/80 flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-850 dark:text-slate-100 uppercase tracking-wider">
                {formMode === 'crear' ? '➕ Registrar Nuevo Asesor' : '✏️ Editar Ficha de Asesor'}
              </h3>
              <button 
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                onClick={() => setIsModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            {/* Sub-pestañas de Formulario */}
            <div className="px-5 bg-slate-50 dark:bg-slate-950 border-b border-slate-150 dark:border-slate-850 flex gap-4 overflow-x-auto whitespace-nowrap scrollbar-none">
              {(['identidad', 'ubicacion', 'conyuge', 'laboral', 'bancario'] as const).map(tab => (
                <button
                  key={tab}
                  type="button"
                  className={`py-2.5 text-[10px] font-black uppercase tracking-wider border-b-2 cursor-pointer transition-colors ${
                    formActiveTab === tab 
                      ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400' 
                      : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-350'
                  }`}
                  onClick={() => setFormActiveTab(tab)}
                >
                  {tab === 'identidad' && 'Identidad'}
                  {tab === 'ubicacion' && 'Ubicación'}
                  {tab === 'conyuge' && 'Cónyuge'}
                  {tab === 'laboral' && 'Laboral/PEP'}
                  {tab === 'bancario' && 'Bancario'}
                </button>
              ))}
            </div>

            {/* Formulario */}
            <form onSubmit={handleFormSubmit} className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
              
              {/* TAB 1: IDENTIDAD */}
              {formActiveTab === 'identidad' && (
                <div className="flex flex-col gap-4 animate-fadeIn">
                  <h4 className="text-xs font-bold text-slate-805 dark:text-slate-200 uppercase tracking-tight">Datos Personales</h4>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">N° Documento *</label>
                      <input
                        type="text"
                        className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                        value={formData.documento_identidad || ''}
                        onChange={(e) => handleInputChange('documento_identidad', e.target.value)}
                        required
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Tipo Doc</label>
                      <select
                        className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                        value={formData.tipo_documento || 'DNI'}
                        onChange={(e) => handleInputChange('tipo_documento', e.target.value)}
                      >
                        <option value="DNI">DNI</option>
                        <option value="CE">CE</option>
                        <option value="RUC">RUC</option>
                        <option value="PASAPORTE">PASAPORTE</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Nombre Completo (o Razón Social) *</label>
                    <input
                      type="text"
                      className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                      value={formData.nombre_completo || ''}
                      onChange={(e) => handleInputChange('nombre_completo', e.target.value)}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Celular / Teléfono</label>
                      <input
                        type="text"
                        className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                        value={formData.telefono || ''}
                        onChange={(e) => handleInputChange('telefono', e.target.value)}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Fecha Nacimiento</label>
                      <input
                        type="date"
                        className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                        value={formData.fecha_nacimiento || ''}
                        onChange={(e) => handleInputChange('fecha_nacimiento', e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Nacionalidad</label>
                      <input
                        type="text"
                        className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                        value={formData.nacionalidad || 'Perú'}
                        onChange={(e) => handleInputChange('nacionalidad', e.target.value)}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Estado Civil</label>
                      <select
                        className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                        value={formData.estado_civil || 'Soltero'}
                        onChange={(e) => handleInputChange('estado_civil', e.target.value)}
                      >
                        <option value="Soltero">Soltero</option>
                        <option value="Casado">Casado</option>
                        <option value="Divorciado">Divorciado</option>
                        <option value="Viudo">Viudo</option>
                        <option value="Conviviente">Conviviente</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Profesión</label>
                      <input
                        type="text"
                        className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                        value={formData.profesion || ''}
                        onChange={(e) => handleInputChange('profesion', e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Email corporativo / personal</label>
                    <input
                      type="email"
                      className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                      value={formData.email || ''}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                    />
                  </div>
                </div>
              )}

              {/* TAB 2: UBICACIÓN */}
              {formActiveTab === 'ubicacion' && (
                <div className="flex flex-col gap-4 animate-fadeIn">
                  <h4 className="text-xs font-bold text-slate-805 dark:text-slate-200 uppercase tracking-tight">Domicilio Fiscal</h4>
                  
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Dirección</label>
                    <input
                      type="text"
                      className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                      value={formData.direccion || ''}
                      onChange={(e) => handleInputChange('direccion', e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Distrito</label>
                      <input
                        type="text"
                        className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                        value={formData.distrito || ''}
                        onChange={(e) => handleInputChange('distrito', e.target.value)}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Provincia</label>
                      <input
                        type="text"
                        className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                        value={formData.provincia || ''}
                        onChange={(e) => handleInputChange('provincia', e.target.value)}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Departamento</label>
                      <input
                        type="text"
                        className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                        value={formData.departamento || ''}
                        onChange={(e) => handleInputChange('departamento', e.target.value)}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Cód Postal</label>
                      <input
                        type="text"
                        className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                        value={formData.codigo_postal || ''}
                        onChange={(e) => handleInputChange('codigo_postal', e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-100 dark:border-slate-800/80 pt-4 mt-2">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">País Residencia</label>
                      <input
                        type="text"
                        className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                        value={formData.pais_residencia || 'Perú'}
                        onChange={(e) => handleInputChange('pais_residencia', e.target.value)}
                      />
                    </div>

                    <div className="flex items-center gap-2 mt-6">
                      <input
                        type="checkbox"
                        id="es_residente_fiscal"
                        className="rounded text-emerald-600 focus:ring-emerald-650 h-4 w-4"
                        checked={formData.es_residente_fiscal ?? true}
                        onChange={(e) => handleInputChange('es_residente_fiscal', e.target.checked)}
                      />
                      <label htmlFor="es_residente_fiscal" className="text-xs font-bold text-slate-650 dark:text-slate-400">¿Es Residente Fiscal en Perú?</label>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: CÓNYUGE */}
              {formActiveTab === 'conyuge' && (
                <div className="flex flex-col gap-4 animate-fadeIn">
                  <h4 className="text-xs font-bold text-slate-805 dark:text-slate-200 uppercase tracking-tight">Información del Cónyuge</h4>
                  
                  {(!['Casado', 'Conviviente'].includes(formData.estado_civil || '')) ? (
                    <div className="bg-slate-50 dark:bg-slate-950 text-slate-450 dark:text-slate-500 border border-slate-200 dark:border-slate-850 rounded-xl p-6 text-center text-xs font-semibold">
                      🔒 No disponible. Se habilita únicamente si el Estado Civil es "Casado" o "Conviviente" (Actual: {formData.estado_civil || 'Soltero'}).
                    </div>
                  ) : (
                    <div className="flex flex-col gap-4">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Nombre Completo Cónyuge</label>
                        <input
                          type="text"
                          className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                          value={formData.nombre_completo_conyuge || ''}
                          onChange={(e) => handleInputChange('nombre_completo_conyuge', e.target.value)}
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Tipo Doc Cónyuge</label>
                          <select
                            className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                            value={formData.tipo_documento_conyuge || 'DNI'}
                            onChange={(e) => handleInputChange('tipo_documento_conyuge', e.target.value)}
                          >
                            <option value="DNI">DNI</option>
                            <option value="CE">CE</option>
                          </select>
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">N° Documento Cónyuge</label>
                          <input
                            type="text"
                            className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                            value={formData.num_documento_conyuge || ''}
                            onChange={(e) => handleInputChange('num_documento_conyuge', e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: LABORAL/PEP */}
              {formActiveTab === 'laboral' && (
                <div className="flex flex-col gap-4 animate-fadeIn">
                  <h4 className="text-xs font-bold text-slate-805 dark:text-slate-200 uppercase tracking-tight">Información Laboral</h4>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Ocupación</label>
                      <input
                        type="text"
                        className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                        value={formData.ocupacion || ''}
                        onChange={(e) => handleInputChange('ocupacion', e.target.value)}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Centro Laboral</label>
                      <input
                        type="text"
                        className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                        value={formData.centro_labores || ''}
                        onChange={(e) => handleInputChange('centro_labores', e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Cargo</label>
                      <input
                        type="text"
                        className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                        value={formData.cargo_ocupado || ''}
                        onChange={(e) => handleInputChange('cargo_ocupado', e.target.value)}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Antigüedad Laboral (Años)</label>
                      <input
                        type="number"
                        className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                        value={formData.antiguedad_laboral_anios ?? 0}
                        onChange={(e) => handleInputChange('antiguedad_laboral_anios', parseInt(e.target.value, 10) || 0)}
                      />
                    </div>
                  </div>

                  <div className="border-t border-slate-100 dark:border-slate-800/80 pt-4 mt-2">
                    <h4 className="text-xs font-bold text-slate-805 dark:text-slate-200 uppercase tracking-tight mb-3">Debida Diligencia (PEP)</h4>
                    
                    <div className="flex items-center gap-2 mb-3">
                      <input
                        type="checkbox"
                        id="es_pep"
                        className="rounded text-emerald-600 focus:ring-emerald-650 h-4 w-4"
                        checked={formData.es_pep || false}
                        onChange={(e) => handleInputChange('es_pep', e.target.checked)}
                      />
                      <label htmlFor="es_pep" className="text-xs font-bold text-slate-655 dark:text-slate-400">¿Es Persona Expuesta Políticamente (PEP)?</label>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Detalle PEP (Si aplica)</label>
                      <textarea
                        rows={2}
                        className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                        value={formData.pep_detalle || ''}
                        onChange={(e) => handleInputChange('pep_detalle', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 5: BANCARIO */}
              {formActiveTab === 'bancario' && (
                <div className="flex flex-col gap-6 animate-fadeIn">
                  
                  {/* Cuentas Soles */}
                  <div className="flex flex-col gap-3">
                    <h4 className="text-xs font-bold text-emerald-650 dark:text-emerald-450 uppercase tracking-tight">Cuentas Soles (PEN)</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Banco (PEN)</label>
                        <input
                          type="text"
                          className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                          value={formData.banco_nombre_pen || ''}
                          onChange={(e) => handleInputChange('banco_nombre_pen', e.target.value)}
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">N° Cuenta (PEN)</label>
                        <input
                          type="text"
                          className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                          value={formData.numero_cuenta_pen || ''}
                          onChange={(e) => handleInputChange('numero_cuenta_pen', e.target.value)}
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">CCI (PEN)</label>
                        <input
                          type="text"
                          className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                          value={formData.cci_pen || ''}
                          onChange={(e) => handleInputChange('cci_pen', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  <hr className="border-slate-100 dark:border-slate-800/80" />

                  {/* Cuentas Dólares */}
                  <div className="flex flex-col gap-3">
                    <h4 className="text-xs font-bold text-blue-650 dark:text-blue-450 uppercase tracking-tight">Cuentas Dólares (USD)</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Banco (USD)</label>
                        <input
                          type="text"
                          className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                          value={formData.banco_nombre_usd || ''}
                          onChange={(e) => handleInputChange('banco_nombre_usd', e.target.value)}
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">N° Cuenta (USD)</label>
                        <input
                          type="text"
                          className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                          value={formData.numero_cuenta_usd || ''}
                          onChange={(e) => handleInputChange('numero_cuenta_usd', e.target.value)}
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">CCI (USD)</label>
                        <input
                          type="text"
                          className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                          value={formData.cci_usd || ''}
                          onChange={(e) => handleInputChange('cci_usd', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                </div>
              )}

              {/* Errores y Éxito */}
              {formSubmitError && (
                <div className="bg-rose-50 dark:bg-rose-950/20 text-rose-650 dark:text-rose-450 border border-rose-200 dark:border-rose-900 rounded-lg p-3 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle size={14} />
                  <span>{formSubmitError}</span>
                </div>
              )}

              {formSubmitSuccess && (
                <div className="bg-emerald-50 dark:bg-emerald-950/20 text-emerald-650 dark:text-emerald-450 border border-emerald-250 dark:border-emerald-900 rounded-lg p-3 text-xs font-semibold flex items-center gap-2">
                  <CheckCircle size={14} />
                  <span>¡Asesor guardado correctamente en Supabase!</span>
                </div>
              )}

            </form>

            {/* Pie */}
            <div className="p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-150 dark:border-slate-850 flex items-center justify-end gap-2.5">
              <button 
                type="button" 
                className="h-9 text-xs font-bold px-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-650 dark:text-slate-300 cursor-pointer hover:bg-slate-50 transition-colors"
                onClick={() => setIsModalOpen(false)}
              >
                Cancelar
              </button>
              <button 
                type="submit" 
                onClick={handleFormSubmit}
                className="h-9 text-xs font-black uppercase tracking-wider px-6 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-sm"
              >
                Guardar Información
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
