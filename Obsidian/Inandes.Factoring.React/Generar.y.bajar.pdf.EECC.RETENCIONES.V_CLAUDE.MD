# Arquitectura ACORDADA: Generacion de PDFs EECC y Retenciones
# Estado: ACORDADA - Pendiente de implementacion
# Fecha: 2026-08-08

---

## ARQUITECTURA FINAL ACORDADA

```
[Usuario hace clic en boton EECC o Retenciones en React]
        |
        | window.open(URL_DEL_ENDPOINT, '_blank')   <- SINCRONO, SIN await
        v
[FastAPI en https://api-factoring.geeksoft.tech]
  Endpoint recibe: id_fondo + fecha_fin (periodo cerrado)
        |
        v
[Supabase: crm_certificados_eventos]
  Filtra por: id_fondo + fecha_periodo_fin
  Lee datos FIRMES del periodo cerrado (NO recalcula)
        |
        v
[WeasyPrint en el VPS]
  Renderiza plantilla HTML con los datos leidos
  Genera binario PDF
        |
        v
[FastAPI devuelve StreamingResponse]
  Content-Type: application/pdf
  Content-Disposition: inline; filename="EECC_NSGPEN01_2026-02-28.pdf"
        |
        v
[Chrome recibe PDF binario]
  Abre visor nativo: fondo negro + documento centrado + scroll + boton de descarga
  IDENTICO al visor del vecino (RETORNOS Y RENDIMIENTOS periodo 2026-02-28)
```

---

## PRINCIPIO FUNDAMENTAL INAMOVIBLE

> La fuente de datos es EXCLUSIVAMENTE crm_certificados_eventos.
> PROHIBIDO recalcular con el Motor V40 o V32 para generar documentos oficiales.
> Los PDFs solo se generan para periodos CERRADOS (datos ya firmados en la tabla).
> El PDF es generado en el VPS por FastAPI. NO localmente en la maquina del usuario.

---

## POR QUE ESTA ARQUITECTURA Y NO OTRA

### Por que NO document.write + print():
- Genera una pagina HTML blanca, NO un PDF binario.
- Chrome no abre su visor nativo (fondo negro, scroll, boton descarga).
- El usuario ve un dialogo de impresion, no un visor de PDF.

### Por que NO Python local + SFTP al VPS:
- Depende de la maquina del desarrollador.
- Si no se corre el script, el PDF en el VPS queda desactualizado.
- Proceso manual propenso a errores.

### Por que SI FastAPI endpoint:
- El PDF se genera ON DEMAND en el momento que el usuario hace clic.
- Los datos siempre son frescos de crm_certificados_eventos.
- Chrome recibe Content-Type: application/pdf y abre el visor nativo.
- Es identico a la experiencia del vecino.
- Sin dependencias de la maquina local del desarrollador.

### Por que NO CORS es un problema:
- window.open(url, '_blank') abre una NUEVA PESTANA del navegador.
- Es una navegacion directa, NO un fetch/XHR desde React.
- El navegador simplemente va a la URL. CORS no aplica a navegaciones directas.
- No se necesita configurar nada de CORS para que esto funcione.

---

## ENDPOINTS A CREAR EN FastAPI

### Endpoint 1: EECC
```
GET /inversionistas/eecc/{id_fondo}/{fecha_fin}
Ejemplo: GET /inversionistas/eecc/NSGPEN01/2026-02-28
         GET /inversionistas/eecc/TODOS/2026-02-28

Respuesta: StreamingResponse(
    content=pdf_bytes,
    media_type='application/pdf',
    headers={'Content-Disposition': 'inline; filename="EECC_{id_fondo}_{fecha_fin}.pdf"'}
)
```

### Endpoint 2: Retenciones
```
GET /inversionistas/retenciones/{id_fondo}/{fecha_fin}
Ejemplo: GET /inversionistas/retenciones/NSGPEN01/2026-02-28
         GET /inversionistas/retenciones/TODOS/2026-02-28

Respuesta: StreamingResponse(
    content=pdf_bytes,
    media_type='application/pdf',
    headers={'Content-Disposition': 'inline; filename="RETENCIONES_{id_fondo}_{fecha_fin}.pdf"'}
)
```

