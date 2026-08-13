# ============================================================================
# INVOICE TRACKING & TIMELINE FUNCTIONS (Top Secret File System)
# ============================================================================

from typing import Dict, Any, Optional, List
import datetime as dt
from data.supabase_client import get_supabase_client

def _convert_to_numeric(value):
    """Convierte un valor a numérico, manejando strings y None"""
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        try:
            return float(value.replace(',', ''))
        except (ValueError, AttributeError):
            return None
    return None

def get_current_user_email() -> str:
    """
    Obtiene el email del usuario logueado desde session_state.
    Fallback a 'sistema' si no hay usuario.
    """
    try:
        import streamlit as st
        if 'user_info' in st.session_state:
            user_info = st.session_state.user_info
            if isinstance(user_info, dict):
                return user_info.get('email', 'sistema')
            return str(user_info)
    except Exception:
        pass
    return 'sistema'

def create_or_update_invoice_status(proposal_id: str, proposal_data: Dict[str, Any], stage: str = None) -> Optional[Dict[str, Any]]:
    """
    Crea o actualiza el registro de estado de una factura.
    
    Args:
        proposal_id: ID de la propuesta
        proposal_data: Datos de la propuesta
        stage: 'CREACION', 'APROBACION', 'DESEMBOLSO', 'LIQUIDACION'
    
    Returns:
        Datos del registro creado/actualizado
    """
    supabase = get_supabase_client()
    current_user = get_current_user_email()
    
    status_data = {
        'proposal_id': proposal_id,
        'emisor_nombre': proposal_data.get('emisor_nombre'),
        'emisor_ruc': proposal_data.get('emisor_ruc'),
        'aceptante_nombre': proposal_data.get('aceptante_nombre'),
        'aceptante_ruc': proposal_data.get('aceptante_ruc'),
        'numero_factura': proposal_data.get('numero_factura'),
        'identificador_lote': proposal_data.get('identificador_lote'),
        'fecha_emision': proposal_data.get('fecha_emision_factura'),
        'fecha_vencimiento': proposal_data.get('fecha_pago_calculada'),
        'monto_total': _convert_to_numeric(proposal_data.get('monto_total_factura')),
        'monto_neto': _convert_to_numeric(proposal_data.get('monto_neto_factura')),
        'estado_actual': proposal_data.get('estado')
    }
    
    # Agregar campos de auditoría según la etapa
    if stage == 'CREACION':
        status_data['usuario_creacion'] = current_user
        status_data['fecha_creacion'] = dt.datetime.now()
    elif stage == 'APROBACION':
        status_data['usuario_aprobacion'] = current_user
        status_data['fecha_aprobacion'] = dt.datetime.now()
    elif stage == 'DESEMBOLSO':
        status_data['usuario_desembolso'] = current_user
        status_data['fecha_desembolso'] = proposal_data.get('fecha_desembolso_factoring')
        status_data['monto_desembolsado'] = _convert_to_numeric(proposal_data.get('monto_neto_factura'))
        status_data['fecha_desembolso_registro'] = dt.datetime.now()
    elif stage == 'LIQUIDACION':
        status_data['usuario_liquidacion'] = current_user
        status_data['fecha_liquidacion'] = proposal_data.get('fecha_liquidacion')
        status_data['saldo_pendiente'] = _convert_to_numeric(proposal_data.get('saldo_pendiente', 0))
        status_data['fecha_liquidacion_registro'] = dt.datetime.now()
    
    try:
        response = supabase.table('invoice_status_registry').upsert(
            status_data,
            on_conflict='proposal_id'
        ).execute()
        return response.data[0] if response.data else None
    except Exception as e:
        print(f"[ERROR en create_or_update_invoice_status]: {e}")
        return None

