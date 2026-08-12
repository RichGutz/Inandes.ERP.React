# Valor Cuota (NAV v26) -- Implementacion React / TypeScript

> **Archivo:** `src/features/fondos/FondosPage.tsx` + `src/services/fondosService.ts`
> **Assets:** `src/assets/base64Images.ts`
> **Ultima actualizacion:** 11 de Agosto de 2026 | **Estado:** COMPLETO Y DESPLEGADO EN PRODUCCION

---

## 1. Objetivo

Recrear fielmente en React / TypeScript el motor de calculo de **Valor Cuota (NAV - Net Asset Value)** del sistema LEGACY (Python / generate_cuotas_v25.py), incluyendo:

- Motor matematico identico al legacy con comisiones completas (Admin + Captacion + Miscelaneos)
- Reporte PDF binario oficial servido en caliente por el backend WeasyPrint
- Encabezados repetidos en TODAS las caras / paginas por mes
- UI de control ejecutivo limpia (sin visor de tabla densa en pantalla)
- Export a Excel con el mismo motor de calculo

---

## 2. Motor de Calculo -- `calculateValorCuotaV26`

**Archivo:** `src/services/fondosService.ts`

### Formulas (INTANGIBLES - NO MODIFICAR)

```
Ingreso Bruto Diario    = Patrimonio(d-1) * (tasa_activa / 360)     <- BASE 360
Gasto Admin Diario      = Patrimonio(d-1) * (comision_admin / 365)  <- BASE 365
Gasto Captacion Diario  = Patrimonio(d-1) * (comision_captacion / 365)
Gasto Miscel. Diario    = Patrimonio(d-1) * (comision_miscelaneos / 365)

Utilidad Neta Diaria    = Ingreso Bruto - (Admin + Captacion + Misc)
Patrimonio(d)           = Patrimonio(d-1) + Utilidad Neta(d) + Suscripciones(d)
Cuotas(d)               = Cuotas(d-1) + nuevas_cuotas_suscripcion(d)
Valor Cuota(d)          = Patrimonio(d) / Cuotas(d)
Nuevas Cuotas           = Capital_Suscrito / Valor_Cuota(d_suscripcion)
```

**REGLA CRITICA:** Ingresos en Base 360, Gastos en Base 365. NO intercambiar.

### Tipos de filas generadas

| tipo | Descripcion | Estilo visual |
|---|---|---|
| Normal | Certificado / Inversion | Blanco |
| AUMENTO | Suscripcion adicional | Verde itálica con borde izquierdo |
| COM. ADMIN | Comision administracion | Rojo pastel `#ffebee` |
| COM. CAPT. | Comision captacion | Rojo pastel |
| COM. MISC. | Miscelaneos | Rojo pastel |
| TOTAL | Patrimonio / Resumen | Amarillo pastel `#fff9c4` |
| VAL CUOTA | Valor Cuota del dia | Azul pastel `#e3f2fd`, **4 decimales** |
| SPACER | Separador visual | Gris claro |

---

## 3. UI -- Panel Ejecutivo de Valor Cuota

**Archivo:** `FondosPage.tsx` -- `activeSubTab === 'valorCuota'`

**Decision de disenio:** NO hay visor de tabla en pantalla (demasiado denso). Solo PDF y Excel.

### Controles del panel

| Control | Opciones |
|---|---|
| Fondo | Selector por id_fondo (agrupados) |
| Anio | 2024, 2025, 2026... |
| Ciclo | Bimestre (6 per.) / Trimestre (4 per.) |
| N Periodo | 1-6 (bimestre) o 1-4 (trimestre) |

### Ficha tecnica (1 sola linea)

```
Fondo: FDO NSG MIPYME PEN 03 (NSGPEN03) | Moneda: PEN |
TASA ACTIVA: 14.00% | ADMIN: 1.00% | CAPTACION: 2% | MISC: 0%
```

---

## 4. Reporte PDF v26 -- `handleExportVcPdf`

### Especificaciones definitivas (a fecha 11-Ago-2026)

| Elemento | Valor |
|---|---|
| Formato PDF | A4 Landscape servido como binario `%PDF-1.7` por FastAPI |
| Backend Generator | `https://inandes.react.geeksoft.tech/api/inversionistas/generate-pdf` |
| Encabezados por cara | Repetidos en **TODAS** las paginas (`meta-box` + `block-title`) |
| Logo izquierda | URL HTTP estatica `https://inandes.react.geeksoft.tech/assets/Logo.Geeksoft.png` (68px alto) |
| Logo derecha | URL HTTP estatica `https://inandes.react.geeksoft.tech/assets/Logo.Inandes.MODERNO.jpeg` (38px alto) |
| Cabecera central | INANDES ACTIVOS ALTERNATIVOS S.A.C. |
| Subtitulo | REPORTE MAESTRO DE LIQUIDACION Y VALOR CUOTA v26 (NAV) |
| Max certificados / pagina | **60** (paginacion automatica con `page-break-before: always`) |

