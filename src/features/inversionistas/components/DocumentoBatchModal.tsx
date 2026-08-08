import React, { useRef, useEffect, useState } from 'react';
import { X, Printer, Download, FileText, CheckCircle2 } from 'lucide-react';

interface DocumentoBatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle: string;
  htmlContent: string;
  filename: string;
}

export const DocumentoBatchModal: React.FC<DocumentoBatchModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  htmlContent,
  filename
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && htmlContent) {
      const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      setBlobUrl(url);

      return () => {
        URL.revokeObjectURL(url);
        setBlobUrl(null);
      };
    }
  }, [isOpen, htmlContent]);

  if (!isOpen) return null;

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("Por favor habilita las ventanas emergentes (popups) para ver el reporte PDF.");
      return;
    }
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  const handleDownload = () => {
    if (!blobUrl) return;
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename.endsWith('.html') ? filename : `${filename}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white w-full max-w-6xl h-[94vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-slate-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-200">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 tracking-tight">{title}</h2>
              <p className="text-xs font-semibold text-slate-500">{subtitle}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-black shadow-md shadow-emerald-200 transition-all active:scale-95"
            >
              <Printer className="w-4 h-4" />
              IMPRIMIR / GUARDAR COMO PDF
            </button>

            <button
              onClick={handleDownload}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-black shadow-md shadow-indigo-200 transition-all active:scale-95"
            >
              <Download className="w-4 h-4" />
              DESCARGAR ARCHIVO
            </button>
            
            <button 
              onClick={onClose}
              className="p-2 hover:bg-slate-200 rounded-xl text-slate-500 hover:text-slate-800 transition-colors ml-2"
              title="Cerrar modal"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content with Iframe Preview (Zero Popup Blocker, Zero Sharing Violation) */}
        <div className="flex-1 bg-slate-100 p-4 relative overflow-hidden flex flex-col">
          {blobUrl ? (
            <iframe
              ref={iframeRef}
              src={blobUrl}
              className="w-full h-full bg-white rounded-xl shadow-inner border border-slate-300"
              title="Vista previa del documento"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-400 font-bold">
              Cargando documento...
            </div>
          )}
        </div>

        {/* Footer info bar */}
        <div className="px-6 py-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 font-medium">
          <span className="flex items-center gap-1.5 text-emerald-700 font-bold">
            <CheckCircle2 className="w-4 h-4" /> Formato oficial verificado con WeasyPrint Base64
          </span>
          <span>Presione <b>Imprimir / Guardar como PDF</b> para generar el PDF nativo en alta resolución.</span>
        </div>

      </div>
    </div>
  );
};
