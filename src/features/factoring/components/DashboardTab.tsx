import React, { useState, useEffect, useMemo } from 'react';
import { factoringService } from '../../../services/factoringService';
import type { OperacionFactoring } from '../../../services/factoringService';
import { InteractiveFactoringChart } from './InteractiveFactoringChart';
import { 
  TrendingUp, 
  DollarSign, 
  BarChart3, 
  PieChart, 
  Building2, 
  Loader2,
  AlertCircle
} from 'lucide-react';

export const DashboardTab: React.FC = () => {
  const [operaciones, setOperaciones] = useState<OperacionFactoring[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadAll = async () => {
      try {
        setLoading(true);
        const data = await factoringService.getOperaciones();
        setOperaciones(data || []);
      } catch (err: any) {
        console.error('Error al cargar datos del dashboard:', err);
        setError(err.message || 'Error al cargar operaciones');
      } finally {
        setLoading(false);
      }
    };
    loadAll();
  }, []);

  const totalBrutoPen = useMemo(() => {
    return operaciones.filter(o => o.moneda === 'PEN').reduce((s, o) => s + (o.monto_bruto_total || 0), 0);
  }, [operaciones]);

  const totalBrutoUsd = useMemo(() => {
    return operaciones.filter(o => o.moneda === 'USD').reduce((s, o) => s + (o.monto_bruto_total || 0), 0);
  }, [operaciones]);

  const totalInteresPen = useMemo(() => {
    return operaciones.filter(o => o.moneda === 'PEN').reduce((s, o) => s + (o.interes_total || 0), 0);
  }, [operaciones]);

  const countOriginado = operaciones.filter(o => o.estado === 'ORIGINADO').length;
  const countAprobado = operaciones.filter(o => o.estado === 'APROBADO').length;
  const countDesembolsado = operaciones.filter(o => o.estado === 'DESEMBOLSADO').length;
  const countLiquidado = operaciones.filter(o => ['LIQUIDADO', 'LIQUIDADA'].includes(o.estado)).length;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header Title */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 rounded-xl">
            <BarChart3 size={22} />
          </div>
          <div>
            <h2 className="text-base font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider">
              Dashboard de Factoring & Análisis Gráfico Interactivo
            </h2>
            <span className="text-xs text-slate-400 font-medium">
              Analítica evolutiva, indicadores de rentabilidad y proyección visual de cartera
            </span>
          </div>
        </div>
      </div>

      {/* Top Header Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">Volumen Operado (PEN)</span>
            <span className="text-xl font-black text-slate-900 dark:text-white">
              S/ {totalBrutoPen.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
              $ {totalBrutoUsd.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
              S/ {totalInteresPen.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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

      {loading ? (
        <div className="p-16 flex flex-col items-center justify-center gap-3 text-slate-400 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
          <span className="text-xs font-medium">Cargando motor de analítica gráfica...</span>
        </div>
      ) : error ? (
        <div className="p-4 bg-red-50 text-red-700 rounded-xl text-xs flex items-center gap-2">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      ) : (
        <>
          {/* MÓDULO AISLADO DE ANÁLISIS GRÁFICO ECHARTS */}
          <InteractiveFactoringChart operaciones={operaciones} />

          {/* PIPELINE BREAKDOWN DISTRIBUTION */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs">
            <div className="flex items-center gap-2 mb-6">
              <PieChart className="h-5 w-5 text-emerald-600" />
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider">
                Distribución de Cartera por Estado Financiero
              </h3>
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  <span>Originada / Evaluándose ({countOriginado})</span>
                  <span>{((countOriginado / (operaciones.length || 1)) * 100).toFixed(0)}%</span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500 rounded-full" style={{ width: `${(countOriginado / (operaciones.length || 1)) * 100}%` }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  <span>Aprobada / Listo Desembolso ({countAprobado})</span>
                  <span>{((countAprobado / (operaciones.length || 1)) * 100).toFixed(0)}%</span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(countAprobado / (operaciones.length || 1)) * 100}%` }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  <span>Desembolsada / En Cobranza ({countDesembolsado})</span>
                  <span>{((countDesembolsado / (operaciones.length || 1)) * 100).toFixed(0)}%</span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(countDesembolsado / (operaciones.length || 1)) * 100}%` }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  <span>Liquidada / Cerrada Total ({countLiquidado})</span>
                  <span>{((countLiquidado / (operaciones.length || 1)) * 100).toFixed(0)}%</span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${(countLiquidado / (operaciones.length || 1)) * 100}%` }}></div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
