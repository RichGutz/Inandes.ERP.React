// src/utils/contractCycleEngine.ts

export interface ContractCycleParams {
  fechaInicioContrato: string; // YYYY-MM-DD (Fecha real de abono / depósito)
  frecuenciaMeses: number;     // 1, 2, 3, 6, 12 (Frecuencia de cupones / ciclo del fondo)
  plazoMeses: string | number; // '12', '24', '36', '60', 'ND', etc.
  fechaCierreFondo?: string | null; // YYYY-MM-DD si es plazo ND
}

export interface ContractCycleResult {
  fechaInicioContrato: string;      // YYYY-MM-DD
  fechaInicioCiclo: string;         // YYYY-MM-DD
  fechaFinContrato: string;         // YYYY-MM-DD
  esPrimerDiaCiclo: boolean;        // true si abono == día 1 del ciclo
  diasFraccionCicloPrevio: number;  // Días entre inicio de contrato e inicio de ciclo
  duracionTotalDias: number;        // Días totales de vigencia (inclusivo)
  duracionTotalMesesTexto: string;  // Descripción legible del plazo
  ndCalculatedMonths: number;       // Meses calculados para plazos ND
}

/**
 * Parsea una fecha en formato YYYY-MM-DD sin desfases de zona horaria
 */
export const parseIsoDate = (dStr: string): { year: number; month: number; day: number } => {
  if (!dStr) {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth(), day: now.getDate() };
  }
  const clean = dStr.split('T')[0];
  const parts = clean.split('-').map(Number);
  return {
    year: parts[0] || 2026,
    month: (parts[1] ? parts[1] - 1 : 0), // 0-indexed
    day: parts[2] || 1
  };
};

/**
 * Formatea componentes de fecha a YYYY-MM-DD
 */
export const formatIsoDate = (year: number, month: number, day: number): string => {
  const y = String(year).padStart(4, '0');
  const m = String(month + 1).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

/**
 * Motor central de cálculo de fechas y ciclos de contratos
 */
export const calculateContractCycleDates = (params: ContractCycleParams): ContractCycleResult => {
  const { fechaInicioContrato, frecuenciaMeses, plazoMeses, fechaCierreFondo } = params;
  const freq = Math.max(1, Number(frecuenciaMeses) || 1);
  const { year, month, day } = parseIsoDate(fechaInicioContrato);

  // 1. Identificar el mes de inicio del ciclo actual (alineado a inicio de año)
  const cycleStartMonth = Math.floor(month / freq) * freq;
  const isFirstDayOfCycle = (day === 1 && month === cycleStartMonth);

  // 2. Determinar la Fecha de Inicio del Ciclo
  let inicioCicloYear = year;
  let inicioCicloMonth = cycleStartMonth;

  if (!isFirstDayOfCycle) {
    // Si no entró el día 1, el ciclo actual no cuenta. El ciclo formal arranca en el siguiente corte.
    inicioCicloMonth = cycleStartMonth + freq;
    if (inicioCicloMonth >= 12) {
      inicioCicloYear += Math.floor(inicioCicloMonth / 12);
      inicioCicloMonth = inicioCicloMonth % 12;
    }
  }

  const fechaInicioCicloStr = formatIsoDate(inicioCicloYear, inicioCicloMonth, 1);
  const fechaInicioContratoStr = formatIsoDate(year, month, day);

  // 3. Determinar la Fecha de Fin del Contrato
  let fechaFinContratoStr = fechaInicioCicloStr;
  let ndCalculatedMonths = 0;

  if (plazoMeses === 'ND') {
    if (fechaCierreFondo) {
      fechaFinContratoStr = fechaCierreFondo.split('T')[0];
      const endParts = parseIsoDate(fechaFinContratoStr);
      ndCalculatedMonths = Math.max(
        0,
        (endParts.year - year) * 12 + (endParts.month - month)
      );
    } else {
      // Fallback a 12 meses si no hay fecha de cierre
      const endMonth = inicioCicloMonth + 12;
      const endYear = inicioCicloYear + Math.floor(endMonth / 12);
      const endMonthNorm = endMonth % 12;
      const lastDayOfPrevMonth = new Date(endYear, endMonthNorm, 0).getDate();
      fechaFinContratoStr = formatIsoDate(endYear, (endMonthNorm === 0 ? 11 : endMonthNorm - 1), lastDayOfPrevMonth);
      ndCalculatedMonths = 12;
    }
  } else {
    const pMonths = Math.max(1, Number(plazoMeses) || 12);
    // El compromiso de N meses inicia en fechaInicioCiclo (día 1)
    // Concluye en el último día del ciclo que completa los N meses
    const targetEndMonth = inicioCicloMonth + pMonths;
    const targetEndYear = inicioCicloYear + Math.floor(targetEndMonth / 12);
    const targetEndMonthNorm = targetEndMonth % 12;

    // new Date(targetEndYear, targetEndMonthNorm, 0) da el último día del mes inmediatamente anterior
    const lastDayDate = new Date(targetEndYear, targetEndMonthNorm, 0);
    fechaFinContratoStr = formatIsoDate(
      lastDayDate.getFullYear(),
      lastDayDate.getMonth(),
      lastDayDate.getDate()
    );
  }

  // 4. Cálculo de días de fracción y duración total
  const dStartContrato = new Date(year, month, day);
  const dStartCiclo = new Date(inicioCicloYear, inicioCicloMonth, 1);
  const endParts = parseIsoDate(fechaFinContratoStr);
  const dFinContrato = new Date(endParts.year, endParts.month, endParts.day);

  const MS_PER_DAY = 1000 * 60 * 60 * 24;
  const diasFraccionCicloPrevio = isFirstDayOfCycle
    ? 0
    : Math.max(0, Math.round((dStartCiclo.getTime() - dStartContrato.getTime()) / MS_PER_DAY));

  const duracionTotalDias = Math.max(
    1,
    Math.round((dFinContrato.getTime() - dStartContrato.getTime()) / MS_PER_DAY) + 1
  );

  let duracionTotalMesesTexto = '';
  if (plazoMeses === 'ND') {
    duracionTotalMesesTexto = `${ndCalculatedMonths} meses (hasta extinción del fondo)`;
  } else if (isFirstDayOfCycle) {
    duracionTotalMesesTexto = `${plazoMeses} meses de compromiso (exactos)`;
  } else {
    duracionTotalMesesTexto = `${plazoMeses} meses de compromiso + ${diasFraccionCicloPrevio} días de fracción inicial`;
  }

  return {
    fechaInicioContrato: fechaInicioContratoStr,
    fechaInicioCiclo: fechaInicioCicloStr,
    fechaFinContrato: fechaFinContratoStr,
    esPrimerDiaCiclo: isFirstDayOfCycle,
    diasFraccionCicloPrevio,
    duracionTotalDias,
    duracionTotalMesesTexto,
    ndCalculatedMonths
  };
};
