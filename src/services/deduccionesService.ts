// src/services/deduccionesService.ts
import { supabase } from './supabaseClient';
import type { Contrato } from './contratosService';

export interface DeduccionCuota {
  id_cuota: string;
  id_agrupador: string;
  id_certificado: string;
  id_contrato: string;
  tipo_cargo: 'DEDUCCION_ORDINARIA' | 'RESCATE_CAPITAL' | 'PENALIDAD_RESCATE';
  glosa_descripcion: string;
  moneda: string;
  monto_cobrar: number;
  fecha_proyectada_cobro: string; // YYYY-MM-DD
  estado: 'PENDIENTE' | 'COBRADO' | 'ANULADO';
  prioridad: number;
  tasa?: number | null;
  es_rescate_total?: boolean;
  creado_por: string;
  created_at?: string;
}

export interface ContratoBusqueda extends Contrato {
  nombre_inversionista_temp?: string;
}

export interface FondoRules {
  plazo_rescate_meses?: number | null;
  plazo_opcion_de_rescate_dias?: number | null;
  penalidad_rescate?: number | null;
  tasa?: number | null;
  id_fondo?: string;
}

/**
  * Helper para determinar si un contrato está vivo (activo)
  */
 const esContratoVivo = (estado?: string): boolean => {
   if (!estado) return false;
   const e = String(estado).toLowerCase().trim();
   if (e.includes('cerrad') || e.includes('liquid') || e.includes('anulad') || e.includes('retirad') || e.includes('rescate')) {
     return false;
   }
   return e === 'emitido' || e === 'activo' || e === 'vigente';
 };

/**
 * Busca únicamente contratos vivos (activos) por ID exacto o por coincidencia en inversionista
 */
export const buscarContratosPadre = async (busqueda: string): Promise<ContratoBusqueda[]> => {
  const qStr = busqueda.trim().toUpperCase();
  if (!qStr) return [];

  // 1. Coincidencia exacta por ID de Contrato
  const { data: exactC } = await supabase
    .from('crm_contratos')
    .select('*')
    .eq('id_contrato', qStr);

  if (exactC && exactC.length > 0) {
    const filtrados = exactC.filter(c => esContratoVivo(c.estado));
    if (filtrados.length > 0) return filtrados as ContratoBusqueda[];
  }

  // 2. Coincidencia por inversionista
  const { data: invs } = await supabase
    .from('crm_inversionistas')
    .select('codigo_inversionista, nombre_completo, documento_identidad')
    .or(`nombre_completo.ilike.%${qStr}%,documento_identidad.ilike.%${qStr}%`);

  if (invs && invs.length > 0) {
    const codigos = invs.map(i => i.codigo_inversionista);
    const legacyCodigos = codigos.map(cod => `DNI${cod.replace('DNI', '')}`);
    const todosCodigos = Array.from(new Set([...codigos, ...legacyCodigos]));

    const { data: contrs } = await supabase
      .from('crm_contratos')
      .select('*')
      .in('id_inversionista_1', todosCodigos)
      .eq('estado', 'emitido');

    if (contrs && contrs.length > 0) {
      const nombresMap = new Map<string, string>();
      invs.forEach(i => nombresMap.set(i.codigo_inversionista, i.nombre_completo));

      const filtrados = contrs.filter(c => esContratoVivo(c.estado));

      return filtrados.map(c => {
        const cleanCode = String(c.id_inversionista_1).replace('DNI', '');
        return {
          ...c,
          nombre_inversionista_temp: nombresMap.get(c.id_inversionista_1) || nombresMap.get(cleanCode) || c.id_inversionista_1
        };
      });
    }
  }

  return [];
};

/**
 * Obtiene el ID del certificado activo vinculado a un contrato (o fallback inandes)
 */
