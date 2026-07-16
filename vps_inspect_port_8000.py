# vps_inspect_port_8000.py
import paramiko
import sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

VPS_HOST = "91.108.125.253"
VPS_USER = "root"
VPS_PASS = "Thiagutz061121@"

def main():
    print("=== INSPECCIONANDO QUE PROCESO USA EL PUERTO 8000 ===")
    
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(hostname=VPS_HOST, username=VPS_USER, password=VPS_PASS, timeout=15)
        print("[OK] Conectado al VPS.")
    except Exception as e:
        print(f"[-] Error de conexion SSH: {e}")
        sys.exit(1)

    cmd = "ss -lptn 'sport = :8000' && ps -ef | grep $(ss -lptn 'sport = :8000' | awk 'NR==2 {print}' | grep -o 'pid=[0-9]*' | cut -d= -f2) 2>/dev/null || true"
    stdin, stdout, stderr = client.exec_command(cmd)
    res = stdout.read().decode('utf-8', errors='replace')
    print("\n--- Proceso en Puerto 8000 ---")
    print(res if res.strip() else "No se detecto proceso activo por ss")

    # Si ss falla, probamos con lsof
    cmd2 = "lsof -i :8000"
    stdin, stdout, stderr = client.exec_command(cmd2)
    res2 = stdout.read().decode('utf-8', errors='replace')
    print("\n--- Salida lsof ---")
    print(res2 if res2.strip() else "Lsof no reporto nada.")

    client.close()

if __name__ == "__main__":
    main()
