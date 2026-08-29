# 🕵️‍♂️ Manual de Auditoría Forense: Caso Valor Cuota NAV V27 — Excel Maestro y PDF WeasyPrint Quincenal

> **Expediente Oficial**: `BENOIT_BLANC_RECUPERA_PDF_BELLOS.NO.SHARING.VIOL.NAV.UI.md`  
> **Ubicación**: `Obsidian/Inandes.Factoring.React/BENOIT_BLANC_RECUPERA_PDF_BELLOS.NO.SHARING.VIOL.NAV.UI.md`  
> **Investigador Principal**: Detective Benoit Blanc  
> **Fecha**: 29 de Agosto de 2026  
> **Metodología Estricta**: `LEG` (Autopsia de la Escena) $\rightarrow$ `CLON` (Aislamiento y Sanitización) $\rightarrow$ `DIFF` (Diferencias y Código) $\rightarrow$ `QC` (Control de Calidad Terminal) $\rightarrow$ `NOTA` (Certificación y Cierre)

---

## 🩸 1. La Escena del Crimen (`LEG`)

1. **Botones Inertes en UI (`FondosPage.tsx`)**:
   * Al presionar `Descargar Excel Maestro V27` o `Descargar PDF Oficial V27`, nada ocurría o permanecían deshabilitados.
2. **Autopsia Forense de la Causa Raíz**:
   * En `src/services/fondosService.ts` (Línea 169), el motor de Valor Cuota V27 intentaba leer `fondoRetornoData.rows`.
   * En `generateRetornosV40`, las filas calculadas se encuentran encapsuladas dentro de `fondoRetornoData.blocks[0].rows`.
   * Al ser `undefined`, la condición `if (certsRetorno.length === 0) continue;` saltaba silenciosamente todos los fondos, retornando un arreglo vacío `[]` y dejando los botones permanentemente bloqueados.
   * Además, en el legado original `MOTOR_A_y_B_Calculo_NAV_y_PYL_V26.py` y `reporte_cuotas_transpuesto_v26.html`, el reporte PDF requería un ancho especial porque 31 días en columnas no entraban legibles en 1 sola hoja A4 Landscape.

---

## 🧬 2. La Solución Quirúrgica (`CLON` & `DIFF`)

### 2.1. Reparación del Motor Contable V27 en `fondosService.ts`:
```typescript
// Extracción universal de filas desde blocks[0].rows
const rawRows = (fondoRetornoData?.rows && fondoRetornoData.rows.length > 0)
  ? fondoRetornoData.rows
  : (fondoRetornoData?.blocks?.[0]?.rows || []);
if (rawRows.length === 0) continue;

// Mapeo estructurado de Certificados Padre y sus Aumentos
const certRows: any[] = [];
let currentPadre: any = null;

for (const r of rawRows) {
  if (r.tipo === 'AUMENTO') {
    const aumentoObj = {
      tipo: 'AUMENTO',
      id: r.id || 'Aumento',
      monto: Number(r.capital || 0),
      fecha_ingreso: r.fecha ? new Date(r.fecha) : (r.fecha_inicio ? new Date(r.fecha_inicio) : new Date(startDate)),
      valores_dia: (r.valores || []).slice(),
      interes_acum: Number(r.bruto_total || 0)
    };
    if (currentPadre) currentPadre.hijos.push(aumentoObj);
  } else {
    currentPadre = {
      tipo: 'CERT',
      id: r.id || r.id_contrato,
      capital: Number(r.capital || r.capital_base || 0),
      cuotas: Number(r.capital || r.capital_base || 0),
      emision: r.emision ? new Date(r.emision) : new Date(startDate),
      interes_acum: Number(r.bruto_total || r.interes_bruto || 0),
      valores_dia: (r.valores || r.valores_dia_padre || []).slice(),
      hijos: []
    };
    certRows.push(currentPadre);
  }
}
```

### 2.2. Excel Maestro V27 con `ExcelJS` ([`src/utils/excelGeneratorValorCuotaV27.ts`](file:///c:/Users/rguti/Inandes.ERP.React/src/utils/excelGeneratorValorCuotaV27.ts)):
* Pestañas independientes por fondo y mes.
* Encabezados institucionales azul InAndes `#0284c7` y slate `#0f172a`.
* Celdas de contratos e intereses formateadas a `#,,##0.00`.
* Aumentos en verde esmeralda `#059669` itálico con fondo `#f0fdf4`.
* Filas de resumen diario (Ganancia Bruta, Comisiones Gestor, Ganancia Neta).
* **Valor Cuota de Cierre con 6 decimales (`0.000000`)** sobre fondo azul claro `#eff6ff`.

### 2.3. PDF WeasyPrint Quincenal en 2 Páginas Horizontales ([`src/utils/pdfGeneratorValorCuotaV27.ts`](file:///c:/Users/rguti/Inandes.ERP.React/src/utils/pdfGeneratorValorCuotaV27.ts)):
* Inspirado en el legado `reporte_cuotas_transpuesto_v26.html` y en el diseño visual de Retornos y Rendimientos.
* **Parte 1 (Días 01 al 15)**: Matriz de la primera quincena con encabezado institucional, logo Geeksoft PNG y logo InAndes en Base64 optimizada.
* **Parte 2 (Días 16 al 31 + Total Cierre)**: Segunda quincena con la columna de liquidación final y Valor Cuota de cierre.
* Integrado con el microservicio WeasyPrint vía [`src/utils/pdfDownloadHelper.ts`](file:///c:/Users/rguti/Inandes.ERP.React/src/utils/pdfDownloadHelper.ts).

---

## 🧪 3. Control de Calidad (`QC`)
* **Compilación Frontend**: `npm run build` en **`5.36s`** (0 errores).
* **Despliegue Contabo**: Commit `f3295f4` en `origin/main`.
* **Guardián Systemd VPS**: **`HTTP 200 OK`**.

---

*Expediente cerrado, documentado y blindado por Detective Benoit Blanc — 29 de Agosto de 2026.*
