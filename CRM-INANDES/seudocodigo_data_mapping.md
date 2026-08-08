# Pseudocódigo y Data Mapping - CRM Inversiones
*Fecha: 2026-01-22*  
*Documento: Hoja de Ruta Completa*

---

## 📋 Propósito del Documento

Este documento es la **hoja de ruta completa** para el desarrollo del módulo CRM Inversiones. Define:
1. Mapeo entre UI y Base de Datos (nombres reales de variables)
2. Pseudocódigo del Motor de Cálculo de Eventos
3. Flujo de datos completo
4. Validaciones y reglas de negocio

---

## 🗂️ Estructura de Tablas (Schema Real)

### 1. `crm_participes` (Maestro de Partícipes)

```sql
Campos clave:
- id (UUID)
- documento_identidad_P1 (TEXT) -- DNI
- nombre_completo_P1 (TEXT)
- email (TEXT)
- telefono (TEXT)
- banco_nombre (TEXT)
- cuenta_bancaria (TEXT)
```

### 2. `crm_fondos` (Maestro de Fondos con Vigencia Anual)

```sql
Campos clave:
- id (UUID)
- nombre (TEXT) -- Ej: "FDO NSG MIPYME PEN 01"
- moneda (TEXT) -- PEN o USD
- origen_dato (TEXT) -- PEN01, PEN02, USD01, etc.
- vigencia_anio (INTEGER) -- 2025, 2026, etc.

-- Tasas por plazo
- tasa_12_meses (NUMERIC)
- tasa_24_meses (NUMERIC)
- tasa_36_meses (NUMERIC)
- tasa_60_meses (NUMERIC)

-- Reglas de rescate
- plazo_opcion_venta (INTEGER) -- Días
- plazo_opcion_devolucion (INTEGER) -- Días
- penalidad_rescate (NUMERIC) -- Porcentaje
- plazo_minimo_permanencia (INTEGER) -- Días

CONSTRAINT: UNIQUE (nombre, moneda, vigencia_anio)
```

### 3. `crm_inversiones` (Tickets/Depósitos)

```sql
Campos clave:
- id (UUID)
- participe_id (UUID FK → crm_participes)
- fondo_id (UUID FK → crm_fondos)
- monto_invertido (NUMERIC) -- Capital actual (puede aumentar con capitalizaciones)
- moneda (TEXT)
- fecha_inicio (DATE) -- Fecha de suscripción
- plazo_dias (INTEGER) -- Plazo en días
- fecha_termino (DATE) -- Auto-calculada: fecha_inicio + plazo_dias
- tasa_interes_aplicada (NUMERIC) -- Snapshot de la tasa al crear
- porcentaje_capitalizacion (NUMERIC) -- 0-100% (cuánto del cupón se capitaliza)
- estado (TEXT) -- ACTIVO, LIQUIDADO, CANCELADO
- instruccion_vencimiento (TEXT) -- PAGAR, CAPITALIZAR, CONSULTAR
- origen_dato (TEXT) -- PEN01, USD01, etc.
```

### 4. `crm_eventos` (Eventos Financieros)

```sql
Campos clave:
- id (UUID)
- inversion_id (UUID FK → crm_inversiones)
- tipo_evento (TEXT) -- CUPON, CAPITALIZACION, RESCATE
- fecha_evento (DATE) -- Fecha del evento
- fecha_procesado (TIMESTAMP) -- Cuándo se ejecutó

-- Montos
- monto_calculado (NUMERIC) -- Monto bruto
- monto_retencion (NUMERIC) -- 5% retención
- monto_neto (NUMERIC) -- Después de retención
- monto_cash (NUMERIC) -- Parte en efectivo
- monto_capitalizado (NUMERIC) -- Parte reinvertida

-- Rescates
- monto_solicitado (NUMERIC)
- monto_penalidad (NUMERIC)
- porcentaje_penalidad (NUMERIC)

- estado (TEXT) -- PENDIENTE, PROCESADO, CANCELADO, ERROR
- notas (TEXT)
```

---

## 🔗 Mapeo UI → Base de Datos

### Tab 1: "Portafolio" (Visualización)

