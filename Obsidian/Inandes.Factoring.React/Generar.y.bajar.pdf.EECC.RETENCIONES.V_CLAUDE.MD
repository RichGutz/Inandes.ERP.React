# Arquitectura Oficial V_CLAUDE: Generacion de PDFs EECC y Retenciones
# Estado: IMPLEMENTADO Y DESPLEGADO - 2026-08-08

---

## REGLA MAESTRA (Leer primero, siempre)

> **PROHIBIDO** generar PDFs localmente con Python/WeasyPrint y subirlos al VPS.
> **PROHIBIDO** usar archivos estaticos en /var/www/inandes/reports/ para EECC y Retenciones.
> **OBLIGATORIO** generar el HTML en React con los datos del Motor V40 y abrirlo en el browser del usuario.

---

## 1. FLUJO DE DATOS OFICIAL (De extremo a extremo)

```
[Supabase] crm_contratos + crm_certificados + crm_inversionistas + crm_cronograma
    |
    v
[Motor V40 TypeScript] generateRetornosV40() en financialCalculator.ts
    |  Calcula: bruto_total, impuesto_total, base_neta, capitalizacion,
    |           devolucion_capital (rescates), reparto_valor, capital_final
    |
    v
[calcResult] estado en InversionistasPage.tsx (en memoria, no persiste)
    |
    +---> [Audit PDF]       handleExportPDFV40()       --> window.open('','_blank') + document.write
    |
    +---> [EECC]            handleExportEECC()          --> window.open('','_blank') + document.write
    |
    +---> [Retenciones]     handleExportRetenciones()   --> window.open('','_blank') + document.write
```

**Los tres botones usan el MISMO calcResult. Mismo dato, diferente formato HTML.**

---

## 2. ARCHIVO UNICO DE IMPLEMENTACION

```
C:\Users\rguti\Inandes.ERP.React\src\features\inversionistas\InversionistasPage.tsx
```

**NO existe ningun otro archivo que genere EECC o Retenciones en produccion.**

Los scripts Python en la raiz del proyecto:
- `_run_eecc_v33.py` - OBSOLETO para produccion, solo herramienta de respaldo local
- `_run_retenciones_v33.py` - OBSOLETO para produccion, solo herramienta de respaldo local
- Las plantillas HTML `estado_cuenta_inversionista_v2.html` y `retencion_renta_v2.html` son REFERENCIA VISUAL, no se usan en produccion.

---

## 3. HANDLER EECC: handleExportEECC() [Lineas ~749 de InversionistasPage.tsx]

### Que hace:
1. Verifica si `calcResult` ya esta en estado. Si no, ejecuta `handleRunV40Calculation()`.
2. Filtra `calcResult.pdfData` por `docFondo` (fondo seleccionado en el selector).
3. Para cada fila con `r.tipo === 'CERT'`, genera un bloque HTML de una pagina A4.
4. Abre `window.open('', '_blank')` y escribe el HTML con `printWindow.document.write(html)`.

### Fuente de cada campo del EECC:

| Campo en el documento PDF | Fuente en calcResult |
|---|---|
| Sr(a)(s): [nombre] | `r.inversionista` |
| Certificado N: | `r.id` |
| Monto inicial invertido | `r.capital` |
| Ganancia bruta obtenida | `r.bruto_total` |
| (-) Impuesto a la renta retenido | `-r.impuesto_total` |
| (-) Deducciones | `-r.deducciones_total` (si > 0) |
| Ganancia disponible al inversionista | `r.base_neta` |
| Ganancias capitalizadas | `r.capitalizacion` (si > 0) |
| Rescates | `r.devolucion_capital` (si > 0) |
| Monto transferido a su cuenta bancaria | `r.reparto_valor` |
| Monto de la inversion al [fecha_fin] | `r.capital_final` |
| Valor cuota al [fecha_fin] | `fondosDisponibles.find(f.id_fondo).valor_cuota` |
| Numero de cuotas al [fecha_fin] | `r.capital_final / valor_cuota` (2 decimales) |
| Moneda del fondo | `fData.fondo.moneda` ('PEN' o 'USD') |
| Nombre del fondo | `fData.fondo.nombre_fondo` |
| Periodo inicio | `fStart` (estado derivado de v40SelYear, v40SelCiclo, v40SelNum) |
| Periodo fin | `fEnd` (estado derivado de v40SelYear, v40SelCiclo, v40SelNum) |
| Logo | `LOGO_EFI_BASE64` (importado de src/assets/base64Images.ts) |