def add_document_to_registry(proposal_id: str, doc_type: str, drive_file_id: str) -> None:
    """
    Agrega un documento al registro de una factura.
    
    Args:
        proposal_id: ID de la propuesta
        doc_type: Tipo de documento ('FACTURA_ORIGINAL', 'PERFIL', 'ANEXO', etc.)
        drive_file_id: ID del archivo en Google Drive
    """
    supabase = get_supabase_client()
    
    column_map = {
        'FACTURA_ORIGINAL': 'doc_factura_original_id',
        'PERFIL': 'doc_perfil_operacion_id',
        'ANEXO': 'doc_anexo_liquidacion_id',
        'VOUCHER_DESEMBOLSO': 'doc_voucher_desembolso_id',
        'SUSTENTO_DESEMBOLSO': 'doc_sustento_desembolso_id',
        'REPORTE_LIQUIDACION': 'doc_reporte_liquidacion_id'
    }
    
    try:
        if doc_type in column_map:
            update_data = {column_map[doc_type]: drive_file_id}
            supabase.table('invoice_status_registry').update(update_data).eq('proposal_id', proposal_id).execute()
        elif doc_type == 'SUSTENTO_COBRANZA':
            # Para array, usar RPC function
            supabase.rpc('append_sustento_cobranza', {
                'p_proposal_id': proposal_id,
                'p_file_id': drive_file_id
            }).execute()
    except Exception as e:
        print(f"[ERROR en add_document_to_registry]: {e}")

def add_timeline_event(proposal_id: str, evento_tipo: str, descripcion: str, 
                       documento_tipo: str = None, documento_nombre: str = None, 
                       documento_drive_id: str = None) -> None:
    """
    Registra un evento en la línea de tiempo de una factura.
    
    Args:
        proposal_id: ID de la propuesta
        evento_tipo: Tipo de evento ('ORIGINACION', 'APROBACION', 'DESEMBOLSO', etc.)
        descripcion: Descripción del evento
        documento_tipo: Tipo de documento asociado (opcional)
        documento_nombre: Nombre del documento (opcional)
        documento_drive_id: ID del archivo en Drive (opcional)
    """
    supabase = get_supabase_client()
    current_user = get_current_user_email()
    
    event_data = {
        'proposal_id': proposal_id,
        'evento_tipo': evento_tipo,
        'evento_fecha': dt.datetime.now(),
        'evento_descripcion': descripcion,
        'documento_tipo': documento_tipo,
        'documento_nombre': documento_nombre,
        'documento_drive_id': documento_drive_id,
        'usuario_responsable': current_user
    }
    
    try:
        supabase.table('invoice_timeline_events').insert(event_data).execute()
    except Exception as e:
        print(f"[ERROR en add_timeline_event]: {e}")

def get_invoice_status(numero_factura: str = None, emisor_ruc: str = None) -> List[Dict[str, Any]]:
    """
    Busca facturas por número o RUC del emisor.
    
    Args:
        numero_factura: Número de factura (búsqueda parcial)
        emisor_ruc: RUC del emisor
    
    Returns:
        Lista de registros de estado de facturas
    """
    supabase = get_supabase_client()
    
    try:
        query = supabase.table('invoice_status_registry').select('*')
        
        if numero_factura:
            query = query.ilike('numero_factura', f'%{numero_factura}%')
        if emisor_ruc:
            query = query.eq('emisor_ruc', emisor_ruc)
        
        response = query.execute()
        return response.data if response.data else []
    except Exception as e:
        print(f"[ERROR en get_invoice_status]: {e}")
        return []

def get_invoice_status_by_proposal_id(proposal_id: str) -> Optional[Dict[str, Any]]:
    """Obtiene el estado de una factura por su proposal_id"""
    supabase = get_supabase_client()
    
    try:
        response = supabase.table('invoice_status_registry').select('*').eq('proposal_id', proposal_id).single().execute()
        return response.data if response.data else None
    except Exception as e:
        print(f"[ERROR en get_invoice_status_by_proposal_id]: {e}")
        return None

def get_invoice_timeline(proposal_id: str) -> List[Dict[str, Any]]:
    """
    Obtiene todos los eventos cronológicos de una factura.
    
    Args:
        proposal_id: ID de la propuesta
    
    Returns:
        Lista de eventos ordenados cronológicamente
    """
    supabase = get_supabase_client()
    
    try:
        response = supabase.table('invoice_timeline_events')\
            .select('*')\
            .eq('proposal_id', proposal_id)\
            .order('evento_fecha', desc=False)\
            .execute()
        return response.data if response.data else []
    except Exception as e:
        print(f"[ERROR en get_invoice_timeline]: {e}")
        return []
