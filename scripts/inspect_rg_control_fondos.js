import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

const fondo1Path = path.join(process.cwd(), 'Exceles.Ricardo.Gallo', 'Control.De.Fondos', 'FDO NSG MIPYME PEN 01 - Control de Fondos 2026 07.xlsx');
const buf = fs.readFileSync(fondo1Path);
const wb = XLSX.read(buf, { type: 'buffer' });

console.log('Sheets in Control de Fondos PEN 01:', wb.SheetNames);

// Inspect sheet names, especially 'Enero 2026', 'Febrero 2026', 'Valor Cuota' or similar
for (const name of wb.SheetNames.slice(0, 5)) {
  const ws = wb.Sheets[name];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
  console.log(`\n======================================================`);
  console.log(`SHEET: ${name} (Filas: ${data.length})`);
  console.log(`======================================================`);
  // print first 15 rows
  for (let i = 0; i < Math.min(15, data.length); i++) {
    console.log(`Row ${i}:`, JSON.stringify(data[i]?.slice(0, 10)));
  }
}
