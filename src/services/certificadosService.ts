// src/services/certificadosService.ts
import { supabase } from './supabaseClient';
import type { CertificadoEvento } from './contratosService';

export interface CertificadoMaster {
  id_certificado: string;
  id_contrato: string;
  titulares_resumen: Array<{ nombre: string; documento: string; participacion_pct: number }>;
  monto_inversion: number;
  valor_cuota: number;
  numero_cuotas: number;
  estado: 'VIGENTE' | 'EXTINTO';
  fecha_emision: string;

  // Enriquecidos
  id_fondo?: string;
  nombre_fondo?: string;
  moneda?: string;
  plazo_meses?: string;
  fecha_cierre_fondo?: string | null;
  titular_1?: string;
  titular_2?: string;
  titular_3?: string;
  titular_4?: string;
  capital_actual?: number;
  ultimo_evento?: string;
  fecha_ultimo_evento?: string;
}

export const esContratoVivo = (estado?: string | null): boolean => {
  if (!estado) return true;
  const est = String(estado).toLowerCase();
  for (const kw of ['cerrad', 'liquid', 'anulad', 'retirad', 'rescate']) {
    if (est.includes(kw)) return false;
  }
  return true;
};

/**
 * Arquitectura Ledger-First (Mapeo 1:1 por Contrato Sin Duplicados):
 * Cada contrato en crm_contratos se mapea exactamente a 1 certificado máster en la UI.
 * Se enriquece con el evento financiero más reciente de crm_certificados_eventos.
 * Si el contrato está cerrado/liquidado o el saldo es 0, el certificado MUERE (estado: EXTINTO).
 */
