# Integración CAVALI Factrack (Registro y Conformidad de Facturas Negociables)

> **Entidad:** CAVALI ICLV (Institución de Compensación y Liquidación de Valores)  
> **Plataforma:** Factrack API (Registro Centralizado de Facturas Negociables)  
> **Marco Legal:** Ley N° 29623 (Ley de Facturas Negociables) y D.U. N° 013-2020  
> **Modalidad:** API REST / Web Services SOAP + Certificado Digital PKI  
> **Última Actualización:** Septiembre 2026

---

## 1. Resumen Ejecutivo y Propósito en Inandes ERP

En el negocio de **Factoring**, la seguridad jurídica de cada factura depende de su **Anotación en Cuenta en CAVALI**. 
El sistema Factrack de CAVALI otorga a la factura electrónica la calidad de **Título Valor con mérito ejecutivo** y gestiona el plazo de 8 días hábiles para la **Conformidad (Expresa o Presunta)** del Aceptante (Pagador).

Actualmente en Inandes ERP:
- En `AprobacionesTab.tsx` monitoreamos los badges visuales `Est. Cavali: ACEPTADA / PENDIENTE`.
- La integración automatizada con **Factrack API** elimina la carga manual de archivos XML/CSV al portal de CAVALI, permitiendo que Inandes registre facturas, monitoree conformidades y transfiera titularidades en milisegundos desde el ERP.

---

## 2. Catálogo de Servicios y APIs de CAVALI Factrack

```
  ┌───────────────────────────────────────────────────────────────────────────┐
  │                    SERVICIOS CAVALI FACTRACK                              │
  │                                                                           │
  │  1. REGISTRO & ANOTACIÓN EN CUENTA                                        │
  │     Envío del XML (Factura / Recibo por Honorarios) para generar el Título │
  │     Valor electrónico. Inicia el conteo de 8 días para conformidad.       │
  │                                                                           │
  │  2. CONSULTA DE ESTADO DE CONFORMIDAD                                     │
  │     Consulta en tiempo real del estado de la factura ante el Aceptante:    │
  │     • CONFORME EXPRESA   • CONFORME PRESUNTA (8 días)   • DISCONFORME     │
  │                                                                           │
  │  3. TRANSFERENCIA DE TITULARIDAD (DESEMBOLSO)                             │
  │     Anotación del traspaso de derechos de cobro del Cedente a Inandes     │
  │     (Legitimación activa para cobranza judicial o extrajudicial).         │
  │                                                                           │
  │  4. CONSULTA DE GRAVÁMENES Y MEDIDAS CAUTELARES                           │
  │     Verificación de que la factura no esté embargada ni cedida a otra     │
  │     empresa de factoring (prevención de doble cesión).                    │
  └───────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Matriz de Endpoints y Casos de Uso en Inandes ERP

| API / Operación Cavali | Tipo | Parámetros Clave | Salida / Resultado | Caso de Uso en Inandes ERP |
| :--- | :--- | :--- | :--- | :--- |
| **Registrar Factura Negociable** | Transaccional | • XML Factura Electrónica<br>• RUC Emisor / RUC Pagador<br>• Monto Neto y Fecha Vencimiento | • `ID_FACTURA_CAVALI`<br>• Código de Anotación en Cuenta | Ingesta masiva desde el módulo de Propuestas/Carga de Facturas. |
| **Consultar Estado de Conformidad** | Consulta | • `ID_FACTURA_CAVALI` o<br>• RUC Emisor + Serie/Número | • Estado: `PENDIENTE`, `CONFORME`, `RECHAZADA`<br>• Fecha límite de presunción | Actualización en tiempo real de los badges en `AprobacionesTab.tsx`. |
| **Registrar Adquisición (Transferencia)** | Transaccional | • `ID_FACTURA_CAVALI`<br>• Participante Adquirente (INANDES)<br>• Fecha y Monto Negociado | • Constancia de Titularidad Electrónica (CTE) | Al hacer clic en `[Aprobar y Desembolsar]` en el ERP. |
| **Bloqueo / Cancelación por Pago** | Transaccional | • `ID_FACTURA_CAVALI`<br>• Fecha y Medio de Pago | • Estado: `CANCELADA POR PAGO` | Al momento de conciliar la cobranza bancaria (BCP). |

---

## 4. Arquitectura de Seguridad y Conexión con CAVALI

```
  ┌─────────────────────────────────────────────────────────────┐
  │                    INANDES ERP SYSTEM                       │
  │                                                             │
  │  [ React Frontend ]  ──>  [ FastAPI Backend ]               │
  │  (AprobacionesTab /       (Worker de CAVALI /               │
  │   Desembolsos / Factoring) Supabase PostgreSQL)             │
  └──────────────────────────────┬──────────────────────────────┘
                                 │
                    mTLS + Certificado PKI Cavali
                    + Token de Autenticación
                                 │
                                 ▼
  ┌─────────────────────────────────────────────────────────────┐
  │                   CAVALI FACTRACK GATEWAY                   │
  │                                                             │
  │  • Anotación en Cuenta (Ley 29623)                          │
  │  • Gestión de Plazo de Conformidad (8 días hábiles)         │
  │  • Prevención de Doble Financiamiento / Gravámenes          │
  │  • Emisión de Constancia de Titularidad (CTE)               │
  └─────────────────────────────────────────────────────────────┘
