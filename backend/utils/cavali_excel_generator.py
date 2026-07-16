# Generador de Excel para Registro Masivo de Letras en Cavali

import pandas as pd
from datetime import datetime
from typing import List, Dict, Any

def generar_excel_cavali_letras(facturas: List[Dict[str, Any]], output_path: str = None) -> pd.DataFrame:
    """
    Genera un Excel en el formato requerido por Cavali para registro masivo de letras.
    
    Args:
        facturas: Lista de diccionarios con datos de facturas/propuestas
        output_path: Ruta donde guardar el Excel (opcional)
    
    Returns:
        DataFrame con el formato de Cavali
    
    Mapeo de campos:
    - CODIGO DE VENTA: Identificador único de la operación
    - TIPO VENTA: Tipo de operación (ej: "FACTORING")
    - NRO DOCUMENTO: Número de la letra
    - NUMERO DOCUMENTO: Número del documento base (factura)
    - TIPO DOCUMENTO: Tipo de documento (ej: "FACTURA")
    - NUMERO DOCUMENTO GIRADOR: RUC del emisor
    - TIPO DOCUMENTO GIRADOR: "RUC"
    - NOMBRE SOCIAL GIRADOR: Razón social del emisor
    - FECHA GIRO: Fecha de emisión de la letra
    - LUGAR GIRO: Lugar de emisión (ej: "LIMA")
    - FECHA VENCIMIENTO: Fecha de vencimiento
    - TIPO MONEDA: "PEN" o "USD"
    - IMPORTE NOMINAL: Monto total de la letra
    - NUMERO PROTESTO: Vacío (opcional)
    - FECHA PROTESTO: Vacío (opcional)
    - TIPO AVAL: Vacío (opcional)
    - NUMERO DOCUMENTO AVALISTA: RUC del aceptante
    - TIPO DOCUMENTO AVALISTA: "RUC"
    - NOMBRE AVALISTA: Razón social del aceptante
    - INFORMACION ADICIONAL: Información extra (opcional)
    """
    
    registros = []
    
    for factura in facturas:
        # Extraer datos de la factura
        proposal_id = factura.get('proposal_id', '')
        numero_factura = factura.get('numero_factura', '')
        
        # Emisor (Girador)
        emisor_ruc = factura.get('emisor_ruc', '')
        emisor_nombre = factura.get('emisor_nombre', '')
        
        # Aceptante (Avalista)
        aceptante_ruc = factura.get('aceptante_ruc', '')
        aceptante_nombre = factura.get('aceptante_nombre', '')
        
        # Fechas
        fecha_emision = factura.get('fecha_emision_factura', '')
        fecha_vencimiento = factura.get('fecha_pago_calculada', '')
        
        # Montos
        monto_total = factura.get('monto_total_factura', 0)
        moneda = factura.get('moneda_factura', 'PEN')
        
        # Crear registro
        registro = {
            'CODIGO DE VENTA': proposal_id,
            'TIPO VENTA': 'FACTORING',
            'NRO DOCUMENTO': f"L-{numero_factura}",  # Letra basada en factura
            'NUMERO DOCUMENTO': numero_factura,
            'TIPO DOCUMENTO': 'FACTURA',
            'NUMERO DOCUMENTO GIRADOR': emisor_ruc,
            'TIPO DOCUMENTO GIRADOR': 'RUC',
            'NOMBRE SOCIAL GIRADOR': emisor_nombre,
            'FECHA GIRO': _format_date_cavali(fecha_emision),
            'LUGAR GIRO': 'LIMA',
            'FECHA VENCIMIENTO': _format_date_cavali(fecha_vencimiento),
            'TIPO MONEDA': moneda,
            'IMPORTE NOMINAL': monto_total,
            'NUMERO PROTESTO': '',
            'FECHA PROTESTO': '',
            'TIPO AVAL': '',
            'NUMERO DOCUMENTO AVALISTA': aceptante_ruc,
            'TIPO DOCUMENTO AVALISTA': 'RUC',
            'NOMBRE AVALISTA': aceptante_nombre,
            'INFORMACION ADICIONAL': f"Lote: {factura.get('identificador_lote', 'N/A')}"
        }
        
        registros.append(registro)
    
    # Crear DataFrame
    df = pd.DataFrame(registros)
    
    # Guardar si se especifica ruta
    if output_path:
        df.to_excel(output_path, index=False, engine='openpyxl')
        print(f"✅ Excel generado: {output_path}")
    
    return df


def _format_date_cavali(date_str: str) -> str:
    """
    Convierte fecha al formato requerido por Cavali.
    
    Entrada: "DD-MM-YYYY" o "YYYY-MM-DD"
    Salida: "DD/MM/YYYY"
    """
    if not date_str:
        return ''
    
    try:
        # Intentar parsear diferentes formatos
        if '-' in date_str:
            parts = date_str.split('-')
            if len(parts[0]) == 4:  # YYYY-MM-DD
                dt = datetime.strptime(date_str, '%Y-%m-%d')
            else:  # DD-MM-YYYY
                dt = datetime.strptime(date_str, '%d-%m-%Y')
        else:
            return date_str
        
        return dt.strftime('%d/%m/%Y')
    except:
        return date_str


# ============================================================================
# FUNCIÓN DE INTEGRACIÓN PARA MÓDULOS
# ============================================================================

def generar_excel_cavali_desde_lote(lote_id: str, output_dir: str = "formatos.letras.push.cavali") -> str:
    """
    Genera Excel de Cavali para todas las facturas de un lote.
    
    Args:
        lote_id: Identificador del lote
        output_dir: Directorio donde guardar el archivo
    
    Returns:
        Ruta del archivo generado
    """
    from data import supabase_repository as db
    import os
    
    # Obtener facturas del lote (estado APROBADO)
    facturas = db.get_proposals_by_lote(lote_id, estado_filter='APROBADO')
    
    if not facturas:
        raise ValueError(f"No se encontraron facturas aprobadas para el lote {lote_id}")
    
    # Generar nombre de archivo
    timestamp = datetime.now().strftime('%d%m%Y')
    filename = f"REGISTRO_MASIVO_LETRAS_{lote_id}_{timestamp}.xlsx"
    
    # Crear directorio si no existe
    os.makedirs(output_dir, exist_ok=True)
    
    output_path = os.path.join(output_dir, filename)
    
    # Generar Excel
    df = generar_excel_cavali_letras(facturas, output_path)
    
    print(f"✅ Generado Excel con {len(df)} letras para lote {lote_id}")
    
    return output_path


# ============================================================================
# EJEMPLO DE USO
# ============================================================================

if __name__ == "__main__":
    # Ejemplo con datos dummy
    facturas_ejemplo = [
        {
            'proposal_id': 'ABC-F001-123-20260108',
            'numero_factura': 'F001-123',
            'emisor_ruc': '20123456789',
            'emisor_nombre': 'EMPRESA ABC SAC',
            'aceptante_ruc': '20987654321',
            'aceptante_nombre': 'EMPRESA XYZ SAC',
            'fecha_emision_factura': '01-01-2026',
            'fecha_pago_calculada': '31-01-2026',
            'monto_total_factura': 10000.00,
            'moneda_factura': 'PEN',
            'identificador_lote': 'LOTE-2026-001'
        }
    ]
    
    df = generar_excel_cavali_letras(facturas_ejemplo, 'test_cavali.xlsx')
    print("\nPreview:")
    print(df.to_string())
