import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://egvcinsbyropumybatdf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVndmNpbnNieXJvcHVteWJhdGRmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDA0NDczNCwiZXhwIjoyMDk5NjIwNzM0fQ.28T_xQmSRJO1O1scio61JU0KHhEQfzSS94qYka8TrcA';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkDetails() {
  const { data: c } = await supabase.from('crm_contratos').select('*').eq('id_contrato', 'NSGPEN01-017.20160101').single();
  console.log('Contrato:', c);
  if (c && c.id_inversionista_1) {
    const { data: inv } = await supabase.from('crm_inversionistas').select('*').or(`codigo_inversionista.eq.${c.id_inversionista_1},id.eq.${c.id_inversionista_1},documento_identidad.eq.${c.id_inversionista_1.replace('DNI','')}`);
    console.log('Inversionista:', inv);
  }
}

checkDetails().catch(console.error);