| Campo UI | Variable BD | Tabla | Observaciones |
|----------|-------------|-------|---------------|
| DNI | `documento_identidad_P1` | `crm_participes` | Llave de búsqueda |
| Nombre | `nombre_completo_P1` | `crm_participes` | |
| Fondo | `nombre` | `crm_fondos` | Via JOIN con `fondo_id` |
| Monto | `monto_invertido` | `crm_inversiones` | Capital actual |
| Fecha Inicio | `fecha_inicio` | `crm_inversiones` | |
| Plazo | `plazo_dias` | `crm_inversiones` | Convertir a meses para display |
| Vencimiento | `fecha_termino` | `crm_inversiones` | Auto-calculada |
| Tasa | `tasa_interes_aplicada` | `crm_inversiones` | Snapshot |
| Estado | `estado` | `crm_inversiones` | ACTIVO/LIQUIDADO |

### Tab 2: "Nuevos Tickets / Rescates"

#### Opción A: Nuevo Ticket

| Campo UI | Variable BD | Validación |
|----------|-------------|------------|
| DNI (buscador) | `documento_identidad_P1` | Debe existir en `crm_participes` |
| Fondo | `fondo_id` | SELECT de `crm_fondos` WHERE `vigencia_anio` = año actual |
| Plazo (meses) | `plazo_dias` | Convertir: meses * 30 |
| Fecha Suscripción | `fecha_inicio` | No puede ser futura |
| Monto | `monto_invertido` | > 0 |
| Moneda | `moneda` | Debe coincidir con fondo |
| % Capitalización | `porcentaje_capitalizacion` | 0-100 |

**Lógica al guardar:**
```python
# 1. Obtener tasa aplicable
anio_suscripcion = fecha_inicio.year
plazo_meses = plazo_dias // 30

fondo_config = SELECT * FROM crm_fondos 
               WHERE id = fondo_id 
               AND vigencia_anio = anio_suscripcion

# 2. Mapear plazo a tasa
tasas_map = {
    12: fondo_config.tasa_12_meses,
    24: fondo_config.tasa_24_meses,
    36: fondo_config.tasa_36_meses,
    60: fondo_config.tasa_60_meses
}
tasa_aplicada = tasas_map.get(plazo_meses, fondo_config.tasa_anual_base)

# 3. Calcular fecha_termino
fecha_termino = fecha_inicio + timedelta(days=plazo_dias)

# 4. Insertar inversión
INSERT INTO crm_inversiones (
    participe_id,
    fondo_id,
    monto_invertido,
    moneda,
    fecha_inicio,
    plazo_dias,
    fecha_termino,
    tasa_interes_aplicada,
    porcentaje_capitalizacion,
    estado,
    origen_dato
) VALUES (...)
```

#### Opción B: Rescate

| Campo UI | Variable BD | Validación |
|----------|-------------|------------|
| DNI (buscador) | `documento_identidad_P1` | Debe existir |
| Ticket (selector) | `id` de `crm_inversiones` | Solo tickets ACTIVOS |
| Monto a rescatar | `monto_solicitado` | ≤ `monto_invertido` |
| Tipo | - | Parcial o Total |

**Lógica al ejecutar rescate:**
```python
# 1. Validar reglas de rescate
inversion = SELECT * FROM crm_inversiones WHERE id = ticket_id
fondo_config = SELECT * FROM crm_fondos WHERE id = inversion.fondo_id 
               AND vigencia_anio = EXTRACT(YEAR FROM inversion.fecha_inicio)

dias_transcurridos = (fecha_rescate - inversion.fecha_inicio).days
if dias_transcurridos < fondo_config.plazo_minimo_permanencia:
    raise Error("No cumple plazo mínimo de permanencia")

# 2. Calcular penalidad (algoritmo pendiente)
dias_restantes = (inversion.fecha_termino - fecha_rescate).days
porcentaje_penalidad = calcular_penalidad_dinamica(
    dias_restantes, 
    fondo_config.penalidad_rescate,
    fondo_config.plazo_opcion_venta,
    fondo_config.plazo_opcion_devolucion
)

monto_penalidad = monto_solicitado * (porcentaje_penalidad / 100)
monto_neto_rescate = monto_solicitado - monto_penalidad

# 3. Crear evento
INSERT INTO crm_eventos (
    inversion_id,
    tipo_evento,
    fecha_evento,
    monto_solicitado,
    monto_penalidad,
    porcentaje_penalidad,
    estado
) VALUES (
    ticket_id,
    'RESCATE',
    fecha_rescate,
    monto_solicitado,
    monto_penalidad,
    porcentaje_penalidad,
    'PROCESADO'
)

# 4. Trigger automático actualiza crm_inversiones:
# - Si rescate total: estado = 'LIQUIDADO'
# - Si parcial: monto_invertido -= monto_solicitado
```

