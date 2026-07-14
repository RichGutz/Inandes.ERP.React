# 🧪 Plan de Pruebas: Clonación de Base de Datos y Comparación de Resultados

Esta nota detalla el plan y el protocolo de pruebas de integridad para clonar la base de datos de Supabase activa del proyecto Streamlit a un nuevo proyecto independiente de pruebas, asegurando que las ejecuciones del motor financiero y contable en **React** arrojen resultados idénticos centavo a centavo frente a los reportes auditados de **Streamlit**.

---

## 🎯 1. Objetivo
Garantizar la exactitud matemática y la estabilidad de la migración en React. Al utilizar el mismo conjunto de datos reales clonados de producción en el nuevo proyecto, los reportes consolidados de retornos, cálculos de comisiones, amortizaciones y ledger de eventos financieros deben coincidir al 100% en ambas plataformas.

---

## ⚙️ 2. Credenciales y Configuración de Proyectos Supabase

### Proyecto A (Origen / Streamlit & Producción Actual)
* **Project ID**: `vinjzmqwaqsqzoigqpxk`
* **URL**: `https://vinjzmqwaqsqzoigqpxk.supabase.co`
* **Clave (`service_role`)**: Utilizada en local y en producción para bypassear RLS.

### Proyecto B (Destino / Nuevo de Pruebas y Auditoría)
* **Project ID**: `egvcinsbyropumybatdf`
* **URL**: `https://egvcinsbyropumybatdf.supabase.co`
* **Clave (`service_role`)**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVndmNpbnNieXJvcHVteWJhdGRmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDA0NDczNCwiZXhwIjoyMDk5NjIwNzM0fQ.28T_xQmSRJO1O1scio61JU0KHhEQfzSS94qYka8TrcA`

---

## 🗄️ 3. Protocolo de Clonación de la Base de Datos

Para migrar la estructura y los datos sin pérdida de integridad ni dependencias, seguiremos la estrategia de clonación a nivel de PostgreSQL:

### Opción A: DUMP y RESTORE de PostgreSQL (Recomendado por Velocidad)
1. **Exportar Dump de Producción (Origen)**:
   ```bash
   pg_dump -h db.vinjzmqwaqsqzoigqpxk.supabase.co -U postgres -d postgres -F p -b -v -f supabase_production_dump.sql
   ```
2. **Restaurar Dump en el Nuevo Proyecto (Destino)**:
   ```bash
   psql -h db.egvcinsbyropumybatdf.supabase.co -U postgres -d postgres -f supabase_production_dump.sql
   ```

### Opción B: Script de Migración Secuencial (Python API Client)
Si se restringe el acceso directo al puerto 5432 de Postgres, se utilizará un script en Python (`clone_supabase_data.py`) que realiza las operaciones vía API de Supabase en el orden correcto de llaves foráneas:
1. `crm_inversionistas` (Entidades Maestras)
2. `crm_asesores` (Asesores Maestros)
3. `crm_fondos` (Fondos de Inversión y Plazos)
4. `crm_contratos` (Borradores y Contratos Definitivos)
5. `crm_certificados` (Certificados Emitidos)
6. `crm_certificados_eventos` (Ledger de Transacciones)
7. `crm_cronograma_deducciones_rescates` (Deducciones Programadas)

---

## 📝 4. Metodología de Pruebas de Comparación (Streamlit vs React)

Una vez que los datos estén perfectamente clonados en el Proyecto B, realizaremos la comparación de resultados bajo el siguiente esquema:

### Paso 1: Configurar React para apuntar al Proyecto B
* Actualizar el archivo `.env.local` en el entorno local de desarrollo de React con los nuevos valores:
  ```env
  VITE_SUPABASE_URL="https://egvcinsbyropumybatdf.supabase.co"
  VITE_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVndmNpbnNieXJvcHVteWJhdGRmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDA0NDczNCwiZXhwIjoyMDk5NjIwNzM0fQ.28T_xQmSRJO1O1scio61JU0KHhEQfzSS94qYka8TrcA"
  ```

### Paso 2: Ejecutar los Módulos Críticos en Ambas Interfaces
1. **Auditoría de Inversionistas (Retornos v40)**:
   * Generar el reporte de retornos del Bimestre/Trimestre de corte en Streamlit.
   * Generar el mismo reporte en la pestaña **Auditoría** del componente de React.
   * Descargar ambos Excels (`xlsx`) y cotejar:
     * `Interés Bruto`
     * `Retención Impuesto (5%)`
     * `Interés Neto`
     * `Saldo Final`
2. **Proyección y Liquidación de Asesores (Comisiones v2)**:
   * Comparar la liquidación mensual de comisiones y mantenimiento de la fuerza de ventas.
3. **Cálculo de Valor Cuota (v26 diario)**:
   * Validar el devengue diario del fondo para el mes de corte.

### Paso 3: Aprobación y Rollback de Transacciones
* Probar el flujo de "Oficializar Bimestre" en React en la base clonada de pruebas, verificando la escritura correcta de los registros en `crm_certificados_eventos`.
* Verificar que el botón de "Rollback" en React limpie los registros del ledger dejándolo en su estado original.

---

## 🛠️ 5. Estado Actual y Pasos de Ejecución

### Acciones Realizadas:
1. **Esquema DDL Generado**: Se creó el archivo `schema_clone.sql` en la raíz del proyecto React conteniendo las sentencias DDL exactas de las 7 tablas de CRM con sus relaciones y restricciones de llaves foráneas.
2. **Script de Clonación REST**: Se implementó `clone_supabase_db.py` para leer datos desde el origen de desarrollo (`vinjzmqwaqsqzoigqpxk`) e inyectarlos vía PostgREST API en lotes ordenados al destino (`egvcinsbyropumybatdf`).
3. **Entorno React Actualizado**: Se actualizó el archivo `.env.local` en el local de desarrollo con las nuevas credenciales de pruebas para hacer bypass de RLS.
4. **Despliegue VPS**: Se compiló y desplegó la versión en la URL: `https://inandes.react.geeksoft.tech`.

