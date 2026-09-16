import React, { useMemo, useState, useEffect, useRef } from 'react';
import ReactECharts from 'echarts-for-react';
import type { PeriodoComisionGroup, ParticipeComisionItem } from '../../../services/comisionesService';
import { 
  Layers,
  ChevronDown,
  Calendar,
  RotateCcw
} from 'lucide-react';

interface ComisionesInteractiveChartProps {
  periodosData: PeriodoComisionGroup[];
  selectedYear: number;
}

type GroupBy = 'asesor' | 'fondo' | 'moneda';
type PlotMetric = 
  | 'comision_total' 
  | 'capital_base' 
  | 'tasa_promedio' 
  | 'num_participes' 
  | 'num_operaciones' 
  | 'none';

// Paleta cromatica ejecutiva y distintiva
const ASESOR_COLORS = [
  '#4F46E5', // Indigo
  '#06B6D4', // Cyan
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#EC4899', // Pink
  '#8B5CF6', // Purple
  '#3B82F6', // Blue
  '#EF4444', // Red
  '#14B8A6', // Teal
  '#F97316', // Orange
  '#6366F1', // Indigo light
  '#84CC16', // Lime
];

const FONDO_COLORS: Record<string, string> = {
  'NSGPEN01': '#0284C7',
  'NSEPEN02': '#7C3AED',
  'NSGUSD01': '#059669',
  'DEFAULT': '#475569'
};

