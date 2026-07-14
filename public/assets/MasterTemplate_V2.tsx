import React, { useState } from 'react';
import { LogOut, ExternalLink, User, Settings, ArrowLeft, Database, Sun, Moon, Key, FileSpreadsheet, FileDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../ui/button';
import { useForecastContext_V2 } from '../../context/ForecastContext_V2';
import { useAuth } from '../../context/AuthContext';
import { AuthService } from '../../services/api';

interface MasterTemplateProps {
    title: string;
    subtitle?: string;
    children: React.ReactNode;
    activeTab?: string;
    onBackToDashboard?: () => void;
    onExportExcel?: () => void;
    onExportPDF?: () => void;
}

export const MasterTemplate: React.FC<MasterTemplateProps> = ({
    title,
    subtitle,
    children,
    activeTab = '',
    onBackToDashboard,
    onExportExcel,
    onExportPDF
}) => {
    const navigate = useNavigate();
    const context = useForecastContext_V2();
    const { user, logout, hasPermission } = useAuth();
    
    // Estados para el cambio de contraseña
    const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [modalError, setModalError] = useState('');
    const [modalSuccess, setModalSuccess] = useState('');
    const [modalLoading, setModalLoading] = useState(false);

    const handleNewWindow = () => {
        window.open(window.location.href, '_blank', 'width=1200,height=800,menubar=no,status=no');
    };


    const handleLogout = () => {
        if (confirm('¿Desea cerrar la sesión de usuario?')) {
            logout();
            navigate('/login');
        }
    };


    return (
        <div className="min-h-screen bg-slate-50 font-sans flex flex-col antialiased">
            {/* Header Superior Principal */}
            <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm px-6 py-3">
                <div className="flex items-center justify-between max-w-full mx-auto w-full">
                    
                    {/* Logos y Título de App */}
                    <div className="flex items-center gap-3">
                        <img src="/Logo.Petral.png" alt="Naviera Petral" className="h-8 object-contain" />
                        <div className="flex flex-col border-l border-slate-200 pl-3">
                            <h1 className="text-sm font-black text-slate-800 tracking-tight uppercase">SHIPPING.SOFT</h1>
                            <span className="text-[10px] text-slate-500 font-bold tracking-wider uppercase">Módulos de Datos Maestros</span>
                        </div>
                    </div>

                    {/* Título Central del Módulo */}
                    <div className="hidden md:flex flex-col items-center">
                        <div className="flex items-center gap-2">
                            <Database size={16} className="text-teal-600" />
                            <h2 className="text-base font-black text-slate-800 tracking-tight">{title}</h2>
                        </div>
                        {subtitle && <p className="text-[11px] text-slate-500 font-medium mt-0.5">{subtitle}</p>}
                    </div>

                    {/* Acciones y Panel de Usuario */}
                    <div className="flex items-center gap-4">
                        {/* Botones de Control de Ventana */}
                        <div className="flex items-center gap-1.5 border-r border-slate-200 pr-3">
                            {onExportExcel && (
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="h-8 text-xs font-semibold flex items-center gap-1.5 hover:bg-emerald-50 hover:text-emerald-750 border-slate-200 text-slate-600 cursor-pointer"
                                    onClick={onExportExcel}
                                    title="Exportar datos a Excel"
                                >
                                    <FileSpreadsheet size={13} className="text-emerald-600" />
                                    <span className="hidden sm:inline">Bajar Excel</span>
                                </Button>
                            )}
                            
                            {onExportPDF && (
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="h-8 text-xs font-semibold flex items-center gap-1.5 hover:bg-rose-50 hover:text-rose-750 border-slate-200 text-slate-600 cursor-pointer"
                                    onClick={onExportPDF}
                                    title="Exportar datos a PDF"
                                >
                                    <FileDown size={13} className="text-rose-600" />
                                    <span className="hidden sm:inline">Bajar PDF</span>
                                </Button>
                            )}

                            <Button 
                                variant="outline" 
                                size="sm" 
                                className="h-8 text-xs font-semibold flex items-center gap-1.5 hover:bg-slate-50 border-slate-200 text-slate-600 cursor-pointer"
                                onClick={handleNewWindow}
                                title="Abrir este módulo en una ventana independiente"
                            >
                                <ExternalLink size={13} />
                                <span className="hidden sm:inline">Nueva Ventana</span>
                            </Button>
                            
                            {onBackToDashboard && (
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="h-8 text-xs font-semibold flex items-center gap-1.5 hover:bg-slate-50 border-slate-200 text-slate-600 cursor-pointer"
                                    onClick={onBackToDashboard}
                                >
                                    <ArrowLeft size={13} />
                                    <span className="hidden sm:inline">Volver a Dashboard</span>
                                </Button>
                            )}
                        </div>

                        {/* Widget de Usuario y Logo Geeksoft */}
                        <div className="flex items-center gap-3">
                            <div className="flex flex-col items-end hidden lg:flex">
                                <span className="text-xs font-bold text-slate-800 leading-tight">{user?.full_name || 'Cargando...'}</span>
                                <span className="text-[9px] font-black text-teal-600 uppercase tracking-wider">{user?.role === 'ADMIN' ? 'Administrador' : 'Usuario'}</span>
                            </div>

                            
                            {/* Avatar Dinámico con Iniciales y Degradado Premium */}
                            <div 
                                className={`h-8 w-8 rounded-full bg-gradient-to-br ${
                                    user?.role === 'ADMIN' 
                                        ? 'from-indigo-600 to-violet-500 text-white border-indigo-200' 
                                        : 'from-blue-600 to-teal-500 text-white border-blue-200'
                                } flex items-center justify-center text-xs font-black shadow-sm tracking-wider uppercase border select-none`}
                                title={`${user?.full_name} (${user?.role})`}
                            >
                                {(() => {
                                    if (!user?.full_name) return 'U';
                                    const parts = user.full_name.trim().split(/\s+/);
                                    if (parts.length >= 2) {
                                        return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
                                    }
                                    return parts[0][0].toUpperCase();
                                })()}
                            </div>


                            {/* Botón Cambiar Contraseña */}
                            <button 
                                onClick={() => {
                                    setModalError('');
                                    setModalSuccess('');
                                    setShowChangePasswordModal(true);
                                }}
                                className="p-1.5 rounded-full hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-colors border border-transparent hover:border-blue-100 cursor-pointer mr-1"
                                title="Cambiar Contraseña"
                            >
                                <Key size={16} />
                            </button>

                            {/* Botón Salir */}
                            <button 
                                onClick={handleLogout}
                                className="p-1.5 rounded-full hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors border border-transparent hover:border-red-100 cursor-pointer mr-1"
                                title="Cerrar Sesión"
                            >
                                <LogOut size={16} />
                            </button>

                            <span className="text-slate-200 text-lg">|</span>
                            
                            {/* Theme Toggle */}
                            <div className="flex items-center gap-1 bg-slate-100 rounded-full p-1 shadow-inner ml-1">
                                <button
                                    onClick={() => context.setIsDarkMode(false)}
                                    className={`p-1.5 rounded-full transition-all ${!context.isDarkMode ? 'bg-white shadow text-amber-500' : 'text-slate-400 hover:text-slate-600'}`}
                                    title="Light Mode"
                                >
                                    <Sun size={14} />
                                </button>
                                <button
                                    onClick={() => context.setIsDarkMode(true)}
                                    className={`p-1.5 rounded-full transition-all ${context.isDarkMode ? 'bg-slate-800 shadow text-indigo-400' : 'text-slate-400 hover:text-slate-600'}`}
                                    title="Dark Mode"
                                >
                                    <Moon size={14} />
                                </button>
                            </div>

                            <img src="/Logo.Geeksoft.png" alt="Geeksoft" className="h-9 object-contain pl-1" />
                        </div>
                    </div>

                </div>
            </header>

            {/* Layout Principal con Sidebar Lateral de Maestros */}
            <div className="flex-1 flex max-w-full w-full mx-auto p-4 gap-4">
                
                {/* Sidebar Izquierdo */}
                <aside className="w-64 shrink-0 flex flex-col gap-4 hidden md:flex">
                    {/* BLOQUE 1: MAESTROS */}
                    {hasPermission ? (
                        (hasPermission('maestro_buques', 'Visor') || 
                         hasPermission('maestro_rutas', 'Visor') || 
                         hasPermission('maestro_tarifas', 'Visor') || 
                         hasPermission('maestro_puertos', 'Visor') || 
                         hasPermission('maestro_contratos', 'Visor') || 
                         hasPermission('maestro_costos_agencia', 'Visor')) && (
                            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 flex flex-col gap-2">
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-1">Datos Maestros</div>
                                <nav className="flex flex-col gap-1">
                                    {hasPermission('maestro_puertos', 'Visor') && (
                                        <button 
                                            onClick={() => navigate('/ports')}
                                            className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2.5 transition-all ${activeTab === 'ports' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
                                        >
                                            <span className="text-sm">⚓</span> Maestro de Puertos & Terminales
                                        </button>
                                    )}

                                    {hasPermission('maestro_buques', 'Visor') && (
                                        <button 
                                            onClick={() => navigate('/vessels')}
                                            className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2.5 transition-all ${activeTab === 'vessels' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
                                        >
                                            <span className="text-sm">🚢</span> Maestro de Buques
                                        </button>
                                    )}
                                    
                                    {hasPermission('maestro_rutas', 'Visor') && (
                                        <button 
                                            onClick={() => navigate('/routes')}
                                            className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2.5 transition-all ${activeTab === 'routes' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
                                        >
                                            <span className="text-sm">🗺️</span> Maestro de Distancias
                                        </button>
                                    )}
                                    
                                    {hasPermission('maestro_tarifas', 'Visor') && (
                                        <button 
                                            onClick={() => navigate('/clients')}
                                            className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2.5 transition-all ${activeTab === 'clients' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
                                        >
                                            <span className="text-sm">💼</span> Maestro de Clientes
                                        </button>
                                    )}

                                    {hasPermission('maestro_contratos', 'Visor') && (
                                        <button 
                                            onClick={() => navigate('/contracts')}
                                            className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2.5 transition-all ${activeTab === 'contracts' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
                                        >
                                            <span className="text-sm">📝</span> Maestro de Contratos
                                        </button>
                                    )}

                                    {hasPermission('maestro_bunker', 'Visor') && (
                                        <button 
                                            onClick={() => navigate('/bunker-prices')}
                                            className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2.5 transition-all ${activeTab === 'bunker' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
                                        >
                                            <span className="text-sm">⛽</span> Maestro de Bunker
                                        </button>
                                    )}

                                    {hasPermission('maestro_costos_agencia', 'Visor') && (
                                        <button 
                                            onClick={() => navigate('/port-costs')}
                                            className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2.5 transition-all ${activeTab === 'port-costs' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
                                        >
                                            <span className="text-sm">💰</span> Maestro Gastos Portuarios
                                        </button>
                                    )}

                                    {hasPermission('maestro_rutas', 'Visor') && (
                                        <button 
                                            onClick={() => navigate('/sources-sinks')}
                                            className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2.5 transition-all ${activeTab === 'sources-sinks' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
                                        >
                                            <span className="text-sm">🔄</span> Maestro Originación / Destino
                                        </button>
                                    )}
                                </nav>
                            </div>
                        )
                    ) : (
                        /* Fallback por si carga */
                        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 flex flex-col gap-2">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-1">Cargando...</div>
                        </div>
                    )}

                    {/* BLOQUE 2: HERRAMIENTAS */}
                    {hasPermission && (hasPermission('multicotizador_spot', 'Visor') || hasPermission('matriz_financiera', 'Visor')) && (
                        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 flex flex-col gap-2">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-1">Herramientas</div>
                            <nav className="flex flex-col gap-1">
                                {hasPermission('multicotizador_spot', 'Visor') && (
                                    <button 
                                        onClick={() => navigate('/multicotizador')}
                                        className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2.5 transition-all ${activeTab === 'multicotizador' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
                                    >
                                        <span className="text-sm">⛴️</span> Multicotizador Multirutas
                                    </button>
                                )}
                                
                                {hasPermission('matriz_financiera', 'Visor') && (
                                    <>
                                        <button 
                                            onClick={() => navigate('/dashboard')}
                                            className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2.5 transition-all ${activeTab === 'financial-matrix' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
                                        >
                                            <span className="text-sm">📊</span> Matriz Financiera
                                        </button>
                                        <button 
                                            onClick={() => navigate('/graphic-analysis')}
                                            className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2.5 transition-all ${activeTab === 'graphic-analysis' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
                                        >
                                            <span className="text-sm">📈</span> Análisis Gráfico
                                        </button>
                                        <button 
                                            onClick={() => navigate('/spaghetti-map')}
                                            className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2.5 transition-all ${activeTab === 'spaghetti-map' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
                                        >
                                            <span className="text-sm">🗺️</span> Spaguetti Map
                                        </button>
                                        <button 
                                            onClick={() => navigate('/audit-ledger')}
                                            className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2.5 transition-all ${activeTab === 'audit-ledger' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
                                        >
                                            <span className="text-sm">🔍</span> Auditoría Ledger
                                        </button>
                                        <button 
                                            onClick={() => navigate('/audit-engine')}
                                            className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2.5 transition-all ${activeTab === 'audit-engine' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
                                        >
                                            <span className="text-sm">🔎</span> Auditoría Motor
                                        </button>
                                    </>
                                )}
                            </nav>
                        </div>
                    )}

                    {/* BLOQUE 3: CONFIGURACIÓN */}
                    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 flex flex-col gap-2">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-1">Configuración</div>
                        <nav className="flex flex-col gap-1">
                            <button className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2.5 transition-all ${activeTab === 'settings' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}>
                                <Settings size={14} /> Temas y Estilos
                            </button>
                        </nav>
                    </div>

                    {/* BLOQUE 4: USUARIOS Y PERMISOS (Sólo visible para ADMIN) */}
                    {user?.role === 'ADMIN' && (
                        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 flex flex-col gap-2">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-1">Usuarios y Permisos</div>
                            <nav className="flex flex-col gap-1">
                                <button 
                                    onClick={() => navigate('/users')}
                                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2.5 transition-all ${activeTab === 'users' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
                                >
                                    <User size={14} /> Gestión de Usuarios
                                </button>
                            </nav>
                        </div>
                    )}
                </aside>


                {/* Contenido Principal */}
                <main className="flex-1 flex flex-col bg-white border border-slate-200 rounded-xl shadow-sm p-6 min-w-0 overflow-hidden">
                    {children}
                </main>

            </div>

            {/* Footer Corporativo */}
            <footer className="bg-white border-t border-slate-200 py-3 px-6 text-center text-[10px] text-slate-400 font-semibold tracking-wider uppercase mt-auto">
                © {new Date().getFullYear()} NAVIERA PETRAL · GEEKSOFT TECHNOLOGY PARTNER
            </footer>

            {/* Modal de Cambio de Contraseña */}
            {showChangePasswordModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white border border-slate-200 w-full max-w-md rounded-2xl shadow-xl p-6 flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                            <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider flex items-center gap-1.5">
                                <Key size={16} className="text-blue-600" /> Cambiar Contraseña
                            </h3>
                            <button 
                                onClick={() => setShowChangePasswordModal(false)}
                                className="text-slate-405 hover:text-slate-600 rounded-full p-1"
                            >
                                <span className="text-lg font-bold">×</span>
                            </button>
                        </div>

                        {modalError && (
                            <div className="bg-rose-50 border border-rose-200 text-rose-600 rounded-lg p-3 text-xs font-semibold leading-relaxed">
                                ⚠️ {modalError}
                            </div>
                        )}

                        {modalSuccess && (
                            <div className="bg-emerald-50 border border-emerald-200 text-emerald-600 rounded-lg p-3 text-xs font-semibold leading-relaxed">
                                ✓ {modalSuccess}
                            </div>
                        )}

                        <form onSubmit={async (e) => {
                            e.preventDefault();
                            setModalError('');
                            setModalSuccess('');
                            
                            if (newPassword !== confirmPassword) {
                                setModalError('Las nuevas contraseñas no coinciden.');
                                return;
                            }
                            
                            if (newPassword.length < 4) {
                                setModalError('La nueva contraseña debe tener al menos 4 caracteres.');
                                return;
                            }
                            
                            setModalLoading(true);
                            try {
                                await AuthService.changePassword({
                                    email: user?.email,
                                    current_password: currentPassword,
                                    new_password: newPassword
                                });
                                setModalSuccess('Contraseña cambiada exitosamente.');
                                setCurrentPassword('');
                                setNewPassword('');
                                setConfirmPassword('');
                                setTimeout(() => setShowChangePasswordModal(false), 1800);
                            } catch (err: any) {
                                const msg = err.response?.data?.detail || 'La contraseña actual es incorrecta o hubo un problema.';
                                setModalError(msg);
                            } finally {
                                setModalLoading(false);
                            }
                        }} className="flex flex-col gap-3">
                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Contraseña Actual</label>
                                <input 
                                    type="password" 
                                    required 
                                    value={currentPassword} 
                                    onChange={e => setCurrentPassword(e.target.value)}
                                    placeholder="Ingrese su clave actual"
                                    className="border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium focus:outline-none focus:border-slate-800"
                                />
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Nueva Contraseña</label>
                                <input 
                                    type="password" 
                                    required 
                                    value={newPassword} 
                                    onChange={e => setNewPassword(e.target.value)}
                                    placeholder="Mínimo 4 caracteres"
                                    className="border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium focus:outline-none focus:border-slate-800"
                                />
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Confirmar Nueva Contraseña</label>
                                <input 
                                    type="password" 
                                    required 
                                    value={confirmPassword} 
                                    onChange={e => setConfirmPassword(e.target.value)}
                                    placeholder="Repita la nueva clave"
                                    className="border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium focus:outline-none focus:border-slate-800"
                                />
                            </div>

                            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                                <button 
                                    type="button"
                                    onClick={() => setShowChangePasswordModal(false)}
                                    className="text-xs bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700 px-4 py-2 rounded-lg font-bold transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    type="submit"
                                    disabled={modalLoading}
                                    className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg font-bold transition-colors disabled:opacity-50"
                                >
                                    {modalLoading ? 'Cambiando...' : 'Cambiar Contraseña'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

