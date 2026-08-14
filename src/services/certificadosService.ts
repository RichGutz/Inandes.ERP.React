// src/services/certificadosService.ts
import { supabase } from './supabaseClient';
import type { CertificadoEvento } from './contratosService';

export interface CertificadoMaster {
  id_certificado: string;
  id_contrato: string;
  titulares_resumen: Array<{ nombre: string; documento: string; participacion_pct: number }>;
  monto_inversion: number;
  valor_cuota: number;
  numero_cuotas: number;
  estado: 'VIGENTE' | 'EXTINTO';
  fecha_emision: string;

  // Enriquecidos
  id_fondo?: string;
  nombre_fondo?: string;
  moneda?: string;
  plazo_meses?: string;
  fecha_cierre_fondo?: string | null;
  titular_1?: string;
  titular_2?: string;
  titular_3?: string;
  titular_4?: string;
  capital_actual?: number;
  ultimo_evento?: string;
  fecha_ultimo_evento?: string;
}

/**
 * Arquitectura Ledger-First:
 * Obtiene la totalidad de certificados construyéndolos directamente desde el libro contable
 * inmutable de eventos financieros (crm_certificados_eventos), enriqueciéndolos con los contratos
 * (crm_contratos), fondos (crm_fondos) e inversionistas (crm_inversionistas).
 */
