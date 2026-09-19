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

export interface FondoComercial {
  id_fondo: string;
  nombre_fondo: string;
  moneda?: string;
  tasa_anual_estimada?: number;
  comision_captacion_fondo?: number;
}

export interface ParticipeComisionItem {
  id_contrato: string;
  id_certificado: string;
  inversionista_nombre: string;
  inversionista_dni: string;
  id_fondo: string;
  nombre_fondo: string;
  id_asesor: string;
  nombre_asesor: string;
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
  try {
    const { data, error } = await supabase
      .from('crm_asesores')
      .select('id, codigo, nombre_completo, tipo_documento_asesor, num_documento_asesor, email, telefono')
      .order('nombre_completo', { ascending: true });

    if (error) {
      console.error('Error consultando asesores:', error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error('Exception consultando asesores:', err);
    return [];
  }
};

export const getFondos = async (): Promise<FondoComercial[]> => {
  try {
    const { data, error } = await supabase
      .from('crm_fondos')
      .select('id_fondo, nombre_fondo, moneda, tasa_anual_estimada, comision_captacion_fondo')
      .order('nombre_fondo', { ascending: true });

    if (error) {
      console.error('Error consultando fondos:', error);
      return [];
    }
    
    // Deduplicar fondos por id_fondo
    const uniqueMap = new Map<string, FondoComercial>();
    (data || []).forEach(f => {
      if (f.id_fondo && !uniqueMap.has(f.id_fondo)) {
        uniqueMap.set(f.id_fondo, f);
      }
    });
    return Array.from(uniqueMap.values());
  } catch (err) {
    console.error('Exception consultando fondos:', err);
    return [];
  }
};

// Función auxiliar para normalizar códigos de asesor
export const normalizeAsesorCode = (code: string | null | undefined): string => {
  if (!code) return '';
  return code.trim().toUpperCase().replace(/\D/g, '').replace(/^0+/, '');
};

export const calculateComisionesAnuales = async (
  year: number,
  selectedAsesorCodigo: string | null = null
): Promise<PeriodoComisionGroup[]> => {
  // 1. Cargar metadatos en paralelo
  const [fondosRes, contratosRes, inversionistasRes, asesoresRes, eventosRes] = await Promise.all([
    supabase.from('crm_fondos').select('*'),
    supabase.from('crm_contratos').select('*'),
    supabase.from('crm_inversionistas').select('codigo_inversionista, nombre_completo, documento_identidad, nombre_1, apellido_1'),
    supabase.from('crm_asesores').select('id, codigo, nombre_completo, num_documento_asesor'),
    supabase.from('crm_certificados_eventos')
      .select('*')
      .lte('fecha_periodo_fin', `${year}-12-31`)
  ]);

  if (fondosRes.error) console.error(fondosRes.error);
  if (contratosRes.error) console.error(contratosRes.error);
  if (inversionistasRes.error) console.error(inversionistasRes.error);

  const fondosMap = new Map<string, any>();
  (fondosRes.data || []).forEach(f => {
    if (!fondosMap.has(f.id_fondo)) fondosMap.set(f.id_fondo, f);
  });

  // Mapeo robusto y normalizado de asesores
  const asesoresMap = new Map<string, string>();
  const asesoresByNormMap = new Map<string, { codigo: string; nombre: string }>();

  (asesoresRes.data || []).forEach(a => {
    if (a.codigo) {
      asesoresMap.set(a.codigo, a.nombre_completo);
      const nCode = normalizeAsesorCode(a.codigo);
      if (nCode) asesoresByNormMap.set(nCode, { codigo: a.codigo, nombre: a.nombre_completo });
    }
    if (a.num_documento_asesor) {
      const nDoc = normalizeAsesorCode(a.num_documento_asesor);
      if (nDoc) asesoresByNormMap.set(nDoc, { codigo: a.codigo, nombre: a.nombre_completo });
    }
    if (a.id) asesoresMap.set(a.id, a.nombre_completo);
  });

  const getAsesorNombre = (aId: string): string => {
    if (!aId) return 'SIN_ASESOR';
    if (asesoresMap.has(aId)) return asesoresMap.get(aId)!;
    const norm = normalizeAsesorCode(aId);
    if (norm && asesoresByNormMap.has(norm)) {
      return asesoresByNormMap.get(norm)!.nombre;
    }
    return aId;
  };

  const isAsesorMatch = (contratoAsesorId: string | null | undefined, filterAsesorCode: string | null | undefined): boolean => {
    if (!filterAsesorCode || filterAsesorCode === 'TODOS') return true;
    if (!contratoAsesorId) return false;
    if (contratoAsesorId === filterAsesorCode) return true;
    const n1 = normalizeAsesorCode(contratoAsesorId);
    const n2 = normalizeAsesorCode(filterAsesorCode);
    return n1 !== '' && n1 === n2;
  };

  const inversionistasMap = new Map<string, any>();
  (inversionistasRes.data || []).forEach(i => {
    const code = i.codigo_inversionista || i.documento_identidad;
    if (code) inversionistasMap.set(code, i);
    if (i.documento_identidad) inversionistasMap.set(i.documento_identidad, i);
  });

  const allContratos = contratosRes.data || [];
  const allEvents = eventosRes.data || [];

  // Mapear eventos de aumento de capital por contrato
  const aumentosByContratoMap = new Map<string, any[]>();
  allEvents.forEach(e => {
    if (e.tipo_evento === 'aumento_capital' && e.id_contrato) {
      if (!aumentosByContratoMap.has(e.id_contrato)) {
        aumentosByContratoMap.set(e.id_contrato, []);
      }
      aumentosByContratoMap.get(e.id_contrato)!.push(e);
    }
  });

  // Helper para extraer el monto exacto de aumento de capital
  const getMontoAumento = (e: any): number => {
    let m = Number(e.capital_final_saldo || 0) - Number(e.capital_base || 0);
    if (m > 0) return m;
    if (e.notas) {
      const match = String(e.notas).match(/Aumento\s+de\s+capital\s+por\s+([0-9.,]+)/i) ||
                    String(e.notas).match(/Aumento\s+Capital\s+([0-9.,]+)k/i);
      if (match) {
        const raw = match[1].replace(/,/g, '');
        if (match[0].toLowerCase().includes('k')) {
          return (parseFloat(raw) || 0) * 1000;
        }
        return parseFloat(raw) || 0;
      }
    }
    return 0;
  };

  // Filtrar contratos por asesor si se especificó (con match flexible)
  const contratosFiltrados = selectedAsesorCodigo && selectedAsesorCodigo !== 'TODOS'
    ? allContratos.filter(c => isAsesorMatch(c.id_asesor, selectedAsesorCodigo))
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
    const eventsInPeriod = allEvents.filter(e => e.fecha_periodo_fin === fEnd && e.tipo_evento !== 'aumento_capital');
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

        const isRescate = contrato.estado === 'cerrado_por_rescate' || 
          String(contrato.estado || '').toLowerCase().includes('rescate') ||
          String(ev.tipo_evento || '').toLowerCase().includes('rescate');

        // Aumentos de capital previos y en ciclo
        const evAums = aumentosByContratoMap.get(contrato.id_contrato) || [];
        const aumsPrevios = evAums.filter(e => String(e.fecha_periodo_fin || e.fecha_periodo_origen || '').split('T')[0] < fStart);
        const sumAumsPrevios = aumsPrevios.reduce((s, e) => s + getMontoAumento(e), 0);

        // Capital Inicial Base + Aumentos Previos
        const capBasePrincipal = Number(contrato.monto_inversion || ev.capital_base || 0) + sumAumsPrevios;
        const capSaldo = Number(ev.capital_final_saldo ?? capBasePrincipal);
        const tasaInv = Number(contrato.tasa_pactada || 10.0);

        // Tasa de comisión de captación del fondo (ej. 1.5% aa) o tasa asesor específica
        const tasaComision = Number(fondo.comision_captacion_fondo || contrato.tasa_comision_asesor || 1.5);
        const moneda = contrato.moneda || fondo.moneda || 'USD';

        const dIniEv = ev.fecha_periodo_origen ? new Date(ev.fecha_periodo_origen + 'T00:00:00') : dStart;
        const dFinEv = ev.fecha_periodo_fin ? new Date(ev.fecha_periodo_fin + 'T00:00:00') : dEnd;
        const diasDevengados = Math.max(1, Math.round((dFinEv.getTime() - dIniEv.getTime()) / (1000 * 60 * 60 * 24)) + 1);

        // 1. Fila Principal del Contrato
        const comisionCalc = isRescate 
          ? 0.00 
          : Math.round(capBasePrincipal * (tasaComision / 100.0 / 365.0) * diasDevengados * 100) / 100;
          
        const capFormatted = capBasePrincipal.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const comFormatted = comisionCalc.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const detTexto = isRescate
          ? `${moneda} ${capFormatted} × RESCATE ANTICIPADO = ${moneda} 0.00`
          : `${moneda} ${capFormatted} × (${tasaComision.toFixed(2)}% / 365) × ${diasDevengados} días = ${moneda} ${comFormatted}`;

        const aId = contrato.id_asesor || 'SIN_ASESOR';
        const aNombre = getAsesorNombre(aId);

        participesList.push({
          id_contrato: contrato.id_contrato,
          id_certificado: ev.id_certificado || contrato.id_contrato,
          inversionista_nombre: invNombre,
          inversionista_dni: inv.documento_identidad || invCode || 'S/N',
          id_fondo: fCode,
          nombre_fondo: fondo.nombre_fondo || fCode,
          id_asesor: aId,
          nombre_asesor: aNombre,
          moneda: moneda,
          capital_base: capBasePrincipal,
          capital_final_saldo: capSaldo,
          tasa_inversionista: tasaInv,
          tasa_comision_asesor: tasaComision,
          tipo_comision_origen: isRescate ? 'Rescate Anticipado (Sin Comisión)' : 'Comisión de Captación del Fondo',
          dias_devengados: diasDevengados,
          fecha_inicio: ev.fecha_periodo_origen || fStart,
          fecha_fin: ev.fecha_periodo_fin || fEnd,
          determinacion_texto: detTexto,
          comision_calculada: comisionCalc
        });

        // 2. Filas Hijas: Aumentos de Capital dentro de este ciclo (Opción A: Desglosado y Prorrateado)
        const aumsEnCiclo = evAums.filter(e => {
          const f = String(e.fecha_periodo_fin || e.fecha_periodo_origen || '').split('T')[0];
          return f >= fStart && f <= fEnd;
        });

        for (const aumEv of aumsEnCiclo) {
          const fAum = String(aumEv.fecha_periodo_fin || aumEv.fecha_periodo_origen || fStart).split('T')[0];
          const montoAum = getMontoAumento(aumEv);
          if (montoAum <= 0) continue;

          const dAumStart = new Date(fAum + 'T00:00:00');
          const diasAum = Math.max(1, Math.round((dEnd.getTime() - dAumStart.getTime()) / (1000 * 60 * 60 * 24)) + 1);
          const comisionAum = isRescate 
            ? 0.00 
            : Math.round(montoAum * (tasaComision / 100.0 / 365.0) * diasAum * 100) / 100;

          const montoAumFmt = montoAum.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
          const comAumFmt = comisionAum.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
          const detTextoAum = isRescate
            ? `${moneda} ${montoAumFmt} × RESCATE ANTICIPADO = ${moneda} 0.00`
            : `${moneda} ${montoAumFmt} × (${tasaComision.toFixed(2)}% / 365) × ${diasAum} días = ${moneda} ${comAumFmt}`;

          participesList.push({
            id_contrato: contrato.id_contrato,
            id_certificado: `${ev.id_certificado || contrato.id_contrato} (Aum. ${fAum})`,
            inversionista_nombre: `↳ [Aumento Cap. ${fAum}] ${invNombre}`,
            inversionista_dni: inv.documento_identidad || invCode || 'S/N',
            id_fondo: fCode,
            nombre_fondo: fondo.nombre_fondo || fCode,
            id_asesor: aId,
            nombre_asesor: aNombre,
            moneda: moneda,
            capital_base: montoAum,
            capital_final_saldo: montoAum,
            tasa_inversionista: tasaInv,
            tasa_comision_asesor: tasaComision,
            tipo_comision_origen: isRescate ? 'Rescate Anticipado (Sin Comisión)' : 'Aumento de Capital (Prorrateado)',
            dias_devengados: diasAum,
            fecha_inicio: fAum,
            fecha_fin: fEnd,
            determinacion_texto: detTextoAum,
            comision_calculada: comisionAum
          });
        }
      }
    } else {
      // Si el período aún no está cerrado en BD, proyectamos con los contratos vigentes del asesor
      for (const contrato of contratosFiltrados) {
        const cIni = contrato.fecha_inicio ? contrato.fecha_inicio.split('T')[0] : '2000-01-01';
        const cFin = contrato.fecha_fin ? contrato.fecha_fin.split('T')[0] : '2099-12-31';

        if (cIni > fEnd || cFin < fStart) continue; // No vigente en el período

        const isRescate = contrato.estado === 'cerrado_por_rescate' || 
          String(contrato.estado || '').toLowerCase().includes('rescate');

        const fCode = contrato.id_fondo;
        const fondo = fondosMap.get(fCode) || {};
        const frecFondo = Number(fondo.frecuencia_cupones_meses || 2);

        // Si el corte no calza con la periodicidad del fondo, omitir
        if (pDef.m % frecFondo !== 0) continue;

        const invCode = contrato.id_inversionista_1 || contrato.id_inversionista;
        const inv = inversionistasMap.get(invCode) || {};
        const invNombre = inv.nombre_completo || `${inv.nombre_1 || ''} ${inv.apellido_1 || ''}`.trim() || 'Inversionista';

        // Aumentos previos y en ciclo para proyección
        const evAums = aumentosByContratoMap.get(contrato.id_contrato) || [];
        const aumsPrevios = evAums.filter(e => String(e.fecha_periodo_fin || e.fecha_periodo_origen || '').split('T')[0] < fStart);
        const sumAumsPrevios = aumsPrevios.reduce((s, e) => s + getMontoAumento(e), 0);

        // Capital Inicial Base + Aumentos Previos
        const capBasePrincipal = Number(contrato.monto_inversion || 0) + sumAumsPrevios;
        const tasaInv = Number(contrato.tasa_pactada || 10.0);
        const tasaComision = Number(fondo.comision_captacion_fondo || contrato.tasa_comision_asesor || 1.5);
        const moneda = contrato.moneda || fondo.moneda || 'USD';

        // Días exactos del contrato en este ciclo
        const dIniReal = cIni > fStart ? new Date(cIni + 'T00:00:00') : dStart;
        const diasContrato = Math.max(1, Math.round((dEnd.getTime() - dIniReal.getTime()) / (1000 * 60 * 60 * 24)) + 1);

        // 1. Fila Principal Proyectada
        const comisionCalc = isRescate 
          ? 0.00 
          : Math.round(capBasePrincipal * (tasaComision / 100.0 / 365.0) * diasContrato * 100) / 100;
          
        const capFormatted = capBasePrincipal.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const comFormatted = comisionCalc.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const detTexto = isRescate
          ? `${moneda} ${capFormatted} × RESCATE ANTICIPADO = ${moneda} 0.00`
          : `${moneda} ${capFormatted} × (${tasaComision.toFixed(2)}% / 365) × ${diasContrato} días = ${moneda} ${comFormatted}`;

        const aId = contrato.id_asesor || 'SIN_ASESOR';
        const aNombre = getAsesorNombre(aId);

        participesList.push({
          id_contrato: contrato.id_contrato,
          id_certificado: contrato.id_contrato,
          inversionista_nombre: invNombre,
          inversionista_dni: inv.documento_identidad || invCode || 'S/N',
          id_fondo: fCode,
          nombre_fondo: fondo.nombre_fondo || fCode,
          id_asesor: aId,
          nombre_asesor: aNombre,
          moneda: moneda,
          capital_base: capBasePrincipal,
          capital_final_saldo: capBasePrincipal,
          tasa_inversionista: tasaInv,
          tasa_comision_asesor: tasaComision,
          tipo_comision_origen: isRescate ? 'Rescate Anticipado (Sin Comisión)' : 'Comisión de Captación Estimada',
          dias_devengados: diasContrato,
          fecha_inicio: cIni > fStart ? cIni : fStart,
          fecha_fin: fEnd,
          determinacion_texto: detTexto,
          comision_calculada: comisionCalc
        });

        // 2. Filas Hijas de Aumentos de Capital en el Ciclo
        const aumsEnCiclo = evAums.filter(e => {
          const f = String(e.fecha_periodo_fin || e.fecha_periodo_origen || '').split('T')[0];
          return f >= fStart && f <= fEnd;
        });

        for (const aumEv of aumsEnCiclo) {
          const fAum = String(aumEv.fecha_periodo_fin || aumEv.fecha_periodo_origen || fStart).split('T')[0];
          const montoAum = getMontoAumento(aumEv);
          if (montoAum <= 0) continue;

          const dAumStart = new Date(fAum + 'T00:00:00');
          const diasAum = Math.max(1, Math.round((dEnd.getTime() - dAumStart.getTime()) / (1000 * 60 * 60 * 24)) + 1);
          const comisionAum = isRescate 
            ? 0.00 
            : Math.round(montoAum * (tasaComision / 100.0 / 365.0) * diasAum * 100) / 100;

          const montoAumFmt = montoAum.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
          const comAumFmt = comisionAum.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
          const detTextoAum = isRescate
            ? `${moneda} ${montoAumFmt} × RESCATE ANTICIPADO = ${moneda} 0.00`
            : `${moneda} ${montoAumFmt} × (${tasaComision.toFixed(2)}% / 365) × ${diasAum} días = ${moneda} ${comAumFmt}`;

          participesList.push({
            id_contrato: contrato.id_contrato,
            id_certificado: `${contrato.id_contrato} (Aum. ${fAum})`,
            inversionista_nombre: `↳ [Aumento Cap. ${fAum}] ${invNombre}`,
            inversionista_dni: inv.documento_identidad || invCode || 'S/N',
            id_fondo: fCode,
            nombre_fondo: fondo.nombre_fondo || fCode,
            id_asesor: aId,
            nombre_asesor: aNombre,
            moneda: moneda,
            capital_base: montoAum,
            capital_final_saldo: montoAum,
            tasa_inversionista: tasaInv,
            tasa_comision_asesor: tasaComision,
            tipo_comision_origen: isRescate ? 'Rescate Anticipado (Sin Comisión)' : 'Aumento de Capital (Prorrateado)',
            dias_devengados: diasAum,
            fecha_inicio: fAum,
            fecha_fin: fEnd,
            determinacion_texto: detTextoAum,
            comision_calculada: comisionAum
          });
        }
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