export const getActiveCertificadoByContrato = async (idContrato: string): Promise<string> => {
  const { data: certs } = await supabase
    .from('crm_certificados')
    .select('id_certificado, estado')
    .eq('id_contrato', idContrato)
    .eq('estado', 'ACTIVO');

  if (certs && certs.length > 0) {
    return certs[0].id_certificado;
  }

  const { data: fallbacks } = await supabase
    .from('crm_certificados')
    .select('id_certificado')
    .eq('id_contrato', idContrato)
    .neq('estado', 'ANULADO')
    .order('fecha_emision', { ascending: false })
    .limit(1);

  if (fallbacks && fallbacks.length > 0) {
    return fallbacks[0].id_certificado;
  }

  // Fallback si no existe certificado
  return `${idContrato}.00000000.00000000`;
};

/**
 * Obtiene el capital base activo real vinculado a un contrato (saldo tras último cierre contable o fallback a monto_inversion)
 */
export const getActiveCapitalBalance = async (idContrato: string, fallbackMonto: number = 0): Promise<number> => {
  try {
    const { data: events } = await supabase
      .from('crm_certificados_eventos')
      .select('capital_final_saldo, capital_base, fecha_periodo_fin')
      .eq('id_contrato', idContrato)
      .order('fecha_periodo_fin', { ascending: false })
      .limit(1);

    if (events && events.length > 0 && events[0].capital_final_saldo != null && Number(events[0].capital_final_saldo) > 0) {
      return Number(events[0].capital_final_saldo);
    }
  } catch (err) {
    console.error('Error al obtener saldo capital activo:', err);
  }
  return fallbackMonto;
};

/**
 * Obtiene las reglas del fondo
 */
export const getFondoRules = async (idFondo: string): Promise<{ rules: FondoRules, tasaMinima: number }> => {
  const { data: plazos } = await supabase
    .from('crm_fondos')
    .select('plazo_rescate_meses, plazo_opcion_de_rescate_dias, penalidad_rescate, tasa, id_fondo')
    .eq('id_fondo', idFondo);

  if (!plazos || plazos.length === 0) {
    return { rules: {}, tasaMinima: 0 };
  }

  const rules: FondoRules = plazos[0];
  const todasLasTasas = plazos.map(p => p.tasa).filter((t): t is number => typeof t === 'number');
  const tasaMinima = todasLasTasas.length > 0 ? Math.min(...todasLasTasas) : 0;

  return { rules, tasaMinima };
};

/**
 * Obtiene las deducciones y rescates registrados para un certificado o contrato
 */
export const getCronogramaDeducciones = async (idCertificado: string, idContrato?: string): Promise<DeduccionCuota[]> => {
  let query = supabase
    .from('crm_cronograma_deducciones_rescates')
    .select('*');

  const targetId = idContrato || idCertificado;
  if (targetId) {
    const cidOnly = targetId.split('.')[0];
    query = query.or(`id_certificado.eq.${idCertificado},id_contrato.eq.${targetId},id_contrato.eq.${cidOnly},id_certificado.ilike.%${cidOnly}%`);
  }

  const { data, error } = await query.order('fecha_proyectada_cobro', { ascending: true });

  if (error) throw new Error(`Error al obtener cronograma: ${error.message}`);
  return data || [];
};

/**
 * Obtiene todos los cronogramas registrados a nivel global
 */
export const getCronogramaDeduccionesGlobal = async (): Promise<DeduccionCuota[]> => {
  const { data, error } = await supabase
    .from('crm_cronograma_deducciones_rescates')
    .select('*')
    .order('fecha_proyectada_cobro', { ascending: true });

  if (error) throw new Error(`Error al obtener cronogramas globales: ${error.message}`);
  return data || [];
};

/**
 * Inserta múltiples cuotas del cronograma
 */
export const insertCronogramaDeducciones = async (cuotas: DeduccionCuota[]): Promise<void> => {
  // Filtrar campos de UI (como es_rescate_total) que no son columnas físicas en Postgres
  const cleanPayload = cuotas.map(({ es_rescate_total, ...rest }) => rest);

  const { error } = await supabase
    .from('crm_cronograma_deducciones_rescates')
    .upsert(cleanPayload, { onConflict: 'id_cuota' });

  if (error) throw new Error(`Error al registrar cronograma: ${error.message}`);
};