### 📊 Resultado Final de la Restauración de Producción Real:
* **Estatus**: ¡Completado Exitosamente con código de salida 0!
* **Fecha de Ejecución**: 14 de Julio, 2026.
* **Origen de Datos (VPS Hostinger)**: Respaldo oficial de producción en caliente (`/root/backups/inandes_V37_20260413_120002.sql.gz`).
* **Destino**: Nuevo proyecto Supabase `egvcinsbyropumybatdf` en Virginia.
* **Métricas Históricas de Respaldos en VPS**:
  * **Primer Respaldo**: 2 de Abril, 2026 (`inandes_backup_20260402_185431.sql.gz`).
  * **Último Respaldo (Restaurado)**: 13 de Abril, 2026 (`inandes_V37_20260413_120002.sql.gz` con un tamaño de 108 KB).
* **Resultado**: La nueva base de datos de pruebas `egvcinsbyropumybatdf` cuenta ahora con la **estructura y los datos reales y consolidados de producción de Streamlit**, incluyendo todos los certificados reales, el ledger histórico de eventos contables y financieros, y los inversionistas oficiales para realizar las pruebas comparativas centavo a centavo.

---

## 🔍 6. Bitácora Técnica de Iteraciones y Solución de Errores

Para lograr la migración directa y transparente entre las dos instancias de Supabase, tuvimos que ejecutar múltiples intentos debido a discrepancias en el diseño de base de datos, tipos de serialización de Python y restricciones de red. A continuación se explica en máximo detalle el "por qué" de cada uno de los intentos fallidos y sus soluciones implementadas:

### 1. El error de "Table not found" vía PostgREST API
* **Qué pasó**: El nuevo proyecto de Supabase (`egvcinsbyropumybatdf`) se inicializó vacío (sin tablas). Al realizar peticiones REST vía cliente HTTP para inyectar datos, Supabase respondió con error `PGRST205` (La tabla no existe en el schema cache).
* **Solución**: Se generó el archivo `schema_clone.sql` extrayendo el esquema DDL real desde la base de datos origen para poder crear las tablas en el destino antes del volcado.