---

## COMO QUEDA EL BOTON EN REACT (codigo exacto)

ARCHIVO: C:\Users\rguti\Inandes.ERP.React\src\features\inversionistas\InversionistasPage.tsx

### BOTON EECC (reemplaza onClick={handleExportEECC}):
```typescript
onClick={() => {
  const fondo = docFondo || 'TODOS';
  window.open(`https://api-factoring.geeksoft.tech/inversionistas/eecc/${fondo}/${fEnd}`, '_blank');
}}
```

### BOTON RETENCIONES (reemplaza onClick={handleExportRetenciones}):
```typescript
onClick={() => {
  const fondo = docFondo || 'TODOS';
  window.open(`https://api-factoring.geeksoft.tech/inversionistas/retenciones/${fondo}/${fEnd}`, '_blank');
}}
```

- SIN calcResult. SIN Motor V40. SIN await. SIN logica intermedia.
- El onClick es una arrow function sincrona de UNA SOLA LINEA.
- PROHIBIDO agregar loading states, validaciones o llamadas async en estos onClick.

### QUE SE ELIMINA DE InversionistasPage.tsx:
Las siguientes funciones async DEBEN SER ELIMINADAS COMPLETAMENTE del archivo:
- handleExportEECC (lineas ~752-854)
- handleExportRetenciones (lineas ~859-1023)

Son reemplazadas por el onClick directo descrito arriba.
No se migra logica de esas funciones. Se borran. La logica vive en el backend.

---

## LOGICA DEL ENDPOINT FASTAPI (descripcion funcional)

### Para EECC:
1. Recibir id_fondo y fecha_fin como parametros de ruta.
2. Consultar crm_certificados_eventos en Supabase:
   - Filtrar por fecha_periodo_fin = fecha_fin
   - Si id_fondo != 'TODOS': filtrar tambien por id_fondo (campo: ver tabla de campos abajo)
3. Para cada registro (cada certificado), extraer los campos de la tabla de campos abajo.
4. Renderizar la plantilla Jinja2: estado_cuenta_inversionista_v2.html
5. Generar PDF con WeasyPrint (from weasyprint import HTML; HTML(string=html_str).write_pdf())
6. Devolver StreamingResponse(io.BytesIO(pdf_bytes), media_type='application/pdf')

### Para Retenciones:
1. Misma consulta a crm_certificados_eventos.
2. Filtrar solo registros con monto_impuesto > 0.
3. Para cada registro, leer tambien datos del inversionista:
   JOIN crm_certificados_eventos -> (campo que une con inversionista, confirmar nombre)
   Para obtener: documento_identidad (DNI), direccion_fiscal (domicilio)
4. Calcular IR en PEN:
   - Fondos PEN: ir_pen = monto_impuesto (ya en PEN)
   - Fondos USD: ir_pen = monto_impuesto * tipo_cambio (leer campo de la tabla)
5. Calcular monto_ir_pen_letras con funcion numero_a_letras() existente en el backend.
6. Renderizar plantilla: retencion_renta_v2.html
7. Generar PDF con WeasyPrint.
8. Devolver StreamingResponse(io.BytesIO(pdf_bytes), media_type='application/pdf')

---

## ARCHIVOS A CREAR/MODIFICAR

### En el backend (C:\Users\rguti\mini_erp_v2_antigravity):

| Archivo | Accion | Descripcion |
|---------|--------|-------------|
| src/api/routers/inversionistas.py | CREAR NUEVO | Contiene los 2 endpoints EECC y Retenciones |
| src/api/main.py | MODIFICAR | Agregar: from routers import inversionistas; app.include_router(inversionistas.router) |
| src/templates/estado_cuenta_inversionista_v2.html | COPIAR DESDE REACT | La plantilla ya existe en el proyecto React |
| src/templates/retencion_renta_v2.html | COPIAR DESDE REACT | La plantilla ya existe en el proyecto React |

ORIGEN DE LAS PLANTILLAS (copiar de aqui):
- C:\Users\rguti\Inandes.ERP.React\src\templates\estado_cuenta_inversionista_v2.html
- C:\Users\rguti\Inandes.ERP.React\src\templates\retencion_renta_v2.html

### En el frontend (C:\Users\rguti\Inandes.ERP.React):

| Archivo | Accion | Descripcion |
|---------|--------|-------------|
| src/features/inversionistas/InversionistasPage.tsx | MODIFICAR | Eliminar handleExportEECC y handleExportRetenciones. Cambiar onClick de ambos botones. |

---

## DESPLIEGUE DEL BACKEND

El backend en mini_erp_v2_antigravity se despliega con:
```
git push origin main
```
(Segun la regla del usuario: Despliegue de ERP -> git push origin main)

El frontend React se despliega con:
```
python deploy_vps.py
```
(Desde C:\Users\rguti\Inandes.ERP.React)

ORDEN DE DESPLIEGUE OBLIGATORIO:
1. PRIMERO desplegar el backend (para que el endpoint exista)
2. LUEGO desplegar el frontend (para que el boton apunte a un endpoint real)

---

## CAMPOS EXACTOS A LEER DE crm_certificados_eventos

ADVERTENCIA: Los nombres de los campos son los que estan en Supabase. Si algun campo
no existe con ese nombre exacto, el agente DEBE PARAR y preguntar al usuario.
PROHIBIDO asumir nombres alternativos.

| Campo en crm_certificados_eventos | Uso en el documento |
|-----------------------------------|---------------------|
| id_certificado | Numero de certificado |
| id_fondo | Filtro por fondo y titulo del documento |
| fecha_periodo_inicio | Fecha inicio del periodo en el documento |
| fecha_periodo_fin | Fecha fin del periodo, usado como filtro principal |
| monto_bruto | Ganancia bruta obtenida |
| monto_impuesto | IR retenido (en moneda del fondo) |
| monto_deducciones | Deducciones |
| monto_neto | Ganancia disponible al inversionista |
| monto_capitalizacion | Ganancias capitalizadas para adquirir nuevas cuotas |
| monto_rescate | Rescates |
| monto_reparto | Monto transferido a cuenta bancaria |
| capital_inicial | Monto inicial invertido |
| capital_final | Monto de la inversion al fecha_fin |
| valor_cuota | Valor cuota al fecha_fin |
| moneda | 'PEN' o 'USD' |
| (campo para nombre inversionista) | VERIFICAR nombre exacto |
| (campo para tipo de cambio USD)   | VERIFICAR nombre exacto |

---

## REGLAS DE MONEDA (INAMOVIBLES)

1. El parrafo legal de Retenciones SIEMPRE dice "la suma de PEN [monto] ([letras] soles)".
2. El IR se expresa SIEMPRE en PEN, incluso para fondos USD (se convierte con tipo_cambio).
3. NUNCA dice "dolares de los Estados Unidos de America" en el parrafo legal.
4. La tabla resumen de Retenciones muestra la BASE en la moneda del fondo (USD o PEN)
   pero el MONTO RETENIDO siempre en PEN.

---

## 4 PASOS OBLIGATORIOS ANTES DE ESCRIBIR UNA SOLA LINEA DE CODIGO

1. Verificar columnas reales de crm_certificados_eventos:
   Ejecutar en Supabase SQL Editor:
   SELECT column_name, data_type FROM information_schema.columns
   WHERE table_name = 'crm_certificados_eventos' ORDER BY ordinal_position;

2. Verificar WeasyPrint en el VPS:
   ssh root@91.108.125.253 'python3 -c "import weasyprint; print(weasyprint.__version__)"'

3. Verificar que el endpoint no existe ya en:
   https://api-factoring.geeksoft.tech/docs

4. Verificar que Jinja2 esta en requirements.txt del backend:
   Leer C:\Users\rguti\mini_erp_v2_antigravity\src\api\requirements.txt

---

## LO QUE DEFINITIVAMENTE NO SE TOCA

- pdf_parser.py (Regla global)
- frontend_app.py (Regla global)
- Cualquier archivo del proyecto React que no sea InversionistasPage.tsx
- La estructura del motor V40 (financialCalculator.ts) - no tiene rol aqui
- Los scripts Python _run_eecc_v33.py y _run_retenciones_v33.py - no se modifican ni eliminan
