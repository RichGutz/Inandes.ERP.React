# 🗄️ Modelo de Datos y Esquema Supabase (ER)

La persistencia de datos del ERP de InAndes se gestiona en **Supabase** (PostgreSQL). Para soportar la migración interactiva e importaciones desde Google Sheets, el modelo de datos evolucionó hacia un esquema híbrido que utiliza **claves naturales en texto** en las relaciones de negocio y UUIDs en registros operacionales de auditoría.

---

## 🗺️ 1. Diagrama de Modelo Entidad-Relación (ER)

A continuación se presenta el flujo relacional del CRM de Inversionistas en formato Mermaid:

```mermaid
erDiagram
    crm_inversionistas ||--o{ crm_contratos : "es titular (DNI)"
    crm_fondos ||--o{ crm_contratos : "determina reglas (codigo_fondo)"
    crm_contratos ||--|| crm_certificados : "emite (id_contrato)"
    crm_contratos ||--o{ crm_deducciones : "tiene deducciones (id_contrato)"
    crm_contratos ||--o{ crm_rescates : "solicita rescates (id_contrato)"
    crm_certificados ||--o{ crm_certificados_eventos : "registra movimientos (id_certificado)"

    crm_inversionistas {
        UUID id PK
        VARCHAR documento_identidad UK "DNI/RUC del Partícipe"
        VARCHAR tipo_doc
        VARCHAR nombre_1
        VARCHAR apellido_1
        VARCHAR nombre_completo "Stored Generated"
        VARCHAR email
        VARCHAR banco_nombre_PEN
        VARCHAR numero_cuenta_PEN
        VARCHAR banco_nombre_USD
        VARCHAR numero_cuenta_USD
    }

    crm_fondos {
        UUID id PK
        TEXT codigo_fondo UK "e.g., NSGPEN01"
        TEXT nombre_fondo
        TEXT moneda "PEN / USD"
        NUMERIC tasa "Tasa pasiva base"
        INTEGER frecuencia_cupones_meses
        NUMERIC penalidad_rescate
    }

    crm_contratos {
        TEXT id PK "ID natural (e.g. NSGPEN01.001)"
        TEXT id_inversionista_1 FK "DNI del Inversionista"
        TEXT id_inversionista_2 FK
        TEXT id_fondo FK "codigo_fondo"
        TEXT id_asesor FK
        DECIMAL monto_inversion
        VARCHAR moneda "PEN / USD"
        TEXT plazo_meses
        DECIMAL tasa_pactada
        INT frecuencia_pago
        DATE fecha_inicio
        DATE fecha_fin
        VARCHAR estado "borrador/revision_senior/vigente/cerrado"
        VARCHAR codigo_contrato "Cod_INVERSION"
    }

    crm_certificados {
        TEXT id_certificado PK "Format: {id_contrato}-{YYYYMMDD}"
        TEXT id_contrato FK "Referencia 1:1 a contratos"
        DATE fecha_emision
        NUMERIC monto_inicial
        NUMERIC monto_actual
        NUMERIC cuotas_inicial
        NUMERIC cuotas_actual
        TEXT titulares_resumen
        TEXT estado "borrador / emitido / extinto"
    }

    crm_certificados_eventos {
        UUID id PK
        TEXT id_certificado FK
        TIMESTAMPTZ fecha_evento
        TEXT tipo_evento "emision_inicial/capitalizacion/interes_ganado/retiro_parcial/ajuste_manual/extincion"
        NUMERIC monto_variacion
        NUMERIC monto_resultante
        NUMERIC cuotas_variacion
        NUMERIC cuotas_resultantes
        TEXT descripcion
    }

    crm_deducciones {
        TEXT id PK "Format: {id_contrato}-A, B..."
        TEXT id_contrato FK
        TEXT tipo_valor "FIJO / PORCENTUAL"
        TEXT frecuencia "RANGO / PUNTUAL / CRONOGRAMA"
        NUMERIC valor
        TEXT moneda "PEN / USD"
        DATE fecha_inicio
        DATE fecha_fin
        JSONB cronograma_jsonb
        TEXT estado "ACTIVO / INACTIVO"
    }

    crm_rescates {
        VARCHAR id PK
        VARCHAR id_contrato FK
        DATE fecha_solicitud
        DATE fecha_rescate
        NUMERIC monto_capital
        VARCHAR estado "PENDIENTE / EJECUTADO / ANULADO"
        NUMERIC penalidad_estimada
        NUMERIC tasa_penalidad_aplicada
    }
```

