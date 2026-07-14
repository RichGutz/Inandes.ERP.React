// src/components/layout/MasterTemplate.tsx
import React, { useState, useEffect } from 'react';
import { 
  LogOut, 
  ExternalLink, 
  Database, 
  Sun, 
  Moon, 
  Key, 
  FileSpreadsheet, 
  FileDown,
  Users,
  Briefcase,
  Calculator,
  Coins,
  ShieldCheck,
  Home,
  FileEdit,
  FileText,
  CheckSquare,
  DollarSign,
  BarChart2,
  FolderOpen,
  Lock,
  Building2,
  Award,
  MinusCircle,
  MessageSquare,
  Bot,
  Trash2,
  Settings
} from 'lucide-react';

interface MasterTemplateProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onExportExcel?: () => void;
  onExportPDF?: () => void;
}

export const MasterTemplate: React.FC<MasterTemplateProps> = ({
  title,
  subtitle,
  children,
  activeTab,
  setActiveTab,
  onExportExcel,
  onExportPDF
}) => {
  // Estado local para Dark/Light mode
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('theme') === 'dark';
  });

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
      alert('Sesión cerrada (Simulación)');
    }
  };

  // Datos mockeados de usuario
  const currentUser = {
    full_name: 'Jorge Parra',
    role: 'ADMIN',
    email: 'jparra@inandes.com'
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 font-sans flex flex-col antialiased text-slate-800 dark:text-slate-100 transition-colors duration-200">
      
      {/* Header Superior Principal */}
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-50 shadow-sm px-6 py-3">
        <div className="flex items-center justify-between max-w-full mx-auto w-full">
          
          {/* Logos y Título de App */}
          <div className="flex items-center gap-3">
            <img src="/Logo.Inandes.jpeg" alt="InAndes Inversiones" className="h-8 rounded object-contain" />
            <div className="flex flex-col border-l border-slate-200 dark:border-slate-700 pl-3">
              <h1 className="text-sm font-black text-slate-800 dark:text-slate-100 tracking-tight uppercase">INANDES</h1>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold tracking-wider uppercase">CRM de Inversionistas</span>
            </div>
          </div>

          {/* Título Central del Módulo */}
          <div className="hidden md:flex flex-col items-center">
            <div className="flex items-center gap-2">
              <Database size={16} className="text-emerald-600 dark:text-emerald-400" />
              <h2 className="text-sm font-black text-slate-800 dark:text-slate-100 tracking-tight uppercase">{title}</h2>
            </div>
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
                <span className="text-xs font-bold text-slate-800 dark:text-slate-100 leading-tight">{currentUser.full_name}</span>
                <span className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Administrador Senior</span>
              </div>

              {/* Avatar Dinámico */}
              <div 
                className="h-8 w-8 rounded-full bg-gradient-to-br from-emerald-600 to-teal-500 text-white flex items-center justify-center text-xs font-black shadow-sm tracking-wider uppercase border border-emerald-250 select-none"
                title={`${currentUser.full_name} (${currentUser.role})`}
              >
                JP
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

              <img src="/Logo.Geeksoft.png" alt="Geeksoft" className="h-8 object-contain pl-1 hidden sm:block" />
            </div>
          </div>

        </div>
      </header>

      {/* Cuerpo Principal: Sidebar + Contenido */}
      <div className="flex-1 flex max-w-full w-full mx-auto p-4 gap-4 overflow-hidden">
        
        {/* Sidebar Izquierdo */}
        <aside className="w-64 shrink-0 flex flex-col gap-4 hidden md:flex overflow-y-auto max-h-[calc(100vh-120px)] pr-2 scrollbar-thin">
          
          {/* INICIO */}
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm p-3.5 flex flex-col gap-1">
            <button 
              onClick={() => setActiveTab('dashboard')}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-bold flex items-center gap-2.5 transition-all cursor-pointer ${activeTab === 'dashboard' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-650 dark:text-slate-355 hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}
            >
              <Home size={14} /> Inicio
            </button>
          </div>

          {/* SECCIÓN 1: FACTORING */}
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm p-3.5 flex flex-col gap-2">
            <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider px-3 mb-1">📊 Factoring</div>
            <nav className="flex flex-col gap-1">
              {[
                { id: 'factoring_registro', label: 'Registro', icon: <FileEdit size={14} /> },
                { id: 'factoring_originacion', label: 'Originación', icon: <FileText size={14} /> },
                { id: 'factoring_aprobacion', label: 'Aprobación', icon: <CheckSquare size={14} /> },
                { id: 'factoring_desembolso', label: 'Desembolso', icon: <DollarSign size={14} /> },
                { id: 'factoring_liquidacion', label: 'Liquidación', icon: <Coins size={14} /> },
                { id: 'factoring_reportes', label: 'Reportes', icon: <BarChart2 size={14} /> },
                { id: 'factoring_repositorio', label: 'Repositorio', icon: <FolderOpen size={14} /> },
              ].map(item => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2.5 transition-all cursor-pointer ${activeTab === item.id ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-650 dark:text-slate-355 hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              ))}
            </nav>
          </div>

          {/* SECCIÓN 2: CONFIRMING */}
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm p-3.5 flex flex-col gap-2">
            <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider px-3 mb-1">🔄 Confirming (Reserved)</div>
            <nav className="flex flex-col gap-1">
              <button 
                onClick={() => setActiveTab('confirming_futuros')}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2.5 transition-all cursor-pointer ${activeTab === 'confirming_futuros' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-650 dark:text-slate-355 hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}
              >
                <Lock size={14} /> Futuros Módulos
              </button>
            </nav>
          </div>

          {/* SECCIÓN 3: CRM */}
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm p-3.5 flex flex-col gap-2">
            <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider px-3 mb-1">👥 CRM</div>
            <nav className="flex flex-col gap-1">
              {[
                { id: 'crm_asesores', label: 'Gestión de Asesores', icon: <Briefcase size={14} /> },
                { id: 'crm_fondos', label: 'Gestión de Fondos', icon: <Building2 size={14} /> },
                { id: 'crm_inversionistas', label: 'Gestión de Inversionistas', icon: <Users size={14} /> },
                { id: 'crm_contratos', label: 'Gestión de Contratos', icon: <FileText size={14} /> },
                { id: 'crm_certificados', label: 'Gestión de Certificados', icon: <Award size={14} /> },
                { id: 'crm_deducciones', label: 'Gestión de Deducciones / Rescates', icon: <MinusCircle size={14} /> },
                { id: 'crm_chat', label: 'Chat WhatsApp', icon: <MessageSquare size={14} /> },
              ].map(item => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2.5 transition-all cursor-pointer ${activeTab === item.id ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-650 dark:text-slate-355 hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              ))}
            </nav>
          </div>

          {/* SECCIÓN 4: HERRAMIENTAS */}
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm p-3.5 flex flex-col gap-2">
            <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider px-3 mb-1">🛠️ Herramientas</div>
            <nav className="flex flex-col gap-1">
              {[
                { id: 'herramientas_calculadora', label: 'Calculadora', icon: <Calculator size={14} /> },
                { id: 'herramientas_agentes', label: 'Agentes IA', icon: <Bot size={14} /> },
              ].map(item => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2.5 transition-all cursor-pointer ${activeTab === item.id ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-650 dark:text-slate-355 hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              ))}
            </nav>
          </div>

          {/* SECCIÓN 5: MANTENIMIENTO */}
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm p-3.5 flex flex-col gap-2">
            <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider px-3 mb-1">⚙️ Mantenimiento</div>
            <nav className="flex flex-col gap-1">
              {[
                { id: 'mantenimiento_limpieza', label: 'Limpieza BD', icon: <Trash2 size={14} /> },
                { id: 'mantenimiento_roles', label: 'Admin Roles', icon: <Settings size={14} /> },
              ].map(item => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2.5 transition-all cursor-pointer ${activeTab === item.id ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-650 dark:text-slate-355 hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              ))}
            </nav>
          </div>

          {/* SSL */}
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm p-3 flex flex-col gap-2 mt-auto">
            <div className="flex items-center gap-2 px-3 text-slate-500 dark:text-slate-400">
              <ShieldCheck size={14} className="text-emerald-500" />
              <span className="text-[10px] font-bold uppercase tracking-wider">SSL Cifrado Activo</span>
            </div>
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
