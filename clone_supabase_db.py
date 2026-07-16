# clone_supabase_db.py
import psycopg2
from psycopg2.extras import register_default_jsonb, execute_values, Json
from psycopg2.extensions import register_adapter
import sys

# Registrar adaptador para diccionarios Python a JSON de PostgreSQL
register_adapter(dict, Json)

# Credenciales de Origen
SRC_HOST = "aws-1-ap-northeast-1.pooler.supabase.com"
SRC_USER = "postgres.vinjzmqwaqsqzoigqpxk"
SRC_PASS = "VivaLaVida2026$"

# Credenciales de Destino (Encontrado en aws-0-us-east-1)
TGT_HOST = "aws-0-us-east-1.pooler.supabase.com"
TGT_USER = "postgres.egvcinsbyropumybatdf"
TGT_PASS = "VivaLaVida2026"

TABLES_ORDER = [
    "crm_inversionistas",
    "crm_asesores",
    "crm_fondos",
    "crm_contratos",
    "crm_certificados",
    "crm_certificados_eventos",
    "crm_cronograma_deducciones_rescates"
]

def main():
    print("=== INICIANDO CLONACION COMPLETA (DDL + DATOS) ===")
    
    # 1. Conectando a Destino
    print("\n[1/4] Conectando a la base de datos DESTINO...")
    try:
        tgt_conn = psycopg2.connect(
            host=TGT_HOST,
            port=5432,
            database="postgres",
            user=TGT_USER,
            password=TGT_PASS,
            sslmode="require",
            connect_timeout=15
        )
        tgt_conn.autocommit = True
        register_default_jsonb(tgt_conn)
        tgt_cur = tgt_conn.cursor()
        print("  [OK] Conectado a Destino.")
    except Exception as e:
        print(f"  [-] Error al conectar a Destino: {e}")
        sys.exit(1)

    # 2. Ejecutar DDL
    print("\n[2/4] Leyendo y ejecutando DDL schema_clone.sql en Destino...")
    try:
        # Forzar drop de tablas en destino para recrear limpiamente con DDL corregido
        drop_tables_sql = "DROP TABLE IF EXISTS crm_cronograma_deducciones_rescates, crm_certificados_eventos, crm_certificados, crm_contratos, crm_fondos, crm_asesores, crm_inversionistas CASCADE;"
        tgt_cur.execute(drop_tables_sql)
        
        with open("schema_clone.sql", "r", encoding="utf-8") as f:
            ddl_sql = f.read()
        
        # Ejecutar el bloque completo
        tgt_cur.execute(ddl_sql)
        print("  [OK] Tablas e Indices creados/verificados en Destino.")
    except Exception as e:
        print(f"  [-] Error al ejecutar DDL: {e}")
        tgt_conn.close()
        sys.exit(1)

    # 3. Conectando a Origen
    print("\n[3/4] Conectando a la base de datos ORIGEN...")
    try:
        src_conn = psycopg2.connect(
            host=SRC_HOST,
            port=5432,
            database="postgres",
            user=SRC_USER,
            password=SRC_PASS,
            sslmode="require",
            connect_timeout=15
        )
        register_default_jsonb(src_conn)
        src_cur = src_conn.cursor()
        print("  [OK] Conectado a Origen.")
    except Exception as e:
        print(f"  [-] Error al conectar a Origen: {e}")
        tgt_conn.close()
        sys.exit(1)

    # 4. Clonar Datos
    print("\n[4/4] Migrando registros tabla por tabla...")
    
    # Primero limpiar destino en orden inverso para evitar violacion de FK
    print("  [LIMPIEZA] Vaciando tablas en Destino...")
    for table in reversed(TABLES_ORDER):
        try:
            tgt_cur.execute(f"TRUNCATE TABLE public.{table} CASCADE;")
            print(f"    [OK] Tabla {table} vaciada.")
        except Exception as e:
            print(f"    [WARN] Alerta al vaciar {table}: {e}")

    # Copiar datos en orden directo de dependencias
    for table in TABLES_ORDER:
        print(f"\n  [MIGRACION] Copiando tabla: {table}")
        
        # Leer de Origen
        try:
            src_cur.execute(f"SELECT * FROM public.{table};")
            rows = src_cur.fetchall()
            colnames = [desc[0] for desc in src_cur.description]
            print(f"    [INFO] Filas encontradas: {len(rows)}")
        except Exception as e:
            print(f"    [WARN] Fallo al leer de {table} en origen (saltando): {e}")
            src_conn.rollback()
            continue

        if not rows:
            print("    [INFO] Sin registros para migrar.")
            continue

        # Escribir en Destino
        try:
            # Crear la consulta INSERT dinamica usando execute_values para velocidad maxima
            columns_str = ", ".join(colnames)
            insert_query = f"INSERT INTO public.{table} ({columns_str}) VALUES %s;"
            
            # Ejecutar en lote super rapido
            execute_values(tgt_cur, insert_query, rows)
            print(f"    [OK] Insertados {len(rows)} registros con éxito.")
        except Exception as e:
            print(f"    [-] Error al insertar registros en {table}: {e}")
            # Si falla, cerramos conexiones
            src_conn.close()
            tgt_conn.close()
            sys.exit(1)

    # Cerrar conexiones
    src_conn.close()
    tgt_conn.close()
    print("\n=== CLONACION CONCLUIDA CON EXITO TOTAL ===")

if __name__ == "__main__":
    main()
