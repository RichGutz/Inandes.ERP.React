# backend/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import retornos, comisiones, valor_cuota
import uvicorn
from dotenv import load_dotenv

# Cargar variables de entorno del archivo .env local
load_dotenv()

app = FastAPI(
    title="InAndes Backend API",
    description="API REST de logica financiera y motores contables para el ERP InAndes",
    version="1.0.0"
)

# Configurar CORS para aceptar peticiones desde el frontend en React (local y produccion)
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

# Registrar routers modulares
app.include_router(retornos.router, prefix="/api/retornos", tags=["Retornos"])
app.include_router(comisiones.router, prefix="/api/comisiones", tags=["Comisiones"])
app.include_router(valor_cuota.router, prefix="/api/valor-cuota", tags=["Valor Cuota"])

@app.get("/")
def read_root():
    return {
        "status": "online",
        "message": "InAndes FastAPI Backend API is running successfully."
    }

if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
