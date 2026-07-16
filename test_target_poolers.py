# test_target_poolers.py
import psycopg2
import sys

POOLERS = [
    "aws-0-us-west-1.pooler.supabase.com",
    "aws-1-ap-northeast-1.pooler.supabase.com",
    "aws-0-us-east-1.pooler.supabase.com",
    "aws-0-sa-east-1.pooler.supabase.com",
    "aws-0-eu-central-1.pooler.supabase.com",
    "aws-0-us-west-2.pooler.supabase.com",
    "aws-0-us-east-2.pooler.supabase.com"
]

PASSWORD = "VivaLaVida2026"
USER = "postgres.egvcinsbyropumybatdf"

for host in POOLERS:
    print(f"Probando conexion en host: {host}...")
    try:
        conn = psycopg2.connect(
            host=host,
            port=5432,
            database="postgres",
            user=USER,
            password=PASSWORD,
            sslmode="require",
            connect_timeout=5
        )
        print(f"\nSUCCESS: Conexion exitosa en host: {host}")
        conn.close()
        sys.exit(0)
    except Exception as e:
        print(f"  [-] Fallido: {e}")

print("\n❌ No se pudo conectar a ninguna region de Supabase con esa contraseña.")
sys.exit(1)
