import React, { useState, useEffect, useMemo } from 'react';
import { getApiBaseUrl } from '../../../config/apiConfig';
import { DriveTreeView } from './DriveTreeView';
import { LiquidacionReporteModal } from './LiquidacionReporteModal';
import { 
  Building2, 
  ChevronDown, 
  ChevronUp,
  FolderOpen, 
  CheckCircle2, 
  AlertCircle,
  Send,
  Loader2,
  FileSearch,
  Clock,
  Upload
} from 'lucide-react';

interface FacturaLiquidacion {
  proposal_id: string;
  emisor_nombre: string;
  emisor_ruc: string;
  aceptante_nombre: string;
  moneda_factura: string;
  monto_neto_factura: number;
  identificador_lote: string;
  group_id: string;
  estado: string;
}

const API_BASE = getApiBaseUrl();

export const LiquidacionesTab: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'NUEVAS' | 'EN_PROCESO'>('NUEVAS');
  const [nuevas, setNuevas] = useState<FacturaLiquidacion[]>([]);
  const [enProceso, setEnProceso] = useState<FacturaLiquidacion[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedLetter, setSelectedLetter] = useState<string>('TODOS');

  // Accordion collapsed state
  const [expandedCompanies, setExpandedCompanies] = useState<Set<string>>(new Set());
  const [expandedLotes, setExpandedLotes] = useState<Set<string>>(new Set());

  // Selection and Input states
  const [selectedInvoices, setSelectedInvoices] = useState<Record<string, boolean>>({});
  const [fechasPago, setFechasPago] = useState<Record<string, string>>({});
  const [montosPago, setMontosPago] = useState<Record<string, number>>({});
  
  // Formalization and Sustentos
  const [fechaCobranzaGlobal, setFechaCobranzaGlobal] = useState<string>(new Date().toISOString().split('T')[0]);
  const [sustentoUnico, setSustentoUnico] = useState<boolean>(false);
  const [consolidatedFile, setConsolidatedFile] = useState<File | null>(null);
  const [sustentosIndividuales, setSustentosIndividuales] = useState<Record<string, File | null>>({});

  // Drive Folder
  const [selectedFolder, setSelectedFolder] = useState<{ id: string; name: string } | null>(null);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [modalProposalId, setModalProposalId] = useState<string | null>(null);
  const [modalFechaPago, setModalFechaPago] = useState<string | null>(null);
  const [modalMontoPago, setModalMontoPago] = useState<number | null>(null);

  // Processing state
  const [processing, setProcessing] = useState(false);
  const [processResult, setProcessResult] = useState<{ exito: number, errores: string[] } | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/liquidaciones/pendientes`);
      if (!res.ok) throw new Error('Error al cargar liquidaciones pendientes');
      const data = await res.json();
      setNuevas(data.nuevas || []);
      setEnProceso(data.en_proceso || []);

      const initialFechas: Record<string, string> = {};
      const initialMontos: Record<string, number> = {};
      
      const today = new Date().toISOString().split('T')[0];
      [...(data.nuevas || []), ...(data.en_proceso || [])].forEach((f: any) => {
        initialFechas[f.proposal_id] = today;
        initialMontos[f.proposal_id] = f.monto_neto_factura;
      });
      
      setFechasPago(initialFechas);
      setMontosPago(initialMontos);

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const currentDataList = activeTab === 'NUEVAS' ? nuevas : enProceso;

  // Total Metrics Calculations
  const totalPen = useMemo(() => {
    return currentDataList
      .filter(inv => (inv.moneda_factura || 'PEN') === 'PEN')
      .reduce((sum, inv) => sum + (inv.monto_neto_factura || 0), 0);
  }, [currentDataList]);

  const totalUsd = useMemo(() => {
    return currentDataList
      .filter(inv => inv.moneda_factura === 'USD')
      .reduce((sum, inv) => sum + (inv.monto_neto_factura || 0), 0);
  }, [currentDataList]);

  // Alphabet calculations
  const ALPHABET = ['TODOS', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', '#'];

  const getLetterCount = (letter: string): number => {
    if (letter === 'TODOS') return currentDataList.length;
    return currentDataList.filter(inv => {
      const eInitial = inv.emisor_nombre ? inv.emisor_nombre.trim().charAt(0).toUpperCase() : '';
      if (letter === '#') {
        return eInitial && !/[A-Z]/.test(eInitial);
      }
      return eInitial === letter;
    }).length;
  };

  const filteredOps = currentDataList.filter(inv => {
    if (selectedLetter === 'TODOS') return true;
    const eInitial = inv.emisor_nombre ? inv.emisor_nombre.trim().charAt(0).toUpperCase() : '';
    if (selectedLetter === '#') {
      return eInitial && !/[A-Z]/.test(eInitial);
    }
    return eInitial === selectedLetter;
  });

  // Grouping: Emisor -> Lote -> Facturas
  const companiesMap = useMemo(() => {
    const map: Record<string, Record<string, FacturaLiquidacion[]>> = {};
    
    filteredOps.forEach(inv => {
      let emisor = (inv.emisor_nombre || "Desconocido").trim();
      let lote = inv.identificador_lote || 'LOTE-GENERAL';

      if (!map[emisor]) map[emisor] = {};
      if (!map[emisor][lote]) map[emisor][lote] = [];

      map[emisor][lote].push(inv);
    });

    return map;
  }, [filteredOps]);

  // Reset accordion state to collapsed when dataset or letter changes
  useEffect(() => {
    setExpandedCompanies(new Set());
    setExpandedLotes(new Set());
  }, [currentDataList, selectedLetter]);

  const toggleExpanded = (set: Set<string>, key: string, setter: React.Dispatch<React.SetStateAction<Set<string>>>) => {
    const newSet = new Set(set);
    if (newSet.has(key)) newSet.delete(key);
    else newSet.add(key);
    setter(newSet);
  };

  const toggleSelect = (proposalId: string) => {
    setSelectedInvoices(prev => ({
      ...prev,
      [proposalId]: !prev[proposalId]
    }));
  };

  const handleVerReporte = (proposalId: string) => {
    setModalProposalId(proposalId);
    setModalFechaPago(fechasPago[proposalId] || fechaCobranzaGlobal);
    setModalMontoPago(montosPago[proposalId] || 0);
    setModalOpen(true);
  };

  const pidsSeleccionados = Object.keys(selectedInvoices).filter(k => selectedInvoices[k]);
  const selectedInvoicesList = useMemo(() => {
    return currentDataList.filter(inv => selectedInvoices[inv.proposal_id]);
  }, [currentDataList, selectedInvoices]);

  const handleProcess = async () => {
    if (pidsSeleccionados.length === 0) {
      alert("Seleccione al menos una factura para registrar liquidación.");
      return;
    }

    if (!selectedFolder) {
      alert("Debe seleccionar una carpeta de Google Drive para guardar los sustentos.");
      return;
    }

    setProcessing(true);
    setProcessResult(null);

    try {
      const formData = new FormData();
      formData.append('proposal_ids', JSON.stringify(pidsSeleccionados));
      formData.append('fechas_pago', JSON.stringify(fechasPago));
      formData.append('montos_pago', JSON.stringify(montosPago));
      formData.append('folder_id', selectedFolder.id);

      // Append files
      pidsSeleccionados.forEach(pid => {
        if (sustentoUnico && consolidatedFile) {
          formData.append('sustentos', consolidatedFile, `Sustento_Cobranza_GLOBAL_${pid}.pdf`);
        } else if (sustentosIndividuales[pid]) {
          formData.append('sustentos', sustentosIndividuales[pid]!, `Sustento_Cobranza_${pid}.pdf`);
        }
      });

      const res = await fetch(`${API_BASE}/api/liquidaciones/procesar`, {
        method: 'POST',
        body: formData
      });

      if (!res.ok) {
        throw new Error('Error al procesar liquidación');
      }

      const data = await res.json();
      setProcessResult({ exito: data.procesadas, errores: data.errores });
      
      if (data.errores.length === 0) {
        setTimeout(() => {
          fetchData();
          setSelectedInvoices({});
          setProcessResult(null);
        }, 3000);
      }

    } catch (err: any) {
      setProcessResult({ exito: 0, errores: [err.message] });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Header & Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">Facturas Pendientes</span>
            <span className="text-2xl font-black text-slate-800 dark:text-slate-100">
              {currentDataList.length}
            </span>
            <span className="text-[11px] text-slate-400 block mt-1">
              {activeTab === 'NUEVAS' ? 'Pendientes de primer pago' : 'Con pagos parciales en proceso'}
            </span>
          </div>
          <div className="h-12 w-12 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 flex items-center justify-center text-amber-600">
            <Clock size={24} />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">
              {activeTab === 'NUEVAS' ? 'Total Abono Pendiente (PEN)' : 'Total Saldo Pendiente (PEN)'}
            </span>
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
              S/ {totalPen.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-[11px] text-slate-400 block mt-1">Monto Líquido a Liquidar</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">
              {activeTab === 'NUEVAS' ? 'Total Abono Pendiente (USD)' : 'Total Saldo Pendiente (USD)'}
            </span>
            <span className="text-2xl font-black text-blue-600 dark:text-blue-400">
              $ {totalUsd.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-[11px] text-slate-400 block mt-1">Monto Líquido a Liquidar</span>
          </div>
        </div>
      </div>

      {/* Tabs Selector: Nuevas vs En Proceso */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-4">
        <button
          onClick={() => { setActiveTab('NUEVAS'); setSelectedInvoices({}); }}
          className={`pb-3 text-sm font-bold transition-colors border-b-2 cursor-pointer ${
            activeTab === 'NUEVAS'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          Liquidaciones Nuevas ({nuevas.length})
        </button>

        <button
          onClick={() => { setActiveTab('EN_PROCESO'); setSelectedInvoices({}); }}
          className={`pb-3 text-sm font-bold transition-colors border-b-2 cursor-pointer ${
            activeTab === 'EN_PROCESO'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          Liquidaciones en Proceso ({enProceso.length})
        </button>
      </div>

      {/* Alphabetical Filter Bar (Rolodex Oficial A-Z) */}
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
                className={`relative px-3.5 py-1.5 rounded-xl font-black text-xs transition-all flex items-center justify-center cursor-pointer ${
                  isSelected 
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200 dark:shadow-none scale-105' 
                    : hasData
                      ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 hover:text-indigo-600'
                      : 'bg-slate-50 dark:bg-slate-900 text-slate-300 dark:text-slate-700'
                }`}
              >
                <span>{char}</span>
                {count > 0 && (
                  <span className={`absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full text-[9px] font-black flex items-center justify-center border border-white dark:border-slate-900 ${
                    isSelected ? 'bg-amber-400 text-slate-900' : 'bg-indigo-500 text-white'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Container */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs p-5 space-y-6">
        <h2 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider">
          {activeTab === 'NUEVAS' ? 'Facturas Desembolsadas Pendientes de Cobro' : 'Facturas en Proceso de Amortización'}
        </h2>

        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center gap-3 text-slate-400">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            <span className="text-xs font-medium">Cargando liquidaciones...</span>
          </div>
        ) : error ? (
          <div className="p-4 bg-red-50 text-red-700 rounded-xl text-xs">{error}</div>
        ) : Object.keys(companiesMap).length === 0 ? (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
            <AlertCircle className="h-8 w-8 text-slate-300" />
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">No hay facturas pendientes de liquidación para el filtro seleccionado.</p>
          </div>
        ) : (
          /* Estructura Acordeón Jerárquico: Empresa -> Lote -> Facturas */
          <div className="space-y-4">
            {Object.entries(companiesMap).map(([emisor, lotes]) => {
              const isCompExpanded = expandedCompanies.has(emisor);
              const totalOpsComp = Object.values(lotes).flat().length;

              return (
                <div key={emisor} className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
                  {/* Empresa Header Button */}
                  <button 
                    onClick={() => toggleExpanded(expandedCompanies, emisor, setExpandedCompanies)}
                    className="w-full bg-slate-50/80 dark:bg-slate-800/60 px-5 py-4 flex justify-between items-center hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border-b border-slate-200/60 dark:border-slate-700/60 cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-indigo-100 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 rounded-xl">
                        <Building2 size={20} />
                      </div>
                      <div className="text-left">
                        <h3 className="font-extrabold text-slate-900 dark:text-white text-base tracking-tight">{emisor}</h3>
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                          {totalOpsComp} {totalOpsComp === 1 ? 'factura en liquidación' : 'facturas en liquidación'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {isCompExpanded ? <ChevronUp size={20} className="text-slate-400" /> : <ChevronDown size={20} className="text-slate-400" />}
                    </div>
                  </button>

                  {/* Sub-bloques de Lotes */}
                  {isCompExpanded && (
                    <div className="p-4 space-y-4 bg-white dark:bg-slate-900">
                      {Object.entries(lotes).map(([loteId, groupOps]) => {
                        const loteKey = `${emisor}__${loteId}`;
                        const isLoteExpanded = expandedLotes.has(loteKey);
                        const allGroupSelected = groupOps.every(op => selectedInvoices[op.proposal_id]);

                        return (
                          <div key={loteId} className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
                            {/* Lote Header Button */}
                            <div className="bg-slate-100/70 dark:bg-slate-800/40 px-4 py-3 flex justify-between items-center border-b border-slate-200 dark:border-slate-700">
                              <button
                                onClick={() => toggleExpanded(expandedLotes, loteKey, setExpandedLotes)}
                                className="flex items-center gap-2 flex-1 text-left cursor-pointer"
                              >
                                <FolderOpen className="text-emerald-600 dark:text-emerald-400" size={18} />
                                <span className="font-bold text-xs text-slate-800 dark:text-slate-200 uppercase tracking-wider">{loteId}</span>
                                <span className="text-xs text-slate-400 font-normal">({groupOps.length} operaciones)</span>
                                {isLoteExpanded ? <ChevronUp size={16} className="text-slate-400 ml-1" /> : <ChevronDown size={16} className="text-slate-400 ml-1" />}
                              </button>

                              <label className="flex items-center gap-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 cursor-pointer hover:underline select-none">
                                <input 
                                  type="checkbox"
                                  checked={allGroupSelected}
                                  onChange={() => {
                                    const groupIds = groupOps.map(op => op.proposal_id);
                                    setSelectedInvoices(prev => {
                                      const next = { ...prev };
                                      groupIds.forEach(id => next[id] = !allGroupSelected);
                                      return next;
                                    });
                                  }}
                                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                />
                                <span>Seleccionar Lote</span>
                              </label>
                            </div>

                            {/* Tabla de Facturas dentro del Lote */}
                            {isLoteExpanded && (
                              <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse text-xs">
                                  <thead>
                                    <tr className="bg-slate-50/50 dark:bg-slate-800/20 border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                      <th className="py-2.5 px-3 w-10 text-center">Sel</th>
                                      <th className="py-2.5 px-4">Factura / Propuesta</th>
                                      <th className="py-2.5 px-4">Pagador (Aceptante)</th>
                                      <th className="py-2.5 px-4 text-right">Monto Neto</th>
                                      <th className="py-2.5 px-4">Fecha Cobro</th>
                                      <th className="py-2.5 px-4">Monto Cobrado</th>
                                      <th className="py-2.5 px-4 text-center">Simulación PDF</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {groupOps.map((inv) => (
                                      <tr key={inv.proposal_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                                        <td className="py-3 px-3 text-center">
                                          <input 
                                            type="checkbox" 
                                            checked={!!selectedInvoices[inv.proposal_id]} 
                                            onChange={() => toggleSelect(inv.proposal_id)} 
                                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" 
                                          />
                                        </td>
                                        <td className="py-3 px-4 font-mono font-bold text-slate-800 dark:text-slate-200">
                                          {inv.proposal_id}
                                        </td>
                                        <td className="py-3 px-4 max-w-[200px]">
                                          <span className="font-semibold text-slate-800 dark:text-slate-200 block truncate" title={inv.aceptante_nombre}>
                                            {inv.aceptante_nombre}
                                          </span>
                                        </td>
                                        <td className="py-3 px-4 text-right font-medium text-slate-700 dark:text-slate-300">
                                          {inv.moneda_factura === 'USD' ? '$' : 'S/'} {inv.monto_neto_factura.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="py-3 px-4">
                                          <input 
                                            type="date"
                                            value={fechasPago[inv.proposal_id] || fechaCobranzaGlobal}
                                            onChange={(e) => setFechasPago(prev => ({ ...prev, [inv.proposal_id]: e.target.value }))}
                                            className="px-2 py-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
                                          />
                                        </td>
                                        <td className="py-3 px-4">
                                          <input 
                                            type="number"
                                            value={montosPago[inv.proposal_id] ?? inv.monto_neto_factura}
                                            onChange={(e) => setMontosPago(prev => ({ ...prev, [inv.proposal_id]: parseFloat(e.target.value) || 0 }))}
                                            className="w-28 px-2 py-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold text-right"
                                          />
                                        </td>
                                        <td className="py-3 px-4 text-center">
                                          <button
                                            onClick={() => handleVerReporte(inv.proposal_id)}
                                            title="Ver Previsualización y Simulación de Auditoría"
                                            className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 rounded-lg font-bold text-[11px] transition-colors cursor-pointer inline-flex items-center gap-1"
                                          >
                                            <FileSearch size={14} />
                                            <span>Simular PDF</span>
                                          </button>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* SECCIÓN 3: FORMALIZACIÓN Y SUSTENTOS DE COBRANZA */}
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xs border border-slate-200 dark:border-slate-800 p-6 space-y-4">
          <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider">
            3. Formalización y Sustentos de Cobranza
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                Fecha de Cobranza Global
              </label>
              <input 
                type="date" 
                value={fechaCobranzaGlobal}
                onChange={e => {
                  setFechaCobranzaGlobal(e.target.value);
                  const updated: Record<string, string> = {};
                  pidsSeleccionados.forEach(id => updated[id] = e.target.value);
                  setFechasPago(prev => ({ ...prev, ...updated }));
                }}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-950 text-slate-800 dark:text-white text-xs"
              />
            </div>
            <div className="flex flex-col justify-center">
              <label className="flex items-center gap-2 cursor-pointer mt-4">
                <input 
                  type="checkbox"
                  checked={sustentoUnico}
                  onChange={e => setSustentoUnico(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <span className="font-bold text-xs text-slate-700 dark:text-slate-300">
                  Sustento de Cobranza Único (Consolidado)
                </span>
              </label>
            </div>
          </div>

          {sustentoUnico ? (
            <div className="border-2 border-dashed border-slate-200 dark:border-slate-800 p-6 rounded-xl text-center bg-slate-50/50 dark:bg-slate-950">
              <Upload className="mx-auto text-indigo-500 mb-2" size={24} />
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">Subir Comprobante Único de Cobranza</p>
              <input 
                type="file" 
                accept=".pdf, .png, .jpg, .jpeg"
                className="text-xs text-slate-500 mx-auto"
                onChange={e => setConsolidatedFile(e.target.files?.[0] || null)}
              />
            </div>
          ) : (
            <div className="space-y-3">
              {selectedInvoicesList.map(inv => (
                <div key={inv.proposal_id} className="flex items-center gap-4 border border-slate-200 dark:border-slate-800 p-3 rounded-xl bg-slate-50/50 dark:bg-slate-950 text-xs">
                  <div className="flex-1 font-mono font-bold text-slate-800 dark:text-slate-200">
                    {inv.proposal_id}
                  </div>
                  <div className="w-1/4 font-bold text-emerald-600 dark:text-emerald-400">
                    {inv.moneda_factura === 'USD' ? '$' : 'S/'} {(montosPago[inv.proposal_id] ?? inv.monto_neto_factura).toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                  </div>
                  <div className="flex-1 flex justify-end">
                    <label className="cursor-pointer flex items-center justify-center gap-2 w-full border border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-500 rounded-xl p-2 bg-white dark:bg-slate-900 transition-colors">
                      <Upload size={14} className="text-indigo-500" />
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 truncate">
                        {sustentosIndividuales[inv.proposal_id] 
                          ? sustentosIndividuales[inv.proposal_id]!.name 
                          : 'Subir Comprobante Individual'}
                      </span>
                      <input 
                        type="file"
                        accept=".pdf, .png, .jpg, .jpeg"
                        className="hidden"
                        onChange={e => {
                          const f = e.target.files?.[0];
                          if (f) setSustentosIndividuales(prev => ({...prev, [inv.proposal_id]: f}));
                        }}
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* SECCIÓN 4: DRIVE Y REGISTRO */}
        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-4 shadow-xs">
          <span className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
            <FolderOpen size={16} className="text-blue-600" />
            📁 4. Selección de Carpeta Destino en Google Drive y Registro
          </span>

          {/* Árbol en Ancho Completo */}
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block">
              Navegador del Repositorio InAndes
            </label>
            <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl h-72 overflow-y-auto shadow-inner w-full">
              <DriveTreeView 
                rootFolderId="1Jv1r9kixL982gL-RCyPnhOY3W-qI0CLq"
                rootFolderName="Repositorio InAndes"
                selectedFolderId={selectedFolder?.id || ''}
                onSelectFolder={f => setSelectedFolder(f)}
                apiBaseUrl={API_BASE}
              />
            </div>
          </div>

          {/* Ficha de Carpeta Seleccionada */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs pt-1">
            <div>
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                ID / Carpeta Seleccionada (Auto-detectado)
              </label>
              <input
                type="text"
                readOnly
                placeholder="Selecciona una carpeta arriba..."
                value={selectedFolder ? `${selectedFolder.name} (${selectedFolder.id})` : ''}
                className="w-full p-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-xs text-slate-700 dark:text-slate-200 font-bold"
              />
            </div>
            <div className="flex items-end">
              {selectedFolder ? (
                <div className="w-full p-2.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 rounded-xl text-xs font-semibold border border-emerald-200 dark:border-emerald-800 flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                  <span>Destino configurado: <strong>{selectedFolder.name}</strong></span>
                </div>
              ) : (
                <div className="w-full p-2.5 bg-slate-100 dark:bg-slate-800 text-slate-400 rounded-xl text-xs font-medium border border-slate-200 dark:border-slate-700 flex items-center gap-2">
                  <AlertCircle size={16} className="shrink-0" />
                  <span>Sin carpeta seleccionada</span>
                </div>
              )}
            </div>
          </div>

          {/* Botón de Acción Principal a Ancho Completo en la Parte Inferior */}
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 mt-2">
            {processResult && (
              <div className={`mb-4 p-3.5 rounded-xl border text-xs ${processResult.errores.length > 0 ? 'bg-red-50 dark:bg-red-950/50 border-red-200 text-red-700' : 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 text-emerald-700'}`}>
                <h4 className="font-bold">
                  {processResult.exito} facturas procesadas correctamente.
                </h4>
                {processResult.errores.length > 0 && (
                  <ul className="mt-1 text-[11px] list-disc pl-4 space-y-0.5">
                    {processResult.errores.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                )}
              </div>
            )}

            <button
              onClick={handleProcess}
              disabled={pidsSeleccionados.length === 0 || processing || !selectedFolder}
              className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              {processing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Registrando Liquidaciones...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  💾 REGISTRAR LIQUIDACIÓN MASIVA (SELECCIONADAS)
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <LiquidacionReporteModal 
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        proposalId={modalProposalId}
        fechaPago={modalFechaPago}
        montoPago={modalMontoPago}
      />
    </div>
  );
};
