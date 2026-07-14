# backend/routers/valor_cuota.py
from fastapi import APIRouter, HTTPException, Query
from typing import Optional, List, Dict, Any
import sys
import os

# Agregar paths del ERP para la importación del motor contable
sys.path.insert(0, '/opt/erp_inandes/CRM_Inandes')

try:
    from scripts_cuotas.generate_cuotas_v25 import get_v25_calculation_data
except ImportError:
    # Fallback para desarrollo local
    def get_v25_calculation_data(*args, **kwargs):
        raise NotImplementedError("Motor v25 de Valor Cuota no cargado.")

router = APIRouter()

@router.get("/diario")
def get_valor_cuota_diario(
    codigo_fondo: Optional[str] = Query(None, description="Codigo de fondo (ej. NSGPEN01)")
):
    try:
        reportes = get_v25_calculation_data(codigo_fondo=codigo_fondo)
        return reportes
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
