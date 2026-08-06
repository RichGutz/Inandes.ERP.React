import React, { useState, useEffect, useMemo } from 'react';
import { getApiBaseUrl } from '../../../config/apiConfig';
import { AlertCircle, CheckCircle2, FileCheck2, Filter, Loader2, Mail, Send } from 'lucide-react';

// Interfaces
interface FacturaAprobacion {
  proposal_id: string;
  emisor_nombre: string;
  aceptante_nombre: string;
  numero_factura: string;
  monto_neto_factura: number;
  moneda_factura: string;
  identificador_lote: string;
  recalculate_result_json?: string;
  // Mocked statuses
  status_cavali?: string;
  status_letra?: string;
  // Calculated from JSON
  group_id?: string;
  monto_a_desembolsar?: number;
}

export const AprobacionTab: React.FC = () => {
  const [facturas, setFacturas] = useState<FacturaAprobacion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Selecciones
  const [activeLetter, setActiveLetter] = useState<string>('A');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Aprobación y UI
  const [forceApproval, setForceApproval] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [approvalResult, setApprovalResult] = useState<{
    success: boolean;
    count: number;
    emisor?: string;
    totalAmount?: number;
    invoices?: { num: string; amount: number }[];
  } | null>(null);

  // --- Carga Inicial de Datos ---
  const API_BASE = getApiBaseUrl();
  const fetchFacturas = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/aprobacion/pendientes`);
      if (!res.ok) throw new Error("Error al cargar las facturas pendientes.");
      const data: any[] = await res.json();
      
      // Aplicar Mock de Estados (Cavali / Letras) y parsear JSON
      const procesadas: FacturaAprobacion[] = data.map(f => {
        let groupId = 'General';
        let montoDesembolso = 0;
        
        try {
          if (f.recalculate_result_json) {
            const rj = JSON.parse(f.recalculate_result_json);
            if (rj.group_id) groupId = String(rj.group_id);
            if (rj.desglose_final_detallado?.abono?.monto) {
              montoDesembolso = rj.desglose_final_detallado.abono.monto;
            }
          }
        } catch (e) { }

        return {
          ...f,
          group_id: groupId,
          monto_a_desembolsar: montoDesembolso,
          status_cavali: Math.random() > 0.5 ? 'ACEPTADA' : 'ENVIADA',
          status_letra: Math.random() > 0.5 ? 'FIRMADA' : 'ENVIADA',
        };
      });

      setFacturas(procesadas);
      setSelectedIds(new Set());
      setApprovalResult(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFacturas();
  }, []);

  // --- Lógica de Agrupación (Alfabeto -> Empresa -> Lote -> Grupo) ---
  const { groupedData, letterCounts, availableLetters } = useMemo(() => {
    const map = new Map<string, any>();
    const counts: Record<string, number> = {};
    
    // Inicializar alfabeto A-Z
    for (let i = 65; i <= 90; i++) {
      const letter = String.fromCharCode(i);
      counts[letter] = 0;
      map.set(letter, {});
    }
    counts['#'] = 0;
    map.set('#', {});

    facturas.forEach(inv => {
      const empresa = (inv.emisor_nombre || "Desconocido").trim();
      let firstLetter = empresa.charAt(0).toUpperCase();
      if (!/[A-Z]/.test(firstLetter)) firstLetter = '#';
      
      counts[firstLetter]++;
      
      const letterMap = map.get(firstLetter);
      if (!letterMap[empresa]) letterMap[empresa] = {};
      
      const loteId = inv.identificador_lote || 'Sin Lote';
      if (!letterMap[empresa][loteId]) letterMap[empresa][loteId] = {};
      
      const groupId = inv.group_id || 'General';
      if (!letterMap[empresa][loteId][groupId]) letterMap[empresa][loteId][groupId] = [];
      
      letterMap[empresa][loteId][groupId].push(inv);
    });

    const activeLetters = Object.keys(counts).filter(l => counts[l] > 0);
    
    return {
      groupedData: map,
      letterCounts: counts,
      availableLetters: activeLetters
    };
  }, [facturas]);

  // Si la letra activa no tiene elementos, saltar a la primera que sí tenga
  useEffect(() => {
    if (availableLetters.length > 0 && (!letterCounts[activeLetter] || letterCounts[activeLetter] === 0)) {
      setActiveLetter(availableLetters[0]);
    }
  }, [availableLetters, activeLetter, letterCounts]);

  // --- Funciones de Selección ---
  const toggleSelection = (pid: string) => {
    const next = new Set(selectedIds);
    if (next.has(pid)) next.delete(pid);
    else next.add(pid);
    setSelectedIds(next);
  };

  const toggleGroupSelection = (invoices: FacturaAprobacion[], selectAll: boolean) => {
    const next = new Set(selectedIds);
    invoices.forEach(inv => {
      if (selectAll) next.add(inv.proposal_id);
      else next.delete(inv.proposal_id);
    });
    setSelectedIds(next);
  };

  // --- Funciones Auxiliares ---
  const parseInvoiceNumber = (pid: string) => {
    const parts = pid.split('-');
    if (parts.length >= 3) return `${parts[parts.length-3]}-${parts[parts.length-2]}`;
    return pid;
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency === 'PEN' ? 'PEN' : 'USD' }).format(amount).replace('PEN', 'S/');
  };

  const StatusBadge = ({ status, successValue }: { status?: string, successValue: string }) => {
    const isSuccess = status === successValue;
    return (
      <span className={`px-2.5 py-1 text-xs font-bold rounded-md border ${
        isSuccess 
          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800'
          : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800'
      }`}>
        {status || 'PENDIENTE'}
      </span>
    );
  };

  // --- Flujo de Aprobación ---
  const handleAprobar = async () => {
    if (selectedIds.size === 0) return;
    
    // Obtener objetos seleccionados
    const selectedInvoices = facturas.filter(f => selectedIds.has(f.proposal_id));
    
    // Validar estados si no se fuerza
    if (!forceApproval) {
      const issues = selectedInvoices.filter(f => f.status_cavali !== 'ACEPTADA' || f.status_letra !== 'FIRMADA');
      if (issues.length > 0) {
        alert("Hay facturas sin estado de Cavali 'ACEPTADA' o Letra 'FIRMADA'. Usa la opción de aprobación forzada si deseas omitir esta validación.");
        return;
      }
    }

    setProcessing(true);
    try {
      const pids = Array.from(selectedIds);
      const res = await fetch(`${API_BASE}/api/aprobacion/aprobar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposal_ids: pids })
      });

      if (!res.ok) throw new Error("Error al aprobar en el servidor.");
      
      // Asumimos que todas pertenecen a la misma empresa (como suele hacerse en la UI por diseño del flujo)
      const emisor = selectedInvoices[0]?.emisor_nombre || "Desconocido";
      const total = selectedInvoices.reduce((sum, inv) => sum + (inv.monto_a_desembolsar || 0), 0);
      const list = selectedInvoices.map(inv => ({ num: parseInvoiceNumber(inv.proposal_id), amount: inv.monto_a_desembolsar || 0 }));
      
      setApprovalResult({
        success: true,
        count: pids.length,
        emisor,
        totalAmount: total,
        invoices: list
      });

      // Recargar lista
      fetchFacturas();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setProcessing(false);
    }
  };

  // --- Renderizado del Acordeón ---
  const renderEmpresa = (empresa: string, lotes: any) => {
    const isExpanded = true; // Simplificado, podríamos manejar estado de expansión
    const invoicesInEmpresa = Object.values(lotes).flatMap((l: any) => Object.values(l).flat());
    const count = invoicesInEmpresa.length;
    
    return (
      <div key={empresa} className="mb-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400 rounded-xl">
              <FileCheck2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-lg">{empresa}</h3>
              <p className="text-xs text-slate-500 font-medium">{count} facturas pendientes</p>
            </div>
          </div>
        </div>
        
        {isExpanded && (
          <div className="p-4 space-y-4">
            {Object.entries(lotes).sort().map(([loteId, grupos]: any) => (
              <div key={loteId} className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                <div className="px-4 py-2 bg-slate-100 dark:bg-slate-800 font-bold text-sm text-slate-700 dark:text-slate-300">
                  Lote: {loteId}
                </div>
                <div className="p-4 space-y-4">
                  {Object.entries(grupos).sort().map(([grupoId, groupInvoices]: any) => {
                    const allSelected = groupInvoices.every((inv: any) => selectedIds.has(inv.proposal_id));
                    
                    return (
                      <div key={grupoId} className="border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-slate-800 pb-2">
                          <span className="font-semibold text-sm text-indigo-600 dark:text-indigo-400">Grupo: {grupoId}</span>
                          <label className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-400 cursor-pointer hover:text-indigo-600">
                            <input 
                              type="checkbox" 
                              checked={allSelected} 
                              onChange={(e) => toggleGroupSelection(groupInvoices, e.target.checked)}
                              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            Seleccionar Todo el Grupo
                          </label>
                        </div>
                        
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs whitespace-nowrap">
                            <thead className="text-slate-500 uppercase font-bold border-b border-slate-200 dark:border-slate-700">
                              <tr>
                                <th className="px-2 py-2 w-10">Sel</th>
                                <th className="px-2 py-2">Factura</th>
                                <th className="px-2 py-2">Emisor</th>
                                <th className="px-2 py-2">Aceptante</th>
                                <th className="px-2 py-2">M. Neto</th>
                                <th className="px-2 py-2">Desembolso</th>
                                <th className="px-2 py-2 text-center">Est. Cavali</th>
                                <th className="px-2 py-2 text-center">Est. Letra</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium text-slate-700 dark:text-slate-300">
                              {groupInvoices.map((inv: FacturaAprobacion) => (
                                <tr key={inv.proposal_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                  <td className="px-2 py-3">
                                    <input 
                                      type="checkbox"
                                      checked={selectedIds.has(inv.proposal_id)}
                                      onChange={() => toggleSelection(inv.proposal_id)}
                                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                    />
                                  </td>
                                  <td className="px-2 py-3 font-mono font-bold">{parseInvoiceNumber(inv.proposal_id)}</td>
                                  <td className="px-2 py-3 truncate max-w-[150px]">{inv.emisor_nombre || 'N/A'}</td>
                                  <td className="px-2 py-3 truncate max-w-[150px]">{inv.aceptante_nombre || 'N/A'}</td>
                                  <td className="px-2 py-3">{formatCurrency(inv.monto_neto_factura, inv.moneda_factura)}</td>
                                  <td className="px-2 py-3 font-bold text-emerald-600 dark:text-emerald-400">
                                    {formatCurrency(inv.monto_a_desembolsar || 0, inv.moneda_factura)}
                                  </td>
                                  <td className="px-2 py-3 text-center">
                                    <StatusBadge status={inv.status_cavali} successValue="ACEPTADA" />
                                  </td>
                                  <td className="px-2 py-3 text-center">
                                    <StatusBadge status={inv.status_letra} successValue="FIRMADA" />
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-24">
      
      {/* Header & Reload */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <CheckCircle2 className="w-6 h-6 text-indigo-600" />
            Módulo de Aprobación
          </h2>
          <p className="text-slate-500 dark:text-slate-400 font-medium text-sm mt-1">
            Revisión y autorización de operaciones originadas (facturas en estado ACTIVO).
          </p>
        </div>
        <button 
          onClick={fetchFacturas}
          disabled={loading}
          className="px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition-colors flex items-center gap-2"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Filter className="w-4 h-4" />}
          Recargar Datos
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-2xl flex gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="font-semibold text-sm">{error}</p>
        </div>
      )}

      {!loading && facturas.length === 0 && !error && (
        <div className="p-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl text-center shadow-sm">
          <CheckCircle2 className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-xl font-black text-slate-800 dark:text-white">Al Día</h3>
          <p className="text-slate-500 mt-2">No hay facturas pendientes de aprobación en este momento.</p>
        </div>
      )}

      {facturas.length > 0 && (
        <>
          {/* Navegación Alfabética */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
            <div className="flex flex-wrap gap-2">
              {Object.keys(letterCounts).map(letter => {
                const count = letterCounts[letter];
                if (letter !== '#' && count === 0) return null; // Solo mostrar si tiene o es A-Z
                // Bueno, en UI moderna mejor solo mostrar las que tienen contenido para ahorrar espacio
                if (count === 0) return null;
                
                const isActive = activeLetter === letter;
                return (
                  <button
                    key={letter}
                    onClick={() => setActiveLetter(letter)}
                    className={`relative w-10 h-10 rounded-xl font-black transition-all ${
                      isActive 
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200 dark:shadow-indigo-900/20' 
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
                    }`}
                  >
                    {letter}
                    {count > 0 && (
                      <span className={`absolute -top-1.5 -right-1.5 text-[9px] w-5 h-5 flex items-center justify-center rounded-full font-bold border-2 border-white dark:border-slate-900 ${isActive ? 'bg-emerald-500 text-white' : 'bg-slate-500 text-white'}`}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Listado de Facturas */}
          <div className="space-y-6">
            {groupedData.get(activeLetter) && Object.keys(groupedData.get(activeLetter)).length > 0 ? (
              Object.entries(groupedData.get(activeLetter)).sort().map(([empresa, lotes]) => 
                renderEmpresa(empresa, lotes)
              )
            ) : (
              <div className="p-8 text-center text-slate-500 font-medium">No hay facturas bajo esta letra.</div>
            )}
          </div>
        </>
      )}

      {/* RESULTADO DE CORREO */}
      {approvalResult && (
        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-6 mt-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-emerald-500 text-white rounded-full">
              <Mail className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-black text-emerald-800 dark:text-emerald-400">Notificación de Aprobación</h3>
          </div>
          
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-700 dark:text-slate-300 font-medium whitespace-pre-wrap font-mono">
            {`Estimados,

Se informa que se han aprobado las siguientes facturas del emisor **${approvalResult.emisor}** por un monto total a desembolsar de **S/ ${new Intl.NumberFormat('en-US').format(approvalResult.totalAmount || 0)}**:

${approvalResult.invoices?.map(i => `- Factura ${i.num} (S/ ${new Intl.NumberFormat('en-US').format(i.amount)})`).join('\n')}

Saludos cordiales,
Gerencia`}
          </div>
          <div className="mt-4 flex justify-end">
            <button className="px-4 py-2 bg-slate-900 text-white dark:bg-white dark:text-slate-900 rounded-xl text-sm font-bold flex items-center gap-2 hover:opacity-90">
              <Send className="w-4 h-4" /> Enviar por Correo (Mock)
            </button>
          </div>
        </div>
      )}

      {/* PANEL FLOTANTE INFERIOR PARA APROBACIÓN */}
      {selectedIds.size > 0 && !approvalResult && (
        <div className="fixed bottom-6 left-0 right-0 z-50 px-4 md:px-0">
          <div className="max-w-4xl mx-auto bg-slate-900 dark:bg-slate-800 text-white p-4 rounded-2xl shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-4 border border-slate-700">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center font-black text-lg">
                {selectedIds.size}
              </div>
              <div>
                <p className="font-bold text-sm">Facturas seleccionadas</p>
                <label className="flex items-center gap-2 text-xs text-slate-400 mt-1 cursor-pointer hover:text-white transition-colors">
                  <input 
                    type="checkbox" 
                    checked={forceApproval}
                    onChange={(e) => setForceApproval(e.target.checked)}
                    className="rounded border-slate-600 bg-slate-800 text-red-500 focus:ring-red-500/50"
                  />
                  Aprobación forzada (ignorar estado Cavali/Letras)
                </label>
              </div>
            </div>
            <button
              onClick={handleAprobar}
              disabled={processing}
              className="px-6 py-3 w-full sm:w-auto bg-emerald-500 hover:bg-emerald-600 text-white font-black rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {processing ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
              {processing ? 'Aprobando...' : 'Aprobar Operaciones'}
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
