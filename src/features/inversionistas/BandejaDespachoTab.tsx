import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../services/supabaseClient';
import ExcelJS from 'exceljs';
import { 
  Mail, Search, RefreshCw, FileSpreadsheet, CheckCircle2, 
  XCircle, Clock, ShieldCheck, Eye, X, Paperclip, 
  AlertCircle, FileText, Send
} from 'lucide-react';

export interface DespachoItem {
  id: number;
  created_at: string;
  table_name: string;
  record_id: string;
  action: string;
  user_email: string;
  metadata: {
    periodo_corte?: string;
    id_fondo?: string;
    nombre_fondo?: string;
    id_certificado?: string;
    inversionista?: string;
    tipo_doc?: string;
    dni?: string;
    destinatario_to?: string;
    copia_cc?: string;
    remitente?: string;
    asunto?: string;
    cuerpo_html?: string;
    adjuntos?: string[];
    estado?: 'ENVIADO' | 'FALLIDO';
    error_detalle?: string | null;
    canal?: string;
    moneda?: string;
    capital_final?: number;
  };
}

export const BandejaDespachoTab: React.FC = () => {
  const [despachos, setDespachos] = useState<DespachoItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [selectedPeriodo, setSelectedPeriodo] = useState<string>('TODOS');
  const [selectedFondo, setSelectedFondo] = useState<string>('TODOS');
  const [selectedEstado, setSelectedEstado] = useState<string>('TODOS');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modal de Detalle / Vista Previa del Correo
  const [previewItem, setPreviewItem] = useState<DespachoItem | null>(null);
  const [exportingExcel, setExportingExcel] = useState<boolean>(false);

  // Cargar registros de auditoría de despacho
  const fetchDespachos = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: sbError } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('action', 'DESPACHO_EMAIL')
        .order('created_at', { ascending: false })
        .limit(1000);

      if (sbError) throw sbError;
      setDespachos((data as DespachoItem[]) || []);
    } catch (err: any) {
      console.error('Error cargando historial de despachos:', err);
      setError(err.message || 'Error al conectar con la base de datos de auditoría');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDespachos();
  }, []);

  // Listas únicas de Periodos y Fondos para los dropdowns de filtrado
  const availablePeriodos = useMemo(() => {
    const setP = new Set<string>();
    despachos.forEach(d => {
      if (d.metadata?.periodo_corte) setP.add(d.metadata.periodo_corte);
    });
    return Array.from(setP).sort().reverse();
  }, [despachos]);

  const availableFondos = useMemo(() => {
    const map = new Map<string, string>();
    despachos.forEach(d => {
      const fId = d.metadata?.id_fondo;
      const fName = d.metadata?.nombre_fondo || fId;
      if (fId) map.set(fId, String(fName || fId));
    });
    return Array.from(map.entries())
      .map(([id, nombre]) => ({ id, nombre }))
      .sort((a, b) => a.id.localeCompare(b.id));
  }, [despachos]);

  // Filtrado de elementos
  const filteredDespachos = useMemo(() => {
    return despachos.filter(d => {
      const meta = d.metadata || {};
      
      // Filtro Periodo
      if (selectedPeriodo !== 'TODOS' && meta.periodo_corte !== selectedPeriodo) {
        return false;
      }
      // Filtro Fondo
      if (selectedFondo !== 'TODOS' && meta.id_fondo !== selectedFondo) {
        return false;
      }
      // Filtro Estado
      if (selectedEstado !== 'TODOS' && meta.estado !== selectedEstado) {
        return false;
      }
      // Filtro Búsqueda de Texto
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const strToSearch = `
          ${meta.inversionista || ''}
          ${meta.dni || ''}
          ${meta.id_certificado || ''}
          ${meta.destinatario_to || ''}
          ${meta.asunto || ''}
        `.toLowerCase();
        if (!strToSearch.includes(q)) return false;
      }

      return true;
    });
  }, [despachos, selectedPeriodo, selectedFondo, selectedEstado, searchQuery]);

  // Métricas KPI
  const stats = useMemo(() => {
    const total = filteredDespachos.length;
    const enviados = filteredDespachos.filter(d => (d.metadata?.estado || 'ENVIADO') === 'ENVIADO').length;
    const fallidos = total - enviados;
    const totalAdjuntos = filteredDespachos.reduce((acc, d) => acc + (d.metadata?.adjuntos?.length || 0), 0);
    const ultimoEnvio = filteredDespachos.length > 0 ? filteredDespachos[0].created_at : null;

    return { total, enviados, fallidos, totalAdjuntos, ultimoEnvio };
  }, [filteredDespachos]);

  // Exportar a Excel (ExcelJS)
  const handleExportExcel = async () => {
    if (filteredDespachos.length === 0) return;
    setExportingExcel(true);

    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'INANDES ERP';
      workbook.created = new Date();

      const worksheet = workbook.addWorksheet('Bandeja_Despacho_Correos', {
        views: [{ showGridLines: true }]
      });

      // Cabecera Principal
      worksheet.mergeCells('A1:J1');
      const titleCell = worksheet.getCell('A1');
      titleCell.value = 'INANDES GRUPO FINANCIERO — BITÁCORA INMUTABLE DE DESPACHO DE CORREOS';
      titleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
      titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0284C7' } };
      titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
      worksheet.getRow(1).height = 30;

      // Subtítulo
      worksheet.mergeCells('A2:J2');
      const subCell = worksheet.getCell('A2');
      subCell.value = `Exportado el: ${new Date().toLocaleString('es-PE')} | Total Registros: ${filteredDespachos.length} | Remitente Oficial: inversionistas@inandes.com`;
      subCell.font = { name: 'Calibri', size: 9, italic: true, color: { argb: 'FF475569' } };
      subCell.alignment = { vertical: 'middle', horizontal: 'center' };
      worksheet.getRow(2).height = 20;

      // Encabezados de Columna
      const headers = [
        'ID Log', 'Fecha / Hora (UTC)', 'Periodo de Corte', 'Fondo', 
        'Certificado', 'Partícipe / Titular', 'DNI / RUC', 'Destinatario (To)', 
        'Copia Institucional (CC)', 'Estado', 'Adjuntos Generados'
      ];
      const headerRow = worksheet.addRow(headers);
      headerRow.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
      headerRow.height = 24;

      headerRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          bottom: { style: 'medium', color: { argb: 'FF0284C7' } }
        };
      });

      // Filas de Datos
      filteredDespachos.forEach((d) => {
        const meta = d.metadata || {};
        const adjuntosStr = (meta.adjuntos || []).join('; ');
        const row = worksheet.addRow([
          d.id,
          new Date(d.created_at).toLocaleString('es-PE'),
          meta.periodo_corte || '-',
          meta.id_fondo || '-',
          meta.id_certificado || '-',
          meta.inversionista || '-',
          meta.dni || '-',
          meta.destinatario_to || '-',
          meta.copia_cc || 'inandes@outlook.es',
          meta.estado || 'ENVIADO',
          adjuntosStr
        ]);

        row.font = { name: 'Calibri', size: 9 };
        row.alignment = { vertical: 'middle' };

        // Color para el estado
        const estadoCell = row.getCell(10);
        if (meta.estado === 'FALLIDO') {
          estadoCell.font = { color: { argb: 'FFE11D48' }, bold: true };
        } else {
          estadoCell.font = { color: { argb: 'FF059669' }, bold: true };
        }
      });

      // Ajuste de Anchos
      worksheet.columns = [
        { width: 10 }, // ID Log
        { width: 22 }, // Fecha / Hora
        { width: 16 }, // Periodo
        { width: 14 }, // Fondo
        { width: 28 }, // Certificado
        { width: 34 }, // Partícipe
        { width: 14 }, // DNI
        { width: 30 }, // To
        { width: 24 }, // CC
        { width: 14 }, // Estado
        { width: 45 }  // Adjuntos
      ];

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `InAndes_Bitacora_Despacho_Correos_${new Date().toISOString().split('T')[0]}.xlsx`;
      anchor.click();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Error exportando bitácora a Excel:', err);
      alert('Error al generar Excel: ' + err.message);
    } finally {
      setExportingExcel(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full animate-fadeIn pb-12">
      
      {/* 1. TARJETAS KPI DE RESUMEN EJECUTIVO */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
        
        {/* KPI 1: Total Envíos */}
        <div className="glass-card p-4 rounded-2xl flex items-center justify-between border-l-4 border-l-[#0284c7]">
          <div className="flex flex-col">
            <span className="text-[10px] font-black uppercase tracking-wider text-[#64748b] dark:text-[#94a3b8]">
              Total Despachos
            </span>
            <span className="text-2xl font-black font-mono text-[#0f172a] dark:text-[#f8fafc] mt-0.5">
              {stats.total}
            </span>
            <span className="text-[10px] text-[#0284c7] font-bold mt-1">
              ✓ {stats.enviados} Exitosos {stats.fallidos > 0 ? `| ✗ ${stats.fallidos} Fallidos` : ''}
            </span>
          </div>
          <div className="p-3 bg-[#f0f9ff] dark:bg-[#0284c7]/15 rounded-xl text-[#0284c7] shrink-0">
            <Send size={22} />
          </div>
        </div>

        {/* KPI 2: Adjuntos Generados */}
        <div className="glass-card p-4 rounded-2xl flex items-center justify-between border-l-4 border-l-emerald-500">
          <div className="flex flex-col">
            <span className="text-[10px] font-black uppercase tracking-wider text-[#64748b] dark:text-[#94a3b8]">
              PDFs Adjuntados
            </span>
            <span className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
              {stats.totalAdjuntos}
            </span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold mt-1">
              EECC y Retenciones 2da Cat.
            </span>
          </div>
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl text-emerald-600 shrink-0">
            <Paperclip size={22} />
          </div>
        </div>

        {/* KPI 3: Remitente Oficial y CC Obligatorio */}
        <div className="glass-card p-4 rounded-2xl flex items-center justify-between border-l-4 border-l-indigo-500">
          <div className="flex flex-col min-w-0 pr-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-[#64748b] dark:text-[#94a3b8]">
              Canal de Salida
            </span>
            <span className="text-xs font-bold text-[#0f172a] dark:text-[#f8fafc] truncate mt-0.5" title="inversionistas@inandes.com">
              inversionistas@inandes.com
            </span>
            <span className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400 font-bold truncate mt-1" title="CC Obligatorio: inandes@outlook.es">
              CC: inandes@outlook.es
            </span>
          </div>
          <div className="p-3 bg-indigo-50 dark:bg-indigo-950/30 rounded-xl text-indigo-600 shrink-0">
            <ShieldCheck size={22} />
          </div>
        </div>

        {/* KPI 4: Último Despacho */}
        <div className="glass-card p-4 rounded-2xl flex items-center justify-between border-l-4 border-l-sky-400">
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] font-black uppercase tracking-wider text-[#64748b] dark:text-[#94a3b8]">
              Última Actividad
            </span>
            <span className="text-xs font-mono font-bold text-[#0f172a] dark:text-[#f8fafc] truncate mt-0.5">
              {stats.ultimoEnvio ? new Date(stats.ultimoEnvio).toLocaleString('es-PE') : 'Sin registros'}
            </span>
            <span className="text-[10px] text-sky-600 dark:text-sky-400 font-bold mt-1">
              Google Gmail API (DWD)
            </span>
          </div>
          <div className="p-3 bg-sky-50 dark:bg-sky-950/30 rounded-xl text-sky-500 shrink-0">
            <Clock size={22} />
          </div>
        </div>

      </div>

      {/* 2. BARRA DE FILTROS Y ACCIONES */}
      <div className="glass-card p-4 rounded-2xl flex flex-wrap items-center justify-between gap-4">
        
        {/* Filtros Izquierda */}
        <div className="flex flex-wrap items-center gap-3">
          
          {/* Filtro Periodo */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] uppercase whitespace-nowrap">Periodo:</span>
            <select
              value={selectedPeriodo}
              onChange={(e) => setSelectedPeriodo(e.target.value)}
              className="text-xs font-bold bg-[#f8fafc] dark:bg-[#0b0f19] border border-[#e2e8f0] dark:border-[#334155] rounded-xl px-2.5 py-1.5 text-[#0f172a] dark:text-[#f8fafc] focus:outline-none focus:border-[#0284c7] shadow-xs cursor-pointer"
            >
              <option value="TODOS">Todos los Periodos</option>
              {availablePeriodos.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          {/* Filtro Fondo */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] uppercase whitespace-nowrap">Fondo:</span>
            <select
              value={selectedFondo}
              onChange={(e) => setSelectedFondo(e.target.value)}
              className="text-xs font-bold bg-[#f8fafc] dark:bg-[#0b0f19] border border-[#e2e8f0] dark:border-[#334155] rounded-xl px-2.5 py-1.5 text-[#0f172a] dark:text-[#f8fafc] focus:outline-none focus:border-[#0284c7] shadow-xs cursor-pointer max-w-[200px]"
            >
              <option value="TODOS">Todos los Fondos</option>
              {availableFondos.map((f) => (
                <option key={f.id} value={f.id}>{f.id} - {f.nombre}</option>
              ))}
            </select>
          </div>

          {/* Filtro Estado */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] uppercase whitespace-nowrap">Estado:</span>
            <select
              value={selectedEstado}
              onChange={(e) => setSelectedEstado(e.target.value)}
              className="text-xs font-bold bg-[#f8fafc] dark:bg-[#0b0f19] border border-[#e2e8f0] dark:border-[#334155] rounded-xl px-2.5 py-1.5 text-[#0f172a] dark:text-[#f8fafc] focus:outline-none focus:border-[#0284c7] shadow-xs cursor-pointer"
            >
              <option value="TODOS">Todos</option>
              <option value="ENVIADO">✓ Enviados</option>
              <option value="FALLIDO">✗ Fallidos</option>
            </select>
          </div>

          {/* Barra de Búsqueda */}
          <div className="relative min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input
              type="text"
              className="w-full bg-[#f8fafc] dark:bg-[#0b0f19] border border-[#e2e8f0] dark:border-[#334155] rounded-xl py-1.5 pl-8 pr-3 text-xs font-semibold text-[#0f172a] dark:text-[#f8fafc] placeholder-slate-400 focus:outline-none focus:border-[#0284c7] shadow-xs"
              placeholder="Buscar partícipe, DNI, certificado..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

        </div>

        {/* Botones Derecha */}
        <div className="flex items-center gap-2">
          <button
            onClick={fetchDespachos}
            disabled={loading}
            className="px-3 py-1.5 bg-white dark:bg-[#1e293b] hover:bg-[#f0f9ff] text-[#475569] dark:text-[#cbd5e1] hover:text-[#0284c7] border border-[#e2e8f0] dark:border-[#334155] rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
            title="Recargar bitácora de auditoría"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>Recargar</span>
          </button>

          <button
            onClick={handleExportExcel}
            disabled={exportingExcel || filteredDespachos.length === 0}
            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
            title="Exportar bitácora oficial a Excel"
          >
            <FileSpreadsheet size={14} />
            <span>{exportingExcel ? 'Generando...' : 'Descargar Excel'}</span>
          </button>
        </div>

      </div>

      {/* 3. TABLA ESPEJO DE DESPACHO INMUTABLE */}
      <div className="glass-card rounded-2xl overflow-hidden border border-[#e2e8f0] dark:border-[#334155]">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-[#f1f5f9] dark:bg-[#1e293b] text-[#475569] dark:text-[#cbd5e1] font-bold text-[10.5px] uppercase border-b border-[#e2e8f0] dark:border-[#334155]">
              <tr>
                <th className="py-3 px-3 text-center">Estado / Fecha</th>
                <th className="py-3 px-3">Certificado & Fondo</th>
                <th className="py-3 px-3">Partícipe / Titular</th>
                <th className="py-3 px-3">Destinatario (To / CC)</th>
                <th className="py-3 px-3">Documentos Adjuntos</th>
                <th className="py-3 px-3 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e2e8f0] dark:divide-[#334155]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-slate-400 font-semibold">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw size={24} className="animate-spin text-[#0284c7]" />
                      <span>Cargando bitácora de despachos desde Supabase...</span>
                    </div>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-rose-500 font-semibold">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <AlertCircle size={28} />
                      <span>{error}</span>
                    </div>
                  </td>
                </tr>
              ) : filteredDespachos.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-slate-400 font-bold uppercase tracking-wider">
                    No se encontraron registros de correos despachados para los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                filteredDespachos.map((d) => {
                  const meta = d.metadata || {};
                  const isOk = (meta.estado || 'ENVIADO') === 'ENVIADO';
                  const adjuntos = meta.adjuntos || [];

                  return (
                    <tr key={d.id} className="hover:bg-[#f8fafc] dark:hover:bg-[#1e293b]/50 transition-colors">
                      
                      {/* 1. Estado y Fecha/Hora */}
                      <td className="py-3 px-3 text-center shrink-0">
                        <div className="flex flex-col items-center gap-1">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${
                            isOk 
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800' 
                              : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-800'
                          }`}>
                            {isOk ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
                            <span>{meta.estado || 'ENVIADO'}</span>
                          </span>
                          <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">
                            {new Date(d.created_at).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </span>
                          <span className="text-[9px] font-mono text-slate-400 dark:text-slate-500">
                            {new Date(d.created_at).toLocaleDateString('es-PE')}
                          </span>
                        </div>
                      </td>

                      {/* 2. Certificado & Fondo */}
                      <td className="py-3 px-3">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-mono font-bold text-xs text-[#0f172a] dark:text-[#f8fafc]">
                            {meta.id_certificado || d.record_id || 'S/C'}
                          </span>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] font-black px-1.5 py-0.5 bg-[#f0f9ff] text-[#0284c7] dark:bg-[#0284c7]/20 dark:text-[#38bdf8] rounded border border-[#bae6fd] dark:border-[#0284c7]/30">
                              {meta.id_fondo || 'FONDO'}
                            </span>
                            {meta.periodo_corte && (
                              <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                                Corte: {meta.periodo_corte}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* 3. Partícipe / Titular */}
                      <td className="py-3 px-3">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-bold text-xs text-[#0f172a] dark:text-[#f8fafc] uppercase">
                            {meta.inversionista || 'Inversionista'}
                          </span>
                          <span className="text-[10.5px] font-mono text-slate-500 dark:text-slate-400">
                            {meta.tipo_doc || 'DNI'}: {meta.dni || 'S/D'}
                          </span>
                        </div>
                      </td>

                      {/* 4. Destinatarios To & CC */}
                      <td className="py-3 px-3">
                        <div className="flex flex-col gap-1 max-w-[280px]">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] font-black uppercase text-[#0284c7] shrink-0">Para:</span>
                            <span className="text-xs font-mono font-bold text-[#0f172a] dark:text-[#f8fafc] truncate" title={meta.destinatario_to}>
                              {meta.destinatario_to || 'Sin correo'}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] font-black uppercase text-indigo-500 shrink-0">CC:</span>
                            <span className="text-[10.5px] font-mono text-slate-500 dark:text-slate-400 truncate" title={meta.copia_cc || 'inandes@outlook.es'}>
                              {meta.copia_cc || 'inandes@outlook.es'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* 5. Adjuntos */}
                      <td className="py-3 px-3">
                        <div className="flex flex-wrap gap-1.5 max-w-[260px]">
                          {adjuntos.length === 0 ? (
                            <span className="text-slate-400 italic text-[11px]">Sin adjuntos</span>
                          ) : (
                            adjuntos.map((att, idx) => {
                              const isEecc = att.startsWith('EECC_');
                              const isRet = att.startsWith('Retencion_');
                              return (
                                <span
                                  key={idx}
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold border ${
                                    isEecc 
                                      ? 'bg-sky-50 text-[#0284c7] border-sky-200 dark:bg-sky-950/30 dark:text-sky-300 dark:border-sky-800'
                                      : isRet
                                        ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800'
                                        : 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300'
                                  }`}
                                  title={att}
                                >
                                  <FileText size={10} />
                                  <span className="truncate max-w-[140px]">{att}</span>
                                </span>
                              );
                            })
                          )}
                        </div>
                      </td>

                      {/* 6. Acciones */}
                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => setPreviewItem(d)}
                          className="px-2.5 py-1.5 rounded-xl border border-[#bae6fd] dark:border-[#0284c7]/40 bg-[#f0f9ff] dark:bg-[#0284c7]/15 text-[#0284c7] dark:text-[#38bdf8] hover:bg-[#0284c7] hover:text-white transition-all text-xs font-bold flex items-center gap-1 mx-auto cursor-pointer shadow-xs"
                          title="Inspeccionar copia espejo del correo despachado"
                        >
                          <Eye size={12} />
                          <span>Ver Correo</span>
                        </button>
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. MODAL DE VISTA PREVIA FORENSE DEL CORREO EMITIDO */}
      {previewItem && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white dark:bg-[#0f172a] border border-[#bae6fd] dark:border-[#1e293b] rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[92vh]">
            
            {/* Modal Header */}
            <div className="bg-[#0284c7] px-6 py-4 flex items-center justify-between text-white shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/10 rounded-xl">
                  <Mail size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider">
                    Copia Espejo del Correo Despachado
                  </h3>
                  <p className="text-[11px] text-sky-100 font-semibold">
                    Certificado: {previewItem.metadata?.id_certificado} | Fecha: {new Date(previewItem.created_at).toLocaleString('es-PE')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewItem(null)}
                className="text-white/80 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Cabecera Técnica del Correo */}
            <div className="p-5 bg-[#f8fafc] dark:bg-[#0b0f19] border-b border-[#e2e8f0] dark:border-[#334155] flex flex-col gap-2 shrink-0">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-[10px] font-black uppercase text-[#64748b] dark:text-[#94a3b8]">De (Remitente):</span>
                  <p className="font-bold text-[#0f172a] dark:text-[#f8fafc]">
                    INANDES Inversionistas &lt;{previewItem.metadata?.remitente || 'inversionistas@inandes.com'}&gt;
                  </p>
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase text-[#64748b] dark:text-[#94a3b8]">Para (Destinatario):</span>
                  <p className="font-bold text-[#0284c7] dark:text-[#38bdf8] font-mono">
                    {previewItem.metadata?.destinatario_to}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase text-[#64748b] dark:text-[#94a3b8]">Copia Institucional (CC):</span>
                  <p className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">
                    {previewItem.metadata?.copia_cc || 'inandes@outlook.es'}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase text-[#64748b] dark:text-[#94a3b8]">Estado de Entrega:</span>
                  <p className="font-bold text-emerald-600 dark:text-emerald-400">
                    ✓ {previewItem.metadata?.estado || 'ENVIADO'} (Vía Google Workspace Gmail API)
                  </p>
                </div>
              </div>

              <div className="pt-2 border-t border-[#e2e8f0] dark:border-[#334155]">
                <span className="text-[10px] font-black uppercase text-[#64748b] dark:text-[#94a3b8]">Asunto:</span>
                <p className="font-bold text-xs text-[#0f172a] dark:text-[#f8fafc]">
                  {previewItem.metadata?.asunto}
                </p>
              </div>

              {/* Badges de Adjuntos */}
              {previewItem.metadata?.adjuntos && previewItem.metadata.adjuntos.length > 0 && (
                <div className="pt-2 border-t border-[#e2e8f0] dark:border-[#334155] flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-black uppercase text-[#64748b] dark:text-[#94a3b8] flex items-center gap-1">
                    <Paperclip size={12} /> Adjuntos ({previewItem.metadata.adjuntos.length}):
                  </span>
                  {previewItem.metadata.adjuntos.map((att, i) => (
                    <span key={i} className="px-2 py-0.5 bg-white dark:bg-[#1e293b] border border-[#cbd5e1] dark:border-[#475569] rounded text-[10px] font-mono font-bold text-[#0f172a] dark:text-[#f8fafc]">
                      📄 {att}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Render del Cuerpo HTML del Correo */}
            <div className="p-6 overflow-y-auto flex-1 bg-white dark:bg-[#0f172a]">
              <span className="text-[10px] font-black uppercase tracking-wider text-[#64748b] dark:text-[#94a3b8] mb-3 block">
                📧 Contenido Visual Embebido:
              </span>
              
              <div 
                className="border border-[#e2e8f0] dark:border-[#334155] rounded-xl p-4 bg-[#f8fafc] dark:bg-[#1e293b]/40 text-[#0f172a] dark:text-[#f8fafc] text-xs leading-relaxed"
                dangerouslySetInnerHTML={{ __html: previewItem.metadata?.cuerpo_html || '<p>No hay vista previa disponible.</p>' }}
              />
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 bg-[#f8fafc] dark:bg-[#1e293b] border-t border-[#e2e8f0] dark:border-[#334155] flex items-center justify-between shrink-0">
              <span className="text-[10px] text-slate-400 font-mono">
                Log ID #{previewItem.id} | Timestamp: {previewItem.created_at}
              </span>
              <button
                type="button"
                className="h-8 text-xs font-bold px-5 rounded-xl bg-[#0284c7] text-white hover:bg-[#0369a1] cursor-pointer transition-colors shadow-xs"
                onClick={() => setPreviewItem(null)}
              >
                Cerrar
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
