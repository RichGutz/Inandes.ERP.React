# Valor Cuota (NAV v26) -- Implementacion React / TypeScript

> **Archivo:** `src/features/fondos/FondosPage.tsx` + `src/services/fondosService.ts`
> **Assets:** `src/assets/base64Images.ts`
> **Ultima actualizacion:** 11 de Agosto de 2026 | **Estado:** METODO 1 IMPLEMENTADO (html2pdf.js Client-Side)

---

## 1. Objetivo

Recrear fielmente en React / TypeScript el motor de calculo de **Valor Cuota (NAV - Net Asset Value)** del sistema LEGACY (Python / generate_cuotas_v25.py), incluyendo:

- Motor matematico identico al legacy con comisiones completas (Admin + Captacion + Miscelaneos)
- Reporte PDF binario instantaneo impreso 100% en el cliente con `html2pdf.js`
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

---

## 4. Estrategia de Solucion de PDF: Metodos 1 y 2

### 🔬 Diagnostico de la Falla del Blob / Timeout HTTP 504

1. **Popup con `blob:about:blank`:** Al usar `window.open` con un Blob HTML local, Chrome abre la vista previa en 50ms pero al presionar "Guardar PDF", Windows arroja **Sharing Violation / Acceso denegado** o guarda un archivo `.html` corrupto no abrible en Acrobat.
2. **Generador Server-Side (WeasyPrint):** Al enviar HTML masivo al servidor Python, WeasyPrint tarda mucho tiempo procesando las tablas y produce cortes por timeout `HTTP 504`.

---

### 🟢 METODO 1: Generacion PDF Client-Side Instantanea (`html2pdf.js` / `jspdf`) [EJECUTADO]

- **Mecanismo:** El navegador convierte el HTML del reporte directamente en memoria en un archivo binario PDF legitimo (`%PDF-1.7`) usando la libreria client-side `html2pdf.js`.
- **Ventajas:**
  - **Velocidad:** Instantaneo en la maquina del cliente.
  - **Cero llamadas al servidor:** No satura la CPU del VPS ni genera HTTP 504.
  - **Descarga directa:** Genera una descarga limpia del archivo `.pdf` en la carpeta de Descargas del usuario.
  - **Cero Sharing Violation:** No usa URLs `blob:about:blank` defectuosas.

---

### 🔵 METODO 2: Servidor HTML con Ruta HTTPS Nativa (Fallback - Plan B)

- **Punto de Retorno:** Commit `d720d19` (Safe point de control).
- **Mecanismo:** El servidor FastAPI expone un endpoint `/api/reportes/view/{id}.html` que devuelve el HTML con una URL HTTPS legitima (`https://inandes.react.geeksoft.tech/...`).
- **Ventajas:**
  - Abre en una pestana independiente de Chrome ultra-rapida (50ms).
  - Al presionar `Ctrl + P` o "Guardar como PDF", Windows **NO lanza Sharing Violation** porque el archivo proviene de una URL HTTPS real y no de un blob local de memoria.

---

## 5. Historial de Commits

| Commit | Descripcion |
|---|---|
| `de7ed88` | Fix HTTP 504 base64 y timeout 300s Nginx |
| `d720d19` | `SAFE-POINT` -- Commit de control antes de Metodo 1 |
| `770dd4f` | Implementacion completa de **Metodo 1 (`html2pdf.js` client-side)** |

---

*Actualizado por Antigravity -- 11 de Agosto de 2026 (Metodo 1 desplegado y probado en produccion).*
