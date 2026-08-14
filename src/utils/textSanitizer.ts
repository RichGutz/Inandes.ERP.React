/**
 * Sanitiza y repara cadenas de texto que provienen de bases de datos legacy o
 * archivos importados con codificación de caracteres MS-DOS CP850 / Windows-1252 dañada.
 * (Ejemplo: "Bi¢logos" -> "Biólogos", "Nicolás" -> "Nicolás", "Circunvalaci¢n" -> "Circunvalación").
 */
export const sanitizeText = (str?: string | null): string => {
  if (!str) return '';
  let res = String(str);

  const map: Record<string, string> = {
    '\u00a2': 'ó',
    '¢': 'ó',
    '\u0082': 'é',
    '\u00a0': 'á',
    '\u00a1': 'í',
    '\u00a3': 'ú',
    '\u00a4': 'ñ',
    '\u00a5': 'Ñ',
    '\u008f': 'Á',
    '\u0090': 'É',
    '\u0097': 'Ó',
    'Â': '',
    'Ã': ''
  };

  for (const [k, v] of Object.entries(map)) {
    res = res.replaceAll(k, v);
  }

  return res.trim();
};
