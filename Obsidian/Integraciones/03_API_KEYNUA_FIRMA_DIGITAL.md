# Integración KEYNUA API (Firma Digital, Letras de Cambio & Contratos Inversionistas)

> **Proveedor:** KEYNUA (Plataforma de Firma Electrónica, Biométrica y Video-Firma)  
> **Referencia:** `https://www.keynua.com/features/`  
> **Marco Legal:** Ley N° 27269 (Ley de Firmas y Certificados Digitales del Perú), D.S. 052-2008-PCM y Acreditación Indecopi (TSF / Sellado de Tiempo)  
> **Modalidad:** API REST / Webhooks JSON / SDK Web & Mobile  
> **Última Actualización:** Septiembre 2026

---

## 1. Resumen Ejecutivo y Propósito en Inandes ERP

La integración de **Keynua API** resuelve dos cuellos de botella operativos y legales críticos en Inandes:

1. **Factoring con Recurso (Firma de Letras de Cambio y Pagarés):**
   - Para que una operación de factoring sea con recurso, el Emisor (Cedente) y sus Avales deben firmar una **Letra de Cambio o Pagaré Electrónico** con plena validez ejecutiva antes del desembolso.
   - En `AprobacionesTab.tsx` existe el badge visual **`Est. Letra: FIRMADA / PENDIENTE`**. Con Keynua, el estado de la letra se actualiza en tiempo real vía Webhook tan pronto el cliente firma desde su smartphone.

2. **CRM Inversionistas (Firma de Contratos y Adendas de Capital):**
   - Firma remota de Contratos de Inversión, Certificados de Participación y Adendas de Aumento/Rolleo de Capital con video-verificación de identidad y sellado de tiempo Indecopi.

---

## 2. Los Dos Casos de Negocio en Inandes ERP

```
  ┌────────────────────────────────────────────────────────────────────────────┐
  │                 CASO A: FACTORING CON RECURSO (LETRAS/PAGARÉS)            │
  │                                                                            │
  │  1. Generación de Letra/Pagaré PDF en FastAPI con datos del lote.          │
  │  2. Envío a Keynua API -> Notificación WhatsApp/Email al Cedente/Aval.    │
  │  3. Firma Biométrica / Video-firma con DNI y reconocimiento facial.        │
  │  4. Webhook Keynua -> Inandes ERP actualiza badge a "Est. Letra: FIRMADA". │
  │  5. Anotación de la Letra Electrónica vinculada en CAVALI.                 │
  └────────────────────────────────────────────────────────────────────────────┘

  ┌────────────────────────────────────────────────────────────────────────────┐
  │                 CASO B: CRM INVERSIONISTAS (CONTRATOS & ADENDAS)           │
  │                                                                            │
  │  1. Alta de Inversionista o Creación de Contrato en el CRM.                │
  │  2. Inyección automática del Contrato PDF a Keynua API.                    │
  │  3. Firma electrónica del Inversionista desde su celular en 60 segundos.   │
  │  4. Retorno del PDF firmado con Acta de Evidencias (IP, GPS, Timestamp).   │
  │  5. Almacenamiento seguro en el expediente digital del Inversionista.      │
  └────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Catálogo de Endpoints de KEYNUA REST API

| Endpoint / Recurso | Método | Parámetros Clave | Salida / Resultado | Uso en Inandes ERP |
| :--- | :---: | :--- | :--- | :--- |
| `/v1/sign_requests` | `POST` | • `document_url` o PDF Base64<br>• `signers`: Lista de firmantes (Nombre, Email, Teléfono, DNI)<br>• `signature_type`: `video`, `otp_sms`, `biometric`<br>• `webhook_url` | • `sign_request_id`<br>• `sign_url` (Link directo de firma) | Disparo de solicitud de firma de Letra o Contrato al momento de crear la propuesta. |
| `/v1/sign_requests/{id}` | `GET` | • `sign_request_id` | • Estado: `pending`, `viewed`, `signed`, `rejected`<br>• Detalle de cada firmante | Consulta de estatus bajo demanda. |
| `/v1/sign_requests/{id}/document` | `GET` | • `sign_request_id` | • Archivo binario PDF con firmas incrustadas y certificado digital | Descarga del documento final con valor probatorio pleno. |
| `/v1/sign_requests/{id}/audit_trail` | `GET` | • `sign_request_id` | • Hoja de evidencias legales (Timestamp, IP, Hash SHA-256, Video de aceptación) | Archivo de auditoría forense para sustento legal ante juzgados o Cavali. |

---

## 4. Arquitectura del Flujo y Webhooks en Tiempo Real

```
  [ Inandes ERP Frontend ]
             │ (Crea Propuesta / Contrato)
             ▼
  [ FastAPI Backend ] ────────── POST /sign_requests ─────────> [ KEYNUA API ]
             ▲                                                         │
             │                                              WhatsApp / SMS con Link
             │                                                         │
             │                                                         ▼
             │                                               [ Firmante / Cliente ]
             │                                               (Firma con Video/DNI)
             │                                                         │
             │                                                         ▼
             │ ◄────── Webhook POST (event: "signed") ─────── [ KEYNUA CLOUD ]
             │
     Actualiza BD Supabase:
     • 'letra_firmada' = true
     • Descarga PDF Firmado
     • AprobacionesTab: Badge "Est. Letra: FIRMADA" (Verde)
