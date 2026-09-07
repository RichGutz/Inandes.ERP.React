import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://egvcinsbyropumybatdf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVndmNpbnNieXJvcHVteWJhdGRmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDA0NDczNCwiZXhwIjoyMDk5NjIwNzM0fQ.28T_xQmSRJO1O1scio61JU0KHhEQfzSS94qYka8TrcA';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function verifyZeroRescates() {
  // Check crm_cronograma_deducciones_rescates
  const { data: deduc } = await supabase
    .from('crm_cronograma_deducciones_rescates')
    .select('*')
    .or('id_contrato.ilike.%042%,id_certificado.ilike.%042%,id_agrupador.ilike.%042%');
  
  console.log('=== VERIFICACION FINAL crm_cronograma_deducciones_rescates ===');
  console.log('Total registros encontrados para 042:', deduc?.length || 0);

  // Check crm_certificados_eventos
  const { data: eventos } = await supabase
    .from('crm_certificados_eventos')
    .select('id_evento, id_certificado, id_contrato, tipo_evento, capital_base, capital_final_saldo, monto_rescate')
    .eq('id_contrato', 'NSGUSD02-042.20250130');
  
  console.log('\n=== ESTADO EN LEDGER (crm_certificados_eventos) ===');
  console.log(JSON.stringify(eventos, null, 2));

  // Check crm_contratos
  const { data: contratos } = await supabase
    .from('crm_contratos')
    .select('id_contrato, id_inversionista_1, monto_inversion, estado')
    .eq('id_contrato', 'NSGUSD02-042.20250130');
  
  console.log('\n=== ESTADO CONTRATO (crm_contratos) ===');
  console.log(JSON.stringify(contratos, null, 2));
}

verifyZeroRescates().catch(console.error);
