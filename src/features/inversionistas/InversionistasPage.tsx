// src/features/inversionistas/InversionistasPage.tsx
import React, { useEffect, useState } from 'react';
import { getInversionistas, upsertInversionista } from '../../services/inversionistasService';
import type { Inversionista } from '../../services/inversionistasService';
import { generateRetornosV40 } from '../../utils/financialCalculator';
import { supabase } from '../../services/supabaseClient';
import * as XLSX from 'xlsx';
import { 
  Search, Loader2, AlertCircle, RefreshCw, Edit2, UserPlus, 
  FileSpreadsheet, FileText, CheckCircle, AlertTriangle, 
  ShieldCheck, Undo2, X, Calendar, Ban
} from 'lucide-react';

export const InversionistasPage: React.FC = () => {
  // Tabs principales del módulo
  const [activeSubTab, setActiveSubTab] = useState<'datos' | 'retornos' | 'retornos_react' | 'documentos'>('datos');


  // Estado común de partícipes
  const [inversionistas, setInversionistas] = useState<Inversionista[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedRange, setSelectedRange] = useState<string>('TODOS');

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
  const [officialRegisterLoading, setOfficialRegisterLoading] = useState<boolean>(false);
  const [registerSuccessMsg, setRegisterSuccessMsg] = useState<string | null>(null);

  // Estado de Generación Documentos
  const [docFondo, setDocFondo] = useState<string>('');
  const [docProcessing, setDocProcessing] = useState<boolean>(false);
  const [batchReady, setBatchReady] = useState<boolean>(false);
  const [batchData, setBatchData] = useState<any>(null);

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

  // Exportar Excel Detallado (SheetJS)
  const handleExportExcelV40 = async () => {
    let currentResult = calcResult;
    if (!currentResult) {
      currentResult = await handleRunV40Calculation();
    }
    if (!currentResult || Object.keys(currentResult.xlsDict).length === 0) {
      alert("No hay datos calculados para exportar (posible filtración de ciclo).");
      return;
    }

    const wb = XLSX.utils.book_new();
    for (const [fondoId, filas] of Object.entries(currentResult.xlsDict)) {
      const ws = XLSX.utils.json_to_sheet(filas as any[]);
      XLSX.utils.book_append_sheet(wb, ws, `Fondo_${fondoId.slice(0, 24)}`);
    }

    XLSX.writeFile(wb, `v40_COMPLETO_${fEnd}.xlsx`);
    setExcelDownloaded(true);
  };

  // Exportar / Imprimir PDF Condensado (Generación de Ventana de Impresión HTML)
  const handleExportPDFV40 = async () => {
    let currentResult = calcResult;
    if (!currentResult) {
      currentResult = await handleRunV40Calculation();
    }
    if (!currentResult || currentResult.pdfData.length === 0) {
      alert("No hay datos calculados para exportar en PDF.");
      return;
    }

    // Generar layout de impresión premium
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("Por favor habilita las ventanas emergentes (popups) para ver el reporte PDF.");
      return;
    }

    const htmlContent = `
      <html>
        <head>
          <title>Reporte de Auditoría InAndes v40 - ${fEnd}</title>
          <style>
            body { font-family: 'Outfit', 'Inter', sans-serif; color: #1e293b; margin: 20px; font-size: 11px; }
            h2 { color: #064e3b; margin-bottom: 2px; text-transform: uppercase; font-size: 16px; border-bottom: 2px solid #059669; padding-bottom: 4px; }
            .meta { font-size: 10px; color: #64748b; margin-bottom: 15px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 25px; page-break-inside: avoid; }
            th { background-color: #0f172a; color: white; font-weight: bold; text-transform: uppercase; font-size: 8px; padding: 6px 4px; text-align: left; }
            td { border-bottom: 1px solid #e2e8f0; padding: 5px 4px; }
            .totals-row { background-color: #f1f5f9; font-weight: bold; }
            .aumento-row { color: #0369a1; font-style: italic; background-color: #f0f9ff; }
            .text-right { text-align: right; }
            .badge { padding: 1px 4px; border-radius: 4px; font-size: 8px; font-weight: bold; color: white; }
            .bg-soles { background-color: #10b981; }
            .bg-usd { background-color: #3b82f6; }
            @media print {
              .no-print { display: none; }
              body { margin: 10px; }
            }
          </style>
        </head>
        <body>
          <h2>INANDES CRM - REPORTE DE AUDITORÍA CONTABLE V40</h2>
          <div class="meta">Periodo: ${fStart} al ${fEnd} | Generado el: ${new Date().toLocaleDateString()}</div>
          
          ${currentResult.pdfData.map((fData: any) => `
            <h3>Fondo: ${fData.fondo.nombre_fondo} (${fData.fondo.id_fondo})</h3>
            <table>
              <thead>
                <tr>
                  <th>N°</th>
                  <th>Certificado</th>
                  <th>Inversionista</th>
                  <th class="text-right">Capital Base</th>
                  <th class="text-right">Int. Bruto</th>
                  <th class="text-right">IR (5%)</th>
                  <th class="text-right">Neto Disp.</th>
                  <th class="text-right">Capitaliz.</th>
                  <th class="text-right">Reparto</th>
                  <th class="text-right">Deducciones</th>
                  <th class="text-right">Rescates</th>
                  <th class="text-right">Capital Final</th>
                </tr>
              </thead>
              <tbody>
                ${fData.blocks[0].rows.map((r: any) => `
                  <tr class="${r.tipo === 'AUMENTO' ? 'aumento-row' : ''}">
                    <td>${r.n_orden || ''}</td>
                    <td>${r.id}</td>
                    <td>${r.inversionista || (r.tipo === 'AUMENTO' ? '└─ Incremento de Capital' : '')}</td>
                    <td class="text-right">${formatCurrencyVal(r.capital, fData.fondo.moneda)}</td>
                    <td class="text-right">${formatCurrencyVal(r.bruto_total, fData.fondo.moneda)}</td>
                    <td class="text-right">${r.tipo === 'CERT' ? formatCurrencyVal(r.impuesto_total, fData.fondo.moneda) : '-'}</td>
                    <td class="text-right">${r.tipo === 'CERT' ? formatCurrencyVal(r.base_neta, fData.fondo.moneda) : '-'}</td>
                    <td class="text-right">${r.tipo === 'CERT' ? formatCurrencyVal(r.capitalizacion, fData.fondo.moneda) : '-'}</td>
                    <td class="text-right">${r.tipo === 'CERT' ? formatCurrencyVal(r.reparto_valor, fData.fondo.moneda) : '-'}</td>
                    <td class="text-right">${r.tipo === 'CERT' ? formatCurrencyVal(r.deducciones_total, fData.fondo.moneda) : '-'}</td>
                    <td class="text-right">${r.tipo === 'CERT' ? formatCurrencyVal(r.devolucion_capital, fData.fondo.moneda) : '-'}</td>
                    <td class="text-right">${r.tipo === 'CERT' ? formatCurrencyVal(r.capital_final, fData.fondo.moneda) : '-'}</td>
                  </tr>
                `).join('')}
                <tr class="totals-row">
                  <td colspan="3">TOTALES</td>
                  <td class="text-right">${formatCurrencyVal(fData.totals.capital, fData.fondo.moneda)}</td>
                  <td class="text-right">${formatCurrencyVal(fData.totals.bruto_total, fData.fondo.moneda)}</td>
                  <td class="text-right">${formatCurrencyVal(fData.totals.impuesto_total, fData.fondo.moneda)}</td>
                  <td class="text-right">${formatCurrencyVal(fData.totals.base_neta, fData.fondo.moneda)}</td>
                  <td class="text-right">${formatCurrencyVal(fData.totals.capitalizacion, fData.fondo.moneda)}</td>
                  <td class="text-right">${formatCurrencyVal(fData.totals.reparto_valor, fData.fondo.moneda)}</td>
                  <td class="text-right">${formatCurrencyVal(fData.totals.deducciones_total, fData.fondo.moneda)}</td>
                  <td class="text-right">${formatCurrencyVal(fData.totals.devolucion_capital, fData.fondo.moneda)}</td>
                  <td class="text-right">${formatCurrencyVal(fData.totals.capital_final, fData.fondo.moneda)}</td>
                </tr>
              </tbody>
            </table>
          `).join('')}
        </body>
      </html>
    `;

    function formatCurrencyVal(amount: number, moneda: string) {
      if (amount === undefined || amount === null) return '-';
      return (moneda === 'USD' ? '$ ' : 'S/ ') + amount.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 500);

    setPdfDownloaded(true);
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

  // Reversión (Rollback) de periodo
  const handleRollback = async () => {
    const doubleCheck = confirm("⚠️ ATENCIÓN: El Rollback eliminará todos los asientos registrados en la fecha de corte del periodo y revertirá los contratos cerrados a estado 'emitido'. ¿Desea proceder?");
    if (!doubleCheck) return;

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

      alert(`Rollback completado con éxito. Se eliminaron los asientos contables y se reactivaron los contratos y cuotas del periodo.`);
      
      // Actualizar vista
      verificarColision(fEnd);
      fetchCycleDashboard(v40SelYear);
    } catch (err: any) {
      alert(`Error en el Rollback: ${err.message}`);
    }
  };

  // --- Lógica de Pestaña C: Generación Documentos ---
  const handleProcessDocBatch = async () => {
    if (!docFondo) return;
    setDocProcessing(true);
    setBatchReady(false);
    try {
      // Usar motor financiero local para obtener los datos de la pestaña actual
      // Tomamos como rango el año actual o el seleccionado
      const year = v40SelYear;
      const s_d = `${year}-01-01`;
      const e_d = `${year}-12-31`; // calculamos año completo para lotes
      
      const res = await generateRetornosV40(docFondo, s_d, e_d);
      
      // Mapear inversionistas para direcciones fiscales
      const { data: invs } = await supabase.from('crm_inversionistas').select('codigo_inversionista, documento_identidad, direccion_fiscal');
      const addressMap: Record<string, string> = {};
      if (invs) {
        for (const i of invs) {
          const key = String(i.documento_identidad || i.codigo_inversionista).toLowerCase();
          addressMap[key] = i.direccion_fiscal || "Domicilio fiscal no registrado";
        }
      }

      // Preparar lotes
      const eeccList = res.asientos.map(a => {
        const payload = a.payload_asiento || {};
        return {
          id_certificado: a.id_certificado,
          inversionista: payload.inversionista,
          moneda: payload.moneda,
          capital_base: a.capital_base,
          interes_bruto: a.interes_generado_bruto,
          impuesto: a.impuestos_renta,
          capital_final: a.capital_final_saldo,
          direccion: addressMap[String(a.id_certificado.split('.')[0]).toLowerCase()] || "No registrado"
        };
      });

      const retencionesList = res.asientos.filter(a => a.impuestos_renta > 0).map(a => {
        const payload = a.payload_asiento || {};
        return {
          id_certificado: a.id_certificado,
          inversionista: payload.inversionista,
          moneda: payload.moneda,
          impuesto: a.impuestos_renta,
          interes_bruto: a.interes_generado_bruto
        };
      });

      setBatchData({ eecc: eeccList, retenciones: retencionesList });
      setBatchReady(true);
    } catch (err: any) {
      alert(`Error al preparar batch: ${err.message}`);
    } finally {
      setDocProcessing(false);
    }
  };

  const handleDownloadEECCBatch = () => {
    if (!batchData) return;
    // Imprimir o simular descarga
    alert(`Generando PDF unificado para ${batchData.eecc.length} Estados de Cuenta (Batch)...`);
  };

  const handleDownloadRetBatch = () => {
    if (!batchData) return;
    alert(`Generando PDF unificado para ${batchData.retenciones.length} Certificados de Retención (Batch)...`);
  };

  // --- Lógica del Formulario Modal de Partícipes ---
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
        estado_compliance: 'borrador',
        perfil_riesgo: 'Medio'
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

    // Filtro por rango alfabético
    let matchesRange = true;
    if (selectedRange !== 'TODOS') {
      const apellido = (item.apellido_1 || item.nombre_completo || 'Z').trim();
      const firstLetter = apellido.normalize("NFD").replace(/[\u0300-\u036f]/g, "").charAt(0).toUpperCase();
      
      if (selectedRange === 'ABC') matchesRange = /^[A-C]/.test(firstLetter);
      else if (selectedRange === 'DEF') matchesRange = /^[D-F]/.test(firstLetter);
      else if (selectedRange === 'GHI') matchesRange = /^[G-I]/.test(firstLetter);
      else if (selectedRange === 'JKL') matchesRange = /^[J-L]/.test(firstLetter);
      else if (selectedRange === 'MNO') matchesRange = /^[M-O]/.test(firstLetter);
      else if (selectedRange === 'PQR') matchesRange = /^[P-R]/.test(firstLetter);
      else if (selectedRange === 'STU') matchesRange = /^[S-U]/.test(firstLetter);
      else if (selectedRange === 'VWX') matchesRange = /^[V-X]/.test(firstLetter);
      else if (selectedRange === 'YZ') matchesRange = /^[Y-Z]/.test(firstLetter);
      else matchesRange = false;
    }

    return matchesText && matchesRange;
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
              activeSubTab === 'retornos' 
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400' 
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-350'
            }`}
            onClick={() => setActiveSubTab('retornos')}
          >
            💹 Retornos y Rendimientos (Legacy)
          </button>

          <button
            className={`py-3 text-xs font-black tracking-wider uppercase border-b-2 cursor-pointer transition-colors flex items-center gap-1.5 ${
              activeSubTab === 'retornos_react' 
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' 
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-350'
            }`}
            onClick={() => setActiveSubTab('retornos_react')}
          >
            <span>🚀 Retornos y Rendimientos React</span>
            <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
              NUEVO
            </span>
          </button>

          <button
            className={`py-3 text-xs font-black tracking-wider uppercase border-b-2 cursor-pointer transition-colors ${
              activeSubTab === 'documentos' 
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400' 
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-350'
            }`}
            onClick={() => setActiveSubTab('documentos')}
          >
            📄 Generación Documentos
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
                className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg py-2 pl-9 pr-4 text-xs font-semibold text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-emerald-650 focus:ring-1 focus:ring-emerald-650 transition-all shadow-sm"
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
                className="h-9 text-xs font-bold flex items-center gap-1.5 px-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-650 dark:text-slate-300 cursor-pointer transition-colors shadow-sm"
                onClick={fetchDatos}
                disabled={loading}
              >
                <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                <span>Actualizar</span>
              </button>
            </div>
          </div>

          {/* Rango Alfabético (Tabs) */}
          <div className="flex flex-wrap gap-2 items-center justify-center sm:justify-start">
            {['ABC', 'DEF', 'GHI', 'JKL', 'MNO', 'PQR', 'STU', 'VWX', 'YZ', 'TODOS'].map((rango) => (
              <button
                key={rango}
                onClick={() => setSelectedRange(rango)}
                className={`px-4 py-1.5 rounded-full text-[11px] font-bold tracking-wide transition-all ${
                  selectedRange === rango 
                    ? 'bg-slate-800 text-white shadow-md dark:bg-emerald-600 border border-transparent' 
                    : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:border-slate-400 hover:text-slate-700 dark:hover:border-emerald-500 dark:hover:text-emerald-400'
                }`}
              >
                {rango}
              </button>
            ))}
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
                  const cleanName = inv.nombre_completo || `${inv.apellido_1} ${inv.apellido_2 || ''} ${inv.nombre_1} ${inv.nombre_2 || ''}`.replace(/\s+/g, ' ').trim();
                  
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

      {/* --- PESTAÑA B: RETORNOS Y RENDIMIENTOS (AUDITORÍA V40) --- */}
      {activeSubTab === 'retornos' && (
        <div className="flex flex-col gap-6 w-full animate-fadeIn">
          
          {/* Dashboard Global de Auditoría (Tiles de Ciclos) */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
            <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-4">
              📡 Panel de Ciclos y Auditoría Real-Time ({v40SelYear})
            </h3>
            
            {/* Ciclos Bimestrales */}
            <div className="mb-4">
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">Ciclos Bimestrales (B1 - B6)</span>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-2">
                {[1, 2, 3, 4, 5, 6].map((i) => {
                  const list = cycleDashboard.B?.[i] || [];
                  return (
                    <div key={`B-${i}`} className="bg-slate-50/50 dark:bg-slate-950 border-t-3 border-rose-500 dark:border-rose-700 border-x border-b border-slate-200 dark:border-slate-850 rounded-lg p-3 min-h-[110px] flex flex-col">
                      <span className="text-xs font-black text-slate-700 dark:text-slate-300">B{i}</span>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {list.length > 0 ? list.map((f: string) => (
                          <span key={f} className="px-1.5 py-0.5 bg-rose-500 text-white rounded text-[8px] font-black">{f}</span>
                        )) : <span className="text-[9px] text-slate-350 dark:text-slate-600 font-semibold italic">Vacío</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Ciclos Trimestrales */}
            <div>
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">Ciclos Trimestrales (Q1 - Q4)</span>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-2">
                {[1, 2, 3, 4].map((i) => {
                  const list = cycleDashboard.Q?.[i] || [];
                  return (
                    <div key={`Q-${i}`} className="bg-slate-50/50 dark:bg-slate-950 border-t-3 border-emerald-500 dark:border-emerald-700 border-x border-b border-slate-200 dark:border-slate-850 rounded-lg p-3 min-h-[90px] flex flex-col">
                      <span className="text-xs font-black text-slate-700 dark:text-slate-300">Q{i}</span>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {list.length > 0 ? list.map((f: string) => (
                          <span key={f} className="px-1.5 py-0.5 bg-emerald-500 text-white rounded text-[8px] font-black">{f}</span>
                        )) : <span className="text-[9px] text-slate-350 dark:text-slate-600 font-semibold italic">Vacío</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Filtros Contables del Motor */}
          <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-wrap gap-4 items-end shadow-sm">
            
            {/* Fondo Selector */}
            <div className="flex flex-col gap-1.5 min-w-[200px] flex-1">
              <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Fondo</label>
              <select
                className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-lg py-1.5 px-3 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-600"
                value={v40SelFondo}
                onChange={(e) => setV40SelFondo(e.target.value)}
              >
                <option value="TODOS">TODOS LOS FONDOS</option>
                {fondosDisponibles.map(f => (
                  <option key={f.id_fondo} value={f.id_fondo}>{f.nombre_fondo}</option>
                ))}
              </select>
            </div>

            {/* Año Selector */}
            <div className="flex flex-col gap-1.5 w-[90px]">
              <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Año</label>
              <select
                className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-lg py-1.5 px-3 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-600"
                value={v40SelYear}
                onChange={(e) => setV40SelYear(Number(e.target.value))}
              >
                <option value={2024}>2024</option>
                <option value={2025}>2025</option>
                <option value={2026}>2026</option>
                <option value={2027}>2027</option>
              </select>
            </div>

            {/* Ciclo (Bimestre / Trimestre) */}
            <div className="flex flex-col gap-1.5 w-[120px]">
              <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Ciclo</label>
              <select
                className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-lg py-1.5 px-3 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-600"
                value={v40SelCiclo}
                onChange={(e) => setV40SelCiclo(e.target.value as 'Bimestre' | 'Trimestre')}
              >
                <option value="Bimestre">Bimestre</option>
                <option value="Trimestre">Trimestre</option>
              </select>
            </div>

            {/* N° Selector */}
            <div className="flex flex-col gap-1.5 w-[140px]">
              <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Periodo</label>
              <select
                className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-lg py-1.5 px-3 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-600"
                value={v40SelNum}
                onChange={(e) => setV40SelNum(Number(e.target.value))}
              >
                {v40SelCiclo === 'Bimestre' ? (
                  <>
                    <option value={1}>1: Ene-Feb</option>
                    <option value={2}>2: Mar-Abr</option>
                    <option value={3}>3: May-Jun</option>
                    <option value={4}>4: Jul-Ago</option>
                    <option value={5}>5: Sep-Oct</option>
                    <option value={6}>6: Nov-Dic</option>
                  </>
                ) : (
                  <>
                    <option value={1}>1: Ene-Mar</option>
                    <option value={2}>2: Abr-Jun</option>
                    <option value={3}>3: Jul-Sep</option>
                    <option value={4}>4: Oct-Dic</option>
                  </>
                )}
              </select>
            </div>
          </div>

          {/* Información del Periodo y Bloqueos de Seguridad */}
          <div className="flex flex-col gap-3">
            <div className="text-xs text-slate-500 dark:text-slate-450 font-bold flex items-center gap-1.5">
              <Calendar size={14} className="text-slate-400" />
              <span>Periodo Calculado: </span>
              <span className="text-slate-800 dark:text-slate-200 font-mono font-black bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                {fStart}
              </span>
              <span>al</span>
              <span className="text-slate-800 dark:text-slate-200 font-mono font-black bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                {fEnd}
              </span>
            </div>

            {collisionCount > 0 && (
              <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900 rounded-xl p-4 flex items-start gap-3">
                <AlertTriangle className="text-rose-650 dark:text-rose-450 shrink-0" size={18} />
                <div className="flex flex-col gap-1">
                  <h4 className="text-xs font-bold text-rose-800 dark:text-rose-400 uppercase tracking-tight">Bloqueo de Auditoría</h4>
                  <p className="text-[11px] text-rose-600 dark:text-rose-450 leading-relaxed font-semibold">
                    ⚠️ BLOQUEO: Ya existen {collisionCount} registros contables guardados en la fecha de corte {fEnd}. Si necesitas recalcular, primero debes ejecutar el Rollback en la zona de herramientas de seguridad.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Acciones del Motor Contable */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              className="h-12 text-xs font-black uppercase tracking-wider bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
              onClick={handleExportExcelV40}
              disabled={calcLoading || collisionCount > 0}
            >
              {calcLoading ? <Loader2 size={16} className="animate-spin text-emerald-600" /> : <FileSpreadsheet size={16} className="text-emerald-600" />}
              <span>Descargar Excel Detallado (v40)</span>
            </button>

            <button
              className="h-12 text-xs font-black uppercase tracking-wider bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
              onClick={handleExportPDFV40}
              disabled={calcLoading || collisionCount > 0}
            >
              {calcLoading ? <Loader2 size={16} className="animate-spin text-emerald-600" /> : <FileText size={16} className="text-blue-650" />}
              <span>Generar PDF Condensado (v40)</span>
            </button>
          </div>

          {/* Guardado Oficial en DB */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm mt-2 flex flex-col gap-4">
            <h3 className="text-sm font-bold text-slate-850 dark:text-slate-100 uppercase tracking-tight">
              💾 Ejecución Oficial: Registrar Asientos en Ledger v40
            </h3>

            {registerSuccessMsg && (
              <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-250 dark:border-emerald-900 rounded-xl p-4 flex items-start gap-3">
                <CheckCircle className="text-emerald-650 dark:text-emerald-450 shrink-0" size={18} />
                <p className="text-[11px] font-semibold text-emerald-750 dark:text-emerald-400 leading-relaxed">
                  {registerSuccessMsg}
                </p>
              </div>
            )}

            {collisionCount > 0 ? (
              <div className="bg-rose-50/50 dark:bg-rose-950/10 text-rose-600 dark:text-rose-450 border border-rose-150 dark:border-rose-900/60 rounded-xl p-4 text-[11px] font-semibold flex items-center gap-2">
                <Ban size={14} />
                <span>Bloqueo Activo: El periodo seleccionado ya está cerrado.</span>
              </div>
            ) : (!excelDownloaded || !pdfDownloaded) ? (
              <div className="bg-amber-50 dark:bg-amber-950/15 border border-amber-250 dark:border-amber-900 rounded-xl p-4 flex items-start gap-3">
                <AlertTriangle className="text-amber-600 dark:text-amber-450 shrink-0 mt-0.5" size={16} />
                <div className="flex flex-col gap-0.5">
                  <h4 className="text-[11px] font-bold text-amber-800 dark:text-amber-400 uppercase tracking-tight">Bloqueo de Auditoría</h4>
                  <p className="text-[10px] text-amber-650 dark:text-amber-450 font-medium">
                    🔒 Para habilitar el registro en la base de datos oficial, primero debes descargar el **Excel Detallado** y generar el **PDF Condensado** de la auditoría.
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-emerald-50 dark:bg-emerald-950/15 border border-emerald-250 dark:border-emerald-900 rounded-xl p-4 flex items-start gap-3">
                <ShieldCheck className="text-emerald-600 dark:text-emerald-450 shrink-0 mt-0.5" size={16} />
                <div className="flex flex-col gap-0.5">
                  <h4 className="text-[11px] font-bold text-emerald-800 dark:text-emerald-400 uppercase tracking-tight">Revisión Completada</h4>
                  <p className="text-[10px] text-emerald-650 dark:text-emerald-450 font-medium">
                    🔓 Auditoría detectada. La firma de revisión está lista. El botón de registro contable permanente se encuentra desbloqueado.
                  </p>
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-4">
              <button
                className="h-10 text-xs font-black uppercase tracking-wider bg-emerald-600 hover:bg-emerald-700 text-white px-6 rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                onClick={handleRegisterPermanent}
                disabled={!excelDownloaded || !pdfDownloaded || collisionCount > 0 || officialRegisterLoading}
              >
                {officialRegisterLoading ? <Loader2 size={14} className="animate-spin text-white" /> : <CheckCircle size={14} />}
                <span>Registrar Permanente en DB</span>
              </button>

              <span className="text-[10px] text-slate-400 font-semibold max-w-sm">
                Al oficializar, se graban los asientos en formato JSON en el ledger de eventos de certificados, se cambian los contratos correspondientes a "Cerrado" y se procesan las cuotas del cronograma.
              </span>
            </div>
          </div>

          {/* Zona de Seguridad: Rollback */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-900 p-4 mt-2">
            <h3 className="text-xs font-bold text-slate-700 dark:text-slate-350 uppercase tracking-wider mb-3">
              🛠️ Herramientas de Seguridad y Reversión
            </h3>
            
            <div className="flex items-center gap-4 flex-wrap">
              <button
                className="h-9 text-xs font-bold bg-white hover:bg-rose-50 hover:text-rose-600 dark:bg-slate-850 dark:hover:bg-rose-950/20 dark:hover:text-rose-400 border border-slate-250 dark:border-slate-800 text-slate-650 dark:text-slate-300 rounded-lg px-4 flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                onClick={handleRollback}
              >
                <Undo2 size={13} />
                <span>Ejecutar Rollback (Limpiar Periodo)</span>
              </button>

              <span className="text-[10px] text-slate-400 font-medium max-w-md">
                Esta acción elimina del Ledger todos los asientos guardados en la fecha de corte seleccionada y reactiva los contratos cerrados a estado 'emitido' y los cronogramas a 'PENDIENTE'. Use con precaución.
              </span>
            </div>
          </div>

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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  className="h-12 text-xs font-black uppercase tracking-wider bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow hover:shadow-md transition-all"
                  onClick={async () => {
                    if (fEnd === '2026-02-28') {
                      window.open('/Reportes_Auditoria_2026-02-28/AUDITORIA_OFICIAL_SISTEMA_2026-02-28_PULIDO.xlsx', '_blank');
                      setExcelDownloaded(true);
                    } else {
                      await handleExportExcelV40();
                    }
                  }}
                >
                  <FileSpreadsheet size={18} />
                  <span>Descargar / Consultar Excel Maestro (Formato #,##0.00)</span>
                </button>

                <button
                  className="h-12 text-xs font-black uppercase tracking-wider bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow hover:shadow-md transition-all"
                  onClick={async () => {
                    if (fEnd === '2026-02-28') {
                      window.open('/Reportes_Auditoria_2026-02-28/REPORTE_OFICIAL_CIERRE_AUDITORIA_2026-02-28.pdf', '_blank');
                      setPdfDownloaded(true);
                    } else {
                      await handleExportPDFV40();
                    }
                  }}
                >
                  <FileText size={18} />
                  <span>Ver / Generar Reporte PDF Oficial (Geeksoft + InAndes)</span>
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
                  <CheckCircle className="text-emerald-650 dark:text-emerald-450 shrink-0" size={18} />
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
                    <p className="text-[10px] text-amber-650 dark:text-amber-450 font-medium">
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
                  onClick={handleRollback}
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


      {/* --- PESTAÑA C: GENERACIÓN DOCUMENTOS (BATCH) --- */}
      {activeSubTab === 'documentos' && (

        <div className="flex flex-col gap-6 w-full animate-fadeIn">
          
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
            <h3 className="text-xs font-bold text-slate-750 dark:text-slate-300 uppercase tracking-wider mb-2">
              📄 Generación Masiva de Documentos por Lote (Batch)
            </h3>
            <p className="text-xs text-slate-450 dark:text-slate-500 leading-relaxed max-w-xl mb-6">
              Permite procesar la contabilidad de certificados de un fondo específico y preparar de forma condensada los Estados de Cuenta (EECC) y Certificados de Retención del Impuesto para su descarga masiva en un solo PDF.
            </p>

            <div className="flex items-end gap-4 max-w-lg mb-6 bg-slate-50 dark:bg-slate-950 p-4 border border-slate-200 dark:border-slate-850 rounded-xl">
              <div className="flex flex-col gap-1 flex-1">
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Seleccione el Fondo</label>
                <select
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg py-1.5 px-3 text-xs font-semibold focus:outline-none"
                  value={docFondo}
                  onChange={(e) => {
                    setDocFondo(e.target.value);
                    setBatchReady(false);
                  }}
                >
                  {fondosDisponibles.map(f => (
                    <option key={f.id_fondo} value={f.id_fondo}>{f.nombre_fondo}</option>
                  ))}
                </select>
              </div>

              <button
                className="h-9 text-xs font-bold bg-emerald-650 hover:bg-emerald-705 text-white px-4 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer shadow transition-colors disabled:opacity-50"
                onClick={handleProcessDocBatch}
                disabled={!docFondo || docProcessing}
              >
                {docProcessing ? <Loader2 size={13} className="animate-spin text-white" /> : <RefreshCw size={13} />}
                <span>Procesar Data</span>
              </button>
            </div>

            {batchReady && batchData && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-slate-100 dark:border-slate-800/80 pt-6 animate-fadeIn">
                
                {/* Lote EECC */}
                <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl p-5 flex flex-col justify-between gap-4">
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-tight">Estados de Cuenta (EECC Batch)</h4>
                    <p className="text-[10px] text-slate-450 dark:text-slate-500 font-medium leading-relaxed mt-1">
                      Genera el lote unificado de estados de cuenta. Incluye datos de partícipes, saldo de capitalización, tasas y amortizaciones.
                    </p>
                    <div className="mt-3 text-xs font-bold text-slate-600 dark:text-slate-400">
                      📄 Registros en lote: <span className="text-emerald-600 dark:text-emerald-450 font-black">{batchData.eecc.length} EECC</span>
                    </div>
                  </div>

                  <button
                    className="h-10 text-xs font-black uppercase tracking-wider bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-800 hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-950/20 dark:hover:text-emerald-450 transition-colors rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                    onClick={handleDownloadEECCBatch}
                  >
                    <FileText size={14} className="text-emerald-600" />
                    <span>Descargar PDF Lote EECC</span>
                  </button>
                </div>

                {/* Lote Retenciones */}
                <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl p-5 flex flex-col justify-between gap-4">
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-tight">Certificados de Retención</h4>
                    <p className="text-[10px] text-slate-450 dark:text-slate-500 font-medium leading-relaxed mt-1">
                      Genera el lote unificado de certificados de retención de Impuesto a la Renta de 2da categoría (5%).
                    </p>
                    <div className="mt-3 text-xs font-bold text-slate-600 dark:text-slate-400">
                      📜 Registros con retención: <span className="text-blue-650 dark:text-blue-450 font-black">{batchData.retenciones.length} certificados</span>
                    </div>
                  </div>

                  <button
                    className="h-10 text-xs font-black uppercase tracking-wider bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-800 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950/20 dark:hover:text-blue-450 transition-colors rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-sm disabled:opacity-50"
                    onClick={handleDownloadRetBatch}
                    disabled={batchData.retenciones.length === 0}
                  >
                    <FileSpreadsheet size={14} className="text-blue-650" />
                    <span>Descargar PDF Lote Retenciones</span>
                  </button>
                </div>

              </div>
            )}
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
                        className="rounded text-emerald-600 focus:ring-emerald-650 h-4 w-4"
                        checked={formData.residente_peru ?? true}
                        onChange={(e) => handleInputChange('residente_peru', e.target.checked)}
                      />
                      <label htmlFor="residente_peru" className="text-xs font-bold text-slate-650 dark:text-slate-400">¿Es residente en el Perú?</label>
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
                    <h4 className="text-xs font-bold text-emerald-650 dark:text-emerald-450 uppercase tracking-tight">Cuentas Soles Oficiales (PEN)</h4>
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
                    <h4 className="text-xs font-bold text-blue-650 dark:text-blue-450 uppercase tracking-tight">Cuentas Dólares Oficiales (USD)</h4>
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
                        className="rounded text-emerald-600 focus:ring-emerald-650 h-4 w-4"
                        checked={formData.es_pep || false}
                        onChange={(e) => handleInputChange('es_pep', e.target.checked)}
                      />
                      <label htmlFor="es_pep" className="text-xs font-bold text-slate-650 dark:text-slate-400">¿Es Persona Expuesta Políticamente (PEP)?</label>
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
                <div className="bg-rose-50 dark:bg-rose-950/20 text-rose-650 dark:text-rose-400 border border-rose-200 dark:border-rose-900 rounded-lg p-3 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle size={14} />
                  <span>{formSubmitError}</span>
                </div>
              )}

              {/* Éxito del formulario */}
              {formSubmitSuccess && (
                <div className="bg-emerald-50 dark:bg-emerald-950/20 text-emerald-650 dark:text-emerald-400 border border-emerald-250 dark:border-emerald-900 rounded-lg p-3 text-xs font-semibold flex items-center gap-2">
                  <CheckCircle size={14} />
                  <span>¡Datos guardados con éxito en Supabase! Cerrando formulario...</span>
                </div>
              )}

            </form>

            {/* Pie del Modal */}
            <div className="p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-150 dark:border-slate-850 flex items-center justify-end gap-2.5">
              <button 
                type="button" 
                className="h-9 text-xs font-bold px-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-650 dark:text-slate-300 cursor-pointer hover:bg-slate-50 transition-colors"
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

    </div>
  );
};
