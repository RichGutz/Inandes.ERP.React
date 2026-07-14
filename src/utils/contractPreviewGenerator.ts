// src/utils/contractPreviewGenerator.ts
import { CONTRATO_HTML_TEMPLATE, CERTIFICADO_HTML_TEMPLATE } from './contractTemplates';
import { numberToWordsEs } from './numberToWordsEs';

export interface InvestorContext {
  name: string;
  dni: string;
  bank_name?: string;
  bank_acc?: string;
  bank_cci?: string;
}

export interface FundContext {
  nombre_fondo: string;
  ruc_fondo?: string | null;
  moneda: string;
  plazo_opcion_de_rescate_dias?: number | null;
  fecha_cierre_fondo?: string | null;
}

export interface ContractContext {
  monto_inversion: number;
  plazo_meses: string; // '12', '24', '36', '60', 'ND'
  porcentaje_reparto: number;
  fecha_inicio: string; // YYYY-MM-DD
  fecha_fin: string; // YYYY-MM-DD
  nd_calculated_months?: number | null;
  domicilio_contractual?: string | null;
  numero_certificado?: string | null;
  fecha_contrato?: string | null;
}

export interface GeneratorContext {
  investors: InvestorContext[];
  fund: FundContext;
  contract: ContractContext;
  percentages: number[];
  deposits: number[];
  logo_path: string;
}

const mesesNombres = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

const parseDate = (dStr: string): Date => {
  const clean = dStr.split('T')[0];
  const parts = clean.split('-').map(Number);
  return new Date(parts[0], parts[1] - 1, parts[2]);
};

const formatDateLarga = (date: Date): string => {
  return `${date.getDate()} de ${mesesNombres[date.getMonth()]} del ${date.getFullYear()}`;
};

const formatDateVenc = (date: Date): string => {
  return `${date.getDate()} del mes de ${mesesNombres[date.getMonth()]} de ${date.getFullYear()}`;
};

const addMonths = (date: Date, months: number): Date => {
  const result = new Date(date.getFullYear(), date.getMonth() + months, date.getDate());
  // Si el mes se desborda (por ejemplo de 31 de Enero a Febrero)
  const expectedMonth = (date.getMonth() + months) % 12;
  const expectedMonthCorrected = expectedMonth < 0 ? expectedMonth + 12 : expectedMonth;
  if (result.getMonth() !== expectedMonthCorrected) {
    result.setDate(0); // Retorna el último día del mes anterior
  }
  return result;
};

/**
 * Genera el string HTML del contrato
 */
