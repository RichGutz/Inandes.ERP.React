import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Faltan variables de entorno de Supabase en .env.local. Por favor configure VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.');
}

// Inicialización del cliente Supabase con conexión segura SSL (nativa por HTTPS)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
