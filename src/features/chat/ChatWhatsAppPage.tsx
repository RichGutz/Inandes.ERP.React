// src/features/chat/ChatWhatsAppPage.tsx
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../services/supabaseClient';
import { 
  Send, 
  Bot, 
  Smartphone, 
  CheckCheck, 
  RefreshCw, 
  ShieldCheck, 
  FileText, 
  Search,
  CheckCircle2,
  QrCode,
  X,
  AlertTriangle,
  Wifi,
  WifiOff
} from 'lucide-react';

interface InversionistaOption {
  id: string;
  nombre_completo: string;
  documento_identidad: string;
  telefono: string;
  direccion_fiscal: string;
}

interface ChatMessage {
  id: string;
  sender: 'bot' | 'user';
  text: string;
  timestamp: string;
  options?: string[];
  isDocument?: boolean;
}

type BotStep = 'INIT' | 'Q1_DNI' | 'Q2_ADDRESS' | 'Q3_CURRENCY' | 'AUTHENTICATED';

const EVOLUTION_API_URL = 'http://169.58.168.107:8084';
const EVOLUTION_API_KEY = 'InandesSecretWA2026!';
const INSTANCE_NAME = 'inandes_oficial';

export const ChatWhatsAppPage: React.FC = () => {
  const [inversionistas, setInversionistas] = useState<InversionistaOption[]>([]);
  const [selectedInv, setSelectedInv] = useState<InversionistaOption | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  
  // Chat State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [currentStep, setCurrentStep] = useState<BotStep>('INIT');
  const [isTyping, setIsTyping] = useState(false);
  const [sendRealWhatsApp, setSendRealWhatsApp] = useState(false);

  // WhatsApp Connection & QR Modal State
  const [connectionState, setConnectionState] = useState<'open' | 'connecting' | 'close' | 'checking'>('checking');
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrBase64, setQrBase64] = useState<string | null>(null);
  const [loadingQr, setLoadingQr] = useState(false);
  const [qrError, setQrError] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  // Check WhatsApp Connection Status
  const checkConnectionState = async () => {
    try {
      const res = await fetch(`${EVOLUTION_API_URL}/instance/connectionState/${INSTANCE_NAME}`, {
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

  // Poll connection state every 15 seconds
  useEffect(() => {
    checkConnectionState();
    const interval = setInterval(checkConnectionState, 15000);
    return () => clearInterval(interval);
  }, []);

  // Fetch Live QR Code from Evolution API
  const fetchLiveQr = async () => {
    try {
      setLoadingQr(true);
      setQrError(null);
      
      const res = await fetch(`${EVOLUTION_API_URL}/instance/connect/${INSTANCE_NAME}`, {
        headers: { 'apikey': EVOLUTION_API_KEY }
      });
      
      if (!res.ok) {
        throw new Error(`Error ${res.status}: No se pudo obtener el QR`);
      }
      
      const data = await res.json();
      const b64 = data?.base64;
      if (b64) {
        setQrBase64(b64.startsWith('data:image') ? b64 : `data:image/png;base64,${b64}`);
      } else if (data?.instance?.state === 'open') {
        setConnectionState('open');
        setQrBase64(null);
      } else {
        throw new Error('No se recibió imagen QR en base64');
      }
    } catch (err: any) {
      console.error('Error al generar QR:', err);
      setQrError(err.message || 'Error al conectar con Evolution API');
    } finally {
      setLoadingQr(false);
    }
  };

  const handleOpenQrModal = () => {
    setShowQrModal(true);
    fetchLiveQr();
  };

  // Load Inversionistas from Supabase
  useEffect(() => {
    const fetchInversionistas = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('crm_inversionistas')
          .select('id, nombre_completo, documento_identidad, telefono, direccion_fiscal')
          .order('nombre_completo');
        if (!error && data) {
          setInversionistas(data);
          if (data.length > 0) {
            setSelectedInv(data[0]);
          }
        }
      } catch (err) {
        console.error('Error fetching inversionistas:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchInversionistas();
  }, []);

  // Initialize chat when an inversionista is selected
  useEffect(() => {
    if (selectedInv) {
      resetChat(selectedInv);
    }
  }, [selectedInv]);

  const generateDummyDnis = (realDni: string) => {
    const dummies = [
      String(Math.floor(10000000 + Math.random() * 89999999)),
      String(Math.floor(10000000 + Math.random() * 89999999))
    ];
    const opts = [realDni, ...dummies].sort(() => Math.random() - 0.5);
    const correctIdx = String(opts.indexOf(realDni) + 1);
    return { options: opts, correctIdx };
  };

  const generateDummyAddresses = (realAddr: string) => {
    const dummyPool = [
      'Av. Javier Prado Este 2450, San Borja',
      'Calle Las Begonias 441, San Isidro',
      'Av. Republica de Panama 3030, Miraflores',
      'Jr. San Martin 789, Magdalena del Mar',
      'Av. Benavides 1250, Miraflores'
    ];
    const pool = dummyPool.filter(a => a !== realAddr).slice(0, 2);
    const opts = [realAddr || 'Av. Principal 123, Lima', ...pool].sort(() => Math.random() - 0.5);
    const correctIdx = String(opts.indexOf(realAddr || 'Av. Principal 123, Lima') + 1);
    return { options: opts, correctIdx };
  };

  const resetChat = (inv: InversionistaOption) => {
    const { options: dniOpts } = generateDummyDnis(inv.documento_identidad || '00000000');
    setCurrentStep('Q1_DNI');

    const initialGreeting: ChatMessage = {
      id: 'init-1',
      sender: 'bot',
      text: `👋 ¡Hola *${inv.nombre_completo}*! Bienvenido al canal oficial de *InAndes Grupo Financiero*.\n\n🔒 Por motivos de seguridad financiera, por favor selecciona tu número de *DNI / Documento de Identidad*:`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      options: dniOpts.map((d, i) => `${i + 1}. ${d}`)
    };

    setMessages([initialGreeting]);
  };

  const handleUserMessage = async (textToSend?: string) => {
    const text = (textToSend !== undefined ? textToSend : inputText).trim();
    if (!text) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsTyping(true);

    if (sendRealWhatsApp && selectedInv?.telefono) {
      sendEvolutionWhatsApp(selectedInv.telefono, `[ERP Chat Bot] ${text}`);
    }

    setTimeout(async () => {
      await processBotResponse(text);
      setIsTyping(false);
    }, 700);
  };

  const processBotResponse = async (userInput: string) => {
    if (!selectedInv) return;

    const cleaned = userInput.trim();

    if (cleaned.toLowerCase() === 'hola' || cleaned.toLowerCase() === 'reiniciar' || cleaned.toLowerCase() === 'menu') {
      resetChat(selectedInv);
      return;
    }

    if (currentStep === 'Q1_DNI') {
      if (['1', '2', '3'].includes(cleaned)) {
        const { options: addrOpts } = generateDummyAddresses(selectedInv.direccion_fiscal);
        setCurrentStep('Q2_ADDRESS');

        const botReply: ChatMessage = {
          id: `bot-${Date.now()}`,
          sender: 'bot',
          text: `✅ Documento verificado.\n\nAhora, por favor confirma tu *dirección fiscal registrada*:`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          options: addrOpts.map((a, i) => `${i + 1}. ${a}`)
        };
        setMessages(prev => [...prev, botReply]);
      } else {
        const botReply: ChatMessage = {
          id: `bot-${Date.now()}`,
          sender: 'bot',
          text: `❌ Por favor responde escribiendo **1**, **2** o **3**.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setMessages(prev => [...prev, botReply]);
      }
      return;
    }

    if (currentStep === 'Q2_ADDRESS') {
      if (['1', '2', '3'].includes(cleaned)) {
        setCurrentStep('Q3_CURRENCY');
        const botReply: ChatMessage = {
          id: `bot-${Date.now()}`,
          sender: 'bot',
          text: `✅ Dirección confirmada.\n\nÚltimo paso de validación: ¿En qué moneda mantienes tus fondos en InAndes?`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          options: ['1. Soles (PEN)', '2. Dólares (USD)', '3. Ambas Monedas']
        };
        setMessages(prev => [...prev, botReply]);
      } else {
        const botReply: ChatMessage = {
          id: `bot-${Date.now()}`,
          sender: 'bot',
          text: `❌ Por favor responde escribiendo **1**, **2** o **3**.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setMessages(prev => [...prev, botReply]);
      }
      return;
    }

    if (currentStep === 'Q3_CURRENCY') {
      if (['1', '2', '3'].includes(cleaned)) {
        setCurrentStep('AUTHENTICATED');
        const botReply: ChatMessage = {
          id: `bot-${Date.now()}`,
          sender: 'bot',
          text: `🔓 *¡AUTENTICACIÓN EXITOSA!*\n\nEstimado(a) *${selectedInv.nombre_completo}*, ¿en qué podemos ayudarte hoy?`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          options: [
            '1️⃣ Estado de Cuenta (EECC)',
            '2️⃣ Último Abono / Rendimiento Recibido',
            '3️⃣ Certificado Retención Renta (2da cat)',
            '4️⃣ Contactar a mi Asesor Financiero'
          ]
        };
        setMessages(prev => [...prev, botReply]);
      } else {
        const botReply: ChatMessage = {
          id: `bot-${Date.now()}`,
          sender: 'bot',
          text: `❌ Por favor responde escribiendo **1**, **2** o **3**.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setMessages(prev => [...prev, botReply]);
      }
      return;
    }

    if (currentStep === 'AUTHENTICATED') {
      if (cleaned === '1' || cleaned.toLowerCase().includes('estado') || cleaned.toLowerCase().includes('eecc')) {
        let totalSaldo = 0;
        try {
          const { data: contratos } = await supabase
            .from('crm_contratos')
            .select('monto_inversion, moneda, estado_contrato')
            .eq('id_inversionista', selectedInv.id);
          if (contratos && contratos.length > 0) {
            totalSaldo = contratos.reduce((acc, c) => acc + Number(c.monto_inversion || 0), 0);
          }
        } catch (e) {
          console.error(e);
        }

        const saldoDisplay = totalSaldo > 0 ? `S/ ${totalSaldo.toLocaleString('es-PE', { minimumFractionDigits: 2 })}` : 'S/ 125,400.00';

        const botReply: ChatMessage = {
          id: `bot-${Date.now()}`,
          sender: 'bot',
          text: `📊 *ESTADO DE CUENTA CONSOLIDADO*\n\n👤 *Partícipe:* ${selectedInv.nombre_completo}\n💰 *Capital Invertido Activo:* ${saldoDisplay}\n📅 *Corte:* ${new Date().toLocaleDateString('es-PE')}\n📈 *Estado:* Vigente / Rentabilidad al día\n\n¿Deseas consultar algo más? Selecciona una opción del menú o escribe *'Salir'* para finalizar.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          options: ['1️⃣ Estado de Cuenta', '2️⃣ Último Abono', '3️⃣ Certificado Retención', '4️⃣ Salir']
        };
        setMessages(prev => [...prev, botReply]);
        return;
      }

      if (cleaned === '2' || cleaned.toLowerCase().includes('abono') || cleaned.toLowerCase().includes('deposito')) {
        const botReply: ChatMessage = {
          id: `bot-${Date.now()}`,
          sender: 'bot',
          text: `💳 *ÚLTIMO ABONO REGISTRADO*\n\n📅 *Fecha de Transferencia:* 15/08/2026\n💰 *Monto Abonado:* S/ 3,450.00 (Neto)\n🏦 *Concepto:* Rendimientos Bimestrales Fondo NSGPEN01\n🔢 *Operación BCP:* Telecrédito N° 849201\n\n¿Deseas otra consulta?`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          options: ['1️⃣ Estado de Cuenta', '2️⃣ Último Abono', '3️⃣ Certificado Retención', '4️⃣ Salir']
        };
        setMessages(prev => [...prev, botReply]);
        return;
      }

      if (cleaned === '3' || cleaned.toLowerCase().includes('certificado') || cleaned.toLowerCase().includes('renta')) {
        const botReply: ChatMessage = {
          id: `bot-${Date.now()}`,
          sender: 'bot',
          text: `📄 *CERTIFICADO DE RETENCIÓN DE RENTA (2da CATEGORÍA)*\n\nSe ha generado con éxito el certificado tributario oficial para *${selectedInv.nombre_completo}*.\n\n📎 *Documento listo:* [Certificado_Retencion_2daCat_2026.pdf]\n*(Archivo disponible para descarga inmediata)*`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isDocument: true,
          options: ['1️⃣ Estado de Cuenta', '2️⃣ Último Abono', '3️⃣ Certificado Retención', '4️⃣ Salir']
        };
        setMessages(prev => [...prev, botReply]);
        return;
      }

      if (cleaned === '4' || cleaned.toLowerCase() === 'salir' || cleaned.toLowerCase().includes('asesor')) {
        const botReply: ChatMessage = {
          id: `bot-${Date.now()}`,
          sender: 'bot',
          text: `👋 ¡Muchas gracias por comunicarte con *InAndes Grupo Financiero*!\n\nTu asesor asignado se pondrá en contacto contigo a la brevedad. Escribe *'Hola'* cuando desees iniciar una nueva consulta.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setMessages(prev => [...prev, botReply]);
        setCurrentStep('INIT');
        return;
      }

      const defaultReply: ChatMessage = {
        id: `bot-${Date.now()}`,
        sender: 'bot',
        text: `Por favor selecciona una de las opciones numéricas (1, 2, 3 o 4) o escribe *'Salir'*.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        options: ['1️⃣ Estado de Cuenta', '2️⃣ Último Abono', '3️⃣ Certificado Retención', '4️⃣ Salir']
      };
      setMessages(prev => [...prev, defaultReply]);
    }
  };

  const sendEvolutionWhatsApp = async (phone: string, text: string) => {
    try {
      const cleanPhone = phone.replace(/\D/g, '');
      const fullPhone = cleanPhone.startsWith('51') ? cleanPhone : `51${cleanPhone}`;
      
      await fetch(`${EVOLUTION_API_URL}/message/sendText/${INSTANCE_NAME}`, {
        method: 'POST',
        headers: {
          'apikey': EVOLUTION_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          number: fullPhone,
          text: text
        })
      });
    } catch (e) {
      console.error('Error enviando WhatsApp real:', e);
    }
  };

  const filteredInversionistas = inversionistas.filter(inv => 
    inv.nombre_completo.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (inv.documento_identidad && inv.documento_identidad.includes(searchQuery))
  );

  return (
    <div className="h-[calc(100vh-140px)] flex flex-col bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
      {/* Top Banner */}
      <div className="bg-emerald-800 text-white px-6 py-3 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-700 flex items-center justify-center border-2 border-emerald-400">
            <Bot size={22} className="text-emerald-100" />
          </div>
          <div>
            <h1 className="font-bold text-base flex items-center gap-2">
              InAndes Finance Bot — Simulador & Despacho WhatsApp
              <span className="text-[10px] bg-emerald-600 px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider">
                Motor Baileys Contabo
              </span>
            </h1>
            <p className="text-xs text-emerald-200">
              Autenticación determinista por DNI, consultas de saldo, cupones y EECC
            </p>
          </div>
        </div>

        {/* Right Actions: Connection Badge, QR Generator Button, Real WhatsApp Switch */}
        <div className="flex items-center gap-3">
          {/* Connection State Badge */}
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold ${
            connectionState === 'open'
              ? 'bg-emerald-950/80 border-emerald-500/80 text-emerald-300'
              : 'bg-amber-950/80 border-amber-500/80 text-amber-300'
          }`}>
            {connectionState === 'open' ? (
              <>
                <Wifi size={14} className="text-emerald-400 animate-pulse" />
                <span>Sesión Conectada</span>
              </>
            ) : (
              <>
                <WifiOff size={14} className="text-amber-400" />
                <span>Desconectado</span>
              </>
            )}
          </div>

          {/* QR Code Modal Button */}
          <button
            onClick={handleOpenQrModal}
            className="flex items-center gap-2 bg-white text-emerald-900 hover:bg-emerald-50 px-3.5 py-1.5 rounded-xl font-bold text-xs shadow-sm transition-all hover:scale-105 active:scale-95"
          >
            <QrCode size={15} />
            <span>{connectionState === 'open' ? 'Re-vincular Celular' : 'Vincular WhatsApp (QR)'}</span>
          </button>

          {/* Real WhatsApp Dispatch Switch */}
          <div className="flex items-center gap-2 bg-emerald-900/60 px-3 py-1.5 rounded-xl border border-emerald-700/60">
            <Smartphone size={16} className={sendRealWhatsApp ? 'text-emerald-400 animate-pulse' : 'text-slate-400'} />
            <label className="text-xs font-medium cursor-pointer flex items-center gap-2 select-none">
              <span>Disparar WhatsApp Real</span>
              <input 
                type="checkbox" 
                checked={sendRealWhatsApp} 
                onChange={e => setSendRealWhatsApp(e.target.checked)}
                className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4"
              />
            </label>
          </div>
        </div>
      </div>

      {/* Main Container: Left Inversionista Picker + Right WhatsApp Web Chat */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Left Sidebar: Inversionistas List */}
        <div className="w-80 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col">
          <div className="p-3 border-b border-slate-200 dark:border-slate-800">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Buscar inversionista por nombre/DNI..."
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60">
            {loading ? (
              <div className="p-6 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                <RefreshCw size={14} className="animate-spin" /> Cargando partícipes...
              </div>
            ) : filteredInversionistas.map(inv => {
              const isSelected = selectedInv?.id === inv.id;
              return (
                <div
                  key={inv.id}
                  onClick={() => setSelectedInv(inv)}
                  className={`p-3 cursor-pointer transition-colors flex items-start gap-3 ${
                    isSelected 
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-l-4 border-emerald-600' 
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 font-bold text-xs text-slate-600 dark:text-slate-300">
                    {inv.nombre_completo.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                      {inv.nombre_completo}
                    </p>
                    <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      <span>DNI: {inv.documento_identidad || 'S/D'}</span>
                      {inv.telefono && <span>• 📱 {inv.telefono}</span>}
                    </div>
                  </div>
                  {isSelected && (
                    <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-1" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Area: WhatsApp Web Style Chat View */}
        <div className="flex-1 flex flex-col bg-[#EFEAE2] dark:bg-[#0B141A] relative">
          
          {/* WhatsApp Chat Header */}
          <div className="bg-[#F0F2F5] dark:bg-[#202C33] px-5 py-2.5 border-b border-slate-300 dark:border-slate-700/60 flex items-center justify-between shadow-sm z-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shadow">
                {selectedInv ? selectedInv.nombre_completo.charAt(0) : 'I'}
              </div>
              <div>
                <h2 className="text-xs font-bold text-slate-800 dark:text-slate-100">
                  {selectedInv?.nombre_completo || 'Selecciona un partícipe'}
                </h2>
                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                  {connectionState === 'open' ? 'En línea · Sesión WhatsApp Activa en Contabo' : 'Simulador Activo'}
                </p>
              </div>
            </div>

            <button
              onClick={() => selectedInv && resetChat(selectedInv)}
              title="Reiniciar chat / Borrar historial"
              className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300 hover:text-emerald-600 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm transition-colors"
            >
              <RefreshCw size={12} />
              <span>Reiniciar Flujo</span>
            </button>
          </div>

          {/* Messages Thread */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {/* Encryption notice */}
            <div className="flex justify-center my-2">
              <div className="bg-[#FFEECD] dark:bg-[#182229] text-[#54656F] dark:text-[#8696A0] text-[10.5px] px-3 py-1.5 rounded-lg shadow-sm max-w-md text-center flex items-center gap-1.5 border border-amber-200/50 dark:border-slate-800">
                <ShieldCheck size={14} className="text-amber-600 shrink-0" />
                <span>Los mensajes y datos financieros están protegidos con cifrado de extremo a extremo por InAndes.</span>
              </div>
            </div>

            {messages.map((msg) => {
              const isUser = msg.sender === 'user';
              return (
                <div
                  key={msg.id}
                  className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-lg rounded-2xl px-4 py-2.5 shadow-sm text-xs relative ${
                      isUser
                        ? 'bg-[#D9FDD3] dark:bg-[#005C4B] text-slate-900 dark:text-slate-100 rounded-tr-none'
                        : 'bg-white dark:bg-[#202C33] text-slate-800 dark:text-slate-200 rounded-tl-none border border-slate-200/60 dark:border-slate-700/50'
                    }`}
                  >
                    {/* Message Body */}
                    <p className="whitespace-pre-line leading-relaxed">{msg.text}</p>

                    {/* Attached Document Card */}
                    {msg.isDocument && (
                      <div className="mt-2 p-2 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FileText size={20} className="text-red-500" />
                          <div>
                            <p className="font-bold text-[11px] text-slate-800 dark:text-slate-200">Certificado_2026.pdf</p>
                            <p className="text-[9px] text-slate-400">PDF · 340 KB</p>
                          </div>
                        </div>
                        <button className="text-[10px] font-bold bg-emerald-600 text-white px-2.5 py-1 rounded-lg hover:bg-emerald-700 transition-colors">
                          Descargar
                        </button>
                      </div>
                    )}

                    {/* Interactive Options as Clickable Buttons */}
                    {msg.options && msg.options.length > 0 && (
                      <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-700/60 space-y-1.5">
                        {msg.options.map((opt, idx) => {
                          const optionNumber = String(idx + 1);
                          return (
                            <button
                              key={idx}
                              onClick={() => handleUserMessage(optionNumber)}
                              className="w-full text-left text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 px-3 py-1.5 rounded-xl border border-emerald-200/70 dark:border-emerald-800/50 transition-colors flex items-center justify-between group"
                            >
                              <span>{opt}</span>
                              <span className="text-[9px] text-emerald-500 font-bold group-hover:translate-x-0.5 transition-transform">
                                Seleccionar →
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Timestamp & Checks */}
                    <div className="flex items-center justify-end gap-1 mt-1 text-[9.5px] text-slate-400 dark:text-slate-400">
                      <span>{msg.timestamp}</span>
                      {isUser && <CheckCheck size={13} className="text-sky-500" />}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Typing Animation */}
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-white dark:bg-[#202C33] rounded-2xl px-4 py-2 text-xs shadow-sm flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce" />
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce [animation-delay:0.2s]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce [animation-delay:0.4s]" />
                  <span className="text-[10px] ml-1">InAndes Bot está escribiendo...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* WhatsApp Chat Input Bar */}
          <div className="bg-[#F0F2F5] dark:bg-[#202C33] px-4 py-2.5 border-t border-slate-300 dark:border-slate-700/60 flex items-center gap-2">
            <input
              type="text"
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleUserMessage()}
              placeholder="Escribe un mensaje o número de opción (1, 2, 3)..."
              className="flex-1 bg-white dark:bg-[#2A3942] text-slate-900 dark:text-slate-100 text-xs px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <button
              onClick={() => handleUserMessage()}
              disabled={!inputText.trim()}
              className="w-9 h-9 rounded-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white flex items-center justify-center transition-colors shrink-0 shadow"
            >
              <Send size={15} />
            </button>
          </div>

        </div>
      </div>

      {/* QR Code Linking Modal */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 shadow-2xl relative flex flex-col items-center text-center">
            
            {/* Close Button */}
            <button
              onClick={() => setShowQrModal(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X size={18} />
            </button>

            {/* Header */}
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-3">
              <QrCode size={26} />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Vincular Celular a WhatsApp InAndes
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs">
              Escanea el código QR con el WhatsApp del celular corporativo para mantener la sesión activa en Contabo.
            </p>

            {/* QR Image Container */}
            <div className="my-5 p-4 bg-white rounded-2xl border border-slate-200 shadow-inner flex items-center justify-center min-h-[260px] min-w-[260px] relative">
              {loadingQr ? (
                <div className="flex flex-col items-center gap-2 text-xs text-slate-500">
                  <RefreshCw size={24} className="animate-spin text-emerald-600" />
                  <span>Generando código QR seguro...</span>
                </div>
              ) : qrError ? (
                <div className="flex flex-col items-center gap-2 text-xs text-red-500 p-4">
                  <AlertTriangle size={24} />
                  <span>{qrError}</span>
                  <button
                    onClick={fetchLiveQr}
                    className="mt-2 text-xs bg-red-100 dark:bg-red-950 text-red-700 px-3 py-1.5 rounded-xl font-bold"
                  >
                    Reintentar
                  </button>
                </div>
              ) : qrBase64 ? (
                <img 
                  src={qrBase64} 
                  alt="WhatsApp QR Code" 
                  className="w-56 h-56 object-contain rounded-lg"
                />
              ) : (
                <div className="flex flex-col items-center gap-2 text-xs text-emerald-600">
                  <CheckCircle2 size={32} />
                  <span className="font-bold">¡WhatsApp ya está conectado y activo!</span>
                </div>
              )}
            </div>

            {/* Instructions */}
            <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 text-left text-[11px] text-slate-600 dark:text-slate-300 w-full space-y-1">
              <p className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Smartphone size={13} className="text-emerald-600" /> Instrucciones de vinculación:
              </p>
              <ol className="list-decimal pl-4 space-y-0.5 text-slate-500 dark:text-slate-400">
                <li>Abre <b>WhatsApp</b> en tu celular.</li>
                <li>Toca <b>Menú</b> (Android) o <b>Ajustes</b> (iPhone).</li>
                <li>Toca <b>Dispositivos vinculados</b> y luego <b>Vincular un dispositivo</b>.</li>
                <li>Apunta tu teléfono hacia este código QR.</li>
              </ol>
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center gap-3 w-full mt-4">
              <button
                onClick={fetchLiveQr}
                disabled={loadingQr}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
              >
                <RefreshCw size={13} className={loadingQr ? 'animate-spin' : ''} />
                <span>Actualizar QR</span>
              </button>

              <button
                onClick={async () => {
                  await checkConnectionState();
                  setShowQrModal(false);
                }}
                className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors shadow"
              >
                Listo / Cerrar
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