---

## 4. HANDLER RETENCIONES: handleExportRetenciones() [Lineas ~870 de InversionistasPage.tsx]

### Que hace:
1. Mismo patron que EECC: verifica calcResult, ejecuta V40 si es null.
2. Filtra solo filas con `r.tipo === 'CERT'` Y `r.impuesto_total > 0`.
3. Para fondos USD: convierte IR a PEN usando TC_USD_PEN (hardcodeado 3.662).
4. Busca DNI y domicilio del inversionista en el array `inversionistas` (ya cargado al montar).
5. Genera HTML con parrafo legal + tabla resumen.
6. `window.open('', '_blank')` + `printWindow.document.write(html)`.

### Fuente de cada campo del Certificado de Retencion:

| Campo en el documento PDF | Fuente |
|---|---|
| Nombre del fondo | `fData.fondo.nombre_fondo` |
| Certificado N: | `r.id` |
| Nombre del inversionista | `r.inversionista` |
| DNI del inversionista | `inversionistas[].documento_identidad` (lookup por nombre) |
| Domicilio fiscal | `inversionistas[].direccion_fiscal` (lookup por nombre) |
| Moneda base del fondo | `fData.fondo.moneda` |
| Base de retencion (tabla) | `r.bruto_total` en moneda del fondo |
| Monto retenido (tabla) | `irPen` = IR convertido a PEN (siempre en PEN) |
| IR para fondos PEN | `r.impuesto_total` (ya en PEN) |
| IR para fondos USD | `r.impuesto_total * TC_USD_PEN` (convertido a PEN) |
| TC_USD_PEN | Hardcodeado 3.662 - TODO: traer de Supabase |
| Tipo de cambio (tabla, solo USD) | `PEN 3.662` |
| Monto en letras | Funcion `numLetras()` local en el handler |
| Fecha de operacion | `fEnd` |
| Fecha de certificacion | `new Date()` (hoy) |
| Logo | `LOGO_EFI_BASE64` |
| Firma | `/assets/firma_ricardo_gallo.png` (URL publica de la app) |

### Regla de moneda en el parrafo legal:
- SIEMPRE dice "...la suma de PEN [monto_ir_pen] ([letras] soles)..."
- El IR se paga SIEMPRE en PEN. Para fondos USD se convierte con TC.
- NUNCA debe decir "dolares de los Estados Unidos de America" en el parrafo.

---

## 5. COMO SE ACTIVA EL CALCULO (Prerequisito)

El `calcResult` se genera en la pestana AUDITORIA (sub-tab `retornos_react`) con el boton
"Ver / Generar Reporte PDF Oficial". Ese mismo resultado queda en el estado del componente
y los handlers EECC/Retenciones lo reutilizan sin recalcular.

Si el usuario va directamente a la pestana DOCUMENTOS sin haber calculado antes,
`calcResult` es null y los handlers ejecutan `handleRunV40Calculation()` automaticamente.

**El Motor V40 usa los selectores:**
- `v40SelFondo` - fondo (puede ser TODOS o un fondo especifico)
- `v40SelYear` - ano (2026)
- `v40SelCiclo` - Bimestre o Trimestre
- `v40SelNum` - numero de periodo (1=Ene-Feb, 2=Mar-Abr, etc.)

Los selectores del tab DOCUMENTOS son los mismos que usan el mismo estado de React.

---

## 6. SELECTOR DE FONDO EN TAB DOCUMENTOS

