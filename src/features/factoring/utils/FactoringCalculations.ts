import { differenceInDays, parseISO } from 'date-fns';

export interface InvoiceItem {
  id: string; // temp id for UI
  numero_factura: string;
  monto_total: number;
  fecha_emision: string; // YYYY-MM-DD
  fecha_pago_esperada: string; // YYYY-MM-DD
  tasa_avance: number; // e.g. 90%
  tasa_interes_mensual: number; // e.g. 2.5%
  retencion_garantia: number; // monto fijo o porcentaje extra
  dias_credito?: number;
  monto_neto?: number; // Monto * Avance
  interes_calculado?: number;
  abono_real?: number;
}

export interface FactoringBatch {
  emisor_id: string;
  aceptante_id: string;
  facturas: InvoiceItem[];
  fecha_desembolso: string;
  moneda: 'PEN' | 'USD';
  comisiones_fijas: number;
}

export interface FactoringMetrics {
  montoBrutoTotal: number;
  montoNetoTotal: number;
  interesTotal: number;
  retencionTotal: number;
  abonoRealTotal: number;
  diasPromedio: number;
}

/**
 * Recalcula las métricas de una factura individual.
 */
export const calculateInvoiceMetrics = (
  invoice: InvoiceItem,
  fechaDesembolso: string
): InvoiceItem => {
  if (!invoice.fecha_pago_esperada || !invoice.monto_total) return invoice;

  const dateDesembolso = parseISO(fechaDesembolso);
  const datePago = parseISO(invoice.fecha_pago_esperada);
  
  // Días de Crédito (Desde Desembolso hasta Pago Esperado + Gracia)
  // Nota: En la vida real suele agregarse 8 días de gracia, lo ajustamos a 0 por ahora para el simulador básico
  const diasCredito = Math.max(0, differenceInDays(datePago, dateDesembolso));

  const montoNeto = invoice.monto_total * ((invoice.tasa_avance || 0) / 100);
  
  // Fórmula de Interés Simple Diario: Monto Neto * (Tasa Mensual / 30) * Días
  const tasaDiaria = (invoice.tasa_interes_mensual || 0) / 100 / 30;
  const interesCalculado = montoNeto * tasaDiaria * diasCredito;
  
  const abonoReal = montoNeto - interesCalculado - (invoice.retencion_garantia || 0);

  return {
    ...invoice,
    dias_credito: diasCredito,
    monto_neto: montoNeto,
    interes_calculado: interesCalculado,
    abono_real: abonoReal
  };
};

/**
 * Calcula los totales consolidados de un lote de facturas.
 */
export const calculateBatchMetrics = (batch: FactoringBatch): FactoringMetrics => {
  const recalculatedInvoices = batch.facturas.map(inv => 
    calculateInvoiceMetrics(inv, batch.fecha_desembolso)
  );

  const totalBruto = recalculatedInvoices.reduce((acc, inv) => acc + (inv.monto_total || 0), 0);
  const totalNeto = recalculatedInvoices.reduce((acc, inv) => acc + (inv.monto_neto || 0), 0);
  const totalInteres = recalculatedInvoices.reduce((acc, inv) => acc + (inv.interes_calculado || 0), 0);
  const totalRetencion = recalculatedInvoices.reduce((acc, inv) => acc + (inv.retencion_garantia || 0), 0);
  
  // Promedio ponderado de días por monto
  let sumaDiasMonto = 0;
  recalculatedInvoices.forEach(inv => {
    sumaDiasMonto += (inv.dias_credito || 0) * (inv.monto_neto || 0);
  });
  const diasPromedio = totalNeto > 0 ? sumaDiasMonto / totalNeto : 0;

  const abonoReal = totalNeto - totalInteres - totalRetencion - (batch.comisiones_fijas || 0);

  return {
    montoBrutoTotal: totalBruto,
    montoNetoTotal: totalNeto,
    interesTotal: totalInteres,
    retencionTotal: totalRetencion,
    abonoRealTotal: abonoReal,
    diasPromedio: diasPromedio
  };
};
