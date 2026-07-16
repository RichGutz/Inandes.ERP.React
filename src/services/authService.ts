import { supabase } from './supabaseClient';

export interface UserModuleAccess {
  modulo: string;
  rol: string;
  nombre_completo: string;
}

export const getUserAccess = async (email: string): Promise<UserModuleAccess[]> => {
  try {
    const { data, error } = await supabase
      .from('user_module_access')
      .select('modulo, rol, nombre_completo')
      .eq('email', email);

    if (error) {
      console.error('Error fetching user access:', error.message);
      return [];
    }

    return data as UserModuleAccess[];
  } catch (err) {
    console.error('Unexpected error fetching user access:', err);
    return [];
  }
};

export const getAllUserAccess = async (): Promise<(UserModuleAccess & { email: string })[]> => {
  try {
    const { data, error } = await supabase
      .from('user_module_access')
      .select('*')
      .order('email');

    if (error) throw error;
    return data as (UserModuleAccess & { email: string })[];
  } catch (err) {
    console.error('Error fetching all user access:', err);
    throw err;
  }
};

export const upsertUserAccess = async (access: UserModuleAccess & { email: string }): Promise<void> => {
  try {
    const { error } = await supabase
      .from('user_module_access')
      .upsert({
        email: access.email,
        modulo: access.modulo,
        rol: access.rol,
        nombre_completo: access.nombre_completo
      }, { onConflict: 'email,modulo' }); // Supabase needs a unique constraint on email + modulo for this to work correctly

    if (error) throw error;
  } catch (err) {
    console.error('Error saving user access:', err);
    throw err;
  }
};

export const deleteUserAccess = async (email: string, modulo: string): Promise<void> => {
  try {
    const { error } = await supabase
      .from('user_module_access')
      .delete()
      .match({ email, modulo });

    if (error) throw error;
  } catch (err) {
    console.error('Error deleting user access:', err);
    throw err;
  }
};