```

---

## 5. Plan de Implementación por Etapas

```
  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
  │   ETAPA 0    │ ──> │   ETAPA 1    │ ──> │   ETAPA 2    │ ──> │   ETAPA 3    │
  │ Cuenta & API │     │ Webhooks en  │     │ Factoring:   │     │ CRM Invers.: │
  │ Keys Keynua  │     │ FastAPI      │     │ Letras/Recur │     │ Contratos    │
  └──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
```

### ETAPA 0: Creación de Cuenta y Obtención de Credenciales Keynua
- Apertura de cuenta corporativa en Keynua y obtención de `API_KEY` y `SECRET` para ambientes Sandbox y Producción.
- Configuración de plantillas de notificación personalizadas con la marca e identidad de **Inandes**.

### ETAPA 1: Microservicio Keynua & Receptor de Webhooks en FastAPI
- Desarrollo del módulo Python `src/integrations/keynua/keynua_client.py`.
- Endpoint público seguro en FastAPI: `POST /api/webhooks/keynua`:
  - Validación de la firma del webhook para evitar spoofing.
  - Al recibir evento `signed`, actualiza el estado en Supabase y dispara evento en tiempo real vía WebSocket / Supabase Realtime a la UI de React.

### ETAPA 2: Módulo Factoring (Letras de Cambio y Pagarés)
- Conexión con el generador de Letras de Cambio del backend.
- Envío automático de la letra a los firmantes al pasar la propuesta a estado `EN_EVALUACION`.
- Reflejo automático en `AprobacionesTab.tsx`:
  - Si la letra está firmada $\rightarrow$ Badge **`Est. Letra: FIRMADA`** (Verde).
  - Si no está firmada $\rightarrow$ Badge **`Est. Letra: PENDIENTE`** (Rojo) y alerta al aprobador.

### ETAPA 3: Módulo CRM Inversionistas
- Botón **`[Enviar a Firma Digital]`** en la ficha del Inversionista / Contrato.
- Seguimiento visual del progreso (ej. "Firmado 1 de 2 apoderados").
- Descarga y visualización directa del PDF firmado con sellado de tiempo en el expediente del inversionista.

---

## 6. Marco Legal y Validez Probatoria en Perú

- **Mérito Ejecutivo:** La firma electrónica con sellado de tiempo de una Entidad de Certificación Acreditada por Indecopi (como Keynua) cumple con el Artículo 141-A del Código Civil y la Ley 27269.
- **Trazabilidad:** El *Audit Trail* de Keynua registra:
  - Video del firmante declarando su voluntad o selfie biométrica.
  - Validación de DNI ante RENIEC.
  - Geolocalización IP y estampilla de tiempo inmutable.
- Permite la vinculación legal perfecta con la anotación de la letra en **CAVALI** para cobranza judicial expedita.
