// src/services/inversionistasService.ts
import { supabase } from './supabaseClient';

export interface Inversionista {
  id?: string;
  created_at?: string;
  updated_at?: string;

  // Identidad
  codigo_inversionista?: string | null;
  tipo_doc: string;
  documento_identidad: string;
  nombre_1: string;
  nombre_2?: string | null;
  apellido_1: string;
  apellido_2?: string | null;
  nombre_completo?: string; // Stored Generated in DB

  // Datos Personales
  fecha_nacimiento?: string | null;
  estado_civil?: string | null;
  nacionalidad?: string | null;
  residente_peru?: boolean | null;

  // Contacto
  email?: string | null;
  telefono?: string | null;
  direccion_fiscal?: string | null;
  codigo_postal?: string | null;

  // Cónyuge
  conyuge_nombre_1?: string | null;
  conyuge_nombre_2?: string | null;
  conyuge_apellido_1?: string | null;
  conyuge_apellido_2?: string | null;
  conyuge_tipo_documento?: string | null;
  conyuge_num_documento?: string | null;

  // Datos Laborales
  ocupacion?: string | null;
  centro_labores?: string | null;
  cargo_ocupado?: string | null;
  antiguedad_laboral_anios?: number | null;

  // Datos Bancarios (PEN / USD)
  banco_nombre_pen?: string | null;
  numero_cuenta_pen?: string | null;
  cci_pen?: string | null;
  banco_nombre_usd?: string | null;
  numero_cuenta_usd?: string | null;
  cci_usd?: string | null;

  // Compliance
  es_pep?: boolean | null;
  pep_detalle?: string | null;
  perfil_riesgo?: string | null;
  estado_compliance?: 'borrador' | 'solicitado' | 'aprobado' | 'rechazado';
  fecha_solicitud_compliance?: string | null;
  fecha_aprobacion_compliance?: string | null;
  firma_oficial_json?: Record<string, any> | null;
  observaciones_compliance?: string | null;
}

/**
 * Consulta la lista completa de inversionistas partícipes, ordenada alfabéticamente por primer apellido.
 */
export const getInversionistas = async (): Promise<Inversionista[]> => {
  const { data, error } = await supabase
    .from('crm_inversionistas')
    .select('*')
    .order('apellido_1', { ascending: true });

  if (error) {
    console.error('Error en getInversionistas:', error.message);
    throw new Error(`Error cargando inversionistas: ${error.message}`);
  }

  return data as Inversionista[];
};

/**
 * Consulta un inversionista individual mediante su documento de identidad o código.
 */
export const getInversionistaById = async (docOrCode: string): Promise<Inversionista | null> => {
  const { data, error } = await supabase
    .from('crm_inversionistas')
    .select('*')
    .or(`documento_identidad.eq.${docOrCode},codigo_inversionista.eq.${docOrCode}`)
    .maybeSingle();

  if (error) {
    console.error(`Error en getInversionistaById (${docOrCode}):`, error.message);
    throw new Error(`Error cargando los detalles del inversionista: ${error.message}`);
  }

  return data as Inversionista;
};

/**
 * Registra o actualiza la ficha del inversionista (upsert).
 */
export const upsertInversionista = async (inversionista: Partial<Inversionista>): Promise<Inversionista> => {
  const payload = { ...inversionista };

  // Eliminar columnas sintéticas/generadas que no existen en crm_inversionistas
  delete payload.updated_at;
  delete payload.created_at;
  delete payload.id;
  // Auto-generar codigo_inversionista si no viene o viene nulo/vacío
  if (!payload.codigo_inversionista && payload.documento_identidad) {
    const prefix = (payload.tipo_doc || 'DNI').toUpperCase().trim();
    payload.codigo_inversionista = `${prefix}${payload.documento_identidad.trim()}`;
  }

  // Recalcular siempre el nombre_completo actualizado
  const ap1 = payload.apellido_1 || '';
  const ap2 = payload.apellido_2 || '';
  const nom1 = payload.nombre_1 || '';
  const nom2 = payload.nombre_2 || '';
  payload.nombre_completo = `${ap1} ${ap2} ${nom1} ${nom2}`.replace(/\s+/g, ' ').trim();

  const { data, error } = await supabase
    .from('crm_inversionistas')
    .upsert(payload, { onConflict: 'documento_identidad' })
    .select()
    .single();

  if (error) {
    console.error('Error en upsertInversionista:', error.message);
    throw new Error(`Error al guardar los cambios: ${error.message}`);
  }

  return data as Inversionista;
};