export const generateContractHtml = (context: GeneratorContext): string => {
  try {
    const { investors, fund, contract, percentages, deposits, logo_path } = context;

    const fechaStart = parseDate(contract.fecha_inicio);
    const fechaEnd = parseDate(contract.fecha_fin);
    const fechaFirma = parseDate(contract.fecha_contrato || contract.fecha_inicio);

    const fechaLarga = formatDateLarga(fechaFirma);
    const fechaVencStr = formatDateVenc(fechaEnd);

    // Calcular plazo del contrato en meses
    const plazoValNum = contract.plazo_meses === 'ND' 
      ? (contract.nd_calculated_months || 0)
      : Number(contract.plazo_meses || 0);

    const plazoVal = `${plazoValNum} meses`;
    const plazoLetrasRep = `${numberToWordsEs(plazoValNum)} MESES`;

    // Penalidad y Permanencia Mínima
    let plazoMinimo = "12 meses";
    let penalidadTxt = "1/3 % x mes";
    let mMin = 12;

    if (contract.plazo_meses === "24") {
      plazoMinimo = "12 meses";
      mMin = 12;
    } else if (contract.plazo_meses === "36") {
      plazoMinimo = "18 meses";
      mMin = 18;
    } else if (contract.plazo_meses === "60") {
      plazoMinimo = "30 meses";
      penalidadTxt = "1/4 % x mes";
      mMin = 30;
    }

    const fechaValidezVenta = addMonths(fechaStart, mMin);
    const fechaValidezStr = formatDateVenc(fechaValidezVenta);

    // Titulares
    const partNames = investors.map(i => i.name.toUpperCase());
    const titularNombreFull = partNames.join(" y ");

    const titularRecordsList = investors.map(i => `<b>${i.name.toUpperCase()}</b> identificado(a) con DNI No. <b>${i.dni}</b>`);
    const titularRecordsHtml = titularRecordsList.join("<br>");

    // Bloques para P2, P3, P4
    const pBlocks: Record<number, string> = { 2: "", 3: "", 4: "" };
    for (let i = 2; i <= 4; i++) {
      if (investors.length >= i) {
        const inv = investors[i - 1];
        pBlocks[i] = `<div class="line"></div><b>EL PARTICIPE</b><br><span class="placeholder">${inv.name.toUpperCase()}</span><br>DNI <span class="placeholder">${inv.dni}</span>`;
      }
    }

    // Tablas de Participación y Depósitos
    let htmlTable26 = '<table class="dynamic-table"><thead><tr><th>PARTICIPE</th><th>% PARTICIPACION</th></tr></thead><tbody>';
    investors.forEach((inv, idx) => {
      const p = percentages[idx] || 0;
      htmlTable26 += `<tr><td>${inv.name.toUpperCase()}</td><td>${p.toFixed(2)}%</td></tr>`;
    });
    htmlTable26 += '</tbody></table>';

    let htmlTable47 = '<table class="dynamic-table"><thead><tr><th>PARTICIPE</th><th>% DEPOSITO</th><th>BANCO</th><th>N° CUENTA</th><th>CCI</th></tr></thead><tbody>';
    let addedAnyDep = false;
    investors.forEach((inv, idx) => {
      const d = deposits[idx] || 0;
      if (d > 0) {
        htmlTable47 += `<tr><td>${inv.name.toUpperCase()}</td><td>${d.toFixed(2)}%</td><td>${inv.bank_name || ''}</td><td>${inv.bank_acc || ''}</td><td>${inv.bank_cci || ''}</td></tr>`;
        addedAnyDep = true;
      }
    });
    htmlTable47 += '</tbody></table>';
    if (!addedAnyDep) {
      htmlTable47 = "<p><i>No se han definido destinos de depósito.</i></p>";
    }

    // Texto de Reparto
    const pRep = contract.porcentaje_reparto;
    const distText = pRep === 100
      ? "Los PARTICIPES solicitan que se reparta el 100% de las ganancias producidas por la INVERSIÓN."
      : `Los PARTICIPES solicitan que se reparta el ${pRep}% de las ganancias producidas por la INVERSIÓN y se capitalice el ${100 - pRep}%.`;

    // Monto en Letras
    const monto = contract.monto_inversion || 0;
    const montoInt = Math.floor(monto);
    const montoCent = Math.round((monto - montoInt) * 100);
    const montoLetrasStr = `${numberToWordsEs(montoInt)} y ${String(montoCent).padStart(2, '0')}/100`;

    const monedaIso = fund.moneda || 'PEN';
    const monedaNombre = monedaIso === 'USD' ? "DOLARES DE LOS ESTADOS UNIDOS DE AMERICA" : "SOLES";

    const replacements: Record<string, string> = {
      "{{LOGO_PATH}}": logo_path,
      "{{P1_NOMBRE}}": investors[0]?.name.toUpperCase() || '',
      "{{P1_DNI}}": investors[0]?.dni || '',
      "{{P2_BLOCK}}": pBlocks[2],
      "{{P3_BLOCK}}": pBlocks[3],
      "{{P4_BLOCK}}": pBlocks[4],
      "{{TITULAR_RECORDS}}": titularRecordsHtml,
      "{{TITULAR_DOMICILIO}}": (contract.domicilio_contractual || '').toUpperCase(),
      "{{MONTO_NUM}}": monto.toLocaleString('es-PE', { minimumFractionDigits: 2 }),
      "{{MONTO_LETRAS}}": montoLetrasStr,
      "{{MONEDA_ISO}}": monedaIso,
      "{{MONEDA_NOMBRE}}": monedaNombre,
      "{{PLAZO_MESES}}": plazoVal,
      "{{PLAZO_LETRAS}}": plazoLetrasRep,
      "{{FECHA_CONTRATO_LARGA}}": fechaLarga,
      "{{FONDO_NOMBRE}}": `FONDO DE INVERSIÓN PRIVADO ${fund.nombre_fondo.toUpperCase()}`,
      "{{FONDO_RUC}}": fund.ruc_fondo || 'PENDIENTE',
      "{{LUGAR_FECHA}}": `Lima, ${fechaLarga}`,
      "{{PLAZO_MINIMO_PERMANENCIA}}": plazoMinimo,
      "{{PENALIDAD_PORCENTAJE}}": penalidadTxt,
      "{{FECHA_VENCIMIENTO}}": fechaVencStr,
      "{{PLAZO_RESCATE_DIAS}}": String(fund.plazo_opcion_de_rescate_dias || 90),
      "{{PARTICIPES_LISTA}}": titularNombreFull,
      "{{PARTICIPACION_TABLE}}": htmlTable26,
      "{{DEPOSITO_TABLE}}": htmlTable47,
      "{{DISTRIBUCION_GANANCIAS_TEXT}}": distText,
      "{{FECHA_INICIO_VALIDEZ_VENTA}}": fechaValidezStr,
      "{{NUMERO_CERTIFICADO}}": contract.numero_certificado || 'XXXX'
    };

    let resultHtml = CONTRATO_HTML_TEMPLATE;
    for (const [key, val] of Object.entries(replacements)) {
      resultHtml = resultHtml.replaceAll(key, val);
    }

    return resultHtml;
  } catch (err: any) {
    console.error(err);
    return `<h1>Error al generar contrato: ${err.message}</h1>`;
  }
};

