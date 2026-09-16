# Integración API BCP Closed Banking (Host to Host - APOB / TCDE)

> **Documento Base:** `Infografía API's APOB - TCDE.pdf`  
> **Banco:** Banco de Crédito del Perú (BCP)  
> **Modalidad:** Closed Banking / Host-to-Host (APIs REST / mTLS + VPN)  
> **Última Actualización:** Septiembre 2026

---

## 1. Resumen Ejecutivo y Propósito en Inandes ERP

Actualmente, las operaciones de pago a inversionistas, asesores y desembolsos de factoring se procesan mediante la generación de archivos planos `.txt` con formato canónico de Telecrédito BCP (`bcpTelecreditoService.ts`), los cuales un operador descarga y sube manualmente a la web de Telecrédito.

La integración **API Closed Banking BCP (APOB / TCDE)** permite conectar directamente el backend FastAPI / Supabase de Inandes con el core transaccional del BCP para:
1. **Validación Previa en Línea:** Validar titularidad (RUC/DNI vs N° de cuenta) y disponibilidad de cuenta antes de emitir cualquier orden de pago.
2. **Transferencias en Tiempo Real 24/7:** Ejecutar transferencias BCP inmediatas con confirmación vía `Payment Domestic ID` (S/ 1.50 por transacción).
3. **Conciliación Automatizada de Cobranzas:** Consultar movimientos bancarios históricos y del día en formato JSON (S/ 0.60 por página) para conciliar pagos de deudores/aceptantes sin intervención manual.
4. **Obtención Automática de CCI:** Resolver el CCI a partir del número de cuenta BCP (S/ 0.50 por consulta).

---

## 2. Cómo se Realizan las Consultas y la Autenticación con BCP

A diferencia de una API pública común (que solo usa usuario/contraseña o una API Key sencilla), las **APIs bancarias Host-to-Host** del BCP utilizan un esquema de **Seguridad en 4 Capas** de grado financiero:

```
  ┌──────────────────────────────────────────────────────────────────────────┐
  │                      CAPAS DE SEGURIDAD BCP                             │
  │                                                                          │
  │  1. CAPA DE RED (IP Whitelist / VPN)                                     │
  │     Solo se aceptan peticiones desde la IP pública fija de nuestro VPS   │
  │     (Contabo USA) o a través de un túnel VPN IPSec / OpenVPN.            │
  │                                                                          │
  │  2. CAPA DE TRANSPORTE (Mutual TLS - mTLS)                               │
  │     Autenticación bidireccional mediante Certificado Digital X.509       │
  │     (client.crt y client.key) emitido o validado por BCP.                │
  │                                                                          │
  │  3. CAPA DE APLICACIÓN (OAuth 2.0 Client Credentials)                    │
  │     Se intercambia `Client ID` + `Client Secret` por un JWT Token        │
  │     de acceso con vigencia limitada (Bearer Token).                      │
  │                                                                          │
  │  4. CAPA TRANSACCIONAL (Idempotencia y Firma)                            │
  │     Headers de trazabilidad: `X-Correlation-Id`, `X-Timestamp`,          │
  │     y firma criptográfica del payload JSON para transferencias.          │
  └──────────────────────────────────────────────────────────────────────────┘
```

### Flujo Técnico de una Consulta a la API BCP:

```
[ Inandes FastAPI Backend ]                              [ BCP API Gateway ]
           │                                                      │
           │  1. Handshake mTLS (Certificado X.509 + VPN)         │
           ├─────────────────────────────────────────────────────>│
           │                                                      │
           │  2. POST /oauth/token (Client ID + Client Secret)    │
           ├─────────────────────────────────────────────────────>│
           │  <── Devuelve: { access_token: "eyJ...", exp: 3600 } │
           │                                                      │
           │  3. POST /v1/cuentas/validacion                      │
           │     Headers: Authorization: Bearer <access_token>    │
           │     Body: { "cuenta": "191-1234567-0-12",            │
           │             "documento": "20601234567" }             │
           ├─────────────────────────────────────────────────────>│
           │                                                      │
           │  4. Response: { "titularValido": true,               │
           │                 "permiteAbonos": true }              │
           │<─────────────────────────────────────────────────────┤
```

