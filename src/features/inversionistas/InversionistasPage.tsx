// src/features/inversionistas/InversionistasPage.tsx
import React, { useEffect, useState, useMemo } from 'react';
import { getInversionistas, upsertInversionista } from '../../services/inversionistasService';
import { getApiBaseUrl } from '../../config/apiConfig';
import type { Inversionista } from '../../services/inversionistasService';
import { generateRetornosV40 } from '../../utils/financialCalculator';
import { generatePdfBelloConDesglose } from '../../utils/pdfGeneratorBelloConDesglose';
import { downloadReportPdf } from '../../utils/pdfDownloadHelper';
import { supabase } from '../../services/supabaseClient';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { generateBcpTelecreditoTxt, downloadBcpTxtFile, generateBcpTelecreditoExcel } from '../../services/bcpTelecreditoService';
import type { BcpTransferItem, BcpBatchConfig, BcpGeneratedFile } from '../../services/bcpTelecreditoService';
import { 
  Search, Loader2, AlertCircle, RefreshCw, Edit2, UserPlus, 
  FileSpreadsheet, FileText, CheckCircle, 
  ShieldCheck, Undo2, X, Calendar, RotateCcw, Download,
  LayoutGrid, List, Mail, Send, Landmark, Archive, MessageSquare, ChevronDown, ChevronUp, CheckSquare, Square
} from 'lucide-react';
import { LOGO_INANDES_BASE64, FIRMA_RICARDO_GALLO_BASE64 } from '../../assets/base64Images';
import { SBS_BANCOS_NOMBRES } from '../../constants/sbsBancos';
import { ComisionesAsesoresTab } from './ComisionesAsesoresTab';

