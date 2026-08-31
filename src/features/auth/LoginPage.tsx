import React, { useState } from 'react';
import { supabase } from '../../services/supabaseClient';
import { Loader2 } from 'lucide-react';

interface LoginPageProps {
  onLogin?: (email: string, roles: any[]) => void;
}

export const LoginPage: React.FC<LoginPageProps> = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      setError(null);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          queryParams: { prompt: 'select_account' },
          redirectTo: window.location.origin
        }
      });
      if (error) throw error;
    } catch (err: any) {
      setError(err.message || 'Error al iniciar sesión con Google.');
      setLoading(false);
    }
  };

  const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  const handleDevLogin = () => {
    sessionStorage.setItem('dev_local_login', 'true');
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center font-sans p-4">
      <div className="max-w-[600px] w-full flex flex-col items-center gap-8">
        
        {/* Logos */}
        <div className="flex items-center justify-center gap-8 mb-8">
          <img src="/Logo.Geeksoft.png" alt="Geeksoft" className="h-24 object-contain" />
          <img src="/assets/Logo.Inandes.MODERNO.png" alt="InAndes" className="h-16 object-contain" />
        </div>

        {/* Text */}
        <div className="flex flex-col items-center text-center gap-3">
          <h1 className="text-3xl md:text-4xl font-semibold text-[#1e293b]">
            ERP INANDES - Gateway Central (v4)
          </h1>
          <p className="text-[#64748b] text-lg">
            Acceso Corporativo
          </p>
        </div>

        {error && (
          <div className="w-full max-w-md bg-red-50 border-l-4 border-red-500 p-4 rounded-md mt-4">
            <p className="text-sm font-medium text-red-800">{error}</p>
          </div>
        )}

        {/* Button */}
        <div className="mt-6 w-full max-w-md space-y-3">
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex justify-center items-center gap-3 py-3 px-4 rounded-md shadow-sm text-base font-semibold text-black bg-[#f1f3f4] hover:bg-[#e2e8f0] focus:outline-none transition-colors disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer border border-transparent"
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin text-gray-600" />
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            )}
            {loading ? 'Iniciando sesión...' : 'Iniciar Sesión con Google'}
          </button>

          {isLocalhost && (
            <div className="pt-4 border-t border-slate-200 text-center">
              <button
                onClick={handleDevLogin}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-md transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                ⚡ Acceso Rápido Local (Dev Bypass)
              </button>
              <p className="text-[11px] text-slate-500 mt-1">
                Modo Desarrollo: Inicia sesión directamente en localhost sin ser redirigido a la web.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
