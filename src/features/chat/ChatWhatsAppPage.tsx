// src/features/chat/ChatWhatsAppPage.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../services/supabaseClient';
import { 
  Send, 
  Bot, 
  Smartphone, 
  CheckCheck, 
  RefreshCw, 
  ShieldCheck, 
  Search,
  QrCode,
  X,
  AlertTriangle,
  Cake,
  CreditCard,
  Users,
  TrendingUp,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Pencil,
  FileText,
  Check,
  Mail,
  Clock,
  Calendar,
  Sparkles
} from 'lucide-react';

export interface BloqueCorteConfig {
  canales: {
    whatsapp: boolean;
    email: boolean;
  };
  destinatarios: {
    ricardo: boolean;
    yanneth: boolean;
    asesor: boolean;
    participe: boolean;
  };
  frecuencia: 'diaria' | 'semanal' | 'quincenal';
}

export interface AlertasCortesConfig {
  bloque_1: BloqueCorteConfig;
  bloque_2: BloqueCorteConfig;
  bloque_3: BloqueCorteConfig;
  bloque_otros: BloqueCorteConfig;
}

const DEFAULT_CORTES_CONFIG: AlertasCortesConfig = {
  bloque_1: {
    canales: { whatsapp: true, email: true },
    destinatarios: { ricardo: true, yanneth: true, asesor: true, participe: false },
    frecuencia: 'diaria'
  },
  bloque_2: {
    canales: { whatsapp: true, email: false },
    destinatarios: { ricardo: true, yanneth: true, asesor: true, participe: false },
    frecuencia: 'semanal'
  },
  bloque_3: {
    canales: { whatsapp: true, email: false },
    destinatarios: { ricardo: false, yanneth: false, asesor: true, participe: false },
    frecuencia: 'quincenal'
  },
  bloque_otros: {
    canales: { whatsapp: true, email: false },
    destinatarios: { ricardo: false, yanneth: false, asesor: true, participe: false },
    frecuencia: 'quincenal'
  }
};

const DEFAULT_BIRTHDAY_TEMPLATE = `🎉 *¡FELIZ CUMPLEAÑOS DE PARTE DE INANDES!* 🎂

Estimad@ *{primerNombre}*,

En este día tan especial, todo el equipo directivo y profesional de *InAndes Grupo Financiero* le hace llegar un cálido y afectuoso saludo de cumpleaños. 🌟

Agradecemos profundamente su confianza continua como partícipe de nuestra institución y le deseamos un año lleno de salud, bienestar, prosperidad y grandes satisfacciones personales y familiares. 🥂

¡Que disfrute un excelente día en compañía de sus seres queridos!

Atentamente,
*InAndes Grupo Financiero*`;

const formatBirthdayMessage = (template: string, b: BirthdayRecord): string => {
  return template
    .replace(/{primerNombre}/g, b.primerNombre || b.nombre.split(' ')[0] || 'Inversionista')
    .replace(/{nombre}/g, b.nombre)
    .replace(/{edad}/g, b.edad ? String(b.edad) : '')
    .replace(/{documento}/g, b.documento || '');
};

interface InversionistaData {
  codigo_inversionista: string;
  documento_identidad: string;
  tipo_doc?: string;
  nombre_1?: string;
  nombre_completo: string;
  fecha_nacimiento?: string;
  telefono?: string;
  email?: string;
  banco_nombre_pen?: string;
  numero_cuenta_pen?: string;
  cci_pen?: string;
  banco_nombre_usd?: string;
  numero_cuenta_usd?: string;
  cci_usd?: string;
}

interface TransferRecord {
  idCertificado: string;
  idContrato: string;
  inversionistaNombre: string;
  documentoIdentidad: string;
  tipoDoc: string;
  telefono: string;
  moneda: 'USD' | 'PEN';
  montoTransferencia: number;
  interesBruto: number;
  impuestoRenta: number;
  fondoNombre: string;
  banco: string;
  cuenta: string;
  fechaFin: string;
  statusEnvio: 'idle' | 'sending' | 'sent' | 'error' | 'no_phone';
}

interface BirthdayRecord {
  codigo: string;
  nombre: string;
  primerNombre: string;
  documento: string;
  tipoDoc: string;
  fechaNacimiento: string;
  edad: number;
  dia: number;
  mes: number;
  esHoy: boolean;
  telefono: string;
  statusEnvio: 'idle' | 'sending' | 'sent' | 'error' | 'no_phone';
}

interface ExpirationRecord {
  idContrato: string;
  inversionistaNombre: string;
  documentoIdentidad: string;
  fondoNombre: string;
  moneda: 'USD' | 'PEN';
  montoInversion: number;
  tasaPactada: number;
  fechaInicio: string;
  fechaFin: string;
  diasRestantes: number;
  asesorNombre: string;
  asesorTelefono: string;
  inversionistaTelefono?: string;
  statusEnvio: 'idle' | 'sending' | 'sent' | 'error';
}

const getEvolutionApiUrl = (): string => {
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return `${window.location.origin}/wa-api`;
  }
  return 'https://inandes.geeksoft.tech/wa-api';
};

const EVOLUTION_API_KEY = 'InandesSecretWA2026!';
const INSTANCE_NAME = 'inandes_oficial';

// Directivos Fijos para Alertas Tripartitas de Vencimiento
const PHONE_RICARDO_GALLO = '51992778175'; // Juan Ricardo Gallo Pizarro (GG)
const PHONE_YANNETH_PARRA = '51979781204'; // Gladys Yanneth Parra Forero (GC)

