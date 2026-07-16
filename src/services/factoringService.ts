import { supabase } from './supabaseClient';
import type { FactoringBatch } from '../features/factoring/utils/FactoringCalculations';

// --- Tipos para las entidades del negocio ---
export interface EmisorAceptante {
  id: string;
  ruc: string;
  razon_social: string;
  tipo: 'emisor' | 'aceptante' | 'ambos';
}

export interface OperacionFactoring {
  id?: string;
  proposal_id: string;
  emisor_ruc: string;
  emisor_nombre: string;
  aceptante_ruc: string;
  aceptante_nombre: string;
  moneda: 'PEN' | 'USD';
  monto_bruto_total: number;
  monto_neto_total: number;
  interes_total: number;
  abono_real_total: number;
  comisiones_fijas: number;
  dias_promedio: number;
  estado: 'ORIGINADO' | 'APROBADO' | 'DESEMBOLSADO' | 'LIQUIDADO' | 'REPOSITORIO';
  fecha_desembolso_esperada: string;
  fecha_creacion?: string;
}

export interface FacturaDetalle {
  id?: string;
  operacion_id: string;
  numero_factura: string;
  monto_total: number;
  monto_neto: number;
  fecha_emision: string;
  fecha_pago_esperada: string;
  dias_credito: number;
  tasa_avance: number;
  tasa_interes_mensual: number;
  interes_calculado: number;
  retencion_garantia: number;
  abono_real: number;
}

// --- Tipos legacy (compatibilidad) ---
export interface PropuestaFactoring {
  proposal_id: string;
  emisor_ruc: string;
  aceptante_ruc: string;
  emisor_nombre: string;
  aceptante_nombre: string;
  numero_factura: string;
  monto_total_factura: number;
  monto_neto_factura: number;
  fecha_emision_factura: string;
  plazo_credito_dias: number;
  tasa_de_avance: number;
  interes_mensual: number;
  estado: string;
  capital_calculado?: number;
  interes_calculado?: number;
  abono_real_calculado?: number;
}

export interface InvoiceStatusRegistry {
  id: string;
  proposal_id: string;
  estado_actual: string;
  saldo_pendiente: number;
  monto_desembolsado: number;
  fecha_desembolso?: string;
  fecha_liquidacion?: string;
}

// --- Generador de ID de propuesta ---
const generateProposalId = (): string => {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `FACT-${yy}${mm}${dd}-${rand}`;
};

export const factoringService = {

  // --- Propuestas (legacy) ---
  async getPropuestasActivas(): Promise<PropuestaFactoring[]> {
    const { data, error } = await supabase
      .from('propuestas')
      .select('*')
      .eq('estado', 'ACTIVO');
    if (error) throw error;
    return data || [];
  },

  async getInvoiceStatus(estadoFiltro?: string): Promise<InvoiceStatusRegistry[]> {
    let query = supabase.from('invoice_status_registry').select('*');
    if (estadoFiltro) {
      query = query.eq('estado_actual', estadoFiltro);
    }
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  // --- Clientes (Emisores y Aceptantes) ---
  async searchClientes(searchTerm: string): Promise<EmisorAceptante[]> {
    if (!searchTerm || searchTerm.length < 2) return [];
    const { data, error } = await supabase
      .from('factoring_clientes')
      .select('id, ruc, razon_social, tipo')
      .or(`ruc.ilike.%${searchTerm}%,razon_social.ilike.%${searchTerm}%`)
      .limit(10);
    if (error) {
      console.warn('Tabla factoring_clientes no disponible, usando demo:', error.message);
      // Demo fallback mientras se crea la tabla
      return ([
        { id: 'demo-1', ruc: '20123456789', razon_social: 'EMPRESA DEMO SAC', tipo: 'emisor' as const },
        { id: 'demo-2', ruc: '20987654321', razon_social: 'ACEPTANTE DEMO SA', tipo: 'aceptante' as const },
      ] as EmisorAceptante[]).filter(c => c.ruc.includes(searchTerm) || c.razon_social.toLowerCase().includes(searchTerm.toLowerCase()));
    }
    return data || [];
  },

  // --- Grabar Operación de Originación ---
  async submitOriginacion(
    batch: FactoringBatch,
    metrics: {
      montoBrutoTotal: number;
      montoNetoTotal: number;
      interesTotal: number;
      retencionTotal: number;
      abonoRealTotal: number;
      diasPromedio: number;
    },
    emisorNombre: string,
    aceptanteNombre: string
  ): Promise<{ proposal_id: string }> {
    const proposalId = generateProposalId();

    // 1. Insertar cabecera de operación
    const operacion: OperacionFactoring = {
      proposal_id: proposalId,
      emisor_ruc: batch.emisor_id,
      emisor_nombre: emisorNombre,
      aceptante_ruc: batch.aceptante_id,
      aceptante_nombre: aceptanteNombre,
      moneda: batch.moneda,
      monto_bruto_total: metrics.montoBrutoTotal,
      monto_neto_total: metrics.montoNetoTotal,
      interes_total: metrics.interesTotal,
      abono_real_total: metrics.abonoRealTotal,
      comisiones_fijas: batch.comisiones_fijas,
      dias_promedio: metrics.diasPromedio,
      estado: 'ORIGINADO',
      fecha_desembolso_esperada: batch.fecha_desembolso,
    };

    const { data: opData, error: opError } = await supabase
      .from('factoring_operaciones')
      .insert(operacion)
      .select('id')
      .single();

    if (opError) throw opError;

    // 2. Insertar facturas detalle
    const facturasInsert: FacturaDetalle[] = batch.facturas.map(inv => ({
      operacion_id: opData.id,
      numero_factura: inv.numero_factura,
      monto_total: inv.monto_total,
      monto_neto: inv.monto_neto || 0,
      fecha_emision: inv.fecha_emision,
      fecha_pago_esperada: inv.fecha_pago_esperada,
      dias_credito: inv.dias_credito || 0,
      tasa_avance: inv.tasa_avance,
      tasa_interes_mensual: inv.tasa_interes_mensual,
      interes_calculado: inv.interes_calculado || 0,
      retencion_garantia: inv.retencion_garantia || 0,
      abono_real: inv.abono_real || 0,
    }));

    if (facturasInsert.length > 0) {
      const { error: facError } = await supabase
        .from('factoring_facturas')
        .insert(facturasInsert);
      if (facError) throw facError;
    }

    return { proposal_id: proposalId };
  },
};
