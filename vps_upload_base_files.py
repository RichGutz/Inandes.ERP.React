# vps_upload_base_files.py
import paramiko
import sys

VPS_HOST = "91.108.125.253"
VPS_USER = "root"
VPS_PASS = "Thiagutz061121@"

MAIN_PY = """# main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

app = FastAPI(
    title="InAndes Backend API",
    description="API REST de logica financiera y motores contables para el ERP InAndes",
    version="1.0.0"
)

# Configurar CORS para aceptar peticiones desde el frontend en React
origins = [
    "http://localhost:5173",
    "http://localhost:3000",
    "https://inandes.react.geeksoft.tech"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {
        "status": "online",
        "message": "InAndes FastAPI Backend API is running successfully."
    }

if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
"""

REQUIREMENTS_TXT = """fastapi>=0.110.0
uvicorn>=0.28.0
pydantic>=2.6.0
psycopg2-binary>=2.9.9
python-dotenv>=1.0.1
supabase>=2.4.0
requests>=2.31.0
"""

def main():
    print("=== SUBIENDO ARCHIVOS BASE AL VPS ===")
    
    # Establecer conexion SSH
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(hostname=VPS_HOST, username=VPS_USER, password=VPS_PASS, timeout=15)
        print("[OK] Conectado al VPS.")
    except Exception as e:
        print(f"[-] Error de conexion SSH: {e}")
        sys.exit(1)

    sftp = client.open_sftp()
    
    # Escribir requirements.txt
    print("Escribiendo requirements.txt...")
    with sftp.file("/opt/erp_inandes/backend/requirements.txt", "w") as f:
        f.write(REQUIREMENTS_TXT)
    print("  [OK] requirements.txt subido.")

    # Escribir main.py
    print("Escribiendo main.py...")
    with sftp.file("/opt/erp_inandes/backend/main.py", "w") as f:
        f.write(MAIN_PY)
    print("  [OK] main.py subido.")

    sftp.close()
    client.close()

if __name__ == "__main__":
    main()
