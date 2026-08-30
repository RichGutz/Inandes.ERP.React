import { supabase } from './supabaseClient';
import { generateRetornosV40 } from '../utils/financialCalculator';

export interface Fondo {
  id_fondo_plazo?: string;
  id_fondo: string;
  nombre_fondo: string;
  moneda: string; // PEN, USD
  ruc_fondo?: string | null;
  tamanho_maximo_fondo?: number | null;
  fecha_cierre_fondo?: string | null;
  frecuencia_cupones_meses?: number | null;
  comision_administracion_fondo?: number | null;
  comision_captacion_fondo?: number | null;
  comision_miscelaneos_fondo?: number | null;
  monto_minimo_inversion?: number | null;
  vigencia_tasa?: string | null;
  activo?: boolean | null;
  
  // Plazos
  plazo_inversion: string; // '12', '24', '36', 'ND', etc.
  tasa?: number | null; // TEA %
  tasa_activa?: number | null; // TEA Activa %
  penalidad_rescate?: number | null;
  plazo_rescate_meses?: number | null;
  plazo_opcion_de_rescate_dias?: number | null;
  valor_cuota_inicial?: number | null;

  // Asesor comisiones configurables por plazo
  comision_asesor_mantenimiento?: number | null;
  comision_asesor_primer_ano?: number | null;
  comision_asesor_unica?: number | null;
}

/**
 * Consulta todos los plazos/variantes de fondos de la base de datos.
 */
export const getFondos = async (): Promise<Fondo[]> => {
  const { data, error } = await supabase
    .from('crm_fondos')
    .select('*')
    .order('vigencia_tasa', { ascending: false })
    .order('nombre_fondo', { ascending: true });

  if (error) {
    console.error('Error en getFondos:', error.message);
    throw new Error(`Error al cargar fondos: ${error.message}`);
  }

  return data as Fondo[];
};

/**
 * Guarda o actualiza registros de fondos/plazos en lote.
 */
export const upsertFondos = async (fondos: Fondo[]): Promise<Fondo[]> => {
  const { data, error } = await supabase
    .from('crm_fondos')
    .upsert(fondos)
    .select();

  if (error) {
    console.error('Error en upsertFondos:', error.message);
    throw new Error(`Error al guardar fondos: ${error.message}`);
  }

  return data as Fondo[];
};

// Interfaz para fila de simulación diaria
export interface V26Row {
  tipo: 'CERT' | 'AUMENTO' | 'TOTAL' | 'SPACER';
  id: string;
  num?: number;
  css_class: string;
  label_class: string;
  is_vc: boolean;
  capital?: number;
  cuotas?: number;
  interes_acum?: number;
  cells: Array<{ val: number | string; css: string }>;
}

export interface V26Block {
  idx: number;
  monthName: string;
  days: string[];
  rows: V26Row[];
}

export interface V26FondoReport {
  fondo: Fondo;
  blocks: V26Block[];
  vars: {
    activa: string;
    admin: string;
  };
}

/**
 * Motor de Cálculo de Valor Cuota v26 en TypeScript.
 * Realiza la simulación contable día a día del periodo seleccionado para un fondo (o todos).
 */
