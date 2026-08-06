import sys
import os
import json
from datetime import datetime, date
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Response
from pydantic import BaseModel
from typing import Optional, List, Dict, Any

# --- Configuración de Path para Módulos Legacy ---
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
sys.path.insert(0, project_root)

legacy_path = r"C:\Users\rguti\mini_erp_v2_antigravity"
if legacy_path not in sys.path:
    sys.path.insert(0, legacy_path)

from backend.data.supabase_repository import (
    get_proposal_details_by_id,
    get_all_disbursed_proposals,
    get_or_create_liquidacion_resumen,
    add_liquidacion_evento,
    update_proposal_status,
    get_liquidacion_eventos
)
from backend.data.invoice_tracking_helpers import create_or_update_invoice_status, add_timeline_event

from testing_audit_liquidation.tabla_maestra_auditoria import generar_tabla_maestra_auditoria
from testing_audit_liquidation.generar_pdfs_liquidacion import generate_preview_html, calcular_costos_totales_a_fecha
from weasyprint import HTML

from src.utils.google_integration import upload_file_with_sa, get_sa_credentials_dict

router = APIRouter()

try:
    SA_CREDENTIALS = get_sa_credentials_dict()
except Exception as e:
    print(f"Error loading SA credentials: {e}")
    SA_CREDENTIALS = None

# --- Helper ---
def parse_invoice_number(proposal_id: str) -> str:
    try:
        parts = proposal_id.split('-')
        return f"{parts[1]}-{parts[2]}" if len(parts) > 2 else proposal_id
    except (IndexError, AttributeError):
        return proposal_id

def upload_helper_liquidacion(file_bytes, file_name, folder_id, sa_creds):
    try:
        if not file_bytes:
            return False, f"Sin contenido: {file_name}"
        success, res_id = upload_file_with_sa(file_bytes, file_name, folder_id, sa_creds)
        if success:
            return True, f"Subido: {file_name}"
        else:
            return False, f"Error {file_name}: {res_id}"
    except Exception as e:
        return False, f"Error {file_name}: {str(e)}"

# --- Endpoints ---

