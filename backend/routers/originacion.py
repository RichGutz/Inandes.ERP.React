import os
import tempfile
import base64
import json
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, UploadFile, File, Body
from pydantic import BaseModel

# Imports from legacy backend
from services import pdf_parser
from utils import google_integration, pdf_generators
from data import supabase_repository as db
from core.factoring_calculator import procesar_lote_desembolso_inicial, procesar_lote_encontrar_tasa

router = APIRouter()

# --- Schemas ---

class InvoiceData(BaseModel):
    # Flexible schema to receive parsed and edited invoice data
    group_id: Optional[int] = None
    parsed_pdf_name: Optional[str] = None
    emisor_ruc: Optional[str] = None
    aceptante_ruc: Optional[str] = None
    fecha_emision_factura: Optional[str] = None
    monto_total_factura: Optional[float] = None
    monto_neto_factura: Optional[float] = None
    moneda_factura: Optional[str] = None
    numero_factura: Optional[str] = None
    emisor_nombre: Optional[str] = None
    aceptante_nombre: Optional[str] = None
    fecha_desembolso_factoring: Optional[str] = None
    fecha_pago_calculada: Optional[str] = None
    tasa_de_avance: Optional[float] = None
    interes_mensual: Optional[float] = None
    interes_moratorio: Optional[float] = None
    comision_afiliacion_pen: Optional[float] = None
    comision_afiliacion_usd: Optional[float] = None
    dias_minimos_interes_individual: Optional[int] = None
    detraccion_porcentaje: Optional[float] = None
    plazo_credito_dias: Optional[int] = None
    plazo_operacion_calculado: Optional[int] = None
    recalculate_result: Optional[Dict[str, Any]] = None
    contract_number: Optional[str] = None
    anexo_number: Optional[str] = None
    lote_id: Optional[str] = None
    comision_de_estructuracion_global: Optional[float] = None
    detraccion_monto: Optional[float] = None

class GeneratePDFRequest(BaseModel):
    invoices: List[Dict[str, Any]]

class FormalizeFile(BaseModel):
    filename: str
    content_base64: str

class FormalizeBatchRequest(BaseModel):
    folder_id: str
    lote_id: str
    contract_number: str
    anexo_number: str
    invoices: List[Dict[str, Any]]
    files_to_upload: List[FormalizeFile]


# --- Endpoints ---

@router.post("/parse-invoices")
async def parse_invoices(files: List[UploadFile] = File(...)):
    """
    Recibe multiples PDFs de facturas, los guarda temporalmente,
    los parsea usando pdf_parser.py y retorna la data extraida.
    Optimizacion: 1 query bulk a Supabase para todos los RUCs (en vez de 3 por PDF).
    """
    # --- Fase 1: Parsear todos los PDFs sin tocar la DB ---
    raw_results = []
    for file in files:
        file_bytes = await file.read()
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            tmp.write(file_bytes)
            temp_file_path = tmp.name
        try:
            parsed_data = pdf_parser.extract_fields_from_pdf(temp_file_path)
            raw_results.append({
                "filename": file.filename,
                "parsed_data": parsed_data,
                "has_error": bool(parsed_data.get("error")) if isinstance(parsed_data, dict) else True,
            })
        except Exception as e:
            raw_results.append({"filename": file.filename, "parsed_data": {}, "has_error": True, "exc": str(e)})
        finally:
            if os.path.exists(temp_file_path):
                os.remove(temp_file_path)

    # --- Fase 2: Recolectar RUCs unicos -> 1 sola query a Supabase ---
    unique_rucs = set()
    for r in raw_results:
        if not r["has_error"]:
            p = r["parsed_data"] or {}
            if p.get("emisor_ruc"):
                unique_rucs.add(str(p["emisor_ruc"]).strip())
            if p.get("aceptante_ruc"):
                unique_rucs.add(str(p["aceptante_ruc"]).strip())

    db_cache = db.get_bulk_emisor_data(list(unique_rucs))

    # --- Fase 3: Armar respuesta usando el cache ---
    results = []
    for r in raw_results:
        if r["has_error"]:
            err_msg = r.get("exc") or r.get("parsed_data", {}).get("error", "Error desconocido")
            results.append({"filename": r["filename"], "error": err_msg})
            continue

        p = r["parsed_data"] or {}
        emisor_ruc = str(p.get("emisor_ruc", "")).strip()
        aceptante_ruc = str(p.get("aceptante_ruc", "")).strip()

        emisor_entry = db_cache.get(emisor_ruc, {})
        aceptante_entry = db_cache.get(aceptante_ruc, {})

        emisor_rates = emisor_entry.get("rates", {}) if emisor_ruc else {}
        clean_rates = {}
        for k, v in emisor_rates.items():
            clean_rates[k] = v if v is not None else 0

        results.append({
            "filename": r["filename"],
            "parsed_data": p,
            "emisor_nombre": emisor_entry.get("razon_social", ""),
            "aceptante_nombre": aceptante_entry.get("razon_social", ""),
            "db_rates": clean_rates,
        })

    return {"results": results}


