import React, { useState, useEffect } from 'react';
import { 
  Trash2, 
  Calculator, 
  Send, 
  AlertCircle, 
  CheckCircle2, 
  RefreshCw, 
  UploadCloud, 
  FileText,
  Download,
  Folder
} from 'lucide-react';
import { format, addDays, differenceInDays } from 'date-fns';
import { DriveTreeView } from './DriveTreeView';

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

const toIsoDate = (dateStr: any): string => {
  if (!dateStr || typeof dateStr !== 'string') return today();
  const trimmed = dateStr.trim();
  if (/^\d{2}[-/]\d{2}[-/]\d{4}$/.test(trimmed)) {
    const parts = trimmed.split(/[-/]/);
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  return today();
};

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

      const parsedInvoices: InvoiceEntry[] = (data.results || []).map((r: any, idx: number) => {
        const p = r.parsed_data || {};
        const match = r.filename ? r.filename.match(/^\[G(\d+)\]_/) : null;
        const bId = match ? parseInt(match[1]) : 1;
        const fechaPagoGrupo = bucketDates[bId] || defaultDueDate();

        const emisorNombre = r.emisor_nombre || p.emisor_nombre || '';
        const aceptanteNombre = r.aceptante_nombre || p.aceptante_nombre || '';
        const dbRates: any = r.db_rates || {};

        const montoTotal = Number(p.monto_total || 0);
        const montoNeto = Number(p.monto_neto || montoTotal);
        const detraccionPct = montoTotal > 0 ? ((montoTotal - montoNeto) / montoTotal) * 100 : 0;

        const fechaEmisionIso = toIsoDate(p.fecha_emision);
        const fechaDesembolsoIso = toIsoDate(fechaDesembolsoGlobal);
        const fechaPagoIso = toIsoDate(fechaPagoGrupo);

        const dDesembolso = new Date(fechaDesembolsoIso);
        const dPago = new Date(fechaPagoIso);
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
          fecha_emision_factura: fechaEmisionIso,
          fecha_desembolso_factoring: fechaDesembolsoIso,
          fecha_pago_calculada: fechaPagoIso,
          plazo_operacion_calculado: plazoDias,
          dias_minimos_interes_individual: Number(dbRates.dias_minimos_interes || 15),
          tasa_de_avance: Number(dbRates.tasa_avance || 90),
          interes_mensual: Number(dbRates.interes_mensual_pen || 2.5),
          interes_moratorio: Number(dbRates.interes_moratorio_pen || 2.5),
          comision_afiliacion_pen: Number(dbRates.comision_afiliacion_pen || 0),
          comision_afiliacion_usd: Number(dbRates.comision_afiliacion_usd || 0),
        };
      });

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

  // --- Simulación Financiera (Sección 4) con Doble Cálculo y Goal Seek ---
  const handleSimulate = async () => {
    if (invoices.length === 0) return;
    setLoadingStep(true);
    setErrorMsg(null);

    try {
      const API_BASE = import.meta.env.VITE_API_FACTORING_URL || 'https://inandes.react.geeksoft.tech';

      // 1. Primer Payload: Cálculo teórico directo
      const totalCapPen = invoices
        .filter(i => i.moneda_factura === 'PEN')
        .reduce((sum, i) => sum + i.monto_neto_factura * (i.tasa_de_avance / 100), 0);
      const totalCapUsd = invoices
        .filter(i => i.moneda_factura === 'USD')
        .reduce((sum, i) => sum + i.monto_neto_factura * (i.tasa_de_avance / 100), 0);

      const payload1 = invoices.map(inv => {
        const cap = inv.monto_neto_factura * (inv.tasa_de_avance / 100);
        const isSol = inv.moneda_factura === 'PEN';
        const totalCap = isSol ? totalCapPen : totalCapUsd;
        const share = totalCap > 0 ? cap / totalCap : 0;

        const comMin = (isSol ? comisionEstructuracionMinPen : comisionEstructuracionMinUsd) * share;
        const comAfi = (isSol ? comisionAfiliacionPen : comisionAfiliacionUsd) * share;

        const plazo = Math.max(inv.plazo_operacion_calculado, inv.dias_minimos_interes_individual);

        return {
          plazo_operacion: plazo,
          mfn: inv.monto_neto_factura,
          tasa_avance: inv.tasa_de_avance / 100,
          interes_mensual: inv.interes_mensual / 100,
          interes_moratorio_mensual: inv.interes_moratorio / 100,
          comision_estructuracion_pct: aplicarComisionEstructuracion ? comisionEstructuracionPct / 100 : 0,
          comision_minima_aplicable: aplicarComisionEstructuracion ? comMin : 0,
          igv_pct: 0.18,
          comision_afiliacion_aplicable: aplicarComisionAfiliacion ? comAfi : 0,
          aplicar_comision_afiliacion: aplicarComisionAfiliacion
        };
      });

      const res1 = await fetch(`${API_BASE}/api/originacion/calcular_desembolso_lote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload1)
      });

      if (!res1.ok) throw new Error("Error en el primer cálculo de desembolso en el servidor.");
      const calcData1 = await res1.json();
      const resCalc1 = calcData1.resultados_por_factura || [];

      // 2. Segundo Payload: Goal Seek (redondeo del abono a múltiplos de 10)
      const payload2 = invoices.map((_inv, idx) => {
        const item1 = resCalc1[idx] || {};
        const abonoTeorico = item1.abono_real_teorico || 0;
        const goal = Math.floor(abonoTeorico / 10) * 10;

        const basePayload = { ...payload1[idx] };
        delete (basePayload as any).tasa_avance; // Quitar tasa fija para resolver tasa de avance objetiva
        return {
          ...basePayload,
          monto_objetivo: goal
        };
      });

      const res2 = await fetch(`${API_BASE}/api/originacion/calcular_desembolso_lote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload2)
      });

      if (!res2.ok) throw new Error("Error en el cálculo Goal-Seek de desembolso.");
      const calcData2 = await res2.json();

      setSimulacionResult(calcData2);

      // Adjuntar resultado individual a cada factura
      const updatedInvoices = invoices.map((inv, idx) => {
        const p1 = payload1[idx];
        return {
          ...inv,
          interes_mensual: inv.interes_mensual || interesMensualGlobal,
          interes_moratorio: inv.interes_moratorio || interesMoratorioGlobal,
          comision_de_estructuracion_global: aplicarComisionEstructuracion ? comisionEstructuracionPct : 0,
          comision_minima_calculada: p1.comision_minima_aplicable,
          recalculate_result: calcData2.resultados_por_factura ? calcData2.resultados_por_factura[idx] : null
        } as any;
      });
      setInvoices(updatedInvoices);

      // Auto-generar PDFs inmediatamente después de simular
      await handleGeneratePdf(updatedInvoices, calcData2);

    } catch (err: any) {
      setErrorMsg(err.message || "Error al simular la operación.");
    } finally {
      setLoadingStep(false);
    }
  };

  // State para Google Drive Navigator & Auto-Extracción (Árbol Interactivo)
  const REPOSITORIO_ROOT_ID = '1Jv1r9kixL982gL-RCyPnhOY3W-qI0CLq';
  const [currentDriveName, setCurrentDriveName] = useState<string>('Inicio');
  const [selectedDrivePath, setSelectedDrivePath] = useState<string>('');

  // State para Generación de Documentos
  const [perfilPdfGenerated, setPerfilPdfGenerated] = useState<boolean>(false);
  const [liquidacionPdfGenerated, setLiquidacionPdfGenerated] = useState<boolean>(false);
  const [perfilPdfUrl, setPerfilPdfUrl] = useState<string | null>(null);
  const [liquidacionPdfUrl, setLiquidacionPdfUrl] = useState<string | null>(null);
  const [perfilPdfBase64, setPerfilPdfBase64] = useState<string | null>(null);
  const [liquidacionPdfBase64, setLiquidacionPdfBase64] = useState<string | null>(null);

  // Helper para convertir base64 a Blob URL seguro para navegadores
  const base64ToBlobUrl = (base64: string, contentType = 'application/pdf'): string => {
    try {
      const byteCharacters = atob(base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: contentType });
      return URL.createObjectURL(blob);
    } catch (e) {
      console.error("Error al generar Blob URL:", e);
      return `data:${contentType};base64,${base64}`;
    }
  };

  const SESSION_KEY = 'factoring_originacion_session';

  // --- Restaurar Sesión desde sessionStorage al Montar el Componente ---
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(SESSION_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        if (data.invoices && Array.isArray(data.invoices)) setInvoices(data.invoices);
        if (data.numGrupos) setNumGrupos(data.numGrupos);
        if (data.bucketDates) setBucketDates(data.bucketDates);
        if (data.simulacionResult) setSimulacionResult(data.simulacionResult);
        if (data.folderId) setFolderId(data.folderId);
        if (data.contractNumber) setContractNumber(data.contractNumber);
        if (data.anexoNumber) setAnexoNumber(data.anexoNumber);
        if (data.selectedDrivePath) setSelectedDrivePath(data.selectedDrivePath);
        if (data.perfilPdfGenerated) setPerfilPdfGenerated(data.perfilPdfGenerated);
        if (data.liquidacionPdfGenerated) setLiquidacionPdfGenerated(data.liquidacionPdfGenerated);
        if (data.perfilPdfBase64) {
          setPerfilPdfBase64(data.perfilPdfBase64);
          setPerfilPdfUrl(base64ToBlobUrl(data.perfilPdfBase64));
        }
        if (data.liquidacionPdfBase64) {
          setLiquidacionPdfBase64(data.liquidacionPdfBase64);
          setLiquidacionPdfUrl(base64ToBlobUrl(data.liquidacionPdfBase64));
        }
      }
    } catch (e) {
      console.error("Error al restaurar sesión de Originación:", e);
    }
  }, []);

  // --- Guardar Sesión Automáticamente en sessionStorage ---
  useEffect(() => {
    if (invoices.length === 0 && !folderId && !contractNumber && !anexoNumber) return;
    try {
      const dataToSave = {
        invoices,
        numGrupos,
        bucketDates,
        simulacionResult,
        folderId,
        contractNumber,
        anexoNumber,
        selectedDrivePath,
        perfilPdfGenerated,
        liquidacionPdfGenerated,
        perfilPdfBase64,
        liquidacionPdfBase64,
      };
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(dataToSave));
    } catch (e) {
      console.error("Error al guardar sesión de Originación:", e);
    }
  }, [
    invoices,
    numGrupos,
    bucketDates,
    simulacionResult,
    folderId,
    contractNumber,
    anexoNumber,
    selectedDrivePath,
    perfilPdfGenerated,
    liquidacionPdfGenerated,
    perfilPdfBase64,
    liquidacionPdfBase64
  ]);

  const handleClearSession = () => {
    sessionStorage.removeItem(SESSION_KEY);
    setInvoices([]);
    setBucketsFiles({ 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [], 8: [] });
    setSimulacionResult(null);
    setFolderId('');
    setContractNumber('');
    setAnexoNumber('');
    setSelectedDrivePath('');
    setPerfilPdfGenerated(false);
    setLiquidacionPdfGenerated(false);
    setPerfilPdfUrl(null);
    setLiquidacionPdfUrl(null);
    setPerfilPdfBase64(null);
    setLiquidacionPdfBase64(null);
  };

  // --- Manejo de Selección de Carpeta en Árbol de Google Drive y Auto-Extracción por RegEx ---
  const handleSelectTreeFolder = (folder: { id: string; name: string; path: string[] }) => {
    setFolderId(folder.id);
    setCurrentDriveName(folder.name);
    setSelectedDrivePath(folder.path.join(' > '));

    // 1. Anexo (de la carpeta seleccionada o su ruta)
    const fullPathStr = folder.path.join(' / ');
    const anexoMatch = folder.name.match(/Anexo.?(\d+)/i) || fullPathStr.match(/Anexo.?(\d+)/i);
    if (anexoMatch && anexoMatch[1]) {
      setAnexoNumber(anexoMatch[1]);
    }

    // 2. Contrato (de la carpeta o de sus carpetas padre en la ruta)
    let foundContract = '';
    for (let i = folder.path.length - 1; i >= 0; i--) {
      const pName = folder.path[i];
      const match1 = pName.match(/Contrato[_ ]+(.+)/i);
      if (match1 && match1[1]) {
        foundContract = match1[1].trim();
        break;
      }
      const match2 = pName.match(/Contrato\s*(\d+)/i);
      if (match2 && match2[1]) {
        foundContract = match2[1].trim();
        break;
      }
      const match3 = pName.match(/Contrato.?([A-Za-z0-9_]+)/i);
      if (match3 && match3[1]) {
        foundContract = match3[1].trim();
        break;
      }
    }

    // Fallback: Si no tiene la palabra "Contrato", usar el nombre de la carpeta padre si existe
    if (!foundContract && folder.path.length >= 2) {
      const parentFolder = folder.path[folder.path.length - 2];
      if (parentFolder && parentFolder !== 'Repositorio InAndes' && parentFolder !== 'Inicio') {
        foundContract = parentFolder;
      }
    }

    if (foundContract) {
      setContractNumber(foundContract);
    }
  };

  // --- Generación de PDFs ---
  const handleGeneratePdf = async (invoicesData = invoices, simData = simulacionResult) => {
    if (invoicesData.length === 0) return;

    if (!simData) {
      alert("Primero debes hacer clic en 'CALCULAR DESEMBOLSO' para que los PDFs tengan los desgloses financieros actualizados.");
      return;
    }

    setLoadingStep(true);
    try {
      const API_BASE = import.meta.env.VITE_API_FACTORING_URL || 'https://inandes.react.geeksoft.tech';

      const payload = {
        invoices: invoicesData
      };

      const res = await fetch(`${API_BASE}/api/originacion/generate-pdfs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.detail || "Error al generar PDFs en el servidor.");
      }
      const data = await res.json();

      if (data.perfil_pdf_base64) {
        setPerfilPdfGenerated(true);
        setPerfilPdfBase64(data.perfil_pdf_base64);
        setPerfilPdfUrl(base64ToBlobUrl(data.perfil_pdf_base64));
      }

      if (data.liquidacion_pdf_base64) {
        setLiquidacionPdfGenerated(true);
        setLiquidacionPdfBase64(data.liquidacion_pdf_base64);
        setLiquidacionPdfUrl(base64ToBlobUrl(data.liquidacion_pdf_base64));
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setLoadingStep(false);
    }
  };

  // --- Formalización (Sección 4 - Consumo Backend FastAPI) ---
  const handleConfirmFormalize = async () => {
    if (invoices.length === 0 || !simulacionResult) return;
    if (!folderId) {
      alert("Por favor selecciona una carpeta destino en el navegador de Google Drive.");
      return;
    }
    setFormalizing(true);
    try {
      // Descargar PDFs localmente
      if (perfilPdfUrl) {
        const a = document.createElement('a');
        a.href = perfilPdfUrl;
        a.download = `Perfil_Operacion_${contractNumber || 'CTR'}_Anexo_${anexoNumber || '1'}.pdf`;
        a.click();
      }
      if (liquidacionPdfUrl) {
        const a = document.createElement('a');
        a.href = liquidacionPdfUrl;
        a.download = `Anexo_Liquidacion_${contractNumber || 'CTR'}_Anexo_${anexoNumber || '1'}.pdf`;
        a.click();
      }

      const API_BASE = import.meta.env.VITE_API_FACTORING_URL || 'https://inandes.react.geeksoft.tech';

      // Preparar archivos generados para subida (Perfil y Liquidación)
      const filesToUpload: Array<{ filename: string; content_base64: string }> = [];

      if (perfilPdfBase64) {
        filesToUpload.push({
          filename: `Perfil_Operacion_${contractNumber || 'CTR'}_Anexo_${anexoNumber || '1'}.pdf`,
          content_base64: perfilPdfBase64
        });
      }

      if (liquidacionPdfBase64) {
        filesToUpload.push({
          filename: `Anexo_Liquidacion_${contractNumber || 'CTR'}_Anexo_${anexoNumber || '1'}.pdf`,
          content_base64: liquidacionPdfBase64
        });
      }

      const payload = {
        folder_id: folderId,
        lote_id: currentDriveName || "REPOSITORIO",
        contract_number: contractNumber,
        anexo_number: anexoNumber,
        invoices: invoices,
        files_to_upload: filesToUpload
      };

      const res = await fetch(`${API_BASE}/api/originacion/formalize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.detail || "Error al formalizar la operación en el servidor.");
      }

      const data = await res.json();
      const proposalId = data.proposal_id || `FACT-${format(new Date(), 'yyMMdd')}-${Math.floor(1000 + Math.random() * 9000)}`;
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
      {/* 1. CARGA DE FACTURAS (COMPACTED GRID LAYOUT)                             */}
      {/* ========================================================================= */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        {/* Header Inline (Título + Selector + Limpiar) */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-4">
            <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
              1. Carga de Facturas
            </h3>
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 shrink-0">Número de Grupos:</label>
              <select
                value={numGrupos}
                onChange={(e) => setNumGrupos(Number(e.target.value))}
                className="p-1 text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8].map(num => (
                  <option key={num} value={num}>{num}</option>
                ))}
              </select>
            </div>
          </div>

          {(invoices.length > 0 || folderId || getTotalFiles() > 0) && (
            <button
              onClick={handleClearSession}
              className="px-3 py-1.5 bg-slate-100 hover:bg-red-50 text-slate-600 hover:text-red-600 dark:bg-slate-800 dark:hover:bg-red-950/40 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
            >
              <Trash2 size={13} /> 🧹 Limpiar Lote Actual
            </button>
          )}
        </div>

        {/* Grid de Grupos / Buckets (Hasta 4 columnas por fila) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {activeGroups.map((bId) => (
            <div key={bId} className="bg-slate-50/70 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl p-3 space-y-2.5 flex flex-col justify-between">
              <div className="space-y-2">
                {/* Header del Grupo */}
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-1.5">
                  <span className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide">
                    📁 GRUPO {bId}
                  </span>
                  <span className="text-[10px] font-bold text-slate-500 bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-800">
                    {(bucketsFiles[bId] || []).length} PDFs
                  </span>
                </div>

                {/* Fila Controles: Fecha de Pago + Botón Adjuntar PDFs */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 space-y-0.5">
                    <label className="text-[9px] font-bold text-slate-500 uppercase block">Fecha Pago:</label>
                    <input
                      type="date"
                      value={bucketDates[bId] || defaultDueDate()}
                      onChange={(e) => setBucketDates(prev => ({ ...prev, [bId]: e.target.value }))}
                      className="w-full p-1 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-800 dark:text-slate-200 font-bold"
                    />
                  </div>

                  <div className="shrink-0 self-end">
                    <label className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-bold bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white rounded-lg cursor-pointer transition-colors shadow-2xs">
                      <UploadCloud size={12} />
                      <span>+ Adjuntar</span>
                      <input
                        type="file"
                        multiple
                        accept=".pdf"
                        onChange={(e) => handleNativeFileSelect(bId, e)}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                {/* Contenedor Grid 3-Columnas (Zona Activa de Drag and Drop) */}
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => handleDrop(bId, e)}
                  className="border-2 border-dashed border-slate-300 dark:border-slate-800 hover:border-red-400 dark:hover:border-red-600 rounded-lg p-2 bg-white dark:bg-slate-900 transition-colors min-h-[90px] space-y-1.5"
                >
                  <div className="flex items-center justify-between text-[9px] font-bold text-slate-400 border-b border-slate-100 dark:border-slate-800/60 pb-1">
                    <span>📥 ARCHIVOS ADJUNTOS ({ (bucketsFiles[bId] || []).length })</span>
                    <span className="text-[8px] font-normal italic">(Arrastra PDFs aquí)</span>
                  </div>

                  {(bucketsFiles[bId] || []).length > 0 ? (
                    <div className="grid grid-cols-3 gap-1 max-h-32 overflow-y-auto pr-0.5">
                      {bucketsFiles[bId].map((f, fIdx) => (
                        <div
                          key={fIdx}
                          className="flex items-center justify-between p-1 bg-slate-50 dark:bg-slate-800/80 rounded border border-slate-200 dark:border-slate-700 text-[9px] group"
                        >
                          <span
                            className="truncate font-mono font-medium text-slate-700 dark:text-slate-200 pr-0.5"
                            title={f.name}
                          >
                            {f.name}
                          </span>
                          <button
                            onClick={() => removeFile(bId, fIdx)}
                            className="text-slate-400 hover:text-red-500 shrink-0 p-0.5"
                            title="Eliminar"
                          >
                            <Trash2 size={10} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-[10px] italic text-slate-400 text-center py-4">
                      Arrastra tus facturas PDF aquí o usa el botón superior.
                    </div>
                  )}
                </div>
              </div>
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

                      {/* --- Perfil de la Operación (Desglose Financiero por Factura - Paridad 100% Streamlit) --- */}
                      {(inv as any).recalculate_result && (() => {
                        const r = (inv as any).recalculate_result;
                        const mon = inv.moneda_factura;
                        const cap = r.capital || (inv.monto_neto_factura * (inv.tasa_de_avance / 100));
                        const interes = r.interes || 0;
                        const comision = r.comision_estructuracion || 0;
                        const igvTotal = (r.igv_interes || 0) + (r.igv_comision || 0) + (r.igv_afiliacion || 0);
                        const abonoLíquido = r.abono_real_teorico || 0;
                        const tasaAvance = inv.monto_neto_factura > 0 ? (cap / inv.monto_neto_factura) * 100 : inv.tasa_de_avance;

                        return (
                          <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3 bg-white dark:bg-slate-900 p-4 rounded-xl shadow-xs">
                            <h5 className="text-xs font-black uppercase text-slate-800 dark:text-slate-200 tracking-wider">
                              Perfil de la Operación
                            </h5>
                            <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                              <b>Emisor:</b> {inv.emisor_nombre} | <b>Aceptante:</b> {inv.aceptante_nombre} | <b>Factura:</b> {inv.numero_factura} | <b>Neto:</b> {mon} {fmt(inv.monto_neto_factura)}
                            </p>
                            <div className="overflow-x-auto">
                              <table className="w-full text-[11px] text-left border-collapse">
                                <thead>
                                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold uppercase text-[10px]">
                                    <th className="py-2 px-2">Item</th>
                                    <th className="py-2 px-2">Monto ({mon})</th>
                                    <th className="py-2 px-2">% Neto</th>
                                    <th className="py-2 px-2">Fórmula de Cálculo</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                                  <tr>
                                    <td className="py-1.5 px-2">Monto Total Factura</td>
                                    <td className="py-1.5 px-2 font-bold">{fmt(inv.monto_total_factura)}</td>
                                    <td className="py-1.5 px-2">-</td>
                                    <td className="py-1.5 px-2 text-slate-400">Dato de entrada con IGV</td>
                                  </tr>
                                  <tr>
                                    <td className="py-1.5 px-2">Detracción / Retención</td>
                                    <td className="py-1.5 px-2 font-bold">{fmt(inv.monto_total_factura - inv.monto_neto_factura)}</td>
                                    <td className="py-1.5 px-2">{fmt(inv.detraccion_porcentaje)}%</td>
                                    <td className="py-1.5 px-2 text-slate-400">Monto Total - Monto Neto</td>
                                  </tr>
                                  <tr>
                                    <td className="py-1.5 px-2">Monto Neto Factura</td>
                                    <td className="py-1.5 px-2 font-bold text-emerald-600">{fmt(inv.monto_neto_factura)}</td>
                                    <td className="py-1.5 px-2">100.00%</td>
                                    <td className="py-1.5 px-2 text-slate-400">Monto a financiar</td>
                                  </tr>
                                  <tr>
                                    <td className="py-1.5 px-2">Tasa de Avance Aplicada</td>
                                    <td className="py-1.5 px-2 font-bold">{fmt(tasaAvance)}%</td>
                                    <td className="py-1.5 px-2">{fmt(tasaAvance)}%</td>
                                    <td className="py-1.5 px-2 text-slate-400">Goal-Seek resuelto</td>
                                  </tr>
                                  <tr>
                                    <td className="py-1.5 px-2">Capital Avance</td>
                                    <td className="py-1.5 px-2 font-bold">{fmt(cap)}</td>
                                    <td className="py-1.5 px-2">{fmt(inv.monto_neto_factura ? (cap / inv.monto_neto_factura) * 100 : 0)}%</td>
                                    <td className="py-1.5 px-2 text-slate-400">Monto Neto * Tasa Avance</td>
                                  </tr>
                                  <tr>
                                    <td className="py-1.5 px-2 text-amber-600 font-semibold">Intereses</td>
                                    <td className="py-1.5 px-2 font-bold text-amber-600">{fmt(interes)}</td>
                                    <td className="py-1.5 px-2">{fmt(inv.monto_neto_factura ? (interes / inv.monto_neto_factura) * 100 : 0)}%</td>
                                    <td className="py-1.5 px-2 text-slate-400">Capital * ((1+TasaDiaria)^Plazo - 1)</td>
                                  </tr>
                                  <tr>
                                    <td className="py-1.5 px-2 font-semibold">Comisión Estructuración</td>
                                    <td className="py-1.5 px-2 font-bold">{fmt(comision)}</td>
                                    <td className="py-1.5 px-2">{fmt(inv.monto_neto_factura ? (comision / inv.monto_neto_factura) * 100 : 0)}%</td>
                                    <td className="py-1.5 px-2 text-slate-400">MAX(Capital * %, Mínima)</td>
                                  </tr>
                                  <tr>
                                    <td className="py-1.5 px-2">IGV Total (Interés + Comisiones)</td>
                                    <td className="py-1.5 px-2 font-bold">{fmt(igvTotal)}</td>
                                    <td className="py-1.5 px-2">{fmt(inv.monto_neto_factura ? (igvTotal / inv.monto_neto_factura) * 100 : 0)}%</td>
                                    <td className="py-1.5 px-2 text-slate-400">Costos * 18%</td>
                                  </tr>
                                  <tr className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 font-bold border-t-2 border-emerald-200 dark:border-emerald-800">
                                    <td className="py-2 px-2 uppercase">Monto a Desembolsar (Abono Líquido)</td>
                                    <td className="py-2 px-2 text-sm text-emerald-600 font-black">{mon} {fmt(abonoLíquido)}</td>
                                    <td className="py-2 px-2">{fmt(inv.monto_neto_factura ? (abonoLíquido / inv.monto_neto_factura) * 100 : 0)}%</td>
                                    <td className="py-2 px-2">Capital - Costos Totales - IGV</td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                          </div>
                        );
                      })()}
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
                    S/ {fmt((simulacionResult.resultados_por_factura || []).reduce((s: number, r: any) => {
                      const d = r.desglose_final_detallado || {};
                      const c = r.calculo_con_tasa_encontrada || {};
                      return s + (d.interes?.monto || c.interes || 0) + (c.igv_interes || 0);
                    }, 0))}
                  </span>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <span className="text-slate-500 font-semibold block mb-1">Comisión Estructuración</span>
                  <span className="text-lg font-black text-slate-700 dark:text-slate-300">
                    S/ {fmt((simulacionResult.resultados_por_factura || []).reduce((s: number, r: any) => {
                      const d = r.desglose_final_detallado || {};
                      const c = r.calculo_con_tasa_encontrada || {};
                      return s + (d.comision_estructuracion?.monto || c.comision_estructuracion || 0);
                    }, 0))}
                  </span>
                </div>

                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/50 rounded-2xl border border-emerald-200 dark:border-emerald-900/60">
                  <span className="text-emerald-700 dark:text-emerald-400 font-bold block mb-1">Abono Real a Cedente</span>
                  <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                    S/ {fmt((simulacionResult.resultados_por_factura || []).reduce((s: number, r: any) => {
                      const d = r.desglose_final_detallado || {};
                      const c = r.calculo_con_tasa_encontrada || {};
                      return s + (d.abono?.monto || c.abono_real_teorico || 0);
                    }, 0))}
                  </span>
                </div>
              </div>

              {/* Navegador del Repositorio Google Drive (Tree View Interactivo) */}
              <div className="p-5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                  <span className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide flex items-center gap-2">
                    <Folder className="h-4 w-4 text-amber-500" />
                    📂 Seleccionar Destino en Repositorio Google Drive
                  </span>
                </div>

                {/* Ruta Seleccionada (Breadcrumb) */}
                <div className="flex items-center justify-between text-xs bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300 font-semibold truncate">
                    <span className="text-slate-400 shrink-0">Ruta Seleccionada:</span>
                    <span className="font-mono text-red-600 dark:text-red-400 truncate">
                      {selectedDrivePath || currentDriveName || 'Inicio (Repositorio InAndes)'}
                    </span>
                  </div>
                </div>

                {/* Visor en Árbol */}
                <DriveTreeView
                  rootFolderId={REPOSITORIO_ROOT_ID}
                  rootFolderName="Repositorio InAndes"
                  selectedFolderId={folderId}
                  onSelectFolder={handleSelectTreeFolder}
                />
              </div>

              {/* Formulario de Metadatos y Generación de Documentos */}
              <div className="p-5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-4">
                <span className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
                  <FileText size={14} className="text-red-600" />
                  📄 Metadatos de Formalización y Generación de Documentos
                </span>

                {/* Campos Auto-completados */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                      ID Carpeta Google Drive
                    </label>
                    <input
                      type="text"
                      readOnly
                      placeholder="Selecciona una carpeta arriba..."
                      value={folderId}
                      className="w-full p-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-xs text-slate-600 dark:text-slate-300"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                      N° de Contrato Marco (Auto-detectado)
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: 2025_Enero"
                      value={contractNumber}
                      onChange={(e) => setContractNumber(e.target.value)}
                      className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-red-600 dark:text-red-400"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                      N° de Anexo (Auto-detectado)
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: 1"
                      value={anexoNumber}
                      onChange={(e) => setAnexoNumber(e.target.value)}
                      className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-red-600 dark:text-red-400"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Botones de Acción Final SIEMPRE VISIBLES en Paso 4 (Ubicados antes de los PDFs) */}
          <div className="pt-4 flex justify-between gap-4 mt-2 mb-6">
            <button
              onClick={handleSimulate}
              disabled={loadingStep}
              className="flex-1 py-3.5 bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 disabled:opacity-50 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              {loadingStep ? <RefreshCw className="animate-spin h-4 w-4" /> : <Calculator size={16} />}
              CALCULAR DESEMBOLSO Y GENERAR PDFs
            </button>

            <button
              onClick={handleConfirmFormalize}
              disabled={formalizing || !folderId || !simulacionResult}
              className="flex-1 py-3.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              {formalizing ? <RefreshCw className="animate-spin h-4 w-4" /> : <Send size={16} />}
              💾 GUARDAR Y SUBIR A GOOGLE DRIVE
            </button>
          </div>

          {simulacionResult && (
            <div className="space-y-6">
              {/* Visores PDF Inline (Iframes) */}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-4">
                <div className="flex flex-col gap-6">
                    {/* Contenedor PDF Perfil */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className="text-slate-700 dark:text-slate-300 font-bold uppercase tracking-wide">1. PDF Perfil de Operación</span>
                        <div className="flex items-center gap-3">
                          {perfilPdfGenerated && perfilPdfUrl ? (
                            <>
                              <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                                <CheckCircle2 size={14} /> Generado
                              </span>
                              <span className="text-slate-300">|</span>
                              <a
                                href={perfilPdfUrl}
                                download={`Perfil_Operacion_${contractNumber || 'CTR'}_Anexo_${anexoNumber || '1'}.pdf`}
                                className="text-blue-600 hover:underline flex items-center gap-1"
                              >
                                <Download size={13} /> Descargar
                              </a>
                            </>
                          ) : (
                            <span className="text-amber-500 font-medium">Pendiente</span>
                          )}
                        </div>
                      </div>
                      
                      {!perfilPdfUrl && (
                        <div className="w-full py-4 bg-slate-100 dark:bg-slate-800 text-slate-500 font-medium text-xs rounded-xl shadow-xs flex items-center justify-center gap-2 border border-dashed border-slate-300 dark:border-slate-700">
                          <FileText size={16} />
                          Los documentos se generarán automáticamente al calcular el desembolso.
                        </div>
                      )}
                      
                      {perfilPdfUrl && (
                        <div className="w-full h-[600px] bg-slate-200 rounded-xl overflow-hidden border border-slate-300 shadow-inner">
                          <iframe
                            src={perfilPdfUrl}
                            title="Visor PDF Perfil de Operación"
                            className="w-full h-full border-none"
                          />
                        </div>
                      )}
                    </div>

                    {/* Contenedor PDF Liquidación */}
                    {(liquidacionPdfUrl || perfilPdfUrl) && (
                      <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                        <div className="flex items-center justify-between text-xs font-semibold">
                          <span className="text-slate-700 dark:text-slate-300 font-bold uppercase tracking-wide">2. PDF Anexo de Liquidación</span>
                          <div className="flex items-center gap-3">
                            {liquidacionPdfGenerated && liquidacionPdfUrl ? (
                              <>
                                <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                                  <CheckCircle2 size={14} /> Generado
                                </span>
                                <span className="text-slate-300">|</span>
                                <a
                                  href={liquidacionPdfUrl}
                                  download={`Anexo_Liquidacion_${contractNumber || 'CTR'}_Anexo_${anexoNumber || '1'}.pdf`}
                                  className="text-blue-600 hover:underline flex items-center gap-1"
                                >
                                  <Download size={13} /> Descargar
                                </a>
                              </>
                            ) : (
                              <span className="text-amber-500 font-medium">Generando...</span>
                            )}
                          </div>
                        </div>
                        
                        {liquidacionPdfUrl && (
                          <div className="w-full h-[600px] bg-slate-200 rounded-xl overflow-hidden border border-slate-300 shadow-inner">
                            <iframe
                              src={liquidacionPdfUrl}
                              title="Visor PDF Anexo de Liquidación"
                              className="w-full h-full border-none"
                            />
                          </div>
                        )}
                      </div>
                    )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
