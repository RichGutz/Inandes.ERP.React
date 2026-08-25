import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://egvcinsbyropumybatdf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVndmNpbnNieXJvcHVteWJhdGRmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDA0NDczNCwiZXhwIjoyMDk5NjIwNzM0fQ.28T_xQmSRJO1O1scio61JU0KHhEQfzSS94qYka8TrcA';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testMarch() {
  console.log('--- Test Query Contratos con estado in (emitido, cerrado_por_rescate, cerrado_fin_contrato) ---');
  const { data: rawContratos } = await supabase
    .from('crm_contratos')
    .select('*')
    .eq('id_fondo', 'NSGPEN01');

  console.log(`Total contratos en NSGPEN01: ${rawContratos.length}`);
  
  const maldonadoContratos = rawContratos.filter(c => c.id_contrato.includes('081') || c.id_contrato.includes('084'));
  console.log('Maldonado contratos:', maldonadoContratos);

  // Check what InversionesPage or InversionistasPage or CertificadosPage queries:
  const { data: invContratos } = await supabase
    .from('crm_contratos')
    .select('*, crm_fondos(*), crm_inversionistas!crm_contratos_id_inversionista_1_fkey(*)')
    .eq('estado', 'emitido');
  console.log('Contratos activos (estado=emitido) con 081 o 084:', invContratos?.filter(c => c.id_contrato.includes('081') || c.id_contrato.includes('084')));

  // Check all distinct estados in crm_contratos:
  const { data: allC } = await supabase.from('crm_contratos').select('id_contrato, estado');
  const estadosCount = {};
  allC.forEach(c => { estadosCount[c.estado] = (estadosCount[c.estado] || 0) + 1; });
  console.log('Conteo por estado en crm_contratos:', estadosCount);
}

testMarch().catch(console.error);
