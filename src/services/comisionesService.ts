// src/services/comisionesService.ts
import { supabase } from './supabaseClient';

export interface AsesorComercial {
  id: string;
  codigo: string;
  nombre_completo: string;
  tipo_documento_asesor?: string;
  num_documento_asesor?: string;
  email?: string;
  telefono?: string;
}

export interface ParticipeComisionItem {
  id_contrato: string;
  id_certificado: string;
  inversionista_nombre: string;
  inversionista_dni: string;
  id_fondo: string;
  nombre_fondo: string;
  moneda: string;
  capital_base: number;
  capital_final_saldo: number;
  tasa_inversionista: number;
  tasa_comision_asesor: number;
  tipo_comision_origen: string;
  dias_devengados: number;
  fecha_inicio: string;
  fecha_fin: string;
  determinacion_texto: string;
  comision_calculada: number;
}

export interface PeriodoComisionGroup {
  id: string;
  mes_num: number;
  mes_nombre: string;
  ciclo_label: string;
  corte_str: string;
  fecha_inicio: string;
  fecha_fin: string;
  dias_periodo: number;
  is_cerrado_bd: boolean;
  participes: ParticipeComisionItem[];
  totales: {
    count_participes: number;
    count_contratos: number;
    capital_pen: number;
    capital_usd: number;
    comision_pen: number;
    comision_usd: number;
  };
}

export const PERIODOS_CANONICOS = [
  { id: 'B1', m: 2, mes: 'Febrero', rango: 'Ene - Feb', label: 'Bimestre 1', corte: '28 Feb', cNum: 1, cType: 'Bimestre' as const, defaultDays: 59 },
  { id: 'Q1', m: 3, mes: 'Marzo', rango: 'Ene - Mar', label: 'Trimestre 1', corte: '31 Mar', cNum: 1, cType: 'Trimestre' as const, defaultDays: 90 },
  { id: 'B2', m: 4, mes: 'Abril', rango: 'Mar - Abr', label: 'Bimestre 2', corte: '30 Abr', cNum: 2, cType: 'Bimestre' as const, defaultDays: 61 },
  { id: 'B3_Q2', m: 6, mes: 'Junio', rango: 'May - Jun / Q2', label: 'Bim. 3 / Q2', corte: '30 Jun', cNum: 3, cType: 'Bimestre' as const, defaultDays: 61 },
  { id: 'B4', m: 8, mes: 'Agosto', rango: 'Jul - Ago', label: 'Bimestre 4', corte: '31 Ago', cNum: 4, cType: 'Bimestre' as const, defaultDays: 62 },
  { id: 'Q3', m: 9, mes: 'Septiembre', rango: 'Jul - Sep', label: 'Trimestre 3', corte: '30 Sep', cNum: 3, cType: 'Trimestre' as const, defaultDays: 92 },
  { id: 'B5', m: 10, mes: 'Octubre', rango: 'Sep - Oct', label: 'Bimestre 5', corte: '31 Oct', cNum: 5, cType: 'Bimestre' as const, defaultDays: 61 },
  { id: 'B6_Q4', m: 12, mes: 'Diciembre', rango: 'Nov - Dic / Q4', label: 'Bim. 6 / Q4', corte: '31 Dic', cNum: 6, cType: 'Bimestre' as const, defaultDays: 61 }
];

export const getAsesores = async (): Promise<AsesorComercial[]> => {
  const { data, error } = await supabase
    .from('crm_asesores')
    .select('id, codigo, nombre_completo, tipo_documento_asesor, num_documento_asesor, email, telefono')
    .order('nombre_completo', { ascending: true });

  if (error) throw new Error(`Error consultando asesores: ${error.message}`);
  return data || [];
};

