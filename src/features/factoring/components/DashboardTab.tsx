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

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

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

  const isMora = (o: OperacionFactoring) => {
    const rawEst = (o.estado || '').toUpperCase();
    const fVenc = (o as any).fecha_vencimiento || (o as any).fecha_pago_calculada || (o as any).fecha_vencimiento_factura || '';
    return Boolean(fVenc && todayStr > fVenc && !rawEst.includes('LIQUIDADA') && !rawEst.includes('LIQUIDADO'));
  };

  const countOriginado = useMemo(() => operaciones.filter(o => ['ORIGINADO', 'ORIGINADA', 'ACTIVO'].includes((o.estado || '').toUpperCase())).length, [operaciones]);
  const countAprobado = useMemo(() => operaciones.filter(o => ['APROBADO', 'APROBADA'].includes((o.estado || '').toUpperCase())).length, [operaciones]);
  const countEnMora = useMemo(() => operaciones.filter(o => isMora(o)).length, [operaciones, todayStr]);
  const countDesembolsado = useMemo(() => operaciones.filter(o => ['DESEMBOLSADO', 'DESEMBOLSADA'].includes((o.estado || '').toUpperCase()) && !isMora(o)).length, [operaciones, todayStr]);
  const countEnProceso = useMemo(() => operaciones.filter(o => (o.estado || '').toUpperCase().includes('PROCESO') && !isMora(o)).length, [operaciones, todayStr]);
  const countLiquidado = useMemo(() => operaciones.filter(o => (o.estado || '').toUpperCase().includes('LIQUIDAD')).length, [operaciones]);

  const totalOps = operaciones.length || 1;

  const pctOriginado = ((countOriginado / totalOps) * 100).toFixed(1);
  const pctAprobado = ((countAprobado / totalOps) * 100).toFixed(1);
  const pctDesembolsado = ((countDesembolsado / totalOps) * 100).toFixed(1);
  const pctEnProceso = ((countEnProceso / totalOps) * 100).toFixed(1);
  const pctLiquidado = ((countLiquidado / totalOps) * 100).toFixed(1);
  const pctEnMora = ((countEnMora / totalOps) * 100).toFixed(1);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* HEADER PRINCIPAL Y BURBUJAS RESUMEN EN UNA SOLA FILA */}
      <div className="flex flex-col xl:flex-row items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
        {/* Título Izquierda */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="p-3 bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 rounded-xl">
            <BarChart3 size={24} />
          </div>
          <div>
            <h2 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider">
              Dashboard de Factoring & Análisis Gráfico Interactivo
            </h2>
            <span className="text-[11px] text-slate-400 font-medium">
              Analítica evolutiva, indicadores de rentabilidad y proyección visual de cartera
            </span>
          </div>
        </div>

        {/* Burbujas Resumen Derecha en Una Sola Fila */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Card 1: Volumen PEN */}
          <div className="flex items-center gap-2.5 px-3 py-2 bg-emerald-50/60 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 rounded-xl">
            <div className="p-1.5 bg-emerald-500 text-white rounded-lg">
              <DollarSign size={16} />
            </div>
            <div>
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Volumen (PEN)</span>
              <span className="text-xs font-black text-emerald-700 dark:text-emerald-300">
                S/ {totalBrutoPen.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Card 2: Volumen USD */}
          <div className="flex items-center gap-2.5 px-3 py-2 bg-blue-50/60 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 rounded-xl">
            <div className="p-1.5 bg-blue-500 text-white rounded-lg">
              <Building2 size={16} />
            </div>
            <div>
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Volumen (USD)</span>
              <span className="text-xs font-black text-blue-700 dark:text-blue-300">
                $ {totalBrutoUsd.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Card 3: Margen Ganado */}
          <div className="flex items-center gap-2.5 px-3 py-2 bg-amber-50/60 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-xl">
            <div className="p-1.5 bg-amber-500 text-white rounded-lg">
              <TrendingUp size={16} />
            </div>
            <div>
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Margen Ganado</span>
              <span className="text-xs font-black text-amber-700 dark:text-amber-300">
                S/ {totalInteresPen.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Card 4: Total Operaciones */}
          <div className="flex items-center gap-2.5 px-3 py-2 bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/60 rounded-xl">
            <div className="p-1.5 bg-indigo-500 text-white rounded-lg">
              <BarChart3 size={16} />
            </div>
            <div>
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Operaciones</span>
              <span className="text-xs font-black text-indigo-700 dark:text-indigo-300">
                {operaciones.length} Facturas
              </span>
            </div>
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

          {/* DISTRIBUCIÓN DE CARTERA POR ESTADO FINANCIERO (SUMA EXACTA 100%) */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <PieChart className="h-5 w-5 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider">
                  Distribución de Cartera por Estado Financiero (Total: {operaciones.length} Facturas - 100%)
                </h3>
              </div>
            </div>

            <div className="space-y-4">
              {/* Originada */}
              <div>
                <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  <span>Originada / Evaluándose ({countOriginado})</span>
                  <span>{pctOriginado}%</span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500 rounded-full" style={{ width: `${pctOriginado}%` }}></div>
                </div>
              </div>

              {/* Aprobada */}
              <div>
                <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  <span>Aprobada / Listo Desembolso ({countAprobado})</span>
                  <span>{pctAprobado}%</span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pctAprobado}%` }}></div>
                </div>
              </div>

              {/* Desembolsada */}
              <div>
                <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  <span>Desembolsada / En Cobranza Activa ({countDesembolsado})</span>
                  <span>{pctDesembolsado}%</span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pctDesembolsado}%` }}></div>
                </div>
              </div>

              {/* En Proceso de Liquidación */}
              <div>
                <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  <span>En Proceso de Liquidación Parcial ({countEnProceso})</span>
                  <span>{pctEnProceso}%</span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-purple-500 rounded-full" style={{ width: `${pctEnProceso}%` }}></div>
                </div>
              </div>

              {/* Liquidada / Cerrada */}
              <div>
                <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  <span>Liquidada / Cerrada Total ({countLiquidado})</span>
                  <span>{pctLiquidado}%</span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-600 rounded-full" style={{ width: `${pctLiquidado}%` }}></div>
                </div>
              </div>

              {/* 🔴 En Mora */}
              <div>
                <div className="flex justify-between text-xs font-bold text-red-600 dark:text-red-400 mb-1">
                  <span>🔴 Cobranza Crítica en Mora ({countEnMora})</span>
                  <span>{pctEnMora}%</span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-red-500 rounded-full" style={{ width: `${pctEnMora}%` }}></div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
