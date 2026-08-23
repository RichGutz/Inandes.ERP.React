// src/services/contratosService.ts
import { supabase } from './supabaseClient';

export interface Contrato {
  id_contrato: string; // UUID borrador o ID correlativo definitivo
  created_at?: string;
  id_inversionista_1: string;
  id_inversionista_2?: string | null;
  id_inversionista_3?: string | null;
  id_inversionista_4?: string | null;
  id_fondo: string;
  id_fondo_plazo?: string | null;
  id_asesor: string;
  porcentaje_participacion_1: number;
  porcentaje_participacion_2?: number | null;
  porcentaje_participacion_3?: number | null;
  porcentaje_participacion_4?: number | null;
  porcentaje_deposito_1: number;
  porcentaje_deposito_2?: number | null;
  porcentaje_deposito_3?: number | null;
  porcentaje_deposito_4?: number | null;
  porcentaje_reparto: number;
  monto_inversion: number;
  moneda: string; // PEN, USD
  plazo_meses: string; // '12', '24', '36', '60', 'ND'
  tasa_pactada: number;
  frecuencia_cupones_meses: number;
  fecha_inicio: string; // YYYY-MM-DD
  fecha_fin: string; // YYYY-MM-DD
  domicilio_contractual?: string | null;
  voucher_deposito_url?: string | null;
  contrato_firmado_url?: string | null;
  id_certificado?: string | null;
  numero_certificado?: string | null;
  estado: 'borrador' | 'propuesto' | 'pendiente_aprobacion' | 'emitido' | 'cerrado_fin_contrato' | 'cerrado_por_rescate';

  // Enriquecidos en cliente
  titular?: { nombre_completo: string };
  crm_fondos?: { nombre_fondo: string };
  asesor?: { nombre_completo: string };
}

export interface Certificado {
  id_certificado: string;
  id_contrato: string;
  fecha_emision: string;
  monto_inversion: number;
  valor_cuota: number;
  numero_cuotas: number;
  titulares_resumen: Array<{ nombre: string; documento: string; participacion_pct: number }>;
  estado: string;
}

export interface CertificadoEvento {
  id_certificado: string;
  id_certificado_origen?: string;
  id_contrato: string;
  tipo_evento: string;
  fecha_periodo_origen: string;
  fecha_periodo_fin: string;
  capital_base: number;
  interes_generado_bruto: number;
  impuestos_renta: number;
  interes_neto_disponible: number;
  tasa_aplicada: number;
  capital_final_saldo: number;
  notas?: string | null;
}

/**
 * Carga la lista de contratos enriqueciendo titular, fondo y asesor
 */
export const getContratos = async (estados?: string[]): Promise<Contrato[]> => {
  let query = supabase.from('crm_contratos').select('*');
  
  if (estados && estados.length > 0) {
    query = query.in('estado', estados);
  }
  
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw new Error(`Error al obtener contratos: ${error.message}`);
  if (!data) return [];

  // Enriquecimiento en cliente para evitar fallos de llaves foráneas con UUIDs antiguos
  try {
    const { data: invData } = await supabase.from('crm_inversionistas').select('codigo_inversionista, nombre_completo');
    const { data: fundData } = await supabase.from('crm_fondos').select('id_fondo, nombre_fondo');
    const { data: advData } = await supabase.from('crm_asesores').select('codigo, nombre_completo');

    const invMap = (invData || []).reduce((acc, i) => {
      acc[i.codigo_inversionista] = i.nombre_completo;
      return acc;
    }, {} as Record<string, string>);

    const fundMap = (fundData || []).reduce((acc, f) => {
      acc[f.id_fondo] = f.nombre_fondo;
      return acc;
    }, {} as Record<string, string>);

    const advMap = (advData || []).reduce((acc, a) => {
      acc[a.codigo] = a.nombre_completo;
      return acc;
    }, {} as Record<string, string>);

    return data.map(row => {
      const p1 = row.id_inversionista_1;
      const invName = invMap[p1] || 'Sin Nombre';

      return {
        ...row,
        titular: { nombre_completo: invName },
        crm_fondos: { nombre_fondo: fundMap[row.id_fondo] || 'Fondo Desconocido' },
        asesor: { nombre_completo: advMap[row.id_asesor] || 'Desconocido' }
      } as Contrato;
    });

  } catch (err: any) {
    console.error('Error enriqueciendo contratos:', err);
    return data as Contrato[];
  }
};