@router.post("/calcular_desembolso_lote")
def calcular_desembolso_lote_endpoint(payload: List[Dict[str, Any]] = Body(...)):
    """
    Realiza el calculo de simulacion de desembolso para un lote de facturas.
    Si alguna factura trae "monto_objetivo", asume logica de Goal Seek.
    """
    try:
        # Detectar si es Goal Seek o Calculo Inicial
        is_goal_seek = any(inv.get("monto_objetivo") is not None for inv in payload)
        if is_goal_seek:
            return procesar_lote_encontrar_tasa(payload)
        else:
            return procesar_lote_desembolso_inicial(payload)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/drive/list")
def list_drive_folders(folder_id: Optional[str] = None):
    """
    Lista subcarpetas en Google Drive para el Drive Picker.
    """
    try:
        sa_creds = google_integration.get_sa_credentials_dict()
        folders = google_integration.list_folders_with_sa(folder_id, sa_creds)
        return {"folders": folders}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def _normalize_inv(inv: Dict[str, Any]) -> Dict[str, Any]:
    recalc = inv.get("recalculate_result") or {}
    if not isinstance(recalc, dict):
        return inv
        
    monto_neto = float(inv.get("monto_neto_factura") or 0.0)
    tasa_avance = float(inv.get("tasa_de_avance") or 90.0) / 100.0
    
    def _extract(key: str, default: float = 0.0) -> float:
        if key in recalc and isinstance(recalc[key], (int, float)):
            return float(recalc[key])
        d = recalc.get("desglose_final_detallado") or {}
        if isinstance(d, dict) and key in d:
            item = d[key]
            if isinstance(item, dict) and "monto" in item and isinstance(item["monto"], (int, float)):
                return float(item["monto"])
            elif isinstance(item, (int, float)):
                return float(item)
        c = recalc.get("calculo_con_tasa_encontrada") or {}
        if isinstance(c, dict) and key in c and isinstance(c[key], (int, float)):
            return float(c[key])
        return default

    capital = _extract("capital", monto_neto * tasa_avance)
    interes = _extract("interes", 0.0)
    igv_interes = _extract("igv_interes", interes * 0.18)
    com_est = _extract("comision_estructuracion", 0.0)
    igv_com_est = _extract("igv_comision_estructuracion", _extract("igv_comision", com_est * 0.18))
    com_afi = _extract("comision_afiliacion", 0.0)
    igv_com_afi = _extract("igv_afiliacion", 0.0)
    
    abono = _extract("abono", _extract("abono_real_teorico", capital - interes - igv_interes - com_est - igv_com_est))
    margen_seguridad = _extract("margen_seguridad", monto_neto - capital)
    plazo_operacion = int(_extract("plazo_operacion", inv.get("plazo_operacion_calculado", 0)))
    tasa_encontrada = _extract("tasa_avance_encontrada", tasa_avance)

    pct_interes = (interes / monto_neto * 100) if monto_neto > 0 else 0.0
    pct_com_est = (com_est / monto_neto * 100) if monto_neto > 0 else 0.0
    pct_com_afi = (com_afi / monto_neto * 100) if monto_neto > 0 else 0.0
    pct_margen = (margen_seguridad / monto_neto * 100) if monto_neto > 0 else 0.0
    pct_abono = (abono / monto_neto * 100) if monto_neto > 0 else 0.0
    igv_total = igv_interes + igv_com_est + igv_com_afi

    normalized = {
        "capital": round(capital, 2),
        "interes": round(interes, 2),
        "igv_interes": round(igv_interes, 2),
        "comision_estructuracion": round(com_est, 2),
        "igv_comision_estructuracion": round(igv_com_est, 2),
        "igv_comision": round(igv_com_est, 2),
        "comision_afiliacion": round(com_afi, 2),
        "igv_afiliacion": round(igv_com_afi, 2),
        "abono_real_teorico": round(abono, 2),
        "margen_seguridad": round(margen_seguridad, 2),
        "plazo_operacion": plazo_operacion,
        
        "calculo_con_tasa_encontrada": {
            "capital": round(capital, 2),
            "igv_interes": round(igv_interes, 2),
            "igv_comision_estructuracion": round(igv_com_est, 2),
            "igv_afiliacion": round(igv_com_afi, 2),
            "plazo_operacion": plazo_operacion
        },
        "resultado_busqueda": {
            "tasa_avance_encontrada": tasa_encontrada
        },
        "desglose_final_detallado": {
            "interes": {"monto": round(interes, 2), "porcentaje": round(pct_interes, 2)},
            "comision_estructuracion": {"monto": round(com_est, 2), "porcentaje": round(pct_com_est, 2)},
            "comision_afiliacion": {"monto": round(com_afi, 2), "porcentaje": round(pct_com_afi, 2)},
            "abono": {"monto": round(abono, 2), "porcentaje": round(pct_abono, 2)},
            "margen_seguridad": {"monto": round(margen_seguridad, 2), "porcentaje": round(pct_margen, 2)},
            "igv_total": {"monto": round(igv_total, 2)}
        }
    }
    
    inv_copy = dict(inv)
    inv_copy["recalculate_result"] = normalized
    return inv_copy


