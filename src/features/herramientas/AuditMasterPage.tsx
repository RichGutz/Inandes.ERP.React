// src/features/herramientas/AuditMasterPage.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShieldCheck, 
  Search, 
  Filter, 
  ArrowRight, 
  Download, 
  Layers, 
  Eye, 
  History,
  RefreshCw
} from 'lucide-react';
import { AuditService, type AuditLogItem } from '../../services/auditService';
import * as XLSX from 'xlsx';

export const AuditMasterPage: React.FC = () => {
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedUserTab, setSelectedUserTab] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [actionFilter, setActionFilter] = useState<string>('ALL');
  const [selectedLogForModal, setSelectedLogForModal] = useState<AuditLogItem | null>(null);

  const loadAuditLogs = async () => {
    setLoading(true);
    try {
      const data = await AuditService.getAuditLogs({ limit: 300 });
      setAuditLogs(data);
    } catch (err) {
      console.error('Error al cargar logs de auditoría:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAuditLogs();
  }, []);

  // Extraer lista única de usuarios
  const usersList = useMemo(() => {
    const map = new Map<string, { email: string; name: string; role: string }>();
    auditLogs.forEach(log => {
      if (log.user_email && !map.has(log.user_email)) {
        map.set(log.user_email, {
          email: log.user_email,
          name: log.user_name || log.user_email.split('@')[0],
          role: log.user_role || 'Operador'
        });
      }
    });
    return Array.from(map.values());
  }, [auditLogs]);

  // Filtrado de logs
  const filteredLogs = useMemo(() => {
    return auditLogs.filter(log => {
      const matchesUser = selectedUserTab === 'ALL' || log.user_email.toLowerCase() === selectedUserTab.toLowerCase();
      const matchesAction = actionFilter === 'ALL' || log.action === actionFilter;
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = !searchTerm || 
        log.user_email.toLowerCase().includes(searchLower) ||
        (log.user_name && log.user_name.toLowerCase().includes(searchLower)) ||
        (log.table_name && log.table_name.toLowerCase().includes(searchLower)) ||
        (log.record_id && log.record_id.toLowerCase().includes(searchLower)) ||
        (log.metadata && JSON.stringify(log.metadata).toLowerCase().includes(searchLower));

      return matchesUser && matchesAction && matchesSearch;
    });
  }, [auditLogs, selectedUserTab, actionFilter, searchTerm]);

  // Badges por tipo de acción
  const getActionBadge = (action: string) => {
    switch (action) {
      case 'INSERT':
        return <span className="px-2 py-0.5 text-[10px] font-black rounded-md bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">INSERT</span>;
      case 'UPDATE':
        return <span className="px-2 py-0.5 text-[10px] font-black rounded-md bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800">UPDATE</span>;
      case 'DELETE':
        return <span className="px-2 py-0.5 text-[10px] font-black rounded-md bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800">DELETE</span>;
      case 'EXPORT':
      case 'EXPORT_EXCEL':
      case 'EXPORT_PDF':
        return <span className="px-2 py-0.5 text-[10px] font-black rounded-md bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-800">{action}</span>;
      case 'UPLOAD':
        return <span className="px-2 py-0.5 text-[10px] font-black rounded-md bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">UPLOAD</span>;
      case 'LOGIN':
        return <span className="px-2 py-0.5 text-[10px] font-black rounded-md bg-teal-50 dark:bg-teal-950/30 text-teal-700 dark:text-teal-400 border border-teal-200 dark:border-teal-800">LOGIN</span>;
      default:
        return <span className="px-2 py-0.5 text-[10px] font-black rounded-md bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">{action}</span>;
    }
  };

  const formatDate = (iso: string) => {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      return d.toLocaleString('es-PE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch {
      return iso;
    }
  };

  const handleExportExcel = () => {
    const formatted = filteredLogs.map(l => ({
      'ID Asiento': l.id,
      'Fecha / Hora': formatDate(l.created_at),
      'Usuario': l.user_name || l.user_email,
      'Correo': l.user_email,
      'Entidad / Tabla': l.table_name,
      'ID Registro': l.record_id,
      'Acción': l.action,
      'IP': l.ip_address || '127.0.0.1',
      'Metadatos': l.metadata ? JSON.stringify(l.metadata) : '',
      'Delta Modificaciones': l.diff_data ? JSON.stringify(l.diff_data) : ''
    }));

    const ws = XLSX.utils.json_to_sheet(formatted);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Bitacora_Auditoria');
    XLSX.writeFile(wb, `Auditoria_InAndes_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="flex-1 flex flex-col max-w-full w-full gap-6 animate-fadeIn">
      
      {/* Header Informativo */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-white dark:bg-[#111827] p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-xl text-indigo-600 dark:text-indigo-400">
            <ShieldCheck size={24} />
          </div>
          <div>
            <h2 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight">
              Bitácora de Auditoría Forense &amp; Trazabilidad
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Libro mayor inmutable de cambios transaccionales, accesos y operaciones de usuarios en InAndes ERP
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadAuditLogs}
            disabled={loading}
            className="px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Actualizar Bitácora"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>Actualizar</span>
          </button>

          <button
            onClick={handleExportExcel}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
            title="Exportar a Excel"
          >
            <Download size={13} />
            <span>Exportar Excel</span>
          </button>
        </div>
      </div>

      {/* Selector de Usuarios en Pestañas con Avatars */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-200 dark:border-slate-800 scrollbar-none">
        <button
          onClick={() => setSelectedUserTab('ALL')}
          className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
            selectedUserTab === 'ALL'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
          }`}
        >
          <Layers size={13} />
          <span>TODOS LOS USUARIOS ({auditLogs.length})</span>
        </button>

        {usersList.map(u => {
          const isSelected = selectedUserTab === u.email;
          const userCount = auditLogs.filter(l => l.user_email === u.email).length;
          const initials = u.name.substring(0, 2).toUpperCase() || 'US';

          return (
            <button
              key={u.email}
              onClick={() => setSelectedUserTab(u.email)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
                isSelected
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
              }`}
            >
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black ${
                isSelected ? 'bg-white text-indigo-700' : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300'
              }`}>
                {initials}
              </div>
              <span className="truncate max-w-[140px]">{u.name}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                isSelected ? 'bg-indigo-800 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
              }`}>
                {userCount}
              </span>
            </button>
          );
        })}
      </div>

      {/* Barra de Filtros y Búsqueda */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-white dark:bg-[#111827] p-3 rounded-2xl border border-slate-200 dark:border-slate-800">
        {/* Búsqueda */}
        <div className="relative md:col-span-2">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por usuario, entidad (crm_contratos, etc), ID de registro o detalle..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>

        {/* Filtro por Acción */}
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-slate-400 shrink-0" />
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="w-full py-2 px-3 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer"
          >
            <option value="ALL">Todas las Acciones</option>
            <option value="INSERT">INSERT (Nuevos Registros)</option>
            <option value="UPDATE">UPDATE (Modificaciones)</option>
            <option value="DELETE">DELETE (Eliminaciones)</option>
            <option value="EXPORT">EXPORT (Excel / PDF)</option>
            <option value="UPLOAD">UPLOAD (Comprobantes / Vouchers)</option>
            <option value="LOGIN">LOGIN (Inicios de Sesión)</option>
          </select>
        </div>
      </div>

      {/* Tabla Principal de Auditoría */}
      <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">
                <th className="py-3 px-4"># Asiento</th>
                <th className="py-3 px-4">Fecha / Hora</th>
                <th className="py-3 px-4">Usuario Operador</th>
                <th className="py-3 px-4">Entidad / Tabla</th>
                <th className="py-3 px-4">ID Registro</th>
                <th className="py-3 px-4 text-center">Acción</th>
                <th className="py-3 px-4">Modificaciones / Deltas</th>
                <th className="py-3 px-4 text-center">Ficha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw size={24} className="animate-spin text-indigo-500" />
                      <span className="font-bold">Cargando libro mayor de auditoría...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <History size={28} className="text-slate-300 dark:text-slate-600" />
                      <span className="font-bold text-slate-700 dark:text-slate-300">No se encontraron eventos registrados</span>
                      <span className="text-[11px] text-slate-400">Las acciones operacionales de los usuarios aparecerán aquí de forma inmutable.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                    {/* ID Asiento */}
                    <td className="py-3 px-4 font-mono font-bold text-indigo-600 dark:text-indigo-400 text-[11px]">
                      #{log.id}
                    </td>

                    {/* Fecha */}
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300 whitespace-nowrap text-[11px]">
                      <div className="font-bold">{formatDate(log.created_at)}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{log.ip_address || '127.0.0.1'}</div>
                    </td>

                    {/* Usuario */}
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900 dark:text-white">{log.user_name || log.user_email}</div>
                      <div className="text-[10px] text-slate-400 font-mono truncate max-w-[160px]">{log.user_email}</div>
                    </td>

                    {/* Entidad */}
                    <td className="py-3 px-4">
                      <span className="font-mono text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                        {log.table_name}
                      </span>
                    </td>

                    {/* ID Registro */}
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-600 dark:text-slate-400 truncate max-w-[140px]" title={log.record_id}>
                      {log.record_id}
                    </td>

                    {/* Acción */}
                    <td className="py-3 px-4 text-center">
                      {getActionBadge(log.action)}
                    </td>

                    {/* Deltas / Cambios */}
                    <td className="py-3 px-4">
                      {log.diff_data && Object.keys(log.diff_data).length > 0 ? (
                        <div className="flex flex-col gap-1 max-w-[340px]">
                          {Object.entries(log.diff_data).map(([field, delta]: [string, any]) => (
                            <div key={field} className="text-[10.5px] bg-slate-50 dark:bg-slate-900 p-1 rounded border border-slate-200 dark:border-slate-700 flex items-center gap-1.5">
                              <span className="font-bold text-slate-700 dark:text-slate-300">{field}:</span>
                              <span className="line-through text-rose-600 bg-rose-50 dark:bg-rose-950/40 px-1 rounded">
                                {String(delta.old)}
                              </span>
                              <ArrowRight size={10} className="text-slate-400 shrink-0" />
                              <span className="font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-1 rounded">
                                {String(delta.new)}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : log.metadata ? (
                        <div className="text-[10.5px] font-mono text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900 p-1.5 rounded border border-slate-200 dark:border-slate-700 truncate max-w-[340px]" title={JSON.stringify(log.metadata)}>
                          {JSON.stringify(log.metadata)}
                        </div>
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">—</span>
                      )}
                    </td>

                    {/* Botón Ver Ficha */}
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => setSelectedLogForModal(log)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded-lg transition-colors cursor-pointer"
                        title="Ver Ficha Forense Completa"
                      >
                        <Eye size={15} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Pericial de Detalle */}
      {selectedLogForModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#111827] rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 dark:border-slate-800 overflow-hidden animate-fadeIn">
            <div className="bg-[#0B2545] p-5 text-white flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/10 rounded-xl">
                  <ShieldCheck size={20} className="text-teal-400" />
                </div>
                <div>
                  <h3 className="font-bold text-base">Ficha Pericial de Auditoría #{selectedLogForModal.id}</h3>
                  <p className="text-xs text-blue-200">Trazabilidad inmutable de evento transaccional</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedLogForModal(null)}
                className="text-slate-300 hover:text-white text-lg font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
              <div className="grid grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Usuario</span>
                  <span className="font-bold text-slate-800 dark:text-white text-sm">{selectedLogForModal.user_name || selectedLogForModal.user_email}</span>
                  <span className="text-slate-500 font-mono block text-[11px]">{selectedLogForModal.user_email}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Fecha / Hora</span>
                  <span className="font-bold text-slate-800 dark:text-white">{formatDate(selectedLogForModal.created_at)}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Acción Realizada</span>
                  <div className="mt-1">{getActionBadge(selectedLogForModal.action)}</div>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Dirección IP</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 inline-block mt-1">
                    {selectedLogForModal.ip_address || '127.0.0.1 (Local)'}
                  </span>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-2">Metadatos &amp; Datos Transaccionales</h4>
                <pre className="bg-slate-900 text-emerald-400 p-4 rounded-xl font-mono text-[11px] overflow-x-auto border border-slate-800">
                  {JSON.stringify({
                    id: selectedLogForModal.id,
                    entity: selectedLogForModal.table_name,
                    record_id: selectedLogForModal.record_id,
                    action: selectedLogForModal.action,
                    user: selectedLogForModal.user_email,
                    diff: selectedLogForModal.diff_data,
                    old_data: selectedLogForModal.old_data,
                    new_data: selectedLogForModal.new_data,
                    metadata: selectedLogForModal.metadata
                  }, null, 2)}
                </pre>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900/60 p-4 border-t border-slate-200 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => setSelectedLogForModal(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold text-xs cursor-pointer transition-colors"
              >
                Cerrar Ficha
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
