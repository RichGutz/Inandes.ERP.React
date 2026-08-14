// src/components/common/OmniBuscadorCertificados.tsx
import React, { useState, useEffect, useRef } from 'react';
import { Search, CheckCircle, User, FileText, X, AlertCircle } from 'lucide-react';
import type { CertificadoMaster } from '../../services/certificadosService';

interface OmniBuscadorCertificadosProps {
  certificados: CertificadoMaster[];
  selectedCertId: string;
  onSelectCert: (certId: string, cert?: CertificadoMaster) => void;
  placeholder?: string;
  labelPaso1?: string;
  labelPaso2?: string;
  autoSelectIfSingle?: boolean;
  filterOnlyVigentes?: boolean;
}

const normalizeText = (text: any = ''): string => {
  if (text === null || text === undefined) return '';
  return String(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
};

export const OmniBuscadorCertificados: React.FC<OmniBuscadorCertificadosProps> = ({
  certificados = [],
  selectedCertId = '',
  onSelectCert,
  placeholder = "Escriba DNI, RUC, Nombre del titular o ID del certificado...",
  labelPaso1 = "1. FILTRAR INVERSIONISTA / CERTIFICADO DESTINO",
  labelPaso2 = "2. SELECCIONE CERTIFICADO DESTINO",
  autoSelectIfSingle = true,
  filterOnlyVigentes = true
}) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Filtrar vigentes si aplica con lista protegida contra nulos
  const availableCerts = React.useMemo(() => {
    const safeList = Array.isArray(certificados) ? certificados : [];
    return filterOnlyVigentes 
      ? safeList.filter(c => c && c.estado === 'VIGENTE')
      : safeList.filter(Boolean);
  }, [certificados, filterOnlyVigentes]);

  // Algoritmo Multicriterio OmniBuscador
  const filteredCerts = React.useMemo(() => {
    if (!searchTerm.trim()) return [];

    const normQuery = normalizeText(searchTerm);
    return availableCerts.filter(c => {
      if (!c) return false;

      // 1. ID Certificado e ID Contrato
      if (c.id_certificado && normalizeText(c.id_certificado).includes(normQuery)) return true;
      if (c.id_contrato && normalizeText(c.id_contrato).includes(normQuery)) return true;

      // 2. Fondo
      if (c.id_fondo && normalizeText(c.id_fondo).includes(normQuery)) return true;
      if (c.nombre_fondo && normalizeText(c.nombre_fondo).includes(normQuery)) return true;

      // 3. Titulares 1 al 4
      for (const name of [c.titular_1, c.titular_2, c.titular_3, c.titular_4]) {
        if (name && normalizeText(name).includes(normQuery)) return true;
      }

      // 4. Titulares Resumen (Nombres y Documentos DNI/RUC/CE)
      if (c.titulares_resumen && Array.isArray(c.titulares_resumen)) {
        for (const t of c.titulares_resumen) {
          if (!t) continue;
          if (t.nombre && normalizeText(t.nombre).includes(normQuery)) return true;
          if (t.documento && normalizeText(t.documento).includes(normQuery)) return true;
        }
      }

      return false;
    });
  }, [availableCerts, searchTerm]);


  // Auto-selección si solo hay 1 coincidencia
  useEffect(() => {
    if (autoSelectIfSingle && filteredCerts.length === 1 && searchTerm.trim().length >= 3) {
      const singleCert = filteredCerts[0];
      if (singleCert.id_certificado !== selectedCertId) {
        onSelectCert(singleCert.id_certificado, singleCert);
      }
    }
  }, [filteredCerts, autoSelectIfSingle, searchTerm, selectedCertId, onSelectCert]);

  // Cerrar overlay al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedCertObj = availableCerts.find(c => c.id_certificado === selectedCertId);

  const handleSelect = (cert: CertificadoMaster) => {
    onSelectCert(cert.id_certificado, cert);
    setIsDropdownOpen(false);
  };

  const handleClearSearch = () => {
    setSearchTerm('');
    onSelectCert('');
    setIsDropdownOpen(false);
  };

  return (
    <div ref={containerRef} className="flex flex-col gap-4 w-full">
      {/* PASO 1: OMNIBUSCADOR */}
      <div className="flex flex-col gap-1.5 relative">
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            {labelPaso1}
          </label>
          {searchTerm && (
            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
              {filteredCerts.length} resultado(s) encontrado(s)
            </span>
          )}
        </div>

        <div className="relative">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-450 dark:text-slate-500">
            <Search size={15} />
          </span>
          
          <input
            type="text"
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl py-2.5 pl-9 pr-9 text-xs font-semibold text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 shadow-2xs transition-all"
            placeholder={placeholder}
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setIsDropdownOpen(true);
            }}
            onFocus={() => {
              if (searchTerm.trim()) setIsDropdownOpen(true);
            }}
          />

          {searchTerm && (
            <button
              type="button"
              onClick={handleClearSearch}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
            >
              <X size={15} />
            </button>
          )}
        </div>

        {/* OVERLAY INTERACTIVO DE RESULTADOS RÁPIDOS (AUTOCOMPLETE CARDS) */}
        {isDropdownOpen && searchTerm.trim().length > 0 && (
          <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl max-h-72 overflow-y-auto p-2 flex flex-col gap-1.5 animate-fadeIn">
            {filteredCerts.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-500 font-semibold flex items-center justify-center gap-2">
                <AlertCircle size={15} className="text-amber-500" />
                <span>No se encontraron certificados para "{searchTerm}". Verifique DNI, Nombre o ID.</span>
              </div>
            ) : (
              filteredCerts.map((cert) => {
                const isSelected = cert.id_certificado === selectedCertId;
                const titularDoc = cert.titulares_resumen?.[0]?.documento || 'S/N';

                return (
                  <button
                    key={cert.id_certificado}
                    type="button"
                    onClick={() => handleSelect(cert)}
                    className={`p-3 rounded-lg text-left transition-all cursor-pointer border flex flex-col gap-1 ${
                      isSelected
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 dark:border-emerald-700'
                        : 'bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-800/80 border-slate-150 dark:border-slate-800/80'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileText size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span className="text-xs font-black text-slate-900 dark:text-white uppercase">
                          {cert.id_certificado}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {cert.id_fondo || 'FONDO'}
                        </span>
                      </div>
                      <span className="text-xs font-black text-emerald-700 dark:text-emerald-400">
                        {cert.moneda || 'PEN'} {cert.capital_actual?.toLocaleString('es-PE', { minimumFractionDigits: 2 }) || '0.00'}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-slate-600 dark:text-slate-400 font-medium">
                      <span className="flex items-center gap-1">
                        <User size={12} className="text-slate-400" />
                        <strong className="text-slate-800 dark:text-slate-200">{cert.titular_1 || 'Sin Titular'}</strong>
                      </span>
                      <span>•</span>
                      <span>DNI/RUC: <strong className="font-mono text-slate-800 dark:text-slate-200">{titularDoc}</strong></span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* PASO 2: SELECTOR DINÁMICO RESTRINGIDO */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
          {labelPaso2}
        </label>
        
        <select
          className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-600 cursor-pointer shadow-2xs"
          value={selectedCertId}
          onChange={(e) => {
            const certId = e.target.value;
            const certObj = availableCerts.find(c => c.id_certificado === certId);
            onSelectCert(certId, certObj);
          }}
          required
        >
          {!searchTerm.trim() ? (
            <option value="">-- 🔎 Escriba DNI, Nombre o ID en el Paso 1 para filtrar ({availableCerts.length} certificados disponibles) --</option>
          ) : filteredCerts.length === 0 ? (
            <option value="">-- ❌ Sin coincidencias para "{searchTerm}" --</option>
          ) : (
            <option value="">-- Seleccionar de los {filteredCerts.length} resultados filtrados --</option>
          )}

          {(searchTerm.trim() ? filteredCerts : availableCerts).map(c => {
            const docStr = c.titulares_resumen?.[0]?.documento ? ` (DNI/RUC: ${c.titulares_resumen[0].documento})` : '';
            return (
              <option key={c.id_certificado} value={c.id_certificado}>
                {c.id_certificado} - {c.titular_1}{docStr} - {c.moneda} {c.capital_actual?.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
              </option>
            );
          })}
        </select>
      </div>

      {/* Ficha Resumen del Certificado Seleccionado */}
      {selectedCertObj && (
        <div className="bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 rounded-xl p-3.5 flex items-center justify-between gap-3 animate-fadeIn">
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-black text-emerald-900 dark:text-emerald-300 uppercase tracking-wide flex items-center gap-1">
              <CheckCircle size={13} /> Certificado Destino Seleccionado:
            </span>
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
              {selectedCertObj.id_certificado} — {selectedCertObj.titular_1} (DNI/RUC: {selectedCertObj.titulares_resumen?.[0]?.documento || 'S/N'})
            </span>
          </div>
          <div className="flex flex-col items-end shrink-0">
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Capital Actual</span>
            <span className="text-xs font-black text-emerald-700 dark:text-emerald-400">
              {selectedCertObj.moneda} {selectedCertObj.capital_actual?.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
