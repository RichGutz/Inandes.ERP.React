# vps_check_db_tables.py
import paramiko
import sys

VPS_HOST = "91.108.125.253"
VPS_USER = "root"
VPS_PASS = "Thiagutz061121@"

def main():
    print("=== OBTENIENDO LISTA DE TABLAS Y VISTAS DE vinjzmqwaqsqzoigqpxk ===")
    
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(hostname=VPS_HOST, username=VPS_USER, password=VPS_PASS, timeout=15)
        print("[OK] Conectado al VPS.")
    except Exception as e:
        print(f"[-] Error de conexion SSH: {e}")
        sys.exit(1)

    # Listar tablas
    cmd_tables = (
        'export PGPASSWORD="VivaLaVida2026$"; '
        'psql -h aws-1-ap-northeast-1.pooler.supabase.com -U postgres.vinjzmqwaqsqzoigqpxk -d postgres -c "\\dt"'
    )
    stdin, stdout, stderr = client.exec_command(cmd_tables)
    tables_out = stdout.read().decode('utf-8', errors='replace')
    print("\n--- TABLAS (\\dt) ---")
    print(tables_out)

    # Listar vistas
    cmd_views = (
        'export PGPASSWORD="VivaLaVida2026$"; '
        'psql -h aws-1-ap-northeast-1.pooler.supabase.com -U postgres.vinjzmqwaqsqzoigqpxk -d postgres -c "\\dv"'
    )
    stdin, stdout, stderr = client.exec_command(cmd_views)
    views_out = stdout.read().decode('utf-8', errors='replace')
    print("\n--- VISTAS (\\dv) ---")
    print(views_out)

    client.close()

if __name__ == "__main__":
    main()
