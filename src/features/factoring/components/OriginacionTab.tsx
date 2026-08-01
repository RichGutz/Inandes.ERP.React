import React, { useState, useEffect } from 'react';
import { 
  Trash2, 
  Calculator, 
  Send, 
  AlertCircle, 
  CheckCircle2, 
  RefreshCw, 
  UploadCloud, 
  FileText
} from 'lucide-react';
import { format, addDays, differenceInDays } from 'date-fns';
import { supabase } from '../../../services/supabaseClient';

const fmt = (n: number, dec = 2) =>
  n.toLocaleString('es-PE', { minimumFractionDigits: dec, maximumFractionDigits: dec });

const today = () => format(new Date(), 'yyyy-MM-dd');
const defaultDueDate = () => format(addDays(new Date(), 30), 'yyyy-MM-dd');

export interface InvoiceEntry {
  id: string;
  group_id: number;
  parsed_pdf_name: string;
  numero_factura: string;
  emisor_ruc: string;
  emisor_nombre: string;
  aceptante_ruc: string;
  aceptante_nombre: string;
  monto_total_factura: number;
  monto_neto_factura: number;
  moneda_factura: 'PEN' | 'USD';
  detraccion_porcentaje: number;
  fecha_emision_factura: string;
  fecha_desembolso_factoring: string;
  fecha_pago_calculada: string;
  plazo_operacion_calculado: number;
  dias_minimos_interes_individual: number;
  tasa_de_avance: number;
  interes_mensual: number;
  interes_moratorio: number;
  comision_afiliacion_pen: number;
  comision_afiliacion_usd: number;
}