### Tab 3: "Cash Flow Cupones / Rescates"

| Campo UI | Variable BD | Query |
|----------|-------------|-------|
| Partícipe (filtro) | `documento_identidad_P1` | JOIN con `crm_participes` |
| Fecha Desde/Hasta | `fecha_evento` | WHERE fecha_evento BETWEEN ... |
| Fondo (filtro) | `origen_dato` | JOIN con `crm_inversiones` |
| Moneda (filtro) | `moneda` | De `crm_inversiones` |

**Query completa:**
```sql
SELECT 
    p.documento_identidad_P1 AS dni,
    p.nombre_completo_P1 AS nombre,
    i.origen_dato AS fondo,
    i.monto_invertido AS capital_actual,
    e.tipo_evento,
    e.fecha_evento,
    e.monto_cash,
    e.monto_capitalizado,
    e.monto_penalidad,
    e.estado
FROM crm_eventos e
JOIN crm_inversiones i ON e.inversion_id = i.id
JOIN crm_participes p ON i.participe_id = p.id
WHERE p.documento_identidad_P1 = :dni_filtro
  AND e.fecha_evento BETWEEN :fecha_desde AND :fecha_hasta
  AND i.origen_dato = :fondo_filtro
  AND i.moneda = :moneda_filtro
ORDER BY e.fecha_evento DESC
```

---

## 🔢 Pseudocódigo del Motor de Cálculo

### EVENTO 1: Cálculo de Cupón Bimestral

```python
def calcular_cupon_bimestral(inversion_id, fecha_cupon):
    """
    Calcula el cupón bimestral para una inversión.
    
    Variables reales:
    - inversion.monto_invertido (capital actual)
    - inversion.tasa_interes_aplicada (TEA %)
    - inversion.porcentaje_capitalizacion (0-100%)
    """
    # 1. Obtener inversión
    inversion = SELECT * FROM crm_inversiones WHERE id = inversion_id
    
    # 2. Calcular cupón bruto (bimestral = TEA / 6)
    tasa_bimestral = inversion.tasa_interes_aplicada / 6
    monto_bruto = inversion.monto_invertido * (tasa_bimestral / 100)
    
    # 3. Aplicar retención 5%
    monto_retencion = monto_bruto * 0.05
    monto_neto = monto_bruto - monto_retencion
    
    # 4. Distribuir según porcentaje_capitalizacion
    monto_capitalizado = monto_neto * (inversion.porcentaje_capitalizacion / 100)
    monto_cash = monto_neto - monto_capitalizado
    
    # 5. Determinar tipo de evento
    if monto_capitalizado > 0:
        tipo_evento = 'CAPITALIZACION'
    else:
        tipo_evento = 'CUPON'
    
    # 6. Crear evento
    INSERT INTO crm_eventos (
        inversion_id,
        tipo_evento,
        fecha_evento,
        monto_calculado,
        monto_retencion,
        monto_neto,
        monto_cash,
        monto_capitalizado,
        estado
    ) VALUES (
        inversion_id,
        tipo_evento,
        fecha_cupon,  # Último día del bimestre
        monto_bruto,
        monto_retencion,
        monto_neto,
        monto_cash,
        monto_capitalizado,
        'PROCESADO'
    )
    
    # 7. Si es CAPITALIZACION, trigger automático actualiza:
    # UPDATE crm_inversiones 
    # SET monto_invertido = monto_invertido + monto_capitalizado
    # WHERE id = inversion_id
    
    return evento_id
```

### EVENTO 2: Capitalización (Caso Especial de Cupón)

