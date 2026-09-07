import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://egvcinsbyropumybatdf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVndmNpbnNieXJvcHVteWJhdGRmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDA0NDczNCwiZXhwIjoyMDk5NjIwNzM0fQ.28T_xQmSRJO1O1scio61JU0KHhEQfzSS94qYka8TrcA';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkAllReferences() {
  const targetAgrupador = 'RES-NSGUSD02-042.20250130.260903';
  console.log('Searching references for:', targetAgrupador);

  // Check crm_certificados_eventos where id_deduccion_rescate is not null
  const { data: certEventsDeduc } = await supabase
    .from('crm_certificados_eventos')
    .select('*')
    .not('id_deduccion_rescate', 'is', null);
  
  console.log('Total cert events with id_deduccion_rescate:', certEventsDeduc?.length || 0);
  const matchCertEvents = (certEventsDeduc || []).filter(e => 
    JSON.stringify(e).includes('042') || JSON.stringify(e).includes(targetAgrupador)
  );
  console.log('Matched cert events:', matchCertEvents);

  // Check if contract status was altered
  const { data: contrato } = await supabase
    .from('crm_contratos')
    .select('*')
    .eq('id_contrato', 'NSGUSD02-042.20250130');
  console.log('Contrato actual:', contrato);
}

checkAllReferences().catch(console.error);
