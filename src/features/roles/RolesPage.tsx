import React, { useEffect, useState } from 'react';
import { getAllUserAccess, upsertUserAccess, deleteUserAccess } from '../../services/authService';
import type { UserModuleAccess } from '../../services/authService';
import { Loader2, AlertCircle, RefreshCw, UserPlus, Shield, Search, X, CheckCircle, Plus } from 'lucide-react';

type AccessRecord = UserModuleAccess & { email: string };

interface UserMatrix {
  email: string;
  nombre_completo: string;
  accesses: Record<string, string>; // modulo -> rol
}

const MODULES = ['CRM', 'FACTORING'];

export const RolesPage: React.FC = () => {
  const [accesses, setAccesses] = useState<AccessRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Estados para Modal de Agregar Nuevo Usuario
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState<boolean>(false);
  const [newUserData, setNewUserData] = useState({ email: '', nombre_completo: '', modulo: 'CRM', rol: 'VISOR' });
  const [addUserError, setAddUserError] = useState<string | null>(null);

  // Estados para Modal de Editar Celda (Usuario x Módulo)
  const [isCellModalOpen, setIsCellModalOpen] = useState<boolean>(false);
  const [cellData, setCellData] = useState<{ email: string; nombre_completo: string; modulo: string; currentRol: string | null }>({ email: '', nombre_completo: '', modulo: '', currentRol: null });
  const [selectedCellRol, setSelectedCellRol] = useState<string>('VISOR');
  
  const [formSubmitSuccess, setFormSubmitSuccess] = useState<boolean>(false);

  const fetchAccesses = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAllUserAccess();
      setAccesses(data);
    } catch (err: any) {
      setError(err.message || 'Error al cargar los accesos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccesses();
  }, []);

  // Transformar data a formato matricial
  const buildMatrix = (): UserMatrix[] => {
    const map: Record<string, UserMatrix> = {};
    for (const acc of accesses) {
      if (!map[acc.email]) {
        map[acc.email] = {
          email: acc.email,
          nombre_completo: acc.nombre_completo || '',
          accesses: {}
        };
      }
      map[acc.email].accesses[acc.modulo] = acc.rol;
      // Actualizar nombre si está presente y no lo teníamos
      if (acc.nombre_completo && !map[acc.email].nombre_completo) {
        map[acc.email].nombre_completo = acc.nombre_completo;
      }
    }
    return Object.values(map);
  };

  const matrix = buildMatrix();
  const filteredMatrix = matrix.filter(u => {
    const term = searchTerm.toLowerCase();
    return u.email.toLowerCase().includes(term) || u.nombre_completo.toLowerCase().includes(term);
  });

  const handleOpenAddUser = () => {
    setAddUserError(null);
    setFormSubmitSuccess(false);
    setNewUserData({ email: '', nombre_completo: '', modulo: 'CRM', rol: 'VISOR' });
    setIsAddUserModalOpen(true);
  };

  const handleSubmitAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddUserError(null);
    
    if (!newUserData.email || !newUserData.modulo || !newUserData.rol) {
      setAddUserError('Correo, módulo y rol son obligatorios.');
      return;
    }

    try {
      await upsertUserAccess(newUserData);
      setFormSubmitSuccess(true);
      setTimeout(() => {
        setIsAddUserModalOpen(false);
        fetchAccesses();
      }, 1000);
    } catch (err: any) {
      setAddUserError(err.message || 'Error al crear usuario.');
    }
  };

  const handleOpenCellModal = (email: string, nombre_completo: string, modulo: string, currentRol: string | null) => {
    setCellData({ email, nombre_completo, modulo, currentRol });
    setSelectedCellRol(currentRol || 'VISOR');
    setAddUserError(null);
    setFormSubmitSuccess(false);
    setIsCellModalOpen(true);
  };

  const handleSubmitCell = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (selectedCellRol === 'SIN_ACCESO') {
        if (cellData.currentRol) {
           await deleteUserAccess(cellData.email, cellData.modulo);
        }
      } else {
        await upsertUserAccess({
          email: cellData.email,
          nombre_completo: cellData.nombre_completo,
          modulo: cellData.modulo,
          rol: selectedCellRol
        });
      }
      setFormSubmitSuccess(true);
      setTimeout(() => {
        setIsCellModalOpen(false);
        fetchAccesses();
      }, 1000);
    } catch (err: any) {
      setAddUserError(err.message || 'Error al actualizar celda.');
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full animate-fadeIn">
      {/* Header Estilo APEFAC */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 w-full glass-card p-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-[#f0f9ff] dark:bg-[#0284c7]/15 border border-[#bae6fd] dark:border-[#0284c7]/30 text-[#0284c7] dark:text-[#38bdf8] rounded-xl flex items-center justify-center shrink-0">
            <Shield size={20} />
          </div>
          <div className="flex flex-col">
            <h1 className="text-xs font-black text-[#0f172a] dark:text-[#f8fafc] uppercase tracking-wider">Matriz de Roles (PETRAL)</h1>
            <p className="text-[10px] text-[#64748b] dark:text-[#94a3b8] font-bold uppercase tracking-wider">Control de Acceso por Módulo</p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={14} />
            <input
              type="text"
              className="w-full bg-[#f8fafc] dark:bg-[#0b0f19] border border-[#e2e8f0] dark:border-[#334155] rounded-lg py-1.5 pl-9 pr-4 text-xs font-semibold text-[#0f172a] dark:text-[#f8fafc] placeholder-slate-400 focus:outline-none focus:border-[#0284c7] shadow-xs"
              placeholder="Buscar por usuario o email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button 
            className="h-8 text-[10px] font-bold flex items-center gap-1.5 px-3 rounded-lg bg-[#0284c7] hover:bg-[#0369a1] text-white cursor-pointer shadow-xs transition-all"
            onClick={handleOpenAddUser}
          >
            <UserPlus size={13} />
            <span className="hidden sm:inline">Nuevo Usuario</span>
          </button>
          <button 
            className="h-8 text-[10px] font-bold flex items-center gap-1.5 px-3 rounded-lg border border-[#e2e8f0] dark:border-[#334155] bg-white dark:bg-[#1e293b] hover:bg-[#f8fafc] text-[#475569] dark:text-[#cbd5e1] cursor-pointer transition-colors shadow-xs"
            onClick={fetchAccesses}
            disabled={loading}
          >
            <RefreshCw size={13} className={loading ? 'animate-spin text-[#0284c7]' : ''} />
          </button>
        </div>
      </div>

      {/* Matriz */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 text-center gap-3">
          <Loader2 className="animate-spin text-[#0284c7]" size={40} />
          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Cargando matriz de accesos...</p>
        </div>
      ) : error ? (
        <div className="max-w-md mx-auto my-12 bg-white dark:bg-[#1e293b] border border-rose-200 dark:border-rose-900/50 p-6 rounded-2xl shadow-sm text-center flex flex-col items-center gap-3">
          <AlertCircle className="text-rose-600" size={40} />
          <p className="text-xs text-slate-500">{error}</p>
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#f8fafc] dark:bg-[#151e2e] border-b border-[#e2e8f0] dark:border-[#334155]">
                  <th className="font-bold text-[#64748b] dark:text-[#94a3b8] px-4 py-3 uppercase tracking-wider w-1/3">Usuario</th>
                  {MODULES.map(mod => (
                    <th key={mod} className="font-bold text-[#64748b] dark:text-[#94a3b8] px-4 py-3 uppercase tracking-wider text-center w-1/3 border-l border-[#e2e8f0] dark:border-[#334155]">
                      Módulo {mod}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredMatrix.length > 0 ? (
                  filteredMatrix.map((u, idx) => (
                    <tr key={idx} className="table-row-hover border-b border-[#e2e8f0]/60 dark:border-[#334155]/60 transition-colors">
                      {/* Celda Usuario */}
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span className="font-mono font-bold text-[#0f172a] dark:text-[#f8fafc]">{u.email}</span>
                          <span className="text-[10px] text-[#64748b] dark:text-[#94a3b8] font-medium">{u.nombre_completo || 'Sin nombre'}</span>
                        </div>
                      </td>
                      {/* Celdas Módulos */}
                      {MODULES.map(mod => {
                        const rol = u.accesses[mod];
                        return (
                          <td key={mod} className="px-4 py-3 text-center border-l border-[#e2e8f0]/60 dark:border-[#334155]/60">
                            {rol ? (
                              <button
                                onClick={() => handleOpenCellModal(u.email, u.nombre_completo, mod, rol)}
                                className={`px-3 py-1 rounded text-[9px] font-bold uppercase transition-all shadow-xs cursor-pointer ${rol === 'ADMIN' ? 'bg-[#f0f9ff] text-[#0284c7] border border-[#bae6fd] hover:bg-[#e0f2fe] dark:bg-[#0284c7]/15 dark:text-[#38bdf8] dark:border-[#0284c7]/30' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-200'}`}
                              >
                                {rol}
                              </button>
                            ) : (
                              <button
                                onClick={() => handleOpenCellModal(u.email, u.nombre_completo, mod, null)}
                                className="px-3 py-1 rounded-full text-[9px] font-bold uppercase bg-transparent text-slate-400 hover:text-[#0284c7] hover:bg-[#f0f9ff] border border-dashed border-slate-300 dark:border-slate-700 hover:border-[#bae6fd] transition-all cursor-pointer flex items-center gap-1 mx-auto"
                              >
                                <Plus size={10} /> Añadir
                              </button>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={1 + MODULES.length} className="px-4 py-8 text-center text-slate-400 font-semibold">
                      No se encontraron usuarios en la matriz.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: NUEVO USUARIO */}
      {isAddUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">Agregar Nuevo Usuario</h3>
              <button 
                onClick={() => setIsAddUserModalOpen(false)}
                className="text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 p-1.5 rounded-lg transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmitAddUser} className="flex flex-col p-5 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Correo Electrónico *</label>
                <input
                  type="email"
                  required
                  value={newUserData.email}
                  onChange={e => setNewUserData({ ...newUserData, email: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg py-2 px-3 text-xs font-semibold focus:outline-none focus:border-indigo-500"
                  placeholder="nuevo@inandes.com"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Nombre Completo (Opcional)</label>
                <input
                  type="text"
                  value={newUserData.nombre_completo}
                  onChange={e => setNewUserData({ ...newUserData, nombre_completo: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg py-2 px-3 text-xs font-semibold focus:outline-none focus:border-indigo-500"
                  placeholder="Ej. María López"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Módulo Inicial *</label>
                  <select
                    required
                    value={newUserData.modulo}
                    onChange={e => setNewUserData({ ...newUserData, modulo: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg py-2 px-3 text-xs font-semibold focus:outline-none focus:border-indigo-500"
                  >
                    {MODULES.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Rol Inicial *</label>
                  <select
                    required
                    value={newUserData.rol}
                    onChange={e => setNewUserData({ ...newUserData, rol: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg py-2 px-3 text-xs font-semibold focus:outline-none focus:border-indigo-500"
                  >
                    <option value="VISOR">VISOR</option>
                    <option value="ADMIN">ADMIN</option>
                  </select>
                </div>
              </div>

              {addUserError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-600 text-[10px] font-semibold p-3 rounded-lg flex items-center gap-2">
                  <AlertCircle size={14} />
                  <span>{addUserError}</span>
                </div>
              )}

              {formSubmitSuccess && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-600 text-[10px] font-semibold p-3 rounded-lg flex items-center gap-2">
                  <CheckCircle size={14} />
                  <span>Guardado exitosamente.</span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 mt-2">
                <button
                  type="button"
                  onClick={() => setIsAddUserModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-sm cursor-pointer"
                >
                  Agregar Usuario
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDITAR CELDA */}
      {isCellModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 w-full max-w-xs rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">Acceso: {cellData.modulo}</h3>
              <button 
                onClick={() => setIsCellModalOpen(false)}
                className="text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 p-1.5 rounded-lg transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmitCell} className="flex flex-col p-5 gap-4 text-center">
              <div>
                <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{cellData.email}</p>
                <p className="text-[10px] text-slate-500">{cellData.nombre_completo}</p>
              </div>

              <div className="flex flex-col gap-2 mt-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider text-left">Selecciona el Nivel de Acceso:</label>
                
                <button type="button" onClick={() => setSelectedCellRol('ADMIN')} className={`w-full text-left px-4 py-2 rounded-lg border text-xs font-bold transition-all ${selectedCellRol === 'ADMIN' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-600'}`}>
                  ⭐ ADMIN
                </button>
                <button type="button" onClick={() => setSelectedCellRol('VISOR')} className={`w-full text-left px-4 py-2 rounded-lg border text-xs font-bold transition-all ${selectedCellRol === 'VISOR' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-600'}`}>
                  👁️ VISOR
                </button>
                <button type="button" onClick={() => setSelectedCellRol('SIN_ACCESO')} className={`w-full text-left px-4 py-2 rounded-lg border text-xs font-bold transition-all ${selectedCellRol === 'SIN_ACCESO' ? 'border-rose-500 bg-rose-50 text-rose-700' : 'border-slate-200 bg-white hover:bg-rose-50 text-slate-600 hover:text-rose-600'}`}>
                  ❌ SIN ACCESO (Remover)
                </button>
              </div>

              {addUserError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-600 text-[10px] font-semibold p-2 rounded-lg">
                  {addUserError}
                </div>
              )}
              {formSubmitSuccess && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-600 text-[10px] font-semibold p-2 rounded-lg">
                  Actualizado con éxito.
                </div>
              )}

              <div className="flex justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 mt-2">
                <button type="button" onClick={() => setIsCellModalOpen(false)} className="w-1/2 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-lg transition-colors">
                  Cancelar
                </button>
                <button type="submit" className="w-1/2 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-sm">
                  Confirmar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
