// src/features/certificados/CertificadosPage.tsx
import React, { useEffect, useState } from 'react';
import { 
  getCertificadosMaster, registrarAumentoCapital, getEventosDeCertificado
} from '../../services/certificadosService';
import type { CertificadoMaster } from '../../services/certificadosService';
import { supabase } from '../../services/supabaseClient';
import { generateCertificateHtml } from '../../utils/contractPreviewGenerator';
import type { CertificadoEvento } from '../../services/contratosService';
import * as XLSX from 'xlsx';
import { 
  Loader2, AlertCircle, FileSpreadsheet, FileText, CheckCircle, Search, Upload, ChevronDown, ChevronUp, Layers
} from 'lucide-react';

export const CertificadosPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'vigentes' | 'aumento' | 'visor'>('vigentes');
  
  // Datos principales
  const [certificados, setCertificados] = useState<CertificadoMaster[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedFondos, setSelectedFondos] = useState<string[]>([]);
  const [expandedFunds, setExpandedFunds] = useState<Record<string, boolean>>({});

  // ==========================================
  // --- FORMULARIO DE AUMENTO DE CAPITAL -----
  // ==========================================
  const [aumentoOmniSearch, setAumentoOmniSearch] = useState<string>('');
  const [selectedAumentoCert, setSelectedAumentoCert] = useState<string>('');
  const [aumentoMonto, setAumentoMonto] = useState<number>(5000);
  const [aumentoFecha, setAumentoFecha] = useState<string>(new Date().toISOString().split('T')[0]);
  const [aumentoVoucherName, setAumentoVoucherName] = useState<string>('');
  const [aumentoSubmitting, setAumentoSubmitting] = useState<boolean>(false);
  const [aumentoError, setAumentoError] = useState<string | null>(null);
  const [aumentoSuccess, setAumentoSuccess] = useState<boolean>(false);

  // ==========================================
  // --- VISOR DE CERTIFICADOS & TIMELINE -----
  // ==========================================
  const [selectedVisorCertId, setSelectedVisorCertId] = useState<string>('');
  const [visorHtml, setVisorHtml] = useState<string>('');
  const [visorEvents, setVisorEvents] = useState<CertificadoEvento[]>([]);
  const [visorLoading, setVisorLoading] = useState<boolean>(false);

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
      // 1. Obtener certificado base
      const certMetaRes = await supabase
        .from('crm_certificados')
        .select('*')
        .eq('id_certificado', certId)
        .single();
      
      if (certMetaRes.error) throw certMetaRes.error;
      const certMeta = certMetaRes.data;

      // 2. Obtener contrato
      const contractRes = await supabase
        .from('crm_contratos')
        .select('*')
        .eq('id_contrato', certMeta.id_contrato)
        .single();
      
      if (contractRes.error) throw contractRes.error;
      const contract = contractRes.data;

      // 3. Obtener fondo
      const fundRes = await supabase
        .from('crm_fondos')
        .select('*')
        .eq('id_fondo', contract.id_fondo)
        .single();
      
      if (fundRes.error) throw fundRes.error;
      const fund = fundRes.data;

      // 4. Obtener eventos e historial
      const events = await getEventosDeCertificado(certId);
      setVisorEvents(events);
      const latestEvent = events[0] || {};

      // 5. Mapear inversionistas
      const investorIds = [
        contract.id_inversionista_1,
        contract.id_inversionista_2,
        contract.id_inversionista_3,
        contract.id_inversionista_4
      ].filter(Boolean);

      const { data: invRows } = await supabase
        .from('crm_inversionistas')
        .select('*')
        .in('codigo_inversionista', investorIds);

      const invList = (invRows || []).map(r => ({
        name: r.nombre_completo || r.nombre_completo_P1 || 'S/N',
        dni: r.documento_identidad || r.documento_identidad_P1 || 'S/N'
      }));

      // 6. Generar HTML final
      const html = generateCertificateHtml({
        investors: invList,
        fund: {
          nombre_fondo: fund.nombre_fondo,
          ruc_fondo: fund.ruc_fondo,
          moneda: contract.moneda
        },
        contract: {
          monto_inversion: contract.monto_inversion,
          plazo_meses: contract.plazo_meses,
          porcentaje_reparto: contract.porcentaje_reparto,
          fecha_inicio: contract.fecha_inicio,
          fecha_fin: contract.fecha_fin
        },
        logo_efi_path: '/logo.EFI.png',
        firma_path: '/Firma.Ricardo.GALLO.png',
        cert_meta: {
          fecha_emision: certMeta.fecha_emision,
          id_certificado: certId,
          monto_actual: latestEvent.capital_final_saldo ?? certMeta.monto_inversion,
          cuotas_actual: latestEvent.capital_final_saldo ?? certMeta.monto_inversion
        }
      });

      setVisorHtml(html);
    } catch (err: any) {
      console.error(err);
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
  // --- METRICAS GLOBALES Y FILTRADOS --------
  // ==========================================
  const uniqueFondos = Array.from(new Set(certificados.map(c => c.nombre_fondo).filter(Boolean))) as string[];

  const filterCertificados = (list: CertificadoMaster[]) => {
    return list.filter(c => {
      // Filtro de fondos
      if (selectedFondos.length > 0 && c.nombre_fondo) {
        if (!selectedFondos.includes(c.nombre_fondo)) return false;
      }

      // Filtro OMNI de buscador
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesCertId = c.id_certificado.toLowerCase().includes(q);
        const matchesTitular = [c.titular_1, c.titular_2, c.titular_3, c.titular_4].some(
          name => name?.toLowerCase().includes(q)
        );
        const matchesDoc = c.titulares_resumen.some(t => t.documento.includes(q));
        
        if (!matchesCertId && !matchesTitular && !matchesDoc) return false;
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

    // Agregar Fila de Totales
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
  const getAumentoOptions = () => {
    const vigentsOnly = certificados.filter(c => c.estado === 'VIGENTE');
    if (!aumentoOmniSearch.trim()) return vigentsOnly;

    const q = aumentoOmniSearch.toLowerCase();
    return vigentsOnly.filter(c => 
      c.id_certificado.toLowerCase().includes(q) ||
      [c.titular_1, c.titular_2, c.titular_3, c.titular_4].some(n => n?.toLowerCase().includes(q))
    );
  };

  const aumentoOptions = getAumentoOptions();

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
      setAumentoOmniSearch('');

      setTimeout(() => {
        setAumentoSuccess(false);
      }, 3000);
    } catch (err: any) {
      setAumentoError(err.message || 'Error al registrar aumento.');
    } finally {
      setAumentoSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full animate-fadeIn">
      
      {/* Top Header Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm flex flex-col justify-center border-l-4 border-l-emerald-600">
          <small className="text-[10px] font-black text-slate-450 dark:text-slate-400 uppercase tracking-wider">Certificados Vigentes</small>
          <span className="text-2xl font-black text-emerald-600 dark:text-emerald-450 mt-1">
            {vigentesList.length}
          </span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm flex flex-col justify-center border-l-4 border-l-blue-650 md:col-span-2">
          <small className="text-[10px] font-black text-slate-450 dark:text-slate-400 uppercase tracking-wider">Capital Total Gestionado (AUM)</small>
          <span className="text-lg font-black text-blue-650 dark:text-blue-400 mt-1">
            USD {totalUSD.toLocaleString('es-PE', { minimumFractionDigits: 2 })} <span className="text-slate-300 dark:text-slate-650">|</span> PEN {totalPEN.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-col gap-4">
        
        {/* Selector de pestañas */}
        <div className="flex gap-4 border-b border-slate-100 dark:border-slate-800/80 pb-0.5">
          {[
            { id: 'vigentes', label: '✅ Vigentes' },
            { id: 'aumento', label: '💰 Aumento de Capital' },
            { id: 'visor', label: '🖨️ Visor & Ledger' },
          ].map(tab => (
            <button
              key={tab.id}
              className={`py-2 text-[10px] font-black uppercase tracking-wider border-b-2 cursor-pointer transition-colors ${
                activeTab === tab.id 
                  ? 'border-emerald-650 text-emerald-650' 
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-400'
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
            
            {/* Filtros e Hojas Excel */}
            <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-3 w-full md:w-auto">
                
                {/* Omni Buscador */}
                <div className="relative w-64">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 text-slate-400">
                    <Search size={13} />
                  </span>
                  <input
                    type="text"
                    className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg py-1.5 pl-8 pr-3 text-xs font-semibold focus:outline-none placeholder:text-slate-400"
                    placeholder="Buscar por Nombre, DNI o Certificado..."
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
                <span>Descargar Excel Consolidado Multipesatañas</span>
              </button>
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
                <Loader2 className="animate-spin text-emerald-600" size={35} />
                <p className="text-xs text-slate-450 dark:text-slate-500 font-bold uppercase tracking-wider">Cargando ledger de certificados...</p>
              </div>
            ) : error ? (
              <div className="max-w-md mx-auto my-12 bg-white dark:bg-slate-900 border border-rose-250 p-6 rounded-2xl text-center flex flex-col items-center gap-3">
                <AlertCircle className="text-rose-650" size={40} />
                <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase">Error</h3>
                <p className="text-xs text-slate-450 dark:text-slate-400">{error}</p>
              </div>
            ) : vigentesList.length === 0 ? (
              <div className="py-16 text-center text-slate-400 font-bold uppercase tracking-wider border border-dashed border-slate-200 dark:border-slate-850 rounded-2xl">
                No hay certificados vigentes.
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
                          <span className="text-[10px] font-black text-blue-650 dark:text-blue-400 uppercase">
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

        {/* CONTENIDO TAB 2: AUMENTO DE CAPITAL */}
        {activeTab === 'aumento' && (
          <div className="flex flex-col gap-6 w-full animate-fadeIn max-w-2xl mx-auto">
            
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <h3 className="text-sm font-black text-slate-850 dark:text-slate-150 uppercase tracking-tight">💰 Ingreso de Nuevo Capital (Aumento)</h3>
                <p className="text-[11px] text-slate-450 dark:text-slate-400 leading-relaxed">
                  Permite inyectar fondos adicionales a un certificado permanente existente. Se insertará un registro de evento de inyección en el ledger financiero.
                </p>
              </div>

              {/* Buscador OMNI local */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">1. Filtrar Inversionista / Certificado Destino</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 text-slate-450">
                    <Search size={13} />
                  </span>
                  <input
                    type="text"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-lg py-2 pl-8 pr-3 text-xs font-semibold focus:outline-none placeholder:text-slate-400"
                    placeholder="Escriba DNI, Nombre o ID del certificado..."
                    value={aumentoOmniSearch}
                    onChange={(e) => setAumentoOmniSearch(e.target.value)}
                  />
                </div>
              </div>

              <form onSubmit={handleProcesarAumento} className="flex flex-col gap-4">
                
                {/* Selector Dropdown */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">2. Seleccione Certificado Destino</label>
                  <select
                    className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-xs font-semibold focus:outline-none"
                    value={selectedAumentoCert}
                    onChange={(e) => setSelectedAumentoCert(e.target.value)}
                    required
                  >
                    <option value="">-- Seleccionar Certificado --</option>
                    {aumentoOptions.map(c => (
                      <option key={c.id_certificado} value={c.id_certificado}>
                        {c.id_certificado} - {c.titular_1} ({c.moneda} {c.capital_actual?.toLocaleString('es-PE', { minimumFractionDigits: 2 })})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Monto Capital Adicional</label>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                      value={aumentoMonto}
                      onChange={(e) => setAumentoMonto(Number(e.target.value) || 0)}
                      required
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Fecha Efectiva Ingreso</label>
                    <input
                      type="date"
                      className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                      value={aumentoFecha}
                      onChange={(e) => setAumentoFecha(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Comprobante / Archivo de Aporte (Ficticio)</label>
                  <div className="flex items-center gap-3">
                    <label className="h-9 px-4 text-xs font-bold bg-white dark:bg-slate-950 hover:bg-slate-50 border border-slate-250 dark:border-slate-800 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer shadow-sm text-slate-655 dark:text-slate-300">
                      <Upload size={13} />
                      <span>Seleccionar archivo</span>
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
                      <span className="text-[10px] font-mono text-emerald-650 bg-emerald-50 dark:bg-emerald-950/20 px-2.5 py-1 rounded-md border border-emerald-100 dark:border-emerald-900 flex items-center gap-1">
                        <CheckCircle size={11} /> {aumentoVoucherName}
                      </span>
                    )}
                  </div>
                </div>

                {aumentoError && (
                  <span className="text-[11px] font-semibold text-rose-650">{aumentoError}</span>
                )}
                {aumentoSuccess && (
                  <span className="text-[11px] font-bold text-emerald-650 flex items-center gap-1">
                    <CheckCircle size={12} /> Aumento registrado con éxito en el ledger.
                  </span>
                )}

                <button
                  type="submit"
                  className="w-full h-10 text-xs font-black uppercase tracking-wider bg-emerald-650 hover:bg-emerald-700 text-white rounded-lg cursor-pointer shadow flex items-center justify-center gap-1.5 disabled:opacity-50 mt-2"
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
        )}

        {/* CONTENIDO TAB 3: VISOR & LEDGER */}
        {activeTab === 'visor' && (
          <div className="flex flex-col gap-6 w-full animate-fadeIn">
            
            {/* Buscador de Certificado */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm flex flex-wrap items-center gap-3">
              <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">Seleccionar Certificado</label>
              <select
                className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none w-64"
                value={selectedVisorCertId}
                onChange={(e) => setSelectedVisorCertId(e.target.value)}
              >
                <option value="">-- Seleccionar --</option>
                {certificados.map(c => (
                  <option key={c.id_certificado} value={c.id_certificado}>
                    {c.id_certificado} - {c.titular_1}
                  </option>
                ))}
              </select>

              {selectedVisorCertId && visorHtml && (
                <button
                  className="h-8 text-[10px] font-black uppercase bg-blue-650 hover:bg-blue-700 text-white px-4 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer shadow ml-auto transition-colors"
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
