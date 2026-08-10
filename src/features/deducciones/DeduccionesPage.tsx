// src/features/deducciones/DeduccionesPage.tsx
import React, { useEffect, useState } from 'react';
import { 
  buscarContratosPadre, getActiveCertificadoByContrato, getFondoRules, getCronogramaDeducciones, insertCronogramaDeducciones
} from '../../services/deduccionesService';
import type { DeduccionCuota, ContratoBusqueda, FondoRules } from '../../services/deduccionesService';
import { 
  Search, Loader2, CheckCircle
} from 'lucide-react';

export const DeduccionesPage: React.FC = () => {
  // Buscador
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [searchLoading, setSearchLoading] = useState<boolean>(false);
  const [searchResults, setSearchResults] = useState<ContratoBusqueda[]>([]);
  const [selectedContrato, setSelectedContrato] = useState<ContratoBusqueda | null>(null);

  // Datos del contrato y certificado activo
  const [activeCertId, setActiveCertId] = useState<string>('');
  const [fondoRules, setFondoRules] = useState<FondoRules>({});
  const [cronograma, setCronograma] = useState<DeduccionCuota[]>([]);
  const [cronoLoading, setCronoLoading] = useState<boolean>(false);

  // Pestañas internas
  const [activeSubTab, setActiveSubTab] = useState<'cronograma' | 'deduccion' | 'rescate'>('cronograma');

  // Fechas de corte disponibles (fín de mes alineado)
  const [validDates, setValidDates] = useState<Date[]>([]);

  // ==========================================
  // --- FORMULARIO PROGRAMAR DEDUCCIÓN -------
  // ==========================================
  const [dedGlosa, setDedGlosa] = useState<string>('');
  const [dedMode, setDedMode] = useState<'fijo' | 'multiple'>('fijo');
  const [dedFijoMonto, setDedFijoMonto] = useState<number>(100);
  const [dedFijoFechaCorte, setDedFijoFechaCorte] = useState<string>('');
  const [dedFijoPeriodos, setDedFijoPeriodos] = useState<number>(1);
  const [dedMultiCuotas, setDedMultiCuotas] = useState<number>(3);
  const [dedMultiFechaInicio, setDedMultiFechaInicio] = useState<string>('');
  const [dedMultiMontos, setDedMultiMontos] = useState<Record<number, number>>({});
  const [dedPrioridad, setDedPrioridad] = useState<number>(2);
  const [dedSubmitting, setDedSubmitting] = useState<boolean>(false);
  const [dedSuccess, setDedSuccess] = useState<string | null>(null);
  const [dedError, setDedError] = useState<string | null>(null);

  // ==========================================
  // --- FORMULARIO PROGRAMAR RESCATE ---------
  // ==========================================
  const [resGlosa, setResGlosa] = useState<string>('Devolución de Capital Principal por Retiro');
  const [resArmadasCount, setResArmadasCount] = useState<number>(1);
  const [resTasaWaiver, setResTasaWaiver] = useState<number>(0);
  const [resArmadasData, setResArmadasData] = useState<Array<{ fecha: string; monto: number; penalidad: number }>>([]);
  const [resSubmitting, setResSubmitting] = useState<boolean>(false);
  const [resSuccess, setResSuccess] = useState<string | null>(null);
  const [resError, setResError] = useState<string | null>(null);

  // Helpers de calendario
  const getValidEndOfMonthDates = (frecuenciaPago: number, startYear: number = 2026, limitYears: number = 5): Date[] => {
    const dates: Date[] = [];
    const mesesCorte = frecuenciaPago === 3 ? [3, 6, 9, 12] : [2, 4, 6, 8, 10, 12];
    for (let y = startYear; y < startYear + limitYears; y++) {
      for (const m of mesesCorte) {
        const d = new Date(y, m, 0); // día 0 del siguiente mes es el último del anterior
        dates.push(d);
      }
    }
    return dates;
  };

  const addMonthsEndOfMonth = (origDate: Date, months: number): Date => {
    // Meses en JS son 0-indexed
    const year = origDate.getFullYear();
    const month = origDate.getMonth() + months;
    const result = new Date(year, month + 1, 0); // día 0 del siguiente mes es el último del actual
    return result;
  };

  // Buscar contrato
  const handleBuscarContrato = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;
    setSearchLoading(true);
    setSelectedContrato(null);
    setSearchResults([]);
    try {
      const res = await buscarContratosPadre(searchTerm);
      setSearchResults(res);
      if (res.length === 1) {
        setSelectedContrato(res[0]);
      }
    } catch (err) {
      console.error(err);
      alert('Error en la búsqueda de contrato.');
    } finally {
      setSearchLoading(false);
    }
  };

  // Cargar datos al seleccionar contrato
  useEffect(() => {
    if (selectedContrato) {
      loadContratoData(selectedContrato);
    } else {
      setActiveCertId('');
      setFondoRules({});
      setCronograma([]);
      setValidDates([]);
    }
  }, [selectedContrato]);

  const loadContratoData = async (c: ContratoBusqueda) => {
    setCronoLoading(true);
    try {
      // 1. Obtener certificado activo
      const certId = await getActiveCertificadoByContrato(c.id_contrato);
      setActiveCertId(certId);

      // 2. Reglas del fondo
      const { rules, tasaMinima } = await getFondoRules(c.id_fondo);
      setFondoRules(rules);
      setResTasaWaiver(tasaMinima);

      // 3. Fechas de corte validas
      const fPago = c.frecuencia_cupones_meses || 2;
      const dates = getValidEndOfMonthDates(fPago);
      setValidDates(dates);
      
      if (dates.length > 0) {
        const firstDateStr = dates[0].toISOString().split('T')[0];
        setDedFijoFechaCorte(firstDateStr);
        setDedMultiFechaInicio(firstDateStr);
      }

      // 4. Cargar cronograma
      const crono = await getCronogramaDeducciones(certId);
      setCronograma(crono);
    } catch (err) {
      console.error(err);
    } finally {
      setCronoLoading(false);
    }
  };

  // Reactivo para armadas de Deducciones Múltiples
  useEffect(() => {
    if (validDates.length > 0 && dedMultiFechaInicio) {
      const initialMontos: Record<number, number> = {};
      for (let i = 0; i < dedMultiCuotas; i++) {
        initialMontos[i] = 100;
      }
      setDedMultiMontos(initialMontos);
    }
  }, [dedMultiCuotas, dedMultiFechaInicio, validDates]);

  // Reactivo para armadas de Rescates
  useEffect(() => {
    if (validDates.length > 0) {
      const newArmadas = [];
      const penaltyPct = fondoRules.penalidad_rescate || 0;

      for (let i = 0; i < resArmadasCount; i++) {
        const matchDate = validDates[i] || validDates[0];
        const dateStr = matchDate.toISOString().split('T')[0];
        const monto = 1000;
        const penalidad = monto * (penaltyPct / 100);

        newArmadas.push({
          fecha: dateStr,
          monto,
          penalidad
        });
      }
      setResArmadasData(newArmadas);
    }
  }, [resArmadasCount, validDates, fondoRules, selectedContrato]);

  // Llaves naturales
  const generateNaturalKeys = (
    prefijo: string,
    idCertificado: string,
    fOrigenDate: Date,
    fEfectivaDate: Date,
    indexCargo: number,
    totalCargos: number
  ) => {
    const parts = idCertificado.split('.');
    const certBase = parts[0] || idCertificado;
    const fInicio = parts[1] || 'NOINI';

    const fOrigenStr = fOrigenDate.toISOString().split('T')[0].replaceAll('-', '').substring(2);
    const fEfectivaStr = fEfectivaDate.toISOString().split('T')[0].replaceAll('-', '').substring(2);

    const agrupador = `${prefijo}-${certBase}.${fInicio}.${fOrigenStr}`;
    const cuotaId = `${agrupador}.${fEfectivaStr}-C.${indexCargo}/${totalCargos}`;
    return { agrupador, cuotaId };
  };

  // ==========================================
  // --- SUBMIT DEDUCCIÓN ---------------------
  // ==========================================
  const handlePlanDeduccion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContrato || !activeCertId) return;

    if (!dedGlosa.trim()) {
      setDedError('Debe ingresar una glosa o descripción.');
      return;
    }

    setDedSubmitting(true);
    setDedError(null);
    setDedSuccess(null);

    try {
      const listCargos: Array<{ fecha: Date; monto: number }> = [];
      const fPago = selectedContrato.frecuencia_cupones_meses || 2;
      const step = fPago === 3 ? 3 : 2;

      if (dedMode === 'fijo') {
        const baseD = new Date(dedFijoFechaCorte + 'T00:00:00');
        let currentD = baseD;
        for (let i = 0; i < dedFijoPeriodos; i++) {
          listCargos.push({
            fecha: currentD,
            monto: dedFijoMonto
          });
          currentD = addMonthsEndOfMonth(currentD, step);
        }
      } else {
        const baseD = new Date(dedMultiFechaInicio + 'T00:00:00');
        let currentD = baseD;
        for (let i = 0; i < dedMultiCuotas; i++) {
          const val = dedMultiMontos[i] ?? 100;
          if (val > 0) {
            listCargos.push({
              fecha: currentD,
              monto: val
            });
          }
          currentD = addMonthsEndOfMonth(currentD, step);
        }
      }

      const totalCargos = listCargos.length;
      if (totalCargos === 0) {
        throw new Error('No se han configurado cuotas con monto mayor a 0.');
      }

      const hoy = new Date();
      const payload: DeduccionCuota[] = listCargos.map((cargo, idx) => {
        const { agrupador, cuotaId } = generateNaturalKeys(
          'DED',
          activeCertId,
          hoy,
          cargo.fecha,
          idx + 1,
          totalCargos
        );

        return {
          id_cuota: cuotaId,
          id_agrupador: agrupador,
          id_certificado: activeCertId,
          id_contrato: selectedContrato.id_contrato,
          tipo_cargo: 'DEDUCCION_ORDINARIA',
          glosa_descripcion: `${dedGlosa} (Cuota ${idx + 1}/${totalCargos})`,
          moneda: selectedContrato.moneda,
          monto_cobrar: cargo.monto,
          fecha_proyectada_cobro: cargo.fecha.toISOString().split('T')[0],
          estado: 'PENDIENTE',
          prioridad: Number(dedPrioridad),
          creado_por: 'Sistema React'
        };
      });

      await insertCronogramaDeducciones(payload);
      setDedSuccess(`Deducciones programadas con éxito. Agrupador ID: ${payload[0].id_agrupador}`);
      setDedGlosa('');
      
      // Recargar
      const crono = await getCronogramaDeducciones(activeCertId);
      setCronograma(crono);
    } catch (err: any) {
      setDedError(err.message || 'Error al programar deducciones.');
    } finally {
      setDedSubmitting(false);
    }
  };

  // ==========================================
  // --- SUBMIT RESCATE -----------------------
  // ==========================================
  const handlePlanRescate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContrato || !activeCertId) return;

    if (!resGlosa.trim()) {
      setResError('Debe ingresar una glosa de rescate.');
      return;
    }

    setResSubmitting(true);
    setResError(null);
    setResSuccess(null);

    try {
      const hoy = new Date();
      const totalArm = resArmadasData.length;
      const todo: DeduccionCuota[] = [];

      resArmadasData.forEach((arm, idx) => {
        const targetDate = new Date(arm.fecha + 'T00:00:00');
        
        // 1. Cargo del Rescate Capital
        const { agrupador: agrRes, cuotaId: cuotaRes } = generateNaturalKeys(
          'RES',
          activeCertId,
          hoy,
          targetDate,
          idx + 1,
          totalArm
        );

        todo.push({
          id_cuota: cuotaRes,
          id_agrupador: agrRes,
          id_certificado: activeCertId,
          id_contrato: selectedContrato.id_contrato,
          tipo_cargo: 'RESCATE_CAPITAL',
          glosa_descripcion: `${resGlosa} (Armada ${idx + 1}/${totalArm})`,
          moneda: selectedContrato.moneda,
          monto_cobrar: arm.monto,
          fecha_proyectada_cobro: arm.fecha,
          estado: 'PENDIENTE',
          prioridad: 3,
          tasa: resTasaWaiver,
          creado_por: 'Sistema React'
        });

        // 2. Cargo de Penalidad asociada (si existe)
        if (arm.penalidad > 0) {
          const { agrupador: agrPen, cuotaId: cuotaPen } = generateNaturalKeys(
            'PEN.RES',
            activeCertId,
            hoy,
            targetDate,
            idx + 1,
            totalArm
          );

          todo.push({
            id_cuota: cuotaPen,
            id_agrupador: agrPen,
            id_certificado: activeCertId,
            id_contrato: selectedContrato.id_contrato,
            tipo_cargo: 'PENALIDAD_RESCATE',
            glosa_descripcion: `Multa Penitente % x Rescate (Armada ${idx + 1}/${totalArm})`,
            moneda: selectedContrato.moneda,
            monto_cobrar: arm.penalidad,
            fecha_proyectada_cobro: arm.fecha,
            estado: 'PENDIENTE',
            prioridad: 1,
            creado_por: 'Sistema React'
          });
        }
      });

      await insertCronogramaDeducciones(todo);
      setResSuccess(`Se crearon ${todo.length} asientos financieros de Rescate (+ Penalidades). Agrupador: ${todo[0].id_agrupador}`);
      
      // Recargar
      const crono = await getCronogramaDeducciones(activeCertId);
      setCronograma(crono);
    } catch (err: any) {
      setResError(err.message || 'Error al programar rescate.');
    } finally {
      setResSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full animate-fadeIn">
      
      {/* Buscador de Contrato */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm flex flex-col gap-4">
        <h3 className="text-xs font-black text-slate-855 dark:text-slate-100 uppercase tracking-tight">🔍 Buscar Contrato Padre</h3>
        <p className="text-[10px] text-slate-450 dark:text-slate-400">Ingrese ID de Contrato, RUC, DNI o Nombre del Inversionista para configurar deducciones.</p>
        
        <form onSubmit={handleBuscarContrato} className="flex gap-3 max-w-xl">
          <input
            type="text"
            className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-lg p-2 text-xs font-semibold focus:outline-none placeholder:text-slate-400"
            placeholder="Ej: NSGPEN... o 12345678 o Gallo"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            required
          />
          <button
            type="submit"
            className="h-9 px-5 bg-blue-650 hover:bg-blue-700 text-white rounded-lg text-xs font-bold cursor-pointer flex items-center gap-1.5 shadow-sm disabled:opacity-50"
            disabled={searchLoading}
          >
            {searchLoading ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
            <span>Buscar Contrato</span>
          </button>
        </form>

        {/* Múltiples Resultados */}
        {searchResults.length > 1 && !selectedContrato && (
          <div className="flex flex-col gap-2 border-t border-slate-100 dark:border-slate-800 pt-3">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Se encontraron {searchResults.length} contratos. Seleccione:</span>
            <div className="flex flex-col gap-1.5 max-h-[140px] overflow-y-auto">
              {searchResults.map(c => (
                <button
                  key={c.id_contrato}
                  type="button"
                  className="w-full text-left p-2 rounded-lg text-xs font-bold border border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-850 cursor-pointer flex justify-between"
                  onClick={() => setSelectedContrato(c)}
                >
                  <span>{c.id_contrato} 👤 {c.nombre_inversionista_temp || c.id_inversionista_1}</span>
                  <span className="text-[9px] text-emerald-650 font-black">{c.moneda} {c.monto_inversion.toLocaleString('es-PE')}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Contrato Seleccionado */}
      {selectedContrato && (
        <div className="flex flex-col gap-6 w-full animate-fadeIn">
          
          {/* Card Resumen de Ficha */}
          <div className="bg-blue-50/50 dark:bg-blue-950/10 border border-blue-100 dark:border-blue-950/20 rounded-xl p-4 flex flex-col md:flex-row justify-between gap-4 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
            <div className="flex flex-col gap-1">
              <span>📜 Contrato: <strong className="text-blue-650 dark:text-blue-400 font-bold">{selectedContrato.id_contrato}</strong></span>
              <span>👤 Inversionista: <strong>{selectedContrato.nombre_inversionista_temp || selectedContrato.id_inversionista_1}</strong></span>
              <span>🏦 Fondo: <strong>{selectedContrato.id_fondo} ({selectedContrato.frecuencia_cupones_meses === 3 ? 'Trimestral' : 'Bimestral'})</strong></span>
            </div>
            <div className="flex flex-col gap-1 md:text-right">
              <span>🎟️ Certificado Activo: <strong className="text-rose-650 dark:text-rose-450 font-bold font-mono">{activeCertId}</strong></span>
              <span>💰 Inversión Original: <strong>{selectedContrato.moneda} {selectedContrato.monto_inversion.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</strong></span>
              <span>📅 Fecha Vencimiento: <strong>{selectedContrato.fecha_fin}</strong></span>
            </div>
          </div>

          {/* Sub Pestañas */}
          <div className="flex gap-4 border-b border-slate-100 dark:border-slate-800 pb-0.5">
            {[
              { id: 'cronograma', label: '📋 Cronograma General (Activo)' },
              { id: 'deduccion', label: '➕ Programar Deducción (DED)' },
              { id: 'rescate', label: '💸 Programar Rescate (RES)' },
            ].map(tab => (
              <button
                key={tab.id}
                className={`py-1.5 text-[10px] font-black uppercase border-b-2 cursor-pointer transition-colors ${
                  activeSubTab === tab.id 
                    ? 'border-blue-650 text-blue-650 dark:text-blue-400' 
                    : 'border-transparent text-slate-450 hover:text-slate-600'
                }`}
                onClick={() => setActiveSubTab(tab.id as any)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* TAB 1: CRONOGRAMA GENERAL */}
          {activeSubTab === 'cronograma' && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm flex flex-col gap-4 animate-fadeIn">
              <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-tight">📋 Cargos Programados y Amortizaciones</h3>
              
              {cronoLoading ? (
                <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
                  <Loader2 className="animate-spin text-blue-650" size={24} />
                </div>
              ) : cronograma.length === 0 ? (
                <div className="py-12 text-center text-[10px] font-bold text-slate-450 uppercase tracking-wider border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                  No hay cronogramas monetarios cargados para este certificado.
                </div>
              ) : (
                <div className="overflow-x-auto w-full border border-slate-150 dark:border-slate-800 rounded-lg">
                  <table className="w-full text-left border-collapse text-[9px] whitespace-nowrap">
                    <thead>
                      <tr className="bg-slate-50/50 dark:bg-slate-850/30 border-b border-slate-200 dark:border-slate-800">
                        <th className="font-bold text-slate-400 dark:text-slate-500 px-4 py-2.5 uppercase">ID Cuota / Asiento</th>
                        <th className="font-bold text-slate-400 dark:text-slate-500 px-4 py-2.5 uppercase">Tipo Cargo</th>
                        <th className="font-bold text-slate-400 dark:text-slate-500 px-4 py-2.5 uppercase">Glosa / Descripción</th>
                        <th className="font-bold text-slate-450 dark:text-slate-500 px-4 py-2.5 uppercase text-center">Moneda</th>
                        <th className="font-bold text-slate-450 dark:text-slate-500 px-4 py-2.5 uppercase text-right">Monto</th>
                        <th className="font-bold text-slate-450 dark:text-slate-500 px-4 py-2.5 uppercase">Corte Cobro</th>
                        <th className="font-bold text-slate-450 dark:text-slate-500 px-4 py-2.5 uppercase">Estado</th>
                        <th className="font-bold text-slate-450 dark:text-slate-500 px-4 py-2.5 uppercase text-center">Prioridad</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cronograma.map(c => (
                        <tr key={c.id_cuota} className="border-b border-slate-100 dark:border-slate-850 hover:bg-slate-50/30">
                          <td className="px-4 py-2 font-mono font-bold text-slate-655 dark:text-slate-350">{c.id_cuota}</td>
                          <td className="px-4 py-2 font-semibold">
                            <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${
                              c.tipo_cargo === 'RESCATE_CAPITAL' 
                                ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/20 dark:text-blue-400' 
                                : c.tipo_cargo === 'PENALIDAD_RESCATE'
                                  ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/20 dark:text-rose-400'
                                  : 'bg-amber-50 text-amber-600 dark:bg-amber-950/20 dark:text-amber-400'
                            }`}>
                              {c.tipo_cargo.replaceAll('_', ' ')}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-slate-700 dark:text-slate-400">{c.glosa_descripcion}</td>
                          <td className="px-4 py-2 text-center text-slate-600 dark:text-slate-455 font-bold">{c.moneda}</td>
                          <td className="px-4 py-2 text-right font-mono font-bold text-slate-755 dark:text-slate-300">{c.monto_cobrar.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</td>
                          <td className="px-4 py-2 text-slate-600 dark:text-slate-455">{c.fecha_proyectada_cobro}</td>
                          <td className="px-4 py-2">
                            <span className={`font-black text-[8px] uppercase ${c.estado === 'PENDIENTE' ? 'text-amber-500' : 'text-emerald-600'}`}>
                              ● {c.estado}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-center font-bold text-slate-500">{c.prioridad}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: PROGRAMAR DEDUCCIÓN */}
          {activeSubTab === 'deduccion' && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm flex flex-col gap-4 animate-fadeIn max-w-3xl">
              <div className="flex flex-col gap-1">
                <h3 className="text-xs font-black text-slate-805 dark:text-slate-200 uppercase tracking-tight">➕ Programar Deducción Múltiple o Fija</h3>
                <p className="text-[10px] text-slate-450 dark:text-slate-400">
                  Las deducciones amortizan intereses u otros cobros ordinarios asociados al certificado y se descuentan de forma prioritaria en los cortes.
                </p>
              </div>

              <form onSubmit={handlePlanDeduccion} className="flex flex-col gap-4 mt-2">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-450 dark:text-slate-500 uppercase">Glosa / Descripción del Descuento</label>
                  <input
                    type="text"
                    className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-xs font-semibold focus:outline-none placeholder:text-slate-400"
                    placeholder="Ej: Cobro de Comisión Administrativa, Seguro..."
                    value={dedGlosa}
                    onChange={(e) => setDedGlosa(e.target.value)}
                    required
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-bold text-slate-450 dark:text-slate-500 uppercase">Modalidad de Deducción</label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-1.5 text-xs cursor-pointer font-semibold">
                      <input
                        type="radio"
                        checked={dedMode === 'fijo'}
                        onChange={() => setDedMode('fijo')}
                      />
                      <span>1. Monto Fijo Periódico</span>
                    </label>
                    <label className="flex items-center gap-1.5 text-xs cursor-pointer font-semibold">
                      <input
                        type="radio"
                        checked={dedMode === 'multiple'}
                        onChange={() => setDedMode('multiple')}
                      />
                      <span>2. Cronograma Múltiple (Armadas Ajustables)</span>
                    </label>
                  </div>
                </div>

                <hr className="border-slate-100 dark:border-slate-850" />

                {/* Formulario Fijo */}
                {dedMode === 'fijo' && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end animate-fadeIn">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-450 dark:text-slate-500 uppercase">Monto Fijo ({selectedContrato.moneda})</label>
                      <input
                        type="number"
                        min={0}
                        step="any"
                        className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                        value={dedFijoMonto}
                        onChange={(e) => setDedFijoMonto(Number(e.target.value) || 0)}
                        required
                      />
                    </div>
                    
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-455 dark:text-slate-500 uppercase">Fecha Corte (1° Descuento)</label>
                      <select
                        className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-xs font-semibold focus:outline-none animate-fadeIn"
                        value={dedFijoFechaCorte}
                        onChange={(e) => setDedFijoFechaCorte(e.target.value)}
                        required
                      >
                        {validDates.map((d, idx) => {
                          const dateStr = d.toISOString().split('T')[0];
                          return <option key={idx} value={dateStr}>{d.toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' })}</option>;
                        })}
                      </select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-455 dark:text-slate-500 uppercase">Número de Periodos</label>
                      <input
                        type="number"
                        min={1}
                        max={60}
                        className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                        value={dedFijoPeriodos}
                        onChange={(e) => setDedFijoPeriodos(Number(e.target.value) || 1)}
                        required
                      />
                    </div>
                  </div>
                )}

                {/* Formulario Multiple */}
                {dedMode === 'multiple' && (
                  <div className="flex flex-col gap-4 animate-fadeIn">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold text-slate-455 dark:text-slate-500 uppercase">Cantidad Total de Armadas</label>
                        <input
                          type="number"
                          min={1}
                          max={24}
                          className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                          value={dedMultiCuotas}
                          onChange={(e) => setDedMultiCuotas(Number(e.target.value) || 1)}
                          required
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold text-slate-455 dark:text-slate-500 uppercase">Fecha Corte Primera Armada</label>
                        <select
                          className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-xs font-semibold focus:outline-none animate-fadeIn"
                          value={dedMultiFechaInicio}
                          onChange={(e) => setDedMultiFechaInicio(e.target.value)}
                          required
                        >
                          {validDates.map((d, idx) => {
                            const dateStr = d.toISOString().split('T')[0];
                            return <option key={idx} value={dateStr}>{d.toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' })}</option>;
                          })}
                        </select>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 mt-2">
                      <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">Configurar importes por armada:</span>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {Array.from({ length: dedMultiCuotas }).map((_, i) => {
                          const fPago = selectedContrato.frecuencia_cupones_meses || 2;
                          const step = fPago === 3 ? 3 : 2;
                          const baseD = dedMultiFechaInicio ? new Date(dedMultiFechaInicio + 'T00:00:00') : new Date();
                          const armDate = addMonthsEndOfMonth(baseD, i * step);

                          return (
                            <div key={i} className="bg-slate-50 dark:bg-slate-950 p-2.5 rounded-lg border border-slate-150 dark:border-slate-850 flex flex-col gap-1.5">
                              <span className="text-[8px] font-black text-slate-450 dark:text-slate-500 uppercase">
                                Armada {i + 1} - {armDate.toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: '2-digit' })}
                              </span>
                              <input
                                type="number"
                                min={0}
                                step="any"
                                className="bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-800 rounded p-1 text-xs font-semibold text-center focus:outline-none"
                                value={dedMultiMontos[i] ?? 100}
                                onChange={(e) => {
                                  const val = Number(e.target.value) || 0;
                                  setDedMultiMontos(prev => ({ ...prev, [i]: val }));
                                }}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                <hr className="border-slate-100 dark:border-slate-850" />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-455 dark:text-slate-500 uppercase">Prioridad de Ejecución (1 = Máxima)</label>
                    <input
                      type="number"
                      min={1}
                      className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none w-32"
                      value={dedPrioridad}
                      onChange={(e) => setDedPrioridad(Number(e.target.value) || 2)}
                      required
                    />
                  </div>

                  <div className="flex flex-col items-end justify-end mt-2">
                    {dedError && <span className="text-[10px] font-bold text-rose-650 mb-2">{dedError}</span>}
                    {dedSuccess && <span className="text-[10px] font-bold text-emerald-650 mb-2 flex items-center gap-1"><CheckCircle size={11} /> {dedSuccess}</span>}
                    
                    <button
                      type="submit"
                      className="h-10 px-6 bg-emerald-650 hover:bg-emerald-700 text-white rounded-lg text-xs font-black uppercase tracking-wider cursor-pointer shadow disabled:opacity-50 transition-colors"
                      disabled={dedSubmitting || !dedGlosa.trim()}
                    >
                      {dedSubmitting ? 'Guardando...' : '✅ Crear Plan de Deducciones'}
                    </button>
                  </div>
                </div>

              </form>
            </div>
          )}

          {/* TAB 3: PROGRAMAR RESCATE */}
          {activeSubTab === 'rescate' && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm flex flex-col gap-4 animate-fadeIn max-w-3xl">
              <div className="flex flex-col gap-1">
                <h3 className="text-xs font-black text-slate-805 dark:text-slate-200 uppercase tracking-tight">💸 Programar Rescate de Capital (RES)</h3>
                <p className="text-[10px] text-slate-450 dark:text-slate-400">
                  Un rescate amortiza de forma anticipada el capital base del inversionista y recalcula la base imponible y el devengue.
                </p>
              </div>

              {/* Reglas del Fondo */}
              {fondoRules && (
                <div className="grid grid-cols-3 gap-4 bg-slate-50 dark:bg-slate-950 p-3.5 rounded-xl border border-slate-200 dark:border-slate-850">
                  <div className="flex flex-col">
                    <span className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase">Permanencia Mínima</span>
                    <strong className="text-xs font-bold text-slate-700 dark:text-slate-200">{fondoRules.plazo_rescate_meses || 0} meses</strong>
                  </div>
                  <div className="flex flex-col border-l border-slate-200 dark:border-slate-800 pl-3">
                    <span className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase">Plazo Máx Devolución</span>
                    <strong className="text-xs font-bold text-slate-700 dark:text-slate-200">{fondoRules.plazo_opcion_de_rescate_dias || 0} días</strong>
                  </div>
                  <div className="flex flex-col border-l border-slate-200 dark:border-slate-800 pl-3">
                    <span className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase">Penalidad Base Fondo</span>
                    <strong className="text-xs font-bold text-rose-650 dark:text-rose-450">{fondoRules.penalidad_rescate || 0}%</strong>
                  </div>
                </div>
              )}

              <form onSubmit={handlePlanRescate} className="flex flex-col gap-4 mt-2">
                
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-455 dark:text-slate-500 uppercase">Glosa de Rescate</label>
                  <input
                    type="text"
                    className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-xs font-semibold focus:outline-none placeholder:text-slate-400"
                    placeholder="Glosa descriptiva..."
                    value={resGlosa}
                    onChange={(e) => setResGlosa(e.target.value)}
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-455 dark:text-slate-500 uppercase">Cantidad de Armadas para Rescate</label>
                    <input
                      type="number"
                      min={1}
                      max={24}
                      className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                      value={resArmadasCount}
                      onChange={(e) => setResArmadasCount(Number(e.target.value) || 1)}
                      required
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-455 dark:text-slate-500 uppercase">Tasa de Interés de Rescate (Waiver) %</label>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                      value={resTasaWaiver}
                      onChange={(e) => setResTasaWaiver(Number(e.target.value) || 0)}
                      required
                    />
                  </div>
                </div>

                <hr className="border-slate-100 dark:border-slate-850" />

                <div className="flex flex-col gap-2.5">
                  <span className="text-[9px] font-black text-slate-450 dark:text-slate-500 uppercase tracking-wider">Configurar cortes y penalidades por armada:</span>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {resArmadasData.map((arm, i) => (
                      <div key={i} className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-150 dark:border-slate-850 flex flex-col gap-3">
                        <span className="text-[9px] font-black text-slate-700 dark:text-slate-300 uppercase">Corte de Devolución {i + 1}</span>
                        
                        <div className="grid grid-cols-1 gap-2.5">
                          
                          <div className="flex flex-col gap-1">
                            <label className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase">Fecha de Corte</label>
                            <select
                              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded p-1.5 text-xs font-semibold focus:outline-none"
                              value={arm.fecha}
                              onChange={(e) => {
                                const val = e.target.value;
                                setResArmadasData(prev => {
                                  const cpy = [...prev];
                                  cpy[i].fecha = val;
                                  return cpy;
                                });
                              }}
                            >
                              {validDates.map((d, idx) => {
                                const dateStr = d.toISOString().split('T')[0];
                                return <option key={idx} value={dateStr}>{d.toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' })}</option>;
                              })}
                            </select>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div className="flex flex-col gap-1">
                              <label className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase">Monto Rescate</label>
                              <input
                                type="number"
                                min={0}
                                step="any"
                                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded p-1 text-xs font-semibold text-center focus:outline-none"
                                value={arm.monto}
                                onChange={(e) => {
                                  const val = Number(e.target.value) || 0;
                                  const penaltyPct = fondoRules.penalidad_rescate || 0;
                                  setResArmadasData(prev => {
                                    const cpy = [...prev];
                                    cpy[i].monto = val;
                                    cpy[i].penalidad = val * (penaltyPct / 100);
                                    return cpy;
                                  });
                                }}
                              />
                            </div>

                            <div className="flex flex-col gap-1">
                              <label className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase">Penalidad A Cobrar</label>
                              <input
                                type="number"
                                min={0}
                                step="any"
                                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-855 rounded p-1 text-xs font-semibold text-center focus:outline-none"
                                value={arm.penalidad}
                                onChange={(e) => {
                                  const val = Number(e.target.value) || 0;
                                  setResArmadasData(prev => {
                                    const cpy = [...prev];
                                    cpy[i].penalidad = val;
                                    return cpy;
                                  });
                                }}
                              />
                            </div>
                          </div>

                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col items-end justify-end mt-4 pt-3 border-t border-slate-100 dark:border-slate-850">
                  {resError && <span className="text-[10px] font-bold text-rose-650 mb-2">{resError}</span>}
                  {resSuccess && <span className="text-[10px] font-bold text-emerald-650 mb-2 flex items-center gap-1"><CheckCircle size={11} /> {resSuccess}</span>}

                  <button
                    type="submit"
                    className="h-10 px-6 bg-blue-650 hover:bg-blue-700 text-white rounded-lg text-xs font-black uppercase tracking-wider cursor-pointer shadow disabled:opacity-50 transition-colors"
                    disabled={resSubmitting || resArmadasData.length === 0}
                  >
                    {resSubmitting ? 'Guardando...' : '✅ Programar Rescate y Penalidades'}
                  </button>
                </div>

              </form>
            </div>
          )}

        </div>
      )}

    </div>
  );
};
