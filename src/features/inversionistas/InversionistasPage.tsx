// src/features/inversionistas/InversionistasPage.tsx
import React, { useEffect, useState, useMemo } from 'react';
import { getInversionistas, upsertInversionista } from '../../services/inversionistasService';
import type { Inversionista } from '../../services/inversionistasService';
import { generateRetornosV40 } from '../../utils/financialCalculator';
import { generatePdfBelloConDesglose } from '../../utils/pdfGeneratorBelloConDesglose';
import { supabase } from '../../services/supabaseClient';
import * as XLSX from 'xlsx';
import { 
  Search, Loader2, AlertCircle, RefreshCw, Edit2, UserPlus, 
  FileSpreadsheet, FileText, CheckCircle, AlertTriangle, 
  ShieldCheck, Undo2, X, Calendar, RotateCcw, ExternalLink, Download
} from 'lucide-react';
import { LOGO_INANDES_BASE64, FIRMA_RICARDO_GALLO_BASE64 } from '../../assets/base64Images';

export const InversionistasPage: React.FC = () => {
  // Tabs principales del módulo con persistencia en sessionStorage
  const [activeSubTab, setActiveSubTab] = useState<'datos' | 'retornos_react' | 'documentos'>(() => {
    const saved = sessionStorage.getItem('inv_active_subtab');
    return (saved as 'datos' | 'retornos_react' | 'documentos') || 'retornos_react';
  });

  useEffect(() => {
    sessionStorage.setItem('inv_active_subtab', activeSubTab);
  }, [activeSubTab]);

  // Modal de confirmacion de Rollback
  const [rollbackModalOpen, setRollbackModalOpen] = useState<boolean>(false);
  const [rollbackConfirmText, setRollbackConfirmText] = useState<string>('');
  const [rollbackLoading, setRollbackLoading] = useState<boolean>(false);


  // Estado común de partícipes
  const [inversionistas, setInversionistas] = useState<Inversionista[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedLetter, setSelectedLetter] = useState<string>('TODOS');

  const ALPHABET_AZ = ['TODOS', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'Ñ', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', '#'];

  const getLetterCount = (char: string) => {
    if (char === 'TODOS') return inversionistas.length;
    if (char === '#') {
      return inversionistas.filter(inv => {
        const apellido = (inv.apellido_1 || inv.nombre_completo || 'Z').trim();
        const firstLetter = apellido.normalize("NFD").replace(/[\u0300-\u036f]/g, "").charAt(0).toUpperCase();
        return !/^[A-ZÑ]/.test(firstLetter);
      }).length;
    }
    return inversionistas.filter(inv => {
      const apellido = (inv.apellido_1 || inv.nombre_completo || 'Z').trim();
      const firstLetter = apellido.normalize("NFD").replace(/[\u0300-\u036f]/g, "").charAt(0).toUpperCase();
      return firstLetter === char;
    }).length;
  };

  // Estado del Formulario de Edición/Creación
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [formMode, setFormMode] = useState<'crear' | 'editar'>('crear');
  const [formData, setFormData] = useState<Partial<Inversionista>>({});
  const [formActiveTab, setFormActiveTab] = useState<'identidad' | 'conyuge' | 'laboral' | 'bancario' | 'compliance'>('identidad');
  const [formSubmitError, setFormSubmitError] = useState<string | null>(null);
  const [formSubmitSuccess, setFormSubmitSuccess] = useState<boolean>(false);

  // Estado del Motor de Retornos y Auditoría v40
  const [fondosDisponibles, setFondosDisponibles] = useState<any[]>([]);
  const [v40SelFondo, setV40SelFondo] = useState<string>('TODOS');
  const [v40SelYear, setV40SelYear] = useState<number>(2026);
  const [v40SelCiclo, setV40SelCiclo] = useState<'Bimestre' | 'Trimestre'>('Bimestre');
  const [v40SelNum, setV40SelNum] = useState<number>(1);
  const [cycleDashboard, setCycleDashboard] = useState<any>({ B: {}, Q: {} });

  const [calcLoading, setCalcLoading] = useState<boolean>(false);
  const [calcResult, setCalcResult] = useState<any>(null);
  const [collisionCount, setCollisionCount] = useState<number>(0);
  const [excelDownloaded, setExcelDownloaded] = useState<boolean>(false);
  const [pdfDownloaded, setPdfDownloaded] = useState<boolean>(false);
  const [exportingExcel, setExportingExcel] = useState<boolean>(false);
  const [exportingPdf, setExportingPdf] = useState<boolean>(false);
  const [officialRegisterLoading, setOfficialRegisterLoading] = useState<boolean>(false);
  const [registerSuccessMsg, setRegisterSuccessMsg] = useState<string | null>(null);

  // Estado de Generación Documentos y Visores Duales Estilo Forecast
  const [docFondo, setDocFondo] = useState<string>('TODOS');
  const [docViewMode, setDocViewMode] = useState<'dual' | 'eecc' | 'retenciones'>('dual');
  const [docReloadKey, setDocReloadKey] = useState<number>(Date.now());
  const [docEvents, setDocEvents] = useState<any[]>([]);
  const [docLoading, setDocLoading] = useState<boolean>(false);
  const [downloadingPdf, setDownloadingPdf] = useState<string | null>(null);

  const handleDownloadFastPdf = async (htmlDoc: string, filename: string) => {
    setDownloadingPdf(filename);
    try {
      // Patron EXACTO de Forecast: extraer body+styles, reconstruir HTML limpio
      const bodyContent = htmlDoc
        .replace(/^[\s\S]*?<body[^>]*>/i, '')
        .replace(/<\/body>[\s\S]*$/i, '');
      let headStyles = (htmlDoc.match(/<style[\s\S]*?<\/style>/gi) || []).join('\n');

      // Conservar imagenes, logos y firmas para el PDF oficial
      const printHtml = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">${headStyles}</head><body>${bodyContent}</body></html>`;

      const response = await fetch('https://inandes.react.geeksoft.tech/api/inversionistas/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html: printHtml, filename })
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (err: any) {
      alert(`Error descargando PDF: ${err.message}`);
    } finally {
      setDownloadingPdf(null);
    }
  };

  // Carga inicial
  const fetchDatos = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getInversionistas();
      setInversionistas(data);
    } catch (err: any) {
      setError(err.message || 'Error inesperado al cargar los partícipes.');
    } finally {
      setLoading(false);
    }
  };

  const fetchFondos = async () => {
    try {
      const { data, error } = await supabase.from('crm_fondos').select('*').order('nombre_fondo');
      if (error) throw error;
      
      // Agrupar únicos
      const uniqueFondos: any[] = [];
      const seen = new Set();
      if (data) {
        for (const f of data) {
          if (!seen.has(f.id_fondo)) {
            seen.add(f.id_fondo);
            uniqueFondos.push(f);
          }
        }
      }
      setFondosDisponibles(uniqueFondos);
      if (uniqueFondos.length > 0) {
        setDocFondo(uniqueFondos[0].id_fondo);
      }
    } catch (err: any) {
      console.error('Error cargando fondos:', err.message);
    }
  };

  const fetchCycleDashboard = async (year: number) => {
    try {
      const { data, error } = await supabase
        .from('crm_certificados_eventos')
        .select('id_certificado, fecha_periodo_fin')
        .gte('fecha_periodo_fin', `${year}-01-01`)
        .lte('fecha_periodo_fin', `${year}-12-31`);

      if (error) throw error;

      const dash = {
        B: { 1: [] as string[], 2: [] as string[], 3: [] as string[], 4: [] as string[], 5: [] as string[], 6: [] as string[] },
        Q: { 1: [] as string[], 2: [] as string[], 3: [] as string[], 4: [] as string[] }
      };

      if (data) {
        for (const r of data) {
          const dateFin = new Date(r.fecha_periodo_fin + 'T00:00:00');
          const month = dateFin.getMonth() + 1;
          const fundCode = r.id_certificado.split('.')[0].split('-')[0];

          if (month % 2 === 0) {
            const bIdx = (month / 2) as 1|2|3|4|5|6;
            if (dash.B[bIdx]) dash.B[bIdx].push(fundCode);
          }
          if (month % 3 === 0) {
            const qIdx = (month / 3) as 1|2|3|4;
            if (dash.Q[qIdx]) dash.Q[qIdx].push(fundCode);
          }
        }
      }

      // Eliminar duplicados
      for (let i = 1; i <= 6; i++) {
        dash.B[i as 1|2|3|4|5|6] = Array.from(new Set(dash.B[i as 1|2|3|4|5|6])).sort();
      }
      for (let i = 1; i <= 4; i++) {
        dash.Q[i as 1|2|3|4] = Array.from(new Set(dash.Q[i as 1|2|3|4])).sort();
      }

      setCycleDashboard(dash);
    } catch (err: any) {
      console.error('Error Dashboard Auditoría:', err.message);
    }
  };

  useEffect(() => {
    fetchDatos();
    fetchFondos();
  }, []);

  useEffect(() => {
    fetchCycleDashboard(v40SelYear);
  }, [v40SelYear]);

  // Al cambiar el fondo seleccionado, ajustar el ciclo por defecto
  useEffect(() => {
    if (v40SelFondo !== 'TODOS') {
      const f = fondosDisponibles.find(x => x.id_fondo === v40SelFondo);
      if (f) {
        const frec = Number(f.frecuencia_cupones_meses || 2);
        if (frec === 3) {
          setV40SelCiclo('Trimestre');
        } else {
          setV40SelCiclo('Bimestre');
        }
      }
    }
  }, [v40SelFondo, fondosDisponibles]);

  // --- Lógica del Motor Contable v40 ---
  const getDates = (y: number, t: 'Bimestre' | 'Trimestre', n: number) => {
    let s_m = 1;
    let e_m = 2;
    if (t === 'Bimestre') {
      s_m = (n - 1) * 2 + 1;
      e_m = s_m + 1;
    } else {
      s_m = (n - 1) * 3 + 1;
      e_m = s_m + 2;
    }
    
    const formatD = (year: number, month: number, day: number) => {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    };

    const s_d = formatD(y, s_m, 1);
    
    // Obtener último día del mes final
    const lastDay = new Date(y, e_m, 0).getDate();
    const e_d = formatD(y, e_m, lastDay);

    return { fStart: s_d, fEnd: e_d };
  };

  const { fStart, fEnd } = getDates(v40SelYear, v40SelCiclo, v40SelNum);

  // Verificar colisiones de fecha en DB
  const verificarColision = async (endDate: string) => {
    try {
      const { count, error } = await supabase
        .from('crm_certificados_eventos')
        .select('id_evento', { count: 'exact', head: true })
        .eq('fecha_periodo_fin', endDate);
      
      if (error) throw error;
      setCollisionCount(count || 0);
    } catch (err) {
      console.error("Error al verificar colision:", err);
      setCollisionCount(0);
    }
  };


  useEffect(() => {
    verificarColision(fEnd);
    // Resetear descargas al cambiar de filtro
    setExcelDownloaded(false);
    setPdfDownloaded(false);
    setCalcResult(null);
  }, [v40SelYear, v40SelCiclo, v40SelNum, v40SelFondo]);

  // Carga reactiva de eventos contables para visualización instantánea estilo Forecast
  useEffect(() => {
    if (activeSubTab === 'documentos') {
      const fetchDocEvents = async () => {
        setDocLoading(true);
        try {
          const { data, error } = await supabase
            .from('crm_certificados_eventos')
            .select('*')
            .eq('fecha_periodo_fin', fEnd);
          if (error) throw error;
          setDocEvents(data || []);
        } catch (err: any) {
          console.error('Error cargando eventos para documentos:', err);
        } finally {
          setDocLoading(false);
        }
      };
      fetchDocEvents();
    }
  }, [activeSubTab, fEnd, docReloadKey]);

  // Funciones de formateo para vista previa HTML instantánea
  const formatNumDoc = (val: any) => {
    if (val === undefined || val === null || val === "" || val === "-") return "-";
    try {
      const n = Number(val);
      if (Math.abs(n) < 0.0001) return "-";
      return n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    } catch (e) {
      return String(val);
    }
  };

  const numeroALetrasDoc = (monto: number): string => {
    monto = Math.round(monto * 100) / 100;
    const enteros = Math.floor(monto);
    const centavos = Math.round((monto - enteros) * 100);
    const cc = `${centavos.toString().padStart(2, '0')}/100`;

    const UNI = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
    const DEC = ['', 'DIEZ', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
    const ESP: Record<number, string> = {
      11: 'ONCE', 12: 'DOCE', 13: 'TRECE', 14: 'CATORCE', 15: 'QUINCE',
      16: 'DIECISEIS', 17: 'DIECISIETE', 18: 'DIECIOCHO', 19: 'DIECINUEVE',
      21: 'VEINTIUN', 22: 'VEINTIDOS', 23: 'VEINTITRES', 24: 'VEINTICUATRO',
      25: 'VEINTICINCO', 26: 'VEINTISEIS', 27: 'VEINTISIETE', 28: 'VEINTIOCHO', 29: 'VEINTINUEVE'
    };
    const CEN = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS',
                 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

    const t3 = (n: number): string => {
      if (n === 0) return '';
      if (n === 100) return 'CIEN';
      const c = Math.floor(n / 100);
      const r = n % 100;
      let s = CEN[c] ? CEN[c] + ' ' : '';
      if (r === 0) return s.trim();
      if (ESP[r]) return (s + ESP[r]).trim();
      const d = Math.floor(r / 10);
      const u = r % 10;
      if (d === 0) return (s + UNI[u]).trim();
      if (u === 0) return (s + DEC[d]).trim();
      return (s + `${DEC[d]} Y ${UNI[u]}`).trim();
    };

    if (enteros === 0) return `CERO CON ${cc}`;
    const miles = Math.floor(enteros / 1000);
    const resto = enteros % 1000;
    let txt = '';
    if (miles === 1) txt = 'MIL ';
    else if (miles > 1) txt = `${t3(miles)} MIL `;
    txt += t3(resto);
    return `${txt.trim().toLowerCase()} con ${cc}`;
  };

  const formatDateDisplayDoc = (dStr: string) => {
    if (!dStr) return '';
    const parts = dStr.split('-');
    if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
    return dStr;
  };

  // Generador en Caliente de HTML para EECC (Estilo Forecast)
  const htmlEeccDoc = useMemo(() => {
    const fondosMap = new Map(fondosDisponibles.map(f => [f.id_fondo, f]));
    let filtered = docEvents.filter(e => e.fecha_periodo_fin === fEnd);
    if (docFondo && docFondo !== 'TODOS') {
      filtered = filtered.filter(e => 
        (e.id_certificado && e.id_certificado.startsWith(docFondo)) ||
        (e.id_contrato && e.id_contrato.startsWith(docFondo))
      );
    }

    if (docLoading) {
      return `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:60px;text-align:center;color:#64748b;background:#0f172a;">
        <h3 style="color:#38bdf8;">⚡ Cargando datos del periodo cerrado ${fEnd}...</h3>
      </body></html>`;
    }

    if (filtered.length === 0) {
      return `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:60px;text-align:center;color:#94a3b8;background:#0f172a;">
        <h3 style="color:#f1f5f9;margin-bottom:8px;">No hay asientos contables oficiales para ${docFondo || 'TODOS'} al ${fEnd}</h3>
        <p style="font-size:13px;color:#64748b;">Para visualizar los Estados de Cuenta oficiales, oficialice el periodo en la pestaña Auditoría o seleccione otra fecha.</p>
      </body></html>`;
    }

    const certs = filtered.map(e => {
      const payload = e.payload_asiento || {};
      const fCode = (e.id_contrato || e.id_certificado || '').split('.')[0].split('-')[0];
      const fInfo = fondosMap.get(fCode) || {};
      const fondoNombre = fInfo.nombre_fondo || fCode;
      const moneda = payload.moneda || fInfo.moneda || 'PEN';
      const inversionista = payload.inversionista || 'Inversionista';
      const valorCuota = Number(fInfo.valor_cuota_cierre_periodo || payload.valor_cuota || 1.0);

      return {
        fondo_nombre: fondoNombre,
        fecha_inicio_str: formatDateDisplayDoc(e.fecha_periodo_origen || fStart),
        fecha_fin_str: formatDateDisplayDoc(e.fecha_periodo_fin || fEnd),
        inversionista_nombre: inversionista,
        id_certificado: e.id_contrato || e.id_certificado,
        moneda: moneda,
        capital_inicial: Number(e.capital_base || 0),
        bruto_total: Number(e.interes_generado_bruto || 0),
        impuesto: Number(e.impuestos_renta || 0),
        deducciones: Number(e.monto_deduccion || 0),
        neto_disponible: Number(e.interes_neto_disponible || 0),
        capitalizacion: Number(e.monto_capitalizacion || 0),
        rescates: Number(e.monto_rescate || 0),
        monto_transferido: Number(e.monto_reparto || 0) + Number(e.monto_rescate || 0),
        capital_final: Number(e.capital_final_saldo || 0),
        valor_cuota: valorCuota
      };
    });

    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Estado de Cuenta</title>
  <style>
    @page { size: A4 portrait; margin: 0; }
    body { font-family: sans-serif; font-size: 10pt; line-height: 1.4; color: #1e293b; margin: 0; padding: 10mm; background: #ffffff; box-sizing: border-box; }
    .sheet { background: #ffffff; padding: 20px 30px; margin: 0 0 10mm 0; max-width: 100%; width: 100%; box-shadow: none; border-radius: 0; border: none; page-break-after: always; box-sizing: border-box; }
    .header { width: 100%; margin-bottom: 25px; }
    .header table { width: 100%; border: none; }
    .header td { vertical-align: middle; border: none; }
    .logo-container { width: 100%; text-align: right; }
    .logo-container img { max-width: 160px; max-height: 80px; }
    .title-box { text-align: center; margin-bottom: 25px; }
    .title-box h1 { font-size: 11pt; font-weight: 800; margin: 0; line-height: 1.35; text-transform: uppercase; color: #0f172a; }
    .client-info { width: 100%; margin-bottom: 25px; font-size: 10pt; }
    .client-info p { margin: 3px 0; }
    .client-name { font-weight: 800; color: #0f172a; margin-left: 15px; }
    .financial-data { width: 100%; margin-bottom: 25px; }
    .fin-table { width: 100%; border-collapse: collapse; }
    .fin-table td { padding: 4px 0; border: none; font-size: 9.5pt; }
    .col-label { width: 65%; }
    .col-currency { width: 10%; text-align: center; font-weight: 600; color: #64748b; }
    .col-amount { width: 25%; text-align: right; padding-right: 10px; font-variant-numeric: tabular-nums; }
    .bold { font-weight: 800; color: #0f172a; }
    .spacer-row td { padding: 6px 0; }
    .totals-section { width: 100%; margin-top: 30px; margin-bottom: 30px; border: 2px solid #0f172a; padding: 12px; box-sizing: border-box; background: #fafafa; border-radius: 4px; }
    .footer { font-size: 8pt; margin-top: 40px; text-align: center; color: #0d47a1; border-top: 1px solid #e2e8f0; padding-top: 10px; }
    .footer p { margin: 2px 0; }
    .logo-inandes-img { display: block; width: 160px; height: 70px; background-image: url("data:image/png;base64,${LOGO_INANDES_BASE64}"); background-size: contain; background-repeat: no-repeat; background-position: right center; margin-left: auto; }
  </style>
</head>
<body>
  ${certs.map(row => `
    <div class="sheet">
      <div class="header">
        <table>
          <tr>
            <td class="logo-container">
              <div class="logo-inandes-img"></div>
            </td>
          </tr>
        </table>
      </div>

      <div class="title-box">
        <h1>ESTADO DE CUENTA DEL FONDO ${row.fondo_nombre}</h1>
        <h1 style="font-size: 10pt; color: #475569; margin-top: 4px;">FONDO DE INVERSION PRIVADO &nbsp;&nbsp;DEL ${row.fecha_inicio_str} AL ${row.fecha_fin_str}</h1>
      </div>

      <div class="client-info">
        <p style="color: #64748b; font-size: 9pt;">Sr(a)(s):</p>
        <p class="client-name">${row.inversionista_nombre}</p>
        <p style="margin-top: 8px; font-size: 9pt; color: #64748b;">Certificado N°: <strong style="color:#0f172a;">${row.id_certificado}</strong></p>
      </div>

      <div class="financial-data">
        <table class="fin-table">
          <tr>
            <td class="col-label">Monto inicial invertido:</td>
            <td class="col-currency">${row.moneda}</td>
            <td class="col-amount">${formatNumDoc(row.capital_inicial)}</td>
          </tr>
          <tr>
            <td class="col-label">Ganancia bruta obtenida:</td>
            <td class="col-currency">${row.moneda}</td>
            <td class="col-amount">${formatNumDoc(row.bruto_total)}</td>
          </tr>
          <tr class="spacer-row"><td colspan="3"></td></tr>

          <tr>
            <td class="col-label">(-) Impuesto a la renta retenido</td>
            <td class="col-currency">${row.moneda}</td>
            <td class="col-amount">${formatNumDoc(row.impuesto)}</td>
          </tr>
          <tr>
            <td class="col-label">(-) Deducciones</td>
            <td class="col-currency">${row.moneda}</td>
            <td class="col-amount">${formatNumDoc(row.deducciones)}</td>
          </tr>
          <tr>
            <td class="col-label bold">Ganancia disponible al inversionista</td>
            <td class="col-currency bold">${row.moneda}</td>
            <td class="col-amount bold">${formatNumDoc(row.neto_disponible)}</td>
          </tr>
          <tr class="spacer-row"><td colspan="3"></td></tr>

          <tr>
            <td class="col-label">Ganancias capitalizadas para adquirir nuevas cuotas</td>
            <td class="col-currency">${row.moneda}</td>
            <td class="col-amount">${formatNumDoc(row.capitalizacion)}</td>
          </tr>

          <tr>
            <td class="col-label">Rescates</td>
            <td class="col-currency">${row.moneda}</td>
            <td class="col-amount">${formatNumDoc(row.rescates)}</td>
          </tr>

          <tr>
            <td class="col-label bold">Monto transferido a su cuenta bancaria</td>
            <td class="col-currency bold">${row.moneda}</td>
            <td class="col-amount bold">${formatNumDoc(row.monto_transferido)}</td>
          </tr>
        </table>
      </div>

      <div class="totals-section">
        <table class="fin-table">
          <tr>
            <td class="col-label bold">Monto de la inversión al ${row.fecha_fin_str}</td>
            <td class="col-currency">${row.moneda}</td>
            <td class="col-amount bold">${formatNumDoc(row.capital_final)}</td>
          </tr>
          <tr>
            <td class="col-label bold">Valor cuota al ${row.fecha_fin_str}</td>
            <td class="col-currency">${row.moneda}</td>
            <td class="col-amount bold">${formatNumDoc(row.valor_cuota)}</td>
          </tr>
          <tr>
            <td class="col-label bold">Número de cuotas al ${row.fecha_fin_str}</td>
            <td class="col-currency">CUOTAS</td>
            <td class="col-amount bold">${formatNumDoc(row.valor_cuota ? row.capital_final / row.valor_cuota : 0)}</td>
          </tr>
        </table>
      </div>

      <div class="footer">
        <p><strong>INANDES ACTIVOS ALTERNATIVOS SAC</strong> | Los Tulipanes 147 oficina 306, Santiago de Surco, Lima | Teléfono: + (511) 7121700 | info@inandes.com</p>
      </div>
    </div>
  `).join('')}
</body>
</html>`;
  }, [docEvents, fondosDisponibles, docFondo, fStart, fEnd, docLoading]);

  // Generador en Caliente de HTML para Retenciones (Estilo Forecast)
  const htmlRetencionesDoc = useMemo(() => {
    const fondosMap = new Map(fondosDisponibles.map(f => [f.id_fondo, f]));
    let filtered = docEvents.filter(e => e.fecha_periodo_fin === fEnd && Number(e.impuestos_renta || 0) > 0);
    if (docFondo && docFondo !== 'TODOS') {
      filtered = filtered.filter(e => 
        (e.id_certificado && e.id_certificado.startsWith(docFondo)) ||
        (e.id_contrato && e.id_contrato.startsWith(docFondo))
      );
    }

    if (docLoading) {
      return `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:60px;text-align:center;color:#64748b;background:#0f172a;">
        <h3 style="color:#38bdf8;">⚡ Cargando certificados de retención...</h3>
      </body></html>`;
    }

    if (filtered.length === 0) {
      return `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:60px;text-align:center;color:#94a3b8;background:#0f172a;">
        <h3 style="color:#f1f5f9;margin-bottom:8px;">No hay certificados con retención > 0 para ${docFondo || 'TODOS'} al ${fEnd}</h3>
        <p style="font-size:13px;color:#64748b;">Los certificados se generan automáticamente para aquellos partícipes con retención de Impuesto a la Renta de 2da Categoría.</p>
      </body></html>`;
    }

    const TC_USD_PEN = 3.662;
    const hoy = new Date();
    const meses_es = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
                      'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    const dia_hoy = hoy.getDate();
    const mes_hoy = meses_es[hoy.getMonth()];
    const anio_hoy = hoy.getFullYear();

    const findInvDoc = (nombre: string) => {
      if (!nombre) return { dni: '', direccion: 'Domicilio no registrado' };
      const n = nombre.toUpperCase().trim();
      for (const inv of inversionistas) {
        const comp = (inv.nombre_completo || '').toUpperCase().trim();
        if (comp && (n.includes(comp) || comp.includes(n))) {
          return { dni: inv.documento_identidad || '', direccion: inv.direccion_fiscal || 'Domicilio no registrado' };
        }
        const n1 = (inv.nombre_1 || '').toUpperCase();
        const a1 = (inv.apellido_1 || '').toUpperCase();
        if (n1 && a1 && n.includes(n1) && n.includes(a1)) {
          return { dni: inv.documento_identidad || '', direccion: inv.direccion_fiscal || 'Domicilio no registrado' };
        }
      }
      return { dni: '', direccion: 'Domicilio no registrado' };
    };

    const certs = filtered.map(e => {
      const payload = e.payload_asiento || {};
      const fCode = (e.id_contrato || e.id_certificado || '').split('.')[0].split('-')[0];
      const fInfo = fondosMap.get(fCode) || {};
      const fondoNombre = fInfo.nombre_fondo || fCode;
      const moneda = payload.moneda || fInfo.moneda || 'PEN';
      const inversionista = payload.inversionista || 'Inversionista';
      const invDetails = findInvDoc(inversionista);

      const impuestoRaw = Number(e.impuestos_renta || 0);
      const irPen = moneda === 'USD' ? Math.round(impuestoRaw * TC_USD_PEN * 100) / 100 : Math.round(impuestoRaw * 100) / 100;

      return {
        num_certificado: e.id_contrato || e.id_certificado,
        nombre_fondo: fondoNombre,
        nombres_participes: inversionista,
        dni_participes: invDetails.dni,
        direccion_fiscal: invDetails.direccion,
        monto_ir_pen_num: irPen.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        monto_ir_pen_letras: numeroALetrasDoc(irPen),
        f_inicio: formatDateDisplayDoc(e.fecha_periodo_origen || fStart),
        f_fin: formatDateDisplayDoc(e.fecha_periodo_fin || fEnd),
        moneda: moneda,
        base_retencion: Number(e.interes_generado_bruto || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        fecha_operacion: formatDateDisplayDoc(e.fecha_periodo_fin || fEnd),
        tipo_cambio_display: `PEN ${TC_USD_PEN.toFixed(3)}`
      };
    });

    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Certificado de Rentas</title>
  <style>
    @page { size: A4 portrait; margin: 0; }
    body { font-family: sans-serif; font-size: 11pt; line-height: 1.5; color: #1e293b; margin: 0; padding: 10mm; background: #ffffff; box-sizing: border-box; }
    .sheet { background: #ffffff; padding: 20px 30px; margin: 0 0 10mm 0; max-width: 100%; width: 100%; box-shadow: none; border-radius: 0; border: none; page-break-after: always; box-sizing: border-box; }
    .header { width: 100%; margin-bottom: 25px; }
    .header table { width: 100%; border: none; }
    .header td { vertical-align: top; border: none; }
    .logo-container { width: 100%; text-align: right; padding-top: 5px; }
    .logo-container img { max-width: 160px; max-height: 80px; }
    .title-box { text-align: center; margin-top: 15px; margin-bottom: 20px; }
    .title-box h1 { font-size: 12pt; font-weight: 800; margin: 0 0 4px 0; text-transform: uppercase; color: #0f172a; line-height: 1.35; }
    .cert-num { font-size: 10.5pt; font-weight: 800; text-align: center; margin: 0 0 15px 0; text-transform: uppercase; color: #475569; }
    .resumen-title { font-size: 10pt; font-weight: 800; text-transform: uppercase; margin: 25px 0 8px 0; color: #0f172a; }
    .resumen-table { width: 100%; border-collapse: collapse; font-size: 9.5pt; margin-bottom: 20px; }
    .resumen-table th { background-color: #334155; color: #ffffff; padding: 8px; text-align: center; font-weight: 700; border: 1px solid #334155; }
    .resumen-table td { padding: 8px; text-align: center; border: 1px solid #cbd5e1; font-variant-numeric: tabular-nums; }
    .content { text-align: justify; margin-bottom: 20px; font-size: 10.5pt; line-height: 1.6; }
    .content p { margin: 10px 0; }
    .signature-area { text-align: center; margin-top: 40px; font-size: 10pt; }
    .signature-img { max-height: 90px; margin-bottom: 5px; }
    .footer { font-size: 8pt; margin-top: 40px; text-align: center; color: #0d47a1; border-top: 1px solid #e2e8f0; padding-top: 10px; }
    .footer p { margin: 2px 0; }
    .logo-inandes-img { display: block; width: 160px; height: 70px; background-image: url("data:image/png;base64,${LOGO_INANDES_BASE64}"); background-size: contain; background-repeat: no-repeat; background-position: right center; margin-left: auto; }
    .firma-inandes-img { display: block; width: 120px; height: 60px; background-image: url("data:image/png;base64,${FIRMA_RICARDO_GALLO_BASE64}"); background-size: contain; background-repeat: no-repeat; margin: 0 auto 5px auto; }
  </style>
</head>
<body>
  ${certs.map(cert => `
    <div class="sheet">
      <div class="header">
        <table>
          <tr>
            <td class="logo-container">
              <div class="logo-inandes-img"></div>
            </td>
          </tr>
        </table>
      </div>

      <div class="title-box">
        <h1>CERTIFICADO DE RENTAS Y RETENCIONES POR RENTAS<br>DE SEGUNDA CATEGORÍA</h1>
        <p class="cert-num">CERTIFICADO N° ${cert.num_certificado}</p>
      </div>

      <div class="content">
        <p>INANDES ACTIVOS ALTERNATIVOS S.A.C., identificada con RUC N° 20601555256, domiciliada en Los Tulipanes 147 oficina 306, Santiago de Surco, provincia y departamento de Lima, representada por su Gerente General, Sr. Juan Ricardo Gallo Pizarro, identificado con DNI 02816271, en su calidad de sociedad administradora del FONDO <strong>${cert.nombre_fondo}</strong> – FONDO DE INVERSION PRIVADO,</p>

        <p style="font-weight: 800; color: #0f172a; margin-top: 15px;">CERTIFICA QUE:</p>

        <p>De acuerdo con la LEY DEL IMPUESTO A LA RENTA, se le(s) ha(n) retenido al(a) Sr(a). <strong>${cert.nombres_participes}</strong>, identificado(a) con DNI <strong>${cert.dni_participes}</strong> y con domicilio fiscal en <strong>${cert.direccion_fiscal}</strong>, la suma de <strong>PEN ${cert.monto_ir_pen_num}</strong> (<strong>${cert.monto_ir_pen_letras} soles</strong>) por concepto de Impuesto a la Renta de Segunda Categoría generado por la distribución de beneficios de las operaciones del FONDO <strong>${cert.nombre_fondo}</strong> – FONDO DE INVERSION PRIVADO, correspondiente al período comprendido entre el <strong>${cert.f_inicio}</strong> al <strong>${cert.f_fin}</strong>.</p>

        <p class="resumen-title">RESUMEN DE LOS MONTOS RETENIDOS</p>
        <table class="resumen-table">
          <thead>
            <tr>
              <th>BASE DE RETENCION</th>
              <th>MONTO RETENIDO</th>
              <th>FECHA DE LA OPERACION</th>
              ${cert.moneda === 'USD' ? '<th>TIPO DE CAMBIO PEN/USD UTILIZADO</th>' : ''}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>${cert.moneda} ${cert.base_retencion}</td>
              <td>PEN ${cert.monto_ir_pen_num}</td>
              <td>${cert.fecha_operacion}</td>
              ${cert.moneda === 'USD' ? `<td>${cert.tipo_cambio_display}</td>` : ''}
            </tr>
          </tbody>
        </table>

        <p style="text-align: right; margin-top: 25px; color: #475569;">
          Santiago de Surco, <strong>${dia_hoy}</strong> de <strong>${mes_hoy}</strong> del <strong>${anio_hoy}</strong>
        </p>
      </div>

      <div class="signature-area">
        <div class="firma-inandes-img"></div><br>
        <strong>Juan Ricardo Gallo Pizarro</strong><br>
        <span style="font-size: 9pt; color: #64748b;">INANDES ACTIVOS ALTERNATIVOS SAC<br>Gerente General</span>
      </div>

      <div class="footer">
        <p><strong>INANDES ACTIVOS ALTERNATIVOS SAC</strong> | Los Tulipanes 147 oficina 306, Santiago de Surco, Lima | Teléfono: + (511) 7121700 | info@inandes.com</p>
      </div>
    </div>
  `).join('')}
</body>
</html>`;
  }, [docEvents, fondosDisponibles, inversionistas, docFondo, fStart, fEnd, docLoading]);

  // Ejecución del cálculo local
  const handleRunV40Calculation = async () => {
    setCalcLoading(true);
    setRegisterSuccessMsg(null);
    try {
      const fondoId = v40SelFondo === 'TODOS' ? null : v40SelFondo;
      const res = await generateRetornosV40(fondoId, fStart, fEnd);
      setCalcResult(res);
      return res;
    } catch (err: any) {
      alert(`Error en el Motor Contable: ${err.message}`);
      return null;
    } finally {
      setCalcLoading(false);
    }
  };

  // Exportar Excel Detallado Oficial y Auditoría (SheetJS)
  const handleExportExcelV40 = async () => {
    let currentResult = calcResult;
    if (!currentResult) {
      currentResult = await handleRunV40Calculation();
    }
    if (!currentResult || !currentResult.pdfData || currentResult.pdfData.length === 0) {
      alert("No hay datos calculados para exportar en Excel.");
      return;
    }

    const wb = XLSX.utils.book_new();

    // 1. Generar pestañas limpias por Fondo con Formato Oficial y Desglose Bello
    currentResult.pdfData.forEach((fData: any) => {
      const fondoId = fData.fondo.id_fondo;
      const moneda = fData.fondo.moneda;
      const rows = fData.blocks[0].rows || [];
      const totals = fData.totals || {};

      const sheetRows: any[] = rows.map((r: any) => {
        if (r.tipo === 'AUMENTO') {
          return {
            "#": "-",
            "Certificado": r.id,
            "Inversionista": "└─ Incremento de Capital",
            "Capital Base": r.capital,
            "INT. BRUTO": r.bruto_total,
            "IR (5%)": "-",
            "BASE NETA": "-",
            "CAPITALIZACION": "-",
            "REPARTO": "-",
            "DEDUCCIONES": "-",
            "NETO FINAL": "-",
            "RESCATES": "-",
            "CAPITAL FINAL": "-"
          };
        }

        return {
          "#": r.n_orden,
          "Certificado": r.id,
          "Inversionista": r.inversionista,
          "Capital Base": r.capital,
          "INT. BRUTO": r.bruto_total,
          "IR (5%)": r.impuesto_total,
          "BASE NETA": r.base_neta,
          "CAPITALIZACION": r.capitalizacion,
          "REPARTO": r.reparto_valor,
          "DEDUCCIONES": r.deducciones_total,
          "NETO FINAL": r.neto_total,
          "RESCATES": r.devolucion_capital,
          "CAPITAL FINAL": r.capital_final
        };
      });

      // Fila de Totales del Fondo
      sheetRows.push({
        "#": "TOTALES",
        "Certificado": `${fondoId} (${moneda})`,
        "Inversionista": "",
        "Capital Base": totals.capital,
        "INT. BRUTO": totals.bruto_total,
        "IR (5%)": totals.impuesto_total,
        "BASE NETA": totals.base_neta,
        "CAPITALIZACION": totals.capitalizacion,
        "REPARTO": totals.reparto_valor,
        "DEDUCCIONES": totals.deducciones_total,
        "NETO FINAL": Math.round(((totals.reparto_valor || 0) - (totals.deducciones_total || 0)) * 100) / 100,
        "RESCATES": totals.devolucion_capital,
        "CAPITAL FINAL": totals.capital_final
      });

      const ws = XLSX.utils.json_to_sheet(sheetRows);
      XLSX.utils.book_append_sheet(wb, ws, `Fondo_${fondoId.slice(0, 24)}`);
    });

    // 2. Generar pestañas de Auditoría Diaria Detallada
    if (currentResult.xlsDict) {
      for (const [fondoId, filas] of Object.entries(currentResult.xlsDict)) {
        const wsAudit = XLSX.utils.json_to_sheet(filas as any[]);
        XLSX.utils.book_append_sheet(wb, wsAudit, `Audit_${fondoId.slice(0, 18)}`);
      }
    }

    const wbOut = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbOut], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AUDITORIA_OFICIAL_SISTEMA_${fEnd}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setExcelDownloaded(true);
  };

  // Exportar Excel Maestro v40 con indicador de carga
  const handleExportExcelV40WithProgress = async () => {
    setExportingExcel(true);
    try {
      let currentResult = calcResult;
      if (!currentResult) {
        currentResult = await handleRunV40Calculation();
      }
      if (!currentResult) {
        alert("No hay datos calculados para exportar en Excel.");
        return;
      }
      await handleExportExcelV40();
    } catch (err: any) {
      alert(`Error generando Excel: ${err.message}`);
    } finally {
      setExportingExcel(false);
    }
  };

  // Exportar PDF Condensado Bello Oficial (Universal: TODOS y Fondo Individual) via descarga directa con progreso
  const handleExportPDFV40 = async () => {
    setExportingPdf(true);
    try {
      let currentResult = calcResult;
      if (!currentResult) {
        currentResult = await handleRunV40Calculation();
      }
      if (!currentResult || currentResult.pdfData.length === 0) {
        alert("No hay datos calculados para exportar en PDF.");
        return;
      }

      const htmlContent = generatePdfBelloConDesglose({
        pdfData: currentResult.pdfData,
        fStart,
        fEnd,
        selFondo: v40SelFondo
      });

      const filename = `REPORTE_OFICIAL_SISTEMA_${fEnd}.pdf`;
      await handleDownloadFastPdf(htmlContent, filename);
      setPdfDownloaded(true);
    } catch (err: any) {
      alert(`Error generando PDF: ${err.message}`);
    } finally {
      setExportingPdf(false);
    }
  };



  // Guardar permanente en base de datos
  const handleRegisterPermanent = async () => {
    if (!excelDownloaded || !pdfDownloaded) return;
    if (collisionCount > 0) return;

    if (!confirm("¿Está seguro de registrar permanentemente estos asientos en el Ledger oficial? Esta operación escribirá eventos y actualizará contratos en Supabase.")) {
      return;
    }

    setOfficialRegisterLoading(true);
    setRegisterSuccessMsg(null);
    try {
      let currentResult = calcResult;
      if (!currentResult) {
        currentResult = await handleRunV40Calculation();
      }

      if (!currentResult || currentResult.asientos.length === 0) {
        throw new Error("No hay asientos generados para guardar.");
      }

      const chunk_size = 50;
      let inserted = 0;
      const contratosCerrarFin: string[] = [];
      const contratosCerrarRescate: string[] = [];
      const idsCronograma: string[] = [];

      // Analizar asientos para cierres y cuotas
      for (const a of currentResult.asientos) {
        const payload = a.payload_asiento || {};
        
        if (payload.detalle_rescates) {
          for (const r of payload.detalle_rescates) {
            if (r.id_registro) idsCronograma.push(r.id_registro);
          }
        }
        if (payload.detalle_deducciones) {
          for (const d of payload.detalle_deducciones) {
            if (d.id_registro) idsCronograma.push(d.id_registro);
          }
        }

        if (a.tipo_evento === 'cierre_fin_contrato') {
          const resSum = Number(a.monto_rescate || 0);
          if (resSum > 0) {
            contratosCerrarRescate.push(a.id_contrato);
          } else {
            contratosCerrarFin.push(a.id_contrato);
          }
        }
      }

      // 1. Insertar Asientos del Ledger en bloques
      for (let i = 0; i < currentResult.asientos.length; i += chunk_size) {
        const chunk = currentResult.asientos.slice(i, i + chunk_size);
        const { data, error } = await supabase.from('crm_certificados_eventos').insert(chunk).select();
        if (error) throw error;
        inserted += (data ? data.length : 0);
      }

      // 2. Cerrar contratos finalizados
      if (contratosCerrarFin.length > 0) {
        for (let i = 0; i < contratosCerrarFin.length; i += chunk_size) {
          const chunk = contratosCerrarFin.slice(i, i + chunk_size);
          const { error } = await supabase
            .from('crm_contratos')
            .update({ estado: 'cerrado_fin_contrato' })
            .in('id_contrato', chunk);
          if (error) throw error;
        }
      }

      // 3. Cerrar contratos por rescate total
      if (contratosCerrarRescate.length > 0) {
        for (let i = 0; i < contratosCerrarRescate.length; i += chunk_size) {
          const chunk = contratosCerrarRescate.slice(i, i + chunk_size);
          const { error } = await supabase
            .from('crm_contratos')
            .update({ estado: 'cerrado_por_rescate' })
            .in('id_contrato', chunk);
          if (error) throw error;
        }
      }

      // 4. Marcar cronograma como procesado
      if (idsCronograma.length > 0) {
        const uniqueIds = Array.from(new Set(idsCronograma));
        for (let i = 0; i < uniqueIds.length; i += chunk_size) {
          const chunk = uniqueIds.slice(i, i + chunk_size);
          const { error } = await supabase
            .from('crm_cronograma_deducciones_rescates')
            .update({ estado: 'PROCESADO' })
            .in('id_cuota', chunk);
          if (error) throw error;
        }
      }

      setRegisterSuccessMsg(`Se registraron con éxito ${inserted} asientos contables. Se cerraron ${contratosCerrarFin.length + contratosCerrarRescate.length} contratos y se procesaron ${idsCronograma.length} cuotas de amortización.`);
      
      // Actualizar dashboard y colisiones
      verificarColision(fEnd);
      fetchCycleDashboard(v40SelYear);
      setExcelDownloaded(false);
      setPdfDownloaded(false);
      setCalcResult(null);
    } catch (err: any) {
      alert(`Error al registrar en base de datos: ${err.message}`);
    } finally {
      setOfficialRegisterLoading(false);
    }
  };

  // Verificar si el periodo seleccionado es el ULTIMO periodo cerrado en DB
  const verificarEsUltimoPeriodo = async (): Promise<{ esUltimo: boolean; ultimaFecha: string | null }> => {
    try {
      const { data, error } = await supabase
        .from('crm_certificados_eventos')
        .select('fecha_periodo_fin')
        .in('tipo_evento', ['cierre_fin_ciclo', 'cierre_fin_contrato'])
        .order('fecha_periodo_fin', { ascending: false })
        .limit(1);
      if (error) throw error;
      const ultimaFecha = data && data.length > 0 ? data[0].fecha_periodo_fin : null;
      return { esUltimo: ultimaFecha === fEnd, ultimaFecha };
    } catch (err) {
      console.error('Error verificando ultimo periodo:', err);
      return { esUltimo: false, ultimaFecha: null };
    }
  };

  // Abrir modal de rollback con verificacion de orden cronologico
  const handleOpenRollbackModal = async () => {
    const { esUltimo, ultimaFecha } = await verificarEsUltimoPeriodo();
    if (!esUltimo) {
      const msg = ultimaFecha
        ? `No se puede hacer rollback de ${fEnd} porque existe un periodo mas reciente cerrado: ${ultimaFecha}. Debes revertir primero ese periodo.`
        : `No hay asientos registrados para el periodo ${fEnd}.`;
      alert(msg);
      return;
    }
    setRollbackConfirmText('');
    setRollbackModalOpen(true);
  };

  // Reversion (Rollback) de periodo - se llama solo desde el modal tras confirmacion EJECUTAR
  const handleRollback = async () => {
    setRollbackLoading(true);

    try {
      const TIPOS_v40 = ['cierre_fin_ciclo', 'cierre_fin_contrato'];
      
      // 1. Obtener los eventos registrados en el fin de periodo
      const { data: eventosPeriodo, error: errEv } = await supabase
        .from('crm_certificados_eventos')
        .select('id_contrato, tipo_evento, payload_asiento')
        .eq('fecha_periodo_fin', fEnd)
        .in('tipo_evento', TIPOS_v40);

      if (errEv) throw errEv;

      if (!eventosPeriodo || eventosPeriodo.length === 0) {
        alert("No se encontraron asientos registrados para revertir en esta fecha de corte.");
        return;
      }

      const contratosRevertir = new Set<string>();
      const idsCronRevertir = new Set<string>();

      for (const reg of eventosPeriodo) {
        if (reg.tipo_evento === 'cierre_fin_contrato') {
          contratosRevertir.add(reg.id_contrato);
        }
        const payload = reg.payload_asiento || {};
        if (payload.detalle_rescates) {
          for (const r of payload.detalle_rescates) {
            if (r.id_registro) idsCronRevertir.add(r.id_registro);
          }
        }
        if (payload.detalle_deducciones) {
          for (const d of payload.detalle_deducciones) {
            if (d.id_registro) idsCronRevertir.add(d.id_registro);
          }
        }
      }

      const chunk_size = 50;

      // Revertir contratos a emitido
      const listC = Array.from(contratosRevertir);
      if (listC.length > 0) {
        for (let i = 0; i < listC.length; i += chunk_size) {
          const chunk = listC.slice(i, i + chunk_size);
          const { error } = await supabase
            .from('crm_contratos')
            .update({ estado: 'emitido' })
            .in('id_contrato', chunk);
          if (error) throw error;
        }
      }

      // Revertir cronograma a PENDIENTE
      const listCron = Array.from(idsCronRevertir);
      if (listCron.length > 0) {
        for (let i = 0; i < listCron.length; i += chunk_size) {
          const chunk = listCron.slice(i, i + chunk_size);
          const { error } = await supabase
            .from('crm_cronograma_deducciones_rescates')
            .update({ estado: 'PENDIENTE' })
            .in('id_cuota', chunk);
          if (error) throw error;
        }
      }

      // Eliminar los asientos del periodo
      const { error: errDel } = await supabase
        .from('crm_certificados_eventos')
        .delete()
        .eq('fecha_periodo_fin', fEnd)
        .in('tipo_evento', TIPOS_v40);

      if (errDel) throw errDel;

      setRollbackModalOpen(false);
      alert(`Rollback completado. Se eliminaron los asientos y se reactivaron contratos y cuotas del periodo ${fEnd}.`);
      verificarColision(fEnd);
      fetchCycleDashboard(v40SelYear);
    } catch (err: any) {
      alert(`Error en el Rollback: ${err.message}`);
    } finally {
      setRollbackLoading(false);
    }
  };


  const handleOpenEditModal = (investor: Inversionista | null) => {
    setFormSubmitError(null);
    setFormSubmitSuccess(false);
    setFormActiveTab('identidad');
    if (investor) {
      setFormMode('editar');
      setFormData({ ...investor });
    } else {
      setFormMode('crear');
      setFormData({
        tipo_doc: 'DNI',
        documento_identidad: '',
        nombre_1: '',
        nombre_2: '',
        apellido_1: '',
        apellido_2: '',
        estado_civil: 'Soltero(a)',
        nacionalidad: 'Peruano(a)',
        residente_peru: true,
        email: '',
        telefono: '',
        direccion_fiscal: '',
        codigo_postal: '',
        estado_compliance: 'borrador'
      });
    }
    setIsModalOpen(true);
  };



  const handleInputChange = (field: keyof Inversionista, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitError(null);
    setFormSubmitSuccess(false);

    if (!formData.documento_identidad || !formData.nombre_1 || !formData.apellido_1) {
      setFormSubmitError("Por favor completa los campos obligatorios (*).");
      return;
    }

    try {
      await upsertInversionista(formData);
      setFormSubmitSuccess(true);
      setTimeout(() => {
        setIsModalOpen(false);
        fetchDatos();
      }, 1000);
    } catch (err: any) {
      setFormSubmitError(err.message || 'Error al guardar los cambios en Supabase.');
    }
  };

  // Filtrado de partícipes reactivo
  const filteredInversionistas = inversionistas.filter(item => {
    // Filtro por texto
    const term = searchTerm.toLowerCase();
    const fullName = item.nombre_completo || `${item.apellido_1} ${item.apellido_2 || ''} ${item.nombre_1} ${item.nombre_2 || ''}`;
    const matchesText = (
      fullName.toLowerCase().includes(term) ||
      item.documento_identidad.toLowerCase().includes(term) ||
      (item.email && item.email.toLowerCase().includes(term))
    );

    // Filtro por Rolodex Alfabético A-Z
    let matchesLetter = true;
    if (selectedLetter !== 'TODOS') {
      const apellido = (item.apellido_1 || item.nombre_completo || 'Z').trim();
      const firstLetter = apellido.normalize("NFD").replace(/[\u0300-\u036f]/g, "").charAt(0).toUpperCase();
      if (selectedLetter === '#') {
        matchesLetter = !/^[A-ZÑ]/.test(firstLetter);
      } else {
        matchesLetter = firstLetter === selectedLetter;
      }
    }

    return matchesText && matchesLetter;
  });

  return (
    <div className="flex flex-col gap-6 w-full">
      
      {/* Selector de sub-pestañas superior */}
      <div className="border-b border-slate-200 dark:border-slate-800 w-full flex items-center justify-between">
        <div className="flex gap-6">
          <button
            className={`py-3 text-xs font-black tracking-wider uppercase border-b-2 cursor-pointer transition-colors ${
              activeSubTab === 'datos' 
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400' 
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-350'
            }`}
            onClick={() => setActiveSubTab('datos')}
          >
            👥 Datos Inversionistas
          </button>
          <button
            className={`py-3 text-xs font-black tracking-wider uppercase border-b-2 cursor-pointer transition-colors ${
              activeSubTab === 'retornos_react' 
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400' 
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-350'
            }`}
            onClick={() => setActiveSubTab('retornos_react')}
          >
            💹 Retornos y Rendimientos
          </button>

          <button
            className={`py-3 text-xs font-black tracking-wider uppercase border-b-2 cursor-pointer transition-colors ${
              activeSubTab === 'documentos' 
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400' 
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-350'
            }`}
            onClick={() => setActiveSubTab('documentos')}
          >
            📄 EECC / RETENCIONES / 2 VISORES
          </button>

        </div>
      </div>

      {/* --- PESTAÑA A: DATOS INVERSIONISTAS --- */}
      {activeSubTab === 'datos' && (
        <div className="flex flex-col gap-6 w-full animate-fadeIn">
          
          {/* Barra de Búsqueda y Botones de Acción */}
          <div className="flex flex-wrap items-center justify-between gap-4 w-full bg-slate-50/50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={15} />
              <input
                type="text"
                className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg py-2 pl-9 pr-4 text-xs font-semibold text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 transition-all shadow-sm"
                placeholder="Buscar por DNI, RUC o Apellidos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2">
              <button 
                className="h-9 text-xs font-bold flex items-center gap-1.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-sm hover:shadow transition-all"
                onClick={() => handleOpenEditModal(null)}
              >
                <UserPlus size={14} />
                <span>Nuevo Registro</span>
              </button>
              
              <button 
                className="h-9 text-xs font-bold flex items-center gap-1.5 px-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 cursor-pointer transition-colors shadow-sm"
                onClick={fetchDatos}
                disabled={loading}
              >
                <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                <span>Actualizar</span>
              </button>
            </div>
          </div>

          {/* Rolodex Abecedario A-Z Oficial */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
            <div className="flex flex-wrap gap-2 items-center justify-center sm:justify-start">
              {ALPHABET_AZ.map((char) => {
                const count = getLetterCount(char);
                const isSelected = selectedLetter === char;
                const hasData = count > 0;

                return (
                  <button
                    key={char}
                    onClick={() => setSelectedLetter(char)}
                    className={`relative px-3.5 py-1.5 rounded-xl font-black text-xs transition-all flex items-center justify-center cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-200 dark:shadow-none scale-105'
                        : hasData
                          ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 hover:text-emerald-600 border border-slate-200 dark:border-slate-800'
                          : 'bg-slate-50 dark:bg-slate-900 text-slate-300 dark:text-slate-700 opacity-60'
                    }`}
                  >
                    <span>{char}</span>
                    {count > 0 && (
                      <span className={`absolute -top-1.5 -right-1.5 w-4.5 h-4.5 rounded-full text-[9px] font-black flex items-center justify-center border border-white dark:border-slate-900 ${
                        isSelected ? 'bg-amber-400 text-slate-900' : 'bg-emerald-600 text-white'
                      }`}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Listado en Tarjetas Premium */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 text-center gap-3">
              <Loader2 className="animate-spin text-emerald-600" size={40} />
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Cargando partícipes desde Supabase...</p>
            </div>
          ) : error ? (
            <div className="max-w-md mx-auto my-12 bg-white dark:bg-slate-800 border border-rose-200 dark:border-rose-950 p-6 rounded-2xl shadow-sm text-center flex flex-col items-center gap-3">
              <AlertCircle className="text-rose-600" size={40} />
              <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 tracking-tight uppercase">Fallo de Conexión</h3>
              <p className="text-xs text-slate-450 dark:text-slate-400 leading-relaxed">{error}</p>
              <button 
                className="mt-2 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-lg transition-colors cursor-pointer" 
                onClick={fetchDatos}
              >
                Reintentar Conexión SSL
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 w-full">
              {filteredInversionistas.length > 0 ? (
                filteredInversionistas.map((inv) => {
                  const initials = `${inv.nombre_1?.charAt(0) || ''}${inv.apellido_1?.charAt(0) || ''}`.toUpperCase();
                  const cleanName = `${inv.apellido_1 || ''} ${inv.apellido_2 || ''} ${inv.nombre_1 || ''} ${inv.nombre_2 || ''}`.replace(/\s+/g, ' ').trim() || inv.nombre_completo || '';
                  
                  return (
                    <div 
                      key={inv.id}
                      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-xl p-5 shadow-sm hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between gap-4"
                    >
                      <div className="flex items-start gap-4">
                        {/* Avatar */}
                        <div className="h-10 w-10 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-250 dark:border-emerald-900/60 text-emerald-600 dark:text-emerald-400 font-black text-xs flex items-center justify-center shrink-0">
                          {initials}
                        </div>

                        {/* Detalle */}
                        <div className="flex flex-col min-w-0">
                          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-150 truncate leading-snug" title={cleanName}>
                            {cleanName}
                          </h4>
                          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 font-mono tracking-wider mt-0.5">
                            🆔 {inv.documento_identidad} ({inv.tipo_doc})
                          </span>
                        </div>
                      </div>

                      {/* Contacto & Cuentas */}
                      <div className="flex flex-col gap-2 py-1 border-t border-slate-100 dark:border-slate-800/60 mt-1">
                        <div className="flex justify-between items-center text-[10px] text-slate-500 dark:text-slate-400">
                          <span className="font-semibold truncate max-w-[180px]">{inv.email || 'Sin correo'}</span>
                          <span className="font-mono">{inv.telefono || 'Sin telf'}</span>
                        </div>
                        
                        <div className="flex items-center gap-4 mt-1">
                          {/* Cuentas Soles */}
                          <div className="flex flex-col">
                            <span className="text-[8px] uppercase font-bold text-slate-400 dark:text-slate-500">PEN</span>
                            <span className="text-[10px] font-bold text-slate-700 dark:text-slate-350 truncate max-w-[100px]">
                              {inv.banco_nombre_pen ? inv.banco_nombre_pen : <span className="text-slate-300 dark:text-slate-700">-</span>}
                            </span>
                          </div>

                          {/* Cuentas Dólares */}
                          <div className="flex flex-col">
                            <span className="text-[8px] uppercase font-bold text-slate-400 dark:text-slate-500">USD</span>
                            <span className="text-[10px] font-bold text-slate-700 dark:text-slate-350 truncate max-w-[100px]">
                              {inv.banco_nombre_usd ? inv.banco_nombre_usd : <span className="text-slate-300 dark:text-slate-700">-</span>}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Compliance & Acciones */}
                      <div className="flex items-center justify-between border-t border-slate-150 dark:border-slate-800/80 pt-3 mt-1">
                        <div>
                          {(() => {
                            const state = inv.estado_compliance || 'borrador';
                            let style = '';
                            if (state === 'aprobado') {
                              style = 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-450 border-emerald-200 dark:border-emerald-900/60';
                            } else if (state === 'solicitado') {
                              style = 'bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-450 border-amber-200 dark:border-amber-900/60';
                            } else if (state === 'rechazado') {
                              style = 'bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-450 border-rose-200 dark:border-rose-900/60';
                            } else {
                              style = 'bg-slate-50 dark:bg-slate-800 text-slate-450 dark:text-slate-450 border-slate-200';
                            }
                            return (
                              <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[8px] font-black tracking-wider uppercase border ${style}`}>
                                {state}
                              </span>
                            );
                          })()}
                        </div>

                        <button
                          className="h-7 text-[10px] font-bold flex items-center gap-1 px-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-250 dark:hover:bg-emerald-950/30 dark:hover:text-emerald-400 dark:hover:border-emerald-900 transition-colors cursor-pointer text-slate-600 dark:text-slate-350"
                          onClick={() => handleOpenEditModal(inv)}
                        >
                          <Edit2 size={10} />
                          <span>Editar Ficha</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="col-span-full py-16 text-center text-slate-400 font-bold uppercase tracking-wider border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900">
                  No se encontraron inversionistas registrados.
                </div>
              )}
            </div>
          )}
        </div>
      )}


      {/* --- NUEVA PESTAÑA: RETORNOS Y RENDIMIENTOS REACT (APROBADO) --- */}
      {activeSubTab === 'retornos_react' && (
        <div className="flex flex-col gap-6 w-full animate-fadeIn">
          
          {/* SECCIÓN 1: TABLERO ANUAL DE 12 MESES (VISIÓN DE ESTADO GLOBAL) */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
              <div className="flex items-center gap-2">
                <Calendar size={18} className="text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                  📅 Tablero Anual de Cierres ({v40SelYear})
                </h3>
              </div>

              {/* Selector de Año */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Año:</span>
                <select
                  className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg py-1 px-3 text-xs font-black text-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-500 shadow-sm cursor-pointer"
                  value={v40SelYear}
                  onChange={(e) => setV40SelYear(Number(e.target.value))}
                >
                  <option value={2024}>2024</option>
                  <option value={2025}>2025</option>
                  <option value={2026}>2026</option>
                  <option value={2027}>2027</option>
                </select>
              </div>
            </div>

            {/* Grid de 12 Meses (Ene - Dic) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { m: 1, name: 'Enero', cycle: null, label: 'Sin cierres', funds: [] },
                { m: 2, name: 'Febrero', cycle: 'B1', label: 'Bimestre 1', funds: ['NSGPEN01', 'NSGPEN02', 'NSGPEN03', 'NSGUSD01', 'NSGUSD02'], cNum: 1, cType: 'Bimestre' },
                { m: 3, name: 'Marzo', cycle: 'Q1', label: 'Trimestre 1', funds: ['NSLCON01'], cNum: 1, cType: 'Trimestre' },
                { m: 4, name: 'Abril', cycle: 'B2', label: 'Bimestre 2', funds: ['NSGPEN01', 'NSGPEN02', 'NSGPEN03', 'NSGUSD01', 'NSGUSD02'], cNum: 2, cType: 'Bimestre' },
                { m: 5, name: 'Mayo', cycle: null, label: 'Sin cierres', funds: [] },
                { m: 6, name: 'Junio', cycle: 'B3/Q2', label: 'Bimestre 3 / Q2', funds: ['NSGPEN01', 'NSGPEN02', 'NSGPEN03', 'NSGUSD01', 'NSGUSD02', 'NSLCON01'], cNum: 3, cType: 'Bimestre' },
                { m: 7, name: 'Julio', cycle: null, label: 'Sin cierres', funds: [] },
                { m: 8, name: 'Agosto', cycle: 'B4', label: 'Bimestre 4', funds: ['NSGPEN01', 'NSGPEN02', 'NSGPEN03', 'NSGUSD01', 'NSGUSD02'], cNum: 4, cType: 'Bimestre' },
                { m: 9, name: 'Septiembre', cycle: 'Q3', label: 'Trimestre 3', funds: ['NSLCON01'], cNum: 3, cType: 'Trimestre' },
                { m: 10, name: 'Octubre', cycle: 'B5', label: 'Bimestre 5', funds: ['NSGPEN01', 'NSGPEN02', 'NSGPEN03', 'NSGUSD01', 'NSGUSD02'], cNum: 5, cType: 'Bimestre' },
                { m: 11, name: 'Noviembre', cycle: null, label: 'Sin cierres', funds: [] },
                { m: 12, name: 'Diciembre', cycle: 'B6/Q4', label: 'Bimestre 6 / Q4', funds: ['NSGPEN01', 'NSGPEN02', 'NSGPEN03', 'NSGUSD01', 'NSGUSD02', 'NSLCON01'], cNum: 6, cType: 'Bimestre' }
              ].map(item => {
                // Verificar si este mes tiene cierres guardados en DB
                let isClosedInDb = false;
                if (item.m === 2) isClosedInDb = (cycleDashboard.B?.[1]?.length || 0) > 0;
                else if (item.m === 3) isClosedInDb = (cycleDashboard.Q?.[1]?.length || 0) > 0;
                else if (item.m === 4) isClosedInDb = (cycleDashboard.B?.[2]?.length || 0) > 0;
                else if (item.m === 6) isClosedInDb = (cycleDashboard.B?.[3]?.length || 0) > 0;
                else if (item.m === 8) isClosedInDb = (cycleDashboard.B?.[4]?.length || 0) > 0;
                else if (item.m === 9) isClosedInDb = (cycleDashboard.Q?.[3]?.length || 0) > 0;
                else if (item.m === 10) isClosedInDb = (cycleDashboard.B?.[5]?.length || 0) > 0;
                else if (item.m === 12) isClosedInDb = (cycleDashboard.B?.[6]?.length || 0) > 0;

                const isSelected = (item.cType === v40SelCiclo && item.cNum === v40SelNum);

                return (
                  <div
                    key={item.m}
                    onClick={() => {
                      if (item.cType && item.cNum) {
                        setV40SelCiclo(item.cType as any);
                        setV40SelNum(item.cNum);
                      }
                    }}
                    className={`rounded-xl p-3 border transition-all flex flex-col justify-between min-h-[110px] ${
                      item.funds.length === 0
                        ? 'bg-slate-50/60 dark:bg-slate-950/40 border-slate-200 dark:border-slate-850 opacity-60'
                        : isSelected
                        ? 'bg-white dark:bg-slate-900 border-indigo-500 shadow-md ring-2 ring-indigo-500/20'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 cursor-pointer'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-slate-800 dark:text-slate-100">{item.name}</span>
                      {item.funds.length > 0 && (
                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${
                          isClosedInDb
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                            : 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
                        }`}>
                          {isClosedInDb ? '🟢 CERRADO' : '🔴 PENDIENTE'}
                        </span>
                      )}
                    </div>

                    <div className="mt-2">
                      {item.funds.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {item.funds.map(f => (
                            <span key={f} className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${
                              isClosedInDb ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
                            }`}>
                              {f.slice(3, 6)}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[9px] font-semibold text-slate-400 italic">Sin cierres</span>
                      )}
                    </div>

                    <div className="mt-2 border-t border-slate-100 dark:border-slate-800/60 pt-1.5 flex justify-between items-center text-[9px] text-slate-400 font-bold">
                      <span>{item.label}</span>
                      {item.funds.length > 0 && <span>{item.funds.length} fond.</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SECCIÓN 2: PANEL OPERATIVO DE LIQUIDACIÓN Y AUDITORÍA (MODO DUAL) */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm flex flex-col gap-5">
            
            {/* Header del Panel y Modo Activo */}
            <div className="flex items-center justify-between gap-4 flex-wrap border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-black text-slate-850 dark:text-slate-100 uppercase tracking-tight">
                    ⚙️ Panel Operativo de Liquidación ({fStart} al {fEnd})
                  </h3>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {collisionCount > 0 
                    ? '🟢 MODO CONSULTA Y LECTURA RETROACTIVA: Los datos están oficializados en la base de datos.'
                    : '🟡 MODO PRE-CIERRE Y SIMULACIÓN: Genere borradores, revise y oficialice los asientos.'}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className={`px-4 py-2 rounded-xl text-xs font-black tracking-wide uppercase border flex items-center gap-2 shadow-sm ${
                  collisionCount > 0 
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800' 
                    : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                }`}>
                  {collisionCount > 0 ? (
                    <>
                      <CheckCircle size={16} />
                      <span>🟢 PERÍODO CERRADO Y OFICIALIZADO ({collisionCount} Registros)</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle size={16} />
                      <span>🟡 MODO BORRADOR / PENDIENTE DE REGISTRO</span>
                    </>
                  )}
                </span>
              </div>
            </div>

            {/* Filtros Finitos de Selección */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 dark:bg-slate-950 p-4 border border-slate-200 dark:border-slate-850 rounded-xl">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Fondo a Auditar / Liquidar</label>
                <select
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg py-1.5 px-3 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none"
                  value={v40SelFondo}
                  onChange={(e) => setV40SelFondo(e.target.value)}
                >
                  <option value="TODOS">TODOS LOS FONDOS</option>
                  {fondosDisponibles.map(f => (
                    <option key={f.id_fondo} value={f.id_fondo}>{f.nombre_fondo}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Frecuencia / Ciclo</label>
                <select
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg py-1.5 px-3 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none"
                  value={v40SelCiclo}
                  onChange={(e) => setV40SelCiclo(e.target.value as any)}
                >
                  <option value="Bimestre">Bimestre</option>
                  <option value="Trimestre">Trimestre</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Número de Período</label>
                <select
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg py-1.5 px-3 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none"
                  value={v40SelNum}
                  onChange={(e) => setV40SelNum(Number(e.target.value))}
                >
                  {v40SelCiclo === 'Bimestre' ? (
                    <>
                      <option value={1}>1: Ene-Feb (Feb 28)</option>
                      <option value={2}>2: Mar-Abr (Abr 30)</option>
                      <option value={3}>3: May-Jun (Jun 30)</option>
                      <option value={4}>4: Jul-Ago (Ago 31)</option>
                      <option value={5}>5: Sep-Oct (Oct 31)</option>
                      <option value={6}>6: Nov-Dic (Dic 31)</option>
                    </>
                  ) : (
                    <>
                      <option value={1}>1: Ene-Mar (Mar 31)</option>
                      <option value={2}>2: Abr-Jun (Jun 30)</option>
                      <option value={3}>3: Jul-Sep (Sep 30)</option>
                      <option value={4}>4: Oct-Dic (Dic 31)</option>
                    </>
                  )}
                </select>
              </div>
            </div>

            {/* FASE 1: DESCARGA DE REPORTES DE AUDITORÍA */}
            <div className="flex flex-col gap-3">
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                📄 Paso 1: Generar y Revisar Reportes de Auditoría ({fEnd})
              </h4>

              {/* Banners de Progreso / Artefactos de Notificación en Vivo */}
              {exportingExcel && (
                <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-xl p-3.5 flex items-center gap-3 animate-pulse shadow-sm">
                  <Loader2 size={20} className="animate-spin text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-black text-emerald-900 dark:text-emerald-200 uppercase tracking-wide">
                      📊 Procesando y Compilando Libro Excel Maestro...
                    </span>
                    <span className="text-[11px] text-emerald-700 dark:text-emerald-300 font-medium">
                      Generando hojas de auditoría contable diaria. La descarga iniciará automáticamente en breve.
                    </span>
                  </div>
                </div>
              )}

              {exportingPdf && (
                <div className="bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-300 dark:border-indigo-800 rounded-xl p-3.5 flex items-center gap-3 animate-pulse shadow-sm">
                  <Loader2 size={20} className="animate-spin text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-black text-indigo-900 dark:text-indigo-200 uppercase tracking-wide">
                      📄 Generando y Convirtiendo Reporte PDF Oficial (WeasyPrint Backend)...
                    </span>
                    <span className="text-[11px] text-indigo-700 dark:text-indigo-300 font-medium">
                      El servidor está compilando las tablas y estilos. Por favor espere unos segundos mientras se procesa la descarga directa.
                    </span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  className={`h-12 text-xs font-black uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow hover:shadow-md transition-all disabled:opacity-60 disabled:cursor-not-allowed ${
                    excelDownloaded
                      ? 'bg-emerald-700 hover:bg-emerald-800 text-white'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  }`}
                  disabled={calcLoading || exportingExcel || exportingPdf}
                  onClick={async () => {
                    await handleExportExcelV40WithProgress();
                  }}
                >
                  {exportingExcel ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      <span>Procesando Excel Maestro...</span>
                    </>
                  ) : excelDownloaded ? (
                    <>
                      <CheckCircle size={18} className="text-emerald-200" />
                      <span>✓ Excel Maestro Descargado (Clic para Re-descargar)</span>
                    </>
                  ) : (
                    <>
                      <FileSpreadsheet size={18} />
                      <span>Descargar / Consultar Excel Maestro (Formato #,##0.00)</span>
                    </>
                  )}
                </button>

                <button
                  className={`h-12 text-xs font-black uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow hover:shadow-md transition-all disabled:opacity-60 disabled:cursor-not-allowed ${
                    pdfDownloaded
                      ? 'bg-indigo-700 hover:bg-indigo-800 text-white'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                  }`}
                  disabled={calcLoading || exportingExcel || exportingPdf}
                  onClick={async () => {
                    await handleExportPDFV40();
                  }}
                >
                  {exportingPdf ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      <span>Procesando y Convirtiendo PDF...</span>
                    </>
                  ) : pdfDownloaded ? (
                    <>
                      <CheckCircle size={18} className="text-indigo-200" />
                      <span>✓ Reporte PDF Descargado (Clic para Re-descargar)</span>
                    </>
                  ) : (
                    <>
                      <FileText size={18} />
                      <span>Descargar Reporte PDF Oficial (Geeksoft + InAndes)</span>
                    </>
                  )}
                </button>
              </div>
            </div>


            {/* FASE 2: EJECUCIÓN OFICIAL EN BD */}
            <div className="flex flex-col gap-3 border-t border-slate-100 dark:border-slate-800 pt-4">
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                💾 Paso 2: Registro Oficial en Ledger y Persistencia DB
              </h4>

              {registerSuccessMsg && (
                <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-250 dark:border-emerald-900 rounded-xl p-4 flex items-start gap-3">
                  <CheckCircle className="text-emerald-600 dark:text-emerald-450 shrink-0" size={18} />
                  <p className="text-[11px] font-semibold text-emerald-750 dark:text-emerald-400 leading-relaxed">
                    {registerSuccessMsg}
                  </p>
                </div>
              )}

              {collisionCount > 0 ? (
                <div className="bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900 rounded-xl p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 text-xs font-bold">
                    <ShieldCheck size={18} />
                    <span>PERÍODO OFICIALIZADO: Los {collisionCount} asientos ya se encuentran registrados en Supabase.</span>
                  </div>
                  <span className="text-[10px] font-semibold text-slate-400">
                    Protección contra duplicados activa
                  </span>
                </div>
              ) : (!excelDownloaded || !pdfDownloaded) ? (
                <div className="bg-amber-50 dark:bg-amber-950/15 border border-amber-250 dark:border-amber-900 rounded-xl p-4 flex items-start gap-3">
                  <AlertTriangle className="text-amber-600 dark:text-amber-450 shrink-0 mt-0.5" size={16} />
                  <div className="flex flex-col gap-0.5">
                    <h4 className="text-[11px] font-bold text-amber-800 dark:text-amber-400 uppercase tracking-tight">Bloqueo de Auditoría</h4>
                    <p className="text-[10px] text-amber-600 dark:text-amber-450 font-medium">
                      🔒 Para habilitar el registro oficial en Supabase, primero debes descargar y revisar el **Excel Maestro** y el **PDF Oficial** del período.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="bg-emerald-50 dark:bg-emerald-950/15 border border-emerald-250 dark:border-emerald-900 rounded-xl p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 text-xs font-bold">
                    <CheckCircle size={18} />
                    <span>Revisión completada: Tienes habilitado el registro contable en la base de datos.</span>
                  </div>
                  <button
                    className="h-10 text-xs font-black uppercase tracking-wider bg-emerald-600 hover:bg-emerald-700 text-white px-6 rounded-xl cursor-pointer shadow transition-all flex items-center gap-2"
                    onClick={handleRegisterPermanent}
                    disabled={officialRegisterLoading}
                  >
                    {officialRegisterLoading ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                    <span>Registrar Asientos en Base de Datos</span>
                  </button>
                </div>
              )}

              {/* Herramienta de Rollback */}
              <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-3 mt-1">
                <button
                  className="h-9 text-xs font-bold bg-white dark:bg-slate-800 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/20 dark:hover:text-rose-400 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 rounded-xl px-4 flex items-center gap-2 transition-colors cursor-pointer"
                  onClick={handleOpenRollbackModal}
                >
                  <Undo2 size={14} />
                  <span>Reversión / Rollback Seguro del Período</span>
                </button>

                <span className="text-[10px] font-semibold text-slate-400">
                  Permite reabrir el período eliminando los asientos de la fecha de corte seleccionada.
                </span>
              </div>
            </div>

          </div>

        </div>
      )}


      {/* --- PESTAÑA C: EECC / RETENCIONES / 2 VISORES (ESTILO FORECAST) --- */}
      {activeSubTab === 'documentos' && (

        <div className="flex flex-col gap-6 w-full animate-fadeIn">
          
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl text-emerald-600 border border-emerald-100 dark:border-emerald-900">
                  <FileText size={22} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-850 dark:text-slate-100 uppercase tracking-tight">
                    AUDITORÍA Y EMISIÓN EN CALIENTE: EECC & RETENCIONES (2 VISORES DUALES)
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Visualización directa en alta resolución sin popups. Compilación y caché de alta velocidad estilo Forecast.
                  </p>
                </div>
              </div>

              {/* Indicador de Estado del Período */}
              {collisionCount > 0 ? (
                <span className="px-3 py-1.5 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 flex items-center gap-1.5 shadow-xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span>
                  🟢 PERÍODO OFICIALIZADO EN BD ({collisionCount} Asientos)
                </span>
              ) : (
                <span className="px-3 py-1.5 rounded-full text-xs font-black bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 flex items-center gap-1.5 shadow-xs">
                  <span className="w-2 h-2 rounded-full bg-amber-600"></span>
                  🔴 PERÍODO EN BORRADOR / SIMULACIÓN
                </span>
              )}
            </div>

            {/* Selectores Vinculados al Fondo y Fecha de Corte */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-4 bg-slate-50 dark:bg-slate-950 p-4 border border-slate-200 dark:border-slate-850 rounded-xl items-end">
              
              {/* Selector de Fondo */}
              <div className="flex flex-col gap-1 lg:col-span-2">
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Fondo a Emitir</label>
                <select
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg py-1.5 px-3 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-600 cursor-pointer"
                  value={docFondo}
                  onChange={(e) => {
                    setDocFondo(e.target.value);
                  }}
                >
                  <option value="TODOS">TODOS LOS FONDOS</option>
                  {fondosDisponibles.map(f => (
                    <option key={f.id_fondo} value={f.id_fondo}>{f.nombre_fondo}</option>
                  ))}
                </select>
              </div>

              {/* Año */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Año</label>
                <select
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg py-1.5 px-3 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-600 cursor-pointer"
                  value={v40SelYear}
                  onChange={(e) => {
                    setV40SelYear(Number(e.target.value));
                  }}
                >
                  <option value={2024}>2024</option>
                  <option value={2025}>2025</option>
                  <option value={2026}>2026</option>
                  <option value={2027}>2027</option>
                </select>
              </div>

              {/* Ciclo */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Ciclo</label>
                <select
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg py-1.5 px-3 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-600 cursor-pointer"
                  value={v40SelCiclo}
                  onChange={(e) => {
                    setV40SelCiclo(e.target.value as 'Bimestre' | 'Trimestre');
                  }}
                >
                  <option value="Bimestre">Bimestre</option>
                  <option value="Trimestre">Trimestre</option>
                </select>
              </div>

              {/* Período / Mes */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">N° Período</label>
                <select
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg py-1.5 px-3 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-600 cursor-pointer"
                  value={v40SelNum}
                  onChange={(e) => {
                    setV40SelNum(Number(e.target.value));
                  }}
                >
                  {v40SelCiclo === 'Bimestre' ? (
                    <>
                      <option value={1}>1: Ene-Feb (Feb 28)</option>
                      <option value={2}>2: Mar-Abr (Abr 30)</option>
                      <option value={3}>3: May-Jun (Jun 30)</option>
                      <option value={4}>4: Jul-Ago (Ago 31)</option>
                      <option value={5}>5: Sep-Oct (Oct 31)</option>
                      <option value={6}>6: Nov-Dic (Dic 31)</option>
                    </>
                  ) : (
                    <>
                      <option value={1}>1: Ene-Mar (Mar 31)</option>
                      <option value={2}>2: Abr-Jun (Jun 30)</option>
                      <option value={3}>3: Jul-Sep (Sep 30)</option>
                      <option value={4}>4: Oct-Dic (Dic 31)</option>
                    </>
                  )}
                </select>
              </div>

            </div>

            {/* Barra de Control de Vistas y Recarga en Caliente */}
            <div className="flex items-center justify-between gap-4 flex-wrap bg-slate-900 text-white p-3 rounded-xl shadow-md mb-6">
              
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono font-bold text-slate-300 uppercase">Modo de Visor:</span>
                
                <div className="flex bg-slate-800 p-1 rounded-lg border border-slate-700">
                  <button
                    onClick={() => setDocViewMode('dual')}
                    className={`px-3 py-1.5 text-xs font-black uppercase rounded-md transition-all cursor-pointer ${
                      docViewMode === 'dual'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    🔲 Vista Dual 50/50
                  </button>
                  
                  <button
                    onClick={() => setDocViewMode('eecc')}
                    className={`px-3 py-1.5 text-xs font-black uppercase rounded-md transition-all cursor-pointer ${
                      docViewMode === 'eecc'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    📑 Solo EECC (100%)
                  </button>

                  <button
                    onClick={() => setDocViewMode('retenciones')}
                    className={`px-3 py-1.5 text-xs font-black uppercase rounded-md transition-all cursor-pointer ${
                      docViewMode === 'retenciones'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    📜 Solo Retenciones (100%)
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-xs font-mono text-slate-400">
                  Corte: <strong className="text-emerald-400">{fStart} al {fEnd}</strong>
                </div>

                <button
                  onClick={() => setDocReloadKey(Date.now())}
                  className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 rounded-lg text-xs font-bold font-mono transition-all flex items-center gap-2 cursor-pointer active:scale-95"
                  title="Recargar visores en caliente"
                >
                  <RotateCcw size={14} />
                  <span>Recargar en Caliente</span>
                </button>
              </div>

            </div>

            {/* --- CONTENEDORES DE LOS 2 VISORES (ESTILO FORECAST) --- */}
            <div className={`grid gap-6 ${docViewMode === 'dual' ? 'grid-cols-1 xl:grid-cols-2' : 'grid-cols-1'}`}>
              
              {/* VISOR 1: ESTADOS DE CUENTA (EECC) */}
              {(docViewMode === 'dual' || docViewMode === 'eecc') && (
                <div className="flex flex-col gap-2.5 w-full bg-slate-100 dark:bg-slate-950 p-3.5 rounded-2xl border border-slate-250 dark:border-slate-800 shadow-sm">
                  
                  {/* Header del Visor EECC */}
                  <div className="bg-slate-900 text-white p-3 rounded-xl shadow-sm flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <FileText size={18} className="text-emerald-400" />
                      <div>
                        <h4 className="text-xs font-black uppercase tracking-wider text-slate-100">
                          ESTADOS DE CUENTA (EECC) — {docFondo || 'TODOS'}
                        </h4>
                        <p className="text-[10px] text-slate-400 font-mono">
                          Periodo: {fEnd} | Formato Oficial WeasyPrint
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          const fondo = docFondo || 'TODOS';
                          window.open(`https://inandes.react.geeksoft.tech/api/inversionistas/eecc/${fondo}/${fEnd}`, '_blank');
                        }}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-[11px] font-mono font-bold transition-all border border-slate-700 flex items-center gap-1.5 cursor-pointer"
                        title="Abrir en pestaña completa independiente"
                      >
                        <ExternalLink size={13} />
                        <span>Abrir Pestaña</span>
                      </button>

                      <button
                        onClick={() => handleDownloadFastPdf(htmlEeccDoc, `EECC_${docFondo || 'TODOS'}_${fEnd}.pdf`)}
                        disabled={downloadingPdf === `EECC_${docFondo || 'TODOS'}_${fEnd}.pdf`}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-lg text-[11px] font-mono font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                        title="Descargar archivo binario PDF en caliente (1.5s)"
                      >
                        {downloadingPdf === `EECC_${docFondo || 'TODOS'}_${fEnd}.pdf` ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                        <span>{downloadingPdf === `EECC_${docFondo || 'TODOS'}_${fEnd}.pdf` ? 'Generando...' : 'Descargar PDF'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Contenedor IFrame de Alta Resolución (Estilo Forecast srcDoc) */}
                  <div className="bg-slate-900 rounded-xl overflow-hidden shadow-inner border border-slate-700/60 p-1">
                    <iframe
                      key={`eecc-frame-${docReloadKey}-${docFondo}-${fEnd}`}
                      srcDoc={htmlEeccDoc}
                      className="w-full h-[800px] rounded-lg border-none bg-slate-950"
                      title="Visor Integrado EECC"
                    />
                  </div>

                </div>
              )}

              {/* VISOR 2: CERTIFICADOS DE RETENCIÓN (5% IR) */}
              {(docViewMode === 'dual' || docViewMode === 'retenciones') && (
                <div className="flex flex-col gap-2.5 w-full bg-slate-100 dark:bg-slate-950 p-3.5 rounded-2xl border border-slate-250 dark:border-slate-800 shadow-sm">
                  
                  {/* Header del Visor Retenciones */}
                  <div className="bg-slate-900 text-white p-3 rounded-xl shadow-sm flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet size={18} className="text-blue-400" />
                      <div>
                        <h4 className="text-xs font-black uppercase tracking-wider text-slate-100">
                          CERTIFICADOS DE RETENCIÓN (5% IR) — {docFondo || 'TODOS'}
                        </h4>
                        <p className="text-[10px] text-slate-400 font-mono">
                          Periodo: {fEnd} | Impuesto a la Renta de 2da Categoría
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          const fondo = docFondo || 'TODOS';
                          window.open(`https://inandes.react.geeksoft.tech/api/inversionistas/retenciones/${fondo}/${fEnd}`, '_blank');
                        }}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-[11px] font-mono font-bold transition-all border border-slate-700 flex items-center gap-1.5 cursor-pointer"
                        title="Abrir en pestaña completa independiente"
                      >
                        <ExternalLink size={13} />
                        <span>Abrir Pestaña</span>
                      </button>

                      <button
                        onClick={() => handleDownloadFastPdf(htmlRetencionesDoc, `RETENCIONES_${docFondo || 'TODOS'}_${fEnd}.pdf`)}
                        disabled={downloadingPdf === `RETENCIONES_${docFondo || 'TODOS'}_${fEnd}.pdf`}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-lg text-[11px] font-mono font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                        title="Descargar archivo binario PDF en caliente (1.5s)"
                      >
                        {downloadingPdf === `RETENCIONES_${docFondo || 'TODOS'}_${fEnd}.pdf` ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                        <span>{downloadingPdf === `RETENCIONES_${docFondo || 'TODOS'}_${fEnd}.pdf` ? 'Generando...' : 'Descargar PDF'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Contenedor IFrame de Alta Resolución (Estilo Forecast srcDoc) */}
                  <div className="bg-slate-900 rounded-xl overflow-hidden shadow-inner border border-slate-700/60 p-1">
                    <iframe
                      key={`ret-frame-${docReloadKey}-${docFondo}-${fEnd}`}
                      srcDoc={htmlRetencionesDoc}
                      className="w-full h-[800px] rounded-lg border-none bg-slate-950"
                      title="Visor Integrado Retenciones"
                    />
                  </div>

                </div>
              )}

            </div>

          </div>

        </div>
      )}

      {/* --- FORMULARIO MODAL INTERACTIVO DE CREACIÓN / EDICIÓN (5 TABS) --- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-3xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">
            
            {/* Cabecera del Modal */}
            <div className="p-5 border-b border-slate-150 dark:border-slate-800/80 flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-850 dark:text-slate-100 uppercase tracking-wider">
                {formMode === 'crear' ? '➕ Registrar Inversionista' : '✏️ Editar Ficha Inversionista'}
              </h3>
              <button 
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                onClick={() => setIsModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            {/* Selector de sub-pestanas del formulario */}
            <div className="px-5 bg-slate-50 dark:bg-slate-950 border-b border-slate-150 dark:border-slate-850 flex gap-4 overflow-x-auto whitespace-nowrap scrollbar-none">
              {(['identidad', 'conyuge', 'laboral', 'bancario', 'compliance'] as const).map(tab => (
                <button
                  key={tab}
                  type="button"
                  className={`py-2.5 text-[10px] font-black uppercase tracking-wider border-b-2 cursor-pointer transition-colors ${
                    formActiveTab === tab 
                      ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400' 
                      : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-350'
                  }`}
                  onClick={() => setFormActiveTab(tab)}
                >
                  {tab === 'identidad' && 'Identidad'}
                  {tab === 'conyuge' && 'Cónyuge'}
                  {tab === 'laboral' && 'Laboral'}
                  {tab === 'bancario' && 'Bancario'}
                  {tab === 'compliance' && 'Compliance'}
                </button>
              ))}
            </div>

            {/* Cuerpo del Formulario */}
            <form onSubmit={handleFormSubmit} className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
              
              {/* --- SUB-TAB 1: IDENTIDAD --- */}
              {formActiveTab === 'identidad' && (
                <div className="flex flex-col gap-4 animate-fadeIn">
                  <h4 className="text-xs font-bold text-slate-805 dark:text-slate-200 uppercase tracking-tight">Información Personal</h4>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">N° Documento *</label>
                      <input
                        type="text"
                        className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 disabled:bg-slate-50 dark:disabled:bg-slate-900 disabled:text-slate-400"
                        value={formData.documento_identidad || ''}
                        onChange={(e) => handleInputChange('documento_identidad', e.target.value)}
                        disabled={formMode === 'editar'}
                        placeholder="DNI, RUC, etc."
                        required
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Tipo Doc *</label>
                      <select
                        className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-600"
                        value={formData.tipo_doc || 'DNI'}
                        onChange={(e) => handleInputChange('tipo_doc', e.target.value)}
                        required
                      >
                        <option value="DNI">DNI</option>
                        <option value="CEX">CEX</option>
                        <option value="PASAPORTE">PASAPORTE</option>
                        <option value="RUC">RUC</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Primer Nombre *</label>
                      <input
                        type="text"
                        className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none focus:border-emerald-600"
                        value={formData.nombre_1 || ''}
                        onChange={(e) => handleInputChange('nombre_1', e.target.value)}
                        placeholder="Nombres"
                        required
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Segundo Nombre</label>
                      <input
                        type="text"
                        className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                        value={formData.nombre_2 || ''}
                        onChange={(e) => handleInputChange('nombre_2', e.target.value)}
                        placeholder="Segundo nombre (opcional)"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Primer Apellido *</label>
                      <input
                        type="text"
                        className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none focus:border-emerald-600"
                        value={formData.apellido_1 || ''}
                        onChange={(e) => handleInputChange('apellido_1', e.target.value)}
                        placeholder="Primer apellido"
                        required
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Segundo Apellido</label>
                      <input
                        type="text"
                        className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                        value={formData.apellido_2 || ''}
                        onChange={(e) => handleInputChange('apellido_2', e.target.value)}
                        placeholder="Segundo apellido"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Fecha Nacimiento</label>
                      <input
                        type="date"
                        className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                        value={formData.fecha_nacimiento || ''}
                        onChange={(e) => handleInputChange('fecha_nacimiento', e.target.value)}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Estado Civil</label>
                      <select
                        className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-600"
                        value={formData.estado_civil || 'Soltero(a)'}
                        onChange={(e) => handleInputChange('estado_civil', e.target.value)}
                      >
                        <option value="Soltero(a)">Soltero(a)</option>
                        <option value="Casado(a)">Casado(a)</option>
                        <option value="Divorciado(a)">Divorciado(a)</option>
                        <option value="Viudo(a)">Viudo(a)</option>
                        <option value="Conviviente">Conviviente</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Nacionalidad</label>
                      <input
                        type="text"
                        className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                        value={formData.nacionalidad || 'Peruano(a)'}
                        onChange={(e) => handleInputChange('nacionalidad', e.target.value)}
                      />
                    </div>
                    <div className="flex items-center gap-2 mt-6">
                      <input
                        type="checkbox"
                        id="residente_peru"
                        className="rounded text-emerald-600 focus:ring-emerald-600 h-4 w-4"
                        checked={formData.residente_peru ?? true}
                        onChange={(e) => handleInputChange('residente_peru', e.target.checked)}
                      />
                      <label htmlFor="residente_peru" className="text-xs font-bold text-slate-700 dark:text-slate-400">¿Es residente en el Perú?</label>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Correo Electrónico</label>
                      <input
                        type="email"
                        className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                        value={formData.email || ''}
                        onChange={(e) => handleInputChange('email', e.target.value)}
                        placeholder="nombre@ejemplo.com"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Teléfono / Celular</label>
                      <input
                        type="text"
                        className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                        value={formData.telefono || ''}
                        onChange={(e) => handleInputChange('telefono', e.target.value)}
                        placeholder="N° Teléfono"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Dirección Fiscal</label>
                    <textarea
                      rows={2}
                      className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                      value={formData.direccion_fiscal || ''}
                      onChange={(e) => handleInputChange('direccion_fiscal', e.target.value)}
                      placeholder="Dirección fiscal registrada"
                    />
                  </div>

                  <div className="w-1/3 flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Código Postal</label>
                    <input
                      type="text"
                      className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                      value={formData.codigo_postal || ''}
                      onChange={(e) => handleInputChange('codigo_postal', e.target.value)}
                    />
                  </div>
                </div>
              )}

              {/* --- SUB-TAB 2: CÓNYUGE --- */}
              {formActiveTab === 'conyuge' && (
                <div className="flex flex-col gap-4 animate-fadeIn">
                  <h4 className="text-xs font-bold text-slate-805 dark:text-slate-200 uppercase tracking-tight text-slate-700">Información del Cónyuge</h4>
                  
                  {(!['Casado(a)', 'Conviviente'].includes(formData.estado_civil || '')) ? (
                    <div className="bg-slate-50 dark:bg-slate-950 text-slate-450 dark:text-slate-500 border border-slate-200 dark:border-slate-850 rounded-xl p-6 text-center text-xs font-semibold">
                      🔒 No disponible. Se habilita únicamente si el Estado Civil es "Casado(a)" o "Conviviente" (Actual: {formData.estado_civil || 'Soltero'}).
                    </div>
                  ) : (
                    <div className="flex flex-col gap-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Primer Nombre Cónyuge</label>
                          <input
                            type="text"
                            className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                            value={formData.conyuge_nombre_1 || ''}
                            onChange={(e) => handleInputChange('conyuge_nombre_1', e.target.value)}
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Segundo Nombre Cónyuge</label>
                          <input
                            type="text"
                            className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                            value={formData.conyuge_nombre_2 || ''}
                            onChange={(e) => handleInputChange('conyuge_nombre_2', e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Primer Apellido Cónyuge</label>
                          <input
                            type="text"
                            className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                            value={formData.conyuge_apellido_1 || ''}
                            onChange={(e) => handleInputChange('conyuge_apellido_1', e.target.value)}
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Segundo Apellido Cónyuge</label>
                          <input
                            type="text"
                            className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                            value={formData.conyuge_apellido_2 || ''}
                            onChange={(e) => handleInputChange('conyuge_apellido_2', e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Tipo Doc Cónyuge</label>
                          <select
                            className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                            value={formData.conyuge_tipo_documento || 'DNI'}
                            onChange={(e) => handleInputChange('conyuge_tipo_documento', e.target.value)}
                          >
                            <option value="DNI">DNI</option>
                            <option value="CEX">CEX</option>
                            <option value="PASAPORTE">PASAPORTE</option>
                          </select>
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">N° Documento Cónyuge</label>
                          <input
                            type="text"
                            className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                            value={formData.conyuge_num_documento || ''}
                            onChange={(e) => handleInputChange('conyuge_num_documento', e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* --- SUB-TAB 3: LABORAL --- */}
              {formActiveTab === 'laboral' && (
                <div className="flex flex-col gap-4 animate-fadeIn">
                  <h4 className="text-xs font-bold text-slate-805 dark:text-slate-200 uppercase tracking-tight text-slate-700">Información Laboral</h4>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Ocupación / Profesión</label>
                      <input
                        type="text"
                        className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                        value={formData.ocupacion || ''}
                        onChange={(e) => handleInputChange('ocupacion', e.target.value)}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Cargo Ocupado</label>
                      <input
                        type="text"
                        className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                        value={formData.cargo_ocupado || ''}
                        onChange={(e) => handleInputChange('cargo_ocupado', e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Centro Laboral</label>
                      <input
                        type="text"
                        className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                        value={formData.centro_labores || ''}
                        onChange={(e) => handleInputChange('centro_labores', e.target.value)}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Antigüedad Laboral (Años)</label>
                      <input
                        type="number"
                        className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                        value={formData.antiguedad_laboral_anios ?? 0}
                        onChange={(e) => handleInputChange('antiguedad_laboral_anios', parseInt(e.target.value, 10) || 0)}
                        min={0}
                        max={60}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* --- SUB-TAB 4: BANCARIO --- */}
              {formActiveTab === 'bancario' && (
                <div className="flex flex-col gap-6 animate-fadeIn">
                  
                  {/* Cuentas Soles */}
                  <div className="flex flex-col gap-3">
                    <h4 className="text-xs font-bold text-emerald-600 dark:text-emerald-450 uppercase tracking-tight">Cuentas Soles Oficiales (PEN)</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Banco (PEN)</label>
                        <input
                          type="text"
                          className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                          value={formData.banco_nombre_pen || ''}
                          onChange={(e) => handleInputChange('banco_nombre_pen', e.target.value)}
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">N° Cuenta (PEN)</label>
                        <input
                          type="text"
                          className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                          value={formData.numero_cuenta_pen || ''}
                          onChange={(e) => handleInputChange('numero_cuenta_pen', e.target.value)}
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">CCI (PEN)</label>
                        <input
                          type="text"
                          className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                          value={formData.cci_pen || ''}
                          onChange={(e) => handleInputChange('cci_pen', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  <hr className="border-slate-100 dark:border-slate-800/80" />

                  {/* Cuentas Dólares */}
                  <div className="flex flex-col gap-3">
                    <h4 className="text-xs font-bold text-blue-600 dark:text-blue-450 uppercase tracking-tight">Cuentas Dólares Oficiales (USD)</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Banco (USD)</label>
                        <input
                          type="text"
                          className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                          value={formData.banco_nombre_usd || ''}
                          onChange={(e) => handleInputChange('banco_nombre_usd', e.target.value)}
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">N° Cuenta (USD)</label>
                        <input
                          type="text"
                          className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                          value={formData.numero_cuenta_usd || ''}
                          onChange={(e) => handleInputChange('numero_cuenta_usd', e.target.value)}
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">CCI (USD)</label>
                        <input
                          type="text"
                          className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                          value={formData.cci_usd || ''}
                          onChange={(e) => handleInputChange('cci_usd', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                </div>
              )}

              {/* --- SUB-TAB 5: COMPLIANCE --- */}
              {formActiveTab === 'compliance' && (
                <div className="flex flex-col gap-4 animate-fadeIn">
                  <h4 className="text-xs font-bold text-slate-805 dark:text-slate-200 uppercase tracking-tight text-slate-700">Debida Diligencia y Cumplimiento</h4>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex items-center gap-2 mt-3">
                      <input
                        type="checkbox"
                        id="es_pep"
                        className="rounded text-emerald-600 focus:ring-emerald-600 h-4 w-4"
                        checked={formData.es_pep || false}
                        onChange={(e) => handleInputChange('es_pep', e.target.checked)}
                      />
                      <label htmlFor="es_pep" className="text-xs font-bold text-slate-700 dark:text-slate-400">¿Es Persona Expuesta Políticamente (PEP)?</label>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Estado Compliance</label>
                      <select
                        className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-600"
                        value={formData.estado_compliance || 'borrador'}
                        onChange={(e) => handleInputChange('estado_compliance', e.target.value)}
                      >
                        <option value="borrador">BORRADOR</option>
                        <option value="solicitado">PENDIENTE / SOLICITADO</option>
                        <option value="aprobado">APROBADO</option>
                        <option value="rechazado">RECHAZADO</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Detalle PEP (Si aplica)</label>
                    <textarea
                      rows={2}
                      className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                      value={formData.pep_detalle || ''}
                      onChange={(e) => handleInputChange('pep_detalle', e.target.value)}
                    />
                  </div>

                  <hr className="border-slate-100 dark:border-slate-800/80" />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Perfil de Riesgo</label>
                      <select
                        className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-600"
                        value={formData.perfil_riesgo || 'Medio'}
                        onChange={(e) => handleInputChange('perfil_riesgo', e.target.value)}
                      >
                        <option value="Bajo">Bajo</option>
                        <option value="Medio">Medio</option>
                        <option value="Alto">Alto</option>
                      </select>
                    </div>
                    
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Fecha Solicitud Compliance</label>
                      <input
                        type="date"
                        className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                        value={formData.fecha_solicitud_compliance || ''}
                        onChange={(e) => handleInputChange('fecha_solicitud_compliance', e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Observaciones de Cumplimiento</label>
                    <textarea
                      rows={2}
                      className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold focus:outline-none"
                      value={formData.observaciones_compliance || ''}
                      onChange={(e) => handleInputChange('observaciones_compliance', e.target.value)}
                    />
                  </div>
                </div>
              )}

              {/* Errores del formulario */}
              {formSubmitError && (
                <div className="bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900 rounded-lg p-3 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle size={14} />
                  <span>{formSubmitError}</span>
                </div>
              )}

              {/* Éxito del formulario */}
              {formSubmitSuccess && (
                <div className="bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border border-emerald-250 dark:border-emerald-900 rounded-lg p-3 text-xs font-semibold flex items-center gap-2">
                  <CheckCircle size={14} />
                  <span>¡Datos guardados con éxito en Supabase! Cerrando formulario...</span>
                </div>
              )}

            </form>

            {/* Pie del Modal */}
            <div className="p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-150 dark:border-slate-850 flex items-center justify-end gap-2.5">
              <button 
                type="button" 
                className="h-9 text-xs font-bold px-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 cursor-pointer hover:bg-slate-50 transition-colors"
                onClick={() => setIsModalOpen(false)}
              >
                Cancelar
              </button>
              <button 
                type="submit" 
                onClick={handleFormSubmit}
                className="h-9 text-xs font-black uppercase tracking-wider px-6 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-sm"
              >
                💾 Guardar Ficha
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Modal de Confirmacion Rollback: requiere escribir EJECUTAR */}
      {rollbackModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            <div className="bg-rose-600 px-6 py-4 flex items-center gap-3">
              <Undo2 size={20} className="text-white" />
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-wider">Confirmacion de Rollback</h3>
                <p className="text-[10px] text-rose-200 font-semibold">Operacion destructiva - no se puede deshacer</p>
              </div>
            </div>
            <div className="px-6 py-5 flex flex-col gap-4">
              <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900 rounded-xl p-4 text-xs text-rose-800 dark:text-rose-300 leading-relaxed font-medium">
                Esta accion eliminara <strong>todos los asientos</strong> del periodo <code className="bg-rose-100 dark:bg-rose-900 px-1 py-0.5 rounded font-black">{fEnd}</code> y revertira los contratos cerrados a estado <strong>emitido</strong> y los cronogramas a <strong>PENDIENTE</strong>.
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Para confirmar, escribe <span className="text-rose-600 font-black">EJECUTAR</span> en el campo:
                </label>
                <input
                  type="text"
                  className="w-full bg-slate-50 dark:bg-slate-950 border-2 border-slate-200 dark:border-slate-700 focus:border-rose-500 dark:focus:border-rose-500 rounded-xl py-2.5 px-4 text-sm font-black text-slate-800 dark:text-slate-100 placeholder-slate-300 dark:placeholder-slate-600 focus:outline-none transition-colors tracking-widest uppercase"
                  placeholder="Escribe EJECUTAR aqui..."
                  value={rollbackConfirmText}
                  onChange={(e) => setRollbackConfirmText(e.target.value.toUpperCase())}
                  autoFocus
                />
              </div>
            </div>
            <div className="px-6 pb-5 flex items-center justify-end gap-3">
              <button
                type="button"
                className="h-9 text-xs font-bold px-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 cursor-pointer transition-colors"
                onClick={() => { setRollbackModalOpen(false); setRollbackConfirmText(''); }}
                disabled={rollbackLoading}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={`h-9 text-xs font-black uppercase tracking-wider px-6 rounded-xl text-white shadow transition-all flex items-center gap-2 ${
                  rollbackConfirmText === 'EJECUTAR' && !rollbackLoading
                    ? 'bg-rose-600 hover:bg-rose-700 cursor-pointer'
                    : 'bg-slate-300 dark:bg-slate-700 cursor-not-allowed opacity-60'
                }`}
                onClick={handleRollback}
                disabled={rollbackConfirmText !== 'EJECUTAR' || rollbackLoading}
              >
                {rollbackLoading ? <Loader2 size={14} className="animate-spin" /> : <Undo2 size={14} />}
                <span>Ejecutar Rollback</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
