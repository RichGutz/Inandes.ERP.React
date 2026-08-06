/**
 * Configuración centralizada de URLs de API para InAndes ERP.
 * 
 * En Producción (VPS / inandes.react.geeksoft.tech):
 * - Retorna '' (cadena vacía) para usar rutas relativas pasadas por el Reverse Proxy Nginx.
 * 
 * En Desarrollo Local (localhost / 127.0.0.1):
 * - Retorna VITE_API_FACTORING_URL o 'http://localhost:8000' por defecto.
 */
export const getApiBaseUrl = (): string => {
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return '';
  }
  return import.meta.env.VITE_API_FACTORING_URL || 'http://localhost:8000';
};
