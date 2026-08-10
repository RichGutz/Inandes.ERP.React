import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../services/supabaseClient';
import { 
  LogOut, 
  ExternalLink, 
  Sun, 
  Moon, 
  Key, 
  FileSpreadsheet, 
  FileDown,
  Users,
  Briefcase,
  Calculator,
  FileText,
  Lock,
  Building2,
  Award,
  MinusCircle,
  MessageSquare,
  Bot,
  Trash2,
  Settings
} from 'lucide-react';
import type { UserModuleAccess } from '../../services/authService';

interface MasterTemplateProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onExportExcel?: () => void;
  onExportPDF?: () => void;
  userEmail: string;
  userFullName: string;
  userRoles: UserModuleAccess[];
}

export const MasterTemplate: React.FC<MasterTemplateProps> = ({
  title,
  subtitle,
  children,
  activeTab,
  setActiveTab,
  onExportExcel,
  onExportPDF,
  userEmail,
  userFullName,
  userRoles
}) => {
  // Estado local para Dark/Light mode
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('theme') === 'dark';
  });

  // Acordeon exclusivo: solo un grupo abierto a la vez
  const isCRM       = activeTab.startsWith('crm_') || activeTab === 'dashboard';
  const isFactoring = activeTab.startsWith('factoring_');
  const isConfirming = activeTab.startsWith('confirming_');
  const isHerr      = activeTab.startsWith('herramientas_');
  const isMant      = activeTab.startsWith('mantenimiento_');

  const hasCRMAccess = userRoles.some(r => r.modulo === 'CRM');
  const hasFactoringAccess = userRoles.some(r => r.modulo === 'FACTORING');

  const defaultOpen = activeTab === 'home' ? null : (isCRM ? 'crm' : isFactoring ? 'factoring' : isConfirming ? 'confirming' : isHerr ? 'herramientas' : isMant ? 'mantenimiento' : null);
  const [openGroup, setOpenGroup] = useState<string | null>(defaultOpen);
  const toggleGroup = useCallback((g: string) => {
    setOpenGroup(prev => (prev === g ? null : g));
  }, []);

  // Breadcrumb dinámico
  const moduleMap: Record<string, string> = {
    dashboard: 'ERP - CRM',
    crm_asesores: 'ERP - CRM', crm_fondos: 'ERP - CRM',
    crm_inversionistas: 'ERP - CRM', crm_contratos: 'ERP - CRM',
    crm_certificados: 'ERP - CRM', crm_deducciones: 'ERP - CRM', crm_chat: 'ERP - CRM',
    factoring_core: 'ERP - Factoring',
    confirming_futuros: 'ERP - Confirming',
    herramientas_calculadora: 'Herramientas', herramientas_agentes: 'Herramientas',
    mantenimiento_limpieza: 'Mantenimiento', mantenimiento_roles: 'Mantenimiento',
  };
  const currentModule = moduleMap[activeTab] || 'InAndes ERP';

  // Estado para el modal ficticio de cambio de contraseña
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [modalSuccess, setModalSuccess] = useState('');

  // Efecto para alternar el modo oscuro en el document HTML
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  const handleNewWindow = () => {
    window.open(window.location.href, '_blank', 'width=1380,height=850,menubar=no,status=no');
  };

  const handleLogout = () => {
    if (confirm('¿Desea cerrar la sesión de usuario?')) {
      sessionStorage.removeItem('dev_local_login');
      supabase.auth.signOut();
      window.location.reload();
    }
  };

  // Datos de usuario reales inyectados
  const isGlobalAdmin = userRoles.some(r => r.modulo === 'CRM' && r.rol === 'ADMIN') && userRoles.some(r => r.modulo === 'FACTORING' && r.rol === 'ADMIN');
  const highestRole = isGlobalAdmin ? 'Administrador Global' : userRoles.some(r => r.rol === 'ADMIN') ? 'Administrador' : 'Visor';
  const currentUser = {
    email: userEmail,
    fullName: userFullName,
    role: highestRole
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 font-sans flex flex-col antialiased text-slate-800 dark:text-slate-100 transition-colors duration-200">
      
      {/* Header Superior Principal */}
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-50 shadow-sm px-6 py-3">
        <div className="flex items-center justify-between max-w-full mx-auto w-full">
          
          {/* Logos y Título de App */}
          <div className="flex items-center gap-3">
            <img src="/Logo.Inandes.jpeg" alt="InAndes Inversiones" className="h-[32px] rounded object-contain" />
            <div className="flex flex-col border-l border-slate-200 dark:border-slate-700 pl-3">
              <span className="text-xs font-black text-slate-800 dark:text-slate-250 tracking-wider uppercase">{currentModule}</span>
            </div>
          </div>

          {/* Título Central del Módulo */}
          <div className="hidden md:flex flex-col items-center">
            <h2 className="text-sm font-black text-slate-800 dark:text-slate-100 tracking-tight uppercase">{title}</h2>
            {subtitle && <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold mt-0.5 uppercase tracking-wider">{subtitle}</p>}
          </div>

          {/* Acciones y Panel de Usuario */}
          <div className="flex items-center gap-4">
            
            {/* Botones de Control y Exportación */}
            <div className="flex items-center gap-1.5 border-r border-slate-200 dark:border-slate-700 pr-3">
              {onExportExcel && (
                <button 
                  className="h-8 text-[11px] font-bold flex items-center gap-1.5 px-3 rounded-lg border border-slate-200 dark:border-slate-750 bg-white dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 text-slate-600 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-400 cursor-pointer transition-colors"
                  onClick={onExportExcel}
                  title="Exportar datos a Excel"
                >
                  <FileSpreadsheet size={13} className="text-emerald-600 dark:text-emerald-450" />
                  <span className="hidden sm:inline">Exportar Excel</span>
                </button>
              )}
              
              {onExportPDF && (
                <button 
                  className="h-8 text-[11px] font-bold flex items-center gap-1.5 px-3 rounded-lg border border-slate-200 dark:border-slate-750 bg-white dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-slate-600 dark:text-slate-300 hover:text-rose-700 dark:hover:text-rose-400 cursor-pointer transition-colors"
                  onClick={onExportPDF}
                  title="Exportar datos a PDF"
                >
                  <FileDown size={13} className="text-rose-600 dark:text-rose-450" />
                  <span className="hidden sm:inline">Bajar PDF</span>
                </button>
              )}

              <button 
                className="h-8 text-[11px] font-bold flex items-center gap-1.5 px-3 rounded-lg border border-slate-200 dark:border-slate-750 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/55 text-slate-600 dark:text-slate-300 cursor-pointer transition-colors"
                onClick={handleNewWindow}
                title="Abrir en ventana independiente"
              >
                <ExternalLink size={13} />
                <span className="hidden sm:inline">Nueva Ventana</span>
              </button>
            </div>

            {/* Widget de Usuario e Imagen de Geeksoft */}
            <div className="flex items-center gap-3">
              <div className="flex flex-col items-end hidden lg:flex">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-100 leading-tight">{currentUser.fullName}</span>
                <span className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">{currentUser.role}</span>
              </div>

              {/* Avatar Dinámico */}
              <div 
                className="h-8 w-8 rounded-full bg-gradient-to-br from-emerald-600 to-teal-500 text-white flex items-center justify-center text-xs font-black shadow-sm tracking-wider uppercase border border-emerald-250 select-none"
                title={`${currentUser.fullName} (${currentUser.email}) - ${currentUser.role}`}
              >
                {currentUser.fullName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
              </div>

              {/* Botón Cambiar Contraseña */}
              <button 
                onClick={() => {
                  setModalSuccess('');
                  setShowChangePasswordModal(true);
                }}
                className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors border border-transparent cursor-pointer"
                title="Cambiar Contraseña"
              >
                <Key size={15} />
              </button>

              {/* Botón Salir */}
              <button 
                onClick={handleLogout}
                className="p-1.5 rounded-full hover:bg-red-50 dark:hover:bg-red-950/20 text-slate-400 hover:text-red-500 transition-colors border border-transparent cursor-pointer"
                title="Cerrar Sesión"
              >
                <LogOut size={15} />
              </button>

              <span className="text-slate-200 dark:text-slate-700 text-lg">|</span>
              
              {/* Selector de Modo Claro / Oscuro */}
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700 rounded-full p-1 shadow-inner">
                <button
                  onClick={() => setIsDarkMode(false)}
                  className={`p-1 rounded-full transition-all cursor-pointer ${!isDarkMode ? 'bg-white dark:bg-slate-600 shadow text-amber-500' : 'text-slate-400 hover:text-slate-600'}`}
                  title="Modo Claro"
                >
                  <Sun size={12} />
                </button>
                <button
                  onClick={() => setIsDarkMode(true)}
                  className={`p-1 rounded-full transition-all cursor-pointer ${isDarkMode ? 'bg-white dark:bg-slate-600 shadow text-indigo-400' : 'text-slate-400 hover:text-slate-600'}`}
                  title="Modo Oscuro"
                >
                  <Moon size={12} />
                </button>
              </div>

              <img src="/Logo.Geeksoft.png" alt="Geeksoft" className="h-[53px] object-contain pl-1 hidden sm:block" />
            </div>
          </div>

        </div>
      </header>

      {/* Cuerpo Principal: Sidebar + Contenido */}
      <div className="flex-1 flex max-w-full w-full mx-auto p-4 gap-4 overflow-hidden">
        
        {/* Sidebar Izquierdo */}
        <aside className="w-64 shrink-0 flex flex-col gap-3 hidden md:flex h-fit max-h-[calc(100vh-90px)] overflow-y-auto pr-2 scrollbar-thin">
          

          {/* SECCIÓN 1: FACTORING (Acceso Directo) */}
          {hasFactoringAccess && (
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm overflow-hidden">
            <button
              onClick={() => setActiveTab('factoring_core')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 text-[10px] font-black uppercase tracking-wider transition-colors cursor-pointer ${
                isFactoring ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20' : 'text-slate-400 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700/30'
              }`}
            >
              <span>FACTORING</span>
            </button>
          </div>
          )}

          {/* SECCIÓN 2: CONFIRMING (colapsable) */}
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm overflow-hidden">
            <button
              onClick={() => toggleGroup('confirming')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 text-[10px] font-black uppercase tracking-wider transition-colors cursor-pointer ${
                isConfirming ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20' : 'text-slate-400 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700/30'
              }`}
            >
              <span>Confirming</span>
              <span className="text-slate-400">{openGroup === 'confirming' ? '▲' : '▼'}</span>
            </button>
            {openGroup === 'confirming' && (
              <nav className="flex flex-col gap-0.5 px-2 pb-2">
                <button
                  onClick={() => setActiveTab('confirming_futuros')}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2.5 transition-all cursor-pointer ${activeTab === 'confirming_futuros' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50'}`}
                >
                  <Lock size={14} /> Proximamente
                </button>
              </nav>
            )}
          </div>

          {/* SECCIÓN 3: CRM (colapsable) */}
          {hasCRMAccess && (
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm overflow-hidden">
            <button
              onClick={() => toggleGroup('crm')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 text-[10px] font-black uppercase tracking-wider transition-colors cursor-pointer ${
                isCRM ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20' : 'text-slate-400 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700/30'
              }`}
            >
              <span>CRM Inversionistas</span>
              <span className="text-slate-400">{openGroup === 'crm' ? '▲' : '▼'}</span>
            </button>
            {openGroup === 'crm' && (
              <nav className="flex flex-col gap-0.5 px-2 pb-2">
                {[
                  { id: 'crm_inversionistas', label: 'Inversionistas', icon: <Users size={14} /> },
                  { id: 'crm_fondos', label: 'Fondos & Tasas', icon: <Building2 size={14} /> },
                  { id: 'crm_asesores', label: 'Asesores', icon: <Briefcase size={14} /> },
                  { id: 'crm_contratos', label: 'Contratos', icon: <FileText size={14} /> },
                  { id: 'crm_certificados', label: 'Certificados', icon: <Award size={14} /> },
                  { id: 'crm_deducciones', label: 'Deducciones / Rescates', icon: <MinusCircle size={14} /> },
                  { id: 'crm_chat', label: 'Chat WhatsApp', icon: <MessageSquare size={14} /> },
                ].map(item => (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2.5 transition-all cursor-pointer ${activeTab === item.id ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50'}`}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </button>
                ))}
              </nav>
            )}
          </div>
          )}

          {/* SECCIÓN 4: HERRAMIENTAS (colapsable) */}
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm overflow-hidden">
            <button
              onClick={() => toggleGroup('herramientas')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 text-[10px] font-black uppercase tracking-wider transition-colors cursor-pointer ${
                isHerr ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20' : 'text-slate-400 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700/30'
              }`}
            >
              <span>Herramientas</span>
              <span className="text-slate-400">{openGroup === 'herramientas' ? '▲' : '▼'}</span>
            </button>
            {openGroup === 'herramientas' && (
              <nav className="flex flex-col gap-0.5 px-2 pb-2">
                {[
                  { id: 'herramientas_calculadora', label: 'Calculadora', icon: <Calculator size={14} /> },
                  { id: 'herramientas_agentes', label: 'Agentes IA', icon: <Bot size={14} /> },
                ].map(item => (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2.5 transition-all cursor-pointer ${activeTab === item.id ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50'}`}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </button>
                ))}
              </nav>
            )}
          </div>

          {/* SECCIÓN 5: MANTENIMIENTO (colapsable) */}
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm overflow-hidden">
            <button
              onClick={() => toggleGroup('mantenimiento')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 text-[10px] font-black uppercase tracking-wider transition-colors cursor-pointer ${
                isMant ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20' : 'text-slate-400 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700/30'
              }`}
            >
              <span>Mantenimiento</span>
              <span className="text-slate-400">{openGroup === 'mantenimiento' ? '▲' : '▼'}</span>
            </button>
            {openGroup === 'mantenimiento' && (
              <nav className="flex flex-col gap-0.5 px-2 pb-2">
                {[
                  { id: 'mantenimiento_limpieza', label: 'Limpieza BD', icon: <Trash2 size={14} /> },
                  { id: 'mantenimiento_roles', label: 'Admin Roles', icon: <Settings size={14} /> },
                ].map(item => (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2.5 transition-all cursor-pointer ${activeTab === item.id ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50'}`}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </button>
                ))}
              </nav>
            )}
          </div>

        </aside>

        {/* Contenido Principal de Vistas */}
        <main className="flex-1 flex flex-col bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm p-6 min-w-0 overflow-y-auto">
          {children}
        </main>

      </div>

      {/* Footer Corporativo */}
      <footer className="bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 py-3 px-6 text-center text-[9px] text-slate-450 dark:text-slate-400 font-bold tracking-wider uppercase mt-auto">
        © {new Date().getFullYear()} INANDES INVERSIONES · GEEKSOFT TECHNOLOGY PARTNER
      </footer>

      {/* Modal Cambio Contraseña (Ficticio para UI) */}
      {showChangePasswordModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-750 w-full max-w-md rounded-2xl shadow-xl p-6 flex flex-col gap-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-700">
              <h3 className="font-bold text-slate-850 dark:text-slate-100 text-xs uppercase tracking-wider flex items-center gap-1.5">
                <Key size={16} className="text-emerald-600" /> Cambiar Contraseña
              </h3>
              <button 
                onClick={() => setShowChangePasswordModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full p-1 cursor-pointer"
              >
                <span className="text-lg font-bold">×</span>
              </button>
            </div>

            {modalSuccess && (
              <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900 text-emerald-600 dark:text-emerald-400 rounded-lg p-3 text-xs font-semibold">
                ✓ {modalSuccess}
              </div>
            )}

            <form onSubmit={(e) => {
              e.preventDefault();
              setModalSuccess('Contraseña cambiada exitosamente (Simulación).');
              setTimeout(() => {
                setShowChangePasswordModal(false);
                setCurrentPassword('');
                setNewPassword('');
                setConfirmPassword('');
              }, 1500);
            }} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Contraseña Actual</label>
                <input 
                  type="password" 
                  required 
                  value={currentPassword} 
                  onChange={e => setCurrentPassword(e.target.value)}
                  placeholder="Contraseña actual"
                  className="border border-slate-250 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-emerald-600 dark:text-white"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Nueva Contraseña</label>
                <input 
                  type="password" 
                  required 
                  value={newPassword} 
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Nueva contraseña"
                  className="border border-slate-250 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-emerald-600 dark:text-white"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Confirmar Contraseña</label>
                <input 
                  type="password" 
                  required 
                  value={confirmPassword} 
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Repetir nueva contraseña"
                  className="border border-slate-250 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-emerald-600 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-700">
                <button 
                  type="button"
                  onClick={() => setShowChangePasswordModal(false)}
                  className="text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-4 py-2 rounded-lg font-bold transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-lg font-bold transition-colors cursor-pointer"
                >
                  Cambiar Contraseña
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
