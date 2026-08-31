import React, { useEffect, useState } from 'react';
import { getAsesores, upsertAsesor } from '../../services/asesoresService';
import type { Asesor } from '../../services/asesoresService';
import * as XLSX from 'xlsx';
import { 
  Search, Loader2, AlertCircle, Edit2, UserPlus, 
  FileSpreadsheet, CheckCircle, X
} from 'lucide-react';
import { SBS_BANCOS_NOMBRES } from '../../constants/sbsBancos';
import { ComisionesAsesoresTab } from '../inversionistas/ComisionesAsesoresTab';

export const AsesoresPage: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<'datos' | 'comisiones'>('datos');

  // Estado del directorio de asesores
  const [asesores, setAsesores] = useState<Asesor[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedRange, setSelectedRange] = useState<string>('TODOS');

  // Estado del formulario modal (5 pestañas)
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [formMode, setFormMode] = useState<'crear' | 'editar'>('crear');
  const [formData, setFormData] = useState<Partial<Asesor>>({});
  const [formActiveTab, setFormActiveTab] = useState<'identidad' | 'ubicacion' | 'conyuge' | 'laboral' | 'bancario'>('identidad');
  const [formSubmitError, setFormSubmitError] = useState<string | null>(null);
  const [formSubmitSuccess, setFormSubmitSuccess] = useState<boolean>(false);

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

  useEffect(() => {
    fetchAsesores();
  }, []);

  // Exportar asesores a Excel
  const handleExportAsesoresExcel = () => {
    if (asesores.length === 0) return;
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(asesores);
    XLSX.utils.book_append_sheet(wb, ws, 'Asesores');
    XLSX.writeFile(wb, 'asesores_crm.xlsx');
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
        nombre_1: '',
        nombre_2: '',
        apellido_1: '',
        apellido_2: '',
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

    if (!formData.documento_identidad || !formData.nombre_1 || !formData.apellido_1) {
      setFormSubmitError("Por favor completa los campos obligatorios (N° Documento, Primer Nombre y Primer Apellido).");
      return;
    }

    // Auto-generar nombre_completo
    const n1 = (formData.nombre_1 || '').trim();
    const n2 = (formData.nombre_2 || '').trim();
    const a1 = (formData.apellido_1 || '').trim();
    const a2 = (formData.apellido_2 || '').trim();
    const generatedName = [n1, n2, a1, a2].filter(Boolean).join(' ');
    formData.nombre_completo = generatedName || formData.nombre_completo;

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
    // Filtro por texto
    const term = searchTerm.toLowerCase();
    const matchesText = (
      item.nombre_completo.toLowerCase().includes(term) ||
      (item.codigo && item.codigo.toLowerCase().includes(term)) ||
      item.documento_identidad.includes(term)
    );

    // Filtro por rango alfabético
    let matchesRange = true;
    if (selectedRange !== 'TODOS') {
      const apellidoParaFiltro = (item.apellido_1 || 'Z').trim();
      const firstLetter = apellidoParaFiltro.normalize("NFD").replace(/[\u0300-\u036f]/g, "").charAt(0).toUpperCase();
      
      if (selectedRange === 'ABC') matchesRange = /^[A-C]/.test(firstLetter);
      else if (selectedRange === 'DEF') matchesRange = /^[D-F]/.test(firstLetter);
      else if (selectedRange === 'GHI') matchesRange = /^[G-I]/.test(firstLetter);
      else if (selectedRange === 'JKL') matchesRange = /^[J-L]/.test(firstLetter);
      else if (selectedRange === 'MNO') matchesRange = /^[M-O]/.test(firstLetter);
      else if (selectedRange === 'PQR') matchesRange = /^[P-R]/.test(firstLetter);
      else if (selectedRange === 'STU') matchesRange = /^[S-U]/.test(firstLetter);
      else if (selectedRange === 'VWX') matchesRange = /^[V-X]/.test(firstLetter);
      else if (selectedRange === 'YZ') matchesRange = /^[Y-Z]/.test(firstLetter);
      else matchesRange = false;
    }

    return matchesText && matchesRange;
  }).sort((a, b) => {
    const a1 = (a.apellido_1 || '').toLowerCase();
    const b1 = (b.apellido_1 || '').toLowerCase();
    if (a1 < b1) return -1;
    if (a1 > b1) return 1;
    
    const a2 = (a.apellido_2 || '').toLowerCase();
    const b2 = (b.apellido_2 || '').toLowerCase();
    if (a2 < b2) return -1;
    if (a2 > b2) return 1;

    const n1 = (a.nombre_1 || '').toLowerCase();
    const m1 = (b.nombre_1 || '').toLowerCase();
    if (n1 < m1) return -1;
    if (n1 > m1) return 1;

    return 0;
  });

  return (
    <div className="flex flex-col gap-6 w-full animate-fadeIn">
      
      {/* Selector de sub-pestañas superior Estilo APEFAC */}
      <div className="border-b border-[#e2e8f0] dark:border-[#334155] w-full flex items-center justify-between">
        <div className="flex gap-4">
          <button
            className={`py-3 px-2 text-xs font-black tracking-wider uppercase border-b-[3px] cursor-pointer transition-colors ${
              activeSubTab === 'datos' 
                ? 'border-[#0284c7] text-[#0284c7] dark:text-[#38bdf8]' 
                : 'border-transparent text-[#64748b] hover:text-[#0f172a] dark:text-[#94a3b8] dark:hover:text-[#f8fafc]'
            }`}
            onClick={() => setActiveSubTab('datos')}
          >
            📋 Datos Asesores
          </button>
          <button
            className={`py-3 px-2 text-xs font-black tracking-wider uppercase border-b-[3px] cursor-pointer transition-colors ${
              activeSubTab === 'comisiones' 
                ? 'border-[#0284c7] text-[#0284c7] dark:text-[#38bdf8]' 
                : 'border-transparent text-[#64748b] hover:text-[#0f172a] dark:text-[#94a3b8] dark:hover:text-[#f8fafc]'
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
          
          {/* Top Bar: Buscar + Rango + Acciones */}
          <div className="glass-card p-5 flex flex-wrap gap-4 items-center justify-between">
            <div className="relative flex-1 min-w-[260px]">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <Search size={15} />
              </span>
              <input
                type="text"
                className="w-full bg-[#f8fafc] dark:bg-[#0b0f19] border border-[#e2e8f0] dark:border-[#334155] rounded-xl py-2 pl-9 pr-3 text-xs font-semibold focus:outline-none placeholder:text-slate-400"
                placeholder="Buscar por Nombre, DNI o Código de Asesor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="flex gap-2">
              <button
                className="h-9 text-xs font-bold bg-[#0284c7] hover:bg-[#0369a1] text-white px-4 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                onClick={() => handleOpenEditModal(null)}
              >
                <UserPlus size={14} />
                <span>Nuevo Asesor</span>
              </button>

              <button
                className="h-9 text-xs font-bold bg-[#ecfdf5] dark:bg-[#059669]/15 border border-[#a7f3d0] dark:border-[#059669]/30 text-[#059669] dark:text-[#34d399] px-4 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs hover:bg-[#d1fae5] transition-colors"
                onClick={handleExportAsesoresExcel}
              >
                <FileSpreadsheet size={14} />
                <span>Exportar</span>
              </button>
            </div>
          </div>

          {/* Rango Alfabético (Tabs) */}
          <div className="flex flex-wrap gap-2 items-center justify-center sm:justify-start">
            {['ABC', 'DEF', 'GHI', 'JKL', 'MNO', 'PQR', 'STU', 'VWX', 'YZ', 'TODOS'].map((rango) => (
              <button
                key={rango}
                onClick={() => setSelectedRange(rango)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold tracking-wide transition-all cursor-pointer ${
                  selectedRange === rango 
                    ? 'bg-[#0284c7] text-white shadow-xs' 
                    : 'bg-white dark:bg-[#1e293b] text-[#475569] dark:text-[#cbd5e1] border border-[#e2e8f0] dark:border-[#334155] hover:border-[#bae6fd]'
                }`}
              >
                {rango}
              </button>
            ))}
          </div>

          {/* Cards Directory */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 text-center gap-3">
              <Loader2 className="animate-spin text-[#0284c7]" size={40} />
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Cargando fuerza de ventas...</p>
            </div>
          ) : error ? (
            <div className="max-w-md mx-auto my-12 bg-white dark:bg-[#1e293b] border border-rose-200 dark:border-rose-900/50 p-6 rounded-2xl shadow-sm text-center flex flex-col items-center gap-3">
              <AlertCircle className="text-rose-600" size={40} />
              <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase">Error de Conexión</h3>
              <p className="text-xs text-slate-400 leading-relaxed">{error}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 w-full">
              {filteredAsesores.length > 0 ? (
                filteredAsesores.map((a) => {
                  const ap1 = a.apellido_1 || '';
                  const ap2 = a.apellido_2 || '';
                  const n1 = a.nombre_1 || '';
                  const n2 = a.nombre_2 || '';
                  const apellidos = [ap1, ap2].filter(Boolean).join(' ');
                  const nombres = [n1, n2].filter(Boolean).join(' ');
                  const displayName = (apellidos && nombres) ? `${apellidos}, ${nombres}` : a.nombre_completo;
                  const initials = a.nombre_completo.split(' ').map(x => x.charAt(0)).slice(0, 2).join('').toUpperCase();
                  
                  return (
                    <div 
                      key={a.id}
                      className="glass-card p-5 hover:scale-[1.01] transition-all flex flex-col justify-between gap-4"
                    >
                      <div className="flex items-start gap-4">
                        {/* Avatar con Gradiente APEFAC */}
                        <div 
                          className="h-10 w-10 rounded-xl text-white font-mono font-black text-xs flex items-center justify-center shrink-0 shadow-xs"
                          style={{ background: 'linear-gradient(135deg, #0284c7 0%, #4f46e5 100%)' }}
                        >
                          {initials || 'AS'}
                        </div>

                        {/* Detalle */}
                        <div className="flex flex-col min-w-0">
                          <h4 className="text-xs font-black text-[#0f172a] dark:text-[#f8fafc] uppercase tracking-wider truncate leading-snug" title={displayName}>
                            {displayName}
                          </h4>
                          <span className="text-[10px] font-bold text-[#0284c7] dark:text-[#38bdf8] font-mono tracking-wider mt-0.5">
                            🆔 {a.codigo || 'PENDING'}
                          </span>
                        </div>
                      </div>

                      {/* Contacto */}
                      <div className="flex flex-col gap-1 py-1 border-t border-[#e2e8f0] dark:border-[#334155] mt-1">
                        <div className="flex justify-between items-center text-[10px] text-[#64748b] dark:text-[#94a3b8]">
                          <span className="font-semibold truncate max-w-[170px]">{a.email || 'N/A'}</span>
                          <span className="font-mono">{a.telefono || 'N/A'}</span>
                        </div>
                      </div>

                      {/* Botón Editar */}
                      <div className="flex items-center justify-end border-t border-[#e2e8f0] dark:border-[#334155] pt-3 mt-1">
                        <button
                          className="h-7 text-[10px] font-bold flex items-center gap-1 px-3 rounded-lg border border-[#e2e8f0] dark:border-[#334155] bg-white dark:bg-[#1e293b] hover:bg-[#f0f9ff] hover:text-[#0284c7] hover:border-[#bae6fd] text-[#475569] dark:text-[#cbd5e1] transition-colors cursor-pointer shadow-xs"
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
                <div className="col-span-full py-16 text-center text-slate-400 font-bold uppercase tracking-wider border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-[#1e293b]">
                  No se encontraron asesores registrados.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* --- PESTAÑA B: CÁLCULO DE COMISIONES (CANÓNICO 8 PERIODOS CON ACORDEONES) --- */}
      {activeSubTab === 'comisiones' && (
        <ComisionesAsesoresTab />
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

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Primer Nombre *</label>
                      <input
                        type="text"
                        className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none focus:border-emerald-600"
                        value={formData.nombre_1 || ''}
                        onChange={(e) => handleInputChange('nombre_1', e.target.value)}
                        placeholder="Primer Nombre"
                        required
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Segundo Nombre</label>
                      <input
                        type="text"
                        className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none focus:border-emerald-600"
                        value={formData.nombre_2 || ''}
                        onChange={(e) => handleInputChange('nombre_2', e.target.value)}
                        placeholder="Segundo Nombre"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Primer Apellido *</label>
                      <input
                        type="text"
                        className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none focus:border-emerald-600"
                        value={formData.apellido_1 || ''}
                        onChange={(e) => handleInputChange('apellido_1', e.target.value)}
                        placeholder="Primer Apellido"
                        required
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Segundo Apellido</label>
                      <input
                        type="text"
                        className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none focus:border-emerald-600"
                        value={formData.apellido_2 || ''}
                        onChange={(e) => handleInputChange('apellido_2', e.target.value)}
                        placeholder="Segundo Apellido"
                      />
                    </div>
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
                        className="rounded text-emerald-600 focus:ring-emerald-600 h-4 w-4"
                        checked={formData.es_residente_fiscal ?? true}
                        onChange={(e) => handleInputChange('es_residente_fiscal', e.target.checked)}
                      />
                      <label htmlFor="es_residente_fiscal" className="text-xs font-bold text-slate-700 dark:text-slate-400">¿Es Residente Fiscal en Perú?</label>
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
                        className="rounded text-emerald-600 focus:ring-emerald-600 h-4 w-4"
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
                    <h4 className="text-xs font-bold text-emerald-600 dark:text-emerald-450 uppercase tracking-tight">Cuentas Soles (PEN)</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Banco (PEN)</label>
                        <select
                          className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                          value={formData.banco_nombre_pen || ''}
                          onChange={(e) => handleInputChange('banco_nombre_pen', e.target.value)}
                        >
                          <option value="">-- SELECCIONAR ENTIDAD SBS --</option>
                          {SBS_BANCOS_NOMBRES.map((banco) => (
                            <option key={banco} value={banco}>
                              {banco}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">N° Cuenta (PEN)</label>
                          {formData.numero_cuenta_pen && (
                            <span className="text-[9px] font-mono font-bold text-emerald-600 dark:text-emerald-400">
                              {formData.numero_cuenta_pen.length} dígitos
                            </span>
                          )}
                        </div>
                        <input
                          type="text"
                          maxLength={16}
                          placeholder="Ej: 19379031376071 (10-16 dígitos)"
                          className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-mono font-bold text-[#0f172a] dark:text-[#f8fafc] focus:outline-none"
                          value={formData.numero_cuenta_pen || ''}
                          onChange={(e) => handleInputChange('numero_cuenta_pen', e.target.value.replace(/\D/g, ''))}
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">CCI (PEN)</label>
                          {formData.cci_pen && (
                            <span className={`text-[9px] font-mono font-bold ${
                              formData.cci_pen.length === 20 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-500'
                            }`}>
                              {formData.cci_pen.length === 20 ? '✓ 20/20 dígitos' : `⚠️ ${formData.cci_pen.length}/20 dígitos`}
                            </span>
                          )}
                        </div>
                        <input
                          type="text"
                          maxLength={20}
                          placeholder="Ej: 00219311916481309617 (20 dígitos)"
                          className={`bg-white dark:bg-slate-950 border rounded-lg p-2 text-xs font-mono font-bold focus:outline-none ${
                            formData.cci_pen && formData.cci_pen.length !== 20
                              ? 'border-amber-400 text-amber-600 dark:text-amber-400'
                              : 'border-slate-200 dark:border-slate-800 text-[#0f172a] dark:text-[#f8fafc]'
                          }`}
                          value={formData.cci_pen || ''}
                          onChange={(e) => handleInputChange('cci_pen', e.target.value.replace(/\D/g, ''))}
                        />
                      </div>
                    </div>
                  </div>

                  <hr className="border-slate-100 dark:border-slate-800/80" />

                  {/* Cuentas Dólares */}
                  <div className="flex flex-col gap-3">
                    <h4 className="text-xs font-bold text-blue-600 dark:text-blue-450 uppercase tracking-tight">Cuentas Dólares (USD)</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Banco (USD)</label>
                        <select
                          className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                          value={formData.banco_nombre_usd || ''}
                          onChange={(e) => handleInputChange('banco_nombre_usd', e.target.value)}
                        >
                          <option value="">-- SELECCIONAR ENTIDAD SBS --</option>
                          {SBS_BANCOS_NOMBRES.map((banco) => (
                            <option key={banco} value={banco}>
                              {banco}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">N° Cuenta (USD)</label>
                          {formData.numero_cuenta_usd && (
                            <span className="text-[9px] font-mono font-bold text-blue-600 dark:text-blue-400">
                              {formData.numero_cuenta_usd.length} dígitos
                            </span>
                          )}
                        </div>
                        <input
                          type="text"
                          maxLength={16}
                          placeholder="Ej: 19395701362140 (10-16 dígitos)"
                          className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-mono font-bold text-[#0f172a] dark:text-[#f8fafc] focus:outline-none"
                          value={formData.numero_cuenta_usd || ''}
                          onChange={(e) => handleInputChange('numero_cuenta_usd', e.target.value.replace(/\D/g, ''))}
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">CCI (USD)</label>
                          {formData.cci_usd && (
                            <span className={`text-[9px] font-mono font-bold ${
                              formData.cci_usd.length === 20 ? 'text-blue-600 dark:text-blue-400' : 'text-amber-500'
                            }`}>
                              {formData.cci_usd.length === 20 ? '✓ 20/20 dígitos' : `⚠️ ${formData.cci_usd.length}/20 dígitos`}
                            </span>
                          )}
                        </div>
                        <input
                          type="text"
                          maxLength={20}
                          placeholder="Ej: 00219312146395616216 (20 dígitos)"
                          className={`bg-white dark:bg-slate-950 border rounded-lg p-2 text-xs font-mono font-bold focus:outline-none ${
                            formData.cci_usd && formData.cci_usd.length !== 20
                              ? 'border-amber-400 text-amber-600 dark:text-amber-400'
                              : 'border-slate-200 dark:border-slate-800 text-[#0f172a] dark:text-[#f8fafc]'
                          }`}
                          value={formData.cci_usd || ''}
                          onChange={(e) => handleInputChange('cci_usd', e.target.value.replace(/\D/g, ''))}
                        />
                      </div>
                    </div>
                  </div>

                </div>
              )}

              {/* Errores y Éxito */}
              {formSubmitError && (
                <div className="bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-450 border border-rose-200 dark:border-rose-900 rounded-lg p-3 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle size={14} />
                  <span>{formSubmitError}</span>
                </div>
              )}

              {formSubmitSuccess && (
                <div className="bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-450 border border-emerald-250 dark:border-emerald-900 rounded-lg p-3 text-xs font-semibold flex items-center gap-2">
                  <CheckCircle size={14} />
                  <span>¡Asesor guardado correctamente en Supabase!</span>
                </div>
              )}

            </form>

            {/* Pie */}
            <div className="p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-150 dark:border-slate-850 flex items-center justify-end gap-2.5">
              <button 
                type="button" 
                className="h-9 text-xs font-bold px-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 cursor-pointer hover:bg-slate-50 transition-colors"
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
