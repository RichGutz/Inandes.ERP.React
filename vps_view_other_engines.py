# vps_view_other_engines.py
import paramiko
import sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

VPS_HOST = "91.108.125.253"
VPS_USER = "root"
VPS_PASS = "Thiagutz061121@"

def main():
    print("=== LEER MOTORES ADICIONALES EN EL VPS ===")
    
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(hostname=VPS_HOST, username=VPS_USER, password=VPS_PASS, timeout=15)
        print("[OK] Conectado al VPS.")
    except Exception as e:
        print(f"[-] Error de conexion SSH: {e}")
        sys.exit(1)

    # 1. Leer Valor Cuota V25
    print("\n--- Cabecera CALCULO_Valor_Cuota_V25.py ---")
    cmd_vc = "head -n 60 /opt/erp_inandes/CRM_Inandes/modules/CALCULO_Valor_Cuota_V25.py"
    stdin, stdout, stderr = client.exec_command(cmd_vc)
    print(stdout.read().decode('utf-8', errors='replace'))

    # 2. Leer Comisiones V2
    print("\n--- Cabecera CALCULO_Comisiones_Asesores_V2.py ---")
    cmd_co = "head -n 60 /opt/erp_inandes/CRM_Inandes/modules/CALCULO_Comisiones_Asesores_V2.py"
    stdin, stdout, stderr = client.exec_command(cmd_co)
    print(stdout.read().decode('utf-8', errors='replace'))

    client.close()

if __name__ == "__main__":
    main()
