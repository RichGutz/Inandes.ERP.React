import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Leer .env manualmente
let supabaseUrl = 'https://egvcinsbyropumybatdf.supabase.co';
let supabaseKey = '';

for (const envFile of ['.env.production', '.env', '.env.local']) {
  const p = path.join(process.cwd(), envFile);
  if (fs.existsSync(p)) {
    const lines = fs.readFileSync(p, 'utf-8').split('\n');
    for (const l of lines) {
      if (l.startsWith('VITE_SUPABASE_URL=')) supabaseUrl = l.split('=')[1].trim();
      if (l.startsWith('VITE_SUPABASE_ANON_KEY=')) supabaseKey = l.split('=')[1].trim();
    }
  }
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runQc() {
  console.log('================================================================');
  console.log('LOOP QC PERICIAL BENOIT BLANC: CASO 1 - CAPITAL BASE INICIAL');
  console.log('================================================================');

  // Cargar contratos de NSGPEN01
  const { data: contratos, error: cErr } = await supabase
    .from('crm_contratos')
    .select('*')
    .eq('id_fondo', 'NSGPEN01')
    .in('estado', ['emitido', 'cerrado_fin_contrato', 'cerrado_por_rescate']);

  if (cErr) throw cErr;

  const { data: events, error: eErr } = await supabase
    .from('crm_certificados_eventos')
    .select('*')
    .in('id_contrato', contratos.map(c => c.id_contrato))
    .eq('tipo_evento', 'aumento_capital');

  if (eErr) throw eErr;

  console.log(`Contratos activos en NSGPEN01: ${contratos.length}`);
  console.log(`Eventos de aumento en NSGPEN01: ${events.length}`);

  let sumCapitalApertura = 0;
  for (const c of contratos) {
    sumCapitalApertura += Number(c.monto_inversion || 0);
  }

  let sumAumentos = 0;
  for (const e of events) {
    const rawF = e.fecha_evento || e.fecha_periodo_fin || '2020-01-01';
    if (rawF.startsWith('2026-01') || rawF.startsWith('2026-02')) {
      const m = Number(e.capital_final_saldo || 0) - Number(e.capital_base || 0);
      sumAumentos += m;
      console.log(`  - Aumento detectado: ${e.id_contrato} en ${rawF} por S/ ${m.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
    }
  }

  console.log('----------------------------------------------------------------');
  console.log(`Capital Base Inicial (01/01/2026): S/ ${sumCapitalApertura.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
  console.log(`Aumentos de Capital posteriores:    S/ ${sumAumentos.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
  console.log(`Capital Acumulado al cierre:       S/ ${(sumCapitalApertura + sumAumentos).toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
  console.log('----------------------------------------------------------------');

  const esperado = 10434753.14;
  const delta = Math.abs(sumCapitalApertura - esperado);
  console.log(`Validacion vs Valor Esperado S/ 10,434,753.14: Delta = S/ ${delta.toFixed(2)}`);

  if (delta < 0.01) {
    console.log('ASERCION PERICIAL APROBADA: Capital Base Inicial coincide al 100.00%');
  } else {
    console.log('ASERCION FALLIDA');
  }
}

runQc().catch(console.error);