export const calculateComisionesAnuales = async (
  year: number,
  selectedAsesorCodigo: string | null = null
): Promise<PeriodoComisionGroup[]> => {
  // 1. Cargar metadatos en paralelo
  const [fondosRes, contratosRes, inversionistasRes, eventosRes] = await Promise.all([
    supabase.from('crm_fondos').select('*'),
    supabase.from('crm_contratos').select('*'),
    supabase.from('crm_inversionistas').select('codigo_inversionista, nombre_completo, documento_identidad, nombre_1, apellido_1'),
    supabase.from('crm_certificados_eventos')
      .select('*')
      .gte('fecha_periodo_fin', `${year}-01-01`)
      .lte('fecha_periodo_fin', `${year}-12-31`)
  ]);

  if (fondosRes.error) throw fondosRes.error;
  if (contratosRes.error) throw contratosRes.error;
  if (inversionistasRes.error) throw inversionistasRes.error;

  const fondosMap = new Map<string, any>();
  (fondosRes.data || []).forEach(f => {
    if (!fondosMap.has(f.id_fondo)) fondosMap.set(f.id_fondo, f);
  });

  const inversionistasMap = new Map<string, any>();
  (inversionistasRes.data || []).forEach(i => {
    const code = i.codigo_inversionista || i.documento_identidad;
    if (code) inversionistasMap.set(code, i);
    if (i.documento_identidad) inversionistasMap.set(i.documento_identidad, i);
  });

  const allContratos = contratosRes.data || [];
  const allEvents = eventosRes.data || [];

  // Filtrar contratos por asesor si se especificó
  const contratosFiltrados = selectedAsesorCodigo && selectedAsesorCodigo !== 'TODOS'
    ? allContratos.filter(c => c.id_asesor === selectedAsesorCodigo)
    : allContratos;

  const contratosMap = new Map<string, any>();
  contratosFiltrados.forEach(c => contratosMap.set(c.id_contrato, c));

  const resultGroups: PeriodoComisionGroup[] = [];

  for (const pDef of PERIODOS_CANONICOS) {
    let s_m = 1;
    let e_m = pDef.m;
    if (pDef.cType === 'Bimestre') {
      s_m = (pDef.cNum - 1) * 2 + 1;
      e_m = s_m + 1;
    } else {
      s_m = (pDef.cNum - 1) * 3 + 1;
      e_m = s_m + 2;
    }

    const lastDay = new Date(year, e_m, 0).getDate();
    const fStart = `${year}-${String(s_m).padStart(2, '0')}-01`;
    const fEnd = `${year}-${String(e_m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const dStart = new Date(fStart + 'T00:00:00');
    const dEnd = new Date(fEnd + 'T00:00:00');
    const diasExactos = Math.round((dEnd.getTime() - dStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    // Buscar eventos oficiales cerrados en este período
    const eventsInPeriod = allEvents.filter(e => e.fecha_periodo_fin === fEnd);
    const isCerrado = eventsInPeriod.length > 0;

    const participesList: ParticipeComisionItem[] = [];

    // Si hay eventos oficiales cerrados en BD, usamos los saldos forenses de los asientos
    if (isCerrado) {
      for (const ev of eventsInPeriod) {
        const contrato = contratosMap.get(ev.id_contrato);
        if (!contrato) continue; // No pertenece al asesor seleccionado

        const fCode = contrato.id_fondo || (ev.id_certificado || '').split('.')[0].split('-')[0];
        const fondo = fondosMap.get(fCode) || {};
        const invCode = contrato.id_inversionista_1 || contrato.id_inversionista;
        const inv = inversionistasMap.get(invCode) || {};
        const invNombre = ev.payload_asiento?.inversionista || inv.nombre_completo || `${inv.nombre_1 || ''} ${inv.apellido_1 || ''}`.trim() || 'Inversionista';

        const capBase = Number(ev.capital_base || ev.capital_final_saldo || contrato.monto_inversion || 0);
        const capSaldo = Number(ev.capital_final_saldo ?? capBase);
        const tasaInv = Number(contrato.tasa_pactada || 10.0);

        // Tasa de comisión de captación del fondo (ej. 1.5% aa) o tasa asesor específica
        const tasaComision = Number(fondo.comision_captacion_fondo || contrato.tasa_comision_asesor || 1.5);
        const moneda = contrato.moneda || fondo.moneda || 'USD';

        const dIniEv = ev.fecha_periodo_origen ? new Date(ev.fecha_periodo_origen + 'T00:00:00') : dStart;
        const dFinEv = ev.fecha_periodo_fin ? new Date(ev.fecha_periodo_fin + 'T00:00:00') : dEnd;
        const diasDevengados = Math.max(1, Math.round((dFinEv.getTime() - dIniEv.getTime()) / (1000 * 60 * 60 * 24)) + 1);

        // Fórmula Canónica Base 365
        const comisionCalc = Math.round(capBase * (tasaComision / 100.0 / 365.0) * diasDevengados * 100) / 100;
        const capFormatted = capBase.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const comFormatted = comisionCalc.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const detTexto = `${moneda} ${capFormatted} × (${tasaComision.toFixed(2)}% / 365) × ${diasDevengados} días = ${moneda} ${comFormatted}`;

        participesList.push({
          id_contrato: contrato.id_contrato,
          id_certificado: ev.id_certificado || contrato.id_contrato,
          inversionista_nombre: invNombre,
          inversionista_dni: inv.documento_identidad || invCode || 'S/N',
          id_fondo: fCode,
          nombre_fondo: fondo.nombre_fondo || fCode,
          moneda: moneda,
          capital_base: capBase,
          capital_final_saldo: capSaldo,
          tasa_inversionista: tasaInv,
          tasa_comision_asesor: tasaComision,
          tipo_comision_origen: 'Comisión de Captación del Fondo',
          dias_devengados: diasDevengados,
          fecha_inicio: ev.fecha_periodo_origen || fStart,
          fecha_fin: ev.fecha_periodo_fin || fEnd,
          determinacion_texto: detTexto,
          comision_calculada: comisionCalc
        });
      }
    } else {
      // Si el período aún no está cerrado en BD, proyectamos con los contratos vigentes del asesor
      for (const contrato of contratosFiltrados) {
        const cIni = contrato.fecha_inicio ? contrato.fecha_inicio.split('T')[0] : '2000-01-01';
        const cFin = contrato.fecha_fin ? contrato.fecha_fin.split('T')[0] : '2099-12-31';

        if (cIni > fEnd || cFin < fStart) continue; // No vigente en el período

        const fCode = contrato.id_fondo;
        const fondo = fondosMap.get(fCode) || {};
        const frecFondo = Number(fondo.frecuencia_cupones_meses || 2);

        // Si el corte no calza con la periodicidad del fondo, omitir
        if (pDef.m % frecFondo !== 0) continue;

        const invCode = contrato.id_inversionista_1 || contrato.id_inversionista;
        const inv = inversionistasMap.get(invCode) || {};
        const invNombre = inv.nombre_completo || `${inv.nombre_1 || ''} ${inv.apellido_1 || ''}`.trim() || 'Inversionista';

        const capBase = Number(contrato.monto_inversion || 0);
        const tasaInv = Number(contrato.tasa_pactada || 10.0);
        const tasaComision = Number(fondo.comision_captacion_fondo || contrato.tasa_comision_asesor || 1.5);
        const moneda = contrato.moneda || fondo.moneda || 'USD';

        const comisionCalc = Math.round(capBase * (tasaComision / 100.0 / 365.0) * diasExactos * 100) / 100;
        const capFormatted = capBase.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const comFormatted = comisionCalc.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const detTexto = `${moneda} ${capFormatted} × (${tasaComision.toFixed(2)}% / 365) × ${diasExactos} días = ${moneda} ${comFormatted}`;

        participesList.push({
          id_contrato: contrato.id_contrato,
          id_certificado: contrato.id_contrato,
          inversionista_nombre: invNombre,
          inversionista_dni: inv.documento_identidad || invCode || 'S/N',
          id_fondo: fCode,
          nombre_fondo: fondo.nombre_fondo || fCode,
          moneda: moneda,
          capital_base: capBase,
          capital_final_saldo: capBase,
          tasa_inversionista: tasaInv,
          tasa_comision_asesor: tasaComision,
          tipo_comision_origen: 'Comisión de Captación Estimada',
          dias_devengados: diasExactos,
          fecha_inicio: fStart,
          fecha_fin: fEnd,
          determinacion_texto: detTexto,
          comision_calculada: comisionCalc
        });
      }
    }

    // Calcular totales del período
    const countParticipes = new Set(participesList.map(p => p.inversionista_nombre)).size;
    const capitalPen = participesList.filter(p => p.moneda === 'PEN').reduce((sum, p) => sum + p.capital_base, 0);
    const capitalUsd = participesList.filter(p => p.moneda === 'USD').reduce((sum, p) => sum + p.capital_base, 0);
    const comisionPen = participesList.filter(p => p.moneda === 'PEN').reduce((sum, p) => sum + p.comision_calculada, 0);
    const comisionUsd = participesList.filter(p => p.moneda === 'USD').reduce((sum, p) => sum + p.comision_calculada, 0);

    resultGroups.push({
      id: pDef.id,
      mes_num: pDef.m,
      mes_nombre: pDef.mes,
      ciclo_label: `${pDef.label} (${pDef.rango})`,
      corte_str: pDef.corte,
      fecha_inicio: fStart,
      fecha_fin: fEnd,
      dias_periodo: diasExactos,
      is_cerrado_bd: isCerrado,
      participes: participesList,
      totales: {
        count_participes: countParticipes,
        count_contratos: participesList.length,
        capital_pen: capitalPen,
        capital_usd: capitalUsd,
        comision_pen: comisionPen,
        comision_usd: comisionUsd
      }
    });
  }

  return resultGroups;
};
