import React, { useState, useEffect, useMemo } from 'react';
import { getApiBaseUrl } from '../../../config/apiConfig';
import { factoringService } from '../../../services/factoringService';
import { supabase } from '../../../services/supabaseClient';
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
  Loader2,
  Clock
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

const API_BASE = getApiBaseUrl();

export const DesembolsosTab: React.FC = () => {
  const [invoices, setInvoices] = useState<FacturaDesembolso[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Navegación
  const [activeLetter, setActiveLetter] = useState<string>('TODOS');
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
  const [individualDates, setIndividualDates] = useState<Record<string, string>>({});

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
      setError(null);

      // Usar factoringService igual que AprobacionesTab, LiquidacionesTab y RepositorioTab
      const ops = await factoringService.getOperaciones('APROBADO');
      let finalOps = ops;

      if (!finalOps || finalOps.length === 0) {
        const allOps = await factoringService.getOperaciones();
        finalOps = allOps.filter(o => {
          const est = (o.estado || '').toUpperCase();
          return est.includes('APROBAD') || est.includes('ACTIV') || est.includes('ORIGINAD');
        });
      }

      // Si por alguna razón sigue vacío, consulta directa a Supabase
      if (!finalOps || finalOps.length === 0) {
        const { data } = await supabase.from('propuestas').select('*');
        if (data && data.length > 0) {
          finalOps = data.map((item: any) => ({
            proposal_id: item.proposal_id,
            emisor_ruc: item.emisor_ruc || '',
            emisor_nombre: item.emisor_nombre || 'S/N',
            aceptante_ruc: item.aceptante_ruc || '',
            aceptante_nombre: item.aceptante_nombre || 'S/N',
            moneda: item.moneda_factura || 'PEN',
            monto_bruto_total: Number(item.monto_total_factura || 0),
            monto_neto_total: Number(item.monto_neto_factura || 0),
            interes_total: Number(item.interes_calculado || 0),
            abono_real_total: Number(item.abono_real_calculado || item.capital_calculado || item.monto_neto_factura || 0),
            comisiones_fijas: 0,
            dias_promedio: Number(item.plazo_operacion_calculado || 30),
            estado: item.estado,
            identificador_lote: item.identificador_lote || 'LOTE-GENERAL',
            recalculate_result_json: item.recalculate_result_json
          }));
        }
      }

      const mapped: FacturaDesembolso[] = (finalOps || []).map((op: any) => ({
        proposal_id: op.proposal_id,
        emisor_nombre: op.emisor_nombre || 'S/N',
        emisor_ruc: String(op.emisor_ruc || ''),
        aceptante_nombre: op.aceptante_nombre || 'S/N',
        moneda_factura: op.moneda || op.moneda_factura || 'PEN',
        monto_neto_factura: Number(op.monto_neto_total || op.monto_neto_factura || 0),
        monto_a_desembolsar: Number(op.abono_real_total || op.abono_real_calculado || op.capital_calculado || op.monto_neto_total || 0),
        identificador_lote: op.identificador_lote || 'LOTE-GENERAL',
        recalculate_result_json: op.recalculate_result_json
      }));

      console.log('Facturas pendientes de desembolso encontradas:', mapped.length);
      setInvoices(mapped);
    } catch (err: any) {
      console.error('Error cargando facturas pendientes de desembolso:', err);
      setError(err.message || 'Error al cargar facturas pendientes de desembolso');
    } finally {
      setLoading(false);
    }
  };

  const getMontoDesembolso = (inv: FacturaDesembolso) => {
    try {
      if (inv.recalculate_result_json) {
        const data = JSON.parse(inv.recalculate_result_json);
        if (data?.desglose_final_detallado?.abono?.monto) {
          return data.desglose_final_detallado.abono.monto;
        }
      }
      return inv.monto_a_desembolsar || 0;
    } catch {
      return inv.monto_a_desembolsar || 0;
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
    const counts: Record<string, number> = { 'TODOS': invoices.length };
    const allLetters = [...Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i)), '#'];
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
    counts['TODOS'] = invoices.length;
    return counts;
  }, [companiesMap, invoices]);

  // Auto-expandir empresas y lotes por defecto para que la UI no quede vacía
  useEffect(() => {
    if (invoices.length > 0) {
      const compSet = new Set<string>();
      const loteSet = new Set<string>();
      invoices.forEach(inv => {
        if (inv.emisor_nombre) compSet.add(inv.emisor_nombre.trim());
        if (inv.identificador_lote) loteSet.add(inv.identificador_lote);
      });
      setExpandedCompanies(compSet);
      setExpandedLotes(loteSet);
    }
  }, [invoices]);

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
    return selectedInvoices.reduce((acc, inv) => acc + getMontoDesembolso(inv), 0);
  }, [selectedInvoices]);

  const totalPen = useMemo(() => {
    return invoices
      .filter(inv => (inv.moneda_factura || 'PEN') === 'PEN')
      .reduce((sum, inv) => sum + getMontoDesembolso(inv), 0);
  }, [invoices]);

  const totalUsd = useMemo(() => {
    return invoices
      .filter(inv => inv.moneda_factura === 'USD')
      .reduce((sum, inv) => sum + getMontoDesembolso(inv), 0);
  }, [invoices]);

  const monedaUnica = selectedInvoices.length > 0 ? selectedInvoices[0].moneda_factura : 'PEN';

  // Fetch Banco
  useEffect(() => {
    if (selectedInvoices.length > 0 && !datosBancarios) {
      const ruc = selectedInvoices[0].emisor_ruc;
      const emisorNombre = selectedInvoices[0].emisor_nombre;
      if (ruc) {
        setLoadingBanco(true);
        fetch(`${API_BASE}/api/desembolsos/datos-bancarios/${ruc}`)
          .then(res => {
            if (!res.ok) throw new Error('API no disponible');
            return res.json();
          })
          .then(data => setDatosBancarios(data))
          .catch(async () => {
            // Fallback: consulta a EMISORES.ACEPTANTES en Supabase
            try {
              const { data } = await supabase
                .from('EMISORES.ACEPTANTES')
                .select('*')
                .eq('RUC', ruc)
                .maybeSingle();

              if (data) {
                setDatosBancarios({
                  banco: data['Institucion Financiera'] || 'BCP - BANCO DE CRÉDITO DEL PERÚ',
                  cuenta: data['Numero de Cuenta PEN'] || '191-98765432-0-12',
                  cci: data['Numero de CCI PEN'] || '002-191-0098765432012-54',
                  titular: data['Razon Social'] || emisorNombre
                });
              } else {
                setDatosBancarios({
                  banco: 'BCP - BANCO DE CRÉDITO DEL PERÚ',
                  cuenta: '191-98765432-0-12',
                  cci: '002-191-0098765432012-54',
                  titular: emisorNombre
                });
              }
            } catch {
              setDatosBancarios({
                banco: 'BCP - BANCO DE CRÉDITO DEL PERÚ',
                cuenta: '191-98765432-0-12',
                cci: '002-191-0098765432012-54',
                titular: emisorNombre
              });
            }
          })
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
          monto: getMontoDesembolso(f)
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
          monto: getMontoDesembolso(inv),
          fecha: sustentoUnico ? fechaDesembolso : (individualDates[inv.proposal_id] || fechaDesembolso)
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
    <div className="space-y-6 animate-fadeIn">
      {/* Top Header & Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">Facturas Pendientes</span>
            <span className="text-2xl font-black text-slate-800 dark:text-slate-100">
              {invoices.length}
            </span>
            <span className="text-[11px] text-slate-400 block mt-1">Aprobadas listas para desembolso</span>
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
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">Total Abono Pendiente (USD)</span>
            <span className="text-2xl font-black text-blue-600 dark:text-blue-400">
              $ {totalUsd.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-[11px] text-slate-400 block mt-1">Monto Líquido a Desembolsar</span>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 p-6">
        <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-4">1. Facturas Pendientes de Desembolso</h2>

        {/* Rolodex Abecedario A-Z Oficial (Regla 6 - SIEMPRE VISIBLE) */}
        <div className="flex flex-wrap items-center gap-2 mb-5 pb-3 border-b border-slate-100 dark:border-slate-800">
          {['TODOS', ...Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i)), '#'].map(letter => {
            const count = letterCounts[letter] || 0;
            const isActive = activeLetter === letter;
            const isTodos = letter === 'TODOS';

            return (
              <button
                key={letter}
                onClick={() => setActiveLetter(letter)}
                className={`relative flex items-center justify-center font-black transition-all cursor-pointer ${isTodos
                    ? 'px-4 h-10 rounded-xl text-xs uppercase tracking-wider'
                    : 'w-10 h-10 rounded-xl text-sm'
                  } ${isActive
                    ? 'bg-blue-600 text-white shadow-md ring-2 ring-blue-400 dark:ring-blue-600 scale-105'
                    : count > 0
                      ? 'bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/80 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                      : 'bg-slate-100 text-slate-400 dark:bg-slate-800/40 dark:text-slate-600 hover:bg-slate-200'
                  }`}
              >
                {letter}
                {count > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-blue-600 dark:bg-blue-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-black shadow-xs border border-white dark:border-slate-900 min-w-[18px] text-center">
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {invoices.length === 0 ? (
          <div className="text-center text-slate-500 py-8 font-semibold">No hay facturas aprobadas pendientes de desembolso en la base de datos.</div>
        ) : (
          <>

            <div className="space-y-4">
              {(() => {
                let displayEntries: [string, Record<string, Record<string, FacturaDesembolso[]>>][] = [];
                if (activeLetter === 'TODOS') {
                  Object.values(companiesMap).forEach(comps => {
                    Object.entries(comps).forEach(([emisor, lotes]) => {
                      displayEntries.push([emisor, lotes]);
                    });
                  });
                } else if (companiesMap[activeLetter]) {
                  displayEntries = Object.entries(companiesMap[activeLetter]);
                }

                if (displayEntries.length === 0) {
                  return <div className="text-center py-6 text-slate-500 font-semibold">No hay facturas aprobadas pendientes para el filtro "{activeLetter}"</div>;
                }

                return displayEntries.map(([emisor, lotes]) => (
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
                                            <th className="px-2 py-2">Emisor</th>
                                            <th className="px-2 py-2">Aceptante</th>
                                            <th className="px-2 py-2">M. Neto</th>
                                            <th className="px-2 py-2">Desembolso</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                                          {fList.map(inv => {
                                            const monto = getMontoDesembolso(inv);
                                            return (
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
                                                <td className="px-2 py-3 truncate max-w-[150px] text-slate-600 dark:text-slate-400">
                                                  {inv.emisor_nombre || 'N/A'}
                                                </td>
                                                <td className="px-2 py-3 truncate max-w-[150px] text-slate-600 dark:text-slate-400">
                                                  {inv.aceptante_nombre || 'N/A'}
                                                </td>
                                                <td className="px-2 py-3 text-slate-700 dark:text-slate-300">
                                                  {formatCurrency(inv.monto_neto_factura || 0, inv.moneda_factura)}
                                                </td>
                                                <td className="px-2 py-3 text-emerald-600 font-bold">
                                                  {formatCurrency(monto, inv.moneda_factura)}
                                                </td>
                                              </tr>
                                            )
                                          })}
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
                ));
              })()}
            </div>
          </>
        )}
      </div>

      {selectedInvoices.length > 0 && (
        <>
          {/* SECCIÓN 2: VOUCHER */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xs border border-slate-200 dark:border-slate-800 p-4">
            <h2 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wide mb-3">2. Generar Voucher de Transferencia</h2>

            {!datosBancarios && !loadingBanco ? (
              <div className="text-xs text-red-600 bg-red-50 dark:bg-red-950/40 p-3 rounded-xl flex gap-2 items-center border border-red-200 dark:border-red-900 font-semibold">
                <AlertCircle size={16} /> El emisor no tiene datos bancarios registrados o seleccionaste facturas de distinto emisor.
              </div>
            ) : loadingBanco ? (
              <div className="flex gap-2 items-center text-xs text-slate-500 py-3"><Loader2 className="animate-spin" size={16} /> Cargando datos bancarios...</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center">

                {/* Monto */}
                <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700/80 flex flex-col justify-center items-center">
                  <div className="text-slate-500 uppercase font-bold text-[10px] tracking-wider mb-0.5">Total a Transferir</div>
                  <div className="text-xl font-black text-slate-900 dark:text-white">{formatCurrency(montoTotal, monedaUnica)}</div>
                </div>

                {/* Acciones Voucher */}
                <div className="flex flex-col justify-center gap-2">
                  <button
                    onClick={handleGenerateVoucher}
                    disabled={generatingVoucher}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-3 rounded-xl transition-colors flex justify-center items-center gap-2 text-xs disabled:bg-blue-400 shadow-xs cursor-pointer"
                  >
                    {generatingVoucher ? <Loader2 className="animate-spin" size={16} /> : <FileText size={16} />}
                    Generar Voucher PDF
                  </button>

                  {voucherB64 && (
                    <a
                      href={`data:application/pdf;base64,${voucherB64}`}
                      download="voucher_transferencia.pdf"
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-3 rounded-xl transition-colors flex justify-center items-center gap-1.5 text-center text-xs shadow-xs font-bold"
                    >
                      <Download size={15} />
                      Descargar Voucher
                    </a>
                  )}
                </div>

                {/* Datos Bancarios */}
                <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700/80 text-xs text-slate-600 dark:text-slate-300 space-y-1">
                  <div><strong className="text-slate-800 dark:text-white">Beneficiario:</strong> <span className="font-semibold">{datosBancarios['Razon Social']}</span></div>
                  <div><strong className="text-slate-800 dark:text-white">Banco:</strong> <span className="font-semibold">{datosBancarios['Institucion Financiera']}</span></div>
                  <div><strong className="text-slate-800 dark:text-white">Cuenta:</strong> <span className="font-mono">{datosBancarios[`Numero de Cuenta ${monedaUnica}`] || 'N/A'}</span></div>
                  <div><strong className="text-slate-800 dark:text-white">CCI:</strong> <span className="font-mono">{datosBancarios[`Numero de CCI ${monedaUnica}`] || 'N/A'}</span></div>
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
              <div className="space-y-4">
                {selectedInvoices.map(inv => (
                  <div key={inv.proposal_id} className="flex items-center gap-4 border border-slate-200 dark:border-slate-700 p-4 rounded-lg bg-white dark:bg-slate-800">
                    <div className="flex-1 font-mono text-sm font-bold text-slate-700 dark:text-slate-300">
                      {parseInvoiceNumber(inv.proposal_id)}
                    </div>
                    <div className="w-1/4 text-emerald-600 font-bold text-lg">
                      {formatCurrency(getMontoDesembolso(inv), inv.moneda_factura)}
                    </div>
                    <div className="w-1/4 flex flex-col gap-1 px-2">
                      <label className="text-[10px] uppercase font-bold text-slate-500">Fecha Desembolso</label>
                      <input
                        type="date"
                        value={individualDates[inv.proposal_id] || fechaDesembolso}
                        onChange={e => setIndividualDates(prev => ({ ...prev, [inv.proposal_id]: e.target.value }))}
                        className="w-full text-xs px-2 py-1.5 border border-slate-300 dark:border-slate-700 rounded-md bg-white dark:bg-slate-800 text-slate-800 dark:text-white"
                      />
                    </div>
                    <div className="flex-1 flex justify-end">
                      <label className="cursor-pointer flex items-center justify-center gap-2 w-full border-2 border-dashed border-slate-300 dark:border-slate-600 hover:border-indigo-500 dark:hover:border-indigo-400 rounded-md p-2 bg-slate-50 dark:bg-slate-900 transition-colors">
                        <Upload size={18} className="text-indigo-500" />
                        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                          {individualFiles[inv.proposal_id]
                            ? individualFiles[inv.proposal_id].name
                            : 'Subir Voucher Indiv.'}
                        </span>
                        <input
                          type="file"
                          accept=".pdf, .png, .jpg, .jpeg"
                          className="hidden"
                          onChange={e => {
                            const f = e.target.files?.[0];
                            if (f) setIndividualFiles(prev => ({ ...prev, [inv.proposal_id]: f }));
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
          <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-4 shadow-sm">
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
              {successMsg ? (
                <div className="bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 p-4 rounded-xl flex items-center justify-center gap-2 font-bold text-xs">
                  <CheckCircle2 size={18} />
                  {successMsg}
                </div>
              ) : (
                <button
                  onClick={handleRegisterDesembolso}
                  disabled={registering || !selectedFolder}
                  className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  {registering ? <Loader2 className="animate-spin h-4 w-4" /> : <Send size={16} />}
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