```

### Mecanismo de Autenticación con CAVALI:
1. **Participante Autorizado:** Inandes debe contar con código de participante o empresa de factoring registrada en CAVALI.
2. **Certificado Digital Corporativo (PKI):** Firma digital X.509 para firmar cada mensaje XML/JSON enviado.
3. **API Keys / Token de Sesión:** Credenciales de servicio para consumir los endpoints REST/SOAP de Factrack.

---

## 5. Plan de Implementación por Etapas

```
  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
  │   ETAPA 0    │ ──> │   ETAPA 1    │ ──> │   ETAPA 2    │ ──> │   ETAPA 3    │
  │ Afiliación   │     │ Conector     │     │ Sincroniza   │     │ Transferenc. │
  │ & Contrato   │     │ FastAPI Cav. │     │ Conformidad  │     │ Titularidad  │
  └──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
```

### ETAPA 0: Afiliación y Acreditación como Participante CAVALI
- Solicitud formal de acceso a **Factrack API** como Empresa de Factoring.
- Adquisición / configuración del **Certificado Digital de Firma** homologado por CAVALI.
- Acceso a ambiente de **Homologación / Certificación Cavali**.

### ETAPA 1: Conector FastAPI y Manejo de XMLs
- Módulo en Python: `src/integrations/cavali/` para serialización de facturas UBL 2.1 y firma digital.
- Invocación al servicio de registro en segundo plano al subir un lote de facturas.

### ETAPA 2: Polling & Webhooks de Estado de Conformidad
- Sincronizador automático (CRON cada 30 minutos) para consultar el estado de conformidad de todas las facturas en estado `PENDIENTE`.
- Reflejo automático en `AprobacionesTab.tsx`:
  - Cuando el Pagador da conformidad expresa $\rightarrow$ Badge cambia inmediatamente a `ACEPTADA` (Verde).
  - Si pasan los 8 días hábiles $\rightarrow$ Pasa a `CONFORME PRESUNTA` (Verde) y habilita la aprobación sin requerir "Aprobación Forzada".

### ETAPA 3: Transferencia Automática de Titularidad en Desembolso
- Al aprobar un lote en `AprobacionesTab.tsx` y ejecutar el desembolso bancario:
  - El backend invoca automáticamente a CAVALI para registrar a **Inandes** como legítimo tenedor del título valor.
  - Almacenamiento del PDF de la **Constancia de Titularidad Electrónica (CTE)** en Supabase/Google Drive para respaldo legal.

---

## 6. Sinergia entre Integraciones: CAVALI + BCP + ERP

La combinación de **CAVALI Factrack** y **BCP Closed Banking** crea un flujo de factoring 100% automatizado y de riesgo cero:

1. **Recepción:** El cliente sube sus facturas electrónicas al ERP.
2. **Registro Legal (CAVALI):** El ERP anota la factura en CAVALI y empieza el reloj de 8 días de conformidad.
3. **Validación Bancaria (BCP):** El ERP valida la cuenta bancaria del emisor vía API BCP.
4. **Aprobación & Desembolso:** Con la conformidad de CAVALI confirmada, el operador aprueba el lote y el ERP dispara la **Transferencia Directa BCP**.
5. **Titularidad:** CAVALI emite la Constancia de Titularidad a favor de Inandes.
6. **Cobranza (BCP + CAVALI):** La API de Movimientos BCP detecta el pago del deudor, el ERP concilia la cobranza y notifica a CAVALI la cancelación del título.
