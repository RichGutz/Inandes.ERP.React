// src/features/mantenimiento/EstilosPage.tsx
import { useState, useEffect } from 'react';
import { 
  Palette, 
  Sun, 
  Moon, 
  Check, 
  RotateCcw, 
  Sparkles, 
  Type, 
  Eye, 
  Sliders, 
  CheckCircle2, 
  XCircle,
  FileSpreadsheet
} from 'lucide-react';
import { applyTheme, getStoredTheme } from '../../styles/theme';

interface AccentColorOption {
  id: string;
  name: string;
  hex: string;
  hoverHex: string;
  bgSoft: string;
  borderSoft: string;
}

const ACCENT_COLORS: AccentColorOption[] = [
  { id: 'sky', name: 'Sky Blue APEFAC (Oficial)', hex: '#0284c7', hoverHex: '#0369a1', bgSoft: '#f0f9ff', borderSoft: '#bae6fd' },
  { id: 'emerald', name: 'Verde Esmeralda', hex: '#059669', hoverHex: '#047857', bgSoft: '#ecfdf5', borderSoft: '#a7f3d0' },
  { id: 'indigo', name: 'Índigo Real', hex: '#4f46e5', hoverHex: '#4338ca', bgSoft: '#eef2ff', borderSoft: '#c7d2fe' },
  { id: 'violet', name: 'Violeta Tecnológico', hex: '#7c3aed', hoverHex: '#6d28d9', bgSoft: '#f5f3ff', borderSoft: '#ddd6fe' },
  { id: 'rose', name: 'Carmesí / Rubí', hex: '#e11d48', hoverHex: '#be123c', bgSoft: '#fff1f2', borderSoft: '#fecdd3' },
  { id: 'amber', name: 'Ámbar Financiero', hex: '#d97706', hoverHex: '#b45309', bgSoft: '#fffbeb', borderSoft: '#fde68a' },
  { id: 'slate', name: 'Slate Minimal', hex: '#475569', hoverHex: '#334155', bgSoft: '#f8fafc', borderSoft: '#cbd5e1' },
];