export const calculateValorCuotaV26 = async (
  codigoFondo: string | null = null,
  startDate: Date,
  endDate: Date
): Promise<V26FondoReport[]> => {
  // 1. Cargar Fondos en el mismo orden que la pestaña Fondos (Variables)
  const { data: fondosData, error: fondosErr } = await supabase
    .from('crm_fondos')
    .select('*')
    .order('vigencia_tasa', { ascending: false })
    .order('nombre_fondo', { ascending: true });
    
  if (fondosErr) throw new Error(`Error en fondos: ${fondosErr.message}`);
  if (!fondosData) return [];

  // Filtrar por fondo si aplica
  const fondosFiltrados = codigoFondo 
    ? fondosData.filter(f => f.id_fondo === codigoFondo)
    : fondosData;

  if (fondosFiltrados.length === 0) return [];

  // Agrupar por id_fondo para obtener las variables maestras de cada uno
  const fondosUnicosMap: Record<string, Fondo> = {};
  for (const f of fondosFiltrados) {
    if (!fondosUnicosMap[f.id_fondo]) {
      fondosUnicosMap[f.id_fondo] = f as Fondo;
    }
  }

  // 2. Ejecutar Motor Oficial de Retornos y Rendimientos V40 para obtener contratos e intereses diarios homologados
  const formatYMD = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  const fStartStr = formatYMD(startDate);
  const fEndStr = formatYMD(endDate);
  const retornosCalc = await generateRetornosV40(codigoFondo, fStartStr, fEndStr);

  // 3. Configurar el rango de días en el periodo
  const diasPeriodo: Date[] = [];
  let curr = new Date(startDate);
  curr.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);

  while (curr <= end) {
    diasPeriodo.push(new Date(curr));
    curr.setDate(curr.getDate() + 1);
  }

  const reports: V26FondoReport[] = [];
  const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

  for (const fondo of Object.values(fondosUnicosMap)) {
    const fid = fondo.id_fondo;
    const tActiva = Number(fondo.tasa_activa || 0) / 100;
    const pAdmin  = Number(fondo.comision_administracion_fondo || 0) / 100;
    const pCap    = Number(fondo.comision_captacion_fondo || 0) / 100;
    const pMisc   = Number(fondo.comision_miscelaneos_fondo || 0) / 100;

    // Obtener datos calculados desde el motor oficial de Retornos V40
    const fondoRetornoData = retornosCalc.pdfData.find((p: any) => p.fondo?.id_fondo === fid);
    const rawRows = (fondoRetornoData?.rows && fondoRetornoData.rows.length > 0)
      ? fondoRetornoData.rows
      : (fondoRetornoData?.blocks?.[0]?.rows || []);
    if (rawRows.length === 0) continue;

    // Inicializar filas de contratos mapeadas desde Retornos V40
    const certRows: any[] = [];
    let currentPadre: any = null;

    for (const r of rawRows) {
      if (r.tipo === 'AUMENTO') {
        const aumentoObj = {
          tipo: 'AUMENTO',
          id: r.id || 'Aumento',
          monto: Number(r.capital || 0),
          fecha_ingreso: r.fecha ? new Date(r.fecha) : (r.fecha_inicio ? new Date(r.fecha_inicio) : new Date(startDate)),
          valores_dia: (r.valores || []).slice(),
          interes_acum: Number(r.bruto_total || 0)
        };
        if (currentPadre) {
          currentPadre.hijos.push(aumentoObj);
        } else {
          certRows.push({
            tipo: 'CERT',
            id: r.id,
            capital: Number(r.capital || 0),
            cuotas: Number(r.capital || 0),
            emision: new Date(startDate),
            interes_acum: Number(r.bruto_total || 0),
            valores_dia: (r.valores || []).slice(),
            hijos: [aumentoObj]
          });
        }
      } else {
        const capIni = Number(r.capital || r.capital_base || 0);
        currentPadre = {
          tipo: 'CERT',
          id: r.id || r.id_contrato,
          capital: capIni,
          cuotas: capIni,
          emision: r.emision ? new Date(r.emision) : new Date(startDate),
          interes_acum: Number(r.bruto_total || r.interes_bruto || 0),
          valores_dia: (r.valores || r.valores_dia_padre || []).slice(),
          hijos: []
        };
        certRows.push(currentPadre);
      }
    }


    // Configurar filas de totales de resumen con distribución clara
    const summaryDefs = [
      { id: 'TOTAL CAPITAL (Apertura)', css: 'summary-row font-black' },
      { id: 'SPACER_1', css: 'spacer-row' },
      { id: '(+) CAPITAL ADICIONAL (Hoy)', css: 'summary-row text-emerald-600' },
      { id: '(=) CAPITAL ACUMULADO', css: 'summary-row' },
      { id: 'CUOTAS APERTURA', css: 'summary-row' },
      { id: '(+) CUOTAS ADICIONALES (Hoy)', css: 'summary-row text-emerald-600' },
      { id: '(=) CUOTAS TOTALES CIERRE', css: 'summary-row' },
      { id: 'VAL CUOTA INICIAL', css: 'vc-cell' },
      { id: 'SPACER_2', css: 'spacer-row' },
      { id: 'GANANCIA TOTAL BRUTA (Base 360)', css: 'summary-row' },
      { id: 'PATRIMONIO TOTAL (Pre-Aportes)', css: 'summary-row' },
      { id: 'COM. ADMIN (-) (Base 365)', css: 'summary-row text-rose-600' },
      { id: 'COM. CAPT. (-) (Base 365)', css: 'summary-row text-rose-600' },
      { id: 'COM. MISC. (-)', css: 'summary-row text-rose-600' },
      { id: 'GANANCIA OPERATIVA (Neta)', css: 'summary-row font-black' },
      { id: 'PATRIMONIO TOTAL CIERRE', css: 'summary-row font-black' },
      { id: 'VAL CUOTA FINAL', css: 'vc-cell' }
    ];

    const summaryRows: any[] = summaryDefs.map(def => ({
      tipo: def.id.startsWith('SPACER') ? 'SPACER' : 'TOTAL',
      id: def.id,
      css_class: def.css,
      valores_dia: [] as number[]
    }));

    // Simulación día a día V27 (Integrada con devengos de Retornos)
    let patAyer = certRows.reduce((acc, c) => acc + c.capital, 0);
    let cuotasAyer = certRows.reduce((acc, c) => acc + c.cuotas, 0);
    let fInvAcu = patAyer;
    let vCuoAyer = 1.0;

    for (let dayIdx = 0; dayIdx < diasPeriodo.length; dayIdx++) {
      const d = diasPeriodo[dayIdx];

      // 1. Devengos de Comisiones Gestor (Base 365)
      const gAdmD  = patAyer * (pAdmin / 365.0);
      const gCapD  = patAyer * (pCap / 365.0);
      const gMiscD = patAyer * (pMisc / 365.0);

      // 2. Suma de intereses diarios provenientes DIRECTAMENTE del motor de Retornos V40
      let pagoInvD = 0.0;
      for (const r of certRows) {
        const vD = r.valores_dia[dayIdx] || 0.0;
        pagoInvD += vD;

        for (const h of r.hijos) {
          const vDh = h.valores_dia[dayIdx] || 0.0;
          pagoInvD += vDh;
        }
      }

      // 3. Aumentos de capital del día
      let apD = 0.0;
      let nuevasCuotasD = 0.0;
      for (const r of certRows) {
        for (const h of r.hijos) {
          if (h.fecha_ingreso && h.fecha_ingreso.getTime() === d.getTime()) {
            const nuevasCuotas = Math.trunc(h.monto / vCuoAyer);
            apD += h.monto;
            nuevasCuotasD += nuevasCuotas;
          }
        }
      }

      fInvAcu += apD;

      // 4. Ingreso Bruto Activo Diario
      const egresosD = pagoInvD + gAdmD + gCapD + gMiscD;
      const iBrutoD = patAyer * (tActiva > 0 ? (tActiva / 360.0) : (0.14 / 360.0));

      // 5. Cierre Contable Diario
      const cuotasTotalesCierre = cuotasAyer + nuevasCuotasD;
      const patCierre = patAyer + apD + iBrutoD;
      const vCuoH = cuotasTotalesCierre > 0 ? patCierre / cuotasTotalesCierre : 1.0;

      // Guardar valores en las filas de resumen
      const setSummaryVal = (label: string, value: number) => {
        const sRow = summaryRows.find(s => s.id === label);
        if (sRow) sRow.valores_dia.push(value);
      };

      setSummaryVal('TOTAL CAPITAL (Apertura)', patAyer);
      setSummaryVal('(+) CAPITAL ADICIONAL (Hoy)', apD);
      setSummaryVal('(=) CAPITAL ACUMULADO', fInvAcu);
      setSummaryVal('CUOTAS APERTURA', cuotasAyer);
      setSummaryVal('(+) CUOTAS ADICIONALES (Hoy)', nuevasCuotasD);
      setSummaryVal('(=) CUOTAS TOTALES CIERRE', cuotasTotalesCierre);
      setSummaryVal('VAL CUOTA INICIAL', vCuoAyer);
      setSummaryVal('GANANCIA TOTAL BRUTA (Base 360)', iBrutoD);
      setSummaryVal('PATRIMONIO TOTAL (Pre-Aportes)', patAyer + iBrutoD);
      setSummaryVal('COM. ADMIN (-) (Base 365)', gAdmD);
      setSummaryVal('COM. CAPT. (-) (Base 365)', gCapD);
      setSummaryVal('COM. MISC. (-)', gMiscD);
      setSummaryVal('GANANCIA OPERATIVA (Neta)', iBrutoD - egresosD);
      setSummaryVal('PATRIMONIO TOTAL CIERRE', patCierre);
      setSummaryVal('VAL CUOTA FINAL', vCuoH);

      // Actualizar saldos para el día siguiente
      patAyer = patCierre;
      cuotasAyer = cuotasTotalesCierre;
      vCuoAyer = vCuoH;
    }

    // Aplanar las filas en orden de renderizado: Certificado -> Aumentos asociados
    const blockRowsMeta: any[] = [];
    let numCert = 1;
    for (const r of certRows) {
      r.num = numCert++;
      r.css_class = "";
      r.label_class = "";
      blockRowsMeta.push(r);
      for (const h of r.hijos) {
        h.css_class = "aumento-row";
        h.label_class = "aumento-label text-slate-400 font-mono text-[9px] pl-2";
        blockRowsMeta.push(h);
      }
    }
    blockRowsMeta.push(...summaryRows);

    // Agrupar fechas en meses
    const monthsGroup: Record<string, number[]> = {};
    for (let i = 0; i < diasPeriodo.length; i++) {
      const d = diasPeriodo[i];
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (!monthsGroup[key]) monthsGroup[key] = [];
      monthsGroup[key].push(i);
    }

    // Generar bloques mensuales para el reporte
    const blocks: V26Block[] = [];
    let blockIdx = 1;

    for (const [key, idxs] of Object.entries(monthsGroup)) {
      const [year, monthIdx] = key.split('-').map(Number);
      const monthName = `${monthNames[monthIdx]} ${year}`;
      const blockDays = idxs.map(i => {
        const d = diasPeriodo[i];
        return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
      });

      const blockRows: V26Row[] = [];

      for (const r of blockRowsMeta) {
        if (r.tipo === 'SPACER') {
          blockRows.push({
            tipo: 'SPACER',
            id: r.id,
            css_class: 'spacer-row h-2 bg-slate-50 dark:bg-slate-900/50',
            label_class: '',
            is_vc: false,
            cells: []
          });
          continue;
        }

        const isVc = r.id === 'VAL CUOTA INICIAL' || r.id === 'VAL CUOTA FINAL';
        const startIdx = idxs[0];
        const endIdx = idxs[idxs.length - 1] + 1;
        const dailyCells = r.valores_dia.slice(startIdx, endIdx).map((val: number) => ({
          val,
          css: isVc ? 'font-black text-blue-600 dark:text-blue-400' : ''
        }));

        blockRows.push({
          tipo: r.tipo,
          id: r.id,
          num: r.num,
          css_class: r.css_class,
          label_class: r.label_class,
          is_vc: isVc,
          capital: r.tipo === 'CERT' ? r.capital : r.monto,
          cuotas: r.cuotas,
          interes_acum: r.interes_acum,
          cells: dailyCells
        });
      }

      blocks.push({
        idx: blockIdx++,
        monthName,
        days: blockDays,
        rows: blockRows
      });
    }

    reports.push({
      fondo,
      blocks,
      vars: {
        activa: (tActiva * 100).toFixed(2),
        admin: (pAdmin * 100).toFixed(2)
      }
    });
  }

  return reports;
};

