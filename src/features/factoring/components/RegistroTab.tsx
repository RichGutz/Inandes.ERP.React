import React, { useState, useEffect, useCallback } from 'react';
import {
  Search, PlusCircle, Save, ArrowLeft,
  RefreshCw, CheckCircle2, AlertCircle, X, Users
} from 'lucide-react';
import { supabase } from '../../../services/supabaseClient';
import { ExportButtons } from '../../../components/common/ExportButtons';
import { exportTableToExcel, exportTableToPDF, type ExportColumn } from '../../../lib/tableExport';

const TABLE = 'EMISORES.ACEPTANTES';

// ─── Tipo completo (73 columnas) ──────────────────────────────────────────────
interface Registro {
  RUC: string;
  TIPO: 'EMISOR' | 'ACEPTANTE' | null;
  RAZON_SOCIAL: string | null;
  'Razon Social'?: string | null;
  SECTOR: string | null;
  GRUPO: string | null;
  // Contacto
  'Correo Electronico 1': string | null;
  'Correo Electronico 2': string | null;
  'Correo Electronico 3': string | null;
  'Correo Electronico 4': string | null;
  CONTACTO_COMERCIAL: string | null;
  CELULAR_CONTACTO: string | null;
  CORREO_CONTACTO: string | null;
  CONTACTO_COBRANZA: string | null;
  CELULAR_COBRANZA: string | null;
  CORREO_COBRANZA: string | null;
  // Financiero
  tasa_avance: string | null;
  dias_minimos_interes: string | null;
  interes_mensual_pen: string | null;
  interes_moratorio_pen: string | null;
  interes_mensual_usd: string | null;
  interes_moratorio_usd: string | null;
  comision_estructuracion_pen: string | null;
  comision_estructuracion_usd: string | null;
  comision_estructuracion_pct: string | null;
  comision_afiliacion_pen: string | null;
  comision_afiliacion_usd: string | null;
  PLAZO_PAGO: string | null;
  LINEA_CREDITO_PEN: string | null;
  LINEA_CREDITO_USD: string | null;
  LINEA_DISPONIBLE_PEN: string | null;
  LINEA_DISPONIBLE_USD: string | null;
  CALIFICACION_RIESGO: string | null;
  FECHA_CALIFICACION: string | null;
  FUENTE_CALIFICACION: string | null;
  // Bancario
  'Institucion Financiera': string | null;
  'Numero de Cuenta PEN': string | null;
  'Numero de CCI PEN': string | null;
  'Numero de Cuenta USD': string | null;
  'Numero de CCI USD': string | null;
  // Domicilios
  DOMICILIO_FISCAL: string | null;
  DEPARTAMENTO: string | null;
  PROVINCIA: string | null;
  DISTRITO: string | null;
  // Garantes / Depositario
  'Depositario 1': string | null;
  'DNI Depositario 1': string | null;
  CORREO_DEPOSITARIO: string | null;
  'Garante/Fiador solidario 1': string | null;
  'DNI Garante/Fiador solidario 1': string | null;
  DOMICILIO_FIADOR1: string | null;
  DEPARTAMENTO_FIADOR1: string | null;
  PROVINCIA_FIADOR1: string | null;
  DISTRITO_FIADOR1: string | null;
  'Garante/Fiador solidario 2': string | null;
  'DNI Garante/Fiador solidario 2': string | null;
  DOMICILIO_FIADOR2: string | null;
  DEPARTAMENTO_FIADOR2: string | null;
  PROVINCIA_FIADOR2: string | null;
  DISTRITO_FIADOR2: string | null;
  'Garante/Fiador solidario 3': string | null;
  'DNI Garante/Fiador solidario 3': string | null;
  DOMICILIO_FIADOR3: string | null;
  DEPARTAMENTO_FIADOR3: string | null;
  PROVINCIA_FIADOR3: string | null;
  DISTRITO_FIADOR3: string | null;
  'Garante/Fiador solidario 4': string | null;
  'DNI Garante/Fiador solidario 4': string | null;
  DOMICILIO_FIADOR4: string | null;
  DEPARTAMENTO_FIADOR4: string | null;
  PROVINCIA_FIADOR4: string | null;
  DISTRITO_FIADOR4: string | null;
  OBSERVACIONES: string | null;
}

