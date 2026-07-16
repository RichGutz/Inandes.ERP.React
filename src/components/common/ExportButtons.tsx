import React from 'react';
import { FileSpreadsheet, FileText } from 'lucide-react';

interface ExportButtonsProps {
    onExportExcel: () => void;
    onExportPDF: () => void;
    disabled?: boolean;
}

export const ExportButtons: React.FC<ExportButtonsProps> = ({ onExportExcel, onExportPDF, disabled }) => {
    return (
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700/50 p-1 rounded-lg border border-slate-200 dark:border-slate-600">
            <button
                onClick={onExportExcel}
                disabled={disabled}
                title="Exportar a Excel"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
                <FileSpreadsheet size={14} />
                <span>XLSX</span>
            </button>
            <div className="w-px h-4 bg-slate-300 dark:bg-slate-600 mx-0.5"></div>
            <button
                onClick={onExportPDF}
                disabled={disabled}
                title="Exportar a PDF"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
                <FileText size={14} />
                <span>PDF</span>
            </button>
        </div>
    );
};
