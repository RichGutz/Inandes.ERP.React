# 📋 Plan de Reingeniería UI & Persistencia: Gestión de Fondos (Valor Cuota NAV V27)

> **Origen**: Transcripción de Audio `UI.CIERRES.NAV27.ogg`  
> **Metodología**: Método Benoit Blanc (`LEG` $\rightarrow$ `CLON` $\rightarrow$ `DIFF` $\rightarrow$ `QC` $\rightarrow$ `NOTA`)  
> **Objetivo**: Reemplazar la interfaz actual de la pestaña *Valor Cuota* en `FondosPage.tsx` por una arquitectura espejo ejecutiva idéntica a la de *Retornos y Rendimientos* (`InversionistasPage.tsx`), adaptada sin transferencias bancarias y con persistencia contable/rollback.

---

## 🎯 1. Diagnóstico del Audio y Requerimientos Clave

1. **Arquitectura Espejo de Retornos**:
   * **Artefacto Superior**: Cronograma Anual de 12 Meses (Ene - Dic) con badges de estado (`🟢 REGISTRADO` vs `🔴 POR REGISTRAR`), selector de año (`2024..2027`) y selección directa de mes.
   * **Panel Operativo en 3 Columnas Horizontales**:
     * **Columna 1 (`1. Filtros del Período`)**: Los 2 selectores inteligentes (*Mes de Cierre / Período* y *Fondo a Liquidar* filtrado al mes).
     * **Columna 2 (`2. Auditoría & Reportes`)**: Botón *Descargar Excel Maestro V27* + Botón *Descargar PDF Oficial V27* con visor dual transponiendo la matriz.
     * **Columna 3 (`3. Persistencia en Base de Datos & Rollback`)**: Botón *Oficializar y Guardar Asientos de Valor Cuota* + Botón *Eliminar y Reabrir Período (Rollback)*.
     * *(Nota: En Valor Cuota NO se incluye Columna 4 de Transferencias Bancarias BCP ya que no aplica salida de caja a terceros)*.
2. **Persistencia y Estado de Cierre (`REGISTRADO` vs `POR REGISTRAR`)**:
   * Cada vez que se oficializa el período, se guardan los asientos diarios de Valor Cuota, Patrimonio de Cierre y Cuotas Totales en Supabase.
   * El badge del mes en el calendario pasa a `🟢 REGISTRADO` con el conteo de asientos oficiales.
   * En caso de error, el botón de **Rollback** permite eliminar los asientos del corte y reabrir el período a `🔴 POR REGISTRAR`.

---

## 🗄️ 2. Estructura de Base de Datos para Valor Cuota

Creación de la tabla `crm_valor_cuota_eventos` en Supabase (o integración con ledger oficial `crm_certificados_eventos`):

```sql
CREATE TABLE IF NOT EXISTS public.crm_valor_cuota_eventos (
    id_evento UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_fondo VARCHAR(30) NOT NULL REFERENCES public.crm_fondos(id_fondo),
    fecha_corte DATE NOT NULL,
    anio INT NOT NULL,
    ciclo VARCHAR(20) NOT NULL, -- 'Bimestre' o 'Trimestre'
    num_periodo INT NOT NULL,
    fecha_inicio_periodo DATE NOT NULL,
    fecha_fin_periodo DATE NOT NULL,
    valor_cuota_inicial NUMERIC(14, 8) NOT NULL,
    valor_cuota_final NUMERIC(14, 8) NOT NULL,
    patrimonio_cierre NUMERIC(18, 4) NOT NULL,
    cuotas_totales_cierre NUMERIC(18, 4) NOT NULL,
    capital_apertura NUMERIC(18, 4) NOT NULL,
    capital_adicional_periodo NUMERIC(18, 4) DEFAULT 0,
    ingresos_brutos_periodo NUMERIC(18, 4) NOT NULL,
    comision_admin_periodo NUMERIC(18, 4) NOT NULL,
    comision_captacion_periodo NUMERIC(18, 4) NOT NULL,
    comision_misc_periodo NUMERIC(18, 4) DEFAULT 0,
    payload_resumen JSONB, -- desglose de los días y filas
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by VARCHAR(100) DEFAULT 'SISTEMA_REACT'
);

CREATE INDEX IF NOT EXISTS idx_vc_eventos_corte ON public.crm_valor_cuota_eventos(fecha_fin_periodo, id_fondo);
```

---

## 🎨 3. Flujo de Usuario y Pantalla

```
+---------------------------------------------------------------------------------------------------+
| 📅 CRONOGRAMA ANUAL DE CIERRES & VALOR CUOTA 2026                               [ 2024 2025 2026 2027 ] |
+---------------------------------------------------------------------------------------------------+
| [MES 01 ENE] | [MES 02 FEB] 🟢 REGISTRADO | [MES 03 MAR] 🔴 POR REGISTRAR | [MES 04 ABR] ...      |
+---------------------------------------------------------------------------------------------------+
| ⚙️ PANEL OPERATIVO DE VALOR CUOTA NAV V27 (2026-01-01 AL 2026-02-28)        [ 🟢 PERÍODO REGISTRADO ] |
+------------------------------------+--------------------------------+-----------------------------+
| 1. FILTROS DEL PERÍODO             | 2. AUDITORÍA & REPORTES        | 3. PERSISTENCIA & ROLLBACK  |
| • 📅 Mes de Cierre / Período       | • [📊 Descargar Excel V27]     | • [💾 Oficializar Cierre]   |
|   [ Febrero (Ene-Feb · Bimestre 1) ]| • [📑 Descargar PDF Oficial]   | • [🔄 Reabrir / Rollback]   |
| • 🎯 Fondo a Liquidar              |                                |                             |
|   [ TODOS LOS FONDOS (5 Fondos)   ]| • Visor: [Matriz | PDF Dual]   |                             |
+------------------------------------+--------------------------------+-----------------------------+
| 📊 MATRIZ CONTINUA TRANSPUESTA NAV V27 (Día a Día con 17 Filas de Totales Contables)              |
+---------------------------------------------------------------------------------------------------+
```

---

## ⚖️ 4. Protocolo de Ejecución (Método Benoit Blanc)

1. **`LEG` (Legacy)**: Crear backup de `src/features/fondos/FondosPage.tsx` como `Files.Legacy/FondosPage_LEGACY_V26_UI.tsx`.
2. **`CLON` & `DIFF`**:
   * Insertar el tablero de 12 meses superior conectado al ciclo activo.
   * Insertar el panel en 3 columnas (*Filtros*, *Auditoría*, *Persistencia*).
   * Conectar con la tabla de eventos en Supabase para oficialización y rollback.
3. **`QC`**: Validar compilación limpia `npm run build` y pruebas de registro/rollback.
4. **`NOTA`**: Documentar Caso Pericial N° 04 y desplegar a VPS Contabo.

---

*Plan documentado y registrado por Detective Benoit Blanc - 29 de Agosto de 2026.*
