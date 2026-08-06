import React, { useState, useEffect, useMemo } from 'react';
import { getApiBaseUrl } from '../../../config/apiConfig';
import { DriveTreeView } from './DriveTreeView';
import { LiquidacionReporteModal } from './LiquidacionReporteModal';
import { 
  Building2, 
  ChevronDown, 
  FolderOpen, 
  CheckCircle2, 
  AlertCircle,
  Send,
  Loader2,
  FileSearch
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

  const [activeLetter, setActiveLetter] = useState<string>('A');
  
  // Selection and Input states
  const [selectedInvoices, setSelectedInvoices] = useState<Record<string, boolean>>({});
  const [fechasPago, setFechasPago] = useState<Record<string, string>>({});
  const [montosPago, setMontosPago] = useState<Record<string, number>>({});
  const [sustentoGlobal, setSustentoGlobal] = useState<Record<string, File | null>>({}); // by groupId
  const [sustentosIndividuales, setSustentosIndividuales] = useState<Record<string, File | null>>({}); // by proposalId
  const [useGlobalSustento, setUseGlobalSustento] = useState<Record<string, boolean>>({}); // by groupId

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

      // Init default inputs for Nuevas
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

  // --- Grouping Logic ---
  const getGroupedData = (data: FacturaLiquidacion[]) => {
    const map: Record<string, Record<string, Record<string, Record<string, FacturaLiquidacion[]>>>> = {};
    
    data.forEach(inv => {
      const emisor = inv.emisor_nombre?.trim() || "Desconocido";
      let firstLetter = emisor.charAt(0).toUpperCase();
      if (!/[A-Z]/.test(firstLetter)) firstLetter = '#';
      
      const loteId = inv.identificador_lote || 'Sin Lote';
      const groupId = inv.group_id || 'General';

      if (!map[firstLetter]) map[firstLetter] = {};
      if (!map[firstLetter][emisor]) map[firstLetter][emisor] = {};
      if (!map[firstLetter][emisor][loteId]) map[firstLetter][emisor][loteId] = {};
      if (!map[firstLetter][emisor][loteId][groupId]) map[firstLetter][emisor][loteId][groupId] = [];
      
      map[firstLetter][emisor][loteId][groupId].push(inv);
    });

    return map;
  };

  const currentDataList = activeTab === 'NUEVAS' ? nuevas : enProceso;
  const groupedData = useMemo(() => getGroupedData(currentDataList), [currentDataList]);

  // Alphabet calculations
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ#".split('');
  const letterCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    alphabet.forEach(l => counts[l] = 0);
    
    currentDataList.forEach(inv => {
      const emisor = inv.emisor_nombre?.trim() || "Desconocido";
      let l = emisor.charAt(0).toUpperCase();
      if (!/[A-Z]/.test(l)) l = '#';
      counts[l]++;
    });
    return counts;
  }, [currentDataList]);

  const activeLetters = alphabet.filter(l => l !== '#' ? true : letterCounts['#'] > 0);

  // Initialize active letter if current is empty
  useEffect(() => {
    if (letterCounts[activeLetter] === 0) {
      const firstWithData = activeLetters.find(l => letterCounts[l] > 0);
      if (firstWithData) setActiveLetter(firstWithData);
    }
  }, [letterCounts, activeLetter, activeLetters]);


  // --- Event Handlers ---
  const handleToggleGroup = (pids: string[], isSelected: boolean) => {
    setSelectedInvoices(prev => {
      const next = { ...prev };
      pids.forEach(p => next[p] = isSelected);
      return next;
    });
  };

  const handleVerReporte = (proposalId: string) => {
    setModalProposalId(proposalId);
    setModalFechaPago(fechasPago[proposalId]);
    setModalMontoPago(montosPago[proposalId]);
    setModalOpen(true);
  };

  const handleProcess = async () => {
    const pids = Object.keys(selectedInvoices).filter(k => selectedInvoices[k]);
    if (pids.length === 0) {
      alert("Seleccione al menos una factura para registrar");
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
      formData.append('proposal_ids', JSON.stringify(pids));
      formData.append('fechas_pago', JSON.stringify(fechasPago));
      formData.append('montos_pago', JSON.stringify(montosPago));
      formData.append('folder_id', selectedFolder.id);

      // Append files
      pids.forEach(pid => {
        const inv = currentDataList.find(i => i.proposal_id === pid);
        if (inv) {
          const gId = inv.group_id;
          if (useGlobalSustento[gId] && sustentoGlobal[gId]) {
            formData.append('sustentos', sustentoGlobal[gId]!, `Sustento_Cobranza_GLOBAL_${pid}.pdf`);
          } else if (sustentosIndividuales[pid]) {
            formData.append('sustentos', sustentosIndividuales[pid]!, `Sustento_Cobranza_${pid}.pdf`);
          }
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
          setProcessResult(null);
        }, 3000);
      }

    } catch (err: any) {
      setProcessResult({ exito: 0, errores: [err.message] });
    } finally {
      setProcessing(false);
    }
  };


  // --- Render Helpers ---

  const renderGroup = (loteId: string, groupId: string, invoices: FacturaLiquidacion[]) => {
    const allPids = invoices.map(i => i.proposal_id);
    const isAllSelected = allPids.every(p => selectedInvoices[p]);
    const isGlobal = useGlobalSustento[groupId] || false;

    return (
      <div key={`${loteId}-${groupId}`} className="bg-white border rounded-xl mb-4 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
        <div className="bg-gray-50 border-b px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <input 
              type="checkbox" 
              className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
              checked={isAllSelected}
              onChange={(e) => handleToggleGroup(allPids, e.target.checked)}
            />
            <span className="font-semibold text-gray-700">Grupo: {groupId}</span>
            <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full font-medium">
              {invoices.length} facturas
            </span>
          </div>
          
          <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-lg border shadow-sm">
            <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-gray-700">
              <input 
                type="checkbox" 
                className="w-4 h-4 rounded text-blue-600"
                checked={isGlobal}
                onChange={(e) => setUseGlobalSustento(prev => ({...prev, [groupId]: e.target.checked}))}
              />
              Sustento de Pago Único para Grupo
            </label>
            {isGlobal && (
              <div className="ml-4 flex items-center gap-2">
                <input 
                  type="file"
                  className="text-sm file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setSustentoGlobal(prev => ({...prev, [groupId]: file}));
                  }}
                />
              </div>
            )}
          </div>
        </div>

        <div className="p-4 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-500 uppercase bg-gray-50">
                <tr>
                  <th className="px-4 py-3">Factura</th>
                  <th className="px-4 py-3">Neto</th>
                  <th className="px-4 py-3">PASO 1: Fecha Pago</th>
                  <th className="px-4 py-3">PASO 2: Monto Recibido</th>
                  <th className="px-4 py-3">{isGlobal ? 'Sustento' : 'PASO 3: Sustento Individual'}</th>
                  <th className="px-4 py-3 text-center">PASO 4: Acción</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map(inv => {
                  const pid = inv.proposal_id;
                  const isChecked = selectedInvoices[pid] || false;
                  
                  return (
                    <tr key={pid} className={`border-b hover:bg-blue-50/50 transition-colors ${isChecked ? 'bg-blue-50/30' : ''}`}>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <input 
                            type="checkbox"
                            className="w-4 h-4 rounded text-blue-600 cursor-pointer"
                            checked={isChecked}
                            onChange={(e) => setSelectedInvoices(prev => ({...prev, [pid]: e.target.checked}))}
                          />
                          <div>
                            <div className="font-semibold text-gray-800">{inv.emisor_ruc}</div>
                            <div className="text-xs text-gray-500">{pid}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 font-medium">
                        S/ {inv.monto_neto_factura.toLocaleString('en-US', {minimumFractionDigits:2})}
                      </td>
                      <td className="px-4 py-4">
                        <input 
                          type="date"
                          className="border border-gray-300 rounded-lg px-3 py-2 w-40 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                          value={fechasPago[pid] || ''}
                          onChange={(e) => setFechasPago(prev => ({...prev, [pid]: e.target.value}))}
                        />
                      </td>
                      <td className="px-4 py-4">
                        <div className="relative">
                          <span className="absolute left-3 top-2 text-gray-500">S/</span>
                          <input 
                            type="number"
                            className="border border-gray-300 rounded-lg pl-8 pr-3 py-2 w-32 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            value={montosPago[pid] || 0}
                            onChange={(e) => setMontosPago(prev => ({...prev, [pid]: parseFloat(e.target.value)}))}
                          />
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        {isGlobal ? (
                          <span className="text-xs text-gray-500 italic bg-gray-100 px-2 py-1 rounded">Usa sustento global</span>
                        ) : (
                          <input 
                            type="file"
                            className="text-xs w-48 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
                            onChange={(e) => {
                              const file = e.target.files?.[0] || null;
                              setSustentosIndividuales(prev => ({...prev, [pid]: file}));
                            }}
                          />
                        )}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <button
                          onClick={() => handleVerReporte(pid)}
                          className="bg-gray-800 hover:bg-gray-900 text-white text-xs font-semibold px-4 py-2 rounded-lg flex items-center justify-center gap-2 w-full transition-colors"
                        >
                          <FileSearch className="w-4 h-4" />
                          Ver Reporte Integral
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };


  if (loading) {
    return <div className="p-8 flex justify-center items-center h-64"><Loader2 className="w-10 h-10 animate-spin text-blue-500" /></div>;
  }

  if (error) {
    return <div className="p-8 text-red-500">Error: {error}</div>;
  }

  const hasSelection = Object.values(selectedInvoices).some(v => v);

  return (
    <div className="space-y-6">
      
      {/* Tabs */}
      <div className="flex border-b">
        <button 
          onClick={() => setActiveTab('NUEVAS')}
          className={`px-8 py-4 text-lg font-bold border-b-2 transition-colors ${activeTab === 'NUEVAS' ? 'border-blue-500 text-blue-600 bg-blue-50/50' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Liquidaciones Nuevas
        </button>
        <button 
          onClick={() => setActiveTab('EN_PROCESO')}
          className={`px-8 py-4 text-lg font-bold border-b-2 transition-colors ${activeTab === 'EN_PROCESO' ? 'border-blue-500 text-blue-600 bg-blue-50/50' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Liquidaciones en Proceso
        </button>
      </div>

      <div className="p-6 bg-white rounded-xl shadow-sm border">
        <div className="mb-6">
          <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            {activeTab === 'NUEVAS' ? 'Nuevas Operaciones' : 'En Proceso'}
          </h3>
          <p className="text-gray-500 mt-1">
            {activeTab === 'NUEVAS' ? 'Facturas desembolsadas pendientes del primer pago.' : 'Facturas con pagos parciales previos pendientes de liquidación final.'}
          </p>
        </div>

        {/* Alphabet Navigation */}
        <div className="flex flex-wrap gap-2 mb-6">
          {activeLetters.map(letter => {
            const count = letterCounts[letter];
            const isActive = activeLetter === letter;
            const hasInvoices = count > 0;

            return (
              <button
                key={letter}
                onClick={() => hasInvoices && setActiveLetter(letter)}
                disabled={!hasInvoices}
                className={`relative px-3.5 py-1.5 rounded-lg font-black text-xs transition-all ${
                  isActive 
                    ? 'bg-blue-600 text-white shadow-md ring-2 ring-blue-400 dark:ring-blue-600 scale-105' 
                    : hasInvoices 
                      ? 'bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/80 dark:text-blue-300 dark:hover:bg-blue-900 border border-blue-200 dark:border-blue-800' 
                      : 'bg-slate-100 text-slate-400 cursor-not-allowed dark:bg-slate-800/40 dark:text-slate-600 opacity-50'
                }`}
              >
                {letter}
                {hasInvoices && (
                  <span className="absolute -top-2 -right-2 bg-blue-600 dark:bg-blue-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-black shadow-xs border border-white dark:border-slate-900">
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Accordions */}
        {groupedData[activeLetter] ? (
          <div className="space-y-4">
            {Object.keys(groupedData[activeLetter]).sort().map(emisor => {
              const emisorData = groupedData[activeLetter][emisor];
              const totalInvEmisor = Object.values(emisorData).reduce((acc, lotes) => acc + Object.values(lotes).reduce((a, g) => a + g.length, 0), 0);
              
              return (
                <details key={emisor} className="group bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden" open>
                  <summary className="cursor-pointer bg-gray-50 px-6 py-4 flex items-center justify-between hover:bg-gray-100 transition-colors select-none">
                    <div className="flex items-center gap-3">
                      <Building2 className="w-5 h-5 text-gray-500" />
                      <span className="text-lg font-bold text-gray-800">{emisor}</span>
                      <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-xs font-bold shadow-inner">
                        {totalInvEmisor} facturas
                      </span>
                    </div>
                    <ChevronDown className="w-5 h-5 text-gray-400 group-open:rotate-180 transition-transform" />
                  </summary>
                  <div className="p-4 bg-gray-50/50 space-y-4">
                    {Object.keys(emisorData).sort().map(loteId => {
                      const loteData = emisorData[loteId];
                      const totalInvLote = Object.values(loteData).reduce((acc, g) => acc + g.length, 0);
                      
                      return (
                        <details key={loteId} className="group/lote bg-white border rounded-xl overflow-hidden" open>
                          <summary className="cursor-pointer bg-white px-5 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors select-none">
                            <div className="flex items-center gap-3">
                              <FolderOpen className="w-4 h-4 text-blue-500" />
                              <span className="font-bold text-gray-700">Lote: {loteId}</span>
                              <span className="text-gray-500 text-sm">({totalInvLote})</span>
                            </div>
                            <ChevronDown className="w-4 h-4 text-gray-400 group-open/lote:rotate-180 transition-transform" />
                          </summary>
                          <div className="p-4 bg-white border-t space-y-4">
                            {Object.keys(loteData).sort().map(groupId => {
                              return renderGroup(loteId, groupId, loteData[groupId]);
                            })}
                          </div>
                        </details>
                      );
                    })}
                  </div>
                </details>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">
            No hay facturas para esta letra.
          </div>
        )}

      </div>

      {/* Accion Masiva y Carpeta */}
      <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-4 shadow-sm">
        <span className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
          <FolderOpen size={16} className="text-blue-600" />
          📁 Selección de Carpeta Destino en Google Drive y Registro de Liquidación
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
              onSelectFolder={setSelectedFolder}
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
            disabled={!hasSelection || processing || !selectedFolder}
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
