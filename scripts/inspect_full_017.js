import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://egvcinsbyropumybatdf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVndmNpbnNieXJvcHVteWJhdGRmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDA0NDczNCwiZXhwIjoyMDk5NjIwNzM0fQ.28T_xQmSRJO1O1scio61JU0KHhEQfzSS94qYka8TrcA';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function inspectFull017() {
  console.log('--- EVENTOS DETALLADOS ---');
  const { data: evs } = await supabase.from('crm_certificados_eventos').select('*').ilike('id_contrato', '%017%').order('fecha_periodo_fin', { ascending: true });
  console.log(evs);

  console.log('--- CRONOGRAMAS DETALLADOS ---');
  const { data: cronos } = await supabase.from('crm_cronograma_deducciones_rescates').select('*').ilike('id_contrato', '%017%');
  console.log(cronos);
}

inspectFull017().catch(console.error);
