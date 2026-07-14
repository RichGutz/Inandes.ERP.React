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
 * Consulta un inversionista individual mediante su UUID.
 */
export const getInversionistaById = async (id: string): Promise<Inversionista | null> => {
  const { data, error } = await supabase
    .from('crm_inversionistas')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error(`Error en getInversionistaById (${id}):`, error.message);
    throw new Error(`Error cargando los detalles del inversionista: ${error.message}`);
  }

  return data as Inversionista;
};

/**
 * Registra o actualiza la ficha del inversionista (upsert).
 */
export const upsertInversionista = async (inversionista: Partial<Inversionista>): Promise<Inversionista> => {
  const { data, error } = await supabase
    .from('crm_inversionistas')
    .upsert({
      ...inversionista,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error('Error en upsertInversionista:', error.message);
    throw new Error(`Error al guardar los cambios: ${error.message}`);
  }

  return data as Inversionista;
};
