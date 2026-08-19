import React, { useState, useEffect, useMemo } from 'react';
import { factoringService } from '../../../services/factoringService';
import type { OperacionFactoring } from '../../../services/factoringService';
import { 
  FolderArchive, 
  Search, 
  Filter, 
  Eye, 
  Loader2,
  AlertCircle,
  Calendar,
  RotateCcw,
  Sparkles,
} from 'lucide-react';

export const RepositorioTab: React.FC = () => {
  const [operaciones, setOperaciones] = useState<OperacionFactoring[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedOp, setSelectedOp] = useState<OperacionFactoring | null>(null);

  // --- ESTADOS DE FILTROS UNIFICADOS ---
  const [selectedLetter, setSelectedLetter] = useState<string>('TODOS');
  const [searchName, setSearchName] = useState<string>('');
  const [searchRuc, setSearchRuc] = useState<string>('');
  const [filtroEstado, setFiltroEstado] = useState<string>('TODOS');
  const [dateType, setDateType] = useState<'DESEMBOLSADO' | 'CIERRE'>('DESEMBOLSADO');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [showAutocomplete, setShowAutocomplete] = useState<boolean>(false);

  const fetchOperaciones = async () => {
    try {
      setLoading(true);
      const data = await factoringService.getOperaciones();
      setOperaciones(data);
    } catch (err) {
      console.error('Error al cargar repositorio:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOperaciones();
  }, []);

  // ALPHABET FOR ROLODEX
  const ALPHABET = ['TODOS', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', '#'];

  const getLetterCount = (letter: string): number => {
    if (letter === 'TODOS') return operaciones.length;
    return operaciones.filter(op => {
      const eInitial = op.emisor_nombre ? op.emisor_nombre.trim().charAt(0).toUpperCase() : '';
      if (letter === '#') {
        return eInitial && !/[A-Z]/.test(eInitial);
      }
      return eInitial === letter;
    }).length;
  };

  // Lista Dinámica de Sugerencias de Autocompletado
  const nameSuggestions = useMemo(() => {
    if (!searchName.trim()) return [];
    const q = searchName.trim().toLowerCase();
    const set = new Set<string>();
    operaciones.forEach(op => {
      if (op.emisor_nombre && op.emisor_nombre.toLowerCase().includes(q)) {
        set.add(op.emisor_nombre);
      }
      if (op.aceptante_nombre && op.aceptante_nombre.toLowerCase().includes(q)) {
        set.add(op.aceptante_nombre);
      }
    });
    return Array.from(set).slice(0, 8);
  }, [operaciones, searchName]);

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // LÓGICA DE FILTRADO UNIFICADO Y ORDEN ALFABÉTICO AUTOMÁTICO A-Z
  const filteredOps = useMemo(() => {
    return operaciones.filter(op => {
      // 1. Filtro Rolodex A-Z (Inicial del Emisor)
      if (selectedLetter !== 'TODOS') {
        const eInitial = op.emisor_nombre ? op.emisor_nombre.trim().charAt(0).toUpperCase() : '';
        if (selectedLetter === '#') {
          if (!eInitial || /[A-Z]/.test(eInitial)) return false;
        } else if (eInitial !== selectedLetter) {
          return false;
        }
      }

      // 2. Filtro por Nombre (Emisor o Aceptante)
      if (searchName.trim()) {
        const q = searchName.trim().toLowerCase();
        const matchE = (op.emisor_nombre || '').toLowerCase().includes(q);
        const matchA = (op.aceptante_nombre || '').toLowerCase().includes(q);
        if (!matchE && !matchA) return false;
      }

      // 3. Filtro por RUC (Emisor o Aceptante)
      if (searchRuc.trim()) {
        const qRuc = searchRuc.trim();
        const matchRucE = (op.emisor_ruc || '').includes(qRuc);
        const matchRucA = (op.aceptante_ruc || '').includes(qRuc);
        if (!matchRucE && !matchRucA) return false;
      }

      // 4. Filtro por Estado (con En Mora dinámico)
      if (filtroEstado !== 'TODOS') {
        const rawEst = (op.estado || '').toUpperCase();
        const fVenc = op.fecha_vencimiento ? op.fecha_vencimiento.split('T')[0] : '';
        const isMora = Boolean(fVenc && todayStr > fVenc && !rawEst.includes('LIQUIDADA') && !rawEst.includes('LIQUIDADO'));

        if (filtroEstado === 'EN_MORA') {
          if (!isMora) return false;
        } else if (filtroEstado !== rawEst) {
          return false;
        }
      }

      // 5. Filtro por Rango de Fechas
      if (startDate || endDate) {
        const targetDate = dateType === 'DESEMBOLSADO' 
          ? (op.fecha_desembolso ? op.fecha_desembolso.split('T')[0] : '')
          : (op.fecha_vencimiento ? op.fecha_vencimiento.split('T')[0] : '');
        
        if (targetDate) {
          if (startDate && targetDate < startDate) return false;
          if (endDate && targetDate > endDate) return false;
        }
      }

      return true;
    }).sort((a, b) => (a.emisor_nombre || '').localeCompare(b.emisor_nombre || '')); // ORDEN ALFABETICO AUTOMATICO (A-Z)
  }, [operaciones, selectedLetter, searchName, searchRuc, filtroEstado, dateType, startDate, endDate, todayStr]);

  const resetFilters = () => {
    setSelectedLetter('TODOS');
    setSearchName('');
    setSearchRuc('');
    setFiltroEstado('TODOS');
    setDateType('DESEMBOLSADO');
    setStartDate('');
    setEndDate('');
    setShowAutocomplete(false);
  };

  const getBadgeStyle = (estado: string) => {
    switch (estado) {
      case 'ORIGINADO': return 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200';
      case 'APROBADO': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200';
      case 'DESEMBOLSADO': return 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200';
      case 'LIQUIDADO': return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200';
      case 'EN MORA': return 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 border-red-200';
      default: return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-200';
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header Title */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 bg-indigo-100 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 rounded-xl">
            <FolderArchive size={22} />
          </div>
          <div>
            <h2 className="text-base font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider">
              Bóveda Digital & Repositorio de Factoring
            </h2>
            <span className="text-xs text-slate-400 font-medium">
              Consulta integral de operaciones y expedientes de cobranza
            </span>
          </div>
        </div>
      </div>

      {/* --- PANEL ÚNICO UNIFICADO DE FILTROS --- */}
      <div className="glass-card p-5 space-y-5">
        <div className="flex items-center justify-between border-b border-[#e2e8f0] dark:border-[#334155] pb-3">
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-[#0284c7] dark:text-[#38bdf8]" />
            <h3 className="text-xs font-black text-[#0f172a] dark:text-[#f8fafc] uppercase tracking-wider">
              Panel Único de Filtros del Repositorio
            </h3>
          </div>
          <span className="text-[10px] font-black text-[#0284c7] dark:text-[#38bdf8] bg-[#f0f9ff] dark:bg-[#0284c7]/15 px-2.5 py-1 rounded-md border border-[#bae6fd] dark:border-[#0284c7]/30 uppercase tracking-wider">
            🔤 Orden Alfabético Automático (A-Z)
          </span>
        </div>

        {/* 1. SECCIÓN ROLODEX DE INICIALES A-Z */}
        <div className="space-y-2">
          <span className="text-[11px] font-bold text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wider block">
            Inicial Empresa Emisora (Rolodex)
          </span>
          <div className="flex flex-wrap gap-2 items-center">
            {ALPHABET.map((char) => {
              const count = getLetterCount(char);
              const isSelected = selectedLetter === char;
              const hasData = count > 0;

              return (
                <button
                  key={char}
                  onClick={() => setSelectedLetter(char)}
                  className={`relative px-3 py-1.5 rounded-xl font-black text-xs transition-all flex items-center justify-center cursor-pointer ${
                    isSelected 
                      ? 'bg-[#0284c7] text-white shadow-md shadow-[#0284c7]/30 scale-105 ring-2 ring-[#38bdf8]' 
                      : hasData
                        ? 'bg-[#f0f9ff] text-[#0284c7] border border-[#bae6fd] dark:bg-[#0284c7]/15 dark:text-[#38bdf8] dark:border-[#0284c7]/40 font-bold hover:bg-[#e0f2fe]'
                        : 'bg-slate-100/70 text-slate-400 dark:bg-slate-800/30 dark:text-slate-600 hover:bg-slate-200/70 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <span>{char}</span>
                  {count > 0 && (
                    <span className={`absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full text-[9px] font-black flex items-center justify-center border border-white dark:border-slate-900 ${
                      isSelected ? 'bg-[#059669] text-white' : 'bg-[#0284c7] text-white'
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. CONTROLES SIMULTÁNEOS DE BÚSQUEDA MULTIDIMENSIONAL */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs pt-1">
          {/* Autocompletar por Nombre de Empresa */}
          <div className="relative">
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1.5">
              Empresa (Emisor / Pagador)
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchName}
                onChange={e => {
                  setSearchName(e.target.value);
                  setShowAutocomplete(true);
                }}
                onFocus={() => setShowAutocomplete(true)}
                placeholder="Escribe para autocompletar..."
                className="w-full pl-8 pr-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500"
              />
              <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
            </div>

            {/* Dropdown de Sugerencias de Autocompletado */}
            {showAutocomplete && nameSuggestions.length > 0 && (
              <div className="absolute z-50 left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl overflow-hidden text-xs">
                <div className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800/60 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
                  <span>Sugerencias Coincidentes</span>
                  <Sparkles size={12} className="text-amber-500" />
                </div>
                {nameSuggestions.map((name, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setSearchName(name);
                      setShowAutocomplete(false);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 hover:text-indigo-600 dark:hover:text-indigo-400 font-semibold transition-colors cursor-pointer border-b border-slate-50 dark:border-slate-800/40 last:border-none"
                  >
                    {name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Filtro por RUC */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1.5">
              RUC Emisor / Pagador
            </label>
            <input
              type="text"
              value={searchRuc}
              onChange={e => setSearchRuc(e.target.value)}
              placeholder="Ej. 20609885026"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono font-medium text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Filtro por Estado Financiero */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1.5">
              Estado Financiero
            </label>
            <select
              value={filtroEstado}
              onChange={e => setFiltroEstado(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="TODOS">Todos los Estados</option>
              <option value="ORIGINADO">Originada</option>
              <option value="APROBADO">Aprobada</option>
              <option value="DESEMBOLSADO">Desembolsada</option>
              <option value="LIQUIDADO">Liquidada</option>
              <option value="EN_MORA">🔴 En Mora (Hoy &gt; Vencimiento)</option>
            </select>
          </div>

          {/* Rango de Fechas Combinado */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1">
                <Calendar size={12} className="text-indigo-500" />
                <span>Rango de Fechas</span>
              </label>
              <div className="flex items-center gap-2 text-[10px] font-bold">
                <label className="cursor-pointer flex items-center gap-1 text-slate-600 dark:text-slate-300">
                  <input
                    type="radio"
                    name="dateTypeRepo"
                    checked={dateType === 'DESEMBOLSADO'}
                    onChange={() => setDateType('DESEMBOLSADO')}
                    className="text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Desembolso</span>
                </label>
                <label className="cursor-pointer flex items-center gap-1 text-slate-600 dark:text-slate-300">
                  <input
                    type="radio"
                    name="dateTypeRepo"
                    checked={dateType === 'CIERRE'}
                    onChange={() => setDateType('CIERRE')}
                    className="text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Vencimiento</span>
                </label>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-[11px] font-medium text-slate-800 dark:text-white"
              />
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-[11px] font-medium text-slate-800 dark:text-white"
              />
            </div>
          </div>
        </div>

        {/* Footer del Panel: Resumen de Resultados & Botón Limpiar */}
        <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-3 text-xs">
          <span className="font-semibold text-slate-500 dark:text-slate-400">
            Mostrando <strong>{filteredOps.length}</strong> de <strong>{operaciones.length}</strong> operaciones ordenadas de A a la Z por Emisor
          </span>

          <button
            onClick={resetFilters}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw size={14} />
            <span>Limpiar Filtros</span>
          </button>
        </div>
      </div>

      {/* Operations Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center gap-3 text-slate-400">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            <span className="text-xs font-medium">Cargando repositorio histórico...</span>
          </div>
        ) : filteredOps.length === 0 ? (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
            <AlertCircle className="h-8 w-8 text-slate-300" />
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">No se encontraron operaciones registradas en el repositorio para los filtros seleccionados.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Código Operación</th>
                  <th className="py-3.5 px-4">Cedente (Emisor A-Z 🔤)</th>
                  <th className="py-3.5 px-4">Deudor (Aceptante)</th>
                  <th className="py-3.5 px-4 text-right">Monto Bruto Total</th>
                  <th className="py-3.5 px-4 text-right">Abono Neto</th>
                  <th className="py-3.5 px-4 text-center">Estado</th>
                  <th className="py-3.5 px-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                {filteredOps.map((op) => (
                  <tr key={op.id || op.proposal_id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900 dark:text-slate-100">
                      {op.proposal_id}
                    </td>
                    <td className="py-3.5 px-4 max-w-[220px]">
                      <span className="font-semibold text-slate-800 dark:text-slate-200 block truncate" title={op.emisor_nombre}>
                        {op.emisor_nombre}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">RUC: {op.emisor_ruc}</span>
                    </td>
                    <td className="py-3.5 px-4 max-w-[220px]">
                      <span className="font-semibold text-slate-800 dark:text-slate-200 block truncate" title={op.aceptante_nombre}>
                        {op.aceptante_nombre}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">RUC: {op.aceptante_ruc}</span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-medium text-slate-700 dark:text-slate-300">
                      {op.moneda === 'USD' ? '$' : 'S/'} {op.monto_bruto_total.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-emerald-600 dark:text-emerald-400">
                      {op.moneda === 'USD' ? '$' : 'S/'} {op.abono_real_total.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded border text-[10px] font-bold ${getBadgeStyle(op.estado)}`}>
                        {op.estado}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <button 
                        onClick={() => setSelectedOp(op)}
                        className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 rounded-lg font-bold text-[11px] transition-colors cursor-pointer inline-flex items-center gap-1"
                      >
                        <Eye size={14} />
                        <span>Detalles</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Drawer de Detalle de Operación */}
      {selectedOp && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex justify-end z-50 animate-fadeIn">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 h-full p-6 shadow-2xl overflow-y-auto space-y-6">
            <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-4">
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white uppercase tracking-wider">
                Detalle de Operación {selectedOp.proposal_id}
              </h3>
              <button 
                onClick={() => setSelectedOp(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl space-y-2 border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Cedente (Emisor)</span>
                <p className="font-extrabold text-slate-900 dark:text-white text-sm">{selectedOp.emisor_nombre}</p>
                <p className="font-mono text-slate-500">RUC: {selectedOp.emisor_ruc}</p>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl space-y-2 border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Deudor (Aceptante)</span>
                <p className="font-extrabold text-slate-900 dark:text-white text-sm">{selectedOp.aceptante_nombre}</p>
                <p className="font-mono text-slate-500">RUC: {selectedOp.aceptante_ruc}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 border border-slate-200 dark:border-slate-800 rounded-xl">
                  <span className="text-[10px] text-slate-400 block mb-1 font-bold">Monto Bruto</span>
                  <span className="font-extrabold text-slate-800 dark:text-slate-100">
                    {selectedOp.moneda === 'USD' ? '$' : 'S/'} {selectedOp.monto_bruto_total.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="p-3 border border-slate-200 dark:border-slate-800 rounded-xl">
                  <span className="text-[10px] text-slate-400 block mb-1 font-bold">Abono Real</span>
                  <span className="font-extrabold text-emerald-600 dark:text-emerald-400">
                    {selectedOp.moneda === 'USD' ? '$' : 'S/'} {selectedOp.abono_real_total.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
