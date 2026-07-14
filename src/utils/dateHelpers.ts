/**
 * Utilidades de control de tiempo y fechas para la lógica contable del CRM.
 */

/**
 * Retorna la diferencia en días completos entre dos fechas.
 */
export const getDaysDifference = (startDate: Date | string, endDate: Date | string): number => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  // Set time to midnight to avoid DST issues
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
};

/**
 * Retorna el nombre de un mes en español (1-12).
 */
export const getMonthName = (monthIdx: number): string => {
  const names = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];
  if (monthIdx < 1 || monthIdx > 12) return 'N/A';
  return names[monthIdx - 1];
};

/**
 * Formatea un Date o string de fecha al formato legible de la UI: DD/MM/YYYY.
 */
export const formatDateUI = (dateInput: Date | string | null | undefined): string => {
  if (!dateInput) return '-';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '-';
  
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  
  return `${day}/${month}/${year}`;
};

/**
 * Retorna el último día de un mes específico para un año dado (para fechas de corte).
 */
export const getLastDayOfMonth = (year: number, month: number): Date => {
  // month is 1-indexed (1 = January, 12 = December)
  return new Date(year, month, 0); // 0th day of next month is last day of current
};

/**
 * Genera una lista de fechas de corte teóricas para un año y una frecuencia específica de meses.
 */
export const getCutDatesForYear = (year: number, frequencyMonths: number): Date[] => {
  const cutDates: Date[] = [];
  for (let m = frequencyMonths; m <= 12; m += frequencyMonths) {
    const lastDay = new Date(year, m, 0);
    cutDates.push(lastDay);
  }
  return cutDates;
};

/**
 * Ubica la fecha de corte teórica MÁS CERCANA O IGUAL a la fecha de referencia hacia adelante.
 * Recrea la función get_closest_cut_after de Python.
 */
export const getClosestCutAfter = (referenceDateInput: Date | string, frequencyMonths: number): Date => {
  const referenceDate = new Date(referenceDateInput);
  referenceDate.setHours(0, 0, 0, 0);
  
  const y = referenceDate.getFullYear();
  
  // Reunimos candidatos del año anterior, año actual y año posterior
  const candidates: Date[] = [
    ...getCutDatesForYear(y - 1, frequencyMonths),
    ...getCutDatesForYear(y, frequencyMonths),
    ...getCutDatesForYear(y + 1, frequencyMonths)
  ];
  
  // Filtramos solo los candidatos que ocurren después o el mismo día
  const validCandidates = candidates.filter(d => {
    d.setHours(0, 0, 0, 0);
    return d.getTime() >= referenceDate.getTime();
  });
  
  if (validCandidates.length > 0) {
    // Retornamos el más pequeño de los candidatos válidos (el más cercano al nacimiento)
    return new Date(Math.min(...validCandidates.map(d => d.getTime())));
  }
  
  return candidates[candidates.length - 1];
};