export const InversionistasPage: React.FC = () => {
  // Tabs principales del módulo con persistencia en sessionStorage
  const [activeSubTab, setActiveSubTab] = useState<'datos' | 'retornos_react' | 'documentos' | 'comisiones'>(() => {
    const saved = sessionStorage.getItem('inv_active_subtab');
    return (saved as 'datos' | 'retornos_react' | 'documentos' | 'comisiones') || 'retornos_react';
  });

  useEffect(() => {
    sessionStorage.setItem('inv_active_subtab', activeSubTab);
  }, [activeSubTab]);

  // Modal de confirmacion de Rollback
  const [rollbackModalOpen, setRollbackModalOpen] = useState<boolean>(false);
  const [rollbackConfirmText, setRollbackConfirmText] = useState<string>('');
  const [rollbackLoading, setRollbackLoading] = useState<boolean>(false);

  // Modal de confirmacion de Registro Oficial
  const [registerModalOpen, setRegisterModalOpen] = useState<boolean>(false);
  const [registerConfirmText, setRegisterConfirmText] = useState<string>('');

  // Modal de confirmacion de Despacho de Correos
  const [emailSummaryModalOpen, setEmailSummaryModalOpen] = useState<boolean>(false);
  const [emailConfirmText, setEmailConfirmText] = useState<string>('');
  const [emailDispatchSuccessMsg, setEmailDispatchSuccessMsg] = useState<string | null>(null);

  // Modal de Transferencias Masivas BCP (Telecrédito)
  const [bcpModalOpen, setBcpModalOpen] = useState<boolean>(false);
  const [bcpCuentaOrigen, setBcpCuentaOrigen] = useState<string>('19300000000000');
  const [bcpTipoCuentaOrigen, setBcpTipoCuentaOrigen] = useState<'CCT' | 'SCA'>('CCT');
  const [bcpValidacionIdc, setBcpValidacionIdc] = useState<'S' | 'N'>('S');
  const [bcpReferenciaLote, setBcpReferenciaLote] = useState<string>('');
  const [bcpLoading, setBcpLoading] = useState<boolean>(false);
  const [bcpBatchData, setBcpBatchData] = useState<BcpGeneratedFile | null>(null);


  // Estado común de partícipes
  const [inversionistas, setInversionistas] = useState<Inversionista[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedLetter, setSelectedLetter] = useState<string>('TODOS');
  const [dataViewMode, setDataViewMode] = useState<'cards' | 'table'>('cards');

  const ALPHABET_AZ = ['TODOS', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'Ñ', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', '#'];

  const getLetterCount = (char: string) => {
    if (char === 'TODOS') return inversionistas.length;
    if (char === '#') {
      return inversionistas.filter(inv => {
        const apellido = (inv.apellido_1 || inv.nombre_completo || 'Z').trim();
        const firstLetter = apellido.normalize("NFD").replace(/[\u0300-\u036f]/g, "").charAt(0).toUpperCase();
        return !/^[A-ZÑ]/.test(firstLetter);
      }).length;
    }
    return inversionistas.filter(inv => {
      const apellido = (inv.apellido_1 || inv.nombre_completo || 'Z').trim();
      const firstLetter = apellido.normalize("NFD").replace(/[\u0300-\u036f]/g, "").charAt(0).toUpperCase();
      return firstLetter === char;
    }).length;
  };

  // Estado del Formulario de Edición/Creación
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [formMode, setFormMode] = useState<'crear' | 'editar'>('crear');
  const [formData, setFormData] = useState<Partial<Inversionista>>({});
  const [formActiveTab, setFormActiveTab] = useState<'identidad' | 'asesor' | 'conyuge' | 'laboral' | 'bancario' | 'compliance'>('identidad');
  const [formSubmitError, setFormSubmitError] = useState<string | null>(null);
  const [formSubmitSuccess, setFormSubmitSuccess] = useState<boolean>(false);

  // Estado de Asesores y Contratos asociados al partícipe
  const [asesoresList, setAsesoresList] = useState<any[]>([]);
  const [contratosListAll, setContratosListAll] = useState<any[]>([]);
  const [selectedFormAsesor, setSelectedFormAsesor] = useState<string>('');
  const [selectedInvContracts, setSelectedInvContracts] = useState<any[]>([]);
  const [reasignarContratos, setReasignarContratos] = useState<boolean>(true);

  // Mapeo indexado de asesores por código, ID o documento
  const asesorMapByCode = useMemo(() => {
    const map: Record<string, any> = {};
    for (const a of asesoresList) {
      if (a.codigo) map[String(a.codigo).trim().toLowerCase()] = a;
      if (a.id) map[String(a.id).trim().toLowerCase()] = a;
      if (a.documento_identidad) map[String(a.documento_identidad).trim().toLowerCase()] = a;
    }
    return map;
  }, [asesoresList]);

  // Helper para consultar contratos y asesor de un inversionista
  const getInvestorContractsAndAsesor = (inv: Inversionista) => {
    const invId = String(inv.id || '').toLowerCase();
    const invUuid = String((inv as any).uuid || '').toLowerCase();
    const invDoc = String(inv.documento_identidad || '').toLowerCase();
    const invCode = String(inv.codigo_inversionista || '').toLowerCase();

    const matchedContracts = contratosListAll.filter(c => {
      const cInv1 = String(c.id_inversionista_1 || '').toLowerCase();
      const cInv2 = String(c.id_inversionista_2 || '').toLowerCase();
      return (invId && (cInv1 === invId || cInv2 === invId)) ||
             (invUuid && (cInv1 === invUuid || cInv2 === invUuid)) ||
             (invDoc && (cInv1 === invDoc || cInv2 === invDoc)) ||
             (invCode && (cInv1 === invCode || cInv2 === invCode));
    });

    const activeContract = matchedContracts.find(c => ['emitido', 'activo', 'vigente'].includes(String(c.estado || '').toLowerCase())) || matchedContracts[0];
    const asesorCode = activeContract?.id_asesor || '';
    const asesorObj = asesorCode ? (asesorMapByCode[asesorCode.trim().toLowerCase()] || { nombre_completo: asesorCode, codigo: asesorCode }) : null;

    return {
      contracts: matchedContracts,
      asesorCode,
      asesorObj
    };
  };

  // Estado del Motor de Retornos y Auditoría v40
  const [fondosDisponibles, setFondosDisponibles] = useState<any[]>([]);
  const [v40SelFondo, setV40SelFondo] = useState<string>('TODOS');
  const [v40SelYear, setV40SelYear] = useState<number>(2026);
  const [v40SelCiclo, setV40SelCiclo] = useState<'Bimestre' | 'Trimestre'>('Bimestre');
  const [v40SelNum, setV40SelNum] = useState<number>(1);
  const [cycleDashboard, setCycleDashboard] = useState<any>({ B: {}, Q: {} });

  const [calcLoading, setCalcLoading] = useState<boolean>(false);
  const [calcResult, setCalcResult] = useState<any>(null);
  const [collisionCount, setCollisionCount] = useState<number>(0);
  const [excelDownloaded, setExcelDownloaded] = useState<boolean>(false);
  const [pdfDownloaded, setPdfDownloaded] = useState<boolean>(false);
  const [exportingExcel, setExportingExcel] = useState<boolean>(false);
  const [exportingPdf, setExportingPdf] = useState<boolean>(false);
  const [officialRegisterLoading, setOfficialRegisterLoading] = useState<boolean>(false);
  const [registerSuccessMsg, setRegisterSuccessMsg] = useState<string | null>(null);

  // Estado de Generación Documentos, Doble Selección y Visores
  const [docFondo, setDocFondo] = useState<string>('TODOS');
  const [docReloadKey, setDocReloadKey] = useState<number>(Date.now());
  const [docEvents, setDocEvents] = useState<any[]>([]);
  const [docLoading, setDocLoading] = useState<boolean>(false);
  const [downloadingPdf, setDownloadingPdf] = useState<string | null>(null);

  // Estados de Selección Doble (Retención y EECC) y Filtros
  const [selectedRetIds, setSelectedRetIds] = useState<Set<string>>(new Set());
  const [selectedEeccIds, setSelectedEeccIds] = useState<Set<string>>(new Set());
  const [expandedVisorIds, setExpandedVisorIds] = useState<Set<string>>(new Set());
  const [docSearchQuery, setDocSearchQuery] = useState<string>('');
  const [selectedDocFondos, setSelectedDocFondos] = useState<string[]>([]);

  // Canales de Envío en Tab C (Email y WhatsApp) y Parámetros Globales (Fecha Operación y TC)
  const [docFechaOperacion, setDocFechaOperacion] = useState<string>('2026-09-10');
  const [docTipoCambio, setDocTipoCambio] = useState<number>(3.4526);
  const [docSendEmail, setDocSendEmail] = useState<boolean>(true);
  const [docSendWhatsapp, setDocSendWhatsapp] = useState<boolean>(true);
  const [docSendingNotifications, setDocSendingNotifications] = useState<boolean>(false);
  const [docNotificationStatus, setDocNotificationStatus] = useState<string | null>(null);
  const [docGeneratingZip, setDocGeneratingZip] = useState<boolean>(false);
  const [docZipProgress, setDocZipProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });

  const handleDownloadFastPdf = async (htmlDoc: string, filename: string) => {
    setDownloadingPdf(filename);
    try {
      await downloadReportPdf(htmlDoc, filename, 'portrait');
    } catch (err: any) {
      alert(`Error descargando PDF: ${err.message}`);
    } finally {
      setDownloadingPdf(null);
    }
  };

  // Carga inicial
  const fetchDatos = async () => {
    setLoading(true);
    setError(null);
    try {
      const [invData, { data: asesData }, { data: contData }] = await Promise.all([
        getInversionistas(),
        supabase.from('crm_asesores').select('*').order('nombre_completo'),
        supabase.from('crm_contratos').select('*')
      ]);
      setInversionistas(invData);
      setAsesoresList(asesData || []);
      setContratosListAll(contData || []);
    } catch (err: any) {
      setError(err.message || 'Error inesperado al cargar los partícipes.');
    } finally {
      setLoading(false);
    }
  };

  const fetchFondos = async () => {
    try {
      const { data, error } = await supabase.from('crm_fondos').select('*').order('nombre_fondo');
      if (error) throw error;
      
      // Agrupar únicos
      const uniqueFondos: any[] = [];
      const seen = new Set();
      if (data) {
        for (const f of data) {
          if (!seen.has(f.id_fondo)) {
            seen.add(f.id_fondo);
            uniqueFondos.push(f);
          }
        }
      }
      setFondosDisponibles(uniqueFondos);
      if (uniqueFondos.length > 0) {
        setDocFondo(uniqueFondos[0].id_fondo);
      }
    } catch (err: any) {
      console.error('Error cargando fondos:', err.message);
    }
  };

  const fetchCycleDashboard = async (year: number) => {
    try {
      const { data, error } = await supabase
        .from('crm_certificados_eventos')
        .select('id_certificado, fecha_periodo_fin, tipo_evento')
        .in('tipo_evento', ['cierre_fin_ciclo', 'cierre_fin_contrato'])
        .gte('fecha_periodo_fin', `${year}-01-01`)
        .lte('fecha_periodo_fin', `${year}-12-31`);

      if (error) throw error;

      const dash = {
        B: { 1: [] as string[], 2: [] as string[], 3: [] as string[], 4: [] as string[], 5: [] as string[], 6: [] as string[] },
        Q: { 1: [] as string[], 2: [] as string[], 3: [] as string[], 4: [] as string[] }
      };

      if (data) {
        for (const r of data) {
          const dateFin = new Date(r.fecha_periodo_fin + 'T00:00:00');
          const month = dateFin.getMonth() + 1;
          const fundCode = r.id_certificado.split('.')[0].split('-')[0];

          if (month % 2 === 0) {
            const bIdx = (month / 2) as 1|2|3|4|5|6;
            if (dash.B[bIdx]) dash.B[bIdx].push(fundCode);
          }
          if (month % 3 === 0) {
            const qIdx = (month / 3) as 1|2|3|4;
            if (dash.Q[qIdx]) dash.Q[qIdx].push(fundCode);
          }
        }
      }

      // Eliminar duplicados
      for (let i = 1; i <= 6; i++) {
        dash.B[i as 1|2|3|4|5|6] = Array.from(new Set(dash.B[i as 1|2|3|4|5|6])).sort();
      }
      for (let i = 1; i <= 4; i++) {
        dash.Q[i as 1|2|3|4] = Array.from(new Set(dash.Q[i as 1|2|3|4])).sort();
      }

      setCycleDashboard(dash);
    } catch (err: any) {
      console.error('Error Dashboard Auditoría:', err.message);
    }
  };

  useEffect(() => {
    fetchDatos();
    fetchFondos();
  }, []);

  useEffect(() => {
    fetchCycleDashboard(v40SelYear);
  }, [v40SelYear]);

  // Al cambiar el fondo seleccionado, ajustar el ciclo por defecto
  useEffect(() => {
    if (v40SelFondo !== 'TODOS') {
      const f = fondosDisponibles.find(x => x.id_fondo === v40SelFondo);
      if (f) {
        const frec = Number(f.frecuencia_cupones_meses || 2);
        if (frec === 3) {
          setV40SelCiclo('Trimestre');
        } else {
          setV40SelCiclo('Bimestre');
        }
      }
    }
  }, [v40SelFondo, fondosDisponibles]);

  // --- Lógica del Motor Contable v40 ---
  const getDates = (y: number, t: 'Bimestre' | 'Trimestre', n: number) => {
    let s_m = 1;
    let e_m = 2;
    if (t === 'Bimestre') {
      s_m = (n - 1) * 2 + 1;
      e_m = s_m + 1;
    } else {
      s_m = (n - 1) * 3 + 1;
      e_m = s_m + 2;
    }
    
    const formatD = (year: number, month: number, day: number) => {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    };

    const s_d = formatD(y, s_m, 1);
    
    // Obtener último día del mes final
    const lastDay = new Date(y, e_m, 0).getDate();
    const e_d = formatD(y, e_m, lastDay);

    return { fStart: s_d, fEnd: e_d };
  };

  const { fStart, fEnd } = getDates(v40SelYear, v40SelCiclo, v40SelNum);

  const PERIODOS_CIERRE = [
    { id: 'B1', m: 2, mes: 'Febrero', rango: 'Ene - Feb', cycle: 'B1', label: 'Bimestre 1', corte: '28 Feb', cNum: 1, cType: 'Bimestre' as const, funds: ['NSGPEN01', 'NSGPEN02', 'NSGPEN03', 'NSGUSD01', 'NSGUSD02'] },
    { id: 'Q1', m: 3, mes: 'Marzo', rango: 'Ene - Mar', cycle: 'Q1', label: 'Trimestre 1', corte: '31 Mar', cNum: 1, cType: 'Trimestre' as const, funds: ['NSLCON01'] },
    { id: 'B2', m: 4, mes: 'Abril', rango: 'Mar - Abr', cycle: 'B2', label: 'Bimestre 2', corte: '30 Abr', cNum: 2, cType: 'Bimestre' as const, funds: ['NSGPEN01', 'NSGPEN02', 'NSGPEN03', 'NSGUSD01', 'NSGUSD02'] },
    { id: 'B3_Q2', m: 6, mes: 'Junio', rango: 'May - Jun / Q2', cycle: 'B3 / Q2', label: 'Bim. 3 / Q2', corte: '30 Jun', cNum: 3, cType: 'Bimestre' as const, funds: ['NSGPEN01', 'NSGPEN02', 'NSGPEN03', 'NSGUSD01', 'NSGUSD02', 'NSLCON01'] },
    { id: 'B4', m: 8, mes: 'Agosto', rango: 'Jul - Ago', cycle: 'B4', label: 'Bimestre 4', corte: '31 Ago', cNum: 4, cType: 'Bimestre' as const, funds: ['NSGPEN01', 'NSGPEN02', 'NSGPEN03', 'NSGUSD01', 'NSGUSD02'] },
    { id: 'Q3', m: 9, mes: 'Septiembre', rango: 'Jul - Sep', cycle: 'Q3', label: 'Trimestre 3', corte: '30 Sep', cNum: 3, cType: 'Trimestre' as const, funds: ['NSLCON01'] },
    { id: 'B5', m: 10, mes: 'Octubre', rango: 'Sep - Oct', cycle: 'B5', label: 'Bimestre 5', corte: '31 Oct', cNum: 5, cType: 'Bimestre' as const, funds: ['NSGPEN01', 'NSGPEN02', 'NSGPEN03', 'NSGUSD01', 'NSGUSD02'] },
    { id: 'B6_Q4', m: 12, mes: 'Diciembre', rango: 'Nov - Dic / Q4', cycle: 'B6 / Q4', label: 'Bim. 6 / Q4', corte: '31 Dic', cNum: 6, cType: 'Bimestre' as const, funds: ['NSGPEN01', 'NSGPEN02', 'NSGPEN03', 'NSGUSD01', 'NSGUSD02', 'NSLCON01'] }
  ];

  const currentCierre = PERIODOS_CIERRE.find(p => p.cType === v40SelCiclo && p.cNum === v40SelNum) || PERIODOS_CIERRE[0];
  const fondosDelCierre = fondosDisponibles.filter(f => currentCierre.funds.includes(f.id_fondo));

  // Verificar colisiones de fecha en DB
  const verificarColision = async (endDate: string) => {
    try {
      const { count, error } = await supabase
        .from('crm_certificados_eventos')
        .select('id_evento', { count: 'exact', head: true })
        .in('tipo_evento', ['cierre_fin_ciclo', 'cierre_fin_contrato'])
        .eq('fecha_periodo_fin', endDate);
      
      if (error) throw error;
      setCollisionCount(count || 0);
    } catch (err) {
      console.error("Error al verificar colision:", err);
      setCollisionCount(0);
    }
  };


  useEffect(() => {
    verificarColision(fEnd);
    // Resetear descargas al cambiar de filtro
    setExcelDownloaded(false);
    setPdfDownloaded(false);
    setCalcResult(null);
  }, [v40SelYear, v40SelCiclo, v40SelNum, v40SelFondo]);

  const [docVcEvents, setDocVcEvents] = useState<any[]>([]);

  // Carga reactiva de eventos contables para visualización instantánea estilo Forecast
  useEffect(() => {
    if (activeSubTab === 'documentos') {
      const fetchDocEvents = async () => {
        setDocLoading(true);
        try {
          const [eventsRes, vcRes] = await Promise.all([
            supabase
              .from('crm_certificados_eventos')
              .select('*')
              .eq('fecha_periodo_fin', fEnd),
            supabase
              .from('crm_valor_cuota_eventos')
              .select('*')
              .eq('fecha_fin_periodo', fEnd)
          ]);
          if (eventsRes.error) throw eventsRes.error;
          setDocEvents(eventsRes.data || []);
          setDocVcEvents(vcRes.data || []);
        } catch (err: any) {
          console.error('Error cargando eventos para documentos:', err);
        } finally {
          setDocLoading(false);
        }
      };
      fetchDocEvents();
    }
  }, [activeSubTab, fEnd, docReloadKey]);

  // Funciones de formateo para vista previa HTML instantánea
  const formatNumDoc = (val: any) => {
    if (val === undefined || val === null || val === "" || val === "-") return "-";
    try {
      const n = Number(val);
      if (Math.abs(n) < 0.0001) return "-";
      return n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    } catch (e) {
      return String(val);
    }
  };

  const numeroALetrasDoc = (monto: number): string => {
    monto = Math.round(monto * 100) / 100;
    const enteros = Math.floor(monto);
    const centavos = Math.round((monto - enteros) * 100);
    const cc = `${centavos.toString().padStart(2, '0')}/100`;

    const UNI = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
    const DEC = ['', 'DIEZ', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
    const ESP: Record<number, string> = {
      11: 'ONCE', 12: 'DOCE', 13: 'TRECE', 14: 'CATORCE', 15: 'QUINCE',
      16: 'DIECISEIS', 17: 'DIECISIETE', 18: 'DIECIOCHO', 19: 'DIECINUEVE',
      21: 'VEINTIUN', 22: 'VEINTIDOS', 23: 'VEINTITRES', 24: 'VEINTICUATRO',
      25: 'VEINTICINCO', 26: 'VEINTISEIS', 27: 'VEINTISIETE', 28: 'VEINTIOCHO', 29: 'VEINTINUEVE'
    };
    const CEN = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS',
                 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

    const t3 = (n: number): string => {
      if (n === 0) return '';
      if (n === 100) return 'CIEN';
      const c = Math.floor(n / 100);
      const r = n % 100;
      let s = CEN[c] ? CEN[c] + ' ' : '';
      if (r === 0) return s.trim();
      if (ESP[r]) return (s + ESP[r]).trim();
      const d = Math.floor(r / 10);
      const u = r % 10;
      if (d === 0) return (s + UNI[u]).trim();
      if (u === 0) return (s + DEC[d]).trim();
      return (s + `${DEC[d]} Y ${UNI[u]}`).trim();
    };

    if (enteros === 0) return `CERO CON ${cc}`;
    const miles = Math.floor(enteros / 1000);
    const resto = enteros % 1000;
    let txt = '';
    if (miles === 1) txt = 'MIL ';
    else if (miles > 1) txt = `${t3(miles)} MIL `;
    txt += t3(resto);
    return `${txt.trim().toLowerCase()} con ${cc}`;
  };

  const formatDateDisplayDoc = (dStr: string) => {
    if (!dStr) return '';
    const parts = dStr.split('-');
    if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
    return dStr;
  };

  const FUND_ORDER_PRIORITY: Record<string, number> = {
    'FDO NSG MIPYME PEN 01': 1,
    'FDO NSG MIPYME PEN 02': 2,
    'FDO NSG MIPYME PEN 03': 3,
    'FDO NSG MIPYME USD 01': 4,
    'FDO NSG MIPYME USD 02': 5,
    'FONDO NSG CAPITAL CONSERVADOR 01': 6,
  };

  const getFundPriority = (name: string): number => {
    if (FUND_ORDER_PRIORITY[name]) return FUND_ORDER_PRIORITY[name];
    const upper = (name || '').toUpperCase();
    if (upper.includes('PEN 01') || upper.includes('PEN 1') || upper.includes('PEN01')) return 1;
    if (upper.includes('PEN 02') || upper.includes('PEN 2') || upper.includes('PEN02')) return 2;
    if (upper.includes('PEN 03') || upper.includes('PEN 3') || upper.includes('PEN03')) return 3;
    if (upper.includes('USD 01') || upper.includes('USD 1') || upper.includes('USD01')) return 4;
    if (upper.includes('USD 02') || upper.includes('USD 2') || upper.includes('USD02')) return 5;
    if (upper.includes('CONSERVADOR') || upper.includes('CON 01') || upper.includes('CON01')) return 6;
    return 99;
  };

  const getShortFundLabel = (name: string): string => {
    const upper = (name || '').toUpperCase();
    if (upper.includes('PEN 01') || upper.includes('PEN 1') || upper.includes('PEN01')) return 'PEN 1';
    if (upper.includes('PEN 02') || upper.includes('PEN 2') || upper.includes('PEN02')) return 'PEN 2';
    if (upper.includes('PEN 03') || upper.includes('PEN 3') || upper.includes('PEN03')) return 'PEN 3';
    if (upper.includes('USD 01') || upper.includes('USD 1') || upper.includes('USD01')) return 'USD 01';
    if (upper.includes('USD 02') || upper.includes('USD 2') || upper.includes('USD02')) return 'USD 02';
    if (upper.includes('CONSERVADOR') || upper.includes('CON 01') || upper.includes('CON01')) return 'CON 01';
    return name;
  };

  const getEvolutionApiUrl = (): string => {
    if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      return `${window.location.origin}/wa-api`;
    }
    return 'https://inandes.geeksoft.tech/wa-api';
  };

  const EVOLUTION_API_KEY = 'InandesSecretWA2026!';
  const INSTANCE_NAME = 'inandes_oficial';

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

  const normalizeTextDoc = (str: string) => {
    return (str || '')
      .toUpperCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, ' ')
      .trim();
  };

  const findInvDoc = (nombre: string, contractId?: string) => {
    if (!nombre && !contractId) return { dni: '', direccion: 'Domicilio no registrado', telefono: '', email: '', inversionista: null as any };

    // 1. Prioridad Maxima: Vinculo Relacional por ID de Contrato / Certificado
    if (contractId && contratosListAll && contratosListAll.length > 0) {
      const ct = contratosListAll.find((c: any) => 
        c.id_contrato === contractId || 
        contractId.startsWith(c.id_contrato) ||
        (c.id_contrato && contractId.includes(c.id_contrato))
      );
      if (ct && ct.id_inversionista_1) {
        const invRel = inversionistas.find(inv => 
          inv.id === ct.id_inversionista_1 || 
          inv.codigo_inversionista === ct.id_inversionista_1 ||
          inv.documento_identidad === ct.id_inversionista_1
        );
        if (invRel) {
          return {
            dni: invRel.documento_identidad || '',
            direccion: invRel.direccion_fiscal || 'Domicilio no registrado',
            telefono: invRel.telefono || (invRel as any).celular || '',
            email: invRel.email || (invRel as any).correo_electronico || '',
            inversionista: invRel
          };
        }
      }
    }

    if (!nombre) return { dni: '', direccion: 'Domicilio no registrado', telefono: '', email: '', inversionista: null as any };
    const n = normalizeTextDoc(nombre);

    // 2. Prioridad: Coincidencia Exacta por Documento de Identidad (DNI/RUC)
    const invByDoc = inversionistas.find(inv => inv.documento_identidad && inv.documento_identidad.trim() === n);
    if (invByDoc) {
      return {
        dni: invByDoc.documento_identidad || '',
        direccion: invByDoc.direccion_fiscal || 'Domicilio no registrado',
        telefono: invByDoc.telefono || (invByDoc as any).celular || '',
        email: invByDoc.email || (invByDoc as any).correo_electronico || '',
        inversionista: invByDoc
      };
    }

    // 3. Prioridad: Coincidencia Exacta por Nombre Completo Normalizado
    for (const inv of inversionistas) {
      const comp = normalizeTextDoc(inv.nombre_completo || '');
      const full1 = normalizeTextDoc(`${inv.nombre_1 || ''} ${inv.nombre_2 || ''} ${inv.apellido_1 || ''} ${inv.apellido_2 || ''}`);
      const full2 = normalizeTextDoc(`${inv.apellido_1 || ''} ${inv.apellido_2 || ''} ${inv.nombre_1 || ''} ${inv.nombre_2 || ''}`);
      const full3 = normalizeTextDoc(`${inv.apellido_1 || ''} ${inv.apellido_2 || ''}, ${inv.nombre_1 || ''} ${inv.nombre_2 || ''}`);

      if (n === comp || n === full1 || n === full2 || n === full3) {
        return {
          dni: inv.documento_identidad || '',
          direccion: inv.direccion_fiscal || 'Domicilio no registrado',
          telefono: inv.telefono || (inv as any).celular || '',
          email: inv.email || (inv as any).correo_electronico || '',
          inversionista: inv
        };
      }
    }

    // 4. Prioridad: Coincidencia Estricta de Tokens con verificacion obligatoria de AMBOS apellidos
    const nTokens = n.split(' ').filter(Boolean);
    for (const inv of inversionistas) {
      const a1 = normalizeTextDoc(inv.apellido_1 || '');
      const a2 = normalizeTextDoc(inv.apellido_2 || '');
      const n1 = normalizeTextDoc(inv.nombre_1 || '');

      // Si el inversionista tiene segundo apellido registrado, DEBE coincidir obligatoriamente
      if (a1 && n1 && nTokens.includes(a1) && nTokens.includes(n1)) {
        if (a2 && !nTokens.includes(a2)) {
          // No coincide el segundo apellido (evita colision padre vs hijo homonimo)
          continue;
        }
        return {
          dni: inv.documento_identidad || '',
          direccion: inv.direccion_fiscal || 'Domicilio no registrado',
          telefono: inv.telefono || (inv as any).celular || '',
          email: inv.email || (inv as any).correo_electronico || '',
          inversionista: inv
        };
      }
    }

    return { dni: '', direccion: 'Domicilio no registrado', telefono: '', email: '', inversionista: null as any };
  };

  const extractCertNumberDoc = (idStr: string) => {
    if (!idStr) return "001";
    try {
      const parts = String(idStr).split('-');
      if (parts.length > 1) {
        return parts[1].split('.')[0];
      }
    } catch {}
    return String(idStr);
  };

  const getPrincipalInversionistaDoc = (nameStr: string) => {
    if (!nameStr) return "Inversionista";
    for (const sep of [' / ', '/', ' & ', ' y ', ' Y ']) {
      if (nameStr.includes(sep)) {
        return nameStr.split(sep)[0].trim();
      }
    }
    return nameStr.trim();
  };

  const getEeccRowData = (e: any) => {
    const fondosMap = new Map(fondosDisponibles.map(f => [f.id_fondo, f]));
    const payload = e.payload_asiento || {};
    const fCode = (e.id_contrato || e.id_certificado || '').split('.')[0].split('-')[0];
    const fInfo = fondosMap.get(fCode) || {};
    const fondoNombre = fInfo.nombre_fondo || fCode;
    const moneda = payload.moneda || fInfo.moneda || 'PEN';
    const rawInv = payload.inversionista || 'Inversionista';
    const inversionista = getPrincipalInversionistaDoc(rawInv);
    const vcFondoEvent = docVcEvents.find(v => v.id_fondo === fCode);
    const valorCuota = vcFondoEvent ? Number(vcFondoEvent.valor_cuota_final || 1.0) : Number(fInfo.valor_cuota_cierre_periodo || payload.valor_cuota || 1.0);
    const cid = e.id_contrato || e.id_certificado;
    const cidShort = extractCertNumberDoc(cid);

    return {
      fondo_nombre: fondoNombre,
      fecha_inicio_str: formatDateDisplayDoc(e.fecha_periodo_origen || fStart),
      fecha_fin_str: formatDateDisplayDoc(e.fecha_periodo_fin || fEnd),
      inversionista_nombre: inversionista,
      id_certificado: cid,
      id_certificado_short: cidShort,
      moneda: moneda,
      capital_inicial: Number(e.capital_base || 0),
      bruto_total: Number(e.interes_generado_bruto || 0),
      impuesto: Number(e.impuestos_renta || 0),
      deducciones: Number(e.monto_deduccion || 0),
      neto_disponible: Number(e.interes_neto_disponible || 0),
      capitalizacion: Number(e.monto_capitalizacion || 0),
      rescates: Number(e.monto_rescate || 0),
      monto_transferido: Number(e.monto_reparto || 0) + Number(e.monto_rescate || 0),
      capital_final: Number(e.capital_final_saldo || 0),
      valor_cuota: valorCuota
    };
  };

  const getRetencionRowData = (e: any) => {
    const fondosMap = new Map(fondosDisponibles.map(f => [f.id_fondo, f]));
    const payload = e.payload_asiento || {};
    const fCode = (e.id_contrato || e.id_certificado || '').split('.')[0].split('-')[0];
    const fInfo = fondosMap.get(fCode) || {};
    const fondoNombre = fInfo.nombre_fondo || fCode;
    const moneda = payload.moneda || fInfo.moneda || 'PEN';
    const rawInv = payload.inversionista || 'Inversionista';
    const inversionista = getPrincipalInversionistaDoc(rawInv);
    const cid = e.id_contrato || e.id_certificado;
    const invDetails = findInvDoc(inversionista, cid);
    const cidShort = extractCertNumberDoc(cid);

    const TC_USD_PEN = Number(docTipoCambio || 3.4526);
    const impuestoRaw = Number(e.impuestos_renta || 0);
    const irPen = moneda === 'USD' ? Math.round(impuestoRaw * TC_USD_PEN * 100) / 100 : Math.round(impuestoRaw * 100) / 100;
    const fOpDate = docFechaOperacion ? formatDateDisplayDoc(docFechaOperacion) : formatDateDisplayDoc(e.fecha_periodo_fin || fEnd);

    return {
      num_certificado: cid,
      id_certificado_short: cidShort,
      nombre_fondo: fondoNombre,
      nombres_participes: inversionista,
      dni_participes: invDetails.dni,
      direccion_fiscal: invDetails.direccion,
      monto_ir_pen_num: irPen.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      monto_ir_pen_letras: numeroALetrasDoc(irPen),
      f_inicio: formatDateDisplayDoc(e.fecha_periodo_origen || fStart),
      f_fin: formatDateDisplayDoc(e.fecha_periodo_fin || fEnd),
      moneda: moneda,
      base_retencion: Number(e.interes_generado_bruto || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      fecha_operacion: fOpDate,
      tipo_cambio_display: moneda === 'USD' ? `PEN ${TC_USD_PEN.toFixed(4)}` : '-',
      monto_ir_moneda_num: impuestoRaw.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      impuestos_renta: impuestoRaw
    };
  };

  const generateSingleEeccHtml = (row: any): string => {
    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Estado de Cuenta</title>
  <style>
    @page { size: letter portrait; margin: 0.75in 1.0in 0.65in 1.0in; }
    body { font-family: 'Consolas', 'Courier New', monospace; font-size: 12.0pt; line-height: 1.35; color: #000000; margin: 0; padding: 0; }
    .header { width: 100%; margin-bottom: 25px; }
    .header table { width: 100%; border: none; }
    .header td { vertical-align: top; border: none; }
    .logo-container { width: 100%; text-align: right; }
    .logo-inandes-img { display: block; width: 130px; height: 50px; background-image: url("data:image/png;base64,${LOGO_INANDES_BASE64}"); background-size: contain; background-repeat: no-repeat; background-position: right center; margin-left: auto; }
    .title-box { text-align: center; margin-bottom: 30px; }
    .title-box h1 { font-family: 'Consolas', 'Courier New', monospace; font-size: 14.0pt; font-weight: bold; color: #0f172a; margin: 0; line-height: 1.35; text-transform: uppercase; }
    .title-box h2 { font-family: 'Consolas', 'Courier New', monospace; font-size: 14.0pt; font-weight: bold; color: #000000; margin: 4px 0 0 0; line-height: 1.35; text-transform: uppercase; }
    .client-info { width: 100%; margin-bottom: 32px; font-size: 12.0pt; }
    .client-info p { margin: 3px 0; }
    .client-name { font-size: 14.0pt !important; font-weight: bold !important; color: #000000; margin-left: 26px !important; }
    .financial-data { width: 100%; margin-bottom: 25px; }
    .fin-table { width: 100%; border-collapse: collapse; }
    .fin-table td { padding: 4px 0; border: none; font-size: 12.0pt; }
    .col-label { width: 58%; text-align: left; color: #000000; }
    .col-currency { width: 14%; text-align: center; color: #64748b; }
    .col-amount { width: 28%; text-align: right; padding-right: 15px; color: #000000; }
    .bold { font-weight: bold; }
    .spacer-row td { padding: 8px 0; }
    .totals-section { width: 100%; margin-top: 30px; margin-bottom: 35px; border: 1.5px solid #000000; background-color: #f8fafc; padding: 10px 14px; box-sizing: border-box; }
    .totals-section table { width: 100%; border-collapse: collapse; }
    .totals-section td { padding: 4px 0; border: none; font-size: 12.0pt; font-weight: bold; color: #000000; }
    .footer-line { width: 100%; border-top: 0.75pt solid #000000; margin-top: 30px; margin-bottom: 12px; }
    .footer { text-align: center; color: #3333ff; font-size: 8.5pt; line-height: 1.35; }
    .footer-company { font-weight: bold; font-size: 9.0pt; margin: 0 0 2px 0; color: #3333ff; }
    .footer-address { margin: 1px 0; font-size: 8.0pt; color: #3333ff; white-space: nowrap; }
    .footer-contact { margin: 1px 0; font-size: 8.5pt; color: #3333ff; }
  </style>
</head>
<body>
  <div class="header">
    <table><tr><td class="logo-container"><div class="logo-inandes-img"></div></td></tr></table>
  </div>
  <div class="title-box">
    <h1>ESTADO DE CUENTA DEL CERTIFICADO N° ${row.id_certificado_short} DEL FONDO ${row.fondo_nombre}<br>– FONDO DE INVERSION PRIVADO</h1>
    <h2>DEL ${row.fecha_inicio_str} AL ${row.fecha_fin_str}</h2>
  </div>
  <div class="client-info">
    <p style="color: #64748b;">Sr(a)(s):</p>
    <p class="client-name">${row.inversionista_nombre}</p>
  </div>
  <div class="financial-data">
    <table class="fin-table">
      <tr><td class="col-label bold">Monto inicial invertido:</td><td class="col-currency">${row.moneda}</td><td class="col-amount bold">${formatNumDoc(row.capital_inicial)}</td></tr>
      <tr class="spacer-row"><td colspan="3"></td></tr>
      <tr><td class="col-label">Ganancia bruta obtenida:</td><td class="col-currency">${row.moneda}</td><td class="col-amount">${formatNumDoc(row.bruto_total)}</td></tr>
      <tr class="spacer-row"><td colspan="3"></td></tr>
      <tr><td class="col-label">(-) Impuesto a la renta retenido</td><td class="col-currency">${row.moneda}</td><td class="col-amount">${formatNumDoc(row.impuesto)}</td></tr>
      <tr class="spacer-row"><td colspan="3"></td></tr>
      <tr><td class="col-label bold">Ganancia neta disponible:</td><td class="col-currency bold">${row.moneda}</td><td class="col-amount bold">${formatNumDoc(row.neto_disponible)}</td></tr>
      <tr><td class="col-label">(-) Deducciones</td><td class="col-currency">${row.moneda}</td><td class="col-amount">${row.deducciones > 0 ? formatNumDoc(row.deducciones) : '-'}</td></tr>
      <tr><td class="col-label">(-) Rescates solicitados:</td><td class="col-currency">${row.moneda}</td><td class="col-amount">${row.rescates > 0 ? formatNumDoc(row.rescates) : '-'}</td></tr>
      <tr class="spacer-row"><td colspan="3"></td></tr>
      <tr><td class="col-label bold">Monto transferido / abonado:</td><td class="col-currency bold">${row.moneda}</td><td class="col-amount bold">${row.monto_transferido > 0 ? formatNumDoc(row.monto_transferido) : '-'}</td></tr>
      <tr class="spacer-row"><td colspan="3"></td></tr>
      <tr><td class="col-label bold">Compra de nuevas cuotas:</td><td class="col-currency bold">${row.moneda}</td><td class="col-amount bold">${row.capitalizacion > 0 ? formatNumDoc(row.capitalizacion) : '-'}</td></tr>
    </table>
  </div>
  <div class="totals-section">
    <table>
      <tr><td class="col-label bold">Monto final invertido:</td><td class="col-currency bold">${row.moneda}</td><td class="col-amount bold">${formatNumDoc(row.capital_final)}</td></tr>
      <tr><td class="col-label bold">Número de cuotas al ${row.fecha_fin_str}</td><td class="col-currency bold">CUOTAS</td><td class="col-amount bold">${Math.round(row.valor_cuota ? row.capital_final / row.valor_cuota : row.capital_final).toLocaleString('es-PE')}</td></tr>
    </table>
  </div>
  <div class="footer-line"></div>
  <div class="footer">
    <p class="footer-company">INANDES ACTIVOS ALTERNATIVOS SAC</p>
    <p class="footer-address">Av. Javier Prado Este 560 Int 1403 Centro Empresarial Javier Prado, San Isidro, Lima</p>
    <p class="footer-contact">Teléfono: + 51 (1) 712 1700 &nbsp;|&nbsp; info@inandes.com</p>
  </div>
</body>
</html>`;
  };

  const generateSingleRetencionHtml = (cert: any): string => {
    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Documento de Retención</title>
  <style>
    @page { size: letter portrait; margin: 0.60in 0.85in 0.50in 0.85in; }
    body { font-family: 'Consolas', 'Courier New', monospace; font-size: 11.0pt; line-height: 1.35; color: #000000; margin: 0; padding: 0; }
    .header { width: 100%; margin-bottom: 16px; }
    .header table { width: 100%; border: none; }
    .header td { vertical-align: top; border: none; }
    .logo-container { width: 100%; text-align: right; }
    .logo-inandes-img { display: block; width: 130px; height: 50px; background-image: url("data:image/png;base64,${LOGO_INANDES_BASE64}"); background-size: contain; background-repeat: no-repeat; background-position: right center; margin-left: auto; }
    .title-box { text-align: center; margin-bottom: 18px; }
    .title-box h1 { font-family: 'Consolas', 'Courier New', monospace; font-size: 13.0pt; font-weight: bold; color: #000000; margin: 0; line-height: 1.35; text-transform: uppercase; }
    .content { text-align: justify; margin-bottom: 14px; }
    .content p { margin: 9px 0; font-size: 11.0pt; line-height: 1.38; }
    .certifica-title { font-weight: bold; color: #000000; margin: 12px 0 6px 0 !important; font-size: 11.0pt; }
    .resumen-table { width: 100%; border-collapse: collapse; font-size: 9.0pt; margin: 14px 0 14px 0; }
    .resumen-table th { font-family: 'Consolas', 'Courier New', monospace; background-color: #334155; color: #ffffff; padding: 6.5px 4px; text-align: center; font-weight: bold; border: 1px solid #334155; font-size: 9.0pt; }
    .resumen-table td { font-family: 'Consolas', 'Courier New', monospace; padding: 6.5px 4px; text-align: center; border: 1px solid #cbd5e1; font-size: 9.0pt; color: #0f172a; }
    .legal-text { margin-top: 14px !important; margin-bottom: 16px !important; font-size: 11.0pt; color: #000000; }
    .signature-area { text-align: center; margin-top: 16px; margin-bottom: 16px; width: 100%; }
    .signature-wrapper { position: relative; display: inline-block; text-align: center; margin: 0 auto; }
    .firma-inandes-img { display: block; margin: 0 auto 0 auto; width: 145pt; height: 60pt; background-image: url("data:image/png;base64,${FIRMA_RICARDO_GALLO_BASE64}"); background-size: contain; background-repeat: no-repeat; background-position: center; position: relative; z-index: 2; }
    .sig-name { font-family: 'Consolas', 'Courier New', monospace; font-weight: bold; font-size: 10.5pt; color: #0f172a; position: relative; z-index: 1; text-align: center; margin-top: 2px; }
    .sig-role { font-family: 'Consolas', 'Courier New', monospace; font-size: 10.0pt; color: #64748b; text-align: center; margin-top: 3px; }
    .sig-company { font-family: 'Consolas', 'Courier New', monospace; font-size: 10.0pt; color: #64748b; text-align: center; }
    .footer-line { width: 100%; border-top: 0.75pt solid #000000; margin-top: 20px; margin-bottom: 10px; }
    .footer { text-align: center; color: #3333ff; font-size: 8.5pt; line-height: 1.35; }
    .footer-company { font-weight: bold; font-size: 9.0pt; margin: 0 0 2px 0; color: #3333ff; }
    .footer-address { margin: 1px 0; font-size: 8.0pt; color: #3333ff; white-space: nowrap; }
    .footer-contact { margin: 1px 0; font-size: 8.5pt; color: #3333ff; }
  </style>
</head>
<body>
  <div class="header">
    <table><tr><td class="logo-container"><div class="logo-inandes-img"></div></td></tr></table>
  </div>
  <div class="title-box">
    <h1>DOCUMENTO DE RETENCIÓN DE RENTAS DE SEGUNDA CATEGORÍA<br>DEL CERTIFICADO N° ${cert.id_certificado_short} DEL FONDO ${cert.nombre_fondo}<br>– FONDO DE INVERSION PRIVADO</h1>
  </div>
  <div class="content">
    <p>INANDES ACTIVOS ALTERNATIVOS S.A.C., identificada con R.U.C. N° 20601555256, domiciliada en Los Tulipanes 147 oficina 306, distrito de Santiago de Surco, provincia y departamento de Lima, en calidad de administradora del FONDO <strong>${cert.nombre_fondo} – FONDO DE INVERSION PRIVADO</strong>.</p>
    <p class="certifica-title">CERTIFICA QUE:</p>
    <p>A Don(ña) <strong>${cert.nombres_participes}</strong>, identificado(a) con DNI N° <strong>${cert.dni_participes}</strong>, con domicilio fiscal en <strong>${cert.direccion_fiscal}</strong>, se le ha efectuado la retención definitiva de PEN <strong>${cert.monto_ir_pen_num}</strong> (<strong>${cert.monto_ir_pen_letras} soles</strong>).por concepto del Impuesto a la Renta de Segunda Categoría por los rendimientos generados en el periodo correspondiente del <strong>${cert.f_inicio}</strong> al <strong>${cert.f_fin}</strong>, conforme al siguiente detalle:</p>
    <table class="resumen-table">
      <thead>
        <tr>
          <th>Fecha de<br>Operación</th>
          <th>Moneda</th>
          <th>Base Imponible</th>
          <th>Tasa (%)</th>
          <th>Impuesto<br>Retenido (${cert.moneda})</th>
          ${cert.moneda === 'USD' ? '<th>TC</th>' : ''}
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>${cert.fecha_operacion}</td>
          <td>${cert.moneda}</td>
          <td>${cert.base_retencion}</td>
          <td>5.00 %</td>
          <td>${cert.monto_ir_moneda_num}</td>
          ${cert.moneda === 'USD' ? `<td>${cert.tipo_cambio_display}</td>` : ''}
        </tr>
      </tbody>
    </table>
    <p class="legal-text">
      Se expide el presente certificado de conformidad con lo establecido en el Texto Único Ordenado de la Ley del Impuesto a la Renta y su Reglamento.
    </p>
  </div>
  <div class="signature-area">
    <div class="signature-wrapper">
      <div class="firma-inandes-img"></div>
      <div class="sig-name">JUAN RICARDO GALLO PIZARRO</div>
    </div>
    <div class="sig-role">Gerente General</div>
    <div class="sig-company">INANDES ACTIVOS ALTERNATIVOS S.A.C.</div>
  </div>
  <div class="footer-line"></div>
  <div class="footer">
    <p class="footer-company">INANDES ACTIVOS ALTERNATIVOS SAC</p>
    <p class="footer-address">Av. Javier Prado Este 560 Int 1403 Centro Empresarial Javier Prado, San Isidro, Lima</p>
    <p class="footer-contact">Teléfono: + (511) 712 1700 &nbsp;|&nbsp; info@inandes.com</p>
  </div>
</body>
</html>`;
  };

  // Filtrar eventos de documentos por Omnibox y Fondos
  const docEventsFiltered = useMemo(() => {
    let list = docEvents.filter(e => e.fecha_periodo_fin === fEnd);

    // Filtro de fondos con pills
    if (selectedDocFondos.length > 0) {
      list = list.filter(e => {
        const fCode = (e.id_contrato || e.id_certificado || '').split('.')[0].split('-')[0];
        const fondoObj = fondosDisponibles.find(f => f.id_fondo === fCode);
        const fName = fondoObj ? fondoObj.nombre_fondo : fCode;
        return selectedDocFondos.some(sf => sf === fCode || sf === fName || getShortFundLabel(fName) === sf);
      });
    }

    // Filtro Omnibox en tiempo real
    if (docSearchQuery.trim()) {
      const q = docSearchQuery.toLowerCase().trim();
      list = list.filter(e => {
        const payload = e.payload_asiento || {};
        const certId = (e.id_contrato || e.id_certificado || '').toLowerCase();
        const inv = (payload.inversionista || '').toLowerCase();
        const docId = (payload.documento_identidad || '').toLowerCase();
        const fCode = (e.id_contrato || e.id_certificado || '').split('.')[0].split('-')[0].toLowerCase();
        return certId.includes(q) || inv.includes(q) || docId.includes(q) || fCode.includes(q);
      });
    }

    return list;
  }, [docEvents, fEnd, selectedDocFondos, docSearchQuery, fondosDisponibles]);

  // Fondos ordenados según prioridad canónica (PEN 1 -> PEN 2 -> PEN 3 -> USD 01 -> USD 02 -> CON 01)
  const orderedDocFunds = useMemo(() => {
    const list = [...fondosDisponibles];
    return list.sort((a, b) => getFundPriority(a.nombre_fondo) - getFundPriority(b.nombre_fondo));
  }, [fondosDisponibles]);

  // Agrupación de eventos por Fondo
  const docEventsGroupedByFondo = useMemo(() => {
    const groups: { fondoKey: string; fondoNombre: string; moneda: string; events: any[] }[] = [];
    const map = new Map<string, any[]>();

    docEventsFiltered.forEach(e => {
      const fCode = (e.id_contrato || e.id_certificado || 'OTROS').split('.')[0].split('-')[0];
      if (!map.has(fCode)) map.set(fCode, []);
      map.get(fCode)!.push(e);
    });

    map.forEach((events, fCode) => {
      const fondoObj = fondosDisponibles.find(f => f.id_fondo === fCode);
      const fName = fondoObj ? fondoObj.nombre_fondo : fCode;
      const fMoneda = fondoObj ? fondoObj.moneda : (events[0]?.payload_asiento?.moneda || 'PEN');
      groups.push({
        fondoKey: fCode,
        fondoNombre: fName,
        moneda: fMoneda,
        events
      });
    });

    return groups.sort((a, b) => getFundPriority(a.fondoNombre) - getFundPriority(b.fondoNombre));
  }, [docEventsFiltered, fondosDisponibles]);

  // Manejo de Selección de Retención
  const toggleSelectRet = (id: string) => {
    setSelectedRetIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Manejo de Selección de EECC
  const toggleSelectEecc = (id: string) => {
    setSelectedEeccIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Seleccionar / Deseleccionar Todos Retención
  const toggleAllRet = () => {
    const visibleIds = docEventsFiltered.map(e => e.id_evento || e.id_contrato || e.id_certificado);
    const allSelected = visibleIds.length > 0 && visibleIds.every(id => selectedRetIds.has(id));
    setSelectedRetIds(prev => {
      const next = new Set(prev);
      if (allSelected) {
        visibleIds.forEach(id => next.delete(id));
      } else {
        visibleIds.forEach(id => next.add(id));
      }
      return next;
    });
  };

  // Seleccionar / Deseleccionar Todos EECC
  const toggleAllEecc = () => {
    const visibleIds = docEventsFiltered.map(e => e.id_evento || e.id_contrato || e.id_certificado);
    const allSelected = visibleIds.length > 0 && visibleIds.every(id => selectedEeccIds.has(id));
    setSelectedEeccIds(prev => {
      const next = new Set(prev);
      if (allSelected) {
        visibleIds.forEach(id => next.delete(id));
      } else {
        visibleIds.forEach(id => next.add(id));
      }
      return next;
    });
  };

  // Toggle de Visor Acordeón por Fila
  const toggleVisor = (id: string) => {
    setExpandedVisorIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Exportar Excel de Documentos
  const handleExportDocExcel = async () => {
    if (docEventsFiltered.length === 0) {
      alert("No hay registros en la vista actual para exportar.");
      return;
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'INANDES GRUPO FINANCIERO';
    workbook.lastModifiedBy = 'InAndes React CRM';
    workbook.created = new Date();

    const ws = workbook.addWorksheet('EECC_Retenciones', {
      views: [{ state: 'frozen', ySplit: 1 }]
    });

    const headers = [
      "ID Documento", "Fondo", "Participe / Inversionista", "DNI / RUC", "Moneda",
      "Capital Base", "Interes Bruto", "Retencion IR 5%", "Deducciones", "Neto Disponible",
      "Capitalizacion", "Rescates", "Total Transferido", "Capital Final", "Fecha Inicio", "Fecha Fin"
    ];

    const headerRow = ws.addRow(headers);
    headerRow.height = 26;
    headerRow.eachCell((cell) => {
      cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    docEventsFiltered.forEach(e => {
      const eecc = getEeccRowData(e);
      const cid = e.id_contrato || e.id_certificado;
      const invDetails = findInvDoc(eecc.inversionista_nombre, cid);
      const row = ws.addRow([
        eecc.id_certificado,
        eecc.fondo_nombre,
        eecc.inversionista_nombre,
        invDetails.dni || '-',
        eecc.moneda,
        eecc.capital_inicial,
        eecc.bruto_total,
        eecc.impuesto,
        eecc.deducciones,
        eecc.neto_disponible,
        eecc.capitalizacion,
        eecc.rescates,
        eecc.monto_transferido,
        eecc.capital_final,
        eecc.fecha_inicio_str,
        eecc.fecha_fin_str
      ]);
      row.height = 20;
      row.eachCell((cell, colNumber) => {
        if (colNumber >= 6 && colNumber <= 14) {
          cell.numFmt = '#,##0.00';
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
        } else {
          cell.alignment = { vertical: 'middle', horizontal: colNumber <= 2 ? 'center' : 'left' };
        }
      });
    });

    ws.columns.forEach(col => {
      col.width = 18;
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `InAndes_EECC_Retenciones_${fEnd}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Exportar ZIP con PDFs en Memoria (JSZip)
  const handleExportDocZip = async () => {
    const hasAnySelection = selectedRetIds.size > 0 || selectedEeccIds.size > 0;
    
    let targetEvents = docEventsFiltered;
    if (hasAnySelection) {
      targetEvents = docEventsFiltered.filter(e => {
        const id = e.id_evento || e.id_contrato || e.id_certificado;
        return selectedRetIds.has(id) || selectedEeccIds.has(id);
      });
    }

    if (targetEvents.length === 0) {
      alert("No hay documentos seleccionados o filtrados para empaquetar en ZIP.");
      return;
    }

    setDocGeneratingZip(true);
    setDocZipProgress({ current: 0, total: targetEvents.length });

    try {
      const zip = new JSZip();
      const API_BASE = getApiBaseUrl();

      for (let i = 0; i < targetEvents.length; i++) {
        const e = targetEvents[i];
        const id = e.id_evento || e.id_contrato || e.id_certificado;
        const eeccData = getEeccRowData(e);
        const retData = getRetencionRowData(e);
        const certClean = (eeccData.id_certificado || `DOC_${i+1}`).replace(/[^a-zA-Z0-9_-]/g, '_');

        const shouldIncludeEecc = !hasAnySelection || selectedEeccIds.has(id);
        const shouldIncludeRet = !hasAnySelection || selectedRetIds.has(id);

        // Generar EECC
        if (shouldIncludeEecc) {
          const htmlEecc = generateSingleEeccHtml(eeccData);
          try {
            const resp = await fetch(`${API_BASE}/api/inversionistas/generar-pdf`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ html: htmlEecc, orientation: 'portrait' })
            });
            if (resp.ok) {
              const blob = await resp.blob();
              zip.file(`EECC_${certClean}_${fEnd}.pdf`, blob);
            }
          } catch (pdfErr) {
            console.warn(`Error compilando EECC ${certClean}:`, pdfErr);
          }
        }

        // Generar Retención
        if (shouldIncludeRet && Number(e.impuestos_renta || 0) > 0) {
          const htmlRet = generateSingleRetencionHtml(retData);
          try {
            const resp = await fetch(`${API_BASE}/api/inversionistas/generar-pdf`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ html: htmlRet, orientation: 'portrait' })
            });
            if (resp.ok) {
              const blob = await resp.blob();
              zip.file(`RETENCION_${certClean}_${fEnd}.pdf`, blob);
            }
          } catch (pdfErr) {
            console.warn(`Error compilando Retencion ${certClean}:`, pdfErr);
          }
        }

        setDocZipProgress({ current: i + 1, total: targetEvents.length });
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const downloadUrl = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `Documentos_InAndes_${fEnd}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);
    } catch (err: any) {
      alert(`Error generando paquete ZIP: ${err.message}`);
    } finally {
      setDocGeneratingZip(false);
    }
  };

  // Enviar Notificaciones (Email y WhatsApp)
  const handleEnviarDocNotificaciones = async () => {
    const hasAnySelection = selectedRetIds.size > 0 || selectedEeccIds.size > 0;
    let targetEvents = docEventsFiltered;
    if (hasAnySelection) {
      targetEvents = docEventsFiltered.filter(e => {
        const id = e.id_evento || e.id_contrato || e.id_certificado;
        return selectedRetIds.has(id) || selectedEeccIds.has(id);
      });
    }

    if (targetEvents.length === 0) {
      alert("Selecciona al menos un documento para enviar notificaciones.");
      return;
    }

    if (!docSendEmail && !docSendWhatsapp) {
      alert("Debes seleccionar al menos un canal de envio (Email o WhatsApp).");
      return;
    }

    setDocSendingNotifications(true);
    setDocNotificationStatus("Iniciando despacho masivo...");

    let emailSentCount = 0;
    let waSentCount = 0;
    const API_BASE = getApiBaseUrl();

    try {
      for (let i = 0; i < targetEvents.length; i++) {
        const e = targetEvents[i];
        const eeccData = getEeccRowData(e);
        const certId = e.id_contrato || e.id_certificado;
        const invDetails = findInvDoc(eeccData.inversionista_nombre, certId);
        const invObj = invDetails.inversionista || inversionistas.find(inv => 
          (invDetails.dni && inv.documento_identidad === invDetails.dni) ||
          ((inv.nombre_completo || '').toUpperCase() === eeccData.inversionista_nombre.toUpperCase())
        );

        setDocNotificationStatus(`Enviando (${i + 1}/${targetEvents.length}): ${eeccData.inversionista_nombre}...`);

        // Canal Email
        const emailDest = invDetails.email || invObj?.email || (e.payload_asiento?.email);
        if (docSendEmail && emailDest) {
          try {
            const resp = await fetch(`${API_BASE}/api/inversionistas/enviar-reportes`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                email: emailDest,
                inversionista_nombre: eeccData.inversionista_nombre,
                id_certificado: eeccData.id_certificado,
                periodo_corte: fEnd,
                moneda: eeccData.moneda,
                monto_transferido: eeccData.monto_transferido
              })
            });
            if (resp.ok) emailSentCount++;
          } catch (emailErr) {
            console.warn(`Error enviando email a ${emailDest}:`, emailErr);
          }
        }

        // Canal WhatsApp
        const phone = invDetails.telefono || invObj?.telefono || (invObj as any)?.celular || (e.payload_asiento?.telefono);
        if (docSendWhatsapp && phone) {
          const waMsg = `Estimado(a) ${eeccData.inversionista_nombre},\n\nLe informamos que sus reportes contables correspondientes al cierre ${fEnd} del fondo ${eeccData.fondo_nombre} (Certificado N° ${eeccData.id_certificado}) ya se encuentran disponibles y formalizados.\n\n*Moneda:* ${eeccData.moneda}\n*Monto Liquidado / Transferido:* ${eeccData.moneda} ${eeccData.monto_transferido.toLocaleString('es-PE', { minimumFractionDigits: 2 })}\n\nGracias por su confianza en InAndes Grupo Financiero.`;
          const okWa = await sendSingleWhatsAppText(phone, waMsg);
          if (okWa) waSentCount++;
        }
      }

      // Registro de Auditoría
      try {
        await supabase.from('audit_logs').insert([{
          modulo: 'inversionistas_documentos',
          accion: 'envio_notificaciones',
          descripcion: `Despacho de reportes cierre ${fEnd}: ${emailSentCount} emails, ${waSentCount} WhatsApps.`
        }]);
      } catch (auditErr) {
        console.warn('Error registrando auditoria:', auditErr);
      }

      setDocNotificationStatus(`Despacho completado con exito: ${emailSentCount} correos enviados, ${waSentCount} mensajes de WhatsApp entregados.`);
      setTimeout(() => setDocNotificationStatus(null), 8000);
    } catch (err: any) {
      alert(`Error en el despacho de notificaciones: ${err.message}`);
      setDocNotificationStatus(null);
    } finally {
      setDocSendingNotifications(false);
    }
  };

  // Resumen Consolidado por Fondo para Despacho de Correos
  const fundSummaryForEmail = useMemo(() => {
    const map: Record<string, { fondo: string; nombre: string; moneda: string; count: number; countRetencion: number }> = {};
    
    let targetEvents = docEvents.filter(e => e.fecha_periodo_fin === fEnd);
    if (docFondo && docFondo !== 'TODOS') {
      targetEvents = targetEvents.filter(e => 
        (e.id_certificado && e.id_certificado.startsWith(docFondo)) ||
        (e.id_contrato && e.id_contrato.startsWith(docFondo))
      );
    }

    targetEvents.forEach(e => {
      const fCode = (e.id_contrato || e.id_certificado || 'OTROS').split('.')[0].split('-')[0];
      const fondoObj = fondosDisponibles.find(f => f.id_fondo === fCode);
      const nombre = fondoObj ? fondoObj.nombre_fondo : fCode;
      const moneda = fondoObj ? fondoObj.moneda : (e.payload_asiento?.moneda || 'PEN');
      
      if (!map[fCode]) {
        map[fCode] = {
          fondo: fCode,
          nombre: nombre,
          moneda: moneda,
          count: 0,
          countRetencion: 0
        };
      }
      map[fCode].count += 1;
      if (Number(e.impuestos_renta || 0) > 0) {
        map[fCode].countRetencion += 1;
      }
    });

    return Object.values(map);
  }, [docEvents, fEnd, docFondo, fondosDisponibles]);

  const totalEmailsToDispatch = useMemo(() => {
    return fundSummaryForEmail.reduce((acc, f) => acc + f.count, 0);
  }, [fundSummaryForEmail]);

  // Ejecución del cálculo local
  const handleRunV40Calculation = async () => {
    setCalcLoading(true);
    setRegisterSuccessMsg(null);
    try {
      const fondoId = v40SelFondo === 'TODOS' ? null : v40SelFondo;
      const res = await generateRetornosV40(fondoId, fStart, fEnd);
      setCalcResult(res);
      return res;
    } catch (err: any) {
      alert(`Error en el Motor Contable: ${err.message}`);
      return null;
    } finally {
      setCalcLoading(false);
    }
  };

  // Exportar Excel Detallado Oficial y Auditoría con Formato Profesional (ExcelJS)
  const handleExportExcelV40 = async () => {
    // Forzar cálculo fresco para asegurar que el Excel refleje siempre los últimos datos de la BD
    const currentResult = await handleRunV40Calculation();
    if (!currentResult || !currentResult.pdfData || currentResult.pdfData.length === 0) {
      alert("No hay datos calculados para exportar en Excel.");
      return;
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'INANDES GRUPO FINANCIERO';
    workbook.lastModifiedBy = 'InAndes React CRM';
    workbook.created = new Date();

    // 1. Generar pestañas limpias por Fondo con Formato Oficial y Desglose Diario Colapsado [+] / [-]
    currentResult.pdfData.forEach((fData: any) => {
      const fondoId = fData.fondo.id_fondo;
      const moneda = fData.fondo.moneda;
      const rows = fData.blocks[0].rows || [];
      const totals = fData.totals || {};
      const fDays: string[] = fData.blocks[0].days || [];

      const headersFondo = [
        "#", "Certificado", "Inversionista", "Capital Base",
        ...fDays,
        "INT. BRUTO", "IR (5%)", "BASE NETA", "CAPITALIZACION", "REPARTO", "DEDUCCIONES",
        "PENALIDAD", "NETO FINAL", "RESCATES", "TRANSFERENCIAS", "CAPITAL FINAL"
      ];

      const dailyStartIndex = 5;
      const dailyEndIndex = dailyStartIndex + fDays.length - 1;

      const ws = workbook.addWorksheet(`Fondo_${fondoId.slice(0, 24)}`, {
        views: [{ state: 'frozen', xSplit: 3, ySplit: 1 }] // Inmovilizar #, Certificado, Inversionista y Fila 1
      });

      // Configurar agrupación horizontal en Excel
      ws.properties.outlineProperties = {
        summaryBelow: false,
        summaryRight: true
      };

      // Cabecera Fila 1
      const headerRow = ws.addRow(headersFondo);
      headerRow.height = 28;
      headerRow.eachCell((cell, colNumber) => {
        cell.font = { name: 'Consolas', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: colNumber <= 3 ? 'FF0F172A' : (colNumber <= dailyEndIndex ? 'FF334155' : 'FF1E293B') }
        };
        cell.alignment = { vertical: 'middle', horizontal: colNumber <= 3 ? 'center' : 'right' };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF334155' } },
          bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
          left: { style: 'thin', color: { argb: 'FF334155' } },
          right: { style: 'thin', color: { argb: 'FF334155' } }
        };
      });

      // Acumulador de suma diaria para la fila de totales
      const sumDias = new Array(fDays.length).fill(0.0);

      // Filas de Certificados y Aumentos
      rows.forEach((r: any) => {
        const isAumento = r.tipo === 'AUMENTO';
        const vDias = r.valores || [];
        for (let dIdx = 0; dIdx < vDias.length; dIdx++) {
          sumDias[dIdx] += (Number(vDias[dIdx]) || 0);
        }

        let rowValues: any[] = [];

        if (isAumento) {
          rowValues = [
            "-",
            r.id,
            "   └─ Incremento de Capital",
            "-",
            ...vDias,
            r.bruto_total || 0,
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0
          ];
        } else {
          const rNetoFinal = r.neto_total !== undefined ? r.neto_total : Math.round(((r.reparto_valor || 0) - (r.deducciones_total || 0)) * 100) / 100;
          const rRescatesNetos = Math.round(((r.devolucion_capital || 0) - (r.penalidad_rescate || 0)) * 100) / 100;
          const rTransferencia = Math.round((rNetoFinal + rRescatesNetos) * 100) / 100;

          rowValues = [
            r.n_orden,
            r.id,
            r.inversionista,
            r.capital || 0,
            ...vDias,
            r.bruto_total || 0,
            r.impuesto_total || 0,
            r.base_neta || 0,
            r.capitalizacion || 0,
            r.reparto_valor || 0,
            r.deducciones_total || 0,
            r.penalidad_rescate || 0,
            rNetoFinal,
            r.devolucion_capital || 0,
            rTransferencia,
            r.capital_final || 0
          ];
        }

        const addedRow = ws.addRow(rowValues);
        addedRow.height = 20;

        addedRow.eachCell((cell, colNumber) => {
          if (colNumber === 1) {
            cell.font = { name: 'Consolas', size: 9.5, color: { argb: 'FF64748B' } };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
          } else if (colNumber === 2) {
            cell.font = { name: 'Consolas', size: 9.5, bold: !isAumento, color: { argb: 'FF1E293B' } };
            cell.alignment = { vertical: 'middle', horizontal: 'left' };
          } else if (colNumber === 3) {
            cell.font = { 
              name: 'Consolas', 
              size: isAumento ? 9 : 9.5, 
              italic: isAumento, 
              bold: false, 
              color: { argb: isAumento ? 'FF059669' : 'FF1E293B' } 
            };
            cell.alignment = { vertical: 'middle', horizontal: 'left', indent: isAumento ? 1 : 0 };
          } else {
            cell.numFmt = '#,##0.00';
            cell.font = { 
              name: 'Consolas', 
              size: 9.5, 
              italic: isAumento, 
              color: { argb: isAumento ? 'FF059669' : 'FF334155' } 
            };
            cell.alignment = { vertical: 'middle', horizontal: 'right' };
          }

          if (isAumento) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDF4' } };
          }

          cell.border = {
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFF1F5F9' } }
          };
        });
      });

      // Fila de Totales del Fondo
      const totNetoFinal = totals.neto_total !== undefined ? totals.neto_total : Math.round(((totals.reparto_valor || 0) - (totals.deducciones_total || 0)) * 100) / 100;
      const totRescatesNetos = Math.round(((totals.devolucion_capital || 0) - (totals.penalidad_rescate || 0)) * 100) / 100;
      const totTransferencia = Math.round((totNetoFinal + totRescatesNetos) * 100) / 100;

      const totalRowValues = [
        "TOTALES",
        `${fondoId} (${moneda})`,
        "",
        totals.capital || 0,
        ...sumDias,
        totals.bruto_total || 0,
        totals.impuesto_total || 0,
        totals.base_neta || 0,
        totals.capitalizacion || 0,
        totals.reparto_valor || 0,
        totals.deducciones_total || 0,
        totals.penalidad_rescate || 0,
        totNetoFinal,
        totals.devolucion_capital || 0,
        totTransferencia,
        totals.capital_final || 0
      ];

      const totalRow = ws.addRow(totalRowValues);
      totalRow.height = 24;

      totalRow.eachCell((cell, colNumber) => {
        if (colNumber <= 2) {
          cell.font = { name: 'Consolas', size: 10, bold: true, color: { argb: 'FF78350F' } };
          cell.alignment = { vertical: 'middle', horizontal: colNumber === 1 ? 'center' : 'left' };
        } else if (colNumber === 3) {
          cell.font = { name: 'Consolas', size: 10, bold: true, color: { argb: 'FF78350F' } };
          cell.alignment = { vertical: 'middle', horizontal: 'left' };
        } else {
          cell.numFmt = '#,##0.00';
          cell.font = { name: 'Consolas', size: 10, bold: true, color: { argb: 'FF78350F' } };
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
        }

        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } }; // Soft Gold
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFD97706' } },
          bottom: { style: 'double', color: { argb: 'FFD97706' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        };
      });

      // Anchos de Columna y Agrupamiento [+] / [-]
      ws.getColumn(1).width = 8;   // #
      ws.getColumn(2).width = 32;  // Certificado
      ws.getColumn(3).width = 42;  // Inversionista
      ws.getColumn(4).width = 16;  // Capital Base

      // Agrupar y ocultar por defecto las columnas de días diarios
      for (let c = dailyStartIndex; c <= dailyEndIndex; c++) {
        const col = ws.getColumn(c);
        col.width = 14;
        col.outlineLevel = 1;
        col.hidden = true; // Colapsado con botón [+] en Excel
      }

      // Columnas de Liquidación y Cierre
      for (let c = dailyEndIndex + 1; c <= headersFondo.length; c++) {
        ws.getColumn(c).width = 16;
      }
    });

    // 2. Generar pestañas de Auditoría Diaria Detallada
    if (currentResult.xlsDict) {
      for (const [fondoId, filas] of Object.entries(currentResult.xlsDict)) {
        const rowsAudit = filas as any[];
        if (!rowsAudit || rowsAudit.length === 0) continue;

        const wsAudit = workbook.addWorksheet(`Audit_${fondoId.slice(0, 18)}`, {
          views: [{ state: 'frozen', xSplit: 2, ySplit: 1 }] // Inmovilizar #, Certificado y Fila 1
        });

        // Extraer encabezados de las claves del primer objeto
        const auditHeaders = Object.keys(rowsAudit[0]);
        const auditHeaderRow = wsAudit.addRow(auditHeaders);
        auditHeaderRow.height = 28;

        auditHeaderRow.eachCell((cell, colNumber) => {
          cell.font = { name: 'Consolas', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: colNumber <= 2 ? 'FF0F172A' : 'FF1E293B' }
          };
          cell.alignment = { vertical: 'middle', horizontal: colNumber <= 2 ? 'left' : 'right' };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FF334155' } },
            bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
            left: { style: 'thin', color: { argb: 'FF334155' } },
            right: { style: 'thin', color: { argb: 'FF334155' } }
          };
        });

        // Filas de Auditoría Diaria
        rowsAudit.forEach((rObj: any) => {
          const rowVals = auditHeaders.map(h => {
            const val = rObj[h];
            if (val === '-' || val === undefined || val === null) return 0;
            return typeof val === 'number' ? val : (isNaN(Number(val)) ? val : Number(val));
          });

          const addedAuditRow = wsAudit.addRow(rowVals);
          addedAuditRow.height = 20;

          addedAuditRow.eachCell((cell, colNumber) => {
            if (colNumber <= 2) {
              cell.font = { name: 'Consolas', size: 9.5, bold: false, color: { argb: 'FF1E293B' } };
              cell.alignment = { vertical: 'middle', horizontal: 'left' };
            } else {
              cell.numFmt = '#,##0.00';
              cell.font = { name: 'Consolas', size: 9.5, color: { argb: 'FF334155' } };
              cell.alignment = { vertical: 'middle', horizontal: 'right' };
            }
            cell.border = {
              bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
              right: { style: 'thin', color: { argb: 'FFF1F5F9' } }
            };
          });
        });

        wsAudit.getColumn(1).width = 10;
        wsAudit.getColumn(2).width = 34;
        for (let c = 3; c <= auditHeaders.length; c++) {
          wsAudit.getColumn(c).width = 14;
        }
      }
    }

    // Descargar archivo binario
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const nowStamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '_').slice(0, 15);
    a.download = `AUDITORIA_OFICIAL_SISTEMA_${fEnd}_${nowStamp}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setExcelDownloaded(true);
  };

  // Exportar Excel Maestro v40 con indicador de carga
  const handleExportExcelV40WithProgress = async () => {
    setExportingExcel(true);
    try {
      // Forzar siempre cálculo fresco en vivo
      const currentResult = await handleRunV40Calculation();
      if (!currentResult) {
        alert("No hay datos calculados para exportar en Excel.");
        return;
      }
      await handleExportExcelV40();
    } catch (err: any) {
      alert(`Error generando Excel: ${err.message}`);
    } finally {
      setExportingExcel(false);
    }
  };

  // Exportar PDF Condensado Bello Oficial (Universal: TODOS y Fondo Individual) via descarga directa con progreso
  const handleExportPDFV40 = async () => {
    setExportingPdf(true);
    try {
      // Forzar siempre cálculo fresco en vivo
      const currentResult = await handleRunV40Calculation();
      if (!currentResult || currentResult.pdfData.length === 0) {
        alert("No hay datos calculados para exportar en PDF.");
        return;
      }

      const htmlContent = generatePdfBelloConDesglose({
        pdfData: currentResult.pdfData,
        fStart,
        fEnd,
        selFondo: v40SelFondo
      });

      const filename = `REPORTE_OFICIAL_SISTEMA_${fEnd}.pdf`;
      await handleDownloadFastPdf(htmlContent, filename);
      setPdfDownloaded(true);
    } catch (err: any) {
      alert(`Error generando PDF: ${err.message}`);
    } finally {
      setExportingPdf(false);
    }
  };

  // Preparar y abrir Modal de Transferencias Masivas BCP (Telecrédito)
  const handlePrepareBcpBatch = async () => {
    setBcpLoading(true);
    try {
      const currentResult = await handleRunV40Calculation();
      if (!currentResult || !currentResult.pdfData || currentResult.pdfData.length === 0) {
        alert("No hay datos calculados para generar el archivo BCP.");
        return;
      }

      // Cargar datos bancarios actualizados de inversionistas y contratos para detección pericial de renovaciones (#0XX)
      const [{ data: invList }, { data: todosContratos }] = await Promise.all([
        supabase.from('crm_inversionistas').select('*'),
        supabase.from('crm_contratos').select('*')
      ]);

      const contratosList = todosContratos || [];

      const extractCorrelativoNumber = (idStr: string): number => {
        const match = String(idStr || '').match(/^[A-Z0-9]+-(\d+)/i);
        return match ? parseInt(match[1], 10) : 0;
      };

      const invMapLocal: Record<string, any> = {};
      if (invList) {
        for (const i of invList) {
          for (const key of ['id', 'uuid', 'documento_identidad', 'codigo_inversionista']) {
            if (i[key]) invMapLocal[String(i[key]).toLowerCase()] = i;
          }
        }
      }

      const items: BcpTransferItem[] = [];
      let nOrden = 1;

      currentResult.pdfData.forEach((fData: any) => {
        const monedaFondo = (fData.fondo?.moneda || 'PEN').toUpperCase() as 'PEN' | 'USD';
        const isUsd = monedaFondo === 'USD';
        const rows = fData.blocks[0].rows || [];

        rows.forEach((r: any) => {
          if (r.tipo === 'AUMENTO') return; // Los aumentos están integrados en el contrato padre

          const rNetoFinal = r.neto_total !== undefined ? r.neto_total : Math.round(((r.reparto_valor || 0) - (r.deducciones_total || 0)) * 100) / 100;
          const rRescatesNetos = Math.round(((r.devolucion_capital || 0) - (r.penalidad_rescate || 0)) * 100) / 100;

          // Buscar datos del contrato actual en la base de datos
          const contratoActual = contratosList.find((c: any) => c.id_contrato === r.id || c.id === r.id);
          const numCorrelativo = extractCorrelativoNumber(r.id || contratoActual?.id_contrato || '');
          const invId = contratoActual?.id_inversionista_1 || r.id_inversionista_1 || '';
          const fondoIdActual = contratoActual?.id_fondo || (r.id ? r.id.split('-')[0] : (fData.fondo?.id || ''));

          const capAnterior = Number(r.capital || r.capital_base || contratoActual?.monto_inversion || 0);

          // Verificar si el contrato llega a vencimiento en o antes de la fecha de cierre fEnd
          const fechaFinStr = contratoActual?.fecha_fin ? contratoActual.fecha_fin.split('T')[0] : '';
          const fechaFinD = fechaFinStr ? new Date(fechaFinStr + 'T00:00:00') : null;
          const fechaCorteD = new Date(fEnd + 'T00:00:00');
          const isVencidoOAlCierre = Boolean(
            (fechaFinD && fechaFinD <= fechaCorteD) || 
            (r.devolucion_capital && r.devolucion_capital >= capAnterior && capAnterior > 0)
          );

          let tipoLiq: 'RENDIMIENTO_REGULAR' | 'ROLLOVER_TOTAL' | 'ROLLOVER_PARCIAL' | 'EXTINCION_TOTAL' = 'RENDIMIENTO_REGULAR';
          let comentario = 'Liquidación Regular de Rendimientos del Período';
          let capitalATransferir = rRescatesNetos;
          let capNuevo = 0;
          let difCap = 0;

          if (isVencidoOAlCierre && numCorrelativo > 0) {
            // Buscar si existe un contrato sucesor con el MISMO número correlativo (#0XX)
            const contratoSucesor = contratosList.find((c: any) => {
              if (c.id_contrato === r.id || c.id === r.id) return false;
              const sameInv = (c.id_inversionista_1 && c.id_inversionista_1 === invId) || 
                              (c.id_inversionista && c.id_inversionista === invId);
              const sameFondo = c.id_fondo === fondoIdActual;
              const sameNum = extractCorrelativoNumber(c.id_contrato) === numCorrelativo;
              const isActive = ['emitido', 'activo', 'vigente'].includes(String(c.estado || '').toLowerCase());
              const isLater = !contratoActual?.fecha_inicio || !c.fecha_inicio || 
                              new Date(c.fecha_inicio) >= new Date(contratoActual.fecha_inicio);
              return sameInv && sameFondo && sameNum && isActive && isLater;
            });

            if (contratoSucesor) {
              capNuevo = Number(contratoSucesor.monto_inversion || contratoSucesor.capital || 0);
              difCap = Math.max(0, Math.round((capAnterior - capNuevo) * 100) / 100);

              if (capNuevo >= capAnterior) {
                // Caso A: Rollover Total o Incremento de Capital -> No se transfiere capital
                tipoLiq = 'ROLLOVER_TOTAL';
                capitalATransferir = 0;
                comentario = `🔄 Rollover Total #${String(numCorrelativo).padStart(3, '0')} (Cap. ${monedaFondo} ${capAnterior.toLocaleString('es-PE', { minimumFractionDigits: 2 })} mantenido en ${contratoSucesor.id_contrato}) — Solo Rendimientos`;
              } else {
                // Caso B: Rollover Parcial -> Se transfiere la diferencia de capital
                tipoLiq = 'ROLLOVER_PARCIAL';
                capitalATransferir = difCap;
                comentario = `✂️ Rollover Parcial #${String(numCorrelativo).padStart(3, '0')} (Cap. anterior ${monedaFondo} ${capAnterior.toLocaleString('es-PE', { minimumFractionDigits: 2 })} ➔ nuevo ${monedaFondo} ${capNuevo.toLocaleString('es-PE', { minimumFractionDigits: 2 })}). Devolución diferencial: ${monedaFondo} ${difCap.toLocaleString('es-PE', { minimumFractionDigits: 2 })} + Rendimientos`;
              }
            } else {
              // Caso C: No hay renovación activa -> Extinción / Devolución Total de Capital
              tipoLiq = 'EXTINCION_TOTAL';
              capitalATransferir = rRescatesNetos > 0 ? rRescatesNetos : capAnterior;
              comentario = `🚪 Extinción / Cierre Contrato #${String(numCorrelativo).padStart(3, '0')} (Sin renovación activa). Devolución Total Cap: ${monedaFondo} ${capitalATransferir.toLocaleString('es-PE', { minimumFractionDigits: 2 })} + Rendimientos`;
            }
          } else if (rRescatesNetos > 0) {
            comentario = `Liquidación Regular + Rescate Parcial (${monedaFondo} ${rRescatesNetos.toLocaleString('es-PE', { minimumFractionDigits: 2 })})`;
          }

          const rTransferencia = Math.round((rNetoFinal + capitalATransferir) * 100) / 100;

          if (rTransferencia > 0) {
            // Buscar datos del inversionista
            const invObj = invMapLocal[String(r.id_inversionista_1 || '').toLowerCase()] || 
              Object.values(invMapLocal).find((inv: any) => (inv.nombre_completo || '').toUpperCase() === (r.inversionista || '').toUpperCase()) || {};

            const banco = isUsd ? (invObj.banco_nombre_usd || '') : (invObj.banco_nombre_pen || '');
            const numeroCuenta = isUsd ? (invObj.numero_cuenta_usd || '') : (invObj.numero_cuenta_pen || '');
            const cci = isUsd ? (invObj.cci_usd || '') : (invObj.cci_pen || '');

            const isBcp = (banco || '').toUpperCase().includes('BCP') && Boolean(numeroCuenta);
            const hasCci = Boolean(cci && cci.replace(/\D/g, '').length === 20);

            let estadoCuenta: 'BCP' | 'INTERBANCARIO' | 'SIN_CUENTA' = 'SIN_CUENTA';
            if (isBcp) estadoCuenta = 'BCP';
            else if (hasCci) estadoCuenta = 'INTERBANCARIO';

            items.push({
              nOrden: nOrden++,
              idContrato: r.id,
              inversionistaId: invObj.id || r.id_inversionista_1 || '',
              inversionistaNombre: r.inversionista || invObj.nombre_completo || 'N/A',
              tipoDoc: invObj.tipo_doc || 'DNI',
              numDoc: invObj.documento_identidad || '',
              banco,
              numeroCuenta,
              cci,
              montoTransferencia: rTransferencia,
              moneda: monedaFondo,
              estadoCuenta,
              tipoLiquidacion: tipoLiq,
              comentarioRollover: comentario,
              capitalAnterior: capAnterior,
              capitalNuevo: capNuevo,
              diferencialCapital: difCap,
              interesNeto: rNetoFinal
            });
          }
        });
      });

      if (items.length === 0) {
        alert("No se encontraron partícipes con saldo en la columna TRANSFERENCIAS mayor a cero.");
        return;
      }

      const monedaBatch = items[0]?.moneda || 'PEN';
      const cleanFecha = fEnd.replace(/-/g, '');
      const refLoteDefault = `LOTE-${v40SelFondo !== 'TODOS' ? v40SelFondo : monedaBatch}-${cleanFecha}`;
      setBcpReferenciaLote(refLoteDefault);

      const batchConfig: BcpBatchConfig = {
        fechaProceso: fEnd,
        tipoCuentaOrigen: bcpTipoCuentaOrigen,
        moneda: monedaBatch,
        numeroCuentaOrigen: bcpCuentaOrigen,
        referenciaLote: refLoteDefault,
        validacionIdc: bcpValidacionIdc
      };

      const result = generateBcpTelecreditoTxt(batchConfig, items);
      setBcpBatchData(result);
      setBcpModalOpen(true);
    } catch (err: any) {
      alert(`Error preparando lote BCP: ${err.message}`);
    } finally {
      setBcpLoading(false);
    }
  };

  const handleDownloadBcpTxt = () => {
    if (!bcpBatchData) return;
    
    const batchConfig: BcpBatchConfig = {
      fechaProceso: fEnd,
      tipoCuentaOrigen: bcpTipoCuentaOrigen,
      moneda: bcpBatchData.items[0]?.moneda || 'PEN',
      numeroCuentaOrigen: bcpCuentaOrigen,
      referenciaLote: bcpReferenciaLote,
      validacionIdc: bcpValidacionIdc
    };

    const finalBatch = generateBcpTelecreditoTxt(batchConfig, bcpBatchData.items);
    downloadBcpTxtFile(finalBatch.filename, finalBatch.content);
  };

  const handleDownloadBcpExcel = async () => {
    if (!bcpBatchData) return;
    
    const batchConfig: BcpBatchConfig = {
      fechaProceso: fEnd,
      tipoCuentaOrigen: bcpTipoCuentaOrigen,
      moneda: bcpBatchData.items[0]?.moneda || 'PEN',
      numeroCuentaOrigen: bcpCuentaOrigen,
      referenciaLote: bcpReferenciaLote,
      validacionIdc: bcpValidacionIdc
    };

    await generateBcpTelecreditoExcel(batchConfig, bcpBatchData.items);
  };



  // Guardar permanente en base de datos
  const handleRegisterPermanent = async () => {
    if (collisionCount > 0) return;

    setOfficialRegisterLoading(true);
    setRegisterSuccessMsg(null);
    try {
      let currentResult = calcResult;
      if (!currentResult) {
        currentResult = await handleRunV40Calculation();
      }

      if (!currentResult || currentResult.asientos.length === 0) {
        throw new Error("No hay asientos generados para guardar.");
      }

      const chunk_size = 50;
      let inserted = 0;
      const contratosCerrarFin: string[] = [];
      const contratosCerrarRescate: string[] = [];
      const idsCronograma: string[] = [];

      // Analizar asientos para cierres y cuotas
      for (const a of currentResult.asientos) {
        const payload = a.payload_asiento || {};
        
        if (payload.detalle_rescates) {
          for (const r of payload.detalle_rescates) {
            if (r.id_registro) idsCronograma.push(r.id_registro);
          }
        }
        if (payload.detalle_deducciones) {
          for (const d of payload.detalle_deducciones) {
            if (d.id_registro) idsCronograma.push(d.id_registro);
          }
        }

        if (a.tipo_evento === 'cierre_fin_contrato') {
          const resSum = Number(a.monto_rescate || 0);
          if (resSum > 0) {
            contratosCerrarRescate.push(a.id_contrato);
          } else {
            contratosCerrarFin.push(a.id_contrato);
          }
        }
      }

      // 1. Insertar Asientos del Ledger en bloques
      for (let i = 0; i < currentResult.asientos.length; i += chunk_size) {
        const chunk = currentResult.asientos.slice(i, i + chunk_size);
        const { data, error } = await supabase.from('crm_certificados_eventos').insert(chunk).select();
        if (error) throw error;
        inserted += (data ? data.length : 0);
      }

      // 2. Cerrar contratos finalizados
      if (contratosCerrarFin.length > 0) {
        for (let i = 0; i < contratosCerrarFin.length; i += chunk_size) {
          const chunk = contratosCerrarFin.slice(i, i + chunk_size);
          const { error } = await supabase
            .from('crm_contratos')
            .update({ estado: 'cerrado_fin_contrato' })
            .in('id_contrato', chunk);
          if (error) throw error;
        }
      }

      // 3. Cerrar contratos por rescate total
      if (contratosCerrarRescate.length > 0) {
        for (let i = 0; i < contratosCerrarRescate.length; i += chunk_size) {
          const chunk = contratosCerrarRescate.slice(i, i + chunk_size);
          const { error } = await supabase
            .from('crm_contratos')
            .update({ estado: 'cerrado_por_rescate' })
            .in('id_contrato', chunk);
          if (error) throw error;
        }
      }

      // 4. Marcar cronograma como procesado
      if (idsCronograma.length > 0) {
        const uniqueIds = Array.from(new Set(idsCronograma));
        for (let i = 0; i < uniqueIds.length; i += chunk_size) {
          const chunk = uniqueIds.slice(i, i + chunk_size);
          const { error } = await supabase
            .from('crm_cronograma_deducciones_rescates')
            .update({ estado: 'PROCESADO' })
            .in('id_cuota', chunk);
          if (error) throw error;
        }
      }

      setRegisterSuccessMsg(`Se registraron con éxito ${inserted} asientos contables. Se cerraron ${contratosCerrarFin.length + contratosCerrarRescate.length} contratos y se procesaron ${idsCronograma.length} cuotas de amortización.`);
      
      // Actualizar dashboard, colisiones y cerrar modal
      verificarColision(fEnd);
      fetchCycleDashboard(v40SelYear);
      setExcelDownloaded(false);
      setPdfDownloaded(false);
      setCalcResult(null);
      setRegisterModalOpen(false);
      setRegisterConfirmText('');
    } catch (err: any) {
      alert(`Error al registrar en base de datos: ${err.message}`);
    } finally {
      setOfficialRegisterLoading(false);
    }
  };

  // Verificar si el periodo seleccionado es el ULTIMO periodo cerrado en DB
  const verificarEsUltimoPeriodo = async (): Promise<{ esUltimo: boolean; ultimaFecha: string | null }> => {
    try {
      const { data, error } = await supabase
        .from('crm_certificados_eventos')
        .select('fecha_periodo_fin')
        .in('tipo_evento', ['cierre_fin_ciclo', 'cierre_fin_contrato'])
        .order('fecha_periodo_fin', { ascending: false })
        .limit(1);
      if (error) throw error;
      const ultimaFecha = data && data.length > 0 ? data[0].fecha_periodo_fin : null;
      return { esUltimo: ultimaFecha === fEnd, ultimaFecha };
    } catch (err) {
      console.error('Error verificando ultimo periodo:', err);
      return { esUltimo: false, ultimaFecha: null };
    }
  };

  // Abrir modal de rollback con verificacion de orden cronologico
  const handleOpenRollbackModal = async () => {
    const { esUltimo, ultimaFecha } = await verificarEsUltimoPeriodo();
    if (!esUltimo) {
      const msg = ultimaFecha
        ? `No se puede hacer rollback de ${fEnd} porque existe un periodo mas reciente cerrado: ${ultimaFecha}. Debes revertir primero ese periodo.`
        : `No hay asientos registrados para el periodo ${fEnd}.`;
      alert(msg);
      return;
    }
    setRollbackConfirmText('');
    setRollbackModalOpen(true);
  };

  // Reversion (Rollback) de periodo - se llama solo desde el modal tras confirmacion EJECUTAR
  const handleRollback = async () => {
    setRollbackLoading(true);

    try {
      const TIPOS_v40 = ['cierre_fin_ciclo', 'cierre_fin_contrato'];
      
      // 1. Obtener los eventos registrados en el fin de periodo
      const { data: eventosPeriodo, error: errEv } = await supabase
        .from('crm_certificados_eventos')
        .select('id_contrato, tipo_evento, payload_asiento')
        .eq('fecha_periodo_fin', fEnd)
        .in('tipo_evento', TIPOS_v40);

      if (errEv) throw errEv;

      if (!eventosPeriodo || eventosPeriodo.length === 0) {
        alert("No se encontraron asientos registrados para revertir en esta fecha de corte.");
        return;
      }

      const contratosRevertir = new Set<string>();
      const idsCronRevertir = new Set<string>();

      for (const reg of eventosPeriodo) {
        contratosRevertir.add(reg.id_contrato);
        const payload = reg.payload_asiento || {};
        if (payload.detalle_rescates) {
          for (const r of payload.detalle_rescates) {
            if (r.id_registro) idsCronRevertir.add(r.id_registro);
          }
        }
        if (payload.detalle_deducciones) {
          for (const d of payload.detalle_deducciones) {
            if (d.id_registro) idsCronRevertir.add(d.id_registro);
          }
        }
      }

      // Revertir cualquier cuota de cronograma del periodo o anterior que haya quedado en PROCESADO
      const { data: cuotasProcesadas } = await supabase
        .from('crm_cronograma_deducciones_rescates')
        .select('id_cuota')
        .lte('fecha_proyectada_cobro', fEnd)
        .eq('estado', 'PROCESADO');

      if (cuotasProcesadas) {
        for (const cp of cuotasProcesadas) {
          idsCronRevertir.add(cp.id_cuota);
        }
      }

      // Revertir cualquier contrato que tenga fecha_fin del periodo y no esté en emitido
      const { data: contratosCerradosPeriodo } = await supabase
        .from('crm_contratos')
        .select('id_contrato')
        .gte('fecha_fin', fStart)
        .lte('fecha_fin', fEnd)
        .neq('estado', 'emitido');

      if (contratosCerradosPeriodo) {
        for (const cc of contratosCerradosPeriodo) {
          contratosRevertir.add(cc.id_contrato);
        }
      }

      const chunk_size = 50;

      // Revertir contratos a emitido
      const listC = Array.from(contratosRevertir);
      if (listC.length > 0) {
        for (let i = 0; i < listC.length; i += chunk_size) {
          const chunk = listC.slice(i, i + chunk_size);
          const { error } = await supabase
            .from('crm_contratos')
            .update({ estado: 'emitido' })
            .in('id_contrato', chunk);
          if (error) throw error;
        }
      }

      // Revertir cronograma a PENDIENTE
      const listCron = Array.from(idsCronRevertir);
      if (listCron.length > 0) {
        for (let i = 0; i < listCron.length; i += chunk_size) {
          const chunk = listCron.slice(i, i + chunk_size);
          const { error } = await supabase
            .from('crm_cronograma_deducciones_rescates')
            .update({ estado: 'PENDIENTE' })
            .in('id_cuota', chunk);
          if (error) throw error;
        }
      }

      // Eliminar los asientos del periodo
      const { error: errDel } = await supabase
        .from('crm_certificados_eventos')
        .delete()
        .eq('fecha_periodo_fin', fEnd)
        .in('tipo_evento', TIPOS_v40);

      if (errDel) throw errDel;

      setRollbackModalOpen(false);
      alert(`Rollback completado. Se eliminaron los asientos y se reactivaron contratos y cuotas del periodo ${fEnd}.`);
      verificarColision(fEnd);
      fetchCycleDashboard(v40SelYear);
    } catch (err: any) {
      alert(`Error en el Rollback: ${err.message}`);
    } finally {
      setRollbackLoading(false);
    }
  };


  const handleOpenEditModal = (investor: Inversionista | null) => {
    setFormSubmitError(null);
    setFormSubmitSuccess(false);
    setFormActiveTab('identidad');
    if (investor) {
      setFormMode('editar');
      setFormData({ ...investor });
      const { contracts, asesorCode } = getInvestorContractsAndAsesor(investor);
      setSelectedInvContracts(contracts);
      setSelectedFormAsesor(asesorCode || '');
      setReasignarContratos(true);
    } else {
      setFormMode('crear');
      setFormData({
        tipo_doc: 'DNI',
        documento_identidad: '',
        nombre_1: '',
        nombre_2: '',
        apellido_1: '',
        apellido_2: '',
        estado_civil: 'Soltero(a)',
        nacionalidad: 'Peruano(a)',
        residente_peru: true,
        email: '',
        telefono: '',
        direccion_fiscal: '',
        codigo_postal: '',
        estado_compliance: 'borrador'
      });
      setSelectedInvContracts([]);
      setSelectedFormAsesor('');
      setReasignarContratos(true);
    }
    setIsModalOpen(true);
  };

  const handleInputChange = (field: keyof Inversionista, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitError(null);
    setFormSubmitSuccess(false);

    if (!formData.documento_identidad || !formData.nombre_1 || !formData.apellido_1) {
      setFormSubmitError("Por favor completa los campos obligatorios (*).");
      return;
    }

    try {
      await upsertInversionista(formData);

      // Si se seleccionó un asesor comercial y hay contratos vinculados marcados para reasignación
      if (selectedFormAsesor && selectedInvContracts.length > 0 && reasignarContratos) {
        const contractIds = selectedInvContracts.map(c => c.id_contrato || c.id).filter(Boolean);
        if (contractIds.length > 0) {
          const { error: errCont } = await supabase
            .from('crm_contratos')
            .update({ id_asesor: selectedFormAsesor })
            .in('id_contrato', contractIds);
          if (errCont) console.warn('Error sincronizando asesor en contratos:', errCont.message);
        }
      }

      setFormSubmitSuccess(true);
      setTimeout(() => {
        setIsModalOpen(false);
        fetchDatos();
      }, 1000);
    } catch (err: any) {
      setFormSubmitError(err.message || 'Error al guardar los cambios en Supabase.');
    }
  };

  // Filtrado de partícipes reactivo
  const filteredInversionistas = inversionistas.filter(item => {
    // Filtro por texto
    const term = searchTerm.toLowerCase();
    const fullName = item.nombre_completo || `${item.apellido_1} ${item.apellido_2 || ''} ${item.nombre_1} ${item.nombre_2 || ''}`;
    const matchesText = (
      fullName.toLowerCase().includes(term) ||
      item.documento_identidad.toLowerCase().includes(term) ||
      (item.email && item.email.toLowerCase().includes(term))
    );

    // Filtro por Rolodex Alfabético A-Z
    let matchesLetter = true;
    if (selectedLetter !== 'TODOS') {
      const apellido = (item.apellido_1 || item.nombre_completo || 'Z').trim();
      const firstLetter = apellido.normalize("NFD").replace(/[\u0300-\u036f]/g, "").charAt(0).toUpperCase();
      if (selectedLetter === '#') {
        matchesLetter = !/^[A-ZÑ]/.test(firstLetter);
      } else {
        matchesLetter = firstLetter === selectedLetter;
      }
    }

    return matchesText && matchesLetter;
  });

  return (
    <div className="flex flex-col gap-6 w-full">
      
      {/* Selector de sub-pestañas superior Estilo APEFAC */}
      <div className="border-b border-[#e2e8f0] dark:border-[#334155] w-full flex items-center justify-between">
        <div className="flex gap-4">
          <button
            className={`py-3 px-2 text-xs font-black tracking-wider uppercase border-b-[3px] cursor-pointer transition-colors ${
              activeSubTab === 'datos' 
                ? 'border-[#0284c7] text-[#0284c7] dark:text-[#38bdf8]' 
                : 'border-transparent text-[#64748b] hover:text-[#0f172a] dark:text-[#94a3b8] dark:hover:text-[#f8fafc]'
            }`}
            onClick={() => setActiveSubTab('datos')}
          >
            👥 Datos Inversionistas
          </button>
          <button
            className={`py-3 px-2 text-xs font-black tracking-wider uppercase border-b-[3px] cursor-pointer transition-colors ${
              activeSubTab === 'retornos_react' 
                ? 'border-[#0284c7] text-[#0284c7] dark:text-[#38bdf8]' 
                : 'border-transparent text-[#64748b] hover:text-[#0f172a] dark:text-[#94a3b8] dark:hover:text-[#f8fafc]'
            }`}
            onClick={() => setActiveSubTab('retornos_react')}
          >
            💹 Retornos y Rendimientos
          </button>

          <button
            className={`py-3 px-2 text-xs font-black tracking-wider uppercase border-b-[3px] cursor-pointer transition-colors ${
              activeSubTab === 'documentos' 
                ? 'border-[#0284c7] text-[#0284c7] dark:text-[#38bdf8]' 
                : 'border-transparent text-[#64748b] hover:text-[#0f172a] dark:text-[#94a3b8] dark:hover:text-[#f8fafc]'
            }`}
            onClick={() => setActiveSubTab('documentos')}
          >
            📄 EECC / Retenciones
          </button>

          <button
            className={`py-3 px-2 text-xs font-black tracking-wider uppercase border-b-[3px] cursor-pointer transition-colors ${
              activeSubTab === 'comisiones' 
                ? 'border-[#0284c7] text-[#0284c7] dark:text-[#38bdf8]' 
                : 'border-transparent text-[#64748b] hover:text-[#0f172a] dark:text-[#94a3b8] dark:hover:text-[#f8fafc]'
            }`}
            onClick={() => setActiveSubTab('comisiones')}
          >
            💼 Comisiones de Asesores
          </button>
        </div>
      </div>

      {/* --- PESTAÑA A: DATOS INVERSIONISTAS --- */}
      {activeSubTab === 'datos' && (
        <div className="flex flex-col gap-6 w-full animate-fadeIn">
          
          {/* Barra de Búsqueda y Botones de Acción */}
          <div className="flex flex-wrap items-center justify-between gap-4 w-full glass-card p-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={15} />
              <input
                type="text"
                className="w-full bg-[#f8fafc] dark:bg-[#0b0f19] border border-[#e2e8f0] dark:border-[#334155] rounded-lg py-2 pl-9 pr-4 text-xs font-semibold text-[#0f172a] dark:text-[#f8fafc] placeholder-slate-400 focus:outline-none focus:border-[#0284c7] transition-all shadow-xs"
                placeholder="Buscar por DNI, RUC o Apellidos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2">
              {/* Switcher de Vista: Tarjetas vs Tabla */}
              <div className="flex items-center bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-[#e2e8f0] dark:border-[#334155] shadow-xs">
                <button
                  type="button"
                  onClick={() => setDataViewMode('cards')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    dataViewMode === 'cards'
                      ? 'bg-white dark:bg-[#1e293b] text-[#0284c7] dark:text-[#38bdf8] shadow-xs'
                      : 'text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a]'
                  }`}
                  title="Vista de Tarjetas Compactas"
                >
                  <LayoutGrid size={14} />
                  <span className="hidden sm:inline">Tarjetas</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDataViewMode('table')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    dataViewMode === 'table'
                      ? 'bg-white dark:bg-[#1e293b] text-[#0284c7] dark:text-[#38bdf8] shadow-xs'
                      : 'text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a]'
                  }`}
                  title="Vista de Tabla DataGrid"
                >
                  <List size={14} />
                  <span className="hidden sm:inline">Tabla</span>
                </button>
              </div>

              <button 
                className="h-9 text-xs font-bold flex items-center gap-1.5 px-4 rounded-lg bg-[#0284c7] hover:bg-[#0369a1] text-white cursor-pointer shadow-xs transition-all"
                onClick={() => handleOpenEditModal(null)}
              >
                <UserPlus size={14} />
                <span>Nuevo Registro</span>
              </button>
              
              <button 
                className="h-9 text-xs font-bold flex items-center gap-1.5 px-3 rounded-lg border border-[#e2e8f0] dark:border-[#334155] bg-white dark:bg-[#1e293b] hover:bg-[#f8fafc] text-[#475569] dark:text-[#cbd5e1] cursor-pointer transition-colors shadow-xs"
                onClick={fetchDatos}
                disabled={loading}
              >
                <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                <span>Actualizar</span>
              </button>
            </div>
          </div>

          {/* Rolodex Abecedario A-Z Oficial */}
          <div className="glass-card p-4">
            <div className="flex flex-wrap gap-2 items-center justify-center sm:justify-start">
              {ALPHABET_AZ.map((char) => {
                const count = getLetterCount(char);
                const isSelected = selectedLetter === char;
                const hasData = count > 0;

                return (
                  <button
                    key={char}
                    onClick={() => setSelectedLetter(char)}
                    className={`relative px-3.5 py-1.5 rounded-xl font-black text-xs transition-all flex items-center justify-center cursor-pointer ${
                      isSelected
                        ? 'bg-[#0284c7] text-white shadow-md shadow-[#0284c7]/30 scale-105 ring-2 ring-[#38bdf8]'
                        : hasData
                          ? 'bg-[#f0f9ff] text-[#0284c7] border border-[#bae6fd] dark:bg-[#0284c7]/15 dark:text-[#38bdf8] dark:border-[#0284c7]/40 font-bold hover:bg-[#e0f2fe]'
                          : 'bg-slate-100/70 text-slate-400 dark:bg-slate-800/30 dark:text-slate-600 hover:bg-slate-200/70 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <span>{char}</span>
                    {count > 0 && (
                      <span className={`absolute -top-1.5 -right-1.5 w-4.5 h-4.5 rounded-full text-[9px] font-black flex items-center justify-center border border-white dark:border-slate-900 ${
                        isSelected ? 'bg-[#059669] text-white' : 'bg-[#0284c7] text-white'
                      }`}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Listado en Tarjetas Ultra-Compactas o Tabla Ejecutiva */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 text-center gap-3">
              <Loader2 className="animate-spin text-[#0284c7]" size={40} />
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Cargando partícipes desde Supabase...</p>
            </div>
          ) : error ? (
            <div className="max-w-md mx-auto my-12 bg-white dark:bg-slate-800 border border-rose-200 dark:border-rose-950 p-6 rounded-2xl shadow-sm text-center flex flex-col items-center gap-3">
              <AlertCircle className="text-rose-600" size={40} />
              <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 tracking-tight uppercase">Fallo de Conexión</h3>
              <p className="text-xs text-slate-450 dark:text-slate-400 leading-relaxed">{error}</p>
              <button 
                className="mt-2 text-xs bg-[#0284c7] hover:bg-[#0369a1] text-white font-bold px-4 py-2 rounded-lg transition-colors cursor-pointer" 
                onClick={fetchDatos}
              >
                Reintentar Conexión SSL
              </button>
            </div>
          ) : filteredInversionistas.length === 0 ? (
            <div className="py-16 text-center text-slate-400 font-bold uppercase tracking-wider border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900">
              No se encontraron inversionistas registrados.
            </div>
          ) : dataViewMode === 'cards' ? (
            /* VISTA 1: TARJETAS ULTRA-COMPACTAS EJECUTIVAS APEFAC */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 w-full">
              {filteredInversionistas.map((inv) => {
                const initials = `${inv.nombre_1?.charAt(0) || ''}${inv.apellido_1?.charAt(0) || ''}`.toUpperCase();
                const cleanName = `${inv.apellido_1 || ''} ${inv.apellido_2 || ''} ${inv.nombre_1 || ''} ${inv.nombre_2 || ''}`.replace(/\s+/g, ' ').trim() || inv.nombre_completo || '';
                const state = inv.estado_compliance || 'borrador';
                const { asesorObj, contracts } = getInvestorContractsAndAsesor(inv);
                
                let stateStyle = 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700';
                if (state === 'aprobado') {
                  stateStyle = 'bg-[#ecfdf5] dark:bg-[#059669]/15 text-[#059669] dark:text-[#34d399] border-[#a7f3d0] dark:border-[#059669]/30';
                } else if (state === 'solicitado') {
                  stateStyle = 'bg-[#fffbeb] dark:bg-[#d97706]/15 text-[#d97706] dark:text-[#fbbf24] border-[#fde68a] dark:border-[#d97706]/30';
                } else if (state === 'rechazado') {
                  stateStyle = 'bg-[#fff1f2] dark:bg-[#e11d48]/15 text-[#e11d48] dark:text-[#fb7185] border-[#fecdd3] dark:border-[#e11d48]/30';
                }
                
                return (
                  <div 
                    key={inv.id}
                    className="glass-card p-3.5 hover:border-[#0284c7] hover:shadow-md transition-all flex flex-col justify-between gap-2.5 rounded-2xl group relative"
                  >
                    {/* Fila 1: Avatar, Nombre, DNI y Badge + Edit */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        {/* Avatar */}
                        <div 
                          className="h-8 w-8 rounded-xl text-white font-mono font-black text-[11px] flex items-center justify-center shrink-0 shadow-xs"
                          style={{ background: 'linear-gradient(135deg, #0284c7 0%, #4f46e5 100%)' }}
                        >
                          {initials}
                        </div>

                        {/* Nombre & Documento */}
                        <div className="flex flex-col min-w-0">
                          <h4 className="text-xs font-black text-[#0f172a] dark:text-[#f8fafc] uppercase tracking-tight truncate leading-tight" title={cleanName}>
                            {cleanName}
                          </h4>
                          <span className="text-[10px] font-mono font-bold text-[#0284c7] dark:text-[#38bdf8] mt-0.5">
                            🆔 {inv.documento_identidad || 'Sin Doc'} {inv.tipo_doc ? `(${inv.tipo_doc})` : ''}
                          </span>
                        </div>
                      </div>

                      {/* Estado & Botón Editar */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className={`px-2 py-0.5 rounded text-[8px] font-mono font-black tracking-wider uppercase border ${stateStyle}`}>
                          {state}
                        </span>
                        <button
                          className="p-1.5 rounded-lg border border-[#e2e8f0] dark:border-[#334155] bg-white dark:bg-[#1e293b] hover:bg-[#f0f9ff] hover:text-[#0284c7] hover:border-[#bae6fd] text-[#64748b] dark:text-[#94a3b8] transition-colors cursor-pointer shadow-xs"
                          onClick={() => handleOpenEditModal(inv)}
                          title="Editar Ficha"
                        >
                          <Edit2 size={11} />
                        </button>
                      </div>
                    </div>

                    {/* Fila 2: Chips Compactos de Contacto y Asesor Asignado */}
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#e2e8f0] dark:border-[#334155] text-[10px]">
                      <div className="flex items-center gap-1.5 text-[#64748b] dark:text-[#94a3b8] truncate min-w-0">
                        <span className="truncate max-w-[130px]" title={inv.email || 'Sin correo'}>
                          ✉️ {inv.email || 'Sin correo'}
                        </span>
                        {inv.telefono && (
                          <span className="font-mono text-[#0f172a] dark:text-[#f8fafc] shrink-0 font-bold">
                            • 📞 {inv.telefono}
                          </span>
                        )}
                      </div>

                      {/* Asesor Asignado */}
                      <div className="flex items-center gap-1 shrink-0 font-sans text-[9.5px]">
                        {asesorObj ? (
                          <span className="px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold border border-indigo-200 dark:border-indigo-800/60 truncate max-w-[140px]" title={`Asesor: ${asesorObj.nombre_completo} (${contracts.length} contratos)`}>
                            👔 {asesorObj.nombre_completo}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic text-[8.5px]">Sin Asesor</span>
                        )}
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>
          ) : (
            /* VISTA 2: TABLA DATAGRID EJECUTIVA APEFAC */
            <div className="glass-card overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#e2e8f0] dark:border-[#334155] bg-[#f8fafc] dark:bg-[#0b0f19] text-[10px] font-black text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wider">
                      <th className="py-3 px-4">Partícipe / Razón Social</th>
                      <th className="py-3 px-4">Documento</th>
                      <th className="py-3 px-4">Email & Teléfono</th>
                      <th className="py-3 px-4">Asesor Asignado</th>
                      <th className="py-3 px-4">Cuentas Bancarias</th>
                      <th className="py-3 px-4 text-center">Compliance</th>
                      <th className="py-3 px-4 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e2e8f0] dark:divide-[#334155] text-xs">
                    {filteredInversionistas.map((inv) => {
                      const initials = `${inv.nombre_1?.charAt(0) || ''}${inv.apellido_1?.charAt(0) || ''}`.toUpperCase();
                      const cleanName = `${inv.apellido_1 || ''} ${inv.apellido_2 || ''} ${inv.nombre_1 || ''} ${inv.nombre_2 || ''}`.replace(/\s+/g, ' ').trim() || inv.nombre_completo || '';
                      const state = inv.estado_compliance || 'borrador';
                      const { asesorObj, contracts } = getInvestorContractsAndAsesor(inv);
                      
                      let stateStyle = 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700';
                      if (state === 'aprobado') {
                        stateStyle = 'bg-[#ecfdf5] dark:bg-[#059669]/15 text-[#059669] dark:text-[#34d399] border-[#a7f3d0] dark:border-[#059669]/30';
                      } else if (state === 'solicitado') {
                        stateStyle = 'bg-[#fffbeb] dark:bg-[#d97706]/15 text-[#d97706] dark:text-[#fbbf24] border-[#fde68a] dark:border-[#d97706]/30';
                      } else if (state === 'rechazado') {
                        stateStyle = 'bg-[#fff1f2] dark:bg-[#e11d48]/15 text-[#e11d48] dark:text-[#fb7185] border-[#fecdd3] dark:border-[#e11d48]/30';
                      }

                      return (
                        <tr key={inv.id} className="table-row-hover">
                          {/* Partícipe */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2.5">
                              <div 
                                className="h-7 w-7 rounded-lg text-white font-mono font-black text-[10px] flex items-center justify-center shrink-0 shadow-xs"
                                style={{ background: 'linear-gradient(135deg, #0284c7 0%, #4f46e5 100%)' }}
                              >
                                {initials}
                              </div>
                              <span className="font-bold text-[#0f172a] dark:text-[#f8fafc] uppercase truncate max-w-[200px]" title={cleanName}>
                                {cleanName}
                              </span>
                            </div>
                          </td>

                          {/* Documento */}
                          <td className="py-3 px-4 font-mono font-bold text-[#0284c7] dark:text-[#38bdf8]">
                            {inv.documento_identidad || '-'} <span className="text-[10px] text-[#64748b] dark:text-[#94a3b8] font-normal">({inv.tipo_doc || 'DNI'})</span>
                          </td>

                          {/* Contacto */}
                          <td className="py-3 px-4 text-[#64748b] dark:text-[#94a3b8]">
                            <div className="flex flex-col gap-0.5">
                              <span className="truncate max-w-[180px]" title={inv.email || ''}>{inv.email || 'Sin correo'}</span>
                              <span className="font-mono text-[10px] text-[#0f172a] dark:text-[#f8fafc] font-bold">{inv.telefono || '-'}</span>
                            </div>
                          </td>

                          {/* Asesor Asignado */}
                          <td className="py-3 px-4 font-sans text-xs">
                            {asesorObj ? (
                              <div className="flex items-center gap-1.5" title={`Asesor: ${asesorObj.nombre_completo} (${contracts.length} contratos vinculados)`}>
                                <span className="h-5 w-5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold text-[10px] flex items-center justify-center shrink-0 border border-indigo-200 dark:border-indigo-800">
                                  👔
                                </span>
                                <span className="font-bold text-[#0f172a] dark:text-[#f8fafc] truncate max-w-[140px]">
                                  {asesorObj.nombre_completo}
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-400 italic text-[11px]">Sin Asesor</span>
                            )}
                          </td>

                          {/* Bancos */}
                          <td className="py-3 px-4 font-mono text-[10px]">
                            <div className="flex flex-wrap gap-1">
                              {inv.banco_nombre_pen && (
                                <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[#0f172a] dark:text-[#f8fafc] font-bold border border-slate-200 dark:border-slate-700">
                                  PEN: {inv.banco_nombre_pen}
                                </span>
                              )}
                              {inv.banco_nombre_usd && (
                                <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[#0284c7] dark:text-[#38bdf8] font-bold border border-slate-200 dark:border-slate-700">
                                  USD: {inv.banco_nombre_usd}
                                </span>
                              )}
                              {!inv.banco_nombre_pen && !inv.banco_nombre_usd && (
                                <span className="text-slate-400 italic">Sin cuentas</span>
                              )}
                            </div>
                          </td>

                          {/* Compliance */}
                          <td className="py-3 px-4 text-center">
                            <span className={`inline-flex px-2 py-0.5 rounded text-[8.5px] font-mono font-black tracking-wider uppercase border ${stateStyle}`}>
                              {state}
                            </span>
                          </td>

                          {/* Acción */}
                          <td className="py-3 px-4 text-right">
                            <button
                              className="h-7 text-[10.5px] font-bold inline-flex items-center gap-1.5 px-3 rounded-lg border border-[#e2e8f0] dark:border-[#334155] bg-white dark:bg-[#1e293b] hover:bg-[#f0f9ff] hover:text-[#0284c7] hover:border-[#bae6fd] text-[#475569] dark:text-[#cbd5e1] transition-colors cursor-pointer shadow-xs"
                              onClick={() => handleOpenEditModal(inv)}
                            >
                              <Edit2 size={11} />
                              <span>Editar</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* --- NUEVA PESTAÑA: RETORNOS Y RENDIMIENTOS REACT (APROBADO) --- */}
      {activeSubTab === 'retornos_react' && (
        <div className="flex flex-col gap-6 w-full animate-fadeIn">
          
          {/* SECCIÓN 1: TABLERO ANUAL DE 12 MESES (CALENDARIO DE CIERRES EJECUTIVO APEFAC) */}
          <div className="glass-card p-6 flex flex-col gap-5 border-l-4 border-l-[#0284c7]">
            
            {/* Header del Calendario y Selector de Año */}
            <div className="flex items-center justify-between gap-4 flex-wrap pb-4 border-b border-[#e2e8f0] dark:border-[#334155]">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-[#f0f9ff] text-[#0284c7] dark:bg-[#0284c7]/15 dark:text-[#38bdf8] border border-[#bae6fd] dark:border-[#0284c7]/30 shadow-xs flex items-center justify-center">
                  <Calendar size={22} />
                </div>
                <div>
                  <h3 className="text-xs font-black text-[#0f172a] dark:text-[#f8fafc] uppercase tracking-wider flex items-center gap-2">
                    <span>Cronograma Anual de Cierres & Liquidaciones</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#f0f9ff] text-[#0284c7] dark:bg-[#0284c7]/20 dark:text-[#38bdf8] border border-[#bae6fd]">
                      {v40SelYear}
                    </span>
                  </h3>
                  <p className="text-[11px] text-[#64748b] dark:text-[#94a3b8] font-semibold mt-0.5">
                    Seleccione el período contable bimestral (B1-B6) o trimestral (Q1-Q4) para auditar y oficializar rendimientos.
                  </p>
                </div>
              </div>

              {/* Selector de Año con Pill Buttons */}
              <div className="flex items-center gap-1.5 bg-[#f8fafc] dark:bg-[#0b0f19] p-1 rounded-xl border border-[#e2e8f0] dark:border-[#334155] shadow-xs">
                {[2024, 2025, 2026, 2027].map(year => (
                  <button
                    key={year}
                    type="button"
                    onClick={() => setV40SelYear(year)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                      v40SelYear === year
                        ? 'bg-[#0284c7] text-white shadow-xs'
                        : 'text-[#64748b] hover:text-[#0f172a] dark:text-[#94a3b8] dark:hover:text-[#f8fafc] hover:bg-white dark:hover:bg-[#1e293b]'
                    }`}
                  >
                    {year}
                  </button>
                ))}
              </div>
            </div>

            {/* Grid de 12 Meses Ejecutivo (Ene - Dic) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
              {[
                { m: 1, name: 'Enero', cycle: null, label: 'Sin Cierres', corte: '-', funds: [] },
                { m: 2, name: 'Febrero', cycle: 'B1', label: 'Bimestre 1', corte: '28 Feb', funds: ['NSGPEN01', 'NSGPEN02', 'NSGPEN03', 'NSGUSD01', 'NSGUSD02'], cNum: 1, cType: 'Bimestre' },
                { m: 3, name: 'Marzo', cycle: 'Q1', label: 'Trimestre 1', corte: '31 Mar', funds: ['NSLCON01'], cNum: 1, cType: 'Trimestre' },
                { m: 4, name: 'Abril', cycle: 'B2', label: 'Bimestre 2', corte: '30 Abr', funds: ['NSGPEN01', 'NSGPEN02', 'NSGPEN03', 'NSGUSD01', 'NSGUSD02'], cNum: 2, cType: 'Bimestre' },
                { m: 5, name: 'Mayo', cycle: null, label: 'Sin Cierres', corte: '-', funds: [] },
                { m: 6, name: 'Junio', cycle: 'B3 / Q2', label: 'Bim. 3 / Q2', corte: '30 Jun', funds: ['NSGPEN01', 'NSGPEN02', 'NSGPEN03', 'NSGUSD01', 'NSGUSD02', 'NSLCON01'], cNum: 3, cType: 'Bimestre' },
                { m: 7, name: 'Julio', cycle: null, label: 'Sin Cierres', corte: '-', funds: [] },
                { m: 8, name: 'Agosto', cycle: 'B4', label: 'Bimestre 4', corte: '31 Ago', funds: ['NSGPEN01', 'NSGPEN02', 'NSGPEN03', 'NSGUSD01', 'NSGUSD02'], cNum: 4, cType: 'Bimestre' },
                { m: 9, name: 'Septiembre', cycle: 'Q3', label: 'Trimestre 3', corte: '30 Sep', funds: ['NSLCON01'], cNum: 3, cType: 'Trimestre' },
                { m: 10, name: 'Octubre', cycle: 'B5', label: 'Bimestre 5', corte: '31 Oct', funds: ['NSGPEN01', 'NSGPEN02', 'NSGPEN03', 'NSGUSD01', 'NSGUSD02'], cNum: 5, cType: 'Bimestre' },
                { m: 11, name: 'Noviembre', cycle: null, label: 'Sin Cierres', corte: '-', funds: [] },
                { m: 12, name: 'Diciembre', cycle: 'B6 / Q4', label: 'Bim. 6 / Q4', corte: '31 Dic', funds: ['NSGPEN01', 'NSGPEN02', 'NSGPEN03', 'NSGUSD01', 'NSGUSD02', 'NSLCON01'], cNum: 6, cType: 'Bimestre' }
              ].map(item => {
                // Verificar si este mes tiene cierres guardados en DB
                let isClosedInDb = false;
                if (item.m === 2) isClosedInDb = (cycleDashboard.B?.[1]?.length || 0) > 0;
                else if (item.m === 3) isClosedInDb = (cycleDashboard.Q?.[1]?.length || 0) > 0;
                else if (item.m === 4) isClosedInDb = (cycleDashboard.B?.[2]?.length || 0) > 0;
                else if (item.m === 6) isClosedInDb = ((cycleDashboard.B?.[3]?.length || 0) > 0) || ((cycleDashboard.Q?.[2]?.length || 0) > 0);
                else if (item.m === 8) isClosedInDb = (cycleDashboard.B?.[4]?.length || 0) > 0;
                else if (item.m === 9) isClosedInDb = (cycleDashboard.Q?.[3]?.length || 0) > 0;
                else if (item.m === 10) isClosedInDb = (cycleDashboard.B?.[5]?.length || 0) > 0;
                else if (item.m === 12) isClosedInDb = ((cycleDashboard.B?.[6]?.length || 0) > 0) || ((cycleDashboard.Q?.[4]?.length || 0) > 0);

                const hasCycle = item.funds.length > 0;
                const isSelected = (item.cType === v40SelCiclo && item.cNum === v40SelNum);

                return (
                  <div
                    key={item.m}
                    onClick={() => {
                      if (item.cType && item.cNum) {
                        setV40SelCiclo(item.cType as any);
                        setV40SelNum(item.cNum);
                        setV40SelFondo('TODOS');
                      }
                    }}
                    className={`rounded-2xl p-3.5 border transition-all flex flex-col justify-between min-h-[160px] ${
                      !hasCycle
                        ? 'bg-slate-50/40 dark:bg-slate-900/20 border-dashed border-[#e2e8f0] dark:border-[#334155] opacity-50'
                        : isSelected
                        ? 'bg-white dark:bg-[#1e293b] border-2 border-[#0284c7] shadow-md shadow-[#0284c7]/20 scale-[1.02] cursor-pointer'
                        : 'bg-white dark:bg-[#1e293b] border border-[#e2e8f0] dark:border-[#334155] hover:border-[#bae6fd] hover:shadow-sm cursor-pointer'
                    }`}
                  >
                    {/* Cabecera del Mes */}
                    <div className="flex items-start justify-between gap-1">
                      <div>
                        <span className="text-[10.5px] font-mono text-[#64748b] dark:text-[#94a3b8] font-bold block">
                          MES {String(item.m).padStart(2, '0')}
                        </span>
                        <span className="text-xs font-black text-[#0f172a] dark:text-[#f8fafc] uppercase tracking-wide">
                          {item.name}
                        </span>
                      </div>

                      {hasCycle && (
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-black uppercase shadow-xs ${
                          isClosedInDb
                            ? 'bg-[#ecfdf5] text-[#059669] border border-[#a7f3d0] dark:bg-[#059669]/20 dark:text-[#34d399]'
                            : 'bg-[#fff1f2] text-[#e11d48] border border-[#fecdd3] dark:bg-[#e11d48]/20 dark:text-[#fb7185]'
                        }`}>
                          {isClosedInDb ? '● CERRADO' : '● ABIERTO'}
                        </span>
                      )}
                    </div>

                    {/* Ciclo y Badges de Fondos (Todos los fondos del mes) */}
                    <div className="my-2 flex flex-col gap-1.5">
                      {hasCycle ? (
                        <>
                          <div className="flex items-center justify-between text-[10.5px]">
                            <span className="font-mono font-bold text-[#0284c7] dark:text-[#38bdf8]">
                              {item.cycle}
                            </span>
                            <span className="text-[10px] text-[#64748b] dark:text-[#94a3b8] font-mono font-bold">
                              {item.corte}
                            </span>
                          </div>

                          <div className="flex flex-wrap gap-1">
                            {item.funds.map(f => (
                              <span 
                                key={f} 
                                className="px-1.5 py-0.5 rounded text-[8px] font-mono font-bold bg-slate-100 dark:bg-slate-800/80 text-[#334155] dark:text-[#cbd5e1] border border-slate-200 dark:border-slate-700/60"
                              >
                                {f}
                              </span>
                            ))}
                          </div>
                        </>
                      ) : (
                        <div className="py-2 text-center text-[10px] font-medium text-slate-400 italic">
                          Sin cierres
                        </div>
                      )}
                    </div>

                    {/* Footer del Mes */}
                    <div className="border-t border-[#e2e8f0] dark:border-[#334155] pt-1.5 flex justify-between items-center text-[9.5px] text-[#64748b] dark:text-[#94a3b8] font-bold">
                      <span>{item.label}</span>
                      {hasCycle && (
                        <span className="font-mono text-[#0284c7] dark:text-[#38bdf8]">
                          {isSelected ? '✓ Activo' : 'Seleccionar'}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SECCIÓN 2: PANEL OPERATIVO COMPACTO EN 3 COLUMNAS HORIZONTALES (ESTILO APEFAC) */}
          <div className="glass-card p-5 flex flex-col gap-4">
            
            {/* Header del Panel y Modo Activo */}
            <div className="flex items-center justify-between gap-4 flex-wrap pb-3 border-b border-[#e2e8f0] dark:border-[#334155]">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-black text-[#0f172a] dark:text-[#f8fafc] uppercase tracking-wider">
                  ⚙️ Panel Operativo de Liquidación ({fStart} al {fEnd})
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <span className={`px-3 py-1 rounded-lg text-[11px] font-mono font-black tracking-wider uppercase border flex items-center gap-1.5 shadow-xs ${
                  collisionCount > 0 
                    ? 'bg-[#ecfdf5] dark:bg-[#059669]/15 text-[#059669] dark:text-[#34d399] border-[#a7f3d0] dark:border-[#059669]/30' 
                    : 'bg-[#fff1f2] dark:bg-[#e11d48]/15 text-[#e11d48] dark:text-[#fb7185] border-[#fecdd3] dark:border-[#e11d48]/30'
                }`}>
                  {collisionCount > 0 ? (
                    <>
                      <CheckCircle size={13} />
                      <span>🟢 PERÍODO CERRADO ({collisionCount} ASIENTOS)</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle size={13} />
                      <span>🔴 PERÍODO ABIERTO / SIMULACIÓN</span>
                    </>
                  )}
                </span>
              </div>
            </div>

            {/* GRID DE 4 COLUMNAS HORIZONTALES (WORKFLOW COMPLETO) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
              
              {/* COLUMNA 1: CONFIGURACIÓN DEL CORTE (2 DESPLEGABLES INTELIGENTES) */}
              <div className="p-4 bg-[#f8fafc] dark:bg-[#0b0f19] border border-[#e2e8f0] dark:border-[#334155] rounded-2xl flex flex-col justify-between gap-3 shadow-xs">
                <div className="flex items-center justify-between border-b border-[#e2e8f0] dark:border-[#334155] pb-2">
                  <span className="text-[11px] font-black text-[#0f172a] dark:text-[#f8fafc] uppercase tracking-wider">
                    1. Filtros del Período
                  </span>
                  <span className="text-[9.5px] font-mono font-bold text-[#0284c7] dark:text-[#38bdf8]">
                    {currentCierre.cycle}
                  </span>
                </div>

                <div className="flex flex-col gap-2.5">
                  {/* DESPLEGABLE 1: MES DE CIERRE / PERÍODO */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[9.5px] font-black text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wider">
                      📅 Mes de Cierre / Período
                    </label>
                    <select
                      className="w-full bg-white dark:bg-[#1e293b] border border-[#e2e8f0] dark:border-[#334155] rounded-xl py-2 px-3 text-xs font-bold text-[#0f172a] dark:text-[#f8fafc] focus:outline-none shadow-xs cursor-pointer"
                      value={`${v40SelCiclo}_${v40SelNum}`}
                      onChange={(e) => {
                        const val = e.target.value;
                        const found = PERIODOS_CIERRE.find(p => `${p.cType}_${p.cNum}` === val);
                        if (found) {
                          setV40SelCiclo(found.cType);
                          setV40SelNum(found.cNum);
                          setV40SelFondo('TODOS');
                        }
                      }}
                    >
                      {PERIODOS_CIERRE.map(p => (
                        <option key={p.id} value={`${p.cType}_${p.cNum}`}>
                          {p.mes} ({p.rango} · {p.label})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* DESPLEGABLE 2: FONDO A LIQUIDAR (FILTRADO POR EL MES SELECCIONADO) */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[9.5px] font-black text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wider">
                      🎯 Fondo a Liquidar
                    </label>
                    <select
                      className="w-full bg-white dark:bg-[#1e293b] border border-[#e2e8f0] dark:border-[#334155] rounded-xl py-2 px-3 text-xs font-bold text-[#0f172a] dark:text-[#f8fafc] focus:outline-none shadow-xs cursor-pointer"
                      value={v40SelFondo}
                      onChange={(e) => setV40SelFondo(e.target.value)}
                    >
                      <option value="TODOS">TODOS LOS FONDOS ({fondosDelCierre.length} Fondos)</option>
                      {fondosDelCierre.map(f => (
                        <option key={f.id_fondo} value={f.id_fondo}>
                          {f.nombre_fondo} ({f.id_fondo})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="pt-1 text-[9.5px] font-mono text-[#64748b] dark:text-[#94a3b8] text-right flex justify-between items-center">
                  <span className="text-[9px] text-slate-400 font-mono">
                    {currentCierre.rango}
                  </span>
                  <span>
                    Corte: <strong className="text-[#0284c7] dark:text-[#38bdf8]">{fEnd}</strong>
                  </span>
                </div>
              </div>

              {/* COLUMNA 2: PASO 1 · AUDITORÍA & REPORTES */}
              <div className="p-4 bg-[#f8fafc] dark:bg-[#0b0f19] border border-[#e2e8f0] dark:border-[#334155] rounded-2xl flex flex-col justify-between gap-3 shadow-xs">
                <div className="flex items-center justify-between border-b border-[#e2e8f0] dark:border-[#334155] pb-2">
                  <span className="text-[11px] font-black text-[#0f172a] dark:text-[#f8fafc] uppercase tracking-wider">
                    2. Auditoría & Reportes
                  </span>
                  <span className="text-[9.5px] font-mono font-bold text-[#059669] dark:text-[#34d399]">
                    Pre-Cierre
                  </span>
                </div>

                {/* Banners de Progreso si están activos */}
                {exportingExcel && (
                  <div className="bg-[#ecfdf5] dark:bg-[#059669]/15 border border-[#a7f3d0] dark:border-[#059669]/30 rounded-xl p-2 flex items-center gap-2 animate-pulse">
                    <Loader2 size={14} className="animate-spin text-[#059669]" />
                    <span className="text-[10.5px] font-black text-[#059669]">Compilando Excel...</span>
                  </div>
                )}
                {exportingPdf && (
                  <div className="bg-[#f0f9ff] dark:bg-[#0284c7]/15 border border-[#bae6fd] dark:border-[#0284c7]/30 rounded-xl p-2 flex items-center gap-2 animate-pulse">
                    <Loader2 size={14} className="animate-spin text-[#0284c7]" />
                    <span className="text-[10.5px] font-black text-[#0284c7]">Generando PDF...</span>
                  </div>
                )}

                <div className="flex flex-col gap-2">
                  <button
                    className="h-10 text-xs font-black uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-xs bg-[#ecfdf5] dark:bg-[#059669]/15 border border-[#a7f3d0] dark:border-[#059669]/30 text-[#059669] dark:text-[#34d399] hover:bg-[#d1fae5] transition-all disabled:opacity-60"
                    disabled={calcLoading || exportingExcel || exportingPdf}
                    onClick={async () => {
                      await handleExportExcelV40WithProgress();
                    }}
                  >
                    {exportingExcel ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : excelDownloaded ? (
                      <CheckCircle size={15} className="text-[#059669]" />
                    ) : (
                      <FileSpreadsheet size={15} />
                    )}
                    <span>{excelDownloaded ? '✓ Excel Maestro Listo' : 'Descargar Excel Maestro'}</span>
                  </button>

                  <button
                    className="h-10 text-xs font-black uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-xs bg-[#0284c7] hover:bg-[#0369a1] text-white transition-all disabled:opacity-60"
                    disabled={calcLoading || exportingExcel || exportingPdf || bcpLoading}
                    onClick={async () => {
                      await handleExportPDFV40();
                    }}
                  >
                    {exportingPdf ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : pdfDownloaded ? (
                      <CheckCircle size={15} className="text-white" />
                    ) : (
                      <FileText size={15} />
                    )}
                    <span>{pdfDownloaded ? '✓ Reporte PDF Listo' : 'Descargar Reporte PDF'}</span>
                  </button>
                </div>

                <p className="text-[9.5px] text-[#64748b] dark:text-[#94a3b8] font-medium leading-tight">
                  Audite los montos antes de la oficialización en base de datos.
                </p>
              </div>

              {/* COLUMNA 3: PASO 3 · OFICIALIZACIÓN & ROLLBACK */}
              <div className="p-4 bg-[#f8fafc] dark:bg-[#0b0f19] border border-[#e2e8f0] dark:border-[#334155] rounded-2xl flex flex-col justify-between gap-3 shadow-xs">
                <div className="flex items-center justify-between border-b border-[#e2e8f0] dark:border-[#334155] pb-2">
                  <span className="text-[11px] font-black text-[#0f172a] dark:text-[#f8fafc] uppercase tracking-wider">
                    3. Persistencia en Base de Datos
                  </span>
                  <span className="text-[9.5px] font-mono font-bold text-[#e11d48] dark:text-[#fb7185]">
                    Oficialización
                  </span>
                </div>

                {registerSuccessMsg && (
                  <div className="bg-[#ecfdf5] dark:bg-[#059669]/15 border border-[#a7f3d0] dark:border-[#059669]/30 rounded-xl p-2 flex items-center gap-1.5">
                    <CheckCircle className="text-[#059669]" size={14} />
                    <span className="text-[10px] font-bold text-[#059669]">{registerSuccessMsg}</span>
                  </div>
                )}

                <div className="flex flex-col gap-2">
                  {collisionCount > 0 ? (
                    <div className="h-10 rounded-xl bg-[#ecfdf5] dark:bg-[#059669]/10 border border-[#a7f3d0] dark:border-[#059669]/30 text-[#059669] dark:text-[#34d399] flex items-center justify-center gap-1.5 text-xs font-black uppercase">
                      <ShieldCheck size={16} />
                      <span>Período Oficializado</span>
                    </div>
                  ) : (
                    <button
                      className="h-10 text-xs font-black uppercase tracking-wider bg-[#059669] hover:bg-[#047857] text-white rounded-xl cursor-pointer shadow-xs transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                      onClick={() => {
                        setRegisterConfirmText('');
                        setRegisterModalOpen(true);
                      }}
                      disabled={officialRegisterLoading}
                    >
                      {officialRegisterLoading ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} />}
                      <span>Oficializar en Base de Datos</span>
                    </button>
                  )}

                  {collisionCount > 0 && (
                    <button
                      className="h-8 text-[11px] font-bold text-[#e11d48] dark:text-[#fb7185] hover:bg-[#fff1f2] dark:hover:bg-[#e11d48]/10 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-[#fecdd3] dark:border-[#e11d48]/30"
                      onClick={handleOpenRollbackModal}
                      disabled={rollbackLoading}
                    >
                      <Undo2 size={13} />
                      <span>Reversión / Rollback del Período</span>
                    </button>
                  )}
                </div>

                <p className="text-[9.5px] text-[#64748b] dark:text-[#94a3b8] font-medium leading-tight">
                  {collisionCount > 0 ? 'Protección activa contra duplicidad.' : 'Reversión disponible si requiere recalcular.'}
                </p>
              </div>

              {/* COLUMNA 4: PASO 4 · TRANSFERENCIAS MASIVAS (TELECRÉDITO BCP) */}
              <div className="p-4 bg-[#f8fafc] dark:bg-[#0b0f19] border border-[#e2e8f0] dark:border-[#334155] rounded-2xl flex flex-col justify-between gap-3 shadow-xs">
                <div className="flex items-center justify-between border-b border-[#e2e8f0] dark:border-[#334155] pb-2">
                  <span className="text-[11px] font-black text-[#0f172a] dark:text-[#f8fafc] uppercase tracking-wider">
                    4. Transferencias Bancarias
                  </span>
                  <span className="text-[9.5px] font-mono font-bold text-[#4f46e5] dark:text-[#818cf8]">
                    Telecrédito BCP
                  </span>
                </div>

                <div className="flex flex-col gap-2">
                  {/* Opción 1: Generar / Descargar TXT */}
                  <button
                    className="h-10 text-xs font-black uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-xs bg-[#4f46e5] hover:bg-[#4338ca] text-white transition-all disabled:opacity-60"
                    disabled={calcLoading || bcpLoading}
                    onClick={async () => {
                      await handlePrepareBcpBatch();
                    }}
                  >
                    {bcpLoading ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <Download size={15} />
                    )}
                    <span>Generar TXT BCP</span>
                  </button>

                  {/* Opción 2: Descargar Excel Auditoría BCP */}
                  <button
                    className="h-10 text-xs font-black uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-xs bg-[#eef2ff] dark:bg-[#312e81]/30 border border-[#c7d2fe] dark:border-[#4f46e5]/40 text-[#4338ca] dark:text-[#a5b4fc] hover:bg-[#e0e7ff] transition-all disabled:opacity-60"
                    disabled={calcLoading || bcpLoading}
                    onClick={async () => {
                      await handlePrepareBcpBatch();
                    }}
                  >
                    <FileSpreadsheet size={15} />
                    <span>Descargar Excel Auditoría</span>
                  </button>
                </div>

                <p className="text-[9.5px] text-[#64748b] dark:text-[#94a3b8] font-medium leading-tight">
                  Columna TRANSFERENCIAS (Rendimientos + Rescates).
                </p>
              </div>

            </div>

          </div>

        </div>
      )}


      {/* --- PESTAÑA C: EECC / RETENCIONES / 2 VISORES SIDE-BY-SIDE STANDARDIZED --- */}
      {activeSubTab === 'documentos' && (
        <div className="flex flex-col gap-5 w-full animate-fadeIn">
          
          {/* Header Card con Título y Estado Oficial */}
          <div className="glass-card p-5">
            <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-[#f0f9ff] dark:bg-[#0284c7]/15 rounded-xl text-[#0284c7] dark:text-[#38bdf8] border border-[#bae6fd] dark:border-[#0284c7]/30 shadow-xs">
                  <FileText size={22} />
                </div>
                <div>
                  <h3 className="text-xs font-black text-[#0f172a] dark:text-[#f8fafc] uppercase tracking-wider">
                    Auditoria y Emision: Estados de Cuenta & Certificados de Retencion
                  </h3>
                  <p className="text-[11px] text-[#64748b] dark:text-[#94a3b8] font-semibold">
                    Generacion masiva y visor side-by-side de EECC y Retenciones (5% IR) por contrato/participe.
                  </p>
                </div>
              </div>

              {/* Indicador de Estado del Periodo */}
              {collisionCount > 0 ? (
                <span className="px-3 py-1.5 rounded-lg text-xs font-black bg-[#ecfdf5] text-[#059669] dark:bg-[#059669]/15 dark:text-[#34d399] border border-[#a7f3d0] dark:border-[#059669]/30 flex items-center gap-1.5 shadow-xs">
                  <span className="w-2 h-2 rounded-full bg-[#059669] animate-pulse"></span>
                  PERIODO OFICIALIZADO ({collisionCount} Asientos)
                </span>
              ) : (
                <span className="px-3 py-1.5 rounded-lg text-xs font-black bg-[#fffbeb] text-[#d97706] dark:bg-[#d97706]/15 dark:text-[#fbbf24] border border-[#fde68a] dark:border-[#d97706]/30 flex items-center gap-1.5 shadow-xs">
                  <span className="w-2 h-2 rounded-full bg-[#d97706]"></span>
                  PERIODO EN BORRADOR / SIMULACION
                </span>
              )}
            </div>

            {/* FILA 1: OMNIBOX ESTANDARIZADO + PILLS DE FONDOS ORDENADOS + SELECTOR DE PERIODO AL FINAL */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-[#f8fafc] dark:bg-[#0b0f19] p-3.5 border border-[#e2e8f0] dark:border-[#334155] rounded-xl mb-4">
              
              {/* Omnibox Estandarizado */}
              <div className="relative flex-1 min-w-[240px] max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748b] dark:text-[#94a3b8]" size={15} />
                <input
                  type="text"
                  className="w-full bg-white dark:bg-[#1e293b] border border-[#e2e8f0] dark:border-[#334155] rounded-xl py-2 pl-9 pr-8 text-xs font-bold text-[#0f172a] dark:text-[#f8fafc] placeholder-[#94a3b8] focus:outline-none focus:border-[#0284c7] transition-all shadow-xs"
                  placeholder="Buscar por DNI, RUC, Inversionista, Contrato o Fondo..."
                  value={docSearchQuery}
                  onChange={(e) => setDocSearchQuery(e.target.value)}
                />
                {docSearchQuery && (
                  <button
                    onClick={() => setDocSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              {/* Pills de Fondos Ordenados (PEN 1 -> PEN 2 -> PEN 3 -> USD 01 -> USD 02 -> CON 01) */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setSelectedDocFondos([])}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                    selectedDocFondos.length === 0
                      ? 'bg-[#0284c7] text-white shadow-xs'
                      : 'bg-white dark:bg-[#1e293b] text-[#64748b] dark:text-[#94a3b8] border border-[#e2e8f0] dark:border-[#334155] hover:border-[#bae6fd]'
                  }`}
                >
                  TODOS
                </button>
                {orderedDocFunds.map(f => {
                  const label = getShortFundLabel(f.nombre_fondo);
                  const isSelected = selectedDocFondos.includes(f.id_fondo) || selectedDocFondos.includes(f.nombre_fondo) || selectedDocFondos.includes(label);
                  return (
                    <button
                      key={f.id_fondo}
                      type="button"
                      onClick={() => {
                        setSelectedDocFondos(prev => {
                          if (prev.includes(f.id_fondo)) return prev.filter(x => x !== f.id_fondo);
                          return [...prev, f.id_fondo];
                        });
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#0284c7] text-white shadow-xs'
                          : 'bg-white dark:bg-[#1e293b] text-[#475569] dark:text-[#cbd5e1] border border-[#e2e8f0] dark:border-[#334155] hover:border-[#bae6fd]'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              {/* Selector de Periodo al Final de la Fila */}
              <div className="flex items-center gap-2 flex-wrap ml-auto">
                <div className="flex items-center gap-1">
                  <span className="text-[10px] font-black text-[#64748b] dark:text-[#94a3b8] uppercase">Ano:</span>
                  <select
                    className="bg-white dark:bg-[#1e293b] border border-[#e2e8f0] dark:border-[#334155] rounded-lg py-1 px-2 text-xs font-mono font-bold text-[#0f172a] dark:text-[#f8fafc] focus:outline-none shadow-xs cursor-pointer"
                    value={v40SelYear}
                    onChange={(e) => setV40SelYear(Number(e.target.value))}
                  >
                    <option value={2024}>2024</option>
                    <option value={2025}>2025</option>
                    <option value={2026}>2026</option>
                    <option value={2027}>2027</option>
                  </select>
                </div>

                <div className="flex items-center gap-1">
                  <span className="text-[10px] font-black text-[#64748b] dark:text-[#94a3b8] uppercase">Ciclo:</span>
                  <select
                    className="bg-white dark:bg-[#1e293b] border border-[#e2e8f0] dark:border-[#334155] rounded-lg py-1 px-2 text-xs font-bold text-[#0f172a] dark:text-[#f8fafc] focus:outline-none shadow-xs cursor-pointer"
                    value={v40SelCiclo}
                    onChange={(e) => setV40SelCiclo(e.target.value as 'Bimestre' | 'Trimestre')}
                  >
                    <option value="Bimestre">Bimestre</option>
                    <option value="Trimestre">Trimestre</option>
                  </select>
                </div>

                <div className="flex items-center gap-1">
                  <span className="text-[10px] font-black text-[#64748b] dark:text-[#94a3b8] uppercase">Periodo:</span>
                  <select
                    className="bg-white dark:bg-[#1e293b] border border-[#e2e8f0] dark:border-[#334155] rounded-lg py-1 px-2 text-xs font-bold text-[#0f172a] dark:text-[#f8fafc] focus:outline-none shadow-xs cursor-pointer"
                    value={v40SelNum}
                    onChange={(e) => setV40SelNum(Number(e.target.value))}
                  >
                    {v40SelCiclo === 'Bimestre' ? (
                      <>
                        <option value={1}>B1 (Feb 28)</option>
                        <option value={2}>B2 (Abr 30)</option>
                        <option value={3}>B3 (Jun 30)</option>
                        <option value={4}>B4 (Ago 31)</option>
                        <option value={5}>B5 (Oct 31)</option>
                        <option value={6}>B6 (Dic 31)</option>
                      </>
                    ) : (
                      <>
                        <option value={1}>Q1 (Mar 31)</option>
                        <option value={2}>Q2 (Jun 30)</option>
                        <option value={3}>Q3 (Sep 30)</option>
                        <option value={4}>Q4 (Dic 31)</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

            </div>

            {/* FILA 2: BARRA DE ACCIONES, CANALES DE ENVIO (EMAIL Y WHATSAPP) Y DESCARGAS */}
            <div className="flex items-center justify-between gap-4 flex-wrap bg-[#f8fafc] dark:bg-[#0b0f19] border border-[#e2e8f0] dark:border-[#334155] p-3.5 rounded-xl shadow-xs mb-4">
              
              {/* Canales de Notificación y Botón de Envío */}
              <div className="flex items-center gap-3 flex-wrap">
                {/* Parámetros Operativos de Documentos: Fecha de Operación y Tipo de Cambio */}
                <div className="flex items-center gap-2 border-r border-[#cbd5e1] dark:border-[#334155] pr-3 mr-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] uppercase whitespace-nowrap">F. Op:</span>
                    <input
                      type="date"
                      value={docFechaOperacion}
                      onChange={(e) => setDocFechaOperacion(e.target.value)}
                      className="text-xs font-mono font-bold bg-white dark:bg-[#1e293b] border border-[#e2e8f0] dark:border-[#334155] rounded-lg px-2 py-1 text-[#0f172a] dark:text-[#f8fafc] focus:outline-none focus:border-[#0284c7] shadow-xs"
                      title="Fecha de Operación para Certificado de Retención"
                    />
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] uppercase whitespace-nowrap">TC:</span>
                    <input
                      type="number"
                      step="0.0001"
                      min="0"
                      value={docTipoCambio}
                      onChange={(e) => setDocTipoCambio(parseFloat(e.target.value) || 0)}
                      className="w-20 text-xs font-mono font-bold bg-white dark:bg-[#1e293b] border border-[#e2e8f0] dark:border-[#334155] rounded-lg px-2 py-1 text-[#0f172a] dark:text-[#f8fafc] focus:outline-none focus:border-[#0284c7] shadow-xs"
                      title="Tipo de Cambio USD/PEN para Certificado de Retención"
                    />
                  </div>
                </div>

                <span className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] uppercase">Canales de Envio:</span>
                
                <label className="flex items-center gap-1.5 text-xs font-bold text-[#0f172a] dark:text-[#f8fafc] cursor-pointer bg-white dark:bg-[#1e293b] px-2.5 py-1.5 rounded-lg border border-[#e2e8f0] dark:border-[#334155] shadow-xs">
                  <input
                    type="checkbox"
                    checked={docSendEmail}
                    onChange={(e) => setDocSendEmail(e.target.checked)}
                    className="accent-[#0284c7] cursor-pointer"
                  />
                  <Mail size={13} className="text-[#0284c7]" />
                  <span>Email</span>
                </label>

                <label className="flex items-center gap-1.5 text-xs font-bold text-[#0f172a] dark:text-[#f8fafc] cursor-pointer bg-white dark:bg-[#1e293b] px-2.5 py-1.5 rounded-lg border border-[#e2e8f0] dark:border-[#334155] shadow-xs">
                  <input
                    type="checkbox"
                    checked={docSendWhatsapp}
                    onChange={(e) => setDocSendWhatsapp(e.target.checked)}
                    className="accent-[#25d366] cursor-pointer"
                  />
                  <MessageSquare size={13} className="text-[#25d366]" />
                  <span>WhatsApp</span>
                </label>

                <button
                  type="button"
                  onClick={handleEnviarDocNotificaciones}
                  disabled={docSendingNotifications}
                  className="px-3.5 py-1.5 bg-[#0284c7] hover:bg-[#0369a1] disabled:opacity-60 text-white rounded-xl text-xs font-bold font-mono transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                  title="Enviar reportes seleccionados a participes via Email y WhatsApp"
                >
                  {docSendingNotifications ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                  <span>{docSendingNotifications ? 'Enviando...' : 'Enviar a Seleccion'}</span>
                </button>
              </div>

              {/* Botones de Descarga Masiva (Excel y ZIP) y Recarga */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleExportDocExcel}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold font-mono transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                  title="Descargar reporte consolidado en Excel"
                >
                  <FileSpreadsheet size={13} />
                  <span>Descargar Excel</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportDocZip}
                  disabled={docGeneratingZip}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-xl text-xs font-bold font-mono transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                  title="Empaquetar y descargar todos los PDFs de seleccion en ZIP"
                >
                  {docGeneratingZip ? <Loader2 size={13} className="animate-spin" /> : <Archive size={13} />}
                  <span>
                    {docGeneratingZip 
                      ? `Empaquetando (${docZipProgress.current}/${docZipProgress.total})...` 
                      : 'Descargar ZIP (PDFs)'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setDocReloadKey(Date.now())}
                  className="px-3 py-1.5 bg-white dark:bg-[#1e293b] hover:bg-[#f0f9ff] text-[#475569] dark:text-[#cbd5e1] hover:text-[#0284c7] border border-[#e2e8f0] dark:border-[#334155] rounded-xl text-xs font-bold font-mono transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                  title="Recargar datos de documentos"
                >
                  <RotateCcw size={13} />
                  <span>Recargar</span>
                </button>
              </div>

            </div>

            {/* Banner de Estado de Notificación */}
            {docNotificationStatus && (
              <div className="p-3 mb-4 rounded-xl bg-[#f0fdf4] dark:bg-[#059669]/20 border border-[#bbf7d0] dark:border-[#059669]/30 text-[#166534] dark:text-[#86efac] text-xs font-bold flex items-center gap-2 animate-fadeIn">
                <CheckCircle size={15} />
                <span>{docNotificationStatus}</span>
              </div>
            )}

            {/* TABLA PRINCIPAL DE DOCUMENTOS CON DOBLE CHECKBOX Y VISOR ACORDEON */}
            <div className="w-full overflow-x-auto rounded-xl border border-[#e2e8f0] dark:border-[#334155] shadow-xs">
              <table className="w-full text-left text-xs border-collapse">
                
                {/* Cabecera Principal */}
                <thead>
                  <tr className="bg-[#0f172a] text-white font-mono text-[10.5px] uppercase">
                    {/* Checkbox Master Retención */}
                    <th className="p-2.5 text-center w-12 border-r border-slate-700">
                      <div className="flex flex-col items-center gap-0.5">
                        <button
                          type="button"
                          onClick={toggleAllRet}
                          className="text-white hover:text-amber-300 cursor-pointer"
                          title="Seleccionar / Deseleccionar todos los Certificados de Retencion"
                        >
                          {docEventsFiltered.length > 0 && docEventsFiltered.every(e => selectedRetIds.has(e.id_evento || e.id_contrato || e.id_certificado)) ? (
                            <CheckSquare size={15} className="text-amber-400" />
                          ) : (
                            <Square size={15} />
                          )}
                        </button>
                        <span className="text-[8.5px] text-amber-300 font-bold">RET</span>
                      </div>
                    </th>

                    {/* Checkbox Master EECC */}
                    <th className="p-2.5 text-center w-12 border-r border-slate-700">
                      <div className="flex flex-col items-center gap-0.5">
                        <button
                          type="button"
                          onClick={toggleAllEecc}
                          className="text-white hover:text-sky-300 cursor-pointer"
                          title="Seleccionar / Deseleccionar todos los Estados de Cuenta (EECC)"
                        >
                          {docEventsFiltered.length > 0 && docEventsFiltered.every(e => selectedEeccIds.has(e.id_evento || e.id_contrato || e.id_certificado)) ? (
                            <CheckSquare size={15} className="text-sky-400" />
                          ) : (
                            <Square size={15} />
                          )}
                        </button>
                        <span className="text-[8.5px] text-sky-300 font-bold">EECC</span>
                      </div>
                    </th>

                    <th className="p-2.5">N° Contrato / Cert.</th>
                    <th className="p-2.5">Participe / Inversionista</th>
                    <th className="p-2.5 text-center">Moneda</th>
                    <th className="p-2.5 text-right">Capital Base</th>
                    <th className="p-2.5 text-right">Interes Bruto</th>
                    <th className="p-2.5 text-right">Retencion 5%</th>
                    <th className="p-2.5 text-right">Deducciones</th>
                    <th className="p-2.5 text-right">Neto Disp.</th>
                    <th className="p-2.5 text-right">Transferencia</th>
                    <th className="p-2.5 text-right">Capital Final</th>
                    <th className="p-2.5 text-center w-24">Visor</th>
                  </tr>
                </thead>

                {/* Cuerpo de la Tabla */}
                <tbody className="divide-y divide-[#e2e8f0] dark:divide-[#334155] bg-white dark:bg-[#151e2e]">
                  {docLoading ? (
                    <tr>
                      <td colSpan={13} className="p-8 text-center text-slate-500">
                        <div className="flex items-center justify-center gap-2">
                          <Loader2 size={18} className="animate-spin text-[#0284c7]" />
                          <span className="font-bold text-xs">Cargando documentos contables del periodo...</span>
                        </div>
                      </td>
                    </tr>
                  ) : docEventsFiltered.length === 0 ? (
                    <tr>
                      <td colSpan={13} className="p-8 text-center text-slate-500 font-medium">
                        No se encontraron registros contables para el periodo {fEnd} con los filtros seleccionados.
                      </td>
                    </tr>
                  ) : (
                    docEventsGroupedByFondo.map(group => (
                      <React.Fragment key={group.fondoKey}>
                        {/* Cabecera de Fondo */}
                        <tr className="bg-slate-100 dark:bg-slate-800/80 font-bold text-[#0f172a] dark:text-[#f8fafc]">
                          <td colSpan={13} className="p-2.5 px-4 text-xs tracking-wider uppercase border-y border-slate-200 dark:border-slate-700">
                            <span className="font-mono text-[#0284c7] dark:text-[#38bdf8] mr-2">●</span>
                            <span>{group.fondoNombre}</span>
                            <span className="ml-3 text-[10.5px] font-mono text-slate-500 font-normal">
                              ({group.events.length} contratos | Moneda: {group.moneda})
                            </span>
                          </td>
                        </tr>

                        {/* Filas de Contratos / Certificados */}
                        {group.events.map((e, idx) => {
                          const rowId = e.id_evento || e.id_contrato || e.id_certificado;
                          const isRetSelected = selectedRetIds.has(rowId);
                          const isEeccSelected = selectedEeccIds.has(rowId);
                          const isExpanded = expandedVisorIds.has(rowId);
                          const eeccData = getEeccRowData(e);
                          const retData = getRetencionRowData(e);
                          const hasRetencion = Number(e.impuestos_renta || 0) > 0;

                          return (
                            <React.Fragment key={rowId || idx}>
                              <tr className={`transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 ${
                                isExpanded ? 'bg-[#f0f9ff]/60 dark:bg-[#0284c7]/10' : ''
                              }`}>
                                
                                {/* Checkbox RET */}
                                <td className="p-2.5 text-center border-r border-slate-200 dark:border-slate-800">
                                  {hasRetencion ? (
                                    <input
                                      type="checkbox"
                                      checked={isRetSelected}
                                      onChange={() => toggleSelectRet(rowId)}
                                      className="accent-amber-500 cursor-pointer w-3.5 h-3.5"
                                      title="Seleccionar Certificado de Retencion"
                                    />
                                  ) : (
                                    <span className="text-[10px] text-slate-300 dark:text-slate-600 font-mono">-</span>
                                  )}
                                </td>

                                {/* Checkbox EECC */}
                                <td className="p-2.5 text-center border-r border-slate-200 dark:border-slate-800">
                                  <input
                                    type="checkbox"
                                    checked={isEeccSelected}
                                    onChange={() => toggleSelectEecc(rowId)}
                                    className="accent-[#0284c7] cursor-pointer w-3.5 h-3.5"
                                    title="Seleccionar Estado de Cuenta (EECC)"
                                  />
                                </td>

                                {/* N° Contrato / Certificado */}
                                <td className="p-2.5 font-mono font-bold text-[#0f172a] dark:text-[#f8fafc] whitespace-nowrap">
                                  {eeccData.id_certificado}
                                </td>

                                {/* Inversionista */}
                                <td className="p-2.5 font-medium text-[#1e293b] dark:text-[#e2e8f0]">
                                  {eeccData.inversionista_nombre}
                                </td>

                                {/* Moneda */}
                                <td className="p-2.5 text-center font-mono font-bold text-slate-500 text-[11px]">
                                  {eeccData.moneda}
                                </td>

                                {/* Capital Base */}
                                <td className="p-2.5 text-right font-mono font-semibold text-slate-700 dark:text-slate-300">
                                  {formatNumDoc(eeccData.capital_inicial)}
                                </td>

                                {/* Interés Bruto */}
                                <td className="p-2.5 text-right font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                                  {formatNumDoc(eeccData.bruto_total)}
                                </td>

                                {/* Retención 5% */}
                                <td className="p-2.5 text-right font-mono font-semibold text-amber-600 dark:text-amber-400">
                                  {formatNumDoc(eeccData.impuesto)}
                                </td>

                                {/* Deducciones */}
                                <td className="p-2.5 text-right font-mono text-slate-500">
                                  {formatNumDoc(eeccData.deducciones)}
                                </td>

                                {/* Neto Disponible */}
                                <td className="p-2.5 text-right font-mono font-bold text-[#0f172a] dark:text-[#f8fafc]">
                                  {formatNumDoc(eeccData.neto_disponible)}
                                </td>

                                {/* Total Transferido */}
                                <td className="p-2.5 text-right font-mono font-black text-[#0284c7] dark:text-[#38bdf8]">
                                  {formatNumDoc(eeccData.monto_transferido)}
                                </td>

                                {/* Capital Final */}
                                <td className="p-2.5 text-right font-mono font-bold text-slate-800 dark:text-slate-200">
                                  {formatNumDoc(eeccData.capital_final)}
                                </td>

                                {/* Botón Visor Acordeón */}
                                <td className="p-2.5 text-center">
                                  <button
                                    type="button"
                                    onClick={() => toggleVisor(rowId)}
                                    className={`h-7 px-2.5 rounded-lg text-xs font-bold font-mono transition-all inline-flex items-center gap-1 cursor-pointer shadow-xs ${
                                      isExpanded
                                        ? 'bg-[#0284c7] text-white'
                                        : 'bg-white dark:bg-[#1e293b] text-[#475569] dark:text-[#cbd5e1] border border-[#e2e8f0] dark:border-[#334155] hover:border-[#bae6fd] hover:text-[#0284c7]'
                                    }`}
                                  >
                                    <span>Visor</span>
                                    {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                  </button>
                                </td>
                              </tr>

                              {/* FILA ACORDEON EXPANDIDA: 2 VISORES SIDE-BY-SIDE */}
                              {isExpanded && (
                                <tr className="bg-slate-50/80 dark:bg-slate-900/60 border-y-2 border-[#0284c7]/40">
                                  <td colSpan={13} className="p-4">
                                    <div className="flex flex-col gap-4">
                                      
                                      <div className="flex items-center justify-between pb-2 border-b border-[#e2e8f0] dark:border-[#334155]">
                                        <div className="flex items-center gap-2">
                                          <span className="text-xs font-black uppercase text-[#0f172a] dark:text-[#f8fafc]">
                                            Visor de Documentos: {eeccData.id_certificado} — {eeccData.inversionista_nombre}
                                          </span>
                                        </div>
                                        <div className="text-[11px] font-mono text-slate-500">
                                          Periodo: {fStart} al {fEnd}
                                        </div>
                                      </div>

                                      {/* Contenedor Grid 2 Columnas Side-by-Side */}
                                      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                                        
                                        {/* COLUMNA IZQUIERDA: ESTADO DE CUENTA (EECC) */}
                                        <div className="flex flex-col gap-2.5 bg-white dark:bg-[#151e2e] p-3.5 rounded-xl border border-[#e2e8f0] dark:border-[#334155] shadow-xs">
                                          <div className="flex items-center justify-between pb-2 border-b border-slate-150 dark:border-slate-800">
                                            <div className="flex items-center gap-2">
                                              <FileText size={16} className="text-[#0284c7] dark:text-[#38bdf8]" />
                                              <h4 className="text-xs font-black uppercase text-[#0f172a] dark:text-[#f8fafc]">
                                                Estado de Cuenta (EECC)
                                              </h4>
                                            </div>
                                            <button
                                              type="button"
                                              onClick={() => handleDownloadFastPdf(generateSingleEeccHtml(eeccData), `EECC_${eeccData.id_certificado}_${fEnd}.pdf`)}
                                              disabled={downloadingPdf === `EECC_${eeccData.id_certificado}_${fEnd}.pdf`}
                                              className="h-7 px-2.5 bg-[#0284c7] hover:bg-[#0369a1] text-white rounded-lg text-xs font-bold font-mono transition-all shadow-xs flex items-center gap-1 cursor-pointer"
                                            >
                                              {downloadingPdf === `EECC_${eeccData.id_certificado}_${fEnd}.pdf` ? <Loader2 size={11} className="animate-spin" /> : <Download size={11} />}
                                              <span>Descargar EECC PDF</span>
                                            </button>
                                          </div>

                                          <div className="rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-white">
                                            <iframe
                                              srcDoc={generateSingleEeccHtml(eeccData)}
                                              className="w-full h-[600px] border-none"
                                              title={`Visor EECC ${eeccData.id_certificado}`}
                                            />
                                          </div>
                                        </div>

                                        {/* COLUMNA DERECHA: CERTIFICADO DE RETENCION (5% IR) */}
                                        <div className="flex flex-col gap-2.5 bg-white dark:bg-[#151e2e] p-3.5 rounded-xl border border-[#e2e8f0] dark:border-[#334155] shadow-xs">
                                          <div className="flex items-center justify-between pb-2 border-b border-slate-150 dark:border-slate-800">
                                            <div className="flex items-center gap-2">
                                              <FileSpreadsheet size={16} className="text-amber-500" />
                                              <h4 className="text-xs font-black uppercase text-[#0f172a] dark:text-[#f8fafc]">
                                                Certificado de Retencion (5% IR)
                                              </h4>
                                            </div>
                                            {hasRetencion ? (
                                              <button
                                                type="button"
                                                onClick={() => handleDownloadFastPdf(generateSingleRetencionHtml(retData), `RETENCION_${eeccData.id_certificado}_${fEnd}.pdf`)}
                                                disabled={downloadingPdf === `RETENCION_${eeccData.id_certificado}_${fEnd}.pdf`}
                                                className="h-7 px-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold font-mono transition-all shadow-xs flex items-center gap-1 cursor-pointer"
                                              >
                                                {downloadingPdf === `RETENCION_${eeccData.id_certificado}_${fEnd}.pdf` ? <Loader2 size={11} className="animate-spin" /> : <Download size={11} />}
                                                <span>Descargar Retencion PDF</span>
                                              </button>
                                            ) : (
                                              <span className="text-[10.5px] font-mono text-slate-400 italic">Sin retencion en el periodo</span>
                                            )}
                                          </div>

                                          {hasRetencion ? (
                                            <div className="rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-white">
                                              <iframe
                                                srcDoc={generateSingleRetencionHtml(retData)}
                                                className="w-full h-[600px] border-none"
                                                title={`Visor Retencion ${eeccData.id_certificado}`}
                                              />
                                            </div>
                                          ) : (
                                            <div className="h-[600px] flex items-center justify-center border border-dashed border-slate-200 dark:border-slate-700 rounded-lg text-slate-400 font-medium text-xs">
                                              Este contrato no genero retenciones de impuesto a la renta en el periodo seleccionado.
                                            </div>
                                          )}
                                        </div>

                                      </div>

                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </React.Fragment>
                    ))
                  )}
                </tbody>
              </table>
            </div>

          </div>

        </div>
      )}

      {/* --- PESTAÑA D: COMISIONES DE ASESORES COMERCIALES --- */}
      {activeSubTab === 'comisiones' && (
        <ComisionesAsesoresTab />
      )}

      {/* --- FORMULARIO MODAL INTERACTIVO DE CREACIÓN / EDICIÓN (5 TABS) --- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-3xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">
            
            {/* Cabecera del Modal */}
            <div className="p-5 border-b border-slate-150 dark:border-slate-800/80 flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-850 dark:text-slate-100 uppercase tracking-wider">
                {formMode === 'crear' ? '➕ Registrar Inversionista' : '✏️ Editar Ficha Inversionista'}
              </h3>
              <button 
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                onClick={() => setIsModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            {/* Selector de sub-pestanas del formulario */}
            <div className="px-5 bg-slate-50 dark:bg-slate-950 border-b border-slate-150 dark:border-slate-850 flex gap-4 overflow-x-auto whitespace-nowrap scrollbar-none">
              {(['identidad', 'asesor', 'conyuge', 'laboral', 'bancario', 'compliance'] as const).map(tab => (
                <button
                  key={tab}
                  type="button"
                  className={`py-2.5 text-[10px] font-black uppercase tracking-wider border-b-2 cursor-pointer transition-colors ${
                    formActiveTab === tab 
                      ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400' 
                      : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-350'
                  }`}
                  onClick={() => setFormActiveTab(tab)}
                >
                  {tab === 'identidad' && 'Identidad'}
                  {tab === 'asesor' && '💼 Asesor Asignado'}
                  {tab === 'conyuge' && 'Cónyuge'}
                  {tab === 'laboral' && 'Laboral'}
                  {tab === 'bancario' && 'Bancario'}
                  {tab === 'compliance' && 'Compliance'}
                </button>
              ))}
            </div>

            {/* Cuerpo del Formulario */}
            <form onSubmit={handleFormSubmit} className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
              
              {/* --- SUB-TAB 1: IDENTIDAD --- */}
              {formActiveTab === 'identidad' && (
                <div className="flex flex-col gap-4 animate-fadeIn">
                  <h4 className="text-xs font-bold text-slate-805 dark:text-slate-200 uppercase tracking-tight">Información Personal</h4>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">N° Documento *</label>
                      <input
                        type="text"
                        className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 disabled:bg-slate-50 dark:disabled:bg-slate-900 disabled:text-slate-400"
                        value={formData.documento_identidad || ''}
                        onChange={(e) => handleInputChange('documento_identidad', e.target.value)}
                        disabled={formMode === 'editar'}
                        placeholder="DNI, RUC, etc."
                        required
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Tipo Doc *</label>
                      <select
                        className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-600"
                        value={formData.tipo_doc || 'DNI'}
                        onChange={(e) => handleInputChange('tipo_doc', e.target.value)}
                        required
                      >
                        <option value="DNI">DNI</option>
                        <option value="CEX">CEX</option>
                        <option value="PASAPORTE">PASAPORTE</option>
                        <option value="RUC">RUC</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Primer Nombre *</label>
                      <input
                        type="text"
                        className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none focus:border-emerald-600"
                        value={formData.nombre_1 || ''}
                        onChange={(e) => handleInputChange('nombre_1', e.target.value)}
                        placeholder="Nombres"
                        required
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Segundo Nombre</label>
                      <input
                        type="text"
                        className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                        value={formData.nombre_2 || ''}
                        onChange={(e) => handleInputChange('nombre_2', e.target.value)}
                        placeholder="Segundo nombre (opcional)"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Primer Apellido *</label>
                      <input
                        type="text"
                        className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none focus:border-emerald-600"
                        value={formData.apellido_1 || ''}
                        onChange={(e) => handleInputChange('apellido_1', e.target.value)}
                        placeholder="Primer apellido"
                        required
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Segundo Apellido</label>
                      <input
                        type="text"
                        className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                        value={formData.apellido_2 || ''}
                        onChange={(e) => handleInputChange('apellido_2', e.target.value)}
                        placeholder="Segundo apellido"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Fecha Nacimiento</label>
                      <input
                        type="date"
                        className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                        value={formData.fecha_nacimiento || ''}
                        onChange={(e) => handleInputChange('fecha_nacimiento', e.target.value)}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Estado Civil</label>
                      <select
                        className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-600"
                        value={formData.estado_civil || 'Soltero(a)'}
                        onChange={(e) => handleInputChange('estado_civil', e.target.value)}
                      >
                        <option value="Soltero(a)">Soltero(a)</option>
                        <option value="Casado(a)">Casado(a)</option>
                        <option value="Divorciado(a)">Divorciado(a)</option>
                        <option value="Viudo(a)">Viudo(a)</option>
                        <option value="Conviviente">Conviviente</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Nacionalidad</label>
                      <input
                        type="text"
                        className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                        value={formData.nacionalidad || 'Peruano(a)'}
                        onChange={(e) => handleInputChange('nacionalidad', e.target.value)}
                      />
                    </div>
                    <div className="flex items-center gap-2 mt-6">
                      <input
                        type="checkbox"
                        id="residente_peru"
                        className="rounded text-emerald-600 focus:ring-emerald-600 h-4 w-4"
                        checked={formData.residente_peru ?? true}
                        onChange={(e) => handleInputChange('residente_peru', e.target.checked)}
                      />
                      <label htmlFor="residente_peru" className="text-xs font-bold text-slate-700 dark:text-slate-400">¿Es residente en el Perú?</label>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Correo Electrónico</label>
                      <input
                        type="email"
                        className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                        value={formData.email || ''}
                        onChange={(e) => handleInputChange('email', e.target.value)}
                        placeholder="nombre@ejemplo.com"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Teléfono / Celular</label>
                      <input
                        type="text"
                        className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                        value={formData.telefono || ''}
                        onChange={(e) => handleInputChange('telefono', e.target.value)}
                        placeholder="N° Teléfono"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Dirección Fiscal</label>
                    <textarea
                      rows={2}
                      className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                      value={formData.direccion_fiscal || ''}
                      onChange={(e) => handleInputChange('direccion_fiscal', e.target.value)}
                      placeholder="Dirección fiscal registrada"
                    />
                  </div>

                  <div className="w-1/3 flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Código Postal</label>
                    <input
                      type="text"
                      className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                      value={formData.codigo_postal || ''}
                      onChange={(e) => handleInputChange('codigo_postal', e.target.value)}
                    />
                  </div>
                </div>
              )}

              {/* --- SUB-TAB 2: ASESOR ASIGNADO Y GESTIÓN DE CARTERA --- */}
              {formActiveTab === 'asesor' && (
                <div className="flex flex-col gap-5 animate-fadeIn">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-150 dark:border-slate-800">
                    <div>
                      <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight flex items-center gap-2">
                        <span>💼 Asesor Comercial Asignado</span>
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Consulte o reasigne el asesor responsable del inversionista y sincronice sus contratos.
                      </p>
                    </div>
                  </div>

                  {/* Selector de Asesor Comercial */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">
                        Asesor Comercial Responsable
                      </label>
                      <select
                        className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-600"
                        value={selectedFormAsesor}
                        onChange={(e) => setSelectedFormAsesor(e.target.value)}
                      >
                        <option value="">-- SELECCIONAR ASESOR COMERCIAL --</option>
                        {asesoresList.map((ase) => (
                          <option key={ase.codigo || ase.id} value={ase.codigo || ase.id}>
                            {ase.nombre_completo} {ase.codigo ? `(${ase.codigo})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center gap-2 mt-5">
                      <input
                        type="checkbox"
                        id="reasignar_contratos"
                        className="rounded text-emerald-600 focus:ring-emerald-600 h-4 w-4 cursor-pointer"
                        checked={reasignarContratos}
                        onChange={(e) => setReasignarContratos(e.target.checked)}
                      />
                      <label htmlFor="reasignar_contratos" className="text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                        Sincronizar contratos vinculados ({selectedInvContracts.length})
                      </label>
                    </div>
                  </div>

                  {/* Ficha Resumen del Asesor Seleccionado */}
                  {(() => {
                    const aseObj = asesoresList.find(a => (a.codigo && a.codigo === selectedFormAsesor) || (a.id && a.id === selectedFormAsesor));
                    if (!aseObj) {
                      return (
                        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-400 italic">
                          Seleccione un asesor comercial para visualizar sus datos de contacto y detalles institucionales.
                        </div>
                      );
                    }
                    return (
                      <div className="p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800/60 flex flex-col gap-3 shadow-xs">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-xl bg-linear-to-br from-indigo-600 to-violet-700 text-white font-mono font-black text-sm flex items-center justify-center shrink-0 shadow-xs">
                            {aseObj.nombre_completo?.charAt(0) || 'A'}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-xs font-black text-[#0f172a] dark:text-[#f8fafc] uppercase">
                              {aseObj.nombre_completo}
                            </span>
                            <span className="text-[10px] font-mono font-bold text-indigo-600 dark:text-indigo-400">
                              Código: {aseObj.codigo || 'N/A'} · Doc: {aseObj.documento_identidad || 'N/A'}
                            </span>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono pt-2 border-t border-indigo-100 dark:border-indigo-900/50">
                          <span className="text-slate-600 dark:text-slate-300">
                            📞 Teléfono: <strong className="text-[#0f172a] dark:text-white">{aseObj.telefono || 'No registrado'}</strong>
                          </span>
                          <span className="text-slate-600 dark:text-slate-300">
                            ✉️ Email: <strong className="text-[#0f172a] dark:text-white">{aseObj.email || 'No registrado'}</strong>
                          </span>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Lista de Contratos del Inversionista */}
                  <div className="flex flex-col gap-2 pt-1">
                    <span className="text-[10.5px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                      Contratos Vinculados a este Partícipe ({selectedInvContracts.length})
                    </span>
                    {selectedInvContracts.length === 0 ? (
                      <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 text-[11px] text-slate-400 text-center italic">
                        No tiene contratos registrados actualmente.
                      </div>
                    ) : (
                      <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden max-h-48 overflow-y-auto shadow-xs">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead className="bg-slate-100 dark:bg-slate-950 text-[10px] font-mono text-slate-500 uppercase sticky top-0">
                            <tr>
                              <th className="py-2 px-3">Contrato</th>
                              <th className="py-2 px-2">Fondo</th>
                              <th className="py-2 px-3 text-right">Monto</th>
                              <th className="py-2 px-2 text-center">Estado</th>
                              <th className="py-2 px-3">Asesor Actual</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[11px] font-mono">
                            {selectedInvContracts.map(c => (
                              <tr key={c.id_contrato || c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                <td className="py-1.5 px-3 font-bold text-[#0f172a] dark:text-[#f8fafc]">{c.id_contrato || c.id}</td>
                                <td className="py-1.5 px-2 font-bold text-indigo-600 dark:text-indigo-400">{c.id_fondo}</td>
                                <td className="py-1.5 px-3 text-right font-bold text-emerald-600">
                                  {c.moneda === 'USD' ? '$' : 'S/'} {Number(c.monto_inversion || c.capital || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                                </td>
                                <td className="py-1.5 px-2 text-center">
                                  <span className="px-1.5 py-0.5 rounded text-[8.5px] font-bold uppercase bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                    {c.estado}
                                  </span>
                                </td>
                                <td className="py-1.5 px-3 font-sans text-slate-600 dark:text-slate-300">
                                  {asesorMapByCode[String(c.id_asesor || '').trim().toLowerCase()]?.nombre_completo || c.id_asesor || 'Sin Asesor'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* --- SUB-TAB 3: CÓNYUGE --- */}
              {formActiveTab === 'conyuge' && (
                <div className="flex flex-col gap-4 animate-fadeIn">
                  <h4 className="text-xs font-bold text-slate-805 dark:text-slate-200 uppercase tracking-tight text-slate-700">Información del Cónyuge</h4>
                  
                  {(!['Casado(a)', 'Conviviente'].includes(formData.estado_civil || '')) ? (
                    <div className="bg-slate-50 dark:bg-slate-950 text-slate-450 dark:text-slate-500 border border-slate-200 dark:border-slate-850 rounded-xl p-6 text-center text-xs font-semibold">
                      🔒 No disponible. Se habilita únicamente si el Estado Civil es "Casado(a)" o "Conviviente" (Actual: {formData.estado_civil || 'Soltero'}).
                    </div>
                  ) : (
                    <div className="flex flex-col gap-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Primer Nombre Cónyuge</label>
                          <input
                            type="text"
                            className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                            value={formData.conyuge_nombre_1 || ''}
                            onChange={(e) => handleInputChange('conyuge_nombre_1', e.target.value)}
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Segundo Nombre Cónyuge</label>
                          <input
                            type="text"
                            className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                            value={formData.conyuge_nombre_2 || ''}
                            onChange={(e) => handleInputChange('conyuge_nombre_2', e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Primer Apellido Cónyuge</label>
                          <input
                            type="text"
                            className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                            value={formData.conyuge_apellido_1 || ''}
                            onChange={(e) => handleInputChange('conyuge_apellido_1', e.target.value)}
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Segundo Apellido Cónyuge</label>
                          <input
                            type="text"
                            className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                            value={formData.conyuge_apellido_2 || ''}
                            onChange={(e) => handleInputChange('conyuge_apellido_2', e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Tipo Doc Cónyuge</label>
                          <select
                            className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                            value={formData.conyuge_tipo_documento || 'DNI'}
                            onChange={(e) => handleInputChange('conyuge_tipo_documento', e.target.value)}
                          >
                            <option value="DNI">DNI</option>
                            <option value="CEX">CEX</option>
                            <option value="PASAPORTE">PASAPORTE</option>
                          </select>
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">N° Documento Cónyuge</label>
                          <input
                            type="text"
                            className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                            value={formData.conyuge_num_documento || ''}
                            onChange={(e) => handleInputChange('conyuge_num_documento', e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* --- SUB-TAB 3: LABORAL --- */}
              {formActiveTab === 'laboral' && (
                <div className="flex flex-col gap-4 animate-fadeIn">
                  <h4 className="text-xs font-bold text-slate-805 dark:text-slate-200 uppercase tracking-tight text-slate-700">Información Laboral</h4>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Ocupación / Profesión</label>
                      <input
                        type="text"
                        className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                        value={formData.ocupacion || ''}
                        onChange={(e) => handleInputChange('ocupacion', e.target.value)}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Cargo Ocupado</label>
                      <input
                        type="text"
                        className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                        value={formData.cargo_ocupado || ''}
                        onChange={(e) => handleInputChange('cargo_ocupado', e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Centro Laboral</label>
                      <input
                        type="text"
                        className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                        value={formData.centro_labores || ''}
                        onChange={(e) => handleInputChange('centro_labores', e.target.value)}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Antigüedad Laboral (Años)</label>
                      <input
                        type="number"
                        className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                        value={formData.antiguedad_laboral_anios ?? 0}
                        onChange={(e) => handleInputChange('antiguedad_laboral_anios', parseInt(e.target.value, 10) || 0)}
                        min={0}
                        max={60}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* --- SUB-TAB 4: BANCARIO --- */}
              {formActiveTab === 'bancario' && (
                <div className="flex flex-col gap-6 animate-fadeIn">
                  
                  {/* Cuentas Soles */}
                  <div className="flex flex-col gap-3">
                    <h4 className="text-xs font-bold text-emerald-600 dark:text-emerald-450 uppercase tracking-tight">Cuentas Soles Oficiales (PEN)</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Banco (PEN)</label>
                        <select
                          className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                          value={formData.banco_nombre_pen || ''}
                          onChange={(e) => handleInputChange('banco_nombre_pen', e.target.value)}
                        >
                          <option value="">-- SELECCIONAR ENTIDAD SBS --</option>
                          {SBS_BANCOS_NOMBRES.map((banco) => (
                            <option key={banco} value={banco}>
                              {banco}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">N° Cuenta (PEN)</label>
                          {formData.numero_cuenta_pen && (
                            <span className="text-[9px] font-mono font-bold text-emerald-600 dark:text-emerald-400">
                              {formData.numero_cuenta_pen.length} dígitos
                            </span>
                          )}
                        </div>
                        <input
                          type="text"
                          maxLength={16}
                          placeholder="Ej: 19379031376071 (10-16 dígitos)"
                          className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-mono font-bold text-[#0f172a] dark:text-[#f8fafc] focus:outline-none"
                          value={formData.numero_cuenta_pen || ''}
                          onChange={(e) => handleInputChange('numero_cuenta_pen', e.target.value.replace(/\D/g, ''))}
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">CCI (PEN)</label>
                          {formData.cci_pen && (
                            <span className={`text-[9px] font-mono font-bold ${
                              formData.cci_pen.length === 20 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-500'
                            }`}>
                              {formData.cci_pen.length === 20 ? '✓ 20/20 dígitos' : `⚠️ ${formData.cci_pen.length}/20 dígitos`}
                            </span>
                          )}
                        </div>
                        <input
                          type="text"
                          maxLength={20}
                          placeholder="Ej: 00219311916481309617 (20 dígitos)"
                          className={`bg-white dark:bg-slate-950 border rounded-lg p-2 text-xs font-mono font-bold focus:outline-none ${
                            formData.cci_pen && formData.cci_pen.length !== 20
                              ? 'border-amber-400 text-amber-600 dark:text-amber-400'
                              : 'border-slate-200 dark:border-slate-800 text-[#0f172a] dark:text-[#f8fafc]'
                          }`}
                          value={formData.cci_pen || ''}
                          onChange={(e) => handleInputChange('cci_pen', e.target.value.replace(/\D/g, ''))}
                        />
                      </div>
                    </div>
                  </div>

                  <hr className="border-slate-100 dark:border-slate-800/80" />

                  {/* Cuentas Dólares */}
                  <div className="flex flex-col gap-3">
                    <h4 className="text-xs font-bold text-blue-600 dark:text-blue-450 uppercase tracking-tight">Cuentas Dólares Oficiales (USD)</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Banco (USD)</label>
                        <select
                          className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                          value={formData.banco_nombre_usd || ''}
                          onChange={(e) => handleInputChange('banco_nombre_usd', e.target.value)}
                        >
                          <option value="">-- SELECCIONAR ENTIDAD SBS --</option>
                          {SBS_BANCOS_NOMBRES.map((banco) => (
                            <option key={banco} value={banco}>
                              {banco}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">N° Cuenta (USD)</label>
                          {formData.numero_cuenta_usd && (
                            <span className="text-[9px] font-mono font-bold text-blue-600 dark:text-blue-400">
                              {formData.numero_cuenta_usd.length} dígitos
                            </span>
                          )}
                        </div>
                        <input
                          type="text"
                          maxLength={16}
                          placeholder="Ej: 19395701362140 (10-16 dígitos)"
                          className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-mono font-bold text-[#0f172a] dark:text-[#f8fafc] focus:outline-none"
                          value={formData.numero_cuenta_usd || ''}
                          onChange={(e) => handleInputChange('numero_cuenta_usd', e.target.value.replace(/\D/g, ''))}
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">CCI (USD)</label>
                          {formData.cci_usd && (
                            <span className={`text-[9px] font-mono font-bold ${
                              formData.cci_usd.length === 20 ? 'text-blue-600 dark:text-blue-400' : 'text-amber-500'
                            }`}>
                              {formData.cci_usd.length === 20 ? '✓ 20/20 dígitos' : `⚠️ ${formData.cci_usd.length}/20 dígitos`}
                            </span>
                          )}
                        </div>
                        <input
                          type="text"
                          maxLength={20}
                          placeholder="Ej: 00219312146395616216 (20 dígitos)"
                          className={`bg-white dark:bg-slate-950 border rounded-lg p-2 text-xs font-mono font-bold focus:outline-none ${
                            formData.cci_usd && formData.cci_usd.length !== 20
                              ? 'border-amber-400 text-amber-600 dark:text-amber-400'
                              : 'border-slate-200 dark:border-slate-800 text-[#0f172a] dark:text-[#f8fafc]'
                          }`}
                          value={formData.cci_usd || ''}
                          onChange={(e) => handleInputChange('cci_usd', e.target.value.replace(/\D/g, ''))}
                        />
                      </div>
                    </div>
                  </div>

                </div>
              )}

              {/* --- SUB-TAB 5: COMPLIANCE --- */}
              {formActiveTab === 'compliance' && (
                <div className="flex flex-col gap-4 animate-fadeIn">
                  <h4 className="text-xs font-bold text-slate-805 dark:text-slate-200 uppercase tracking-tight text-slate-700">Debida Diligencia y Cumplimiento</h4>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex items-center gap-2 mt-3">
                      <input
                        type="checkbox"
                        id="es_pep"
                        className="rounded text-emerald-600 focus:ring-emerald-600 h-4 w-4"
                        checked={formData.es_pep || false}
                        onChange={(e) => handleInputChange('es_pep', e.target.checked)}
                      />
                      <label htmlFor="es_pep" className="text-xs font-bold text-slate-700 dark:text-slate-400">¿Es Persona Expuesta Políticamente (PEP)?</label>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Estado Compliance</label>
                      <select
                        className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-600"
                        value={formData.estado_compliance || 'borrador'}
                        onChange={(e) => handleInputChange('estado_compliance', e.target.value)}
                      >
                        <option value="borrador">BORRADOR</option>
                        <option value="solicitado">PENDIENTE / SOLICITADO</option>
                        <option value="aprobado">APROBADO</option>
                        <option value="rechazado">RECHAZADO</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Detalle PEP (Si aplica)</label>
                    <textarea
                      rows={2}
                      className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                      value={formData.pep_detalle || ''}
                      onChange={(e) => handleInputChange('pep_detalle', e.target.value)}
                    />
                  </div>

                  <hr className="border-slate-100 dark:border-slate-800/80" />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Perfil de Riesgo</label>
                      <select
                        className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-600"
                        value={formData.perfil_riesgo || 'Medio'}
                        onChange={(e) => handleInputChange('perfil_riesgo', e.target.value)}
                      >
                        <option value="Bajo">Bajo</option>
                        <option value="Medio">Medio</option>
                        <option value="Alto">Alto</option>
                      </select>
                    </div>
                    
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Fecha Solicitud Compliance</label>
                      <input
                        type="date"
                        className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                        value={formData.fecha_solicitud_compliance || ''}
                        onChange={(e) => handleInputChange('fecha_solicitud_compliance', e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Observaciones de Cumplimiento</label>
                    <textarea
                      rows={2}
                      className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                      value={formData.observaciones_compliance || ''}
                      onChange={(e) => handleInputChange('observaciones_compliance', e.target.value)}
                    />
                  </div>
                </div>
              )}

              {/* Errores del formulario */}
              {formSubmitError && (
                <div className="bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900 rounded-lg p-3 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle size={14} />
                  <span>{formSubmitError}</span>
                </div>
              )}

              {/* Éxito del formulario */}
              {formSubmitSuccess && (
                <div className="bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border border-emerald-250 dark:border-emerald-900 rounded-lg p-3 text-xs font-semibold flex items-center gap-2">
                  <CheckCircle size={14} />
                  <span>¡Datos guardados con éxito en Supabase! Cerrando formulario...</span>
                </div>
              )}

            </form>

            {/* Pie del Modal */}
            <div className="p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-150 dark:border-slate-850 flex items-center justify-end gap-2.5">
              <button 
                type="button" 
                className="h-9 text-xs font-bold px-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 cursor-pointer hover:bg-slate-50 transition-colors"
                onClick={() => setIsModalOpen(false)}
              >
                Cancelar
              </button>
              <button 
                type="submit" 
                onClick={handleFormSubmit}
                className="h-9 text-xs font-black uppercase tracking-wider px-6 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-sm"
              >
                💾 Guardar Ficha
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Modal de Confirmacion Registro Oficial: requiere escribir EJECUTAR */}
      {registerModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-900 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            <div className="bg-emerald-600 px-6 py-4 flex items-center gap-3">
              <ShieldCheck size={20} className="text-white" />
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-wider">Confirmación de Registro Oficial</h3>
                <p className="text-[10px] text-emerald-100 font-semibold">Persistencia irreversible en Ledger Oficial</p>
              </div>
            </div>
            <div className="px-6 py-5 flex flex-col gap-4">
              <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900 rounded-xl p-4 text-xs text-emerald-900 dark:text-emerald-300 leading-relaxed font-medium">
                Esta acción escribirá <strong>oficialmente los asientos contables</strong> del período <code className="bg-emerald-100 dark:bg-emerald-900 px-1 py-0.5 rounded font-black">{fEnd}</code> en Supabase, cerrará contratos extinguidos y actualizará el cronograma.
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Para confirmar, escribe <span className="text-emerald-600 font-black">EJECUTAR</span> en el campo:
                </label>
                <input
                  type="text"
                  className="w-full bg-slate-50 dark:bg-slate-950 border-2 border-slate-200 dark:border-slate-700 focus:border-emerald-500 dark:focus:border-emerald-500 rounded-xl py-2.5 px-4 text-sm font-black text-slate-800 dark:text-slate-100 placeholder-slate-300 dark:placeholder-slate-600 focus:outline-none transition-colors tracking-widest uppercase"
                  placeholder="Escribe EJECUTAR aquí..."
                  value={registerConfirmText}
                  onChange={(e) => setRegisterConfirmText(e.target.value.toUpperCase())}
                  autoFocus
                />
              </div>
            </div>
            <div className="px-6 pb-5 flex items-center justify-end gap-3">
              <button
                type="button"
                className="h-9 text-xs font-bold px-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 cursor-pointer transition-colors"
                onClick={() => { setRegisterModalOpen(false); setRegisterConfirmText(''); }}
                disabled={officialRegisterLoading}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={`h-9 text-xs font-black uppercase tracking-wider px-6 rounded-xl text-white shadow transition-all flex items-center gap-2 ${
                  registerConfirmText === 'EJECUTAR' && !officialRegisterLoading
                    ? 'bg-emerald-600 hover:bg-emerald-700 cursor-pointer'
                    : 'bg-slate-300 dark:bg-slate-700 cursor-not-allowed opacity-60'
                }`}
                onClick={handleRegisterPermanent}
                disabled={registerConfirmText !== 'EJECUTAR' || officialRegisterLoading}
              >
                {officialRegisterLoading ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                <span>Ejecutar Registro Oficial</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmacion Rollback: requiere escribir EJECUTAR */}
      {rollbackModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            <div className="bg-rose-600 px-6 py-4 flex items-center gap-3">
              <Undo2 size={20} className="text-white" />
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-wider">Confirmacion de Rollback</h3>
                <p className="text-[10px] text-rose-200 font-semibold">Operacion destructiva - no se puede deshacer</p>
              </div>
            </div>
            <div className="px-6 py-5 flex flex-col gap-4">
              <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900 rounded-xl p-4 text-xs text-rose-800 dark:text-rose-300 leading-relaxed font-medium">
                Esta accion eliminara <strong>todos los asientos</strong> del periodo <code className="bg-rose-100 dark:bg-rose-900 px-1 py-0.5 rounded font-black">{fEnd}</code> y revertira los contratos cerrados a estado <strong>emitido</strong> y los cronogramas a <strong>PENDIENTE</strong>.
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Para confirmar, escribe <span className="text-rose-600 font-black">EJECUTAR</span> en el campo:
                </label>
                <input
                  type="text"
                  className="w-full bg-slate-50 dark:bg-slate-950 border-2 border-slate-200 dark:border-slate-700 focus:border-rose-500 dark:focus:border-rose-500 rounded-xl py-2.5 px-4 text-sm font-black text-slate-800 dark:text-slate-100 placeholder-slate-300 dark:placeholder-slate-600 focus:outline-none transition-colors tracking-widest uppercase"
                  placeholder="Escribe EJECUTAR aqui..."
                  value={rollbackConfirmText}
                  onChange={(e) => setRollbackConfirmText(e.target.value.toUpperCase())}
                  autoFocus
                />
              </div>
            </div>
            <div className="px-6 pb-5 flex items-center justify-end gap-3">
              <button
                type="button"
                className="h-9 text-xs font-bold px-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 cursor-pointer transition-colors"
                onClick={() => { setRollbackModalOpen(false); setRollbackConfirmText(''); }}
                disabled={rollbackLoading}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={`h-9 text-xs font-black uppercase tracking-wider px-6 rounded-xl text-white shadow transition-all flex items-center gap-2 ${
                  rollbackConfirmText === 'EJECUTAR' && !rollbackLoading
                    ? 'bg-rose-600 hover:bg-rose-700 cursor-pointer'
                    : 'bg-slate-300 dark:bg-slate-700 cursor-not-allowed opacity-60'
                }`}
                onClick={handleRollback}
                disabled={rollbackConfirmText !== 'EJECUTAR' || rollbackLoading}
              >
                {rollbackLoading ? <Loader2 size={14} className="animate-spin" /> : <Undo2 size={14} />}
                <span>Ejecutar Rollback</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Despacho de Correos a Inversionistas: Paso Intermedio con Resumen por Fondo y Confirmación ENVIAR */}
      {emailSummaryModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white dark:bg-[#0f172a] border border-[#bae6fd] dark:border-[#1e293b] rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Header del Modal */}
            <div className="bg-[#0284c7] px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/10 rounded-xl text-white">
                  <Mail size={22} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-wider">
                    Despacho Oficial de Estados de Cuenta y Retenciones
                  </h3>
                  <p className="text-[11px] text-sky-100 font-semibold">
                    Emisión institucional automatizada desde inversionistas@inandes.com
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setEmailSummaryModalOpen(false); setEmailConfirmText(''); setEmailDispatchSuccessMsg(null); }}
                className="text-white/80 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Cuerpo del Modal con Resumen de Fondos */}
            <div className="p-6 overflow-y-auto flex flex-col gap-4">
              
              {/* Tarjetas Superiores de Contexto */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 bg-[#f8fafc] dark:bg-[#1e293b] border border-[#e2e8f0] dark:border-[#334155] rounded-xl flex flex-col gap-0.5">
                  <span className="text-[9.5px] font-black text-[#64748b] dark:text-[#94a3b8] uppercase">Período de Corte</span>
                  <span className="text-xs font-mono font-bold text-[#0f172a] dark:text-[#f8fafc]">{fStart} al {fEnd}</span>
                </div>
                <div className="p-3 bg-[#f8fafc] dark:bg-[#1e293b] border border-[#e2e8f0] dark:border-[#334155] rounded-xl flex flex-col gap-0.5">
                  <span className="text-[9.5px] font-black text-[#64748b] dark:text-[#94a3b8] uppercase">Remitente Oficial</span>
                  <span className="text-xs font-bold text-[#0284c7] dark:text-[#38bdf8] truncate" title="inversionistas@inandes.com">inversionistas@inandes.com</span>
                </div>
                <div className="p-3 bg-[#f8fafc] dark:bg-[#1e293b] border border-[#e2e8f0] dark:border-[#334155] rounded-xl flex flex-col gap-0.5">
                  <span className="text-[9.5px] font-black text-[#64748b] dark:text-[#94a3b8] uppercase">Copia de Auditoría (CC)</span>
                  <span className="text-xs font-mono font-bold text-[#0f172a] dark:text-[#f8fafc] truncate" title="rgutil@gmail.com">rgutil@gmail.com</span>
                </div>
              </div>

              {/* Tabla Resumen de Envíos por Fondo */}
              <div className="flex flex-col gap-2">
                <span className="text-xs font-black text-[#0f172a] dark:text-[#f8fafc] uppercase tracking-wider flex items-center justify-between">
                  <span>📊 Resumen Previo de Destinatarios por Fondo</span>
                  <span className="text-[11px] font-mono text-[#0284c7] font-bold">{totalEmailsToDispatch} Partícipes en Total</span>
                </span>

                <div className="border border-[#e2e8f0] dark:border-[#334155] rounded-xl overflow-hidden">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-[#f1f5f9] dark:bg-[#1e293b] text-[#475569] dark:text-[#cbd5e1] font-bold text-[10.5px] uppercase border-b border-[#e2e8f0] dark:border-[#334155]">
                      <tr>
                        <th className="py-2.5 px-3">Fondo</th>
                        <th className="py-2.5 px-2 text-center">Moneda</th>
                        <th className="py-2.5 px-3 text-center">Destinatarios (Titular 1)</th>
                        <th className="py-2.5 px-3">Documentos Adjuntos</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#e2e8f0] dark:divide-[#334155]">
                      {fundSummaryForEmail.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-4 text-center text-slate-400 font-semibold italic">
                            No se encontraron asientos contables cerrados para el período seleccionado.
                          </td>
                        </tr>
                      ) : (
                        fundSummaryForEmail.map((item) => (
                          <tr key={item.fondo} className="hover:bg-[#f8fafc] dark:hover:bg-[#1e293b]/50 transition-colors">
                            <td className="py-2.5 px-3 font-bold text-[#0f172a] dark:text-[#f8fafc]">
                              {item.nombre} <span className="font-mono text-[10px] text-[#64748b] dark:text-[#94a3b8]">({item.fondo})</span>
                            </td>
                            <td className="py-2.5 px-2 text-center font-mono font-bold text-[#0284c7] dark:text-[#38bdf8]">
                              {item.moneda}
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono font-bold text-[#059669]">
                              {item.count} {item.count === 1 ? 'partícipe' : 'partícipes'}
                            </td>
                            <td className="py-2.5 px-3 text-[#64748b] dark:text-[#94a3b8] text-[11px]">
                              <span>📄 EECC</span>
                              {item.countRetencion > 0 && <span className="ml-1 text-[#0284c7] font-semibold">+ 📜 Retención ({item.countRetencion})</span>}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    <tfoot className="bg-[#f8fafc] dark:bg-[#1e293b] font-black border-t-2 border-[#e2e8f0] dark:border-[#334155]">
                      <tr>
                        <td colSpan={2} className="py-2.5 px-3 uppercase text-[#0f172a] dark:text-[#f8fafc]">Total General a Despachar:</td>
                        <td className="py-2.5 px-3 text-center font-mono text-[#059669] text-sm">
                          {totalEmailsToDispatch} Correos
                        </td>
                        <td className="py-2.5 px-3 text-[10.5px] text-[#64748b]">100% Personalizado por Inversionista</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Mensaje de Confirmación / Estado Protegido */}
              {emailDispatchSuccessMsg ? (
                <div className="bg-[#ecfdf5] dark:bg-[#059669]/15 border border-[#a7f3d0] dark:border-[#059669]/30 rounded-xl p-3.5 flex items-start gap-2.5 text-xs text-[#059669] dark:text-[#34d399] font-medium leading-relaxed">
                  <CheckCircle size={18} className="shrink-0 mt-0.5 text-[#059669]" />
                  <span>{emailDispatchSuccessMsg}</span>
                </div>
              ) : (
                /* Campo de Confirmación de Seguridad ENVIAR */
                <div className="flex flex-col gap-2 pt-2 border-t border-[#e2e8f0] dark:border-[#334155]">
                  <label className="text-[10.5px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                    Para confirmar la orden de despacho, escribe <span className="text-[#0284c7] font-black">ENVIAR</span> en el campo:
                  </label>
                  <input
                    type="text"
                    className="w-full bg-[#f8fafc] dark:bg-[#0b0f19] border-2 border-[#e2e8f0] dark:border-[#334155] focus:border-[#0284c7] dark:focus:border-[#0284c7] rounded-xl py-2 px-3 text-sm font-black text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none transition-colors tracking-widest uppercase"
                    placeholder="Escribe ENVIAR aquí..."
                    value={emailConfirmText}
                    onChange={(e) => setEmailConfirmText(e.target.value.toUpperCase())}
                    autoFocus
                  />
                  <p className="text-[10px] text-[#64748b] dark:text-[#94a3b8] italic">
                    ℹ️ Modo de seguridad: Los correos se emitirán con la plantilla institucional HTML de InAndes y ambos PDFs adjuntos.
                  </p>
                </div>
              )}

            </div>

            {/* Footer del Modal */}
            <div className="px-6 py-4 bg-[#f8fafc] dark:bg-[#1e293b] border-t border-[#e2e8f0] dark:border-[#334155] flex items-center justify-end gap-3">
              <button
                type="button"
                className="h-9 text-xs font-bold px-5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 cursor-pointer transition-colors"
                onClick={() => { setEmailSummaryModalOpen(false); setEmailConfirmText(''); setEmailDispatchSuccessMsg(null); }}
              >
                Cerrar
              </button>
              
              <button
                type="button"
                className={`h-9 text-xs font-black uppercase tracking-wider px-6 rounded-xl text-white shadow transition-all flex items-center gap-2 ${
                  emailConfirmText === 'ENVIAR' && !emailDispatchSuccessMsg
                    ? 'bg-[#0284c7] hover:bg-[#0369a1] cursor-pointer'
                    : 'bg-slate-300 dark:bg-slate-700 cursor-not-allowed opacity-60'
                }`}
                onClick={() => {
                  setEmailDispatchSuccessMsg(`¡Resumen de despacho validado para ${totalEmailsToDispatch} partícipes! (Modo de protección activo: No se enviaron correos masivos a terceros sin orden directa).`);
                }}
                disabled={emailConfirmText !== 'ENVIAR' || !!emailDispatchSuccessMsg}
              >
                <Send size={14} />
                <span>{emailDispatchSuccessMsg ? '✓ Resumen Validado' : `Enviar Correos (${totalEmailsToDispatch})`}</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL DE TRANSFERENCIAS MASIVAS BCP (TELECRÉDITO)                         */}
      {/* ========================================================================= */}
      {bcpModalOpen && bcpBatchData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#0b0f19] border border-[#e2e8f0] dark:border-[#334155] rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            
            {/* Header del Modal */}
            <div className="px-6 py-4 bg-linear-to-r from-[#1e1b4b] to-[#312e81] text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-white/10 text-indigo-300">
                  <Landmark size={22} />
                </div>
                <div>
                  <h3 className="text-base font-black tracking-wide flex items-center gap-2">
                    Lote Telecrédito BCP — Abonos Masivos
                    <span className="text-[11px] font-mono font-bold bg-indigo-500/30 text-indigo-200 px-2 py-0.5 rounded-full border border-indigo-400/30">
                      {bcpBatchData.items[0]?.moneda}
                    </span>
                  </h3>
                  <p className="text-xs text-indigo-200/80 font-medium">
                    Archivo plano oficial .TXT para la columna TRANSFERENCIAS (Rendimientos y Rescates)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setBcpModalOpen(false)}
                className="text-white/80 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Cuerpo del Modal */}
            <div className="p-6 overflow-y-auto flex flex-col gap-4">
              
              {/* Tarjetas Superiores de Métricas */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-[#f8fafc] dark:bg-[#1e293b] border border-[#e2e8f0] dark:border-[#334155] rounded-xl flex flex-col gap-0.5">
                  <span className="text-[9.5px] font-black text-[#64748b] dark:text-[#94a3b8] uppercase">Total Transferencias</span>
                  <span className="text-sm font-mono font-black text-[#0f172a] dark:text-[#f8fafc]">
                    {bcpBatchData.totalRegistros} certificados
                  </span>
                </div>

                <div className="p-3 bg-[#f8fafc] dark:bg-[#1e293b] border border-[#e2e8f0] dark:border-[#334155] rounded-xl flex flex-col gap-0.5">
                  <span className="text-[9.5px] font-black text-[#64748b] dark:text-[#94a3b8] uppercase">Monto Total del Lote</span>
                  <span className="text-sm font-mono font-black text-[#059669]">
                    {bcpBatchData.items[0]?.moneda === 'USD' ? '$' : 'S/'} {bcpBatchData.montoTotal.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="p-3 bg-[#f8fafc] dark:bg-[#1e293b] border border-[#e2e8f0] dark:border-[#334155] rounded-xl flex flex-col gap-0.5">
                  <span className="text-[9.5px] font-black text-[#64748b] dark:text-[#94a3b8] uppercase">Destinos de Abono</span>
                  <span className="text-xs font-mono font-bold text-[#0284c7] dark:text-[#38bdf8]">
                    {bcpBatchData.totalBcp} BCP · {bcpBatchData.totalCci} CCI
                  </span>
                </div>

                <div className={`p-3 border rounded-xl flex flex-col gap-0.5 ${
                  bcpBatchData.totalSinCuenta > 0 
                    ? 'bg-[#fffbeb] dark:bg-[#78350f]/20 border-[#fde68a] text-[#b45309]' 
                    : 'bg-[#f8fafc] dark:bg-[#1e293b] border-[#e2e8f0] dark:border-[#334155]'
                }`}>
                  <span className="text-[9.5px] font-black uppercase">Sin Cuenta Bancaria</span>
                  <span className={`text-xs font-mono font-bold ${bcpBatchData.totalSinCuenta > 0 ? 'text-[#b45309]' : 'text-[#64748b]'}`}>
                    {bcpBatchData.totalSinCuenta > 0 ? `⚠️ ${bcpBatchData.totalSinCuenta} partícipes` : '✓ 0 faltantes'}
                  </span>
                </div>
              </div>

              {/* Parámetros de Cabecera BCP */}
              <div className="p-4 bg-[#f8fafc] dark:bg-[#1e293b]/60 border border-[#e2e8f0] dark:border-[#334155] rounded-xl flex flex-col gap-3">
                <div className="flex items-center justify-between border-b border-[#e2e8f0] dark:border-[#334155] pb-1.5">
                  <span className="text-[10.5px] font-black uppercase tracking-wider text-[#0f172a] dark:text-[#f8fafc]">
                    Configuración de Cabecera (Registro 'C' — BCP)
                  </span>
                  <span className="text-[10px] font-mono text-[#64748b]">Longitud exacta: 96/97 chars</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[9.5px] font-black text-[#64748b] dark:text-[#94a3b8] uppercase">
                      Cuenta Cargo InAndes
                    </label>
                    <input
                      type="text"
                      className="bg-white dark:bg-[#0b0f19] border border-[#e2e8f0] dark:border-[#334155] rounded-lg py-1.5 px-2.5 text-xs font-mono font-bold text-[#0f172a] dark:text-[#f8fafc] focus:outline-none"
                      value={bcpCuentaOrigen}
                      onChange={(e) => setBcpCuentaOrigen(e.target.value)}
                      placeholder="Ej: 19300000000000"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[9.5px] font-black text-[#64748b] dark:text-[#94a3b8] uppercase">
                      Tipo Cuenta Origen
                    </label>
                    <select
                      className="bg-white dark:bg-[#0b0f19] border border-[#e2e8f0] dark:border-[#334155] rounded-lg py-1.5 px-2.5 text-xs font-bold text-[#0f172a] dark:text-[#f8fafc] focus:outline-none"
                      value={bcpTipoCuentaOrigen}
                      onChange={(e) => setBcpTipoCuentaOrigen(e.target.value as any)}
                    >
                      <option value="CCT">CCT (Corriente)</option>
                      <option value="SCA">SCA (Ahorros)</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[9.5px] font-black text-[#64748b] dark:text-[#94a3b8] uppercase">
                      Referencia del Lote
                    </label>
                    <input
                      type="text"
                      className="bg-white dark:bg-[#0b0f19] border border-[#e2e8f0] dark:border-[#334155] rounded-lg py-1.5 px-2.5 text-xs font-mono font-bold text-[#0f172a] dark:text-[#f8fafc] focus:outline-none uppercase"
                      value={bcpReferenciaLote}
                      onChange={(e) => setBcpReferenciaLote(e.target.value.toUpperCase())}
                      placeholder="Ej: LOTE-NSGPEN01-20260228"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[9.5px] font-black text-[#64748b] dark:text-[#94a3b8] uppercase">
                      Validación IDC / Titularidad
                    </label>
                    <select
                      className="bg-white dark:bg-[#0b0f19] border border-[#e2e8f0] dark:border-[#334155] rounded-lg py-1.5 px-2.5 text-xs font-bold text-[#0f172a] dark:text-[#f8fafc] focus:outline-none"
                      value={bcpValidacionIdc}
                      onChange={(e) => setBcpValidacionIdc(e.target.value as any)}
                    >
                      <option value="S">S = Validar Nombre/Doc contra BCP</option>
                      <option value="N">N = Sin Validación Estricta</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Tabla de Detalle de Abonos */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10.5px] font-black uppercase tracking-wider text-[#0f172a] dark:text-[#f8fafc]">
                    Detalle de Transferencias por Certificado ({bcpBatchData.items.length})
                  </span>
                  <span className="text-[10px] text-[#64748b] font-mono">1 línea por certificado (120 chars)</span>
                </div>

                <div className="border border-[#e2e8f0] dark:border-[#334155] rounded-xl overflow-hidden shadow-xs max-h-72 overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse font-sans">
                    <thead className="bg-[#0f172a] text-white font-mono text-[10px] sticky top-0 z-10 uppercase">
                      <tr>
                        <th className="py-2 px-2.5 text-center w-10">#</th>
                        <th className="py-2 px-3">Certificado</th>
                        <th className="py-2 px-3">Inversionista / Razón Social</th>
                        <th className="py-2 px-2 text-center">Doc</th>
                        <th className="py-2 px-3">Banco / Cuenta / CCI</th>
                        <th className="py-2 px-3">Concepto / Observaciones</th>
                        <th className="py-2 px-3 text-right">Monto</th>
                        <th className="py-2 px-2.5 text-center">Canal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#e2e8f0] dark:divide-[#334155] text-[11px] font-mono">
                      {bcpBatchData.items.map((it, idx) => (
                        <tr key={it.idContrato} className="hover:bg-[#f8fafc] dark:hover:bg-[#1e293b]/50 transition-colors">
                          <td className="py-1.5 px-2.5 text-center text-[#64748b]">{idx + 1}</td>
                          <td className="py-1.5 px-3 font-bold text-[#0f172a] dark:text-[#f8fafc]">{it.idContrato}</td>
                          <td className="py-1.5 px-3 font-sans font-medium text-[#334155] dark:text-[#cbd5e1] truncate max-w-44" title={it.inversionistaNombre}>
                            {it.inversionistaNombre}
                          </td>
                          <td className="py-1.5 px-2 text-center text-[#64748b]">
                            {it.tipoDoc}: {it.numDoc || '-'}
                          </td>
                          <td className="py-1.5 px-3 text-[#334155] dark:text-[#cbd5e1]">
                            {it.estadoCuenta === 'BCP' ? (
                              <span className="text-[#059669] font-bold">BCP: {it.numeroCuenta}</span>
                            ) : it.estadoCuenta === 'INTERBANCARIO' ? (
                              <span className="text-[#0284c7] font-bold">CCI: {it.cci}</span>
                            ) : (
                              <span className="text-[#e11d48] font-bold italic">⚠️ Sin Cuenta Registrada</span>
                            )}
                          </td>
                          <td className="py-1.5 px-3 max-w-56 truncate">
                            {it.tipoLiquidacion === 'ROLLOVER_TOTAL' ? (
                              <span className="inline-flex items-center gap-1 text-[9.5px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 px-1.5 py-0.5 rounded border border-indigo-200 dark:border-indigo-800" title={it.comentarioRollover}>
                                🔄 Rollover Total (Solo Rend.)
                              </span>
                            ) : it.tipoLiquidacion === 'ROLLOVER_PARCIAL' ? (
                              <span className="inline-flex items-center gap-1 text-[9.5px] font-bold text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-950/60 px-1.5 py-0.5 rounded border border-violet-200 dark:border-violet-800" title={it.comentarioRollover}>
                                ✂️ Rollover Parcial (Dif. Cap)
                              </span>
                            ) : it.tipoLiquidacion === 'EXTINCION_TOTAL' ? (
                              <span className="inline-flex items-center gap-1 text-[9.5px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-800" title={it.comentarioRollover}>
                                🚪 Extinción (Cap. + Rend.)
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-500 font-sans" title={it.comentarioRollover}>
                                {it.comentarioRollover || 'Rendimiento Regular'}
                              </span>
                            )}
                          </td>
                          <td className="py-1.5 px-3 text-right font-black text-[#059669]">
                            {it.montoTransferencia.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="py-1.5 px-2.5 text-center">
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                              it.estadoCuenta === 'BCP'
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200'
                                : it.estadoCuenta === 'INTERBANCARIO'
                                ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200'
                                : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200'
                            }`}>
                              {it.estadoCuenta === 'BCP' ? 'BCP' : it.estadoCuenta === 'INTERBANCARIO' ? 'CCI' : 'ALERTA'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>

            {/* Footer del Modal */}
            <div className="px-6 py-4 bg-[#f8fafc] dark:bg-[#1e293b] border-t border-[#e2e8f0] dark:border-[#334155] flex items-center justify-between">
              <div className="text-[11px] text-[#64748b] dark:text-[#94a3b8] font-mono">
                Total a Transferir: <strong className="text-[#059669] text-xs">
                  {bcpBatchData.items[0]?.moneda === 'USD' ? '$' : 'S/'} {bcpBatchData.montoTotal.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </strong>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="h-9 text-xs font-bold px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 cursor-pointer transition-colors"
                  onClick={() => setBcpModalOpen(false)}
                >
                  Cerrar
                </button>

                <button
                  type="button"
                  className="h-9 text-xs font-black uppercase tracking-wider px-5 rounded-xl bg-[#059669] hover:bg-[#047857] text-white shadow-md transition-all flex items-center gap-2 cursor-pointer"
                  onClick={async () => {
                    await handleDownloadBcpExcel();
                  }}
                >
                  <FileSpreadsheet size={15} />
                  <span>Descargar Excel Auditoría BCP</span>
                </button>

                <button
                  type="button"
                  className="h-9 text-xs font-black uppercase tracking-wider px-5 rounded-xl bg-[#4f46e5] hover:bg-[#4338ca] text-white shadow-md transition-all flex items-center gap-2 cursor-pointer"
                  onClick={() => {
                    handleDownloadBcpTxt();
                    setBcpModalOpen(false);
                  }}
                >
                  <Download size={15} />
                  <span>Descargar Archivo TXT Telecrédito</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};
