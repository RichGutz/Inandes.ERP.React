// src/features/herramientas/EstadoPosicionPage.tsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Search, 
  FileText, 
  Download, 
  Eye, 
  Building2, 
  DollarSign, 
  AlertCircle, 
  ChevronRight, 
  ChevronDown, 
  X, 
  RefreshCw
} from 'lucide-react';
import { 
  getAllInvestorsForSearch, 
  getInvestorPositionReport, 
  type InvestorSearchResult, 
  type InvestorPositionReport 
} from '../../services/estadoPosicionService';
import { generatePdfEstadoPosicion } from '../../utils/pdfGeneratorEstadoPosicion';
import { downloadReportPdf } from '../../utils/pdfDownloadHelper';

const ALPHABET = [
  'TODOS', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
  'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', '#'
];

export const EstadoPosicionPage: React.FC = () => {
  const [investors, setInvestors] = useState<InvestorSearchResult[]>([]);
  const [loadingList, setLoadingList] = useState<boolean>(true);
  const [errorList, setErrorList] = useState<string | null>(null);

  // Filtros
  const [selectedLetter, setSelectedLetter] = useState<string>('TODOS');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Inversionista seleccionado y su reporte
  const [selectedInvestorCode, setSelectedInvestorCode] = useState<string>('');
  const [positionReport, setPositionReport] = useState<InvestorPositionReport | null>(null);
  const [loadingReport, setLoadingReport] = useState<boolean>(false);
  const [reportError, setReportError] = useState<string | null>(null);

  // Estados de exportación y modal de vista previa
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState<boolean>(false);
  const [previewHtml, setPreviewHtml] = useState<string>('');

  // Contratos expandidos en el acordeón
  const [expandedContracts, setExpandedContracts] = useState<Record<string, boolean>>({});

  const detailRef = useRef<HTMLDivElement>(null);

  // Cargar lista de inversionistas al montar
  const loadInvestors = async () => {
    try {
      setLoadingList(true);
      setErrorList(null);
      const data = await getAllInvestorsForSearch();
      setInvestors(data);

      // Si no hay seleccionado, preseleccionar el primero o si viene en query
      if (data.length > 0 && !selectedInvestorCode) {
        // Seleccionar el primero por defecto
        selectInvestor(data[0].codigo_inversionista);
      }
    } catch (err: any) {
      setErrorList(err.message || 'Error al cargar directorio de inversionistas.');
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    loadInvestors();
  }, []);

  // Cargar el reporte de posición cuando cambia el inversionista seleccionado
  const selectInvestor = async (codigo: string) => {
    setSelectedInvestorCode(codigo);
    try {
      setLoadingReport(true);
      setReportError(null);
      const rep = await getInvestorPositionReport(codigo);
      setPositionReport(rep);

      // Abrir por defecto el primer contrato
      if (rep && rep.contracts.length > 0) {
        const initialExpanded: Record<string, boolean> = {};
        rep.contracts.forEach((c, idx) => {
          initialExpanded[c.id_contrato] = idx === 0; // expandir el primero
        });
        setExpandedContracts(initialExpanded);
      }
    } catch (err: any) {
      setReportError(err.message || 'Error al obtener estado de posición.');
      setPositionReport(null);
    } finally {
      setLoadingReport(false);
    }
  };

  // Toggle contrato en el acordeón
  const toggleContract = (ctId: string) => {
    setExpandedContracts(prev => ({
      ...prev,
      [ctId]: !prev[ctId]
    }));
  };

  // Conteo por letra para el Rolodex A-Z
  const letterCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    ALPHABET.forEach(l => (counts[l] = 0));
    counts['TODOS'] = investors.length;

    investors.forEach(inv => {
      const firstChar = (inv.nombre_completo || '').trim().charAt(0).toUpperCase();
      if (/^[A-Z]$/.test(firstChar)) {
        counts[firstChar] = (counts[firstChar] || 0) + 1;
      } else {
        counts['#'] = (counts['#'] || 0) + 1;
      }
    });

    return counts;
  }, [investors]);

  // Filtrado de inversionistas por Rolodex y OmniBuscador
  const filteredInvestors = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return investors.filter(inv => {
      // 1. Filtro Rolodex
      if (selectedLetter !== 'TODOS') {
        const firstChar = (inv.nombre_completo || '').trim().charAt(0).toUpperCase();
        if (selectedLetter === '#') {
          if (/^[A-Z]$/.test(firstChar)) return false;
        } else {
          if (firstChar !== selectedLetter) return false;
        }
      }

      // 2. Filtro OmniBuscador (DNI, Nombre, Código)
      if (query) {
        const matchName = (inv.nombre_completo || '').toLowerCase().includes(query);
        const matchDoc = (inv.documento_identidad || '').toLowerCase().includes(query);
        const matchCode = (inv.codigo_inversionista || '').toLowerCase().includes(query);
        if (!matchName && !matchDoc && !matchCode) return false;
      }

      return true;
    });
  }, [investors, selectedLetter, searchQuery]);

  // Formato monetario legible
  const formatCurrency = (n: number, mon: string = 'USD') => {
    const prefix = mon === 'USD' ? '$ ' : 'S/ ';
    return `${prefix}${Number(n || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (d?: string | null) => {
    if (!d) return '-';
    const parts = d.split('T')[0].split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return d;
  };

  // Acción: Descargar PDF Oficial
  const handleDownloadPdf = async () => {
    if (!positionReport) return;
    try {
      setIsExportingPdf(true);
      const htmlDoc = generatePdfEstadoPosicion(positionReport);
      const filename = `ESTADO_POSICION_${positionReport.inversionista.documento_identidad}_${positionReport.inversionista.nombre_completo.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
      await downloadReportPdf(htmlDoc, filename, 'portrait');
    } catch (err: any) {
      alert(`Error al generar PDF: ${err.message}`);
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Acción: Abrir Vista Previa en Modal
  const handleOpenPreview = () => {
    if (!positionReport) return;
    const htmlDoc = generatePdfEstadoPosicion(positionReport);
    setPreviewHtml(htmlDoc);
    setIsPreviewModalOpen(true);
  };

  return (
    <div className="flex flex-col gap-4 w-full animate-fadeIn pb-12">
      
      {/* OMNIBUSCADOR + ROLODEX ALFABÉTICO EN UNA SOLA FILA COMPACTA */}
      <div className="glass-card p-3 rounded-2xl shadow-sm flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        {/* OMNIBUSCADOR INTEGRADO A LA IZQUIERDA */}
        <div className="w-full lg:w-80 shrink-0">
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
              <Search size={14} />
            </span>
            <input
              type="text"
              className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl py-1.5 pl-8 pr-7 text-xs font-semibold text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 shadow-2xs"
              placeholder="Buscar DNI, RUC, Nombre o Código..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* ROLODEX DE BOTONES A-Z A LA DERECHA */}
        <div className="flex flex-wrap items-center gap-1.5 flex-1 justify-start lg:justify-end">
          {ALPHABET.map(char => {
            const count = letterCounts[char] || 0;
            const isSelected = selectedLetter === char;
            const hasData = count > 0;

            return (
              <button
                key={char}
                onClick={() => setSelectedLetter(char)}
                className={`relative px-2.5 py-1 rounded-xl font-black text-xs transition-all flex items-center justify-center cursor-pointer ${
                  isSelected
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 scale-105 ring-2 ring-indigo-400'
                    : hasData
                      ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800 font-bold hover:bg-indigo-100 dark:hover:bg-indigo-900/50'
                      : 'bg-slate-100/70 text-slate-400 dark:bg-slate-800/30 dark:text-slate-600 hover:bg-slate-200/70 dark:hover:bg-slate-800/60'
                }`}
              >
                <span>{char}</span>
                {count > 0 && (
                  <span
                    className={`absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full text-[8px] font-black flex items-center justify-center border border-white dark:border-slate-900 ${
                      isSelected ? 'bg-emerald-500 text-white' : 'bg-indigo-600 text-white'
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

      {/* PANEL PRINCIPAL DE 2 COLUMNAS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        
        {/* COLUMNA IZQUIERDA: LISTA DE INVERSIONISTAS + TARJETAS DE POSICIÓN (4 COLS) */}
        <div className="lg:col-span-4 flex flex-col gap-3">

          {/* Lista scrolleable de Inversionistas */}
          <div className="glass-card p-2 rounded-2xl shadow-sm max-h-[220px] overflow-y-auto flex flex-col gap-1.5">
            {loadingList ? (
              <div className="py-8 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
                <RefreshCw size={18} className="animate-spin text-indigo-500" />
                <span>Cargando inversionistas...</span>
              </div>
            ) : errorList ? (
              <div className="p-3 text-center text-xs text-rose-500">
                {errorList}
              </div>
            ) : filteredInvestors.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                No se encontraron inversionistas.
              </div>
            ) : (
              filteredInvestors.map(inv => {
                const isSelected = selectedInvestorCode === inv.codigo_inversionista;
                return (
                  <button
                    key={inv.codigo_inversionista}
                    onClick={() => selectInvestor(inv.codigo_inversionista)}
                    className={`w-full text-left p-2.5 rounded-xl transition-all flex flex-col gap-1 cursor-pointer border ${
                      isSelected
                        ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/20 ring-2 ring-indigo-300'
                        : 'bg-white dark:bg-slate-900/60 hover:bg-slate-50 dark:hover:bg-slate-800/60 border-slate-200/80 dark:border-slate-800 text-slate-800 dark:text-slate-100'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] font-mono font-bold ${isSelected ? 'text-indigo-200' : 'text-indigo-600 dark:text-indigo-400'}`}>
                        {inv.documento_identidad}
                      </span>
                      <div className="flex items-center gap-1">
                        {inv.saldo_pen > 0 && (
                          <span className={`px-1.5 py-0.2 rounded text-[9px] font-black ${isSelected ? 'bg-sky-500/40 text-white' : 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300'}`}>
                            PEN
                          </span>
                        )}
                        {inv.saldo_usd > 0 && (
                          <span className={`px-1.5 py-0.2 rounded text-[9px] font-black ${isSelected ? 'bg-emerald-500/40 text-white' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'}`}>
                            USD
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="font-bold text-xs leading-snug line-clamp-1">
                      {inv.nombre_completo}
                    </div>

                    <div className="flex items-center justify-between text-[10px] pt-1 border-t border-slate-100 dark:border-slate-800/80">
                      <span className={isSelected ? 'text-indigo-100 font-semibold' : 'text-slate-500 font-medium'}>
                        {inv.contratos_count} contrato(s)
                      </span>
                      <div className="text-right font-black">
                        {inv.saldo_usd > 0 && (
                          <span className={isSelected ? 'text-emerald-200' : 'text-emerald-600 dark:text-emerald-400'}>
                            {formatCurrency(inv.saldo_usd, 'USD')}
                          </span>
                        )}
                        {inv.saldo_usd > 0 && inv.saldo_pen > 0 && ' · '}
                        {inv.saldo_pen > 0 && (
                          <span className={isSelected ? 'text-sky-200' : 'text-sky-600 dark:text-sky-400'}>
                            {formatCurrency(inv.saldo_pen, 'PEN')}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* INFORMACIÓN DEL PARTÍCIPE & TARJETAS DE POSICIÓN CONSOLIDADA EN COLUMNA LATERAL */}
          {positionReport && (
            <div className="flex flex-col gap-3 animate-fadeIn">
              
              {/* TARJETA COMPACTA DE IDENTIDAD DEL PARTÍCIPE */}
              <div className="glass-card p-3.5 rounded-2xl border-l-4 border-indigo-600 shadow-sm flex flex-col gap-2.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-2 border-b border-slate-100 dark:border-slate-800">
                  {/* COLUMNA 1: TITULAR Y DOCUMENTO */}
                  <div className="flex flex-col gap-1 justify-center">
                    <span className="text-[9px] font-extrabold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider block">
                      Partícipe / Titular
                    </span>
                    <h2 className="text-xs sm:text-sm font-black text-slate-900 dark:text-slate-50 leading-tight">
                      {positionReport.inversionista.nombre_completo}
                    </h2>
                    <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                      <span className="px-2 py-0.5 rounded-md text-[9px] font-black bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                        {positionReport.inversionista.tipo_doc}: {positionReport.inversionista.documento_identidad}
                      </span>
                      <span className="px-2 py-0.5 rounded-md text-[9px] font-mono font-bold bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                        {positionReport.inversionista.codigo_inversionista}
                      </span>
                    </div>
                  </div>

                  {/* COLUMNA 2: ASESOR, CONTACTO Y CUENTAS EN 2 FILAS */}
                  <div className="flex flex-col justify-between gap-1.5 text-[10px] bg-slate-50/70 dark:bg-slate-900/40 p-2 rounded-xl border border-slate-100 dark:border-slate-800/60">
                    {/* FILA 1: ASESOR & CONTACTO */}
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[8px] font-bold text-slate-400 uppercase">Asesor:</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                          {positionReport.inversionista.asesor_nombre}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-1 text-[9px] text-slate-600 dark:text-slate-400 truncate">
                        <span className="truncate">{positionReport.inversionista.email || '-'}</span>
                        <span className="font-mono font-semibold">{positionReport.inversionista.telefono || ''}</span>
                      </div>
                    </div>

                    {/* FILA 2: CUENTAS BANCARIAS */}
                    <div className="pt-1 border-t border-slate-200/60 dark:border-slate-800/60 text-[9px] text-slate-600 dark:text-slate-400">
                      <div className="flex items-center justify-between gap-1 truncate">
                        <span className="font-bold text-slate-500">PEN:</span>
                        <span className="font-mono truncate">{positionReport.inversionista.banco_pen || '-'} {positionReport.inversionista.cuenta_pen || ''}</span>
                      </div>
                      <div className="flex items-center justify-between gap-1 truncate">
                        <span className="font-bold text-slate-500">USD:</span>
                        <span className="font-mono truncate">{positionReport.inversionista.banco_usd || '-'} {positionReport.inversionista.cuenta_usd || ''}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* BOTONES DE ACCIÓN REPORTES */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={handleOpenPreview}
                    className="w-full py-1.5 px-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs hover:scale-[1.02]"
                    title="Vista Previa en Pantalla"
                  >
                    <Eye size={13} />
                    <span>Vista Previa</span>
                  </button>
                  <button
                    onClick={handleDownloadPdf}
                    disabled={isExportingPdf}
                    className="w-full py-1.5 px-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-[11px] font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm hover:scale-[1.02] disabled:opacity-50"
                    title="Descargar Reporte PDF Institucional"
                  >
                    {isExportingPdf ? (
                      <>
                        <RefreshCw size={12} className="animate-spin" />
                        <span>Generando...</span>
                      </>
                    ) : (
                      <>
                        <Download size={13} />
                        <span>Descargar PDF</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
              
              {/* TARJETA SOLES (PEN) */}
              {(positionReport.resumen_pen.contratos_total > 0 || positionReport.resumen_usd.contratos_total === 0) && (
                <div className="p-4 rounded-2xl bg-gradient-to-br from-sky-50 to-blue-50/50 dark:from-sky-950/40 dark:to-blue-950/20 border border-sky-200 dark:border-sky-800/60 shadow-sm flex flex-col gap-2.5">
                  <div className="flex items-center justify-between border-b border-sky-200/60 dark:border-sky-800/40 pb-2">
                    <span className="text-[11px] font-black text-sky-800 dark:text-sky-300 uppercase tracking-wide flex items-center gap-1.5">
                      <Building2 size={13} /> Posición Soles (PEN)
                    </span>
                    <span className="text-[10px] font-bold text-sky-600 dark:text-sky-400">
                      {positionReport.resumen_pen.contratos_activos} contrato(s)
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[9px] font-bold text-slate-500 uppercase block">Inversión Inicial</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200 text-[11px]">
                        {formatCurrency(positionReport.resumen_pen.total_inversion_inicial, 'PEN')}
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-slate-500 uppercase block">Int. Neto Acum.</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400 text-[11px]">
                        {formatCurrency(positionReport.resumen_pen.total_interes_neto, 'PEN')}
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-slate-500 uppercase block">Capitalizado</span>
                      <span className="font-bold text-blue-600 dark:text-blue-400 text-[11px]">
                        {formatCurrency(positionReport.resumen_pen.total_capitalizado, 'PEN')}
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-slate-500 uppercase block">Rescates Pagados</span>
                      <span className="font-bold text-rose-600 dark:text-rose-400 text-[11px]">
                        {formatCurrency(positionReport.resumen_pen.total_rescates, 'PEN')}
                      </span>
                    </div>
                  </div>

                  <div className="mt-0.5 pt-2 border-t-2 border-sky-300 dark:border-sky-700 flex items-center justify-between">
                    <span className="text-[11px] font-black text-sky-900 dark:text-sky-100 uppercase">Saldo al Corte:</span>
                    <span className="text-sm font-black text-sky-900 dark:text-sky-100">
                      {formatCurrency(positionReport.resumen_pen.total_capital_actual, 'PEN')}
                    </span>
                  </div>
                </div>
              )}

              {/* TARJETA DÓLARES (USD) */}
              {(positionReport.resumen_usd.contratos_total > 0 || positionReport.resumen_pen.contratos_total === 0) && (
                <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50/50 dark:from-emerald-950/40 dark:to-teal-950/20 border border-emerald-200 dark:border-emerald-800/60 shadow-sm flex flex-col gap-2.5">
                  <div className="flex items-center justify-between border-b border-emerald-200/60 dark:border-emerald-800/40 pb-2">
                    <span className="text-[11px] font-black text-emerald-800 dark:text-emerald-300 uppercase tracking-wide flex items-center gap-1.5">
                      <DollarSign size={13} /> Posición Dólares (USD)
                    </span>
                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                      {positionReport.resumen_usd.contratos_activos} contrato(s)
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[9px] font-bold text-slate-500 uppercase block">Inversión Inicial</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200 text-[11px]">
                        {formatCurrency(positionReport.resumen_usd.total_inversion_inicial, 'USD')}
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-slate-500 uppercase block">Int. Neto Acum.</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400 text-[11px]">
                        {formatCurrency(positionReport.resumen_usd.total_interes_neto, 'USD')}
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-slate-500 uppercase block">Capitalizado</span>
                      <span className="font-bold text-blue-600 dark:text-blue-400 text-[11px]">
                        {formatCurrency(positionReport.resumen_usd.total_capitalizado, 'USD')}
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-slate-500 uppercase block">Rescates Pagados</span>
                      <span className="font-bold text-rose-600 dark:text-rose-400 text-[11px]">
                        {formatCurrency(positionReport.resumen_usd.total_rescates, 'USD')}
                      </span>
                    </div>
                  </div>

                  <div className="mt-0.5 pt-2 border-t-2 border-emerald-300 dark:border-emerald-700 flex items-center justify-between">
                    <span className="text-[11px] font-black text-emerald-900 dark:text-emerald-100 uppercase">Saldo al Corte:</span>
                    <span className="text-sm font-black text-emerald-900 dark:text-emerald-100">
                      {formatCurrency(positionReport.resumen_usd.total_capital_actual, 'USD')}
                    </span>
                  </div>
                </div>
              )}

            </div>
          )}

        </div>

        {/* COLUMNA DERECHA: DESGLOSE COMPLETO DE CONTRATOS & AUDITORÍA (8 COLS) */}
        <div ref={detailRef} className="lg:col-span-8 flex flex-col gap-4">
          {loadingReport ? (
            <div className="glass-card p-16 text-center text-slate-400 rounded-2xl flex flex-col items-center justify-center gap-3">
              <RefreshCw size={28} className="animate-spin text-indigo-500" />
              <div className="text-sm font-bold text-slate-700 dark:text-slate-200">
                Extrayendo posiciones consolidadas y ledger de eventos...
              </div>
              <p className="text-xs text-slate-400">Calculando saldos contables y validando asientos en Supabase.</p>
            </div>
          ) : reportError ? (
            <div className="glass-card p-12 text-center text-rose-500 rounded-2xl flex flex-col items-center gap-3">
              <AlertCircle size={32} />
              <div className="text-sm font-bold">{reportError}</div>
            </div>
          ) : !positionReport ? (
            <div className="glass-card p-16 text-center text-slate-400 rounded-2xl flex flex-col items-center justify-center gap-3">
              <FileText size={36} className="text-slate-300" />
              <div className="text-sm font-bold">Seleccione un inversionista para visualizar su Estado de Posición</div>
            </div>
          ) : (
            <>
              {/* DESGLOSE DETALLADO DE CONTRATOS & HISTORIAL DEL LEDGER */}
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
                    <FileText size={15} className="text-indigo-500" />
                    Desglose Individual de Contratos ({positionReport.contracts.length})
                  </h3>
                  <span className="text-[11px] text-slate-400 font-medium">
                    Haga clic en un contrato para expandir u ocultar su ledger
                  </span>
                </div>

                {positionReport.contracts.map(ct => {
                  const isExpanded = !!expandedContracts[ct.id_contrato];
                  const isPen = ct.moneda === 'PEN';

                  return (
                    <div
                      key={ct.id_contrato}
                      className="glass-card rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm transition-all"
                    >
                      {/* Cabecera del Contrato (Clickeable) */}
                      <div
                        onClick={() => toggleContract(ct.id_contrato)}
                        className={`p-4 cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                          isExpanded
                            ? isPen
                              ? 'bg-sky-50 dark:bg-sky-950/40 border-b border-sky-200 dark:border-sky-800'
                              : 'bg-emerald-50 dark:bg-emerald-950/40 border-b border-emerald-200 dark:border-emerald-800'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-xl text-white font-black text-xs ${isPen ? 'bg-sky-600' : 'bg-emerald-600'}`}>
                            {ct.moneda}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-black font-mono text-slate-900 dark:text-slate-100">
                                {ct.id_contrato}
                              </span>
                              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                                · {ct.nombre_fondo}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-400 font-medium">
                              Vigencia: {formatDate(ct.fecha_inicio)} al {formatDate(ct.fecha_fin)} ({ct.plazo_meses}m) · Tasa: {ct.tasa_pactada_anual}% TEA
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <span className="text-[10px] text-slate-400 uppercase font-bold block">Saldo al Corte</span>
                            <span className="text-sm font-black text-slate-900 dark:text-slate-100">
                              {formatCurrency(ct.capital_actual, ct.moneda)}
                            </span>
                          </div>
                          <div className="text-slate-400">
                            {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                          </div>
                        </div>
                      </div>

                      {/* Cuerpo Expandido: KPIs del Contrato + Ledger + Rescates */}
                      {isExpanded && (
                        <div className="p-4 flex flex-col gap-4 bg-white/50 dark:bg-slate-950/30">
                          
                          {/* Mini Strip KPIs */}
                          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 p-3 bg-slate-50 dark:bg-slate-900/80 rounded-xl text-xs border border-slate-100 dark:border-slate-800">
                            <div>
                              <span className="text-[9px] font-bold text-slate-400 uppercase block">Inversión Inicial</span>
                              <span className="font-bold text-slate-800 dark:text-slate-200">
                                {formatCurrency(ct.monto_inversion, ct.moneda)}
                              </span>
                            </div>
                            <div>
                              <span className="text-[9px] font-bold text-slate-400 uppercase block">Tasa Pactada</span>
                              <span className="font-bold text-slate-800 dark:text-slate-200">
                                {ct.tasa_pactada_anual}% TEA
                              </span>
                            </div>
                            <div>
                              <span className="text-[9px] font-bold text-slate-400 uppercase block">Int. Neto Acum.</span>
                              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                {formatCurrency(ct.total_interes_neto, ct.moneda)}
                              </span>
                            </div>
                            <div>
                              <span className="text-[9px] font-bold text-slate-400 uppercase block">Capitalizado</span>
                              <span className="font-bold text-blue-600 dark:text-blue-400">
                                {formatCurrency(ct.total_capitalizado, ct.moneda)}
                              </span>
                            </div>
                            <div>
                              <span className="text-[9px] font-bold text-slate-400 uppercase block">Rescates Pagados</span>
                              <span className="font-bold text-rose-600 dark:text-rose-400">
                                {formatCurrency(ct.total_rescates, ct.moneda)}
                              </span>
                            </div>
                          </div>

                          {/* Tabla del Ledger */}
                          <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-xs">
                              <thead>
                                <tr className="bg-slate-900 text-white text-[10px] uppercase font-bold">
                                  <th className="p-2.5 rounded-l-lg text-center">Corte</th>
                                  <th className="p-2.5">Tipo Evento</th>
                                  <th className="p-2.5 text-center">Modalidad</th>
                                  <th className="p-2.5 text-center">TEA %</th>
                                  <th className="p-2.5 text-right">Cap. Base</th>
                                  <th className="p-2.5 text-right">Int. Neto</th>
                                  <th className="p-2.5 text-right">Capitalizado</th>
                                  <th className="p-2.5 text-right">Rescate</th>
                                  <th className="p-2.5 rounded-r-lg text-right">Saldo Final</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[11px]">
                                {ct.events.length === 0 ? (
                                  <tr>
                                    <td colSpan={9} className="p-4 text-center text-slate-400">
                                      Sin asientos de cierre contable registrados.
                                    </td>
                                  </tr>
                                ) : (
                                  ct.events.map(ev => {
                                    const isCap = (ev.modalidad_periodo || '').toUpperCase().includes('CAPITALIZA') || ev.capitalizacion_monto > 0;
                                    const hasRescate = ev.amortizacion_rescate_monto > 0;

                                    return (
                                      <tr
                                        key={ev.id_evento}
                                        className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors ${
                                          hasRescate
                                            ? 'bg-rose-50/40 dark:bg-rose-950/20'
                                            : isCap
                                              ? 'bg-blue-50/30 dark:bg-blue-950/10'
                                              : ''
                                        }`}
                                      >
                                        <td className="p-2.5 font-bold text-center text-slate-700 dark:text-slate-300">
                                          {formatDate(ev.fecha_periodo_fin)}
                                        </td>
                                        <td className="p-2.5 font-mono text-slate-600 dark:text-slate-400">
                                          {ev.tipo_evento.replace(/_/g, ' ')}
                                        </td>
                                        <td className="p-2.5 text-center">
                                          {isCap ? (
                                            <span className="px-2 py-0.5 rounded text-[9px] font-black bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                                              100% CAPITALIZACIÓN
                                            </span>
                                          ) : (
                                            <span className="px-2 py-0.5 rounded text-[9px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                              100% REPARTO
                                            </span>
                                          )}
                                        </td>
                                        <td className="p-2.5 text-center font-bold text-slate-700 dark:text-slate-300">
                                          {ev.tasa_anual_periodo}%
                                        </td>
                                        <td className="p-2.5 text-right font-medium text-slate-700 dark:text-slate-300">
                                          {formatCurrency(ev.capital_base, ct.moneda)}
                                        </td>
                                        <td className="p-2.5 text-right font-bold text-emerald-600 dark:text-emerald-400">
                                          {formatCurrency(ev.interes_neto, ct.moneda)}
                                        </td>
                                        <td className="p-2.5 text-right font-bold text-blue-600 dark:text-blue-400">
                                          {ev.capitalizacion_monto > 0 ? formatCurrency(ev.capitalizacion_monto, ct.moneda) : '-'}
                                        </td>
                                        <td className="p-2.5 text-right font-black text-rose-600 dark:text-rose-400">
                                          {ev.amortizacion_rescate_monto > 0 ? formatCurrency(ev.amortizacion_rescate_monto, ct.moneda) : '-'}
                                        </td>
                                        <td className="p-2.5 text-right font-black text-slate-900 dark:text-slate-50">
                                          {formatCurrency(ev.capital_final_saldo, ct.moneda)}
                                        </td>
                                      </tr>
                                    );
                                  })
                                )}
                              </tbody>
                            </table>
                          </div>

                          {/* Sección de Deducciones y Rescates Vinculados */}
                          {ct.rescates.length > 0 && (
                            <div className="mt-2 flex flex-col gap-2">
                              <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                                Cronograma de Deducciones / Rescates del Contrato ({ct.rescates.length})
                              </span>
                              <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse text-xs">
                                  <thead>
                                    <tr className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] uppercase font-bold">
                                      <th className="p-2 rounded-l-lg text-center">ID Cuota</th>
                                      <th className="p-2">Concepto</th>
                                      <th className="p-2 text-center">Fecha Prog.</th>
                                      <th className="p-2 text-right">Monto</th>
                                      <th className="p-2 text-center">Estado</th>
                                      <th className="p-2 rounded-r-lg text-center">Asiento</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[11px]">
                                    {ct.rescates.map(rs => (
                                      <tr key={rs.id_cuota}>
                                        <td className="p-2 font-mono font-bold text-center text-slate-600 dark:text-slate-400">
                                          {rs.id_cuota}
                                        </td>
                                        <td className="p-2 text-slate-700 dark:text-slate-300">
                                          {rs.descripcion || rs.tipo.replace(/_/g, ' ')}
                                        </td>
                                        <td className="p-2 text-center font-bold text-slate-700 dark:text-slate-300">
                                          {formatDate(rs.fecha_programada)}
                                        </td>
                                        <td className="p-2 text-right font-bold text-rose-600 dark:text-rose-400">
                                          {formatCurrency(rs.monto, rs.moneda)}
                                        </td>
                                        <td className="p-2 text-center">
                                          <span className={`px-2 py-0.5 rounded text-[9px] font-black ${
                                            rs.estado === 'APLICADO'
                                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                              : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                          }`}>
                                            {rs.estado}
                                          </span>
                                        </td>
                                        <td className="p-2 text-center text-slate-500 font-mono">
                                          {rs.id_evento_aplicado ? `#${rs.id_evento_aplicado}` : '-'}
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
                  );
                })}
              </div>
            </>
          )}
        </div>

      </div>

      {/* MODAL DE VISTA PREVIA IMPRESIÓN / PDF */}
      {isPreviewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-5xl h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950">
              <div className="flex items-center gap-2">
                <FileText size={18} className="text-indigo-600" />
                <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase">
                  Vista Previa Oficial: Estado de Posición ({positionReport?.inversionista.nombre_completo})
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDownloadPdf}
                  disabled={isExportingPdf}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Download size={14} />
                  <span>Descargar PDF</span>
                </button>
                <button
                  onClick={() => setIsPreviewModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Modal Body: Renderizado HTML en iFrame aislado */}
            <div className="flex-1 w-full bg-slate-200 dark:bg-slate-950 p-2 overflow-hidden">
              <iframe
                title="Vista Previa Estado de Posición"
                srcDoc={previewHtml}
                className="w-full h-full bg-white shadow-md rounded-lg border-0"
              />
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
