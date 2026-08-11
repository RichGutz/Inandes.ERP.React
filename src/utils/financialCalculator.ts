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
 * Realiza las consultas SSL directas a Supabase y calcula el ledger del periodo.
 */
export const generateRetornosV40 = async (
  codigoFondo: string | null = null,
  fechaInicio: string | null = null,
  fechaCorte: string | null = null
): Promise<CalculationResult> => {
  const hoy = new Date();
  
  // Normalizar fechas de entrada
  const fechaFin = fechaCorte ? new Date(fechaCorte + 'T00:00:00') : new Date(hoy.setHours(0,0,0,0));
  const fStart = fechaInicio ? new Date(fechaInicio + 'T00:00:00') : new Date(fechaFin.getFullYear(), 0, 1);

  // Crear la lista de días completos en el periodo
  const diasPeriodo: Date[] = [];
  const current = new Date(fStart);
  while (current <= fechaFin) {
    diasPeriodo.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  const columnasFechas = diasPeriodo.map(d => formatDateMD(d));

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

  const fondosRaw: Record<string, any[]> = {};
  if (fondosData) {
    for (const f of fondosData) {
      if (!fondosRaw[f.id_fondo]) fondosRaw[f.id_fondo] = [];
      fondosRaw[f.id_fondo].push(f);
    }
  }

  const fondosMap: Record<string, any> = {};
  for (const fId of Object.keys(fondosRaw)) {
    const data = fondosRaw[fId];
    data.sort((a, b) => String(b.periodo_vigente || '2000').localeCompare(String(a.periodo_vigente || '2000')));
    fondosMap[fId] = data[0];
  }

  // 3. Cargar contratos maestros (filtrando solo por estado 'emitido')
  let queryContratos = supabase.from('crm_contratos').select('*').eq('estado', 'emitido');
  if (codigoFondo && codigoFondo !== 'TODOS') {
    queryContratos = queryContratos.eq('id_fondo', codigoFondo);
  }
  const { data: contratosMaster, error: contratosErr } = await queryContratos;
  if (contratosErr) throw new Error(`Error en crm_contratos: ${contratosErr.message}`);

  if (!contratosMaster || contratosMaster.length === 0) {
    return { asientos: [], xlsDict: {}, pdfData: [] };
  }

  const contratosMap: Record<string, any> = {};
  for (const c of contratosMaster) {
    contratosMap[c.id_contrato] = c;
  }
  const cidsActivos = contratosMaster.map(c => c.id_contrato);

  // 4. Historial Ledger (Eventos previos)
  const tempHistorialMap: Record<string, any[]> = {};

  const chunkSize = 100;
  for (let i = 0; i < cidsActivos.length; i += chunkSize) {
    const chunk = cidsActivos.slice(i, i + chunkSize);
    const { data: events, error: eventsErr } = await supabase
      .from('crm_certificados_eventos')
      .select('*')
      .in('id_contrato', chunk)
      .order('fecha_periodo_fin', { ascending: true });

    if (eventsErr) throw new Error(`Error en crm_certificados_eventos: ${eventsErr.message}`);

    if (events) {
      for (const e of events) {
        const cid = e.id_contrato || e.id_certificado;
        if (!tempHistorialMap[cid]) tempHistorialMap[cid] = [];
        tempHistorialMap[cid].push(e);
      }
    }
  }

  // Filtrar para desduplicar: solo conservar versiones de certificado válidas al inicio del periodo
  const historialMap: Record<string, any[]> = {};
  const aumMap: Record<string, Array<{ fecha: Date; monto: number }>> = {};
  const balPrevMap: Record<string, number> = {};

  for (const [cid, events] of Object.entries(tempHistorialMap)) {
    events.sort((a, b) => String(a.fecha_periodo_fin || '2000-01-01').localeCompare(String(b.fecha_periodo_fin || '2000-01-01')));
    const firstEv = events[0];
    const rawFin = firstEv.fecha_periodo_fin || '2000-01-01';
    const fFin = new Date(rawFin.split('T')[0] + 'T00:00:00');
    const isEmision = firstEv.tipo_evento === 'emision_inicial';

    // Si el certificado inició antes del periodo o es la emisión inicial del contrato en este periodo, se procesa
    if (fFin < fStart || isEmision) {
      historialMap[cid] = events;
      for (const e of events) {
        const rawF = e.fecha_evento || e.fecha_periodo_fin || '2020-01-01';
        const fEv = new Date(rawF.split('T')[0] + 'T00:00:00');

        if (['aumento_capital', 'reinvierte_interes'].includes(e.tipo_evento)) {
          const monto = Number(e.capital_final_saldo || 0) - Number(e.capital_base || 0);
          if (monto > 0) {
            if (!aumMap[cid]) aumMap[cid] = [];
            aumMap[cid].push({ fecha: fEv, monto });
          }
        } else if (fEv < fStart && ['rescate_capital', 'rescate'].includes(e.tipo_evento)) {
          const monto = Number(e.capital_base || 0) - Number(e.capital_final_saldo || 0);
          if (!balPrevMap[cid]) balPrevMap[cid] = 0;
          balPrevMap[cid] -= Math.abs(monto);
        }
      }
    }
  }

  // 5. Carga de Cronogramas de deducciones y rescates
  const todoCids = Object.keys(historialMap);
  const cronDedMap: Record<string, any[]> = {};
  const cronRescMap: Record<string, Array<{ id_registro: string; fecha: Date; monto: number; tasa: number }>> = {};

  for (let i = 0; i < todoCids.length; i += chunkSize) {
    const chunk = todoCids.slice(i, i + chunkSize);
    const { data: items, error: itemsErr } = await supabase
      .from('crm_cronograma_deducciones_rescates')
      .select('*')
      .in('id_contrato', chunk);

    if (itemsErr) throw new Error(`Error en cronograma: ${itemsErr.message}`);

    if (items) {
      for (const item of items) {
        const cid = item.id_contrato || item.id_certificado;
        const fP = new Date(item.fecha_proyectada_cobro.split('T')[0] + 'T00:00:00');
        const tipo = item.tipo_cargo;

        if (fP < fStart) {
          if (tipo === 'RESCATE_CAPITAL') {
            if (!balPrevMap[cid]) balPrevMap[cid] = 0;
            balPrevMap[cid] -= Number(item.monto_cobrar);
          }
        } else if (fP <= fechaFin) {
          if (tipo === 'RESCATE_CAPITAL') {
            if (!cronRescMap[cid]) cronRescMap[cid] = [];
            cronRescMap[cid].push({
              id_registro: item.id_cuota,
              fecha: fP,
              monto: Number(item.monto_cobrar),
              tasa: Number(item.tasa || 0) / 100
            });
          } else {
            if (!cronDedMap[cid]) cronDedMap[cid] = [];
            cronDedMap[cid].push(item);
          }
        }
      }
    }
  }

  // 6. Preparación de Filas de Cálculo
  const certRowsData: any[] = [];
  for (const certId of Object.keys(historialMap)) {
    const events = historialMap[certId];
    const mid = events.length > 0 ? (events[events.length - 1].id_contrato || certId) : certId;
    const c = contratosMap[mid];
    if (!c) continue;

    const tasaRaw = c.tasa_pactada;
    let tasaP = (tasaRaw && Number(tasaRaw) > 0) ? (Number(tasaRaw) / 100) : 0.0;
    if (tasaP === 0) {
      tasaP = Number(fondosMap[c.id_fondo]?.tasa || 0) / 100;
    }
    const repartoPct = Number(c.porcentaje_reparto || 0) / 100;

    const hijos: any[] = [];
    const aums = aumMap[certId] || [];
    for (const a of aums) {
      hijos.push({
        id: `Aumento (${formatDate(a.fecha)})`,
        fecha: a.fecha,
        monto: a.monto,
        interes_acum: 0.0,
        v_dias: []
      });
    }

    certRowsData.push({
      id: certId,
      id_contrato: mid,
      id_fondo: c.id_fondo,
      moneda: c.moneda,
      inversionista: getInvName(c, invMap),
      capital_base: Number(c.monto_inversion || 0) + (balPrevMap[certId] || 0.0),
      emision: new Date(c.fecha_inicio.split('T')[0] + 'T00:00:00'),
      tasa_pactada: tasaP,
      porcentaje_reparto: repartoPct,
      hijos,
      interes_total_acum: 0.0,
      cron_deducciones: cronDedMap[certId] || [],
      cron_rescates: cronRescMap[certId] || [],
      valores_dia_padre: []
    });
  }

  certRowsData.sort((a, b) => {
    if (a.id_fondo !== b.id_fondo) return a.id_fondo.localeCompare(b.id_fondo);
    return extractCorrelativo(a.id) - extractCorrelativo(b.id);
  });

  // 7. Bucle Diario
  for (const d of diasPeriodo) {
    d.setHours(0, 0, 0, 0);
    const dTime = d.getTime();

    for (const row of certRowsData) {
      const rescates = (row.cron_rescates || []).slice().sort((x: any, y: any) => x.fecha.getTime() - y.fecha.getTime());
      const r_a = rescates.find((r: any) => dTime <= r.fecha.getTime());

      let cap_rem = row.capital_base;
      for (const r of rescates) {
        if (dTime > r.fecha.getTime()) {
          cap_rem -= r.monto;
        }
      }

      const t_hoy = r_a ? r_a.tasa : row.tasa_pactada;
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

  // 8. Generación de Salida
  const asientos: any[] = [];
  const xlsDict: Record<string, any[]> = {};
  const pdfData: any[] = [];

  const uniqueFIds = Array.from(new Set(certRowsData.map(r => r.id_fondo)));
  const fondosOrder = PRIORITY_FONDOS.filter(f => uniqueFIds.includes(f))
    .concat(uniqueFIds.filter(f => !PRIORITY_FONDOS.includes(f)).sort());

  const monthFin = fechaFin.getMonth() + 1; // 1-indexed (1-12)

  for (const fIdStr of fondosOrder) {
    const rowsF = certRowsData.filter(r => r.id_fondo === fIdStr);
    if (rowsF.length === 0) continue;

    const fondoMeta = fondosMap[fIdStr] || {};
    const frecuencia = Number(fondoMeta.frecuencia_cupones_meses || 1);

    // Filtración por ciclo contable
    if (monthFin % frecuencia !== 0) {
      continue;
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

    for (const r of rowsF) {
      const bruto = Math.round(r.interes_total_acum * 100) / 100;
      const imp = Math.round(bruto * 0.05 * 100) / 100;
      const neta = Math.round((bruto - imp) * 100) / 100;
      const cap_z = Math.round(neta * (1 - r.porcentaje_reparto) * 100) / 100;
      const rep_v = Math.round(neta * r.porcentaje_reparto * 100) / 100;

      const ded_ord = r.cron_deducciones
        .filter((x: any) => x.tipo_cargo === 'DEDUCCION_ORDINARIA')
        .reduce((sum: number, x: any) => sum + Number(x.monto_cobrar), 0);

      const rescate_sum = r.cron_rescates.reduce((sum: number, x: any) => sum + x.monto, 0);

      const penalidad_sum = r.cron_deducciones
        .filter((x: any) => x.tipo_cargo === 'PENALIDAD_RESCATE')
        .reduce((sum: number, x: any) => sum + Number(x.monto_cobrar), 0);

      const aum_v = r.hijos.reduce((sum: number, h: any) => sum + h.monto, 0);
      const cap_final = Math.round((r.capital_base + aum_v + cap_z - rescate_sum - penalidad_sum) * 100) / 100;
      const tipo_ev = cap_final <= 0 ? "cierre_fin_contrato" : "cierre_fin_ciclo";

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
        id_certificado_origen: r.id,
        id_contrato: r.id_contrato,
        tipo_evento: tipo_ev,
        fecha_periodo_origen: fStart.toISOString().split('T')[0],
        fecha_periodo_fin: fechaFin.toISOString().split('T')[0],
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
        rx[columnasFechas[k]] = Math.round(r.valores_dia_padre[k] * 1000000) / 1000000;
      }

      rx["INT. BRUTO"] = bruto;
      rx["IR (5%)"] = imp;
      rx["BASE NETA"] = neta;
      rx["CAPITALIZACION"] = cap_z;
      rx["REPARTO"] = rep_v;
      rx["DEDUCCIONES"] = ded_ord;
      rx["NETO FINAL"] = Math.round((rep_v - ded_ord) * 100) / 100;
      rx["RESCATES"] = rescate_sum;
      rx["PENALIDAD"] = penalidad_sum;
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
          "Capital Base": h.monto
        };
        for (let k = 0; k < h.v_dias.length; k++) {
          hx[columnasFechas[k]] = Math.round(h.v_dias[k] * 1000000) / 1000000;
        }
        hx["INT. BRUTO"] = Math.round(h.interes_acum * 100) / 100;
        const zeroCols = ["IR (5%)", "BASE NETA", "CAPITALIZACION", "REPARTO", "DEDUCCIONES", "NETO FINAL", "RESCATES", "PENALIDAD", "AUM. CAPITAL", "CAPITAL FINAL"];
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
        bruto_total: bruto,
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
      "NETO FINAL": fTotals.neto_total,
      "RESCATES": fTotals.devolucion_capital,
      "PENALIDAD": fTotals.penalidad_rescate,
      "AUM. CAPITAL": fTotals.aumentos,
      "CAPITAL FINAL": fTotals.capital_final
    });

    xlsDict[fIdStr] = rowsXls;

    pdfData.push({
      fondo: fondoMeta,
      totals: fTotals,
      vars: { pasiva: "v40", tasa_display: `${(fondoMeta.tasa || 0).toFixed(2)}%` },
      blocks: [{
        idx: 1,
        month_name: `${getMonthName(fechaFin.getMonth() + 1)} ${fechaFin.getFullYear()}`,
        days: columnasFechas,
        is_last: true,
        rows: rowsPdf
      }]
    });
  }

  return { asientos, xlsDict, pdfData };
};
