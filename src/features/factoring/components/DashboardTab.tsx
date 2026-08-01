import React, { useState, useEffect } from 'react';
import { factoringService } from '../../../services/factoringService';
import type { OperacionFactoring } from '../../../services/factoringService';
import { 
  TrendingUp, 
  DollarSign, 
  BarChart3, 
  PieChart, 
  Building2, 
  ShieldCheck, 
  Loader2
} from 'lucide-react';

export const DashboardTab: React.FC = () => {
  const [operaciones, setOperaciones] = useState<OperacionFactoring[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const loadAll = async () => {
      try {
        setLoading(true);
        const data = await factoringService.getOperaciones();
        setOperaciones(data);
      } catch (err) {
        console.error('Error al cargar datos del dashboard:', err);
      } finally {
        setLoading(false);
      }
    };
    loadAll();
  }, []);

  const totalBrutoPen = operaciones.filter(o => o.moneda === 'PEN').reduce((s, o) => s + o.monto_bruto_total, 0);
  const totalBrutoUsd = operaciones.filter(o => o.moneda === 'USD').reduce((s, o) => s + o.monto_bruto_total, 0);
  const totalInteresPen = operaciones.filter(o => o.moneda === 'PEN').reduce((s, o) => s + o.interes_total, 0);

  const countOriginado = operaciones.filter(o => o.estado === 'ORIGINADO').length;
  const countAprobado = operaciones.filter(o => o.estado === 'APROBADO').length;
  const countDesembolsado = operaciones.filter(o => o.estado === 'DESEMBOLSADO').length;
  const countLiquidado = operaciones.filter(o => o.estado === 'LIQUIDADO').length;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">Volumen Operado (PEN)</span>
            <span className="text-xl font-black text-slate-900 dark:text-white">
              S/ {totalBrutoPen.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
            </span>
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 block mt-1 font-medium">Facturas Soles</span>
          </div>
          <div className="h-10 w-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 flex items-center justify-center text-emerald-600">
            <DollarSign size={20} />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">Volumen Operado (USD)</span>
            <span className="text-xl font-black text-blue-600 dark:text-blue-400">
              $ {totalBrutoUsd.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
            </span>
            <span className="text-[11px] text-slate-400 block mt-1">Dólares Americanos</span>
          </div>
          <div className="h-10 w-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 flex items-center justify-center text-blue-600">
            <Building2 size={20} />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">Margen Ganado (PEN)</span>
            <span className="text-xl font-black text-amber-600 dark:text-amber-400">
              S/ {totalInteresPen.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
            </span>
            <span className="text-[11px] text-slate-400 block mt-1">Interés de Descuento</span>
          </div>
          <div className="h-10 w-10 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 flex items-center justify-center text-amber-600">
            <TrendingUp size={20} />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">Total Operaciones</span>
            <span className="text-2xl font-black text-slate-900 dark:text-white">{operaciones.length}</span>
            <span className="text-[11px] text-slate-400 block mt-1">Pipeline Activo</span>
          </div>
          <div className="h-10 w-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/60 flex items-center justify-center text-indigo-600">
            <BarChart3 size={20} />
          </div>
        </div>
      </div>

      {/* State Pipeline Distribution & Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Pipeline Breakdown */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-xs">
          <div className="flex items-center gap-2 mb-6">
            <PieChart className="h-5 w-5 text-emerald-600" />
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider">
              Estado de la Cartera por Pipeline
            </h3>
          </div>

          {loading ? (
            <div className="py-12 flex justify-center"><Loader2 className="animate-spin h-6 w-6 text-emerald-600" /></div>
          ) : (
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  <span>Originado / Pendiente Evaluación ({countOriginado})</span>
                  <span>{((countOriginado / (operaciones.length || 1)) * 100).toFixed(0)}%</span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500 rounded-full" style={{ width: `${(countOriginado / (operaciones.length || 1)) * 100}%` }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  <span>Aprobado / Pendiente Desembolso ({countAprobado})</span>
                  <span>{((countAprobado / (operaciones.length || 1)) * 100).toFixed(0)}%</span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(countAprobado / (operaciones.length || 1)) * 100}%` }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  <span>Desembolsado / En Cobranza ({countDesembolsado})</span>
                  <span>{((countDesembolsado / (operaciones.length || 1)) * 100).toFixed(0)}%</span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(countDesembolsado / (operaciones.length || 1)) * 100}%` }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  <span>Liquidado / Cerrado ({countLiquidado})</span>
                  <span>{((countLiquidado / (operaciones.length || 1)) * 100).toFixed(0)}%</span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${(countLiquidado / (operaciones.length || 1)) * 100}%` }}></div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Top Operations */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-xs">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-indigo-600" />
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider">
                Operaciones Recientes
              </h3>
            </div>
          </div>

          {loading ? (
            <div className="py-12 flex justify-center"><Loader2 className="animate-spin h-6 w-6 text-indigo-600" /></div>
          ) : (
            <div className="space-y-3">
              {operaciones.slice(0, 4).map(op => (
                <div key={op.id || op.proposal_id} className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg flex items-center justify-between text-xs">
                  <div>
                    <span className="font-mono font-bold text-slate-900 dark:text-slate-100 block">{op.proposal_id}</span>
                    <span className="text-slate-500 block truncate max-w-[180px]">{op.emisor_nombre}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 block">
                      {op.moneda === 'USD' ? '$' : 'S/'} {op.abono_real_total.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase">{op.estado}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