export const calculateValorCuotaV27 = calculateValorCuotaV26;

// =========================================================================
// MOTOR V28: GOAL SEEK DE TASA ACTIVA IMPLÍCITA MENSUAL (P&L OPERATIVO = 0)
// =========================================================================

export const calculateValorCuotaV28 = async (
  codigoFondo: string | null,
  startDate: Date,
  endDate: Date
): Promise<V26FondoReport[]> => {
  const { data: fondosData, error: fondosErr } = await supabase
    .from('crm_fondos')
    .select('*')
    .order('vigencia_tasa', { ascending: false })
    .order('nombre_fondo', { ascending: true });

  if (fondosErr) throw new Error(`Error en crm_fondos: ${fondosErr.message}`);

  const fondosUnicosMap: Record<string, Fondo> = {};
  if (fondosData) {
    for (const f of fondosData) {
      if (!fondosUnicosMap[f.id_fondo]) {
        fondosUnicosMap[f.id_fondo] = f;
      }
    }
  }

  if (codigoFondo && codigoFondo !== 'TODOS') {
    for (const k of Object.keys(fondosUnicosMap)) {
      if (k !== codigoFondo) delete fondosUnicosMap[k];
    }
  }

  const formatYMD = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const fStartStr = formatYMD(startDate);
  const fEndStr = formatYMD(endDate);

  const retornosCalc = await generateRetornosV40(codigoFondo, fStartStr, fEndStr);

  const diasPeriodo: Date[] = [];
  const curr = new Date(startDate);
  curr.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);

  while (curr <= end) {
    diasPeriodo.push(new Date(curr));
    curr.setDate(curr.getDate() + 1);
  }

  const reports: V26FondoReport[] = [];
  const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

  for (const fondo of Object.values(fondosUnicosMap)) {
    const fid = fondo.id_fondo;
    const pAdmin  = Number(fondo.comision_administracion_fondo || 0) / 100;
    const pCap    = Number(fondo.comision_captacion_fondo || 0) / 100;
    const pMisc   = Number(fondo.comision_miscelaneos_fondo || 0) / 100;

    const fondoRetornoData = retornosCalc.pdfData.find((p: any) => p.fondo?.id_fondo === fid);
    const rawRows = (fondoRetornoData?.rows && fondoRetornoData.rows.length > 0)
      ? fondoRetornoData.rows
      : (fondoRetornoData?.blocks?.[0]?.rows || []);
    if (rawRows.length === 0) continue;

    const certRows: any[] = [];
    let currentPadre: any = null;

    for (const r of rawRows) {
      if (r.tipo === 'AUMENTO') {
        const aumentoObj = {
          tipo: 'AUMENTO',
          id: r.id || 'Aumento',
          monto: Number(r.capital || 0),
          fecha_ingreso: r.fecha ? new Date(r.fecha) : (r.fecha_inicio ? new Date(r.fecha_inicio) : new Date(startDate)),
          valores_dia: (r.valores || []).slice(),
          interes_acum: Number(r.bruto_total || 0)
        };
        if (currentPadre) {
          currentPadre.hijos.push(aumentoObj);
        } else {
          certRows.push({
            tipo: 'CERT',
            id: r.id,
            capital: Number(r.capital || 0),
            cuotas: Number(r.capital || 0),
            emision: new Date(startDate),
            interes_acum: Number(r.bruto_total || 0),
            valores_dia: (r.valores || []).slice(),
            hijos: [aumentoObj]
          });
        }
      } else {
        const capIni = Number(r.capital || r.capital_base || 0);
        currentPadre = {
          tipo: 'CERT',
          id: r.id || r.id_contrato,
          capital: capIni,
          cuotas: capIni,
          emision: r.emision ? new Date(r.emision) : new Date(startDate),
          interes_acum: Number(r.bruto_total || r.interes_bruto || 0),
          valores_dia: (r.valores || r.valores_dia_padre || []).slice(),
          hijos: []
        };
        certRows.push(currentPadre);
      }
    }

    // Configurar filas de totales de resumen con distribución clara
    const summaryDefs = [
      { id: 'TOTAL CAPITAL (Apertura)', css: 'summary-row font-black' },
      { id: 'SPACER_1', css: 'spacer-row' },
      { id: '(+) CAPITAL ADICIONAL (Hoy)', css: 'summary-row text-emerald-600' },
      { id: '(=) CAPITAL ACUMULADO', css: 'summary-row' },
      { id: 'CUOTAS APERTURA', css: 'summary-row' },
      { id: '(+) CUOTAS ADICIONALES (Hoy)', css: 'summary-row text-emerald-600' },
      { id: '(=) CUOTAS TOTALES CIERRE', css: 'summary-row' },
      { id: 'VAL CUOTA INICIAL', css: 'vc-cell' },
      { id: 'SPACER_2', css: 'spacer-row' },
      { id: 'GANANCIA TOTAL BRUTA (Base 360)', css: 'summary-row' },
      { id: 'PATRIMONIO TOTAL (Pre-Aportes)', css: 'summary-row' },
      { id: 'COM. ADMIN (-) (Base 365)', css: 'summary-row text-rose-600' },
      { id: 'COM. CAPT. (-) (Base 365)', css: 'summary-row text-rose-600' },
      { id: 'COM. MISC. (-)', css: 'summary-row text-rose-600' },
      { id: 'GANANCIA OPERATIVA (Neta)', css: 'summary-row font-black' },
      { id: 'PATRIMONIO TOTAL CIERRE', css: 'summary-row font-black' },
      { id: 'VAL CUOTA FINAL', css: 'vc-cell' }
    ];

    const summaryRows: any[] = summaryDefs.map(def => ({
      tipo: def.id.startsWith('SPACER') ? 'SPACER' : 'TOTAL',
      id: def.id,
      css_class: def.css,
      valores_dia: [] as number[]
    }));

    // Agrupar fechas en meses para calcular Goal Seek mensual
    const monthsGroup: Record<string, number[]> = {};
    for (let i = 0; i < diasPeriodo.length; i++) {
      const d = diasPeriodo[i];
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (!monthsGroup[key]) monthsGroup[key] = [];
      monthsGroup[key].push(i);
    }

    let patAyer = certRows.reduce((acc, c) => acc + c.capital, 0);
    let cuotasAyer = certRows.reduce((acc, c) => acc + c.cuotas, 0);
    let fInvAcu = patAyer;
    let vCuoAyer = 1.0;
    let ultimaTasaActivaMensual = 0.14;

    // Ejecutar simulación mes por mes con Goal Seek exacto por mes
    for (const [, idxs] of Object.entries(monthsGroup)) {
      // 1. Pre-cálculo para Goal Seek del mes
      let sumEgresosMes = 0.0;
      let sumCapitalPonderadoMes = 0.0;
      let tempPat = patAyer;

      for (const dayIdx of idxs) {
        const d = diasPeriodo[dayIdx];
        const gAdmD  = tempPat * (pAdmin / 365.0);
        const gCapD  = tempPat * (pCap / 365.0);
        const gMiscD = tempPat * (pMisc / 365.0);

        let pagoInvD = 0.0;
        for (const r of certRows) {
          pagoInvD += r.valores_dia[dayIdx] || 0.0;
          for (const h of r.hijos) {
            pagoInvD += h.valores_dia[dayIdx] || 0.0;
          }
        }

        let apD = 0.0;
        for (const r of certRows) {
          for (const h of r.hijos) {
            if (h.fecha_ingreso && h.fecha_ingreso.getTime() === d.getTime()) {
              apD += h.monto;
            }
          }
        }

        const egresosD = pagoInvD + gAdmD + gCapD + gMiscD;
        sumEgresosMes += egresosD;
        sumCapitalPonderadoMes += tempPat;
        tempPat += apD + egresosD;
      }

      // Tasa Activa Implícita Goal Seek del Mes (Base 365)
      const tActivaMes = sumCapitalPonderadoMes > 0
        ? (sumEgresosMes / sumCapitalPonderadoMes) * 365.0
        : 0.14;
      ultimaTasaActivaMensual = tActivaMes;

      // 2. Simulación día a día del mes
      for (const dayIdx of idxs) {
        const d = diasPeriodo[dayIdx];

        const gAdmD  = patAyer * (pAdmin / 365.0);
        const gCapD  = patAyer * (pCap / 365.0);
        const gMiscD = patAyer * (pMisc / 365.0);

        let pagoInvD = 0.0;
        for (const r of certRows) {
          pagoInvD += r.valores_dia[dayIdx] || 0.0;
          for (const h of r.hijos) {
            pagoInvD += h.valores_dia[dayIdx] || 0.0;
          }
        }

        let apD = 0.0;
        let nuevasCuotasD = 0.0;
        for (const r of certRows) {
          for (const h of r.hijos) {
            if (h.fecha_ingreso && h.fecha_ingreso.getTime() === d.getTime()) {
              const nuevasCuotas = Math.trunc(h.monto / vCuoAyer);
              apD += h.monto;
              nuevasCuotasD += nuevasCuotas;
            }
          }
        }

        fInvAcu += apD;

        // Ingreso Bruto Activo Diario Goal Seek (Base 365)
        const egresosD = pagoInvD + gAdmD + gCapD + gMiscD;
        const iBrutoD = patAyer * (tActivaMes / 365.0);
        const gananciaOperativa = Math.round((iBrutoD - egresosD) * 100) / 100;

        // Cierre Contable Diario (Benchmark Ricardo Gallo)
        const cuotasTotalesCierre = cuotasAyer + nuevasCuotasD;
        const patCierre = patAyer + apD + iBrutoD;
        const vCuoH = cuotasTotalesCierre > 0 ? patCierre / cuotasTotalesCierre : 1.0;

        const setSummaryVal = (label: string, value: number) => {
          const sRow = summaryRows.find(s => s.id === label);
          if (sRow) sRow.valores_dia.push(value);
        };

        setSummaryVal('TOTAL CAPITAL (Apertura)', patAyer);
        setSummaryVal('(+) CAPITAL ADICIONAL (Hoy)', apD);
        setSummaryVal('(=) CAPITAL ACUMULADO', fInvAcu);
        setSummaryVal('CUOTAS APERTURA', cuotasAyer);
        setSummaryVal('(+) CUOTAS ADICIONALES (Hoy)', nuevasCuotasD);
        setSummaryVal('(=) CUOTAS TOTALES CIERRE', cuotasTotalesCierre);
        setSummaryVal('VAL CUOTA INICIAL', vCuoAyer);
        setSummaryVal('GANANCIA TOTAL BRUTA (Base 360)', iBrutoD);
        setSummaryVal('PATRIMONIO TOTAL (Pre-Aportes)', patAyer + iBrutoD);
        setSummaryVal('COM. ADMIN (-) (Base 365)', gAdmD);
        setSummaryVal('COM. CAPT. (-) (Base 365)', gCapD);
        setSummaryVal('COM. MISC. (-)', gMiscD);
        setSummaryVal('GANANCIA OPERATIVA (Neta)', gananciaOperativa);
        setSummaryVal('PATRIMONIO TOTAL CIERRE', patCierre);
        setSummaryVal('VAL CUOTA FINAL', vCuoH);

        patAyer = patCierre;
        cuotasAyer = cuotasTotalesCierre;
        vCuoAyer = vCuoH;
      }
    }


    const blockRowsMeta: any[] = [];
    let numCert = 1;
    for (const r of certRows) {
      r.num = numCert++;
      r.css_class = "";
      r.label_class = "";
      blockRowsMeta.push(r);
      for (const h of r.hijos) {
        h.css_class = "aumento-row";
        h.label_class = "aumento-label text-slate-400 font-mono text-[9px] pl-2";
        blockRowsMeta.push(h);
      }
    }
    blockRowsMeta.push(...summaryRows);

    const blocks: V26Block[] = [];
    let blockIdx = 1;

    for (const [key, idxs] of Object.entries(monthsGroup)) {
      const [year, monthIdx] = key.split('-').map(Number);
      const monthName = `${monthNames[monthIdx]} ${year}`;
      const blockDays = idxs.map(i => {
        const d = diasPeriodo[i];
        return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
      });

      const blockRows: V26Row[] = [];

      for (const r of blockRowsMeta) {
        if (r.tipo === 'SPACER') {
          blockRows.push({
            tipo: 'SPACER',
            id: r.id,
            css_class: 'spacer-row h-2 bg-slate-50 dark:bg-slate-900/50',
            label_class: '',
            is_vc: false,
            cells: []
          });
          continue;
        }

        const isVc = r.id === 'VAL CUOTA INICIAL' || r.id === 'VAL CUOTA FINAL';
        const startIdx = idxs[0];
        const endIdx = idxs[idxs.length - 1] + 1;
        const dailyCells = r.valores_dia.slice(startIdx, endIdx).map((val: number) => ({
          val,
          css: isVc ? 'font-black text-blue-600 dark:text-blue-400' : ''
        }));

        blockRows.push({
          tipo: r.tipo,
          id: r.id,
          num: r.num,
          css_class: r.css_class,
          label_class: r.label_class,
          is_vc: isVc,
          capital: r.tipo === 'CERT' ? r.capital : r.monto,
          cuotas: r.cuotas,
          interes_acum: r.interes_acum,
          cells: dailyCells
        });
      }

      blocks.push({
        idx: blockIdx++,
        monthName,
        days: blockDays,
        rows: blockRows
      });
    }

    reports.push({
      fondo,
      blocks,
      vars: {
        activa: (ultimaTasaActivaMensual * 100).toFixed(2),
        admin: (pAdmin * 100).toFixed(2)
      }
    });
  }

  return reports;
};