```
docFondo (estado React) -> selector <select> en tab DOCUMENTOS
```

- Si `docFondo === 'TODOS'`: genera documentos de TODOS los fondos en el calcResult.
- Si `docFondo === 'NSGPEN01'`: filtra `calcResult.pdfData` para solo ese fondo.

El filtro se aplica en `fondosFiltrados`:
```typescript
const fondosFiltrados = (docFondo && docFondo !== 'TODOS')
  ? currentResult.pdfData.filter((f: any) => f.fondo.id_fondo === docFondo)
  : currentResult.pdfData;
```

---

## 7. LOOKUP DE DNI / DOMICILIO EN RETENCIONES

El array `inversionistas` se carga al montar el componente via `fetchDatos()`.
El mapa de busqueda se construye dentro de `handleExportRetenciones()`:

```typescript
const invLookup = new Map<string, Inversionista>();
for (const inv of inversionistas) {
  const nombre = [inv.apellido_1, inv.apellido_2, inv.nombre_1, inv.nombre_2]
    .filter(Boolean).join(' ').toUpperCase().trim();
  invLookup.set(nombre, inv);
}
```

Se busca con: `invLookup.get(r.inversionista.toUpperCase().trim())`

**LIMITACION CONOCIDA**: Si el nombre en `r.inversionista` (generado por V40 con formato
"APELLIDO1 APELLIDO2 NOMBRE1 NOMBRE2") no coincide exactamente con el nombre reconstruido
del array `inversionistas`, el DNI y domicilio aparecen vacios. Esto es aceptable como
degradacion graceful. No rompe el documento.

---

## 8. TC_USD_PEN - PENDIENTE CONECTAR A SUPABASE

En `handleExportRetenciones()`, linea 1 del handler:

```typescript
// TODO: TC_USD_PEN hardcodeado - obtener de Supabase cuando este disponible
const TC_USD_PEN = 3.662;
```

Cuando el dato este disponible en Supabase (tabla `crm_fondos` u otra),
reemplazar esa linea con una consulta a la BD. El dato debe ser pre-cargado
ANTES del `window.open` para no violar la Bandera Roja 4.

---

## 9. BANDERAS ROJAS HEREDADAS (Siguen vigentes)

### BANDERA ROJA 1: Nginx / fallback a index.html
No aplica para esta arquitectura (no hay URLs de PDF en el VPS).

### BANDERA ROJA 2: 404 por archivos no sincronizados
No aplica. No hay archivos estaticos PDF en el VPS para EECC/Retenciones.

### BANDERA ROJA 3: Blob URLs y modales
PROHIBIDO. Usar `window.open('', '_blank') + document.write`.

### BANDERA ROJA 4: await antes de window.open
El window.open se llama DESPUES de cualquier await (el await solo ocurre si
calcResult es null). Si calcResult ya existe, el path es sincrono.

### BANDERA ROJA 5: Creatividad no solicitada
Copiar el patron de handleExportPDFV40 exactamente. Sin variaciones.

---

## 10. COMMITS RELEVANTES

| Commit | Descripcion |
|---|---|
| 88fab84 | EECC.RETENCIONES.V33.PDF.AESTHETICS - plantillas V2 HTML |
| ca31e2e | FIX.TS6133.dead.code.numeroALetrasPeru |
| [ultimo] | handleExportEECC + handleExportRetenciones - nueva arquitectura |

---

## 11. PENDIENTES CONOCIDOS (Tomar nota, no actuar sin orden)

1. **TC_USD_PEN**: Conectar a Supabase en lugar de hardcode 3.662.
2. **Capitalizacion y Rescates en EECC**: Verificar que Motor V40 devuelve
   valores correctos para r.capitalizacion y r.devolucion_capital.
   La senora Parra tiene ~325,000 en rescates que deben aparecer.
3. **DNI lookup**: Si el formato de nombre en V40 difiere del de Supabase,
   mejorar el algoritmo de matching.

