// src/features/deducciones/DeduccionesPage.tsx
import React, { useEffect, useState, useMemo } from 'react';
import { 
  buscarContratosPadre, getActiveCertificadoByContrato, getActiveCapitalBalance, getFondoRules, getCronogramaDeducciones, getCronogramaDeduccionesGlobal, insertCronogramaDeducciones, getParticipesMap, updateCuotaTasa
} from '../../services/deduccionesService';
import type { DeduccionCuota, ContratoBusqueda, FondoRules } from '../../services/deduccionesService';
import { 
  Search, Loader2, CheckCircle, User, FileText, X, AlertCircle, DollarSign, Calendar, Pencil
} from 'lucide-react';

// Helper para determinar si el fondo es trimestral (CON01) o bimestral (todos los demás)
const isFondoTrimestral = (idFondo?: string, freq?: number): boolean => {
  if (!idFondo) return freq === 3;
  return idFondo.toUpperCase().includes('CON01');
};

export const DeduccionesPage: React.FC = () => {
  // Buscador
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [searchLoading, setSearchLoading] = useState<boolean>(false);
  const [searchResults, setSearchResults] = useState<ContratoBusqueda[]>([]);
  const [selectedContrato, setSelectedContrato] = useState<ContratoBusqueda | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const omniContainerRef = React.useRef<HTMLDivElement>(null);

  // Datos del contrato y certificado activo
  const [activeCertId, setActiveCertId] = useState<string>('');
  const [activeCapital, setActiveCapital] = useState<number>(0);
  const [fondoRules, setFondoRules] = useState<FondoRules>({});
  const [cronograma, setCronograma] = useState<DeduccionCuota[]>([]);
  const [cronoLoading, setCronoLoading] = useState<boolean>(false);
  const [participesMap, setParticipesMap] = useState<Record<string, string>>({});

  // Modal de edición de Tasa Waiver / REPO Credicorp ex-post
  const [editTasaModalOpen, setEditTasaModalOpen] = useState<boolean>(false);
  const [cuotaToEditTasa, setCuotaToEditTasa] = useState<DeduccionCuota | null>(null);
  const [newTasaValue, setNewTasaValue] = useState<number>(0);
  const [savingTasa, setSavingTasa] = useState<boolean>(false);
  const [tasaSaveError, setTasaSaveError] = useState<string | null>(null);

  const handleOpenEditTasa = (cuota: DeduccionCuota) => {
    setCuotaToEditTasa(cuota);
    setNewTasaValue(cuota.tasa ?? 0);
    setTasaSaveError(null);
    setEditTasaModalOpen(true);
  };

  const handleSaveTasaWaiver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cuotaToEditTasa) return;
    setSavingTasa(true);
    setTasaSaveError(null);
    try {
      await updateCuotaTasa(cuotaToEditTasa.id_cuota, newTasaValue);
      setCronograma(prev => prev.map(c => c.id_cuota === cuotaToEditTasa.id_cuota ? { ...c, tasa: newTasaValue } : c));
      setEditTasaModalOpen(false);
    } catch (err: any) {
      setTasaSaveError(err.message || 'Error al actualizar tasa');
    } finally {
      setSavingTasa(false);
    }
  };

  // Pestañas internas
  const [activeSubTab, setActiveSubTab] = useState<'cronograma' | 'deduccion' | 'rescate'>('cronograma');

  // Filtros temporales por Año y Período de Cierre
  const [selYearFilter, setSelYearFilter] = useState<number>(2026);
  const [selCorteFilter, setSelCorteFilter] = useState<string>('2026-02-28');

  // Fechas de corte disponibles (fín de mes alineado)
  const [validDates, setValidDates] = useState<Date[]>([]);

  // Cronograma filtrado por año y por período de cierre
  const filteredCronograma = useMemo(() => {
    return cronograma.filter(c => {
      if (!c.fecha_proyectada_cobro) return true;
      const fechaStr = c.fecha_proyectada_cobro.split('T')[0];
      const year = new Date(fechaStr + 'T00:00:00').getFullYear();

      if (selYearFilter && year !== selYearFilter) return false;
      if (selCorteFilter !== 'TODOS' && fechaStr !== selCorteFilter) return false;
      return true;
    });
  }, [cronograma, selYearFilter, selCorteFilter]);

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
  const [resEsRescateTotal, setResEsRescateTotal] = useState<boolean>(false);
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

  // Búsqueda en tiempo real con Debounce (Omnibuscador)
  useEffect(() => {
    if (!searchTerm.trim() || searchTerm.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await buscarContratosPadre(searchTerm);
        setSearchResults(res);
        if (res.length === 1 && !selectedContrato) {
          setSelectedContrato(res[0]);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setSearchLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Cerrar burbujón al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (omniContainerRef.current && !omniContainerRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Buscar contrato al presionar ENTER
  const handleBuscarContrato = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;
    setSearchLoading(true);
    try {
      const res = await buscarContratosPadre(searchTerm);
      setSearchResults(res);
      setIsDropdownOpen(true);
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


  const loadGlobalCronograma = async () => {
    setCronoLoading(true);
    try {
      const [crono, pMap] = await Promise.all([
        getCronogramaDeduccionesGlobal(),
        getParticipesMap()
      ]);
      setParticipesMap(pMap);
      setCronograma(crono);
    } catch (err) {
      console.error(err);
    } finally {
      setCronoLoading(false);
    }
  };

  // Cargar datos al seleccionar contrato (o cargar global si no hay selección)
  useEffect(() => {
    if (selectedContrato) {
      loadContratoData(selectedContrato);
    } else {
      setActiveCertId('');
      setActiveCapital(0);
      setFondoRules({});
      setValidDates([]);
      loadGlobalCronograma();
    }
  }, [selectedContrato]);

  const loadContratoData = async (c: ContratoBusqueda) => {
    setCronoLoading(true);
    try {
      // 1. Obtener certificado activo y saldo capital vivo real
      const certId = await getActiveCertificadoByContrato(c.id_contrato);
      setActiveCertId(certId);

      const realCap = await getActiveCapitalBalance(c.id_contrato, c.monto_inversion);
      setActiveCapital(realCap);

      // 2. Reglas del fondo
      const { rules, tasaMinima } = await getFondoRules(c.id_fondo);
      setFondoRules(rules);
      setResTasaWaiver(tasaMinima);

      // 3. Fechas de corte validas (CON01 es el único fondo trimestral; los demás fondos son bimestrales)
      const fPago = isFondoTrimestral(c.id_fondo, c.frecuencia_cupones_meses) ? 3 : 2;
      const dates = getValidEndOfMonthDates(fPago);
      setValidDates(dates);
      
      if (dates.length > 0) {
        const firstDateStr = dates[0].toISOString().split('T')[0];
        setDedFijoFechaCorte(firstDateStr);
        setDedMultiFechaInicio(firstDateStr);
      }

      // 4. Cargar cronograma
      const crono = await getCronogramaDeducciones(certId, c.id_contrato);
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
      const capVigente = activeCapital > 0 ? activeCapital : (selectedContrato?.monto_inversion || 0);
      const baseMonto = (resEsRescateTotal && selectedContrato) 
        ? Math.round((capVigente / resArmadasCount) * 100) / 100 
        : 1000;

      // Si es rescate total, buscar automáticamente la fecha de corte que coincida con el fin del contrato
      let defaultDateIndex = 0;
      if (resEsRescateTotal && selectedContrato?.fecha_fin) {
        const finStr = selectedContrato.fecha_fin.split('T')[0];
        const matchIdx = validDates.findIndex(d => d.toISOString().split('T')[0] === finStr);
        if (matchIdx !== -1) {
          defaultDateIndex = matchIdx;
        }
      }

      for (let i = 0; i < resArmadasCount; i++) {
        const targetIdx = (resEsRescateTotal && resArmadasCount === 1) ? defaultDateIndex : i;
        const matchDate = validDates[targetIdx] || validDates[i] || validDates[0];
        const dateStr = matchDate.toISOString().split('T')[0];
        const monto = baseMonto;
        const penalidad = Math.round(monto * (penaltyPct / 100) * 100) / 100;

        newArmadas.push({
          fecha: dateStr,
          monto,
          penalidad
        });
      }
      setResArmadasData(newArmadas);
    }
  }, [resArmadasCount, validDates, fondoRules, selectedContrato, resEsRescateTotal, activeCapital]);

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
      const fPago = isFondoTrimestral(selectedContrato.id_fondo, selectedContrato.frecuencia_cupones_meses) ? 3 : 2;
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
      const crono = await getCronogramaDeducciones(activeCertId, selectedContrato?.id_contrato);
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
          glosa_descripcion: `${resGlosa}${resEsRescateTotal ? ' [RESCATE TOTAL]' : ''} (Armada ${idx + 1}/${totalArm})`,
          moneda: selectedContrato.moneda,
          monto_cobrar: arm.monto,
          fecha_proyectada_cobro: arm.fecha,
          estado: 'PENDIENTE',
          prioridad: 3,
          tasa: resTasaWaiver,
          es_rescate_total: resEsRescateTotal,
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
      const crono = await getCronogramaDeducciones(activeCertId, selectedContrato?.id_contrato);
      setCronograma(crono);
    } catch (err: any) {
      setResError(err.message || 'Error al programar rescate.');
    } finally {
      setResSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full animate-fadeIn">
      
      {/* Buscador OMNI de Contrato Padre con Estilo APEFAC */}
      <div ref={omniContainerRef} className="glass-card p-5 flex flex-col gap-3 relative">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-black text-[#0f172a] dark:text-[#f8fafc] uppercase tracking-wider flex items-center gap-1.5">
            🔍 Buscar Contrato Padre (Omnibuscador)
          </h3>
          {searchResults.length > 0 && (
            <span className="text-[10px] font-bold text-[#0284c7] dark:text-[#38bdf8]">
              {searchResults.length} contrato(s) encontrado(s)
            </span>
          )}
        </div>
        <p className="text-[10.5px] text-[#64748b] dark:text-[#94a3b8] font-semibold">
          Ingrese ID de Contrato, RUC, DNI o Nombre del Inversionista para configurar deducciones.
        </p>

        <form onSubmit={handleBuscarContrato} className="relative max-w-2xl w-full">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
            <Search size={15} />
          </span>

          <input
            type="text"
            className="w-full bg-[#f8fafc] dark:bg-[#0b0f19] border border-[#e2e8f0] dark:border-[#334155] rounded-xl py-2.5 pl-9 pr-9 text-xs font-semibold text-[#0f172a] dark:text-[#f8fafc] placeholder:text-slate-400 focus:outline-none focus:border-[#0284c7] shadow-xs transition-all"
            placeholder="Ej: NSGPEN... o DNI 45678912 o Gallo"
            value={searchTerm}
            onChange={(e) => {
              const val = e.target.value;
              setSearchTerm(val);
              setIsDropdownOpen(true);
            }}
            onFocus={() => {
              if (searchTerm.trim()) setIsDropdownOpen(true);
            }}
          />

          {searchLoading ? (
            <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-blue-600">
              <Loader2 size={15} className="animate-spin" />
            </span>
          ) : searchTerm ? (
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setSearchResults([]);
                setSelectedContrato(null);
                setIsDropdownOpen(false);
              }}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X size={15} />
            </button>
          ) : null}

          {/* BELLO BURBUJÓN DE HALLAZGOS (OVERLAY DE SELECCIÓN RÁPIDA A 1-CLIC) */}
          {isDropdownOpen && searchTerm.trim().length >= 2 && (
            <div className="absolute top-full left-0 right-0 z-50 mt-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl max-h-80 overflow-y-auto p-2 flex flex-col gap-1.5 animate-fadeIn border-t-2 border-t-blue-600">
              {searchLoading ? (
                <div className="p-4 text-center text-xs text-slate-500 font-semibold flex items-center justify-center gap-2">
                  <Loader2 size={16} className="animate-spin text-blue-600" />
                  <span>Buscando coincidencias en el ledger de contratos...</span>
                </div>
              ) : searchResults.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-500 font-semibold flex items-center justify-center gap-2">
                  <AlertCircle size={15} className="text-amber-500" />
                  <span>No se encontraron contratos para "{searchTerm}". Intente por DNI, RUC o Apellido.</span>
                </div>
              ) : (
                searchResults.map((c) => {
                  const isSelected = selectedContrato?.id_contrato === c.id_contrato;
                  const inversionistaNombre = c.nombre_inversionista_temp || c.id_inversionista_1 || 'Inversionista';

                  return (

                    <button
                      key={c.id_contrato}
                      type="button"
                      onClick={() => {
                        setSelectedContrato(c);
                        setIsDropdownOpen(false);
                      }}
                      className={`p-3 rounded-xl text-left transition-all cursor-pointer border flex flex-col gap-1 ${
                        isSelected
                          ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-500 dark:border-blue-700 shadow-xs'
                          : 'bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-850 border-slate-150 dark:border-slate-800/80'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FileText size={14} className="text-blue-600 dark:text-blue-400 shrink-0" />
                          <span className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-tight">
                            {c.id_contrato}
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {c.id_fondo} ({isFondoTrimestral(c.id_fondo, c.frecuencia_cupones_meses) ? 'Trimestral' : 'Bimestral'})
                          </span>
                        </div>
                        <span className="text-xs font-black text-emerald-700 dark:text-emerald-400">
                          {c.moneda} {c.monto_inversion?.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-slate-600 dark:text-slate-400 font-medium">
                        <span className="flex items-center gap-1">
                          <User size={12} className="text-slate-400" />
                          <strong className="text-slate-800 dark:text-slate-200">{inversionistaNombre}</strong>
                        </span>
                        <span>•</span>
                        <span>Inversionista / DNI: <strong className="font-mono text-slate-800 dark:text-slate-200">{c.id_inversionista_1}</strong></span>
                      </div>

                    </button>
                  );
                })
              )}
            </div>
          )}
        </form>
      </div>


      {/* Card Resumen de Ficha (Si hay contrato seleccionado) */}
      {selectedContrato && (
        <div className="bg-blue-50/50 dark:bg-blue-950/10 border border-blue-100 dark:border-blue-950/20 rounded-xl p-4 flex flex-col md:flex-row justify-between gap-4 text-[11px] font-semibold text-slate-700 dark:text-slate-300 animate-fadeIn">
          <div className="flex flex-col gap-1">
            <span>📜 Contrato: <strong className="text-blue-600 dark:text-blue-400 font-bold">{selectedContrato.id_contrato}</strong></span>
            <span>👤 Inversionista: <strong>{selectedContrato.nombre_inversionista_temp || selectedContrato.id_inversionista_1}</strong></span>
            <span>🏦 Fondo: <strong>{selectedContrato.id_fondo} ({isFondoTrimestral(selectedContrato.id_fondo, selectedContrato.frecuencia_cupones_meses) ? 'Trimestral' : 'Bimestral'})</strong></span>
          </div>
          <div className="flex flex-col gap-1 md:text-right">
            <span>🎟️ Certificado Activo: <strong className="text-rose-600 dark:text-rose-450 font-bold font-mono">{activeCertId}</strong></span>
            <span>💰 Inversión Original: <strong>{selectedContrato.moneda} {selectedContrato.monto_inversion.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</strong></span>
            <span>📈 Capital Base Activo (Último Cierre): <strong className="text-emerald-700 dark:text-emerald-400 font-bold">{selectedContrato.moneda} {(activeCapital || selectedContrato.monto_inversion).toLocaleString('es-PE', { minimumFractionDigits: 2 })}</strong></span>
            <span>📅 Fecha Vencimiento: <strong>{selectedContrato.fecha_fin}</strong></span>
          </div>
        </div>
      )}

      {/* Contenedor Principal de Pestañas */}
      <div className="flex flex-col gap-6 w-full animate-fadeIn">

          {/* Sub Pestañas Ribbon Estilo APEFAC */}
          <div className="flex gap-2 border-b border-[#e2e8f0] dark:border-[#334155] pb-2">
            {[
              { id: 'cronograma', label: '📋 Cronograma General (Activo)' },
              { id: 'deduccion', label: '➕ Programar Deducción (DED)' },
              { id: 'rescate', label: '💸 Programar Rescate (RES)' },
            ].map(tab => (
              <button
                key={tab.id}
                className={`px-4 py-2 rounded-lg text-xs font-black uppercase cursor-pointer transition-all ${
                  activeSubTab === tab.id 
                    ? 'bg-[#f0f9ff] text-[#0284c7] dark:bg-[#0284c7]/15 dark:text-[#38bdf8] shadow-xs' 
                    : 'text-[#64748b] hover:text-[#0f172a] dark:text-[#94a3b8] dark:hover:text-[#f8fafc] hover:bg-slate-100 dark:hover:bg-slate-800/50'
                }`}
                onClick={() => setActiveSubTab(tab.id as any)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* TAB 1: CRONOGRAMA GENERAL ORGANIZADO POR FONDO */}
          {activeSubTab === 'cronograma' && (
            <div className="flex flex-col gap-6 animate-fadeIn">
              
              {/* BARRA DE FILTROS TEMPORALES: AÑO Y PERÍODOS DE CIERRE Estilo APEFAC */}
              <div className="glass-card p-5 flex flex-col gap-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-[#e2e8f0] dark:border-[#334155] pb-3">
                  <div className="flex items-center gap-2">
                    <Calendar size={16} className="text-[#0284c7] dark:text-[#38bdf8]" />
                    <span className="text-xs font-black text-[#0f172a] dark:text-[#f8fafc] uppercase tracking-wider">Filtro por Año y Período de Cierre Contable</span>
                  </div>

                  {/* Selector de Año */}
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-[#64748b] dark:text-[#94a3b8] uppercase">Año de Ejercicio:</span>
                    <div className="flex gap-1">
                      {[2025, 2026, 2027].map(y => (
                        <button
                          key={y}
                          type="button"
                          onClick={() => {
                            setSelYearFilter(y);
                            setSelCorteFilter(`${y}-02-28`);
                          }}
                          className={`px-3 py-1 rounded-lg text-xs font-mono font-bold cursor-pointer transition-all ${
                            selYearFilter === y
                              ? 'bg-[#0284c7] text-white shadow-xs'
                              : 'bg-slate-100 dark:bg-slate-800 text-[#475569] dark:text-[#cbd5e1] hover:bg-slate-200 dark:hover:bg-slate-700'
                          }`}
                        >
                          {y}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Tabs por Período de Cierre (Cortes Bimestrales / Trimestrales) */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
                  {[
                    { id: 'TODOS', label: '🌐 Todos los Cortes' },
                    { id: `${selYearFilter}-02-28`, label: '📅 28 Feb (B1)' },
                    { id: `${selYearFilter}-03-31`, label: '📅 31 Mar (Q1)' },
                    { id: `${selYearFilter}-04-30`, label: '📅 30 Abr (B2)' },
                    { id: `${selYearFilter}-06-30`, label: '📅 30 Jun (B3/Q2)' },
                    { id: `${selYearFilter}-08-31`, label: '📅 31 Ago (B4)' },
                    { id: `${selYearFilter}-09-30`, label: '📅 30 Set (Q3)' },
                    { id: `${selYearFilter}-10-31`, label: '📅 31 Oct (B5)' },
                    { id: `${selYearFilter}-12-31`, label: '📅 31 Dic (B6/Q4)' },
                  ].map(p => {
                    const count = cronograma.filter(c => {
                      if (!c.fecha_proyectada_cobro) return false;
                      const fStr = c.fecha_proyectada_cobro.split('T')[0];
                      const yr = new Date(fStr + 'T00:00:00').getFullYear();
                      if (yr !== selYearFilter) return false;
                      return p.id === 'TODOS' ? true : fStr === p.id;
                    }).length;

                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setSelCorteFilter(p.id)}
                        className={`h-8 px-3 rounded-lg text-xs font-bold whitespace-nowrap cursor-pointer transition-all flex items-center gap-1.5 ${
                          selCorteFilter === p.id
                            ? 'bg-[#0284c7] text-white font-black shadow-xs'
                            : 'bg-[#f8fafc] hover:bg-[#f0f9ff] text-[#475569] hover:text-[#0284c7] border border-[#e2e8f0] dark:bg-[#151e2e] dark:border-[#334155] dark:text-[#cbd5e1]'
                        }`}
                      >
                        <span>{p.label}</span>
                        {count > 0 && (
                          <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-mono font-bold ${
                            selCorteFilter === p.id ? 'bg-white text-[#0284c7]' : 'bg-[#e0f2fe] text-[#0284c7] dark:bg-[#0284c7]/20 dark:text-[#38bdf8]'
                          }`}>
                            {count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {cronoLoading ? (
                <div className="glass-card p-12 flex flex-col items-center justify-center text-center gap-2">
                  <Loader2 className="animate-spin text-[#0284c7]" size={28} />
                  <span className="text-xs font-bold text-slate-400">Cargando cronogramas por fondo...</span>
                </div>
              ) : filteredCronograma.length === 0 ? (
                <div className="glass-card py-16 text-center text-xs font-bold text-slate-400 uppercase tracking-wider border-dashed flex flex-col items-center justify-center gap-2">
                  <span>No hay cronogramas ni rescates programados para el período seleccionado ({selCorteFilter === 'TODOS' ? `Año ${selYearFilter}` : selCorteFilter}).</span>
                  <button 
                    type="button" 
                    onClick={() => setSelCorteFilter('TODOS')}
                    className="text-[#0284c7] hover:underline cursor-pointer font-black text-xs uppercase"
                  >
                    Ver todos los cortes del año {selYearFilter}
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-6 w-full">
                  {/* Tarjeta Resumen de Provisión de Cash Inteligente Estilo APEFAC */}
                  {(() => {
                    const rescatesOnly = filteredCronograma.filter(c => c.tipo_cargo === 'RESCATE_CAPITAL');
                    const hasPendientes = rescatesOnly.some(c => c.estado === 'PENDIENTE');
                    const allProcesados = rescatesOnly.length > 0 && rescatesOnly.every(c => c.estado === 'PROCESADO');

                    const cashPEN = rescatesOnly.filter(c => c.moneda === 'PEN').reduce((sum, x) => sum + (x.monto_cobrar || 0), 0);
                    const cashUSD = rescatesOnly.filter(c => c.moneda === 'USD').reduce((sum, x) => sum + (x.monto_cobrar || 0), 0);

                    const cardTitle = allProcesados
                      ? `✅ Cash Liquidado / Ejecutado en Rescates (${selCorteFilter === 'TODOS' ? `Año ${selYearFilter}` : `Corte ${selCorteFilter}`})`
                      : hasPendientes
                        ? `💰 Provisión de Cash Requerida (${selCorteFilter === 'TODOS' ? `Año ${selYearFilter}` : `Corte ${selCorteFilter}`})`
                        : `📊 Resumen de Rescates (${selCorteFilter === 'TODOS' ? `Año ${selYearFilter}` : `Corte ${selCorteFilter}`})`;

                    const cardSubtitle = allProcesados
                      ? `Capital amortizado y liquidado exitosamente en los cierres contables oficiales del Ledger`
                      : `Flujo de tesorería pendiente y requerido para atender las devoluciones programadas`;

                    return (
                      <div className={`glass-card p-5 flex flex-col md:flex-row items-center justify-between gap-4 border-l-4 ${
                        allProcesados ? 'border-l-[#059669]' : 'border-l-[#0284c7]'
                      }`}>
                        <div className="flex items-center gap-3">
                          <div className={`p-3 rounded-xl ${
                            allProcesados 
                              ? 'bg-[#ecfdf5] text-[#059669] dark:bg-[#059669]/15 dark:text-[#34d399]' 
                              : 'bg-[#f0f9ff] text-[#0284c7] dark:bg-[#0284c7]/15 dark:text-[#38bdf8]'
                          }`}>
                            <DollarSign size={22} />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-xs font-black uppercase text-[#0f172a] dark:text-[#f8fafc] tracking-wider">{cardTitle}</span>
                            <span className="text-[11px] font-semibold text-[#64748b] dark:text-[#94a3b8]">{cardSubtitle}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="flex flex-col text-right">
                            <span className="text-[10px] font-bold text-[#64748b] dark:text-[#94a3b8] uppercase">
                              {allProcesados ? 'Total Liquidado (PEN)' : 'Provisión Soles (PEN)'}
                            </span>
                            <span className="font-mono text-base font-black text-[#059669] dark:text-[#34d399] tabular-nums">S/ {cashPEN.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span>
                          </div>
                          {cashUSD > 0 && (
                            <div className="flex flex-col text-right border-l border-[#e2e8f0] dark:border-[#334155] pl-6">
                              <span className="text-[10px] font-bold text-[#64748b] dark:text-[#94a3b8] uppercase">
                                {allProcesados ? 'Total Liquidado (USD)' : 'Provisión Dólares (USD)'}
                              </span>
                              <span className="font-mono text-base font-black text-[#0284c7] dark:text-[#38bdf8] tabular-nums">$ {cashUSD.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {Object.entries(
                    filteredCronograma.reduce((acc, c) => {
                      const fId = (c.id_contrato || c.id_certificado || 'OTROS').split('-')[0];
                      if (!acc[fId]) acc[fId] = [];
                      acc[fId].push(c);
                      return acc;
                    }, {} as Record<string, DeduccionCuota[]>)
                  ).sort(([a], [b]) => a.localeCompare(b)).map(([fondoId, cuotas]) => {
                    const totalMonto = cuotas.reduce((sum, x) => sum + (x.monto_cobrar || 0), 0);
                    const moneda = cuotas[0]?.moneda || 'PEN';
                    return (
                      <div key={`grupo-fondo-${fondoId}`} className="glass-card overflow-hidden">
                        <div className="py-3.5 px-5 bg-[#f8fafc] dark:bg-[#151e2e] border-b border-[#e2e8f0] dark:border-[#334155] flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="bg-[#0284c7] text-white font-mono text-xs font-black px-2.5 py-1 rounded-lg">
                              🏛️ FONDO: {fondoId}
                            </span>
                            <span className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8]">
                              ({cuotas.length} {cuotas.length === 1 ? 'registro' : 'registros'})
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-[#64748b] dark:text-[#94a3b8] uppercase">Total Programado:</span>
                            <span className="font-mono text-xs font-black text-[#059669] dark:text-[#34d399] tabular-nums">
                              {moneda} {totalMonto.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>

                        <div className="overflow-x-auto w-full">
                          <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
                            <thead>
                              <tr className="bg-[#f8fafc]/50 dark:bg-[#151e2e]/50 border-b border-[#e2e8f0] dark:border-[#334155]">
                                <th className="font-bold text-[#64748b] dark:text-[#94a3b8] px-4 py-3 uppercase tracking-wider text-[10.5px]">Inversionista / Partícipes</th>
                                <th className="font-bold text-[#64748b] dark:text-[#94a3b8] px-4 py-3 uppercase tracking-wider text-[10.5px]">Contrato</th>
                                <th className="font-bold text-[#64748b] dark:text-[#94a3b8] px-4 py-3 uppercase tracking-wider text-[10.5px]">Tipo Cargo</th>
                                <th className="font-bold text-[#64748b] dark:text-[#94a3b8] px-4 py-3 uppercase tracking-wider text-[10.5px]">Glosa / Descripción</th>
                                <th className="font-bold text-[#64748b] dark:text-[#94a3b8] px-4 py-3 uppercase tracking-wider text-[10.5px] text-center">Moneda</th>
                                <th className="font-bold text-[#64748b] dark:text-[#94a3b8] px-4 py-3 uppercase tracking-wider text-[10.5px] text-right">Monto</th>
                                <th className="font-bold text-[#64748b] dark:text-[#94a3b8] px-4 py-3 uppercase tracking-wider text-[10.5px] text-center">Tasa Waiver REPO</th>
                                <th className="font-bold text-[#64748b] dark:text-[#94a3b8] px-4 py-3 uppercase tracking-wider text-[10.5px] text-center">Corte Cobro</th>
                                <th className="font-bold text-[#64748b] dark:text-[#94a3b8] px-4 py-3 uppercase tracking-wider text-[10.5px] text-center">Estado</th>
                                <th className="font-bold text-[#64748b] dark:text-[#94a3b8] px-4 py-3 uppercase tracking-wider text-[10.5px] text-center">Prioridad</th>
                              </tr>
                            </thead>
                            <tbody>
                              {cuotas.map(c => {
                                const investorName = participesMap[c.id_contrato] || (selectedContrato?.id_contrato === c.id_contrato ? selectedContrato.nombre_inversionista_temp : null) || 'Inversionista No Identificado';
                                return (
                                  <tr key={c.id_cuota} className="table-row-hover border-b border-[#e2e8f0]/60 dark:border-[#334155]/60 transition-colors">
                                    <td className="px-4 py-3 max-w-[280px]">
                                      <div className="flex flex-col">
                                        <span className="font-bold text-[#0f172a] dark:text-[#f8fafc] text-xs leading-tight truncate" title={investorName}>
                                          {investorName}
                                        </span>
                                        <span className="font-mono text-[9.5px] text-[#64748b] dark:text-[#94a3b8] tracking-tight">
                                          {c.id_cuota}
                                        </span>
                                      </div>
                                    </td>
                                    <td className="px-4 py-3 font-mono font-bold text-[#0284c7] dark:text-[#38bdf8]">{c.id_contrato || '-'}</td>
                                  <td className="px-4 py-3">
                                    <span className={`px-2.5 py-1 rounded-md text-[9.5px] font-mono font-bold uppercase ${
                                      c.tipo_cargo === 'RESCATE_CAPITAL' 
                                        ? 'bg-[#f0f9ff] text-[#0284c7] border border-[#bae6fd] dark:bg-[#0284c7]/15 dark:text-[#38bdf8] dark:border-[#0284c7]/30' 
                                        : c.tipo_cargo === 'PENALIDAD_RESCATE'
                                          ? 'bg-[#fef2f2] text-[#e11d48] border border-[#fecdd3] dark:bg-[#e11d48]/15 dark:text-[#fb7185] dark:border-[#e11d48]/30'
                                          : 'bg-[#fffbeb] text-[#d97706] border border-[#fde68a] dark:bg-[#d97706]/15 dark:text-[#fbbf24] dark:border-[#d97706]/30'
                                    }`}>
                                      {c.tipo_cargo.replaceAll('_', ' ')}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-[#0f172a] dark:text-[#f8fafc] font-medium max-w-[280px] truncate" title={c.glosa_descripcion}>{c.glosa_descripcion}</td>
                                  <td className="px-4 py-3 text-center">
                                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-[#475569] dark:text-[#cbd5e1]">
                                      {c.moneda}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-right font-mono font-black text-[#059669] dark:text-[#34d399] tabular-nums">{c.monto_cobrar.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</td>
                                  <td className="px-4 py-3 text-center">
                                    {c.tipo_cargo === 'RESCATE_CAPITAL' ? (
                                      <div className="inline-flex items-center gap-1.5 bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 px-2 py-0.5 rounded-lg">
                                        <span className="font-mono text-[10.5px] font-black text-sky-700 dark:text-sky-300">
                                          {c.tasa !== null && c.tasa !== undefined && c.tasa > 0 ? `${c.tasa}%` : '0% (Ex-post)'}
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => handleOpenEditTasa(c)}
                                          className="text-sky-600 hover:text-sky-800 dark:text-sky-400 p-0.5 rounded hover:bg-sky-100 dark:hover:bg-sky-900/60 transition-colors cursor-pointer"
                                          title="Editar Tasa Waiver / REPO Credicorp ex-post"
                                        >
                                          <Pencil size={11} />
                                        </button>
                                      </div>
                                    ) : (
                                      <span className="text-slate-300 dark:text-slate-700 text-xs">-</span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3 text-center font-mono text-xs text-[#64748b] dark:text-[#94a3b8]">{c.fecha_proyectada_cobro}</td>
                                  <td className="px-4 py-3 text-center">
                                    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[9px] font-mono font-black uppercase ${
                                      c.estado === 'PENDIENTE' 
                                        ? 'bg-[#fffbeb] text-[#d97706] border border-[#fde68a] dark:bg-[#d97706]/20 dark:text-[#fbbf24]' 
                                        : 'bg-[#ecfdf5] text-[#059669] border border-[#a7f3d0] dark:bg-[#059669]/20 dark:text-[#34d399]'
                                    }`}>
                                      ● {c.estado}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-center font-mono font-bold text-[#475569] dark:text-[#cbd5e1]">{c.prioridad}</td>
                                </tr>
                              );
                            })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: PROGRAMAR DEDUCCIÓN */}
          {activeSubTab === 'deduccion' && (
            !selectedContrato ? (
              <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-xl p-8 text-center text-xs font-bold text-amber-700 dark:text-amber-400">
                ⚠️ Por favor, busca y selecciona un contrato activo en el buscador de la parte superior para programar una deducción.
              </div>
            ) : (
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
                        onFocus={(e) => e.target.select()}
                        className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                        value={dedFijoMonto === 0 ? '' : dedFijoMonto}
                        placeholder="0.00"
                        onChange={(e) => setDedFijoMonto(e.target.value === '' ? 0 : (parseFloat(e.target.value) || 0))}
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
                        onFocus={(e) => e.target.select()}
                        className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                        value={dedFijoPeriodos === 0 ? '' : dedFijoPeriodos}
                        placeholder="1"
                        onChange={(e) => setDedFijoPeriodos(e.target.value === '' ? 1 : (parseInt(e.target.value, 10) || 1))}
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
                          onFocus={(e) => e.target.select()}
                          className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                          value={dedMultiCuotas === 0 ? '' : dedMultiCuotas}
                          placeholder="1"
                          onChange={(e) => setDedMultiCuotas(e.target.value === '' ? 1 : (parseInt(e.target.value, 10) || 1))}
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
                          const fPago = isFondoTrimestral(selectedContrato.id_fondo, selectedContrato.frecuencia_cupones_meses) ? 3 : 2;
                          const step = fPago === 3 ? 3 : 2;
                          const baseD = dedMultiFechaInicio ? new Date(dedMultiFechaInicio + 'T00:00:00') : new Date();
                          const armDate = addMonthsEndOfMonth(baseD, i * step);
                          const mVal = dedMultiMontos[i] ?? 100;

                          return (
                            <div key={i} className="bg-slate-50 dark:bg-slate-950 p-2.5 rounded-lg border border-slate-150 dark:border-slate-850 flex flex-col gap-1.5">
                              <span className="text-[8px] font-black text-slate-450 dark:text-slate-500 uppercase">
                                Armada {i + 1} - {armDate.toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: '2-digit' })}
                              </span>
                              <input
                                type="number"
                                min={0}
                                step="any"
                                onFocus={(e) => e.target.select()}
                                className="bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-800 rounded p-1 text-xs font-semibold text-center focus:outline-none"
                                value={mVal === 0 ? '' : mVal}
                                placeholder="0.00"
                                onChange={(e) => {
                                  const val = e.target.value === '' ? 0 : (parseFloat(e.target.value) || 0);
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
                      onFocus={(e) => e.target.select()}
                      className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none w-32"
                      value={dedPrioridad === 0 ? '' : dedPrioridad}
                      placeholder="2"
                      onChange={(e) => setDedPrioridad(e.target.value === '' ? 1 : (parseInt(e.target.value, 10) || 2))}
                      required
                    />
                  </div>

                  <div className="flex flex-col items-end justify-end mt-2">
                    {dedError && <span className="text-[10px] font-bold text-rose-600 mb-2">{dedError}</span>}
                    {dedSuccess && <span className="text-[10px] font-bold text-emerald-600 mb-2 flex items-center gap-1"><CheckCircle size={11} /> {dedSuccess}</span>}
                    
                    <button
                      type="submit"
                      className="h-10 px-6 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-black uppercase tracking-wider cursor-pointer shadow disabled:opacity-50 transition-colors"
                      disabled={dedSubmitting || !dedGlosa.trim()}
                    >
                      {dedSubmitting ? 'Guardando...' : '✅ Crear Plan de Deducciones'}
                    </button>
                  </div>
                </div>

              </form>
            </div>
            )
          )}

          {/* TAB 3: PROGRAMAR RESCATE */}
          {activeSubTab === 'rescate' && (
            !selectedContrato ? (
              <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-xl p-8 text-center text-xs font-bold text-amber-700 dark:text-amber-400">
                ⚠️ Por favor, busca y selecciona un contrato activo en el buscador de la parte superior para programar un rescate.
              </div>
            ) : (
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
                    <strong className="text-xs font-bold text-rose-600 dark:text-rose-450">{fondoRules.penalidad_rescate || 0}%</strong>
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
                      onFocus={(e) => e.target.select()}
                      className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                      value={resArmadasCount === 0 ? '' : resArmadasCount}
                      placeholder="1"
                      onChange={(e) => setResArmadasCount(e.target.value === '' ? 1 : (parseInt(e.target.value, 10) || 1))}
                      required
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-455 dark:text-slate-500 uppercase">Tasa de Interés de Rescate (Waiver) %</label>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      onFocus={(e) => e.target.select()}
                      className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                      value={resTasaWaiver === 0 ? '' : resTasaWaiver}
                      placeholder="0"
                      onChange={(e) => setResTasaWaiver(e.target.value === '' ? 0 : (parseFloat(e.target.value) || 0))}
                      required
                    />
                  </div>
                </div>

                {/* Checkbox Rescate Total */}
                <div className="bg-rose-50/70 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 rounded-xl p-3.5 flex flex-col gap-2">
                  <label className="flex items-center gap-2.5 text-xs font-black text-rose-700 dark:text-rose-400 cursor-pointer">
                    <input
                      type="checkbox"
                      className="w-4 h-4 text-rose-600 rounded focus:ring-rose-500 cursor-pointer"
                      checked={resEsRescateTotal}
                      onChange={(e) => setResEsRescateTotal(e.target.checked)}
                    />
                    <span>☑ Rescate Total (Extinción Completa del Certificado a USD 0.00)</span>
                  </label>
                  <p className="text-[10px] text-rose-600/90 dark:text-rose-400/80 leading-relaxed font-semibold pl-6">
                    Al marcar esta opción, el motor V40 liquidará el 100% de los rendimientos netos acumulados sin recapitalizar, obligando al saldo final del certificado a USD 0.00 para extinguirlo definitivamente en la base de datos.
                  </p>
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
                                onFocus={(e) => e.target.select()}
                                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded p-1.5 text-xs font-semibold text-center focus:outline-none"
                                value={arm.monto === 0 ? '' : arm.monto}
                                placeholder="0.00"
                                onChange={(e) => {
                                  const val = e.target.value === '' ? 0 : (parseFloat(e.target.value) || 0);
                                  const penaltyPct = fondoRules.penalidad_rescate || 0;
                                  setResArmadasData(prev => {
                                    const cpy = [...prev];
                                    cpy[i].monto = val;
                                    cpy[i].penalidad = Math.round(val * (penaltyPct / 100) * 100) / 100;
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
                                onFocus={(e) => e.target.select()}
                                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-855 rounded p-1.5 text-xs font-semibold text-center focus:outline-none"
                                value={arm.penalidad === 0 ? '' : arm.penalidad}
                                placeholder="0.00"
                                onChange={(e) => {
                                  const val = e.target.value === '' ? 0 : (parseFloat(e.target.value) || 0);
                                  setResArmadasData(prev => {
                                    const cpy = [...prev];
                                    cpy[i].penalidad = val;
                                    return cpy;
                                  });
                                }}
                              />
                            </div>
                          </div>

                          {/* Badge Visual de Neto en Efectivo a Devolver */}
                          <div className="p-2 rounded-lg bg-emerald-50/80 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 flex items-center justify-between mt-0.5">
                            <span className="text-[9.5px] font-bold text-emerald-800 dark:text-emerald-300">
                              💵 Neto a Devolver al Inversionista:
                            </span>
                            <span className="font-mono text-xs font-black text-emerald-700 dark:text-emerald-400">
                              {selectedContrato.moneda} {Math.max(0, arm.monto - arm.penalidad).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>

                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col items-end justify-end mt-4 pt-3 border-t border-slate-100 dark:border-slate-850">
                  {resError && <span className="text-[10px] font-bold text-rose-600 mb-2">{resError}</span>}
                  {resSuccess && <span className="text-[10px] font-bold text-emerald-600 mb-2 flex items-center gap-1"><CheckCircle size={11} /> {resSuccess}</span>}

                  <button
                    type="submit"
                    className="h-10 px-6 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-black uppercase tracking-wider cursor-pointer shadow disabled:opacity-50 transition-colors"
                    disabled={resSubmitting || resArmadasData.length === 0}
                  >
                    {resSubmitting ? 'Guardando...' : '✅ Programar Rescate y Penalidades'}
                  </button>
                </div>

              </form>
            </div>
            )
          )}

        </div>

        {/* MODAL PARA EDITAR TASA WAIVER / REPO CREDICORP EX-POST */}
        {editTasaModalOpen && cuotaToEditTasa && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative space-y-4">
              <button 
                onClick={() => setEditTasaModalOpen(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer"
              >
                <X size={18} />
              </button>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-sky-100 dark:bg-sky-950 text-sky-600 dark:text-sky-400 flex items-center justify-center font-bold">
                  <Pencil size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">Editar Tasa Waiver / REPO Credicorp</h3>
                  <p className="text-[11px] text-slate-500 font-mono">{cuotaToEditTasa.id_cuota}</p>
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-950 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                <div className="flex justify-between">
                  <span>Contrato:</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-slate-200">{cuotaToEditTasa.id_contrato}</span>
                </div>
                <div className="flex justify-between">
                  <span>Monto Rescate:</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-slate-200">{cuotaToEditTasa.moneda} {cuotaToEditTasa.monto_cobrar.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between">
                  <span>Corte Cobro:</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-slate-200">{cuotaToEditTasa.fecha_proyectada_cobro}</span>
                </div>
              </div>

              <p className="text-[11px] text-slate-500 leading-relaxed">
                Esta tasa representa el rendimiento efectivo obtenido en Credicorp Capital para depósitos REPO y aplicará al <b>saldo remanente de capital</b> a partir de la fecha de este rescate.
              </p>

              <form onSubmit={handleSaveTasaWaiver} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Nueva Tasa Waiver / REPO (%)</label>
                  <div className="relative">
                    <input
                      type="number"
                      step="any"
                      min={0}
                      max={100}
                      autoFocus
                      className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-sm font-mono font-bold text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-sky-500 focus:outline-none pr-8"
                      value={newTasaValue === 0 ? '' : newTasaValue}
                      placeholder="0.00"
                      onChange={(e) => setNewTasaValue(e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                      required
                    />
                    <span className="absolute right-3 top-3 text-sm font-mono font-bold text-slate-400">%</span>
                  </div>
                </div>

                {tasaSaveError && (
                  <p className="text-xs text-rose-600 font-semibold">{tasaSaveError}</p>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setEditTasaModalOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={savingTasa}
                    className="px-5 py-2 text-xs font-bold bg-sky-600 hover:bg-sky-700 text-white rounded-xl shadow-sm transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {savingTasa ? 'Guardando...' : 'Guardar Tasa Ex-Post'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

    </div>
  );
};
