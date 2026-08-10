// src/features/inversiones/InversionesPage.tsx
import React, { useEffect, useState } from 'react';
import { 
  getContratos, upsertContrato, deleteContrato, approveContrato, updateContratoFirmado
} from '../../services/contratosService';
import type { Contrato, Certificado, CertificadoEvento } from '../../services/contratosService';
import { getFondos } from '../../services/fondosService';
import type { Fondo } from '../../services/fondosService';
import { supabase } from '../../services/supabaseClient';
import { generateContractHtml, generateCertificateHtml } from '../../utils/contractPreviewGenerator';
import * as XLSX from 'xlsx';
import { 
  Loader2, AlertCircle, RefreshCw, Edit2, FileSpreadsheet, Plus, FileText, CheckCircle, Eye, Trash2, ArrowUpRight, Upload, Link2, Check
} from 'lucide-react';

export const InversionesPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'borradores' | 'porAprobar' | 'vigentes' | 'cerrados'>('borradores');
  const [view, setView] = useState<'list' | 'create' | 'approve' | 'active' | 'certificate'>('list');

  // Datos del listado
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros vigentes en barra de búsqueda y sidebar
  const [omniSearch, setOmniSearch] = useState<string>('');
  const [selectedFondosFilter, setSelectedFondosFilter] = useState<string[]>([]);

  // Opciones de mapeo cargadas de DB
  const [investors, setInvestors] = useState<any[]>([]);
  const [funds, setFunds] = useState<Fondo[]>([]);
  const [advisors, setAdvisors] = useState<any[]>([]);

  // Estados del Contrato seleccionado
  const [editingContractId, setEditingContractId] = useState<string | null>(null);
  const [selectedContract, setSelectedContract] = useState<Contrato | null>(null);

  // ==========================================
  // --- ESTADOS DEL FORMULARIO DE BORRADOR ---
  // ==========================================
  const [formFondoSel, setFormFondoSel] = useState<string>('');
  const [formMonto, setFormMonto] = useState<number>(20000);
  const [formPlazo, setFormPlazo] = useState<string>('');
  const [formReparto, setFormReparto] = useState<number>(100);
  const [formAsesor, setFormAsesor] = useState<string>('');
  const [formFechaContrato, setFormFechaContrato] = useState<string>(new Date().toISOString().split('T')[0]);
  const [formSelectedInvestors, setFormSelectedInvestors] = useState<string[]>([]);
  const [formDireccion, setFormDireccion] = useState<string>('');
  const [formPercentages, setFormPercentages] = useState<number[]>([]);
  const [formDeposits, setFormDeposits] = useState<number[]>([]);
  const [formSubmitError, setFormSubmitError] = useState<string | null>(null);

  // ==========================================
  // --- ESTADOS DEL FORMULARIO DE APROBACION -
  // ==========================================
  const [approveDate, setApproveDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [approveVoucherName, setApproveVoucherName] = useState<string>('');
  const [approveError, setApproveError] = useState<string | null>(null);
  const [approveSuccess, setApproveSuccess] = useState<boolean>(false);
  const [approveSubmitting, setApproveSubmitting] = useState<boolean>(false);
  const [approveTab, setApproveTab] = useState<'contrato' | 'certificado'>('contrato');

  // ==========================================
  // --- ESTADOS DEL DETALLE ACTIVO (SUBIDA) --
  // ==========================================
  const [signedFileUrl, setSignedFileUrl] = useState<string>('');
  const [signedUploadSuccess, setSignedUploadSuccess] = useState<boolean>(false);
  const [signedUploadError, setSignedUploadError] = useState<string | null>(null);

  const fetchInitialOptions = async () => {
    try {
      const { data: invs } = await supabase.from('crm_inversionistas').select('*').order('nombre_completo');
      setInvestors(invs || []);

      const fnds = await getFondos();
      setFunds(fnds);

      const { data: advs } = await supabase.from('crm_asesores').select('*');
      setAdvisors(advs || []);
    } catch (err) {
      console.error('Error cargando opciones iniciales:', err);
    }
  };

  const fetchContratosData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getContratos();
      setContratos(data);
    } catch (err: any) {
      setError(err.message || 'Error al obtener contratos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialOptions();
    fetchContratosData();
  }, []);

  // Agrupar plazos por fondo
  const groupedFunds: Record<string, Fondo[]> = {};
  for (const f of funds) {
    if (!groupedFunds[f.id_fondo]) groupedFunds[f.id_fondo] = [];
    groupedFunds[f.id_fondo].push(f);
  }

  // Lista de fondos únicos para filtros y selects
  const uniqueFondoCodes = Object.keys(groupedFunds);

  // Obtener plazos para el fondo seleccionado en el formulario
  const activeFundPlazos = formFondoSel ? (groupedFunds[formFondoSel] || []) : [];
  const selectedPlazoRow = activeFundPlazos.find(p => p.plazo_inversion === formPlazo);

  // ========================================================
  // --- CÁLCULO DE FECHAS REACTIVAS PARA NUEVO CONTRATO ---
  // ========================================================
  const calculateDates = () => {
    if (!selectedPlazoRow) return { start: '', end: '', ndMonths: 0 };

    const dateHoy = new Date(formFechaContrato + 'T00:00:00');
    const freqAuto = selectedPlazoRow.frecuencia_cupones_meses || 1;

    // Alinear al siguiente límite de ciclo contable
    const currentYear = dateHoy.getFullYear();
    let windowStart = new Date(currentYear, 0, 1, 0, 0, 0, 0);
    let foundWindow = false;

    for (let i = 0; i < 24; i++) {
      if (windowStart > dateHoy) {
        foundWindow = true;
        break;
      }
      windowStart.setMonth(windowStart.getMonth() + freqAuto);
    }

    const start = foundWindow ? windowStart : dateHoy;
    const startStr = start.toISOString().split('T')[0];
    let endStr = startStr;
    let ndMonths = 0;

    if (formPlazo === 'ND') {
      const extinctionDate = selectedPlazoRow.fecha_cierre_fondo;
      if (extinctionDate) {
        endStr = extinctionDate.split('T')[0];
        const endD = new Date(endStr + 'T00:00:00');
        ndMonths = (endD.getFullYear() - start.getFullYear()) * 12 + (endD.getMonth() - start.getMonth());
      }
    } else {
      const pMeses = Number(formPlazo || 0);
      const endD = new Date(start.getFullYear(), start.getMonth() + pMeses, start.getDate());
      if (endD.getDate() !== start.getDate()) {
        endD.setDate(0);
      }
      endStr = endD.toISOString().split('T')[0];
    }

    return { start: startStr, end: endStr, ndMonths };
  };

  const { start: calculatedStart, end: calculatedEnd, ndMonths: calculatedNdMonths } = calculateDates();

  // ========================================================
  // --- DIRECCIONES DISPONIBLES SEGÚN PARTICIPES SELECC ---
  // ========================================================
  const getSelectedInvestorsFiscalAddresses = (): string[] => {
    const list: string[] = [];
    const seen = new Set<string>();

    formSelectedInvestors.forEach(code => {
      const inv = investors.find(i => i.codigo_inversionista === code);
      if (inv) {
        const addressFields = [inv.direccion_fiscal, inv.direccion, inv.direccion_P1];
        addressFields.forEach(addr => {
          const clean = addr?.trim().toUpperCase();
          if (clean && clean !== 'SIN DIRECCIÓN' && !seen.has(clean)) {
            list.push(`${clean} (${inv.nombre_completo})`);
            seen.add(clean);
          }
        });
      }
    });

    return list.length > 0 ? list : ['SIN DIRECCIÓN'];
  };

  const addressesOptions = getSelectedInvestorsFiscalAddresses();

  // Forzar dirección por defecto al cambiar inversionistas
  useEffect(() => {
    if (addressesOptions.length > 0 && !addressesOptions.includes(formDireccion)) {
      setFormDireccion(addressesOptions[0]);
    }
  }, [formSelectedInvestors]);

  // Inicializar porcentajes al agregar inversionistas
  useEffect(() => {
    if (formSelectedInvestors.length === 1) {
      setFormPercentages([100]);
      setFormDeposits([100]);
    } else {
      const newPercs = new Array(formSelectedInvestors.length).fill(0);
      setFormPercentages(newPercs);
      setFormDeposits(newPercs);
    }
  }, [formSelectedInvestors]);

  // Validaciones del Wizard de Borrador
  const sumPart = formPercentages.reduce((acc, p) => acc + p, 0);
  const isPartSumValid = Math.abs(sumPart - 100) < 0.01;

  const isBankAccountsValid = (): { valid: boolean; error: string | null } => {
    if (!selectedPlazoRow) return { valid: false, error: 'Falta configurar fondo y plazo' };
    const cur = selectedPlazoRow.moneda.toLowerCase(); // pen o usd

    for (let i = 0; i < formSelectedInvestors.length; i++) {
      const code = formSelectedInvestors[i];
      const depPct = formDeposits[i] || 0;
      
      if (depPct > 0) {
        const inv = investors.find(invRow => invRow.codigo_inversionista === code);
        if (inv) {
          const acc = inv[`numero_cuenta_${cur}`];
          if (!acc || acc === 'PENDIENTE') {
            return {
              valid: false,
              error: `El partícipe ${inv.nombre_completo} requiere cuenta bancaria registrada en ${cur.toUpperCase()} para recibir depósitos.`
            };
          }
        }
      }
    }
    return { valid: true, error: null };
  };

  const bankCheck = isBankAccountsValid();
  const isWizardValid = formFondoSel && formPlazo && formAsesor && formSelectedInvestors.length > 0 && isPartSumValid && bankCheck.valid;

  // ==========================================
  // --- CONSTRUIR CONTEXTO DE VISTA PREVIA ---
  // ==========================================
  const getGeneratorContext = () => {
    if (!selectedPlazoRow) return null;

    const mappedInvestors = formSelectedInvestors.map(code => {
      const inv = investors.find(i => i.codigo_inversionista === code);
      const cur = selectedPlazoRow.moneda.toLowerCase();
      return {
        name: inv?.nombre_completo || 'S/N',
        dni: inv?.documento_identidad || 'S/N',
        bank_name: inv?.[`banco_nombre_${cur}`] || '',
        bank_acc: inv?.[`numero_cuenta_${cur}`] || '',
        bank_cci: inv?.[`cci_${cur}`] || ''
      };
    });

    const cleanAddress = formDireccion.split(' (')[0].trim();

    return {
      investors: mappedInvestors,
      fund: {
        nombre_fondo: selectedPlazoRow.nombre_fondo,
        ruc_fondo: selectedPlazoRow.ruc_fondo,
        moneda: selectedPlazoRow.moneda,
        plazo_opcion_de_rescate_dias: selectedPlazoRow.plazo_opcion_de_rescate_dias
      },
      contract: {
        monto_inversion: formMonto,
        plazo_meses: formPlazo,
        porcentaje_reparto: formReparto,
        fecha_inicio: calculatedStart,
        fecha_fin: calculatedEnd,
        nd_calculated_months: calculatedNdMonths,
        domicilio_contractual: cleanAddress,
        numero_certificado: 'XXXX',
        fecha_contrato: formFechaContrato
      },
      percentages: formPercentages,
      deposits: formDeposits,
      logo_path: '/logo_inandes.png'
    };
  };

  const previewContext = getGeneratorContext();
  const contractPreviewHtml = previewContext ? generateContractHtml(previewContext) : '';

  // ==========================================
  // --- MANEJO DE ENVÍO DE BORRADORES (CRUD) --
  // ==========================================
  const handleOpenCreateNew = () => {
    setEditingContractId(null);
    setFormFondoSel(uniqueFondoCodes[0] || '');
    setFormMonto(20000);
    setFormSelectedInvestors([]);
    setFormDireccion('');
    setFormAsesor(advisors[0]?.codigo || '');
    setFormFechaContrato(new Date().toISOString().split('T')[0]);
    
    // Auto-plazo
    const related = groupedFunds[uniqueFondoCodes[0] || ''] || [];
    setFormPlazo(related[0]?.plazo_inversion || '');
    
    setFormSubmitError(null);
    setView('create');
  };

  const handleOpenEdit = (c: Contrato) => {
    setEditingContractId(c.id_contrato);
    setFormFondoSel(c.id_fondo);
    setFormMonto(c.monto_inversion);
    setFormPlazo(c.plazo_meses);
    setFormReparto(c.porcentaje_reparto);
    setFormAsesor(c.id_asesor);
    setFormFechaContrato(c.fecha_inicio); // fallback original start
    
    const loadedInvestors: string[] = [];
    if (c.id_inversionista_1) loadedInvestors.push(c.id_inversionista_1);
    if (c.id_inversionista_2) loadedInvestors.push(c.id_inversionista_2);
    if (c.id_inversionista_3) loadedInvestors.push(c.id_inversionista_3);
    if (c.id_inversionista_4) loadedInvestors.push(c.id_inversionista_4);
    
    setFormSelectedInvestors(loadedInvestors);

    // Cargar porcentajes
    const newPercs: number[] = [];
    const newDeps: number[] = [];
    if (c.id_inversionista_1) { newPercs.push(c.porcentaje_participacion_1); newDeps.push(c.porcentaje_deposito_1); }
    if (c.id_inversionista_2) { newPercs.push(c.porcentaje_participacion_2 || 0); newDeps.push(c.porcentaje_deposito_2 || 0); }
    if (c.id_inversionista_3) { newPercs.push(c.porcentaje_participacion_3 || 0); newDeps.push(c.porcentaje_deposito_3 || 0); }
    if (c.id_inversionista_4) { newPercs.push(c.porcentaje_participacion_4 || 0); newDeps.push(c.porcentaje_deposito_4 || 0); }

    setFormPercentages(newPercs);
    setFormDeposits(newDeps);
    setFormDireccion(c.domicilio_contractual || '');
    setFormSubmitError(null);
    setView('create');
  };

  const handleSaveDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitError(null);

    if (!selectedPlazoRow) return;

    try {
      const pIds = [...formSelectedInvestors, null, null, null, null].slice(0, 4);
      const pPercs = [...formPercentages, 0, 0, 0, 0].slice(0, 4);
      const pDeps = [...formDeposits, 0, 0, 0, 0].slice(0, 4);

      const payload: Contrato = {
        id_contrato: editingContractId || crypto.randomUUID(), // Borrador UUID temporal
        id_inversionista_1: pIds[0]!,
        id_inversionista_2: pIds[1],
        id_inversionista_3: pIds[2],
        id_inversionista_4: pIds[3],
        porcentaje_participacion_1: pPercs[0]!,
        porcentaje_participacion_2: pPercs[1],
        porcentaje_participacion_3: pPercs[2],
        porcentaje_participacion_4: pPercs[3],
        porcentaje_deposito_1: pDeps[0]!,
        porcentaje_deposito_2: pDeps[1],
        porcentaje_deposito_3: pDeps[2],
        porcentaje_deposito_4: pDeps[3],
        id_fondo: selectedPlazoRow.id_fondo,
        id_fondo_plazo: selectedPlazoRow.id_fondo_plazo,
        id_asesor: formAsesor,
        monto_inversion: formMonto,
        moneda: selectedPlazoRow.moneda,
        plazo_meses: formPlazo,
        tasa_pactada: selectedPlazoRow.tasa || 0,
        frecuencia_cupones_meses: selectedPlazoRow.frecuencia_cupones_meses || 1,
        porcentaje_reparto: formReparto,
        estado: 'propuesto', // Borrador inicial
        fecha_inicio: calculatedStart,
        fecha_fin: calculatedEnd,
        domicilio_contractual: formDireccion.split(' (')[0].trim()
      };

      await upsertContrato(payload);
      fetchContratosData();
      setView('list');
    } catch (err: any) {
      setFormSubmitError(err.message || 'Error al guardar borrador.');
    }
  };

  const handleRequestApproval = async (id: string) => {
    try {
      const { error: err } = await supabase
        .from('crm_contratos')
        .update({ estado: 'pendiente_aprobacion' })
        .eq('id_contrato', id);

      if (err) throw err;
      fetchContratosData();
    } catch (err: any) {
      alert(`Error al solicitar aprobación: ${err.message}`);
    }
  };

  const handleDeleteDraft = async (id: string) => {
    if (confirm('¿Está seguro de eliminar este borrador de contrato permanente?')) {
      try {
        await deleteContrato(id);
        fetchContratosData();
      } catch (err: any) {
        alert(err.message || 'Error al eliminar borrador.');
      }
    }
  };

  // ==========================================
  // --- FLUJO DE APROBACIÓN CON ENRIQUECIM. ---
  // ==========================================
  const handleOpenApproveView = async (c: Contrato) => {
    setSelectedContract(c);
    setApproveDate(c.fecha_inicio);
    setApproveVoucherName('');
    setApproveError(null);
    setApproveSuccess(false);
    setApproveTab('contrato');
    setView('approve');
  };

  // Cargar Contexto preliminar de aprobación
  const getApproveContext = () => {
    if (!selectedContract || !funds.length) return null;
    
    const fundRow = funds.find(f => f.id_fondo === selectedContract.id_fondo);
    const relatedInvs: any[] = [];
    const cur = selectedContract.moneda.toLowerCase();

    [selectedContract.id_inversionista_1, selectedContract.id_inversionista_2, selectedContract.id_inversionista_3, selectedContract.id_inversionista_4].forEach(code => {
      if (code) {
        const inv = investors.find(i => i.codigo_inversionista === code);
        if (inv) {
          relatedInvs.push({
            name: inv.nombre_completo,
            dni: inv.documento_identidad,
            bank_name: inv[`banco_nombre_${cur}`] || '',
            bank_acc: inv[`numero_cuenta_${cur}`] || '',
            bank_cci: inv[`cci_${cur}`] || ''
          });
        }
      }
    });

    // Calcular cambio de fechas reactivo por voucher
    const oldStart = new Date(selectedContract.fecha_inicio + 'T00:00:00');
    const newStart = new Date(approveDate + 'T00:00:00');
    const delta = newStart.getTime() - oldStart.getTime();

    const oldEnd = new Date(selectedContract.fecha_fin + 'T00:00:00');
    const newEnd = new Date(oldEnd.getTime() + delta);
    const calculatedEndStr = newEnd.toISOString().split('T')[0];

    const percs = [
      selectedContract.porcentaje_participacion_1,
      selectedContract.porcentaje_participacion_2 || 0,
      selectedContract.porcentaje_participacion_3 || 0,
      selectedContract.porcentaje_participacion_4 || 0
    ].slice(0, relatedInvs.length);

    const deps = [
      selectedContract.porcentaje_deposito_1,
      selectedContract.porcentaje_deposito_2 || 0,
      selectedContract.porcentaje_deposito_3 || 0,
      selectedContract.porcentaje_deposito_4 || 0
    ].slice(0, relatedInvs.length);

    return {
      investors: relatedInvs,
      fund: {
        nombre_fondo: fundRow?.nombre_fondo || 'Fondo Desconocido',
        ruc_fondo: fundRow?.ruc_fondo || 'PENDIENTE',
        moneda: selectedContract.moneda,
        plazo_opcion_de_rescate_dias: fundRow?.plazo_opcion_de_rescate_dias
      },
      contract: {
        monto_inversion: selectedContract.monto_inversion,
        plazo_meses: selectedContract.plazo_meses,
        porcentaje_reparto: selectedContract.porcentaje_reparto,
        fecha_inicio: approveDate,
        fecha_fin: calculatedEndStr,
        domicilio_contractual: selectedContract.domicilio_contractual,
        numero_certificado: 'XXXX',
        fecha_contrato: selectedContract.fecha_inicio // original contract date
      },
      percentages: percs,
      deposits: deps,
      logo_path: '/logo_inandes.png'
    };
  };

  const approveContext = getApproveContext();
  const approveContractHtml = approveContext ? generateContractHtml(approveContext) : '';

  // Certificado preliminar
  const approveCertMeta = {
    fecha_emision: approveDate,
    id_certificado: `PRELIMINAR-${approveDate.replaceAll('-', '')}`
  };
  const approveCertContext = approveContext ? {
    ...approveContext,
    logo_efi_path: '/logo.EFI.png',
    firma_path: '/Firma.Ricardo.GALLO.png',
    cert_meta: approveCertMeta
  } : null;
  const approveCertHtml = approveCertContext ? generateCertificateHtml(approveCertContext) : '';

  const handleExecuteApproval = async () => {
    if (!selectedContract || !approveContext) return;
    if (!approveVoucherName) {
      setApproveError('Debe seleccionar o cargar un voucher de depósito para autorizar.');
      return;
    }

    setApproveSubmitting(true);
    setApproveError(null);

    try {
      // 1. Obtener último correlativo para el ID definitivo
      const fCode = selectedContract.id_fondo;
      const { data: lastContracts } = await supabase
        .from('crm_contratos')
        .select('id_contrato')
        .eq('id_fondo', fCode)
        .like('id_contrato', `${fCode}-%`)
        .order('id_contrato', { ascending: false })
        .limit(1);

      let nextCorrelative = 1;
      if (lastContracts && lastContracts.length > 0 && lastContracts[0].id_contrato) {
        const lastStr = lastContracts[0].id_contrato;
        const match = lastStr.match(/-(\d+)/);
        if (match) {
          nextCorrelative = parseInt(match[1], 10) + 1;
        }
      }

      const formattedDate = approveDate.replaceAll('-', '');
      const newContractId = `${fCode}-${String(nextCorrelative).padStart(3, '0')}.${formattedDate}`;
      const newCertificateId = `${newContractId}.${formattedDate}`;

      // 2. Armar payload de contrato definitivo
      const newContractPayload: Contrato = {
        ...selectedContract,
        id_contrato: newContractId,
        fecha_inicio: approveDate,
        fecha_fin: approveContext.contract.fecha_fin,
        voucher_deposito_url: `voucher_${selectedContract.id_contrato}_${approveVoucherName}`,
        estado: 'emitido'
      };

      // Limpiar enriquecidos antes de enviar
      delete newContractPayload.titular;
      delete newContractPayload.crm_fondos;
      delete newContractPayload.asesor;

      // 3. Certificado
      const titularesResumen = approveContext.investors.map((inv, idx) => ({
        nombre: inv.name.toUpperCase(),
        documento: inv.dni,
        participacion_pct: approveContext.percentages[idx] || 0
      }));

      const certPayload: Certificado = {
        id_certificado: newCertificateId,
        id_contrato: newContractId,
        fecha_emision: approveDate,
        monto_inversion: selectedContract.monto_inversion,
        valor_cuota: 1.0,
        numero_cuotas: selectedContract.monto_inversion,
        titulares_resumen: titularesResumen,
        estado: 'emitido'
      };

      // 4. Evento
      const eventPayload: CertificadoEvento = {
        id_certificado: newCertificateId,
        id_contrato: newContractId,
        tipo_evento: 'emision_inicial',
        fecha_periodo_origen: approveDate,
        fecha_periodo_fin: approveDate,
        capital_base: selectedContract.monto_inversion,
        interes_generado_bruto: 0,
        impuestos_renta: 0,
        interes_neto_disponible: 0,
        tasa_aplicada: 0,
        capital_final_saldo: selectedContract.monto_inversion,
        notas: `Emisión inicial del certificado ${newCertificateId} tras aprobación del contrato.`
      };

      await approveContrato(selectedContract.id_contrato, newContractPayload, certPayload, eventPayload);
      setApproveSuccess(true);
      fetchContratosData();
      setTimeout(() => {
        setView('list');
      }, 1500);
    } catch (err: any) {
      setApproveError(err.message || 'Error al aprobar contrato.');
    } finally {
      setApproveSubmitting(false);
    }
  };

  // ==========================================
  // --- VISTA DETALLE ACTIVO (SUBIDA FIRMA) --
  // ==========================================
  const handleOpenActiveView = (c: Contrato) => {
    setSelectedContract(c);
    setSignedFileUrl(c.contrato_firmado_url || '');
    setSignedUploadSuccess(false);
    setSignedUploadError(null);
    setView('active');
  };

  const getActiveContext = () => {
    if (!selectedContract || !funds.length) return null;
    const fundRow = funds.find(f => f.id_fondo === selectedContract.id_fondo);
    const relatedInvs: any[] = [];
    const cur = selectedContract.moneda.toLowerCase();

    [selectedContract.id_inversionista_1, selectedContract.id_inversionista_2, selectedContract.id_inversionista_3, selectedContract.id_inversionista_4].forEach(code => {
      if (code) {
        const inv = investors.find(i => i.codigo_inversionista === code);
        if (inv) {
          relatedInvs.push({
            name: inv.nombre_completo,
            dni: inv.documento_identidad,
            bank_name: inv[`banco_nombre_${cur}`] || '',
            bank_acc: inv[`numero_cuenta_${cur}`] || '',
            bank_cci: inv[`cci_${cur}`] || ''
          });
        }
      }
    });

    const percs = [
      selectedContract.porcentaje_participacion_1,
      selectedContract.porcentaje_participacion_2 || 0,
      selectedContract.porcentaje_participacion_3 || 0,
      selectedContract.porcentaje_participacion_4 || 0
    ].slice(0, relatedInvs.length);

    const deps = [
      selectedContract.porcentaje_deposito_1,
      selectedContract.porcentaje_deposito_2 || 0,
      selectedContract.porcentaje_deposito_3 || 0,
      selectedContract.porcentaje_deposito_4 || 0
    ].slice(0, relatedInvs.length);

    return {
      investors: relatedInvs,
      fund: {
        nombre_fondo: fundRow?.nombre_fondo || 'Fondo Desconocido',
        ruc_fondo: fundRow?.ruc_fondo || 'PENDIENTE',
        moneda: selectedContract.moneda,
        plazo_opcion_de_rescate_dias: fundRow?.plazo_opcion_de_rescate_dias
      },
      contract: {
        ...selectedContract,
        fecha_contrato: selectedContract.fecha_inicio
      },
      percentages: percs,
      deposits: deps,
      logo_path: '/logo_inandes.png'
    };
  };

  const activeContext = getActiveContext();
  const activeContractHtml = activeContext ? generateContractHtml(activeContext) : '';

  // Guardar archivo firmado
  const handleSaveSignedUrl = async () => {
    if (!selectedContract) return;
    setSignedUploadError(null);
    setSignedUploadSuccess(false);

    try {
      await updateContratoFirmado(selectedContract.id_contrato, signedFileUrl.trim());
      setSignedUploadSuccess(true);
      fetchContratosData();
    } catch (err: any) {
      setSignedUploadError(err.message || 'Error al guardar.');
    }
  };

  // ==========================================
  // --- VISTA CERTIFICADO OFICIAL ------------
  // ==========================================
  const [activeCert, setActiveCert] = useState<Certificado | null>(null);
  const [activeCertEvent, setActiveCertEvent] = useState<CertificadoEvento | null>(null);
  const [certLoading, setCertLoading] = useState<boolean>(false);

  const handleOpenCertificateView = async () => {
    if (!selectedContract) return;
    setCertLoading(true);
    try {
      const { data: certs } = await supabase
        .from('crm_certificados')
        .select('*')
        .eq('id_contrato', selectedContract.id_contrato)
        .order('fecha_emision', { ascending: false })
        .limit(1);

      if (certs && certs.length > 0) {
        setActiveCert(certs[0] as Certificado);
        
        const { data: evts } = await supabase
          .from('crm_certificados_eventos')
          .select('*')
          .eq('id_certificado', certs[0].id_certificado)
          .order('fecha_periodo_origen', { ascending: false })
          .limit(1);

        if (evts && evts.length > 0) {
          setActiveCertEvent(evts[0] as CertificadoEvento);
        } else {
          setActiveCertEvent(null);
        }
      } else {
        setActiveCert(null);
        setActiveCertEvent(null);
      }
      setView('certificate');
    } catch (err) {
      console.error(err);
    } finally {
      setCertLoading(false);
    }
  };

  // HTML Certificado Oficial
  const getOfficialCertHtml = () => {
    if (!selectedContract || !activeCert || !funds.length) return '';
    const fundRow = funds.find(f => f.id_fondo === selectedContract.id_fondo);
    const mappedInvs = activeCert.titulares_resumen.map(t => ({
      name: t.nombre,
      dni: t.documento
    }));

    return generateCertificateHtml({
      investors: mappedInvs,
      fund: {
        nombre_fondo: fundRow?.nombre_fondo || 'Fondo Desconocido',
        ruc_fondo: fundRow?.ruc_fondo || 'PENDIENTE',
        moneda: selectedContract.moneda
      },
      contract: {
        monto_inversion: selectedContract.monto_inversion,
        plazo_meses: selectedContract.plazo_meses,
        porcentaje_reparto: selectedContract.porcentaje_reparto,
        fecha_inicio: selectedContract.fecha_inicio,
        fecha_fin: selectedContract.fecha_fin
      },
      logo_efi_path: '/logo.EFI.png',
      firma_path: '/Firma.Ricardo.GALLO.png',
      cert_meta: {
        fecha_emision: activeCert.fecha_emision,
        id_certificado: activeCert.id_certificado,
        monto_actual: activeCertEvent?.capital_final_saldo ?? activeCert.monto_inversion,
        cuotas_actual: activeCertEvent?.capital_final_saldo ?? activeCert.numero_cuotas
      }
    });
  };

  const officialCertHtml = getOfficialCertHtml();

  // Imprimir PDF (Nativo)
  const handlePrintPdf = (html: string, _title: string) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Por favor habilita las ventanas emergentes (popups) para imprimir.');
      return;
    }
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  // ==========================================
  // --- EXPORTAR EXCEL DE CONTRATOS ----------
  // ==========================================
  const handleExportExcel = () => {
    if (contratos.length === 0) return;
    const wb = XLSX.utils.book_new();

    const flatList = contratos.map(c => ({
      'ID Contrato': c.id_contrato,
      'Estado': c.estado.toUpperCase(),
      'Titular Principal': c.titular?.nombre_completo || 'Sin Nombre',
      'Fondo': c.crm_fondos?.nombre_fondo || 'Fondo Desconocido',
      'Moneda': c.moneda,
      'Monto Inversión': c.monto_inversion,
      'Fecha Inicio': c.fecha_inicio,
      'Fecha Fin': c.fecha_fin,
      'Plazo (Meses)': c.plazo_meses,
      'Tasa Pactada (%)': c.tasa_pactada,
      'Asesor': c.asesor?.nombre_completo || 'Desconocido',
      'Domicilio Contractual': c.domicilio_contractual || 'N/A'
    }));

    const ws = XLSX.utils.json_to_sheet(flatList);
    XLSX.utils.book_append_sheet(wb, ws, 'Listado Contratos');
    XLSX.writeFile(wb, `BD_Contratos_Inandes_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // ==========================================
  // --- FILTRADO DE CONTRATOS PARA LISTAS ----
  // ==========================================
  const filterList = (list: Contrato[]) => {
    return list.filter(c => {
      // Filtro de sidebar (fondos)
      if (selectedFondosFilter.length > 0) {
        if (!selectedFondosFilter.includes(c.crm_fondos?.nombre_fondo || '')) return false;
      }
      
      // Filtro OMNI
      if (omniSearch.trim()) {
        const query = omniSearch.toLowerCase();
        const matchesName = c.titular?.nombre_completo?.toLowerCase().includes(query);
        const matchesId = c.id_contrato.toLowerCase().includes(query);
        if (!matchesName && !matchesId) return false;
      }
      return true;
    });
  };

  const getContractsByStates = (states: string[]) => {
    return contratos.filter(c => states.includes(c.estado));
  };

  const draftsList = filterList(getContractsByStates(['borrador', 'propuesto']));
  const pendingList = filterList(getContractsByStates(['pendiente_aprobacion']));
  const activeList = filterList(getContractsByStates(['aprobado', 'vigente', 'emitido']));
  const closedList = filterList(getContractsByStates(['cerrado_fin_contrato', 'cerrado_por_rescate']));

  // Agrupar activos por fondo para el expander
  const activeGroupedByFund: Record<string, Contrato[]> = {};
  activeList.forEach(c => {
    const fName = c.crm_fondos?.nombre_fondo || 'Sin Fondo';
    if (!activeGroupedByFund[fName]) activeGroupedByFund[fName] = [];
    activeGroupedByFund[fName].push(c);
  });

  // Ordenar numéricamente por el código correlativo de contrato (e.g. NSGPEN03-041.20221011 -> 41)
  Object.keys(activeGroupedByFund).forEach(fName => {
    activeGroupedByFund[fName].sort((a, b) => {
      const getNum = (id: string) => {
        try {
          const numStr = (id || '').split('-')[1]?.split('.')[0];
          const val = parseInt(numStr || '0', 10);
          return isNaN(val) ? 0 : val;
        } catch {
          return 0;
        }
      };
      return getNum(a.id_contrato) - getNum(b.id_contrato);
    });
  });

  return (
    <div className="flex flex-col gap-6 w-full animate-fadeIn">
      
      {/* VISTA 1: LISTAS POR PESTAÑAS (LIST) */}
      {view === 'list' && (
        <div className="flex flex-col gap-6 w-full animate-fadeIn">
          
          {/* Header Superior y Barra de Herramientas */}
          <div className="flex items-center justify-between gap-4 w-full bg-slate-50/50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-slate-700 dark:text-slate-350 uppercase tracking-tight">Directorio Contratos</span>
            </div>
            
            <div className="flex items-center gap-2">
              <button 
                className="h-9 text-xs font-bold flex items-center gap-1.5 px-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 cursor-pointer shadow-sm"
                onClick={handleExportExcel}
                disabled={contratos.length === 0}
              >
                <FileSpreadsheet size={13} className="text-emerald-600" />
                <span>Exportar Excel</span>
              </button>

              <button 
                className="h-9 text-xs font-bold flex items-center gap-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-sm"
                onClick={handleOpenCreateNew}
              >
                <Plus size={13} />
                <span>Nuevo Borrador</span>
              </button>

              <button 
                className="h-9 text-xs font-bold flex items-center gap-1.5 px-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 cursor-pointer shadow-sm"
                onClick={fetchContratosData}
                disabled={loading}
              >
                <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          {/* Buscador y tabs por estado */}
          <div className="flex flex-col gap-4">
            
            {/* Buscador rápido */}
            <div className="max-w-md w-full">
              <input
                type="text"
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg py-1.5 px-3 text-xs font-semibold focus:outline-none placeholder:text-slate-400"
                placeholder="🔍 Omni buscador rápido (DNI, Nombre o ID de contrato)..."
                value={omniSearch}
                onChange={(e) => setOmniSearch(e.target.value)}
              />
            </div>

            {/* Pestañas de estado */}
            <div className="flex gap-4 border-b border-slate-100 dark:border-slate-800/80 pb-0.5">
              {[
                { id: 'borradores', label: `Borradores (${draftsList.length})` },
                { id: 'porAprobar', label: `Por Aprobar (${pendingList.length})` },
                { id: 'vigentes', label: `Vigentes (${activeList.length})` },
                { id: 'cerrados', label: `Cerrados (${closedList.length})` },
              ].map(tab => (
                <button
                  key={tab.id}
                  className={`py-2 text-[10px] font-black uppercase tracking-wider border-b-2 cursor-pointer transition-colors ${
                    activeTab === tab.id 
                      ? 'border-emerald-650 text-emerald-600 dark:text-emerald-450' 
                      : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-400'
                  }`}
                  onClick={() => setActiveTab(tab.id as any)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Listado de Contratos */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 text-center gap-3">
              <Loader2 className="animate-spin text-emerald-600" size={35} />
              <p className="text-xs text-slate-450 dark:text-slate-500 font-bold uppercase tracking-wider">Cargando contratos del Sandbox...</p>
            </div>
          ) : error ? (
            <div className="max-w-md mx-auto my-12 bg-white dark:bg-slate-800 border border-rose-200 dark:border-rose-950 p-6 rounded-2xl shadow-sm text-center flex flex-col items-center gap-3">
              <AlertCircle className="text-rose-650" size={40} />
              <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 tracking-tight uppercase">Error de Conexión</h3>
              <p className="text-xs text-slate-450 dark:text-slate-400 leading-relaxed">{error}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4 w-full">
              
              {/* TAB: BORRADORES */}
              {activeTab === 'borradores' && (
                <div className="flex flex-col gap-4 w-full animate-fadeIn">
                  {draftsList.length === 0 ? (
                    <div className="py-16 text-center text-slate-400 font-bold uppercase tracking-wider border border-dashed border-slate-200 dark:border-slate-850 rounded-2xl">
                      No hay borradores registrados.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                      {draftsList.map(c => (
                        <div key={c.id_contrato} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-xl p-4 shadow-sm flex flex-col justify-between gap-4">
                          <div className="flex flex-col gap-1.5">
                            <div className="flex justify-between items-center w-full">
                              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{c.titular?.nombre_completo}</h4>
                              <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-450">Borrador</span>
                            </div>
                            <span className="text-[10px] text-emerald-650 dark:text-emerald-450 font-bold uppercase tracking-wider">
                              {c.crm_fondos?.nombre_fondo}
                            </span>
                            <span className="text-[9px] font-mono text-slate-400">ID Temp: {c.id_contrato}</span>
                          </div>

                          <div className="flex justify-between items-center border-t border-slate-100 dark:border-slate-800/50 pt-3 text-[10px]">
                            <div className="flex flex-col">
                              <span className="text-slate-400 uppercase font-semibold">Monto</span>
                              <span className="font-bold text-slate-700 dark:text-slate-350">{c.moneda} {c.monto_inversion.toLocaleString('es-PE')}</span>
                            </div>
                            <div className="flex flex-col text-right">
                              <span className="text-slate-400 uppercase font-semibold">Plazo / Tasa</span>
                              <span className="font-semibold text-slate-700 dark:text-slate-350">{c.plazo_meses} meses / {c.tasa_pactada}%</span>
                            </div>
                          </div>

                          <div className="flex gap-2 border-t border-slate-150 dark:border-slate-800 pt-3">
                            <button
                              className="h-8 text-[10px] font-bold flex items-center justify-center gap-1.5 px-3 rounded-lg border border-slate-250 dark:border-slate-800 hover:bg-slate-50 text-slate-700 dark:text-slate-300 cursor-pointer"
                              onClick={() => handleOpenEdit(c)}
                            >
                              <Edit2 size={10} />
                              <span>Editar</span>
                            </button>
                            <button
                              className="h-8 text-[10px] font-bold flex items-center justify-center gap-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                              onClick={() => handleRequestApproval(c.id_contrato)}
                            >
                              <ArrowUpRight size={10} />
                              <span>Solicitar Aprobación</span>
                            </button>
                            <button
                              className="h-8 text-[10px] font-bold flex items-center justify-center gap-1.5 px-2 rounded-lg border border-rose-200 dark:border-rose-950 text-rose-650 hover:bg-rose-50 dark:hover:bg-rose-950/20 cursor-pointer ml-auto"
                              onClick={() => handleDeleteDraft(c.id_contrato)}
                            >
                              <Trash2 size={10} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB: POR APROBAR */}
              {activeTab === 'porAprobar' && (
                <div className="flex flex-col gap-4 w-full animate-fadeIn">
                  {pendingList.length === 0 ? (
                    <div className="py-16 text-center text-slate-400 font-bold uppercase tracking-wider border border-dashed border-slate-200 dark:border-slate-850 rounded-2xl">
                      No hay contratos pendientes de aprobación.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                      {pendingList.map(c => (
                        <div key={c.id_contrato} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-xl p-4 shadow-sm flex flex-col justify-between gap-4">
                          <div className="flex flex-col gap-1.5">
                            <div className="flex justify-between items-center w-full">
                              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{c.titular?.nombre_completo}</h4>
                              <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 dark:bg-amber-950/20 dark:text-amber-450">Por Aprobar</span>
                            </div>
                            <span className="text-[10px] text-emerald-650 dark:text-emerald-450 font-bold uppercase tracking-wider">
                              {c.crm_fondos?.nombre_fondo}
                            </span>
                            <span className="text-[9px] font-mono text-slate-400">ID Temp: {c.id_contrato}</span>
                          </div>

                          <div className="flex justify-between items-center border-t border-slate-100 dark:border-slate-800/50 pt-3 text-[10px]">
                            <div className="flex flex-col">
                              <span className="text-slate-400 uppercase font-semibold">Monto</span>
                              <span className="font-bold text-slate-700 dark:text-slate-350">{c.moneda} {c.monto_inversion.toLocaleString('es-PE')}</span>
                            </div>
                            <div className="flex flex-col text-right">
                              <span className="text-slate-400 uppercase font-semibold">Inicio Contrato</span>
                              <span className="font-semibold text-slate-700 dark:text-slate-350">{c.fecha_inicio}</span>
                            </div>
                          </div>

                          <div className="border-t border-slate-150 dark:border-slate-800 pt-3">
                            <button
                              className="w-full h-8 text-[10px] font-bold flex items-center justify-center gap-1.5 px-3 rounded-lg bg-blue-650 hover:bg-blue-700 text-white cursor-pointer shadow-sm"
                              onClick={() => handleOpenApproveView(c)}
                            >
                              <Eye size={10} />
                              <span>Revisar y Aprobar Depósito</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB: VIGENTES */}
              {activeTab === 'vigentes' && (
                <div className="flex flex-col gap-4 w-full animate-fadeIn">
                  
                  {/* Selector de filtros de fondo en sidebar local */}
                  <div className="flex gap-2 items-center flex-wrap">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Filtrar Fondos:</span>
                    {uniqueFondoCodes.map(code => {
                      const isSelected = selectedFondosFilter.includes(groupedFunds[code][0].nombre_fondo);
                      return (
                        <button
                          key={code}
                          className={`h-6 text-[8px] font-black uppercase px-2.5 rounded-full cursor-pointer transition-colors ${
                            isSelected 
                              ? 'bg-emerald-600 text-white' 
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-750'
                          }`}
                          onClick={() => {
                            const fName = groupedFunds[code][0].nombre_fondo;
                            if (isSelected) {
                              setSelectedFondosFilter(prev => prev.filter(n => n !== fName));
                            } else {
                              setSelectedFondosFilter(prev => [...prev, fName]);
                            }
                          }}
                        >
                          {code}
                        </button>
                      );
                    })}
                    {selectedFondosFilter.length > 0 && (
                      <button
                        className="text-[9px] font-bold text-rose-600 hover:underline cursor-pointer ml-2"
                        onClick={() => setSelectedFondosFilter([])}
                      >
                        Limpiar filtros
                      </button>
                    )}
                  </div>

                  {Object.entries(activeGroupedByFund).length === 0 ? (
                    <div className="py-16 text-center text-slate-400 font-bold uppercase tracking-wider border border-dashed border-slate-200 dark:border-slate-850 rounded-2xl bg-white dark:bg-slate-900">
                      No hay contratos vigentes activos.
                    </div>
                  ) : (
                    Object.entries(activeGroupedByFund).map(([fundName, items]) => (
                      <div key={fundName} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm flex flex-col gap-3">
                        <span className="text-xs font-black text-slate-850 dark:text-slate-100 uppercase tracking-wider bg-slate-50 dark:bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-850">
                          📁 {fundName} ({items.length} Contratos)
                        </span>

                        <div className="overflow-x-auto w-full border border-slate-150 dark:border-slate-800 rounded-lg">
                          <table className="w-full text-left border-collapse text-[9px] whitespace-nowrap">
                            <thead>
                              <tr className="bg-slate-50/50 dark:bg-slate-850/30 border-b border-slate-200 dark:border-slate-800">
                                <th className="font-bold text-slate-400 dark:text-slate-500 px-3 py-2 uppercase">ID Contrato</th>
                                <th className="font-bold text-slate-400 dark:text-slate-500 px-3 py-2 uppercase">Titular Principal</th>
                                <th className="font-bold text-slate-450 dark:text-slate-500 px-3 py-2 uppercase text-center">Moneda</th>
                                <th className="font-bold text-slate-450 dark:text-slate-500 px-3 py-2 uppercase text-right">Monto</th>
                                <th className="font-bold text-slate-450 dark:text-slate-500 px-3 py-2 uppercase">Inicio</th>
                                <th className="font-bold text-slate-450 dark:text-slate-500 px-3 py-2 uppercase">Vencimiento</th>
                                <th className="font-bold text-slate-400 dark:text-slate-500 px-3 py-2 uppercase text-center">Acciones</th>
                              </tr>
                            </thead>
                            <tbody>
                              {items.map(c => (
                                <tr key={c.id_contrato} className="border-b border-slate-150 dark:border-slate-800/50 hover:bg-slate-50/30 dark:hover:bg-slate-850/10">
                                  <td className="px-3 py-2 font-mono font-bold text-slate-700 dark:text-slate-300">{c.id_contrato}</td>
                                  <td className="px-3 py-2 text-slate-700 dark:text-slate-350">{c.titular?.nombre_completo}</td>
                                  <td className="px-3 py-2 text-center text-slate-600 dark:text-slate-400">{c.moneda}</td>
                                  <td className="px-3 py-2 text-right font-mono font-semibold text-slate-750 dark:text-slate-300">{c.monto_inversion.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</td>
                                  <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{c.fecha_inicio}</td>
                                  <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{c.fecha_fin}</td>
                                  <td className="px-3 py-2 text-center">
                                    <button
                                      className="h-7 text-[8px] font-black uppercase flex items-center justify-center gap-1 px-3 mx-auto rounded bg-slate-100 hover:bg-emerald-50 hover:text-emerald-600 dark:bg-slate-800 dark:hover:bg-emerald-950/20 dark:hover:text-emerald-450 cursor-pointer transition-colors"
                                      onClick={() => handleOpenActiveView(c)}
                                    >
                                      <Eye size={10} />
                                      <span>Visualizar</span>
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* TAB: CERRADOS */}
              {activeTab === 'cerrados' && (
                <div className="flex flex-col gap-4 w-full animate-fadeIn">
                  {closedList.length === 0 ? (
                    <div className="py-16 text-center text-slate-400 font-bold uppercase tracking-wider border border-dashed border-slate-200 dark:border-slate-850 rounded-2xl bg-white dark:bg-slate-900">
                      No hay contratos cerrados.
                    </div>
                  ) : (
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm flex flex-col gap-3">
                      <div className="overflow-x-auto w-full border border-slate-150 dark:border-slate-800 rounded-lg">
                        <table className="w-full text-left border-collapse text-[9px] whitespace-nowrap">
                          <thead>
                            <tr className="bg-slate-50/50 dark:bg-slate-850/30 border-b border-slate-200 dark:border-slate-800">
                              <th className="font-bold text-slate-400 dark:text-slate-500 px-3 py-2 uppercase">ID Contrato</th>
                              <th className="font-bold text-slate-400 dark:text-slate-500 px-3 py-2 uppercase">Titular Principal</th>
                              <th className="font-bold text-slate-400 dark:text-slate-500 px-3 py-2 uppercase">Fondo</th>
                              <th className="font-bold text-slate-450 dark:text-slate-500 px-3 py-2 uppercase text-center">Moneda</th>
                              <th className="font-bold text-slate-450 dark:text-slate-500 px-3 py-2 uppercase text-right">Monto</th>
                              <th className="font-bold text-slate-450 dark:text-slate-500 px-3 py-2 uppercase">Fin</th>
                              <th className="font-bold text-slate-400 dark:text-slate-500 px-3 py-2 uppercase text-center">Acciones</th>
                            </tr>
                          </thead>
                          <tbody>
                            {closedList.map(c => (
                              <tr key={c.id_contrato} className="border-b border-slate-150 dark:border-slate-800/50 hover:bg-slate-50/30 dark:hover:bg-slate-850/10">
                                <td className="px-3 py-2 font-mono font-bold text-slate-700 dark:text-slate-300">{c.id_contrato}</td>
                                <td className="px-3 py-2 text-slate-700 dark:text-slate-350">{c.titular?.nombre_completo}</td>
                                <td className="px-3 py-2 text-slate-700 dark:text-slate-350">{c.crm_fondos?.nombre_fondo}</td>
                                <td className="px-3 py-2 text-center text-slate-600 dark:text-slate-400">{c.moneda}</td>
                                <td className="px-3 py-2 text-right font-mono font-semibold text-slate-750 dark:text-slate-300">{c.monto_inversion.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</td>
                                <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{c.fecha_fin}</td>
                                <td className="px-3 py-2 text-center">
                                  <button
                                    className="h-7 text-[8px] font-black uppercase flex items-center justify-center gap-1 px-3 mx-auto rounded bg-slate-100 hover:bg-emerald-50 hover:text-emerald-600 dark:bg-slate-800 dark:hover:bg-emerald-950/20 dark:hover:text-emerald-450 cursor-pointer transition-colors"
                                    onClick={() => handleOpenActiveView(c)}
                                  >
                                    <Eye size={10} />
                                    <span>Ver</span>
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

            </div>
          )}

        </div>
      )}

      {/* VISTA 2: FORMULARIO WIZARD / BORRADOR (CREATE) */}
      {view === 'create' && (
        <div className="flex flex-col gap-6 w-full animate-fadeIn">
          
          <div className="flex items-center gap-2">
            <button
              className="h-8 text-[10px] font-bold px-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer hover:bg-slate-50 transition-colors"
              onClick={() => setView('list')}
            >
              ⬅ Volver a la Lista
            </button>
          </div>

          <form onSubmit={handleSaveDraft} className="flex flex-col gap-6 w-full">
            
            {/* Sección 1: El Fondo */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm flex flex-col gap-3">
              <h3 className="text-xs font-black text-slate-850 dark:text-slate-150 uppercase tracking-tight">1️⃣ El Fondo</h3>
              <div className="max-w-md flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Seleccione Fondo Base</label>
                <select
                  className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                  value={formFondoSel}
                  onChange={(e) => {
                    setFormFondoSel(e.target.value);
                    const related = groupedFunds[e.target.value] || [];
                    setFormPlazo(related[0]?.plazo_inversion || '');
                  }}
                  required
                >
                  {uniqueFondoCodes.map(code => (
                    <option key={code} value={code}>
                      {groupedFunds[code][0].nombre_fondo} ({groupedFunds[code][0].moneda})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Sección 2: Condiciones del Contrato */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm flex flex-col gap-4">
              <h3 className="text-xs font-black text-slate-850 dark:text-slate-150 uppercase tracking-tight">2️⃣ Condiciones del Contrato</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                <div className="flex flex-col gap-1.5 md:col-span-1.5">
                  <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Monto Inversión</label>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                    value={formMonto}
                    onChange={(e) => setFormMonto(Number(e.target.value) || 0)}
                    required
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Plazo (Meses)</label>
                  <select
                    className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                    value={formPlazo}
                    onChange={(e) => setFormPlazo(e.target.value)}
                    required
                  >
                    {activeFundPlazos.map(p => (
                      <option key={p.id_fondo_plazo} value={p.plazo_inversion}>
                        {p.plazo_inversion === 'ND' ? 'A la Vista (ND)' : `${p.plazo_inversion} Meses`}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Tasa Pactada</label>
                  <input
                    type="text"
                    disabled
                    className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold text-slate-500"
                    value={`${selectedPlazoRow?.tasa || 0}%`}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Frec. Cupones</label>
                  <input
                    type="text"
                    disabled
                    className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold text-slate-500"
                    value={`${selectedPlazoRow?.frecuencia_cupones_meses || 1} m`}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">% Reparto</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                    value={formReparto}
                    onChange={(e) => setFormReparto(Number(e.target.value) || 0)}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Asesor Asignado</label>
                  <select
                    className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                    value={formAsesor}
                    onChange={(e) => setFormAsesor(e.target.value)}
                    required
                  >
                    {advisors.map(a => (
                      <option key={a.codigo} value={a.codigo}>
                        {a.nombre_completo} ({a.codigo})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Fecha de Contrato</label>
                  <input
                    type="date"
                    className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                    value={formFechaContrato}
                    onChange={(e) => setFormFechaContrato(e.target.value)}
                    required
                  />
                </div>
              </div>

              {selectedPlazoRow && (
                <div className="p-3 bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-100 dark:border-emerald-950/20 rounded-lg flex flex-wrap gap-4 items-center justify-between text-[11px] font-bold text-emerald-800 dark:text-emerald-400">
                  <span>🗓️ Fecha de Inicio: <strong>{calculatedStart.split('-').reverse().join('/')}</strong></span>
                  <span>📅 Vencimiento: <strong>{calculatedEnd.split('-').reverse().join('/')}</strong> {formPlazo === 'ND' ? `(${calculatedNdMonths} meses)` : ''}</span>
                </div>
              )}
            </div>

            {/* Sección 3: Los Partícipes (Inversionistas) */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm flex flex-col gap-4">
              <h3 className="text-xs font-black text-slate-850 dark:text-slate-150 uppercase tracking-tight">3️⃣ Los Partícipes (Inversionistas)</h3>
              
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Seleccione Inversionista(s) (Máximo 4)</label>
                <div className="flex flex-wrap gap-2 p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg max-h-[160px] overflow-y-auto">
                  {investors.map(inv => {
                    const isSelected = formSelectedInvestors.includes(inv.codigo_inversionista);
                    return (
                      <button
                        key={inv.codigo_inversionista}
                        type="button"
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-colors cursor-pointer ${
                          isSelected 
                            ? 'bg-emerald-650 text-white' 
                            : 'bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800'
                        }`}
                        onClick={() => {
                          if (isSelected) {
                            setFormSelectedInvestors(prev => prev.filter(c => c !== inv.codigo_inversionista));
                          } else {
                            if (formSelectedInvestors.length >= 4) {
                              alert('Solo se pueden seleccionar un máximo de 4 inversionistas por contrato.');
                              return;
                            }
                            setFormSelectedInvestors(prev => [...prev, inv.codigo_inversionista]);
                          }
                        }}
                      >
                        {inv.nombre_completo} ({inv.documento_identidad})
                      </button>
                    );
                  })}
                </div>
              </div>

              {formSelectedInvestors.length > 0 && (
                <div className="flex flex-col gap-4 border-t border-slate-100 dark:border-slate-800 pt-4">
                  
                  {/* Selector de Domicilio */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Dirección para el Contrato</label>
                    <select
                      className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                      value={formDireccion}
                      onChange={(e) => setFormDireccion(e.target.value)}
                      required
                    >
                      {addressesOptions.map(addr => (
                        <option key={addr} value={addr}>{addr}</option>
                      ))}
                    </select>
                  </div>

                  {/* Distribución de Participación y Depósito */}
                  <div className="flex flex-col gap-2">
                    <span className="text-[10px] font-bold text-slate-800 dark:text-slate-200 uppercase">📊 Distribución de Participación y Depósito</span>
                    
                    <div className="overflow-x-auto w-full border border-slate-150 dark:border-slate-800 rounded-lg">
                      <table className="w-full text-left border-collapse text-[9px] whitespace-nowrap">
                        <thead>
                          <tr className="bg-slate-50/50 dark:bg-slate-850/30 border-b border-slate-200 dark:border-slate-800">
                            <th className="font-bold text-slate-400 dark:text-slate-500 px-3 py-2 uppercase">Partícipe</th>
                            <th className="font-bold text-slate-400 dark:text-slate-500 px-3 py-2 uppercase text-center w-[120px]">% Part</th>
                            <th className="font-bold text-slate-400 dark:text-slate-500 px-3 py-2 uppercase text-center w-[120px]">% Dep</th>
                            <th className="font-bold text-slate-400 dark:text-slate-500 px-3 py-2 uppercase text-center">Moneda</th>
                            <th className="font-bold text-slate-400 dark:text-slate-500 px-3 py-2 uppercase">Banco</th>
                            <th className="font-bold text-slate-400 dark:text-slate-500 px-3 py-2 uppercase">Cuenta</th>
                          </tr>
                        </thead>
                        <tbody>
                          {formSelectedInvestors.map((code, idx) => {
                            const inv = investors.find(i => i.codigo_inversionista === code);
                            const cur = selectedPlazoRow?.moneda || 'PEN';
                            const bank = inv?.[`banco_nombre_${cur.toLowerCase()}`] || '';
                            const acc = inv?.[`numero_cuenta_${cur.toLowerCase()}`] || '';

                            return (
                              <tr key={code} className="border-b border-slate-150 dark:border-slate-800/50">
                                <td className="px-3 py-2 font-bold text-slate-700 dark:text-slate-300">{idx + 1}. {inv?.nombre_completo}</td>
                                
                                <td className="px-2 py-1 text-center">
                                  <input
                                    type="number"
                                    min={0}
                                    max={100}
                                    step="0.01"
                                    className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded p-1 text-xs text-center w-full font-semibold focus:outline-none"
                                    value={formPercentages[idx] ?? 0}
                                    onChange={(e) => {
                                      const val = Number(e.target.value) || 0;
                                      setFormPercentages(prev => {
                                        const cpy = [...prev];
                                        cpy[idx] = val;
                                        return cpy;
                                      });
                                    }}
                                  />
                                </td>

                                <td className="px-2 py-1 text-center">
                                  <input
                                    type="number"
                                    min={0}
                                    max={100}
                                    step="0.01"
                                    className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded p-1 text-xs text-center w-full font-semibold focus:outline-none"
                                    value={formDeposits[idx] ?? 0}
                                    onChange={(e) => {
                                      const val = Number(e.target.value) || 0;
                                      setFormDeposits(prev => {
                                        const cpy = [...prev];
                                        cpy[idx] = val;
                                        return cpy;
                                      });
                                    }}
                                  />
                                </td>

                                <td className="px-3 py-2 text-center text-slate-600 dark:text-slate-400">{cur}</td>
                                <td className="px-3 py-2 text-slate-700 dark:text-slate-400">{bank || '⚠️ N/A'}</td>
                                <td className="px-3 py-2 text-slate-700 dark:text-slate-400">{acc || '⚠️ PENDIENTE'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Alertas de Validaciones */}
                    <div className="flex flex-col gap-2 mt-2">
                      {bankCheck.error && (
                        <div className="text-[10px] font-bold text-rose-650 flex items-center gap-1">
                          <AlertCircle size={11} /> {bankCheck.error}
                        </div>
                      )}
                      {!isPartSumValid && (
                        <div className="text-[10px] font-bold text-rose-650 flex items-center gap-1">
                          <AlertCircle size={11} /> La suma de Participación debe ser exactamente 100% (Actual: {sumPart.toFixed(2)}%).
                        </div>
                      )}
                      {isPartSumValid && bankCheck.valid && (
                        <div className="text-[10px] font-bold text-emerald-650 flex items-center gap-1">
                          <CheckCircle size={11} /> Distribución y cuentas bancarias validadas correctamente.
                        </div>
                      )}
                    </div>

                  </div>

                </div>
              )}

            </div>

            {/* Sección 4: Vista Previa del Borrador */}
            {formSelectedInvestors.length > 0 && selectedPlazoRow && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black text-slate-850 dark:text-slate-150 uppercase tracking-tight">4️⃣ Vista Previa del Borrador</h3>
                  <button
                    type="button"
                    className="h-7 text-[9px] font-black uppercase tracking-wider bg-slate-50 border border-slate-200 dark:bg-slate-800 dark:border-slate-800 px-3 rounded-lg flex items-center gap-1 hover:bg-slate-100 transition-colors text-slate-700 dark:text-slate-300"
                    onClick={() => handlePrintPdf(contractPreviewHtml, 'BorradorContrato')}
                  >
                    <FileText size={10} />
                    <span>Vista Impresión PDF</span>
                  </button>
                </div>

                <div className="border border-slate-150 dark:border-slate-800 rounded-lg overflow-hidden bg-slate-100 p-2">
                  <iframe
                    srcDoc={contractPreviewHtml}
                    className="w-full h-[600px] bg-white border-0"
                    title="Previsualización de Contrato Privado"
                  />
                </div>
              </div>
            )}

            {/* Botones de Guardado de Borrador */}
            <div className="flex items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-800/80 pt-4">
              {formSubmitError && (
                <span className="text-[11px] font-semibold text-rose-650">{formSubmitError}</span>
              )}
              
              <button
                type="button"
                className="h-9 px-5 text-xs font-bold uppercase tracking-wider border border-slate-250 dark:border-slate-800 bg-white dark:bg-slate-850 text-slate-700 dark:text-slate-300 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors"
                onClick={() => setView('list')}
              >
                Cancelar
              </button>

              <button
                type="submit"
                className="h-9 px-6 text-xs font-black uppercase tracking-wider bg-emerald-650 hover:bg-emerald-700 text-white rounded-lg cursor-pointer shadow disabled:opacity-50 transition-colors"
                disabled={!isWizardValid}
              >
                {editingContractId ? '💾 Actualizar Contrato' : '💾 Guardar Contrato'}
              </button>
            </div>

          </form>

        </div>
      )}

      {/* VISTA 3: REVISAR Y APROBAR DEPÓSITO (APPROVE) */}
      {view === 'approve' && selectedContract && approveContext && (
        <div className="flex flex-col gap-6 w-full animate-fadeIn">
          
          <div className="flex items-center justify-between w-full">
            <button
              className="h-8 text-[10px] font-bold px-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer hover:bg-slate-50 transition-colors"
              onClick={() => setView('list')}
            >
              ⬅ Volver
            </button>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm flex flex-col gap-4">
            <h3 className="text-xs font-black text-slate-850 dark:text-slate-150 uppercase tracking-tight">✅ Aprobación de Depósito (Voucher)</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Fecha Real (Voucher)</label>
                <input
                  type="date"
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                  value={approveDate}
                  onChange={(e) => setApproveDate(e.target.value)}
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5 md:col-span-2">
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Subir Voucher de Depósito</label>
                <div className="flex items-center gap-3">
                  <label className="h-9 px-4 text-xs font-bold bg-white dark:bg-slate-900 hover:bg-slate-50 border border-slate-250 dark:border-slate-800 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer shadow-sm text-slate-700 dark:text-slate-300">
                    <Upload size={13} />
                    <span>Seleccionar voucher</span>
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*,application/pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setApproveVoucherName(file.name);
                        }
                      }}
                    />
                  </label>
                  {approveVoucherName && (
                    <span className="text-[10px] font-mono text-emerald-650 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-100 flex items-center gap-1">
                      <Check size={11} /> {approveVoucherName}
                    </span>
                  )}
                </div>
              </div>

              <button
                type="button"
                className="h-9 w-full text-xs font-black uppercase bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg cursor-pointer shadow flex items-center justify-center gap-1.5 disabled:opacity-50 transition-colors"
                onClick={handleExecuteApproval}
                disabled={approveSubmitting || !approveVoucherName}
              >
                {approveSubmitting ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Aprobando...</span>
                  </>
                ) : (
                  <span>✅ APROBAR Y GUARDAR</span>
                )}
              </button>
            </div>

            {approveError && (
              <div className="text-[10px] font-bold text-rose-650 flex items-center gap-1.5">
                <AlertCircle size={12} /> {approveError}
              </div>
            )}
            {approveSuccess && (
              <div className="text-[10px] font-bold text-emerald-650 flex items-center gap-1.5">
                <CheckCircle size={12} /> Contrato aprobado y Certificado emitido exitosamente. Redireccionando...
              </div>
            )}

            {/* Pestañas de Previsualización */}
            <div className="flex flex-col gap-3 mt-2">
              <div className="flex gap-4 border-b border-slate-100 dark:border-slate-800/80 pb-0.5">
                <button
                  className={`py-1.5 text-[9px] font-black uppercase tracking-wider border-b-2 cursor-pointer transition-colors ${
                    approveTab === 'contrato' ? 'border-emerald-650 text-emerald-650' : 'border-transparent text-slate-400'
                  }`}
                  onClick={() => setApproveTab('contrato')}
                >
                  📑 Contrato (Revisión)
                </button>
                <button
                  className={`py-1.5 text-[9px] font-black uppercase tracking-wider border-b-2 cursor-pointer transition-colors ${
                    approveTab === 'certificado' ? 'border-emerald-650 text-emerald-650' : 'border-transparent text-slate-400'
                  }`}
                  onClick={() => setApproveTab('certificado')}
                >
                  📜 Certificado (Preliminar)
                </button>
              </div>

              {approveTab === 'contrato' && (
                <div className="border border-slate-150 dark:border-slate-800 rounded-lg overflow-hidden bg-slate-100 p-2 animate-fadeIn">
                  <iframe
                    srcDoc={approveContractHtml}
                    className="w-full h-[600px] bg-white border-0"
                    title="Contrato para Aprobación"
                  />
                </div>
              )}

              {approveTab === 'certificado' && approveCertHtml && (
                <div className="border border-slate-150 dark:border-slate-800 rounded-lg overflow-hidden bg-slate-100 p-2 animate-fadeIn">
                  <iframe
                    srcDoc={approveCertHtml}
                    className="w-full h-[500px] bg-white border-0"
                    title="Certificado Preliminar"
                  />
                </div>
              )}
            </div>

          </div>

        </div>
      )}

      {/* VISTA 4: GESTIONAR CONTRATO VIGENTE (ACTIVE DETAIL) */}
      {view === 'active' && selectedContract && activeContext && (
        <div className="flex flex-col gap-6 w-full animate-fadeIn">
          
          <div className="flex items-center justify-between w-full">
            <button
              className="h-8 text-[10px] font-bold px-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer hover:bg-slate-50 transition-colors"
              onClick={() => setView('list')}
            >
              ⬅ Volver a la Lista
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full items-start">
            
            {/* Visualización del Contrato */}
            <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black text-slate-850 dark:text-slate-150 uppercase tracking-tight">📑 Contrato Definitivo</h3>
                <button
                  type="button"
                  className="h-7 text-[9px] font-black uppercase bg-slate-50 border border-slate-200 dark:bg-slate-800 dark:border-slate-800 px-3 rounded-lg flex items-center gap-1 hover:bg-slate-100 transition-colors text-slate-700 dark:text-slate-300"
                  onClick={() => handlePrintPdf(activeContractHtml, `Contrato_${selectedContract.id_contrato}`)}
                >
                  <FileText size={10} />
                  <span>Imprimir PDF</span>
                </button>
              </div>

              <div className="border border-slate-150 dark:border-slate-800 rounded-lg overflow-hidden bg-slate-100 p-2">
                <iframe
                  srcDoc={activeContractHtml}
                  className="w-full h-[600px] bg-white border-0"
                  title="Contrato Vigente"
                />
              </div>
            </div>

            {/* Acciones de Firma y Certificado */}
            <div className="flex flex-col gap-6 w-full">
              
              {/* Sección Firma */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm flex flex-col gap-4">
                <h3 className="text-xs font-black text-slate-850 dark:text-slate-150 uppercase tracking-tight">🗂️ Archivo Firmado</h3>
                
                <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-lg flex flex-col gap-2">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Estado de Contrato</span>
                  <span className="text-xs font-bold text-emerald-600 uppercase flex items-center gap-1">
                    <CheckCircle size={12} /> {selectedContract.estado.toUpperCase()}
                  </span>
                  
                  {selectedContract.contrato_firmado_url ? (
                    <div className="mt-2 flex flex-col gap-1 border-t border-slate-150 dark:border-slate-800 pt-2 text-[10px]">
                      <span className="text-slate-400 font-semibold uppercase">Archivo Firmado:</span>
                      <a
                        href={selectedContract.contrato_firmado_url}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-blue-650 hover:underline flex items-center gap-1 break-all"
                      >
                        <Link2 size={11} className="shrink-0" />
                        <span>{selectedContract.contrato_firmado_url}</span>
                      </a>
                    </div>
                  ) : (
                    <span className="text-[10px] text-rose-650 font-bold bg-rose-50/50 p-2 rounded-lg border border-rose-100 flex items-center gap-1 mt-2">
                      <AlertCircle size={12} /> Sin contrato firmado en el expediente.
                    </span>
                  )}
                </div>

                <div className="flex flex-col gap-3 border-t border-slate-100 dark:border-slate-800 pt-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Pegar URL del Documento Firmado</label>
                    <input
                      type="text"
                      className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-lg p-2 text-xs font-semibold focus:outline-none placeholder:text-slate-400"
                      placeholder="https://drive.google.com/..."
                      value={signedFileUrl}
                      onChange={(e) => setSignedFileUrl(e.target.value)}
                    />
                  </div>

                  {signedUploadError && (
                    <span className="text-[10px] font-semibold text-rose-650">{signedUploadError}</span>
                  )}
                  {signedUploadSuccess && (
                    <span className="text-[10px] font-bold text-emerald-650 flex items-center gap-0.5">
                      <CheckCircle size={11} /> Guardado con éxito.
                    </span>
                  )}

                  <button
                    className="w-full h-8 text-[10px] font-black uppercase bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg cursor-pointer shadow transition-colors"
                    onClick={handleSaveSignedUrl}
                  >
                    💾 Guardar Enlace
                  </button>
                </div>
              </div>

              {/* Sección Certificado */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm flex flex-col gap-4">
                <h3 className="text-xs font-black text-slate-850 dark:text-slate-150 uppercase tracking-tight">📜 Certificado de Participación</h3>
                <p className="text-[10px] text-slate-400">Verifique y descargue el certificado oficial de partícipes con firmas y logotipos autorizados.</p>
                
                <button
                  className="w-full h-9 text-[10px] font-black uppercase bg-blue-650 hover:bg-blue-700 text-white rounded-lg cursor-pointer shadow flex items-center justify-center gap-1.5 transition-colors"
                  onClick={handleOpenCertificateView}
                >
                  <FileText size={12} />
                  <span>Ver Certificado de Participación</span>
                </button>
              </div>

            </div>

          </div>

        </div>
      )}

      {/* VISTA 5: CERTIFICADO DE PARTICIPACION OFICIAL */}
      {view === 'certificate' && selectedContract && (
        <div className="flex flex-col gap-6 w-full animate-fadeIn">
          
          <div className="flex items-center justify-between w-full">
            <button
              className="h-8 text-[10px] font-bold px-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer hover:bg-slate-50 transition-colors"
              onClick={() => setView('active')}
            >
              ⬅ Volver al Contrato
            </button>

            {activeCert && (
              <button
                type="button"
                className="h-8 text-[10px] font-black uppercase bg-blue-650 hover:bg-blue-700 text-white px-4 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer shadow transition-colors"
                onClick={() => handlePrintPdf(officialCertHtml, `Certificado_${activeCert.id_certificado}`)}
              >
                <FileText size={11} />
                <span>Imprimir PDF Oficial</span>
              </button>
            )}
          </div>

          {certLoading ? (
            <div className="flex flex-col items-center justify-center py-24 text-center gap-3">
              <Loader2 className="animate-spin text-emerald-600" size={30} />
              <p className="text-xs text-slate-450 dark:text-slate-500 font-bold uppercase tracking-wider">Cargando certificado emitido...</p>
            </div>
          ) : activeCert ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm flex flex-col gap-4">
              <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800/80 pb-3">
                <div className="flex flex-col gap-0.5">
                  <h3 className="text-sm font-black text-blue-650 dark:text-blue-400 uppercase tracking-tight">
                    📜 Certificado Emitido ({activeCert.id_certificado})
                  </h3>
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    Fecha de Emisión: {activeCert.fecha_emision} | Capital: {selectedContract.moneda} {activeCert.monto_inversion.toLocaleString('es-PE')}
                  </span>
                </div>
              </div>

              <div className="border border-slate-150 dark:border-slate-800 rounded-lg overflow-hidden bg-slate-100 p-2">
                <iframe
                  srcDoc={officialCertHtml}
                  className="w-full h-[550px] bg-white border-0"
                  title="Certificado de Participación Oficial"
                />
              </div>
            </div>
          ) : (
            <div className="py-16 text-center text-rose-650 font-bold uppercase tracking-wider border border-dashed border-rose-200 dark:border-rose-950 rounded-2xl bg-rose-50/50 dark:bg-rose-950/10">
              No se ha encontrado un certificado emitido registrado para este contrato en la base de datos.
            </div>
          )}

        </div>
      )}

    </div>
  );
};