---

## 3. Catálogo de APIs del Servicio BCP

| API | Tipo | Entrada (Input) | Salida (Response) | Tarifa BCP | Casos de Uso en Inandes ERP |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **API Transferencias** | Transaccional | • Cuenta Origen<br>• Cuenta Destino<br>• Beneficiario<br>• Monto<br>• Moneda (PEN/USD) | • `Payment Domestic ID`<br>• Estado de ejecución | **S/ 1.50** / invocación | • Desembolsos de Factoring<br>• Pago de Rendimientos a Inversionistas<br>• Liquidación de Comisiones a Asesores |
| **API Validación de Cuentas** | Consulta | • N° Cuenta BCP + Tipo Cuenta<br>• N° Documento (DNI/RUC/CE) + Tipo | • `True` / `False`<br>(Titularidad y habilitada para abonos) | **S/ 0.50** / invocación | • Alta de nuevos Inversionistas<br>• Registro de Emisores/Cedentes<br>• Pre-validación antes de transferir |
| **API Consulta de Movimientos** | Consulta | • `AccountId`<br>• `Fecha Inicio`<br>• `Fecha Fin`<br>• `Página` | • `AccountId`, `TransactionId`<br>• `CreditDebitIndicator`<br>• `Status`, `BookingDateTime`<br>• `Amount`, `Currency`<br>• `TransactionInformation` | **S/ 0.60** / página *(hasta 1,000 movs del día o 250 históricos)* | • Conciliación bancaria automática de cobranzas Cavali/Factoring<br>• Verificación de depósitos de capital de inversionistas |
| **API Consulta de CCI** | Consulta | • N° Cuenta BCP<br>• Tipo de Cuenta | • Código de Cuenta Interbancario (CCI de 20 dígitos) | **S/ 0.50** / invocación | • Enriquecimiento automático de fichas de clientes y proveedores interbancarios |

---

## 4. Plan de Implementación por Etapas

```
  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
  │   ETAPA 0    │ ──> │   ETAPA 1    │ ──> │   ETAPA 2    │ ──> │   ETAPA 3    │ ──> │   ETAPA 4    │
  │ Onboarding & │     │ Infra & Auth │     │ Validación   │     │ Conciliación │     │ Transferenc. │
  │ Cumplimiento │     │   (mTLS/VPN) │     │ Cuentas CRM  │     │ Automática   │     │ en Vivo 24/7 │
  └──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
```

### ETAPA 0: Onboarding Administrativo y Legal con BCP
* **Objetivo:** Cumplimentar los requisitos formales del banco para la apertura del canal API.
* **Acciones:**
  1. Firma de la **Declaración Jurada** por el Representante Legal de Inandes.
  2. Completar el **Checklist Técnico y de Ciberseguridad** (diagrama de arquitectura, ubicación del servidor en USA/Perú, políticas de cifrado).
  3. Revisión de riesgos por el equipo de ciberseguridad del BCP.
  4. Firma del contrato de servicios API Closed Banking.
  5. Recepción del paquete de credenciales de **Sandbox / Certificación** (Certificado Digital `.crt`/`.key`, `Client ID`, `Client Secret`).

---

### ETAPA 1: Infraestructura de Conectividad y Microservicio de Autenticación
* **Objetivo:** Construir en el backend FastAPI el cliente de comunicaciones seguro con el BCP.
* **Acciones:**
  1. Configuración de túnel VPN / whitelist de la IP fija del VPS Contabo en BCP.
  2. Almacenamiento seguro de certificados X.509 y llaves privadas en variables de entorno / Vault del backend.
  3. Desarrollo del módulo `BcpApiClient` en Python (`src/integrations/bcp/`):
     - Manejo de sesión HTTP con `requests` o `httpx` configurado con mTLS (`cert=(client_cert, client_key)`).
     - Gestor de tokens OAuth2 con caché en memoria y autorenovación antes de su expiración.
     - Logging de auditoría estructurado sin exponer datos bancarios sensibles.

---

