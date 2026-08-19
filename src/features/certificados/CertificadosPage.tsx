// src/features/certificados/CertificadosPage.tsx
import React, { useEffect, useState } from 'react';
import { 
  getCertificadosMaster, registrarAumentoCapital, getEventosDeCertificado, getAumentosCapitalHistoricos
} from '../../services/certificadosService';
import type { CertificadoMaster, AumentoCapitalHistorico } from '../../services/certificadosService';
import { supabase } from '../../services/supabaseClient';
import { generateCertificateHtml } from '../../utils/contractPreviewGenerator';
import type { CertificadoEvento } from '../../services/contratosService';
import { OmniBuscadorCertificados } from '../../components/common/OmniBuscadorCertificados';
import * as XLSX from 'xlsx';
import { 
  Loader2, AlertCircle, FileSpreadsheet, FileText, CheckCircle, Search, Upload, ChevronDown, ChevronUp, Layers, Calendar, DollarSign, ArrowUpCircle, History, User
} from 'lucide-react';

const ALPHABET = ['TODOS', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'Ñ', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', '#'];

export const CertificadosPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'vigentes' | 'aumento' | 'visor'>('vigentes');
  
  // Datos principales
  const [certificados, setCertificados] = useState<CertificadoMaster[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros Rolodex y Omni
  const [selectedLetter, setSelectedLetter] = useState<string>('TODOS');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedFondos, setSelectedFondos] = useState<string[]>([]);
  const [expandedFunds, setExpandedFunds] = useState<Record<string, boolean>>({});

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
      
      // Auto expandir todos los periodos por defecto
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
      
      // Auto expandir fondos por defecto
      const initialExp: Record<string, boolean> = {};
      data.forEach(c => {
        if (c.nombre_fondo) {
          initialExp[c.nombre_fondo] = true;
        }
      });
      setExpandedFunds(initialExp);
      
      // Cargar también histórico de aumentos
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

  // Recargar HTML del certificado y timeline cuando cambia en el visor
  useEffect(() => {
    if (selectedVisorCertId) {
      loadVisorData(selectedVisorCertId);
    } else {
      setVisorHtml('');
      setVisorEvents([]);
    }
  }, [selectedVisorCertId]);

  const loadVisorData = async (certId: string) => {
    setVisorLoading(true);
    try {
      // 1. Buscar en certificados master cargados previamente
      const masterCert = certificados.find(c => c.id_certificado === certId);

      // 2. Intentar obtener datos de crm_certificados o crm_contratos
      const { data: certData } = await supabase
        .from('crm_certificados')
        .select('*')
        .eq('id_certificado', certId)
        .maybeSingle();

      const targetContractId = certData?.id_contrato || masterCert?.id_contrato || certId;

      const { data: contractData } = await supabase
        .from('crm_contratos')
        .select('*')
        .eq('id_contrato', targetContractId)
        .maybeSingle();

      const contract = contractData || {
        monto_inversion: masterCert?.monto_inversion || 0,
        plazo_meses: masterCert?.plazo_meses || '12',
        porcentaje_reparto: 100,
        fecha_inicio: masterCert?.fecha_ultimo_evento || new Date().toISOString().split('T')[0],
        fecha_fin: new Date().toISOString().split('T')[0],
        moneda: masterCert?.moneda || 'USD',
        id_fondo: masterCert?.id_fondo || '',
        id_inversionista_1: ''
      };

      // 3. Obtener fondo
      let fundName = masterCert?.nombre_fondo || 'FONDO DE INVERSIÓN';
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

      // 4. Obtener eventos e historial
      const events = await getEventosDeCertificado(certId);
      setVisorEvents(events);
      const latestEvent = events[0] || {};

      // 5. Mapear inversionistas
      let invList: Array<{ name: string; dni: string }> = [];

      if (masterCert?.titulares_resumen && masterCert.titulares_resumen.length > 0) {
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
        invList = [{ name: masterCert?.titular_1 || 'INVERSIONISTA', dni: 'S/N' }];
      }

      // 6. Generar HTML final
      const html = generateCertificateHtml({
        investors: invList,
        fund: {
          nombre_fondo: fundName,
          ruc_fondo: fundRuc,
          moneda: contract.moneda || masterCert?.moneda || 'USD'
        },
        contract: {
          monto_inversion: contract.monto_inversion || masterCert?.monto_inversion || 0,
          plazo_meses: contract.plazo_meses || masterCert?.plazo_meses || '12',
          porcentaje_reparto: contract.porcentaje_reparto ?? 100,
          fecha_inicio: contract.fecha_inicio || new Date().toISOString().split('T')[0],
          fecha_fin: contract.fecha_fin || new Date().toISOString().split('T')[0]
        },
        logo_efi_path: '/logo.EFI.png',
        firma_path: '/Firma.Ricardo.GALLO.png',
        cert_meta: {
          fecha_emision: certData?.fecha_emision || contract.fecha_inicio || new Date().toISOString().split('T')[0],
          id_certificado: certId,
          monto_actual: latestEvent.capital_final_saldo ?? masterCert?.capital_actual ?? certData?.monto_inversion ?? 0,
          cuotas_actual: latestEvent.capital_final_saldo ?? masterCert?.capital_actual ?? certData?.monto_inversion ?? 0
        }
      });

      setVisorHtml(html);
    } catch (err: any) {
      console.error('Error al cargar visor:', err);
      setVisorHtml(`<h3>Error al cargar visor: ${err.message}</h3>`);
    } finally {
      setVisorLoading(false);
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
  // --- METRICAS GLOBALES, ROLODEX Y FILTROS -
  // ==========================================
  const uniqueFondos = Array.from(new Set(certificados.map(c => c.nombre_fondo).filter(Boolean))) as string[];

  const getLetterInitial = (name?: string) => {
    if (!name) return '#';
    const clean = name.trim().toUpperCase();
    const first = clean.charAt(0);
    if (first >= 'A' && first <= 'Z') return first;
    if (first === 'Ñ') return 'Ñ';
    return '#';
  };

  const getLetterCount = (char: string) => {
    const vigentsOnly = certificados.filter(c => c.estado === 'VIGENTE');
    if (char === 'TODOS') return vigentsOnly.length;
    if (char === '#') {
      return vigentsOnly.filter(c => getLetterInitial(c.titular_1) === '#').length;
    }
    return vigentsOnly.filter(c => getLetterInitial(c.titular_1) === char).length;
  };

  const filterCertificados = (list: CertificadoMaster[]) => {
    return list.filter(c => {
      // 1. Filtro Rolodex A-Z por Titular 1
      if (selectedLetter !== 'TODOS') {
        const initial = getLetterInitial(c.titular_1);
        if (selectedLetter === '#') {
          if (initial !== '#') return false;
        } else if (initial !== selectedLetter) {
          return false;
        }
      }

      // 2. Filtro de fondos
      if (selectedFondos.length > 0 && c.nombre_fondo) {
        if (!selectedFondos.includes(c.nombre_fondo)) return false;
      }

      // 3. Filtro OMNI de buscador
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesCertId = c.id_certificado.toLowerCase().includes(q);
        const matchesContratoId = c.id_contrato.toLowerCase().includes(q);
        const matchesTitular = [c.titular_1, c.titular_2, c.titular_3, c.titular_4].some(
          name => name?.toLowerCase().includes(q)
        );
        const matchesDoc = (c.titulares_resumen || []).some(t => t.documento?.toLowerCase().includes(q));
        
        if (!matchesCertId && !matchesContratoId && !matchesTitular && !matchesDoc) return false;
      }
      return true;
    });
  };

  const filteredCerts = filterCertificados(certificados);
  const vigentesList = filteredCerts.filter(c => c.estado === 'VIGENTE');

  // Cálculos de patrimonio
  const totalUSD = vigentesList.filter(c => c.moneda === 'USD').reduce((acc, c) => acc + (c.capital_actual || 0), 0);
  const totalPEN = vigentesList.filter(c => c.moneda === 'PEN').reduce((acc, c) => acc + (c.capital_actual || 0), 0);

  // Agrupamiento por fondo
  const groupedCerts: Record<string, CertificadoMaster[]> = {};
  vigentesList.forEach(c => {
    const fName = c.nombre_fondo || 'Sin Fondo';
    if (!groupedCerts[fName]) groupedCerts[fName] = [];
    groupedCerts[fName].push(c);
  });

  const toggleExpandFund = (fundName: string) => {
    setExpandedFunds(prev => ({ ...prev, [fundName]: !prev[fundName] }));
  };

  // ==========================================
  // --- EXPORTAR EXCEL MULTIPESTAÑAS (SheetJS)-
  // ==========================================
  const handleExportExcel = () => {
    if (vigentesList.length === 0) return;
    const wb = XLSX.utils.book_new();

    // 1. Pestaña Consolidada: Todos
    const flatList = vigentesList.map((c, idx) => ({
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

    const sumInic = vigentesList.reduce((acc, c) => acc + c.monto_inversion, 0);
    const sumAct = vigentesList.reduce((acc, c) => acc + (c.capital_actual || 0), 0);

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
    XLSX.utils.book_append_sheet(wb, wsAll, 'Todos los Certificados');

    // 2. Pestañas individuales por fondo
    const fundsInView = Array.from(new Set(vigentesList.map(c => c.id_fondo).filter(Boolean)));
    fundsInView.forEach(fId => {
      const fCerts = vigentesList.filter(c => c.id_fondo === fId);
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

    XLSX.writeFile(wb, `certificados_vigentes_multipestana_${new Date().toISOString().split('T')[0]}.xlsx`);
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
      const nuevoSaldo = (targetCert.capital_actual || 0) + aumentoMonto;

      const eventPayload: CertificadoEvento = {
        id_certificado: targetCert.id_certificado,
        id_certificado_origen: targetCert.id_certificado,
        id_contrato: targetCert.id_contrato,
        tipo_evento: 'aumento_capital',
        fecha_periodo_origen: aumentoFecha,
        fecha_periodo_fin: aumentoFecha,
        capital_base: nuevoSaldo,
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
            
            {/* Alphabetical Filter Bar (Rolodex Oficial A-Z) */}
            <div className="glass-card p-4">
              <div className="flex flex-wrap gap-2.5 items-center">
                {ALPHABET.map((char) => {
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
                        <span
                          className={`absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full text-[9px] font-black flex items-center justify-center border border-white dark:border-slate-900 ${
                            isSelected ? 'bg-[#059669] text-white' : 'bg-[#0284c7] text-white'
                          }`}
                        >
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Filtros e Hojas Excel */}
            <div className="flex flex-wrap items-center justify-between gap-4 glass-card p-4">
              <div className="flex items-center gap-3 w-full md:w-auto">
                
                {/* Omni Buscador */}
                <div className="relative w-72">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 text-slate-400">
                    <Search size={13} />
                  </span>
                  <input
                    type="text"
                    className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg py-1.5 pl-8 pr-3 text-xs font-semibold focus:outline-none placeholder:text-slate-400"
                    placeholder="Buscar por Nombre, DNI, Certificado o Contrato..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

                {/* Filtro Fondos (pills) */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {uniqueFondos.map(fName => {
                    const isSelected = selectedFondos.includes(fName);
                    return (
                      <button
                        key={fName}
                        className={`h-6 text-[8px] font-black uppercase px-2.5 rounded-full cursor-pointer transition-colors ${
                          isSelected 
                            ? 'bg-emerald-600 text-white' 
                            : 'bg-white hover:bg-slate-100 border border-slate-250 text-slate-655 dark:bg-slate-950 dark:border-slate-800 dark:text-slate-350 dark:hover:bg-slate-850'
                        }`}
                        onClick={() => {
                          if (isSelected) {
                            setSelectedFondos(prev => prev.filter(n => n !== fName));
                          } else {
                            setSelectedFondos(prev => [...prev, fName]);
                          }
                        }}
                      >
                        {fName}
                      </button>
                    );
                  })}
                  {selectedFondos.length > 0 && (
                    <button
                      className="text-[9px] font-bold text-rose-600 hover:underline cursor-pointer ml-1"
                      onClick={() => setSelectedFondos([])}
                    >
                      Limpiar
                    </button>
                  )}
                </div>

              </div>

              {/* Botón Excel consolidado */}
              <button
                className="h-9 text-xs font-bold flex items-center gap-1.5 px-3.5 rounded-lg border border-slate-250 dark:border-slate-800 bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-850 text-slate-655 dark:text-slate-300 cursor-pointer shadow-sm ml-auto"
                onClick={handleExportExcel}
                disabled={vigentesList.length === 0}
              >
                <FileSpreadsheet size={14} className="text-emerald-600" />
                <span>Descargar Excel Consolidado Multipe staña</span>
              </button>
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
                <Loader2 className="animate-spin text-emerald-600" size={35} />
                <p className="text-xs text-slate-450 dark:text-slate-500 font-bold uppercase tracking-wider">Cargando ledger de certificados...</p>
              </div>
            ) : error ? (
              <div className="max-w-md mx-auto my-12 bg-white dark:bg-slate-900 border border-rose-250 p-6 rounded-2xl text-center flex flex-col items-center gap-3">
                <AlertCircle className="text-rose-600" size={40} />
                <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase">Error</h3>
                <p className="text-xs text-slate-450 dark:text-slate-400">{error}</p>
              </div>
            ) : vigentesList.length === 0 ? (
              <div className="py-16 text-center text-slate-400 font-bold uppercase tracking-wider border border-dashed border-slate-200 dark:border-slate-850 rounded-2xl flex flex-col items-center justify-center gap-2">
                <span>No se encontraron certificados para el filtro seleccionado.</span>
                {(selectedLetter !== 'TODOS' || searchQuery || selectedFondos.length > 0) && (
                  <button
                    className="text-xs text-indigo-600 hover:underline font-black cursor-pointer"
                    onClick={() => {
                      setSelectedLetter('TODOS');
                      setSearchQuery('');
                      setSelectedFondos([]);
                    }}
                  >
                    Resetear Filtros
                  </button>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {Object.entries(groupedCerts).map(([fundName, items]) => {
                  const fUSD = items.filter(c => c.moneda === 'USD').reduce((acc, c) => acc + (c.capital_actual || 0), 0);
                  const fPEN = items.filter(c => c.moneda === 'PEN').reduce((acc, c) => acc + (c.capital_actual || 0), 0);
                  const totalStr: string[] = [];
                  if (fUSD > 0) totalStr.push(`USD ${fUSD.toLocaleString('es-PE', { minimumFractionDigits: 2 })}`);
                  if (fPEN > 0) totalStr.push(`PEN ${fPEN.toLocaleString('es-PE', { minimumFractionDigits: 2 })}`);

                  const isExpanded = !!expandedFunds[fundName];

                  return (
                    <div key={fundName} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
                      
                      {/* Cabecera Colapsable del Fondo */}
                      <button
                        className="w-full flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-950 border-b border-slate-150 dark:border-slate-850 cursor-pointer"
                        onClick={() => toggleExpandFund(fundName)}
                      >
                        <span className="text-xs font-black text-slate-850 dark:text-slate-100 uppercase tracking-tight flex items-center gap-2">
                          📌 {fundName} <span className="text-[10px] font-bold text-slate-400">({items.length} vigentes)</span>
                        </span>
                        
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase">
                            {totalStr.join(" / ")}
                          </span>
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </div>
                      </button>

                      {/* Tabla del Fondo */}
                      {isExpanded && (
                        <div className="overflow-x-auto w-full">
                          <table className="w-full text-left border-collapse text-[9px] whitespace-nowrap">
                            <thead>
                              <tr className="bg-slate-50/20 dark:bg-slate-850/10 border-b border-slate-150 dark:border-slate-800">
                                <th className="font-bold text-slate-400 dark:text-slate-500 px-4 py-2.5 uppercase">Certificado</th>
                                <th className="font-bold text-slate-400 dark:text-slate-500 px-4 py-2.5 uppercase">Titulares</th>
                                <th className="font-bold text-slate-450 dark:text-slate-500 px-4 py-2.5 uppercase text-center">Moneda</th>
                                <th className="font-bold text-slate-450 dark:text-slate-500 px-4 py-2.5 uppercase text-right">Inversión Inicial</th>
                                <th className="font-bold text-slate-450 dark:text-slate-500 px-4 py-2.5 uppercase text-right">Capital Actual</th>
                                <th className="font-bold text-slate-450 dark:text-slate-500 px-4 py-2.5 uppercase text-center">Plazo (m)</th>
                                <th className="font-bold text-slate-450 dark:text-slate-500 px-4 py-2.5 uppercase">Ult. Evento</th>
                                <th className="font-bold text-slate-450 dark:text-slate-500 px-4 py-2.5 uppercase">Fecha</th>
                                <th className="font-bold text-slate-400 dark:text-slate-500 px-4 py-2.5 uppercase text-center">Acción</th>
                              </tr>
                            </thead>
                            <tbody>
                              {items.sort((a, b) => a.id_certificado.localeCompare(b.id_certificado)).map(c => (
                                <tr key={c.id_certificado} className="border-b border-slate-100 dark:border-slate-850 hover:bg-slate-50/30 dark:hover:bg-slate-850/10">
                                  <td className="px-4 py-2 font-mono font-bold text-slate-700 dark:text-slate-300">{c.id_certificado}</td>
                                  <td className="px-4 py-2 text-slate-750 dark:text-slate-350 max-w-[220px] truncate" title={c.titulares_resumen.map(t => t.nombre).join(" y/o ")}>
                                    {c.titulares_resumen.map(t => t.nombre).join(" y/o ")}
                                  </td>
                                  <td className="px-4 py-2 text-center text-slate-600 dark:text-slate-400 font-semibold">{c.moneda}</td>
                                  <td className="px-4 py-2 text-right font-mono text-slate-700 dark:text-slate-350">{c.monto_inversion.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</td>
                                  <td className="px-4 py-2 text-right font-mono font-bold text-emerald-600 dark:text-emerald-450">{c.capital_actual?.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</td>
                                  <td className="px-4 py-2 text-center text-slate-655 dark:text-slate-400 font-semibold">{c.plazo_meses}</td>
                                  <td className="px-4 py-2">
                                    <span className="px-2 py-0.5 rounded-full font-black text-[8px] uppercase bg-slate-100 dark:bg-slate-800 text-slate-550 dark:text-slate-400">
                                      {c.ultimo_evento}
                                    </span>
                                  </td>
                                  <td className="px-4 py-2 text-slate-600 dark:text-slate-400">{c.fecha_ultimo_evento}</td>
                                  <td className="px-4 py-2 text-center">
                                    <button
                                      className="h-7 text-[8px] font-black uppercase bg-slate-100 hover:bg-emerald-50 hover:text-emerald-600 dark:bg-slate-800 dark:hover:bg-emerald-950/20 dark:hover:text-emerald-450 px-3.5 rounded cursor-pointer transition-colors"
                                      onClick={() => {
                                        setSelectedVisorCertId(c.id_certificado);
                                        setActiveTab('visor');
                                      }}
                                    >
                                      Visor
                                    </button>
                                  </td>
                                </tr>
                              ))}
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

        {/* CONTENIDO TAB 3: VISOR & LEDGER */}
        {activeTab === 'visor' && (
          <div className="flex flex-col gap-6 w-full animate-fadeIn">
            
            {/* Buscador de Certificado */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm flex flex-wrap items-center gap-3">
              <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">Seleccionar Certificado</label>
              <select
                className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none w-80"
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

              {selectedVisorCertId && visorHtml && (
                <button
                  className="h-8 text-[10px] font-black uppercase bg-blue-600 hover:bg-blue-700 text-white px-4 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer shadow ml-auto transition-colors"
                  onClick={handlePrintPdf}
                >
                  <FileText size={11} />
                  <span>Imprimir Certificado PDF</span>
                </button>
              )}
            </div>

            {selectedVisorCertId ? (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full items-start">
                
                {/* Visualizador del Certificado */}
                <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm flex flex-col gap-3">
                  <h3 className="text-xs font-black text-slate-805 dark:text-slate-150 uppercase tracking-tight border-b border-slate-100 dark:border-slate-800 pb-2">
                    📜 Documento de Certificación Oficial
                  </h3>
                  
                  {visorLoading ? (
                    <div className="flex flex-col items-center justify-center py-32 text-center gap-3">
                      <Loader2 className="animate-spin text-emerald-600" size={30} />
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Generando vista previa del documento...</p>
                    </div>
                  ) : visorHtml ? (
                    <div className="border border-slate-150 dark:border-slate-800 rounded-lg overflow-hidden bg-slate-100 p-2">
                      <iframe
                        srcDoc={visorHtml}
                        className="w-full h-[550px] bg-white border-0"
                        title="Documento Certificado Visor"
                      />
                    </div>
                  ) : (
                    <div className="py-12 text-center text-slate-400">Error al cargar la plantilla.</div>
                  )}
                </div>

                {/* Ledger de Eventos / Timeline */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm flex flex-col gap-4">
                  <h3 className="text-xs font-black text-slate-805 dark:text-slate-155 uppercase tracking-tight border-b border-slate-100 dark:border-slate-800 pb-2 flex items-center gap-1.5">
                    <Layers size={14} className="text-emerald-600" />
                    <span>Ledger Financiero (Eventos)</span>
                  </h3>

                  {visorLoading ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center gap-2">
                      <Loader2 className="animate-spin text-emerald-600" size={24} />
                    </div>
                  ) : visorEvents.length === 0 ? (
                    <div className="py-8 text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Sin eventos registrados en la base de datos.
                    </div>
                  ) : (
                    <div className="flex flex-col gap-4 pl-3 relative border-l-2 border-emerald-600/30">
                      {visorEvents.map((evt, idx) => (
                        <div key={idx} className="relative flex flex-col gap-1 text-[10px] pb-4 border-b border-slate-100 dark:border-slate-850 last:border-b-0">
                          
                          {/* Indicator dot */}
                          <div className="absolute -left-[18px] top-1.5 h-2 w-2 rounded-full bg-emerald-600 shadow-sm border border-white dark:border-slate-900" />

                          <div className="flex items-center justify-between w-full">
                            <span className="font-black text-slate-800 dark:text-slate-200 uppercase text-[9px] bg-slate-50 dark:bg-slate-950 px-2 py-0.5 rounded border border-slate-150 dark:border-slate-800">
                              {evt.tipo_evento}
                            </span>
                            <span className="font-mono text-slate-400 font-bold">{evt.fecha_periodo_fin.split('T')[0]}</span>
                          </div>

                          <div className="flex justify-between items-center text-[9px] mt-1 font-semibold text-slate-500">
                            <span>Base: {evt.capital_base.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span>
                            <span className="font-bold text-slate-700 dark:text-slate-300">Saldo: {evt.capital_final_saldo.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span>
                          </div>

                          {evt.notas && (
                            <p className="text-[9px] text-slate-400 leading-relaxed italic bg-slate-50/50 dark:bg-slate-950/20 p-2 rounded border border-slate-100 dark:border-slate-850 mt-1">
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
              <div className="py-16 text-center text-slate-400 font-bold uppercase tracking-wider border border-dashed border-slate-200 dark:border-slate-850 rounded-2xl">
                Seleccione un código de certificado arriba para visualizar sus detalles.
              </div>
            )}

          </div>
        )}

      </div>

    </div>
  );
};