const emptyRegistro = (): Registro => ({
  RUC: '', TIPO: 'EMISOR', RAZON_SOCIAL: '', 'Razon Social': '', SECTOR: '', GRUPO: '',
  'Correo Electronico 1': '', 'Correo Electronico 2': '',
  'Correo Electronico 3': '', 'Correo Electronico 4': '',
  CONTACTO_COMERCIAL: '', CELULAR_CONTACTO: '', CORREO_CONTACTO: '',
  CONTACTO_COBRANZA: '', CELULAR_COBRANZA: '', CORREO_COBRANZA: '',
  tasa_avance: '', dias_minimos_interes: '',
  interes_mensual_pen: '', interes_moratorio_pen: '',
  interes_mensual_usd: '', interes_moratorio_usd: '',
  comision_estructuracion_pen: '', comision_estructuracion_usd: '',
  comision_estructuracion_pct: '', comision_afiliacion_pen: '',
  comision_afiliacion_usd: '', PLAZO_PAGO: '',
  LINEA_CREDITO_PEN: '', LINEA_CREDITO_USD: '',
  LINEA_DISPONIBLE_PEN: '', LINEA_DISPONIBLE_USD: '',
  CALIFICACION_RIESGO: '', FECHA_CALIFICACION: '', FUENTE_CALIFICACION: '',
  'Institucion Financiera': '',
  'Numero de Cuenta PEN': '', 'Numero de CCI PEN': '',
  'Numero de Cuenta USD': '', 'Numero de CCI USD': '',
  DOMICILIO_FISCAL: '', DEPARTAMENTO: '', PROVINCIA: '', DISTRITO: '',
  'Depositario 1': '', 'DNI Depositario 1': '', CORREO_DEPOSITARIO: '',
  'Garante/Fiador solidario 1': '', 'DNI Garante/Fiador solidario 1': '',
  DOMICILIO_FIADOR1: '', DEPARTAMENTO_FIADOR1: '', PROVINCIA_FIADOR1: '', DISTRITO_FIADOR1: '',
  'Garante/Fiador solidario 2': '', 'DNI Garante/Fiador solidario 2': '',
  DOMICILIO_FIADOR2: '', DEPARTAMENTO_FIADOR2: '', PROVINCIA_FIADOR2: '', DISTRITO_FIADOR2: '',
  'Garante/Fiador solidario 3': '', 'DNI Garante/Fiador solidario 3': '',
  DOMICILIO_FIADOR3: '', DEPARTAMENTO_FIADOR3: '', PROVINCIA_FIADOR3: '', DISTRITO_FIADOR3: '',
  'Garante/Fiador solidario 4': '', 'DNI Garante/Fiador solidario 4': '',
  DOMICILIO_FIADOR4: '', DEPARTAMENTO_FIADOR4: '', PROVINCIA_FIADOR4: '', DISTRITO_FIADOR4: '',
  OBSERVACIONES: '',
});

// ─── Helpers UI ───────────────────────────────────────────────────────────────
const F: React.FC<{ label: string; children: React.ReactNode; span2?: boolean }> = ({ label, children, span2 }) => (
  <div className={`flex flex-col gap-1 ${span2 ? 'md:col-span-2' : ''}`}>
    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{label}</label>
    {children}
  </div>
);

const TI: React.FC<{
  value: string | null; onChange: (v: string) => void;
  placeholder?: string; disabled?: boolean; mono?: boolean; type?: string;
}> = ({ value, onChange, placeholder, disabled, mono, type = 'text' }) => (
  <input
    type={type}
    value={value ?? ''}
    onChange={e => onChange(e.target.value)}
    disabled={disabled}
    placeholder={placeholder}
    className={`w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 bg-white dark:bg-slate-800 disabled:bg-slate-50 dark:disabled:bg-slate-700/50 disabled:text-slate-400 transition-all ${mono ? 'font-mono tracking-wide' : ''}`}
  />
);

