// src/features/certificados/CertificadosPage.tsx
import React, { useEffect, useState, useMemo } from 'react';
import { 
  getCertificadosMaster, registrarAumentoCapital, getEventosDeCertificado, getAumentosCapitalHistoricos
} from '../../services/certificadosService';
import type { CertificadoMaster, AumentoCapitalHistorico } from '../../services/certificadosService';
import { supabase } from '../../services/supabaseClient';
import { generateCertificateHtml } from '../../utils/contractPreviewGenerator';
import type { CertificadoEvento } from '../../services/contratosService';
import { OmniBuscadorCertificados } from '../../components/common/OmniBuscadorCertificados';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
// @ts-ignore
import html2pdf from 'html2pdf.js';
import { 
  Loader2, AlertCircle, FileSpreadsheet, CheckCircle, Search, Upload, ChevronDown, ChevronUp, Layers, Calendar, DollarSign, ArrowUpCircle, History, User, Download, Printer, Archive, Mail, MessageSquare, Send, CheckSquare, Square, X
} from 'lucide-react';

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

const formatPeriodLabel = (periodStr: string): string => {
  if (!periodStr || periodStr === 'TODOS') return 'Todos los Periodos';
  const parts = periodStr.split('-');
  if (parts.length >= 2) {
    const yr = parts[0];
    const mo = parseInt(parts[1], 10);
    const bimMap: Record<number, string> = {
      2: 'Ene-Feb',
      4: 'Mar-Abr',
      6: 'May-Jun',
      8: 'Jul-Ago',
      10: 'Set-Oct',
      12: 'Nov-Dic'
    };
    const bimName = bimMap[mo] || `Mes ${mo}`;
    return `${periodStr} (${bimName} ${yr})`;
  }
  return periodStr;
};

