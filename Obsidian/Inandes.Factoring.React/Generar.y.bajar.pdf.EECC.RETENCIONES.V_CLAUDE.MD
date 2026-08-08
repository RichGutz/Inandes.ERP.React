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

> La fuente de datos es EXCLUSIVAMENTE `crm_certificados_eventos`.
> PROHIBIDO recalcular con el Motor V40 o V32 para generar documentos oficiales.
> Los PDFs solo se generan para periodos CERRADOS (datos ya firmados en la tabla).
> El PDF es generado en el VPS por FastAPI — NO localmente en la maquina del usuario.

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

## COMO REACCIONA EL BOTON EN REACT

```typescript
// EECC — sincrono, sin await, sin logica intermedia
onClick={() => {
  const fondo = docFondo || 'TODOS';
  window.open(`https://api-factoring.geeksoft.tech/inversionistas/eecc/${fondo}/${fEnd}`, '_blank');
}}

// Retenciones — identico patron
onClick={() => {
  const fondo = docFondo || 'TODOS';
  window.open(`https://api-factoring.geeksoft.tech/inversionistas/retenciones/${fondo}/${fEnd}`, '_blank');
}}
```

- SIN calcResult, SIN Motor V40, SIN await antes del window.open.
- El boton es 100% sincrono. No hay User Gesture Context que perder.
- Chrome abre el PDF del endpoint exactamente como abre el PDF del vecino.

---

## LOGICA DEL ENDPOINT FASTAPI (descripcion funcional)

### Para EECC:
1. Recibir id_fondo y fecha_fin como parametros de ruta.
2. Consultar crm_certificados_eventos en Supabase:
   - Filtrar por fecha_periodo_fin = fecha_fin
   - Si id_fondo != 'TODOS': filtrar tambien por id_fondo
3. Para cada registro (cada certificado):
   - Leer: monto_bruto, monto_impuesto, monto_deducciones, monto_neto,
           monto_capitalizacion, monto_rescate, monto_reparto,
           capital_inicial, capital_final, valor_cuota, numero_cuotas,
           fecha_periodo_inicio, fecha_periodo_fin, moneda
4. Renderizar la plantilla HTML: src/templates/estado_cuenta_inversionista_v2.html
5. Generar PDF con WeasyPrint.
6. Devolver StreamingResponse con Content-Type: application/pdf.

### Para Retenciones:
1. Misma consulta a crm_certificados_eventos.
2. Filtrar solo registros con monto_impuesto > 0.
3. Para cada registro, leer tambien datos del inversionista (DNI, domicilio)
   desde crm_inversionistas (JOIN por id_certificado -> crm_contratos -> id_inversionista).
4. Calcular IR en PEN:
   - Fondos PEN: ir_pen = monto_impuesto
   - Fondos USD: ir_pen = monto_impuesto * tipo_cambio (leer de crm_certificados_eventos o crm_fondos)
5. Renderizar plantilla: src/templates/retencion_renta_v2.html
6. Generar PDF con WeasyPrint.
7. Devolver StreamingResponse con Content-Type: application/pdf.

---

## ARCHIVOS A CREAR/MODIFICAR

| Archivo | Accion | Descripcion |
|---------|--------|-------------|
| mini_erp_v2_antigravity/src/api/routers/inversionistas.py | CREAR | Endpoints EECC y Retenciones |
| mini_erp_v2_antigravity/src/api/main.py | MODIFICAR | Incluir el nuevo router |
| InversionistasPage.tsx (React) | MODIFICAR | Reemplazar handleExportEECC y handleExportRetenciones con window.open al endpoint |

Las plantillas HTML ya existen en:
- src/templates/estado_cuenta_inversionista_v2.html
- src/templates/retencion_renta_v2.html

---

## CAMPOS EXACTOS A LEER DE crm_certificados_eventos

Los siguientes campos deben existir en la tabla. Si alguno no existe,
el agente DEBE preguntar al usuario antes de asumir un nombre alternativo.

| Campo requerido en crm_certificados_eventos | Uso en el documento |
|---------------------------------------------|---------------------|
| id_certificado | Numero de certificado |
| id_fondo | Filtro y titulo del fondo |
| fecha_periodo_inicio | Inicio del periodo en el documento |
| fecha_periodo_fin | Fin del periodo, usado como filtro |
| monto_bruto | Ganancia bruta obtenida |
| monto_impuesto | IR retenido (en moneda del fondo) |
| monto_deducciones | Deducciones |
| monto_neto | Ganancia disponible al inversionista |
| monto_capitalizacion | Ganancias capitalizadas |
| monto_rescate | Rescates |
| monto_reparto | Monto transferido a cuenta bancaria |
| capital_inicial | Monto inicial invertido |
| capital_final | Monto de la inversion al fecha_fin |
| valor_cuota | Valor cuota al fecha_fin |
| moneda | 'PEN' o 'USD' |

---

## PENDIENTE ANTES DE IMPLEMENTAR

El agente que implemente esto DEBE PRIMERO:
1. Verificar que los campos listados existen en crm_certificados_eventos
   (ejecutar: SELECT column_name FROM information_schema.columns WHERE table_name = 'crm_certificados_eventos')
2. Verificar que WeasyPrint esta instalado en el VPS del backend
   (ejecutar en VPS: python -c "import weasyprint; print('OK')")
3. Verificar que el endpoint no existe ya en https://api-factoring.geeksoft.tech/docs
4. Confirmar con el usuario el nombre del campo tipo_cambio si es USD

NO IMPLEMENTAR sin completar estos 4 pasos de verificacion.
