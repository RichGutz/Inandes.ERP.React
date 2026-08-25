import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://egvcinsbyropumybatdf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVndmNpbnNieXJvcHVteWJhdGRmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDA0NDczNCwiZXhwIjoyMDk5NjIwNzM0fQ.28T_xQmSRJO1O1scio61JU0KHhEQfzSS94qYka8TrcA';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function verify017() {
  console.log('=== VERIFICACION FINAL NSGPEN01-017 ===');
  const { data: c } = await supabase.from('crm_contratos').select('id_contrato, estado, monto_inversion, fecha_inicio, fecha_fin').eq('id_contrato', 'NSGPEN01-017.20160101');
  console.log('Contrato:', c);

  const { data: cron } = await supabase.from('crm_cronograma_deducciones_rescates').select('id_cuota, fecha_proyectada_cobro, monto_cobrar, estado').eq('id_contrato', 'NSGPEN01-017.20160101');
  console.log('Cronograma:');
  console.table(cron);

  const { data: ev } = await supabase.from('crm_certificados_eventos').select('id_evento, id_certificado, tipo_evento, fecha_periodo_fin, capital_base, capital_final_saldo, monto_rescate').eq('id_contrato', 'NSGPEN01-017.20160101');
  console.log('Eventos:');
  console.table(ev);
}

verify017().catch(console.error);
