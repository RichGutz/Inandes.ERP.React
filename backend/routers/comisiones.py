# backend/routers/comisiones.py
from fastapi import APIRouter, HTTPException, Query
from typing import Optional, List, Dict, Any
import sys
import os
import pandas as pd

# Agregar paths del ERP para la importación del motor contable
sys.path.insert(0, '/opt/erp_inandes/CRM_Inandes')

try:
    from scripts_cuotas.generate_comisiones_asesores_v2 import generate_proyeccion_comisiones_v2
except ImportError:
    # Fallback para desarrollo local
    def generate_proyeccion_comisiones_v2(*args, **kwargs):
        raise NotImplementedError("Motor de Comisiones de Asesores no cargado.")

router = APIRouter()

@router.get("/calcular")
def calcular_comisiones(
    codigo_asesor: Optional[str] = Query(None, description="Codigo del asesor"),
    target_year: int = Query(2026, description="Año objetivo para la proyección")
):
    try:
        df = generate_proyeccion_comisiones_v2(codigo_asesor=codigo_asesor, target_year=target_year)
        if df.empty:
            return []
        return df.to_dict(orient='records')
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
