import React, { useState, useEffect } from 'react';
import { factoringService } from '../../../services/factoringService';
import type { OperacionFactoring } from '../../../services/factoringService';
import { 
  CheckCircle2, 
  XCircle, 
  Search, 
  DollarSign, 
  Clock, 
  AlertCircle,
  Loader2,
  ShieldCheck
} from 'lucide-react';

export const AprobacionesTab: React.FC = () => {
  const [operaciones, setOperaciones] = useState<OperacionFactoring[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedOp, setSelectedOp] = useState<OperacionFactoring | null>(null);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [modalAction, setModalAction] = useState<'aprobar' | 'rechazar'>('aprobar');
  const [observaciones, setObservaciones] = useState<string>('');
  const [processing, setProcessing] = useState<boolean>(false);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [forceApproval, setForceApproval] = useState<boolean>(false);

  const fetchOperaciones = async () => {
    try {
      setLoading(true);
      const data = await factoringService.getOperaciones('ORIGINADO');
      const procesadas = data.map(op => ({
        ...op,
        status_cavali: op.status_cavali || 'ACEPTADA',
        status_letra: op.status_letra || 'FIRMADA'
      }));
      setOperaciones(procesadas);
    } catch (err) {
      console.error('Error al cargar operaciones pendientes:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOperaciones();
  }, []);

  const [selectedLetter, setSelectedLetter] = useState<string>('TODOS');

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

  const filteredOps = operaciones.filter(op => {
    const matchesSearch = 
      op.proposal_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      op.emisor_nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      op.emisor_ruc.includes(searchTerm) ||
      op.aceptante_nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      op.aceptante_ruc.includes(searchTerm);

    if (!matchesSearch) return false;

    if (selectedLetter === 'TODOS') return true;

    const eInitial = op.emisor_nombre ? op.emisor_nombre.trim().charAt(0).toUpperCase() : '';

    if (selectedLetter === '#') {
      return eInitial && !/[A-Z]/.test(eInitial);
    }

    return eInitial === selectedLetter;
  });

  const totalPen = filteredOps
    .filter(op => op.moneda === 'PEN')
    .reduce((sum, op) => sum + op.abono_real_total, 0);

  const totalUsd = filteredOps
    .filter(op => op.moneda === 'USD')
    .reduce((sum, op) => sum + op.abono_real_total, 0);

  const toggleSelect = (proposalId: string) => {
    const next = new Set(selectedIds);
    if (next.has(proposalId)) next.delete(proposalId);
    else next.add(proposalId);
    setSelectedIds(next);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredOps.length && filteredOps.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredOps.map(op => op.proposal_id)));
    }
  };

  const handleAprobarSeleccionadas = async (action: 'aprobar' | 'rechazar') => {
    if (selectedIds.size === 0) return;
    const selectedOps = operaciones.filter(op => selectedIds.has(op.proposal_id));

    if (action === 'aprobar' && !forceApproval) {
      const issues = selectedOps.filter(op => (op.status_cavali || 'ACEPTADA') !== 'ACEPTADA' || (op.status_letra || 'FIRMADA') !== 'FIRMADA');
      if (issues.length > 0) {
        alert("No se puede aprobar. Existen operaciones sin Cavali 'ACEPTADA' o sin Letra 'FIRMADA'. Marca la casilla de 'Aprobación forzada' si deseas autorizar de todas formas.");
        return;
      }
    }

    setProcessing(true);
    try {
      for (const op of selectedOps) {
        if (action === 'aprobar') {
          await factoringService.cambiarEstadoOperacion(op.id || '', 'APROBADO', {
            observaciones_aprobacion: 'Aprobación masiva desde panel',
            fecha_aprobacion: new Date().toISOString()
          });
        } else {
          await factoringService.cambiarEstadoOperacion(op.id || '', 'ORIGINADO', {
            observaciones_rechazo: 'Rechazo masivo desde panel',
            estado_detalle: 'RECHAZADO_COMITE'
          });
        }
      }
      setSelectedIds(new Set());
      await fetchOperaciones();
    } catch (err: any) {
      alert(`Error al procesar la acción: ${err.message}`);
    } finally {
      setProcessing(false);
    }
  };

  const handleActionClick = (op: OperacionFactoring, action: 'aprobar' | 'rechazar') => {
    setSelectedOp(op);
    setModalAction(action);
    setObservaciones('');
    setShowModal(true);
  };

  const handleConfirmAction = async () => {
    if (!selectedOp) return;
    try {
      setProcessing(true);
      if (modalAction === 'aprobar') {
        await factoringService.cambiarEstadoOperacion(selectedOp.id || '', 'APROBADO', {
          observaciones_aprobacion: observaciones,
          fecha_aprobacion: new Date().toISOString()
        });
      } else {
        await factoringService.cambiarEstadoOperacion(selectedOp.id || '', 'ORIGINADO', {
          observaciones_rechazo: observaciones,
          estado_detalle: 'RECHAZADO_COMITE'
        });
      }
      setShowModal(false);
      setSelectedOp(null);
      await fetchOperaciones();
    } catch (err: any) {
      alert(`Error al procesar la acción: ${err.message}`);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Header & Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">Pendientes de Evaluación</span>
            <span className="text-2xl font-black text-slate-900 dark:text-white">{filteredOps.length}</span>
            <span className="text-[11px] text-amber-600 dark:text-amber-400 block mt-1 font-medium">Bandeja de Comité de Riesgos</span>
          </div>
          <div className="h-12 w-12 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 flex items-center justify-center text-amber-600">
            <Clock size={24} />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">Total Abono Pendiente (PEN)</span>
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
              S/ {totalPen.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-[11px] text-slate-400 block mt-1">Monto Líquido a Desembolsar</span>
          </div>
          <div className="h-12 w-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 flex items-center justify-center text-emerald-600">
            <DollarSign size={24} />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">Total Abono Pendiente (USD)</span>
            <span className="text-2xl font-black text-blue-600 dark:text-blue-400">
              $ {totalUsd.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>

      {/* Alphabetical Filter Bar (Burbujas Azules con Contador en Esquina Superior Derecha) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
        <div className="flex flex-wrap gap-2.5 items-center">
          {ALPHABET.map((char) => {
            const count = getLetterCount(char);
            const isSelected = selectedLetter === char;
            const hasData = count > 0;

            return (
              <button
                key={char}
                onClick={() => setSelectedLetter(char)}
                className={`relative ${char === 'TODOS' ? 'px-4' : 'w-10'} h-10 rounded-xl font-black text-sm transition-all flex items-center justify-center ${
                  isSelected
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200 dark:shadow-indigo-900/30 scale-105 ring-2 ring-indigo-400'
                    : hasData
                      ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800 font-bold hover:bg-indigo-100'
                      : 'bg-slate-100/70 text-slate-400 dark:bg-slate-800/30 dark:text-slate-600 hover:bg-slate-200/70 dark:hover:bg-slate-800/60'
                }`}
              >
                <span>{char}</span>
                {hasData && (
                  <span
                    className={`absolute -top-1.5 -right-1.5 text-[9px] min-w-[20px] h-5 px-1.5 flex items-center justify-center rounded-full font-black border-2 border-white dark:border-slate-900 shadow-xs ${
                      isSelected ? 'bg-emerald-500 text-white' : 'bg-indigo-600 text-white'
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs overflow-hidden">
        {/* Table Header Controls */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-amber-600" />
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider">
                Bandeja de Aprobación de Factoring
              </h3>
            </div>

            {/* Acciones de Selección en Lote al lado del Título */}
            <div className="flex items-center gap-2 pl-3 border-l border-slate-200 dark:border-slate-700">
              <button
                onClick={() => handleAprobarSeleccionadas('aprobar')}
                disabled={selectedIds.size === 0 || processing}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 text-white disabled:text-slate-400 font-bold text-xs rounded-xl transition-all cursor-pointer disabled:cursor-not-allowed shadow-xs"
              >
                {processing ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                <span>Aprobar Selección ({selectedIds.size})</span>
              </button>

              <button
                onClick={() => handleAprobarSeleccionadas('rechazar')}
                disabled={selectedIds.size === 0 || processing}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 disabled:opacity-40 font-bold text-xs rounded-xl border border-rose-200 dark:border-rose-900/50 transition-all cursor-pointer disabled:cursor-not-allowed"
              >
                <XCircle size={13} />
                <span>Rechazar ({selectedIds.size})</span>
              </button>

              <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 font-semibold cursor-pointer select-none">
                <input 
                  type="checkbox" 
                  checked={forceApproval}
                  onChange={(e) => setForceApproval(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <span>Aprobación Forzada</span>
              </label>
            </div>
          </div>
          
          <div className="relative w-full lg:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input 
              type="text"
              placeholder="Buscar RUC, Empresa..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 text-slate-800 dark:text-slate-200"
            />
          </div>
        </div>

        {/* Content State */}
        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center gap-3 text-slate-400">
            <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
            <span className="text-xs font-medium">Cargando operaciones en originación...</span>
          </div>
        ) : filteredOps.length === 0 ? (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
            <AlertCircle className="h-8 w-8 text-slate-300" />
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">No hay operaciones pendientes de aprobación en este momento.</p>
            <span className="text-xs text-slate-400">Las propuestas originadas aparecerán automáticamente en esta lista.</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-3 w-10 text-center">
                    <input 
                      type="checkbox" 
                      checked={filteredOps.length > 0 && selectedIds.size === filteredOps.length} 
                      onChange={toggleSelectAll} 
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" 
                      title="Marcar / Desmarcar Todas"
                    />
                  </th>
                  <th className="py-3 px-4">Cedente (Emisor)</th>
                  <th className="py-3 px-4">Pagador (Aceptante)</th>
                  <th className="py-3 px-4 text-right">Monto Neto</th>
                  <th className="py-3 px-4 text-right">Interés Ganado</th>
                  <th className="py-3 px-4 text-right">Abono Neto Cedente</th>
                  <th className="py-3 px-3 text-center">Est. Cavali</th>
                  <th className="py-3 px-3 text-center">Est. Letra</th>
                  <th className="py-3 px-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                {filteredOps.map((op) => (
                  <tr key={op.id || op.proposal_id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-3 text-center">
                      <input 
                        type="checkbox" 
                        checked={selectedIds.has(op.proposal_id)} 
                        onChange={() => toggleSelect(op.proposal_id)} 
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" 
                      />
                    </td>
                    <td className="py-3 px-4 max-w-[220px]">
                      <span className="font-semibold text-slate-800 dark:text-slate-200 block truncate" title={op.emisor_nombre}>
                        {op.emisor_nombre}
                      </span>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                        <span>RUC: {op.emisor_ruc}</span>
                        <span>•</span>
                        <span className="font-bold text-slate-500 dark:text-slate-400">{op.proposal_id}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 max-w-[200px]">
                      <span className="font-semibold text-slate-800 dark:text-slate-200 block truncate" title={op.aceptante_nombre}>
                        {op.aceptante_nombre}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">RUC: {op.aceptante_ruc}</span>
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-slate-700 dark:text-slate-300">
                      {op.moneda === 'USD' ? '$' : 'S/'} {op.monto_neto_total.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-amber-600 dark:text-amber-400">
                      {op.moneda === 'USD' ? '$' : 'S/'} {op.interes_total.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-emerald-600 dark:text-emerald-400">
                      {op.moneda === 'USD' ? '$' : 'S/'} {op.abono_real_total.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md border ${
                        (op.status_cavali || 'ACEPTADA') === 'ACEPTADA'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                          : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800'
                      }`}>
                        {op.status_cavali || 'ACEPTADA'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md border ${
                        (op.status_letra || 'FIRMADA') === 'FIRMADA'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                          : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800'
                      }`}>
                        {op.status_letra || 'FIRMADA'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-1.5">
                        <button 
                          onClick={() => handleActionClick(op, 'aprobar')}
                          title="Aprobar Operación"
                          className="px-2.5 py-1 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded shadow-xs flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <CheckCircle2 size={14} />
                          Aprobar
                        </button>

                        <button 
                          onClick={() => handleActionClick(op, 'rechazar')}
                          title="Rechazar Operación"
                          className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50 rounded transition-colors cursor-pointer"
                        >
                          <XCircle size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {showModal && selectedOp && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-xl animate-fadeIn">
            <div className="flex items-center gap-3 mb-4">
              <div className={`h-10 w-10 rounded-full flex items-center justify-center ${modalAction === 'aprobar' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                {modalAction === 'aprobar' ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {modalAction === 'aprobar' ? 'Aprobar Operación' : 'Rechazar Operación'}
                </h3>
                <p className="text-xs text-slate-500">Operación: <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{selectedOp.proposal_id}</span></p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2 mb-4 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Cedente:</span>
                <span className="font-medium text-slate-800 dark:text-slate-200 truncate max-w-[200px]">{selectedOp.emisor_nombre}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Abono Neto:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  {selectedOp.moneda === 'USD' ? '$' : 'S/'} {selectedOp.abono_real_total.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div className="space-y-1.5 mb-6">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {modalAction === 'aprobar' ? 'Observaciones de Aprobación (Opcional)' : 'Motivo del Rechazo (Obligatorio)'}
              </label>
              <textarea
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                placeholder={modalAction === 'aprobar' ? 'Escriba anotaciones para Tesorería...' : 'Detalle la razón de rechazo...'}
                className="w-full p-2.5 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-slate-800 dark:text-slate-200 h-20 resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setShowModal(false)}
                disabled={processing}
                className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmAction}
                disabled={processing || (modalAction === 'rechazar' && !observaciones.trim())}
                className={`px-4 py-2 text-xs font-semibold text-white rounded-lg shadow-xs flex items-center gap-2 transition-colors ${
                  modalAction === 'aprobar' 
                    ? 'bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50' 
                    : 'bg-red-600 hover:bg-red-700 disabled:opacity-50'
                }`}
              >
                {processing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {modalAction === 'aprobar' ? 'Confirmar Aprobación' : 'Confirmar Rechazo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
