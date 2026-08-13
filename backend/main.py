# backend/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import retornos, comisiones, valor_cuota, originacion, liquidaciones, aprobacion, desembolsos, inversionistas
import uvicorn
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(
    title="InAndes Backend API",
    description="API REST de logica financiera y motores contables para el ERP InAndes",
    version="1.0.0"
)

origins = [
    "http://localhost:5173",
    "http://localhost:3000",
    "https://inandes.react.geeksoft.tech",
    "https://inandes.geeksoft.tech",
    "https://api.geeksoft.tech"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(desembolsos.router, prefix="/api/desembolsos", tags=["desembolsos"])
app.include_router(aprobacion.router, prefix="/api/aprobacion", tags=["aprobacion"])
app.include_router(retornos.router, prefix="/api/retornos", tags=["Retornos"])
app.include_router(comisiones.router, prefix="/api/comisiones", tags=["Comisiones"])
app.include_router(valor_cuota.router, prefix="/api/valor-cuota", tags=["Valor Cuota"])
app.include_router(originacion.router, prefix="/api/originacion", tags=["originacion"])
app.include_router(liquidaciones.router, prefix="/api/liquidaciones", tags=["liquidaciones"])
app.include_router(inversionistas.router, prefix="/api/inversionistas", tags=["inversionistas"])
app.include_router(inversionistas.router, prefix="/inversionistas", tags=["inversionistas"])

@app.get("/")
def read_root():
    return {
        "status": "online",
        "message": "InAndes FastAPI Backend API is running successfully."
    }

if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
