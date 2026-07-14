// src/services/fondosService.ts
import { supabase } from './supabaseClient';

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
  // 1. Cargar Fondos
  const { data: fondosData, error: fondosErr } = await supabase
    .from('crm_fondos')
    .select('*');
    
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

  // 2. Cargar Contratos de Inversión emitidos
  let queryContratos = supabase
    .from('crm_contratos')
    .select('id_contrato, fecha_inicio, monto_inversion, id_fondo')
    .eq('estado', 'emitido');
    
  if (codigoFondo) {
    queryContratos = queryContratos.eq('id_fondo', codigoFondo);
  }
  
  const { data: contratosData, error: contrErr } = await queryContratos;
  if (contrErr) throw new Error(`Error en contratos: ${contrErr.message}`);
  if (!contratosData || contratosData.length === 0) return [];

  const certIds = contratosData.map(c => c.id_contrato);

  // 3. Cargar aumentos de capital de crm_certificados_eventos
  const { data: aumData, error: aumErr } = await supabase
    .from('crm_certificados_eventos')
    .select('*')
    .in('id_certificado', certIds)
    .eq('tipo_evento', 'aumento_capital');

  if (aumErr) throw new Error(`Error en aumentos de capital: ${aumErr.message}`);

  const aumMap: Record<string, Array<{ fecha: Date; monto: number }>> = {};
  if (aumData) {
    for (const a of aumData) {
      const idCert = a.id_certificado;
      if (!aumMap[idCert]) aumMap[idCert] = [];
      const fDate = new Date(a.fecha_periodo_origen.split('T')[0] + 'T00:00:00');
      const monto = Number(a.capital_final_saldo || 0) - Number(a.capital_base || 0);
      aumMap[idCert].push({ fecha: fDate, monto });
    }
  }

  // 4. Configurar el rango de días en el periodo
  const diasPeriodo: Date[] = [];
  let curr = new Date(startDate);
  // Asegurar horas en 0 para comparaciones consistentes
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
    const pAdmin = Number(fondo.comision_administracion_fondo || 0) / 100;

    const certsFondo = contratosData.filter(c => c.id_fondo === fid);
    if (certsFondo.length === 0) continue;

    // Ordenamiento por correlativo numérico del id_contrato
    certsFondo.sort((a, b) => {
      const m1 = a.id_contrato.match(/[.-](\d+)/);
      const m2 = b.id_contrato.match(/[.-](\d+)/);
      const idx1 = m1 ? parseInt(m1[1], 10) : 999;
      const idx2 = m2 ? parseInt(m2[1], 10) : 999;
      return idx1 - idx2;
    });

    // Inicializar filas de contratos
    const certRows: any[] = [];
    const startDateStr = startDate.toISOString().split('T')[0];

    for (const c of certsFondo) {
      // Calcular Capital Inicial en la fecha de inicio del periodo
      const births = (aumMap[c.id_contrato] || []).filter(a => a.fecha.toISOString().split('T')[0] === startDateStr);
      const capIniAum = births.reduce((acc, a) => acc + a.monto, 0);
      const capIni = capIniAum > 0 ? capIniAum : Number(c.monto_inversion);

      certRows.push({
        tipo: 'CERT',
        id: c.id_contrato,
        capital: capIni,
        cuotas: capIni, // Inicialmente 1.0 cuota por sol/dólar
        emision: new Date(c.fecha_inicio + 'T00:00:00'),
        interes_acum: 0.0,
        valores_dia: [] as number[],
        hijos: [] as any[]
      });
    }

    // Configurar filas de totales de resumen
    const summaryDefs = [
      { id: 'TOTAL CAPITAL', css: 'summary-row' },
      { id: 'SPACER_1', css: 'spacer-row' },
      { id: 'INVERSIONES ORIGINALES', css: 'summary-row' },
      { id: 'INV. ORIGINALES ACUMULADAS', css: 'summary-row' },
      { id: 'VAL CUOTA INICIAL', css: 'vc-cell' },
      { id: 'SPACER_2', css: 'spacer-row' },
      { id: 'GANANCIA TOTAL BRUTA', css: 'summary-row' },
      { id: 'GANANCIA OPERATIVA', css: 'summary-row' },
      { id: 'PATRIMONIO TOTAL CIERRE', css: 'summary-row' },
      { id: 'VAL CUOTA FINAL', css: 'vc-cell' }
    ];

    const summaryRows: any[] = summaryDefs.map(def => ({
      tipo: def.id.startsWith('SPACER') ? 'SPACER' : 'TOTAL',
      id: def.id,
      css_class: def.css,
      valores_dia: [] as number[]
    }));

    // Simulación día a día
    let patAyer = certRows.reduce((acc, c) => acc + c.capital, 0);
    let cuotasAyer = certRows.reduce((acc, c) => acc + c.cuotas, 0);
    let fInvAcu = patAyer;
    let vCuoAyer = 1.0;

    for (const d of diasPeriodo) {
      const dStr = d.toISOString().split('T')[0];

      // Devengue diario
      const iBrutoD = patAyer * (tActiva / 360);
      const gAdmD = patAyer * (pAdmin / 365);
      const uNetaD = iBrutoD - gAdmD;

      // Valor Cuota Final de hoy
      const vCuoH = cuotasAyer > 0 ? (patAyer + uNetaD) / cuotasAyer : 1.0;

      // Calcular intereses por certificado e hijo
      for (const r of certRows) {
        const isEmitted = d >= r.emision;
        const vD = isEmitted ? r.capital * (tActiva / 360) : 0.0;
        r.valores_dia.push(vD);
        r.interes_acum += vD;

        for (const h of r.hijos) {
          const isHijoEmitted = d >= h.fecha_ingreso;
          const vDh = isHijoEmitted ? h.monto * (tActiva / 360) : 0.0;
          h.valores_dia.push(vDh);
          h.interes_acum += vDh;
        }
      }

      // Procesar aumentos de capital que ocurren hoy (si d > startDate)
      let apD = 0.0;
      if (dStr !== startDateStr) {
        for (const r of certRows) {
          const aumentosHoy = (aumMap[r.id] || []).filter(a => a.fecha.toISOString().split('T')[0] === dStr);
          for (const a of aumentosHoy) {
            const nuevoHijo = {
              tipo: 'AUMENTO',
              id: `Aumento (${a.fecha.getDate()}/${a.fecha.getMonth() + 1})`,
              monto: a.monto,
              fecha_ingreso: a.fecha,
              valores_dia: new Array(diasPeriodo.indexOf(d)).fill(0.0), // rellenar ceros para los días anteriores
              interes_acum: 0.0
            };
            r.hijos.push(nuevoHijo);
            r.capital += a.monto;
            r.cuotas += a.monto / vCuoH;
            apD += a.monto;
          }
        }
      }

      fInvAcu += apD;

      // Guardar valores en las filas de resumen
      const setSummaryVal = (label: string, value: number) => {
        const sRow = summaryRows.find(s => s.id === label);
        if (sRow) sRow.valores_dia.push(value);
      };

      setSummaryVal('TOTAL CAPITAL', patAyer);
      setSummaryVal('INVERSIONES ORIGINALES', apD);
      setSummaryVal('INV. ORIGINALES ACUMULADAS', fInvAcu);
      setSummaryVal('VAL CUOTA INICIAL', vCuoAyer);
      setSummaryVal('GANANCIA TOTAL BRUTA', iBrutoD);
      setSummaryVal('GANANCIA OPERATIVA', uNetaD);
      
      const patCierre = patAyer + uNetaD + apD;
      setSummaryVal('PATRIMONIO TOTAL CIERRE', patCierre);
      setSummaryVal('VAL CUOTA FINAL', vCuoH);

      // Actualizar saldos para el día siguiente
      patAyer = patCierre;
      cuotasAyer += (apD / vCuoH);
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
          css: isVc ? 'font-black text-blue-650 dark:text-blue-400' : ''
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