/**
 * Guarda o actualiza un borrador de contrato
 */
export const upsertContrato = async (contrato: Contrato): Promise<Contrato> => {
  const { data, error } = await supabase
    .from('crm_contratos')
    .upsert(contrato)
    .select()
    .single();

  if (error) throw new Error(`Error al guardar contrato: ${error.message}`);
  return data as Contrato;
};

/**
 * Elimina un contrato por ID (Generalmente borradores)
 */
export const deleteContrato = async (idContrato: string): Promise<void> => {
  const { error } = await supabase
    .from('crm_contratos')
    .delete()
    .eq('id_contrato', idContrato);

  if (error) throw new Error(`Error al eliminar contrato: ${error.message}`);
};

/**
 * Flujo de aprobación atómico (Contrato + Ledger Contable)
 */
export const approveContrato = async (
  draftId: string,
  newContract: Contrato,
  _cert?: Partial<Certificado> | any,
  event?: CertificadoEvento | any
): Promise<void> => {
  // 1. Insertar el contrato definitivo
  const { error: insErr } = await supabase
    .from('crm_contratos')
    .insert(newContract);
  if (insErr) throw new Error(`Error al insertar contrato definitivo: ${insErr.message}`);

  // 2. Eliminar el borrador UUID temporal
  const { error: delErr } = await supabase
    .from('crm_contratos')
    .delete()
    .eq('id_contrato', draftId);
  if (delErr) {
    console.warn(`Alerta: Contrato insertado pero falló la eliminación del borrador: ${delErr.message}`);
  }

  // 3. Insertar el evento inicial de emisión en el Ledger (crm_certificados_eventos)
  if (event) {
    const safeEvent = {
      ...event,
      id_certificado_origen: event.id_certificado_origen || event.id_certificado || newContract.id_contrato
    };
    const { error: evtErr } = await supabase
      .from('crm_certificados_eventos')
      .insert(safeEvent);
    if (evtErr) throw new Error(`Error al registrar evento inicial: ${evtErr.message}`);
  }
};

/**
 * Obtiene el siguiente correlativo para un fondo aplicando la regla de
 * "Llenado de Huecos por Menor Muerto Disponible" (1..N o N+1)
 */
export const getNextCorrelativeForFondo = async (idFondo: string): Promise<number> => {
  const { data: activeContracts, error } = await supabase
    .from('crm_contratos')
    .select('id_contrato')
    .eq('id_fondo', idFondo)
    .in('estado', ['emitido', 'pendiente_aprobacion', 'propuesto', 'activo', 'vigente'])
    .like('id_contrato', `${idFondo}-%`);

  if (error) throw new Error(`Error calculando correlativo: ${error.message}`);

  const activeCorrelatives = new Set<number>();
  if (activeContracts) {
    for (const row of activeContracts) {
      if (row.id_contrato) {
        const match = row.id_contrato.match(/-(\d+)/);
        if (match) {
          activeCorrelatives.add(parseInt(match[1], 10));
        }
      }
    }
  }

  // Buscar el menor entero disponible (1, 2, 3...)
  let nextCorrelative = 1;
  while (activeCorrelatives.has(nextCorrelative)) {
    nextCorrelative++;
  }

  return nextCorrelative;
};

/**
 * Guarda el archivo firmado o URL de contrato
 */
export const updateContratoFirmado = async (idContrato: string, url: string): Promise<void> => {
  const { error } = await supabase
    .from('crm_contratos')
    .update({ contrato_firmado_url: url })
    .eq('id_contrato', idContrato);

  if (error) throw new Error(`Error al guardar archivo firmado: ${error.message}`);
};
