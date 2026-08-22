import ExcelJS from 'exceljs';

async function testGrouping() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('TestGroup');

  ws.views = [{ state: 'frozen', xSplit: 3, ySplit: 1 }];

  // Column definitions
  ws.columns = [
    { header: '#', key: 'n', width: 6 },
    { header: 'Certificado', key: 'cert', width: 25 },
    { header: 'Inversionista', key: 'inv', width: 30 },
    { header: 'Capital Base', key: 'cap', width: 15 },
    // Daily columns (grouped)
    { header: '01/01', key: 'd1', width: 12, outlineLevel: 1, hidden: true },
    { header: '02/01', key: 'd2', width: 12, outlineLevel: 1, hidden: true },
    { header: '03/01', key: 'd3', width: 12, outlineLevel: 1, hidden: true },
    // Summary columns
    { header: 'INT. BRUTO', key: 'bruto', width: 15 },
    { header: 'IR (5%)', key: 'ir', width: 12 },
    { header: 'NETO FINAL', key: 'neto', width: 15 }
  ];

  ws.addRow({
    n: 1, cert: 'NSGPEN01-001', inv: 'Juan Perez', cap: 100000,
    d1: 38.35, d2: 38.35, d3: 38.35,
    bruto: 115.05, ir: 5.75, neto: 109.30
  });

  await wb.xlsx.writeFile('test_group.xlsx');
  console.log('Group test excel created!');
}

testGrouping();
