import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://egvcinsbyropumybatdf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVndmNpbnNieXJvcHVteWJhdGRmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDA0NDczNCwiZXhwIjoyMDk5NjIwNzM0fQ.28T_xQmSRJO1O1scio61JU0KHhEQfzSS94qYka8TrcA';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkAuthLogs() {
  try {
    const { data: audit, error: errAudit } = await supabase
      .from('audit_log_entries')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);
    console.log('audit_log_entries:', audit, errAudit);
  } catch (e) {
    console.log('audit err:', e.message);
  }

  // Check auth.users / logins around Sep 3
  try {
    const { data: users, error: errUsers } = await supabase.auth.admin.listUsers();
    console.log('\nUsers found:', users?.users?.map(u => ({ email: u.email, last_sign_in_at: u.last_sign_in_at, created_at: u.created_at })));
  } catch (e) {
    console.log('users err:', e.message);
  }
}

checkAuthLogs().catch(console.error);
