import { supabase } from '../services/supabaseClient';

export interface CalculationResult {
  asientos: any[];
  xlsDict: Record<string, any[]>;
  pdfData: any[];
}

const BASE_DIAS = 365.0;
const PRIORITY_FONDOS = ["NSGPEN01", "NSGPEN02", "NSGPEN03", "NSGUSD01", "NSGUSD02", "NSLCON01"];

const getMonthName = (monthIdx: number): string => {
  const names = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];
  return names[monthIdx - 1] || "N/A";
};

const formatDate = (d: Date): string => {
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = String(d.getFullYear()).slice(-2);
  return `${day}/${month}/${year}`;
};

const formatDateMD = (d: Date): string => {
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}`;
};

const extractCorrelativo = (s: string): number => {
  const match = s.match(/-(\d+)/);
  return match ? parseInt(match[1], 10) : 999999;
};

const getInvName = (c: any, invMap: Record<string, string>): string => {
  const names: string[] = [];
  for (let i = 1; i <= 3; i++) {
    const idVal = c[`id_inversionista_${i}`];
    if (idVal) {
      const name = invMap[String(idVal).toLowerCase()];
      if (name) names.push(name);
    }
  }
  return names.join(" / ") || "N/A";
};

/**
 * Traduce el motor de retornos v40 a TypeScript.
 * Realiza las consultas SSL directas a Supabase y calcula el ledger del periodo
 * adaptando de forma autónoma la frecuencia de cada fondo (Bimestral 2m vs Trimestral 3m).
 */
export const generateRetornosV40 = async (
  codigoFondo: string | null = null,
  fechaInicio: string | null = null,
  fechaCorte: string | null = null
): Promise<CalculationResult> => {
  const hoy = new Date();
  
  // Normalizar fechas de corte
  const fechaFin = fechaCorte ? new Date(fechaCorte + 'T00:00:00') : new Date(hoy.setHours(0,0,0,0));
  const fEndStr = fechaFin.toISOString().split('T')[0];
  const monthFin = fechaFin.getMonth() + 1; // 1-indexed (1-12)
  const yearFin = fechaFin.getFullYear();

  // 1. Cargar inversionistas para mapeo de nombres completos
  const { data: invData, error: invErr } = await supabase
    .from('crm_inversionistas')
    .select('*');
    
  if (invErr) throw new Error(`Error en crm_inversionistas: ${invErr.message}`);

  const invMap: Record<string, string> = {};
  if (invData) {
    for (const i of invData) {
      const fullName = i.nombre_completo || `${i.nombre_1 || ''} ${i.apellido_1 || ''}`.trim();
      for (const key of ['id', 'uuid', 'documento_identidad', 'codigo_inversionista']) {
        const val = i[key];
        if (val) invMap[String(val).toLowerCase()] = fullName;
      }
    }
  }

  // 2. Cargar fondos vigentes
  const { data: fondosData, error: fondosErr } = await supabase
    .from('crm_fondos')
    .select('*');

  if (fondosErr) throw new Error(`Error en crm_fondos: ${fondosErr.message}`);

  const fondosPlazoMap: Record<string, any> = {};
  const fondosMap: Record<string, any> = {};

  if (fondosData) {
    for (const f of fondosData) {
      if (f.id_fondo_plazo) fondosPlazoMap[f.id_fondo_plazo] = f;
      fondosPlazoMap[`${f.id_fondo}-${f.plazo_inversion}`] = f;
      if (!fondosMap[f.id_fondo]) fondosMap[f.id_fondo] = f;
    }
  }

  // 3. Cargar contratos maestros (vigentes o cerrados en el periodo actual/futuros)
  let queryContratos = supabase
    .from('crm_contratos')
    .select('*')
    .in('estado', ['emitido', 'cerrado_por_rescate', 'cerrado_fin_contrato']);
  if (codigoFondo && codigoFondo !== 'TODOS') {
    queryContratos = queryContratos.eq('id_fondo', codigoFondo);
  }
  const { data: rawContratosMaster, error: contratosErr } = await queryContratos;
  if (contratosErr) throw new Error(`Error en crm_contratos: ${contratosErr.message}`);

  if (!rawContratosMaster || rawContratosMaster.length === 0) {
    return { asientos: [], xlsDict: {}, pdfData: [] };
  }

  const allCids = rawContratosMaster.map(c => c.id_contrato);

  // 4. Historial Ledger (Eventos previos)
  const eventsByContrato: Record<string, any[]> = {};
  const chunkSize = 100;
  for (let i = 0; i < allCids.length; i += chunkSize) {
    const chunk = allCids.slice(i, i + chunkSize);
    const { data: events, error: eventsErr } = await supabase
      .from('crm_certificados_eventos')
      .select('*')
      .in('id_contrato', chunk)
      .order('fecha_periodo_fin', { ascending: true });

    if (eventsErr) throw new Error(`Error en crm_certificados_eventos: ${eventsErr.message}`);

    if (events) {
      for (const e of events) {
        const cid = e.id_contrato || e.id_certificado;
        if (!eventsByContrato[cid]) eventsByContrato[cid] = [];
        eventsByContrato[cid].push(e);
      }
    }
  }

  // 5. Carga de Cronogramas de deducciones y rescates
  const allCronItems: any[] = [];
  for (let i = 0; i < allCids.length; i += chunkSize) {
    const chunk = allCids.slice(i, i + chunkSize);
    const { data: items, error: itemsErr } = await supabase
      .from('crm_cronograma_deducciones_rescates')
      .select('*')
      .in('id_contrato', chunk);

    if (itemsErr) throw new Error(`Error en cronograma: ${itemsErr.message}`);
    if (items) allCronItems.push(...items);
  }

  // 6. Generación de Salida por Fondo con Periodo Canónico Independiente
  const asientos: any[] = [];
  const xlsDict: Record<string, any[]> = {};
  const pdfData: any[] = [];

  const uniqueFIds = Array.from(new Set(rawContratosMaster.map(r => r.id_fondo)));
  const fondosOrder = PRIORITY_FONDOS.filter(f => uniqueFIds.includes(f))
    .concat(uniqueFIds.filter(f => !PRIORITY_FONDOS.includes(f)).sort());

  for (const fIdStr of fondosOrder) {
    const fondoMeta = fondosMap[fIdStr] || {};
    const frecuencia = Number(fondoMeta.frecuencia_cupones_meses || 2);

    // Filtración por ciclo contable: si el mes de corte no coincide con la periodicidad del fondo, omitir
    if (monthFin % frecuencia !== 0) {
      continue;
    }

    // Determinar la fecha de inicio canónica exacta según la periodicidad del fondo
    let fStartFund: Date;
    if (codigoFondo && codigoFondo !== 'TODOS' && fechaInicio) {
      fStartFund = new Date(fechaInicio + 'T00:00:00');
    } else {
      const startMonth = monthFin - frecuencia + 1;
      fStartFund = new Date(yearFin, startMonth - 1, 1);
    }
    const fStartFundStr = fStartFund.toISOString().split('T')[0];

    // Lista de días completa del período específico de este fondo
    const diasPeriodoFund: Date[] = [];
    const cur = new Date(fStartFund);
    while (cur <= fechaFin) {
      diasPeriodoFund.push(new Date(cur));
      cur.setDate(cur.getDate() + 1);
    }
    const columnasFechasFund = diasPeriodoFund.map(d => formatDateMD(d));

    // Filtrar contratos de este fondo vigentes en su período
    const contratosMaster = rawContratosMaster.filter(c => {
      if (c.id_fondo !== fIdStr) return false;
      const fIniStr = c.fecha_inicio ? c.fecha_inicio.split('T')[0] : '2000-01-01';
      if (fIniStr > fEndStr) return false;

      if (c.estado === 'emitido') {
        const evs = eventsByContrato[c.id_contrato] || [];
        const cierresPrevios = evs.filter(e => 
          ['cierre_fin_contrato', 'cierre_por_rescate'].includes(e.tipo_evento) &&
          e.fecha_periodo_fin &&
          e.fecha_periodo_fin.split('T')[0] < fStartFundStr
        );
        if (cierresPrevios.length > 0) {
          const lastC = cierresPrevios[cierresPrevios.length - 1];
          const saldoC = Number(lastC.capital_final_saldo ?? lastC.capital_base ?? 0);
          if (saldoC <= 0) return false;
        }
        return true;
      }

      const fFinStr = c.fecha_fin ? c.fecha_fin.split('T')[0] : '2099-12-31';
      if (fFinStr >= fStartFundStr) return true;
      const evs = eventsByContrato[c.id_contrato] || [];
      const cierreEv = evs.find(e => e.tipo_evento === 'cierre_fin_contrato' || e.tipo_evento === 'cierre_por_rescate');
      if (!cierreEv) return true;
      const cFinStr = cierreEv.fecha_periodo_fin ? cierreEv.fecha_periodo_fin.split('T')[0] : '2000-01-01';
      return cFinStr >= fStartFundStr;
    });

    if (contratosMaster.length === 0) continue;

    const contratosMap: Record<string, any> = {};
    for (const c of contratosMaster) {
      contratosMap[c.id_contrato] = c;
    }
    const cidsActivos = contratosMaster.map(c => c.id_contrato);

    // Mapear cronograma para este fondo
    const cronDedMap: Record<string, any[]> = {};
    const cronRescMap: Record<string, Array<{ id_registro: string; fecha: Date; monto: number; tasa: number; es_rescate_total?: boolean }>> = {};
    const cronBalPrevMap: Record<string, number> = {};

    for (const item of allCronItems) {
      const cid = item.id_contrato || item.id_certificado;
      if (!contratosMap[cid]) continue;
      const fP = new Date(item.fecha_proyectada_cobro.split('T')[0] + 'T00:00:00');
      const tipo = item.tipo_cargo;

      if (fP < fStartFund) {
        if (tipo === 'RESCATE_CAPITAL') {
          if (!cronBalPrevMap[cid]) cronBalPrevMap[cid] = 0;
          cronBalPrevMap[cid] -= Number(item.monto_cobrar);
        }
      } else if (fP <= fechaFin) {
        if (tipo === 'RESCATE_CAPITAL') {
          if (!cronRescMap[cid]) cronRescMap[cid] = [];
          cronRescMap[cid].push({
            id_registro: item.id_cuota,
            fecha: fP,
            monto: Number(item.monto_cobrar),
            tasa: Number(item.tasa || 0) / 100,
            es_rescate_total: Boolean(item.es_rescate_total || (item.glosa_descripcion && item.glosa_descripcion.includes('[RESCATE TOTAL]')))
          });
        } else {
          if (!cronDedMap[cid]) cronDedMap[cid] = [];
          cronDedMap[cid].push(item);
        }
      }
    }

    // Preparar filas del fondo con arrastre del cierre anterior
    const certRowsData: any[] = [];
    for (const mid of cidsActivos) {
      const c = contratosMap[mid];
      if (!c) continue;

      const events = eventsByContrato[mid] || [];
      events.sort((a, b) => String(a.fecha_periodo_fin || '2000-01-01').localeCompare(String(b.fecha_periodo_fin || '2000-01-01')));

      const closingEvents = events.filter(e => 
        ['cierre_fin_ciclo', 'cierre_fin_contrato', 'emision_inicial', 'emision'].includes(e.tipo_evento) &&
        e.fecha_periodo_fin &&
        new Date(e.fecha_periodo_fin.split('T')[0] + 'T00:00:00') < fStartFund
      );

      let lastClosureDate: Date | null = null;
      let capBaseInicio = 0;
      let idCertOrigen = mid;

      if (closingEvents.length > 0) {
        closingEvents.sort((a, b) => String(a.fecha_periodo_fin).localeCompare(String(b.fecha_periodo_fin)));
        const lastClosure = closingEvents[closingEvents.length - 1];
        capBaseInicio = (lastClosure.capital_final_saldo !== null && lastClosure.capital_final_saldo !== undefined)
          ? Number(lastClosure.capital_final_saldo)
          : Number(lastClosure.capital_base || 0);
        lastClosureDate = new Date(lastClosure.fecha_periodo_fin.split('T')[0] + 'T00:00:00');
        idCertOrigen = lastClosure.id_certificado || mid;
      } else {
        capBaseInicio = Number(c.monto_inversion || 0) + (cronBalPrevMap[mid] || 0.0);
        idCertOrigen = mid;
      }

      const hijos: any[] = [];
      for (const e of events) {
        if (['aumento_capital', 'reinvierte_interes'].includes(e.tipo_evento)) {
          const rawF = e.fecha_evento || e.fecha_periodo_fin || '2020-01-01';
          const fEv = new Date(rawF.split('T')[0] + 'T00:00:00');

          if (lastClosureDate && fEv <= lastClosureDate) continue;
          if (fEv <= fechaFin) {
            let monto = Number(e.capital_final_saldo || 0) - Number(e.capital_base || 0);
            if (monto <= 0 && e.notas) {
              const match = String(e.notas).match(/Aumento\s+de\s+capital\s+por\s+([0-9.,]+)/i);
              if (match) monto = parseFloat(match[1].replace(/,/g, '')) || 0;
            }
            if (monto > 0) {
              hijos.push({
                id: `Aumento (${formatDate(fEv)})`,
                fecha: fEv,
                monto,
                interes_acum: 0.0,
                v_dias: []
              });
            }
          }
        }
      }

      if (capBaseInicio <= 0 && hijos.length === 0) continue;

      const tasaRaw = c.tasa_pactada;
      const tasaP = (tasaRaw && Number(tasaRaw) > 0) ? (Number(tasaRaw) / 100) : 0.0;
      const repartoPct = Number(c.porcentaje_reparto || 0) / 100;

      certRowsData.push({
        id: mid,
        id_certificado_origen: idCertOrigen,
        id_contrato: mid,
        id_fondo: c.id_fondo,
        moneda: c.moneda,
        inversionista: getInvName(c, invMap),
        capital_base: capBaseInicio,
        emision: new Date(c.fecha_inicio.split('T')[0] + 'T00:00:00'),
        tasa_pactada: tasaP,
        porcentaje_reparto: repartoPct,
        hijos,
        interes_total_acum: 0.0,
        cron_deducciones: cronDedMap[mid] || [],
        cron_rescates: cronRescMap[mid] || [],
        valores_dia_padre: []
      });
    }

    certRowsData.sort((a, b) => {
      if (a.id_fondo !== b.id_fondo) return a.id_fondo.localeCompare(b.id_fondo);
      return extractCorrelativo(a.id) - extractCorrelativo(b.id);
    });

    // Bucle diario para este fondo
    for (const d of diasPeriodoFund) {
      d.setHours(0, 0, 0, 0);
      const dTime = d.getTime();

      for (const row of certRowsData) {
        const rescates = (row.cron_rescates || []).slice().sort((x: any, y: any) => x.fecha.getTime() - y.fecha.getTime());
        const r_a = rescates.find((r: any) => dTime <= r.fecha.getTime());

        let cap_rem = row.capital_base;
        for (const r of rescates) {
          if (dTime > r.fecha.getTime()) cap_rem -= r.monto;
        }

        const t_hoy = row.tasa_pactada;
        const base_hoy = r_a ? row.capital_base : Math.max(0.0, cap_rem);

        const isEmittedOrAfter = dTime >= row.emision.getTime();
        const int_dia_p = isEmittedOrAfter ? (base_hoy * (t_hoy / BASE_DIAS)) : 0.0;

        row.valores_dia_padre.push(int_dia_p);
        row.interes_total_acum += int_dia_p;

        for (const h of row.hijos) {
          const isAumOrAfter = dTime >= h.fecha.getTime();
          const int_dia_h = isAumOrAfter ? (h.monto * (t_hoy / BASE_DIAS)) : 0.0;
          h.interes_acum += int_dia_h;
          h.v_dias.push(int_dia_h);
          row.interes_total_acum += int_dia_h;
        }
      }
    }

    const rowsPdf: any[] = [];
    const rowsXls: any[] = [];
    let globalCounter = 1;

    const fTotals = {
      capital: 0,
      bruto_total: 0,
      impuesto_total: 0,
      base_neta: 0,
      capitalizacion: 0,
      reparto_valor: 0,
      deducciones_total: 0,
      neto_total: 0,
      devolucion_capital: 0,
      penalidad_rescate: 0,
      aumentos: 0,
      capital_final: 0
    };

    for (const r of certRowsData) {
      const bruto_hijos = r.hijos.reduce((sum: number, h: any) => sum + (Math.round(h.interes_acum * 100) / 100), 0);
      const bruto = Math.round(r.interes_total_acum * 100) / 100;
      const bruto_padre = Math.round((bruto - bruto_hijos) * 100) / 100;
      
      const imp = Math.round(bruto * 0.05 * 100) / 100;
      const neta = Math.round((bruto - imp) * 100) / 100;
      
      const tieneRescateTotal = r.cron_rescates.some((x: any) => x.es_rescate_total || (x.monto > 0 && x.monto >= r.capital_base));

      let cap_z = Math.round(neta * (1 - r.porcentaje_reparto) * 100) / 100;
      let rep_v = Math.round(neta * r.porcentaje_reparto * 100) / 100;

      const aum_v = r.hijos.reduce((sum: number, h: any) => sum + h.monto, 0);

      let rescate_sum = 0;
      if (tieneRescateTotal) {
        cap_z = 0.0;
        rep_v = neta;
        rescate_sum = Math.round((r.capital_base + aum_v) * 100) / 100;
      } else {
        rescate_sum = r.cron_rescates.reduce((sum: number, x: any) => sum + x.monto, 0);
      }

      const ded_ord = r.cron_deducciones
        .filter((x: any) => x.tipo_cargo === 'DEDUCCION_ORDINARIA')
        .reduce((sum: number, x: any) => sum + Number(x.monto_cobrar), 0);

      const penalidad_sum = r.cron_deducciones
        .filter((x: any) => x.tipo_cargo === 'PENALIDAD_RESCATE')
        .reduce((sum: number, x: any) => sum + Number(x.monto_cobrar), 0);

      let cap_final = Math.round((r.capital_base + aum_v + cap_z - rescate_sum - penalidad_sum) * 100) / 100;
      if (tieneRescateTotal || cap_final < 0) {
        cap_final = 0.0;
      }
      const tipo_ev = (cap_final <= 0 || tieneRescateTotal) ? "cierre_fin_contrato" : "cierre_fin_ciclo";

      // Crear payload de auditoría
      const payloadEnriquecido = {
        audit_version: "v40 (Ciclo Auditado React)",
        inversionista: r.inversionista,
        moneda: r.moneda,
        capital_base: r.capital_base,
        tasa_pactada: r.tasa_pactada,
        interes_bruto: bruto,
        impuesto_5_pct: imp,
        interes_neto: neta,
        capitalizacion: cap_z,
        reparto_valor: rep_v,
        deducciones_ordinarias: ded_ord,
        rescates_capital: rescate_sum,
        penalidades: penalidad_sum,
        aumentos_capital: aum_v,
        capital_final: cap_final,
        detalle_aumentos: r.hijos.map((h: any) => ({ fecha: h.fecha.toISOString().split('T')[0], monto: h.monto })),
        detalle_rescates: r.cron_rescates.map((rc: any) => ({ id_registro: rc.id_registro, fecha: rc.fecha.toISOString().split('T')[0], monto: rc.monto, tasa_castigo: rc.tasa })),
        detalle_deducciones: r.cron_deducciones.map((d: any) => ({ id_registro: d.id_cuota, fecha: d.fecha_proyectada_cobro, monto: d.monto_cobrar, tipo: d.tipo_cargo }))
      };

      const strFin = fechaFin.toISOString().split('T')[0].replace(/-/g, '');
      const nuevoIdCertificado = `${r.id_contrato}.${strFin}`;

      asientos.push({
        id_certificado: nuevoIdCertificado,
        id_certificado_origen: r.id_certificado_origen || r.id_contrato,
        id_contrato: r.id_contrato,
        tipo_evento: tipo_ev,
        fecha_periodo_origen: fStartFundStr,
        fecha_periodo_fin: fEndStr,
        capital_base: r.capital_base,
        tasa_aplicada: r.tasa_pactada,
        interes_generado_bruto: bruto,
        impuestos_renta: imp,
        interes_neto_disponible: neta,
        monto_capitalizacion: cap_z,
        monto_reparto: rep_v,
        monto_deduccion: ded_ord,
        monto_rescate: rescate_sum,
        penalidad_rescate: penalidad_sum,
        capital_final_saldo: cap_final,
        dias_calculados: r.valores_dia_padre.length,
        payload_asiento: payloadEnriquecido
      });

      // Crear fila Excel estructurada
      const rx: Record<string, any> = {
        "#": globalCounter,
        "Certificado": r.id,
        "Payload_JSON_Audit": JSON.stringify(payloadEnriquecido),
        "Inversionista": r.inversionista,
        "Moneda": r.moneda,
        "Capital Base": r.capital_base
      };

      // Columnas de intereses diarios
      for (let k = 0; k < r.valores_dia_padre.length; k++) {
        rx[columnasFechasFund[k]] = Math.round(r.valores_dia_padre[k] * 1000000) / 1000000;
      }

      const rNetoFinal = Math.round((rep_v - ded_ord) * 100) / 100;
      const rRescatesNetos = Math.round((rescate_sum - penalidad_sum) * 100) / 100;
      const rTransferencia = Math.round((rNetoFinal + rRescatesNetos) * 100) / 100;

      rx["INT. BRUTO"] = bruto_padre;
      rx["IR (5%)"] = imp;
      rx["BASE NETA"] = neta;
      rx["CAPITALIZACION"] = cap_z;
      rx["REPARTO"] = rep_v;
      rx["DEDUCCIONES"] = ded_ord;
      rx["PENALIDAD"] = penalidad_sum;
      rx["NETO FINAL"] = rNetoFinal;
      rx["RESCATES"] = rescate_sum;
      rx["TRANSFERENCIAS"] = rTransferencia;
      rx["AUM. CAPITAL"] = aum_v;
      rx["CAPITAL FINAL"] = cap_final;

      rowsXls.push(rx);

      // Filas secundarias para incrementos de capital
      for (const h of r.hijos) {
        const hx: Record<string, any> = {
          "#": "-",
          "Certificado": h.id,
          "Payload_JSON_Audit": "",
          "Inversionista": "└─ Incremento de Capital",
          "Moneda": r.moneda,
          "Capital Base": "-"
        };
        for (let k = 0; k < h.v_dias.length; k++) {
          hx[columnasFechasFund[k]] = Math.round(h.v_dias[k] * 1000000) / 1000000;
        }
        hx["INT. BRUTO"] = Math.round(h.interes_acum * 100) / 100;
        const zeroCols = ["IR (5%)", "BASE NETA", "CAPITALIZACION", "REPARTO", "DEDUCCIONES", "PENALIDAD", "NETO FINAL", "RESCATES", "TRANSFERENCIAS", "AUM. CAPITAL", "CAPITAL FINAL"];
        for (const col of zeroCols) {
          hx[col] = "-";
        }
        rowsXls.push(hx);
      }

      // Fila de datos para PDF
      rowsPdf.push({
        tipo: "CERT",
        n_orden: globalCounter,
        id: r.id,
        inversionista: r.inversionista,
        capital: r.capital_base,
        aumentos: aum_v,
        tasa_cert: `${(r.tasa_pactada * 100).toFixed(2)}%`,
        valores: r.valores_dia_padre,
        bruto_total: bruto_padre,
        impuesto_total: imp,
        base_neta: neta,
        capitalizacion: cap_z,
        reparto_valor: rep_v,
        deducciones_total: ded_ord,
        neto_total: Math.round((rep_v - ded_ord) * 100) / 100,
        devolucion_capital: rescate_sum,
        penalidad_rescate: penalidad_sum,
        capital_final: cap_final
      });

      for (const h of r.hijos) {
        const nDiasH = h.v_dias.length;
        const intDiarioH = nDiasH > 0 ? Math.round((h.interes_acum / nDiasH) * 10000) / 10000 : 0.0;
        rowsPdf.push({
          tipo: "AUMENTO",
          id: h.id,
          capital: h.monto,
          tasa_cert: `${(r.tasa_pactada * 100).toFixed(2)}%`,
          valores: h.v_dias,
          bruto_total: Math.round(h.interes_acum * 100) / 100,
          n_dias: nDiasH,
          int_diario: intDiarioH,
          fecha_inicio: formatDateMD(h.fecha),
          fecha_fin: formatDateMD(fechaFin)
        });
      }

      // Actualizar acumuladores totales
      fTotals.capital += r.capital_base;
      fTotals.bruto_total += bruto;
      fTotals.impuesto_total += imp;
      fTotals.base_neta += neta;
      fTotals.capitalizacion += cap_z;
      fTotals.reparto_valor += rep_v;
      fTotals.deducciones_total += ded_ord;
      fTotals.neto_total += Math.round((rep_v - ded_ord) * 100) / 100;
      fTotals.devolucion_capital += rescate_sum;
      fTotals.penalidad_rescate += penalidad_sum;
      fTotals.aumentos += aum_v;
      fTotals.capital_final += cap_final;

      globalCounter++;
    }

    // Fila final de totales por fondo para el Excel
    const totRescatesNetos = Math.round(((fTotals.devolucion_capital || 0) - (fTotals.penalidad_rescate || 0)) * 100) / 100;
    const totTransferencia = Math.round(((fTotals.neto_total || 0) + totRescatesNetos) * 100) / 100;

    rowsXls.push({
      "#": "",
      "Certificado": "TOTALES",
      "Payload_JSON_Audit": "",
      "Inversionista": "--- SUMATORIA ---",
      "Moneda": "",
      "Capital Base": fTotals.capital,
      "INT. BRUTO": fTotals.bruto_total,
      "IR (5%)": fTotals.impuesto_total,
      "BASE NETA": fTotals.base_neta,
      "CAPITALIZACION": fTotals.capitalizacion,
      "REPARTO": fTotals.reparto_valor,
      "DEDUCCIONES": fTotals.deducciones_total,
      "PENALIDAD": fTotals.penalidad_rescate,
      "NETO FINAL": fTotals.neto_total,
      "RESCATES": fTotals.devolucion_capital,
      "TRANSFERENCIAS": totTransferencia,
      "AUM. CAPITAL": fTotals.aumentos,
      "CAPITAL FINAL": fTotals.capital_final
    });

    xlsDict[fIdStr] = rowsXls;

    pdfData.push({
      fondo: fondoMeta,
      totals: fTotals,
      fStart: fStartFundStr,
      fEnd: fEndStr,
      diasBase: diasPeriodoFund.length,
      vars: { pasiva: "v40", tasa_display: `${(fondoMeta.tasa || 0).toFixed(2)}%` },
      blocks: [{
        idx: 1,
        month_name: `${getMonthName(fechaFin.getMonth() + 1)} ${fechaFin.getFullYear()}`,
        days: columnasFechasFund,
        is_last: true,
        rows: rowsPdf
      }]
    });
  }

  return { asientos, xlsDict, pdfData };
};