```python
def procesar_capitalizacion(evento_id):
    """
    Trigger automático que se ejecuta cuando un evento CAPITALIZACION
    cambia a estado PROCESADO.
    
    Variables reales:
    - evento.monto_capitalizado
    - inversion.monto_invertido
    """
    evento = SELECT * FROM crm_eventos WHERE id = evento_id
    
    if evento.tipo_evento == 'CAPITALIZACION' AND evento.estado == 'PROCESADO':
        # Aumentar capital
        UPDATE crm_inversiones
        SET monto_invertido = monto_invertido + evento.monto_capitalizado,
            updated_at = NOW()
        WHERE id = evento.inversion_id
        
        # IMPORTANTE: El siguiente cupón se calculará con el nuevo monto_invertido
```

### EVENTO 3: Rescate Anticipado

```python
def procesar_rescate(inversion_id, monto_solicitado, fecha_rescate):
    """
    Procesa un rescate anticipado con penalidades.
    
    Variables reales:
    - inversion.monto_invertido
    - inversion.fecha_inicio
    - inversion.fecha_termino
    - fondo.plazo_minimo_permanencia
    - fondo.penalidad_rescate
    - fondo.plazo_opcion_venta
    - fondo.plazo_opcion_devolucion
    """
    # 1. Obtener inversión y configuración del fondo
    inversion = SELECT * FROM crm_inversiones WHERE id = inversion_id
    
    fondo_config = SELECT * FROM crm_fondos 
                   WHERE id = inversion.fondo_id
                   AND vigencia_anio = EXTRACT(YEAR FROM inversion.fecha_inicio)
    
    # 2. Validar plazo mínimo de permanencia
    dias_transcurridos = (fecha_rescate - inversion.fecha_inicio).days
    
    if dias_transcurridos < fondo_config.plazo_minimo_permanencia:
        raise ValidationError(
            f"Debe esperar {fondo_config.plazo_minimo_permanencia} días. "
            f"Han transcurrido {dias_transcurridos} días."
        )
    
    # 3. Validar que sea post-bimestre
    meses_transcurridos = dias_transcurridos / 30
    if meses_transcurridos % 2 != 0:  # No es múltiplo de 2
        raise ValidationError("Los rescates solo se permiten al finalizar un bimestre")
    
    # 4. Calcular penalidad dinámica (algoritmo pendiente de definir)
    dias_restantes = (inversion.fecha_termino - fecha_rescate).days
    
    # Algoritmo simplificado (pendiente refinamiento):
    if dias_restantes <= fondo_config.plazo_opcion_devolucion:
        # Cerca del vencimiento, penalidad baja
        porcentaje_penalidad = fondo_config.penalidad_rescate * 0.5
    elif dias_restantes <= fondo_config.plazo_opcion_venta:
        # Medianamente cerca, penalidad media
        porcentaje_penalidad = fondo_config.penalidad_rescate * 0.75
    else:
        # Muy temprano, penalidad completa
        porcentaje_penalidad = fondo_config.penalidad_rescate
    
    monto_penalidad = monto_solicitado * (porcentaje_penalidad / 100)
    monto_neto_rescate = monto_solicitado - monto_penalidad
    
    # 5. Crear evento
    INSERT INTO crm_eventos (
        inversion_id,
        tipo_evento,
        fecha_evento,
        monto_solicitado,
        monto_penalidad,
        porcentaje_penalidad,
        estado,
        notas
    ) VALUES (
        inversion_id,
        'RESCATE',
        fecha_rescate,
        monto_solicitado,
        monto_penalidad,
        porcentaje_penalidad,
        'PROCESADO',
        f'Rescate con {porcentaje_penalidad:.2f}% penalidad'
    )
    
    # 6. Trigger automático actualiza crm_inversiones:
    # Si monto_solicitado >= monto_invertido:
    #     UPDATE crm_inversiones SET estado = 'LIQUIDADO'
    # Else:
    #     UPDATE crm_inversiones 
    #     SET monto_invertido = monto_invertido - monto_solicitado
    
    return monto_neto_rescate
```

---

## 🔄 Flujo Completo del Motor de Cálculo

### Generación Automática de Cupones Bimestrales

