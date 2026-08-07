import React, { useMemo, useState, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import type { OperacionFactoring } from '../../../services/factoringService';

interface InteractiveFactoringChartProps {
  operaciones: OperacionFactoring[];
}

type GroupBy = 'emisor' | 'aceptante' | 'moneda' | 'estado' | 'all';
type PlotMetric = 'monto_neto' | 'monto_bruto' | 'interes' | 'cantidad' | 'none' | 'tasa_promedio' | 'dias_credito' | 'porcentaje_mora';

const getHexColor = (name: string, type: GroupBy) => {
  if (type === 'all') return '#0089CF';
  if (type === 'moneda') {
    if (name === 'USD') return '#3B82F6';
    return '#10B981';
  }
  if (type === 'estado') {
    if (name.includes('ORIGINAD')) return '#F59E0B';
    if (name.includes('APROBAD')) return '#10B981';
    if (name.includes('DESEMBOLSAD')) return '#3B82F6';
    if (name.includes('PROCESO')) return '#8B5CF6';
    if (name.includes('LIQUIDAD')) return '#6366F1';
    if (name.includes('MORA')) return '#EF4444';
    return '#64748B';
  }
  if (type === 'emisor') {
    if (name.includes('TRANS STAR')) return '#3B82F6';
    if (name.includes('SAN IGNACIO')) return '#8B5CF6';
    if (name.includes('TRUCK')) return '#F59E0B';
    return '#1E3A8A';
  }
  if (type === 'aceptante') {
    if (name.includes('EXALMAR')) return '#10B981';
    if (name.includes('LOGISTICA')) return '#06B6D4';
    return '#D946EF';
  }
  return '#94A3B8';
};

export const InteractiveFactoringChart: React.FC<InteractiveFactoringChartProps> = ({ operaciones }) => {
  const [groupBy, setGroupBy] = useState<GroupBy>('emisor');
  const [filterEmisor, setFilterEmisor] = useState<string>('ALL');
  const [filterAceptante, setFilterAceptante] = useState<string>('ALL');
  const [filterMoneda, setFilterMoneda] = useState<string>('ALL');
  const [filterEstado, setFilterEstado] = useState<string>('ALL');

  // Eje Primario
  const [primaryMetric, setPrimaryMetric] = useState<PlotMetric>('monto_neto');
  const [primaryGraphType, setPrimaryGraphType] = useState<'bar_stack' | 'bar_group' | 'line' | 'line_straight'>('bar_stack');

  // Eje Secundario
  const [secondaryMetric, setSecondaryMetric] = useState<PlotMetric>('tasa_promedio');
  const [secondaryGraphType, setSecondaryGraphType] = useState<'bar' | 'line' | 'line_straight'>('line');
  const [isSecondaryCumulativeSeries, setIsSecondaryCumulativeSeries] = useState<boolean>(false);
  const [isSecondaryCumulativeGlobal, setIsSecondaryCumulativeGlobal] = useState<boolean>(false);
  const [isSecondaryPercentage, setIsSecondaryPercentage] = useState<boolean>(false);

  // Label settings
  const [primaryLabelPos, setPrimaryLabelPos] = useState<'inside' | 'top' | 'none'>('inside');
  const [primaryLabelColor, setPrimaryLabelColor] = useState<'#ffffff' | '#000000'>('#ffffff');
  const [secondaryLabelPos, setSecondaryLabelPos] = useState<'inside' | 'top' | 'none'>('none');
  const [secondaryLabelColor, setSecondaryLabelColor] = useState<'#ffffff' | '#000000'>('#000000');

  // Popover open states
  const [isPriOpen, setIsPriOpen] = useState<boolean>(false);
  const [isSecOpen, setIsSecOpen] = useState<boolean>(false);
  const [isEmisorFilterOpen, setIsEmisorFilterOpen] = useState(false);
  const [isAceptanteFilterOpen, setIsAceptanteFilterOpen] = useState(false);
  const [isMonedaFilterOpen, setIsMonedaFilterOpen] = useState(false);
  const [isEstadoFilterOpen, setIsEstadoFilterOpen] = useState(false);

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  useEffect(() => {
    const handleOutsideClick = () => {
      setIsPriOpen(false);
      setIsSecOpen(false);
      setIsEmisorFilterOpen(false);
      setIsAceptanteFilterOpen(false);
      setIsMonedaFilterOpen(false);
      setIsEstadoFilterOpen(false);
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);

  const filterOptions = useMemo(() => {
    const emisores = new Set<string>();
    const aceptantes = new Set<string>();
    const monedas = new Set<string>();

    operaciones.forEach(op => {
      if (op.emisor_nombre) emisores.add(op.emisor_nombre);
      if (op.aceptante_nombre) aceptantes.add(op.aceptante_nombre);
      if (op.moneda) monedas.add(op.moneda);
    });

    return {
      emisores: Array.from(emisores).sort(),
      aceptantes: Array.from(aceptantes).sort(),
      monedas: Array.from(monedas).sort(),
      estados: ['ORIGINADO', 'APROBADO', 'DESEMBOLSADO', 'EN_PROCESO', 'LIQUIDADO', 'EN_MORA']
    };
  }, [operaciones]);

  const months = useMemo(() => {
    const monthSet = new Set<string>();
    operaciones.forEach(op => {
      const d = op.fecha_desembolso_esperada || op.fecha_creacion || todayStr;
      monthSet.add(d.substring(0, 7));
    });
    return Array.from(monthSet).sort();
  }, [operaciones, todayStr]);

  const xAxisData = useMemo(() => {
    return months.map(m => {
      const date = new Date(`${m}-02`);
      const formatted = new Intl.DateTimeFormat('es-ES', { month: 'short', year: '2-digit' }).format(date).replace('.', '');
      return formatted.charAt(0).toUpperCase() + formatted.slice(1);
    });
  }, [months]);

  const metricOptions = [
    { value: 'none', label: 'Ninguno', icon: '🚫', desc: 'No graficar' },
    { value: 'monto_neto', label: 'Monto Neto Abono', icon: '💰', desc: 'S/ / $ Abono Líquido' },
    { value: 'monto_bruto', label: 'Monto Bruto Total', icon: '📊', desc: 'S/ / $ Valor Facturado' },
    { value: 'interes', label: 'Interés de Descuento', icon: '💸', desc: 'S/ / $ Margen Ganado' },
    { value: 'cantidad', label: 'N° Operaciones', icon: '📅', desc: 'Cantidad de Facturas' },
    { value: 'tasa_promedio', label: 'Tasa Interés (%)', icon: '📈', desc: '% Tasa Compensatoria' },
    { value: 'dias_credito', label: 'Días Crédito Prom.', icon: '⏱️', desc: 'Plazo Promedio Días' },
    { value: 'porcentaje_mora', label: '% Facturas en Mora', icon: '⚠️', desc: '% Facturas Vencidas' }
  ];

  const getMetricLabel = (m: PlotMetric) => {
    const found = metricOptions.find(o => o.value === m);
    return found ? found.label : m;
  };

  const options = useMemo(() => {
    if (!operaciones || operaciones.length === 0 || months.length === 0) return {};

    const filtered = operaciones.filter(op => {
      if (filterEmisor !== 'ALL' && op.emisor_nombre !== filterEmisor) return false;
      if (filterAceptante !== 'ALL' && op.aceptante_nombre !== filterAceptante) return false;
      if (filterMoneda !== 'ALL' && op.moneda !== filterMoneda) return false;

      if (filterEstado !== 'ALL') {
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

    const seriesMapPri: Record<string, Record<string, number>> = {};
    const seriesMapSec: Record<string, Record<string, number>> = {};
    const totalPriMap: Record<string, number> = {};
    const totalSecMap: Record<string, number> = {};

    const getVal = (op: OperacionFactoring, m: PlotMetric) => {
      if (m === 'monto_neto') return op.abono_real_total || op.monto_neto_total || 0;
      if (m === 'monto_bruto') return op.monto_bruto_total || 0;
      if (m === 'interes') return op.interes_total || 0;
      if (m === 'cantidad') return 1;
      if (m === 'tasa_promedio') return 3.0; // Tasa promedio fija 3.0%
      if (m === 'dias_credito') return op.dias_promedio || 30;
      if (m === 'porcentaje_mora') {
        const fVenc = (op as any).fecha_vencimiento || (op as any).fecha_vencimiento_factura || '';
        return (fVenc && todayStr > fVenc && !op.estado.includes('LIQUIDADA')) ? 100 : 0;
      }
      return 0;
    };

    filtered.forEach(op => {
      const d = op.fecha_desembolso_esperada || op.fecha_creacion || todayStr;
      const month = d.substring(0, 7);

      let key = 'InAndes (Todo)';
      if (groupBy === 'emisor') key = op.emisor_nombre || 'Otros';
      else if (groupBy === 'aceptante') key = op.aceptante_nombre || 'Otros';
      else if (groupBy === 'moneda') key = op.moneda || 'PEN';
      else if (groupBy === 'estado') key = op.estado || 'Otros';

      if (!seriesMapPri[key]) seriesMapPri[key] = {};
      if (!seriesMapSec[key]) seriesMapSec[key] = {};

      const priVal = getVal(op, primaryMetric);
      seriesMapPri[key][month] = (seriesMapPri[key][month] || 0) + priVal;
      totalPriMap[month] = (totalPriMap[month] || 0) + priVal;

      if (secondaryMetric !== 'none') {
        const secVal = getVal(op, secondaryMetric);
        seriesMapSec[key][month] = (seriesMapSec[key][month] || 0) + secVal;
        totalSecMap[month] = (totalSecMap[month] || 0) + secVal;
      }
    });

    const buildSeries = (
      seriesMap: Record<string, Record<string, number>>,
      totalMap: Record<string, number>,
      metric: PlotMetric,
      graphType: string,
      isCumulative: boolean,
      isPercentage: boolean,
      yAxisIndex: number
    ) => {
      if (metric === 'none') return [];

      const labelPos = yAxisIndex === 0 ? primaryLabelPos : secondaryLabelPos;
      const labelColor = yAxisIndex === 0 ? primaryLabelColor : secondaryLabelColor;
      const grandTotal = Object.values(totalMap).reduce((a, b) => a + b, 0);

      return Object.entries(seriesMap).map(([name, mData]) => {
        let runningTotal = 0;
        let runningTotalOfTotals = 0;

        const dataArr = months.map(m => {
          const val = mData[m] || 0;
          const tot = totalMap[m] || 0;
          runningTotal += val;
          runningTotalOfTotals += tot;

          const finalVal = isCumulative ? runningTotal : val;
          const finalTot = isCumulative ? runningTotalOfTotals : tot;
          const pct = isCumulative ? (grandTotal ? (finalVal / grandTotal) * 100 : 0) : (finalTot ? (finalVal / finalTot) * 100 : 0);

          return {
            value: isPercentage ? pct : finalVal,
            pct,
            rawVal: finalVal
          };
        });

        const cColor = getHexColor(name, groupBy);
        const isBar = graphType.includes('bar');
        const isStack = graphType === 'bar_stack' || (yAxisIndex === 1 && graphType === 'bar');

        return {
          name: `${name} ${yAxisIndex === 0 ? '(Pri)' : '(Sec)'}`,
          type: isBar ? 'bar' : 'line',
          stack: isStack ? `total_${yAxisIndex}` : undefined,
          yAxisIndex,
          smooth: graphType === 'line',
          symbol: graphType.includes('line') ? 'circle' : undefined,
          symbolSize: graphType.includes('line') ? 8 : undefined,
          barMaxWidth: isBar ? 40 : undefined,
          barGap: isStack ? undefined : '10%',
          data: dataArr,
          itemStyle: {
            borderRadius: isBar ? [2, 2, 0, 0] : undefined,
            color: cColor
          },
          lineStyle: graphType.includes('line') ? { width: 3, type: yAxisIndex === 1 ? 'dashed' : 'solid' } : undefined,
          label: {
            show: labelPos !== 'none',
            position: labelPos === 'none' ? undefined : labelPos,
            formatter: (params: any) => {
              const val = params.data.value;
              if (val === 0) return '';
              if (isPercentage) return `${params.data.pct.toFixed(1)}%`;
              if (metric === 'cantidad') return val.toString();
              if (metric === 'tasa_promedio') return `${val.toFixed(1)}%`;
              if (metric === 'dias_credito') return `${val.toFixed(0)}d`;
              return val >= 1000 ? `$${(val / 1000).toFixed(0)}k` : `$${val.toFixed(0)}`;
            },
            color: labelColor,
            fontWeight: 'bold',
            fontSize: 10
          }
        };
      });
    };

    const seriesPri = buildSeries(seriesMapPri, totalPriMap, primaryMetric, primaryGraphType, false, false, 0);

    const showSecIndividual = isSecondaryCumulativeSeries || !isSecondaryCumulativeGlobal;
    let seriesSec: any[] = [];
    if (showSecIndividual && secondaryMetric !== 'none') {
      seriesSec = buildSeries(seriesMapSec, totalSecMap, secondaryMetric, secondaryGraphType, isSecondaryCumulativeSeries, isSecondaryPercentage, 1);
    }

    let globalSeries: any[] = [];
    if (isSecondaryCumulativeGlobal && secondaryMetric !== 'none') {
      const grandTotalSec = Object.values(totalSecMap).reduce((a, b) => a + b, 0);
      let runningGlobal = 0;
      const globalData = xAxisData.map((_, i) => {
        const month = months[i];
        let val = 0;
        Object.values(seriesMapSec).forEach(mData => {
          val += (mData[month] || 0);
        });
        runningGlobal += val;
        const globalPct = grandTotalSec ? (runningGlobal / grandTotalSec) * 100 : 0;
        return {
          value: isSecondaryPercentage ? globalPct : runningGlobal,
          pct: globalPct,
          rawVal: runningGlobal,
          itemStyle: { color: '#1E293B' }
        };
      });

      globalSeries.push({
        name: 'Total Global (Sec)',
        type: 'line',
        yAxisIndex: 1,
        smooth: secondaryGraphType === 'line',
        symbol: 'circle',
        symbolSize: 8,
        lineStyle: { width: 3, type: 'dashed' },
        data: globalData,
        label: {
          show: secondaryLabelPos !== 'none',
          position: secondaryLabelPos === 'none' ? undefined : secondaryLabelPos,
          formatter: (params: any) => `${params.data.value.toFixed(0)}`,
          color: secondaryLabelColor,
          fontWeight: 'bold',
          fontSize: 10
        }
      });
    }

    const series = [...seriesPri, ...seriesSec, ...globalSeries];

    const getAxisFormatter = (m: PlotMetric, isPct: boolean) => {
      if (isPct || m === 'tasa_promedio' || m === 'porcentaje_mora') return '{value}%';
      if (m === 'cantidad') return '{value}';
      if (m === 'dias_credito') return '{value}d';
      return (v: number) => `$${(v / 1000).toFixed(0)}k`;
    };

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' },
        formatter: (params: any[]) => {
          if (!params || params.length === 0) return '';
          let tooltip = `<div style="font-weight:600;margin-bottom:4px">${params[0].axisValue}</div>`;
          params.forEach((p: any) => {
            const isSec = p.seriesName.includes('(Sec)');
            const m = isSec ? secondaryMetric : primaryMetric;
            let valStr = '';
            if (m === 'tasa_promedio' || m === 'porcentaje_mora') valStr = `${p.value.toFixed(1)}%`;
            else if (m === 'cantidad') valStr = p.value.toString();
            else if (m === 'dias_credito') valStr = `${Math.round(p.value)} d`;
            else valStr = `$${Math.round(p.value).toLocaleString('es-PE')}`;

            tooltip += `<div>${p.marker} <b>${p.seriesName.replace(' (Pri)', '').replace(' (Sec)', '')}</b>: ${valStr}</div>`;
          });
          return tooltip;
        }
      },
      legend: {
        top: 0,
        icon: 'circle',
        textStyle: { color: '#475569' }
      },
      grid: {
        left: 70,
        right: 70,
        bottom: 30,
        top: 40,
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: xAxisData,
        axisLine: { lineStyle: { color: '#CBD5E1' } },
        axisLabel: { color: '#64748B', fontWeight: 'bold' }
      },
      yAxis: [
        {
          type: 'value',
          name: getMetricLabel(primaryMetric),
          nameTextStyle: { color: '#0EA5E9', padding: [0, 0, 0, -40] },
          axisLine: { show: false },
          axisLabel: { color: '#64748B', fontWeight: 'bold', formatter: getAxisFormatter(primaryMetric, false) },
          splitLine: { lineStyle: { type: 'dashed', color: '#E2E8F0' } }
        },
        {
          type: 'value',
          name: secondaryMetric === 'none' ? '' : getMetricLabel(secondaryMetric),
          nameTextStyle: { color: '#059669', padding: [0, -40, 0, 0] },
          axisLine: { show: false },
          axisLabel: { color: '#059669', fontWeight: 'bold', formatter: getAxisFormatter(secondaryMetric, isSecondaryPercentage) },
          splitLine: { show: false }
        }
      ],
      series,
      color: ['#0EA5E9', '#3B82F6', '#6366F1', '#8B5CF6', '#EC4899', '#14B8A6', '#10B981']
    };
  }, [operaciones, groupBy, months, xAxisData, filterEmisor, filterAceptante, filterMoneda, filterEstado, primaryMetric, primaryGraphType, secondaryMetric, secondaryGraphType, isSecondaryCumulativeSeries, isSecondaryCumulativeGlobal, isSecondaryPercentage, primaryLabelPos, primaryLabelColor, secondaryLabelPos, secondaryLabelColor, todayStr]);

  const renderCustomDropdown = (
    selectedVal: string,
    onSelect: (val: string) => void,
    isOpen: boolean,
    setIsOpen: (open: boolean) => void,
    colorClass: string,
    isSecondary: boolean
  ) => {
    const selectedOption = metricOptions.find(o => o.value === selectedVal) || metricOptions[0];

    return (
      <div className="relative w-full" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => {
            if (isSecondary) {
              setIsPriOpen(false);
              setIsOpen(!isOpen);
            } else {
              setIsSecOpen(false);
              setIsOpen(!isOpen);
            }
          }}
          className="w-full flex items-center justify-between gap-1 px-2 py-1.5 text-xs font-bold bg-white border border-slate-200 rounded hover:border-slate-350 focus:outline-none transition-all cursor-pointer text-slate-700"
        >
          <div className="flex items-center gap-1.5 truncate">
            <span className="text-sm shrink-0">{selectedOption.icon}</span>
            <span className="truncate">{selectedOption.label}</span>
          </div>
          <span className="text-[9px] text-slate-400 shrink-0">{isOpen ? '▲' : '▼'}</span>
        </button>

        {isOpen && (
          <div className="absolute left-[208px] top-1/2 -translate-y-1/2 bg-white border border-slate-200 rounded-lg shadow-xl z-50 w-[420px] p-2 grid grid-cols-2 gap-1.5 animate-in fade-in slide-in-from-left-2 duration-150">
            <div className="col-span-2 px-1 py-0.5 border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center justify-between">
              <span>Métricas ({isSecondary ? 'Eje Secundario' : 'Eje Primario'})</span>
              <button onClick={() => setIsOpen(false)} className="text-[11px] text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer">✕</button>
            </div>
            {metricOptions.map((opt) => {
              const isSel = opt.value === selectedVal;
              if (!isSecondary && opt.value === 'none') return null;

              return (
                <button
                  key={opt.value}
                  onClick={() => {
                    onSelect(opt.value);
                    setIsOpen(false);
                  }}
                  className={`text-left p-1.5 flex flex-col gap-0.5 rounded hover:bg-slate-50 transition-all cursor-pointer border ${
                    isSel
                      ? (colorClass === 'blue' ? 'bg-blue-50/70 border-blue-200 hover:bg-blue-50' : 'bg-emerald-50/70 border-emerald-200 hover:bg-emerald-50')
                      : 'border-slate-100/50 bg-slate-50/20'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm shrink-0">{opt.icon}</span>
                    <span className={`text-[11px] ${isSel ? 'font-bold' : 'font-semibold'} ${isSel ? (colorClass === 'blue' ? 'text-blue-900' : 'text-emerald-900') : 'text-slate-700'} truncate`}>
                      {opt.label}
                    </span>
                  </div>
                  <span className="text-[9px] text-slate-400 font-medium pl-5 truncate block">
                    {opt.desc}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const renderFilterDropdown = (
    selectedVal: string,
    onSelect: (val: string) => void,
    optionsList: string[],
    isOpen: boolean,
    setIsOpen: (open: boolean) => void,
    title: string
  ) => {
    return (
      <div className="relative flex-1" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => {
            setIsEmisorFilterOpen(false);
            setIsAceptanteFilterOpen(false);
            setIsMonedaFilterOpen(false);
            setIsEstadoFilterOpen(false);
            setIsPriOpen(false);
            setIsSecOpen(false);
            setIsOpen(!isOpen);
          }}
          className="w-full flex items-center justify-between gap-1 px-2 py-1.5 text-xs bg-white border border-slate-200 rounded hover:border-slate-350 focus:outline-none transition-all cursor-pointer text-slate-700 font-bold"
        >
          <span className="truncate">{selectedVal === 'ALL' ? 'Todos' : selectedVal}</span>
          <span className="text-[8px] text-slate-400 shrink-0">{isOpen ? '▲' : '▼'}</span>
        </button>

        {isOpen && (
          <div className="absolute left-[130px] top-1/2 -translate-y-1/2 bg-white border border-slate-200 rounded-lg shadow-xl z-50 w-[240px] max-h-[220px] overflow-y-auto p-1.5 flex flex-col gap-0.5 animate-in fade-in slide-in-from-left-2 duration-150">
            <div className="px-2 py-1 border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center justify-between">
              <span>Filtrar {title}</span>
              <button onClick={() => setIsOpen(false)} className="text-[10px] text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer">✕</button>
            </div>
            <button
              onClick={() => {
                onSelect('ALL');
                setIsOpen(false);
              }}
              className={`text-left text-[11px] p-1.5 rounded transition-all cursor-pointer border ${
                selectedVal === 'ALL'
                  ? 'bg-blue-50 border-blue-200 font-bold text-blue-900'
                  : 'border-transparent hover:bg-slate-50 font-medium text-slate-600'
              }`}
            >
              Todos
            </button>
            {optionsList.map((opt) => {
              const isSel = opt === selectedVal;
              return (
                <button
                  key={opt}
                  onClick={() => {
                    onSelect(opt);
                    setIsOpen(false);
                  }}
                  className={`text-left text-[11px] p-1.5 rounded transition-all cursor-pointer border truncate ${
                    isSel
                      ? 'bg-blue-50 border-blue-200 font-bold text-blue-900'
                      : 'border-transparent hover:bg-slate-50 font-medium text-slate-600'
                  }`}
                >
                  {opt === 'EN_PROCESO' ? 'EN PROCESO' : (opt === 'EN_MORA' ? '🔴 EN MORA' : opt)}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-full bg-white pt-6 pb-6 px-6 shadow-sm rounded-2xl flex flex-row gap-6 items-stretch border border-slate-200 dark:border-slate-800 dark:bg-slate-900 min-h-[650px]">
      {/* Sidebar de Controles (Left 240px) */}
      <div className="flex flex-col gap-3 shrink-0 w-[240px]">
        
        {/* FILTROS TABS SIDEBAR */}
        <div className="flex bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="bg-slate-700 w-7 flex items-center justify-center shrink-0 rounded-l-lg">
            <span className="text-[11px] font-bold text-white uppercase tracking-widest" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>Filtros</span>
          </div>
          <div className="flex-1 p-2 flex flex-col gap-2 bg-slate-50/50 dark:bg-slate-950/40 rounded-r-lg relative">
            <button 
              onClick={() => setGroupBy('all')} 
              className={`w-full h-8 flex items-center justify-center text-center px-2 text-[12px] font-extrabold rounded-md transition-colors ${groupBy === 'all' ? 'bg-blue-600 text-white shadow-sm' : 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
            >
              InAndes (Todo)
            </button>
            <div className="h-px w-full bg-slate-200 dark:bg-slate-800 my-0.5"></div>

            {/* Emisor filter row */}
            <div className="flex items-center gap-1">
              <button 
                onClick={() => setGroupBy('emisor')} 
                className={`w-[75px] shrink-0 h-8 flex items-center justify-center text-[11px] font-bold rounded-md transition-colors ${groupBy === 'emisor' || filterEmisor !== 'ALL' ? 'bg-blue-600 text-white shadow-sm' : 'bg-white dark:bg-slate-900 text-slate-500 border border-slate-200 dark:border-slate-800'}`}
              >
                Emisor
              </button>
              {renderFilterDropdown(filterEmisor, setFilterEmisor, filterOptions.emisores, isEmisorFilterOpen, setIsEmisorFilterOpen, 'Emisor')}
            </div>

            {/* Aceptante filter row */}
            <div className="flex items-center gap-1">
              <button 
                onClick={() => setGroupBy('aceptante')} 
                className={`w-[75px] shrink-0 h-8 flex items-center justify-center text-[11px] font-bold rounded-md transition-colors ${groupBy === 'aceptante' || filterAceptante !== 'ALL' ? 'bg-blue-600 text-white shadow-sm' : 'bg-white dark:bg-slate-900 text-slate-500 border border-slate-200 dark:border-slate-800'}`}
              >
                Pagador
              </button>
              {renderFilterDropdown(filterAceptante, setFilterAceptante, filterOptions.aceptantes, isAceptanteFilterOpen, setIsAceptanteFilterOpen, 'Pagador')}
            </div>

            {/* Moneda filter row */}
            <div className="flex items-center gap-1">
              <button 
                onClick={() => setGroupBy('moneda')} 
                className={`w-[75px] shrink-0 h-8 flex items-center justify-center text-[11px] font-bold rounded-md transition-colors ${groupBy === 'moneda' || filterMoneda !== 'ALL' ? 'bg-blue-600 text-white shadow-sm' : 'bg-white dark:bg-slate-900 text-slate-500 border border-slate-200 dark:border-slate-800'}`}
              >
                Moneda
              </button>
              {renderFilterDropdown(filterMoneda, setFilterMoneda, filterOptions.monedas, isMonedaFilterOpen, setIsMonedaFilterOpen, 'Moneda')}
            </div>

            {/* Estado filter row */}
            <div className="h-px w-full bg-slate-200 dark:bg-slate-800 my-0.5"></div>
            <div className="flex items-center gap-1">
              <button 
                onClick={() => setGroupBy('estado')} 
                className={`w-[75px] shrink-0 h-8 flex items-center justify-center text-[11px] font-bold rounded-md transition-colors ${groupBy === 'estado' || filterEstado !== 'ALL' ? 'bg-blue-600 text-white shadow-sm' : 'bg-white dark:bg-slate-900 text-slate-500 border border-slate-200 dark:border-slate-800'}`}
              >
                Estado
              </button>
              {renderFilterDropdown(filterEstado, setFilterEstado, filterOptions.estados, isEstadoFilterOpen, setIsEstadoFilterOpen, 'Estado')}
            </div>
          </div>
        </div>

        {/* EJE PRIMARIO SIDEBAR CARD */}
        <div className="flex bg-white dark:bg-slate-900 rounded-lg border border-blue-200 dark:border-blue-900/60 shadow-sm">
          <div className="bg-blue-600 w-7 flex items-center justify-center shrink-0 rounded-l-lg">
            <span className="text-[11px] font-bold text-white uppercase tracking-widest" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>Eje Primario</span>
          </div>
          <div className="flex-1 p-2 flex flex-col gap-2.5 bg-blue-50/30 dark:bg-blue-950/20 rounded-r-lg relative">
            {renderCustomDropdown(primaryMetric, (val) => setPrimaryMetric(val as PlotMetric), isPriOpen, setIsPriOpen, 'blue', false)}
            
            <div className="flex flex-row gap-4 pt-2 border-t border-blue-200/40 dark:border-blue-800/40 mt-1">
              {/* Iconos apilados tipo de gráfico */}
              <div className="flex flex-col gap-1 w-9 shrink-0">
                <button 
                  onClick={() => setPrimaryGraphType('bar_stack')}
                  className={`p-1.5 rounded border flex items-center justify-center transition-all cursor-pointer ${primaryGraphType === 'bar_stack' ? 'bg-blue-600 border-blue-600 text-white shadow-sm' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500'}`}
                  title="Barras Stack"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><rect x="7" y="13" width="10" height="4" rx="1"/><rect x="7" y="7" width="10" height="4" rx="1"/></svg>
                </button>
                <button 
                  onClick={() => setPrimaryGraphType('bar_group')}
                  className={`p-1.5 rounded border flex items-center justify-center transition-all cursor-pointer ${primaryGraphType === 'bar_group' ? 'bg-blue-600 border-blue-600 text-white shadow-sm' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500'}`}
                  title="Barras Adjuntas"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="M7 17v-6"/><path d="M11 17V9"/><path d="M15 17v-4"/><path d="M19 17V5"/></svg>
                </button>
                <button 
                  onClick={() => setPrimaryGraphType('line')}
                  className={`p-1.5 rounded border flex items-center justify-center transition-all cursor-pointer ${primaryGraphType === 'line' ? 'bg-blue-600 border-blue-600 text-white shadow-sm' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500'}`}
                  title="Línea Suavizada"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="M7 17c2-5 4-10 8-10s6 5 8 5"/></svg>
                </button>
                <button 
                  onClick={() => setPrimaryGraphType('line_straight')}
                  className={`p-1.5 rounded border flex items-center justify-center transition-all cursor-pointer ${primaryGraphType === 'line_straight' ? 'bg-blue-600 border-blue-600 text-white shadow-sm' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500'}`}
                  title="Línea Recta"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="M7 15l5-8 5 6 4-6"/></svg>
                </button>
              </div>

              {/* Control de Etiquetas */}
              <div className="flex-1 flex flex-col gap-1">
                <button
                  onClick={() => setPrimaryLabelColor(primaryLabelColor === '#ffffff' ? '#000000' : '#ffffff')}
                  className={`w-full text-center py-1 text-[10px] font-extrabold rounded border transition-colors shadow-sm cursor-pointer ${primaryLabelColor === '#ffffff' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-800 border-slate-200'}`}
                  title="Alternar Color (Blanco/Negro)"
                >
                  Etiquetas
                </button>
                <div className="flex flex-col rounded border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900 mt-1 w-full">
                  {(['none', 'top', 'inside'] as const).map(pos => (
                    <button
                      key={pos}
                      onClick={() => setPrimaryLabelPos(pos)}
                      className={`text-[9px] font-bold py-1 px-1 transition-all cursor-pointer border-b last:border-0 border-slate-100 dark:border-slate-800 ${primaryLabelPos === pos ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                      {pos === 'none' ? 'Ocultar' : (pos === 'top' ? 'Encima' : 'Centro')}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* EJE SECUNDARIO SIDEBAR CARD */}
        <div className="flex bg-white dark:bg-slate-900 rounded-lg border border-emerald-200 dark:border-emerald-900/60 shadow-sm">
          <div className="bg-emerald-600 w-7 flex items-center justify-center shrink-0 rounded-l-lg">
            <span className="text-[11px] font-bold text-white uppercase tracking-widest" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>Eje Secundario</span>
          </div>
          <div className="flex-1 p-2 flex flex-col gap-2.5 bg-emerald-50/30 dark:bg-emerald-950/20 rounded-r-lg relative">
            {renderCustomDropdown(secondaryMetric, (val) => setSecondaryMetric(val as PlotMetric), isSecOpen, setIsSecOpen, 'emerald', true)}

            <div className="flex flex-col gap-1.5 mt-1 border-t border-slate-200/50 dark:border-slate-800/50 pt-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="w-3 h-3 rounded" checked={isSecondaryCumulativeSeries} onChange={(e) => setIsSecondaryCumulativeSeries(e.target.checked)} />
                <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300">Acumular por serie</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="w-3 h-3 rounded" checked={isSecondaryCumulativeGlobal} onChange={(e) => setIsSecondaryCumulativeGlobal(e.target.checked)} />
                <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300">Acumular Global</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="w-3 h-3 rounded" checked={isSecondaryPercentage} onChange={(e) => setIsSecondaryPercentage(e.target.checked)} />
                <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300">Mostrar en % (Share)</span>
              </label>
            </div>

            <div className="flex flex-row gap-4 pt-2 border-t border-emerald-200/40 dark:border-emerald-800/40 mt-1">
              <div className="flex flex-col gap-1 w-9 shrink-0">
                <button 
                  onClick={() => setSecondaryGraphType('bar')}
                  className={`p-1.5 rounded border flex items-center justify-center transition-all cursor-pointer ${secondaryGraphType === 'bar' ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500'}`}
                  title="Barras"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="M7 17v-6"/><path d="M11 17V9"/><path d="M15 17v-4"/><path d="M19 17V5"/></svg>
                </button>
                <button 
                  onClick={() => setSecondaryGraphType('line')}
                  className={`p-1.5 rounded border flex items-center justify-center transition-all cursor-pointer ${secondaryGraphType === 'line' ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500'}`}
                  title="Línea Suavizada"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="M7 17c2-5 4-10 8-10s6 5 8 5"/></svg>
                </button>
                <button 
                  onClick={() => setSecondaryGraphType('line_straight')}
                  className={`p-1.5 rounded border flex items-center justify-center transition-all cursor-pointer ${secondaryGraphType === 'line_straight' ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500'}`}
                  title="Línea Recta"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="M7 15l5-8 5 6 4-6"/></svg>
                </button>
              </div>

              <div className="flex-1 flex flex-col gap-1">
                <button
                  onClick={() => setSecondaryLabelColor(secondaryLabelColor === '#ffffff' ? '#000000' : '#ffffff')}
                  className={`w-full text-center py-1 text-[10px] font-extrabold rounded border transition-colors shadow-sm cursor-pointer ${secondaryLabelColor === '#ffffff' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-800 border-slate-200'}`}
                  title="Alternar Color (Blanco/Negro)"
                >
                  Etiquetas
                </button>
                <div className="flex flex-col rounded border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900 mt-1 w-full">
                  {(['none', 'top', 'inside'] as const).map(pos => (
                    <button
                      key={pos}
                      onClick={() => setSecondaryLabelPos(pos)}
                      className={`text-[9px] font-bold py-1 px-1 transition-all cursor-pointer border-b last:border-0 border-slate-100 dark:border-slate-800 ${secondaryLabelPos === pos ? 'bg-emerald-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                      {pos === 'none' ? 'Ocultar' : (pos === 'top' ? 'Encima' : 'Centro')}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Contenedor del Gráfico (Right Area) */}
      <div className="flex-1 flex flex-col min-h-[650px]">
        <ReactECharts 
          option={options} 
          style={{ flex: 1, height: '100%', minHeight: '650px', width: '100%' }} 
          notMerge={true} 
        />
      </div>
    </div>
  );
};