const TA: React.FC<{ value: string | null; onChange: (v: string) => void; placeholder?: string }> = ({ value, onChange, placeholder }) => (
  <textarea
    value={value ?? ''}
    onChange={e => onChange(e.target.value)}
    placeholder={placeholder}
    rows={3}
    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 bg-white dark:bg-slate-800 resize-none transition-all"
  />
);

// ─── Sub-sección de domicilio de fiador ──────────────────────────────────────
const FiadorSection: React.FC<{
  num: number;
  nombre: string | null; dni: string | null;
  dom: string | null; dep: string | null; prov: string | null; dist: string | null;
  onNombre: (v: string) => void; onDni: (v: string) => void;
  onDom: (v: string) => void; onDep: (v: string) => void;
  onProv: (v: string) => void; onDist: (v: string) => void;
}> = ({ num, nombre, dni, dom, dep, prov, dist, onNombre, onDni, onDom, onDep, onProv, onDist }) => (
  <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 flex flex-col gap-3">
    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Garante / Fiador #{num}</p>
    <div className="grid grid-cols-2 gap-3">
      <F label="Nombre"><TI value={nombre} onChange={onNombre} /></F>
      <F label="DNI"><TI value={dni} onChange={onDni} mono /></F>
    </div>
    <F label="Domicilio"><TI value={dom} onChange={onDom} placeholder="Av. Lima 123" /></F>
    <div className="grid grid-cols-3 gap-3">
      <F label="Departamento"><TI value={dep} onChange={onDep} /></F>
      <F label="Provincia"><TI value={prov} onChange={onProv} /></F>
      <F label="Distrito"><TI value={dist} onChange={onDist} /></F>
    </div>
  </div>
);

// ─── FORMULARIO ──────────────────────────────────────────────────────────────
const FORM_TABS = [
  '🏢 Identidad', '📞 Contacto', '💰 Financiero',
  '🏦 Bancario', '🛡️ Garantias', '⚙️ Otros'
];

