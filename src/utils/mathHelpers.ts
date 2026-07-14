/**
 * Redondeo contable estricto a 2 decimales (centavos) utilizando el EPSILON de JavaScript
 * para evitar imprecisiones de coma flotante durante las sumatorias diarias.
 */
export const roundToCents = (num: number): number => {
  return Math.round((num + Number.EPSILON) * 100) / 100;
};

/**
 * Formatea un número como moneda (PEN o USD) con formato de miles y decimales.
 */
export const formatCurrency = (amount: number | null | undefined, currency: string = 'PEN'): string => {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return '-';
  }
  
  const formatter = new Intl.NumberFormat('es-PE', {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const formatted = formatter.format(amount);
  const symbol = currency === 'USD' ? '$' : 'S/';
  
  return `${symbol} ${formatted}`;
};

/**
 * Formatea porcentajes contables (ej. 8.5% o 3.5%).
 */
export const formatPercent = (value: number | null | undefined): string => {
  if (value === null || value === undefined || isNaN(value)) {
    return '-';
  }
  return `${value.toFixed(2)}%`;
};
