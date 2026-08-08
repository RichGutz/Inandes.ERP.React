# Arquitectura Oficial V_CLAUDE: Generacion de PDFs EECC y Retenciones
# Estado: IMPLEMENTADO, DESPLEGADO Y TAGGEADO (99percent) - 2026-08-08
# Commit: 5cab047 | Tag: 99percent

---

## REGLA MAESTRA — LEER PRIMERO, SIEMPRE

> PROHIBIDO generar PDFs con Python/WeasyPrint y subirlos al VPS.
> PROHIBIDO usar archivos estaticos /var/www/inandes/reports/*.pdf para EECC y Retenciones.
> OBLIGATORIO generar el HTML en React con datos del Motor V40 y abrirlo con window.open + document.write + setTimeout(print, 500).
> ESTA ES LA UNICA ARQUITECTURA VALIDA PARA PRODUCCION.

---

## 1. FLUJO DE DATOS (De extremo a extremo, sin excepciones)

```
[Supabase]
  crm_contratos + crm_certificados + crm_inversionistas + crm_cronograma
        |
        v
[Motor V40 TypeScript]
  src/utils/financialCalculator.ts -> generateRetornosV40()
  Calcula: bruto_total, impuesto_total, base_neta, capitalizacion,
           devolucion_capital (= rescates), reparto_valor, capital_final
        |
        v
[calcResult] — estado React en memoria en InversionistasPage.tsx
        |
        +---> Audit PDF     handleExportPDFV40()       -> window.open + document.write + print()
        +---> EECC          handleExportEECC()          -> window.open + document.write + print()
        +---> Retenciones   handleExportRetenciones()   -> window.open + document.write + print()
```

LOS TRES BOTONES USAN EL MISMO calcResult. MISMO DATO. DIFERENTE FORMATO HTML.

---

## 2. ARCHIVO UNICO DE IMPLEMENTACION

```
C:\Users\rguti\Inandes.ERP.React\src\features\inversionistas\InversionistasPage.tsx
```

- handleExportEECC()          -> lineas ~752-854
- handleExportRetenciones()   -> lineas ~859-1023

NO existe ningun otro archivo que genere EECC o Retenciones en produccion.

Los scripts Python en la raiz:
- _run_eecc_v33.py            -> OBSOLETO. Solo respaldo offline.
- _run_retenciones_v33.py     -> OBSOLETO. Solo respaldo offline.

Las plantillas HTML en src/templates/:
- estado_cuenta_inversionista_v2.html  -> REFERENCIA VISUAL SOLAMENTE. No se usa en produccion.
- retencion_renta_v2.html              -> REFERENCIA VISUAL SOLAMENTE. No se usa en produccion.

---

## 3. PATRON EXACTO DE APERTURA (IDENTICO AL VECINO handleExportPDFV40)

```typescript
const printWindow = window.open('', '_blank');
if (!printWindow) {
  alert('Habilita las ventanas emergentes para ver el documento.');
  return;
}
// ... construir html string ...
printWindow.document.write(html);
printWindow.document.close();
printWindow.focus();
setTimeout(() => {
  printWindow.print();   // <-- dispara dialogo Chrome: fondo oscuro + PDF centrado + boton descarga
}, 500);
```

ESTE PATRON ES INTANGIBLE. NO SE MODIFICA. NO SE "MEJORA".
- PROHIBIDO usar Blob URLs (URL.createObjectURL).
- PROHIBIDO usar iframes o modales React.
- PROHIBIDO poner await de Supabase ANTES del window.open (Bandera Roja 4).
- El window.open es sincrono si calcResult ya existe. El await solo ocurre si calcResult es null.

---

## 4. HANDLER EECC: handleExportEECC()

### Prerequisito:
calcResult debe existir. Si es null, el handler llama handleRunV40Calculation() automaticamente.

### Filtro de fondo:
```typescript
const fondosFiltrados = (docFondo && docFondo !== 'TODOS')
  ? currentResult.pdfData.filter((f: any) => f.fondo.id_fondo === docFondo)
  : currentResult.pdfData;
```

### Filas incluidas:
Solo `r.tipo === 'CERT'` (excluye filas tipo 'AUMENTO').

### Tabla de campos — fuente exacta de cada dato del documento:

| Campo en el documento EECC                        | Fuente en calcResult / estado               |
|---------------------------------------------------|---------------------------------------------|
| Sr(a)(s): [nombre]                                | r.inversionista                             |
| Certificado N:                                    | r.id                                        |
| Nombre del fondo (titulo)                         | fData.fondo.nombre_fondo                    |
| Periodo inicio                                    | fStart (getDates(v40SelYear, v40SelCiclo, v40SelNum).fStart) |
| Periodo fin                                       | fEnd   (getDates(v40SelYear, v40SelCiclo, v40SelNum).fEnd)   |
| Moneda del fondo                                  | fData.fondo.moneda ('PEN' o 'USD')          |
| Prefijo moneda                                    | 'PEN ' o 'USD '                             |
| Monto inicial invertido                           | r.capital                                   |
| Ganancia bruta obtenida                           | r.bruto_total                               |
| (-) Impuesto a la renta retenido                  | -r.impuesto_total                           |
| (-) Deducciones (si > 0, negativo; si = 0, '-')   | r.deducciones_total                         |
| Ganancia disponible al inversionista              | r.base_neta                                 |
| Ganancias capitalizadas (si > 0; si = 0, '-')     | r.capitalizacion                            |
| Rescates (si > 0; si = 0, '-')                    | r.devolucion_capital                        |
| Monto transferido a su cuenta bancaria            | r.reparto_valor                             |
| Monto de la inversion al [fEnd]                   | r.capital_final                             |
| Valor cuota al [fEnd]                             | fondosDisponibles.find(id_fondo).valor_cuota|
| Numero de cuotas al [fEnd]                        | r.capital_final / valor_cuota (2 decimales) |
| Logo InAndes                                      | LOGO_EFI_BASE64 (importado de src/assets/base64Images.ts) |

---

## 5. HANDLER RETENCIONES: handleExportRetenciones()

### Prerequisito:
calcResult debe existir. Si es null, llama handleRunV40Calculation().

### Filtro de filas incluidas:
`r.tipo === 'CERT'` Y `r.impuesto_total > 0`
(Si impuesto_total = 0, no se emite certificado para ese inversionista.)

### TC_USD_PEN:
```typescript
// TODO: traer de Supabase cuando este disponible
const TC_USD_PEN = 3.662;
```
Para fondos PEN: irPen = r.impuesto_total (ya en PEN, sin conversion).
Para fondos USD: irPen = Math.round(r.impuesto_total * TC_USD_PEN * 100) / 100.

### Lookup de DNI y domicilio:
El array `inversionistas` ya esta cargado al montar el componente (fetchDatos()).
Se construye un Map dentro del handler:
```typescript
const invLookup = new Map<string, Inversionista>();
for (const inv of inversionistas) {
  const nombre = [inv.apellido_1, inv.apellido_2, inv.nombre_1, inv.nombre_2]
    .filter(Boolean).join(' ').toUpperCase().trim();
  invLookup.set(nombre, inv);
}
const inv = invLookup.get(r.inversionista.toUpperCase().trim());
const dni = inv?.documento_identidad ?? '';
const domicilio = inv?.direccion_fiscal ?? 'Domicilio no registrado';
```

LIMITACION CONOCIDA: Si el formato de nombre del Motor V40 difiere del reconstruido
desde inv.apellido_1/2/nombre_1/2, el DNI y domicilio quedan vacios. Degradacion graceful.

### Tabla de campos — fuente exacta de cada dato del certificado de retencion:

| Campo en el certificado de Retencion                    | Fuente                                           |
|---------------------------------------------------------|--------------------------------------------------|
| Nombre del fondo                                        | fData.fondo.nombre_fondo                         |
| Certificado N:                                          | r.id                                             |
| Nombre del inversionista                                | r.inversionista                                  |
| DNI del inversionista                                   | inv.documento_identidad (lookup por nombre)       |
| Domicilio fiscal                                        | inv.direccion_fiscal (lookup por nombre)          |
| Moneda del fondo (para tabla Base de Retencion)         | fData.fondo.moneda                               |
| Base de retencion (tabla)                               | fData.fondo.moneda + ' ' + r.bruto_total         |
| Monto retenido (tabla) — SIEMPRE EN PEN                 | 'PEN ' + irPen                                  |
| IR fondos PEN                                           | r.impuesto_total (sin conversion)                |
| IR fondos USD                                           | r.impuesto_total * 3.662 (redondeo 2 decimales)  |
| Tipo de cambio (tabla, SOLO fondos USD)                 | 'PEN 3.662'                                      |
| Tipo de cambio (tabla, fondos PEN)                      | columna omitida del <thead> y <tbody>            |
| Monto en letras (parrafo legal)                         | numLetras(irPen) + ' soles'                      |
| Fecha de operacion (tabla)                              | fEnd                                             |
| Fecha de certificacion (parrafo firma)                  | new Date() — dia/mes/anio de hoy                 |
| Periodo inicio (parrafo legal)                          | fStart                                           |
| Periodo fin (parrafo legal)                             | fEnd                                             |
| Logo InAndes                                            | LOGO_EFI_BASE64 (base64, inline en <img src=>)   |
| Firma de Ricardo Gallo                                  | /assets/firma_ricardo_gallo.png (URL publica)    |
| Nombre firmante                                         | Juan Ricardo Gallo Pizarro                       |
| Empresa firmante                                        | INANDES ACTIVOS ALTERNATIVOS SAC                 |
| Cargo firmante                                          | Gerente General                                  |

### REGLA DE MONEDA EN EL PARRAFO LEGAL (INAMOVIBLE):
El parrafo SIEMPRE dice "...la suma de PEN [monto_ir_pen] ([letras] SOLES)..."
El IR se paga SIEMPRE EN PEN. Para fondos USD se convierte con TC.
NUNCA debe decir "dolares de los Estados Unidos de America" en el parrafo legal.

---

## 6. SELECTORES QUE CONTROLAN EL PERIODO Y FONDO

Los handlers leen el estado React. No reciben parametros.

| Estado React       | Descripcion                                         | Ejemplo           |
|--------------------|-----------------------------------------------------|-------------------|
| v40SelYear         | Ano del periodo                                     | 2026              |
| v40SelCiclo        | 'Bimestre' o 'Trimestre'                            | 'Bimestre'        |
| v40SelNum          | Numero del ciclo (1,2,3,4,5,6 para Bimestre)        | 1 (= Ene-Feb)     |
| fStart             | Derivado: primer dia del periodo                    | '2026-01-01'      |
| fEnd               | Derivado: ultimo dia del periodo                    | '2026-02-28'      |
| docFondo           | Fondo seleccionado en tab Documentos                | 'NSGPEN01'        |

fStart y fEnd se calculan en:
```typescript
const { fStart, fEnd } = getDates(v40SelYear, v40SelCiclo, v40SelNum);
```

---

## 7. CUANDO SE EJECUTA EL MOTOR V40

El Motor V40 se ejecuta UNA SOLA VEZ por periodo. calcResult queda en estado.
Los botones EECC y Retenciones reusan calcResult sin recalcular.

Si el usuario va directamente a la pestana Documentos sin pasar por Auditoria:
calcResult = null -> los handlers llaman handleRunV40Calculation() automaticamente.

Cambiar v40SelYear / v40SelCiclo / v40SelNum resetea calcResult a null (useEffect linea 212).

---

## 8. COMMITS Y TAGS DE REFERENCIA

| Commit/Tag           | Descripcion                                                      |
|----------------------|------------------------------------------------------------------|
| ca31e2e              | FIX.TS6133.dead.code.numeroALetrasPeru                           |
| 08264a6              | ARCH.EECC.RET.V40.REACT.WINDOW.OPEN (nueva arquitectura base)    |
| 5cab047 = 99percent  | FIX.window.print.EECC.RET.igual.vecino (setTimeout print 500ms)  |

---

## 9. PENDIENTES CONOCIDOS (No actuar sin orden explicita del usuario)

1. TC_USD_PEN = 3.662 hardcodeado. Conectar a Supabase cuando este disponible.
2. Validar con datos reales que r.capitalizacion y r.devolucion_capital
   del Motor V40 muestran valores correctos (ej: Sra. Parra ~325,000 en rescates).
3. Si el DNI lookup falla por formato de nombre, mejorar algoritmo de matching.

---

## 10. BANDERAS ROJAS VIGENTES

| Bandera | Descripcion | Aplica a esta arquitectura |
|---------|-------------|---------------------------|
| 1 | Nginx devuelve index.html para .pdf | NO APLICA. No hay URLs .pdf en VPS. |
| 2 | 404 por archivos no sincronizados | NO APLICA. No hay archivos estaticos PDF. |
| 3 | Blob URLs y modales | VIGENTE. Prohibido. Usar window.open + document.write. |
| 4 | await antes de window.open | VIGENTE. window.open es sincrono si calcResult existe. |
| 5 | Creatividad no solicitada | VIGENTE. Copiar patron vecino exacto. Cero variaciones. |