export const OriginacionTab: React.FC = () => {
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loadingStep, setLoadingStep] = useState<boolean>(false);

  // =========================================================================
  // SECCIÓN 1: CARGA DE FACTURAS POR GRUPOS (BUCKETS)
  // =========================================================================
  const [numGrupos, setNumGrupos] = useState<number>(1);
  const [bucketDates, setBucketDates] = useState<Record<number, string>>({
    1: defaultDueDate(), 2: defaultDueDate(), 3: defaultDueDate(), 4: defaultDueDate(),
    5: defaultDueDate(), 6: defaultDueDate(), 7: defaultDueDate(), 8: defaultDueDate()
  });
  const [bucketsFiles, setBucketsFiles] = useState<Record<number, File[]>>({
    1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [], 8: []
  });

  // =========================================================================
  // SECCIÓN 2: CONFIGURACIÓN GLOBAL
  // =========================================================================
  const [aplicarComisionEstructuracion, setAplicarComisionEstructuracion] = useState(true);
  const [comisionEstructuracionPct, setComisionEstructuracionPct] = useState(0.5);
  const [comisionEstructuracionMinPen, setComisionEstructuracionMinPen] = useState(150.0);
  const [comisionEstructuracionMinUsd, setComisionEstructuracionMinUsd] = useState(50.0);

  const [aplicarComisionAfiliacion, setAplicarComisionAfiliacion] = useState(false);
  const [comisionAfiliacionPen, setComisionAfiliacionPen] = useState(0.0);
  const [comisionAfiliacionUsd, setComisionAfiliacionUsd] = useState(0.0);

  const [aplicarFechaDesembolsoGlobal, setAplicarFechaDesembolsoGlobal] = useState(false);
  const [fechaDesembolsoGlobal, setFechaDesembolsoGlobal] = useState(today());

  const [aplicarDiasInteresMinimoGlobal, setAplicarDiasInteresMinimoGlobal] = useState(false);
  const [diasInteresMinimoGlobal, setDiasInteresMinimoGlobal] = useState(15);

  const [aplicarTasaAvanceGlobal, setAplicarTasaAvanceGlobal] = useState(false);
  const [tasaAvanceGlobal, setTasaAvanceGlobal] = useState(90.0);

  const [aplicarInteresMensualGlobal, setAplicarInteresMensualGlobal] = useState(false);
  const [interesMensualGlobal, setInteresMensualGlobal] = useState(2.5);

  const [aplicarInteresMoratorioGlobal, setAplicarInteresMoratorioGlobal] = useState(false);
  const [interesMoratorioGlobal, setInteresMoratorioGlobal] = useState(2.5);

  // =========================================================================
  // SECCIÓN 3: DETALLE DE FACTURAS PARSEADAS
  // =========================================================================
  const [invoices, setInvoices] = useState<InvoiceEntry[]>([]);

  // =========================================================================
  // SECCIÓN 4: RESULTADOS, SIMULACIÓN Y FORMALIZACIÓN
  // =========================================================================
  const [simulacionResult, setSimulacionResult] = useState<any | null>(null);
  const [folderId, setFolderId] = useState('');
  const [contractNumber, setContractNumber] = useState('');
  const [anexoNumber, setAnexoNumber] = useState('');
  const [formalizing, setFormalizing] = useState(false);
  const [successId, setSuccessId] = useState<string | null>(null);

  // --- Handlers de Archivos ---
  const handleNativeFileSelect = (bucketId: number, e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files).filter(f => f.type === 'application/pdf');
      if (newFiles.length === 0) {
        setErrorMsg("Solo se permiten archivos PDF.");
        return;
      }
      setBucketsFiles(prev => ({
        ...prev,
        [bucketId]: [...(prev[bucketId] || []), ...newFiles]
      }));
      setErrorMsg(null);
    }
  };

  const handleDrop = (bucketId: number, e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const newFiles = Array.from(e.dataTransfer.files).filter(f => f.type === 'application/pdf');
      if (newFiles.length === 0) {
        setErrorMsg("Solo se permiten archivos PDF.");
        return;
      }
      setBucketsFiles(prev => ({
        ...prev,
        [bucketId]: [...(prev[bucketId] || []), ...newFiles]
      }));
      setErrorMsg(null);
    }
  };

  const removeFile = (bucketId: number, fileIdx: number) => {
    setBucketsFiles(prev => {
      const updated = [...(prev[bucketId] || [])];
      updated.splice(fileIdx, 1);
      return { ...prev, [bucketId]: updated };
    });
  };

  const getTotalFiles = () => {
    let total = 0;
    for (let i = 1; i <= numGrupos; i++) {
      total += (bucketsFiles[i] || []).length;
    }
    return total;
  };

  // --- Parsear Facturas (Sección 1 -> Sección 2 & 3) ---
  const handleParseBatch = async () => {
    if (getTotalFiles() === 0) {
      setErrorMsg("Debes seleccionar o arrastrar al menos una factura (PDF) en algún Grupo.");
      return;
    }

    setLoadingStep(true);
    setErrorMsg(null);

    try {
      const formData = new FormData();
      for (let bId = 1; bId <= numGrupos; bId++) {
        (bucketsFiles[bId] || []).forEach(file => {
          const newFile = new File([file], `[G${bId}]_${file.name}`, { type: file.type });
          formData.append('files', newFile);
        });
      }

      const API_BASE = import.meta.env.VITE_API_FACTORING_URL || 'https://inandes.react.geeksoft.tech';
      const res = await fetch(`${API_BASE}/api/originacion/parse-invoices`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Error en el servidor al parsear PDFs (${res.status}): ${errText}`);
      }

      const data = await res.json();

      const parsedInvoices: InvoiceEntry[] = await Promise.all((data.results || []).map(async (r: any, idx: number) => {
        const p = r.parsed_data || {};
        const match = r.filename ? r.filename.match(/^\[G(\d+)\]_/) : null;
        const bId = match ? parseInt(match[1]) : 1;
        const fechaPagoGrupo = bucketDates[bId] || defaultDueDate();

        // Buscar razón social y tasas en Supabase por RUC Emisor
        let emisorNombre = r.emisor_nombre || p.emisor_nombre || '';
        let aceptanteNombre = r.aceptante_nombre || p.aceptante_nombre || '';
        let dbRates: any = r.db_rates || {};

        if (p.emisor_ruc) {
          try {
            const { data: dbEmisor } = await supabase
              .from('EMISORES.ACEPTANTES')
              .select('*')
              .eq('RUC', String(p.emisor_ruc).trim())
              .maybeSingle();
            if (dbEmisor) {
              if (dbEmisor.RAZON_SOCIAL) emisorNombre = dbEmisor.RAZON_SOCIAL;
              dbRates = dbEmisor;
            }
          } catch (e) {
            console.warn("No se encontraron datos para RUC Emisor:", p.emisor_ruc);
          }
        }

        if (p.aceptante_ruc) {
          try {
            const { data: dbAceptante } = await supabase
              .from('EMISORES.ACEPTANTES')
              .select('RAZON_SOCIAL')
              .eq('RUC', String(p.aceptante_ruc).trim())
              .maybeSingle();
            if (dbAceptante && dbAceptante.RAZON_SOCIAL) {
              aceptanteNombre = dbAceptante.RAZON_SOCIAL;
            }
          } catch (e) {
            console.warn("No se encontraron datos para RUC Aceptante:", p.aceptante_ruc);
          }
        }

        const montoTotal = Number(p.monto_total || 0);
        const montoNeto = Number(p.monto_neto || montoTotal);
        const detraccionPct = montoTotal > 0 ? ((montoTotal - montoNeto) / montoTotal) * 100 : 0;

        const dDesembolso = new Date(fechaDesembolsoGlobal);
        const dPago = new Date(fechaPagoGrupo);
        const plazoDias = Math.max(0, differenceInDays(dPago, dDesembolso));

        return {
          id: `inv_${idx}_${Date.now()}`,
          group_id: bId,
          parsed_pdf_name: (r.filename || '').replace(/^\[G\d+\]_/, ''),
          numero_factura: p.invoice_id || `F001-${idx + 1}`,
          emisor_ruc: p.emisor_ruc || '',
          emisor_nombre: emisorNombre || 'EMISOR S.A.C.',
          aceptante_ruc: p.aceptante_ruc || '',
          aceptante_nombre: aceptanteNombre || 'ACEPTANTE S.A.A.',
          monto_total_factura: montoTotal,
          monto_neto_factura: montoNeto,
          moneda_factura: (p.moneda === 'USD' ? 'USD' : 'PEN') as 'PEN' | 'USD',
          detraccion_porcentaje: detraccionPct,
          fecha_emision_factura: p.fecha_emision || today(),
          fecha_desembolso_factoring: fechaDesembolsoGlobal,
          fecha_pago_calculada: fechaPagoGrupo,
          plazo_operacion_calculado: plazoDias,
          dias_minimos_interes_individual: Number(dbRates.dias_minimos_interes || 15),
          tasa_de_avance: Number(dbRates.tasa_avance || 90),
          interes_mensual: Number(dbRates.interes_mensual_pen || 2.5),
          interes_moratorio: Number(dbRates.interes_moratorio_pen || 2.5),
          comision_afiliacion_pen: Number(dbRates.comision_afiliacion_pen || 0),
          comision_afiliacion_usd: Number(dbRates.comision_afiliacion_usd || 0),
        };
      }));

      setInvoices(parsedInvoices);
    } catch (err: any) {
      setErrorMsg(err.message || "Fallo en la comunicación con el servidor.");
    } finally {
      setLoadingStep(false);
    }
  };

  // --- Propagación de Configuración Global ---
  useEffect(() => {
    if (invoices.length === 0) return;
    setInvoices(prev => prev.map(inv => {
      const updated = { ...inv };
      if (aplicarFechaDesembolsoGlobal) {
        updated.fecha_desembolso_factoring = fechaDesembolsoGlobal;
        const dDes = new Date(fechaDesembolsoGlobal);
        const dPag = new Date(updated.fecha_pago_calculada);
        updated.plazo_operacion_calculado = Math.max(0, differenceInDays(dPag, dDes));
      }
      if (aplicarDiasInteresMinimoGlobal) {
        updated.dias_minimos_interes_individual = diasInteresMinimoGlobal;
      }
      if (aplicarTasaAvanceGlobal) {
        updated.tasa_de_avance = tasaAvanceGlobal;
      }
      if (aplicarInteresMensualGlobal) {
        updated.interes_mensual = interesMensualGlobal;
      }
      if (aplicarInteresMoratorioGlobal) {
        updated.interes_moratorio = interesMoratorioGlobal;
      }
      return updated;
    }));
  }, [
    aplicarFechaDesembolsoGlobal, fechaDesembolsoGlobal,
    aplicarDiasInteresMinimoGlobal, diasInteresMinimoGlobal,
    aplicarTasaAvanceGlobal, tasaAvanceGlobal,
    aplicarInteresMensualGlobal, interesMensualGlobal,
    aplicarInteresMoratorioGlobal, interesMoratorioGlobal
  ]);

  // --- Actualizar campo individual ---
  const updateInvoiceField = (id: string, field: keyof InvoiceEntry, val: any) => {
    setInvoices(prev => prev.map(inv => {
      if (inv.id !== id) return inv;
      const updated = { ...inv, [field]: val };

      if (field === 'fecha_desembolso_factoring' || field === 'fecha_pago_calculada') {
        const dDes = new Date(updated.fecha_desembolso_factoring);
        const dPag = new Date(updated.fecha_pago_calculada);
        updated.plazo_operacion_calculado = Math.max(0, differenceInDays(dPag, dDes));
      }

      if (field === 'monto_total_factura' || field === 'monto_neto_factura') {
        if (updated.monto_total_factura > 0) {
          updated.detraccion_porcentaje = ((updated.monto_total_factura - updated.monto_neto_factura) / updated.monto_total_factura) * 100;
        }
      }

      return updated;
    }));
  };

  // --- Simulación Financiera (Sección 4) ---
  const handleSimulate = async () => {
    if (invoices.length === 0) return;
    setLoadingStep(true);
    setErrorMsg(null);

    try {
      const payload = invoices.map(inv => ({
        mfn: inv.monto_neto_factura,
        monto_objetivo: inv.monto_neto_factura,
        tasa_avance: inv.tasa_de_avance / 100,
        interes_mensual: inv.interes_mensual / 100,
        plazo_operacion: Math.max(inv.plazo_operacion_calculado, inv.dias_minimos_interes_individual),
        igv_pct: 0.18,
        comision_estructuracion_pct: aplicarComisionEstructuracion ? comisionEstructuracionPct / 100 : 0,
        comision_minima_aplicable: aplicarComisionEstructuracion ? (inv.moneda_factura === 'PEN' ? comisionEstructuracionMinPen : comisionEstructuracionMinUsd) : 0,
        aplicar_comision_afiliacion: aplicarComisionAfiliacion,
        comision_afiliacion_aplicable: aplicarComisionAfiliacion ? (inv.moneda_factura === 'PEN' ? comisionAfiliacionPen : comisionAfiliacionUsd) : 0
      }));

      const API_BASE = import.meta.env.VITE_API_FACTORING_URL || 'https://inandes.react.geeksoft.tech';
      const res = await fetch(`${API_BASE}/calcular_desembolso_lote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error("Error al calcular el desembolso en el servidor.");
      const calcData = await res.json();
      setSimulacionResult(calcData);
    } catch (err: any) {
      setErrorMsg(err.message || "Error al simular la operación.");
    } finally {
      setLoadingStep(false);
    }
  };

  // --- Formalización (Sección 4) ---
  const handleConfirmFormalize = async () => {
    if (invoices.length === 0 || !simulacionResult) return;
    setFormalizing(true);
    try {
      const firstInv = invoices[0];
      const resCalc = simulacionResult.resultados_por_factura || [];

      const montoBrutoTotal = invoices.reduce((sum, i) => sum + i.monto_total_factura, 0);
      const montoNetoTotal = invoices.reduce((sum, i) => sum + i.monto_neto_factura, 0);
      const interesTotal = resCalc.reduce((sum: number, r: any) => sum + (r.interes || 0), 0);
      const abonoRealTotal = resCalc.reduce((sum: number, r: any) => sum + (r.abono_real_teorico || 0), 0);
      const comisionesFijas = resCalc.reduce((sum: number, r: any) => sum + (r.comision_estructuracion || 0), 0);
      const diasPromedio = Math.round(invoices.reduce((sum, i) => sum + i.plazo_operacion_calculado, 0) / invoices.length);

      const proposalId = `FACT-${format(new Date(), 'yyMMdd')}-${Math.floor(1000 + Math.random() * 9000)}`;
      const { error: opErr } = await supabase
        .from('factoring_operaciones')
        .insert({
          proposal_id: proposalId,
          emisor_ruc: firstInv.emisor_ruc,
          emisor_nombre: firstInv.emisor_nombre,
          aceptante_ruc: firstInv.aceptante_ruc,
          aceptante_nombre: firstInv.aceptante_nombre,
          moneda: firstInv.moneda_factura,
          monto_bruto_total: montoBrutoTotal,
          monto_neto_total: montoNetoTotal,
          interes_total: interesTotal,
          abono_real_total: abonoRealTotal,
          comisiones_fijas: comisionesFijas,
          dias_promedio: diasPromedio,
          estado: 'ORIGINADO',
          fecha_desembolso_esperada: fechaDesembolsoGlobal,
          meta_drive_folder_id: folderId,
          meta_contract_number: contractNumber,
          meta_anexo_number: anexoNumber
        });

      if (opErr) throw opErr;

      setSuccessId(proposalId);
    } catch (err: any) {
      alert(`Error al formalizar: ${err.message}`);
    } finally {
      setFormalizing(false);
    }
  };

  // Active groups for rendering Section 3
  const activeGroups = Array.from({ length: numGrupos }, (_, i) => i + 1);

  return (
    <div className="space-y-8 animate-fadeIn pb-12 bg-slate-50/30 dark:bg-slate-950/30 p-2 md:p-6 rounded-3xl">
      {/* Alerta de Error Global */}
      {errorMsg && (
        <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-xl flex items-center gap-3 text-red-700 dark:text-red-400 text-xs font-medium">
          <AlertCircle size={18} className="shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Éxito de Formalización */}
      {successId && (
        <div className="p-8 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 rounded-3xl text-center space-y-4 shadow-lg">
          <div className="h-16 w-16 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 flex items-center justify-center mx-auto">
            <CheckCircle2 size={36} />
          </div>
          <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">¡Operación Originada con Éxito!</h3>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Propuesta Generada: <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950 px-3 py-1 rounded-lg">{successId}</span>
          </p>
          <button
            onClick={() => {
              setInvoices([]);
              setSimulacionResult(null);
              setSuccessId(null);
              setBucketsFiles({ 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [], 8: [] });
            }}
            className="px-6 py-3 text-xs font-black uppercase tracking-wider bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-md transition-colors"
          >
            Nueva Operación
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. CARGA DE FACTURAS (STREAMLIT PARITY)                                  */}
      {/* ========================================================================= */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
          1. Carga de Facturas
        </h3>

        {/* Selector Número de Grupos */}
        <div className="space-y-1 max-w-xs">
          <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Número de Grupos</label>
          <select
            value={numGrupos}
            onChange={(e) => setNumGrupos(Number(e.target.value))}
            className="w-full p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200"
          >
            {[1, 2, 3, 4, 5, 6, 7, 8].map(num => (
              <option key={num} value={num}>{num}</option>
            ))}
          </select>
        </div>

        {/* Tarjetas de Grupos / Buckets */}
        <div className="space-y-6">
          {activeGroups.map((bId) => (
            <div key={bId} className="bg-slate-50/70 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
              <span className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide block border-b border-slate-200 dark:border-slate-800 pb-2">
                GRUPO {bId}
              </span>

              {/* Campo Fecha de Pago */}
              <div className="space-y-1 max-w-xs">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Fecha de Pago</label>
                <input
                  type="date"
                  value={bucketDates[bId] || defaultDueDate()}
                  onChange={(e) => setBucketDates(prev => ({ ...prev, [bId]: e.target.value }))}
                  className="w-full p-2.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-800 dark:text-slate-200 font-bold"
                />
              </div>

              {/* Botón Browse Files Nativo de Windows + Drag and Drop */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleDrop(bId, e)}
                className="border-2 border-dashed border-slate-300 dark:border-slate-800 rounded-xl p-6 text-center bg-white dark:bg-slate-900 space-y-3"
              >
                <UploadCloud className="h-8 w-8 text-slate-400 mx-auto" />
                <p className="text-xs text-slate-500 font-medium">Drag and drop files here</p>

                <label className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl cursor-pointer transition-colors border border-slate-200 dark:border-slate-700 shadow-xs">
                  <span>Browse files</span>
                  <input
                    type="file"
                    multiple
                    accept=".pdf"
                    onChange={(e) => handleNativeFileSelect(bId, e)}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Lista de Archivos Subidos */}
              {(bucketsFiles[bId] || []).length > 0 && (
                <div className="space-y-1.5 pt-2">
                  <span className="text-[11px] font-bold text-slate-500 uppercase">Archivos subidos (Grupo {bId}):</span>
                  {bucketsFiles[bId].map((f, fIdx) => (
                    <div key={fIdx} className="flex items-center justify-between p-2.5 bg-white dark:bg-slate-900 rounded-xl text-xs border border-slate-200 dark:border-slate-800 shadow-xs">
                      <span className="truncate max-w-[280px] font-mono text-slate-700 dark:text-slate-300" title={f.name}>
                        {f.name}
                      </span>
                      <button
                        onClick={() => removeFile(bId, fIdx)}
                        className="text-slate-400 hover:text-red-500 p-1"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Botón Rojo Ancho PROCESAR TODO EL LOTE */}
        <button
          onClick={handleParseBatch}
          disabled={loadingStep || getTotalFiles() === 0}
          className="w-full py-3.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md flex items-center justify-center gap-2 transition-colors cursor-pointer"
        >
          {loadingStep ? <RefreshCw className="animate-spin h-4 w-4" /> : <FileText size={16} />}
          PROCESAR TODO EL LOTE ({getTotalFiles()} archivos)
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 2. CONFIGURACIÓN GLOBAL (STREAMLIT PARITY)                                */}
      {/* ========================================================================= */}
      {invoices.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
            2. Configuración Global
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 text-xs">
            {/* Columna 1: Com. de Estructuración */}
            <div className="space-y-3 bg-slate-50/70 dark:bg-slate-950/60 p-4 border border-slate-200 dark:border-slate-800 rounded-2xl">
              <span className="font-bold text-slate-800 dark:text-slate-200 block border-b border-slate-200 dark:border-slate-800 pb-2">
                Com. de Estructuración
              </span>
              <label className="flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={aplicarComisionEstructuracion}
                  onChange={(e) => setAplicarComisionEstructuracion(e.target.checked)}
                  className="rounded text-red-600 focus:ring-red-500"
                />
                Aplicar Comisión de Estructuración
              </label>

              <div className="space-y-2 pt-1">
                <div>
                  <span className="text-[11px] text-slate-500 block mb-1">Comisión de Estructuración (%)</span>
                  <input
                    type="number"
                    step="0.1"
                    value={comisionEstructuracionPct}
                    onChange={(e) => setComisionEstructuracionPct(Number(e.target.value))}
                    disabled={!aplicarComisionEstructuracion}
                    className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold"
                  />
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 block mb-1">Comisión Mínima (PEN)</span>
                  <input
                    type="number"
                    value={comisionEstructuracionMinPen}
                    onChange={(e) => setComisionEstructuracionMinPen(Number(e.target.value))}
                    disabled={!aplicarComisionEstructuracion}
                    className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 block mb-1">Comisión Mínima (USD)</span>
                  <input
                    type="number"
                    value={comisionEstructuracionMinUsd}
                    onChange={(e) => setComisionEstructuracionMinUsd(Number(e.target.value))}
                    disabled={!aplicarComisionEstructuracion}
                    className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Columna 2: Com. de Afiliación */}
            <div className="space-y-3 bg-slate-50/70 dark:bg-slate-950/60 p-4 border border-slate-200 dark:border-slate-800 rounded-2xl">
              <span className="font-bold text-slate-800 dark:text-slate-200 block border-b border-slate-200 dark:border-slate-800 pb-2">
                Com. de Afiliación
              </span>
              <label className="flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={aplicarComisionAfiliacion}
                  onChange={(e) => setAplicarComisionAfiliacion(e.target.checked)}
                  className="rounded text-red-600 focus:ring-red-500"
                />
                Aplicar Comisión de Afiliación
              </label>

              <div className="space-y-2 pt-1">
                <div>
                  <span className="text-[11px] text-slate-500 block mb-1">Monto Comisión Afiliación (PEN)</span>
                  <input
                    type="number"
                    value={comisionAfiliacionPen}
                    onChange={(e) => setComisionAfiliacionPen(Number(e.target.value))}
                    disabled={!aplicarComisionAfiliacion}
                    className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 block mb-1">Monto Comisión Afiliación (USD)</span>
                  <input
                    type="number"
                    value={comisionAfiliacionUsd}
                    onChange={(e) => setComisionAfiliacionUsd(Number(e.target.value))}
                    disabled={!aplicarComisionAfiliacion}
                    className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Columna 3: Fechas y Días */}
            <div className="space-y-3 bg-slate-50/70 dark:bg-slate-950/60 p-4 border border-slate-200 dark:border-slate-800 rounded-2xl">
              <span className="font-bold text-slate-800 dark:text-slate-200 block border-b border-slate-200 dark:border-slate-800 pb-2">
                Fechas y Días
              </span>
              <label className="flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={aplicarFechaDesembolsoGlobal}
                  onChange={(e) => setAplicarFechaDesembolsoGlobal(e.target.checked)}
                  className="rounded text-red-600 focus:ring-red-500"
                />
                Aplicar Fecha Desembolso Global
              </label>
              <input
                type="date"
                value={fechaDesembolsoGlobal}
                onChange={(e) => setFechaDesembolsoGlobal(e.target.value)}
                disabled={!aplicarFechaDesembolsoGlobal}
                className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs"
              />

              <label className="flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-300 pt-2">
                <input
                  type="checkbox"
                  checked={aplicarDiasInteresMinimoGlobal}
                  onChange={(e) => setAplicarDiasInteresMinimoGlobal(e.target.checked)}
                  className="rounded text-red-600 focus:ring-red-500"
                />
                Aplicar Días Interés Mínimo
              </label>
              <input
                type="number"
                value={diasInteresMinimoGlobal}
                onChange={(e) => setDiasInteresMinimoGlobal(Number(e.target.value))}
                disabled={!aplicarDiasInteresMinimoGlobal}
                className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs"
              />
            </div>

            {/* Columna 4: Tasas Globales */}
            <div className="space-y-3 bg-slate-50/70 dark:bg-slate-950/60 p-4 border border-slate-200 dark:border-slate-800 rounded-2xl">
              <span className="font-bold text-slate-800 dark:text-slate-200 block border-b border-slate-200 dark:border-slate-800 pb-2">
                Tasas Globales
              </span>
              <label className="flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={aplicarTasaAvanceGlobal}
                  onChange={(e) => setAplicarTasaAvanceGlobal(e.target.checked)}
                  className="rounded text-red-600 focus:ring-red-500"
                />
                Aplicar Tasa de Avance Global
              </label>
              <input
                type="number"
                step="0.5"
                value={tasaAvanceGlobal}
                onChange={(e) => setTasaAvanceGlobal(Number(e.target.value))}
                disabled={!aplicarTasaAvanceGlobal}
                className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs"
              />

              <label className="flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-300 pt-1">
                <input
                  type="checkbox"
                  checked={aplicarInteresMensualGlobal}
                  onChange={(e) => setAplicarInteresMensualGlobal(e.target.checked)}
                  className="rounded text-red-600 focus:ring-red-500"
                />
                Aplicar Interés Mensual Global
              </label>
              <input
                type="number"
                step="0.1"
                value={interesMensualGlobal}
                onChange={(e) => setInteresMensualGlobal(Number(e.target.value))}
                disabled={!aplicarInteresMensualGlobal}
                className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs"
              />

              <label className="flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-300 pt-1">
                <input
                  type="checkbox"
                  checked={aplicarInteresMoratorioGlobal}
                  onChange={(e) => setAplicarInteresMoratorioGlobal(e.target.checked)}
                  className="rounded text-red-600 focus:ring-red-500"
                />
                Aplicar Interés Moratorio Global
              </label>
              <input
                type="number"
                step="0.1"
                value={interesMoratorioGlobal}
                onChange={(e) => setInteresMoratorioGlobal(Number(e.target.value))}
                disabled={!aplicarInteresMoratorioGlobal}
                className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs"
              />
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. DETALLE DE FACTURAS (STREAMLIT PARITY AGRUPADO POR GRUPO)             */}
      {/* ========================================================================= */}
      {invoices.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
            3. Detalle de Facturas
          </h3>

          <div className="space-y-6">
            {activeGroups.map(grpId => {
              const groupInvoices = invoices.filter(inv => inv.group_id === grpId);
              if (groupInvoices.length === 0) return null;

              return (
                <div key={grpId} className="space-y-4">
                  <div className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
                    📁 <b>GRUPO {grpId}</b>
                  </div>

                  {groupInvoices.map((inv, idx) => (
                    <div key={inv.id} className="p-5 bg-slate-50/70 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-4">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block border-b border-slate-200 dark:border-slate-800/80 pb-2">
                        Factura {idx + 1}: <code className="text-red-600 bg-red-50 dark:bg-red-950/50 px-2 py-0.5 rounded font-mono">{inv.parsed_pdf_name}</code>
                      </span>

                      {/* Sub-fila 1: Involucrados */}
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Involucrados</span>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
                          <div>
                            <span className="text-[10px] text-slate-500 uppercase block mb-1">Nombre del Emisor</span>
                            <input
                              type="text"
                              value={inv.emisor_nombre}
                              onChange={(e) => updateInvoiceField(inv.id, 'emisor_nombre', e.target.value)}
                              className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium"
                            />
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-500 uppercase block mb-1">RUC del Emisor</span>
                            <input
                              type="text"
                              value={inv.emisor_ruc}
                              onChange={(e) => updateInvoiceField(inv.id, 'emisor_ruc', e.target.value)}
                              className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono font-bold text-red-600"
                            />
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-500 uppercase block mb-1">Nombre del Aceptante</span>
                            <input
                              type="text"
                              value={inv.aceptante_nombre}
                              onChange={(e) => updateInvoiceField(inv.id, 'aceptante_nombre', e.target.value)}
                              className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium"
                            />
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-500 uppercase block mb-1">RUC del Aceptante</span>
                            <input
                              type="text"
                              value={inv.aceptante_ruc}
                              onChange={(e) => updateInvoiceField(inv.id, 'aceptante_ruc', e.target.value)}
                              className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono font-bold"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Sub-fila 2: Montos y Moneda */}
                      <div className="space-y-1 pt-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Montos y Moneda</span>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
                          <div>
                            <span className="text-[10px] text-slate-500 uppercase block mb-1">Número de Factura</span>
                            <input
                              type="text"
                              value={inv.numero_factura}
                              onChange={(e) => updateInvoiceField(inv.id, 'numero_factura', e.target.value)}
                              className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono font-bold"
                            />
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-500 uppercase block mb-1">Monto Total (con IGV)</span>
                            <input
                              type="number"
                              value={inv.monto_total_factura}
                              onChange={(e) => updateInvoiceField(inv.id, 'monto_total_factura', Number(e.target.value))}
                              className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold"
                            />
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-500 uppercase block mb-1">Monto Neto</span>
                            <input
                              type="number"
                              value={inv.monto_neto_factura}
                              onChange={(e) => updateInvoiceField(inv.id, 'monto_neto_factura', Number(e.target.value))}
                              className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-emerald-600"
                            />
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-500 uppercase block mb-1">Moneda</span>
                            <select
                              value={inv.moneda_factura}
                              onChange={(e) => updateInvoiceField(inv.id, 'moneda_factura', e.target.value)}
                              className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold"
                            >
                              <option value="PEN">PEN</option>
                              <option value="USD">USD</option>
                            </select>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-500 uppercase block mb-1">Detracción (%)</span>
                            <input
                              type="text"
                              disabled
                              value={`${inv.detraccion_porcentaje.toFixed(2)}%`}
                              className="w-full p-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-500"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Sub-fila 3: Fechas y Plazos (Pre-cargado desde Bucket) */}
                      <div className="space-y-1 pt-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Fechas y Plazos (Pre-cargado desde Bucket)</span>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
                          <div>
                            <span className="text-[10px] text-slate-500 uppercase block mb-1">Fecha Emisión</span>
                            <input
                              type="date"
                              value={inv.fecha_emision_factura}
                              onChange={(e) => updateInvoiceField(inv.id, 'fecha_emision_factura', e.target.value)}
                              className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs"
                            />
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-500 uppercase block mb-1">Fecha Desembolso</span>
                            <input
                              type="date"
                              value={inv.fecha_desembolso_factoring}
                              onChange={(e) => updateInvoiceField(inv.id, 'fecha_desembolso_factoring', e.target.value)}
                              className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold"
                            />
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-500 uppercase block mb-1">Fecha Pago</span>
                            <input
                              type="date"
                              value={inv.fecha_pago_calculada}
                              onChange={(e) => updateInvoiceField(inv.id, 'fecha_pago_calculada', e.target.value)}
                              className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-red-600"
                            />
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-500 uppercase block mb-1">Plazo (días)</span>
                            <input
                              type="text"
                              disabled
                              value={inv.plazo_operacion_calculado}
                              className="w-full p-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white"
                            />
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-500 uppercase block mb-1">Días Mínimos</span>
                            <input
                              type="number"
                              value={inv.dias_minimos_interes_individual}
                              onChange={(e) => updateInvoiceField(inv.id, 'dias_minimos_interes_individual', Number(e.target.value))}
                              className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Sub-fila 4: Tasas y Comisiones */}
                      <div className="space-y-1 pt-1 border-t border-slate-200 dark:border-slate-800/80">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Tasas y Comisiones</span>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                          <div>
                            <span className="text-[10px] text-slate-500 uppercase block mb-1">Tasa de Avance (%)</span>
                            <input
                              type="number"
                              step="0.5"
                              value={inv.tasa_de_avance}
                              onChange={(e) => updateInvoiceField(inv.id, 'tasa_de_avance', Number(e.target.value))}
                              className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200"
                            />
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-500 uppercase block mb-1">Interés Mensual (%)</span>
                            <input
                              type="number"
                              step="0.1"
                              value={inv.interes_mensual}
                              onChange={(e) => updateInvoiceField(inv.id, 'interes_mensual', Number(e.target.value))}
                              className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-amber-600"
                            />
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-500 uppercase block mb-1">Interés Moratorio (%)</span>
                            <input
                              type="number"
                              step="0.1"
                              value={inv.interes_moratorio}
                              onChange={(e) => updateInvoiceField(inv.id, 'interes_moratorio', Number(e.target.value))}
                              className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. RESULTADOS, SIMULACIÓN Y FORMALIZACIÓN (STREAMLIT PARITY)              */}
      {/* ========================================================================= */}
      {invoices.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
            4. Resultados, Simulación y Formalización
          </h3>

          {/* Botón Rojo Ancho CALCULAR DESEMBOLSO */}
          <button
            onClick={handleSimulate}
            disabled={loadingStep}
            className="w-full py-3.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            {loadingStep ? <RefreshCw className="animate-spin h-4 w-4" /> : <Calculator size={16} />}
            CALCULAR DESEMBOLSO
          </button>

          {/* Resumen Financiero post-simulación */}
          {simulacionResult && (
            <div className="space-y-6 pt-4 border-t border-slate-200 dark:border-slate-800">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <span className="text-slate-500 font-semibold block mb-1">Monto Neto Total</span>
                  <span className="text-lg font-black text-slate-900 dark:text-white">
                    S/ {fmt(invoices.reduce((s, i) => s + i.monto_neto_factura, 0))}
                  </span>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <span className="text-slate-500 font-semibold block mb-1">Interés Total + IGV</span>
                  <span className="text-lg font-black text-amber-600 dark:text-amber-400">
                    S/ {fmt((simulacionResult.resultados_por_factura || []).reduce((s: number, r: any) => s + (r.interes || 0) + (r.igv_interes || 0), 0))}
                  </span>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <span className="text-slate-500 font-semibold block mb-1">Comisión Estructuración</span>
                  <span className="text-lg font-black text-slate-700 dark:text-slate-300">
                    S/ {fmt((simulacionResult.resultados_por_factura || []).reduce((s: number, r: any) => s + (r.comision_estructuracion || 0), 0))}
                  </span>
                </div>

                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/50 rounded-2xl border border-emerald-200 dark:border-emerald-900/60">
                  <span className="text-emerald-700 dark:text-emerald-400 font-bold block mb-1">Abono Real a Cedente</span>
                  <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                    S/ {fmt((simulacionResult.resultados_por_factura || []).reduce((s: number, r: any) => s + (r.abono_real_teorico || 0), 0))}
                  </span>
                </div>
              </div>

              {/* Formulario de Formalización */}
              <div className="p-5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-4">
                <span className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide flex items-center gap-2">
                  <Send size={14} className="text-red-600" />
                  Metadatos de Formalización y Google Drive
                </span>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">ID Carpeta Google Drive</label>
                    <input
                      type="text"
                      placeholder="Ej: 1A2b3C4d5E..."
                      value={folderId}
                      onChange={(e) => setFolderId(e.target.value)}
                      className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl font-mono text-xs"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">N° de Contrato Marco</label>
                    <input
                      type="text"
                      placeholder="Ej: CTR-2026-001"
                      value={contractNumber}
                      onChange={(e) => setContractNumber(e.target.value)}
                      className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">N° de Anexo de Liquidación</label>
                    <input
                      type="text"
                      placeholder="Ej: ANX-2026-088"
                      value={anexoNumber}
                      onChange={(e) => setAnexoNumber(e.target.value)}
                      className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={handleConfirmFormalize}
                    disabled={formalizing}
                    className="px-8 py-3 bg-red-600 hover:bg-red-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    {formalizing && <RefreshCw className="animate-spin h-4 w-4" />}
                    FORMALIZAR OPERACIÓN
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