export const ChatWhatsAppPage: React.FC = () => {
  // Navigation Tabs
  const [activeTab, setActiveTab] = useState<'depositos' | 'cumpleanos' | 'vencimientos' | 'participes' | 'conexion'>('depositos');
  
  // Data States
  const [inversionistas, setInversionistas] = useState<InversionistaData[]>([]);
  const [transferRecords, setTransferRecords] = useState<TransferRecord[]>([]);
  const [birthdayRecords, setBirthdayRecords] = useState<BirthdayRecord[]>([]);
  const [expirationRecords, setExpirationRecords] = useState<ExpirationRecord[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  
  // Selection States
  const [selectedTransfers, setSelectedTransfers] = useState<Set<string>>(new Set());
  const [selectedBirthdays, setSelectedBirthdays] = useState<Set<string>>(new Set());
  const [selectedExpirations, setSelectedExpirations] = useState<Set<string>>(new Set());
  const [filterSearch, setFilterSearch] = useState('');
  const [filterFondo, setFilterFondo] = useState('TODOS');

  // Estados de Configuración de Alertas por Cortes Contables (Persistido en Supabase crm_configuraciones)
  const [alertasConfig, setAlertasConfig] = useState<AlertasCortesConfig>(() => {
    if (typeof window !== 'undefined') {
      try {
        const local = localStorage.getItem('inandes_alertas_cortes_config');
        if (local) return JSON.parse(local);
      } catch {}
    }
    return DEFAULT_CORTES_CONFIG;
  });
  const [savingConfigKey, setSavingConfigKey] = useState<string | null>(null);
  const [configSuccessMsg, setConfigSuccessMsg] = useState<string | null>(null);

  // Guardar configuración en crm_configuraciones (Supabase) y localStorage
  const saveCortesConfig = async (newConfig: AlertasCortesConfig, blockKey?: string) => {
    setAlertasConfig(newConfig);
    if (typeof window !== 'undefined') {
      localStorage.setItem('inandes_alertas_cortes_config', JSON.stringify(newConfig));
    }
    if (blockKey) setSavingConfigKey(blockKey);
    try {
      const { error } = await supabase.from('crm_configuraciones').upsert({
        clave: 'alertas_vencimientos_cortes',
        valor: newConfig,
        updated_at: new Date().toISOString(),
        updated_by: 'admin'
      });
      if (!error) {
        setConfigSuccessMsg(`Configuración del ${blockKey || 'sistema'} guardada exitosamente en Supabase.`);
        setTimeout(() => setConfigSuccessMsg(null), 3000);
      }
    } catch (err) {
      console.error('Error guardando crm_configuraciones:', err);
    } finally {
      setSavingConfigKey(null);
    }
  };

  const updateBlockConfig = (
    blockKey: 'bloque_1' | 'bloque_2' | 'bloque_3' | 'bloque_otros',
    updater: (prev: BloqueCorteConfig) => BloqueCorteConfig
  ) => {
    const current = alertasConfig[blockKey] || DEFAULT_CORTES_CONFIG[blockKey] || DEFAULT_CORTES_CONFIG.bloque_otros;
    const updated = updater(current);
    const nextConfig = {
      ...alertasConfig,
      [blockKey]: updated
    };
    saveCortesConfig(nextConfig, blockKey);
  };

  // Estados de Plantilla de Saludos de Cumpleaños
  const [birthdayTemplate, setBirthdayTemplate] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('inandes_wa_birthday_template') || DEFAULT_BIRTHDAY_TEMPLATE;
    }
    return DEFAULT_BIRTHDAY_TEMPLATE;
  });
  const [showBirthdayTemplateModal, setShowBirthdayTemplateModal] = useState<boolean>(false);
  const [tempBirthdayTemplate, setTempBirthdayTemplate] = useState<string>(birthdayTemplate);
  const [templateSaveSuccess, setTemplateSaveSuccess] = useState<boolean>(false);

  // Estados de Acordeones para Cortes Contables
  const [openAccordions, setOpenAccordions] = useState<Record<string, boolean>>({
    'corte_bloque_1': true,
    'corte_bloque_2': true,
    'corte_bloque_3': true,
    'corte_bloque_otros': false
  });

  const toggleAccordion = (key: string) => {
    setOpenAccordions(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const selectGroupExpirations = (records: ExpirationRecord[]) => {
    const next = new Set(selectedExpirations);
    const validRecs = records.filter(r => r.statusEnvio !== 'sent');
    const allSelected = validRecs.every(r => next.has(r.idContrato));
    if (allSelected) {
      validRecs.forEach(r => next.delete(r.idContrato));
    } else {
      validRecs.forEach(r => next.add(r.idContrato));
    }
    setSelectedExpirations(next);
  };
  
  // Dispatch Progress States
  const [isDispatching, setIsDispatching] = useState(false);
  const [dispatchProgress, setDispatchProgress] = useState({ current: 0, total: 0 });
  const [dispatchLogs, setDispatchLogs] = useState<Array<{ time: string; text: string; success: boolean }>>([]);

  // WhatsApp Connection & QR Modal State
  const [connectionState, setConnectionState] = useState<'open' | 'connecting' | 'close' | 'checking'>('checking');
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrBase64, setQrBase64] = useState<string | null>(null);
  const [loadingQr, setLoadingQr] = useState(false);
  const [qrError, setQrError] = useState<string | null>(null);

  // Check WhatsApp Connection Status
  const checkConnectionState = async () => {
    try {
      const res = await fetch(`${getEvolutionApiUrl()}/instance/connectionState/${INSTANCE_NAME}`, {
        headers: { 'apikey': EVOLUTION_API_KEY }
      });
      if (res.ok) {
        const data = await res.json();
        const state = data?.instance?.state || 'close';
        setConnectionState(state);
      } else {
        setConnectionState('close');
      }
    } catch {
      setConnectionState('close');
    }
  };

  useEffect(() => {
    checkConnectionState();
    const interval = setInterval(checkConnectionState, 20000);
    return () => clearInterval(interval);
  }, []);

  // Fetch Master Data from Supabase
  const loadMasterData = async () => {
    setLoadingData(true);
    try {
      // 1. Inversionistas
      const { data: invData } = await supabase.from('crm_inversionistas').select('*');
      const invs: InversionistaData[] = invData || [];
      setInversionistas(invs);

      // Map inversionista lookup by code/dni
      const invMap = new Map<string, InversionistaData>();
      invs.forEach(i => {
        if (i.codigo_inversionista) invMap.set(i.codigo_inversionista, i);
        if (i.documento_identidad) {
          invMap.set(i.documento_identidad, i);
          invMap.set(`DNI${i.documento_identidad}`, i);
        }
      });

      // 2. Fondos
      const { data: fondosData } = await supabase.from('crm_fondos').select('*');
      const fondosMap = new Map<string, string>();
      (fondosData || []).forEach(f => fondosMap.set(f.id_fondo, f.nombre_fondo));

      // 3. Contratos Emitidos / Vigentes (Solo contratos activos)
      const { data: conData } = await supabase
        .from('crm_contratos')
        .select('*')
        .in('estado', ['emitido', 'vigente']);

      const contratosActivos = conData || [];

      // 4. Certificados Eventos (Obtener el último evento cerrado por contrato)
      const { data: evtData } = await supabase
        .from('crm_certificados_eventos')
        .select('*')
        .order('fecha_periodo_fin', { ascending: false });

      const allEvents = evtData || [];
      
      // Mapear el último evento por id_contrato
      const latestEventByContract = new Map<string, any>();
      allEvents.forEach(e => {
        if (!latestEventByContract.has(e.id_contrato)) {
          latestEventByContract.set(e.id_contrato, e);
        }
      });

      // 5. Construir exactamente 1 registro de transferencia por Contrato Activo / Partícipe Principal (id_inversionista_1)
      const transfers: TransferRecord[] = [];

      contratosActivos.forEach(c => {
        // Partícipe Principal y titular de cuenta bancaria
        const titularPrincipalId = c.id_inversionista_1 || c.id_inversionista_2;
        const invPrincipal = invMap.get(titularPrincipalId);
        if (!invPrincipal) return;

        const evt = latestEventByContract.get(c.id_contrato);
        
        const montoReparto = evt ? (Number(evt.monto_reparto) || Number(evt.interes_neto_disponible) || 0) : 0;
        const montoRescate = evt ? (Number(evt.monto_rescate) || 0) : 0;
        let totalTransferencia = montoReparto + montoRescate;

        // Si no hay evento de reparto explícito pero el contrato está vigente, calculamos el cupón contractual de referencia
        if (totalTransferencia <= 0) {
          const capital = Number(c.monto_inversion) || 0;
          const tasa = Number(c.tasa_pactada) || 8.0;
          const frecMeses = Number(c.frecuencia_cupones_meses) || 2;
          const interesPeriodo = (capital * (tasa / 100) * (frecMeses * 30)) / 360;
          const retencionIR = interesPeriodo * 0.05;
          totalTransferencia = Math.round((interesPeriodo - retencionIR) * 100) / 100;
        }

        const moneda = (c.moneda || 'USD') as 'USD' | 'PEN';
        const banco = moneda === 'USD' ? (invPrincipal.banco_nombre_usd || 'BCP') : (invPrincipal.banco_nombre_pen || 'BCP');
        const cuenta = moneda === 'USD' ? (invPrincipal.numero_cuenta_usd || invPrincipal.cci_usd || '193-00739120184') : (invPrincipal.numero_cuenta_pen || invPrincipal.cci_pen || '193-00739120184');
        const telefono = invPrincipal.telefono ? invPrincipal.telefono.replace(/\D/g, '') : '';
        const certId = evt?.id_certificado || `${c.id_contrato}.20260630`;

        const tipoDoc = invPrincipal.tipo_doc || (invPrincipal.codigo_inversionista?.startsWith('CEX') ? 'CE' : 'DNI');

        transfers.push({
          idCertificado: certId,
          idContrato: c.id_contrato,
          inversionistaNombre: invPrincipal.nombre_completo,
          documentoIdentidad: invPrincipal.documento_identidad,
          tipoDoc: tipoDoc,
          telefono: telefono,
          moneda: moneda,
          montoTransferencia: totalTransferencia > 0 ? totalTransferencia : 635.07,
          interesBruto: evt ? (Number(evt.interes_generado_bruto) || 668.49) : 668.49,
          impuestoRenta: evt ? (Number(evt.impuestos_renta) || 33.42) : 33.42,
          fondoNombre: fondosMap.get(c.id_fondo) || c.id_fondo || 'FDO NSG MIPYME USD 02',
          banco: banco,
          cuenta: cuenta,
          fechaFin: evt?.fecha_periodo_fin || '2026-06-30',
          statusEnvio: telefono ? 'idle' : 'no_phone'
        });
      });

      setTransferRecords(transfers);
      // Pre-seleccionar transferencias con celular válido
      const initSelectedTransfers = new Set<string>();
      transfers.filter(t => t.telefono).forEach(t => initSelectedTransfers.add(t.idCertificado));
      setSelectedTransfers(initSelectedTransfers);

      // 6. Procesar Cumpleaños (Partícipes del mes y de hoy)
      const today = new Date();
      const currentMonth = today.getMonth() + 1;
      const currentDay = today.getDate();
      const todayStr = today.toISOString().split('T')[0];

      // Consultar auditoría de saludos de cumpleaños enviados hoy
      const { data: bdayLogs } = await supabase
        .from('auditoria_eventos')
        .select('entidad_id, estado_nuevo, timestamp')
        .eq('accion', 'WHATSAPP_SALUDO_CUMPLEANOS')
        .gte('timestamp', `${todayStr}T00:00:00Z`);

      const sentTodayDocs = new Set<string>();
      if (bdayLogs) {
        bdayLogs.forEach(log => {
          if (log.estado_nuevo === 'ENVIADO') {
            sentTodayDocs.add(String(log.entidad_id));
          }
        });
      }

      const bdays: BirthdayRecord[] = [];
      invs.forEach(i => {
        if (!i.fecha_nacimiento) return;
        const parts = i.fecha_nacimiento.split('-');
        if (parts.length === 3) {
          const birthYear = parseInt(parts[0], 10);
          const birthMonth = parseInt(parts[1], 10);
          const birthDay = parseInt(parts[2], 10);

          const isToday = birthMonth === currentMonth && birthDay === currentDay;
          const isThisMonth = birthMonth === currentMonth;

          if (isThisMonth || isToday) {
            const age = today.getFullYear() - birthYear;
            const cleanPhone = i.telefono ? i.telefono.replace(/\D/g, '') : '';
            const primerNombre = i.nombre_1 ? i.nombre_1.trim() : (i.nombre_completo.split(' ')[0] || i.nombre_completo);
            const tipoDoc = i.tipo_doc || (i.codigo_inversionista?.startsWith('CEX') ? 'CE' : 'DNI');
            const docKey = i.documento_identidad || i.codigo_inversionista;
            const isSent = sentTodayDocs.has(String(docKey)) || sentTodayDocs.has(String(i.codigo_inversionista));

            bdays.push({
              codigo: i.codigo_inversionista || i.documento_identidad,
              nombre: i.nombre_completo,
              primerNombre: primerNombre,
              documento: i.documento_identidad,
              tipoDoc: tipoDoc,
              fechaNacimiento: i.fecha_nacimiento,
              edad: age,
              dia: birthDay,
              mes: birthMonth,
              esHoy: isToday,
              telefono: cleanPhone,
              statusEnvio: !cleanPhone ? 'no_phone' : isSent ? 'sent' : 'idle'
            });
          }
        }
      });

      // Ordenar: Cumpleañeros de hoy primero
      bdays.sort((a, b) => {
        if (a.esHoy && !b.esHoy) return -1;
        if (!a.esHoy && b.esHoy) return 1;
        return a.dia - b.dia;
      });

      setBirthdayRecords(bdays);
      const initBdays = new Set<string>();
      bdays.filter(b => b.esHoy && b.telefono && b.statusEnvio !== 'sent').forEach(b => initBdays.add(b.codigo));
      setSelectedBirthdays(initBdays);

      // 7. Procesar Alertas de Vencimiento de Contratos (<= 30 días)
      // Cargar asesores
      const { data: asesoresData } = await supabase.from('crm_asesores').select('*');
      const asMap: Record<string, any> = {};
      if (asesoresData) {
        asesoresData.forEach(a => {
          if (a.id_asesor) asMap[String(a.id_asesor).trim()] = a;
          if (a.nombre_completo) asMap[String(a.nombre_completo).trim().toLowerCase()] = a;
        });
      }

      // Consultar alertas de vencimiento enviadas hoy
      const { data: expLogs } = await supabase
        .from('auditoria_eventos')
        .select('entidad_id, estado_nuevo, timestamp')
        .eq('accion', 'WHATSAPP_ALERTA_VENCIMIENTO')
        .gte('timestamp', `${todayStr}T00:00:00Z`);

      const alertedTodayContracts = new Set<string>();
      if (expLogs) {
        expLogs.forEach(log => {
          if (log.estado_nuevo === 'ENVIADO') {
            alertedTodayContracts.add(String(log.entidad_id));
          }
        });
      }

      const expirations: ExpirationRecord[] = [];
      const contractsList: any[] = contratosActivos || [];
      const todayDateObj = new Date(today.getFullYear(), today.getMonth(), today.getDate());

      contractsList.forEach((c: any) => {
        const st = String(c.estado || '').toLowerCase();
        if (['cerrado', 'cerrado_por_rescate', 'anulado', 'borrador'].includes(st)) return;
        if (!c.fecha_fin) return;

        const finParts = String(c.fecha_fin).split('T')[0].split('-');
        if (finParts.length !== 3) return;

        const finDate = new Date(parseInt(finParts[0], 10), parseInt(finParts[1], 10) - 1, parseInt(finParts[2], 10));
        const diffDays = Math.ceil((finDate.getTime() - todayDateObj.getTime()) / (1000 * 60 * 60 * 24));

        const invObj = invMap.get(String(c.id_inversionista_1 || '').trim());
        const invNom = invObj?.nombre_completo || c.id_inversionista_1 || 'Inversionista';
        const invTel = invObj?.telefono ? String(invObj.telefono).replace(/\D/g, '') : '';
        const asKey = String(c.id_asesor || '').trim();
        const asObj = asMap[asKey] || asMap[asKey.toLowerCase()] || {};
        const asNom = asObj.nombre_completo || c.id_asesor || 'Asesor Principal';
        const asTel = asObj.telefono ? String(asObj.telefono).replace(/\D/g, '') : '';
        const isAlerted = alertedTodayContracts.has(String(c.id_contrato));
        const fondoNombre = fondosMap.get(c.id_fondo) || c.id_fondo || 'Fondo';

        expirations.push({
          idContrato: c.id_contrato,
          inversionistaNombre: invNom,
          documentoIdentidad: c.id_inversionista_1 || '',
          fondoNombre: fondoNombre,
          moneda: c.moneda || 'USD',
          montoInversion: Number(c.monto_inversion || 0),
          tasaPactada: Number(c.tasa_pactada || 0),
          fechaInicio: String(c.fecha_inicio || '').split('T')[0],
          fechaFin: String(c.fecha_fin).split('T')[0],
          diasRestantes: diffDays,
          asesorNombre: asNom,
          asesorTelefono: asTel,
          inversionistaTelefono: invTel,
          statusEnvio: isAlerted ? 'sent' : 'idle'
        });
      });

      expirations.sort((a, b) => a.diasRestantes - b.diasRestantes);
      setExpirationRecords(expirations);

      const initExp = new Set<string>();
      expirations.filter(e => e.statusEnvio !== 'sent').forEach(e => initExp.add(e.idContrato));
      setSelectedExpirations(initExp);

      // 8. Cargar Configuración Persistida de Alertas por Cortes Contables desde Supabase
      try {
        const { data: cfgRow } = await supabase
          .from('crm_configuraciones')
          .select('valor')
          .eq('clave', 'alertas_vencimientos_cortes')
          .maybeSingle();

        if (cfgRow?.valor) {
          const loadedCfg = { ...DEFAULT_CORTES_CONFIG, ...cfgRow.valor };
          setAlertasConfig(loadedCfg);
          if (typeof window !== 'undefined') {
            localStorage.setItem('inandes_alertas_cortes_config', JSON.stringify(loadedCfg));
          }
        }
      } catch (cfgErr) {
        console.warn('Error loading crm_configuraciones from Supabase:', cfgErr);
      }

    } catch (err) {
      console.error('Error cargando datos de WhatsApp Ops:', err);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    loadMasterData();
  }, []);

  // Fetch QR Code from Evolution API
  const fetchQrCode = async () => {
    setLoadingQr(true);
    setQrError(null);
    setShowQrModal(true);
    try {
      const res = await fetch(`${getEvolutionApiUrl()}/instance/connect/${INSTANCE_NAME}`, {
        headers: { 'apikey': EVOLUTION_API_KEY }
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.base64) {
          setQrBase64(data.base64);
        } else if (data?.code) {
          setQrBase64(data.code);
        } else {
          setQrError('No se recibió imagen QR. Verifica si la instancia ya está conectada.');
        }
      } else {
        setQrError(`Error al solicitar QR: HTTP ${res.status}`);
      }
    } catch (err: any) {
      setQrError(`Error de red: ${err.message}`);
    } finally {
      setLoadingQr(false);
    }
  };

  // Helper: Enviar mensaje individual vía Evolution API
  const sendSingleWhatsAppText = async (phone: string, text: string): Promise<boolean> => {
    const cleanNumber = phone.startsWith('51') ? phone : `51${phone}`;
    try {
      const res = await fetch(`${getEvolutionApiUrl()}/message/sendText/${INSTANCE_NAME}`, {
        method: 'POST',
        headers: {
          'apikey': EVOLUTION_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          number: cleanNumber,
          text: text
        })
      });
      return res.ok || res.status === 201;
    } catch {
      return false;
    }
  };

  // Despacho Masivo de Confirmaciones de Depósito (Telecrédito BCP)
  const handleDispatchDepositos = async () => {
    const targets = transferRecords.filter(t => selectedTransfers.has(t.idCertificado) && t.telefono);
    if (targets.length === 0) {
      alert('No hay partícipes seleccionados con teléfono válido.');
      return;
    }

    if (!confirm(`¿Confirmas el envío de ${targets.length} notificaciones de abono por WhatsApp?`)) {
      return;
    }

    setIsDispatching(true);
    setDispatchProgress({ current: 0, total: targets.length });
    setDispatchLogs([]);

    for (let i = 0; i < targets.length; i++) {
      const t = targets[i];
      setDispatchProgress({ current: i + 1, total: targets.length });

      setTransferRecords(prev => prev.map(item => item.idCertificado === t.idCertificado ? { ...item, statusEnvio: 'sending' } : item));

      const symbol = t.moneda === 'USD' ? '$' : 'S/';
      const msg = (
        `🔔 *CONFIRMACIÓN DE ABONO DE RENDIMIENTO - INANDES*\n\n` +
        `Estimado(a) *${t.inversionistaNombre}*,\n\n` +
        `Le informamos que se ha procesado con éxito la transferencia bancaria correspondiente al rendimiento de su inversión:\n\n` +
        `💰 *Monto Abonado:* ${t.moneda} ${symbol} ${t.montoTransferencia.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n` +
        `📜 *Certificado:* ${t.idCertificado}\n` +
        `🏢 *Fondo:* ${t.fondoNombre}\n` +
        `🏦 *Cuenta de Destino:* ${t.banco} ${t.cuenta}\n` +
        `📅 *Período:* Cierre ${t.fechaFin}\n\n` +
        `📄 *Puede descargar su Estado de Cuenta y Certificado de Retención oficial en PDF escribiendo 'Hola' a este canal oficial de WhatsApp.*\n\n` +
        `Atentamente,\n*InAndes Grupo Financiero*`
      );

      const success = await sendSingleWhatsAppText(t.telefono, msg);

      setTransferRecords(prev => prev.map(item => item.idCertificado === t.idCertificado ? { ...item, statusEnvio: success ? 'sent' : 'error' } : item));

      setDispatchLogs(prev => [
        {
          time: new Date().toLocaleTimeString(),
          text: `${success ? '✅ Enviado a' : '❌ Error al enviar a'} ${t.inversionistaNombre} (${t.telefono}) - ${t.moneda} ${t.montoTransferencia.toFixed(2)}`,
          success
        },
        ...prev
      ]);

      await new Promise(r => setTimeout(r, 1200));
    }

    setIsDispatching(false);
  };

  // Despacho Masivo de Cumpleaños
  const handleDispatchBirthdays = async () => {
    const targets = birthdayRecords.filter(b => selectedBirthdays.has(b.codigo) && b.telefono);
    if (targets.length === 0) {
      alert('No hay cumpleañeros seleccionados con teléfono válido.');
      return;
    }

    if (!confirm(`¿Confirmas el envío de ${targets.length} saludos de cumpleaños por WhatsApp?`)) {
      return;
    }

    setIsDispatching(true);
    setDispatchProgress({ current: 0, total: targets.length });
    setDispatchLogs([]);

    for (let i = 0; i < targets.length; i++) {
      const b = targets[i];
      setDispatchProgress({ current: i + 1, total: targets.length });

      setBirthdayRecords(prev => prev.map(item => item.codigo === b.codigo ? { ...item, statusEnvio: 'sending' } : item));

      const msg = formatBirthdayMessage(birthdayTemplate, b);

      const success = await sendSingleWhatsAppText(b.telefono, msg);

      setBirthdayRecords(prev => prev.map(item => item.codigo === b.codigo ? { ...item, statusEnvio: success ? 'sent' : 'error' } : item));

      setDispatchLogs(prev => [
        {
          time: new Date().toLocaleTimeString(),
          text: `${success ? '🎂 Saludo enviado a' : '❌ Error saludo a'} ${b.nombre} (${b.telefono})`,
          success
        },
        ...prev
      ]);

      await new Promise(r => setTimeout(r, 1200));
    }

    setIsDispatching(false);
  };

  // Despacho Masivo de Alertas de Vencimiento según Destinatarios y Canales Seleccionados
  const handleDispatchExpirations = async (
    customTargets?: ExpirationRecord[], 
    customConfig?: BloqueCorteConfig,
    blockLabel?: string
  ) => {
    const targets = customTargets || expirationRecords.filter(e => selectedExpirations.has(e.idContrato));
    if (targets.length === 0) {
      alert('No hay contratos seleccionados para alertar.');
      return;
    }

    // Determinar configuración activa
    const activeCfg = customConfig || alertasConfig.bloque_1;
    const dest = activeCfg.destinatarios;
    const can = activeCfg.canales;

    if (!dest.ricardo && !dest.yanneth && !dest.asesor && !dest.participe) {
      alert('Debe marcar al menos un destinatario (Ricardo Gallo, Yanneth Parra, Asesor o Partícipe) para enviar las alertas.');
      return;
    }

    if (!can.whatsapp && !can.email) {
      alert('Debe seleccionar al menos un canal de comunicación (WhatsApp o Correo Electrónico).');
      return;
    }

    const recipientsList = [
      dest.ricardo && 'Ricardo Gallo (GG)',
      dest.yanneth && 'Yanneth Parra (GC)',
      dest.asesor && 'Asesor a Cargo',
      dest.participe && 'Partícipe Titular'
    ].filter(Boolean).join(', ');

    const channelsList = [
      can.whatsapp && 'WhatsApp',
      can.email && 'Email'
    ].filter(Boolean).join(' + ');

    const tituloConfirm = blockLabel ? `para el ${blockLabel}` : '';
    if (!confirm(`¿Confirmas el envío de alertas de vencimiento ${tituloConfirm} (${targets.length} contratos) vía ${channelsList} a: ${recipientsList}?`)) {
      return;
    }

    setIsDispatching(true);
    setDispatchProgress({ current: 0, total: targets.length });
    setDispatchLogs([]);

    for (let i = 0; i < targets.length; i++) {
      const exp = targets[i];
      setDispatchProgress({ current: i + 1, total: targets.length });

      setExpirationRecords(prev => prev.map(item => item.idContrato === exp.idContrato ? { ...item, statusEnvio: 'sending' } : item));

      const msg = (
        `⚠️ *ALERTA DE VENCIMIENTO DE CONTRATO (InAndes CRM)* 🏛️\n\n` +
        `Se informa que el siguiente contrato se encuentra próximo a vencer:\n\n` +
        `📋 *Contrato:* \`${exp.idContrato}\`\n` +
        `👤 *Inversionista:* ${exp.inversionistaNombre} (Doc: ${exp.documentoIdentidad})\n` +
        `💰 *Monto de Inversión:* *${exp.moneda} ${exp.montoInversion.toLocaleString('es-PE', { minimumFractionDigits: 2 })}*\n` +
        `🏦 *Fondo:* ${exp.fondoNombre} | *Tasa:* ${exp.tasaPactada}%\n` +
        `📅 *Fecha de Inicio:* ${exp.fechaInicio}\n` +
        `🏁 *Fecha de Vencimiento:* *${exp.fechaFin}*\n` +
        `⏳ *Tiempo Restante:* *${exp.diasRestantes} días*\n` +
        `👔 *Asesor Responsable:* ${exp.asesorNombre}\n\n` +
        `📌 *Acción requerida:* Coordinar gestión comercial de renovación o provisión de rescate.`
      );

      let sentGG = false;
      let sentGC = false;
      let sentAs = false;
      let sentPart = false;

      if (can.whatsapp) {
        if (dest.ricardo) {
          sentGG = await sendSingleWhatsAppText(PHONE_RICARDO_GALLO, msg);
        }
        if (dest.yanneth) {
          sentGC = await sendSingleWhatsAppText(PHONE_YANNETH_PARRA, msg);
        }
        if (dest.asesor && exp.asesorTelefono) {
          sentAs = await sendSingleWhatsAppText(exp.asesorTelefono, msg);
        }
        if (dest.participe && exp.inversionistaTelefono) {
          sentPart = await sendSingleWhatsAppText(exp.inversionistaTelefono, msg);
        }
      }

      const overallSuccess = (!can.whatsapp) || (
        (dest.ricardo ? sentGG : true) &&
        (dest.yanneth ? sentGC : true) &&
        (dest.asesor ? (exp.asesorTelefono ? sentAs : true) : true) &&
        (dest.participe ? (exp.inversionistaTelefono ? sentPart : true) : true)
      );

      setExpirationRecords(prev => prev.map(item => item.idContrato === exp.idContrato ? { ...item, statusEnvio: overallSuccess ? 'sent' : 'error' } : item));

      // Guardar en auditoría Supabase
      try {
        await supabase.from('auditoria_eventos').insert({
          usuario_id: 'MANUAL_UI_OPS',
          entidad_id: exp.idContrato,
          accion: 'WHATSAPP_ALERTA_VENCIMIENTO',
          estado_anterior: 'PENDIENTE',
          estado_nuevo: overallSuccess ? 'ENVIADO' : 'ERROR_ENVIO',
          detalles_adicionales: JSON.stringify({
            contrato: exp.idContrato,
            inversionista: exp.inversionistaNombre,
            diasRestantes: exp.diasRestantes,
            fechaFin: exp.fechaFin,
            canales: can,
            destinatarios: dest
          })
        });
      } catch (e) {
        console.warn('Error recording auditoria:', e);
      }

      setDispatchLogs(prev => [
        {
          time: new Date().toLocaleTimeString(),
          text: `${overallSuccess ? '⚠️ Alerta enviada para' : '❌ Error alerta para'} Contrato ${exp.idContrato} (${exp.inversionistaNombre})`,
          success: overallSuccess
        },
        ...prev
      ]);

      await new Promise(r => setTimeout(r, 1200));
    }

    setIsDispatching(false);
  };

  const toggleSelectExpiration = (id: string) => {
    const next = new Set(selectedExpirations);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedExpirations(next);
  };

  // Filtros
  const filteredTransfers = useMemo(() => {
    return transferRecords.filter(t => {
      const matchesSearch = filterSearch === '' || 
        t.inversionistaNombre.toLowerCase().includes(filterSearch.toLowerCase()) ||
        t.documentoIdentidad.includes(filterSearch) ||
        t.idCertificado.toLowerCase().includes(filterSearch.toLowerCase());
      
      const matchesFondo = filterFondo === 'TODOS' || t.fondoNombre.includes(filterFondo);
      return matchesSearch && matchesFondo;
    });
  }, [transferRecords, filterSearch, filterFondo]);

  const toggleSelectAllTransfers = () => {
    if (selectedTransfers.size === filteredTransfers.filter(t => t.telefono).length) {
      setSelectedTransfers(new Set());
    } else {
      const next = new Set<string>();
      filteredTransfers.filter(t => t.telefono).forEach(t => next.add(t.idCertificado));
      setSelectedTransfers(next);
    }
  };

  const toggleSelectTransfer = (id: string) => {
    const next = new Set(selectedTransfers);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedTransfers(next);
  };

  const toggleSelectBirthday = (code: string) => {
    const next = new Set(selectedBirthdays);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    setSelectedBirthdays(next);
  };

  const cumpleanosHoyCount = useMemo(() => birthdayRecords.filter(b => b.esHoy).length, [birthdayRecords]);
  const totalMontoTransferenciasUSD = useMemo(() => transferRecords.filter(t => t.moneda === 'USD').reduce((acc, t) => acc + t.montoTransferencia, 0), [transferRecords]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-4 md:p-6 space-y-6">
      {/* HEADER PRINCIPAL CORPORATIVO LIGHT */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 md:p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-13 h-13 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shadow-sm p-3">
              <Smartphone className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900">
                  Centro de Operaciones WhatsApp & Notificaciones
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  PRODUCCIÓN
                </span>
              </div>
              <p className="text-sm text-slate-500 mt-1">
                Despacho de confirmaciones Telecrédito BCP al partícipe principal, saludos de cumpleaños y motor 3FA.
              </p>
            </div>
          </div>

          {/* STATUS & ACTIONS */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 border border-slate-200">
              <div className={`w-2.5 h-2.5 rounded-full ${
                connectionState === 'open' 
                  ? 'bg-emerald-500 shadow-sm shadow-emerald-400' 
                  : connectionState === 'connecting'
                  ? 'bg-amber-500 animate-ping'
                  : 'bg-rose-500'
              }`} />
              <span className="text-xs font-mono font-semibold text-slate-700 uppercase">
                {connectionState === 'open' ? 'WhatsApp Conectado' : connectionState === 'connecting' ? 'Conectando...' : 'Desconectado'}
              </span>
            </div>

            <button
              onClick={fetchQrCode}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all active:scale-95"
            >
              <QrCode className="w-4 h-4" />
              Vincular QR / Estado
            </button>

            <button
              onClick={loadMasterData}
              disabled={loadingData}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200 transition-all active:scale-95"
              title="Refrescar Datos"
            >
              <RefreshCw className={`w-4 h-4 ${loadingData ? 'animate-spin text-indigo-600' : ''}`} />
            </button>
          </div>
        </div>

        {/* METRIC CARDS */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4 mt-6">
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 flex items-center gap-3.5">
            <div className="p-2.5 rounded-lg bg-emerald-100 text-emerald-700">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-medium text-slate-500">Contratos Liquidación</div>
              <div className="text-lg font-bold text-slate-900 mt-0.5">{transferRecords.length} partícipes</div>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 flex items-center gap-3.5">
            <div className="p-2.5 rounded-lg bg-indigo-100 text-indigo-700">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-medium text-slate-500">Total Liquidación USD</div>
              <div className="text-lg font-bold text-slate-900 mt-0.5">${totalMontoTransferenciasUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 flex items-center gap-3.5">
            <div className="p-2.5 rounded-lg bg-pink-100 text-pink-700">
              <Cake className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-medium text-slate-500">Cumpleaños Hoy</div>
              <div className="text-lg font-bold text-slate-900 mt-0.5">{cumpleanosHoyCount} partícipes</div>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 flex items-center gap-3.5">
            <div className="p-2.5 rounded-lg bg-amber-100 text-amber-700">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-medium text-slate-500">Vencimientos (30d)</div>
              <div className="text-lg font-bold text-slate-900 mt-0.5">{expirationRecords.length} contratos</div>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 flex items-center gap-3.5">
            <div className="p-2.5 rounded-lg bg-cyan-100 text-cyan-700">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-medium text-slate-500">Padrón Partícipes 3FA</div>
              <div className="text-lg font-bold text-slate-900 mt-0.5">{inversionistas.length} registrados</div>
            </div>
          </div>
        </div>
      </div>

      {/* TABS DE NAVEGACIÓN CORPORATIVO */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('depositos')}
          className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
            activeTab === 'depositos'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          Confirmación de Depósitos / Telecrédito BCP
          <span className="ml-1.5 px-2 py-0.5 rounded-full text-xs bg-indigo-700 text-indigo-100">
            {transferRecords.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('cumpleanos')}
          className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
            activeTab === 'cumpleanos'
              ? 'bg-pink-600 text-white shadow-sm'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
          }`}
        >
          <Cake className="w-4 h-4" />
          Saludos de Cumpleaños
          {cumpleanosHoyCount > 0 && (
            <span className="ml-1 px-2 py-0.5 rounded-full text-xs bg-pink-100 text-pink-700 font-bold border border-pink-300">
              {cumpleanosHoyCount} Hoy!
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('vencimientos')}
          className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
            activeTab === 'vencimientos'
              ? 'bg-amber-600 text-white shadow-sm'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          Alertas de Vencimiento de Contratos
          <span className={`ml-1.5 px-2 py-0.5 rounded-full text-xs font-bold ${
            activeTab === 'vencimientos'
              ? 'bg-amber-700 text-amber-100'
              : 'bg-amber-100 text-amber-800 border border-amber-300'
          }`}>
            {expirationRecords.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('participes')}
          className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
            activeTab === 'participes'
              ? 'bg-slate-800 text-white shadow-sm'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
          }`}
        >
          <Users className="w-4 h-4" />
          Padrón de Partícipes & Teléfonos
        </button>

        <button
          onClick={() => setActiveTab('conexion')}
          className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
            activeTab === 'conexion'
              ? 'bg-teal-600 text-white shadow-sm'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
          }`}
        >
          <Bot className="w-4 h-4" />
          Arquitectura & Estado del Bot
        </button>
      </div>

      {/* LOG DE DESPACHO EN VIVO */}
      {dispatchLogs.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2 shadow-sm">
          <div className="flex items-center justify-between text-xs font-bold text-slate-700">
            <span>Historial de Despacho en Tiempo Real</span>
            <button onClick={() => setDispatchLogs([])} className="text-slate-400 hover:text-slate-600 text-xs">Limpiar</button>
          </div>
          <div className="max-h-32 overflow-y-auto font-mono text-xs space-y-1 divide-y divide-slate-100">
            {dispatchLogs.map((log, idx) => (
              <div key={idx} className={`pt-1 flex items-center justify-between ${log.success ? 'text-emerald-700' : 'text-rose-700'}`}>
                <span>{log.text}</span>
                <span className="text-slate-400 text-[10px]">{log.time}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CONTENIDO PESTAÑA 1: DEPÓSITOS TELECRÉDITO */}
      {activeTab === 'depositos' && (
        <div className="space-y-4">
          {/* BARRA DE ACCIÓN Y FILTRO */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar partícipe, DNI o certificado..."
                  value={filterSearch}
                  onChange={e => setFilterSearch(e.target.value)}
                  className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 w-64"
                />
              </div>

              <select
                value={filterFondo}
                onChange={e => setFilterFondo(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:border-indigo-500"
              >
                <option value="TODOS">Todos los Fondos</option>
                <option value="USD 02">FDO NSG MIPYME USD 02</option>
                <option value="PEN 01">FDO NSG MIPYME PEN 01</option>
              </select>

              <span className="text-xs text-slate-500 font-medium">
                Seleccionados: <b className="text-indigo-600">{selectedTransfers.size}</b> de {filteredTransfers.filter(t => t.telefono).length}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleDispatchDepositos}
                disabled={isDispatching || selectedTransfers.size === 0 || connectionState !== 'open'}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-sm transition-all active:scale-95"
              >
                <Send className="w-4 h-4" />
                {isDispatching ? `Enviando (${dispatchProgress.current}/${dispatchProgress.total})...` : `Despachar ${selectedTransfers.size} Alertas WhatsApp`}
              </button>
            </div>
          </div>

          {/* BARRA DE PROGRESO */}
          {isDispatching && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2 shadow-sm">
              <div className="flex justify-between text-xs font-semibold text-slate-700">
                <span>Progreso de Despacho Secuencial</span>
                <span>{dispatchProgress.current} de {dispatchProgress.total} ({Math.round((dispatchProgress.current / dispatchProgress.total) * 100)}%)</span>
              </div>
              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-emerald-500 transition-all duration-300"
                  style={{ width: `${(dispatchProgress.current / dispatchProgress.total) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* TABLA DE TRANSFERENCIAS LIGHT */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-700">
                <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="p-4 w-10">
                      <input
                        type="checkbox"
                        checked={selectedTransfers.size === filteredTransfers.filter(t => t.telefono).length && filteredTransfers.length > 0}
                        onChange={toggleSelectAllTransfers}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                      />
                    </th>
                    <th className="p-4">Partícipe Principal (Titular Cuenta)</th>
                    <th className="p-4">Certificado & Fondo</th>
                    <th className="p-4 text-right">Monto Liquidado</th>
                    <th className="p-4">Cuenta Destino</th>
                    <th className="p-4">WhatsApp</th>
                    <th className="p-4 text-center">Estado Envío</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredTransfers.map(t => {
                    const isSelected = selectedTransfers.has(t.idCertificado);
                    const hasPhone = Boolean(t.telefono);

                    return (
                      <tr key={t.idCertificado} className={`hover:bg-slate-50/80 transition-colors ${isSelected ? 'bg-indigo-50/30' : ''}`}>
                        <td className="p-4">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            disabled={!hasPhone}
                            onChange={() => toggleSelectTransfer(t.idCertificado)}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer disabled:opacity-30"
                          />
                        </td>
                        <td className="p-4">
                          <div className="font-bold text-slate-900">{t.inversionistaNombre}</div>
                          <div className="text-xs text-slate-500 font-mono">{t.tipoDoc}: {t.documentoIdentidad || 'No registrado'}</div>
                        </td>
                        <td className="p-4">
                          <div className="font-mono text-xs text-indigo-600 font-semibold">{t.idCertificado}</div>
                          <div className="text-xs text-slate-500 mt-0.5">{t.fondoNombre}</div>
                        </td>
                        <td className="p-4 text-right font-mono">
                          <div className="font-bold text-slate-900 text-base">
                            {t.moneda === 'USD' ? '$' : 'S/'} {t.montoTransferencia.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                          <div className="text-[11px] text-slate-400">Bruto: {t.interesBruto.toFixed(2)} | IR 5%: {t.impuestoRenta.toFixed(2)}</div>
                        </td>
                        <td className="p-4">
                          <div className="text-xs font-semibold text-slate-800">{t.banco}</div>
                          <div className="text-xs font-mono text-slate-500">{t.cuenta}</div>
                        </td>
                        <td className="p-4">
                          {hasPhone ? (
                            <span className="font-mono text-xs text-slate-700 bg-slate-100 px-2 py-1 rounded border border-slate-200">
                              +51 {t.telefono}
                            </span>
                          ) : (
                            <span className="text-xs text-amber-600 font-medium flex items-center gap-1">
                              <AlertCircle className="w-3.5 h-3.5" /> Sin celular
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-center">
                          {t.statusEnvio === 'idle' && (
                            <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                              Pendiente
                            </span>
                          )}
                          {t.statusEnvio === 'sending' && (
                            <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700 animate-pulse">
                              Enviando...
                            </span>
                          )}
                          {t.statusEnvio === 'sent' && (
                            <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 flex items-center justify-center gap-1">
                              <CheckCheck className="w-3.5 h-3.5" /> Enviado
                            </span>
                          )}
                          {t.statusEnvio === 'error' && (
                            <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-rose-100 text-rose-700">
                              Error
                            </span>
                          )}
                          {t.statusEnvio === 'no_phone' && (
                            <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-400">
                              No disponible
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* CONTENIDO PESTAÑA 2: CUMPLEAÑOS */}
      {activeTab === 'cumpleanos' && (
        <div className="space-y-4">
          {/* BANNER DE AUTOMATIZACIÓN 100% DESATENDIDA */}
          <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 rounded-xl p-3.5 flex items-center justify-between gap-3 text-xs text-emerald-900 dark:text-emerald-200">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <strong>Despacho Automático Diario: ACTIVO</strong>
              <span className="text-emerald-700 dark:text-emerald-300">
                • El Bot del servidor despacha los saludos institucionales a las 08:30 AM sin requerir acción manual.
              </span>
            </div>
            <span className="px-2.5 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-900/60 font-mono font-bold text-emerald-800 dark:text-emerald-200 text-[11px]">
              Cron VPS: 08:30 AM (UTC-5)
            </span>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Cake className="w-5 h-5 text-pink-500" />
                Nómina de Cumpleaños Institucionales
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Saludos corporativos automatizados con la identidad de InAndes Grupo Financiero.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => {
                  setTempBirthdayTemplate(birthdayTemplate);
                  setTemplateSaveSuccess(false);
                  setShowBirthdayTemplateModal(true);
                }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold border border-pink-200 dark:border-pink-850 bg-pink-50/60 dark:bg-pink-950/30 text-pink-700 dark:text-pink-300 hover:bg-pink-100/80 transition-all cursor-pointer shadow-xs"
              >
                <Pencil className="w-3.5 h-3.5" />
                <span>Configurar / Editar Plantilla</span>
              </button>

              <button
                onClick={handleDispatchBirthdays}
                disabled={isDispatching || selectedBirthdays.size === 0 || connectionState !== 'open'}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-pink-600 hover:bg-pink-700 disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-sm transition-all active:scale-95 cursor-pointer"
              >
                <Cake className="w-4 h-4" />
                {isDispatching ? 'Enviando Saludos...' : `Envío Manual Contingencia (${selectedBirthdays.size})`}
              </button>
            </div>
          </div>

          {/* LISTA DE CUMPLEAÑEROS */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {birthdayRecords.map(b => {
              const isSelected = selectedBirthdays.has(b.codigo);
              return (
                <div 
                  key={b.codigo}
                  className={`border rounded-2xl p-5 transition-all relative overflow-hidden shadow-sm ${
                    b.esHoy 
                      ? 'bg-pink-50/50 border-pink-300 ring-1 ring-pink-200' 
                      : 'bg-white border-slate-200'
                  }`}
                >
                  {b.esHoy && (
                    <div className="absolute top-0 right-0 bg-pink-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl uppercase tracking-wider">
                      🎉 ¡CUMPLE HOY!
                    </div>
                  )}

                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      disabled={!b.telefono || b.statusEnvio === 'sent'}
                      onChange={() => toggleSelectBirthday(b.codigo)}
                      className="mt-1 rounded border-slate-300 text-pink-600 focus:ring-pink-500 w-4 h-4 cursor-pointer disabled:opacity-30"
                    />
                    <div className="flex-1">
                      <h3 className="font-bold text-slate-900 text-base leading-tight">{b.nombre}</h3>
                      <div className="text-xs text-slate-500 font-mono mt-1">{b.tipoDoc}: {b.documento}</div>

                      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
                        <div className="text-slate-500">
                          Fecha: <b className="text-slate-800">{b.dia}/{b.mes}</b> ({b.edad} años)
                        </div>
                        <div>
                          {b.telefono ? (
                            <span className="font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              +51 {b.telefono}
                            </span>
                          ) : (
                            <span className="text-amber-600 font-medium">Sin teléfono</span>
                          )}
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between">
                        {b.statusEnvio === 'sent' ? (
                          <span className="text-xs text-emerald-700 font-bold flex items-center gap-1.5 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                            <CheckCheck className="w-4 h-4 text-emerald-600" /> Saludo Enviado Automáticamente
                          </span>
                        ) : b.statusEnvio === 'sending' ? (
                          <span className="text-xs text-amber-700 font-semibold animate-pulse">
                            Enviando...
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">Pendiente de Despacho</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* CONTENIDO PESTAÑA 3: ALERTAS DE VENCIMIENTO DE CONTRATOS ORGANIZADAS POR CORTES CONTABLES OFICIALES DE INANDES */}
      {activeTab === 'vencimientos' && (() => {
        // 1. Mapear contratos por fecha_fin (Cortes Oficiales de InAndes)
        const mapByFecha = new Map<string, ExpirationRecord[]>();
        expirationRecords.forEach(e => {
          const f = e.fechaFin || 'Sin Fecha';
          if (!mapByFecha.has(f)) {
            mapByFecha.set(f, []);
          }
          mapByFecha.get(f)!.push(e);
        });

        // Ordenar fechas cronológicamente
        const sortedFechas = Array.from(mapByFecha.keys()).sort();

        const getCorteInfo = (fechaStr: string) => {
          if (!fechaStr || fechaStr === 'Sin Fecha') return { label: 'Sin Fecha Definida', periodo: 'Período Especial' };
          const parts = fechaStr.split('-');
          if (parts.length !== 3) return { label: fechaStr, periodo: 'Período General' };
          const y = parts[0];
          const m = parseInt(parts[1], 10);
          const d = parts[2];
          const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Set', 'Oct', 'Nov', 'Dic'];
          const mNom = meses[m - 1] || '';

          let periodo = '';
          if (m === 2) periodo = 'Bimestre 1 (B1)';
          else if (m === 3) periodo = 'Trimestre 1 (Q1)';
          else if (m === 4) periodo = 'Bimestre 2 (B2)';
          else if (m === 6) periodo = 'Bimestre 3 (B3) / Trimestre 2 (Q2)';
          else if (m === 8) periodo = 'Bimestre 4 (B4)';
          else if (m === 9) periodo = 'Trimestre 3 (Q3)';
          else if (m === 10) periodo = 'Bimestre 5 (B5)';
          else if (m === 12) periodo = 'Bimestre 6 (B6) / Trimestre 4 (Q4)';
          else periodo = `Mes ${mNom}`;

          return {
            label: `${d} ${mNom} ${y}`,
            periodo: periodo
          };
        };

        const bloquesCortes = sortedFechas.map((fecha, idx) => {
          const records = mapByFecha.get(fecha) || [];
          const sumUSD = records.filter(r => r.moneda === 'USD').reduce((acc, r) => acc + r.montoInversion, 0);
          const sumPEN = records.filter(r => r.moneda === 'PEN').reduce((acc, r) => acc + r.montoInversion, 0);
          const dias = records.length > 0 ? records[0].diasRestantes : 0;
          const info = getCorteInfo(fecha);

          let blockKey: 'bloque_1' | 'bloque_2' | 'bloque_3' | 'bloque_otros' = 'bloque_otros';
          let blockTitle = `📦 BLOQUE ${idx + 1}: CORTE POSTERIOR`;
          let badgeTag = 'Corte Posterior';
          let badgeColor = 'bg-slate-600 text-white';
          let borderColor = 'border-slate-200 dark:border-slate-800';
          let bgHeader = 'bg-slate-50/70 dark:bg-slate-900/50';

          if (idx === 0) {
            blockKey = 'bloque_1';
            blockTitle = '🥇 BLOQUE 1: SIGUIENTE CORTE INMEDIATO ("Mañana")';
            badgeTag = 'Corte Inmediato';
            badgeColor = 'bg-rose-600 text-white';
            borderColor = 'border-rose-200 dark:border-rose-900/60';
            bgHeader = 'bg-rose-50/70 dark:bg-rose-950/40';
          } else if (idx === 1) {
            blockKey = 'bloque_2';
            blockTitle = '🥈 BLOQUE 2: SUBSIGUIENTE CORTE ("Pasado Mañana")';
            badgeTag = 'Subsiguiente Corte';
            badgeColor = 'bg-amber-600 text-white';
            borderColor = 'border-amber-200 dark:border-amber-900/60';
            bgHeader = 'bg-amber-50/70 dark:bg-amber-950/40';
          } else if (idx === 2) {
            blockKey = 'bloque_3';
            blockTitle = '🥉 BLOQUE 3: TERCER CORTE ("Tras Pasado Mañana")';
            badgeTag = 'Tercer Corte';
            badgeColor = 'bg-blue-600 text-white';
            borderColor = 'border-blue-200 dark:border-blue-900/60';
            bgHeader = 'bg-blue-50/70 dark:bg-blue-950/40';
          }

          return {
            fecha,
            info,
            index: idx,
            blockKey,
            blockTitle,
            badgeTag,
            badgeColor,
            borderColor,
            bgHeader,
            diasRestantes: dias,
            records,
            sumUSD,
            sumPEN
          };
        });

        const renderContractCards = (list: ExpirationRecord[]) => {
          if (list.length === 0) {
            return (
              <div className="py-8 text-center text-slate-400 text-xs font-semibold bg-white dark:bg-[#151e2e] border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                No hay contratos registrados en este corte contable.
              </div>
            );
          }

          return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
              {list.map(exp => {
                const isSelected = selectedExpirations.has(exp.idContrato);
                const isUrgent = exp.diasRestantes <= 7;

                return (
                  <div 
                    key={exp.idContrato}
                    className={`border rounded-2xl p-5 transition-all relative overflow-hidden shadow-sm ${
                      isUrgent 
                        ? 'bg-rose-50/60 border-rose-300 ring-1 ring-rose-200' 
                        : exp.diasRestantes <= 30
                        ? 'bg-amber-50/40 border-amber-200'
                        : 'bg-white border-slate-200'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={exp.statusEnvio === 'sent'}
                        onChange={() => toggleSelectExpiration(exp.idContrato)}
                        className="mt-1 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer disabled:opacity-30"
                      />
                      <div className="flex-1 space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono font-bold text-xs text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                            {exp.idContrato}
                          </span>
                          <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wide ${
                            isUrgent 
                              ? 'bg-rose-100 text-rose-800 border border-rose-300' 
                              : exp.diasRestantes <= 30
                              ? 'bg-amber-100 text-amber-800 border border-amber-300'
                              : exp.diasRestantes <= 60
                              ? 'bg-blue-100 text-blue-800 border border-blue-200'
                              : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          }`}>
                            {exp.diasRestantes < 0 ? `Venció hace ${Math.abs(exp.diasRestantes)}d` : exp.diasRestantes === 0 ? '¡Vence Hoy!' : `⏳ Vence en ${exp.diasRestantes} días`}
                          </span>
                        </div>

                        <div>
                          <h3 className="font-bold text-slate-900 text-sm leading-tight">{exp.inversionistaNombre}</h3>
                          <div className="text-[11px] text-slate-500 font-mono mt-0.5">Doc: {exp.documentoIdentidad} • Fondo: {exp.fondoNombre} ({exp.tasaPactada}%)</div>
                        </div>

                        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 space-y-1 text-xs">
                          <div className="flex justify-between items-center">
                            <span className="text-slate-500">Monto Inversión:</span>
                            <span className="font-black text-slate-900">
                              {exp.moneda} {exp.montoInversion.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-[11px]">
                            <span className="text-slate-400">Fecha Vencimiento (Corte):</span>
                            <span className="font-mono font-bold text-slate-700">{exp.fechaFin}</span>
                          </div>
                          <div className="flex justify-between items-center text-[11px]">
                            <span className="text-slate-400">Asesor a Cargo:</span>
                            <span className="text-slate-700 font-medium">{exp.asesorNombre}</span>
                          </div>
                          {exp.inversionistaTelefono && (
                            <div className="flex justify-between items-center text-[11px]">
                              <span className="text-slate-400">Celular Partícipe:</span>
                              <span className="font-mono font-semibold text-emerald-700">+51 {exp.inversionistaTelefono}</span>
                            </div>
                          )}
                        </div>

                        <div className="pt-1 flex items-center justify-between">
                          <span className="text-[10px] text-slate-400 font-medium">
                            Contrato Activo
                          </span>
                          {exp.statusEnvio === 'sent' ? (
                            <span className="text-xs text-emerald-700 font-bold flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              <CheckCheck className="w-3.5 h-3.5 text-emerald-600" /> Alerta Enviada
                            </span>
                          ) : exp.statusEnvio === 'sending' ? (
                            <span className="text-xs text-amber-700 font-semibold animate-pulse">
                              Despachando...
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">Pendiente de Despacho</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        };

        return (
          <div className="space-y-6">
            {/* BANNER INFORMATIVO DE CORTES CONTABLES OFICIALES */}
            <div className="bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/80 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs text-indigo-950 dark:text-indigo-200 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold shadow-xs">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 font-bold text-sm text-indigo-900 dark:text-indigo-100">
                    <span>Tablero de Alertas por Cortes Contables Oficiales de InAndes</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-300 font-semibold">
                      Sincronizado Supabase
                    </span>
                  </div>
                  <p className="text-indigo-700 dark:text-indigo-300 mt-0.5">
                    Organización por cortes de liquidación (Inmediato, Subsiguiente y Tercer Corte). Cada bloque cuenta con su caja de configuración independiente de canales, destinatarios y frecuencia persistida en la tabla <code>crm_configuraciones</code>.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 font-mono text-[11px] bg-white dark:bg-slate-900 px-3 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-800 self-start md:self-auto font-bold text-indigo-800 dark:text-indigo-200">
                <Clock className="w-3.5 h-3.5 text-indigo-600" />
                <span>Cron VPS: 09:00 AM (UTC-5)</span>
              </div>
            </div>

            {/* MENSAJE DE CONFIRMACIÓN DE GUARDADO EN VIVO */}
            {configSuccessMsg && (
              <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-bold text-emerald-800 dark:text-emerald-200 flex items-center gap-2 shadow-xs animate-fadeIn">
                <Check className="w-4 h-4 text-emerald-600" />
                <span>{configSuccessMsg}</span>
              </div>
            )}

            {/* HEADER DE ACCIONES GLOBALES */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 md:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
              <div>
                <h2 className="text-base md:text-lg font-bold text-slate-900 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                  Gestión de Alertas de Vencimiento ({expirationRecords.length} Contratos Activos)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Seleccione contratos o configure individualmente las reglas de despacho por cada corte contable.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleDispatchExpirations(undefined, alertasConfig.bloque_1, 'Contratos Seleccionados')}
                  disabled={isDispatching || selectedExpirations.size === 0 || connectionState !== 'open'}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs md:text-sm font-bold bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-sm transition-all active:scale-95 cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  {isDispatching ? 'Despachando...' : `Despachar Selección Global (${selectedExpirations.size})`}
                </button>
              </div>
            </div>

            {/* ========================================================================= */}
            {/* RENDERIZADO DE BLOQUES DE CORTE CONTABLE (1: Inmediato, 2: Sub, 3: Tercer) */}
            {/* ========================================================================= */}
            {bloquesCortes.map((bloque) => {
              const bKey = bloque.blockKey;
              const cfg = alertasConfig[bKey] || DEFAULT_CORTES_CONFIG[bKey] || DEFAULT_CORTES_CONFIG.bloque_otros;
              const isAccordionOpen = openAccordions[`corte_${bKey}`] !== false;

              return (
                <div 
                  key={bloque.fecha}
                  className={`border rounded-2xl overflow-hidden bg-white shadow-sm transition-all ${bloque.borderColor}`}
                >
                  {/* CABECERA PRINCIPAL DEL CORTE */}
                  <div 
                    onClick={() => toggleAccordion(`corte_${bKey}`)}
                    className={`p-4 md:p-5 ${bloque.bgHeader} border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer select-none hover:opacity-95 transition-all`}
                  >
                    <div className="flex items-start md:items-center gap-3.5">
                      <div className={`px-3 py-1.5 rounded-xl font-black text-xs uppercase tracking-wider shadow-xs ${bloque.badgeColor}`}>
                        {bloque.badgeTag}
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm md:text-base">
                            {bloque.blockTitle}
                          </h3>
                          <span className="font-mono font-bold text-xs text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-900/60 px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-800">
                            📅 {bloque.info.label} • {bloque.info.periodo}
                          </span>
                        </div>
                        <div className="text-xs text-slate-600 dark:text-slate-300 font-medium mt-1 flex flex-wrap gap-3 items-center">
                          <span>Contratos: <b>{bloque.records.length}</b></span>
                          <span>•</span>
                          <span>USD: <b>${bloque.sumUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })}</b></span>
                          <span>•</span>
                          <span>PEN: <b>S/ {bloque.sumPEN.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</b></span>
                          <span>•</span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {bloque.diasRestantes < 0 
                              ? `⚠️ Venció hace ${Math.abs(bloque.diasRestantes)}d` 
                              : bloque.diasRestantes === 0 
                              ? '¡Vence Hoy!' 
                              : `⏳ Vence en ${bloque.diasRestantes} días`}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end md:self-auto">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          selectGroupExpirations(bloque.records);
                        }}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all cursor-pointer shadow-xs"
                      >
                        Seleccionar Todo Corte
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDispatchExpirations(bloque.records, cfg, bloque.info.label);
                        }}
                        disabled={isDispatching || connectionState !== 'open' || bloque.records.length === 0}
                        className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Despachar Corte</span>
                      </button>
                      <div className="p-1 text-slate-500">
                        {isAccordionOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                      </div>
                    </div>
                  </div>

                  {/* ========================================================================= */}
                  {/* BOX DE CONFIGURACIÓN PERSISTENTE (CANAL, DESTINATARIOS, FRECUENCIA)       */}
                  {/* ========================================================================= */}
                  <div className="p-4 md:p-5 bg-slate-50/50 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-800 space-y-4">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-indigo-600" />
                        <span className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide">
                          ⚙️ Parámetros de Envío Automático para este Corte (Persistido en Supabase):
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {savingConfigKey === bKey ? (
                          <span className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold animate-pulse flex items-center gap-1">
                            <Clock className="w-3 h-3 animate-spin" /> Guardando en Supabase...
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400 font-mono">
                            Clave: crm_configuraciones &gt; {bKey}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* 1. CANAL / MEDIO */}
                      <div className="bg-white dark:bg-slate-800/80 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2.5 shadow-xs">
                        <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-tight flex items-center gap-1.5">
                          <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
                          1. Medio / Canales de Envío:
                        </span>
                        <div className="flex flex-wrap gap-2">
                          <label className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold cursor-pointer transition-all ${
                            cfg.canales.whatsapp 
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-400 text-emerald-900 dark:text-emerald-200 ring-1 ring-emerald-300' 
                              : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400'
                          }`}>
                            <input
                              type="checkbox"
                              checked={cfg.canales.whatsapp}
                              onChange={(e) => updateBlockConfig(bKey, prev => ({
                                ...prev,
                                canales: { ...prev.canales, whatsapp: e.target.checked }
                              }))}
                              className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                            />
                            <span>WhatsApp</span>
                          </label>

                          <label className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold cursor-pointer transition-all ${
                            cfg.canales.email 
                              ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-400 text-blue-900 dark:text-blue-200 ring-1 ring-blue-300' 
                              : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400'
                          }`}>
                            <input
                              type="checkbox"
                              checked={cfg.canales.email}
                              onChange={(e) => updateBlockConfig(bKey, prev => ({
                                ...prev,
                                canales: { ...prev.canales, email: e.target.checked }
                              }))}
                              className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                            />
                            <Mail className="w-3.5 h-3.5 text-blue-600" />
                            <span>Correo Electrónico</span>
                          </label>
                        </div>
                      </div>

                      {/* 2. DESTINATARIOS (4 CHECKBOXES) */}
                      <div className="bg-white dark:bg-slate-800/80 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2.5 shadow-xs">
                        <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-tight flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-indigo-600" />
                          2. Destinatarios de la Alerta:
                        </span>
                        <div className="grid grid-cols-2 gap-2">
                          <label className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-bold cursor-pointer transition-all ${
                            cfg.destinatarios.ricardo 
                              ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-400 text-indigo-900 dark:text-indigo-200' 
                              : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400'
                          }`}>
                            <input
                              type="checkbox"
                              checked={cfg.destinatarios.ricardo}
                              onChange={(e) => updateBlockConfig(bKey, prev => ({
                                ...prev,
                                destinatarios: { ...prev.destinatarios, ricardo: e.target.checked }
                              }))}
                              className="w-3.5 h-3.5 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            />
                            <span>Ricardo Gallo</span>
                          </label>

                          <label className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-bold cursor-pointer transition-all ${
                            cfg.destinatarios.yanneth 
                              ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-400 text-indigo-900 dark:text-indigo-200' 
                              : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400'
                          }`}>
                            <input
                              type="checkbox"
                              checked={cfg.destinatarios.yanneth}
                              onChange={(e) => updateBlockConfig(bKey, prev => ({
                                ...prev,
                                destinatarios: { ...prev.destinatarios, yanneth: e.target.checked }
                              }))}
                              className="w-3.5 h-3.5 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            />
                            <span>Yanneth Parra</span>
                          </label>

                          <label className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-bold cursor-pointer transition-all ${
                            cfg.destinatarios.asesor 
                              ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-400 text-indigo-900 dark:text-indigo-200' 
                              : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400'
                          }`}>
                            <input
                              type="checkbox"
                              checked={cfg.destinatarios.asesor}
                              onChange={(e) => updateBlockConfig(bKey, prev => ({
                                ...prev,
                                destinatarios: { ...prev.destinatarios, asesor: e.target.checked }
                              }))}
                              className="w-3.5 h-3.5 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            />
                            <span>Asesor a Cargo</span>
                          </label>

                          <label className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-bold cursor-pointer transition-all ${
                            cfg.destinatarios.participe 
                              ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-400 text-purple-900 dark:text-purple-200' 
                              : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400'
                          }`}>
                            <input
                              type="checkbox"
                              checked={cfg.destinatarios.participe}
                              onChange={(e) => updateBlockConfig(bKey, prev => ({
                                ...prev,
                                destinatarios: { ...prev.destinatarios, participe: e.target.checked }
                              }))}
                              className="w-3.5 h-3.5 rounded text-purple-600 focus:ring-purple-500 cursor-pointer"
                            />
                            <span>Partícipe Titular</span>
                          </label>
                        </div>
                      </div>

                      {/* 3. FRECUENCIA */}
                      <div className="bg-white dark:bg-slate-800/80 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2.5 shadow-xs">
                        <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-tight flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-amber-600" />
                          3. Frecuencia de Despacho:
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {(['diaria', 'semanal', 'quincenal'] as const).map(frec => (
                            <label 
                              key={frec}
                              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold capitalize cursor-pointer transition-all ${
                                cfg.frecuencia === frec 
                                  ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-400 text-amber-900 dark:text-amber-200 ring-1 ring-amber-300' 
                                  : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400'
                              }`}
                            >
                              <input
                                type="radio"
                                name={`frec_${bKey}`}
                                value={frec}
                                checked={cfg.frecuencia === frec}
                                onChange={() => updateBlockConfig(bKey, prev => ({ ...prev, frecuencia: frec }))}
                                className="w-3.5 h-3.5 text-amber-600 focus:ring-amber-500 cursor-pointer"
                              />
                              <span>{frec === 'diaria' ? 'Diaria' : frec === 'semanal' ? 'Semanal (Lun)' : 'Quincenal'}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ========================================================================= */}
                  {/* LISTA DE CONTRATOS EN EL ACORDEÓN                                         */}
                  {/* ========================================================================= */}
                  {isAccordionOpen && (
                    <div className="p-4 md:p-5 bg-white dark:bg-slate-900/60">
                      {renderContractCards(bloque.records)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* CONTENIDO PESTAÑA 4: PADRÓN DE PARTÍCIPES & 3FA */}
      {activeTab === 'participes' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-sm">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-600" />
                Padrón de Partícipes Registrados en Supabase
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Datos sincronizados para la autenticación 3FA y despacho automatizado.
              </p>
            </div>
            <span className="text-xs font-mono text-indigo-700 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-200 font-semibold">
              Total: {inversionistas.length} Partícipes
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 uppercase font-semibold text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="p-3">Código</th>
                  <th className="p-3">Nombre Completo</th>
                  <th className="p-3">DNI</th>
                  <th className="p-3">Celular Registrado</th>
                  <th className="p-3">Email</th>
                  <th className="p-3">F. Nacimiento</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {inversionistas.map(i => (
                  <tr key={i.codigo_inversionista || i.documento_identidad} className="hover:bg-slate-50">
                    <td className="p-3 font-mono text-indigo-600 font-medium">{i.codigo_inversionista || '-'}</td>
                    <td className="p-3 font-semibold text-slate-900">{i.nombre_completo}</td>
                    <td className="p-3 font-mono text-slate-600">{i.documento_identidad}</td>
                    <td className="p-3 font-mono text-emerald-700 font-medium">{i.telefono ? `+51 ${i.telefono}` : <span className="text-slate-400">No asignado</span>}</td>
                    <td className="p-3 text-slate-500">{i.email || '-'}</td>
                    <td className="p-3 font-mono text-slate-500">{i.fecha_nacimiento || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CONTENIDO PESTAÑA 4: ARQUITECTURA & ESTADO */}
      {activeTab === 'conexion' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-sm">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Bot className="w-5 h-5 text-teal-600" />
              Estado de Microservicios en Contabo VPS
            </h2>

            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-700 font-medium">Evolution API v2.2.3</span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  {connectionState.toUpperCase()}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-700 font-medium">Microservicio Bot FastAPI</span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  PUERTO 8085 / ACTIVO
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-700 font-medium">Traefik Reverse Proxy SSL</span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  https://inandes.geeksoft.tech/wa-api
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-700 font-medium">Instancia Oficial Conectada</span>
                <span className="font-mono text-slate-800 font-semibold">{INSTANCE_NAME}</span>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={fetchQrCode}
                className="w-full py-3 rounded-xl text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm flex items-center justify-center gap-2 transition-all active:scale-95"
              >
                <QrCode className="w-4 h-4" />
                Generar Código QR de Reconexión
              </button>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-sm">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              Reglas Intangibles del Bot Inbound (3FA)
            </h2>
            <div className="space-y-2 text-xs text-slate-600 leading-relaxed">
              <p>• <b>Determinismo 100%:</b> Las respuestas de saldos, retenciones y certificados se calculan exclusivamente a partir del Ledger en Supabase.</p>
              <p>• <b>Anti-Link Formatting:</b> Los DNIs se muestran con prefijo <code>DNI-</code> y dummies de la serie <code>09</code> para prevenir auto-linking verde en WhatsApp Web.</p>
              <p>• <b>Compilación de PDFs Oficiales:</b> El motor ReportLab genera en memoria el EECC y el Certificado de Retención con la firma digital de Juan Ricardo Gallo Pizarro y el logo de InAndes.</p>
              <p>• <b>Asesor Asignado:</b> La opción 4 resuelve dinámicamente el asesor del contrato y genera un link directo de WhatsApp.</p>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE QR (100% PRESERVADO Y CON LOOK LIGHT) */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl space-y-6 relative animate-in fade-in zoom-in duration-200">
            <button
              onClick={() => setShowQrModal(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto border border-indigo-200">
                <QrCode className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-slate-900">Vincular Chip InAndes Oficial</h3>
              <p className="text-xs text-slate-500">
                Abre WhatsApp en el celular corporativo &gt; Dispositivos Vinculados &gt; Escanear código QR.
              </p>
            </div>

            <div className="flex items-center justify-center min-h-[260px] bg-slate-50 rounded-2xl border border-slate-200 p-4">
              {loadingQr ? (
                <div className="flex flex-col items-center gap-3 text-slate-500">
                  <RefreshCw className="w-8 h-8 animate-spin text-indigo-600" />
                  <span className="text-xs">Generando código QR seguro...</span>
                </div>
              ) : qrError ? (
                <div className="flex flex-col items-center gap-2 text-rose-600 text-center px-4">
                  <AlertTriangle className="w-8 h-8" />
                  <span className="text-xs">{qrError}</span>
                  <button
                    onClick={fetchQrCode}
                    className="mt-2 text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-200 text-slate-700 hover:bg-slate-300"
                  >
                    Reintentar
                  </button>
                </div>
              ) : qrBase64 ? (
                <div className="p-3 bg-white rounded-xl shadow-md border border-slate-200">
                  <img
                    src={qrBase64.startsWith('data:') ? qrBase64 : `data:image/png;base64,${qrBase64}`}
                    alt="WhatsApp QR Code"
                    className="w-56 h-56 object-contain"
                  />
                </div>
              ) : (
                <div className="text-xs text-slate-400">Sin código QR disponible.</div>
              )}
            </div>

            <div className="flex items-center justify-between pt-2 text-xs">
              <span className="text-slate-500 font-mono">Instancia: {INSTANCE_NAME}</span>
              <button
                onClick={checkConnectionState}
                className="text-indigo-600 hover:underline font-semibold"
              >
                Verificar Conexión
              </button>
            </div>
          </div>
        </div>
      )}
      {/* MODAL DE CONFIGURACIÓN / EDICIÓN DE PLANTILLA DE CUMPLEAÑOS */}
      {showBirthdayTemplateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 max-w-4xl w-full shadow-2xl space-y-6 relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowBirthdayTemplateModal(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1">
              <div className="flex items-center gap-2 text-pink-600 dark:text-pink-400">
                <Cake className="w-6 h-6" />
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  Plantilla de Saludo Institucional por WhatsApp
                </h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Personalice el mensaje que el Bot despachará automáticamente a las 08:30 AM y en contingencias manuales.
              </p>
            </div>

            {/* GUÍA DE VARIABLES */}
            <div className="bg-pink-50/70 dark:bg-pink-950/30 border border-pink-200 dark:border-pink-900/40 rounded-2xl p-3.5 space-y-2">
              <span className="text-[11px] font-bold text-pink-900 dark:text-pink-300 uppercase tracking-tight block">
                Variables dinámicas disponibles (haz clic para insertar):
              </span>
              <div className="flex flex-wrap gap-2">
                {[
                  { tag: '{primerNombre}', desc: 'Primer Nombre (ej. Juan)' },
                  { tag: '{nombre}', desc: 'Nombre Completo' },
                  { tag: '{edad}', desc: 'Años cumplidos' },
                  { tag: '{documento}', desc: 'DNI / RUC' },
                ].map(v => (
                  <button
                    key={v.tag}
                    type="button"
                    onClick={() => setTempBirthdayTemplate(prev => prev + ' ' + v.tag)}
                    className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-white dark:bg-slate-800 border border-pink-200 dark:border-pink-800 text-pink-700 dark:text-pink-300 hover:bg-pink-100 dark:hover:bg-pink-900/40 transition-colors shadow-xs cursor-pointer flex items-center gap-1"
                  >
                    <span>{v.tag}</span>
                    <span className="text-[10px] text-slate-400 font-sans">({v.desc})</span>
                  </button>
                ))}
              </div>
            </div>

            {/* CUERPO DEL EDITOR Y PREVIEW */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Columna Izquierda: Textarea */}
              <div className="space-y-2 flex flex-col">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-tight flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-slate-400" />
                  Editor de Plantilla
                </label>
                <textarea
                  value={tempBirthdayTemplate}
                  onChange={(e) => setTempBirthdayTemplate(e.target.value)}
                  rows={12}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 text-xs font-mono text-slate-800 dark:text-slate-200 focus:outline-none focus:border-pink-500 leading-relaxed shadow-inner resize-none flex-1"
                  placeholder="Redacta el saludo aquí..."
                />
              </div>

              {/* Columna Derecha: Mockup WhatsApp */}
              <div className="space-y-2 flex flex-col">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-tight flex items-center gap-1.5">
                  <Smartphone className="w-4 h-4 text-emerald-600" />
                  Previsualización en WhatsApp
                </label>
                <div className="bg-[#e5ddd5] dark:bg-[#0b141a] rounded-2xl p-4 border border-slate-300 dark:border-slate-800 shadow-inner flex flex-col justify-end flex-1 min-h-[280px]">
                  <div className="bg-white dark:bg-[#202c33] p-3.5 rounded-2xl rounded-tl-none shadow-sm max-w-full space-y-2 border border-slate-200/60 dark:border-slate-700/60 text-slate-800 dark:text-slate-100 text-xs whitespace-pre-wrap leading-relaxed">
                    {formatBirthdayMessage(tempBirthdayTemplate, {
                      codigo: 'DNI00000001',
                      nombre: 'Juan Ricardo Gallo González',
                      primerNombre: 'Juan Ricardo',
                      documento: '02816271',
                      tipoDoc: 'DNI',
                      fechaNacimiento: '1981-09-04',
                      edad: 45,
                      dia: 4,
                      mes: 9,
                      esHoy: true,
                      telefono: '51992778175',
                      statusEnvio: 'idle'
                    })}
                    <div className="text-[10px] text-slate-400 text-right font-sans pt-1">
                      {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ✓✓
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {templateSaveSuccess && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-2 animate-fadeIn">
                <Check className="w-4 h-4" />
                <span>Plantilla guardada y actualizada exitosamente en el sistema.</span>
              </div>
            )}

            {/* BOTONES DE ACCIÓN */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setTempBirthdayTemplate(DEFAULT_BIRTHDAY_TEMPLATE)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
              >
                Restablecer por Defecto
              </button>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowBirthdayTemplateModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Cerrar
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setBirthdayTemplate(tempBirthdayTemplate);
                    if (typeof window !== 'undefined') {
                      localStorage.setItem('inandes_wa_birthday_template', tempBirthdayTemplate);
                    }
                    setTemplateSaveSuccess(true);
                    setTimeout(() => setShowBirthdayTemplateModal(false), 800);
                  }}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-pink-600 hover:bg-pink-700 text-white shadow transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
                >
                  <Check className="w-4 h-4" />
                  <span>💾 Guardar Plantilla</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default ChatWhatsAppPage;
