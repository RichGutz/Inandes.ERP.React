// src/services/estadoPosicionService.ts
import { supabase } from './supabaseClient';

export interface LedgerPositionEvent {
  id_evento: number;
  id_contrato: string;
  id_certificado?: string;
  fecha_periodo_fin: string;
  tipo_evento: string;
  modalidad_periodo: string;
  tasa_anual_periodo: number;
  capital_base: number;
  interes_ganado_bruto: number;
  retencion_fiscal: number;
  interes_neto: number;
  capitalizacion_monto: number;
  amortizacion_rescate_monto: number;
  capital_final_saldo: number;
  created_at?: string;
}

export interface RescatePositionItem {
  id_cuota: string;
  id_contrato: string;
  id_inversionista?: string;
  tipo: string;
  descripcion?: string;
  moneda: string;
  monto: number;
  fecha_programada: string;
  estado: string;
  id_evento_aplicado?: number | null;
  fecha_pago_real?: string | null;
}

export interface ContractPositionSummary {
  id_contrato: string;
  id_certificado: string;
  id_fondo: string;
  nombre_fondo: string;
  moneda: 'PEN' | 'USD';
  monto_inversion: number;
  fecha_inicio: string;
  fecha_fin: string;
  plazo_meses: string;
  tasa_pactada_anual: number;
  tasa_pactada_mensual: number;
  modalidad_pago_rendimiento: string;
  estado: string;
  capital_actual: number;
  total_interes_neto: number;
  total_capitalizado: number;
  total_rescates: number;
  events: LedgerPositionEvent[];
  rescates: RescatePositionItem[];
  titulares: Array<{
    codigo: string;
    nombre: string;
    documento: string;
    participacion_pct: number;
  }>;
}

export interface InvestorPositionReport {
  inversionista: {
    codigo_inversionista: string;
    documento_identidad: string;
    tipo_doc: string;
    nombre_completo: string;
    email: string;
    telefono: string;
    direccion_fiscal?: string;
    banco_pen?: string;
    cuenta_pen?: string;
    cci_pen?: string;
    banco_usd?: string;
    cuenta_usd?: string;
    cci_usd?: string;
    asesor_nombre?: string;
  };
  contracts: ContractPositionSummary[];
  resumen_pen: {
    total_inversion_inicial: number;
    total_capital_actual: number;
    total_interes_neto: number;
    total_capitalizado: number;
    total_rescates: number;
    contratos_activos: number;
    contratos_total: number;
  };
  resumen_usd: {
    total_inversion_inicial: number;
    total_capital_actual: number;
    total_interes_neto: number;
    total_capitalizado: number;
    total_rescates: number;
    contratos_activos: number;
    contratos_total: number;
  };
  fecha_reporte: string;
}

export interface InvestorSearchResult {
  codigo_inversionista: string;
  documento_identidad: string;
  nombre_completo: string;
  contratos_count: number;
  monedas: string[];
  saldo_pen: number;
  saldo_usd: number;
}

/**
 * Obtiene la lista completa de inversionistas con resumen de saldos y contratos para el buscador/rolodex
 */
