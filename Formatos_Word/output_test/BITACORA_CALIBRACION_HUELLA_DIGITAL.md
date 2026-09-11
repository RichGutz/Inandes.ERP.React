# Bitacora de Calibracion y Paridad de Huella Digital Forense

Esta bitacora documenta el bucle de calibracion pixel-perfect y la comparacion estructural entre los documentos de referencia Word del usuario y los PDFs generados en local.

## 1. Archivos Comparados

| Tipo de Documento | Archivo Original de Referencia (User) | Archivo Generado (Local) |
| :--- | :--- | :--- |
| **Estado de Cuenta (EECC)** | `Formatos_Word/ESTADO_DE_CUENTA_EECC.RGL.RGP.pdf` | `Formatos_Word/output_test/ESTADO_DE_CUENTA_GALLO_20260831.pdf` |
| **Certificado de Retencion** | `Formatos_Word/CERTIFICADO_DE_RETENCION_IR.RGL.RGP.pdf` | `Formatos_Word/output_test/RETENCION_IR_GALLO_20260831.pdf` |

## 2. Scripts y Herramientas del Bucle de Calibracion

1. `scripts/inspect_exact_pdf_fonts.py`: Extraccion de familia tipografica y tamanos en puntos.
2. `scripts/inspect_exact_geometry.py`: Extraccion de coordenadas (x0, top, width, height), imagenes y vectores (lineas divisorias y rectangulos).
3. `scripts/inspect_exact_colors.py`: Extraccion de la paleta RGB exacta de textos y fondos.
4. `scripts/generate_eecc_retencion_gallo_test.py`: Motor de renderizado y generacion Jinja2 + WeasyPrint.
5. `scripts/loop_calibration_fingerprint.py`: Validador automatizado de convergencia de huella digital.

## 3. Matriz de Paridad Estructural y Forense

### A. Estado de Cuenta (EECC)
- **Formato de Pagina:** Letter Portrait (612.0 x 792.0 pt) - Identico.
- **Numero de Paginas:** 1 pagina exacta.
- **Tipografia:** `Consolas` y `Consolas-Bold` (14pt titulos y nombre, 12pt cuerpo y totales, 10pt/9pt pie de pagina).
- **Rayita Divisoria sobre Footer:** Presente (`border-top: 0.75pt solid black`).
- **Fondo del Recuadro de Totales:** `#f8fafc` (Slate 50) con borde negro de 1.5pt.
- **Color de Pie de Pagina:** Azul vibrante `#3333ff` (RGB 51, 51, 255) con la nueva direccion de San Isidro.

### B. Certificado de Retencion (2da Categoria)
- **Formato de Pagina:** Letter Portrait (612.0 x 792.0 pt) - Identico.
- **Numero de Paginas:** 1 pagina exacta.
- **Tipografia:** `Consolas` y `Consolas-Bold` (14pt titulos, 11pt parrafos y clausulas, 9pt tabla, 10pt firma y pie de pagina).
- **Tabla de 6 Columnas:** Cabecera azul oscura `#334155` (Slate 700) con texto blanco y celdas bordeadas en `#cbd5e1`.
- **Firma Digital:** Centrada con cargo y nombre en `Consolas-Bold`.
- **Color de Pie de Pagina:** Azul vibrante `#3333ff` con la nueva direccion de San Isidro.

## 4. Estado de Convergencia: 100% OK
