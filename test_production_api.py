# test_production_api.py
import requests
import json

BASE_URL = "https://inandes.react.geeksoft.tech/api"

def main():
    print(f"=== PROBANDO CONEXION HTTPS DE PRODUCCION A LA API REST DEL VPS ({BASE_URL}) ===")
    
    # 1. Probar endpoint raiz de la API
    try:
        res = requests.get(f"{BASE_URL}/", timeout=10)
        print("API Root Status:", res.status_code)
        print("API Root Response:", res.json())
    except Exception as e:
        print("[-] Error de conexion a root:", e)
        return

    # 2. Probar endpoint de preview de retornos (Motor V40)
    print("\nProbando preview de retornos en producción...")
    url_preview = f"{BASE_URL}/retornos/preview"
    params = {
        "fecha_inicio": "2026-01-01",
        "fecha_corte": "2026-02-28",
        "codigo_fondo": "NSGPEN01"
    }
    try:
        res = requests.get(url_preview, params=params, timeout=20)
        print("Preview Status:", res.status_code)
        if res.status_code == 200:
            data = res.json()
            print(f"[OK] Se recibieron {len(data)} asientos del fondo NSGPEN01 exitosamente.")
            if data:
                print("\nEjemplo de primer asiento devuelto:")
                print(json.dumps(data[0], indent=2, ensure_ascii=False)[:1000])
        else:
            print("[-] Error en preview:", res.text)
    except Exception as e:
        print("[-] Error en conexion a preview:", e)

if __name__ == "__main__":
    main()