export const ComisionesInteractiveChart: React.FC<ComisionesInteractiveChartProps> = ({
  periodosData,
  selectedYear
}) => {
  const [groupBy, setGroupBy] = useState<GroupBy>('asesor');
  const [filterPeriodo, setFilterPeriodo] = useState<string>('ALL');
  const [filterFondo, setFilterFondo] = useState<string>('ALL');
  const [filterAsesor, setFilterAsesor] = useState<string>('ALL');
  const [filterMoneda, setFilterMoneda] = useState<string>('ALL');

  // Eje Primario
  const [primaryMetric, setPrimaryMetric] = useState<PlotMetric>('comision_total');
  const [primaryGraphType, setPrimaryGraphType] = useState<'bar_stack' | 'bar_group' | 'line' | 'area'>('bar_stack');
  const primaryLabelPos = 'none';
  const primaryLabelColor = '#0f172a';

  // Eje Secundario
  const [secondaryMetric, setSecondaryMetric] = useState<PlotMetric>('tasa_promedio');
  const [secondaryGraphType, setSecondaryGraphType] = useState<'line' | 'bar'>('line');
  const [isSecondaryCumulative, setIsSecondaryCumulative] = useState<boolean>(false);
  const secondaryLabelPos = 'none';
  const secondaryLabelColor = '#0f172a';

  // Popovers de filtros
  const [isPeriodoFilterOpen, setIsPeriodoFilterOpen] = useState(false);
  const [isFondoFilterOpen, setIsFondoFilterOpen] = useState(false);
  const [isAsesorFilterOpen, setIsAsesorFilterOpen] = useState(false);
  const [isPriOpen, setIsPriOpen] = useState(false);
  const [isSecOpen, setIsSecOpen] = useState(false);

  const echartsRef = useRef<any>(null);

  // Auto-resize de ECharts
  useEffect(() => {
    const handleResize = () => {
      if (echartsRef.current) {
        try {
          const chartInstance = echartsRef.current.getEchartsInstance();
          if (chartInstance && typeof chartInstance.resize === 'function' && !chartInstance.isDisposed()) {
            chartInstance.resize();
          }
        } catch (e) {
          // Ignore layout errors
        }
      }
    };

    const timers = [50, 150, 300, 600].map(delay => setTimeout(handleResize, delay));
    window.addEventListener('resize', handleResize);
    return () => {
      timers.forEach(clearTimeout);
      window.removeEventListener('resize', handleResize);
    };
  }, [periodosData]);

  // Cerrar popovers al hacer click fuera
  useEffect(() => {
    const handleOutsideClick = () => {
      setIsPeriodoFilterOpen(false);
      setIsFondoFilterOpen(false);
      setIsAsesorFilterOpen(false);
      setIsPriOpen(false);
      setIsSecOpen(false);
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);

  // Extraer opciones de filtros disponibles
  const filterOptions = useMemo(() => {
    const fondosMap = new Map<string, string>();
    const asesoresMap = new Map<string, string>();
    const monedas = new Set<string>();

    const sortedP = [...periodosData].sort((a, b) => a.mes_num - b.mes_num);
    const periodos = sortedP.map(p => ({
      id: p.id,
      nombre: `${p.mes_nombre} (${p.ciclo_label})`
    }));

    periodosData.forEach((p: PeriodoComisionGroup) => {
      p.participes.forEach((part: ParticipeComisionItem) => {
        if (part.id_fondo) fondosMap.set(part.id_fondo, part.nombre_fondo || part.id_fondo);
        if (part.id_asesor) asesoresMap.set(part.id_asesor, part.nombre_asesor || part.id_asesor);
        if (part.moneda) monedas.add(part.moneda);
      });
    });

    return {
      periodos,
      fondos: Array.from(fondosMap.entries()).map(([id, nombre]) => ({ id, nombre })),
      asesores: Array.from(asesoresMap.entries()).map(([id, nombre]) => ({ id, nombre })),
      monedas: Array.from(monedas)
    };
  }, [periodosData]);

  const metricOptionsList: { value: PlotMetric; label: string; icon: string; desc: string }[] = [
    { value: 'comision_total', label: 'Comision Devengada', icon: '$', desc: 'Monto total pagado en comisiones comerciales' },
    { value: 'capital_base', label: 'Capital Administrado', icon: '🏦', desc: 'Volumen total de cartera administrada' },
    { value: 'tasa_promedio', label: 'Tasa Ponderada (% aa)', icon: '%', desc: 'Tasa anualizada promedio de comision' },
    { value: 'num_participes', label: 'Participes (Inversionistas)', icon: '👥', desc: 'Numero de inversionistas con comisiones' },
    { value: 'num_operaciones', label: 'Contratos / Certificados', icon: '📋', desc: 'Cantidad de operaciones activas' },
  ];

  const getMetricLabel = (m: PlotMetric) => {
    switch (m) {
      case 'comision_total': return 'Comision (PEN / USD)';
      case 'capital_base': return 'Capital Base (PEN / USD)';
      case 'tasa_promedio': return 'Tasa Promedio (% aa)';
      case 'num_participes': return 'Cant. Inversionistas';
      case 'num_operaciones': return 'Cant. Contratos';
      case 'none': return 'Ninguna';
      default: return m;
    }
  };

  // Asignador de colores estable por nombre/ID
  const getColorForKey = (key: string, index: number, type: 'asesor' | 'fondo' | 'moneda' | 'general') => {
    if (type === 'fondo') {
      return FONDO_COLORS[key] || ASESOR_COLORS[index % ASESOR_COLORS.length];
    }
    if (type === 'moneda') {
      return key === 'PEN' ? '#10B981' : '#0284C7';
    }
    return ASESOR_COLORS[index % ASESOR_COLORS.length];
  };

  // =========================================================================
  // CONSTRUCCIÓN DINÁMICA DE OPCIONES DE APACHE ECHARTS (LOGICA JERARQUICA)
  // =========================================================================
  const options = useMemo(() => {
    if (periodosData.length === 0) return {};

    // Determinar Modo del Eje X segun los filtros activos
    const isPeriodoFijo = filterPeriodo !== 'ALL';
    const isFondoFijo = filterFondo !== 'ALL';

    // -----------------------------------------------------------------------
    // CASO 1: PERIODO FIJO + FONDO FIJO -> EJE X = LÍNEA DE ASESORES
    // -----------------------------------------------------------------------
    if (isPeriodoFijo && isFondoFijo) {
      const selectedPeriod = periodosData.find(p => p.id === filterPeriodo);
      const participes = selectedPeriod ? selectedPeriod.participes.filter(p => {
        if (p.id_fondo !== filterFondo) return false;
        if (filterAsesor !== 'ALL' && p.id_asesor !== filterAsesor) return false;
        if (filterMoneda !== 'ALL' && p.moneda !== filterMoneda) return false;
        return true;
      }) : [];

      // Agrupar por Asesor
      const asesorTotalsMap = new Map<string, {
        nombre: string;
        comision: number;
        capital: number;
        tasa_ponderada: number;
        participes_set: Set<string>;
        contratos_count: number;
      }>();

      participes.forEach(part => {
        const sKey = part.nombre_asesor || part.id_asesor;
        if (!asesorTotalsMap.has(sKey)) {
          asesorTotalsMap.set(sKey, {
            nombre: sKey,
            comision: 0,
            capital: 0,
            tasa_ponderada: 0,
            participes_set: new Set<string>(),
            contratos_count: 0
          });
        }
        const item = asesorTotalsMap.get(sKey)!;
        item.comision += part.comision_calculada;
        item.capital += part.capital_base;
        item.tasa_ponderada += (part.tasa_comision_asesor * part.capital_base);
        item.participes_set.add(part.inversionista_nombre);
        item.contratos_count += 1;
      });

      // Ordenar asesores de MAYOR A MENOR comision (los que mas ganan primero)
      const sortedAsesores = Array.from(asesorTotalsMap.values()).sort((a, b) => b.comision - a.comision);
      const xAxisData = sortedAsesores.map(a => a.nombre);

      const getValForMetric = (a: typeof sortedAsesores[0], m: PlotMetric) => {
        if (m === 'comision_total') return Math.round(a.comision * 100) / 100;
        if (m === 'capital_base') return Math.round(a.capital);
        if (m === 'tasa_promedio') return a.capital > 0 ? Math.round((a.tasa_ponderada / a.capital) * 100) / 100 : 0;
        if (m === 'num_participes') return a.participes_set.size;
        if (m === 'num_operaciones') return a.contratos_count;
        return 0;
      };

      const primaryData = sortedAsesores.map(a => getValForMetric(a, primaryMetric));
      const secondaryData = secondaryMetric !== 'none' ? sortedAsesores.map(a => getValForMetric(a, secondaryMetric)) : [];

      const priSeries = [{
        name: getMetricLabel(primaryMetric),
        type: primaryGraphType.includes('bar') ? 'bar' : 'line',
        yAxisIndex: 0,
        smooth: true,
        barMaxWidth: 45,
        itemStyle: {
          color: (params: any) => ASESOR_COLORS[params.dataIndex % ASESOR_COLORS.length],
          borderRadius: [4, 4, 0, 0]
        },
        data: primaryData
      }];

      const secSeries = secondaryMetric !== 'none' ? [{
        name: `${getMetricLabel(secondaryMetric)} (Sec)`,
        type: secondaryGraphType,
        yAxisIndex: 1,
        smooth: true,
        lineStyle: { width: 3, type: 'dashed' },
        itemStyle: { color: '#059669' },
        data: secondaryData
      }] : [];

      return {
        tooltip: {
          trigger: 'axis',
          axisPointer: { type: 'cross' },
          formatter: (params: any[]) => {
            if (!params || params.length === 0) return '';
            const asesorName = params[0].axisValue;
            let html = `<div style="font-weight:bold;margin-bottom:4px;border-bottom:1px solid #cbd5e1;padding-bottom:2px;font-size:12px;color:#0f172a;">
              👤 Asesor: ${asesorName}
            </div>`;
            params.forEach(p => {
              const val = p.value;
              const formattedVal = typeof val === 'number' ? val.toLocaleString('es-PE', { minimumFractionDigits: 2 }) : val;
              html += `<div style="display:flex;justify-content:space-between;gap:12px;font-size:11px;margin-top:2px;">
                <span style="color:#475569;">${p.seriesName}:</span>
                <span style="font-weight:bold;color:#0F172A;">${formattedVal}</span>
              </div>`;
            });
            return html;
          }
        },
        grid: { left: '3%', right: '4%', bottom: '12%', top: '10%', containLabel: true },
        xAxis: {
          type: 'category',
          data: xAxisData,
          axisTick: { alignWithLabel: true },
          axisLabel: { 
            fontWeight: 'bold', 
            fontSize: 11, 
            rotate: xAxisData.length > 4 ? 25 : 0,
            color: '#334155' 
          }
        },
        yAxis: [
          {
            type: 'value',
            name: getMetricLabel(primaryMetric),
            nameTextStyle: { fontWeight: 'bold', fontSize: 11, color: '#4F46E5' },
            axisLabel: { formatter: (val: number) => val >= 1000 ? `${(val / 1000).toFixed(0)}k` : String(val) },
            splitLine: { lineStyle: { type: 'dashed', color: '#E2E8F0' } }
          },
          {
            type: 'value',
            name: secondaryMetric !== 'none' ? getMetricLabel(secondaryMetric) : '',
            nameTextStyle: { fontWeight: 'bold', fontSize: 11, color: '#059669' },
            show: secondaryMetric !== 'none',
            splitLine: { show: false }
          }
        ],
        series: [...priSeries, ...secSeries]
      };
    }

    // -----------------------------------------------------------------------
    // CASO 2: PERIODO FIJO + TODOS LOS FONDOS -> EJE X = LÍNEA DE FONDOS
    // -----------------------------------------------------------------------
    if (isPeriodoFijo && !isFondoFijo) {
      const selectedPeriod = periodosData.find(p => p.id === filterPeriodo);
      const participes = selectedPeriod ? selectedPeriod.participes.filter(p => {
        if (filterAsesor !== 'ALL' && p.id_asesor !== filterAsesor) return false;
        if (filterMoneda !== 'ALL' && p.moneda !== filterMoneda) return false;
        return true;
      }) : [];

      // Identificar Fondos presentes (Eje X)
      const fondosMap = new Map<string, string>();
      participes.forEach(part => {
        fondosMap.set(part.id_fondo, part.nombre_fondo || part.id_fondo);
      });
      const fondosList = Array.from(fondosMap.entries()).map(([id, nombre]) => ({ id, nombre }));
      const xAxisData = fondosList.map(f => f.nombre);

      // Identificar Asesores (Series del Stack)
      const asesoresTotalesMap = new Map<string, number>();
      const seriesMatrix: Record<string, {
        comision_total: number[];
        capital_base: number[];
        tasa_sum: number[];
        capital_for_tasa: number[];
      }> = {};

      participes.forEach(part => {
        const aKey = part.nombre_asesor || part.id_asesor;
        asesoresTotalesMap.set(aKey, (asesoresTotalesMap.get(aKey) || 0) + part.comision_calculada);

        if (!seriesMatrix[aKey]) {
          seriesMatrix[aKey] = {
            comision_total: new Array(fondosList.length).fill(0),
            capital_base: new Array(fondosList.length).fill(0),
            tasa_sum: new Array(fondosList.length).fill(0),
            capital_for_tasa: new Array(fondosList.length).fill(0),
          };
        }

        const fondoIdx = fondosList.findIndex(f => f.id === part.id_fondo);
        if (fondoIdx >= 0) {
          const s = seriesMatrix[aKey];
          s.comision_total[fondoIdx] += part.comision_calculada;
          s.capital_base[fondoIdx] += part.capital_base;
          s.tasa_sum[fondoIdx] += (part.tasa_comision_asesor * part.capital_base);
          s.capital_for_tasa[fondoIdx] += part.capital_base;
        }
      });

      // ORDEN DE APILAMIENTO REQUERIDO POR EL USUARIO:
      // "Dentro de un stack siempre que las mayores comisiones estén ABAJO y va subiendo a la comisión más pequeña"
      // En ECharts, el primer elemento en series[] se dibuja en la base del stack (ABAJO).
      // Por tanto, ordenamos DESCENDENTE por comision total: los que mas ganan van primero (abajo).
      const sortedAsesorKeys = Array.from(asesoresTotalesMap.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([k]) => k);

      const priSeries = sortedAsesorKeys.map((aKey, aIdx) => {
        const s = seriesMatrix[aKey];
        const sColor = ASESOR_COLORS[aIdx % ASESOR_COLORS.length];
        const dataArr = s.comision_total.map(v => Math.round(v * 100) / 100);

        return {
          name: aKey,
          type: 'bar',
          stack: 'stack_fondos',
          yAxisIndex: 0,
          barMaxWidth: 45,
          itemStyle: { color: sColor },
          data: dataArr
        };
      });

      return {
        tooltip: {
          trigger: 'axis',
          axisPointer: { type: 'cross' },
          formatter: (params: any[]) => {
            if (!params || params.length === 0) return '';
            const fondoName = params[0].axisValue;
            let totalFondo = 0;
            let html = `<div style="font-weight:bold;margin-bottom:6px;border-bottom:1px solid #cbd5e1;padding-bottom:3px;font-size:12px;color:#0f172a;">
              🏛️ Fondo: ${fondoName}
            </div>`;

            params.forEach(p => {
              const val = Number(p.value) || 0;
              if (val > 0) {
                totalFondo += val;
                html += `<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:11px;margin-top:2px;">
                  <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background-color:${p.color};"></span>
                  <span style="color:#475569;max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${p.seriesName}:</span>
                  <span style="font-weight:bold;color:#0F172A;">${val.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span>
                </div>`;
              }
            });

            if (totalFondo > 0) {
              html += `<div style="margin-top:6px;padding-top:4px;border-top:1px dashed #cbd5e1;display:flex;justify-content:space-between;font-size:11px;font-weight:bold;color:#4338ca;">
                <span>Total Comisiones Fondo:</span>
                <span>${totalFondo.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span>
              </div>`;
            }

            return html;
          }
        },
        legend: { top: 0, type: 'scroll', textStyle: { fontSize: 11, fontWeight: 'bold', color: '#334155' } },
        grid: { left: '3%', right: '4%', bottom: '10%', top: '10%', containLabel: true },
        xAxis: {
          type: 'category',
          data: xAxisData,
          axisTick: { alignWithLabel: true },
          axisLabel: { fontWeight: 'bold', fontSize: 11, color: '#334155' }
        },
        yAxis: [
          {
            type: 'value',
            name: 'Comisión por Fondo (PEN / USD)',
            nameTextStyle: { fontWeight: 'bold', fontSize: 11, color: '#4F46E5' },
            axisLabel: { formatter: (val: number) => val >= 1000 ? `${(val / 1000).toFixed(0)}k` : String(val) },
            splitLine: { lineStyle: { type: 'dashed', color: '#E2E8F0' } }
          }
        ],
        series: priSeries
      };
    }

    // -----------------------------------------------------------------------
    // CASO 3: MULTITEMPORAL (TODOS LOS PERÍODOS) -> EJE X = LÍNEA DE MESES
    // -----------------------------------------------------------------------
    const sortedPeriodos = [...periodosData].sort((a, b) => a.mes_num - b.mes_num);
    const xAxisData = sortedPeriodos.map(p => `${p.mes_nombre.slice(0, 3)} ${selectedYear}`);

    // Extraer todas las series segun GroupBy
    const seriesTotalsMap = new Map<string, number>();
    const seriesDataMap: Record<string, {
      comision_total: number[];
      capital_base: number[];
      tasa_sum_weighted: number[];
      capital_for_tasa: number[];
      participes_set: Set<string>[];
      contratos_count: number[];
    }> = {};

    sortedPeriodos.forEach((p: PeriodoComisionGroup, pIdx: number) => {
      p.participes.forEach((part: ParticipeComisionItem) => {
        if (filterFondo !== 'ALL' && part.id_fondo !== filterFondo) return;
        if (filterAsesor !== 'ALL' && part.id_asesor !== filterAsesor) return;
        if (filterMoneda !== 'ALL' && part.moneda !== filterMoneda) return;

        let sKey = part.nombre_asesor || part.id_asesor;
        if (groupBy === 'fondo') sKey = part.nombre_fondo || part.id_fondo;
        if (groupBy === 'moneda') sKey = part.moneda;

        seriesTotalsMap.set(sKey, (seriesTotalsMap.get(sKey) || 0) + part.comision_calculada);

        if (!seriesDataMap[sKey]) {
          seriesDataMap[sKey] = {
            comision_total: new Array(sortedPeriodos.length).fill(0),
            capital_base: new Array(sortedPeriodos.length).fill(0),
            tasa_sum_weighted: new Array(sortedPeriodos.length).fill(0),
            capital_for_tasa: new Array(sortedPeriodos.length).fill(0),
            participes_set: Array.from({ length: sortedPeriodos.length }, () => new Set<string>()),
            contratos_count: new Array(sortedPeriodos.length).fill(0),
          };
        }

        const sData = seriesDataMap[sKey];
        sData.comision_total[pIdx] += part.comision_calculada;
        sData.capital_base[pIdx] += part.capital_base;
        sData.tasa_sum_weighted[pIdx] += (part.tasa_comision_asesor * part.capital_base);
        sData.capital_for_tasa[pIdx] += part.capital_base;
        sData.participes_set[pIdx].add(part.inversionista_nombre);
        sData.contratos_count[pIdx] += 1;
      });
    });

    // ORDEN DE APILAMIENTO DESCENDENTE: Los que mas ganan van abajo (primeros en series[])
    const sortedSeriesKeys = Array.from(seriesTotalsMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([k]) => k);

    const buildSeriesList = (metric: PlotMetric, graphType: string, yAxisIndex: number) => {
      if (metric === 'none') return [];

      const labelPos = yAxisIndex === 0 ? primaryLabelPos : secondaryLabelPos;
      const labelColor = yAxisIndex === 0 ? primaryLabelColor : secondaryLabelColor;
      const isStack = graphType === 'bar_stack';
      const isBar = graphType.includes('bar');
      const isArea = graphType === 'area';

      return sortedSeriesKeys.map((sKey, sIdx) => {
        const sData = seriesDataMap[sKey];
        const sColor = getColorForKey(sKey, sIdx, groupBy);

        let dataArr: number[] = [];

        if (metric === 'comision_total') {
          dataArr = sData.comision_total.map(v => Math.round(v * 100) / 100);
        } else if (metric === 'capital_base') {
          dataArr = sData.capital_base.map(v => Math.round(v));
        } else if (metric === 'tasa_promedio') {
          dataArr = sData.tasa_sum_weighted.map((tw, idx) => {
            const cap = sData.capital_for_tasa[idx];
            return cap > 0 ? Math.round((tw / cap) * 100) / 100 : 0;
          });
        } else if (metric === 'num_participes') {
          dataArr = sData.participes_set.map(set => set.size);
        } else if (metric === 'num_operaciones') {
          dataArr = sData.contratos_count;
        }

        if (yAxisIndex === 1 && isSecondaryCumulative) {
          let runningTotal = 0;
          dataArr = dataArr.map(v => {
            runningTotal += v;
            return Math.round(runningTotal * 100) / 100;
          });
        }

        return {
          name: `${sKey} ${yAxisIndex === 1 ? '(Sec)' : ''}`,
          type: isBar ? 'bar' : 'line',
          stack: isStack ? 'stack_primary' : undefined,
          yAxisIndex: yAxisIndex,
          smooth: !isBar,
          areaStyle: isArea ? { opacity: 0.25, color: sColor } : undefined,
          barMaxWidth: 35,
          barGap: '15%',
          data: dataArr,
          itemStyle: {
            borderRadius: isBar ? (isStack ? [0, 0, 0, 0] : [4, 4, 0, 0]) : undefined,
            color: sColor
          },
          lineStyle: !isBar ? { width: 3, type: yAxisIndex === 1 ? 'dashed' : 'solid' } : undefined,
          label: {
            show: labelPos !== 'none',
            position: labelPos === 'none' ? undefined : labelPos,
            formatter: (params: any) => {
              const val = typeof params.data === 'object' ? params.data?.value : params.value;
              if (!val || val === 0) return '';
              if (metric === 'tasa_promedio') return `${val}%`;
              if (val >= 1000) return `${(val / 1000).toFixed(1)}k`;
              return String(val);
            },
            fontSize: 9,
            fontWeight: 'bold',
            color: labelColor
          }
        };
      });
    };

    const priSeries = buildSeriesList(primaryMetric, primaryGraphType, 0);
    const secSeries = buildSeriesList(secondaryMetric, secondaryGraphType, 1);

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross', crossStyle: { color: '#94A3B8' } },
        formatter: (params: any[]) => {
          if (!params || params.length === 0) return '';
          const pName = params[0].axisValue;

          let totalPriPeriod = 0;
          let html = `<div style="font-weight:bold;margin-bottom:6px;border-bottom:1px solid #cbd5e1;padding-bottom:3px;font-size:12px;color:#0f172a;">
            📅 Período: ${pName}
          </div>`;

          params.forEach(p => {
            const val = typeof p.data === 'object' ? p.data?.value : p.value;
            if (val !== undefined && val !== null && val > 0) {
              const isSec = p.seriesName.includes('(Sec)');
              if (!isSec) totalPriPeriod += Number(val);

              const formattedVal = primaryMetric === 'tasa_promedio' || (isSec && secondaryMetric === 'tasa_promedio')
                ? `${val.toFixed(2)}% aa`
                : `${val.toLocaleString('es-PE', { minimumFractionDigits: 2 })}`;

              html += `<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:11px;margin-top:2px;">
                <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background-color:${p.color};"></span>
                <span style="color:#475569;max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${p.seriesName}:</span>
                <span style="font-weight:bold;color:#0F172A;">${formattedVal}</span>
              </div>`;
            }
          });

          if (primaryGraphType === 'bar_stack' && totalPriPeriod > 0) {
            html += `<div style="margin-top:6px;padding-top:4px;border-top:1px dashed #cbd5e1;display:flex;justify-content:space-between;font-size:11px;font-weight:bold;color:#4338ca;">
              <span>Total Período:</span>
              <span>${totalPriPeriod.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span>
            </div>`;
          }

          return html;
        }
      },
      legend: {
        top: 0,
        type: 'scroll',
        textStyle: { fontSize: 11, fontWeight: 'bold', color: '#334155' }
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '8%',
        top: '10%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: xAxisData,
        axisTick: { alignWithLabel: true },
        axisLine: { lineStyle: { color: '#64748B', width: 1.5 } },
        axisLabel: { fontWeight: 'bold', fontSize: 11, color: '#334155' }
      },
      yAxis: [
        {
          type: 'value',
          name: getMetricLabel(primaryMetric),
          nameTextStyle: { fontWeight: 'bold', fontSize: 11, color: '#4F46E5' },
          axisLabel: {
            formatter: (val: number) => {
              if (primaryMetric === 'tasa_promedio') return `${val}%`;
              return val >= 1000 ? `${(val / 1000).toFixed(0)}k` : String(val);
            }
          },
          splitLine: { lineStyle: { type: 'dashed', color: '#E2E8F0' } }
        },
        {
          type: 'value',
          name: secondaryMetric !== 'none' ? `${getMetricLabel(secondaryMetric)}${isSecondaryCumulative ? ' (Acum)' : ''}` : '',
          nameTextStyle: { fontWeight: 'bold', fontSize: 11, color: '#059669' },
          show: secondaryMetric !== 'none',
          axisLabel: {
            formatter: (val: number) => {
              if (secondaryMetric === 'tasa_promedio') return `${val}%`;
              return val >= 1000 ? `${(val / 1000).toFixed(0)}k` : String(val);
            }
          },
          splitLine: { show: false }
        }
      ],
      series: [...priSeries, ...secSeries]
    };
  }, [
    periodosData, 
    groupBy, 
    primaryMetric, 
    primaryGraphType, 
    secondaryMetric, 
    secondaryGraphType, 
    isSecondaryCumulative, 
    filterPeriodo,
    filterFondo, 
    filterAsesor, 
    filterMoneda,
    selectedYear
  ]);

  // Dropdown helper de filtros
  const renderFilterDropdown = (
    selectedVal: string,
    onSelect: (val: string) => void,
    optionsList: { id: string; nombre: string }[],
    isOpen: boolean,
    setIsOpen: (open: boolean) => void,
    title: string
  ) => {
    const selectedObj = optionsList.find(o => o.id === selectedVal);
    const displayLabel = selectedVal === 'ALL' ? `Todos (${title})` : (selectedObj ? selectedObj.nombre : selectedVal);

    return (
      <div className="relative w-full" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => {
            setIsPeriodoFilterOpen(false);
            setIsFondoFilterOpen(false);
            setIsAsesorFilterOpen(false);
            setIsPriOpen(false);
            setIsSecOpen(false);
            setIsOpen(!isOpen);
          }}
          className="w-full h-8 flex items-center justify-between gap-1 px-2.5 text-[11px] bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-lg hover:border-indigo-400 focus:outline-none transition-all cursor-pointer text-slate-700 dark:text-slate-200 font-bold shadow-2xs"
          title={displayLabel}
        >
          <span className="truncate block flex-1 text-left">{displayLabel}</span>
          <ChevronDown size={12} className="text-slate-400 shrink-0" />
        </button>

        {isOpen && (
          <div className="absolute left-0 top-full mt-1 bg-white dark:bg-[#0f172a] border border-slate-300 dark:border-slate-700 rounded-xl shadow-2xl z-[9999] w-[280px] max-h-[300px] overflow-y-auto p-2 flex flex-col gap-1">
            <div className="px-2 py-1 text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
              <span>Seleccionar {title}</span>
              <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-700">x</button>
            </div>
            <button
              onClick={() => { onSelect('ALL'); setIsOpen(false); }}
              className={`text-left text-xs p-2 rounded-lg cursor-pointer flex items-center justify-between ${
                selectedVal === 'ALL' ? 'bg-indigo-600 text-white font-bold' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
              }`}
            >
              <span>Todos los {title}s</span>
              {selectedVal === 'ALL' && <span>ok</span>}
            </button>
            {optionsList.map(opt => (
              <button
                key={opt.id}
                onClick={() => { onSelect(opt.id); setIsOpen(false); }}
                className={`text-left text-xs p-2 rounded-lg cursor-pointer flex items-center justify-between gap-2 ${
                  opt.id === selectedVal ? 'bg-indigo-600 text-white font-bold' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200'
                }`}
                title={opt.nombre}
              >
                <span className="truncate">{opt.nombre}</span>
                {opt.id === selectedVal && <span className="shrink-0">ok</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  const handleResetFilters = () => {
    setGroupBy('asesor');
    setFilterPeriodo('ALL');
    setFilterFondo('ALL');
    setFilterAsesor('ALL');
    setFilterMoneda('ALL');
    setPrimaryMetric('comision_total');
    setPrimaryGraphType('bar_stack');
    setSecondaryMetric('tasa_promedio');
    setSecondaryGraphType('line');
    setIsSecondaryCumulative(false);
  };

  return (
    <div className="w-full">
      {/* TABLERO DE CONTROL Y GRAFICO INTERACTIVO */}
      <div className="bg-white dark:bg-[#0f172a] p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col lg:flex-row gap-5 items-stretch min-h-[640px]">
        
        {/* SIDEBAR IZQUIERDO DE CONTROLES */}
        <div className="flex flex-col gap-3 shrink-0 lg:w-[270px]">
          
          {/* BLOQUE 1: FILTROS & AGRUPACION */}
          <div className="bg-slate-50/80 dark:bg-slate-900/50 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[11px] font-black uppercase text-slate-700 dark:text-slate-300">
                <Layers size={14} className="text-indigo-600" />
                <span>Agrupar / Apilar Por:</span>
              </div>
              <button
                onClick={handleResetFilters}
                title="Restablecer filtros a valores por defecto"
                className="p-1 rounded-md text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <RotateCcw size={13} />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-1 bg-slate-200/70 dark:bg-slate-800 p-0.5 rounded-lg text-[10.5px] font-bold">
              <button
                onClick={() => setGroupBy('asesor')}
                className={`py-1.5 rounded-md cursor-pointer transition-all ${
                  groupBy === 'asesor' ? 'bg-indigo-600 text-white shadow-2xs font-black' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Asesor
              </button>
              <button
                onClick={() => setGroupBy('fondo')}
                className={`py-1.5 rounded-md cursor-pointer transition-all ${
                  groupBy === 'fondo' ? 'bg-indigo-600 text-white shadow-2xs font-black' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Fondo
              </button>
              <button
                onClick={() => setGroupBy('moneda')}
                className={`py-1.5 rounded-md cursor-pointer transition-all ${
                  groupBy === 'moneda' ? 'bg-indigo-600 text-white shadow-2xs font-black' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Moneda
              </button>
            </div>

            {/* Filtro Temporal: Periodo / Cierre */}
            <div className="flex flex-col gap-1 mt-1">
              <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500 uppercase">
                <Calendar size={11} className="text-indigo-500" />
                <span>Cierre / Período:</span>
              </div>
              {renderFilterDropdown(filterPeriodo, setFilterPeriodo, filterOptions.periodos, isPeriodoFilterOpen, setIsPeriodoFilterOpen, 'Cierre')}
            </div>

            {/* Filtro Fondo */}
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase">Fondo de Inversión:</span>
              {renderFilterDropdown(filterFondo, setFilterFondo, filterOptions.fondos, isFondoFilterOpen, setIsFondoFilterOpen, 'Fondo')}
            </div>

            {/* Filtro Asesor */}
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase">Asesor Comercial:</span>
              {renderFilterDropdown(filterAsesor, setFilterAsesor, filterOptions.asesores, isAsesorFilterOpen, setIsAsesorFilterOpen, 'Asesor')}
            </div>

            {/* Filtro Moneda */}
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase">Moneda:</span>
              <div className="grid grid-cols-3 gap-1 bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 p-0.5 rounded-lg text-[10px] font-bold">
                <button
                  onClick={() => setFilterMoneda('ALL')}
                  className={`py-1 rounded cursor-pointer ${filterMoneda === 'ALL' ? 'bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-300'}`}
                >
                  Todas
                </button>
                <button
                  onClick={() => setFilterMoneda('PEN')}
                  className={`py-1 rounded cursor-pointer ${filterMoneda === 'PEN' ? 'bg-emerald-600 text-white' : 'text-slate-600 dark:text-slate-300'}`}
                >
                  PEN
                </button>
                <button
                  onClick={() => setFilterMoneda('USD')}
                  className={`py-1 rounded cursor-pointer ${filterMoneda === 'USD' ? 'bg-sky-600 text-white' : 'text-slate-600 dark:text-slate-300'}`}
                >
                  USD
                </button>
              </div>
            </div>
          </div>

          {/* BLOQUE 2: EJE PRIMARIO */}
          <div className="bg-indigo-50/50 dark:bg-indigo-950/20 p-3 rounded-xl border border-indigo-200/80 dark:border-indigo-900/40 flex flex-col gap-2">
            <div className="text-[10.5px] font-black uppercase text-indigo-900 dark:text-indigo-300 flex items-center justify-between">
              <span>Eje Primario (Y1)</span>
              <span className="text-indigo-600">●</span>
            </div>

            {/* Metrica Primaria */}
            <div className="relative" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => { setIsPriOpen(!isPriOpen); setIsSecOpen(false); }}
                className="w-full h-8 flex items-center justify-between px-2.5 text-[11px] bg-white dark:bg-[#0f172a] border border-indigo-200 dark:border-indigo-800 rounded-lg font-bold text-indigo-950 dark:text-indigo-200 cursor-pointer shadow-2xs"
              >
                <span className="truncate">{getMetricLabel(primaryMetric)}</span>
                <ChevronDown size={12} className="text-indigo-500" />
              </button>

              {isPriOpen && (
                <div className="absolute left-0 top-full mt-1 bg-white dark:bg-[#0f172a] border border-indigo-200 dark:border-indigo-800 rounded-xl shadow-2xl z-[9999] w-[260px] p-1.5 flex flex-col gap-1">
                  {metricOptionsList.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => { setPrimaryMetric(opt.value); setIsPriOpen(false); }}
                      className={`text-left p-2 rounded-lg cursor-pointer flex flex-col ${
                        primaryMetric === opt.value ? 'bg-indigo-600 text-white font-bold' : 'hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 text-xs font-bold">
                        <span>{opt.icon}</span>
                        <span>{opt.label}</span>
                      </div>
                      <span className={`text-[9.5px] mt-0.5 ${primaryMetric === opt.value ? 'text-indigo-100' : 'text-slate-400'}`}>
                        {opt.desc}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Tipo de Grafico Primario */}
            <div className="grid grid-cols-4 gap-1 bg-white dark:bg-[#0f172a] border border-indigo-100 dark:border-indigo-900 p-0.5 rounded-lg text-[9.5px] font-bold">
              <button
                onClick={() => setPrimaryGraphType('bar_stack')}
                className={`py-1 rounded cursor-pointer ${primaryGraphType === 'bar_stack' ? 'bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-400'}`}
                title="Barras Apiladas"
              >
                Stack
              </button>
              <button
                onClick={() => setPrimaryGraphType('bar_group')}
                className={`py-1 rounded cursor-pointer ${primaryGraphType === 'bar_group' ? 'bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-400'}`}
                title="Barras Agrupadas"
              >
                Barras
              </button>
              <button
                onClick={() => setPrimaryGraphType('line')}
                className={`py-1 rounded cursor-pointer ${primaryGraphType === 'line' ? 'bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-400'}`}
                title="Lineas"
              >
                Linea
              </button>
              <button
                onClick={() => setPrimaryGraphType('area')}
                className={`py-1 rounded cursor-pointer ${primaryGraphType === 'area' ? 'bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-400'}`}
                title="Area"
              >
                Area
              </button>
            </div>
          </div>

          {/* BLOQUE 3: EJE SECUNDARIO */}
          <div className="bg-emerald-50/50 dark:bg-emerald-950/20 p-3 rounded-xl border border-emerald-200/80 dark:border-emerald-900/40 flex flex-col gap-2">
            <div className="text-[10.5px] font-black uppercase text-emerald-900 dark:text-emerald-300 flex items-center justify-between">
              <span>Eje Secundario (Y2)</span>
              <span className="text-emerald-600">●</span>
            </div>

            {/* Metrica Secundaria */}
            <div className="relative" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => { setIsSecOpen(!isSecOpen); setIsPriOpen(false); }}
                className="w-full h-8 flex items-center justify-between px-2.5 text-[11px] bg-white dark:bg-[#0f172a] border border-emerald-200 dark:border-emerald-800 rounded-lg font-bold text-emerald-950 dark:text-emerald-200 cursor-pointer shadow-2xs"
              >
                <span className="truncate">{secondaryMetric === 'none' ? 'Desactivado' : getMetricLabel(secondaryMetric)}</span>
                <ChevronDown size={12} className="text-emerald-500" />
              </button>

              {isSecOpen && (
                <div className="absolute left-0 top-full mt-1 bg-white dark:bg-[#0f172a] border border-emerald-200 dark:border-emerald-800 rounded-xl shadow-2xl z-[9999] w-[260px] p-1.5 flex flex-col gap-1">
                  <button
                    onClick={() => { setSecondaryMetric('none'); setIsSecOpen(false); }}
                    className={`text-left p-2 rounded-lg cursor-pointer text-xs font-bold ${
                      secondaryMetric === 'none' ? 'bg-emerald-600 text-white' : 'hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-slate-800 dark:text-slate-200'
                    }`}
                  >
                    Desactivar Eje Secundario
                  </button>
                  {metricOptionsList.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => { setSecondaryMetric(opt.value); setIsSecOpen(false); }}
                      className={`text-left p-2 rounded-lg cursor-pointer flex flex-col ${
                        secondaryMetric === opt.value ? 'bg-emerald-600 text-white font-bold' : 'hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 text-xs font-bold">
                        <span>{opt.icon}</span>
                        <span>{opt.label}</span>
                      </div>
                      <span className={`text-[9.5px] mt-0.5 ${secondaryMetric === opt.value ? 'text-emerald-100' : 'text-slate-400'}`}>
                        {opt.desc}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Controles Secundarios: Tipo y Acumulado */}
            {secondaryMetric !== 'none' && (
              <div className="flex items-center justify-between gap-2 mt-1">
                <div className="grid grid-cols-2 gap-1 bg-white dark:bg-[#0f172a] border border-emerald-100 dark:border-emerald-900 p-0.5 rounded-lg text-[9.5px] font-bold flex-1">
                  <button
                    onClick={() => setSecondaryGraphType('line')}
                    className={`py-1 rounded cursor-pointer ${secondaryGraphType === 'line' ? 'bg-emerald-600 text-white' : 'text-slate-600 dark:text-slate-400'}`}
                  >
                    Linea
                  </button>
                  <button
                    onClick={() => setSecondaryGraphType('bar')}
                    className={`py-1 rounded cursor-pointer ${secondaryGraphType === 'bar' ? 'bg-emerald-600 text-white' : 'text-slate-600 dark:text-slate-400'}`}
                  >
                    Barras
                  </button>
                </div>

                <label className="flex items-center gap-1 text-[10px] font-bold text-slate-600 dark:text-slate-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isSecondaryCumulative}
                    onChange={(e) => setIsSecondaryCumulative(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Acumular</span>
                </label>
              </div>
            )}
          </div>
        </div>

        {/* AREA PRINCIPAL: GRAFICO DE APACHE ECHARTS */}
        <div className="flex-1 min-w-0 bg-[#fafafa] dark:bg-[#0b1329] border border-slate-200 dark:border-slate-800 rounded-xl p-3 flex flex-col justify-center">
          <ReactECharts
            ref={echartsRef}
            option={options}
            style={{ height: '580px', width: '100%' }}
            opts={{ renderer: 'svg' }}
          />
        </div>

      </div>
    </div>
  );
};
