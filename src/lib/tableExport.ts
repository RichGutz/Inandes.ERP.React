import * as XLSX from 'xlsx';

export interface ExportColumn {
    header: string;
    key: string;
    type: 'string' | 'number' | 'currency' | 'percent' | 'date' | 'boolean';
    render?: (val: any, row: any) => any;
}

export function exportTableToExcel(title: string, columns: ExportColumn[], data: any[]) {
    // 1. Crear el array de objetos estructurados para SheetJS
    const sheetData = data.map(row => {
        const item: any = {};
        columns.forEach(col => {
            let val = col.render ? col.render(row[col.key], row) : row[col.key];
            if (col.type === 'boolean') {
                val = val ? 'Sí' : 'No';
            }
            item[col.header] = val !== undefined && val !== null ? val : '';
        });
        return item;
    });

    // 2. Crear la hoja (workbook/worksheet)
    const ws = XLSX.utils.json_to_sheet(sheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Datos");

    // 3. Formatear las columnas
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1');

    // Anchos de columna automáticos
    const colWidths = columns.map((col, cIndex) => {
        let maxLen = col.header.length;
        for (let r = range.s.r + 1; r <= range.e.r; r++) {
            const cellRef = XLSX.utils.encode_cell({ r, c: cIndex });
            const cell = ws[cellRef];
            if (cell && cell.v) {
                maxLen = Math.max(maxLen, String(cell.v).length);
            }
        }
        return { wch: maxLen + 4 };
    });
    ws['!cols'] = colWidths;

    // Aplicar los formatos numéricos y alineaciones
    for (let r = range.s.r + 1; r <= range.e.r; r++) {
        columns.forEach((col, cIndex) => {
            const cellRef = XLSX.utils.encode_cell({ r, c: cIndex });
            const cell = ws[cellRef];
            if (!cell) return;

            // Formatear según tipo
            if (col.type === 'number') {
                const num = parseFloat(cell.v);
                if (!isNaN(num)) {
                    cell.t = 'n';
                    cell.v = num;
                    cell.z = '#,##0';
                }
            } else if (col.type === 'currency') {
                const num = parseFloat(cell.v);
                if (!isNaN(num)) {
                    cell.t = 'n';
                    cell.v = num;
                    cell.z = '$#,##0';
                }
            } else if (col.type === 'percent') {
                const num = parseFloat(cell.v);
                if (!isNaN(num)) {
                    cell.t = 'n';
                    cell.v = num / 100;
                    cell.z = '0.0%';
                }
            }
        });
    }

    // Guardar el archivo
    const filename = `${title.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, filename);
}

export function exportTableToPDF(title: string, columns: ExportColumn[], data: any[]) {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return alert('Por favor, permita las ventanas emergentes para descargar el PDF.');

    // Construir cabecera de la tabla
    const headersHtml = columns.map(col => `
        <th class="py-2 px-3 text-xs font-black uppercase text-slate-700 bg-slate-100 border-b border-slate-300 text-left">
            ${col.header}
        </th>
    `).join('');

    // Construir filas de la tabla
    const rowsHtml = data.map((row, idx) => {
        const cellsHtml = columns.map(col => {
            let val = col.render ? col.render(row[col.key], row) : row[col.key];
            if (col.type === 'boolean') {
                val = val ? 'Sí' : 'No';
            }
            if (val === null || val === undefined) val = '-';

            // Formatear texto en la tabla
            let displayVal = val;
            let alignClass = 'text-left';

            if (col.type === 'number') {
                alignClass = 'text-right';
                const num = parseFloat(val);
                if (!isNaN(num)) displayVal = new Intl.NumberFormat('en-US').format(num);
            } else if (col.type === 'currency') {
                alignClass = 'text-right';
                const num = parseFloat(val);
                if (!isNaN(num)) displayVal = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(num);
            } else if (col.type === 'percent') {
                alignClass = 'text-right';
                const num = parseFloat(val);
                if (!isNaN(num)) displayVal = `${num.toFixed(1)}%`;
            }

            return `
                <td class="py-2 px-3 text-xs font-medium text-slate-700 border-b border-slate-200 ${alignClass} tabular-nums">
                    ${displayVal}
                </td>
            `;
        }).join('');

        const rowBg = idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50';
        return `<tr class="${rowBg}">${cellsHtml}</tr>`;
    }).join('');

    const formattedDate = new Date().toLocaleString('es-ES', {
        year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });

    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>${title}</title>
            <meta charset="utf-8">
            <script src="https://cdn.tailwindcss.com"></script>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap');
                body {
                    font-family: 'Outfit', sans-serif;
                }
                @media print {
                    @page {
                        size: landscape;
                        margin: 15mm;
                    }
                    body {
                        margin: 0;
                        -webkit-print-color-adjust: exact;
                    }
                    .no-print {
                        display: none !important;
                    }
                }
            </style>
        </head>
        <body class="bg-white p-6">
            <!-- Barra de control -->
            <div class="no-print mb-6 p-4 bg-slate-100 rounded-xl flex items-center justify-between border border-slate-200">
                <span class="text-xs font-bold text-slate-600 font-sans">Vista previa del reporte en PDF (Orientación recomendada: Horizontal / Paisaje)</span>
                <div class="flex gap-2">
                    <button onclick="window.print()" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg shadow transition-colors">
                        Imprimir / Guardar PDF
                    </button>
                    <button onclick="window.close()" class="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-lg transition-colors">
                        Cerrar Ventana
                    </button>
                </div>
            </div>

            <!-- Reporte -->
            <div class="max-w-full mx-auto">
                <!-- Cabecera de reporte -->
                <div class="flex items-center justify-between border-b-2 border-slate-800 pb-4 mb-6">
                    <div class="flex items-center gap-3">
                        <img src="/assets/Logo.Inandes.MODERNO.png" alt="InAndes" class="h-10 object-contain" />
                        <div class="flex flex-col border-l border-slate-200 pl-3">
                            <span class="text-[10px] font-black text-slate-500 tracking-wider uppercase">INANDES ERP</span>
                            <h1 class="text-lg font-black text-slate-800 uppercase tracking-tight">${title}</h1>
                        </div>
                    </div>
                    <div class="text-right">
                        <span class="text-[10px] font-bold text-slate-400 block">FECHA DE REPORTE</span>
                        <span class="text-xs font-bold text-slate-600">${formattedDate}</span>
                    </div>
                </div>

                <!-- Tabla de Datos -->
                <div class="overflow-x-auto">
                    <table class="min-w-full border border-slate-300 rounded-lg overflow-hidden border-collapse">
                        <thead>
                            <tr>${headersHtml}</tr>
                        </thead>
                        <tbody>
                            ${rowsHtml}
                        </tbody>
                    </table>
                </div>

                <!-- Footer del reporte -->
                <div class="mt-8 flex items-center justify-between border-t border-slate-200 pt-4 text-[10px] font-bold text-slate-400">
                    <span>© ${new Date().getFullYear()} INANDES — Todos los derechos reservados.</span>
                    <a href="https://www.geeksoft.tech" target="_blank" class="flex items-center gap-1.5 hover:opacity-80">
                        <span>Powered by</span>
                        <img src="/Logo.Geeksoft.png" alt="Geeksoft" class="h-4 object-contain" />
                    </a>
                </div>
            </div>
        </body>
        </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
}
