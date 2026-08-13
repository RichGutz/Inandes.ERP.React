# backend/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers.desembolsos import router as desembolsos_router
from routers.aprobacion import router as aprobacion_router
from routers.retornos import router as retornos_router
from routers.comisiones import router as comisiones_router
from routers.valor_cuota import router as valor_cuota_router
from routers.originacion import router as originacion_router
from routers.liquidaciones import router as liquidaciones_router
from routers.inversionistas import router as inversionistas_router
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

# Registrar routers modulares
app.include_router(desembolsos_router, prefix="/api/desembolsos", tags=["desembolsos"])
app.include_router(aprobacion_router, prefix="/api/aprobacion", tags=["aprobacion"])
app.include_router(retornos_router, prefix="/api/retornos", tags=["Retornos"])
app.include_router(comisiones_router, prefix="/api/comisiones", tags=["Comisiones"])
app.include_router(valor_cuota_router, prefix="/api/valor-cuota", tags=["Valor Cuota"])
app.include_router(originacion_router, prefix="/api/originacion", tags=["originacion"])
app.include_router(liquidaciones_router, prefix="/api/liquidaciones", tags=["liquidaciones"])
app.include_router(inversionistas_router, prefix="/api/inversionistas", tags=["inversionistas"])
app.include_router(inversionistas_router, prefix="/inversionistas", tags=["inversionistas"])



@app.get("/")
def read_root():
    return {
        "status": "online",
        "message": "InAndes FastAPI Backend API is running successfully."
    }

if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
