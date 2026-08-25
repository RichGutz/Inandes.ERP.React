import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://egvcinsbyropumybatdf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVndmNpbnNieXJvcHVteWJhdGRmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDA0NDczNCwiZXhwIjoyMDk5NjIwNzM0fQ.28T_xQmSRJO1O1scio61JU0KHhEQfzSS94qYka8TrcA';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function inspectContract017() {
  console.log('=== 1. CONTRATO NSGPEN01-017 ===');
  const { data: contratos, error: cErr } = await supabase
    .from('crm_contratos')
    .select('*')
    .ilike('id_contrato', '%NSGPEN01-017%');
  
  if (cErr) throw cErr;
  console.log(contratos);

  console.log('\n=== 2. CRONOGRAMA DEDUCCIONES / RESCATES (017) ===');
  const { data: cronos, error: crErr } = await supabase
    .from('crm_cronograma_deducciones_rescates')
    .select('*')
    .ilike('id_contrato', '%NSGPEN01-017%');
  
  if (crErr) throw crErr;
  console.table(cronos);

  console.log('\n=== 3. EVENTOS (017) ===');
  const { data: eventos, error: evErr } = await supabase
    .from('crm_certificados_eventos')
    .select('*')
    .ilike('id_contrato', '%NSGPEN01-017%')
    .order('fecha_periodo_fin', { ascending: true });
  
  if (evErr) throw evErr;
  console.table(eventos?.map(e => ({
    id_contrato: e.id_contrato,
    id_certificado: e.id_certificado,
    tipo_evento: e.tipo_evento,
    f_origen: e.fecha_periodo_origen,
    f_fin: e.fecha_periodo_fin,
    cap_base: e.capital_base,
    cap_final: e.capital_final_saldo,
    monto_rescate: e.monto_rescate
  })));
}

inspectContract017().catch(console.error);
