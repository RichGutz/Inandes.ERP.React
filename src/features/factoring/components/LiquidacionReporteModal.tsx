import React, { useState, useEffect } from 'react';
import { getApiBaseUrl } from '../../../config/apiConfig';
import { X, Download, Loader2 } from 'lucide-react';

interface LiquidacionReporteModalProps {
  isOpen: boolean;
  onClose: () => void;
  proposalId: string | null;
  fechaPago: string | null; // format YYYY-MM-DD
  montoPago: number | null;
}

export const LiquidacionReporteModal: React.FC<LiquidacionReporteModalProps> = ({
  isOpen,
  onClose,
  proposalId,
  fechaPago,
  montoPago
}) => {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    
    if (isOpen && proposalId && fechaPago && montoPago !== null) {
      setLoading(true);
      setError(null);
      setPdfUrl(null);
      
      const fetchPdf = async () => {
        try {
          const apiBase = getApiBaseUrl();
          const baseOrigin = (apiBase && apiBase.startsWith('http')) 
            ? apiBase 
            : (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8000');

          const endpointPath = `/api/liquidaciones/${encodeURIComponent(proposalId)}/pdf`;
          const url = new URL(endpointPath, baseOrigin);
          if (fechaPago) url.searchParams.append('fecha_pago', fechaPago);
          if (montoPago !== null && montoPago !== undefined) url.searchParams.append('monto_pago', montoPago.toString());

          const res = await fetch(url.toString(), {
            method: 'GET'
          });

          if (!res.ok) {
            let errorMsg = 'Error al generar el PDF';
            try {
              const data = await res.json();
              errorMsg = data.detail || errorMsg;
            } catch (e) {}
            throw new Error(errorMsg);
          }

          const blob = await res.blob();
          const objectUrl = URL.createObjectURL(blob);
          if (active) {
            setPdfUrl(objectUrl);
            setLoading(false);
          }
        } catch (err: any) {
          if (active) {
            setError(err.message || 'Error desconocido');
            setLoading(false);
          }
        }
      };

      fetchPdf();
    }

    return () => {
      active = false;
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [isOpen, proposalId, fechaPago, montoPago]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-5xl h-[90vh] rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50">
          <div>
            <h2 className="text-xl font-bold text-gray-800">Reporte Integral de Liquidación</h2>
            <p className="text-sm text-gray-500">ID: {proposalId}</p>
          </div>
          
          <div className="flex items-center gap-3">
            {pdfUrl && (
              <a 
                href={pdfUrl}
                download={`LIQUIDACION_${proposalId}.pdf`}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm"
              >
                <Download className="w-4 h-4" />
                DESCARGAR PDF OFICIAL
              </a>
            )}
            
            <button 
              onClick={onClose}
              className="p-2 hover:bg-gray-200 rounded-full text-gray-500 hover:text-gray-700 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 bg-gray-100 relative">
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white">
              <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
              <p className="text-gray-600 font-medium">Generando PDF del Reporte Integral...</p>
              <p className="text-gray-400 text-sm mt-1">Calculando tabla maestra diaria e intereses...</p>
            </div>
          )}
          
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white p-6">
              <div className="bg-red-50 text-red-700 p-6 rounded-lg max-w-lg border border-red-200 shadow-sm text-center">
                <h3 className="text-lg font-bold mb-2">Error al generar reporte</h3>
                <p>{error}</p>
                <button 
                  onClick={onClose}
                  className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 font-medium"
                >
                  Cerrar
                </button>
              </div>
            </div>
          )}
          
          {pdfUrl && !loading && (
            <iframe 
              src={`${pdfUrl}#toolbar=0`} 
              className="w-full h-full border-none bg-white"
              title="Reporte de Liquidación PDF"
            />
          )}
        </div>
      </div>
    </div>
  );
};
