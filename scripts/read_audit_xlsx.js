import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

const auditPath = path.join(process.cwd(), 'Reportes_Auditoria_2026-02-28', 'AUDITORIA_OFICIAL_SISTEMA_2026-02-28_PULIDO.xlsx');
const buf = fs.readFileSync(auditPath);
const wb = XLSX.read(buf, { type: 'buffer' });

console.log('Sheet names in Auditoría Oficial:', wb.SheetNames);

for (const sheetName of wb.SheetNames) {
  const ws = wb.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(ws);
  console.log(`\n======================================================`);
  console.log(`SHEET: ${sheetName} (Filas: ${data.length})`);
  console.log(`======================================================`);
  if (data.length > 0) {
    console.table(data.slice(-2));
  }
}
