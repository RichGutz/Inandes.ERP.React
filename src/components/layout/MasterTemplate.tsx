// src/components/layout/MasterTemplate.tsx
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
  Settings,
  ChevronDown,
  ChevronRight,
  Layers
} from 'lucide-react';
import type { UserModuleAccess } from '../../services/authService';
import { applyTheme, getStoredTheme } from '../../styles/theme';

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
  // Estado local para Dark/Light mode sincronizado con theme.ts
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    return getStoredTheme() === 'dark';
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

  // Estado para modal ficticio de cambio de contraseña
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [modalSuccess, setModalSuccess] = useState('');

  // Efecto para alternar el modo oscuro en el document HTML
  useEffect(() => {
    applyTheme(isDarkMode ? 'dark' : 'light');
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

  // Datos de usuario
  const isGlobalAdmin = userRoles.some(r => r.modulo === 'CRM' && r.rol === 'ADMIN') && userRoles.some(r => r.modulo === 'FACTORING' && r.rol === 'ADMIN');
  const highestRole = isGlobalAdmin ? 'Administrador Global' : userRoles.some(r => r.rol === 'ADMIN') ? 'Administrador' : 'Visor';
  const currentUser = {
    email: userEmail,
    fullName: userFullName || 'Usuario InAndes',
    role: highestRole
  };

  const initials = currentUser.fullName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'IA';

  return (
    <div className="min-h-screen bg-[var(--bg-app)] font-sans flex flex-col antialiased text-[var(--text-main)] transition-colors duration-200">
      
      {/* Header Superior Corporativo Estilo APEFAC (74px) */}
      <header className="bg-white dark:bg-[#111827] border-b border-[#e2e8f0] dark:border-[#1f2937] sticky top-0 z-50 px-6 h-[74px] flex items-center justify-between shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
        
        {/* Izquierda: Logos + Estado de Red en Vivo */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab('home')}>
            <img src="/Logo.Inandes.jpeg" alt="InAndes ERP" className="h-[38px] rounded-lg object-contain shadow-xs" />
            <div className="hidden sm:flex flex-col">
              <span className="text-xs font-black text-[#0f172a] dark:text-[#f8fafc] tracking-tight uppercase">INANDES ERP</span>
              <span className="text-[10px] font-bold text-[#64748b] dark:text-[#94a3b8] tracking-wider uppercase">{currentModule}</span>
            </div>
          </div>

          <div className="w-[1px] h-8 bg-[#e2e8f0] dark:bg-[#334155] hidden sm:block" />

          {/* Live Network Status Badge Estilo APEFAC */}
          <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-[#ecfdf5] dark:bg-[#059669]/15 border border-[#a7f3d0] dark:border-[#059669]/30 rounded-full">
            <span className="w-2 h-2 rounded-full bg-[#059669] shadow-[0_0_0_2px_rgba(5,150,105,0.2)] animate-pulse" />
            <span className="text-[11px] text-[#059669] dark:text-[#34d399] font-extrabold tracking-tight">
              Factoring Conectado (FastAPI + Supabase)
            </span>
          </div>
        </div>

        {/* Centro: Título Central del Módulo */}
        <div className="hidden md:flex flex-col items-center justify-center text-center">
          <h2 className="text-sm font-black text-[#0f172a] dark:text-[#f8fafc] tracking-tight uppercase flex items-center gap-1.5">
            {title}
          </h2>
          {subtitle && (
            <p className="text-[10.5px] text-[#64748b] dark:text-[#94a3b8] font-bold uppercase tracking-wider mt-0.5">
              {subtitle}
            </p>
          )}
        </div>

        {/* Derecha: Acciones, Perfil, Dark Mode & Salir */}
        <div className="flex items-center gap-3">
          
          {/* Botones de Control y Exportación */}
          <div className="flex items-center gap-1.5 border-r border-[#e2e8f0] dark:border-[#334155] pr-3">
            {onExportExcel && (
              <button 
                className="h-8 text-[11px] font-bold flex items-center gap-1.5 px-3 rounded-lg border border-[#e2e8f0] dark:border-[#334155] bg-[#ffffff] dark:bg-[#1e293b] hover:bg-[#ecfdf5] dark:hover:bg-[#059669]/20 text-[#475569] dark:text-[#cbd5e1] hover:text-[#059669] dark:hover:text-[#34d399] cursor-pointer transition-colors shadow-xs"
                onClick={onExportExcel}
                title="Exportar datos a Excel"
              >
                <FileSpreadsheet size={13} className="text-[#059669]" />
                <span className="hidden sm:inline">Excel</span>
              </button>
            )}
            
            {onExportPDF && (
              <button 
                className="h-8 text-[11px] font-bold flex items-center gap-1.5 px-3 rounded-lg border border-[#e2e8f0] dark:border-[#334155] bg-[#ffffff] dark:bg-[#1e293b] hover:bg-[#fff1f2] dark:hover:bg-[#e11d48]/20 text-[#475569] dark:text-[#cbd5e1] hover:text-[#e11d48] dark:hover:text-[#fb7185] cursor-pointer transition-colors shadow-xs"
                onClick={onExportPDF}
                title="Exportar datos a PDF"
              >
                <FileDown size={13} className="text-[#e11d48]" />
                <span className="hidden sm:inline">PDF</span>
              </button>
            )}

            <button 
              className="h-8 text-[11px] font-bold flex items-center gap-1.5 px-3 rounded-lg border border-[#e2e8f0] dark:border-[#334155] bg-[#ffffff] dark:bg-[#1e293b] hover:bg-[#f8fafc] dark:hover:bg-[#334155] text-[#475569] dark:text-[#cbd5e1] cursor-pointer transition-colors shadow-xs"
              onClick={handleNewWindow}
              title="Abrir en ventana independiente"
            >
              <ExternalLink size={13} />
              <span className="hidden sm:inline">Ventana</span>
            </button>
          </div>

          {/* User Profile Badge Estilo APEFAC */}
          <div className="flex items-center gap-2.5 px-3 py-1.5 bg-[#f8fafc] dark:bg-[#1e293b] rounded-full border border-[#e2e8f0] dark:border-[#334155]">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#0284c7] to-[#4f46e5] text-white flex items-center justify-center text-[11px] font-black shadow-xs">
              {initials}
            </div>
            <div className="hidden lg:flex flex-col text-left leading-tight">
              <span className="text-[11.5px] font-black text-[#0f172a] dark:text-[#f8fafc]">{currentUser.fullName}</span>
              <span className="text-[9.5px] font-bold text-[#0284c7] dark:text-[#38bdf8] uppercase tracking-wider">{currentUser.role}</span>
            </div>
          </div>

          {/* Toggle Modo Oscuro / Claro */}
          <div className="flex items-center gap-1 bg-[#f1f5f9] dark:bg-[#1e293b] rounded-full p-1 border border-[#e2e8f0] dark:border-[#334155]">
            <button
              onClick={() => setIsDarkMode(false)}
              className={`p-1.5 rounded-full transition-all cursor-pointer ${!isDarkMode ? 'bg-white shadow text-amber-500' : 'text-slate-400 hover:text-slate-600'}`}
              title="Modo Claro"
            >
              <Sun size={13} />
            </button>
            <button
              onClick={() => setIsDarkMode(true)}
              className={`p-1.5 rounded-full transition-all cursor-pointer ${isDarkMode ? 'bg-slate-700 shadow text-indigo-400' : 'text-slate-400 hover:text-slate-600'}`}
              title="Modo Oscuro"
            >
              <Moon size={13} />
            </button>
          </div>

          {/* Botón Cambiar Contraseña */}
          <button 
            onClick={() => {
              setModalSuccess('');
              setShowChangePasswordModal(true);
            }}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors border border-transparent cursor-pointer"
            title="Cambiar Contraseña"
          >
            <Key size={15} />
          </button>

          {/* Botón Salir Estilo APEFAC */}
          <button
            onClick={handleLogout}
            title="Cerrar Sesión"
            className="flex items-center gap-1.5 bg-[#fef2f2] dark:bg-[#e11d48]/15 border border-[#fecdd3] dark:border-[#e11d48]/30 text-[#e11d48] dark:text-[#fb7185] px-3 py-1.5 rounded-lg font-bold text-xs cursor-pointer hover:bg-[#fee2e2] transition-colors shadow-xs"
          >
            <LogOut size={13} />
            <span className="hidden sm:inline">Salir</span>
          </button>

          {/* Logo Geeksoft */}
          <img src="/Logo.Geeksoft.png" alt="Geeksoft" className="h-[44px] object-contain pl-1 hidden xl:block" />

        </div>
      </header>

      {/* Cuerpo Principal: Sidebar + Contenido */}
      <div className="flex-1 flex max-w-full w-full mx-auto p-4 gap-4 overflow-hidden">
        
        {/* Sidebar Izquierdo Ejecutivo */}
        <aside className="w-64 shrink-0 flex flex-col gap-2.5 hidden md:flex h-fit max-h-[calc(100vh-105px)] overflow-y-auto pr-1 scrollbar-thin">
          
          {/* SECCIÓN 1: FACTORING */}
          {hasFactoringAccess && (
          <div className="glass-card overflow-hidden">
            <button
              onClick={() => setActiveTab('factoring_core')}
              className={`w-full flex items-center justify-between px-4 py-3 text-xs font-black uppercase tracking-wider transition-colors cursor-pointer ${
                isFactoring 
                  ? 'text-[#0284c7] dark:text-[#38bdf8] bg-[#f0f9ff] dark:bg-[#0284c7]/15 border-l-4 border-[#0284c7]' 
                  : 'text-[#475569] dark:text-[#94a3b8] hover:bg-[#f8fafc] dark:hover:bg-[#334155]/40'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Layers size={16} className={isFactoring ? 'text-[#0284c7] dark:text-[#38bdf8]' : 'text-[#64748b]'} />
                <span>FACTORING</span>
              </div>
              {isFactoring && <span className="w-2 h-2 rounded-full bg-[#0284c7]" />}
            </button>
          </div>
          )}

          {/* SECCIÓN 2: CONFIRMING */}
          <div className="glass-card overflow-hidden">
            <button
              onClick={() => toggleGroup('confirming')}
              className={`w-full flex items-center justify-between px-4 py-3 text-xs font-black uppercase tracking-wider transition-colors cursor-pointer ${
                isConfirming 
                  ? 'text-[#0284c7] dark:text-[#38bdf8] bg-[#f0f9ff] dark:bg-[#0284c7]/15 border-l-4 border-[#0284c7]' 
                  : 'text-[#475569] dark:text-[#94a3b8] hover:bg-[#f8fafc] dark:hover:bg-[#334155]/40'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Lock size={15} className="text-[#64748b]" />
                <span>Confirming</span>
              </div>
              {openGroup === 'confirming' ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
            {openGroup === 'confirming' && (
              <nav className="flex flex-col gap-1 p-2 bg-[#f8fafc] dark:bg-[#151e2e] border-t border-[#e2e8f0] dark:border-[#334155]">
                <button
                  onClick={() => setActiveTab('confirming_futuros')}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2.5 transition-all cursor-pointer ${
                    activeTab === 'confirming_futuros' 
                      ? 'bg-[#0284c7] text-white shadow-xs' 
                      : 'text-[#475569] dark:text-[#cbd5e1] hover:bg-white dark:hover:bg-[#1e293b]'
                  }`}
                >
                  <Lock size={14} /> Próximamente
                </button>
              </nav>
            )}
          </div>

          {/* SECCIÓN 3: CRM INVERSIONISTAS */}
          {hasCRMAccess && (
          <div className="glass-card overflow-hidden">
            <button
              onClick={() => toggleGroup('crm')}
              className={`w-full flex items-center justify-between px-4 py-3 text-xs font-black uppercase tracking-wider transition-colors cursor-pointer ${
                isCRM 
                  ? 'text-[#0284c7] dark:text-[#38bdf8] bg-[#f0f9ff] dark:bg-[#0284c7]/15 border-l-4 border-[#0284c7]' 
                  : 'text-[#475569] dark:text-[#94a3b8] hover:bg-[#f8fafc] dark:hover:bg-[#334155]/40'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Users size={16} className={isCRM ? 'text-[#0284c7] dark:text-[#38bdf8]' : 'text-[#64748b]'} />
                <span>CRM Inversionistas</span>
              </div>
              {openGroup === 'crm' ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
            {openGroup === 'crm' && (
              <nav className="flex flex-col gap-1 p-2 bg-[#f8fafc] dark:bg-[#151e2e] border-t border-[#e2e8f0] dark:border-[#334155]">
                {[
                  { id: 'crm_inversionistas', label: 'Inversionistas', icon: <Users size={14} /> },
                  { id: 'crm_fondos', label: 'Fondos & Tasas', icon: <Building2 size={14} /> },
                  { id: 'crm_asesores', label: 'Asesores', icon: <Briefcase size={14} /> },
                  { id: 'crm_contratos', label: 'Contratos', icon: <FileText size={14} /> },
                  { id: 'crm_certificados', label: 'Certificados', icon: <Award size={14} /> },
                  { id: 'crm_deducciones', label: 'Deducciones / Rescates', icon: <MinusCircle size={14} /> },
                  { id: 'crm_chat', label: 'Chat WhatsApp', icon: <MessageSquare size={14} /> },
                ].map(item => {
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2.5 transition-all cursor-pointer ${
                        isActive 
                          ? 'bg-[#0284c7] text-white shadow-xs' 
                          : 'text-[#475569] dark:text-[#cbd5e1] hover:bg-white dark:hover:bg-[#1e293b]'
                      }`}
                    >
                      {item.icon}
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </nav>
            )}
          </div>
          )}

          {/* SECCIÓN 4: HERRAMIENTAS */}
          <div className="glass-card overflow-hidden">
            <button
              onClick={() => toggleGroup('herramientas')}
              className={`w-full flex items-center justify-between px-4 py-3 text-xs font-black uppercase tracking-wider transition-colors cursor-pointer ${
                isHerr 
                  ? 'text-[#0284c7] dark:text-[#38bdf8] bg-[#f0f9ff] dark:bg-[#0284c7]/15 border-l-4 border-[#0284c7]' 
                  : 'text-[#475569] dark:text-[#94a3b8] hover:bg-[#f8fafc] dark:hover:bg-[#334155]/40'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Calculator size={16} className={isHerr ? 'text-[#0284c7] dark:text-[#38bdf8]' : 'text-[#64748b]'} />
                <span>Herramientas</span>
              </div>
              {openGroup === 'herramientas' ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
            {openGroup === 'herramientas' && (
              <nav className="flex flex-col gap-1 p-2 bg-[#f8fafc] dark:bg-[#151e2e] border-t border-[#e2e8f0] dark:border-[#334155]">
                {[
                  { id: 'herramientas_calculadora', label: 'Calculadora', icon: <Calculator size={14} /> },
                  { id: 'herramientas_agentes', label: 'Agentes IA', icon: <Bot size={14} /> },
                ].map(item => {
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2.5 transition-all cursor-pointer ${
                        isActive 
                          ? 'bg-[#0284c7] text-white shadow-xs' 
                          : 'text-[#475569] dark:text-[#cbd5e1] hover:bg-white dark:hover:bg-[#1e293b]'
                      }`}
                    >
                      {item.icon}
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </nav>
            )}
          </div>

          {/* SECCIÓN 5: MANTENIMIENTO */}
          <div className="glass-card overflow-hidden">
            <button
              onClick={() => toggleGroup('mantenimiento')}
              className={`w-full flex items-center justify-between px-4 py-3 text-xs font-black uppercase tracking-wider transition-colors cursor-pointer ${
                isMant 
                  ? 'text-[#0284c7] dark:text-[#38bdf8] bg-[#f0f9ff] dark:bg-[#0284c7]/15 border-l-4 border-[#0284c7]' 
                  : 'text-[#475569] dark:text-[#94a3b8] hover:bg-[#f8fafc] dark:hover:bg-[#334155]/40'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Settings size={16} className={isMant ? 'text-[#0284c7] dark:text-[#38bdf8]' : 'text-[#64748b]'} />
                <span>Mantenimiento</span>
              </div>
              {openGroup === 'mantenimiento' ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
            {openGroup === 'mantenimiento' && (
              <nav className="flex flex-col gap-1 p-2 bg-[#f8fafc] dark:bg-[#151e2e] border-t border-[#e2e8f0] dark:border-[#334155]">
                {[
                  { id: 'mantenimiento_limpieza', label: 'Limpieza BD', icon: <Trash2 size={14} /> },
                  { id: 'mantenimiento_roles', label: 'Admin Roles', icon: <Settings size={14} /> },
                ].map(item => {
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2.5 transition-all cursor-pointer ${
                        isActive 
                          ? 'bg-[#0284c7] text-white shadow-xs' 
                          : 'text-[#475569] dark:text-[#cbd5e1] hover:bg-white dark:hover:bg-[#1e293b]'
                      }`}
                    >
                      {item.icon}
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </nav>
            )}
          </div>

        </aside>

        {/* Contenido Principal de Vistas */}
        <main className="flex-1 flex flex-col glass-card p-6 min-w-0 overflow-y-auto">
          {children}
        </main>

      </div>

      {/* Footer Corporativo APEFAC */}
      <footer className="bg-white dark:bg-[#111827] border-t border-[#e2e8f0] dark:border-[#1f2937] py-3 px-6 text-center text-[10px] text-[#64748b] dark:text-[#94a3b8] font-bold tracking-wider uppercase mt-auto">
        © {new Date().getFullYear()} INANDES INVERSIONES · GEEKSOFT TECHNOLOGY ENGINE
      </footer>

      {/* Modal Cambio Contraseña (Simulación) */}
      {showChangePasswordModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-md p-6 flex flex-col gap-4 shadow-xl">
            <div className="flex justify-between items-center pb-2 border-b border-[#e2e8f0] dark:border-[#334155]">
              <h3 className="font-extrabold text-[#0f172a] dark:text-[#f8fafc] text-xs uppercase tracking-wider flex items-center gap-1.5">
                <Key size={16} className="text-[#0284c7]" /> Cambiar Contraseña
              </h3>
              <button 
                onClick={() => setShowChangePasswordModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full p-1 cursor-pointer"
              >
                <span className="text-lg font-bold">×</span>
              </button>
            </div>

            {modalSuccess && (
              <div className="bg-[#ecfdf5] dark:bg-[#059669]/20 border border-[#a7f3d0] dark:border-[#059669]/30 text-[#059669] dark:text-[#34d399] rounded-lg p-3 text-xs font-bold">
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
                <label className="text-[10px] font-bold text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wider">Contraseña Actual</label>
                <input 
                  type="password" 
                  required 
                  value={currentPassword} 
                  onChange={e => setCurrentPassword(e.target.value)}
                  placeholder="Contraseña actual"
                  className="border border-[#e2e8f0] dark:border-[#334155] bg-[#f8fafc] dark:bg-[#0b0f19] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#0284c7] dark:text-white"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wider">Nueva Contraseña</label>
                <input 
                  type="password" 
                  required 
                  value={newPassword} 
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Nueva contraseña"
                  className="border border-[#e2e8f0] dark:border-[#334155] bg-[#f8fafc] dark:bg-[#0b0f19] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#0284c7] dark:text-white"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wider">Confirmar Contraseña</label>
                <input 
                  type="password" 
                  required 
                  value={confirmPassword} 
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Repetir nueva contraseña"
                  className="border border-[#e2e8f0] dark:border-[#334155] bg-[#f8fafc] dark:bg-[#0b0f19] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#0284c7] dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#e2e8f0] dark:border-[#334155]">
                <button 
                  type="button"
                  onClick={() => setShowChangePasswordModal(false)}
                  className="text-xs bg-[#f8fafc] dark:bg-[#151e2e] border border-[#e2e8f0] dark:border-[#334155] hover:bg-[#e2e8f0] text-[#475569] dark:text-[#cbd5e1] px-4 py-2 rounded-lg font-bold transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="text-xs bg-[#0284c7] hover:bg-[#0369a1] text-white px-5 py-2 rounded-lg font-bold transition-colors cursor-pointer shadow-xs"
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
