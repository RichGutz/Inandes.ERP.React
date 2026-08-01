import React, { useState, useEffect } from 'react';
import { factoringService } from '../../../services/factoringService';
import type { OperacionFactoring } from '../../../services/factoringService';
import { 
  Send, 
  Search, 
  FileCheck2, 
  Building2, 
  DollarSign, 
  Calendar, 
  AlertCircle,
  Loader2,
  UploadCloud,
  CreditCard
} from 'lucide-react';

export const DesembolsosTab: React.FC = () => {
  const [operaciones, setOperaciones] = useState<OperacionFactoring[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedOp, setSelectedOp] = useState<OperacionFactoring | null>(null);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [bancoOrigen, setBancoOrigen] = useState<string>('BCP');
  const [bancoDestino, setBancoDestino] = useState<string>('BBVA');
  const [nroOperacion, setNroOperacion] = useState<string>('');
  const [fechaPago, setFechaPago] = useState<string>(new Date().toISOString().split('T')[0]);
  const [processing, setProcessing] = useState<boolean>(false);

  const fetchOperaciones = async () => {
    try {
      setLoading(true);
      const data = await factoringService.getOperaciones('APROBADO');
      setOperaciones(data);
    } catch (err) {
      console.error('Error al cargar operaciones aprobadas:', err);
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
    .reduce((sum, op) => sum + op.abono_real_total, 0);

  const totalUsd = filteredOps
    .filter(op => op.moneda === 'USD')
    .reduce((sum, op) => sum + op.abono_real_total, 0);

  const handleOpenDesembolso = (op: OperacionFactoring) => {
    setSelectedOp(op);
    setNroOperacion('');
    setShowModal(true);
  };

  const handleConfirmDesembolso = async () => {
    if (!selectedOp || !nroOperacion.trim()) return;
    try {
      setProcessing(true);
      const API_BASE = import.meta.env.VITE_API_FACTORING_URL || 'https://inandes.react.geeksoft.tech';

      // 1. Llamar al backend FastAPI que registra en desembolsos_resumen + desembolso_eventos
      const fechaFormateada = new Date(fechaPago).toLocaleDateString('es-PE', {
        day: '2-digit', month: '2-digit', year: 'numeric'
      }).replace(/\//g, '-');

      const res = await fetch(`${API_BASE}/desembolsar_lote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usuario_id: 'react-user',
          desembolsos: [{
            proposal_id: selectedOp.proposal_id,
            monto_desembolsado: selectedOp.abono_real_total,
            fecha_desembolso_real: fechaFormateada,
          }]
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Error en el servidor al desembolsar');
      }

      // 2. Actualizar estado local en factoring_operaciones (Supabase)
      await factoringService.cambiarEstadoOperacion(selectedOp.id || '', 'DESEMBOLSADO', {
        banco_origen: bancoOrigen,
        banco_destino: bancoDestino,
        nro_operacion_bancaria: nroOperacion,
        fecha_desembolso_real: fechaPago
      });
      setShowModal(false);
      setSelectedOp(null);
      await fetchOperaciones();
    } catch (err: any) {
      alert(`Error al registrar el desembolso: ${err.message}`);
    } finally {
      setProcessing(false);
    }
  };

  const handlePrintCartaDescuento = (op: OperacionFactoring) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Por favor habilita las ventanas emergentes para imprimir la Carta de Autorización.');
      return;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Carta de Descuento - ${op.proposal_id}</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; color: #0f172a; line-height: 1.6; }
            .header { display: flex; justify-content: space-between; border-bottom: 2px solid #16a34a; padding-bottom: 15px; margin-bottom: 30px; }
            .title { font-size: 18px; font-weight: bold; color: #15803d; }
            .section-title { font-size: 13px; font-weight: bold; background: #f0fdf4; padding: 6px 12px; border-left: 4px solid #16a34a; margin-top: 20px; margin-bottom: 10px; }
            .table-box { width: 100%; border-collapse: collapse; margin-top: 10px; }
            .table-box th, .table-box td { border: 1px solid #cbd5e1; padding: 8px 12px; text-align: left; font-size: 12px; }
            .table-box th { background: #f8fafc; }
            .signatures { margin-top: 60px; display: flex; justify-content: space-between; text-align: center; font-size: 11px; }
            .sig-line { width: 220px; border-top: 1px solid #64748b; padding-top: 5px; margin-top: 50px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="title">AUTORIZACIÓN DE DESEMBOLSO DE TESORERÍA</div>
              <div style="font-size: 12px; color: #64748b;">Operación N°: <b>${op.proposal_id}</b></div>
            </div>
            <div style="text-align: right; font-size: 11px; color: #64748b;">
              Fecha: ${new Date().toLocaleDateString('es-PE')}<br/>
              Estado: <b>APROBADO PARA PAGO</b>
            </div>
          </div>

          <p style="font-size: 12px;">Por medio de la presente se autoriza a la Gerencia de Tesorería a realizar la transferencia de fondos por concepto de operación de Factoring según el siguiente detalle:</p>

          <div class="section-title">1. BENEFICIARIO (CEDENTE)</div>
          <table class="table-box">
            <tr>
              <td width="30%"><b>Razón Social:</b></td>
              <td>${op.emisor_nombre}</td>
            </tr>
            <tr>
              <td><b>RUC:</b></td>
              <td>${op.emisor_ruc}</td>
            </tr>
          </table>

          <div class="section-title">2. DETALLE DEL MONTO A TRANSFERIR</div>
          <table class="table-box">
            <thead>
              <tr>
                <th>Moneda</th>
                <th>Monto Bruto Factura</th>
                <th>Descuento Interés</th>
                <th>Comisión Estructuración</th>
                <th>Abono Neto Líquido</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><b>${op.moneda}</b></td>
                <td>${op.monto_bruto_total.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</td>
                <td style="color: #dc2626;">-${op.interes_total.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</td>
                <td>-${op.comisiones_fijas.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</td>
                <td style="color: #15803d; font-weight: bold; font-size: 14px;">
                  ${op.moneda === 'USD' ? '$' : 'S/'} ${op.abono_real_total.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                </td>
              </tr>
            </tbody>
          </table>

          <div class="signatures">
            <div>
              <div class="sig-line"><b>Gerencia de Operaciones</b><br/>VoBo Factoring</div>
            </div>
            <div>
              <div class="sig-line"><b>Tesorería / Caja</b><br/>Firma de Ejecución</div>
            </div>
          </div>

          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">Aprobadas por Desembolsar</span>
            <span className="text-2xl font-black text-slate-900 dark:text-white">{filteredOps.length}</span>
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 block mt-1 font-medium">Listas para Pago en Tesorería</span>
          </div>
          <div className="h-12 w-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 flex items-center justify-center text-emerald-600">
            <Send size={24} />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">Total a Desembolsar (PEN)</span>
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
              S/ {totalPen.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-[11px] text-slate-400 block mt-1">Soles Peruanos</span>
          </div>
          <div className="h-12 w-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 flex items-center justify-center text-emerald-600">
            <DollarSign size={24} />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">Total a Desembolsar (USD)</span>
            <span className="text-2xl font-black text-blue-600 dark:text-blue-400">
              $ {totalUsd.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-[11px] text-slate-400 block mt-1">Dólares Americanos</span>
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
            <CreditCard className="h-5 w-5 text-emerald-600" />
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider">
              Bandeja de Desembolsos de Tesorería
            </h3>
          </div>
          
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input 
              type="text"
              placeholder="Buscar RUC, Cedente o N° Operación..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-slate-800 dark:text-slate-200"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center gap-3 text-slate-400">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
            <span className="text-xs font-medium">Cargando operaciones aprobadas...</span>
          </div>
        ) : filteredOps.length === 0 ? (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
            <AlertCircle className="h-8 w-8 text-slate-300" />
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">No hay operaciones aprobadas pendientes de pago.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Operación</th>
                  <th className="py-3 px-4">Cedente (Titular Pago)</th>
                  <th className="py-3 px-4">Pagador</th>
                  <th className="py-3 px-4 text-right">Abono Neto a Pagar</th>
                  <th className="py-3 px-4 text-center">Fecha Estimada</th>
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
                      <span className="font-semibold text-slate-800 dark:text-slate-200 block truncate" title={op.emisor_nombre}>
                        {op.emisor_nombre}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">RUC: {op.emisor_ruc}</span>
                    </td>
                    <td className="py-3 px-4 max-w-[200px]">
                      <span className="font-semibold text-slate-800 dark:text-slate-200 block truncate" title={op.aceptante_nombre}>
                        {op.aceptante_nombre}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">RUC: {op.aceptante_ruc}</span>
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                      {op.moneda === 'USD' ? '$' : 'S/'} {op.abono_real_total.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        <Calendar size={12} className="text-slate-400" />
                        {op.fecha_desembolso_esperada || 'Hoy'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-2">
                        <button 
                          onClick={() => handlePrintCartaDescuento(op)}
                          title="Ver Autorización de Pago"
                          className="p-1.5 text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                        >
                          <FileCheck2 size={16} />
                        </button>

                        <button 
                          onClick={() => handleOpenDesembolso(op)}
                          className="px-3 py-1 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded shadow-xs flex items-center gap-1.5 transition-colors"
                        >
                          <Send size={13} />
                          Ejecutar Pago
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payment Execution Modal */}
      {showModal && selectedOp && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-xl animate-fadeIn">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                <CreditCard size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Registrar Pago a Cedente</h3>
                <p className="text-xs text-slate-500">Operación: <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{selectedOp.proposal_id}</span></p>
              </div>
            </div>

            <div className="p-3.5 bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 rounded-xl space-y-1 mb-4 text-xs">
              <div className="text-slate-500">Beneficiario:</div>
              <div className="font-bold text-slate-900 dark:text-white">{selectedOp.emisor_nombre}</div>
              <div className="flex justify-between items-center pt-2">
                <span className="text-slate-500">Monto Líquido a Transferir:</span>
                <span className="font-black text-emerald-700 dark:text-emerald-400 text-base">
                  {selectedOp.moneda === 'USD' ? '$' : 'S/'} {selectedOp.abono_real_total.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div className="space-y-3 mb-6">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">Banco Origen (InAndes)</label>
                  <select
                    value={bancoOrigen}
                    onChange={(e) => setBancoOrigen(e.target.value)}
                    className="w-full p-2 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  >
                    <option value="BCP">BCP (Soles/Dólares)</option>
                    <option value="BBVA">BBVA Continental</option>
                    <option value="INTERBANK">Interbank</option>
                    <option value="SCOTIABANK">Scotiabank</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">Banco Destino Cedente</label>
                  <select
                    value={bancoDestino}
                    onChange={(e) => setBancoDestino(e.target.value)}
                    className="w-full p-2 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  >
                    <option value="BBVA">BBVA Continental</option>
                    <option value="BCP">BCP</option>
                    <option value="INTERBANK">Interbank</option>
                    <option value="SCOTIABANK">Scotiabank</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">N° Operación Bancaria / Voucher</label>
                <input
                  type="text"
                  placeholder="Ej: 004829102938"
                  value={nroOperacion}
                  onChange={(e) => setNroOperacion(e.target.value)}
                  className="w-full p-2 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-mono"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">Fecha de Transferencia</label>
                <input
                  type="date"
                  value={fechaPago}
                  onChange={(e) => setFechaPago(e.target.value)}
                  className="w-full p-2 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <div className="p-3 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl text-center flex flex-col items-center justify-center gap-1 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                <UploadCloud className="h-5 w-5 text-slate-400" />
                <span className="text-[11px] text-slate-500">Adjuntar Constancia Voucher (PDF / JPG)</span>
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
                onClick={handleConfirmDesembolso}
                disabled={processing || !nroOperacion.trim()}
                className="px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-xs flex items-center gap-2 disabled:opacity-50 transition-colors"
              >
                {processing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Confirmar Desembolso
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
