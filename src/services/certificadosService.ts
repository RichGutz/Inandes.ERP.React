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
  // 1. Obtener todos los certificados
  const { data: certs, error: certsErr } = await supabase
    .from('crm_certificados')
    .select('*');

  if (certsErr) throw new Error(`Error al obtener certificados: ${certsErr.message}`);
  if (!certs || certs.length === 0) return [];

  // 2. Obtener contratos asociados
  const contractIds = certs.map(c => c.id_contrato);
  const { data: contracts, error: contractsErr } = await supabase
    .from('crm_contratos')
    .select('*')
    .in('id_contrato', contractIds);

  if (contractsErr) throw new Error(`Error al obtener contratos de certificados: ${contractsErr.message}`);
  const contractsMap = new Map<string, any>();
  if (contracts) {
    contracts.forEach(ct => contractsMap.set(ct.id_contrato, ct));
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

  // 4. Obtener todos los inversionistas para mapear nombres
  const { data: investors, error: invsErr } = await supabase
    .from('crm_inversionistas')
    .select('codigo_inversionista, nombre_1, nombre_2, apellido_1, apellido_2');

  if (invsErr) throw new Error(`Error al obtener inversionistas: ${invsErr.message}`);
  const invsNameMap = new Map<string, string>();
  if (investors) {
    investors.forEach(r => {
      const nombres = [r.nombre_1, r.nombre_2].filter(Boolean).join(" ");
      const apellidos = [r.apellido_1, r.apellido_2].filter(Boolean).join(" ");
      const fullName = `${nombres} ${apellidos}`.trim();
      invsNameMap.set(r.codigo_inversionista, fullName);
    });
  }

  // 5. Obtener los últimos eventos de cada certificado
  const { data: events, error: evtsErr } = await supabase
    .from('crm_certificados_eventos')
    .select('*')
    .order('fecha_periodo_fin', { ascending: false });

  if (evtsErr) throw new Error(`Error al obtener eventos de certificados: ${evtsErr.message}`);
  
  // Agrupar por certificado para obtener el más reciente (por fecha de fin)
  const latestEventsMap = new Map<string, any>();
  if (events) {
    events.forEach(evt => {
      if (!latestEventsMap.has(evt.id_certificado)) {
        latestEventsMap.set(evt.id_certificado, evt);
      }
    });
  }

  // 6. Ensamblar listado maestro consolidado
  const masterList: CertificadoMaster[] = certs.map(c => {
    const ct = contractsMap.get(c.id_contrato) || {};
    const fd = fundsMap.get(ct.id_fondo) || {};
    const evt = latestEventsMap.get(c.id_certificado);

    const t1 = invsNameMap.get(ct.id_inversionista_1) || '';
    const t2 = ct.id_inversionista_2 ? (invsNameMap.get(ct.id_inversionista_2) || '') : '';
    const t3 = ct.id_inversionista_3 ? (invsNameMap.get(ct.id_inversionista_3) || '') : '';
    const t4 = ct.id_inversionista_4 ? (invsNameMap.get(ct.id_inversionista_4) || '') : '';

    const capitalActual = evt ? Number(evt.capital_final_saldo) : c.monto_inversion;
    const ultimoEvento = evt ? evt.tipo_evento : 'SIN EVENTOS';
    const fechaUltimoEvento = evt ? evt.fecha_periodo_fin.split('T')[0] : 'S/D';

    // Determinar estado de vigencia (Activo o Extinto)
    let isVigente = capitalActual > 0;
    if (fd.fecha_cierre_fondo) {
      const fechaCierre = new Date(fd.fecha_cierre_fondo + 'T00:00:00');
      if (new Date() > fechaCierre) {
        isVigente = false;
      }
    }

    return {
      ...c,
      id_fondo: ct.id_fondo,
      nombre_fondo: fd.nombre_fondo || 'Fondo Desconocido',
      moneda: ct.moneda || 'PEN',
      plazo_meses: ct.plazo_meses || '0',
      fecha_cierre_fondo: fd.fecha_cierre_fondo ? fd.fecha_cierre_fondo.split('T')[0] : null,
      titular_1: t1,
      titular_2: t2,
      titular_3: t3,
      titular_4: t4,
      capital_actual: capitalActual,
      ultimo_evento: ultimoEvento,
      fecha_ultimo_evento: fechaUltimoEvento,
      estado: isVigente ? 'VIGENTE' : 'EXTINTO'
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