export async function getAllInvestorsForSearch(): Promise<InvestorSearchResult[]> {
  const [invRes, ctRes, evtRes] = await Promise.all([
    supabase
      .from('crm_inversionistas')
      .select('codigo_inversionista, documento_identidad, nombre_completo, nombre_1, nombre_2, apellido_1, apellido_2'),
    supabase
      .from('crm_contratos')
      .select('id_contrato, id_inversionista_1, id_inversionista_2, id_inversionista_3, id_inversionista_4, moneda, monto_inversion, estado'),
    supabase
      .from('crm_certificados_eventos')
      .select('id_contrato, id_certificado, capital_final_saldo, fecha_periodo_fin')
      .order('fecha_periodo_fin', { ascending: false })
  ]);

  if (invRes.error) throw new Error(`Error cargando inversionistas: ${invRes.error.message}`);
  if (ctRes.error) throw new Error(`Error cargando contratos: ${ctRes.error.message}`);

  const latestEventByContract = new Map<string, number>();
  if (evtRes.data) {
    for (const ev of evtRes.data) {
      if (ev.id_contrato && !latestEventByContract.has(ev.id_contrato)) {
        latestEventByContract.set(ev.id_contrato, Number(ev.capital_final_saldo || 0));
      }
    }
  }

  // Agrupar contratos por inversionista
  const contractsByInv = new Map<string, Array<any>>();
  if (ctRes.data) {
    for (const ct of ctRes.data) {
      const invIds = [ct.id_inversionista_1, ct.id_inversionista_2, ct.id_inversionista_3, ct.id_inversionista_4].filter(Boolean);
      for (const invId of invIds) {
        if (!contractsByInv.has(invId)) {
          contractsByInv.set(invId, []);
        }
        contractsByInv.get(invId)!.push(ct);
      }
    }
  }

  const results: InvestorSearchResult[] = (invRes.data || []).map(inv => {
    let fullName = inv.nombre_completo;
    if (!fullName) {
      const nombres = [inv.nombre_1, inv.nombre_2].filter(Boolean).join(' ');
      const apellidos = [inv.apellido_1, inv.apellido_2].filter(Boolean).join(' ');
      fullName = `${nombres} ${apellidos}`.trim();
    }

    const myContracts = contractsByInv.get(inv.codigo_inversionista) || [];
    const monedasSet = new Set<string>();
    let saldoPen = 0;
    let saldoUsd = 0;

    for (const ct of myContracts) {
      const mon = ct.moneda || 'USD';
      monedasSet.add(mon);
      const cap = latestEventByContract.has(ct.id_contrato)
        ? latestEventByContract.get(ct.id_contrato)!
        : Number(ct.monto_inversion || 0);

      if (mon === 'PEN') {
        saldoPen += cap;
      } else {
        saldoUsd += cap;
      }
    }

    return {
      codigo_inversionista: inv.codigo_inversionista,
      documento_identidad: inv.documento_identidad || 'S/D',
      nombre_completo: fullName || 'Sin Nombre Registrado',
      contratos_count: myContracts.length,
      monedas: Array.from(monedasSet),
      saldo_pen: saldoPen,
      saldo_usd: saldoUsd
    };
  });

  return results.sort((a, b) => a.nombre_completo.localeCompare(b.nombre_completo));
}

/**
 * Obtiene el Estado de Posición Financiera Consolidado para un inversionista
 */
