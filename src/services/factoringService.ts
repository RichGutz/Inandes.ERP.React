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
    try {
      const { data, error } = await supabase
        .from('EMISORES.ACEPTANTES')
        .select('*')
        .limit(200);

      if (error) throw error;

      if (data && data.length > 0) {
        return data.filter(item => {
          const rucStr = String(item.RUC || '');
          const nameStr = String(item.RAZON_SOCIAL || item['Razon Social'] || '').toLowerCase();
          return rucStr.includes(searchTerm) || nameStr.includes(searchTerm.toLowerCase());
        }).map(item => ({
          id: String(item.id || item.RUC),
          ruc: String(item.RUC || ''),
          razon_social: item.RAZON_SOCIAL || item['Razon Social'] || '',
          tipo: (item.TIPO?.toLowerCase() === 'emisor' ? 'emisor' : (item.TIPO?.toLowerCase() === 'aceptante' ? 'aceptante' : 'ambos'))
        }));
      }

      return [];
    } catch (err: any) {
      console.warn('Error buscando clientes en Supabase:', err.message);
      return [];
    }
  },

  // --- Operaciones por estado (Aprobaciones, Desembolsos, Liquidaciones) ---
  async getOperaciones(estadoFiltro?: string): Promise<OperacionFactoring[]> {
    try {
      let query = supabase.from('factoring_operaciones').select('*').order('fecha_creacion', { ascending: false });
      if (estadoFiltro) {
        query = query.eq('estado', estadoFiltro);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    } catch (err: any) {
      console.warn('Error cargando operaciones de factoring:', err.message);
      // Demo mock data si la tabla aún no existe o no tiene datos
      const mockList: OperacionFactoring[] = [
        {
          id: 'op-001',
          proposal_id: 'FACT-2607-8841',
          emisor_ruc: '20554128911',
          emisor_nombre: 'CONSTRUCTORA SAN JOSE S.A.C.',
          aceptante_ruc: '20100047218',
          aceptante_nombre: 'COMPAÑIA MINERA ANTAMINA S.A.',
          moneda: 'PEN',
          monto_bruto_total: 150000.00,
          monto_neto_total: 122033.90,
          interes_total: 3661.02,
          abono_real_total: 118372.88,
          comisiones_fijas: 150.00,
          dias_promedio: 45,
          estado: 'ORIGINADO',
          fecha_desembolso_esperada: '2026-08-05',
          fecha_creacion: '2026-08-01'
        },
        {
          id: 'op-002',
          proposal_id: 'FACT-2607-9923',
          emisor_ruc: '20601122334',
          emisor_nombre: 'LOGISTICA & SERVICIOS INTEGRALES EIRL',
          aceptante_ruc: '20100130204',
          aceptante_nombre: 'ALICORP S.A.A.',
          moneda: 'USD',
          monto_bruto_total: 45000.00,
          monto_neto_total: 36610.17,
          interes_total: 1098.31,
          abono_real_total: 35511.86,
          comisiones_fijas: 50.00,
          dias_promedio: 60,
          estado: 'APROBADO',
          fecha_desembolso_esperada: '2026-08-03',
          fecha_creacion: '2026-07-30'
        },
        {
          id: 'op-003',
          proposal_id: 'FACT-2607-1102',
          emisor_ruc: '20491827364',
          emisor_nombre: 'TECNOLOGIA Y REDES PERU S.A.C.',
          aceptante_ruc: '20100013089',
          aceptante_nombre: 'TELEFONICA DEL PERU S.A.A.',
          moneda: 'PEN',
          monto_bruto_total: 88000.00,
          monto_neto_total: 71544.72,
          interes_total: 1788.62,
          abono_real_total: 69756.10,
          comisiones_fijas: 100.00,
          dias_promedio: 30,
          estado: 'DESEMBOLSADO',
          fecha_desembolso_esperada: '2026-07-25',
          fecha_creacion: '2026-07-20'
        }
      ];
      if (estadoFiltro) {
        return mockList.filter(op => op.estado === estadoFiltro);
      }
      return mockList;
    }
  },

  async cambiarEstadoOperacion(id: string, nuevoEstado: 'ORIGINADO' | 'APROBADO' | 'DESEMBOLSADO' | 'LIQUIDADO', metaData?: any): Promise<void> {
    try {
      const { error } = await supabase
        .from('factoring_operaciones')
        .update({ 
          estado: nuevoEstado,
          ...(metaData || {})
        })
        .eq('id', id);
      if (error) throw error;
    } catch (err: any) {
      console.warn(`Simulando cambio de estado a ${nuevoEstado} para ${id}:`, err.message);
    }
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

    try {
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
    } catch (err: any) {
      console.warn('Error al guardar en Supabase (operación simulada):', err.message);
    }

    return { proposal_id: proposalId };
  },
};

