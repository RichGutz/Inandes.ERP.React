from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any
from pydantic import BaseModel
from data import supabase_repository as db

router = APIRouter()

class ApproveRequest(BaseModel):
    proposal_ids: List[str]

@router.get("/pendientes")
def get_pending_approvals():
    """
    Retorna las propuestas en estado ACTIVO.
    """
    try:
        proposals = db.get_active_proposals_for_approval()
        return proposals
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/aprobar")
def approve_proposals(request: ApproveRequest):
    """
    Aprueba una lista de propuestas cambiando su estado a APROBADO.
    """
    if not request.proposal_ids:
        raise HTTPException(status_code=400, detail="No se proporcionaron proposal_ids")
        
    try:
        success_count = 0
        errors = []
        
        for pid in request.proposal_ids:
            try:
                db.update_proposal_status(pid, 'APROBADO')
                # Audit event
                db.add_audit_event(
                    usuario_id="SISTEMA", # idealmente sacar del token
                    entidad_id=pid,
                    accion="APROBACION",
                    estado_anterior="ACTIVO",
                    estado_nuevo="APROBADO",
                    detalles_adicionales={"source": "react_app"}
                )
                success_count += 1
            except Exception as inner_e:
                errors.append(f"Error en {pid}: {str(inner_e)}")
                
        return {
            "status": "success",
            "approved_count": success_count,
            "errors": errors
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
