# Proceso de Cierre Look-Ahead (Contratos Sucesores & Compra de Nuevas Cuotas)

> **Modulo:** CRM Inversionistas — Motor de Retornos v40 / Asientos Contables / Estados de Cuenta
> **Fecha de Especificacion:** 2026-09-15
> **Estado:** Aprobado para implementacion

---

## 1. Contexto de Negocio y Regla Temporal

En la operativa real de InAndes Grupo Financiero:
- Los **cierres contables de periodo** tienen como fecha de corte el ultimo dia del mes (ejemplo: **31 de agosto**).
- Los **asientos contables y la liquidacion oficial** se ejecutan operativamente en los primeros 10 dias del mes siguiente (ejemplo: **10 de septiembre**).
- En este intervalo temporal, el equipo comercial ya negocio y registro en la base de datos (`crm_contratos`) los contratos sucesores de aquellos inversionistas que deciden renovar su participacion (quedarse en la empresa).

---

## 2. Criterio Unico y Exclusivo de Busqueda (Look-Ahead)

Para determinar si un contrato que finaliza o vence al corte del periodo tiene renovacion:
- **Criterio Estricto:**
  1. **Mismo Inversionista:** Coincidencia por `id_inversionista_1` (o nombre principal).
  2. **Misma Moneda:** Coincidencia exacta de moneda (`PEN` con `PEN`, `USD` con `USD`).
  3. **Estado Activo/Emitido/Vigente:** El nuevo contrato debe estar registrado con fecha de inicio posterior al corte (`fecha_inicio > fecha_corte`, de hecho típicamente inicia el día siguiente al cierre).
- **Flexibilidad de Parametros:** El nuevo contrato puede variar libremente en:
  - Fondo (`id_fondo`)
  - Tasa de interes (`tasa_pactada`)
  - Plazo (`plazo_meses`)
  - Monto de inversion (`monto_inversion`)

---

## 3. Matriz de Decision: Rollover vs. Extincion

| Escenario | Condicion | Monto Compra Nuevas Cuotas | Monto de Capital a Transferir | Clasificacion |
|---|---|---|---|---|
| **A. Rollover Total o con Aumento** | Existe contrato nuevo con `capNuevo >= capAnterior` | `capAnterior` (mantenido para nuevas cuotas) | `0.00` (solo se transfieren rendimientos netos) | `ROLLOVER_TOTAL` |
| **B. Rollover Parcial** | Existe contrato nuevo con `capNuevo < capAnterior` | `capNuevo` | `capAnterior - capNuevo` (diferencial a favor del participe) | `ROLLOVER_PARCIAL` |
| **C. Extincion / Sin Renovacion** | No existe contrato nuevo registrado | `0.00` | `capAnterior` (devolucion total de capital) | `EXTINCION_TOTAL` |

---

## 4. Persistencia en el Payload del Asiento Contable (`crm_certificados_eventos`)

Para asegurar la trazabilidad y sustentar el **Monto Transferido Real** de forma inmutable:
Al momento de generar y registrar el asiento contable de cierre (`cierre_fin_contrato` / `cierre_fin_ciclo`), el objeto `payload_asiento` incluira:

```json
{
  "audit_version": "v40 (Ciclo Auditado React)",
  "inversionista": "Nombre Inversionista",
  "moneda": "PEN",
  "capital_base": 100000.00,
  "capital_final": 0.00,
  "id_contrato_siguiente": "NSGPEN01-002",
  "tipo_liquidacion": "ROLLOVER_TOTAL",
  "compra_nuevas_cuotas": 100000.00,
  "diferencial_capital_devuelto": 0.00,
  "monto_transferido_calculado": 1500.00,
  "comentario_look_ahead": "Rollover Total mantenido en nuevo contrato NSGPEN01-002"
}
```

---

## 5. Reflejo en el Estado de Cuenta (EECC HTML & PDF)

1. **Fila 'Monto destinado para la compra de nuevas cuotas':**
   - Muestra el valor de `compra_nuevas_cuotas` (si hubo reinversion/rollover o aumentos de capital).
2. **Fila 'Monto Liquidado / Transferido':**
   - Refleja el monto real transferido: rendimientos netos liquidados + diferencial de capital devuelto (si hubo rollover parcial o extincion).
   - Prohibido devolver en transferencias el capital que ya esta destinado a la compra de nuevas cuotas del contrato sucesor.

---

## 6. Sincronizacion de Capas de Software

1. **Frontend (`InversionistasPage.tsx`):**
   - Busqueda look-ahead de contratos en el calculo de liquidaciones y generador de EECC.
   - Sincronizacion en la generacion de asientos contables.
2. **Backend FastAPI (`backend/routers/inversionistas.py`):**
   - Lectura del campo `compra_nuevas_cuotas` e `id_contrato_siguiente` desde el payload de eventos para la generacion del PDF oficial.

---

## 7. Dictamen de Ejecucion y Entregables (Sesion 2026-09-15)

1. **Algoritmo Look-Ahead:** Implementado y validado en Frontend (`financialCalculator.ts`, `InversionistasPage.tsx`) y Backend FastAPI.
2. **Snapshot Total de Respaldo:** 8 tablas de Supabase respaldadas al 100% en `backups/SNAPSHOT_TOTAL_SUPABASE_20260915/` (1,768 registros).
3. **Enriquecimiento Inmutable de Payloads:** 199 asientos contables de agosto 2026 enriquecidos con campos de Look-Ahead sin alterar importes historicos.
4. **Caso Mantilla Silva:** Actualizado contrato sucesor a S/ 100,000.00 (Rollover Parcial con devolucion de capital S/ 4,057.99 + rendimientos netos S/ 1,427.31 = Transferencia Total S/ 5,485.30).
5. **PDFs Oficiales Generados:**
   - [Reporte_Casos_Look_Ahead_Agosto_2026.pdf](file:///C:/Users/rguti/Inandes.ERP.React/Obsidian/Inandes.Inversionistas.React/Backend/Reporte_Casos_Look_Ahead_Agosto_2026.pdf)
   - [EECC_Rolleadores_Cierre_Agosto_2026.pdf](file:///C:/Users/rguti/Inandes.ERP.React/Obsidian/Inandes.Inversionistas.React/Backend/EECC_Rolleadores_Cierre_Agosto_2026.pdf)