export async function getInvestorPositionReport(codigoInversionista: string): Promise<InvestorPositionReport | null> {
  // 1. Obtener inversionista
  const { data: inv, error: invErr } = await supabase
    .from('crm_inversionistas')
    .select('*')
    .eq('codigo_inversionista', codigoInversionista)
    .single();

  if (invErr || !inv) {
    // Si no se encuentra por código, intentar buscar por documento de identidad
    const { data: invByDoc, error: invDocErr } = await supabase
      .from('crm_inversionistas')
      .select('*')
      .eq('documento_identidad', codigoInversionista)
      .single();

    if (invDocErr || !invByDoc) {
      throw new Error(`Inversionista ${codigoInversionista} no encontrado.`);
    }
  }

  const targetInv = inv || null;
  const targetCodigo = targetInv.codigo_inversionista;

  // 2. Obtener contratos donde participe el inversionista
  const { data: allContracts, error: ctErr } = await supabase
    .from('crm_contratos')
    .select('*')
    .or(`id_inversionista_1.eq.${targetCodigo},id_inversionista_2.eq.${targetCodigo},id_inversionista_3.eq.${targetCodigo},id_inversionista_4.eq.${targetCodigo}`)
    .order('fecha_inicio', { ascending: true });

  if (ctErr) throw new Error(`Error cargando contratos: ${ctErr.message}`);
  const contractsList = allContracts || [];

  // 3. Obtener catálogo de fondos
  const { data: fundsData } = await supabase.from('crm_fondos').select('*');
  const fundsMap = new Map<string, any>();
  (fundsData || []).forEach(f => fundsMap.set(f.id_fondo, f));

  // 4. Obtener asesores si aplica
  const { data: asesoresData } = await supabase.from('crm_asesores').select('codigo_asesor, nombre_completo');
  const asesoresMap = new Map<string, string>();
  (asesoresData || []).forEach(a => asesoresMap.set(a.codigo_asesor, a.nombre_completo));

  // 5. Obtener todos los partícipes de los contratos para mostrar cotitulares
  const invCodigosSet = new Set<string>();
  contractsList.forEach(ct => {
    if (ct.id_inversionista_1) invCodigosSet.add(ct.id_inversionista_1);
    if (ct.id_inversionista_2) invCodigosSet.add(ct.id_inversionista_2);
    if (ct.id_inversionista_3) invCodigosSet.add(ct.id_inversionista_3);
    if (ct.id_inversionista_4) invCodigosSet.add(ct.id_inversionista_4);
  });

  const { data: relatedInvs } = await supabase
    .from('crm_inversionistas')
    .select('codigo_inversionista, documento_identidad, nombre_completo, nombre_1, nombre_2, apellido_1, apellido_2')
    .in('codigo_inversionista', Array.from(invCodigosSet));

  const relatedInvsMap = new Map<string, { nombre: string; documento: string }>();
  (relatedInvs || []).forEach(r => {
    let fn = r.nombre_completo;
    if (!fn) {
      fn = `${r.nombre_1 || ''} ${r.nombre_2 || ''} ${r.apellido_1 || ''} ${r.apellido_2 || ''}`.replace(/\s+/g, ' ').trim();
    }
    relatedInvsMap.set(r.codigo_inversionista, {
      nombre: fn || 'S/N',
      documento: r.documento_identidad || 'S/D'
    });
  });

  // 6. Obtener todos los eventos del ledger de estos contratos
  const contractIds = contractsList.map(c => c.id_contrato);
  let allEvents: any[] = [];
  if (contractIds.length > 0) {
    const { data: evts, error: evtsErr } = await supabase
      .from('crm_certificados_eventos')
      .select('*')
      .in('id_contrato', contractIds)
      .order('fecha_periodo_fin', { ascending: true });

    if (evtsErr) throw new Error(`Error cargando eventos: ${evtsErr.message}`);
    allEvents = evts || [];
  }

  // 7. Obtener todas las deducciones / rescates de estos contratos
  let allRescates: any[] = [];
  if (contractIds.length > 0) {
    const { data: rescs, error: rescsErr } = await supabase
      .from('crm_cronograma_deducciones_rescates')
      .select('*')
      .in('id_contrato', contractIds)
      .order('fecha_proyectada_cobro', { ascending: true });

    if (rescsErr) throw new Error(`Error cargando rescates: ${rescsErr.message}`);
    allRescates = rescs || [];
  }

  // Indexar eventos y rescates por contrato
  const eventsByContract = new Map<string, LedgerPositionEvent[]>();
  allEvents.forEach(e => {
    if (!eventsByContract.has(e.id_contrato)) {
      eventsByContract.set(e.id_contrato, []);
    }
    const isCapEvent = Number(e.monto_capitalizacion || e.capitalizacion_monto || 0) > 0 || Number(e.pct_reparto_aplicado ?? 0) === 0;
    const tasaRaw = e.tasa_aplicada !== undefined && e.tasa_aplicada !== null ? Number(e.tasa_aplicada) : Number(e.tasa_anual_periodo || 0);
    const tasaNorm = (tasaRaw > 0 && tasaRaw <= 1) ? tasaRaw * 100 : tasaRaw;

    eventsByContract.get(e.id_contrato)!.push({
      id_evento: e.id_evento,
      id_contrato: e.id_contrato,
      id_certificado: e.id_certificado || e.id_contrato,
      fecha_periodo_fin: e.fecha_periodo_fin ? e.fecha_periodo_fin.split('T')[0] : '',
      tipo_evento: e.tipo_evento || 'CIERRE_PERIODICO',
      modalidad_periodo: e.modalidad_periodo || (isCapEvent ? 'CAPITALIZACION' : 'REPARTO'),
      tasa_anual_periodo: tasaNorm,
      capital_base: Number(e.capital_base || 0),
      interes_ganado_bruto: Number(e.interes_generado_bruto || e.interes_ganado_bruto || 0),
      retencion_fiscal: Number(e.impuestos_renta || e.retencion_fiscal || 0),
      interes_neto: Number(e.interes_neto_disponible || e.interes_neto || 0),
      capitalizacion_monto: Number(e.monto_capitalizacion || e.capitalizacion_monto || 0),
      amortizacion_rescate_monto: Number(e.monto_rescate || e.amortizacion_rescate_monto || 0),
      capital_final_saldo: Number(e.capital_final_saldo || 0),
      created_at: e.created_at
    });
  });

  const rescatesByContract = new Map<string, RescatePositionItem[]>();
  allRescates.forEach(r => {
    if (!rescatesByContract.has(r.id_contrato)) {
      rescatesByContract.set(r.id_contrato, []);
    }
    const fechaProg = r.fecha_proyectada_cobro ? String(r.fecha_proyectada_cobro).split('T')[0] : '';
    rescatesByContract.get(r.id_contrato)!.push({
      id_cuota: r.id_cuota,
      id_contrato: r.id_contrato,
      id_inversionista: r.id_agrupador || '',
      tipo: r.tipo_cargo || 'RESCATE_CAPITAL',
      descripcion: r.glosa_descripcion || '',
      moneda: r.moneda || 'USD',
      monto: Number(r.monto_cobrar || r.monto || 0),
      fecha_programada: fechaProg,
      estado: r.estado || 'PENDIENTE',
      id_evento_aplicado: r.id_evento_ledger || r.id_evento_aplicado || null,
      fecha_pago_real: null
    });
  });

  // Ensamblar contratos enriquecidos
  const contractSummaries: ContractPositionSummary[] = contractsList.map(ct => {
    const fd = fundsMap.get(ct.id_fondo) || {};
    const evts = eventsByContract.get(ct.id_contrato) || [];
    const rescs = rescatesByContract.get(ct.id_contrato) || [];

    // Último evento para saldo actual
    const lastEvt = evts.length > 0 ? evts[evts.length - 1] : null;
    const capitalActual = lastEvt ? lastEvt.capital_final_saldo : Number(ct.monto_inversion || 0);

    // Totales acumulados del ledger
    let sumIntNeto = 0;
    let sumCap = 0;
    let sumResc = 0;

    evts.forEach(ev => {
      sumIntNeto += ev.interes_neto;
      sumCap += ev.capitalizacion_monto;
      sumResc += ev.amortizacion_rescate_monto;
    });

    const titulares: Array<{ codigo: string; nombre: string; documento: string; participacion_pct: number }> = [];
    if (ct.id_inversionista_1) {
      const info = relatedInvsMap.get(ct.id_inversionista_1);
      titulares.push({
        codigo: ct.id_inversionista_1,
        nombre: info?.nombre || 'S/N',
        documento: info?.documento || 'S/D',
        participacion_pct: Number(ct.porcentaje_participacion_1 || 100)
      });
    }
    if (ct.id_inversionista_2) {
      const info = relatedInvsMap.get(ct.id_inversionista_2);
      titulares.push({
        codigo: ct.id_inversionista_2,
        nombre: info?.nombre || 'S/N',
        documento: info?.documento || 'S/D',
        participacion_pct: Number(ct.porcentaje_participacion_2 || 0)
      });
    }
    if (ct.id_inversionista_3) {
      const info = relatedInvsMap.get(ct.id_inversionista_3);
      titulares.push({
        codigo: ct.id_inversionista_3,
        nombre: info?.nombre || 'S/N',
        documento: info?.documento || 'S/D',
        participacion_pct: Number(ct.porcentaje_participacion_3 || 0)
      });
    }
    if (ct.id_inversionista_4) {
      const info = relatedInvsMap.get(ct.id_inversionista_4);
      titulares.push({
        codigo: ct.id_inversionista_4,
        nombre: info?.nombre || 'S/N',
        documento: info?.documento || 'S/D',
        participacion_pct: Number(ct.porcentaje_participacion_4 || 0)
      });
    }

    const tasaPactadaVal = Number(ct.tasa_pactada || ct.tasa_pactada_anual || 0);

    return {
      id_contrato: ct.id_contrato,
      id_certificado: ct.id_certificado || ct.id_contrato,
      id_fondo: ct.id_fondo,
      nombre_fondo: fd.nombre_fondo || ct.id_fondo || 'FONDO DE INVERSIÓN',
      moneda: (ct.moneda === 'PEN' ? 'PEN' : 'USD') as 'PEN' | 'USD',
      monto_inversion: Number(ct.monto_inversion || 0),
      fecha_inicio: ct.fecha_inicio ? ct.fecha_inicio.split('T')[0] : '',
      fecha_fin: ct.fecha_fin ? ct.fecha_fin.split('T')[0] : '',
      plazo_meses: ct.plazo_meses || '12',
      tasa_pactada_anual: tasaPactadaVal,
      tasa_pactada_mensual: Number(ct.tasa_pactada_mensual || 0),
      modalidad_pago_rendimiento: ct.modalidad_pago_rendimiento || (Number(ct.porcentaje_reparto || 0) === 0 ? 'CAPITALIZACION' : 'REPARTO'),
      estado: ct.estado || 'vigente',
      capital_actual: capitalActual,
      total_interes_neto: sumIntNeto,
      total_capitalizado: sumCap,
      total_rescates: sumResc,
      events: evts,
      rescates: rescs,
      titulares
    };
  });

  // Consolidar totales por moneda
  const resumenPen = {
    total_inversion_inicial: 0,
    total_capital_actual: 0,
    total_interes_neto: 0,
    total_capitalizado: 0,
    total_rescates: 0,
    contratos_activos: 0,
    contratos_total: 0
  };

  const resumenUsd = {
    total_inversion_inicial: 0,
    total_capital_actual: 0,
    total_interes_neto: 0,
    total_capitalizado: 0,
    total_rescates: 0,
    contratos_activos: 0,
    contratos_total: 0
  };

  contractSummaries.forEach(ct => {
    const isPen = ct.moneda === 'PEN';
    const targetResumen = isPen ? resumenPen : resumenUsd;

    targetResumen.total_inversion_inicial += ct.monto_inversion;
    targetResumen.total_capital_actual += ct.capital_actual;
    targetResumen.total_interes_neto += ct.total_interes_neto;
    targetResumen.total_capitalizado += ct.total_capitalizado;
    targetResumen.total_rescates += ct.total_rescates;
    targetResumen.contratos_total += 1;
    if (ct.capital_actual > 0 && !ct.estado.toLowerCase().includes('cerrad')) {
      targetResumen.contratos_activos += 1;
    }
  });

  let fullName = targetInv.nombre_completo;
  if (!fullName) {
    const nombres = [targetInv.nombre_1, targetInv.nombre_2].filter(Boolean).join(' ');
    const apellidos = [targetInv.apellido_1, targetInv.apellido_2].filter(Boolean).join(' ');
    fullName = `${nombres} ${apellidos}`.trim();
  }

  return {
    inversionista: {
      codigo_inversionista: targetInv.codigo_inversionista,
      documento_identidad: targetInv.documento_identidad || 'S/D',
      tipo_doc: targetInv.tipo_doc || 'DNI',
      nombre_completo: fullName || 'Sin Nombre Registrado',
      email: targetInv.email || '-',
      telefono: targetInv.telefono || '-',
      direccion_fiscal: targetInv.direccion_fiscal || '-',
      banco_pen: targetInv.banco_nombre_pen || '-',
      cuenta_pen: targetInv.numero_cuenta_pen || '-',
      cci_pen: targetInv.cci_pen || '-',
      banco_usd: targetInv.banco_nombre_usd || '-',
      cuenta_usd: targetInv.numero_cuenta_usd || '-',
      cci_usd: targetInv.cci_usd || '-',
      asesor_nombre: asesoresMap.get(targetInv.codigo_asesor) || targetInv.codigo_asesor || 'Asesor Principal'
    },
    contracts: contractSummaries,
    resumen_pen: resumenPen,
    resumen_usd: resumenUsd,
    fecha_reporte: new Date().toISOString().split('T')[0]
  };
}
