# test_production_all_apis.py
import requests
import json

BASE_URL = "https://inandes.react.geeksoft.tech/api"

def test_endpoint(name, path, params=None):
    url = f"{BASE_URL}{path}"
    print(f"\n--- Probando endpoint: {name} ({url}) ---")
    try:
        res = requests.get(url, params=params, timeout=30)
        print("Status Code:", res.status_code)
        if res.status_code == 200:
            data = res.json()
            print(f"[OK] Se recibieron {len(data)} elementos de {name}.")
            if data:
                print("Primer elemento:")
                # Limitar impresión del primer elemento
                summary = json.dumps(data[0], indent=2, ensure_ascii=False)
                if len(summary) > 600:
                    print(summary[:600] + "\n... (truncado)")
                else:
                    print(summary)
        else:
            print("[-] Error:", res.text)
    except Exception as e:
        print("[-] Excepcion de conexion:", e)

def main():
    # 1. Test Retornos Preview
    test_endpoint(
        name="Retornos Preview (V40)",
        path="/retornos/preview",
        params={"fecha_inicio": "2026-01-01", "fecha_corte": "2026-02-28", "codigo_fondo": "NSGPEN01"}
    )
    
    # 2. Test Valor Cuota
    test_endpoint(
        name="Valor Cuota (V25)",
        path="/valor-cuota/diario",
        params={"codigo_fondo": "NSGPEN01"}
    )
    
    # 3. Test Comisiones de Asesores
    test_endpoint(
        name="Comisiones de Asesores (V2)",
        path="/comisiones/calcular",
        params={"target_year": 2026}
    )

if __name__ == "__main__":
    main()
