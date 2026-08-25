import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://egvcinsbyropumybatdf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVndmNpbnNieXJvcHVteWJhdGRmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDA0NDczNCwiZXhwIjoyMDk5NjIwNzM0fQ.28T_xQmSRJO1O1scio61JU0KHhEQfzSS94qYka8TrcA';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function inspectMaldonado() {
  console.log('=== 1. CONTRATOS EXACTOS 081 Y 084 ===');
  const { data: contratos, error: cErr } = await supabase
    .from('crm_contratos')
    .select('*')
    .in('id_contrato', ['NSGPEN01-081.20160101', 'NSGPEN01-084.20160101']);
  
  console.log('Contratos encontrados:', contratos);

  console.log('\n=== 2. EVENTOS DE ENERO Y FEBRERO EN crm_certificados_eventos ===');
  const { data: eventos } = await supabase
    .from('crm_certificados_eventos')
    .select('*')
    .in('id_contrato', ['NSGPEN01-081.20160101', 'NSGPEN01-084.20160101'])
    .order('fecha_periodo_fin', { ascending: true });
  
  console.table(eventos?.map(e => ({
    id_contrato: e.id_contrato,
    id_certificado: e.id_certificado,
    tipo_evento: e.tipo_evento,
    f_inicio: e.fecha_periodo_origen,
    f_fin: e.fecha_periodo_fin,
    cap_base: e.capital_base,
    cap_final: e.capital_final_saldo,
    monto_rescate: e.monto_rescate
  })));

  console.log('\n=== 3. CRONOGRAMAS ===');
  const { data: cronos } = await supabase
    .from('crm_cronograma_deducciones_rescates')
    .select('*')
    .in('id_contrato', ['NSGPEN01-081.20160101', 'NSGPEN01-084.20160101']);
  
  console.table(cronos?.map(cr => ({
    id_cuota: cr.id_cuota,
    id_contrato: cr.id_contrato,
    tipo_cargo: cr.tipo_cargo,
    fecha_cobro: cr.fecha_proyectada_cobro,
    monto: cr.monto_cobrar,
    estado: cr.estado,
    glosa: cr.glosa_descripcion
  })));
}

inspectMaldonado().catch(console.error);