export const getCertificadosMaster = async (): Promise<CertificadoMaster[]> => {
  // 1. Obtener la totalidad de contratos (187 contratos en BD)
  const { data: contracts, error: contractsErr } = await supabase
    .from('crm_contratos')
    .select('*');

  if (contractsErr) throw new Error(`Error al obtener contratos: ${contractsErr.message}`);
  if (!contracts || contracts.length === 0) return [];

  // 2. Obtener la totalidad del Ledger Financial Events (ordenado por fecha más reciente)
  const { data: events, error: evtsErr } = await supabase
    .from('crm_certificados_eventos')
    .select('*')
    .order('fecha_periodo_fin', { ascending: false });

  if (evtsErr) throw new Error(`Error al obtener eventos de certificados: ${evtsErr.message}`);

  // Indexar el evento más reciente por id_contrato
  const latestEventByContractMap = new Map<string, any>();
  const latestEventByCertIdMap = new Map<string, any>();

  if (events) {
    events.forEach(evt => {
      if (evt.id_contrato && !latestEventByContractMap.has(evt.id_contrato)) {
        latestEventByContractMap.set(evt.id_contrato, evt);
      }
      if (evt.id_certificado && !latestEventByCertIdMap.has(evt.id_certificado)) {
        latestEventByCertIdMap.set(evt.id_certificado, evt);
      }
    });
  }

  // 3. Obtener todos los fondos
  const { data: funds, error: fundsErr } = await supabase
    .from('crm_fondos')
    .select('*');
  
  if (fundsErr) throw new Error(`Error al obtener fondos: ${fundsErr.message}`);
  const fundsMap = new Map<string, any>();
  if (funds) {
    funds.forEach(fd => fundsMap.set(fd.id_fondo, fd));
  }

  // 4. Obtener todos los inversionistas para mapear nombres y documentos
  const { data: investors, error: invsErr } = await supabase
    .from('crm_inversionistas')
    .select('codigo_inversionista, nombre_completo, documento_identidad, nombre_1, nombre_2, apellido_1, apellido_2');

  if (invsErr) throw new Error(`Error al obtener inversionistas: ${invsErr.message}`);
  const invsMap = new Map<string, { nombre: string; documento: string }>();
  if (investors) {
    investors.forEach(r => {
      let fullName = r.nombre_completo;
      if (!fullName) {
        const nombres = [r.nombre_1, r.nombre_2].filter(Boolean).join(" ");
        const apellidos = [r.apellido_1, r.apellido_2].filter(Boolean).join(" ");
        fullName = `${nombres} ${apellidos}`.trim();
      }
      invsMap.set(r.codigo_inversionista, {
        nombre: fullName || 'S/N',
        documento: r.documento_identidad || 'S/N'
      });
    });
  }

  // 5. Ensamblar 1:1 desde contratos (garantiza cero duplicados)
  const masterList: CertificadoMaster[] = contracts.map(ct => {
    const ctId = ct.id_contrato;
    let evt = latestEventByContractMap.get(ctId);
    
    if (!evt) {
      // Buscar evento por prefijo de certificado si id_contrato no está explícito en el evento
      for (const [certIdKey, e] of latestEventByCertIdMap.entries()) {
        if (certIdKey.startsWith(ctId)) {
          evt = e;
          break;
        }
      }
    }

    const fd = fundsMap.get(ct.id_fondo) || {};

    // Titulares del contrato
    const i1 = invsMap.get(ct.id_inversionista_1);
    const i2 = ct.id_inversionista_2 ? invsMap.get(ct.id_inversionista_2) : null;
    const i3 = ct.id_inversionista_3 ? invsMap.get(ct.id_inversionista_3) : null;
    const i4 = ct.id_inversionista_4 ? invsMap.get(ct.id_inversionista_4) : null;

    const titularesResumen: Array<{ nombre: string; documento: string; participacion_pct: number }> = [];
    if (i1) titularesResumen.push({ ...i1, participacion_pct: ct.porcentaje_participacion_1 || 100 });
    if (i2) titularesResumen.push({ ...i2, participacion_pct: ct.porcentaje_participacion_2 || 0 });
    if (i3) titularesResumen.push({ ...i3, participacion_pct: ct.porcentaje_participacion_3 || 0 });
    if (i4) titularesResumen.push({ ...i4, participacion_pct: ct.porcentaje_participacion_4 || 0 });

    const capitalActual = evt ? Number(evt.capital_final_saldo ?? evt.capital_base ?? ct.monto_inversion ?? 0) : Number(ct.monto_inversion || 0);
    const tipoEvt = evt ? (evt.tipo_evento || 'EVENTO_LEDGER') : 'EMISION_INICIAL';
    const fechaEvt = evt ? (evt.fecha_periodo_fin ? evt.fecha_periodo_fin.split('T')[0] : ct.fecha_inicio) : ct.fecha_inicio;
    const certDisplayId = evt?.id_certificado || ctId;

    // REGLA INTANGIBLE: El certificado MUERE cuando el contrato se cierra/liquida/rescata o saldo es 0
    const estadoCt = (ct.estado || '').toLowerCase();
    const esExtintoDefinitivo = capitalActual <= 0 || 
                                tipoEvt.toLowerCase().includes('cierre_fin_contrato') || 
                                tipoEvt.toLowerCase().includes('cierre_por_rescate') || 
                                tipoEvt.toLowerCase().includes('rescate_total') || 
                                estadoCt.includes('cerrad') || 
                                estadoCt.includes('liquid') || 
                                estadoCt.includes('rescate') || 
                                estadoCt.includes('anulad') || 
                                estadoCt.includes('retirad');

    let isVigente = !esExtintoDefinitivo;
    if (fd.fecha_cierre_fondo) {
      const fechaCierre = new Date(fd.fecha_cierre_fondo + 'T00:00:00');
      if (new Date() > fechaCierre) {
        isVigente = false;
      }
    }

    return {
      id_certificado: certDisplayId,
      id_contrato: ctId,
      titulares_resumen: titularesResumen,
      monto_inversion: ct.monto_inversion || 0,
      valor_cuota: 1.0,
      numero_cuotas: ct.monto_inversion || 0,
      estado: isVigente ? 'VIGENTE' : 'EXTINTO',
      fecha_emision: ct.fecha_inicio,
      id_fondo: ct.id_fondo,
      nombre_fondo: fd.nombre_fondo || ct.id_fondo || 'FONDO DE INVERSIÓN',
      moneda: ct.moneda || 'USD',
      plazo_meses: ct.plazo_meses || '12',
      fecha_cierre_fondo: fd.fecha_cierre_fondo ? fd.fecha_cierre_fondo.split('T')[0] : null,
      titular_1: i1?.nombre || 'S/N',
      titular_2: i2?.nombre || '',
      titular_3: i3?.nombre || '',
      titular_4: i4?.nombre || '',
      capital_actual: capitalActual,
      ultimo_evento: tipoEvt,
      fecha_ultimo_evento: fechaEvt
    };
  });

  return masterList;
};

/**
 * Registra un evento de aumento de capital en crm_certificados_eventos y actualiza el saldo del contrato
 */
export const registrarAumentoCapital = async (event: CertificadoEvento): Promise<void> => {
  const payload = {
    ...event,
    id_certificado_origen: event.id_certificado_origen || event.id_certificado || event.id_contrato
  };

  const { error: evtErr } = await supabase
    .from('crm_certificados_eventos')
    .insert([payload]);

  if (evtErr) throw new Error(`Error al registrar aumento de capital: ${evtErr.message}`);

  // Actualizar el saldo de inversión en crm_contratos para reflejar el nuevo capital base
  if (event.id_contrato && event.capital_final_saldo) {
    await supabase
      .from('crm_contratos')
      .update({ monto_inversion: event.capital_final_saldo })
      .eq('id_contrato', event.id_contrato);
  }
};

/**
 * Obtiene el historial inmutable de eventos de un certificado específico
 */
export const getEventosDeCertificado = async (certId: string): Promise<CertificadoEvento[]> => {
  const { data, error } = await supabase
    .from('crm_certificados_eventos')
    .select('*')
    .or(`id_certificado.eq.${certId},id_contrato.eq.${certId}`)
    .order('fecha_periodo_fin', { ascending: false });

  if (error) throw new Error(`Error al obtener historial de eventos: ${error.message}`);
  return data || [];
};