### ETAPA 2: Módulo de Validación de Cuentas y Consulta de CCI (Frontend & CRM)
* **Objetivo:** Pre-validar automáticamente cualquier cuenta bancaria ingresada al sistema.
* **Acciones:**
  1. Endpoint en FastAPI: `POST /api/bcp/validar-cuenta` y `POST /api/bcp/consultar-cci`.
  2. Integración en UI React:
     - En el modal de **Nuevo Inversionista / Editar Cuentas Bancarias**: al ingresar número de cuenta BCP, botón con feedback visual `[✓ Validar con BCP]`.
     - Si el RUC/DNI coincide con la titularidad, se marca con un badge verde `Cuenta Verificada BCP`.
     - Obtención y autocompletado del CCI de 20 dígitos sin necesidad de cálculo manual.
  3. Evitar rechazos de transferencias futuras por cuentas bloqueadas, inactivas o con error de dígito.

---

### ETAPA 3: Conciliación Bancaria Automática (API de Movimientos)
* **Objetivo:** Ingesta automática de extractos bancarios en tiempo real para liquidar cobranzas de factoring y aportes de inversionistas.
* **Acciones:**
  1. Job programado en FastAPI (CRON nocturno y bajo demanda cada hora) para invocar `GET /v1/movimientos`.
  2. Parseo del JSON de movimientos bancarios (`TransactionInformation`, `Amount`, `CreditDebitIndicator`).
  3. Motor de Matching Inteligente en Supabase:
     - Identificar el RUC del pagador o código de operación en la glosa.
     - Matchear automáticamente con la factura por cobrar en Factoring o con el contrato del Inversionista.
     - Cambiar estado de la factura a `COBRADA` y generar el asiento de liquidación.

---

### ETAPA 4: Dispersión y Transferencias Directas en Tiempo Real (API de Transferencias)
* **Objetivo:** Reemplazar los archivos `.txt` de Telecrédito por pagos electrónicos inmediatos desde el ERP.
* **Acciones:**
  1. Flujo de seguridad en ERP: Aprobación de desembolsos por usuario con rol `ADMINISTRADOR` o `APROBADOR_PAGOS` con confirmación 2FA (código OTP/WhatsApp).
  2. Invocación transaccional a `POST /v1/transferencias`:
     - Parámetros: Cuenta Origen del Fondo, Cuenta Destino del Inversionista/Cedente, Monto exacto, Moneda.
  3. Captura del `Payment Domestic ID` devuelto por el BCP y registro en la base de datos Supabase como comprobante inmutable de pago.
  4. Envío automático de constancia de transferencia por WhatsApp / Email al beneficiario.

---

### ETAPA 5: Pruebas de Certificación con BCP y Pase a Producción
* **Objetivo:** Homologar todos los casos de prueba con el equipo técnico de BCP y habilitar el canal productivo.
* **Acciones:**
  1. Ejecución de la matriz de pruebas en ambiente de Sandbox BCP (casos de éxito, fondos insuficientes, cuentas erradas, timeouts).
  2. Firma del acta de pase a producción.
  3. Cambio de endpoints y certificados a ambiente productivo (`api.viabcp.com`).
  4. Monitoreo en tiempo real de consumo mensual y costos por invocación.

---

## 5. Estimación de Costos Operativos por Invocación

Asumiendo una operación mensual típica de Inandes:

| Concepto | Invocaciones Estimadas / Mes | Costo Unitario | Costo Mensual Estimado |
| :--- | :---: | :---: | :---: |
| Validaciones de Cuenta (Nuevos Inversionistas/Proveedores) | 100 consultas | S/ 0.50 | S/ 50.00 |
| Consultas de Movimientos (Conciliación Diaria - 4 cuentas) | 120 páginas | S/ 0.60 | S/ 72.00 |
| Transferencias Directas (Desembolsos + Rendimientos) | 250 pagos | S/ 1.50 | S/ 375.00 |
| **Total Estimado Mensual** | — | — | **~ S/ 497.00** |

*Beneficio directo:* Ahorro de más de 20 horas/hombre mensuales de digitación y subida manual de archivos a Telecrédito, y eliminación del 100% de errores humanos en transferencias.
