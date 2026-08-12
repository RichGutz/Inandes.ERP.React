# Valor Cuota (NAV v26) — Implementacion React / TypeScript

> **Ubicacion:** `C:\Users\rguti\Inandes.ERP.React\Obsidian\Inandes.Inversionistas.React\Frontend\Valor.Cuota.Implementacion.React.md`
> **Relacionado con:** Backend/Destripando.Logica.Valor.Cuota.Legacy.md | FondosPage.tsx | fondosService.ts
> **Fecha:** 11 de Agosto de 2026 | **Estado:** COMPLETO Y DESPLEGADO

---

## 1. Objetivo

Recrear fielmente en React / TypeScript el motor de calculo de **Valor Cuota (NAV - Net Asset Value)** del sistema LEGACY (Python), incluyendo:

- Motor matematico identico al de `generate_cuotas_v25.py`
- Comisiones completas (Admin + Captacion + Miscelaneos) en base 365
- Reporte PDF transpuesto de alta calidad (equivalente al HTML de LEGACY)
- UI de control ejecutivo limpia (sin visor denso en pantalla)

---

## 2. Motor de Calculo — `calculateValorCuotaV26`

**Archivo:** `src/services/fondosService.ts`

### Formulas implementadas

Para cada dia `d` dentro del periodo seleccionado:

```
Ingreso Bruto Diario    = Patrimonio(d-1) * (tasa_activa / 360)
Gasto Admin Diario      = Patrimonio(d-1) * (comision_admin / 365)
Gasto Captacion Diario  = Patrimonio(d-1) * (comision_captacion / 365)
Gasto Miscel. Diario    = Patrimonio(d-1) * (comision_miscelaneos / 365)

Utilidad Neta Diaria    = Ingreso Bruto - (Admin + Captacion + Misc)

Patrimonio(d)           = Patrimonio(d-1) + Utilidad Neta(d) + Suscripciones(d)
Cuotas(d)               = Cuotas(d-1) + nuevas_cuotas(d)
Valor Cuota(d)          = Patrimonio(d) / Cuotas(d)

Nuevas Cuotas Suscripcion = Capital_Suscrito / Valor_Cuota(d)
```

**Bases de dias:**
- Tasa Activa (ingresos): **Base 360** (convenio financiero peruano)
- Comisiones (gastos): **Base 365** (calendario real)

### Filas generadas por el motor

| Tipo de Fila | Estilo Visual |
|---|---|
| Certificado / Inversion | Fila normal con numero de certificado |
| Aumento / Suscripcion | Fila italic en verde con indentacion |
| COM. ADMIN (-) | Fila roja pastel (comision-row) |
| COM. CAPT. (-) | Fila roja pastel |
| COM. MISC. (-) | Fila roja pastel |
| TOTAL / PATRIMONIO | Fila amarilla pastel (summary-row) |
| VAL CUOTA | Fila azul pastel (vc-highlight), 4 decimales |
| SPACER | Separador visual entre grupos |

---

## 3. UI — Panel Ejecutivo de Valor Cuota

**Archivo:** `src/features/fondos/FondosPage.tsx` — `activeSubTab === 'valorCuota'`

### Estructura del Panel

```
+-----------------------------------------------------------+
|  Seguimiento y Simulacion de Valor Cuota v26 (NAV)        |
|  Titulo + descripcion                                     |
+-----------------------------------------------------------+
|  Fondo | Anio | Ciclo | N Periodo                         |
|  SELECT | SELECT | SELECT | SELECT                        |
+-----------------------------------------------------------+
|  Ficha Tecnica en 1 sola linea:                           |
|  Fondo: ... | Moneda: PEN | TEA: 14% | Admin: 1% ...      |
+-----------------------------------------------------------+
|  [Imprimir PDF Oficial v26]  [Exportar Excel v26]         |
+-----------------------------------------------------------+
```

**Decision de disenio:** Se elimino el visor de tabla B&N en pantalla (demasiado denso y de poco valor UX). La tabla completa se accede unicamente via PDF o Excel impreso.

### Ciclos disponibles

- **Bimestre:** 6 periodos (Ene-Feb, Mar-Abr, May-Jun, Jul-Ago, Sep-Oct, Nov-Dic)
- **Trimestre:** 4 periodos (Ene-Mar, Abr-Jun, Jul-Sep, Oct-Dic)