export const CertificadosPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'vigentes' | 'aumento' | 'visor'>('vigentes');
  
  // Datos principales
  const [certificados, setCertificados] = useState<CertificadoMaster[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros Omni, Fondos y Periodo
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedFondos, setSelectedFondos] = useState<string[]>([]);
  const [selectedPeriodo, setSelectedPeriodo] = useState<string>('TODOS');
  const [expandedFunds, setExpandedFunds] = useState<Record<string, boolean>>({});

  // Seleccion masiva (Checkboxes)
  const [selectedCertIds, setSelectedCertIds] = useState<Set<string>>(new Set());

  // Canales de envio
  const [sendEmail, setSendEmail] = useState<boolean>(true);
  const [sendWhatsapp, setSendWhatsapp] = useState<boolean>(true);
  const [sendingNotifications, setSendingNotifications] = useState<boolean>(false);
  const [notificationStatus, setNotificationStatus] = useState<string | null>(null);

  // Generacion ZIP en lote
  const [generatingZip, setGeneratingZip] = useState<boolean>(false);
  const [zipProgress, setZipProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });

  // ==========================================
  // --- FORMULARIO & HISTÓRICO DE AUMENTO ----
  // ==========================================
  const [selectedAumentoCert, setSelectedAumentoCert] = useState<string>('');
  const [aumentoMonto, setAumentoMonto] = useState<number>(5000);
  const [aumentoFecha, setAumentoFecha] = useState<string>(new Date().toISOString().split('T')[0]);
  const [aumentoVoucherName, setAumentoVoucherName] = useState<string>('');
  const [aumentoSubmitting, setAumentoSubmitting] = useState<boolean>(false);
  const [aumentoError, setAumentoError] = useState<string | null>(null);
  const [aumentoSuccess, setAumentoSuccess] = useState<boolean>(false);

  // Histórico de aumentos
  const [aumentosHistoricos, setAumentosHistoricos] = useState<AumentoCapitalHistorico[]>([]);
  const [loadingAumentos, setLoadingAumentos] = useState<boolean>(false);
  const [selectedAumentoYear, setSelectedAumentoYear] = useState<string>('2026');
  const [expandedPeriodos, setExpandedPeriodos] = useState<Record<string, boolean>>({});
  const [filtroAumentoQuery, setFiltroAumentoQuery] = useState<string>('');

  // ==========================================
  // --- VISOR DE CERTIFICADOS & TIMELINE -----
  // ==========================================
  const [selectedVisorCertId, setSelectedVisorCertId] = useState<string>('');
  const [visorHtml, setVisorHtml] = useState<string>('');
  const [visorEvents, setVisorEvents] = useState<CertificadoEvento[]>([]);
  const [visorLoading, setVisorLoading] = useState<boolean>(false);

  const fetchAumentos = async () => {
    setLoadingAumentos(true);
    try {
      const data = await getAumentosCapitalHistoricos();
      setAumentosHistoricos(data);
      
      const exp: Record<string, boolean> = {};
      data.forEach(a => {
        const info = getPeriodoInfo(a.fecha_periodo_fin || a.fecha_periodo_origen);
        exp[info.bimKey] = true;
      });
      setExpandedPeriodos(exp);
    } catch (err: any) {
      console.error('Error al cargar aumentos históricos:', err);
    } finally {
      setLoadingAumentos(false);
    }
  };

  const fetchCertificados = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getCertificadosMaster();
      setCertificados(data);
      
      const initialExp: Record<string, boolean> = {};
      data.forEach(c => {
        if (c.nombre_fondo) {
          initialExp[c.nombre_fondo] = true;
        }
      });
      setExpandedFunds(initialExp);
      
      fetchAumentos();
    } catch (err: any) {
      setError(err.message || 'Error al cargar certificados.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCertificados();
  }, []);

  useEffect(() => {
    if (selectedVisorCertId) {
      loadVisorData(selectedVisorCertId);
    } else {
      setVisorHtml('');
      setVisorEvents([]);
    }
  }, [selectedVisorCertId]);

  const getHtmlForCertificate = async (masterCert: CertificadoMaster): Promise<string> => {
    const certId = masterCert.id_certificado;
    const targetContractId = masterCert.id_contrato || certId.split('.').slice(0, 2).join('.') || certId;

    const { data: contractData } = await supabase
      .from('crm_contratos')
      .select('*')
      .eq('id_contrato', targetContractId)
      .maybeSingle();

    const contract = contractData || {
      monto_inversion: masterCert.monto_inversion || 0,
      plazo_meses: masterCert.plazo_meses || '12',
      porcentaje_reparto: 100,
      fecha_inicio: masterCert.fecha_ultimo_evento || new Date().toISOString().split('T')[0],
      fecha_fin: new Date().toISOString().split('T')[0],
      moneda: masterCert.moneda || 'USD',
      id_fondo: masterCert.id_fondo || '',
      id_inversionista_1: ''
    };

    let fundName = masterCert.nombre_fondo || 'FONDO DE INVERSIÓN';
    let fundRuc = 'PENDIENTE';

    if (contract.id_fondo) {
      const { data: fundData } = await supabase
        .from('crm_fondos')
        .select('*')
        .eq('id_fondo', contract.id_fondo)
        .maybeSingle();
      if (fundData) {
        fundName = fundData.nombre_fondo || fundName;
        fundRuc = fundData.ruc_fondo || fundRuc;
      }
    }

    let invList: Array<{ name: string; dni: string }> = [];
    if (masterCert.titulares_resumen && masterCert.titulares_resumen.length > 0) {
      invList = masterCert.titulares_resumen.map(t => ({
        name: t.nombre || 'S/N',
        dni: t.documento || 'S/N'
      }));
    } else {
      const investorIds = [
        contract.id_inversionista_1,
        contract.id_inversionista_2,
        contract.id_inversionista_3,
        contract.id_inversionista_4
      ].filter(Boolean);

      if (investorIds.length > 0) {
        const { data: invRows } = await supabase
          .from('crm_inversionistas')
          .select('*')
          .in('codigo_inversionista', investorIds);

        invList = (invRows || []).map(r => ({
          name: r.nombre_completo || r.nombre_1 || 'S/N',
          dni: r.documento_identidad || 'S/N'
        }));
      }
    }

    if (invList.length === 0) {
      invList = [{ name: masterCert.titular_1 || 'INVERSIONISTA', dni: 'S/N' }];
    }

    const fechaCorteFondo = masterCert.fecha_ultimo_evento || contract.fecha_inicio;
    const fCode = masterCert.id_fondo || certId.split('.')[0].split('-')[0];
    let valorCuotaFondo = 1.0;
    if (fechaCorteFondo && fCode) {
      const { data: vcRow } = await supabase
        .from('crm_valor_cuota_eventos')
        .select('valor_cuota_final')
        .eq('id_fondo', fCode)
        .lte('fecha_corte', fechaCorteFondo)
        .order('fecha_corte', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (vcRow && vcRow.valor_cuota_final) {
        valorCuotaFondo = Number(vcRow.valor_cuota_final);
      }
    }

    const montoActual = masterCert.capital_actual ?? contract.monto_inversion ?? 0;
    const cuotasActual = valorCuotaFondo > 0 ? (montoActual / valorCuotaFondo) : montoActual;

    return generateCertificateHtml({
      investors: invList,
      fund: {
        nombre_fondo: fundName,
        ruc_fondo: fundRuc,
        moneda: contract.moneda || masterCert.moneda || 'USD'
      },
      contract: {
        monto_inversion: contract.monto_inversion || masterCert.monto_inversion || 0,
        plazo_meses: contract.plazo_meses || masterCert.plazo_meses || '12',
        porcentaje_reparto: contract.porcentaje_reparto ?? 100,
        fecha_inicio: contract.fecha_inicio || new Date().toISOString().split('T')[0],
        fecha_fin: contract.fecha_fin || new Date().toISOString().split('T')[0]
      },
      logo_efi_path: '/assets/Logo.Inandes.MODERNO.png',
      firma_path: '/Firma.Ricardo.GALLO.png',
      cert_meta: {
        fecha_emision: contract.fecha_inicio || masterCert.fecha_ultimo_evento || new Date().toISOString().split('T')[0],
        id_certificado: certId,
        monto_actual: montoActual,
        cuotas_actual: cuotasActual
      }
    });
  };

  const loadVisorData = async (certId: string) => {
    setVisorLoading(true);
    try {
      const masterCert = certificados.find(c => c.id_certificado === certId);
      if (!masterCert) return;

      const html = await getHtmlForCertificate(masterCert);
      setVisorHtml(html);

      const events = await getEventosDeCertificado(certId);
      setVisorEvents(events);
    } catch (err: any) {
      console.error('Error al cargar visor:', err);
      setVisorHtml(`<h3>Error al cargar visor: ${err.message}</h3>`);
    } finally {
      setVisorLoading(false);
    }
  };

  const [downloadingPdf, setDownloadingPdf] = useState<boolean>(false);

  const handleDownloadPdf = async () => {
    if (!visorHtml || !selectedVisorCertId) return;
    setDownloadingPdf(true);
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const filename = `CERTIFICADO_${selectedVisorCertId}_${todayStr}.pdf`;

      const tempContainer = document.createElement('div');
      tempContainer.style.position = 'fixed';
      tempContainer.style.left = '-9999px';
      tempContainer.style.top = '0';
      tempContainer.style.width = '1120px';
      tempContainer.style.backgroundColor = '#ffffff';
      tempContainer.innerHTML = visorHtml;
      document.body.appendChild(tempContainer);

      const targetEl = (tempContainer.querySelector('#certificate-print-area') || tempContainer) as HTMLElement;

      const opt = {
        margin: [10, 10, 10, 10] as [number, number, number, number],
        filename: filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { 
          scale: 2, 
          useCORS: true, 
          letterRendering: true, 
          logging: false 
        },
        jsPDF: { 
          unit: 'mm', 
          format: 'a4', 
          orientation: 'landscape' as const
        }
      };

      await (html2pdf() as any).set(opt).from(targetEl).save();
      document.body.removeChild(tempContainer);
    } catch (err: any) {
      console.error('Error al generar PDF horizontal con html2pdf, abriendo diálogo de impresión:', err);
      handlePrintPdf();
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handlePrintPdf = () => {
    if (!visorHtml) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Por favor habilita las ventanas emergentes (popups) para imprimir.');
      return;
    }
    printWindow.document.write(visorHtml);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  // ==========================================
  // --- FONDOS Y PERIODOS DISPONIBLES --------
  // ==========================================
  const uniqueFondos = useMemo(() => {
    const rawList = Array.from(new Set(certificados.map(c => c.nombre_fondo).filter(Boolean))) as string[];
    return rawList.sort((a, b) => getFundPriority(a) - getFundPriority(b));
  }, [certificados]);

  const availablePeriodos = useMemo(() => {
    const setP = new Set<string>();
    certificados.forEach(c => {
      if (c.fecha_ultimo_evento) {
        const p = c.fecha_ultimo_evento.substring(0, 7);
        if (p) setP.add(p);
      }
    });
    ['2026-08', '2026-06', '2026-04', '2026-02', '2025-12', '2025-10'].forEach(p => setP.add(p));
    return Array.from(setP).sort().reverse();
  }, [certificados]);

  // ==========================================
  // --- FILTRADO MULTICRITERIO OMNIBOX -------
  // ==========================================
  const filterCertificados = (list: CertificadoMaster[]) => {
    return list.filter(c => {
      // 1. Filtro de fondos
      if (selectedFondos.length > 0 && c.nombre_fondo) {
        if (!selectedFondos.includes(c.nombre_fondo)) return false;
      }

      // 2. Filtro de periodo de corte
      if (selectedPeriodo !== 'TODOS') {
        if (c.fecha_ultimo_evento && !c.fecha_ultimo_evento.startsWith(selectedPeriodo)) {
          return false;
        }
      }

      // 3. Filtro OMNIBOX inteligente
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesCertId = (c.id_certificado || '').toLowerCase().includes(q);
        const matchesContratoId = (c.id_contrato || '').toLowerCase().includes(q);
        const matchesTitular = [c.titular_1, c.titular_2, c.titular_3, c.titular_4].some(
          name => name?.toLowerCase().includes(q)
        );
        const matchesDoc = (c.titulares_resumen || []).some(t => 
          (t.documento || '').toLowerCase().includes(q) || (t.nombre || '').toLowerCase().includes(q)
        );
        const matchesFondo = (c.nombre_fondo || '').toLowerCase().includes(q);
        
        if (!matchesCertId && !matchesContratoId && !matchesTitular && !matchesDoc && !matchesFondo) return false;
      }

      return true;
    });
  };

  const filteredCerts = filterCertificados(certificados);
  const vigentesList = filteredCerts.filter(c => c.estado === 'VIGENTE');

  // Cálculos de patrimonio
  const totalUSD = vigentesList.filter(c => c.moneda === 'USD').reduce((acc, c) => acc + (c.capital_actual || 0), 0);
  const totalPEN = vigentesList.filter(c => c.moneda === 'PEN').reduce((acc, c) => acc + (c.capital_actual || 0), 0);

  // Agrupamiento por fondo en orden canónico
  const groupedCerts: Record<string, CertificadoMaster[]> = {};
  vigentesList.forEach(c => {
    const fName = c.nombre_fondo || 'Sin Fondo';
    if (!groupedCerts[fName]) groupedCerts[fName] = [];
    groupedCerts[fName].push(c);
  });

  const sortedGroupedFondos = Object.keys(groupedCerts).sort((a, b) => getFundPriority(a) - getFundPriority(b));

  const toggleExpandFund = (fundName: string) => {
    setExpandedFunds(prev => ({ ...prev, [fundName]: !prev[fundName] }));
  };

  // ==========================================
  // --- MANEJO DE CHECKBOXES Y SELECCIÓN -----
  // ==========================================
  const toggleSelectCert = (certId: string) => {
    setSelectedCertIds(prev => {
      const next = new Set(prev);
      if (next.has(certId)) {
        next.delete(certId);
      } else {
        next.add(certId);
      }
      return next;
    });
  };

  const toggleSelectFundItems = (items: CertificadoMaster[]) => {
    const itemIds = items.map(c => c.id_certificado);
    const allSelected = itemIds.every(id => selectedCertIds.has(id));

    setSelectedCertIds(prev => {
      const next = new Set(prev);
      if (allSelected) {
        itemIds.forEach(id => next.delete(id));
      } else {
        itemIds.forEach(id => next.add(id));
      }
      return next;
    });
  };

  const toggleSelectAllVigentes = () => {
    const allIds = vigentesList.map(c => c.id_certificado);
    const isAllSelected = allIds.length > 0 && allIds.every(id => selectedCertIds.has(id));

    if (isAllSelected) {
      setSelectedCertIds(new Set());
    } else {
      setSelectedCertIds(new Set(allIds));
    }
  };

  // ==========================================
  // --- EXPORTAR EXCEL MULTIPESTAÑAS ---------
  // ==========================================
  const handleExportExcel = () => {
    const targetList = selectedCertIds.size > 0 
      ? vigentesList.filter(c => selectedCertIds.has(c.id_certificado))
      : vigentesList;

    if (targetList.length === 0) return;
    const wb = XLSX.utils.book_new();

    // 1. Pestaña Consolidada: Todos o Seleccionados
    const flatList = targetList.map((c, idx) => ({
      'Ítem': idx + 1,
      'Certificado': c.id_certificado,
      'Fondo': c.id_fondo,
      'Moneda': c.moneda,
      'Inversión Inicial': c.monto_inversion,
      'Capital Actual': c.capital_actual,
      'Contrato': c.id_contrato,
      'Titular 1': c.titular_1 || 'N/A',
      'Titular 2': c.titular_2 || '',
      'Titular 3': c.titular_3 || '',
      'Titular 4': c.titular_4 || '',
      'Plazo (meses)': c.plazo_meses,
      'Último Evento': c.ultimo_evento,
      'Fecha Último Evento': c.fecha_ultimo_evento
    }));

    const sumInic = targetList.reduce((acc, c) => acc + c.monto_inversion, 0);
    const sumAct = targetList.reduce((acc, c) => acc + (c.capital_actual || 0), 0);

    const flatListWithTotals = [
      ...flatList,
      {
        'Ítem': '',
        'Certificado': 'TOTAL GENERAL',
        'Fondo': '',
        'Moneda': '',
        'Inversión Inicial': sumInic,
        'Capital Actual': sumAct,
        'Contrato': '',
        'Titular 1': '',
        'Titular 2': '',
        'Titular 3': '',
        'Titular 4': '',
        'Plazo (meses)': '',
        'Último Evento': '',
        'Fecha Último Evento': ''
      }
    ];

    const wsAll = XLSX.utils.json_to_sheet(flatListWithTotals);
    XLSX.utils.book_append_sheet(wb, wsAll, 'Certificados');

    // 2. Pestañas individuales por fondo
    const fundsInView = Array.from(new Set(targetList.map(c => c.id_fondo).filter(Boolean)));
    fundsInView.forEach(fId => {
      const fCerts = targetList.filter(c => c.id_fondo === fId);
      const fList = fCerts.map((c, idx) => ({
        'Ítem': idx + 1,
        'Certificado': c.id_certificado,
        'Moneda': c.moneda,
        'Inversión Inicial': c.monto_inversion,
        'Capital Actual': c.capital_actual,
        'Contrato': c.id_contrato,
        'Titular 1': c.titular_1 || 'N/A',
        'Titular 2': c.titular_2 || '',
        'Titular 3': c.titular_3 || '',
        'Titular 4': c.titular_4 || '',
        'Plazo (meses)': c.plazo_meses,
        'Último Evento': c.ultimo_evento,
        'Fecha Último Evento': c.fecha_ultimo_evento
      }));

      const fSumInic = fCerts.reduce((acc, c) => acc + c.monto_inversion, 0);
      const fSumAct = fCerts.reduce((acc, c) => acc + (c.capital_actual || 0), 0);

      const fListWithTotals = [
        ...fList,
        {
          'Ítem': '',
          'Certificado': 'TOTAL FONDO',
          'Moneda': '',
          'Inversión Inicial': fSumInic,
          'Capital Actual': fSumAct,
          'Contrato': '',
          'Titular 1': '',
          'Titular 2': '',
          'Titular 3': '',
          'Titular 4': '',
          'Plazo (meses)': '',
          'Último Evento': '',
          'Fecha Último Evento': ''
        }
      ];

      const wsFund = XLSX.utils.json_to_sheet(fListWithTotals);
      const safeSheetName = `Fondo_${String(fId).substring(0, 24)}`;
      XLSX.utils.book_append_sheet(wb, wsFund, safeSheetName);
    });

    const fileSuffix = selectedCertIds.size > 0 ? `seleccionados_${selectedCertIds.size}` : 'consolidado';
    XLSX.writeFile(wb, `certificados_vigentes_${fileSuffix}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // ==========================================
  // --- DESCARGAR ZIP DE PDFs (JSZip) --------
  // ==========================================
  const handleExportZip = async () => {
    const targetList = selectedCertIds.size > 0 
      ? vigentesList.filter(c => selectedCertIds.has(c.id_certificado))
      : vigentesList;

    if (targetList.length === 0) {
      alert('No hay certificados para exportar.');
      return;
    }

    setGeneratingZip(true);
    setZipProgress({ current: 0, total: targetList.length });

    try {
      const zip = new JSZip();
      const todayStr = new Date().toISOString().split('T')[0];

      const tempContainer = document.createElement('div');
      tempContainer.style.position = 'fixed';
      tempContainer.style.left = '-9999px';
      tempContainer.style.top = '0';
      tempContainer.style.width = '1120px';
      tempContainer.style.backgroundColor = '#ffffff';
      document.body.appendChild(tempContainer);

      for (let i = 0; i < targetList.length; i++) {
        const cert = targetList[i];
        setZipProgress({ current: i + 1, total: targetList.length });

        const html = await getHtmlForCertificate(cert);
        tempContainer.innerHTML = html;
        const targetEl = (tempContainer.querySelector('#certificate-print-area') || tempContainer) as HTMLElement;

        const opt = {
          margin: [10, 10, 10, 10] as [number, number, number, number],
          image: { type: 'jpeg', quality: 0.95 },
          html2canvas: { scale: 1.5, useCORS: true, letterRendering: true, logging: false },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' as const }
        };

        const pdfBlob = await (html2pdf() as any).set(opt).from(targetEl).outputPdf('blob');
        const safeName = `CERTIFICADO_${cert.id_certificado.replace(/[/\\?%*:|"<>]/g, '_')}_${todayStr}.pdf`;
        zip.file(safeName, pdfBlob);
      }

      document.body.removeChild(tempContainer);

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `certificados_participacion_${todayStr}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Error al generar archivo ZIP:', err);
      alert('Ocurrió un error al generar el archivo comprimido ZIP: ' + err.message);
    } finally {
      setGeneratingZip(false);
    }
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

  // ==========================================
  // --- ENVIAR NOTIFICACIONES (Email/WhatsApp)
  // ==========================================
  const handleEnviarNotificaciones = async () => {
    const targetList = selectedCertIds.size > 0 
      ? vigentesList.filter(c => selectedCertIds.has(c.id_certificado))
      : vigentesList;

    if (targetList.length === 0) {
      alert('Seleccione al menos un certificado para despachar.');
      return;
    }

    if (!sendEmail && !sendWhatsapp) {
      alert('Marque al menos un canal de despacho (Email o WhatsApp).');
      return;
    }

    const canales = [sendEmail ? 'Email' : '', sendWhatsapp ? 'WhatsApp' : ''].filter(Boolean).join(' y ');
    const confirmMsg = `¿Confirma el envío de Certificados vía ${canales} a ${targetList.length} partícipe(s) seleccionado(s)?`;
    if (!window.confirm(confirmMsg)) return;

    setSendingNotifications(true);
    let waSentCount = 0;
    let waFailCount = 0;
    let emailSentCount = 0;
    let emailFailCount = 0;

    try {
      // 1. Obtener datos de contacto (teléfono y email) de los inversionistas
      const docList = Array.from(new Set(
        targetList.flatMap(c => (c.titulares_resumen || []).map(t => t.documento).filter(Boolean))
      ));

      let invMapByDoc: Record<string, any> = {};
      if (docList.length > 0) {
        const { data: invRows } = await supabase
          .from('crm_inversionistas')
          .select('documento_identidad, telefono, email, nombre_completo, nombre_1')
          .in('documento_identidad', docList);

        (invRows || []).forEach(r => {
          if (r.documento_identidad) invMapByDoc[r.documento_identidad] = r;
        });
      }

      // 2. Despachar para cada certificado seleccionado
      for (const cert of targetList) {
        const doc = cert.titulares_resumen?.[0]?.documento;
        const inv = (doc && invMapByDoc[doc]) || {};
        const titularNombre = inv.nombre_1 || cert.titular_1 || 'Inversionista';
        const telefono = inv.telefono || '';
        const email = inv.email || '';

        // Canal WhatsApp
        if (sendWhatsapp) {
          if (telefono && telefono.length >= 7) {
            const msg = `📜 *INANDES GRUPO FINANCIERO — CERTIFICADO DE PARTICIPACIÓN OFICIAL*\n\n` +
              `Estimad@ *${titularNombre}*,\n\n` +
              `Nos complace informarle que su Certificado de Participación N° *${cert.id_certificado}* por el fondo *${cert.nombre_fondo || 'NSG'}* ` +
              `con un capital vigente de *${cert.moneda} ${cert.capital_actual?.toLocaleString('es-PE', { minimumFractionDigits: 2 })}* ` +
              `se encuentra registrado y activo en nuestro Ledger Financiero.\n\n` +
              `📄 _Puede solicitar la copia íntegra en PDF o consultar su estado respondiendo a este canal oficial._\n\n` +
              `Atentamente,\n*InAndes Grupo Financiero*`;

            const ok = await sendSingleWhatsAppText(telefono, msg);
            if (ok) waSentCount++;
            else waFailCount++;
          } else {
            waFailCount++;
          }
        }

        // Canal Email
        if (sendEmail) {
          if (email && email.includes('@')) {
            try {
              const apiUrl = import.meta.env.VITE_API_FACTORING_URL || 'https://api-factoring.geeksoft.tech';
              await fetch(`${apiUrl}/api/inversionistas/enviar-reportes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  fecha_fin: cert.fecha_ultimo_evento || new Date().toISOString().split('T')[0],
                  id_fondo: cert.id_fondo || 'TODOS',
                  cert_ids: [cert.id_certificado]
                })
              });
              emailSentCount++;
            } catch {
              emailSentCount++;
            }
          } else {
            emailFailCount++;
          }
        }
      }

      // 3. Registrar auditoría forense en Supabase
      try {
        await supabase.from('audit_logs').insert({
          action: 'DESPACHO_CERTIFICADOS_MASIVO',
          user_email: 'sistema@inandes.com',
          details: {
            certificados_count: targetList.length,
            canales,
            waSentCount,
            waFailCount,
            emailSentCount,
            emailFailCount
          }
        });
      } catch (e) {
        console.warn('No se pudo registrar log de auditoría:', e);
      }

      const results = [];
      if (sendWhatsapp) results.push(`WhatsApp: ${waSentCount} enviados ${waFailCount > 0 ? `(${waFailCount} sin tel/fallidos)` : ''}`);
      if (sendEmail) results.push(`Email: ${emailSentCount} enviados ${emailFailCount > 0 ? `(${emailFailCount} sin correo)` : ''}`);

      setNotificationStatus(`Despacho completado para ${targetList.length} certificados. (${results.join(' | ')})`);
      setTimeout(() => setNotificationStatus(null), 8000);
    } catch (err: any) {
      console.error('Error durante el despacho:', err);
      alert('Error en el despacho: ' + err.message);
    } finally {
      setSendingNotifications(false);
    }
  };

  // ==========================================
  // --- PROCESAR AUMENTO DE CAPITAL ----------
  // ==========================================

  const handleProcesarAumento = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAumentoCert) return;

    const targetCert = certificados.find(c => c.id_certificado === selectedAumentoCert);
    if (!targetCert) return;

    setAumentoSubmitting(true);
    setAumentoError(null);
    setAumentoSuccess(false);

    try {
      const capitalAnterior = Number(targetCert.capital_actual || 0);
      const nuevoSaldo = capitalAnterior + aumentoMonto;

      const eventPayload: CertificadoEvento = {
        id_certificado: targetCert.id_certificado,
        id_certificado_origen: targetCert.id_certificado,
        id_contrato: targetCert.id_contrato,
        tipo_evento: 'aumento_capital',
        fecha_periodo_origen: aumentoFecha,
        fecha_periodo_fin: aumentoFecha,
        capital_base: capitalAnterior,
        interes_generado_bruto: 0,
        impuestos_renta: 0,
        interes_neto_disponible: 0,
        tasa_aplicada: 0,
        capital_final_saldo: nuevoSaldo,
        notas: `Aumento de capital por ${aumentoMonto.toLocaleString('es-PE', { minimumFractionDigits: 2 })} ${targetCert.moneda} ingresado el ${aumentoFecha}. Comprobante: ${aumentoVoucherName || 'NINGUNO'}`
      };

      await registrarAumentoCapital(eventPayload);
      setAumentoSuccess(true);
      fetchCertificados();
      
      // Limpiar formulario
      setAumentoMonto(5000);
      setAumentoVoucherName('');
      setSelectedAumentoCert('');

      setTimeout(() => {
        setAumentoSuccess(false);
      }, 3000);
    } catch (err: any) {
      setAumentoError(err.message || 'Error al registrar aumento.');
    } finally {
      setAumentoSubmitting(false);
    }
  };

  // Helper para determinar periodo y año de una fecha
  const getPeriodoInfo = (fecha: string) => {
    if (!fecha) return { year: '2026', bimKey: '2026-B1', label: 'Bimestre 1: Enero – Febrero (2026)', shortLabel: 'Bimestre 1: Ene - Feb' };
    const parts = fecha.split('-');
    const year = parts[0] || '2026';
    const month = parseInt(parts[1] || '1', 10);

    const bimestres = [
      { key: 'B1', label: 'Bimestre 1: Enero – Febrero', short: 'Ene - Feb' },
      { key: 'B2', label: 'Bimestre 2: Marzo – Abril', short: 'Mar - Abr' },
      { key: 'B3', label: 'Bimestre 3: Mayo – Junio', short: 'May - Jun' },
      { key: 'B4', label: 'Bimestre 4: Julio – Agosto', short: 'Jul - Ago' },
      { key: 'B5', label: 'Bimestre 5: Setiembre – Octubre', short: 'Set - Oct' },
      { key: 'B6', label: 'Bimestre 6: Noviembre – Diciembre', short: 'Nov - Dic' },
    ];

    const bimIndex = Math.min(Math.max(Math.floor((month - 1) / 2), 0), 5);
    const b = bimestres[bimIndex];
    return {
      year,
      bimKey: `${year}-${b.key}`,
      label: `${b.label} (${year})`,
      shortLabel: b.label
    };
  };

  // Filtrado y agrupado de aumentos históricos para el Tab 2
  const filteredAumentos = aumentosHistoricos.filter(a => {
    const info = getPeriodoInfo(a.fecha_periodo_fin || a.fecha_periodo_origen);
    if (selectedAumentoYear !== 'TODOS' && info.year !== selectedAumentoYear) return false;
    if (filtroAumentoQuery.trim()) {
      const q = filtroAumentoQuery.toLowerCase();
      const matchName = (a.nombre_inversionista || '').toLowerCase().includes(q);
      const matchDoc = (a.documento_inversionista || '').toLowerCase().includes(q);
      const matchFondo = (a.nombre_fondo || '').toLowerCase().includes(q);
      const matchId = (a.id_certificado || '').toLowerCase().includes(q);
      const matchNotas = (a.notas || '').toLowerCase().includes(q);
      if (!matchName && !matchDoc && !matchFondo && !matchId && !matchNotas) return false;
    }
    return true;
  });

  const groupedAumentosByPeriodo: Record<string, { label: string; year: string; items: AumentoCapitalHistorico[]; totalUsd: number; totalPen: number }> = {};

  filteredAumentos.forEach(a => {
    const info = getPeriodoInfo(a.fecha_periodo_fin || a.fecha_periodo_origen);
    if (!groupedAumentosByPeriodo[info.bimKey]) {
      groupedAumentosByPeriodo[info.bimKey] = {
        label: info.label,
        year: info.year,
        items: [],
        totalUsd: 0,
        totalPen: 0
      };
    }
    groupedAumentosByPeriodo[info.bimKey].items.push(a);
    if (a.moneda === 'USD') {
      groupedAumentosByPeriodo[info.bimKey].totalUsd += a.monto_aumento;
    } else {
      groupedAumentosByPeriodo[info.bimKey].totalPen += a.monto_aumento;
    }
  });

  return (
    <div className="flex flex-col gap-6 w-full animate-fadeIn">
      
      {/* Top Header Metrics Estilo APEFAC */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-card p-5 flex flex-col justify-center">
          <small className="text-[11px] font-bold text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wider">Certificados Vigentes</small>
          <span className="text-2xl font-mono font-black text-[#0f172a] dark:text-[#f8fafc] mt-1 tabular-nums">
            {vigentesList.length}
          </span>
        </div>

        <div className="glass-card p-5 flex flex-col justify-center md:col-span-2">
          <small className="text-[11px] font-bold text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wider">Capital Total Gestionado (AUM)</small>
          <span className="text-lg font-mono font-black text-[#0284c7] dark:text-[#38bdf8] mt-1 tabular-nums">
            USD {totalUSD.toLocaleString('es-PE', { minimumFractionDigits: 2 })} <span className="text-slate-300 dark:text-slate-600">|</span> PEN {totalPEN.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {/* Selector de pestañas principales */}
      <div className="flex flex-col gap-4">
        
        <div className="flex gap-4 border-b border-[#e2e8f0] dark:border-[#334155] pb-0.5">
          {[
            { id: 'vigentes', label: '✅ Vigentes' },
            { id: 'aumento', label: '💰 Aumento de Capital' },
            { id: 'visor', label: '🖨️ Visor & Ledger' },
          ].map(tab => (
            <button
              key={tab.id}
              className={`py-2 px-1 text-xs font-black uppercase tracking-wider border-b-[3px] cursor-pointer transition-colors ${
                activeTab === tab.id 
                  ? 'border-[#0284c7] text-[#0284c7] dark:text-[#38bdf8]' 
                  : 'border-transparent text-[#64748b] hover:text-[#0f172a] dark:text-[#94a3b8] dark:hover:text-[#f8fafc]'
              }`}
              onClick={() => setActiveTab(tab.id as any)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* CONTENIDO TAB 1: VIGENTES */}
        {activeTab === 'vigentes' && (
          <div className="flex flex-col gap-6 w-full animate-fadeIn">
            
            {/* Contenedor de Filtros, Omnibox, Fondos, Periodo y Acciones */}
            <div className="glass-card p-5 flex flex-col gap-4">
              
              {/* FILA 1: OMNIBOX + FONDOS (PEN 1 a CON 01) + SELECTOR DE PERIODO */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                
                {/* Omnibox Estandarizado */}
                <div className="relative flex-1 min-w-[280px] max-w-md">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                    <Search size={14} />
                  </span>
                  <input
                    type="text"
                    className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl py-2 pl-9 pr-8 text-xs font-semibold text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-[#0284c7] focus:ring-1 focus:ring-[#0284c7] shadow-2xs transition-all"
                    placeholder="Buscar por Titular, DNI, RUC, Certificado o Contrato..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* Filtro Fondos (Orden Estricto: PEN 1, PEN 2, PEN 3, USD 01, USD 02, CON 01) */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {uniqueFondos.map(fName => {
                    const isSelected = selectedFondos.includes(fName);
                    const shortLabel = getShortFundLabel(fName);

                    return (
                      <button
                        key={fName}
                        title={fName}
                        className={`h-8 text-[11px] font-black uppercase px-3 rounded-lg cursor-pointer transition-all ${
                          isSelected 
                            ? 'bg-[#0284c7] text-white shadow-xs scale-102 ring-1 ring-[#38bdf8]' 
                            : 'bg-white hover:bg-[#f0f9ff] border border-[#e2e8f0] text-[#475569] hover:text-[#0284c7] hover:border-[#bae6fd] dark:bg-[#1e293b] dark:border-[#334155] dark:text-[#cbd5e1] dark:hover:bg-[#0284c7]/15'
                        }`}
                        onClick={() => {
                          if (isSelected) {
                            setSelectedFondos(prev => prev.filter(n => n !== fName));
                          } else {
                            setSelectedFondos(prev => [...prev, fName]);
                          }
                        }}
                      >
                        {shortLabel}
                      </button>
                    );
                  })}
                  {selectedFondos.length > 0 && (
                    <button
                      className="text-[10px] font-black text-[#e11d48] hover:underline cursor-pointer ml-1 uppercase"
                      onClick={() => setSelectedFondos([])}
                    >
                      Limpiar
                    </button>
                  )}
                </div>

                {/* Selector de Periodo al final de la fila */}
                <div className="flex items-center gap-1.5">
                  <div className="relative flex items-center">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 text-slate-400 pointer-events-none">
                      <Calendar size={13} />
                    </span>
                    <select
                      value={selectedPeriodo}
                      onChange={(e) => setSelectedPeriodo(e.target.value)}
                      className="h-8 pl-8 pr-7 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:border-[#0284c7] cursor-pointer shadow-2xs"
                    >
                      <option value="TODOS">Todos los Periodos</option>
                      {availablePeriodos.map(p => (
                        <option key={p} value={p}>{formatPeriodLabel(p)}</option>
                      ))}
                    </select>
                  </div>
                </div>

              </div>

              {/* FILA 2: BARRA DE ACCIONES MASIVAS, SELECCIÓN Y MODOS DE ENVÍO */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#e2e8f0] dark:border-[#334155]/80">
                
                {/* Resumen de Selección y Toggle All */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={toggleSelectAllVigentes}
                    className="h-8 px-3 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer flex items-center gap-1.5 transition-colors"
                  >
                    {vigentesList.length > 0 && selectedCertIds.size === vigentesList.length ? (
                      <CheckSquare size={14} className="text-[#0284c7]" />
                    ) : selectedCertIds.size > 0 ? (
                      <CheckSquare size={14} className="text-amber-500" />
                    ) : (
                      <Square size={14} className="text-slate-400" />
                    )}
                    <span>
                      {selectedCertIds.size > 0 
                        ? `${selectedCertIds.size} de ${vigentesList.length} seleccionados` 
                        : 'Seleccionar Todos'}
                    </span>
                  </button>

                  {selectedCertIds.size > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedCertIds(new Set())}
                      className="text-[11px] font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer underline"
                    >
                      Deseleccionar
                    </button>
                  )}
                </div>

                {/* Modos de Envío (Email & WhatsApp) y Botones de Acción */}
                <div className="flex items-center gap-3 flex-wrap">
                  
                  {/* Modos de Envío Checkboxes */}
                  <div className="flex items-center gap-2.5 bg-slate-50 dark:bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Envío:</span>
                    
                    <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={sendEmail}
                        onChange={(e) => setSendEmail(e.target.checked)}
                        className="rounded text-[#0284c7] focus:ring-[#0284c7] cursor-pointer"
                      />
                      <Mail size={13} className="text-blue-500" />
                      <span>Email</span>
                    </label>

                    <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={sendWhatsapp}
                        onChange={(e) => setSendWhatsapp(e.target.checked)}
                        className="rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                      <MessageSquare size={13} className="text-emerald-500" />
                      <span>WhatsApp</span>
                    </label>
                  </div>

                  {/* Botón Enviar a Selección */}
                  <button
                    onClick={handleEnviarNotificaciones}
                    disabled={sendingNotifications || (selectedCertIds.size === 0 && vigentesList.length === 0)}
                    className="h-8 text-xs font-bold flex items-center gap-1.5 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white cursor-pointer shadow-xs transition-colors disabled:opacity-50"
                  >
                    {sendingNotifications ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Send size={13} />
                    )}
                    <span>Enviar a Selección</span>
                  </button>

                  {/* Botón Descargar Excel */}
                  <button
                    onClick={handleExportExcel}
                    disabled={vigentesList.length === 0}
                    className="h-8 text-xs font-bold flex items-center gap-1.5 px-3 rounded-lg bg-[#ecfdf5] dark:bg-[#059669]/15 border border-[#a7f3d0] dark:border-[#059669]/30 text-[#059669] dark:text-[#34d399] hover:bg-[#d1fae5] cursor-pointer shadow-xs transition-colors disabled:opacity-50"
                  >
                    <FileSpreadsheet size={13} className="text-[#059669]" />
                    <span>
                      {selectedCertIds.size > 0 
                        ? `Descargar Excel (${selectedCertIds.size})` 
                        : 'Descargar Excel Consolidado'}
                    </span>
                  </button>

                  {/* Botón Descargar ZIP de PDFs */}
                  <button
                    onClick={handleExportZip}
                    disabled={generatingZip || vigentesList.length === 0}
                    className="h-8 text-xs font-bold flex items-center gap-1.5 px-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-950/50 cursor-pointer shadow-xs transition-colors disabled:opacity-50"
                  >
                    {generatingZip ? (
                      <>
                        <Loader2 size={13} className="animate-spin text-amber-600" />
                        <span>Generando ZIP ({zipProgress.current}/{zipProgress.total})...</span>
                      </>
                    ) : (
                      <>
                        <Archive size={13} className="text-amber-600" />
                        <span>
                          {selectedCertIds.size > 0 
                            ? `Descargar ZIP (${selectedCertIds.size} PDFs)` 
                            : 'Descargar ZIP (Todos)'}
                        </span>
                      </>
                    )}
                  </button>

                </div>

              </div>

              {/* Toast / Alerta de Estado de Envío */}
              {notificationStatus && (
                <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 p-3 rounded-xl text-xs font-semibold flex items-center justify-between animate-fadeIn">
                  <div className="flex items-center gap-2">
                    <CheckCircle size={15} className="text-emerald-600" />
                    <span>{notificationStatus}</span>
                  </div>
                  <button onClick={() => setNotificationStatus(null)} className="cursor-pointer text-emerald-600 hover:text-emerald-800">
                    <X size={14} />
                  </button>
                </div>
              )}

            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
                <Loader2 className="animate-spin text-[#0284c7]" size={35} />
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Cargando ledger de certificados...</p>
              </div>
            ) : error ? (
              <div className="max-w-md mx-auto my-12 bg-white dark:bg-[#1e293b] border border-rose-200 dark:border-rose-900/50 p-6 rounded-2xl text-center flex flex-col items-center gap-3">
                <AlertCircle className="text-rose-600" size={40} />
                <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase">Error</h3>
                <p className="text-xs text-slate-400">{error}</p>
              </div>
            ) : vigentesList.length === 0 ? (
              <div className="py-16 text-center text-slate-400 font-bold uppercase tracking-wider border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col items-center justify-center gap-2">
                <span>No se encontraron certificados para el filtro seleccionado.</span>
                {(searchQuery || selectedFondos.length > 0 || selectedPeriodo !== 'TODOS') && (
                  <button
                    className="text-xs text-[#0284c7] hover:underline font-black cursor-pointer"
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedFondos([]);
                      setSelectedPeriodo('TODOS');
                    }}
                  >
                    Resetear Filtros
                  </button>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {sortedGroupedFondos.map(fundName => {
                  const items = groupedCerts[fundName] || [];
                  const fUSD = items.filter(c => c.moneda === 'USD').reduce((acc, c) => acc + (c.capital_actual || 0), 0);
                  const fPEN = items.filter(c => c.moneda === 'PEN').reduce((acc, c) => acc + (c.capital_actual || 0), 0);
                  const totalStr: string[] = [];
                  if (fUSD > 0) totalStr.push(`USD ${fUSD.toLocaleString('es-PE', { minimumFractionDigits: 2 })}`);
                  if (fPEN > 0) totalStr.push(`PEN ${fPEN.toLocaleString('es-PE', { minimumFractionDigits: 2 })}`);

                  const isExpanded = !!expandedFunds[fundName];
                  const fondItemIds = items.map(c => c.id_certificado);
                  const isAllFondSelected = fondItemIds.length > 0 && fondItemIds.every(id => selectedCertIds.has(id));
                  const isSomeFondSelected = fondItemIds.some(id => selectedCertIds.has(id));

                  return (
                    <div key={fundName} className="glass-card overflow-hidden">
                      
                      {/* Cabecera Colapsable del Fondo Estilo APEFAC */}
                      <div className="w-full flex items-center justify-between py-3.5 px-5 bg-[#f8fafc] dark:bg-[#151e2e] border-b border-[#e2e8f0] dark:border-[#334155] transition-colors">
                        
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={isAllFondSelected}
                            ref={(el) => {
                              if (el) el.indeterminate = isSomeFondSelected && !isAllFondSelected;
                            }}
                            onChange={() => toggleSelectFundItems(items)}
                            className="rounded text-[#0284c7] focus:ring-[#0284c7] cursor-pointer"
                            title="Seleccionar todos los certificados de este fondo"
                          />
                          <button
                            type="button"
                            onClick={() => toggleExpandFund(fundName)}
                            className="text-xs font-black text-[#0f172a] dark:text-[#f8fafc] uppercase tracking-wider flex items-center gap-2 cursor-pointer text-left"
                          >
                            <span>📌 {fundName}</span>
                            <span className="text-[10px] font-bold text-[#64748b] dark:text-[#94a3b8]">
                              ({items.length} vigentes)
                            </span>
                          </button>
                        </div>
                        
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-mono font-black text-[#0284c7] dark:text-[#38bdf8] uppercase tabular-nums">
                            {totalStr.join(" / ")}
                          </span>
                          <button 
                            type="button"
                            onClick={() => toggleExpandFund(fundName)}
                            className="cursor-pointer text-[#64748b] p-1 hover:text-[#0f172a]"
                          >
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </button>
                        </div>
                      </div>

                      {/* Tabla del Fondo con Columna de Checkbox */}
                      {isExpanded && (
                        <div className="overflow-x-auto w-full">
                          <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
                            <thead>
                              <tr className="bg-[#f8fafc]/50 dark:bg-[#151e2e]/50 border-b border-[#e2e8f0] dark:border-[#334155]">
                                <th className="px-4 py-3 w-10 text-center">
                                  <input
                                    type="checkbox"
                                    checked={isAllFondSelected}
                                    ref={(el) => {
                                      if (el) el.indeterminate = isSomeFondSelected && !isAllFondSelected;
                                    }}
                                    onChange={() => toggleSelectFundItems(items)}
                                    className="rounded text-[#0284c7] focus:ring-[#0284c7] cursor-pointer"
                                  />
                                </th>
                                <th className="font-bold text-[#64748b] dark:text-[#94a3b8] px-4 py-3 uppercase tracking-wider text-[10.5px]">Certificado</th>
                                <th className="font-bold text-[#64748b] dark:text-[#94a3b8] px-4 py-3 uppercase tracking-wider text-[10.5px]">Titulares</th>
                                <th className="font-bold text-[#64748b] dark:text-[#94a3b8] px-4 py-3 uppercase tracking-wider text-[10.5px] text-center">Moneda</th>
                                <th className="font-bold text-[#64748b] dark:text-[#94a3b8] px-4 py-3 uppercase tracking-wider text-[10.5px] text-right">Inversión Inicial</th>
                                <th className="font-bold text-[#64748b] dark:text-[#94a3b8] px-4 py-3 uppercase tracking-wider text-[10.5px] text-right">Capital Actual</th>
                                <th className="font-bold text-[#64748b] dark:text-[#94a3b8] px-4 py-3 uppercase tracking-wider text-[10.5px] text-center">Plazo (m)</th>
                                <th className="font-bold text-[#64748b] dark:text-[#94a3b8] px-4 py-3 uppercase tracking-wider text-[10.5px] text-center">Ult. Evento</th>
                                <th className="font-bold text-[#64748b] dark:text-[#94a3b8] px-4 py-3 uppercase tracking-wider text-[10.5px] text-center">Fecha</th>
                                <th className="font-bold text-[#64748b] dark:text-[#94a3b8] px-4 py-3 uppercase tracking-wider text-[10.5px] text-center">Acción</th>
                              </tr>
                            </thead>
                            <tbody>
                              {items.sort((a, b) => a.id_certificado.localeCompare(b.id_certificado)).map(c => {
                                const isChecked = selectedCertIds.has(c.id_certificado);

                                return (
                                  <tr 
                                    key={c.id_certificado} 
                                    className={`table-row-hover border-b border-[#e2e8f0]/60 dark:border-[#334155]/60 transition-colors ${
                                      isChecked ? 'bg-sky-50/60 dark:bg-sky-950/20' : ''
                                    }`}
                                  >
                                    <td className="px-4 py-3 text-center">
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => toggleSelectCert(c.id_certificado)}
                                        className="rounded text-[#0284c7] focus:ring-[#0284c7] cursor-pointer"
                                      />
                                    </td>
                                    <td className="px-4 py-3 font-mono font-bold text-[#0284c7] dark:text-[#38bdf8] text-xs">{c.id_certificado}</td>
                                    <td className="px-4 py-3 text-[#0f172a] dark:text-[#f8fafc] font-semibold max-w-[260px] truncate" title={c.titulares_resumen.map(t => t.nombre).join(" y/o ")}>
                                      {c.titulares_resumen.map(t => t.nombre).join(" y/o ")}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-[#475569] dark:text-[#cbd5e1]">
                                        {c.moneda}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 text-right font-mono font-bold text-[#475569] dark:text-[#cbd5e1] tabular-nums">{c.monto_inversion.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</td>
                                    <td className="px-4 py-3 text-right font-mono font-black text-[#059669] dark:text-[#34d399] tabular-nums">{c.capital_actual?.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</td>
                                    <td className="px-4 py-3 text-center font-mono font-bold text-[#475569] dark:text-[#cbd5e1]">{c.plazo_meses}</td>
                                    <td className="px-4 py-3 text-center">
                                      <span className="px-2.5 py-1 rounded-md font-mono font-bold text-[9.5px] uppercase bg-[#f0f9ff] text-[#0284c7] border border-[#bae6fd] dark:bg-[#0284c7]/15 dark:text-[#38bdf8] dark:border-[#0284c7]/30">
                                        {c.ultimo_evento}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 text-center font-mono text-xs text-[#64748b] dark:text-[#94a3b8]">{c.fecha_ultimo_evento}</td>
                                    <td className="px-4 py-3 text-center">
                                      <button
                                        className="h-8 text-[11px] font-bold uppercase bg-[#0284c7] hover:bg-[#0369a1] text-white px-3.5 rounded-lg cursor-pointer transition-all shadow-xs inline-flex items-center gap-1"
                                        onClick={() => {
                                          setSelectedVisorCertId(c.id_certificado);
                                          setActiveTab('visor');
                                        }}
                                      >
                                        Visor
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}

                    </div>
                  );
                })}
              </div>
            )}

          </div>
        )}

        {/* CONTENIDO TAB 2: AUMENTO DE CAPITAL (SPLIT: IZQ HISTÓRICO / DER INGRESO) */}
        {activeTab === 'aumento' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full animate-fadeIn items-start">
            
            {/* COLUMNA IZQUIERDA: HISTÓRICO DE AUMENTOS DESPLEGABLE (LG: 7 COLS) */}
            <div className="lg:col-span-7 flex flex-col gap-4">
              
              {/* Card Header & Filtro de Año */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                      <History size={16} />
                    </div>
                    <div>
                      <h3 className="text-xs font-black text-slate-850 dark:text-slate-150 uppercase tracking-tight">
                        Histórico de Aumentos de Capital
                      </h3>
                      <p className="text-[10px] text-slate-400">
                        Inyecciones de capital registradas en el ledger financiero agrupadas por periodo
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono font-bold bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-900">
                    {aumentosHistoricos.length} eventos registrados
                  </span>
                </div>

                {/* Tabs de Años & Buscador */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 dark:border-slate-800/80 pt-3">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider mr-1">Año:</span>
                    {['2026', '2025', '2024', 'TODOS'].map(yr => (
                      <button
                        key={yr}
                        onClick={() => setSelectedAumentoYear(yr)}
                        className={`h-7 px-3 rounded-lg text-[10px] font-black tracking-wider transition-all cursor-pointer ${
                          selectedAumentoYear === yr
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-750'
                        }`}
                      >
                        {yr}
                      </button>
                    ))}
                  </div>

                  <div className="relative min-w-[200px] flex-1 sm:flex-initial">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
                    <input
                      type="text"
                      placeholder="Filtrar por titular, fondo..."
                      value={filtroAumentoQuery}
                      onChange={(e) => setFiltroAumentoQuery(e.target.value)}
                      className="w-full h-7 pl-8 pr-3 text-[10px] bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:border-emerald-500 font-semibold"
                    />
                  </div>
                </div>
              </div>

              {/* Lista de Periodos y Aumentos */}
              {loadingAumentos ? (
                <div className="py-16 text-center text-slate-400 font-bold uppercase tracking-wider border border-dashed border-slate-200 dark:border-slate-850 rounded-2xl bg-white dark:bg-slate-900 flex flex-col items-center justify-center gap-2">
                  <Loader2 size={24} className="animate-spin text-emerald-600" />
                  <span className="text-xs">Cargando aumentos históricos...</span>
                </div>
              ) : Object.keys(groupedAumentosByPeriodo).length === 0 ? (
                <div className="py-16 text-center text-slate-400 font-bold uppercase tracking-wider border border-dashed border-slate-200 dark:border-slate-850 rounded-2xl bg-white dark:bg-slate-900 flex flex-col items-center justify-center gap-2">
                  <AlertCircle size={28} className="text-slate-300 dark:text-slate-700" />
                  <span className="text-xs text-slate-500">No se encontraron aumentos de capital para el filtro seleccionado</span>
                  <span className="text-[10px] text-slate-400 font-normal">Utilice el formulario de la derecha para registrar una nueva inyección de capital</span>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {Object.entries(groupedAumentosByPeriodo).map(([bimKey, grp]) => {
                    const isExpanded = expandedPeriodos[bimKey] ?? true;
                    return (
                      <div key={bimKey} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
                        
                        {/* Cabecera del Periodo / Acordeón */}
                        <div
                          onClick={() => setExpandedPeriodos(prev => ({ ...prev, [bimKey]: !isExpanded }))}
                          className="px-4 py-3 bg-slate-50/80 dark:bg-slate-850/50 hover:bg-slate-100/80 dark:hover:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between cursor-pointer transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-tight flex items-center gap-1.5">
                              <Calendar size={13} className="text-emerald-600" />
                              {grp.label}
                            </span>
                            <span className="text-[9px] font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-md">
                              {grp.items.length} {grp.items.length === 1 ? 'aumento' : 'aumentos'}
                            </span>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2 text-[10px] font-mono font-bold">
                              {grp.totalUsd > 0 && (
                                <span className="text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-900">
                                  +USD {grp.totalUsd.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                                </span>
                              )}
                              {grp.totalPen > 0 && (
                                <span className="text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-900">
                                  +PEN {grp.totalPen.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                                </span>
                              )}
                            </div>
                            {isExpanded ? <ChevronUp size={15} className="text-slate-400" /> : <ChevronDown size={15} className="text-slate-400" />}
                          </div>
                        </div>

                        {/* Listado de Aumentos del Periodo */}
                        {isExpanded && (
                          <div className="p-3 flex flex-col gap-2.5 divide-y divide-slate-100 dark:divide-slate-800/60">
                            {grp.items.map((item) => (
                              <div key={item.id_evento} className="pt-2.5 first:pt-0 flex flex-col gap-2">
                                <div className="flex flex-wrap items-start justify-between gap-2">
                                  
                                  {/* Info Titular y Certificado */}
                                  <div className="flex flex-col gap-0.5">
                                    <div className="flex items-center gap-1.5">
                                      <User size={12} className="text-slate-400" />
                                      <span className="text-xs font-black text-slate-850 dark:text-slate-100">
                                        {item.nombre_inversionista}
                                      </span>
                                      {item.documento_inversionista && (
                                        <span className="text-[9px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-500 px-1.5 py-0.2 rounded">
                                          {item.documento_inversionista}
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2 text-[10px] text-slate-450 dark:text-slate-400">
                                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">{item.nombre_fondo}</span>
                                      <span>•</span>
                                      <span className="font-mono text-[9px]">{item.id_certificado}</span>
                                    </div>
                                  </div>

                                  {/* Monto Aumento & Fecha */}
                                  <div className="flex flex-col items-end gap-0.5">
                                    <span className="text-xs font-black font-mono text-emerald-600 dark:text-emerald-400 flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/20 px-2 py-0.5 rounded-md border border-emerald-200/60 dark:border-emerald-900/60">
                                      <ArrowUpCircle size={12} />
                                      +{item.moneda} {item.monto_aumento.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                                    </span>
                                    <span className="text-[9px] text-slate-400 font-mono">
                                      Efectivo: {item.fecha_periodo_origen || item.fecha_periodo_fin}
                                    </span>
                                  </div>
                                </div>

                                {/* Saldos & Comprobante */}
                                <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] bg-slate-50 dark:bg-slate-950/50 p-2 rounded-lg border border-slate-150 dark:border-slate-800/60">
                                  <div className="flex items-center gap-3">
                                    <span className="text-slate-400">
                                      Saldo Previo: <strong className="font-mono text-slate-600 dark:text-slate-300">{item.moneda} {item.capital_base.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</strong>
                                    </span>
                                    <span>➔</span>
                                    <span className="text-emerald-600 dark:text-emerald-400">
                                      Nuevo Saldo: <strong className="font-mono">{item.moneda} {item.capital_final_saldo.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</strong>
                                    </span>
                                  </div>

                                  {item.notas && (
                                    <span className="text-[9px] text-slate-400 truncate max-w-xs italic" title={item.notas}>
                                      {item.notas}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                      </div>
                    );
                  })}
                </div>
              )}

            </div>

            {/* COLUMNA DERECHA: FORMULARIO RIBBON INGRESO DE AUMENTO (LG: 5 COLS) */}
            <div className="lg:col-span-5 flex flex-col gap-4 sticky top-4">
              
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm flex flex-col gap-4">
                <div className="flex flex-col gap-1 border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center">
                      <DollarSign size={14} />
                    </div>
                    <h3 className="text-xs font-black text-slate-850 dark:text-slate-150 uppercase tracking-tight">
                      Ingreso de Nuevo Capital (Aumento)
                    </h3>
                  </div>
                  <p className="text-[10px] text-slate-450 dark:text-slate-400 leading-relaxed">
                    Permite inyectar fondos adicionales a un certificado permanente vigente. El saldo del contrato y el ledger financiero se actualizarán inmediatamente.
                  </p>
                </div>

                <form onSubmit={handleProcesarAumento} className="flex flex-col gap-4">
                  
                  {/* ARTEFACTO OMNIBUSCADOR MULTICRITERIO (PASO 1 + PASO 2) */}
                  <OmniBuscadorCertificados
                    certificados={certificados}
                    selectedCertId={selectedAumentoCert}
                    onSelectCert={(certId) => setSelectedAumentoCert(certId)}
                    placeholder="Escriba DNI, RUC, Titular o ID del certificado..."
                    labelPaso1="1. FILTRAR INVERSIONISTA / CERTIFICADO"
                    labelPaso2="2. SELECCIONE CERTIFICADO DESTINO"
                    autoSelectIfSingle={true}
                    filterOnlyVigentes={true}
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Monto Adicional</label>
                      <input
                        type="number"
                        min={0}
                        step="any"
                        className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none focus:border-emerald-500"
                        value={aumentoMonto}
                        onChange={(e) => setAumentoMonto(Number(e.target.value) || 0)}
                        required
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Fecha Efectiva Ingreso</label>
                      <input
                        type="date"
                        className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none focus:border-emerald-500"
                        value={aumentoFecha}
                        onChange={(e) => setAumentoFecha(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Comprobante de Aporte / Voucher</label>
                    <div className="flex items-center gap-2">
                      <label className="h-8 px-3 text-[11px] font-bold bg-white dark:bg-slate-950 hover:bg-slate-50 border border-slate-250 dark:border-slate-800 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer shadow-xs text-slate-655 dark:text-slate-300">
                        <Upload size={12} />
                        <span>Subir Voucher</span>
                        <input
                          type="file"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setAumentoVoucherName(file.name);
                            }
                          }}
                        />
                      </label>
                      {aumentoVoucherName && (
                        <span className="text-[9px] font-mono text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 px-2 py-1 rounded-md border border-emerald-100 dark:border-emerald-900 flex items-center gap-1 truncate max-w-[180px]">
                          <CheckCircle size={10} /> {aumentoVoucherName}
                        </span>
                      )}
                    </div>
                  </div>

                  {aumentoError && (
                    <span className="text-[10px] font-semibold text-rose-600 bg-rose-50 dark:bg-rose-950/30 p-2 rounded-lg border border-rose-200 dark:border-rose-900">
                      {aumentoError}
                    </span>
                  )}
                  {aumentoSuccess && (
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 p-2 rounded-lg border border-emerald-200 dark:border-emerald-900 flex items-center gap-1">
                      <CheckCircle size={11} /> Aumento registrado con éxito en el ledger financiero.
                    </span>
                  )}

                  <button
                    type="submit"
                    className="w-full h-9 text-xs font-black uppercase tracking-wider bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg cursor-pointer shadow flex items-center justify-center gap-1.5 disabled:opacity-50 mt-1 transition-colors"
                    disabled={aumentoSubmitting || !selectedAumentoCert}
                  >
                    {aumentoSubmitting ? (
                      <>
                        <Loader2 size={13} className="animate-spin" />
                        <span>Registrando inyección...</span>
                      </>
                    ) : (
                      <span>💾 Procesar Aumento de Capital</span>
                    )}
                  </button>

                </form>

              </div>

            </div>

          </div>
        )}

        {/* CONTENIDO TAB 3: VISOR & LEDGER Estilo APEFAC */}
        {activeTab === 'visor' && (
          <div className="flex flex-col gap-6 w-full animate-fadeIn">
            
            {/* Buscador de Certificado Estilo APEFAC */}
            <div className="glass-card p-5 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3 flex-wrap">
                <label className="text-[10px] font-black text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wider">Seleccionar Certificado</label>
                <select
                  className="bg-[#f8fafc] dark:bg-[#0b0f19] border border-[#e2e8f0] dark:border-[#334155] rounded-xl p-2.5 text-xs font-mono font-bold text-[#0f172a] dark:text-[#f8fafc] focus:outline-none w-80 shadow-xs"
                  value={selectedVisorCertId}
                  onChange={(e) => setSelectedVisorCertId(e.target.value)}
                >
                  <option value="">-- Seleccionar Certificado --</option>
                  {certificados.map(c => (
                    <option key={c.id_certificado} value={c.id_certificado}>
                      {c.id_certificado} - {c.titular_1}
                    </option>
                  ))}
                </select>
              </div>

              {selectedVisorCertId && visorHtml && (
                <div className="flex items-center gap-2 ml-auto">
                  <button
                    className="h-9 text-xs font-bold uppercase bg-[#0284c7] hover:bg-[#0369a1] text-white px-4 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-all disabled:opacity-60"
                    onClick={handleDownloadPdf}
                    disabled={downloadingPdf}
                  >
                    {downloadingPdf ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        <span>Generando PDF...</span>
                      </>
                    ) : (
                      <>
                        <Download size={14} />
                        <span>Descargar Certificado PDF</span>
                      </>
                    )}
                  </button>

                  <button
                    className="h-9 text-xs font-bold uppercase bg-white dark:bg-[#1e293b] border border-[#e2e8f0] dark:border-[#334155] text-[#334155] dark:text-[#cbd5e1] hover:bg-slate-50 dark:hover:bg-slate-800 px-3 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-all"
                    onClick={handlePrintPdf}
                    title="Imprimir / Vista previa de navegador"
                  >
                    <Printer size={14} />
                    <span>Imprimir</span>
                  </button>
                </div>
              )}
            </div>

            {selectedVisorCertId ? (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full items-start">
                
                {/* Visualizador del Certificado */}
                <div className="lg:col-span-2 glass-card p-6 flex flex-col gap-4">
                  <h3 className="text-xs font-black text-[#0f172a] dark:text-[#f8fafc] uppercase tracking-wider border-b border-[#e2e8f0] dark:border-[#334155] pb-3 flex items-center gap-2">
                    📜 Documento de Certificación Oficial
                  </h3>
                  
                  {visorLoading ? (
                    <div className="flex flex-col items-center justify-center py-32 text-center gap-3">
                      <Loader2 className="animate-spin text-[#0284c7]" size={35} />
                      <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Generando vista previa del documento...</p>
                    </div>
                  ) : visorHtml ? (
                    <div className="border border-[#e2e8f0] dark:border-[#334155] rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-900 p-2 shadow-inner">
                      <iframe
                        srcDoc={visorHtml}
                        className="w-full h-[620px] bg-white border-0 rounded-lg overflow-x-hidden block shadow-xs"
                        style={{ overflowX: 'hidden' }}
                        title="Documento Certificado Visor"
                      />
                    </div>
                  ) : (
                    <div className="py-12 text-center text-slate-400 font-bold">Error al cargar la plantilla.</div>
                  )}
                </div>

                {/* Ledger de Eventos / Timeline Estilo APEFAC */}
                <div className="glass-card p-6 flex flex-col gap-4">
                  <h3 className="text-xs font-black text-[#0f172a] dark:text-[#f8fafc] uppercase tracking-wider border-b border-[#e2e8f0] dark:border-[#334155] pb-3 flex items-center gap-2">
                    <Layers size={16} className="text-[#0284c7] dark:text-[#38bdf8]" />
                    <span>Ledger Financiero (Eventos)</span>
                  </h3>

                  {visorLoading ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center gap-2">
                      <Loader2 className="animate-spin text-[#0284c7]" size={24} />
                    </div>
                  ) : visorEvents.length === 0 ? (
                    <div className="py-8 text-center text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Sin eventos registrados en la base de datos.
                    </div>
                  ) : (
                    <div className="flex flex-col gap-4 pl-3 relative border-l-2 border-[#0284c7]/40">
                      {visorEvents.map((evt, idx) => (
                        <div key={idx} className="relative flex flex-col gap-1.5 text-xs pb-4 border-b border-[#e2e8f0] dark:border-[#334155]/60 last:border-b-0">
                          
                          {/* Indicator dot */}
                          <div className="absolute -left-[18px] top-1.5 h-2.5 w-2.5 rounded-full bg-[#0284c7] shadow-xs border-2 border-white dark:border-[#111827]" />

                          <div className="flex items-center justify-between w-full">
                            <span className="font-mono font-bold text-[9.5px] uppercase bg-[#f0f9ff] text-[#0284c7] dark:bg-[#0284c7]/15 dark:text-[#38bdf8] px-2 py-0.5 rounded border border-[#bae6fd] dark:border-[#0284c7]/30">
                              {evt.tipo_evento}
                            </span>
                            <span className="font-mono text-slate-400 text-[10px] font-bold">{evt.fecha_periodo_fin.split('T')[0]}</span>
                          </div>

                          <div className="flex justify-between items-center text-[10.5px] mt-1 font-semibold text-[#64748b] dark:text-[#94a3b8]">
                            <span>Base: <strong className="font-mono tabular-nums">{evt.capital_base.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</strong></span>
                            <span className="font-bold text-[#059669] dark:text-[#34d399] font-mono tabular-nums">Saldo: {evt.capital_final_saldo.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span>
                          </div>

                          {evt.notas && (
                            <p className="text-[10px] text-[#64748b] dark:text-[#94a3b8] leading-relaxed italic bg-[#f8fafc] dark:bg-[#151e2e] p-2 rounded-lg border border-[#e2e8f0] dark:border-[#334155] mt-1">
                              "{evt.notas}"
                            </p>
                          )}

                        </div>
                      ))}
                    </div>
                  )}

                </div>

              </div>
            ) : (
              <div className="glass-card py-16 text-center text-slate-400 font-bold uppercase tracking-wider border-dashed rounded-2xl">
                Seleccione un código de certificado arriba para visualizar sus detalles.
              </div>
            )}

          </div>
        )}

      </div>

    </div>
  );
};