/**
 * Genera el string HTML del certificado de participación
 */
export const generateCertificateHtml = (context: {
  investors: InvestorContext[];
  fund: FundContext;
  contract: ContractContext;
  logo_efi_path: string;
  firma_path: string;
  cert_meta: { fecha_emision: string; id_certificado: string; monto_actual?: number; cuotas_actual?: number };
}): string => {
  try {
    const { investors, fund, contract, logo_efi_path, firma_path, cert_meta } = context;

    const fechaIssue = parseDate(cert_meta.fecha_emision);
    const fechaLarga = formatDateLarga(fechaIssue);

    const titularesList = investors.map(inv => `${inv.name.toUpperCase()}, identificado(a) con DNI ${inv.dni}`);
    const titularesText = titularesList.join(" y/o ");

    const monto = cert_meta.monto_actual !== undefined ? cert_meta.monto_actual : contract.monto_inversion;
    const cuotas = cert_meta.cuotas_actual !== undefined ? cert_meta.cuotas_actual : monto;

    const montoInt = Math.floor(monto);
    const montoCent = Math.round((monto - montoInt) * 100);
    const monedaIso = fund.moneda || 'USD';
    const monedaNombre = monedaIso === 'USD' ? "DOLARES DE LOS ESTADOS UNIDOS DE AMERICA" : "SOLES";
    const montoLetrasStr = `${numberToWordsEs(montoInt)} y ${String(montoCent).padStart(2, '0')}/100 ${monedaNombre}`;

    const replacements: Record<string, string> = {
      "{{LOGO_EFI_PATH}}": logo_efi_path,
      "{{FIRMA_PATH}}": firma_path,
      "{{FONDO_NOMBRE}}": `FONDO DE INVERSIÓN PRIVADO ${fund.nombre_fondo.toUpperCase()}`,
      "{{FONDO_RUC}}": fund.ruc_fondo || 'PENDIENTE',
      "{{CERTIFICADO_NUM}}": cert_meta.id_certificado,
      "{{TITULARES_TEXT}}": titularesText,
      "{{MONEDA_ISO}}": monedaIso,
      "{{MONTO_NUM}}": monto.toLocaleString('es-PE', { minimumFractionDigits: 2 }),
      "{{MONTO_LETRAS}}": montoLetrasStr,
      "{{CUOTAS_NUM}}": cuotas.toLocaleString('es-PE', { minimumFractionDigits: 2 }),
      "{{FECHA_CERTIFICADO_LARGA}}": fechaLarga
    };

    let resultHtml = CERTIFICADO_HTML_TEMPLATE;
    for (const [key, val] of Object.entries(replacements)) {
      resultHtml = resultHtml.replaceAll(key, val);
    }

    return resultHtml;
  } catch (err: any) {
    console.error(err);
    return `<h1>Error al generar certificado: ${err.message}</h1>`;
  }
};
