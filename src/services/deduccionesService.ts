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
 * Busca contratos por ID exacto o por coincidencia en inversionista (nombre o documento)
 */
export const buscarContratosPadre = async (busqueda: string): Promise<ContratoBusqueda[]> => {
  const qStr = busqueda.trim().toUpperCase();
  if (!qStr) return [];

  let contrsToFilter: any[] = [];

  // 1. Coincidencia exacta por ID de Contrato
  const { data: exactC } = await supabase
    .from('crm_contratos')
    .select('*')
    .eq('id_contrato', qStr)
    .neq('estado', 'anulado')
    .neq('estado', 'cancelado')
    .neq('estado', 'cerrado_fin_contrato')
    .neq('estado', 'cerrado_por_rescate');

  if (exactC && exactC.length > 0) {
    contrsToFilter = exactC;
  } else {
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
        .neq('estado', 'anulado')
        .neq('estado', 'cancelado')
        .neq('estado', 'cerrado_fin_contrato')
        .neq('estado', 'cerrado_por_rescate');

      if (contrs && contrs.length > 0) {
        const nombresMap = new Map<string, string>();
        invs.forEach(i => nombresMap.set(i.codigo_inversionista, i.nombre_completo));

        contrsToFilter = contrs.map(c => {
          const cleanCode = String(c.id_inversionista_1).replace('DNI', '');
          return {
            ...c,
            nombre_inversionista_temp: nombresMap.get(c.id_inversionista_1) || nombresMap.get(cleanCode) || c.id_inversionista_1
          };
        });
      }
    }
  }

  if (contrsToFilter.length === 0) return [];

  // 3. Verificar el saldo del último evento registrado en crm_certificados_eventos
  const contractIds = contrsToFilter.map(c => c.id_contrato);

  const { data: evts } = await supabase
    .from('crm_certificados_eventos')
    .select('id_contrato, capital_final_saldo, fecha_periodo_fin, tipo_evento')
    .in('id_contrato', contractIds)
    .order('fecha_periodo_fin', { ascending: false });

  const contrSaldoMap = new Map<string, number>();
  if (evts) {
    for (const ev of evts) {
      if (!contrSaldoMap.has(ev.id_contrato)) {
        contrSaldoMap.set(ev.id_contrato, Number(ev.capital_final_saldo || 0));
      }
    }
  }

  return contrsToFilter.filter(c => {
    const saldo = contrSaldoMap.has(c.id_contrato) ? contrSaldoMap.get(c.id_contrato)! : Number(c.monto_inversion || 1);
    return saldo > 0;
  });
};

/**
 * Obtiene el ID del certificado activo vinculado a un contrato (o fallback inandes)
 */
export const getActiveCertificadoByContrato = async (idContrato: string): Promise<string> => {
  // 1. Buscar en crm_certificados_eventos la clave real de certificado del contrato
  const { data: evts } = await supabase
    .from('crm_certificados_eventos')
    .select('id_certificado')
    .eq('id_contrato', idContrato)
    .order('fecha_periodo_fin', { ascending: false })
    .limit(1);

  if (evts && evts.length > 0 && evts[0].id_certificado) {
    return evts[0].id_certificado;
  }

  // 2. Buscar en crm_certificados como fallback
  const { data: certs } = await supabase
    .from('crm_certificados')
    .select('id_certificado')
    .eq('id_contrato', idContrato)
    .limit(1);

  if (certs && certs.length > 0 && certs[0].id_certificado) {
    return certs[0].id_certificado;
  }

  // 3. Fallback de clave con fecha base
  return `${idContrato}.20251231`;
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
 * Obtiene las deducciones y rescates registrados para un certificado/contrato
 */
export const getCronogramaDeducciones = async (idCertificado: string, idContrato?: string): Promise<DeduccionCuota[]> => {
  let query = supabase.from('crm_cronograma_deducciones_rescates').select('*');

  if (idContrato) {
    query = query.or(`id_certificado.eq.${idCertificado},id_contrato.eq.${idContrato}`);
  } else {
    query = query.eq('id_certificado', idCertificado);
  }

  const { data, error } = await query.order('fecha_proyectada_cobro', { ascending: true });

  if (error) throw new Error(`Error al obtener cronograma: ${error.message}`);
  
  // Desduplicar por id_cuota
  const uniqueMap = new Map<string, DeduccionCuota>();
  (data || []).forEach(item => uniqueMap.set(item.id_cuota, item));
  return Array.from(uniqueMap.values());
};

/**
 * Inserta múltiples cuotas del cronograma
 */
export const insertCronogramaDeducciones = async (cuotas: DeduccionCuota[]): Promise<void> => {
  const { error } = await supabase
    .from('crm_cronograma_deducciones_rescates')
    .insert(cuotas);

  if (error) throw new Error(`Error al registrar cronograma: ${error.message}`);
};
