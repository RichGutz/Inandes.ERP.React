# vps_clone_production.py
import paramiko
import sys
import time

VPS_HOST = "91.108.125.253"
VPS_USER = "root"
VPS_PASS = "N4pee0BVZsL@r6dJz4R+"

def main():
    print("=== CLONANDO BASE DE DATOS DE PRODUCCION DESDE EL VPS ===")
    
    # Conectando al VPS
    print(f"Conectando al VPS Hostinger ({VPS_HOST})...")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(hostname=VPS_HOST, username=VPS_USER, password=VPS_PASS, timeout=15)
        print("[OK] Conectado al VPS.")
    except Exception as e:
        print(f"[-] Error de conexion SSH: {e}")
        sys.exit(1)

    # Comando de clonacion directo
    # Dumper: h db.qwtwwidjfiymqgtmfhib.supabase.co
    # Inyector: h aws-0-us-east-1.pooler.supabase.com
    cmd = (
        'export PGPASSWORD="VivaLaVida2026$"; '
        'pg_dump -h db.qwtwwidjfiymqgtmfhib.supabase.co -U postgres -d postgres --no-owner --no-acl --clean | '
        'PGPASSWORD="VivaLaVida2026" psql -h aws-0-us-east-1.pooler.supabase.com -U postgres.egvcinsbyropumybatdf -d postgres -p 5432'
    )
    
    print("\nEjecutando tunel de clonacion directa en el VPS (Produccion -> Pruebas)...")
    print("Esto puede tardar unos segundos...")
    
    stdin, stdout, stderr = client.exec_command(cmd)
    
    # Monitorear salida
    exit_status = stdout.channel.recv_exit_status()
    out = stdout.read().decode('utf-8', errors='replace')
    err = stderr.read().decode('utf-8', errors='replace')
    
    print(f"\nCodigo de salida: {exit_status}")
    if exit_status == 0:
        print("\n=== CLONACION DE PRODUCCION COMPLETADA CON EXITO ===")
        # Imprimir primeras lineas de salida o confirmacion
        print("Detalle:")
        print("\n".join(out.splitlines()[-10:])) # Ultimas 10 lineas de la restauracion
    else:
        print("\n[-] Error durante la clonacion:")
        print(err)
        print(out)
        
    client.close()

if __name__ == "__main__":
    main()
