import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://egvcinsbyropumybatdf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVndmNpbnNieXJvcHVteWJhdGRmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDA0NDczNCwiZXhwIjoyMDk5NjIwNzM0fQ.28T_xQmSRJO1O1scio61JU0KHhEQfzSS94qYka8TrcA';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function updateRescate037() {
  console.log('=====================================================');
  console.log('ACTUALIZANDO RESCATE NSGPEN03-037.20260224 A 1307.02');
  console.log('=====================================================');

  const { data, error } = await supabase
    .from('crm_cronograma_deducciones_rescates')
    .update({ monto_cobrar: 1307.02 })
    .eq('id_cuota', 'RES-NSGPEN03-037.20260224.260820.260430-C.1/1')
    .select();

  if (error) {
    console.error('Error al actualizar rescate:', error);
    throw error;
  }

  console.log('Registro actualizado:', data);
}

updateRescate037().catch(console.error);
