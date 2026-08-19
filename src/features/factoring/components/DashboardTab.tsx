// src/features/factoring/components/DashboardTab.tsx
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
    <div className="space-y-6">
      {/* HEADER PRINCIPAL Y BURBUJAS RESUMEN EN UNA SOLA FILA */}
      <div className="flex flex-col xl:flex-row items-center justify-between gap-4 glass-card p-4">
        {/* Título Izquierda */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-10 h-10 bg-[#f0f9ff] text-[#0284c7] dark:bg-[#0284c7]/20 dark:text-[#38bdf8] rounded-xl flex items-center justify-center border border-[#bae6fd] dark:border-[#0284c7]/40 shadow-xs">
            <BarChart3 size={20} />
          </div>
          <div>
            <h2 className="text-xs font-black text-[#0f172a] dark:text-[#f8fafc] uppercase tracking-wider">
              Dashboard de Factoring & Analítica Interactiva
            </h2>
            <span className="text-[11px] text-[#64748b] dark:text-[#94a3b8] font-semibold">
              Evolución de cartera, rentabilidad y volumen desembolsado
            </span>
          </div>
        </div>

        {/* Burbujas Resumen Derecha con Tipografía Monoespaciada y Cards Ejecutivas */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Card 1: Volumen PEN */}
          <div className="flex items-center gap-2.5 px-3.5 py-2 bg-[#ecfdf5] dark:bg-[#059669]/15 border border-[#a7f3d0] dark:border-[#059669]/30 rounded-xl shadow-xs">
            <div className="p-1.5 bg-[#059669] text-white rounded-lg">
              <DollarSign size={14} />
            </div>
            <div>
              <span className="text-[9.5px] font-black text-[#059669] dark:text-[#34d399] uppercase tracking-wider block">Volumen PEN</span>
              <span className="font-mono text-xs font-black text-[#059669] dark:text-[#34d399] tabular-nums">
                S/ {totalBrutoPen.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Card 2: Volumen USD */}
          <div className="flex items-center gap-2.5 px-3.5 py-2 bg-[#f0f9ff] dark:bg-[#0284c7]/15 border border-[#bae6fd] dark:border-[#0284c7]/30 rounded-xl shadow-xs">
            <div className="p-1.5 bg-[#0284c7] text-white rounded-lg">
              <Building2 size={14} />
            </div>
            <div>
              <span className="text-[9.5px] font-black text-[#0284c7] dark:text-[#38bdf8] uppercase tracking-wider block">Volumen USD</span>
              <span className="font-mono text-xs font-black text-[#0284c7] dark:text-[#38bdf8] tabular-nums">
                $ {totalBrutoUsd.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Card 3: Margen Ganado */}
          <div className="flex items-center gap-2.5 px-3.5 py-2 bg-[#fffbeb] dark:bg-[#d97706]/15 border border-[#fde68a] dark:border-[#d97706]/30 rounded-xl shadow-xs">
            <div className="p-1.5 bg-[#d97706] text-white rounded-lg">
              <TrendingUp size={14} />
            </div>
            <div>
              <span className="text-[9.5px] font-black text-[#d97706] dark:text-[#fbbf24] uppercase tracking-wider block">Interés Ganado</span>
              <span className="font-mono text-xs font-black text-[#d97706] dark:text-[#fbbf24] tabular-nums">
                S/ {totalInteresPen.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Card 4: Total Operaciones */}
          <div className="flex items-center gap-2.5 px-3.5 py-2 bg-[#f8fafc] dark:bg-[#1e293b] border border-[#e2e8f0] dark:border-[#334155] rounded-xl shadow-xs">
            <div className="p-1.5 bg-[#4f46e5] text-white rounded-lg">
              <BarChart3 size={14} />
            </div>
            <div>
              <span className="text-[9.5px] font-black text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wider block">Operaciones</span>
              <span className="font-mono text-xs font-black text-[#0f172a] dark:text-[#f8fafc] tabular-nums">
                {operaciones.length} Facturas
              </span>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="p-16 flex flex-col items-center justify-center gap-3 text-slate-400 glass-card">
          <Loader2 className="h-8 w-8 animate-spin text-[#0284c7]" />
          <span className="text-xs font-bold text-[#64748b]">Cargando motor de analítica gráfica...</span>
        </div>
      ) : error ? (
        <div className="p-4 bg-[#fff1f2] border border-[#fecdd3] text-[#e11d48] rounded-xl text-xs flex items-center gap-2 font-semibold">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      ) : (
        <>
          {/* MÓDULO AISLADO DE ANÁLISIS GRÁFICO ECHARTS */}
          <InteractiveFactoringChart operaciones={operaciones} />

          {/* DISTRIBUCIÓN DE CARTERA POR ESTADO FINANCIERO */}
          <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <PieChart className="h-5 w-5 text-[#0284c7]" />
                <h3 className="text-xs font-black text-[#0f172a] dark:text-[#f8fafc] uppercase tracking-wider">
                  Distribución de Cartera por Estado Financiero (Total: {operaciones.length} Facturas - 100%)
                </h3>
              </div>
            </div>

            <div className="space-y-4">
              {/* Originada */}
              <div>
                <div className="flex justify-between text-xs font-bold text-[#475569] dark:text-[#cbd5e1] mb-1">
                  <span>Originada / Evaluándose ({countOriginado})</span>
                  <span className="font-mono tabular-nums">{pctOriginado}%</span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500 rounded-full" style={{ width: `${pctOriginado}%` }}></div>
                </div>
              </div>

              {/* Aprobada */}
              <div>
                <div className="flex justify-between text-xs font-bold text-[#475569] dark:text-[#cbd5e1] mb-1">
                  <span>Aprobada / Listo Desembolso ({countAprobado})</span>
                  <span className="font-mono tabular-nums">{pctAprobado}%</span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-[#059669] rounded-full" style={{ width: `${pctAprobado}%` }}></div>
                </div>
              </div>

              {/* Desembolsada */}
              <div>
                <div className="flex justify-between text-xs font-bold text-[#475569] dark:text-[#cbd5e1] mb-1">
                  <span>Desembolsada / En Cobranza Activa ({countDesembolsado})</span>
                  <span className="font-mono tabular-nums">{pctDesembolsado}%</span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-[#0284c7] rounded-full" style={{ width: `${pctDesembolsado}%` }}></div>
                </div>
              </div>

              {/* En Proceso de Liquidación */}
              <div>
                <div className="flex justify-between text-xs font-bold text-[#475569] dark:text-[#cbd5e1] mb-1">
                  <span>En Proceso de Liquidación Parcial ({countEnProceso})</span>
                  <span className="font-mono tabular-nums">{pctEnProceso}%</span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-purple-500 rounded-full" style={{ width: `${pctEnProceso}%` }}></div>
                </div>
              </div>

              {/* Liquidada / Cerrada */}
              <div>
                <div className="flex justify-between text-xs font-bold text-[#475569] dark:text-[#cbd5e1] mb-1">
                  <span>Liquidada / Cerrada Total ({countLiquidado})</span>
                  <span className="font-mono tabular-nums">{pctLiquidado}%</span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-[#4f46e5] rounded-full" style={{ width: `${pctLiquidado}%` }}></div>
                </div>
              </div>

              {/* 🔴 En Mora */}
              <div>
                <div className="flex justify-between text-xs font-black text-[#e11d48] dark:text-[#fb7185] mb-1">
                  <span>🔴 Cobranza Crítica en Mora ({countEnMora})</span>
                  <span className="font-mono tabular-nums">{pctEnMora}%</span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-[#e11d48] rounded-full" style={{ width: `${pctEnMora}%` }}></div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