const RegistroForm: React.FC<{
  initial: Registro; isEdit: boolean;
  onSave: (d: Registro) => Promise<void>;
  onBack: () => void;
  saving: boolean; errorMsg: string | null; successMsg: string | null;
}> = ({ initial, isEdit, onSave, onBack, saving, errorMsg, successMsg }) => {
  const [d, setD] = useState<Registro>(initial);
  const [tab, setTab] = useState(0);
  const f = (field: keyof Registro) => (v: string) => setD(prev => ({ ...prev, [field]: v }));

  return (
    <div className="flex flex-col gap-4">
      {/* Encabezado */}
      <div className="flex items-center gap-3 pb-2 border-b border-slate-200 dark:border-slate-700">
        <button onClick={onBack} className="flex items-center gap-2 px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer">
          <ArrowLeft size={14} /> Volver a Busqueda
        </button>
        <h3 className="text-sm font-black text-slate-700 dark:text-slate-200">
          {isEdit ? `Editar: ${initial.RAZON_SOCIAL || initial['Razon Social']} (${initial.RUC})` : 'Crear Emisor / Aceptante'}
        </h3>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-slate-200 dark:border-slate-700 overflow-x-auto">
        {FORM_TABS.map((label, i) => (
          <button key={i} onClick={() => setTab(i)}
            className={`px-4 py-2.5 text-xs font-bold whitespace-nowrap border-b-2 transition-all cursor-pointer -mb-px ${
              tab === i
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/10'
                : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/30'
            }`}>{label}</button>
        ))}
      </div>

      <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-5">

        {/* TAB 0: IDENTIDAD */}
        {tab === 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <F label="RUC *"><TI value={d.RUC} onChange={f('RUC')} disabled={isEdit} placeholder="20123456789" mono /></F>
            <F label="Tipo *">
              <div className="flex gap-2">
                {(['EMISOR', 'ACEPTANTE'] as const).map(t => (
                  <button key={t} onClick={() => setD(prev => ({ ...prev, TIPO: t }))}
                    className={`flex-1 py-2 rounded-lg text-sm font-bold border transition-all cursor-pointer ${
                      d.TIPO === t ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                        : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-300 dark:border-slate-600 hover:border-emerald-400'
                    }`}>{t}</button>
                ))}
              </div>
            </F>
            <F label="Razon Social *" span2>
              <TI value={d.RAZON_SOCIAL || d['Razon Social'] || ''} onChange={v => { f('RAZON_SOCIAL')(v); f('Razon Social')(v); }} placeholder="EMPRESA EJEMPLO SAC" />
            </F>
            <F label="Sector"><TI value={d.SECTOR} onChange={f('SECTOR')} placeholder="Industria, Comercio..." /></F>
            <F label="Grupo Economico"><TI value={d.GRUPO} onChange={f('GRUPO')} placeholder="Nombre del grupo..." /></F>
          </div>
        )}

        {/* TAB 1: CONTACTO */}
        {tab === 1 && (
          <div className="flex flex-col gap-5">
            <div>
              <p className="text-xs font-black text-slate-600 dark:text-slate-300 mb-3 uppercase tracking-wider">Correos Electronicos</p>
              <div className="grid grid-cols-2 gap-4">
                <F label="Correo 1"><TI value={d['Correo Electronico 1']} onChange={f('Correo Electronico 1')} type="email" /></F>
                <F label="Correo 2"><TI value={d['Correo Electronico 2']} onChange={f('Correo Electronico 2')} type="email" /></F>
                <F label="Correo 3"><TI value={d['Correo Electronico 3']} onChange={f('Correo Electronico 3')} type="email" /></F>
                <F label="Correo 4"><TI value={d['Correo Electronico 4']} onChange={f('Correo Electronico 4')} type="email" /></F>
              </div>
            </div>
            <div>
              <p className="text-xs font-black text-slate-600 dark:text-slate-300 mb-3 uppercase tracking-wider">Contacto Comercial</p>
              <div className="grid grid-cols-3 gap-4">
                <F label="Nombre"><TI value={d.CONTACTO_COMERCIAL} onChange={f('CONTACTO_COMERCIAL')} /></F>
                <F label="Celular"><TI value={d.CELULAR_CONTACTO} onChange={f('CELULAR_CONTACTO')} mono /></F>
                <F label="Correo"><TI value={d.CORREO_CONTACTO} onChange={f('CORREO_CONTACTO')} type="email" /></F>
              </div>
            </div>
            <div>
              <p className="text-xs font-black text-slate-600 dark:text-slate-300 mb-3 uppercase tracking-wider">Contacto Cobranza</p>
              <div className="grid grid-cols-3 gap-4">
                <F label="Nombre"><TI value={d.CONTACTO_COBRANZA} onChange={f('CONTACTO_COBRANZA')} /></F>
                <F label="Celular"><TI value={d.CELULAR_COBRANZA} onChange={f('CELULAR_COBRANZA')} mono /></F>
                <F label="Correo"><TI value={d.CORREO_COBRANZA} onChange={f('CORREO_COBRANZA')} type="email" /></F>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: FINANCIERO */}
        {tab === 2 && (
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <F label="Tasa de Avance (%)"><TI value={d.tasa_avance} onChange={f('tasa_avance')} placeholder="90" /></F>
              <F label="Dias Min. Interes"><TI value={d.dias_minimos_interes} onChange={f('dias_minimos_interes')} placeholder="8" /></F>
              <F label="Plazo de Pago"><TI value={d.PLAZO_PAGO} onChange={f('PLAZO_PAGO')} placeholder="30 dias" /></F>
            </div>
            <div>
              <p className="text-xs font-black text-slate-600 dark:text-slate-300 mb-3 uppercase tracking-wider">Tasas e Intereses</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <F label="Int. Mensual PEN (%)"><TI value={d.interes_mensual_pen} onChange={f('interes_mensual_pen')} /></F>
                <F label="Int. Moratorio PEN (%)"><TI value={d.interes_moratorio_pen} onChange={f('interes_moratorio_pen')} /></F>
                <F label="Int. Mensual USD (%)"><TI value={d.interes_mensual_usd} onChange={f('interes_mensual_usd')} /></F>
                <F label="Int. Moratorio USD (%)"><TI value={d.interes_moratorio_usd} onChange={f('interes_moratorio_usd')} /></F>
              </div>
            </div>
            <div>
              <p className="text-xs font-black text-slate-600 dark:text-slate-300 mb-3 uppercase tracking-wider">Comisiones</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <F label="Com. Estruct. PEN (Flat)"><TI value={d.comision_estructuracion_pen} onChange={f('comision_estructuracion_pen')} /></F>
                <F label="Com. Estruct. USD (Flat)"><TI value={d.comision_estructuracion_usd} onChange={f('comision_estructuracion_usd')} /></F>
                <F label="Com. Estruct. (%)"><TI value={d.comision_estructuracion_pct} onChange={f('comision_estructuracion_pct')} /></F>
                <F label="Com. Afiliacion PEN"><TI value={d.comision_afiliacion_pen} onChange={f('comision_afiliacion_pen')} /></F>
                <F label="Com. Afiliacion USD"><TI value={d.comision_afiliacion_usd} onChange={f('comision_afiliacion_usd')} /></F>
              </div>
            </div>
            <div>
              <p className="text-xs font-black text-slate-600 dark:text-slate-300 mb-3 uppercase tracking-wider">Lineas de Credito</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <F label="Linea PEN"><TI value={d.LINEA_CREDITO_PEN} onChange={f('LINEA_CREDITO_PEN')} /></F>
                <F label="Linea USD"><TI value={d.LINEA_CREDITO_USD} onChange={f('LINEA_CREDITO_USD')} /></F>
                <F label="Disponible PEN"><TI value={d.LINEA_DISPONIBLE_PEN} onChange={f('LINEA_DISPONIBLE_PEN')} /></F>
                <F label="Disponible USD"><TI value={d.LINEA_DISPONIBLE_USD} onChange={f('LINEA_DISPONIBLE_USD')} /></F>
              </div>
            </div>
            <div>
              <p className="text-xs font-black text-slate-600 dark:text-slate-300 mb-3 uppercase tracking-wider">Calificacion de Riesgo</p>
              <div className="grid grid-cols-3 gap-4">
                <F label="Calificacion"><TI value={d.CALIFICACION_RIESGO} onChange={f('CALIFICACION_RIESGO')} placeholder="A, B, C..." /></F>
                <F label="Fecha Calificacion"><TI value={d.FECHA_CALIFICACION} onChange={f('FECHA_CALIFICACION')} type="date" /></F>
                <F label="Fuente"><TI value={d.FUENTE_CALIFICACION} onChange={f('FUENTE_CALIFICACION')} placeholder="SBS, Equifax..." /></F>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: BANCARIO */}
        {tab === 3 && (
          <div className="flex flex-col gap-5">
            <F label="Institucion Financiera"><TI value={d['Institucion Financiera']} onChange={f('Institucion Financiera')} placeholder="BCP, BBVA, Interbank..." /></F>
            <div>
              <p className="text-xs font-black text-slate-600 dark:text-slate-300 mb-3 uppercase tracking-wider">Cuentas en Soles (PEN)</p>
              <div className="grid grid-cols-2 gap-4">
                <F label="Cuenta PEN"><TI value={d['Numero de Cuenta PEN']} onChange={f('Numero de Cuenta PEN')} mono /></F>
                <F label="CCI PEN"><TI value={d['Numero de CCI PEN']} onChange={f('Numero de CCI PEN')} mono /></F>
              </div>
            </div>
            <div>
              <p className="text-xs font-black text-slate-600 dark:text-slate-300 mb-3 uppercase tracking-wider">Cuentas en Dolares (USD)</p>
              <div className="grid grid-cols-2 gap-4">
                <F label="Cuenta USD"><TI value={d['Numero de Cuenta USD']} onChange={f('Numero de Cuenta USD')} mono /></F>
                <F label="CCI USD"><TI value={d['Numero de CCI USD']} onChange={f('Numero de CCI USD')} mono /></F>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: GARANTIAS */}
        {tab === 4 && (
          <div className="flex flex-col gap-5">
            <div>
              <p className="text-xs font-black text-slate-600 dark:text-slate-300 mb-3 uppercase tracking-wider">Depositario</p>
              <div className="grid grid-cols-3 gap-4">
                <F label="Nombre Depositario"><TI value={d['Depositario 1']} onChange={f('Depositario 1')} /></F>
                <F label="DNI Depositario"><TI value={d['DNI Depositario 1']} onChange={f('DNI Depositario 1')} mono /></F>
                <F label="Correo Depositario"><TI value={d.CORREO_DEPOSITARIO} onChange={f('CORREO_DEPOSITARIO')} type="email" /></F>
              </div>
            </div>
            <hr className="border-slate-200 dark:border-slate-700" />
            <FiadorSection
              num={1}
              nombre={d['Garante/Fiador solidario 1']} dni={d['DNI Garante/Fiador solidario 1']}
              dom={d.DOMICILIO_FIADOR1} dep={d.DEPARTAMENTO_FIADOR1} prov={d.PROVINCIA_FIADOR1} dist={d.DISTRITO_FIADOR1}
              onNombre={f('Garante/Fiador solidario 1')} onDni={f('DNI Garante/Fiador solidario 1')}
              onDom={f('DOMICILIO_FIADOR1')} onDep={f('DEPARTAMENTO_FIADOR1')} onProv={f('PROVINCIA_FIADOR1')} onDist={f('DISTRITO_FIADOR1')}
            />
            <FiadorSection
              num={2}
              nombre={d['Garante/Fiador solidario 2']} dni={d['DNI Garante/Fiador solidario 2']}
              dom={d.DOMICILIO_FIADOR2} dep={d.DEPARTAMENTO_FIADOR2} prov={d.PROVINCIA_FIADOR2} dist={d.DISTRITO_FIADOR2}
              onNombre={f('Garante/Fiador solidario 2')} onDni={f('DNI Garante/Fiador solidario 2')}
              onDom={f('DOMICILIO_FIADOR2')} onDep={f('DEPARTAMENTO_FIADOR2')} onProv={f('PROVINCIA_FIADOR2')} onDist={f('DISTRITO_FIADOR2')}
            />
            <FiadorSection
              num={3}
              nombre={d['Garante/Fiador solidario 3']} dni={d['DNI Garante/Fiador solidario 3']}
              dom={d.DOMICILIO_FIADOR3} dep={d.DEPARTAMENTO_FIADOR3} prov={d.PROVINCIA_FIADOR3} dist={d.DISTRITO_FIADOR3}
              onNombre={f('Garante/Fiador solidario 3')} onDni={f('DNI Garante/Fiador solidario 3')}
              onDom={f('DOMICILIO_FIADOR3')} onDep={f('DEPARTAMENTO_FIADOR3')} onProv={f('PROVINCIA_FIADOR3')} onDist={f('DISTRITO_FIADOR3')}
            />
            <FiadorSection
              num={4}
              nombre={d['Garante/Fiador solidario 4']} dni={d['DNI Garante/Fiador solidario 4']}
              dom={d.DOMICILIO_FIADOR4} dep={d.DEPARTAMENTO_FIADOR4} prov={d.PROVINCIA_FIADOR4} dist={d.DISTRITO_FIADOR4}
              onNombre={f('Garante/Fiador solidario 4')} onDni={f('DNI Garante/Fiador solidario 4')}
              onDom={f('DOMICILIO_FIADOR4')} onDep={f('DEPARTAMENTO_FIADOR4')} onProv={f('PROVINCIA_FIADOR4')} onDist={f('DISTRITO_FIADOR4')}
            />
          </div>
        )}

        {/* TAB 5: OTROS */}
        {tab === 5 && (
          <div className="flex flex-col gap-5">
            <div>
              <p className="text-xs font-black text-slate-600 dark:text-slate-300 mb-3 uppercase tracking-wider">Domicilio Fiscal</p>
              <F label="Direccion" span2><TI value={d.DOMICILIO_FISCAL} onChange={f('DOMICILIO_FISCAL')} placeholder="Av. Principal 123, Oficina 501" /></F>
              <div className="grid grid-cols-3 gap-4 mt-3">
                <F label="Departamento"><TI value={d.DEPARTAMENTO} onChange={f('DEPARTAMENTO')} /></F>
                <F label="Provincia"><TI value={d.PROVINCIA} onChange={f('PROVINCIA')} /></F>
                <F label="Distrito"><TI value={d.DISTRITO} onChange={f('DISTRITO')} /></F>
              </div>
            </div>
            <F label="Observaciones">
              <TA value={d.OBSERVACIONES} onChange={f('OBSERVACIONES')} placeholder="Notas internas, acuerdos especiales..." />
            </F>
          </div>
        )}
      </div>

      {/* Mensajes */}
      {errorMsg && (
        <div className="flex items-start gap-2 px-4 py-3 bg-red-50 dark:bg-red-950/20 border border-red-200 rounded-lg text-red-700 text-sm">
          <AlertCircle size={15} className="mt-0.5 shrink-0" /><span>{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div className="flex items-center gap-2 px-4 py-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 rounded-lg text-emerald-700 text-sm">
          <CheckCircle2 size={15} /><span>{successMsg}</span>
        </div>
      )}

      {/* Guardar */}
      <div className="flex justify-end pt-2 border-t border-slate-200 dark:border-slate-700">
        <button
          onClick={() => onSave(d)}
          disabled={saving || !d.RUC || !d['Razon Social']}
          className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white text-sm font-bold rounded-xl transition-all cursor-pointer disabled:cursor-not-allowed shadow-sm"
        >
          {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
          {saving ? 'Guardando...' : 'Guardar Registro'}
        </button>
      </div>
    </div>
  );
};

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────
type Vista = 'busqueda' | 'crear' | 'editar';

export const RegistroTab: React.FC = () => {
  const [vista, setVista] = useState<Vista>('busqueda');
  const [lista, setLista] = useState<{ RUC: string; RAZON_SOCIAL: string | null; 'Razon Social'?: string | null; TIPO: string | null }[]>([]);
  const [selected, setSelected] = useState<Registro | null>(null);
  const [loadingLista, setLoadingLista] = useState(true);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchLista = useCallback(async () => {
    setLoadingLista(true);
    const { data, error } = await supabase
      .from(TABLE)
      .select('*');
    if (error) {
      console.error('Error fetching list from EMISORES.ACEPTANTES:', error.message);
    }
    setLista((data as typeof lista) || []);
    setLoadingLista(false);
  }, []);

  useEffect(() => { fetchLista(); }, [fetchLista]);

  const handleSelectRUC = async (ruc: string) => {
    const { data, error } = await supabase.from(TABLE).select('*').eq('RUC', ruc).single();
    if (error || !data) return;
    setSelected(data as Registro);
    setVista('editar');
    setErrorMsg(null); setSuccessMsg(null);
  };

  const handleSave = async (d: Registro) => {
    const rName = d.RAZON_SOCIAL || d['Razon Social'];
    if (!d.RUC || !rName) { setErrorMsg('RUC y Razon Social son obligatorios.'); return; }
    setSaving(true); setErrorMsg(null); setSuccessMsg(null);
    try {
      const clean = Object.fromEntries(
        Object.entries(d).map(([k, v]) => [k, v === '' ? null : v])
      );
      if (vista === 'editar') {
        const { error } = await supabase.from(TABLE).update(clean).eq('RUC', d.RUC);
        if (error) throw error;
        setSuccessMsg('Registro actualizado correctamente.');
      } else {
        const { error } = await supabase.from(TABLE).insert(clean);
        if (error) throw error;
        setSuccessMsg('Registro creado correctamente.');
      }
      await fetchLista();
      setTimeout(() => { setVista('busqueda'); setSuccessMsg(null); setSelected(null); }, 1800);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error en BD.');
    } finally {
      setSaving(false);
    }
  };

  // ── Vista formulario ────────────────────────────────────────────────────────
  if (vista === 'crear' || vista === 'editar') {
    return (
      <RegistroForm
        initial={vista === 'editar' && selected ? selected : emptyRegistro()}
        isEdit={vista === 'editar'}
        onSave={handleSave}
        onBack={() => { setVista('busqueda'); setErrorMsg(null); setSuccessMsg(null); }}
        saving={saving} errorMsg={errorMsg} successMsg={successMsg}
      />
    );
  }

  // ── Vista busqueda ──────────────────────────────────────────────────────────
  const opciones = lista.filter(e => {
    const name = e.RAZON_SOCIAL || e['Razon Social'] || '';
    const rucStr = String(e.RUC || '');
    return !search || name.toLowerCase().includes(search.toLowerCase()) || rucStr.includes(search);
  });

  const exportColumns: ExportColumn[] = [
    { header: 'RUC', key: 'RUC', type: 'string' },
    { header: 'Razón Social', key: 'RAZON_SOCIAL', type: 'string' },
    { header: 'Tipo', key: 'TIPO', type: 'string' }
  ];

  const handleExportExcel = () => {
    exportTableToExcel('Emisores y Aceptantes', exportColumns, opciones);
  };

  const handleExportPDF = () => {
    exportTableToPDF('Emisores y Aceptantes', exportColumns, opciones);
  };

  return (
    <div className="flex flex-col gap-4 p-1">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar empresa (Nombre o RUC)..."
            className="w-full pl-9 pr-9 py-2.5 text-sm border border-slate-200 dark:border-slate-600 rounded-lg outline-none focus:ring-2 focus:ring-emerald-400 bg-white dark:bg-slate-800" />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer">
              <X size={13} />
            </button>
          )}
        </div>
        <button onClick={() => { setSelected(null); setVista('crear'); setErrorMsg(null); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-lg transition-colors cursor-pointer whitespace-nowrap shadow-sm">
          <PlusCircle size={14} /> Nuevo Registro
        </button>
        <ExportButtons 
          onExportExcel={handleExportExcel} 
          onExportPDF={handleExportPDF} 
          disabled={opciones.length === 0} 
        />
        <button onClick={fetchLista} className="p-2.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg transition-colors cursor-pointer" title="Refrescar">
          <RefreshCw size={14} className={`text-slate-500 ${loadingLista ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm overflow-hidden">
        {loadingLista ? (
          <div className="flex items-center justify-center py-16 gap-3 text-slate-400">
            <RefreshCw size={18} className="animate-spin" /><span className="text-sm">Cargando registros...</span>
          </div>
        ) : opciones.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-slate-400">
            <Users size={36} className="opacity-20" />
            <p className="text-sm font-medium">{search ? `Sin resultados para "${search}"` : 'No hay registros. Crea el primero.'}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-700/50 text-[10px] font-black uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left">RUC</th>
                <th className="px-4 py-3 text-left">Razon Social</th>
                <th className="px-4 py-3 text-left">Tipo</th>
                <th className="px-4 py-3 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {opciones.map(r => (
                <tr key={r.RUC} onClick={() => handleSelectRUC(r.RUC.toString())}
                  className="hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors cursor-pointer">
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{r.RUC}</td>
                  <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">{r.RAZON_SOCIAL || r['Razon Social']}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      r.TIPO === 'EMISOR' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                        : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                    }`}>{r.TIPO ?? 'N/A'}</span>
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-slate-400">Editar →</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loadingLista && opciones.length > 0 && (
          <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-700 text-xs text-slate-400 bg-slate-50 dark:bg-slate-700/30">
            {opciones.length} de {lista.length} registros
          </div>
        )}
      </div>
    </div>
  );
};