export const EstilosPage = () => {
  const [currentTheme, setCurrentTheme] = useState<'light' | 'dark'>('light');
  const [selectedAccent, setSelectedAccent] = useState<string>('sky');
  const [tableDensity, setTableDensity] = useState<'compact' | 'comfortable' | 'spacious'>('comfortable');
  const [saveToast, setSaveToast] = useState<boolean>(false);

  useEffect(() => {
    // Leer tema actual
    const theme = getStoredTheme();
    setCurrentTheme(theme);

    // Leer acento guardado
    const savedAccent = localStorage.getItem('inandes_accent_id') || 'sky';
    setSelectedAccent(savedAccent);

    // Leer densidad
    const savedDensity = (localStorage.getItem('inandes_table_density') as any) || 'comfortable';
    setTableDensity(savedDensity);
  }, []);

  const handleThemeChange = (mode: 'light' | 'dark') => {
    setCurrentTheme(mode);
    applyTheme(mode);
    showFeedback();
  };

  const handleAccentChange = (accent: AccentColorOption) => {
    setSelectedAccent(accent.id);
    localStorage.setItem('inandes_accent_id', accent.id);
    localStorage.setItem('inandes_accent_hex', accent.hex);

    // Inyectar variable CSS en el root
    document.documentElement.style.setProperty('--color-primary', accent.hex);
    document.documentElement.style.setProperty('--color-accent', accent.hex);
    document.documentElement.style.setProperty('--color-primary-hover', accent.hoverHex);
    showFeedback();
  };

  const handleDensityChange = (density: 'compact' | 'comfortable' | 'spacious') => {
    setTableDensity(density);
    localStorage.setItem('inandes_table_density', density);
    showFeedback();
  };

  const handleResetDefaults = () => {
    const defaultAccent = ACCENT_COLORS[0];
    handleAccentChange(defaultAccent);
    handleThemeChange('light');
    handleDensityChange('comfortable');
    showFeedback();
  };

  const showFeedback = () => {
    setSaveToast(true);
    setTimeout(() => setSaveToast(false), 2200);
  };

  const activeColorObj = ACCENT_COLORS.find(c => c.id === selectedAccent) || ACCENT_COLORS[0];

  return (
    <div className="flex flex-col gap-6 w-full animate-fadeIn max-w-5xl mx-auto pb-12">
      
      {/* Cabecera del Módulo */}
      <div className="glass-card p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-l-4 border-l-[#0284c7]">
        <div className="flex items-center gap-3">
          <div 
            className="p-3.5 rounded-2xl text-white shadow-md flex items-center justify-center"
            style={{ background: `linear-gradient(135deg, ${activeColorObj.hex} 0%, #4f46e5 100%)` }}
          >
            <Palette size={24} />
          </div>
          <div>
            <h1 className="text-sm font-black text-[#0f172a] dark:text-[#f8fafc] uppercase tracking-wider">
              🎨 Configuración de Estilos & Design System
            </h1>
            <p className="text-xs text-[#64748b] dark:text-[#94a3b8] font-semibold mt-0.5">
              Personaliza el Modo Oscuro, colores corporativos de acento, tipografías y densidad visual del ERP.
            </p>
          </div>
        </div>

        <button
          onClick={handleResetDefaults}
          className="h-9 px-3.5 rounded-xl border border-[#e2e8f0] dark:border-[#334155] bg-white dark:bg-[#1e293b] hover:bg-[#f8fafc] dark:hover:bg-[#334155]/60 text-[#475569] dark:text-[#cbd5e1] text-xs font-bold flex items-center gap-2 cursor-pointer shadow-xs transition-all"
        >
          <RotateCcw size={14} />
          <span>Restablecer APEFAC</span>
        </button>
      </div>

      {/* Grid de Configuración (2 Columnas) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        
        {/* 1. MODO DE TEMA (DARK / LIGHT) */}
        <div className="glass-card p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-[#e2e8f0] dark:border-[#334155] pb-3">
            <div className="flex items-center gap-2">
              <Sun size={16} className="text-[#0284c7] dark:text-[#38bdf8]" />
              <h3 className="text-xs font-black text-[#0f172a] dark:text-[#f8fafc] uppercase tracking-wider">
                1. Apariencia General
              </h3>
            </div>
            <span className="text-[10px] font-mono font-bold text-[#0284c7] uppercase">
              {currentTheme === 'dark' ? '🌙 Modo Oscuro Activo' : '☀️ Modo Claro Activo'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Opción Claro */}
            <button
              type="button"
              onClick={() => handleThemeChange('light')}
              className={`p-4 rounded-xl border-2 flex flex-col items-center justify-center gap-2.5 transition-all cursor-pointer ${
                currentTheme === 'light'
                  ? 'border-[#0284c7] bg-[#f0f9ff] dark:bg-[#0284c7]/15 shadow-sm'
                  : 'border-[#e2e8f0] dark:border-[#334155] bg-white dark:bg-[#1e293b] hover:border-[#bae6fd]'
              }`}
            >
              <div className="p-2.5 rounded-full bg-amber-100 text-amber-600 shadow-xs">
                <Sun size={20} />
              </div>
              <div className="text-center">
                <span className="text-xs font-black text-[#0f172a] dark:text-[#f8fafc] block">Modo Claro</span>
                <span className="text-[10px] text-[#64748b] dark:text-[#94a3b8] font-medium">Contraste luminoso diurno</span>
              </div>
              {currentTheme === 'light' && <Check size={16} className="text-[#0284c7]" />}
            </button>

            {/* Opción Oscuro */}
            <button
              type="button"
              onClick={() => handleThemeChange('dark')}
              className={`p-4 rounded-xl border-2 flex flex-col items-center justify-center gap-2.5 transition-all cursor-pointer ${
                currentTheme === 'dark'
                  ? 'border-[#0284c7] bg-[#0284c7]/15 dark:bg-[#0284c7]/20 shadow-sm'
                  : 'border-[#e2e8f0] dark:border-[#334155] bg-white dark:bg-[#1e293b] hover:border-[#bae6fd]'
              }`}
            >
              <div className="p-2.5 rounded-full bg-slate-800 text-sky-400 shadow-xs">
                <Moon size={20} />
              </div>
              <div className="text-center">
                <span className="text-xs font-black text-[#0f172a] dark:text-[#f8fafc] block">Modo Oscuro</span>
                <span className="text-[10px] text-[#64748b] dark:text-[#94a3b8] font-medium">Descanso visual y OLED</span>
              </div>
              {currentTheme === 'dark' && <Check size={16} className="text-[#0284c7]" />}
            </button>
          </div>
        </div>

        {/* 2. PALETA DE COLOR DE ACENTO */}
        <div className="glass-card p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-[#e2e8f0] dark:border-[#334155] pb-3">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-[#0284c7] dark:text-[#38bdf8]" />
              <h3 className="text-xs font-black text-[#0f172a] dark:text-[#f8fafc] uppercase tracking-wider">
                2. Color de Acento Primario
              </h3>
            </div>
            <span className="text-[10px] font-mono font-bold text-[#64748b] dark:text-[#94a3b8]">
              {activeColorObj.name}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {ACCENT_COLORS.map(color => {
              const isSelected = selectedAccent === color.id;
              return (
                <button
                  key={color.id}
                  type="button"
                  onClick={() => handleAccentChange(color)}
                  className={`p-2.5 rounded-xl border flex items-center gap-2.5 transition-all cursor-pointer ${
                    isSelected
                      ? 'border-[#0284c7] bg-[#f0f9ff] dark:bg-[#0284c7]/15 ring-2 ring-[#0284c7]/30 shadow-xs'
                      : 'border-[#e2e8f0] dark:border-[#334155] bg-white dark:bg-[#1e293b] hover:border-[#bae6fd]'
                  }`}
                >
                  <span 
                    className="w-5 h-5 rounded-full shrink-0 shadow-xs flex items-center justify-center text-white text-[10px]"
                    style={{ backgroundColor: color.hex }}
                  >
                    {isSelected && <Check size={12} />}
                  </span>
                  <div className="flex flex-col text-left min-w-0">
                    <span className="text-[11px] font-black text-[#0f172a] dark:text-[#f8fafc] truncate">
                      {color.name.split(' ')[0]}
                    </span>
                    <span className="text-[9px] font-mono text-[#64748b] dark:text-[#94a3b8]">
                      {color.hex}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. TIPOGRAFÍA Y FUENTES */}
        <div className="glass-card p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-[#e2e8f0] dark:border-[#334155] pb-3">
            <div className="flex items-center gap-2">
              <Type size={16} className="text-[#0284c7] dark:text-[#38bdf8]" />
              <h3 className="text-xs font-black text-[#0f172a] dark:text-[#f8fafc] uppercase tracking-wider">
                3. Tipografía del Sistema
              </h3>
            </div>
            <span className="text-[10px] font-mono font-bold text-[#059669]">
              Google Fonts Conectado
            </span>
          </div>

          <div className="space-y-3">
            <div className="p-3 bg-[#f8fafc] dark:bg-[#151e2e] border border-[#e2e8f0] dark:border-[#334155] rounded-xl flex items-center justify-between">
              <div>
                <span className="text-xs font-black text-[#0f172a] dark:text-[#f8fafc] block font-sans">
                  Inter (Títulos y Textos Generales)
                </span>
                <span className="text-[10px] text-[#64748b] dark:text-[#94a3b8] font-medium">
                  Excelente contraste y legibilidad en pantallas de alta densidad.
                </span>
              </div>
              <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-[#ecfdf5] text-[#059669] border border-[#a7f3d0]">
                Predeterminada
              </span>
            </div>

            <div className="p-3 bg-[#f8fafc] dark:bg-[#151e2e] border border-[#e2e8f0] dark:border-[#334155] rounded-xl flex items-center justify-between">
              <div>
                <span className="text-xs font-black text-[#0f172a] dark:text-[#f8fafc] block font-mono">
                  JetBrains Mono / Consolas (Montos & Tablas)
                </span>
                <span className="text-[10px] text-[#64748b] dark:text-[#94a3b8] font-medium">
                  Números con alineación tabular perfecta (tabular-nums).
                </span>
              </div>
              <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-[#f0f9ff] text-[#0284c7] border border-[#bae6fd]">
                Financiera
              </span>
            </div>
          </div>
        </div>

        {/* 4. DENSIDAD DE TABLAS Y ESPACIADOS */}
        <div className="glass-card p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-[#e2e8f0] dark:border-[#334155] pb-3">
            <div className="flex items-center gap-2">
              <Sliders size={16} className="text-[#0284c7] dark:text-[#38bdf8]" />
              <h3 className="text-xs font-black text-[#0f172a] dark:text-[#f8fafc] uppercase tracking-wider">
                4. Densidad de Tablas
              </h3>
            </div>
            <span className="text-[10px] font-mono font-bold text-[#64748b] dark:text-[#94a3b8] uppercase">
              {tableDensity}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            {[
              { id: 'compact', name: 'Compacta', desc: 'py-2 px-3 (Más filas)' },
              { id: 'comfortable', name: 'Confortable', desc: 'py-3 px-4 (APEFAC)' },
              { id: 'spacious', name: 'Espaciosa', desc: 'py-4 px-5 (Lectura relax)' },
            ].map(d => {
              const isSelected = tableDensity === d.id;
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => handleDensityChange(d.id as any)}
                  className={`p-3 rounded-xl border flex flex-col items-center justify-center text-center gap-1 transition-all cursor-pointer ${
                    isSelected
                      ? 'border-[#0284c7] bg-[#f0f9ff] dark:bg-[#0284c7]/15 shadow-xs'
                      : 'border-[#e2e8f0] dark:border-[#334155] bg-white dark:bg-[#1e293b] hover:border-[#bae6fd]'
                  }`}
                >
                  <span className="text-xs font-black text-[#0f172a] dark:text-[#f8fafc]">{d.name}</span>
                  <span className="text-[9px] text-[#64748b] dark:text-[#94a3b8]">{d.desc}</span>
                  {isSelected && <Check size={14} className="text-[#0284c7] mt-1" />}
                </button>
              );
            })}
          </div>
        </div>

      </div>

      {/* 5. SHOWCASE / PREVISUALIZADOR EN VIVO DEL DESIGN SYSTEM */}
      <div className="glass-card p-6 flex flex-col gap-6">
        <div className="flex items-center justify-between border-b border-[#e2e8f0] dark:border-[#334155] pb-4">
          <div className="flex items-center gap-2">
            <Eye size={18} className="text-[#0284c7] dark:text-[#38bdf8]" />
            <h2 className="text-xs font-black text-[#0f172a] dark:text-[#f8fafc] uppercase tracking-wider">
              5. Previsualizador en Vivo (Showcase de Componentes)
            </h2>
          </div>
          <span className="text-[10px] font-bold text-[#64748b] dark:text-[#94a3b8]">
            Verificación de componentes activos en tiempo real
          </span>
        </div>

        {/* Muestra 1: Botones */}
        <div className="flex flex-col gap-2">
          <span className="text-[10.5px] font-bold text-[#64748b] dark:text-[#94a3b8] uppercase">Botones & Acciones</span>
          <div className="flex flex-wrap items-center gap-3">
            <button 
              className="h-9 px-4 rounded-xl text-white font-bold text-xs shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
              style={{ backgroundColor: activeColorObj.hex }}
            >
              <Sparkles size={14} /> Botón Primario ({activeColorObj.name.split(' ')[0]})
            </button>

            <button className="h-9 px-4 rounded-xl bg-[#059669] hover:bg-[#047857] text-white font-bold text-xs shadow-xs transition-colors cursor-pointer flex items-center gap-1.5">
              <CheckCircle2 size={14} /> Botón Éxito
            </button>

            <button className="h-9 px-4 rounded-xl bg-[#ecfdf5] dark:bg-[#059669]/15 border border-[#a7f3d0] dark:border-[#059669]/30 text-[#059669] dark:text-[#34d399] font-bold text-xs shadow-xs hover:bg-[#d1fae5] transition-colors cursor-pointer flex items-center gap-1.5">
              <FileSpreadsheet size={14} /> Descargar Excel
            </button>

            <button className="h-9 px-4 rounded-xl bg-white dark:bg-[#1e293b] border border-[#e2e8f0] dark:border-[#334155] hover:bg-[#f8fafc] text-[#475569] dark:text-[#cbd5e1] font-bold text-xs shadow-xs transition-colors cursor-pointer">
              Botón Neutro / Outline
            </button>

            <button className="h-9 px-4 rounded-xl bg-[#fef2f2] dark:bg-[#e11d48]/15 border border-[#fecdd3] dark:border-[#e11d48]/30 text-[#e11d48] dark:text-[#fb7185] font-bold text-xs shadow-xs hover:bg-[#fee2e2] transition-colors cursor-pointer flex items-center gap-1.5">
              <XCircle size={14} /> Botón Peligro
            </button>
          </div>
        </div>

        {/* Muestra 2: Badges Semánticos */}
        <div className="flex flex-col gap-2">
          <span className="text-[10.5px] font-bold text-[#64748b] dark:text-[#94a3b8] uppercase">Insignias & Badges Semánticos</span>
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-1 rounded-md text-[10px] font-mono font-bold uppercase bg-[#ecfdf5] text-[#059669] border border-[#a7f3d0] dark:bg-[#059669]/20 dark:text-[#34d399] dark:border-[#059669]/40">
              ● APROBADO / CERRADO
            </span>
            <span className="px-2.5 py-1 rounded-md text-[10px] font-mono font-bold uppercase bg-[#fffbeb] text-[#d97706] border border-[#fde68a] dark:bg-[#d97706]/20 dark:text-[#fbbf24] dark:border-[#d97706]/40">
              ● PENDIENTE / BORRADOR
            </span>
            <span className="px-2.5 py-1 rounded-md text-[10px] font-mono font-bold uppercase bg-[#fef2f2] text-[#e11d48] border border-[#fecdd3] dark:bg-[#e11d48]/20 dark:text-[#fb7185] dark:border-[#e11d48]/40">
              ● RECHAZADO / MORA
            </span>
            <span className="px-2.5 py-1 rounded-md text-[10px] font-mono font-bold uppercase bg-[#f0f9ff] text-[#0284c7] border border-[#bae6fd] dark:bg-[#0284c7]/20 dark:text-[#38bdf8] dark:border-[#0284c7]/40">
              ● EN PROCESO CAVALI
            </span>
          </div>
        </div>

        {/* Muestra 3: Tabla Interactiva con Efecto Hover */}
        <div className="flex flex-col gap-2">
          <span className="text-[10.5px] font-bold text-[#64748b] dark:text-[#94a3b8] uppercase">Tabla Financiera en Vivo</span>
          <div className="overflow-x-auto w-full border border-[#e2e8f0] dark:border-[#334155] rounded-xl">
            <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
              <thead>
                <tr className="bg-[#f8fafc]/50 dark:bg-[#151e2e]/50 border-b border-[#e2e8f0] dark:border-[#334155]">
                  <th className="font-bold text-[#64748b] dark:text-[#94a3b8] px-4 py-3 uppercase tracking-wider text-[10.5px]">Código Operación</th>
                  <th className="font-bold text-[#64748b] dark:text-[#94a3b8] px-4 py-3 uppercase tracking-wider text-[10.5px]">Titular / Cliente</th>
                  <th className="font-bold text-[#64748b] dark:text-[#94a3b8] px-4 py-3 uppercase tracking-wider text-[10.5px] text-center">Moneda</th>
                  <th className="font-bold text-[#64748b] dark:text-[#94a3b8] px-4 py-3 uppercase tracking-wider text-[10.5px] text-right">Monto Nominal</th>
                  <th className="font-bold text-[#64748b] dark:text-[#94a3b8] px-4 py-3 uppercase tracking-wider text-[10.5px] text-right">Abono Neto</th>
                  <th className="font-bold text-[#64748b] dark:text-[#94a3b8] px-4 py-3 uppercase tracking-wider text-[10.5px] text-center">Estado</th>
                </tr>
              </thead>
              <tbody>
                <tr className="table-row-hover border-b border-[#e2e8f0]/60 dark:border-[#334155]/60 transition-colors">
                  <td className="px-4 py-3 font-mono font-bold text-[#0284c7] dark:text-[#38bdf8]">FAC-2026-0819</td>
                  <td className="px-4 py-3 font-semibold text-[#0f172a] dark:text-[#f8fafc]">Inversiones & Construcciones Andinas S.A.C.</td>
                  <td className="px-4 py-3 text-center">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-[#475569] dark:text-[#cbd5e1]">PEN</span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold tabular-nums">S/ 450,000.00</td>
                  <td className="px-4 py-3 text-right font-mono font-black text-[#059669] dark:text-[#34d399] tabular-nums">S/ 432,150.00</td>
                  <td className="px-4 py-3 text-center">
                    <span className="px-2.5 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase bg-[#ecfdf5] text-[#059669] border border-[#a7f3d0]">
                      ● LIQUIDADO
                    </span>
                  </td>
                </tr>
                <tr className="table-row-hover transition-colors">
                  <td className="px-4 py-3 font-mono font-bold text-[#0284c7] dark:text-[#38bdf8]">CTR-NSGUSD-004</td>
                  <td className="px-4 py-3 font-semibold text-[#0f172a] dark:text-[#f8fafc]">Zuzunaga & Asociados Consultores</td>
                  <td className="px-4 py-3 text-center">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-[#475569] dark:text-[#cbd5e1]">USD</span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold tabular-nums">$ 120,000.00</td>
                  <td className="px-4 py-3 text-right font-mono font-black text-[#059669] dark:text-[#34d399] tabular-nums">$ 120,000.00</td>
                  <td className="px-4 py-3 text-center">
                    <span className="px-2.5 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase bg-[#fffbeb] text-[#d97706] border border-[#fde68a]">
                      ● VIGENTE
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Notificación Toast Flotante */}
      {saveToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#0f172a] text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 border border-slate-700 animate-fadeIn">
          <CheckCircle2 size={16} className="text-[#34d399]" />
          <span className="text-xs font-bold">Preferencias visuales actualizadas y guardadas</span>
        </div>
      )}

    </div>
  );
};
