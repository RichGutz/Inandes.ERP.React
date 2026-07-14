// src/utils/numberToWordsEs.ts

const UNIDADES = ["", "UN", "DOS", "TRES", "CUATRO", "CINCO", "SEIS", "SIETE", "OCHO", "NUEVE"];
const DECENAS = ["", "DIEZ", "VEINTE", "TREINTA", "CUARENTA", "CINCUENTA", "SESENTA", "SETENTA", "OCHENTA", "NOVENTA"];
const ESPECIALES = ["DIEZ", "ONCE", "DOCE", "TRECE", "CATORCE", "QUINCE", "DIECISEIS", "DIECISIETE", "DIECIOCHO", "DIECINUEVE"];
const CENTENAS = ["", "CIENTO", "DOSCIENTOS", "TRESCIENTOS", "CUATROCIENTOS", "QUINIENTOS", "SEISCIENTOS", "SETECIENTOS", "OCHOCIENTOS", "NOVECIENTOS"];

function leerTresDigitos(n: number): string {
  if (n === 100) return "CIEN";
  
  const c = Math.floor(n / 100);
  const remainder = n % 100;
  let out = CENTENAS[c];
  if (remainder === 0) return out;
  if (out !== "") out += " ";

  if (remainder < 10) {
    out += UNIDADES[remainder];
  } else if (remainder >= 10 && remainder < 20) {
    out += ESPECIALES[remainder - 10];
  } else {
    // 20-99
    const dVal = Math.floor(remainder / 10);
    const uVal = remainder % 10;
    if (dVal === 2) {
      if (uVal === 0) out += "VEINTE";
      else out += "VEINTI" + UNIDADES[uVal];
    } else {
      out += DECENAS[dVal];
      if (uVal > 0) {
        out += " Y " + UNIDADES[uVal];
      }
    }
  }
  return out.trim();
}

/**
 * Convierte un número entero en palabras en español.
 */
export const numberToWordsEs = (num: number): string => {
  if (num === 0) return "CERO";
  
  let n = Math.floor(num);
  let words = "";

  const millones = Math.floor(n / 1000000);
  n = n % 1000000;
  
  const miles = Math.floor(n / 1000);
  n = n % 1000;

  if (millones > 0) {
    if (millones === 1) {
      words += "UN MILLON ";
    } else {
      words += leerTresDigitos(millones) + " MILLONES ";
    }
  }

  if (miles > 0) {
    if (miles === 1) {
      words += "MIL ";
    } else {
      words += leerTresDigitos(miles) + " MIL ";
    }
  }

  if (n > 0) {
    words += leerTresDigitos(n);
  }

  return words.trim();
};