@router.get("/pendientes")
async def get_liquidaciones_pendientes():
    """
    Retorna las facturas en estado DESEMBOLSADA (Nuevas) y EN PROCESO DE LIQUIDACION (En Proceso).
    Incluye estructura para armar la jerarquía visual.
    """
    try:
        todas = get_all_disbursed_proposals()
        nuevas = []
        en_proceso = []

        for p in todas:
            estado = p.get('estado', '')
            
            # Helper to get group_id safely
            group_id = 'General'
            try:
                rj = json.loads(p.get('recalculate_result_json', '{}'))
                if isinstance(rj, dict):
                    group_id = str(rj.get('group_id', 'General'))
            except: pass
            
            p['group_id'] = group_id
            
            if estado in ['DESEMBOLSADA', 'DESEMBOLSADO']:
                nuevas.append(p)
            elif estado in ['EN PROCESO', 'EN PROCESO DE LIQUIDACION']:
                en_proceso.append(p)
                
        return {
            "status": "success",
            "nuevas": nuevas,
            "en_proceso": en_proceso
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class SimularLiquidacionRequest(BaseModel):
    proposal_id: str
    fecha_pago: str # YYYY-MM-DD
    monto_pago: float

@router.post("/simular")
async def simular_liquidacion(req: SimularLiquidacionRequest):
    """
    Corre el oráculo y retorna si el candado pasa, y la data para el preview.
    """
    try:
        detalles = get_proposal_details_by_id(req.proposal_id)
        if not detalles:
            raise HTTPException(status_code=404, detail="Propuesta no encontrada")

        rj = json.loads(detalles.get('recalculate_result_json', '{}'))
        monto_desembolsado_val = float(rj.get('desglose_final_detallado', {}).get('abono', {}).get('monto', 0))
        if monto_desembolsado_val == 0: 
            monto_desembolsado_val = float(detalles.get('monto_neto_factura', 0))
        
        capital = float(detalles.get('monto_neto_factura', 0))
        try: capital = float(rj.get('calculo_con_tasa_encontrada', {}).get('capital', capital))
        except: pass

        tasa_comp = float(detalles.get('interes_mensual', 2.0)) / 100
        tasa_mora = float(detalles.get('interes_moratorio', 3.0)) / 100
        
        f_desemb = date.today()
        if detalles.get('fecha_desembolso_factoring'):
            f_desemb = datetime.fromisoformat(detalles.get('fecha_desembolso_factoring').split('T')[0]).date()
            
        f_venc = date.today()
        if detalles.get('fecha_pago_calculada'):
            f_venc = datetime.fromisoformat(detalles.get('fecha_pago_calculada').split('T')[0]).date()
            
        gastos = rj.get('gastos_operativos', {})
        com_est = float(gastos.get('comision_estructuracion', 0.0))
        com_afi = float(gastos.get('comision_afiliacion', 0.0))
        
        pagos_previos = []
        eventos = get_liquidacion_eventos(req.proposal_id)
        for ev in eventos:
            try:
                pagos_previos.append({
                    'fecha': datetime.fromisoformat(ev['fecha_evento'].split('T')[0]).date(), 
                    'monto': float(ev['monto_recibido'])
                })
            except: pass
        
        f_pago = datetime.strptime(req.fecha_pago, '%Y-%m-%d').date()
        pagos_act = pagos_previos + [{'fecha': f_pago, 'monto': req.monto_pago}]
        
        df_oracle, historial = generar_tabla_maestra_auditoria(
            capital_original=monto_desembolsado_val,
            tasa_mensual=tasa_comp,
            tasa_moratoria=tasa_mora,
            fecha_desembolso=f_desemb,
            fecha_vencimiento=f_venc,
            pagos=pagos_act,
            dias_proyeccion=5,
            com_est=com_est, igv_com_est=com_est*0.18,
            com_afi=com_afi, igv_com_afi=com_afi*0.18,
            monto_desembolsado=monto_desembolsado_val,
            int_min_originacion=0,
            capital_financiado=capital
        )
        
        fecha_str = f_pago.strftime('%d/%m/%Y')
        r_val = df_oracle[df_oracle['Fecha'] == fecha_str]
        if r_val.empty: r_val = df_oracle.iloc[[-1]]
        r = r_val.iloc[0]
        
        total_oracle = float(r.get('TotalDeudaREAL', 0))
        cap_rem = float(r.get('CapitalRemanente', 0))
        
        if total_oracle > 0:
            costos_acum = total_oracle - cap_rem
        else:
            costos_acum = (float(r.get('IntDev',0)) + float(r.get('IntMin',0)) + 
                          float(r.get('IntMora',0)) + float(r.get('IGV_Int',0)) + float(r.get('IGV_Mora',0)) +
                          float(r.get('ComEst',0)) + float(r.get('IGV_ComEst',0)) + float(r.get('ComAfi',0)) + float(r.get('IGV_ComAfi',0)))
            
        cobertura = req.monto_pago - costos_acum
        passed = cobertura >= -0.01

        return {
            "status": "success",
            "passed": bool(passed),
            "cobertura": cobertura,
            "costos_acumulados": costos_acum,
            "capital_remanente": cap_rem
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{proposal_id}/pdf")
async def generar_pdf(proposal_id: str, fecha_pago: str, monto_pago: float):
    """
    Genera el Reporte Integral de Liquidación (PDF nativo con WeasyPrint).
    """
    try:
        detalles = get_proposal_details_by_id(proposal_id)
        if not detalles:
            raise HTTPException(status_code=404, detail="Propuesta no encontrada")
            
        rj = json.loads(detalles.get('recalculate_result_json', '{}'))
        monto_desembolsado_val = float(rj.get('desglose_final_detallado', {}).get('abono', {}).get('monto', 0))
        if monto_desembolsado_val == 0: 
            monto_desembolsado_val = float(detalles.get('monto_neto_factura', 0))
        
        capital = float(detalles.get('monto_neto_factura', 0))
        try: capital = float(rj.get('calculo_con_tasa_encontrada', {}).get('capital', capital))
        except: pass

        tasa_comp = float(detalles.get('interes_mensual', 2.0)) / 100
        tasa_mora = float(detalles.get('interes_moratorio', 3.0)) / 100
        
        f_desemb = date.today()
        if detalles.get('fecha_desembolso_factoring'):
            f_desemb = datetime.fromisoformat(detalles.get('fecha_desembolso_factoring').split('T')[0]).date()
            
        f_venc = date.today()
        if detalles.get('fecha_pago_calculada'):
            f_venc = datetime.fromisoformat(detalles.get('fecha_pago_calculada').split('T')[0]).date()
            
        gastos = rj.get('gastos_operativos', {})
        com_est = float(gastos.get('comision_estructuracion', 0.0))
        com_afi = float(gastos.get('comision_afiliacion', 0.0))
        
        pagos_previos = []
        eventos = get_liquidacion_eventos(proposal_id)
        for ev in eventos:
            try:
                pagos_previos.append({
                    'fecha': datetime.fromisoformat(ev['fecha_evento'].split('T')[0]).date(), 
                    'monto': float(ev['monto_recibido'])
                })
            except: pass
        
        f_pago = datetime.strptime(fecha_pago, '%Y-%m-%d').date()
        pagos_act = pagos_previos + [{'fecha': f_pago, 'monto': monto_pago}]
        
        df_oracle, _ = generar_tabla_maestra_auditoria(
            capital_original=monto_desembolsado_val,
            tasa_mensual=tasa_comp,
            tasa_moratoria=tasa_mora,
            fecha_desembolso=f_desemb,
            fecha_vencimiento=f_venc,
            pagos=pagos_act,
            dias_proyeccion=5,
            com_est=com_est, igv_com_est=com_est*0.18,
            com_afi=com_afi, igv_com_afi=com_afi*0.18,
            monto_desembolsado=monto_desembolsado_val,
            int_min_originacion=0,
            capital_financiado=capital
        )
        
        fecha_str = f_pago.strftime('%d/%m/%Y')
        r_val = df_oracle[df_oracle['Fecha'] == fecha_str]
        if r_val.empty: r_val = df_oracle.iloc[[-1]]
        r = r_val.iloc[0]
        
        cap_rem = float(r.get('CapitalRemanente', 0))
        total_oracle = float(r.get('TotalDeudaREAL', 0))
        if total_oracle > 0:
            total_req = total_oracle - cap_rem
        else:
            total_req = (float(r.get('IntDev', 0)) + float(r.get('IntMin', 0)) + 
                         float(r.get('IntMora', 0)) + float(r.get('IGV_Int', 0)) + float(r.get('IGV_Mora', 0)) + 
                         float(r.get('ComEst', 0)) + float(r.get('IGV_ComEst', 0)) + 
                         float(r.get('ComAfi', 0)) + float(r.get('IGV_ComAfi', 0)))
                         
        costos_obj = {
            'interes_devengado': max(float(r.get('IntMin', 0)), float(r.get('IntDev', 0))),
            'interes_moratorio': float(r.get('IntMora', 0)),
            'comisiones': float(r.get('ComEst', 0)) + float(r.get('ComAfi', 0)),
            'igv_total': float(r.get('IGV_Int', 0)) + float(r.get('IGV_Mora', 0)) + float(r.get('IGV_ComEst', 0)) + float(r.get('IGV_ComAfi', 0)),
            'total_costo_financiero': total_req
        }
        
        import importlib
        import testing_audit_liquidation.generar_pdfs_liquidacion as gpdf
        importlib.reload(gpdf)

        html = gpdf.generate_preview_html(
            df=df_oracle,
            costos=costos_obj,
            cap_rem=cap_rem,
            monto_pago=monto_pago,
            fecha_pago=f_pago,
            f_desemb=f_desemb,
            detalles=detalles
        )
        
        pdf_bytes = HTML(string=html).write_pdf()
        
        return Response(content=pdf_bytes, media_type="application/pdf")
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/procesar")
async def procesar_liquidacion(
    proposal_ids: str = Form(...), # JSON string list
    fechas_pago: str = Form(...), # JSON string dict
    montos_pago: str = Form(...), # JSON string dict
    folder_id: str = Form(None),
    sustentos: List[UploadFile] = File(None)
):
    """
    Procesa liquidaciones masivas o individuales y sube el PDF a Drive.
    """
    try:
        pids = json.loads(proposal_ids)
        f_pagos = json.loads(fechas_pago)
        m_pagos = json.loads(montos_pago)
        
        cont_exito = 0
        errores = []
        
        # Mapear archivos por filename (Sustento_Cobranza_ID.pdf o similar)
        files_dict = {}
        if sustentos:
            for s in sustentos:
                if s.filename:
                    files_dict[s.filename] = s
        
        for pid in pids:
            try:
                f_pago_str = f_pagos.get(pid)
                m_pago = m_pagos.get(pid)
                if not f_pago_str or m_pago is None:
                    errores.append(f"Faltan datos para factura {parse_invoice_number(pid)}")
                    continue
                    
                m_pago = float(m_pago)
                f_pago = datetime.strptime(f_pago_str, '%Y-%m-%d').date()
                
                detalles = get_proposal_details_by_id(pid)
                
                rj = json.loads(detalles.get('recalculate_result_json', '{}'))
                monto_desembolsado_val = float(rj.get('desglose_final_detallado', {}).get('abono', {}).get('monto', 0))
                if monto_desembolsado_val == 0: 
                    monto_desembolsado_val = float(detalles.get('monto_neto_factura', 0))
                
                capital = float(detalles.get('monto_neto_factura', 0))
                try: capital = float(rj.get('calculo_con_tasa_encontrada', {}).get('capital', capital))
                except: pass

                tasa_comp = float(detalles.get('interes_mensual', 2.0)) / 100
                tasa_mora = float(detalles.get('interes_moratorio', 3.0)) / 100
                f_desemb = date.today()
                if detalles.get('fecha_desembolso_factoring'):
                    f_desemb = datetime.fromisoformat(detalles.get('fecha_desembolso_factoring').split('T')[0]).date()
                f_venc = date.today()
                if detalles.get('fecha_pago_calculada'):
                    f_venc = datetime.fromisoformat(detalles.get('fecha_pago_calculada').split('T')[0]).date()
                    
                gastos = rj.get('gastos_operativos', {})
                com_est = float(gastos.get('comision_estructuracion', 0.0))
                com_afi = float(gastos.get('comision_afiliacion', 0.0))
                
                pagos_previos = []
                eventos = get_liquidacion_eventos(pid)
                for ev in eventos:
                    try:
                        pagos_previos.append({
                            'fecha': datetime.fromisoformat(ev['fecha_evento'].split('T')[0]).date(), 
                            'monto': float(ev['monto_recibido'])
                        })
                    except: pass
                
                pagos_act = pagos_previos + [{'fecha': f_pago, 'monto': m_pago}]
                
                df_oracle, _ = generar_tabla_maestra_auditoria(
                    capital_original=monto_desembolsado_val,
                    tasa_mensual=tasa_comp,
                    tasa_moratoria=tasa_mora,
                    fecha_desembolso=f_desemb,
                    fecha_vencimiento=f_venc,
                    pagos=pagos_act,
                    dias_proyeccion=5,
                    com_est=com_est, igv_com_est=com_est*0.18,
                    com_afi=com_afi, igv_com_afi=com_afi*0.18,
                    monto_desembolsado=monto_desembolsado_val,
                    int_min_originacion=0,
                    capital_financiado=capital
                )
                
                fecha_str = f_pago.strftime('%d/%m/%Y')
                r_val = df_oracle[df_oracle['Fecha'] == fecha_str]
                if r_val.empty: r_val = df_oracle.iloc[[-1]]
                r = r_val.iloc[0]
                
                total_oracle = float(r.get('TotalDeudaREAL', 0))
                cap_rem = float(r.get('CapitalRemanente', 0))
                
                if total_oracle > 0:
                    costos_acum = total_oracle - cap_rem
                else:
                    costos_acum = (float(r.get('IntDev',0)) + float(r.get('IntMin',0)) + 
                                float(r.get('IntMora',0)) + float(r.get('IGV_Int',0)) + float(r.get('IGV_Mora',0)) +
                                float(r.get('ComEst',0)) + float(r.get('IGV_ComEst',0)) + float(r.get('ComAfi',0)) + float(r.get('IGV_ComAfi',0)))
                    
                cobertura = m_pago - costos_acum
                if cobertura < -0.01:
                    errores.append(f"Factura {parse_invoice_number(pid)}: Pago insuficiente (Faltan S/ {abs(cobertura):.2f})")
                    continue
                    
                nuevo_estado = "LIQUIDADA" if cap_rem <= 0.50 else "EN PROCESO DE LIQUIDACION"
                update_proposal_status(pid, nuevo_estado)
                
                liq_resumen_id = get_or_create_liquidacion_resumen(pid, detalles)
                add_liquidacion_evento(
                    liquidacion_resumen_id=liq_resumen_id,
                    tipo_evento="PAGO_REGISTRADO",
                    monto_recibido=float(m_pago),
                    fecha_evento=f_pago,
                    dias_diferencia=0,
                    resultado_json={"origen": "react_app", "saldo_restante": cap_rem}
                )
                
                # Tracking Legacy (igual a Tab 2)
                try:
                    dtl_tracking = get_proposal_details_by_id(pid)
                    if dtl_tracking:
                        create_or_update_invoice_status(pid, dtl_tracking, stage='LIQUIDACION')
                        add_timeline_event(
                            pid,
                            'LIQUIDACION' if nuevo_estado == 'LIQUIDADA' else 'PAGO_PARCIAL',
                            f"Pago registrado: S/ {m_pago:,.2f}. Estado: {nuevo_estado}",
                            'SUSTENTO',
                            f"Sustento_{f_pago.strftime('%Y%m%d')}.pdf",
                            None
                        )
                except Exception as track_err:
                    print(f"[WARNING] Error en tracking: {track_err}")
                
                # Upload a Drive
                file_name_expected_individual = f"Sustento_Cobranza_{pid}.pdf"
                file_name_expected_global = f"Sustento_Cobranza_GLOBAL_{pid}.pdf"
                file_obj = None
                
                # Search if we have a file matching this pid
                if file_name_expected_individual in files_dict:
                    file_obj = files_dict[file_name_expected_individual]
                elif file_name_expected_global in files_dict:
                    file_obj = files_dict[file_name_expected_global]
                    
                if file_obj and folder_id and SA_CREDENTIALS:
                    content = await file_obj.read()
                    drive_name = f"Sustento_Cobranza_{parse_invoice_number(pid)}.pdf"
                    upload_helper_liquidacion(content, drive_name, folder_id, SA_CREDENTIALS)
                    
                cont_exito += 1
                
            except Exception as e:
                errores.append(f"Error interno {parse_invoice_number(pid)}: {str(e)}")

        return {
            "status": "success",
            "procesadas": cont_exito,
            "errores": errores
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
