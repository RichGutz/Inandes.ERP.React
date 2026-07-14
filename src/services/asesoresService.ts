// src/services/asesoresService.ts
import { supabase } from './supabaseClient';

export interface Asesor {
  id?: string;
  created_at?: string;
  updated_at?: string;
  
  codigo?: string | null;
  tipo_documento?: string | null;
  documento_identidad: string;
  nombre_completo: string;
  email?: string | null;
  telefono?: string | null;
  fecha_nacimiento?: string | null;
  nacionalidad?: string | null;
  estado_civil?: string | null;
  profesion?: string | null;
  
  // Domicilio
  direccion?: string | null;
  distrito?: string | null;
  provincia?: string | null;
  departamento?: string | null;
  codigo_postal?: string | null;
  pais_residencia?: string | null;
  es_residente_fiscal?: boolean | null;

  // Cónyuge
  nombre_completo_conyuge?: string | null;
  tipo_documento_conyuge?: string | null;
  num_documento_conyuge?: string | null;

  // Laboral
  ocupacion?: string | null;
  centro_labores?: string | null;
  cargo_ocupado?: string | null;
  antiguedad_laboral_anios?: number | null;
  es_pep?: boolean | null;
  pep_detalle?: string | null;

  // Bancos
  banco_nombre_pen?: string | null;
  numero_cuenta_pen?: string | null;
  cci_pen?: string | null;
  banco_nombre_usd?: string | null;
  numero_cuenta_usd?: string | null;
  cci_usd?: string | null;
}

/**
 * Consulta la lista completa de asesores ordenada por fecha de creación descendente.
 */
export const getAsesores = async (): Promise<Asesor[]> => {
  const { data, error } = await supabase
    .from('crm_asesores')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error en getAsesores:', error.message);
    throw new Error(`Error cargando asesores: ${error.message}`);
  }

  return data as Asesor[];
};

/**
 * Guarda o actualiza un asesor en la base de datos.
 * Autogenera un código único si es un nuevo registro.
 */
