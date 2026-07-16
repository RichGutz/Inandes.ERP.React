# vps_locate_all_calculo.py
import paramiko
import sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

VPS_HOST = "91.108.125.253"
VPS_USER = "root"
VPS_PASS = "Thiagutz061121@"

def main():
    print("=== BUSCANDO SCRIPTS DE COMISIONES Y VALOR CUOTA EN EL VPS ===")
    
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(hostname=VPS_HOST, username=VPS_USER, password=VPS_PASS, timeout=15)
        print("[OK] Conectado al VPS.")
    except Exception as e:
        print(f"[-] Error de conexion SSH: {e}")
        sys.exit(1)

    # Buscar archivos *.py que contengan "comisiones" o "cuota" o "CALCULO"
    cmd = "find /opt/erp_inandes/ -name '*.py' | grep -iE 'comision|cuota|calculo' 2>/dev/null"
    stdin, stdout, stderr = client.exec_command(cmd)
    res = stdout.read().decode('utf-8', errors='replace')
    print("\n--- Scripts encontrados ---")
    print(res)

    client.close()

if __name__ == "__main__":
    main()
