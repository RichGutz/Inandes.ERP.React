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
  estado: string;
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

/**
 * Obtiene todos los certificados del CRM enriquecidos con la información de sus contratos,
 * fondos, inversionistas y su último saldo (capital actual) del ledger de eventos.
 */
export const getCertificadosMaster = async (): Promise<CertificadoMaster[]> => {
  // 1. Obtener todos los contratos (187 contratos en BD)
  const { data: contracts, error: contractsErr } = await supabase
    .from('crm_contratos')
    .select('*');

  if (contractsErr) throw new Error(`Error al obtener contratos: ${contractsErr.message}`);
  if (!contracts || contracts.length === 0) return [];

  // 2. Obtener certificados explícitos si existen
  const { data: certs } = await supabase
    .from('crm_certificados')
    .select('*');

  const certsByContractMap = new Map<string, any>();
  if (certs) {
    certs.forEach(c => certsByContractMap.set(c.id_contrato, c));
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

  // 5. Obtener los últimos eventos de cada certificado/contrato
  const { data: events, error: evtsErr } = await supabase
    .from('crm_certificados_eventos')
    .select('*')
    .order('fecha_periodo_fin', { ascending: false });

  if (evtsErr) throw new Error(`Error al obtener eventos de certificados: ${evtsErr.message}`);
  
  // Agrupar por id_certificado e id_contrato para obtener el evento más reciente
  const latestEventsMap = new Map<string, any>();
  if (events) {
    events.forEach(evt => {
      if (evt.id_certificado && !latestEventsMap.has(evt.id_certificado)) {
        latestEventsMap.set(evt.id_certificado, evt);
      }
      if (evt.id_contrato && !latestEventsMap.has(evt.id_contrato)) {
        latestEventsMap.set(evt.id_contrato, evt);
      }
    });
  }

  // 6. Ensamblar listado maestro consolidado desde crm_contratos
  const masterList: CertificadoMaster[] = contracts.map(ct => {
    const certExplicit = certsByContractMap.get(ct.id_contrato);
    const certId = certExplicit?.id_certificado || ct.id_contrato;
    const fd = fundsMap.get(ct.id_fondo) || {};
    const evt = latestEventsMap.get(certId) || latestEventsMap.get(ct.id_contrato);

    // Titulares
    const i1 = invsMap.get(ct.id_inversionista_1);
    const i2 = ct.id_inversionista_2 ? invsMap.get(ct.id_inversionista_2) : null;
    const i3 = ct.id_inversionista_3 ? invsMap.get(ct.id_inversionista_3) : null;
    const i4 = ct.id_inversionista_4 ? invsMap.get(ct.id_inversionista_4) : null;

    const titularesResumen: Array<{ nombre: string; documento: string; participacion_pct: number }> = [];
    if (i1) titularesResumen.push({ ...i1, participacion_pct: ct.porcentaje_participacion_1 || 100 });
    if (i2) titularesResumen.push({ ...i2, participacion_pct: ct.porcentaje_participacion_2 || 0 });
    if (i3) titularesResumen.push({ ...i3, participacion_pct: ct.porcentaje_participacion_3 || 0 });
    if (i4) titularesResumen.push({ ...i4, participacion_pct: ct.porcentaje_participacion_4 || 0 });

    const capitalActual = evt ? Number(evt.capital_final_saldo) : ct.monto_inversion;
    const ultimoEvento = evt ? evt.tipo_evento : 'EMISION_INICIAL';
    const fechaUltimoEvento = evt ? evt.fecha_periodo_fin.split('T')[0] : ct.fecha_inicio;

    // Determinar si está vigente o extinto (por estado del contrato o saldo 0)
    const estadoCt = (ct.estado || '').toLowerCase();
    const esCerrado = estadoCt.includes('cerrad') || estadoCt.includes('liquid') || estadoCt.includes('rescate') || estadoCt.includes('anulad');
    let isVigente = !esCerrado && capitalActual > 0;

    if (fd.fecha_cierre_fondo) {
      const fechaCierre = new Date(fd.fecha_cierre_fondo + 'T00:00:00');
      if (new Date() > fechaCierre) {
        isVigente = false;
      }
    }

    return {
      id_certificado: certId,
      id_contrato: ct.id_contrato,
      titulares_resumen: titularesResumen,
      monto_inversion: ct.monto_inversion,
      valor_cuota: certExplicit?.valor_cuota || 1.0,
      numero_cuotas: certExplicit?.numero_cuotas || ct.monto_inversion,
      estado: isVigente ? 'VIGENTE' : 'EXTINTO',
      fecha_emision: ct.fecha_inicio,
      id_fondo: ct.id_fondo,
      nombre_fondo: fd.nombre_fondo || ct.id_fondo || 'Fondo Desconocido',
      moneda: ct.moneda || 'USD',
      plazo_meses: ct.plazo_meses || '12',
      fecha_cierre_fondo: fd.fecha_cierre_fondo ? fd.fecha_cierre_fondo.split('T')[0] : null,
      titular_1: i1?.nombre || 'S/N',
      titular_2: i2?.nombre || '',
      titular_3: i3?.nombre || '',
      titular_4: i4?.nombre || '',
      capital_actual: capitalActual,
      ultimo_evento: ultimoEvento,
      fecha_ultimo_evento: fechaUltimoEvento
    };
  });

  return masterList;
};

/**
 * Registra un evento de aumento de capital en crm_certificados_eventos
 */
export const registrarAumentoCapital = async (event: CertificadoEvento): Promise<void> => {
  const { error } = await supabase
    .from('crm_certificados_eventos')
    .insert(event);

  if (error) throw new Error(`Error al registrar aumento de capital: ${error.message}`);
};

/**
 * Obtiene todos los eventos asociados a un certificado específico ordenados cronológicamente descendente
 */
export const getEventosDeCertificado = async (idCertificado: string): Promise<CertificadoEvento[]> => {
  const { data, error } = await supabase
    .from('crm_certificados_eventos')
    .select('*')
    .eq('id_certificado', idCertificado)
    .order('fecha_periodo_fin', { ascending: false });

  if (error) throw new Error(`Error al obtener historial de eventos: ${error.message}`);
  return data || [];
};