@router.post("/generate-pdfs")
def generate_pdfs(request: GeneratePDFRequest):
    """
    Genera el Perfil de Operación y el Anexo de Liquidación (PDFs)
    a partir del lote de facturas precalculadas.
    Devuelve los PDFs en formato base64.
    """
    if not request.invoices:
        raise HTTPException(status_code=400, detail="No invoices provided")
        
    try:
        invoices = [_normalize_inv(dict(inv)) for inv in request.invoices]

        # Generar Perfil de Operación
        pdf_perfil_bytes = pdf_generators.generate_perfil_operacion_pdf(invoices)
        perfil_b64 = base64.b64encode(pdf_perfil_bytes).decode('utf-8')
        
        # Preparar data del banco para el anexo
        bank_info_dict = {}
        first_emisor_ruc = invoices[0].get('emisor_ruc')
        if first_emisor_ruc:
            raw_emisor_data = db.get_signatory_data_by_ruc(first_emisor_ruc)
            if raw_emisor_data:
                currency = invoices[0].get('moneda_factura', 'PEN')
                suffix = "PEN" if currency == 'PEN' else "USD"
                bank_info_dict = {
                    'banco': raw_emisor_data.get('Institucion Financiera', 'N/A'),
                    'cuenta': raw_emisor_data.get(f'Numero de Cuenta {suffix}', 'N/A'),
                    'cci': raw_emisor_data.get(f'Numero de CCI {suffix}', 'N/A')
                }
                
        # Generar Anexo de Liquidación
        pdf_liquidacion_bytes = pdf_generators.generar_anexo_liquidacion_pdf(invoices, bank_info=bank_info_dict)
        liquidacion_b64 = base64.b64encode(pdf_liquidacion_bytes).decode('utf-8')
        
        return {
            "perfil_pdf_base64": perfil_b64,
            "liquidacion_pdf_base64": liquidacion_b64
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generando PDFs: {str(e)}")


@router.post("/formalize")
def formalize_batch(request: FormalizeBatchRequest):
    """
    Sube los archivos originales y generados a Google Drive.
    Guarda las propuestas en la Base de Datos.
    """
    try:
        sa_creds = google_integration.get_sa_credentials_dict()
        uploaded_links = []
        
        # 1. Subir archivos a Google Drive
        for f in request.files_to_upload:
            file_bytes = base64.b64decode(f.content_base64)
            success, file_id = google_integration.upload_file_with_sa(
                file_bytes, 
                f.filename, 
                request.folder_id, 
                sa_creds
            )
            if not success:
                raise Exception(f"Fallo al subir archivo {f.filename} a Drive")
            
            drive_link = f"https://drive.google.com/file/d/{file_id}/view"
            uploaded_links.append({"filename": f.filename, "link": drive_link})
            
            # Si el archivo subido corresponde a una factura original, inyectar el link en el invoice
            for inv in request.invoices:
                if f.filename.startswith(inv.get('emisor_ruc', '')) and str(inv.get('numero_factura', '')) in f.filename:
                    inv['drive_link'] = drive_link

        # 2. Guardar en Base de Datos
        saved_count = 0
        for inv in request.invoices:
            # Sanitización
            contract_num = request.contract_number
            anexo_num = request.anexo_number
            
            import re
            def sanitize_id_for_db(val):
                if not val: return None
                match = re.match(r'^(\d+)', str(val))
                if match: return int(match.group(1))
                return None

            inv['contract_number'] = sanitize_id_for_db(contract_num)
            inv['anexo_number'] = sanitize_id_for_db(anexo_num)
            
            success_db, msg_db = db.save_proposal(inv, request.lote_id)
            if success_db:
                saved_count += 1
                # Integración con timeline asíncrona/segura
                try:
                    from data.invoice_tracking_helpers import create_or_update_invoice_status, add_timeline_event
                    create_or_update_invoice_status(inv['proposal_id'], inv, stage='CREACION')
                    add_timeline_event(
                        inv['proposal_id'],
                        'ORIGINACION',
                        f"Factura ingresada vía API. Lote: {request.lote_id}",
                        'FACTURA',
                        f"{inv.get('numero_factura')}.pdf",
                        None
                    )
                except Exception as e:
                    print(f"Error en tracking DB: {str(e)}")
            else:
                raise Exception(f"Error DB al guardar {inv.get('numero_factura')}: {msg_db}")
                
        return {
            "status": "success",
            "saved_invoices": saved_count,
            "uploaded_files": len(request.files_to_upload),
            "links": uploaded_links
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/operaciones")
def get_operaciones_endpoint(estado: Optional[str] = None):
    """
    Obtiene operaciones/propuestas registradas en Supabase a traves del servicio backend.
    """
    try:
        raw = db.get_all_proposals(estado_filter=estado)
        parsed_ops = []
        for item in raw:
            rJson = {}
            if item.get('recalculate_result_json'):
                try:
                    raw_j = item['recalculate_result_json']
                    rJson = json.loads(raw_j) if isinstance(raw_j, str) else raw_j
                except Exception:
                    pass
            
            calc = rJson.get('calculo_con_tasa_encontrada') or {}
            desglose = rJson.get('desglose_final_detallado') or {}

            montoBruto = float(item.get('monto_total_factura') or item.get('monto_neto_factura') or 0.0)
            montoNeto = float(item.get('monto_neto_factura') or 0.0)
            interes = float(desglose.get('interes', {}).get('monto') or calc.get('interes') or item.get('interes_calculado') or 0.0)
            comisiones = float(desglose.get('comision_estructuracion', {}).get('monto') or calc.get('comision_estructuracion') or 0.0)
            abonoReal = float(desglose.get('abono', {}).get('monto') or calc.get('abono') or item.get('abono_real_calculado') or (montoNeto - interes - comisiones))
            diasPromedio = int(calc.get('plazo_operacion') or item.get('plazo_operacion_calculado') or 30)

            st = item.get('estado', 'ORIGINADO')
            if st in ['ACTIVO', 'PENDIENTE']:
                st = 'ORIGINADO'

            parsed_ops.append({
                "id": item.get('proposal_id'),
                "proposal_id": item.get('proposal_id'),
                "emisor_ruc": item.get('emisor_ruc', ''),
                "emisor_nombre": item.get('emisor_nombre', 'S/N'),
                "aceptante_ruc": item.get('aceptante_ruc', ''),
                "aceptante_nombre": item.get('aceptante_nombre', 'S/N'),
                "moneda": item.get('moneda_factura', 'PEN'),
                "monto_bruto_total": montoBruto,
                "monto_neto_total": montoNeto,
                "interes_total": interes,
                "abono_real_total": abonoReal,
                "comisiones_fijas": comisiones,
                "dias_promedio": diasPromedio,
                "estado": st,
                "fecha_desembolso_esperada": str(item.get('fecha_desembolso_factoring') or ''),
                "fecha_creacion": str(item.get('fecha_registro') or '')
            })

        return {"operaciones": parsed_ops}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