### 2. Hostname de Supabase no Resuelto por deprecación de DNS directos
* **Qué pasó**: Intentamos conectarnos a la base destino usando `db.egvcinsbyropumybatdf.supabase.co`. Sin embargo, las DNS fallaron porque Supabase ha retirado los hostnames `.co` directos en proyectos nuevos en favor de conexiones a través de poolers regionales seguros.
* **Solución**: Escribimos un script de escaneo (`test_target_poolers.py`) para probar la conexión a través de los poolers regionales de AWS. Descubrimos que el nuevo proyecto se aloja en Virginia y responde exitosamente en `aws-0-us-east-1.pooler.supabase.com`.

### 3. Caída por Codificación de Caracteres en Consola de Windows (CP1252)
* **Qué pasó**: El script imprimía emojis decorativos de consola (como escobas 🧹 o cohetes 🚀). Al ejecutarlo en la consola predeterminada de Windows, la cual utiliza la codificación de caracteres heredada `CP1252` (Western European), Python arrojó un error fatal `UnicodeEncodeError` bloqueando la ejecución.
* **Solución**: Se removieron todos los caracteres especiales y emojis de los enunciados de consola (`print`).

### 4. Conflicto de Nombres de Columnas en Inversionistas
* **Qué pasó**: Al intentar insertar los registros de inversionistas, el motor de base de datos origen nos indicó que el campo se llamaba `antiguedad_laboral_anios`. Sin embargo, en el DDL simplificado del destino lo habíamos definido como `antiguedad_laboral_anios_inversionista`, lo cual rompió el mapeo.
* **Solución**: Modificamos `schema_clone.sql` para restaurar la columna exacta original, y añadimos un comando `DROP TABLE IF EXISTS ... CASCADE` en el script Python para que al reintentar, borrara la estructura antigua fallida y la recreara correctamente.

### 5. Bloqueo de Transacción en Postgres por Tabla de Certificados vacía
* **Qué pasó**: La base de datos origen no contenía la tabla física `crm_certificados` (ya que se maneja dinámicamente o estaba vacía en desarrollo). Al intentar consultarla, Postgres arrojó un error de relación no existente. En Postgres, cuando una consulta falla dentro de un bloque transaccional, todas las siguientes peticiones de esa conexión fallan automáticamente con el error `current transaction is aborted, commands ignored until end of transaction block`. Esto impidió que las tablas siguientes (`eventos` y `cronograma`) se leyeran.
* **Solución**: Añadimos un bloque `try/except` que aplica `src_conn.rollback()` cuando una tabla no existe. Esto limpia el estado de la transacción en caliente, permitiendo leer las demás tablas con éxito.

### 6. Fallo de Tipado de JSONB en Python (`can't adapt type 'dict'`)
* **Qué pasó**: La tabla `crm_certificados_eventos` contiene una columna de auditoría compleja llamada `payload_asiento` de tipo `JSONB`. Al extraerla por psycopg2, Python la lee en memoria como un diccionario nativo (`dict`). Al intentar realizar un `INSERT` masivo en el destino, psycopg2 falló con `can't adapt type 'dict'` porque no sabe cómo serializar un objeto `dict` en un string JSON crudo de base de datos por defecto.
* **Solución**:
  * Intentamos usar el registro automático `register_default_jsonb`, el cual falló porque la versión de psycopg2 instalada no aceptaba el argumento por palabra clave `conn_or_cursor`.
  * La solución final fue registrar el adaptador de tipos global de psycopg2 para diccionarios: `register_adapter(dict, Json)`. De esta manera, cada diccionario se convierte automáticamente a su representación JSON al momento del guardado.

### 7. Optimización de Rendimiento (`executemany` vs `execute_values`)
* **Qué pasó**: Las bases de datos se encuentran en continentes distintos (Tokio y Virginia). El método clásico de psycopg2 `executemany` ejecuta sentencias `INSERT` fila por fila de forma secuencial. Con cientos de filas, la latencia de ida y vuelta de red (RTT ~150ms) provocaba que la inserción de 220 registros tardara más de 30 segundos, colgando la consola.
* **Solución**: Reemplazamos la inserción por `execute_values` de `psycopg2.extras`. Este método compacta todos los registros en una sola consulta estructurada (`VALUES %s`), realizando una sola llamada de red y reduciendo el tiempo de migración de minutos a menos de 1 segundo por tabla.



