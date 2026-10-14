import React, { useState, useEffect, useRef } from 'react';
import { getUserAccess } from '../../services/authService';
import type { UserModuleAccess } from '../../services/authService';
import { getDeviceFingerprint } from '../../utils/deviceFingerprint';
import { Loader2, ShieldCheck, Mail, ArrowRight, RefreshCw, KeyRound, CheckCircle2, AlertTriangle, Shield } from 'lucide-react';

interface LoginPageProps {
  onLogin?: (email: string, roles: UserModuleAccess[]) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [step, setStep] = useState<1 | 2>(1); // 1 = Email, 2 = OTP 6 Digits
  const [email, setEmail] = useState<string>('');
  const [matchedUser, setMatchedUser] = useState<{
    email: string;
    nombre_completo: string;
    roles: UserModuleAccess[];
  } | null>(null);

  const [otp, setOtp] = useState<string[]>(['', '', '', '', '', '']);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');
  const [resendTimer, setResendTimer] = useState<number>(60);
  const [canResend, setCanResend] = useState<boolean>(false);
  const [deviceAlert, setDeviceAlert] = useState<{ status: string; fingerprint: string; name?: string; message: string } | null>(null);

  const inputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null)
  ];

  // Temporizador regresivo de 60s para reenvío
  useEffect(() => {
    let interval: any = null;
    if (step === 2 && resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer(prev => prev - 1);
      }, 1000);
    } else if (resendTimer === 0) {
      setCanResend(true);
      if (interval) clearInterval(interval);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [step, resendTimer]);

  // Enfocar el primer input de OTP cuando pasa al Paso 2
  useEffect(() => {
    if (step === 2) {
      setTimeout(() => {
        inputRefs[0].current?.focus();
      }, 150);
    }
  }, [step]);

  // PASO 1: Solicitar Codigo OTP al Servidor Oficial de FastAPI (Server-Side 2FA)
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMsg('Por favor ingrese un correo electrónico válido.');
      setLoading(false);
      return;
    }

    try {
      // 1. Solicitar OTP al Backend Oficial de FastAPI
      const resp = await fetch('/api/auth/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail })
      });

      if (resp.ok) {
        const data = await resp.json();
        // Consultar roles para preparar contexto
        const roles = await getUserAccess(cleanEmail);
        const fullName = roles[0]?.nombre_completo || cleanEmail.split('@')[0];

        setMatchedUser({
          email: cleanEmail,
          nombre_completo: fullName,
          roles: roles
        });

        setStep(2);
        setResendTimer(60);
        setCanResend(false);
        setLoading(false);
        setSuccessMsg(data.message || `Código de seguridad enviado a ${cleanEmail}. Ingrese los 6 dígitos recibidos.`);
        return;
      }

      // Si el backend devolvio error estructurado
      const errData = await resp.json().catch(() => ({}));
      if (resp.status === 403) {
        setLoading(false);
        setErrorMsg(errData.detail || `Acceso Restringido: El correo "${cleanEmail}" no tiene autorización registrada en el ERP.`);
        return;
      } else if (resp.status === 429) {
        setLoading(false);
        setErrorMsg(errData.detail || 'Demasiados intentos. Por favor espere unos momentos antes de reintentar.');
        return;
      }

      setLoading(false);
      setErrorMsg(errData.detail || 'Error al solicitar el código de seguridad. Intente nuevamente.');
    } catch (err: any) {
      setLoading(false);
      setErrorMsg(err.message || 'Error de conexión con el servidor de autenticación.');
    }
  };

  // Control de Inputs OTP (Navegacion y Pegado)
  const handleOtpChange = (index: number, value: string) => {
    // Permitir solo digitos
    const cleanVal = value.replace(/\D/g, '');
    if (!cleanVal && value !== '') return;

    const newOtp = [...otp];

    if (cleanVal.length > 1) {
      // Manejo de pegado multiple en un solo input
      const digits = cleanVal.slice(0, 6).split('');
      for (let i = 0; i < 6; i++) {
        newOtp[i] = digits[i] || '';
      }
      setOtp(newOtp);
      const nextIndex = Math.min(digits.length, 5);
      inputRefs[nextIndex].current?.focus();
      if (digits.length === 6) {
        verifyCode(newOtp.join(''));
      }
      return;
    }

    newOtp[index] = cleanVal;
    setOtp(newOtp);

    // Auto-focus siguiente input
    if (cleanVal && index < 5) {
      inputRefs[index + 1].current?.focus();
    }

    // Si completo los 6 digitos, auto-verificar
    if (newOtp.every(d => d !== '')) {
      verifyCode(newOtp.join(''));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!otp[index] && index > 0) {
        const newOtp = [...otp];
        newOtp[index - 1] = '';
        setOtp(newOtp);
        inputRefs[index - 1].current?.focus();
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pastedData) return;

    const newOtp = ['', '', '', '', '', ''];
    pastedData.split('').forEach((char, idx) => {
      if (idx < 6) newOtp[idx] = char;
    });
    setOtp(newOtp);

    const focusIdx = Math.min(pastedData.length, 5);
    inputRefs[focusIdx].current?.focus();

    if (pastedData.length === 6) {
      verifyCode(pastedData);
    }
  };

  // Reenviar Codigo (Server-Side)
  const handleResend = async () => {
    if (!matchedUser || !canResend) return;
    setLoading(true);
    setErrorMsg('');
    setOtp(['', '', '', '', '', '']);

    try {
      const resp = await fetch('/api/auth/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: matchedUser.email })
      });
      if (resp.ok) {
        const data = await resp.json();
        setResendTimer(60);
        setCanResend(false);
        setLoading(false);
        setSuccessMsg(data.message || 'Nuevo código de seguridad enviado exitosamente.');
        inputRefs[0].current?.focus();
        return;
      }
      const errData = await resp.json().catch(() => ({}));
      setErrorMsg(errData.detail || 'Error al reenviar el código.');
    } catch (_e) {
      setErrorMsg('Error de conexión al solicitar el nuevo código.');
    }
    setLoading(false);
  };

  // PASO 2: Verificar Codigo e Iniciar Sesion en el Servidor
  const verifyCode = async (codeToVerify: string) => {
    if (!matchedUser) return;
    setErrorMsg('');
    setDeviceAlert(null);
    setLoading(true);

    try {
      const deviceInfo = getDeviceFingerprint();
      const resp = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: matchedUser.email,
          code: codeToVerify,
          device_fingerprint: deviceInfo.fingerprint,
          device_name: deviceInfo.deviceName
        })
      });

      if (resp.ok) {
        const data = await resp.json();
        // Autenticación Exitosa con Token JWT firmado por Backend
        const sessionPayload = {
          email: data.user?.email || matchedUser.email,
          nombre_completo: data.user?.nombre_completo || matchedUser.nombre_completo,
          roles: data.user?.roles || matchedUser.roles,
          token: data.token,
          device_fingerprint: data.device_fingerprint || deviceInfo.fingerprint,
          authType: '2FA_SERVER_JWT',
          timestamp: Date.now()
        };

        // Persistencia segura de sesión y Bearer Token
        localStorage.setItem('inandes_auth_session', JSON.stringify(sessionPayload));
        if (data.token) {
          localStorage.setItem('inandes_jwt_token', data.token);
          sessionStorage.setItem('inandes_jwt_token', data.token);
        }
        sessionStorage.setItem('dev_local_login', 'true');

        if (onLogin) {
          onLogin(sessionPayload.email, sessionPayload.roles);
        }

        window.location.reload();
        return;
      }

      const errData = await resp.json().catch(() => ({}));
      if (errData.device_status) {
        setDeviceAlert({
          status: errData.device_status,
          fingerprint: errData.device_fingerprint || deviceInfo.fingerprint,
          name: errData.device_name || deviceInfo.deviceName,
          message: errData.detail || 'Dispositivo no autorizado en la Bóveda de Seguridad.'
        });
      }
      setErrorMsg(errData.detail || 'Código de seguridad incorrecto o expirado.');
      setLoading(false);
      setOtp(['', '', '', '', '', '']);
      inputRefs[0].current?.focus();
    } catch (err: any) {
      setLoading(false);
      setErrorMsg(err.message || 'Error de conexión con el servidor al verificar el código.');
    }
  };

  const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  const handleDevQuickLogin = () => {
    const defaultEmail = 'rgutil@gmail.com';
    const defaultRoles: UserModuleAccess[] = [
      { modulo: 'CRM', rol: 'ADMIN', nombre_completo: 'Richard Gutierrez' },
      { modulo: 'FACTORING', rol: 'ADMIN', nombre_completo: 'Richard Gutierrez' }
    ];
    localStorage.setItem('inandes_auth_session', JSON.stringify({
      email: defaultEmail,
      nombre_completo: 'Richard Gutierrez (Dev)',
      roles: defaultRoles,
      authType: 'DEV_BYPASS',
      timestamp: Date.now()
    }));
    sessionStorage.setItem('dev_local_login', 'true');
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-blue-50/30 flex flex-col items-center justify-center font-sans p-4 select-none">
      
      {/* Contenedor Principal Flotante */}
      <div className="max-w-[480px] w-full bg-white rounded-2xl shadow-xl border border-slate-200/80 p-8 md:p-10 relative overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Barra superior de acento corporativo */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-600 via-sky-500 to-indigo-600" />

        {/* Header con Logos Oficiales */}
        <div className="flex items-center justify-between gap-4 mb-6 pb-5 border-b border-slate-100">
          <img src="/Logo.Geeksoft.png" alt="Geeksoft" className="h-10 object-contain" />
          <div className="h-8 w-px bg-slate-200" />
          <img src="/logo_inandes.png" alt="InAndes" className="h-8 object-contain" />
        </div>

        {/* Título y Badge de Seguridad */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold uppercase tracking-wider mb-2.5">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Autenticación 2FA Segura</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            ERP INANDES
          </h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Factoring • Inversionistas • Confirming
          </p>
        </div>

        {/* PASO 1: INGRESO DE CORREO */}
        {step === 1 && (
          <form onSubmit={handleEmailSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Correo Electrónico Autorizado
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ej. usuario@inandes.com"
                  autoFocus
                  required
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1.5">
                Ingrese su cuenta institucional registrada en el sistema de permisos.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-sm font-bold rounded-xl shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verificando Permisos...</span>
                </>
              ) : (
                <>
                  <span>ENVIAR CÓDIGO DE ACCESO (2FA)</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        {/* PASO 2: INGRESO DEL TOKEN OTP DE 6 DÍGITOS */}
        {step === 2 && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center mx-auto mb-3">
                <KeyRound className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-bold text-slate-900">
                Ingrese el Código de 6 Dígitos
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Enviado a <strong className="text-slate-800 font-semibold">{email}</strong>
              </p>
            </div>

            {/* Inputs Numéricos OTP */}
            <div className="flex justify-center items-center gap-2">
              {otp.map((digit, idx) => (
                <input
                  key={idx}
                  ref={inputRefs[idx]}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(idx, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(idx, e)}
                  onPaste={handlePaste}
                  className={`w-12 h-14 text-center text-2xl font-black rounded-xl border transition-all outline-none ${
                    digit 
                      ? 'bg-blue-50/50 border-blue-500 text-blue-700 ring-2 ring-blue-100' 
                      : 'bg-slate-50 border-slate-200 text-slate-900 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100'
                  }`}
                />
              ))}
            </div>

            {/* Botón de Validación */}
            <button
              type="button"
              onClick={() => verifyCode(otp.join(''))}
              disabled={loading || otp.some(d => d === '')}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-sm font-bold rounded-xl shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Validando Token 2FA...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>INGRESAR AL ERP</span>
                </>
              )}
            </button>

            {/* Navegación y Reenvío */}
            <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setStep(1);
                  setOtp(['', '', '', '', '', '']);
                  setErrorMsg('');
                  setSuccessMsg('');
                }}
                className="text-slate-500 hover:text-slate-800 font-semibold underline cursor-pointer"
              >
                Cambiar correo
              </button>

              {canResend ? (
                <button
                  type="button"
                  onClick={handleResend}
                  className="text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Reenviar código</span>
                </button>
              ) : (
                <span className="text-slate-400 font-medium">
                  Reenviar en {resendTimer}s
                </span>
              )}
            </div>
          </div>
        )}

        {/* Alerta de Bóveda de Dispositivos (Device Vault) */}
        {deviceAlert && (
          <div className="mt-5 p-4 bg-amber-50/90 border border-amber-200 rounded-xl text-left animate-in fade-in space-y-2">
            <div className="flex items-center gap-2 text-amber-800 font-bold text-xs">
              <Shield className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Bóveda de Dispositivos (Device Vault Zero Trust)</span>
            </div>
            <p className="text-xs text-amber-900 leading-relaxed font-medium">
              {deviceAlert.message}
            </p>
            <div className="bg-white/80 p-2.5 rounded-lg border border-amber-200/60 font-mono text-[11px] text-slate-700 flex flex-col gap-1">
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-sans">Huella Digital:</span>
                <strong className="text-indigo-700 font-black">{deviceAlert.fingerprint}</strong>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-sans">Estado en Bóveda:</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  deviceAlert.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' :
                  deviceAlert.status === 'REVOKED' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                }`}>
                  {deviceAlert.status === 'APPROVED' ? 'AUTORIZADO' : deviceAlert.status === 'REVOKED' ? 'REVOCADO' : 'PENDIENTE DE AUTORIZACIÓN'}
                </span>
              </div>
            </div>
            <p className="text-[10px] text-slate-500 italic">
              Para autorizar este equipo, ingrese como Administrador al menú Herramientas &gt; Device Vault o solicite la aprobación al Oficial de Seguridad.
            </p>
          </div>
        )}

        {/* Mensajes de Alerta y Notificación */}
        {errorMsg && !deviceAlert && (
          <div className="mt-5 p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-red-700 text-xs leading-relaxed animate-in fade-in">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && !errorMsg && (
          <div className="mt-5 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-emerald-700 text-xs font-semibold animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Bypass para Desarrollo Local */}
        {isLocalhost && (
          <div className="mt-6 pt-4 border-t border-slate-200 text-center">
            <button
              type="button"
              onClick={handleDevQuickLogin}
              className="w-full py-2.5 px-3 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl shadow transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>⚡ Acceso Rápido Local (Dev Bypass)</span>
            </button>
            <p className="text-[10px] text-slate-400 mt-1">
              Entorno Localhost: Inicia como Administrador sin requerir validación SMTP.
            </p>
          </div>
        )}

        {/* Footer Institucional */}
        <div className="mt-8 pt-4 border-t border-slate-100 text-center">
          <p className="text-[10px] text-slate-400">
            Plataforma Segura InAndes • Cifrado TLS 1.3 • © 2026 GeekSoft Technologies
          </p>
        </div>

      </div>
    </div>
  );
};