export const getCertificadosMaster = async (): Promise<CertificadoMaster[]> => {
  // 1. Obtener la totalidad del Ledger Financial Events (ordenado por fecha más reciente)
  const { data: events, error: evtsErr } = await supabase
    .from('crm_certificados_eventos')
    .select('*')
    .order('fecha_periodo_fin', { ascending: false });

  if (evtsErr) throw new Error(`Error al obtener eventos de certificados: ${evtsErr.message}`);

  // 2. Obtener todos los contratos
  const { data: contracts, error: contractsErr } = await supabase
    .from('crm_contratos')
    .select('*');

  if (contractsErr) throw new Error(`Error al obtener contratos: ${contractsErr.message}`);
  const contractsMap = new Map<string, any>();
  if (contracts) {
    contracts.forEach(ct => contractsMap.set(ct.id_contrato, ct));
  }

  // 3. Obtener todos los fondos
  const { data: funds, error: fundsErr } = await supabase
    .from('crm_fondos')
    .select('*');
  
  if (fundsErr) throw new Error(`Error al obtener fondos: ${fundsErr.message}`);
  const fundsMap = new Map<string, any>();
  if (funds) {
    funds.forEach(fd => fundsMap.set(fd.id_fondo, fd));
  }

  // 4. Obtener todos los inversionistas para mapear nombres y documentos
  const { data: investors, error: invsErr } = await supabase
    .from('crm_inversionistas')
    .select('codigo_inversionista, nombre_completo, documento_identidad, nombre_1, nombre_2, apellido_1, apellido_2');

  if (invsErr) throw new Error(`Error al obtener inversionistas: ${invsErr.message}`);
  const invsMap = new Map<string, { nombre: string; documento: string }>();
  if (investors) {
    investors.forEach(r => {
      let fullName = r.nombre_completo;
      if (!fullName) {
        const nombres = [r.nombre_1, r.nombre_2].filter(Boolean).join(" ");
        const apellidos = [r.apellido_1, r.apellido_2].filter(Boolean).join(" ");
        fullName = `${nombres} ${apellidos}`.trim();
      }
      invsMap.set(r.codigo_inversionista, {
        nombre: fullName || 'S/N',
        documento: r.documento_identidad || 'S/N'
      });
    });
  }

  const masterMap = new Map<string, CertificadoMaster>();

  // 5. Mapear certificados desde el Ledger (crm_certificados_eventos)
  if (events) {
    events.forEach(evt => {
      const certId = evt.id_certificado || evt.id_contrato;
      if (!certId || masterMap.has(certId)) return; // ya procesamos el evento más reciente de este certificado

      const ctId = evt.id_contrato || certId;
      const ct = contractsMap.get(ctId) || contractsMap.get(certId) || {};
      const fd = fundsMap.get(ct.id_fondo) || {};

      // Titulares del contrato
      const i1 = invsMap.get(ct.id_inversionista_1);
      const i2 = ct.id_inversionista_2 ? invsMap.get(ct.id_inversionista_2) : null;
      const i3 = ct.id_inversionista_3 ? invsMap.get(ct.id_inversionista_3) : null;
      const i4 = ct.id_inversionista_4 ? invsMap.get(ct.id_inversionista_4) : null;

      const titularesResumen: Array<{ nombre: string; documento: string; participacion_pct: number }> = [];
      if (i1) titularesResumen.push({ ...i1, participacion_pct: ct.porcentaje_participacion_1 || 100 });
      if (i2) titularesResumen.push({ ...i2, participacion_pct: ct.porcentaje_participacion_2 || 0 });
      if (i3) titularesResumen.push({ ...i3, participacion_pct: ct.porcentaje_participacion_3 || 0 });
      if (i4) titularesResumen.push({ ...i4, participacion_pct: ct.porcentaje_participacion_4 || 0 });

      const capitalActual = Number(evt.capital_final_saldo ?? evt.capital_base ?? ct.monto_inversion ?? 0);
      const tipoEvt = evt.tipo_evento || 'EVENTO_LEDGER';
      const fechaEvt = evt.fecha_periodo_fin ? evt.fecha_periodo_fin.split('T')[0] : (ct.fecha_inicio || 'S/D');

      // Determinar si está VIGENTE o EXTINTO
      const estadoCt = (ct.estado || '').toLowerCase();
      const esCerrado = capitalActual <= 0 || 
                        tipoEvt.includes('cierre') || 
                        (tipoEvt.includes('rescate') && capitalActual === 0) || 
                        estadoCt.includes('cerrad') || 
                        estadoCt.includes('liquid') || 
                        estadoCt.includes('anulad');

      let isVigente = !esCerrado && capitalActual > 0;
      if (fd.fecha_cierre_fondo) {
        const fechaCierre = new Date(fd.fecha_cierre_fondo + 'T00:00:00');
        if (new Date() > fechaCierre) {
          isVigente = false;
        }
      }

      masterMap.set(certId, {
        id_certificado: certId,
        id_contrato: ctId,
        titulares_resumen: titularesResumen,
        monto_inversion: ct.monto_inversion || evt.capital_base || capitalActual,
        valor_cuota: 1.0,
        numero_cuotas: ct.monto_inversion || capitalActual,
        estado: isVigente ? 'VIGENTE' : 'EXTINTO',
        fecha_emision: ct.fecha_inicio || fechaEvt,
        id_fondo: ct.id_fondo,
        nombre_fondo: fd.nombre_fondo || ct.id_fondo || 'FONDO DE INVERSIÓN',
        moneda: ct.moneda || 'USD',
        plazo_meses: ct.plazo_meses || '12',
        fecha_cierre_fondo: fd.fecha_cierre_fondo ? fd.fecha_cierre_fondo.split('T')[0] : null,
        titular_1: i1?.nombre || 'S/N',
        titular_2: i2?.nombre || '',
        titular_3: i3?.nombre || '',
        titular_4: i4?.nombre || '',
        capital_actual: capitalActual,
        ultimo_evento: tipoEvt,
        fecha_ultimo_evento: fechaEvt
      });
    });
  }

  // 6. Incorporar contratos de crm_contratos que no tengan eventos en crm_certificados_eventos aún
  if (contracts) {
    contracts.forEach(ct => {
      if (!masterMap.has(ct.id_contrato)) {
        const fd = fundsMap.get(ct.id_fondo) || {};

        const i1 = invsMap.get(ct.id_inversionista_1);
        const i2 = ct.id_inversionista_2 ? invsMap.get(ct.id_inversionista_2) : null;
        const i3 = ct.id_inversionista_3 ? invsMap.get(ct.id_inversionista_3) : null;
        const i4 = ct.id_inversionista_4 ? invsMap.get(ct.id_inversionista_4) : null;

        const titularesResumen: Array<{ nombre: string; documento: string; participacion_pct: number }> = [];
        if (i1) titularesResumen.push({ ...i1, participacion_pct: ct.porcentaje_participacion_1 || 100 });
        if (i2) titularesResumen.push({ ...i2, participacion_pct: ct.porcentaje_participacion_2 || 0 });
        if (i3) titularesResumen.push({ ...i3, participacion_pct: ct.porcentaje_participacion_3 || 0 });
        if (i4) titularesResumen.push({ ...i4, participacion_pct: ct.porcentaje_participacion_4 || 0 });

        const cap = Number(ct.monto_inversion || 0);
        const estadoCt = (ct.estado || '').toLowerCase();
        const esCerrado = cap <= 0 || estadoCt.includes('cerrad') || estadoCt.includes('liquid') || estadoCt.includes('rescate') || estadoCt.includes('anulad');

        let isVigente = !esCerrado && cap > 0;
        if (fd.fecha_cierre_fondo) {
          const fechaCierre = new Date(fd.fecha_cierre_fondo + 'T00:00:00');
          if (new Date() > fechaCierre) {
            isVigente = false;
          }
        }

        masterMap.set(ct.id_contrato, {
          id_certificado: ct.id_contrato,
          id_contrato: ct.id_contrato,
          titulares_resumen: titularesResumen,
          monto_inversion: cap,
          valor_cuota: 1.0,
          numero_cuotas: cap,
          estado: isVigente ? 'VIGENTE' : 'EXTINTO',
          fecha_emision: ct.fecha_inicio,
          id_fondo: ct.id_fondo,
          nombre_fondo: fd.nombre_fondo || ct.id_fondo || 'FONDO DE INVERSIÓN',
          moneda: ct.moneda || 'USD',
          plazo_meses: ct.plazo_meses || '12',
          fecha_cierre_fondo: fd.fecha_cierre_fondo ? fd.fecha_cierre_fondo.split('T')[0] : null,
          titular_1: i1?.nombre || 'S/N',
          titular_2: i2?.nombre || '',
          titular_3: i3?.nombre || '',
          titular_4: i4?.nombre || '',
          capital_actual: cap,
          ultimo_evento: 'EMISION_INICIAL',
          fecha_ultimo_evento: ct.fecha_inicio
        });
      }
    });
  }

  return Array.from(masterMap.values());
};

/**
 * Registra un evento de aumento de capital en crm_certificados_eventos
 */
export const registrarAumentoCapital = async (event: CertificadoEvento): Promise<void> => {
  const { error } = await supabase
    .from('crm_certificados_eventos')
    .insert([event]);

  if (error) throw new Error(`Error al registrar aumento de capital: ${error.message}`);
};

/**
 * Obtiene el historial inmutable de eventos de un certificado específico
 */
export const getEventosDeCertificado = async (certId: string): Promise<CertificadoEvento[]> => {
  const { data, error } = await supabase
    .from('crm_certificados_eventos')
    .select('*')
    .or(`id_certificado.eq.${certId},id_contrato.eq.${certId}`)
    .order('fecha_periodo_fin', { ascending: false });

  if (error) throw new Error(`Error al obtener historial de eventos: ${error.message}`);
  return data || [];
};
