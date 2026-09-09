// src/features/herramientas/DeviceVaultPage.tsx
import React, { useState, useEffect } from 'react';
import { AuditService, type AuthorizedDevice } from '../../services/auditService';
import { 
  Laptop, 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  Shield, 
  AlertTriangle, 
  Search, 
  Info
} from 'lucide-react';

interface DeviceVaultPageProps {
  currentUserEmail?: string;
}

export const DeviceVaultPage: React.FC<DeviceVaultPageProps> = ({ currentUserEmail = 'admin@inandes.pe' }) => {
  const [devices, setDevices] = useState<AuthorizedDevice[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'APPROVED' | 'PENDING' | 'REVOKED'>('ALL');
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');

  const loadDevices = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await AuditService.getDevices();
      setDevices(data);
    } catch (err: any) {
      setError('Error al conectar con la bóveda de dispositivos.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDevices();
  }, []);

  const handleApproveDevice = async (deviceId: string) => {
    setActionLoading(deviceId);
    setError('');
    setSuccess('');
    try {
      await AuditService.approveDevice(deviceId, currentUserEmail);
      setSuccess('Dispositivo autorizado con éxito.');
      await loadDevices();
    } catch (err: any) {
      setError('Error al autorizar dispositivo.');
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRevokeDevice = async (deviceId: string) => {
    if (!confirm('¿Está seguro de revocar el acceso a este equipo físico?')) return;
    setActionLoading(deviceId);
    setError('');
    setSuccess('');
    try {
      await AuditService.revokeDevice(deviceId, currentUserEmail);
      setSuccess('Acceso del dispositivo revocado.');
      await loadDevices();
    } catch (err: any) {
      setError('Error al revocar dispositivo.');
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  const filteredDevices = devices.filter(dev => {
    const matchesStatus = statusFilter === 'ALL' || dev.status === statusFilter;
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = !searchTerm || 
      dev.user_email.toLowerCase().includes(searchLower) ||
      (dev.device_name && dev.device_name.toLowerCase().includes(searchLower)) ||
      dev.device_fingerprint.toLowerCase().includes(searchLower) ||
      (dev.ip_address && dev.ip_address.includes(searchLower));

    return matchesStatus && matchesSearch;
  });

  const countApproved = devices.filter(d => d.status === 'APPROVED').length;
  const countPending = devices.filter(d => d.status === 'PENDING').length;
  const countRevoked = devices.filter(d => d.status === 'REVOKED').length;

  return (
    <div className="flex-1 flex flex-col max-w-full w-full gap-6 animate-fadeIn">
      
      {/* Header Informativo */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-white dark:bg-[#111827] p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-600 dark:text-emerald-400">
            <Shield size={24} />
          </div>
          <div>
            <h2 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight">
              Bóveda de Dispositivos Autorizados (Device Vault)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Control Zero-Trust de hardware físico y firmas digitales autorizadas para operar en InAndes ERP
            </p>
          </div>
        </div>

        <button
          onClick={loadDevices}
          disabled={loading}
          className="px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-xs"
          title="Actualizar Dispositivos"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          <span>Actualizar</span>
        </button>
      </div>

      {/* Banner Informativo */}
      <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl flex items-start gap-3">
        <Info size={16} className="text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
        <div className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          <span className="font-bold text-slate-900 dark:text-white">Blindaje de Acceso Físico (Hardware Fingerprinting): </span>
          Cada estación de trabajo extrae una huella digital determinística basada en GPU, CPU y entorno de navegador. Los dispositivos no autorizados requieren aprobación manual de un Administrador Global.
        </div>
      </div>

      {/* Alertas */}
      {error && (
        <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 p-3.5 rounded-xl text-rose-700 dark:text-rose-400 text-xs flex items-center gap-2">
          <AlertTriangle size={15} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 p-3.5 rounded-xl text-emerald-700 dark:text-emerald-400 text-xs flex items-center gap-2">
          <CheckCircle2 size={15} className="shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Métricas de Dispositivos */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div 
          onClick={() => setStatusFilter('ALL')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            statusFilter === 'ALL'
              ? 'bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-700 shadow-xs'
              : 'bg-white dark:bg-[#111827] border-slate-200 dark:border-slate-800 hover:border-slate-300'
          }`}
        >
          <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Equipos</div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">{devices.length}</div>
        </div>

        <div 
          onClick={() => setStatusFilter('APPROVED')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            statusFilter === 'APPROVED'
              ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 shadow-xs'
              : 'bg-white dark:bg-[#111827] border-slate-200 dark:border-slate-800 hover:border-slate-300'
          }`}
        >
          <div className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Autorizados</div>
          <div className="text-2xl font-black text-emerald-700 dark:text-emerald-400 mt-1">{countApproved}</div>
        </div>

        <div 
          onClick={() => setStatusFilter('PENDING')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            statusFilter === 'PENDING'
              ? 'bg-amber-50/80 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700 shadow-xs'
              : 'bg-white dark:bg-[#111827] border-slate-200 dark:border-slate-800 hover:border-slate-300'
          }`}
        >
          <div className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Pendientes</div>
          <div className="text-2xl font-black text-amber-700 dark:text-amber-400 mt-1">{countPending}</div>
        </div>

        <div 
          onClick={() => setStatusFilter('REVOKED')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            statusFilter === 'REVOKED'
              ? 'bg-rose-50/80 dark:bg-rose-950/40 border-rose-300 dark:border-rose-700 shadow-xs'
              : 'bg-white dark:bg-[#111827] border-slate-200 dark:border-slate-800 hover:border-slate-300'
          }`}
        >
          <div className="text-[11px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">Revocados</div>
          <div className="text-2xl font-black text-rose-700 dark:text-rose-400 mt-1">{countRevoked}</div>
        </div>
      </div>

      {/* Buscador */}
      <div className="relative bg-white dark:bg-[#111827] p-3 rounded-2xl border border-slate-200 dark:border-slate-800">
        <Search size={14} className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Filtrar por correo de usuario, nombre de equipo, IP o huella digital..."
          className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none"
        />
      </div>

      {/* Tabla de Dispositivos */}
      <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">
                <th className="py-3 px-4">Usuario</th>
                <th className="py-3 px-4">Nombre del Equipo</th>
                <th className="py-3 px-4">Huella Hardware (Fingerprint)</th>
                <th className="py-3 px-4">IP &amp; Último Acceso</th>
                <th className="py-3 px-4 text-center">Estado</th>
                <th className="py-3 px-4 text-center">Aprobado Por</th>
                <th className="py-3 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw size={24} className="animate-spin text-emerald-500" />
                      <span className="font-bold">Consultando Bóveda de Dispositivos...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredDevices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Laptop size={28} className="text-slate-300 dark:text-slate-600" />
                      <span className="font-bold text-slate-700 dark:text-slate-300">No se encontraron dispositivos</span>
                      <span className="text-[11px] text-slate-400">Los nuevos equipos aparecerán aquí automáticamente al iniciar sesión.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredDevices.map((dev) => (
                  <tr key={dev.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                      {dev.user_email}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <Laptop size={14} className="text-slate-400 shrink-0" />
                        <span className="font-semibold text-slate-700 dark:text-slate-200">{dev.device_name || 'Estación de Trabajo'}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-mono text-[10.5px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                        {dev.device_fingerprint}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                      <div className="font-semibold text-slate-700 dark:text-slate-300">{dev.ip_address || '127.0.0.1'}</div>
                      <div className="text-[10px] text-slate-400 font-sans">
                        {dev.last_access_at ? new Date(dev.last_access_at).toLocaleString() : 'Sin accesos recientes'}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {dev.status === 'APPROVED' && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800">
                          <CheckCircle2 size={11} className="text-emerald-600 dark:text-emerald-400" /> Autorizado
                        </span>
                      )}
                      {dev.status === 'PENDING' && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 px-2.5 py-1 rounded-full border border-amber-200 dark:border-amber-800 animate-pulse">
                          <AlertTriangle size={11} className="text-amber-600 dark:text-amber-400" /> Pendiente
                        </span>
                      )}
                      {dev.status === 'REVOKED' && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 px-2.5 py-1 rounded-full border border-rose-200 dark:border-rose-800">
                          <XCircle size={11} className="text-rose-600 dark:text-rose-400" /> Revocado
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center text-slate-500 text-[11px]">
                      {dev.approved_by ? (
                        <div>
                          <span className="font-bold text-slate-700 dark:text-slate-300">{dev.approved_by}</span>
                          <div className="text-[10px] text-slate-400">
                            {dev.approved_at ? new Date(dev.approved_at).toLocaleDateString() : ''}
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {dev.status !== 'APPROVED' && (
                          <button
                            onClick={() => handleApproveDevice(dev.id)}
                            disabled={actionLoading === dev.id}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50 shadow-2xs"
                            title="Autorizar este dispositivo"
                          >
                            <CheckCircle2 size={12} />
                            <span>Autorizar</span>
                          </button>
                        )}
                        {dev.status !== 'REVOKED' && (
                          <button
                            onClick={() => handleRevokeDevice(dev.id)}
                            disabled={actionLoading === dev.id}
                            className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 rounded-lg text-xs font-bold transition-all flex items-center gap-1 border border-rose-200 dark:border-rose-800 cursor-pointer disabled:opacity-50"
                            title="Revocar acceso de este dispositivo"
                          >
                            <XCircle size={12} />
                            <span>Revocar</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
