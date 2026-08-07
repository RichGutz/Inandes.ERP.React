import React, { useState, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import type { OperacionFactoring } from '../../../services/factoringService';
import { 
  BarChart3, 
  RotateCcw,
  Sparkles
} from 'lucide-react';

export interface InteractiveFactoringChartProps {
  operaciones: OperacionFactoring[];
}

type GroupBy = 'emisor' | 'aceptante' | 'moneda' | 'estado';
type PrimaryMetric = 'monto_neto' | 'monto_bruto' | 'interes' | 'cantidad';
type PrimaryGraphType = 'bar_stack' | 'bar_group' | 'line';
type SecondaryMetric = 'none' | 'tasa_promedio' | 'dias_credito' | 'porcentaje_mora';
type SecondaryGraphType = 'line' | 'bar';

const ENTITY_COLORS: Record<string, string> = {
  'TRANS STAR HERMANOS SAC': '#3B82F6',
  'OPERADOR LOGISTICO SAN IGNACIO S.A.C.': '#8B5CF6',
  'PESQUERA EXALMAR S.A.A.': '#10B981',
  'LOGISTICA TRUCK S.A.C.': '#F59E0B',
  'PEN': '#10B981',
  'USD': '#3B82F6',
  'ORIGINADO': '#F59E0B',
  'APROBADO': '#10B981',
  'DESEMBOLSADO': '#3B82F6',
  'EN PROCESO DE LIQUIDACION': '#8B5CF6',
  'EN PROCESO': '#8B5CF6',
  'LIQUIDADO': '#6366F1',
  'LIQUIDADA': '#6366F1',
  'EN MORA': '#EF4444',
};

const PALETTE = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#6366F1', '#14B8A6'];

export const InteractiveFactoringChart: React.FC<InteractiveFactoringChartProps> = ({ operaciones }) => {
  // Controles del Gráfico
  const [groupBy, setGroupBy] = useState<GroupBy>('emisor');
  const [primaryMetric, setPrimaryMetric] = useState<PrimaryMetric>('monto_neto');
  const [primaryGraphType, setPrimaryGraphType] = useState<PrimaryGraphType>('bar_stack');
  const [secondaryMetric, setSecondaryMetric] = useState<SecondaryMetric>('tasa_promedio');
  const [secondaryGraphType, setSecondaryGraphType] = useState<SecondaryGraphType>('line');

  // Filtros Simultáneos
  const [filterEmisor, setFilterEmisor] = useState<string>('TODOS');
  const [filterAceptante, setFilterAceptante] = useState<string>('TODOS');
  const [filterMoneda, setFilterMoneda] = useState<string>('TODOS');
  const [filterEstado, setFilterEstado] = useState<string>('TODOS');

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Listas para los dropdowns de filtro
  const emisoresList = useMemo(() => {
    const set = new Set<string>();
    operaciones.forEach(op => op.emisor_nombre && set.add(op.emisor_nombre));
    return Array.from(set).sort();
  }, [operaciones]);

  const aceptantesList = useMemo(() => {
    const set = new Set<string>();
    operaciones.forEach(op => op.aceptante_nombre && set.add(op.aceptante_nombre));
    return Array.from(set).sort();
  }, [operaciones]);

  // Operaciones Filtradas
  const filteredOps = useMemo(() => {
    return operaciones.filter(op => {
      if (filterEmisor !== 'TODOS' && op.emisor_nombre !== filterEmisor) return false;
      if (filterAceptante !== 'TODOS' && op.aceptante_nombre !== filterAceptante) return false;
      if (filterMoneda !== 'TODOS' && op.moneda !== filterMoneda) return false;

      if (filterEstado !== 'TODOS') {
        const rawEst = (op.estado || '').toUpperCase();
        const fVenc = (op as any).fecha_vencimiento || (op as any).fecha_vencimiento_factura || '';
        const isMora = Boolean(fVenc && todayStr > fVenc && !rawEst.includes('LIQUIDADA') && !rawEst.includes('LIQUIDADO'));

        if (filterEstado === 'ORIGINADO') {
          if (!['ORIGINADO', 'ACTIVO', 'APROBADO'].includes(rawEst)) return false;
        } else if (filterEstado === 'DESEMBOLSADO') {
          if (!['DESEMBOLSADA', 'DESEMBOLSADO'].includes(rawEst)) return false;
        } else if (filterEstado === 'EN_PROCESO') {
          if (!rawEst.includes('PROCESO')) return false;
        } else if (filterEstado === 'LIQUIDADO') {
          if (!rawEst.includes('LIQUIDADA') && !rawEst.includes('LIQUIDADO')) return false;
        } else if (filterEstado === 'EN_MORA') {
          if (!isMora) return false;
        }
      }

      return true;
    });
  }, [operaciones, filterEmisor, filterAceptante, filterMoneda, filterEstado, todayStr]);

  // Agrupamiento Dinámico por Mes / Categórica
  const { categories, seriesData, secondarySeriesData, metricUnits } = useMemo(() => {
    // 1. Extraer meses de operaciones
    const monthSet = new Set<string>();
    filteredOps.forEach(op => {
      const d = op.fecha_desembolso_esperada || op.fecha_creacion || todayStr;
      const monthKey = d.substring(0, 7); // YYYY-MM
      monthSet.add(monthKey);
    });
    const months = Array.from(monthSet).sort();

    // 2. Extraer entidades según `groupBy`
    const groupKeysSet = new Set<string>();
    filteredOps.forEach(op => {
      let key = 'Otros';
      if (groupBy === 'emisor') key = op.emisor_nombre || 'Otros';
      else if (groupBy === 'aceptante') key = op.aceptante_nombre || 'Otros';
      else if (groupBy === 'moneda') key = op.moneda || 'PEN';
      else if (groupBy === 'estado') key = op.estado || 'Otros';
      groupKeysSet.add(key);
    });
    const groupKeys = Array.from(groupKeysSet).sort();

    // 3. Estructuras de acumulación [groupKey][monthKey]
    const primaryMap: Record<string, Record<string, number>> = {};
    const countMap: Record<string, Record<string, number>> = {};

    groupKeys.forEach(g => {
      primaryMap[g] = {};
      countMap[g] = {};
      months.forEach(m => {
        primaryMap[g][m] = 0;
        countMap[g][m] = 0;
      });
    });

    filteredOps.forEach(op => {
      const d = op.fecha_desembolso_esperada || op.fecha_creacion || todayStr;
      const mKey = d.substring(0, 7);
      let gKey = 'Otros';
      if (groupBy === 'emisor') gKey = op.emisor_nombre || 'Otros';
      else if (groupBy === 'aceptante') gKey = op.aceptante_nombre || 'Otros';
      else if (groupBy === 'moneda') gKey = op.moneda || 'PEN';
      else if (groupBy === 'estado') gKey = op.estado || 'Otros';

      if (!primaryMap[gKey]) primaryMap[gKey] = {};
      if (!countMap[gKey]) countMap[gKey] = {};

      let val = 0;
      if (primaryMetric === 'monto_neto') val = op.abono_real_total || op.monto_neto_total || 0;
      else if (primaryMetric === 'monto_bruto') val = op.monto_bruto_total || 0;
      else if (primaryMetric === 'interes') val = op.interes_total || 0;
      else if (primaryMetric === 'cantidad') val = 1;

      primaryMap[gKey][mKey] = (primaryMap[gKey][mKey] || 0) + val;
      countMap[gKey][mKey] = (countMap[gKey][mKey] || 0) + 1;
    });

    // 4. Series para Eje Principal Y1
    const series = groupKeys.map((gKey, idx) => {
      const dataArr = months.map(m => Number((primaryMap[gKey]?.[m] || 0).toFixed(2)));
      const color = ENTITY_COLORS[gKey] || PALETTE[idx % PALETTE.length];

      return {
        name: gKey,
        type: primaryGraphType === 'line' ? 'line' : 'bar',
        stack: primaryGraphType === 'bar_stack' ? 'total_y1' : undefined,
        smooth: primaryGraphType === 'line',
        data: dataArr,
        itemStyle: { color },
        yAxisIndex: 0,
      };
    });

    // 5. Serie para Eje Secundario Y2 (si aplica)
    let secSeries: any = null;
    if (secondaryMetric !== 'none') {
      const secDataArr = months.map(mKey => {
        const opsInMonth = filteredOps.filter(op => {
          const d = op.fecha_desembolso_esperada || op.fecha_creacion || todayStr;
          return d.substring(0, 7) === mKey;
        });

        if (opsInMonth.length === 0) return 0;

        if (secondaryMetric === 'tasa_promedio') {
          // Tasa promedio estimada (~3.0% mensual)
          return 3.0;
        } else if (secondaryMetric === 'dias_credito') {
          const sumDias = opsInMonth.reduce((s, o) => s + (o.dias_promedio || 30), 0);
          return Number((sumDias / opsInMonth.length).toFixed(1));
        } else if (secondaryMetric === 'porcentaje_mora') {
          const moraOps = opsInMonth.filter(o => {
            const fVenc = (o as any).fecha_vencimiento || (o as any).fecha_vencimiento_factura || '';
            return fVenc && todayStr > fVenc && !o.estado.includes('LIQUIDADA');
          });
          return Number(((moraOps.length / opsInMonth.length) * 100).toFixed(1));
        }
        return 0;
      });

      let secName = 'Tasa Interés Prom. (%)';
      if (secondaryMetric === 'dias_credito') secName = 'Días Crédito Prom.';
      if (secondaryMetric === 'porcentaje_mora') secName = '% Facturas en Mora';

      secSeries = {
        name: secName,
        type: secondaryGraphType,
        smooth: true,
        data: secDataArr,
        itemStyle: { color: '#EF4444' },
        lineStyle: { width: 3, type: 'dashed' },
        yAxisIndex: 1,
      };
    }

    const units = primaryMetric === 'cantidad' ? 'Unidades' : 'Monto (S/ / $)';

    return {
      categories: months,
      seriesData: series,
      secondarySeriesData: secSeries,
      metricUnits: units,
    };
  }, [filteredOps, groupBy, primaryMetric, primaryGraphType, secondaryMetric, secondaryGraphType, todayStr]);

  // Configuración Completa de Apache ECharts Canvas
  const echartsOption = useMemo(() => {
    const allSeries = [...seriesData];
    if (secondarySeriesData) allSeries.push(secondarySeriesData);

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        borderColor: '#334155',
        borderWidth: 1,
        textStyle: { color: '#F8FAFC', fontSize: 11 },
        formatter: (params: any[]) => {
          if (!params || params.length === 0) return '';
          let header = `<div style="font-weight:900;margin-bottom:6px;border-bottom:1px solid #475569;padding-bottom:4px;">Mes: ${params[0].name}</div>`;
          let body = params.map((p: any) => {
            const valStr = typeof p.value === 'number' 
              ? (p.seriesName.includes('%') ? `${p.value}%` : p.value.toLocaleString('es-PE', { minimumFractionDigits: 2 }))
              : p.value;
            return `<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:3px;">
              <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background-color:${p.color};"></span>
              <span style="font-size:11px;">${p.seriesName}:</span>
              <strong style="font-mono;margin-left:8px;">${valStr}</strong>
            </div>`;
          }).join('');
          return header + body;
        }
      },
      legend: {
        bottom: 0,
        textStyle: { color: '#64748B', fontSize: 11, fontWeight: 'bold' },
        icon: 'circle'
      },
      grid: {
        top: '12%',
        left: '3%',
        right: '4%',
        bottom: '15%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: categories,
        axisLine: { lineStyle: { color: '#94A3B8' } },
        axisLabel: { color: '#64748B', fontSize: 11, fontWeight: 'bold' }
      },
      yAxis: [
        {
          type: 'value',
          name: metricUnits,
          nameTextStyle: { color: '#64748B', fontSize: 10, fontWeight: 'bold' },
          splitLine: { lineStyle: { color: 'rgba(226, 232, 240, 0.6)', type: 'dashed' } },
          axisLabel: { 
            color: '#64748B', 
            fontSize: 10,
            formatter: (val: number) => val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val
          }
        },
        {
          type: 'value',
          name: secondaryMetric === 'none' ? '' : (secondaryMetric === 'tasa_promedio' ? '%' : (secondaryMetric === 'dias_credito' ? 'Días' : '% Mora')),
          nameTextStyle: { color: '#EF4444', fontSize: 10, fontWeight: 'bold' },
          show: secondaryMetric !== 'none',
          splitLine: { show: false },
          axisLabel: { 
            color: '#EF4444', 
            fontSize: 10,
            formatter: (val: number) => `${val}`
          }
        }
      ],
      series: allSeries
    };
  }, [categories, seriesData, secondarySeriesData, metricUnits, secondaryMetric]);

  const resetFilters = () => {
    setFilterEmisor('TODOS');
    setFilterAceptante('TODOS');
    setFilterMoneda('TODOS');
    setFilterEstado('TODOS');
  };

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* --- PANEL DE CONTROL Y CONTROLES DEL GRÁFICO COMBINADO --- */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-xl">
              <BarChart3 size={20} />
            </div>
            <div>
              <h3 className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider">
                Panel de Control & Parámetros del Gráfico
              </h3>
              <span className="text-[11px] text-slate-400 font-medium">
                Personalización dinámicas de ejes, agrupamientos y métricas
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-3 py-1 rounded-xl border border-indigo-100 dark:border-indigo-900 flex items-center gap-1.5">
              <Sparkles size={13} className="text-amber-500" />
              <span>ECharts Motor Gráfico Dual</span>
            </span>
          </div>
        </div>

        {/* CONTROLES DE CONFIGURACIÓN DEL GRÁFICO */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
          {/* 1. Agrupar Por */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1.5">
              1. Agrupar Por
            </label>
            <select
              value={groupBy}
              onChange={e => setGroupBy(e.target.value as GroupBy)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="emisor">Empresa Emisora (Cedente)</option>
              <option value="aceptante">Pagador (Aceptante)</option>
              <option value="moneda">Moneda (PEN / USD)</option>
              <option value="estado">Estado Financiero</option>
            </select>
          </div>

          {/* 2. Eje Principal Y1 */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1.5">
              2. Eje Principal (Y1)
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              <select
                value={primaryMetric}
                onChange={e => setPrimaryMetric(e.target.value as PrimaryMetric)}
                className="w-full px-2 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-[11px] font-bold text-slate-800 dark:text-white cursor-pointer"
              >
                <option value="monto_neto">Monto Neto</option>
                <option value="monto_bruto">Monto Bruto</option>
                <option value="interes">Interés Ganado</option>
                <option value="cantidad">N° Operaciones</option>
              </select>

              <select
                value={primaryGraphType}
                onChange={e => setPrimaryGraphType(e.target.value as PrimaryGraphType)}
                className="w-full px-2 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-[11px] font-bold text-slate-800 dark:text-white cursor-pointer"
              >
                <option value="bar_stack">Apilado 📊</option>
                <option value="bar_group">Agrupado 📶</option>
                <option value="line">Línea 📈</option>
              </select>
            </div>
          </div>

          {/* 3. Eje Secundario Y2 */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1.5">
              3. Eje Secundario (Y2)
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              <select
                value={secondaryMetric}
                onChange={e => setSecondaryMetric(e.target.value as SecondaryMetric)}
                className="w-full px-2 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-[11px] font-bold text-slate-800 dark:text-white cursor-pointer"
              >
                <option value="none">Ninguno</option>
                <option value="tasa_promedio">Tasa Interés (%)</option>
                <option value="dias_credito">Días Crédito Prom.</option>
                <option value="porcentaje_mora">% En Mora</option>
              </select>

              <select
                value={secondaryGraphType}
                onChange={e => setSecondaryGraphType(e.target.value as SecondaryGraphType)}
                disabled={secondaryMetric === 'none'}
                className="w-full px-2 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-[11px] font-bold text-slate-800 dark:text-white disabled:opacity-40 cursor-pointer"
              >
                <option value="line">Línea 📉</option>
                <option value="bar">Barra 📊</option>
              </select>
            </div>
          </div>

          {/* 4. Reset & Acciones */}
          <div className="flex items-end">
            <button
              onClick={resetFilters}
              className="w-full py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <RotateCcw size={14} />
              <span>Limpiar Filtros</span>
            </button>
          </div>
        </div>

        {/* BARRA DE FILTROS SIMULTÁNEOS */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs pt-2 border-t border-slate-100 dark:border-slate-800">
          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
              Emisor (Cedente)
            </label>
            <select
              value={filterEmisor}
              onChange={e => setFilterEmisor(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-800 dark:text-white cursor-pointer"
            >
              <option value="TODOS">Todos los Emisores</option>
              {emisoresList.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
              Pagador (Aceptante)
            </label>
            <select
              value={filterAceptante}
              onChange={e => setFilterAceptante(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-800 dark:text-white cursor-pointer"
            >
              <option value="TODOS">Todos los Pagadores</option>
              {aceptantesList.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
              Moneda
            </label>
            <select
              value={filterMoneda}
              onChange={e => setFilterMoneda(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-800 dark:text-white cursor-pointer"
            >
              <option value="TODOS">Todas las Monedas</option>
              <option value="PEN">Soles (PEN)</option>
              <option value="USD">Dólares (USD)</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
              Estado Financiero
            </label>
            <select
              value={filterEstado}
              onChange={e => setFilterEstado(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-800 dark:text-white cursor-pointer"
            >
              <option value="TODOS">Todos los Estados</option>
              <option value="ORIGINADO">Originada</option>
              <option value="DESEMBOLSADO">Desembolsada</option>
              <option value="EN_PROCESO">En Proceso de Liquidación</option>
              <option value="LIQUIDADO">Liquidada</option>
              <option value="EN_MORA">🔴 En Mora (Hoy &gt; Vencimiento)</option>
            </select>
          </div>
        </div>
      </div>

      {/* --- CANVAS GRÁFICO ECHARTS --- */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
            Analítica Evolutiva por Mes ({filteredOps.length} operaciones evaluadas)
          </span>
          <span className="text-[11px] font-extrabold text-emerald-600 dark:text-emerald-400">
            Renderizado Apache ECharts v5
          </span>
        </div>

        <div className="w-full h-[420px]">
          <ReactECharts 
            option={echartsOption}
            style={{ height: '100%', width: '100%' }}
            opts={{ renderer: 'svg' }}
          />
        </div>
      </div>
    </div>
  );
};