export const upsertAsesor = async (asesor: Partial<Asesor>): Promise<Asesor> => {
  const payload = { ...asesor };
  
  if (!payload.codigo) {
    const year = new Date().getFullYear();
    const randSuffix = Math.floor(100 + Math.random() * 900); // 100-999
    payload.codigo = `AS-${year}-${randSuffix}`;
  }

  const { data, error } = await supabase
    .from('crm_asesores')
    .upsert({
      ...payload,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error('Error en upsertAsesor:', error.message);
    throw new Error(`Error al guardar el asesor: ${error.message}`);
  }

  return data as Asesor;
};

// Helpers de fecha para comisiones
const getCutDatesYear = (year: number, frequencyMonths: number): Date[] => {
  const dates: Date[] = [];
  for (let m = frequencyMonths; m <= 12; m += frequencyMonths) {
    const lastDay = new Date(year, m, 0).getDate();
    dates.push(new Date(year, m - 1, lastDay, 0, 0, 0, 0));
  }
  return dates;
};

const getClosestCutAfter = (referenceDate: Date, frequencyMonths: number): Date => {
  const y = referenceDate.getFullYear();
  const candidates = [
    ...getCutDatesYear(y - 1, frequencyMonths),
    ...getCutDatesYear(y, frequencyMonths),
    ...getCutDatesYear(y + 1, frequencyMonths)
  ];
  
  const refTime = referenceDate.getTime();
  const validCandidates = candidates.filter(d => d.getTime() >= refTime);
  if (validCandidates.length > 0) {
    return new Date(Math.min(...validCandidates.map(d => d.getTime())));
  }
  return candidates[candidates.length - 1];
};

/**
 * Motor de Comisiones v2 traducido a TypeScript.
 * Calcula y proyecta las comisiones de captación, única y mantenimiento de contratos.
 */
export const calculateComisionesProyeccion = async (
  codigoAsesor: string | null = null,
  targetYear: number = 2026
): Promise<any[]> => {
  // 1. Obtener Fondos
  const { data: fondosData, error: fondosErr } = await supabase
    .from('crm_fondos')
    .select('*');
    
  if (fondosErr) throw new Error(`Error en fondos: ${fondosErr.message}`);
  const fondosMap: Record<string, any> = {};
  if (fondosData) {
    for (const f of fondosData) {
      fondosMap[f.id_fondo] = f;
    }
  }

  // 2. Obtener Asesores
  const { data: asesoresData, error: asesoresErr } = await supabase
    .from('crm_asesores')
    .select('codigo, nombre_completo, apellido_1');
    
  if (asesoresErr) throw new Error(`Error en asesores: ${asesoresErr.message}`);
  const aseMap: Record<string, string> = {};
  if (asesoresData) {
    for (const a of asesoresData) {
      aseMap[a.codigo] = `${a.apellido_1 || ''} ${a.nombre_completo || ''}`.trim() || "Desconocido";
    }
  }

  // 3. Obtener Certificados y Contratos
  const { data: certData, error: certErr } = await supabase
    .from('crm_certificados')
    .select('id_certificado, fecha_emision, monto_inversion, crm_contratos(id_fondo, id_asesor, fecha_inicio)')
    .eq('estado', 'emitido');
    
  if (certErr) throw new Error(`Error en certificados: ${certErr.message}`);

  const dataProyeccion: any[] = [];
  const monthNamesShort = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  
  // Generar columnas de meses para el año objetivo
  const columnasMeses: Array<{ label: string; date: Date }> = [];
  for (let m = 1; m <= 12; m++) {
    const lastDay = new Date(targetYear, m, 0).getDate();
    columnasMeses.push({
      label: `${monthNamesShort[m - 1]}-${String(targetYear).slice(-2)}`,
      date: new Date(targetYear, m - 1, lastDay, 0, 0, 0, 0)
    });
  }

  if (certData) {
    for (const c of certData) {
      const contrato: any = c.crm_contratos;
      if (!contrato) continue;
      
      // Filtrar por asesor
      if (codigoAsesor && contrato.id_asesor !== codigoAsesor) continue;
      
      const fCode = contrato.id_fondo;
      const fondo = fondosMap[fCode];
      if (!fondo) continue;

      const idCertificado = c.id_certificado;
      let birthDate: Date;

      // Extraer fecha de nacimiento del ID de Certificado
      const matchDate = idCertificado.match(/(20\d{6})/);
      if (matchDate) {
        const dStr = matchDate[1];
        birthDate = new Date(
          parseInt(dStr.slice(0, 4), 10),
          parseInt(dStr.slice(4, 6), 10) - 1,
          parseInt(dStr.slice(6, 8), 10),
          0, 0, 0, 0
        );
      } else {
        const emision = c.fecha_emision;
        birthDate = emision ? new Date(emision.split('T')[0] + 'T00:00:00') : new Date();
      }

      // Extraer correlativo
      const matchCorr = idCertificado.match(/-(\d+)/);
      const correlativo = matchCorr ? parseInt(matchCorr[1], 10) : 999999;

      const capital = Number(c.monto_inversion || 0);
      const frecuencia = Number(fondo.frecuencia_cupones_meses || 1);

      // Tasas
      const tCaptacion = Number(fondo.comision_asesor_primer_ano || 2.0);
      const tMantenimiento = Number(fondo.comision_asesor_mantenimiento || 1.5);
      const tUnica = Number(fondo.comision_asesor_unica || 3.5);

      // Primer pago
      const fecha1erPago = getClosestCutAfter(birthDate, frecuencia);
      fecha1erPago.setHours(0, 0, 0, 0);

      // Esquema nuevo 2026
      const esNuevo = birthDate.getTime() >= new Date('2026-01-01T00:00:00').getTime();

      // Año de gracia posterior al primer pago
      const fechaInicioMantenimiento = new Date(fecha1erPago);
      fechaInicioMantenimiento.setFullYear(fechaInicioMantenimiento.getFullYear() + 1);
      fechaInicioMantenimiento.setHours(0, 0, 0, 0);

      const row: Record<string, any> = {
        _fondo: fCode,
        _correlativo: correlativo,
        
        Asesor: aseMap[contrato.id_asesor] || "Desconocido",
        Fondo: fCode,
        ID_Certificado: idCertificado,
        Captacion: !esNuevo ? `${tCaptacion}%` : "-",
        Mantenimiento: !esNuevo ? `${tMantenimiento}%` : "-",
        Unica: esNuevo ? `${tUnica}%` : "-",
        Capital: capital,
      };

      // Rellenar proyección por meses
      for (const mObj of columnasMeses) {
        let pago = 0.0;
        const mTime = mObj.date.getTime();
        const isCutDate = (mObj.date.getMonth() + 1) % frecuencia === 0;

        if (isCutDate) {
          // 1. Pago de Captación / Comisión Única
          if (mTime === fecha1erPago.getTime()) {
            pago = esNuevo ? capital * (tUnica / 100) : capital * (tCaptacion / 100);
          }
          // 2. Pago de Mantenimiento (Antiguos post periodo de gracia)
          else if (mTime > fecha1erPago.getTime() && !esNuevo) {
            if (mTime > fechaInicioMantenimiento.getTime()) {
              const divisor = 12 / frecuencia;
              pago = capital * ((tMantenimiento / 100) / divisor);
            }
          }
        }

        row[mObj.label] = pago > 0 ? Math.round(pago * 100) / 100 : "-";
      }

      dataProyeccion.push(row);
    }
  }

  // Ordenar por Fondo y Correlativo
  dataProyeccion.sort((a, b) => {
    if (a._fondo !== b._fondo) return a._fondo.localeCompare(b._fondo);
    return a._correlativo - b._correlativo;
  });

  // Limpiar llaves auxiliares
  return dataProyeccion.map(r => {
    const { _fondo, _correlativo, ...cleanRow } = r;
    return cleanRow;
  });
};
