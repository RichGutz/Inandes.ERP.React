# vps_find_cuotas_and_comisiones.py
import paramiko
import sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

VPS_HOST = "91.108.125.253"
VPS_USER = "root"
VPS_PASS = "Thiagutz061121@"

def main():
    print("=== CONFIRMANDO RUTAS DE SCRIPTS DE COMISIONES Y VALOR CUOTA EN EL VPS ===")
    
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(hostname=VPS_HOST, username=VPS_USER, password=VPS_PASS, timeout=15)
        print("[OK] Conectado al VPS.")
    except Exception as e:
        print(f"[-] Error de conexion SSH: {e}")
        sys.exit(1)

    # 1. Comprobar generate_cuotas_v25.py
    cmd1 = "ls -lh /opt/erp_inandes/CRM_Inandes/scripts_cuotas/generate_cuotas_v25.py 2>/dev/null"
    stdin, stdout, stderr = client.exec_command(cmd1)
    out1 = stdout.read().decode('utf-8', errors='replace').strip()
    print("\n--- Ruta de Valor Cuota ---")
    print(out1 or "[-] No encontrado en scripts_cuotas")

    # 2. Comprobar generate_comisiones_asesores_v2.py en decommissioned
    cmd2 = "find /opt/erp_inandes/ -name 'generate_comisiones_asesores_v2.py' 2>/dev/null"
    stdin, stdout, stderr = client.exec_command(cmd2)
    out2 = stdout.read().decode('utf-8', errors='replace').strip()
    print("\n--- Ruta de Comisiones ---")
    print(out2 or "[-] No encontrado en ninguna parte")

    client.close()

if __name__ == "__main__":
    main()
