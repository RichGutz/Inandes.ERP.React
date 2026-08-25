import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://egvcinsbyropumybatdf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVndmNpbnNieXJvcHVteWJhdGRmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDA0NDczNCwiZXhwIjoyMDk5NjIwNzM0fQ.28T_xQmSRJO1O1scio61JU0KHhEQfzSS94qYka8TrcA';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function inspect037() {
  console.log('=== 1. CONTRATOS NSGPEN03-037 ===');
  const { data: contratos } = await supabase
    .from('crm_contratos')
    .select('*')
    .ilike('id_contrato', '%NSGPEN03-037%');
  console.log(contratos);

  console.log('\n=== 2. CRONOGRAMAS CONTRATO 037 / MONTO 1307 ===');
  const { data: cronos } = await supabase
    .from('crm_cronograma_deducciones_rescates')
    .select('*')
    .or('id_contrato.ilike.%NSGPEN03-037%,monto_cobrar.eq.1307.03,monto_cobrar.eq.1307.02');
  console.table(cronos);

  console.log('\n=== 3. EVENTOS (037) ===');
  const { data: eventos } = await supabase
    .from('crm_certificados_eventos')
    .select('*')
    .ilike('id_contrato', '%NSGPEN03-037%')
    .order('fecha_periodo_fin', { ascending: true });
  console.table(eventos?.map(e => ({
    id_evento: e.id_evento,
    id_contrato: e.id_contrato,
    id_certificado: e.id_certificado,
    tipo_evento: e.tipo_evento,
    f_fin: e.fecha_periodo_fin,
    cap_base: e.capital_base,
    cap_final: e.capital_final_saldo,
    monto_rescate: e.monto_rescate,
    monto_deduccion: e.monto_deduccion
  })));
}

inspect037().catch(console.error);
