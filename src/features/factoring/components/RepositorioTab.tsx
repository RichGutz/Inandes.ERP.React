import React, { useState, useEffect } from 'react';
import { factoringService } from '../../../services/factoringService';
import type { OperacionFactoring } from '../../../services/factoringService';
import { 
  FolderArchive, 
  Search, 
  Filter, 
  FileText, 
  Eye, 
  Loader2,
  AlertCircle
} from 'lucide-react';

export const RepositorioTab: React.FC = () => {
  const [operaciones, setOperaciones] = useState<OperacionFactoring[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filtroEstado, setFiltroEstado] = useState<string>('TODOS');
  const [selectedOp, setSelectedOp] = useState<OperacionFactoring | null>(null);

  const fetchOperaciones = async () => {
    try {
      setLoading(true);
      const data = await factoringService.getOperaciones();
      setOperaciones(data);
    } catch (err) {
      console.error('Error al cargar repositorio:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOperaciones();
  }, []);

  const filteredOps = operaciones.filter(op => {
    const matchesSearch = 
      op.proposal_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      op.emisor_nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      op.emisor_ruc.includes(searchTerm) ||
      op.aceptante_nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      op.aceptante_ruc.includes(searchTerm);
    
    const matchesState = filtroEstado === 'TODOS' || op.estado === filtroEstado;
    return matchesSearch && matchesState;
  });

  const getBadgeStyle = (estado: string) => {
    switch (estado) {
      case 'ORIGINADO': return 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200';
      case 'APROBADO': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200';
      case 'DESEMBOLSADO': return 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200';
      case 'LIQUIDADO': return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200';
      default: return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-200';
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Search and Filters Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <FolderArchive className="h-5 w-5 text-indigo-600" />
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider">
            Bóveda Digital & Repositorio de Factoring
          </h3>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input 
              type="text"
              placeholder="Buscar por N° Factura, RUC o Empresa..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-800 dark:text-slate-200"
            />
          </div>

          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-950 p-1 border border-slate-200 dark:border-slate-800 rounded-lg text-xs">
            <Filter size={14} className="text-slate-400 ml-1" />
            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
              className="bg-transparent border-none text-xs font-medium text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer pr-2"
            >
              <option value="TODOS">Todos los Estados</option>
              <option value="ORIGINADO">Originados</option>
              <option value="APROBADO">Aprobados</option>
              <option value="DESEMBOLSADO">Desembolsados</option>
              <option value="LIQUIDADO">Liquidados</option>
            </select>
          </div>
        </div>
      </div>

      {/* Operations Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center gap-3 text-slate-400">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            <span className="text-xs font-medium">Cargando repositorio histórico...</span>
          </div>
        ) : filteredOps.length === 0 ? (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
            <AlertCircle className="h-8 w-8 text-slate-300" />
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">No se encontraron operaciones registradas en el repositorio.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Código Operación</th>
                  <th className="py-3 px-4">Cedente (Emisor)</th>
                  <th className="py-3 px-4">Deudor (Aceptante)</th>
                  <th className="py-3 px-4 text-right">Monto Bruto Total</th>
                  <th className="py-3 px-4 text-right">Abono Neto</th>
                  <th className="py-3 px-4 text-center">Estado</th>
                  <th className="py-3 px-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                {filteredOps.map((op) => (
                  <tr key={op.id || op.proposal_id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-slate-100">
                      {op.proposal_id}
                    </td>
                    <td className="py-3 px-4 max-w-[200px]">
                      <span className="font-semibold text-slate-800 dark:text-slate-200 block truncate" title={op.emisor_nombre}>
                        {op.emisor_nombre}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">RUC: {op.emisor_ruc}</span>
                    </td>
                    <td className="py-3 px-4 max-w-[200px]">
                      <span className="font-semibold text-slate-800 dark:text-slate-200 block truncate" title={op.aceptante_nombre}>
                        {op.aceptante_nombre}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">RUC: {op.aceptante_ruc}</span>
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-slate-700 dark:text-slate-300">
                      {op.moneda === 'USD' ? '$' : 'S/'} {op.monto_bruto_total.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-emerald-600 dark:text-emerald-400">
                      {op.moneda === 'USD' ? '$' : 'S/'} {op.abono_real_total.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded border text-[10px] font-bold ${getBadgeStyle(op.estado)}`}>
                        {op.estado}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button 
                        onClick={() => setSelectedOp(op)}
                        className="px-2.5 py-1 text-xs font-medium text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded transition-colors flex items-center gap-1 mx-auto"
                      >
                        <Eye size={14} />
                        Detalles
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Full Detail Modal */}
      {selectedOp && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-xl animate-fadeIn">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <FileText className="h-5 w-5 text-indigo-600" />
                  Expediente de Factoring: {selectedOp.proposal_id}
                </h3>
                <p className="text-xs text-slate-500">Fecha de Registro: {selectedOp.fecha_creacion || 'Reciente'}</p>
              </div>
              <span className={`px-3 py-1 rounded-full border text-xs font-bold ${getBadgeStyle(selectedOp.estado)}`}>
                {selectedOp.estado}
              </span>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl">
                  <span className="text-slate-500 font-semibold block mb-1">EMISOR (CEDENTE)</span>
                  <div className="font-bold text-slate-900 dark:text-white">{selectedOp.emisor_nombre}</div>
                  <div className="text-slate-500 font-mono">RUC: {selectedOp.emisor_ruc}</div>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl">
                  <span className="text-slate-500 font-semibold block mb-1">ACEPTANTE (PAGADOR)</span>
                  <div className="font-bold text-slate-900 dark:text-white">{selectedOp.aceptante_nombre}</div>
                  <div className="text-slate-500 font-mono">RUC: {selectedOp.aceptante_ruc}</div>
                </div>
              </div>

              <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 rounded-xl space-y-2">
                <div className="font-bold text-emerald-800 dark:text-emerald-300 uppercase text-[11px]">Resumen Financiero Consolidado</div>
                <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                  <div>
                    <span className="text-slate-500 block text-[10px]">Monto Bruto</span>
                    <span className="font-bold text-slate-900 dark:text-white">{selectedOp.moneda === 'USD' ? '$' : 'S/'} {selectedOp.monto_bruto_total.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Interés Descuento</span>
                    <span className="font-bold text-amber-600">{selectedOp.moneda === 'USD' ? '$' : 'S/'} {selectedOp.interes_total.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Abono Real Cedente</span>
                    <span className="font-bold text-emerald-600">{selectedOp.moneda === 'USD' ? '$' : 'S/'} {selectedOp.abono_real_total.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 mt-6 pt-4 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setSelectedOp(null)}
                className="px-4 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg transition-colors"
              >
                Cerrar Expediente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
