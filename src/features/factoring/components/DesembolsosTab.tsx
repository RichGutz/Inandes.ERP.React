import React, { useState, useEffect, useMemo, useRef } from 'react';
import { DriveTreeView } from './DriveTreeView';
import { 
  Building2, 
  ChevronDown, 
  ChevronUp, 
  FolderOpen, 
  CheckCircle2, 
  AlertCircle,
  FileText,
  Upload,
  Download,
  Send,
  Loader2
} from 'lucide-react';

interface FacturaDesembolso {
  proposal_id: string;
  emisor_nombre: string;
  emisor_ruc: string;
  aceptante_nombre: string;
  moneda_factura: string;
  monto_neto_factura: number;
  monto_a_desembolsar: number;
  identificador_lote: string;
  recalculate_result_json?: string;
}

const API_BASE = import.meta.env.VITE_API_FACTORING_URL || 'http://localhost:8000';

export const DesembolsosTab: React.FC = () => {
  const [invoices, setInvoices] = useState<FacturaDesembolso[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Navegación
  const [activeLetter, setActiveLetter] = useState<string>('A');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedCompanies, setExpandedCompanies] = useState<Set<string>>(new Set());
  const [expandedLotes, setExpandedLotes] = useState<Set<string>>(new Set());

  // Voucher
  const [datosBancarios, setDatosBancarios] = useState<any>(null);
  const [loadingBanco, setLoadingBanco] = useState(false);
  const [voucherB64, setVoucherB64] = useState<string | null>(null);
  const [generatingVoucher, setGeneratingVoucher] = useState(false);

  // Formalización
  const [fechaDesembolso, setFechaDesembolso] = useState<string>(new Date().toISOString().split('T')[0]);
  const [sustentoUnico, setSustentoUnico] = useState(false);
  const [consolidatedFile, setConsolidatedFile] = useState<File | null>(null);
  const [individualFiles, setIndividualFiles] = useState<Record<string, File>>({});

  // Drive & Final
  const [selectedFolder, setSelectedFolder] = useState<{ id: string; name: string } | null>(null);
  const [registering, setRegistering] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchPendientes();
  }, []);

  const fetchPendientes = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/desembolsos/pendientes`);
      if (!res.ok) throw new Error('Error al cargar facturas pendientes de desembolso');
      const data = await res.json();
      setInvoices(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getGroupId = (inv: FacturaDesembolso) => {
    try {
      if (!inv.recalculate_result_json) return 'General';
      const rj = JSON.parse(inv.recalculate_result_json);
      return rj.group_id || 'General';
    } catch {
      return 'General';
    }
  };

  const companiesMap = useMemo(() => {
    const map: Record<string, Record<string, Record<string, Record<string, FacturaDesembolso[]>>>> = {};
    invoices.forEach(inv => {
      let emisor = (inv.emisor_nombre || "Desconocido").trim();
      let firstLetter = emisor.charAt(0).toUpperCase();
      if (!/[A-Z]/.test(firstLetter)) firstLetter = '#';

      if (!map[firstLetter]) map[firstLetter] = {};
      if (!map[firstLetter][emisor]) map[firstLetter][emisor] = {};
      
      const lote = inv.identificador_lote || 'Sin Lote';
      if (!map[firstLetter][emisor][lote]) map[firstLetter][emisor][lote] = {};
      
      const grp = getGroupId(inv);
      if (!map[firstLetter][emisor][lote][grp]) map[firstLetter][emisor][lote][grp] = [];
      
      map[firstLetter][emisor][lote][grp].push(inv);
    });
    return map;
  }, [invoices]);

  const letterCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    const allLetters = [...Array.from({length: 26}, (_, i) => String.fromCharCode(65 + i)), '#'];
    allLetters.forEach(l => counts[l] = 0);

    for (const [letter, comps] of Object.entries(companiesMap)) {
      let count = 0;
      for (const lotes of Object.values(comps)) {
        for (const grps of Object.values(lotes)) {
          for (const invs of Object.values(grps)) {
            count += invs.length;
          }
        }
      }
      counts[letter] = count;
    }
    return counts;
  }, [companiesMap]);

  useEffect(() => {
    const availableLetters = Object.keys(letterCounts).filter(l => letterCounts[l] > 0);
    if (availableLetters.length > 0 && letterCounts[activeLetter] === 0) {
      setActiveLetter(availableLetters[0]);
    }
  }, [letterCounts]);

  const toggleSelection = (id: string) => {
    const newSel = new Set(selectedIds);
    if (newSel.has(id)) newSel.delete(id);
    else newSel.add(id);
    setSelectedIds(newSel);
    
    // Si la selección cambia a vacío o a otra empresa, reset de datos bancarios y voucher
    setDatosBancarios(null);
    setVoucherB64(null);
  };

  const toggleGroupSelection = (groupIds: string[], allSelected: boolean) => {
    const newSel = new Set(selectedIds);
    groupIds.forEach(id => {
      if (allSelected) newSel.delete(id);
      else newSel.add(id);
    });
    setSelectedIds(newSel);
    setDatosBancarios(null);
    setVoucherB64(null);
  };

  const toggleExpanded = (set: Set<string>, key: string, setter: React.Dispatch<React.SetStateAction<Set<string>>>) => {
    const newSet = new Set(set);
    if (newSet.has(key)) newSet.delete(key);
    else newSet.add(key);
    setter(newSet);
  };

  const formatCurrency = (val: number, cur: string) => {
    return new Intl.NumberFormat('es-PE', { style: 'currency', currency: cur }).format(val);
  };

  const parseInvoiceNumber = (pid: string) => {
    const p = pid.split('-');
    return p.length > 2 ? `${p[1]}-${p[2]}` : pid;
  };

  const selectedInvoices = useMemo(() => {
    return invoices.filter(inv => selectedIds.has(inv.proposal_id));
  }, [selectedIds, invoices]);

  const montoTotal = useMemo(() => {
    return selectedInvoices.reduce((acc, inv) => acc + (inv.monto_a_desembolsar || 0), 0);
  }, [selectedInvoices]);

  const monedaUnica = selectedInvoices.length > 0 ? selectedInvoices[0].moneda_factura : 'PEN';

  // Fetch Banco
  useEffect(() => {
    if (selectedInvoices.length > 0 && !datosBancarios) {
      const ruc = selectedInvoices[0].emisor_ruc;
      if (ruc) {
        setLoadingBanco(true);
        fetch(`${API_BASE}/api/desembolsos/datos-bancarios/${ruc}`)
          .then(res => res.json())
          .then(data => setDatosBancarios(data))
          .catch(e => console.error(e))
          .finally(() => setLoadingBanco(false));
      }
    }
  }, [selectedInvoices]);

  const handleGenerateVoucher = async () => {
    if (!datosBancarios || selectedInvoices.length === 0) return;
    try {
      setGeneratingVoucher(true);
      const payload = {
        datos_emisor: datosBancarios,
        monto_total: montoTotal,
        moneda: monedaUnica,
        facturas: selectedInvoices.map(f => ({
          numero_factura: parseInvoiceNumber(f.proposal_id),
          emisor_nombre: f.emisor_nombre || 'N/A',
          monto: f.monto_a_desembolsar || 0
        }))
      };

      const res = await fetch(`${API_BASE}/api/desembolsos/generar-voucher`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Error al generar el voucher PDF');
      
      const data = await res.json();
      setVoucherB64(data.file_base64);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setGeneratingVoucher(false);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        let encoded = reader.result as string;
        // Strip out the data URL prefix (e.g., "data:application/pdf;base64,")
        encoded = encoded.replace(/^data:(.*,)?/, '');
        if ((encoded.length % 4) > 0) {
          encoded += '='.repeat(4 - (encoded.length % 4));
        }
        resolve(encoded);
      };
      reader.onerror = error => reject(error);
    });
  };

  const handleRegisterDesembolso = async () => {
    if (!selectedFolder) {
      alert('Debes seleccionar una carpeta en Google Drive.');
      return;
    }
    if (sustentoUnico && !consolidatedFile) {
      alert('Debes subir el archivo de Sustento Único.');
      return;
    }

    try {
      setRegistering(true);
      
      const filesPayload: any[] = [];
      
      // 1. Voucher
      if (voucherB64) {
        filesPayload.push({
          file_name: `${selectedInvoices[0].identificador_lote}_Voucher_Transferencia.pdf`,
          file_base64: voucherB64
        });
      }

      // 2. Sustentos
      if (sustentoUnico && consolidatedFile) {
        const b64 = await fileToBase64(consolidatedFile);
        filesPayload.push({
          file_name: `${selectedInvoices[0].identificador_lote}_Sustento_Global.${consolidatedFile.name.split('.').pop()}`,
          file_base64: b64
        });
      } else if (!sustentoUnico) {
        for (const inv of selectedInvoices) {
          const file = individualFiles[inv.proposal_id];
          if (file) {
            const b64 = await fileToBase64(file);
            filesPayload.push({
              file_name: `${inv.identificador_lote}_${parseInvoiceNumber(inv.proposal_id)}_Sustento.${file.name.split('.').pop()}`,
              file_base64: b64
            });
          }
        }
      }

      const payload = {
        desembolsos: selectedInvoices.map(inv => ({
          proposal_id: inv.proposal_id,
          monto: inv.monto_a_desembolsar,
          fecha: fechaDesembolso
        })),
        folder_id: selectedFolder.id,
        files: filesPayload
      };

      const res = await fetch(`${API_BASE}/api/desembolsos/registrar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('Error al registrar desembolsos');
      
      setSuccessMsg(`¡${selectedInvoices.length} operaciones desembolsadas con éxito!`);
      
      // Reset after 3 seconds
      setTimeout(() => {
        setSuccessMsg(null);
        setSelectedIds(new Set());
        setVoucherB64(null);
        setConsolidatedFile(null);
        setIndividualFiles({});
        setSelectedFolder(null);
        fetchPendientes();
      }, 3000);

    } catch (e: any) {
      alert(e.message);
    } finally {
      setRegistering(false);
    }
  };

  if (loading) return <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin text-indigo-600 h-8 w-8" /></div>;
  if (error) return <div className="text-red-500 bg-red-50 p-4 rounded-md">{error}</div>;

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 p-6">
        <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-4">1. Facturas Pendientes de Desembolso</h2>
        
        {invoices.length === 0 ? (
          <div className="text-center text-slate-500 py-8">No hay facturas aprobadas pendientes de desembolso.</div>
        ) : (
          <>
            {/* Abecedario */}
            <div className="flex flex-wrap gap-2 mb-4">
              {Object.keys(letterCounts).map(letter => {
                const count = letterCounts[letter];
                const isActive = activeLetter === letter;
                const hasInvoices = count > 0;
                
                if (!hasInvoices && letter !== '#') return null;

                return (
                  <button
                    key={letter}
                    onClick={() => hasInvoices && setActiveLetter(letter)}
                    disabled={!hasInvoices}
                    className={`relative px-4 py-2 rounded-md font-bold text-sm transition-colors ${
                      isActive 
                        ? 'bg-indigo-600 text-white shadow-sm' 
                        : hasInvoices 
                          ? 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700' 
                          : 'bg-slate-50 text-slate-300 cursor-not-allowed dark:bg-slate-800/30 dark:text-slate-600'
                    }`}
                  >
                    {letter}
                    {hasInvoices && (
                      <span className="absolute -top-2 -right-2 bg-emerald-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="space-y-4">
              {!companiesMap[activeLetter] ? (
                <div className="text-center py-6 text-slate-500">No hay empresas registradas con la letra {activeLetter}</div>
              ) : (
                Object.entries(companiesMap[activeLetter]).map(([emisor, lotes]) => (
                  <div key={emisor} className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                    {/* Empresa Header */}
                    <button 
                      className="w-full bg-slate-50 dark:bg-slate-800 px-4 py-3 flex justify-between items-center hover:bg-slate-100 dark:hover:bg-slate-700/80 transition-colors"
                      onClick={() => toggleExpanded(expandedCompanies, emisor, setExpandedCompanies)}
                    >
                      <div className="flex items-center gap-3">
                        <Building2 className="text-indigo-500" size={20} />
                        <span className="font-bold text-slate-800 dark:text-white">{emisor}</span>
                      </div>
                      {expandedCompanies.has(emisor) ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </button>

                    {expandedCompanies.has(emisor) && (
                      <div className="p-4 space-y-4 bg-white dark:bg-slate-900">
                        {Object.entries(lotes).map(([loteId, grupos]) => (
                          <div key={loteId} className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                            {/* Lote Header */}
                            <button
                              className="w-full bg-slate-50 dark:bg-slate-800/50 px-4 py-2 flex justify-between items-center border-b border-slate-200 dark:border-slate-700"
                              onClick={() => toggleExpanded(expandedLotes, loteId, setExpandedLotes)}
                            >
                              <div className="flex items-center gap-2">
                                <FolderOpen className="text-emerald-500" size={16} />
                                <span className="font-semibold text-sm text-slate-700 dark:text-slate-300">Lote: {loteId}</span>
                              </div>
                              {expandedLotes.has(loteId) ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </button>

                            {expandedLotes.has(loteId) && (
                              <div className="p-4 space-y-4">
                                {Object.entries(grupos).map(([grupoId, fList]) => {
                                  const groupIds = fList.map(f => f.proposal_id);
                                  const allSelected = groupIds.every(id => selectedIds.has(id));
                                  
                                  return (
                                    <div key={grupoId} className="border border-slate-200 dark:border-slate-700 rounded-md p-3">
                                      <div className="flex items-center gap-4 mb-3 pb-2 border-b border-slate-100 dark:border-slate-800">
                                        <h4 className="font-semibold text-sm text-slate-600 dark:text-slate-400 flex-1">Grupo: {grupoId}</h4>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                          <input 
                                            type="checkbox"
                                            checked={allSelected}
                                            onChange={() => toggleGroupSelection(groupIds, allSelected)}
                                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                          />
                                          <span className="text-xs font-bold text-slate-500">Seleccionar Todo el Grupo</span>
                                        </label>
                                      </div>

                                      <table className="w-full text-sm text-left">
                                        <thead className="text-slate-500 uppercase font-bold border-b border-slate-200 dark:border-slate-700">
                                          <tr>
                                            <th className="px-2 py-2 w-10">Sel</th>
                                            <th className="px-2 py-2">Factura</th>
                                            <th className="px-2 py-2">Aceptante</th>
                                            <th className="px-2 py-2 text-right">Monto</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                                          {fList.map(inv => (
                                            <tr key={inv.proposal_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                              <td className="px-2 py-3">
                                                <input 
                                                  type="checkbox"
                                                  checked={selectedIds.has(inv.proposal_id)}
                                                  onChange={() => toggleSelection(inv.proposal_id)}
                                                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                                />
                                              </td>
                                              <td className="px-2 py-3 font-mono font-bold text-slate-700 dark:text-slate-300">
                                                {parseInvoiceNumber(inv.proposal_id)}
                                              </td>
                                              <td className="px-2 py-3 truncate max-w-[200px] text-slate-600 dark:text-slate-400">
                                                {inv.aceptante_nombre || 'N/A'}
                                              </td>
                                              <td className="px-2 py-3 text-right text-emerald-600 font-bold">
                                                {formatCurrency(inv.monto_a_desembolsar || 0, inv.moneda_factura)}
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>

      {selectedInvoices.length > 0 && (
        <>
          {/* SECCIÓN 2: VOUCHER */}
          <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 p-6">
            <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-4">2. Generar Voucher</h2>
            
            {!datosBancarios && !loadingBanco ? (
              <div className="text-red-500 bg-red-50 p-3 rounded-md flex gap-2 items-center">
                <AlertCircle size={18} /> El emisor no tiene datos bancarios registrados o seleccionaste facturas de distinto emisor.
              </div>
            ) : loadingBanco ? (
              <div className="flex gap-2 items-center text-slate-500"><Loader2 className="animate-spin" size={16} /> Cargando datos bancarios...</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Monto */}
                <div className="bg-slate-50 dark:bg-slate-800 p-6 rounded-lg border border-slate-200 dark:border-slate-700 flex flex-col justify-center items-center h-48">
                  <div className="text-slate-500 uppercase font-bold text-xs mb-2">Total a Transferir</div>
                  <div className="text-3xl font-bold text-slate-800 dark:text-white">{formatCurrency(montoTotal, monedaUnica)}</div>
                </div>

                {/* Acciones Voucher */}
                <div className="flex flex-col justify-center h-48 gap-4 px-4">
                  <button
                    onClick={handleGenerateVoucher}
                    disabled={generatingVoucher}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-md transition-colors flex justify-center items-center gap-2 disabled:bg-indigo-400"
                  >
                    {generatingVoucher ? <Loader2 className="animate-spin" size={18}/> : <FileText size={18} />}
                    Generar Voucher PDF
                  </button>
                  
                  {voucherB64 && (
                    <a
                      href={`data:application/pdf;base64,${voucherB64}`}
                      download="voucher_transferencia.pdf"
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-md transition-colors flex justify-center items-center gap-2 text-center"
                    >
                      <Download size={18} />
                      Descargar Voucher
                    </a>
                  )}
                </div>

                {/* Datos Bancarios */}
                <div className="bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-700 h-48 text-sm text-slate-600 dark:text-slate-300">
                  <div className="mb-2"><strong className="text-slate-800 dark:text-white">Beneficiario:</strong> {datosBancarios['Razon Social']}</div>
                  <div className="mb-2"><strong className="text-slate-800 dark:text-white">Banco:</strong> {datosBancarios['Institucion Financiera']}</div>
                  <div className="mb-2"><strong className="text-slate-800 dark:text-white">Cuenta:</strong> {datosBancarios[`Numero de Cuenta ${monedaUnica}`] || 'N/A'}</div>
                  <div><strong className="text-slate-800 dark:text-white">CCI:</strong> {datosBancarios[`Numero de CCI ${monedaUnica}`] || 'N/A'}</div>
                </div>

              </div>
            )}
          </div>

          {/* SECCIÓN 3: FORMALIZACIÓN */}
          <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 p-6">
            <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-4">3. Formalización</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Fecha de Desembolso</label>
                <input 
                  type="date" 
                  value={fechaDesembolso}
                  onChange={e => setFechaDesembolso(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-md bg-white dark:bg-slate-800 text-slate-800 dark:text-white"
                />
              </div>
              <div className="flex flex-col justify-center">
                <label className="flex items-center gap-2 cursor-pointer mt-6">
                  <input 
                    type="checkbox"
                    checked={sustentoUnico}
                    onChange={e => setSustentoUnico(e.target.checked)}
                    className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="font-bold text-slate-700 dark:text-slate-300">Sustento de Pago Único (Consolidado)</span>
                </label>
              </div>
            </div>

            {sustentoUnico ? (
              <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 p-6 rounded-lg text-center bg-slate-50 dark:bg-slate-800/50">
                <Upload className="mx-auto text-slate-400 mb-2" size={24} />
                <p className="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-2">Subir Evidencia Consolidada</p>
                <input 
                  type="file" 
                  accept=".pdf, .png, .jpg, .jpeg"
                  className="text-sm text-slate-500 mx-auto"
                  onChange={e => setConsolidatedFile(e.target.files?.[0] || null)}
                />
              </div>
            ) : (
              <div className="space-y-3">
                {selectedInvoices.map(inv => (
                  <div key={inv.proposal_id} className="flex items-center gap-4 border border-slate-200 dark:border-slate-700 p-3 rounded-lg">
                    <div className="flex-1 font-mono text-sm font-bold text-slate-700 dark:text-slate-300">
                      {parseInvoiceNumber(inv.proposal_id)}
                    </div>
                    <div className="w-1/3 text-emerald-600 font-bold">
                      {formatCurrency(inv.monto_a_desembolsar || 0, inv.moneda_factura)}
                    </div>
                    <div className="w-1/2">
                      <input 
                        type="file"
                        accept=".pdf, .png, .jpg, .jpeg"
                        className="text-xs w-full text-slate-500"
                        onChange={e => {
                          const f = e.target.files?.[0];
                          if (f) setIndividualFiles(prev => ({...prev, [inv.proposal_id]: f}));
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SECCIÓN 4: DRIVE Y REGISTRO */}
          <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 p-6">
            <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-4">4. Selección de Carpeta Destino</h2>
            
            <div className="h-64 overflow-hidden border border-slate-200 dark:border-slate-700 rounded-lg">
              <DriveTreeView 
                rootFolderId="1h6w84vFmZpZ9u3-2Q8B9jX4m_4C1L_7s" // Raiz del drive (mismo de originación o configurable)
                rootFolderName="InAndes Drive"
                selectedFolderId={selectedFolder?.id || ''}
                onSelectFolder={f => setSelectedFolder(f)}
                apiBaseUrl={API_BASE}
              />
            </div>

            {selectedFolder && (
              <div className="mt-4 p-3 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-md font-medium border border-emerald-200 dark:border-emerald-800">
                Destino Seleccionado: <span className="font-bold">{selectedFolder.name}</span>
              </div>
            )}

            <div className="mt-6 border-t border-slate-200 dark:border-slate-700 pt-6">
              {successMsg ? (
                <div className="bg-emerald-100 text-emerald-800 p-4 rounded-lg flex items-center justify-center gap-2 font-bold">
                  <CheckCircle2 size={20} />
                  {successMsg}
                </div>
              ) : (
                <button
                  onClick={handleRegisterDesembolso}
                  disabled={registering}
                  className="w-full bg-slate-800 hover:bg-slate-900 dark:bg-slate-100 dark:hover:bg-white dark:text-slate-900 text-white font-bold py-4 rounded-lg flex justify-center items-center gap-2 transition-colors disabled:opacity-70"
                >
                  {registering ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
                  REGISTRAR DESEMBOLSO Y SUBIR ARCHIVOS
                </button>
              )}
            </div>

          </div>
        </>
      )}

    </div>
  );
};