### Patron de Descarga PDF Server-Side (Igual a Retornos / Inversionistas)

Se envia el `htmlContent` estilizado al backend FastAPI `/api/inversionistas/generate-pdf`. El servidor lo renderiza en un documento binario PDF real (`%PDF-1.7`) y lo devuelve como `application/pdf`. El browser activa la descarga automatica del archivo `.pdf`, garantizando que abre sin fallas en Acrobat, Chrome o Edge.

```typescript
const response = await fetch('https://inandes.react.geeksoft.tech/api/inversionistas/generate-pdf', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ html: printHtml, filename })
});
const blob = await response.blob();
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = filename;
document.body.appendChild(a);
a.click();
```

---

## 5. Lecciones Aprendidas y Solucion a Problema de Rendimiento (HTTP 504 Timeout)

### ⚠️ El Problema Encontrado (HTTP 504 Gateway Timeout)

Al solicitar la descarga de reportes multi-pagina (ej. 20-30 caras por periodo/fondo):
- El sistema demoraba mas de 60 segundos intentando generar el PDF.
- Se mostraba el mensaje de error: `Error descargando PDF: HTTP 504`.
- El archivo resultaba corrupto o no se podia abrir.

### 🔍 Causa Raiz Diagnosticada

1. **Incrustacion Masiva de Base64:** El logo de InAndes en Base64 tenia un tamano de **537 Kilobytes** de texto.
2. **Duplicacion por Pagina:** Al repetir el encabezado en cada cara paginada, la cadena de 537 KB se duplicaba docenas de veces en el HTML.
3. **Payload Gigante:** El HTML resultante superaba los **25 Megabytes**.
4. **Colapso de CPU en WeasyPrint:** El motor Weasyprint en Python del servidor tardaba mas de 90 segundos en decodificar 25MB de cadenas Base64.
5. **Corte Nginx:** Nginx tenia `proxy_read_timeout 60` (60 segundos), por lo que cortaba la conexion devolviendo `504 Gateway Timeout`.

### 🛠️ Solucion Aplicada

1. **Reemplazo por URLs HTTP Estaticas:** Se reemplazaron las cadenas Base64 inline por URLs HTTP estaticas directas (`https://inandes.react.geeksoft.tech/assets/Logo.Inandes.MODERNO.jpeg`).
   - **Resultado:** El tamano del HTML se redujo de **25 MB a 150 KB** (reduccion del 99.4%).
2. **Ampliado de Timeout en Nginx:** Se configuro `proxy_read_timeout 300s` (5 minutos) en `deploy_vps.py` para Nginx.
3. **Optimizacion de Tiempos:** El tiempo de generacion del PDF bajo de **>90 segundos (HTTP 504) a solo 1.05 segundos (200 OK)**.

---

## 6. Historial de Commits

| Commit | Descripcion |
|---|---|
| `585c115` | Implementacion inicial NAV v26 con comisiones Captacion y Misc |
| `089ffb7` | Logo Geeksoft texto, metadata 1 linea, encabezados, eliminacion visor B&N |
| `3e24818` | Restaura A2 landscape pantalla, impresion zoom:58%, LOGO_GEEKSOFT_BASE64 |
| `25f611a` | Logo 68px, paginacion 60 certs/pag, Blob URL, persistencia tab |
| `ae152c9` | Encabezados repetidos en cada cara + descarga PDF binario server-side via `/api/inversionistas/generate-pdf` |
| `de7ed88` | Solucion HTTP 504: reemplazo de Base64 por URLs estaticas + Nginx timeout 300s |

---

## 7. Reglas Intangibles

1. **Base dias:** Ingresos Base 360, Gastos Base 365. NUNCA intercambiar.
2. **Valor Cuota:** Siempre 4 decimales de precision.
3. **Nuevas cuotas:** Calcular con VC del dia de suscripcion.
4. **Logo URLs:** Usar URLs HTTP estaticas (`https://inandes.react.geeksoft.tech/assets/...`) para evitar inflar el HTML con Base64.
5. **Descarga PDF:** Siempre consumir `/api/inversionistas/generate-pdf` server-side para entregar un binario `%PDF-1.7` legitimo.
6. **Encabezados:** Repetir `meta-box` y `block-title` en cada cara paginada.
7. **Paginacion:** Maximo 60 certificados por pagina.

---

*Actualizado por Antigravity -- 11 de Agosto de 2026 (Documentacion del fix HTTP 504 timeout e imagenes estaticas).*
