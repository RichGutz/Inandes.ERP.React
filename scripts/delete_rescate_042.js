import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://egvcinsbyropumybatdf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVndmNpbnNieXJvcHVteWJhdGRmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDA0NDczNCwiZXhwIjoyMDk5NjIwNzM0fQ.28T_xQmSRJO1O1scio61JU0KHhEQfzSS94qYka8TrcA';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function deleteAndInvestigate() {
  const agrupador = 'RES-NSGUSD02-042.20250130.260903';
  
  // 1. Get exact record details before deletion
  const { data: before, error: errBefore } = await supabase
    .from('crm_cronograma_deducciones_rescates')
    .select('*')
    .eq('id_agrupador', agrupador);
  
  console.log('--- REGISTROS A ELIMINAR ---');
  console.log(JSON.stringify(before, null, 2));

  // 2. Perform deletion
  const { data: deleted, error: errDelete } = await supabase
    .from('crm_cronograma_deducciones_rescates')
    .delete()
    .eq('id_agrupador', agrupador)
    .select();

  console.log('\n--- RESULTADO DE ELIMINACION ---');
  if (errDelete) {
    console.error('Error al eliminar:', errDelete);
  } else {
    console.log('Filas eliminadas exitosamente:', deleted.length);
    console.log(JSON.stringify(deleted, null, 2));
  }

  // 3. Verify that 0 remain
  const { data: after } = await supabase
    .from('crm_cronograma_deducciones_rescates')
    .select('*')
    .or(`id_agrupador.eq.${agrupador},id_contrato.ilike.%042%`);
  
  console.log('\n--- VERIFICACION POST-ELIMINACION ---');
  console.log('Registros restantes para 042:', after?.length || 0);
}

deleteAndInvestigate().catch(console.error);
