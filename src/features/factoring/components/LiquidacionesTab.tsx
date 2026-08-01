import React, { useState, useEffect } from 'react';
import { factoringService } from '../../../services/factoringService';
import type { OperacionFactoring } from '../../../services/factoringService';
import { 
  CheckCircle, 
  Search, 
  Building2, 
  DollarSign, 
  AlertTriangle,
  Loader2,
  Calendar,
  WalletCards
} from 'lucide-react';

export const LiquidacionesTab: React.FC = () => {
  const [operaciones, setOperaciones] = useState<OperacionFactoring[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedOp, setSelectedOp] = useState<OperacionFactoring | null>(null);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [diasAtraso, setDiasAtraso] = useState<number>(0);
  const [interesMora, setInteresMora] = useState<number>(0);
  const [fechaCobro, setFechaCobro] = useState<string>(new Date().toISOString().split('T')[0]);
  const [processing, setProcessing] = useState<boolean>(false);

  const fetchOperaciones = async () => {
    try {
      setLoading(true);
      const data = await factoringService.getOperaciones('DESEMBOLSADO');
      setOperaciones(data);
    } catch (err) {
      console.error('Error al cargar operaciones desembolsadas:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOperaciones();
  }, []);

  const filteredOps = operaciones.filter(op => 
    op.proposal_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    op.emisor_nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    op.emisor_ruc.includes(searchTerm) ||
    op.aceptante_nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    op.aceptante_ruc.includes(searchTerm)
  );

  const totalPen = filteredOps
    .filter(op => op.moneda === 'PEN')
    .reduce((sum, op) => sum + op.monto_bruto_total, 0);

  const totalUsd = filteredOps
    .filter(op => op.moneda === 'USD')
    .reduce((sum, op) => sum + op.monto_bruto_total, 0);

  const handleOpenLiquidacion = (op: OperacionFactoring) => {
    setSelectedOp(op);
    setDiasAtraso(0);
    setInteresMora(0);
    setShowModal(true);
  };

  const handleConfirmLiquidacion = async () => {
    if (!selectedOp) return;
    try {
      setProcessing(true);
      const API_BASE = import.meta.env.VITE_API_FACTORING_URL || 'https://inandes.react.geeksoft.tech';

      // Formato de fecha DD-MM-YYYY que espera el backend
      const fechaFormateada = new Date(fechaCobro).toLocaleDateString('es-PE', {
        day: '2-digit', month: '2-digit', year: 'numeric'
      }).replace(/\//g, '-');

      const res = await fetch(`${API_BASE}/liquidaciones/procesar_liquidacion_lote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usuario_id: 'react-user',
          liquidaciones: [{
            proposal_id: selectedOp.proposal_id,
            monto_recibido: selectedOp.monto_neto_total,
            fecha_pago_real: fechaFormateada,
            tasa_interes_compensatoria_pct: 2.5,
            tasa_interes_moratoria_pct: interesMora || 0,
            is_first_payment: true,
          }]
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Error en el servidor al liquidar');
      }

      // Actualizar estado local en Supabase
      await factoringService.cambiarEstadoOperacion(selectedOp.id || '', 'LIQUIDADO', {
        fecha_liquidacion_real: fechaCobro,
        dias_atraso: diasAtraso,
        interes_moratorio_cobrado: interesMora
      });
      setShowModal(false);
      setSelectedOp(null);
      await fetchOperaciones();
    } catch (err: any) {
      alert(`Error al registrar la liquidacion: ${err.message}`);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">Cartera en Cobranza</span>
            <span className="text-2xl font-black text-slate-900 dark:text-white">{filteredOps.length}</span>
            <span className="text-[11px] text-blue-600 dark:text-blue-400 block mt-1 font-medium">Facturas por Recaudar de Deudores</span>
          </div>
          <div className="h-12 w-12 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 flex items-center justify-center text-blue-600">
            <WalletCards size={24} />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">Total a Recaudar (PEN)</span>
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
              S/ {totalPen.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-[11px] text-slate-400 block mt-1">Valor Bruto Facturas</span>
          </div>
          <div className="h-12 w-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 flex items-center justify-center text-emerald-600">
            <DollarSign size={24} />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">Total a Recaudar (USD)</span>
            <span className="text-2xl font-black text-blue-600 dark:text-blue-400">
              $ {totalUsd.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-[11px] text-slate-400 block mt-1">Moneda Extranjera</span>
          </div>
          <div className="h-12 w-12 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 flex items-center justify-center text-blue-600">
            <Building2 size={24} />
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-blue-600" />
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider">
              Bandeja de Liquidación & Recaudación (Cobranzas)
            </h3>
          </div>
          
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input 
              type="text"
              placeholder="Buscar RUC, Empresa o N° Operación..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-800 dark:text-slate-200"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center gap-3 text-slate-400">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <span className="text-xs font-medium">Cargando cartera en cobranza...</span>
          </div>
        ) : filteredOps.length === 0 ? (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
            <AlertTriangle className="h-8 w-8 text-slate-300" />
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">No hay facturas pendientes de cobro en esta bandeja.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Operación</th>
                  <th className="py-3 px-4">Deudor (Aceptante)</th>
                  <th className="py-3 px-4">Cedente (Emisor)</th>
                  <th className="py-3 px-4 text-right">Monto Bruto a Recaudar</th>
                  <th className="py-3 px-4 text-center">Días Financiamiento</th>
                  <th className="py-3 px-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                {filteredOps.map((op) => (
                  <tr key={op.id || op.proposal_id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-slate-100">
                      {op.proposal_id}
                    </td>
                    <td className="py-3 px-4 max-w-[200px]">
                      <span className="font-semibold text-slate-800 dark:text-slate-200 block truncate" title={op.aceptante_nombre}>
                        {op.aceptante_nombre}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">RUC: {op.aceptante_ruc}</span>
                    </td>
                    <td className="py-3 px-4 max-w-[200px]">
                      <span className="font-semibold text-slate-800 dark:text-slate-200 block truncate" title={op.emisor_nombre}>
                        {op.emisor_nombre}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">RUC: {op.emisor_ruc}</span>
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900 dark:text-white text-sm">
                      {op.moneda === 'USD' ? '$' : 'S/'} {op.monto_bruto_total.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        <Calendar size={12} className="text-slate-400" />
                        {op.dias_promedio} días
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button 
                        onClick={() => handleOpenLiquidacion(op)}
                        className="px-3 py-1 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded shadow-xs flex items-center gap-1.5 transition-colors mx-auto"
                      >
                        <CheckCircle size={13} />
                        Liquidar Cobro
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Liquidation Modal */}
      {showModal && selectedOp && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-xl animate-fadeIn">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                <CheckCircle size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Registrar Recaudación / Liquidación</h3>
                <p className="text-xs text-slate-500">Operación: <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{selectedOp.proposal_id}</span></p>
              </div>
            </div>

            <div className="p-3.5 bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 rounded-xl space-y-1 mb-4 text-xs">
              <div className="text-slate-500">Deudor (Aceptante):</div>
              <div className="font-bold text-slate-900 dark:text-white">{selectedOp.aceptante_nombre}</div>
              <div className="flex justify-between items-center pt-2">
                <span className="text-slate-500">Monto Bruto Factura:</span>
                <span className="font-black text-blue-700 dark:text-blue-400 text-base">
                  {selectedOp.moneda === 'USD' ? '$' : 'S/'} {selectedOp.monto_bruto_total.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div className="space-y-3 mb-6">
              <div>
                <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">Fecha de Recepción de Fondos</label>
                <input
                  type="date"
                  value={fechaCobro}
                  onChange={(e) => setFechaCobro(e.target.value)}
                  className="w-full p-2 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">Días de Atraso (Mora)</label>
                  <input
                    type="number"
                    min="0"
                    value={diasAtraso}
                    onChange={(e) => setDiasAtraso(Number(e.target.value))}
                    className="w-full p-2 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">Interés Moratorio (S/ o $)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={interesMora}
                    onChange={(e) => setInteresMora(Number(e.target.value))}
                    className="w-full p-2 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setShowModal(false)}
                disabled={processing}
                className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmLiquidacion}
                disabled={processing}
                className="px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-xs flex items-center gap-2 disabled:opacity-50 transition-colors"
              >
                {processing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Confirmar Liquidación Final
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
