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
  fecha_desembolso_esperada?: string;
  fecha_desembolso?: string;
  fecha_vencimiento?: string;
  fecha_creacion?: string;
  status_cavali?: string;
  status_letra?: string;
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

const getApiBaseUrl = (): string => {
  if (import.meta.env.VITE_API_FACTORING_URL) {
    return import.meta.env.VITE_API_FACTORING_URL;
  }
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return 'https://api-factoring.geeksoft.tech';
  }
  return 'http://localhost:8000';
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
      const API_BASE = getApiBaseUrl();
      const url = estadoFiltro 
        ? `${API_BASE}/api/originacion/operaciones?estado=${estadoFiltro}` 
        : `${API_BASE}/api/originacion/operaciones`;
      
      const res = await fetch(url);
      if (res.ok) {
        const jsonRes = await res.json();
        if (jsonRes.operaciones && Array.isArray(jsonRes.operaciones)) {
          return jsonRes.operaciones;
        }
      }
    } catch (err: any) {
      console.warn('Backend API /operaciones no respondió, intentando fallback directo:', err.message);
    }

    // Fallback: consulta directa a Supabase
    try {
      let query = supabase.from('propuestas').select('*');
      if (estadoFiltro) {
        if (estadoFiltro === 'ORIGINADO' || estadoFiltro === 'PENDIENTE') {
          query = query.in('estado', ['ACTIVO', 'ORIGINADO', 'PENDIENTE']);
        } else {
          query = query.eq('estado', estadoFiltro);
        }
      }
      const { data, error } = await query;
      if (error) throw error;

      if (data && data.length > 0) {
        return data.map((item: any) => {
          let rJson: any = {};
          if (item.recalculate_result_json) {
            try {
              rJson = typeof item.recalculate_result_json === 'string'
                ? JSON.parse(item.recalculate_result_json)
                : item.recalculate_result_json;
            } catch (e) {
              console.warn('Error parseando recalculate_result_json:', e);
            }
          }
          
          const calc = rJson.calculo_con_tasa_encontrada || {};
          const desglose = rJson.desglose_final_detallado || {};

          const montoBruto = Number(item.monto_total_factura || item.monto_neto_factura || 0);
          const montoNeto = Number(item.monto_neto_factura || 0);
          const interes = Number(desglose.interes?.monto || calc.interes || item.interes_calculado || 0);
          const comisiones = Number(desglose.comision_estructuracion?.monto || calc.comision_estructuracion || 0);
          const abonoReal = Number(desglose.abono?.monto || calc.abono || item.abono_real_calculado || (montoNeto - interes - comisiones));
          const diasPromedio = Number(calc.plazo_operacion || item.plazo_operacion_calculado || 30);

          return {
            id: item.proposal_id,
            proposal_id: item.proposal_id,
            emisor_ruc: item.emisor_ruc || '',
            emisor_nombre: item.emisor_nombre || 'S/N',
            aceptante_ruc: item.aceptante_ruc || '',
            aceptante_nombre: item.aceptante_nombre || 'S/N',
            moneda: item.moneda_factura || 'PEN',
            monto_bruto_total: montoBruto,
            monto_neto_total: montoNeto,
            interes_total: interes,
            abono_real_total: abonoReal,
            comisiones_fijas: comisiones,
            dias_promedio: diasPromedio,
            estado: item.estado === 'ACTIVO' ? 'ORIGINADO' : item.estado,
            fecha_desembolso_esperada: item.fecha_desembolso_factoring || '',
            fecha_creacion: item.fecha_registro || ''
          };
        });
      }
      return [];
    } catch (err: any) {
      console.warn('Error cargando propuestas desde tabla propuestas:', err.message);
      return [];
    }
  },

  async cambiarEstadoOperacion(id: string, nuevoEstado: string, metaData?: any): Promise<void> {
    try {
      const { error } = await supabase
        .from('propuestas')
        .update({ 
          estado: nuevoEstado,
          ...metaData
        })
        .eq('proposal_id', id);

      if (error) throw error;
    } catch (err: any) {
      console.error('Error al actualizar estado en propuestas:', err.message);
      throw err;
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

