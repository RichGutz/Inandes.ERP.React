import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

const auditPath = path.join(process.cwd(), 'Reportes_Auditoria_2026-02-28', 'AUDITORIA_OFICIAL_SISTEMA_2026-02-28_PULIDO.xlsx');
const navPath = path.join(process.cwd(), 'reports', 'Reporte_NAV_QC_Ene_Feb_2026.xlsx');

const bufAudit = fs.readFileSync(auditPath);
const wbAudit = XLSX.read(bufAudit, { type: 'buffer' });

const bufNav = fs.readFileSync(navPath);
const wbNav = XLSX.read(bufNav, { type: 'buffer' });

console.log('===============================================================');
console.log('CRUCE EXACTO: AUDITORÍA (RETORNOS V40) VS MOTOR NAV (VALOR CUOTA)');
console.log('===============================================================');

const comparison = [];

for (const navSheet of wbNav.SheetNames) {
  const wsNav = wbNav.Sheets[navSheet];
  const navData = XLSX.utils.sheet_to_json(wsNav);

  // Buscar hoja de auditoría correspondiente
  const auditSheetName = wbAudit.SheetNames.find(s => s.toLowerCase().includes(navSheet.toLowerCase()));
  if (!auditSheetName) continue;

  const wsAudit = wbAudit.Sheets[auditSheetName];
  const auditRows = XLSX.utils.sheet_to_json(wsAudit, { header: 1 });

  // Encontrar fila de totales de auditoría
  const totalRow = auditRows.find(r => r && r[2] && String(r[2]).includes('TOTALES'));

  // Extraer valores de auditoría: Col 5 (Capital Inicial), Col 6 (Interés Bruto), Col 8 (Neto)
  const auditCapIni = totalRow ? Number(totalRow[4] || totalRow[5] || 0) : 0;
  
  // Buscar en NAV las filas de resumen
  const totalCapRow = navData.find(r => r.ITEM === 'TOTAL CAPITAL');
  const navCapIni = totalCapRow ? Number(totalCapRow['01/01'] || 0) : 0;

  const valCuotaFinalRow = navData.find(r => r.ITEM === 'VAL CUOTA FINAL');
  const navVcFinal = valCuotaFinalRow ? Number(valCuotaFinalRow['28/02'] || 0) : 0;

  const patCierreRow = navData.find(r => r.ITEM === 'PATRIMONIO TOTAL CIERRE');
  const navPatCierre = patCierreRow ? Number(patCierreRow['28/02'] || 0) : 0;

  const ganBrutaRow = navData.find(r => r.ITEM === 'GANANCIA TOTAL ACUMULADA');
  const navGanBruta = ganBrutaRow ? Number(ganBrutaRow['28/02'] || 0) : 0;

  const utilNetaRow = navData.find(r => r.ITEM === 'GANANCIA OPERATIVA ACUMULADA');
  const navUtilNeta = utilNetaRow ? Number(utilNetaRow['28/02'] || 0) : 0;

  // Conteo de contratos (filas antes de TOTAL CAPITAL y que no sean aumento)
  const certCount = navData.filter(r => !r.ITEM.startsWith(' ') && !['TOTAL CAPITAL', 'INVERSIONES ORIGINALES', 'INV. ORIGINALES ACUMULADAS', 'CUOTAS ORIGINALES', 'CUOTAS ORIGINALES ACUMULADAS', 'VAL CUOTA INICIAL', 'GANANCIA TOTAL BRUTA', 'GANANCIA TOTAL ACUMULADA', 'PATRIMONIO TOTAL', 'COM. ADMIN (-)', 'COM. ADMIN ACUM. (-)', 'COM. CAPT. (-)', 'COM. CAPT. ACUM. (-)', 'COM. MISC. (-)', 'COM. MISC. ACUM. (-)', 'GANANCIA OPERATIVA', 'GANANCIA OPERATIVA ACUMULADA', 'PATRIMONIO TOTAL CIERRE', 'CUOTA TOTAL CIERRE', 'VAL CUOTA FINAL'].includes(r.ITEM)).length;

  comparison.push({
    fondo: navSheet,
    contratos: certCount,
    nav_patrimonio_01_01: navCapIni.toLocaleString('en-US', { minimumFractionDigits: 2 }),
    nav_patrimonio_28_02: navPatCierre.toLocaleString('en-US', { minimumFractionDigits: 2 }),
    nav_ganancia_bruta_acum: navGanBruta.toLocaleString('en-US', { minimumFractionDigits: 2 }),
    nav_utilidad_neta_acum: navUtilNeta.toLocaleString('en-US', { minimumFractionDigits: 2 }),
    nav_valor_cuota_final: navVcFinal.toFixed(4)
  });
}

console.table(comparison);
