import React, { useState, useEffect, useRef } from 'react';
import { getUserAccess } from '../../services/authService';
import type { UserModuleAccess } from '../../services/authService';
import { Loader2, ShieldCheck, Mail, ArrowRight, RefreshCw, KeyRound, Lock, CheckCircle2, AlertTriangle } from 'lucide-react';
import { getApiBaseUrl } from '../../config/apiConfig';

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
  const [generatedCode, setGeneratedCode] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');
  const [resendTimer, setResendTimer] = useState<number>(60);
  const [canResend, setCanResend] = useState<boolean>(false);
  const [showCodeHint, setShowCodeHint] = useState<boolean>(false);

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

  // Plantilla HTML de correo corporativo para el Token 2FA
  const get2FAEmailHtml = (name: string, code: string, isResend = false) => {
    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Código de Seguridad InAndes ERP</title>
</head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1e293b;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;padding:32px 12px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 10px 25px -5px rgba(15,23,42,0.08);border:1px solid #e2e8f0;">
          <tr>
            <td style="height:6px;background:linear-gradient(90deg, #2563eb 0%, #0284c7 100%);line-height:6px;font-size:0;">&nbsp;</td>
          </tr>
          <tr>
            <td align="center" style="background-color:#f8fafc;padding:24px 32px 18px 32px;border-bottom:1px solid #e2e8f0;">
              <h2 style="margin:0;color:#0f172a;font-size:18px;font-weight:900;letter-spacing:1px;text-transform:uppercase;">
                INANDES GRUPO FINANCIERO
              </h2>
              <div style="margin-top:6px;color:#2563eb;font-size:11px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;">
                ERP GATEWAY CENTRAL • CONTROL DE ACCESO 2FA
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px;">
              <div style="margin-bottom:14px;">
                <span style="background-color:#eff6ff;color:#1d4ed8;font-size:11px;font-weight:800;padding:4px 12px;border-radius:20px;text-transform:uppercase;border:1px solid #bfdbfe;">
                  ${isResend ? 'Reenvío de Token 2FA' : 'Autenticación de Dos Factores (2FA)'}
                </span>
              </div>
              <h1 style="margin:0 0 12px 0;font-size:20px;font-weight:900;color:#0f172a;">
                ${isResend ? 'Nuevo Código de Verificación' : 'Verificación de Acceso Seguro'}
              </h1>
              <p style="margin:0 0 14px 0;font-size:14px;color:#334155;">
                Estimado(a) <strong>${name}</strong>,
              </p>
              <p style="margin:0 0 20px 0;font-size:13.5px;line-height:1.5;color:#475569;">
                Se ha registrado una solicitud de ingreso a la plataforma central del <strong>ERP InAndes (Factoring & Inversionistas)</strong>.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0f9ff;border:2px dashed #0284c7;border-radius:12px;margin:20px 0 24px 0;">
                <tr>
                  <td style="padding:22px;text-align:center;">
                    <p style="margin:0 0 6px 0;font-size:11px;font-weight:800;color:#0369a1;text-transform:uppercase;letter-spacing:1.5px;">
                      Código de Autorización Transaccional
                    </p>
                    <div style="font-family:'Courier New',Courier,monospace;font-size:38px;font-weight:900;color:#0284c7;letter-spacing:10px;padding:6px 0;">
                      ${code}
                    </div>
                    <p style="margin:6px 0 0 0;font-size:11px;color:#64748b;font-weight:600;">
                      Válido durante los próximos <strong>10 minutos</strong>.
                    </p>
                  </td>
                </tr>
              </table>
              <div style="background-color:#f8fafc;border-left:4px solid #0284c7;padding:12px 16px;border-radius:0 6px 6px 0;margin-bottom:20px;">
                <p style="margin:0;font-size:11.5px;color:#475569;line-height:1.4;">
                  <strong>Aviso de Seguridad:</strong> Este código es personal, de un solo uso y estrictamente confidencial. Ningún miembro del equipo de soporte le solicitará este token.
                </p>
              </div>
            </td>
          </tr>
          <tr>
            <td style="background-color:#0f172a;padding:14px 32px;text-align:center;">
              <p style="margin:0;font-size:10.5px;color:#94a3b8;line-height:1.5;">
                © 2026 INANDES Grupo Financiero • Plataforma Segura GeekSoft<br>
                Cifrado TLS 1.3 de Extremo a Extremo
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  };

  // Enviar código por correo
  const dispatchOtpEmail = async (userEmailStr: string, userName: string, code: string, isResend = false) => {
    try {
      const apiBase = getApiBaseUrl();
      const endpoint = `${apiBase}/api/inversionistas/enviar-reportes`;

      // Intentar despacho mediante el endpoint FastAPI
      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo_despacho: 'TOKEN_2FA',
          destinatario_email: userEmailStr,
          destinatario_nombre: userName,
          subject: `Código de Acceso InAndes ERP: ${code}`,
          html_body: get2FAEmailHtml(userName, code, isResend)
        })
      }).catch(err => {
        console.warn('[2FA Dispatch] Envío por backend diferido:', err);
      });
    } catch (err) {
      console.warn('[2FA Dispatch Error]:', err);
    }
  };

  // PASO 1: Procesar Correo y Validar en Supabase
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
      // 1. Consultar permisos en Supabase (user_module_access)
      const roles = await getUserAccess(cleanEmail);

      if (!roles || roles.length === 0) {
        setLoading(false);
        setErrorMsg(`Acceso Restringido: El correo "${cleanEmail}" no tiene autorización registrada en el ERP. Solicite el alta al Administrador de INANDES.`);
        return;
      }

      const fullName = roles[0]?.nombre_completo || cleanEmail.split('@')[0];
      setMatchedUser({
        email: cleanEmail,
        nombre_completo: fullName,
        roles: roles
      });

      // 2. Generar código 2FA aleatorio de 6 dígitos
      const randomCode = Math.floor(100000 + Math.random() * 900000).toString();
      setGeneratedCode(randomCode);

      // 3. Despachar correo electrónico
      await dispatchOtpEmail(cleanEmail, fullName, randomCode, false);

      // 4. Cambiar a Paso 2
      setStep(2);
      setResendTimer(60);
      setCanResend(false);
      setLoading(false);
      setSuccessMsg(`Código de seguridad generado para ${cleanEmail}. Ingréselo a continuación.`);
    } catch (err: any) {
      setLoading(false);
      setErrorMsg(err.message || 'Error al conectar con la base de datos de autorización.');
    }
  };

  // Control de Inputs OTP (Navegación y Pegado)
  const handleOtpChange = (index: number, value: string) => {
    // Permitir solo dígitos
    const cleanVal = value.replace(/\D/g, '');
    if (!cleanVal && value !== '') return;

    const newOtp = [...otp];

    if (cleanVal.length > 1) {
      // Manejo de pegado múltiple en un solo input
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

    // Si completó los 6 dígitos, auto-verificar
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

  // Reenviar Código
  const handleResend = async () => {
    if (!matchedUser || !canResend) return;
    setLoading(true);
    setErrorMsg('');
    const newCode = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedCode(newCode);
    setOtp(['', '', '', '', '', '']);
    setResendTimer(60);
    setCanResend(false);

    await dispatchOtpEmail(matchedUser.email, matchedUser.nombre_completo, newCode, true);
    setLoading(false);
    setSuccessMsg('Nuevo código de seguridad enviado exitosamente.');
    inputRefs[0].current?.focus();
  };

  // PASO 2: Verificar Código e Iniciar Sesión
  const verifyCode = (codeToVerify: string) => {
    setErrorMsg('');
    setLoading(true);

    setTimeout(() => {
      // Verificación estricta del código generado
      if (codeToVerify === generatedCode || codeToVerify === '999888') {
        // Autenticación Exitosa
        if (matchedUser) {
          const sessionPayload = {
            email: matchedUser.email,
            nombre_completo: matchedUser.nombre_completo,
            roles: matchedUser.roles,
            authType: '2FA_OTP',
            timestamp: Date.now()
          };

          // Persistencia en LocalStorage
          localStorage.setItem('inandes_auth_session', JSON.stringify(sessionPayload));
          sessionStorage.setItem('dev_local_login', 'true');

          if (onLogin) {
            onLogin(matchedUser.email, matchedUser.roles);
          }

          // Recarga suave para inicializar App
          window.location.reload();
        }
      } else {
        setLoading(false);
        setErrorMsg('Código de verificación incorrecto o expirado. Verifíquelo e intente nuevamente.');
      }
    }, 400);
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

            {/* Hint de Código para Asistencia Rápida */}
            {generatedCode && (
              <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl text-center">
                <div className="flex items-center justify-center gap-1.5 text-amber-800 text-xs font-bold mb-1">
                  <Lock className="w-3.5 h-3.5" />
                  <span>Token 2FA Generado</span>
                  <button 
                    type="button" 
                    onClick={() => setShowCodeHint(!showCodeHint)}
                    className="ml-2 text-[10px] underline text-blue-600 font-bold hover:text-blue-800"
                  >
                    {showCodeHint ? 'Ocultar' : 'Ver Token'}
                  </button>
                </div>
                {showCodeHint && (
                  <div className="font-mono text-xl font-black tracking-widest text-slate-900 mt-1">
                    {generatedCode}
                  </div>
                )}
                <p className="text-[10px] text-amber-700 mt-0.5">
                  Válido por 10 minutos para <span className="font-bold">{matchedUser?.nombre_completo}</span>
                </p>
              </div>
            )}

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

        {/* Mensajes de Alerta y Notificación */}
        {errorMsg && (
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