// =========================================================================
// PERSISTENCIA Y ROLLBACK DE CIERRES DE VALOR CUOTA (NAV V27)
// =========================================================================

export const getValorCuotaEvents = async (endDate: string) => {
  try {
    const { data, error, count } = await supabase
      .from('crm_valor_cuota_eventos')
      .select('*', { count: 'exact' })
      .eq('fecha_fin_periodo', endDate);
    if (error) throw error;
    return { data: data || [], count: count || 0 };
  } catch (err: any) {
    console.error('Error consultando crm_valor_cuota_eventos:', err.message);
    return { data: [], count: 0 };
  }
};

export const fetchValorCuotaDashboard = async (year: number) => {
  try {
    const { data, error } = await supabase
      .from('crm_valor_cuota_eventos')
      .select('id_fondo, fecha_fin_periodo, anio, ciclo, num_periodo')
      .eq('anio', year);
    if (error) throw error;

    const dash: any = {
      B: { 1: [] as string[], 2: [] as string[], 3: [] as string[], 4: [] as string[], 5: [] as string[], 6: [] as string[] },
      Q: { 1: [] as string[], 2: [] as string[], 3: [] as string[], 4: [] as string[] }
    };

    if (data) {
      for (const r of data) {
        if (r.ciclo === 'Bimestre' && dash.B[r.num_periodo]) {
          dash.B[r.num_periodo].push(r.id_fondo);
        } else if (r.ciclo === 'Trimestre' && dash.Q[r.num_periodo]) {
          dash.Q[r.num_periodo].push(r.id_fondo);
        }
      }
    }

    for (let i = 1; i <= 6; i++) {
      dash.B[i] = Array.from(new Set(dash.B[i])).sort();
    }
    for (let i = 1; i <= 4; i++) {
      dash.Q[i] = Array.from(new Set(dash.Q[i])).sort();
    }

    return dash;
  } catch (err: any) {
    console.error('Error consultando dashboard de valor cuota:', err.message);
    return { B: {}, Q: {} };
  }
};

export const oficializarCierreValorCuota = async (payloads: any[]) => {
  const { data, error } = await supabase
    .from('crm_valor_cuota_eventos')
    .insert(payloads)
    .select();
  if (error) throw error;
  return data;
};

export const rollbackCierreValorCuota = async (endDate: string) => {
  const { data, error } = await supabase
    .from('crm_valor_cuota_eventos')
    .delete()
    .eq('fecha_fin_periodo', endDate)
    .select();
  if (error) throw error;
  return data;
};