---

## 🔑 2. Estrategia de Claves Naturales y Lookup Lógico
En el diseño original de Supabase se utilizaban únicamente UUIDs de Postgres. Para evitar la duplicidad de datos al migrar de Google Sheets (donde los identificadores de contratos son de tipo `'NSGPEN01.001'`), se adoptó la siguiente estrategia:

*   **Identificación del Contrato**: El campo `id` de `crm_contratos` es de tipo `TEXT` y guarda el valor del Excel (ej. `'NSGPEN02.045'`).
*   **Identificación del Inversionista en Contratos**: El campo `id_inversionista_1` en `crm_contratos` guarda de manera directa el **DNI** (`documento_identidad`) del inversionista, evitando subconsultas anidadas durante la importación.
*   **Identificación del Fondo**: El campo `id_fondo` de `crm_contratos` almacena el código corto (ej. `'NSGPEN01'`), no el UUID de `crm_fondos`.
*   **Identificación del Certificado**: Cada certificado tiene un `id_certificado` de tipo `TEXT` que concatena el contrato y la fecha (ej. `'NSGPEN01.001-20260228'`).

---

## 🗂️ 3. Diccionario Físico de Datos (Restricciones y Tipos)

### Tabla `crm_inversionistas`
*   `documento_identidad`: `VARCHAR(20) NOT NULL UNIQUE` (Llave de búsqueda/relación).
*   `nombre_completo`: `VARCHAR(400) GENERATED ALWAYS AS (apellido_1 || ' ' || COALESCE(apellido_2, '') || ' ' || nombre_1 || ' ' || COALESCE(nombre_2, '')) STORED` (Autogenerado contablemente).
*   `banco_nombre_PEN` / `numero_cuenta_PEN` / `cci_PEN`: Datos para moneda local.
*   `banco_nombre_USD` / `numero_cuenta_USD` / `cci_USD`: Datos para moneda extranjera.
*   `estado_compliance`: `'borrador'`, `'solicitado'`, `'aprobado'`, `'rechazado'` (Control de workflow).

### Tabla `crm_contratos`
*   `id`: `TEXT PRIMARY KEY` (Clave de migración).
*   `moneda`: `VARCHAR(3) NOT NULL CHECK (moneda IN ('USD', 'PEN'))`.
*   `estado`: `VARCHAR(20) DEFAULT 'borrador' CHECK (estado IN ('borrador', 'revision_senior', 'esperando_firma', 'vigente', 'rechazado', 'finalizado'))`.

### Tabla `crm_certificados`
*   `id_certificado`: `TEXT PRIMARY KEY` (Formato: `{id_contrato}-{fecha}`).
*   `id_contrato`: `TEXT NOT NULL REFERENCES crm_contratos(id) ON DELETE CASCADE` (Relación 1:1 lógica).
*   `estado`: `TEXT DEFAULT 'emitido' CHECK (estado IN ('borrador', 'emitido', 'extinto'))`.

### Tabla `crm_certificados_eventos`
*   `tipo_evento`: `TEXT NOT NULL CHECK (tipo_evento IN ('emision_inicial', 'capitalizacion', 'interes_ganado', 'retiro_parcial', 'ajuste_manual', 'extincion'))` (Ledger inmutable).
*   `monto_variacion`: `NUMERIC(20,2)` (Variación aplicada al capital).
*   `monto_resultante`: `NUMERIC(20,2)` (Snapshot de capitalización posterior).

### Tabla `crm_deducciones`
*   `id`: `TEXT PRIMARY KEY` (Formato: `{id_contrato}-A`).
*   `tipo_valor`: `TEXT CHECK (tipo_valor IN ('FIJO', 'PORCENTUAL'))`.
*   `frecuencia`: `TEXT CHECK (frecuencia IN ('RANGO', 'PUNTUAL', 'CRONOGRAMA'))`.
*   `cronograma_jsonb`: `JSONB` (Estructura `{"YYYY-MM-DD": monto}` para deducciones programadas).

### Tabla `crm_rescates`
*   `id_contrato`: `VARCHAR(50) NOT NULL REFERENCES crm_contratos(id)` (Vínculo al contrato).
*   `estado`: `VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE'` (Estados: `'PENDIENTE'`, `'EJECUTADO'`, `'ANULADO'`).
