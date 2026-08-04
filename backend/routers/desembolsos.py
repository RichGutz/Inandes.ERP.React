from fastapi import APIRouter, HTTPException, Body
from typing import List, Dict, Any, Optional
from datetime import date
import base64

from data import supabase_repository as db
from utils.pdf_generators import generar_voucher_transferencia_pdf
from utils.google_integration import upload_file_with_sa, get_sa_credentials_dict
import json

router = APIRouter()

@router.get("/pendientes", response_model=List[Dict[str, Any]])
def get_pendientes():
    """
    Retorna las propuestas que están en estado APROBADO,
    listas para ser desembolsadas.
    """
    try:
        proposals = db.get_approved_proposals_for_disbursement()
        return proposals
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/datos-bancarios/{ruc}", response_model=Dict[str, Any])
def get_datos_bancarios(ruc: str):
    """
    Retorna los datos del emisor usando su RUC.
    """
    try:
        data = db.get_signatory_data_by_ruc(ruc)
        if not data:
            raise HTTPException(status_code=404, detail="Emisor no encontrado")
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/generar-voucher")
def generar_voucher(payload: Dict[str, Any] = Body(...)):
    """
    Genera el PDF del Voucher de Transferencia en base64.
    Recibe:
    - datos_emisor: Dict
    - monto_total: float
    - moneda: str
    - facturas: List[Dict[numero_factura, emisor_nombre, monto]]
    """
    try:
        datos_emisor = payload.get("datos_emisor")
        monto_total = payload.get("monto_total")
        moneda = payload.get("moneda")
        facturas = payload.get("facturas")
        
        pdf_bytes = generar_voucher_transferencia_pdf(
            datos_emisor=datos_emisor,
            monto_total=monto_total,
            moneda=moneda,
            facturas=facturas,
            fecha_generacion=date.today()
        )
        
        if not pdf_bytes:
            raise HTTPException(status_code=500, detail="Error al generar PDF")
            
        b64_pdf = base64.b64encode(pdf_bytes).decode("utf-8")
        return {"file_name": "voucher_transferencia.pdf", "file_base64": b64_pdf}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/registrar")
def registrar_desembolsos(payload: Dict[str, Any] = Body(...)):
    """
    Registra el desembolso en base de datos y sube archivos a Google Drive.
    Recibe:
    - desembolsos: List[Dict[proposal_id, monto, fecha]]
    - folder_id: str
    - files: List[Dict[file_name, file_base64]] (incluye voucher y sustentos)
    - usuario_id: str (default para test)
    """
    try:
        desembolsos = payload.get("desembolsos", [])
        folder_id = payload.get("folder_id")
        files = payload.get("files", [])
        usuario_id = payload.get("usuario_id", "user_test@inandes.com")
        
        # 1. Actualizar BD
        for d in desembolsos:
            pid = d["proposal_id"]
            db.update_proposal_status(pid, "DESEMBOLSADA")
            db.add_audit_event(
                usuario_id=usuario_id,
                entidad_id=pid,
                accion="DESEMBOLSO",
                estado_anterior="APROBADO",
                estado_nuevo="DESEMBOLSADA",
                detalles_adicionales={
                    "monto_desembolsado": d["monto"],
                    "fecha_desembolso": d["fecha"]
                }
            )
            
        # 2. Subir Archivos a Drive
        if folder_id and files:
            sa_creds = get_sa_credentials_dict()
            for f in files:
                file_bytes = base64.b64decode(f["file_base64"])
                file_name = f["file_name"]
                success, msg = upload_file_with_sa(file_bytes, file_name, folder_id, sa_creds)
                if not success:
                    print(f"Error uploading {file_name} to Drive: {msg}")
                    
        return {"status": "success", "message": "Desembolsos registrados correctamente"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