---

## 4. Reporte PDF v26 — `handleExportVcPdf`

**Archivo:** `src/features/fondos/FondosPage.tsx`

### Especificaciones del PDF

| Elemento | Detalle |
|---|---|
| **Tamano** | A4 Landscape (`@page { size: A4 landscape; margin: 0.5cm }`) |
| **Escala impresion** | `transform: scale(0.72)` — contenido de 270mm escalado a A4 |
| **Logo izquierda** | `LOGO_EFI_BASE64` — Logo PNG oficial de Geeksoft |
| **Logo derecha** | `LOGO_INANDES_BASE64` — Logo JPEG oficial de InAndes |
| **Cabecera central** | INANDES ACTIVOS ALTERNATIVOS S.A.C. |
| **Subtitulo** | REPORTE MAESTRO DE LIQUIDACION Y VALOR CUOTA v26 (NAV) |

### Meta-box (1 sola linea por fondo)

```
Fondo: FDO NSG MIPYME PEN 03 (NSGPEN03) | Moneda: PEN |
TASA ACTIVA EMPRESA: 14.00% | COMISION ADMIN: 1.00% |
COM. CAPTACION: 2% | COM. MISC: 0%
```

### Cabeceras de tabla (thead) — fondo azul oscuro #01579b, texto blanco

| Columna | Ancho |
|---|---|
| N | 24px |
| CERTIFICADO / RESUMEN | 160px |
| CAPITAL / REF. | 70px |
| N CUOTAS | 65px |
| Dia 1 ... Dia N | auto |
| TOTAL ACUM. | 70px |

> **Regla clave:** Los `th` usan `!important` para evitar que el CSS del browser sobrescriba el color de fondo azul con texto blanco.

### Paleta de colores de filas

| Tipo | Fondo |
|---|---|
| Normal / Certificado | blanco |
| Suscripcion / Aumento | #fafafa con borde verde izquierdo |
| Comisiones | #ffebee (rosa pastel), texto #c62828 |
| Totales / Patrimonio | #fff9c4 (amarillo pastel) |
| Valor Cuota | #e3f2fd (azul pastel), texto #0d47a1, **4 decimales** |

---

## 5. Export Excel v26 — `handleExportVcExcel`

Genera un archivo `.xlsx` transpuesto con la misma estructura que el PDF, usando la libreria `xlsx` (SheetJS). Los datos los provee el mismo motor `calculateValorCuotaV26`.

---

## 6. Flujo de Datos

```
Supabase (crm_fondos)
    -> fondosService.ts -> getFondos()
         -> FondosPage.tsx -> groupedFondos
              -> calculateValorCuotaV26(fondo, year, tipoPeriodo, numPeriodo)
                   -> V26FondoReport { fondo, vars, blocks[] }
                        -> blocks[].days[]    -> columnas (dias del mes)
                        -> blocks[].rows[]    -> filas (certificados + resumenes)
                        -> handleExportVcPdf  -> window.print() A4 landscape
                        -> handleExportVcExcel -> XLSX download
```

---

## 7. Historial de Commits relevantes

| Commit | Descripcion |
|---|---|
| `585c115` | Implementacion inicial NAV v26 con comisiones Captacion y Misc |
| `089ffb7` | Logo Geeksoft texto, metadata 1 linea, encabezados legibles, eliminacion visor B&N |
| `9c51028` | Logo Geeksoft PNG real, orientacion A4 landscape con scale(0.72) |

---

## 8. Reglas y Restricciones

1. **Base de dias:** Ingresos en Base 360, Gastos en Base 365 — NO intercambiar.
2. **Valor Cuota:** Siempre con **4 decimales** de precision.
3. **Nuevas cuotas:** Se calculan usando el VC del dia de suscripcion, no del dia anterior.
4. **Logo Geeksoft:** Usar `LOGO_EFI_BASE64` (PNG). No reemplazar por texto estilizado.
5. **Escala PDF:** El `scale(0.72)` es necesario porque la tabla de 31 dias nunca cabe en A4 sin escalar. No aumentar el factor de escala.
6. **No visor en pantalla:** La tabla densa no se muestra en la UI React. Solo PDF/Excel.

---

*Nota generada por Antigravity — 11 de Agosto de 2026.*
