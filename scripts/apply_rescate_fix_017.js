import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://egvcinsbyropumybatdf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVndmNpbnNieXJvcHVteWJhdGRmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDA0NDczNCwiZXhwIjoyMDk5NjIwNzM0fQ.28T_xQmSRJO1O1scio61JU0KHhEQfzSS94qYka8TrcA';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function applyRescateFix017() {
  console.log('====================================================');
  console.log('APLICANDO CAMBIO DE RESCATE NSGPEN01-017 AL 31/08/2026');
  console.log('====================================================');

  // 1. Eliminar cuota errónea del 28/02/2026 en crm_cronograma_deducciones_rescates
  console.log('\n1. Eliminando cuota errónea del 28/02/2026...');
  const { data: delCron, error: delErr } = await supabase
    .from('crm_cronograma_deducciones_rescates')
    .delete()
    .eq('id_cuota', 'RES-NSGPEN01-017.20160101.260822.260228-C.1/1')
    .select();
  
  if (delErr) {
    console.error('Error al eliminar cuota 28/02:', delErr);
  } else {
    console.log('Cuota 28/02 eliminada:', delCron);
  }

  // 2. Asegurar que la cuota del 31/08/2026 esté en estado PENDIENTE
  console.log('\n2. Verificando/Actualizando cuota del 31/08/2026 a PENDIENTE...');
  const { data: updCron, error: updCronErr } = await supabase
    .from('crm_cronograma_deducciones_rescates')
    .update({ estado: 'PENDIENTE', fecha_proyectada_cobro: '2026-08-31' })
    .eq('id_cuota', 'RES-NSGPEN01-017.20160101.260822.260831-C.1/1')
    .select();
  
  if (updCronErr) {
    console.error('Error al actualizar cuota 31/08:', updCronErr);
  } else {
    console.log('Cuota 31/08 actualizada:', updCron);
  }

  // 3. Reactivar el contrato en crm_contratos (estado: emitido)
  console.log('\n3. Actualizando estado del contrato NSGPEN01-017.20160101 a "emitido"...');
  const { data: updContrato, error: updContratoErr } = await supabase
    .from('crm_contratos')
    .update({ estado: 'emitido' })
    .eq('id_contrato', 'NSGPEN01-017.20160101')
    .select();
  
  if (updContratoErr) {
    console.error('Error al actualizar contrato:', updContratoErr);
  } else {
    console.log('Contrato actualizado:', updContrato);
  }

  // 4. Corregir el asiento contable en crm_certificados_eventos para el corte 2026-02-28
  console.log('\n4. Actualizando asiento de cierre al 2026-02-28 (evento 11572) a cierre_fin_ciclo sin rescate...');
  const { data: updEvento, error: updEvErr } = await supabase
    .from('crm_certificados_eventos')
    .update({
      tipo_evento: 'cierre_fin_ciclo',
      monto_rescate: 0,
      capital_final_saldo: 60000,
      payload_asiento: {
        moneda: 'PEN',
        penalidades: 0,
        capital_base: 60000,
        interes_neto: 967.44,
        tasa_pactada: 0.105,
        audit_version: 'v40 (Ciclo Auditado React)',
        capital_final: 60000,
        interes_bruto: 1018.36,
        inversionista: 'Barton Carmen Michele',
        reparto_valor: 967.44,
        capitalizacion: 0,
        impuesto_5_pct: 50.92,
        aumentos_capital: 0,
        detalle_aumentos: [],
        detalle_rescates: [],
        rescates_capital: 0,
        detalle_deducciones: [],
        deducciones_ordinarias: 0
      }
    })
    .eq('id_evento', 11572)
    .select();

  if (updEvErr) {
    console.error('Error al actualizar asiento 11572:', updEvErr);
  } else {
    console.log('Asiento contable actualizado:', updEvento);
  }
}

applyRescateFix017().catch(console.error);
