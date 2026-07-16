# backend/routers/retornos.py
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import sys
import os

# Agregar paths del ERP para la importación del motor contable
sys.path.insert(0, '/opt/erp_inandes/CRM_Inandes')

try:
    from modules.CALCULO_Retornos_Intereses_v40 import generate_retornos_v40
except ImportError:
    # Fallback para desarrollo local
    def generate_retornos_v40(*args, **kwargs):
        raise NotImplementedError("Motor v40 no cargado en el entorno local.")

router = APIRouter()

class RetornoPreviewResponse(BaseModel):
    id_certificado: str
    id_certificado_origen: str
    id_contrato: str
    tipo_evento: str
    fecha_periodo_origen: str
    fecha_periodo_fin: str
    capital_base: float
    tasa_aplicada: float
    interes_generado_bruto: float
    impuestos_renta: float
    interes_neto_disponible: float
    monto_capitalizacion: float
    monto_reparto: float
    monto_deduccion: float
    monto_rescate: float
    penalidad_rescate: float
    capital_final_saldo: float
    dias_calculados: int
    payload_asiento: Dict[str, Any]

@router.get("/preview", response_model=List[RetornoPreviewResponse])
def get_retornos_preview(
    fecha_inicio: str = Query("2026-01-01", description="Fecha de inicio YYYY-MM-DD"),
    fecha_corte: str = Query(..., description="Fecha de corte YYYY-MM-DD"),
    codigo_fondo: Optional[str] = Query(None, description="Codigo de fondo"),
    codigo_inversionista: Optional[str] = Query(None, description="Filtrar por nombre o codigo de inversionista")
):
    try:
        asientos, _, _ = generate_retornos_v40(
            codigo_fondo=codigo_fondo,
            fecha_inicio=fecha_inicio,
            fecha_corte=fecha_corte,
            return_data=True
        )
        
        # Filtrar si se solicita uno especifico
        if codigo_inversionista:
            term = codigo_inversionista.lower()
            asientos = [
                a for a in asientos 
                if term in a["id_certificado"].lower() or term in a.get("id_contrato", "").lower()
            ]
            
        return asientos
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/oficializar")
def oficializar_retornos(
    fecha_inicio: str = Query("2026-01-01"),
    fecha_corte: str = Query(...),
    codigo_fondo: Optional[str] = Query(None)
):
    try:
        from data.supabase_client import get_supabase_client
        supabase = get_supabase_client()
        
        asientos, _, _ = generate_retornos_v40(
            codigo_fondo=codigo_fondo,
            fecha_inicio=fecha_inicio,
            fecha_corte=fecha_corte,
            return_data=True
        )
        
        if not asientos:
            return {"status": "empty", "message": "No hay asientos para registrar en este periodo."}
            
        chunk_size = 50
        inserted_total = 0
        contratos_cerrar_fin = set()
        contratos_cerrar_rescate = set()
        ids_cronograma = set()
        
        for asiento in asientos:
            payload = asiento.get("payload_asiento", {})
            for resc in payload.get("detalle_rescates", []):
                if resc.get("id_registro"): ids_cronograma.add(resc["id_registro"])
            for ded in payload.get("detalle_deducciones", []):
                if ded.get("id_registro"): ids_cronograma.add(ded["id_registro"])
            
            if float(asiento.get("capital_final_saldo", 0)) <= 0:
                if asiento.get("monto_rescate", 0) > 0:
                    contratos_cerrar_rescate.add(asiento["id_contrato"])
                else:
                    contratos_cerrar_fin.add(asiento["id_contrato"])
                    
        # 1. Insert Ledger
        for i in range(0, len(asientos), chunk_size):
            chunk = asientos[i:i + chunk_size]
            res = supabase.table('crm_certificados_eventos').insert(chunk).execute()
            inserted_total += len(res.data)
            
        # 2. Update Contratos
        if contratos_cerrar_fin:
            l_c = list(contratos_cerrar_fin)
            for i in range(0, len(l_c), chunk_size):
                supabase.table('crm_contratos').update({"estado": "cerrado"}).in_("id_contrato", l_c[i:i+chunk_size]).execute()
                
        if contratos_cerrar_rescate:
            l_c = list(contratos_cerrar_rescate)
            for i in range(0, len(l_c), chunk_size):
                supabase.table('crm_contratos').update({"estado": "cerrado"}).in_("id_contrato", l_c[i:i+chunk_size]).execute()
                
        # 3. Update Cronograma
        if ids_cronograma:
            l_id = list(ids_cronograma)
            for i in range(0, len(l_id), chunk_size):
                supabase.table('crm_cronograma_deducciones_rescates').update({"estado": "PROCESADO"}).in_("id_cuota", l_id[i:i+chunk_size]).execute()
                
        return {
            "status": "success",
            "inserted_asientos": inserted_total,
            "contracts_closed": len(contratos_cerrar_fin) + len(contratos_cerrar_rescate),
            "cronograma_processed": len(ids_cronograma)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/rollback")
def rollback_retornos(
    fecha_corte: str = Query(..., description="Fecha fin del periodo a revertir YYYY-MM-DD")
):
    try:
        from data.supabase_client import get_supabase_client
        supabase = get_supabase_client()
        
        TIPOS_v40 = ['cierre_fin_ciclo', 'cierre_fin_contrato']
        
        registros_periodo = supabase.table('crm_certificados_eventos')\
            .select('id_contrato, tipo_evento, payload_asiento')\
            .eq('fecha_periodo_fin', fecha_corte)\
            .in_('tipo_evento', TIPOS_v40)\
            .execute().data or []
            
        if not registros_periodo:
            return {"status": "empty", "message": "No se encontraron asientos para este periodo."}
            
        contratos_revertir = set()
        ids_cron_revertir = set()
        chunk_size = 50
        
        for reg in registros_periodo:
            contratos_revertir.add(reg["id_contrato"])
            payload = reg.get("payload_asiento", {})
            for resc in payload.get("detalle_rescates", []):
                if resc.get("id_registro"): ids_cron_revertir.add(resc["id_registro"])
            for ded in payload.get("detalle_deducciones", []):
                if ded.get("id_registro"): ids_cron_revertir.add(ded["id_registro"])
                
        # 1. Revertir Contratos
        if contratos_revertir:
            l_c = list(contratos_revertir)
            for i in range(0, len(l_c), chunk_size):
                supabase.table('crm_contratos').update({"estado": "emitido"}).in_("id_contrato", l_c[i:i+chunk_size]).execute()
                
        # 2. Revertir Cronogramas
        if ids_cron_revertir:
            l_id = list(ids_cron_revertir)
            for i in range(0, len(l_id), chunk_size):
                supabase.table('crm_cronograma_deducciones_rescates')\
                    .update({"estado": "PENDIENTE"})\
                    .in_('id_cuota', l_id[i:i+chunk_size]).execute()
                    
        # 3. Borrar asientos del ledger
        supabase.table('crm_certificados_eventos')\
            .delete()\
            .eq('fecha_periodo_fin', fecha_corte)\
            .in_('tipo_evento', TIPOS_v40)\
            .execute()
            
        return {
            "status": "success",
            "asientos_deleted": len(registros_periodo),
            "contracts_reverted": len(contratos_revertir),
            "cronograma_reverted": len(ids_cron_revertir)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
