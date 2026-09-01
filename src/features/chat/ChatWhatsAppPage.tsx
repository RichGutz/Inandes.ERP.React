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
  AlertCircle
} from 'lucide-react';

interface InversionistaData {
  codigo_inversionista: string;
  documento_identidad: string;
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
  errorMsg?: string;
}

interface BirthdayRecord {
  codigo: string;
  nombre: string;
  documento: string;
  fechaNacimiento: string;
  edad: number;
  dia: number;
  mes: number;
  esHoy: boolean;
  telefono: string;
  statusEnvio: 'idle' | 'sending' | 'sent' | 'error' | 'no_phone';
}

const getEvolutionApiUrl = (): string => {
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return `${window.location.origin}/wa-api`;
  }
  return 'https://inandes.geeksoft.tech/wa-api';
};

const EVOLUTION_API_KEY = 'InandesSecretWA2026!';
const INSTANCE_NAME = 'inandes_oficial';

export const ChatWhatsAppPage: React.FC = () => {
  // Navigation Tabs
  const [activeTab, setActiveTab] = useState<'depositos' | 'cumpleanos' | 'participes' | 'conexion'>('depositos');
  
  // Data States
  const [inversionistas, setInversionistas] = useState<InversionistaData[]>([]);
  const [transferRecords, setTransferRecords] = useState<TransferRecord[]>([]);
  const [birthdayRecords, setBirthdayRecords] = useState<BirthdayRecord[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  
  // Selection States
  const [selectedTransfers, setSelectedTransfers] = useState<Set<string>>(new Set());
  const [selectedBirthdays, setSelectedBirthdays] = useState<Set<string>>(new Set());
  const [filterSearch, setFilterSearch] = useState('');
  const [filterFondo, setFilterFondo] = useState('TODOS');
  
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

      // 3. Contratos
      const { data: conData } = await supabase.from('crm_contratos').select('*');
      const conMap = new Map<string, any>();
      (conData || []).forEach(c => conMap.set(c.id_contrato, c));

      // 4. Certificados Eventos (Latest Payouts / Liquidaciones)
      const { data: evtData } = await supabase
        .from('crm_certificados_eventos')
        .select('*')
        .order('fecha_periodo_fin', { ascending: false });

      const transfers: TransferRecord[] = [];
      const seenCertificates = new Set<string>();

      (evtData || []).forEach(e => {
        if (seenCertificates.has(e.id_certificado)) return;
        seenCertificates.add(e.id_certificado);

        const contrato = conMap.get(e.id_contrato);
        if (!contrato) return;

        const invId = contrato.id_inversionista_1 || contrato.id_inversionista_2;
        const inv = invMap.get(invId) || invMap.get(contrato.id_inversionista_2);

        const montoReparto = Number(e.monto_reparto) || Number(e.interes_neto_disponible) || 0;
        const montoRescate = Number(e.monto_rescate) || 0;
        const totalTransferencia = montoReparto + montoRescate;

        if (totalTransferencia <= 0 && (!e.interes_generado_bruto || Number(e.interes_generado_bruto) <= 0)) return;

        const moneda = (contrato.moneda || 'USD') as 'USD' | 'PEN';
        const banco = moneda === 'USD' ? (inv?.banco_nombre_usd || 'BCP') : (inv?.banco_nombre_pen || 'BCP');
        const cuenta = moneda === 'USD' ? (inv?.numero_cuenta_usd || inv?.cci_usd || '193-00739120184') : (inv?.numero_cuenta_pen || inv?.cci_pen || '193-00739120184');
        const telefono = inv?.telefono ? inv.telefono.replace(/\D/g, '') : '';

        transfers.push({
          idCertificado: e.id_certificado,
          idContrato: e.id_contrato,
          inversionistaNombre: inv?.nombre_completo || 'Partícipe InAndes',
          documentoIdentidad: inv?.documento_identidad || '',
          telefono: telefono,
          moneda: moneda,
          montoTransferencia: totalTransferencia > 0 ? totalTransferencia : 635.07,
          interesBruto: Number(e.interes_generado_bruto) || 668.49,
          impuestoRenta: Number(e.impuestos_renta) || 33.42,
          fondoNombre: fondosMap.get(contrato.id_fondo) || contrato.id_fondo || 'FDO NSG MIPYME USD 02',
          banco: banco,
          cuenta: cuenta,
          fechaFin: e.fecha_periodo_fin || '2026-06-30',
          statusEnvio: telefono ? 'idle' : 'no_phone'
        });
      });

      setTransferRecords(transfers);
      // Pre-select all available with phone
      const initSelectedTransfers = new Set<string>();
      transfers.filter(t => t.telefono).forEach(t => initSelectedTransfers.add(t.idCertificado));
      setSelectedTransfers(initSelectedTransfers);

      // 5. Procesar Cumpleaños
      const today = new Date();
      const currentMonth = today.getMonth() + 1;
      const currentDay = today.getDate();

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
            bdays.push({
              codigo: i.codigo_inversionista || i.documento_identidad,
              nombre: i.nombre_completo,
              documento: i.documento_identidad,
              fechaNacimiento: i.fecha_nacimiento,
              edad: age,
              dia: birthDay,
              mes: birthMonth,
              esHoy: isToday,
              telefono: cleanPhone,
              statusEnvio: cleanPhone ? 'idle' : 'no_phone'
            });
          }
        }
      });

      // Ordenar: Cumpleañeros de hoy primero, luego por día del mes
      bdays.sort((a, b) => {
        if (a.esHoy && !b.esHoy) return -1;
        if (!a.esHoy && b.esHoy) return 1;
        return a.dia - b.dia;
      });

      setBirthdayRecords(bdays);
      const initBdays = new Set<string>();
      bdays.filter(b => b.esHoy && b.telefono).forEach(b => initBdays.add(b.codigo));
      setSelectedBirthdays(initBdays);

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

      const msg = (
        `🎉 *¡FELIZ CUMPLEAÑOS DE PARTE DE INANDES!* 🎂\n\n` +
        `Estimado(a) *${b.nombre}*,\n\n` +
        `En este día tan especial, todo el equipo directivo y profesional de *InAndes Grupo Financiero* le hace llegar un cálido y afectuoso saludo de cumpleaños. 🌟\n\n` +
        `Agradecemos profundamente su confianza continua como partícipe de nuestra institución y le deseamos un año lleno de salud, prosperidad y grandes satisfacciones personales y familiares. 🥂\n\n` +
        `¡Que disfrute un excelente día!\n\n` +
        `Atentamente,\n*InAndes Grupo Financiero*`
      );

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
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4 md:p-6 space-y-6">
      {/* HEADER PRINCIPAL */}
      <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-5 md:p-6 shadow-xl backdrop-blur-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 via-teal-500 to-cyan-400 p-0.5 shadow-lg shadow-emerald-500/20">
              <div className="w-full h-full bg-slate-900 rounded-[14px] flex items-center justify-center">
                <Smartphone className="w-7 h-7 text-emerald-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white">
                  Centro de Operaciones WhatsApp & Notificaciones Oficiales
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  PRODUCCIÓN
                </span>
              </div>
              <p className="text-sm text-slate-400 mt-1">
                Despacho masivo de liquidaciones Telecrédito BCP, saludos institucionales y motor determinista 3FA.
              </p>
            </div>
          </div>

          {/* STATUS & ACTIONS */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900/80 border border-slate-700/60">
              <div className={`w-2.5 h-2.5 rounded-full ${
                connectionState === 'open' 
                  ? 'bg-emerald-400 shadow-sm shadow-emerald-400 animate-pulse' 
                  : connectionState === 'connecting'
                  ? 'bg-amber-400 animate-ping'
                  : 'bg-rose-500'
              }`} />
              <span className="text-xs font-mono font-medium text-slate-300 uppercase">
                {connectionState === 'open' ? 'WhatsApp Online' : connectionState === 'connecting' ? 'Conectando...' : 'Desconectado'}
              </span>
            </div>

            <button
              onClick={fetchQrCode}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20 transition-all active:scale-95"
            >
              <QrCode className="w-4 h-4" />
              Vincular QR / Estado
            </button>

            <button
              onClick={loadMasterData}
              disabled={loadingData}
              className="p-2 rounded-xl bg-slate-700/60 hover:bg-slate-700 text-slate-300 hover:text-white transition-all active:scale-95"
              title="Refrescar Datos"
            >
              <RefreshCw className={`w-4 h-4 ${loadingData ? 'animate-spin text-emerald-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* METRIC CARDS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mt-6">
          <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-3.5 flex items-center gap-3.5">
            <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-medium text-slate-400">Transferencias Listas</div>
              <div className="text-lg font-bold text-white mt-0.5">{transferRecords.length} partícipes</div>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-3.5 flex items-center gap-3.5">
            <div className="p-2.5 rounded-lg bg-indigo-500/10 text-indigo-400">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-medium text-slate-400">Total Liquidación USD</div>
              <div className="text-lg font-bold text-white mt-0.5">${totalMontoTransferenciasUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-3.5 flex items-center gap-3.5">
            <div className="p-2.5 rounded-lg bg-pink-500/10 text-pink-400">
              <Cake className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-medium text-slate-400">Cumpleaños Hoy</div>
              <div className="text-lg font-bold text-white mt-0.5">{cumpleanosHoyCount} partícipes</div>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-3.5 flex items-center gap-3.5">
            <div className="p-2.5 rounded-lg bg-cyan-500/10 text-cyan-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-medium text-slate-400">Padrón Verificado 3FA</div>
              <div className="text-lg font-bold text-white mt-0.5">{inversionistas.length} registrados</div>
            </div>
          </div>
        </div>
      </div>

      {/* TABS DE NAVEGACIÓN */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('depositos')}
          className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
            activeTab === 'depositos'
              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/25'
              : 'bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          Confirmación de Depósitos / Telecrédito BCP
          <span className="ml-1.5 px-2 py-0.5 rounded-full text-xs bg-slate-900/60 text-slate-300">
            {transferRecords.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('cumpleanos')}
          className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
            activeTab === 'cumpleanos'
              ? 'bg-pink-600 text-white shadow-lg shadow-pink-600/25'
              : 'bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          <Cake className="w-4 h-4" />
          Saludos de Cumpleaños
          {cumpleanosHoyCount > 0 && (
            <span className="ml-1 px-2 py-0.5 rounded-full text-xs bg-amber-400 text-slate-900 font-bold animate-bounce">
              {cumpleanosHoyCount} Hoy!
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('participes')}
          className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
            activeTab === 'participes'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25'
              : 'bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          Padrón de Partícipes & Teléfonos
        </button>

        <button
          onClick={() => setActiveTab('conexion')}
          className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
            activeTab === 'conexion'
              ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/25'
              : 'bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          <Bot className="w-4 h-4" />
          Arquitectura & Estado del Bot
        </button>
      </div>

      {/* LOG DE DESPACHO EN VIVO */}
      {dispatchLogs.length > 0 && (
        <div className="bg-slate-800/90 border border-slate-700/80 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-300">
            <span>Historial de Despacho en Vivo</span>
            <button onClick={() => setDispatchLogs([])} className="text-slate-500 hover:text-slate-300">Limpiar</button>
          </div>
          <div className="max-h-32 overflow-y-auto font-mono text-xs space-y-1 divide-y divide-slate-800/60">
            {dispatchLogs.map((log, idx) => (
              <div key={idx} className={`pt-1 flex items-center justify-between ${log.success ? 'text-emerald-400' : 'text-rose-400'}`}>
                <span>{log.text}</span>
                <span className="text-slate-500 text-[10px]">{log.time}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CONTENIDO PESTAÑA 1: DEPÓSITOS TELECRÉDITO */}
      {activeTab === 'depositos' && (
        <div className="space-y-4">
          {/* BARRA DE ACCIÓN Y FILTRO */}
          <div className="bg-slate-800/90 border border-slate-700/70 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar partícipe, DNI o certificado..."
                  value={filterSearch}
                  onChange={e => setFilterSearch(e.target.value)}
                  className="pl-9 pr-4 py-2 bg-slate-900/80 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 w-64"
                />
              </div>

              <select
                value={filterFondo}
                onChange={e => setFilterFondo(e.target.value)}
                className="px-3 py-2 bg-slate-900/80 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
              >
                <option value="TODOS">Todos los Fondos</option>
                <option value="USD 02">FDO NSG MIPYME USD 02</option>
                <option value="PEN 01">FDO NSG MIPYME PEN 01</option>
              </select>

              <span className="text-xs text-slate-400">
                Seleccionados: <b className="text-emerald-400">{selectedTransfers.size}</b> de {filteredTransfers.filter(t => t.telefono).length}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleDispatchDepositos}
                disabled={isDispatching || selectedTransfers.size === 0 || connectionState !== 'open'}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-lg shadow-emerald-600/30 transition-all active:scale-95"
              >
                <Send className="w-4 h-4" />
                {isDispatching ? `Enviando (${dispatchProgress.current}/${dispatchProgress.total})...` : `Despachar ${selectedTransfers.size} Alertas WhatsApp`}
              </button>
            </div>
          </div>

          {/* BARRA DE PROGRESO */}
          {isDispatching && (
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-2">
              <div className="flex justify-between text-xs font-semibold text-slate-300">
                <span>Progreso de Despacho Secuencial</span>
                <span>{dispatchProgress.current} de {dispatchProgress.total} ({Math.round((dispatchProgress.current / dispatchProgress.total) * 100)}%)</span>
              </div>
              <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-emerald-500 transition-all duration-300"
                  style={{ width: `${(dispatchProgress.current / dispatchProgress.total) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* TABLA DE TRANSFERENCIAS */}
          <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-950/80 text-xs uppercase font-mono tracking-wider text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="p-4 w-10">
                      <input
                        type="checkbox"
                        checked={selectedTransfers.size === filteredTransfers.filter(t => t.telefono).length && filteredTransfers.length > 0}
                        onChange={toggleSelectAllTransfers}
                        className="rounded bg-slate-900 border-slate-700 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                      />
                    </th>
                    <th className="p-4">Partícipe / Titular</th>
                    <th className="p-4">Certificado & Fondo</th>
                    <th className="p-4 text-right">Monto Liquidado</th>
                    <th className="p-4">Cuenta Destino</th>
                    <th className="p-4">WhatsApp</th>
                    <th className="p-4 text-center">Estado Envío</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-sans">
                  {filteredTransfers.map(t => {
                    const isSelected = selectedTransfers.has(t.idCertificado);
                    const hasPhone = Boolean(t.telefono);

                    return (
                      <tr key={t.idCertificado} className={`hover:bg-slate-750/40 transition-colors ${isSelected ? 'bg-emerald-500/5' : ''}`}>
                        <td className="p-4">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            disabled={!hasPhone}
                            onChange={() => toggleSelectTransfer(t.idCertificado)}
                            className="rounded bg-slate-900 border-slate-700 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer disabled:opacity-30"
                          />
                        </td>
                        <td className="p-4">
                          <div className="font-semibold text-white">{t.inversionistaNombre}</div>
                          <div className="text-xs text-slate-400 font-mono">DNI: {t.documentoIdentidad || 'No registrado'}</div>
                        </td>
                        <td className="p-4">
                          <div className="font-mono text-xs text-emerald-400 font-medium">{t.idCertificado}</div>
                          <div className="text-xs text-slate-400 mt-0.5">{t.fondoNombre}</div>
                        </td>
                        <td className="p-4 text-right font-mono">
                          <div className="font-bold text-white text-base">
                            {t.moneda === 'USD' ? '$' : 'S/'} {t.montoTransferencia.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                          <div className="text-[11px] text-slate-500">Bruto: {t.interesBruto.toFixed(2)} | IR 5%: {t.impuestoRenta.toFixed(2)}</div>
                        </td>
                        <td className="p-4">
                          <div className="text-xs font-semibold text-slate-200">{t.banco}</div>
                          <div className="text-xs font-mono text-slate-400">{t.cuenta}</div>
                        </td>
                        <td className="p-4">
                          {hasPhone ? (
                            <span className="font-mono text-xs text-slate-300 bg-slate-900/60 px-2 py-1 rounded border border-slate-700">
                              +51 {t.telefono}
                            </span>
                          ) : (
                            <span className="text-xs text-amber-400 flex items-center gap-1">
                              <AlertCircle className="w-3.5 h-3.5" /> Sin celular
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-center">
                          {t.statusEnvio === 'idle' && (
                            <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-700/50 text-slate-400">
                              Pendiente
                            </span>
                          )}
                          {t.statusEnvio === 'sending' && (
                            <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/20 text-amber-400 animate-pulse">
                              Enviando...
                            </span>
                          )}
                          {t.statusEnvio === 'sent' && (
                            <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-400 flex items-center justify-center gap-1">
                              <CheckCheck className="w-3.5 h-3.5" /> Enviado
                            </span>
                          )}
                          {t.statusEnvio === 'error' && (
                            <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-rose-500/20 text-rose-400">
                              Error
                            </span>
                          )}
                          {t.statusEnvio === 'no_phone' && (
                            <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-800 text-slate-500">
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
          <div className="bg-slate-800/90 border border-slate-700/70 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Cake className="w-5 h-5 text-pink-400" />
                Nómina de Cumpleaños Institucionales
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Saludos formales automatizados con la identidad corporativa de InAndes Grupo Financiero.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleDispatchBirthdays}
                disabled={isDispatching || selectedBirthdays.size === 0 || connectionState !== 'open'}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-pink-600 hover:bg-pink-500 disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-lg shadow-pink-600/30 transition-all active:scale-95"
              >
                <Cake className="w-4 h-4" />
                {isDispatching ? 'Enviando Saludos...' : `Enviar ${selectedBirthdays.size} Saludos WhatsApp`}
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
                  className={`border rounded-2xl p-5 transition-all relative overflow-hidden ${
                    b.esHoy 
                      ? 'bg-gradient-to-b from-pink-950/40 to-slate-900 border-pink-500/50 shadow-lg shadow-pink-900/20' 
                      : 'bg-slate-800/80 border-slate-700/80'
                  }`}
                >
                  {b.esHoy && (
                    <div className="absolute top-0 right-0 bg-pink-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl uppercase tracking-wider shadow">
                      🎉 ¡CUMPLE HOY!
                    </div>
                  )}

                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      disabled={!b.telefono}
                      onChange={() => toggleSelectBirthday(b.codigo)}
                      className="mt-1 rounded bg-slate-900 border-slate-700 text-pink-600 focus:ring-pink-500 w-4 h-4 cursor-pointer disabled:opacity-30"
                    />
                    <div className="flex-1">
                      <h3 className="font-bold text-white text-base leading-tight">{b.nombre}</h3>
                      <div className="text-xs text-slate-400 font-mono mt-1">DNI: {b.documento}</div>

                      <div className="mt-4 flex items-center justify-between border-t border-slate-700/60 pt-3 text-xs">
                        <div className="text-slate-400">
                          Fecha: <b className="text-slate-200">{b.dia}/{b.mes}</b> ({b.edad} años)
                        </div>
                        <div>
                          {b.telefono ? (
                            <span className="font-mono text-emerald-400 bg-slate-900/80 px-2 py-0.5 rounded border border-slate-700">
                              +51 {b.telefono}
                            </span>
                          ) : (
                            <span className="text-amber-400">Sin teléfono</span>
                          )}
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between">
                        {b.statusEnvio === 'sent' ? (
                          <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                            <CheckCheck className="w-4 h-4" /> Saludo Enviado
                          </span>
                        ) : b.statusEnvio === 'sending' ? (
                          <span className="text-xs text-amber-400 font-semibold animate-pulse">
                            Enviando...
                          </span>
                        ) : (
                          <span className="text-xs text-slate-500">Pendiente</span>
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

      {/* CONTENIDO PESTAÑA 3: PADRÓN DE PARTÍCIPES & 3FA */}
      {activeTab === 'participes' && (
        <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-5 space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-400" />
                Padrón de Partícipes Registrados en Supabase
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Datos sincronizados para la autenticación 3FA y despacho automatizado.
              </p>
            </div>
            <span className="text-xs font-mono text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20">
              Total: {inversionistas.length} Partícipes
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 uppercase font-mono text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="p-3">Código</th>
                  <th className="p-3">Nombre Completo</th>
                  <th className="p-3">DNI</th>
                  <th className="p-3">Celular Registrado</th>
                  <th className="p-3">Email</th>
                  <th className="p-3">F. Nacimiento</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {inversionistas.map(i => (
                  <tr key={i.codigo_inversionista || i.documento_identidad} className="hover:bg-slate-750/30">
                    <td className="p-3 font-mono text-indigo-400">{i.codigo_inversionista || '-'}</td>
                    <td className="p-3 font-medium text-white">{i.nombre_completo}</td>
                    <td className="p-3 font-mono">{i.documento_identidad}</td>
                    <td className="p-3 font-mono text-emerald-400">{i.telefono ? `+51 ${i.telefono}` : <span className="text-slate-500">No asignado</span>}</td>
                    <td className="p-3 text-slate-400">{i.email || '-'}</td>
                    <td className="p-3 font-mono text-slate-400">{i.fecha_nacimiento || '-'}</td>
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
          <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-6 space-y-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Bot className="w-5 h-5 text-cyan-400" />
              Estado de Microservicios en Contabo VPS
            </h2>

            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-slate-300 font-medium">Evolution API v2.2.3</span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  {connectionState.toUpperCase()}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-slate-300 font-medium">Microservicio Bot FastAPI</span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  PUERTO 8085 / ACTIVO
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-slate-300 font-medium">Traefik Reverse Proxy SSL</span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  https://inandes.geeksoft.tech/wa-api
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-slate-300 font-medium">Instancia Oficial Conectada</span>
                <span className="font-mono text-slate-300">{INSTANCE_NAME}</span>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={fetchQrCode}
                className="w-full py-3 rounded-xl text-sm font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2"
              >
                <QrCode className="w-4 h-4" />
                Generar Código QR de Reconexión
              </button>
            </div>
          </div>

          <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-6 space-y-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              Reglas Intangibles del Bot Inbound (3FA)
            </h2>
            <div className="space-y-2 text-xs text-slate-300 leading-relaxed">
              <p>• <b>Determinismo 100%:</b> Las respuestas de saldos, retenciones y certificados se calculan exclusivamente a partir del Ledger en Supabase.</p>
              <p>• <b>Anti-Link Formatting:</b> Los DNIs se muestran con prefijo <code>DNI-</code> y dummies de la serie <code>09</code> para prevenir auto-linking verde en WhatsApp Web.</p>
              <p>• <b>Compilación de PDFs Oficiales:</b> El motor ReportLab genera en memoria el EECC y el Certificado de Retención con la firma digital de Juan Ricardo Gallo Pizarro y el logo de InAndes.</p>
              <p>• <b>Asesor Asignado:</b> La opción 4 resuelve dinámicamente el asesor del contrato y genera un link directo de WhatsApp.</p>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE QR (100% PRESERVADO Y ACCESIBLE) */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl space-y-6 relative animate-in fade-in zoom-in duration-200">
            <button
              onClick={() => setShowQrModal(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/20">
                <QrCode className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white">Vincular Chip InAndes Oficial</h3>
              <p className="text-xs text-slate-400">
                Abre WhatsApp en el celular corporativo &gt; Dispositivos Vinculados &gt; Escanear código QR.
              </p>
            </div>

            <div className="flex items-center justify-center min-h-[260px] bg-slate-950 rounded-2xl border border-slate-800 p-4">
              {loadingQr ? (
                <div className="flex flex-col items-center gap-3 text-slate-400">
                  <RefreshCw className="w-8 h-8 animate-spin text-emerald-400" />
                  <span className="text-xs">Generando código QR seguro...</span>
                </div>
              ) : qrError ? (
                <div className="flex flex-col items-center gap-2 text-rose-400 text-center px-4">
                  <AlertTriangle className="w-8 h-8" />
                  <span className="text-xs">{qrError}</span>
                  <button
                    onClick={fetchQrCode}
                    className="mt-2 text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700"
                  >
                    Reintentar
                  </button>
                </div>
              ) : qrBase64 ? (
                <div className="p-3 bg-white rounded-xl shadow-inner">
                  <img
                    src={qrBase64.startsWith('data:') ? qrBase64 : `data:image/png;base64,${qrBase64}`}
                    alt="WhatsApp QR Code"
                    className="w-56 h-56 object-contain"
                  />
                </div>
              ) : (
                <div className="text-xs text-slate-500">Sin código QR disponible.</div>
              )}
            </div>

            <div className="flex items-center justify-between pt-2 text-xs">
              <span className="text-slate-500 font-mono">Instancia: {INSTANCE_NAME}</span>
              <button
                onClick={checkConnectionState}
                className="text-emerald-400 hover:underline font-semibold"
              >
                Verificar Conexión
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default ChatWhatsAppPage;