```python
def generar_cupones_bimestrales(fecha_proceso):
    """
    Ejecutar diariamente. Genera cupones para inversiones que cumplen bimestre.
    
    Variables reales:
    - inversion.fecha_inicio
    - inversion.fecha_termino
    - inversion.estado
    """
    # 1. Obtener inversiones activas que cumplen bimestre hoy
    inversiones = SELECT * FROM crm_inversiones
                  WHERE estado = 'ACTIVO'
                  AND fecha_inicio <= fecha_proceso
                  AND fecha_termino >= fecha_proceso
    
    for inversion in inversiones:
        # 2. Calcular meses transcurridos
        dias_transcurridos = (fecha_proceso - inversion.fecha_inicio).days
        meses_transcurridos = dias_transcurridos / 30
        
        # 3. Si es múltiplo de 2 (bimestre completo)
        if meses_transcurridos % 2 == 0 and meses_transcurridos > 0:
            # 4. Verificar que no exista cupón para esta fecha
            existe = SELECT COUNT(*) FROM crm_eventos
                     WHERE inversion_id = inversion.id
                     AND fecha_evento = fecha_proceso
                     AND tipo_evento IN ('CUPON', 'CAPITALIZACION')
            
            if existe == 0:
                # 5. Generar cupón
                calcular_cupon_bimestral(inversion.id, fecha_proceso)
```

---

## ⚠️ Reglas de Negocio Críticas

### Cupones
- ✅ Frecuencia: **Bimestral** (cada 2 meses)
- ✅ Retención: **5% siempre**
- ✅ Base de cálculo: `monto_invertido` actual (puede haber aumentado por capitalizaciones previas)
- ✅ NO afecta `monto_invertido` si es cupón puro (0% capitalización)

### Capitalizaciones
- ✅ Se capitaliza **después de retención** (sobre `monto_neto`)
- ✅ Fecha: **Último día del bimestre**
- ✅ SÍ afecta `monto_invertido` (aumenta)
- ✅ Siguiente cupón se calcula con capital incrementado

### Rescates
- ✅ Solo **post-bimestre** (meses_transcurridos % 2 == 0)
- ✅ Validar `plazo_minimo_permanencia`
- ✅ Penalidad varía según `dias_restantes`
- ✅ Si total: `estado` → 'LIQUIDADO'
- ✅ Si parcial: `monto_invertido` disminuye

---

## 📝 Pendientes y Decisiones

### Algoritmo de Penalidades (Rescates)

**Estado:** Pendiente de definición exacta

**Variables involucradas:**
- `dias_restantes` = `fecha_termino` - `fecha_rescate`
- `fondo.penalidad_rescate` (% base)
- `fondo.plazo_opcion_venta` (días)
- `fondo.plazo_opcion_devolucion` (días)

**Propuesta simplificada:**
```python
if dias_restantes <= plazo_opcion_devolucion:
    penalidad = penalidad_rescate * 0.5
elif dias_restantes <= plazo_opcion_venta:
    penalidad = penalidad_rescate * 0.75
else:
    penalidad = penalidad_rescate * 1.0
```

**Requiere:** Validación con usuario sobre lógica exacta

---

## 🎯 Próximos Pasos de Implementación

1. **Motor de Cálculo:**
   - [ ] Implementar `calcular_cupon_bimestral()`
   - [ ] Implementar `generar_cupones_bimestrales()` (job diario)
   - [ ] Implementar `procesar_rescate()` con algoritmo de penalidades
   - [ ] Tests unitarios para cada función

2. **UI - Tab "Nuevos Tickets":**
   - [ ] Conectar formulario con `crm_inversiones`
   - [ ] Implementar lógica de obtención de tasa según año + plazo
   - [ ] Validaciones de negocio

3. **UI - Tab "Cash Flow":**
   - [ ] Implementar query de eventos con filtros
   - [ ] Grid de visualización
   - [ ] Exportación a Excel

4. **Automatización:**
   - [ ] Crear job diario para generación de cupones
   - [ ] Notificaciones de eventos procesados
   - [ ] Envío de EECC (Tab 4)

---

*Documento creado: 2026-01-22*  
*Versión: 1.0*
