"""
Google Sheets Integration Helper
Funciones para leer datos desde Google Sheets usando Service Account.
"""
import gspread
from google.oauth2 import service_account
from src.utils.google_integration import get_sa_credentials_dict


def get_gsheets_client():
    """
    Crea y retorna un cliente de gspread autenticado con Service Account.
    
    Returns:
        gspread.Client: Cliente autenticado para interactuar con Google Sheets
        
    Raises:
        ValueError: Si no se encuentran las credenciales del Service Account
    """
    # Obtener credenciales del Service Account (desde Railway env vars)
    sa_creds = get_sa_credentials_dict()
    
    # Fix private_key si es necesario
    if 'private_key' in sa_creds:
        sa_creds['private_key'] = sa_creds['private_key'].replace('\\\\n', '\n')
    
    # Crear credenciales con scope de Sheets (read-only)
    creds = service_account.Credentials.from_service_account_info(
        sa_creds,
        scopes=['https://www.googleapis.com/auth/spreadsheets.readonly']
    )
    
    # Autorizar y retornar cliente
    return gspread.authorize(creds)


def read_sheet_data(spreadsheet_id, worksheet_name=None, worksheet_gid=None):
    """
    Lee todos los datos de una pestaña específica de Google Sheets.
    
    Args:
        spreadsheet_id (str): ID del Google Spreadsheet
        worksheet_name (str, optional): Nombre de la pestaña a leer
        worksheet_gid (str, optional): GID de la pestaña a leer
        
    Returns:
        dict: Diccionario con:
            - 'headers': Lista de nombres de columnas
            - 'data': Lista de diccionarios, cada uno representa una fila
            - 'raw_data': Lista de listas con los datos crudos
            - 'metadata': Información sobre la pestaña
            
    Raises:
        ValueError: Si no se especifica ni worksheet_name ni worksheet_gid
        gspread.exceptions.WorksheetNotFound: Si no se encuentra la pestaña
    """
    if not worksheet_name and not worksheet_gid:
        raise ValueError("Debes especificar worksheet_name o worksheet_gid")
    
    # Obtener cliente
    client = get_gsheets_client()
    
    # Abrir spreadsheet
    spreadsheet = client.open_by_key(spreadsheet_id)
    
    # Seleccionar worksheet
    if worksheet_gid:
        # Buscar por GID
        worksheet = None
        for ws in spreadsheet.worksheets():
            if str(ws.id) == str(worksheet_gid):
                worksheet = ws
                break
        if not worksheet:
            raise ValueError(f"No se encontró pestaña con GID: {worksheet_gid}")
    else:
        # Buscar por nombre
        worksheet = spreadsheet.worksheet(worksheet_name)
    
    # Leer todos los datos
    all_values = worksheet.get_all_values()
    
    if not all_values:
        return {
            'headers': [],
            'data': [],
            'raw_data': [],
            'metadata': {
                'title': worksheet.title,
                'id': worksheet.id,
                'row_count': worksheet.row_count,
                'col_count': worksheet.col_count
            }
        }
    
    # Separar headers y datos
    headers = all_values[0]
    raw_data = all_values[1:]
    
    # Convertir a lista de diccionarios
    data = []
    for row in raw_data:
        # Asegurar que la fila tenga el mismo número de columnas que headers
        padded_row = row + [''] * (len(headers) - len(row))
        row_dict = dict(zip(headers, padded_row))
        data.append(row_dict)
    
    return {
        'headers': headers,
        'data': data,
        'raw_data': raw_data,
        'metadata': {
            'title': worksheet.title,
            'id': worksheet.id,
            'row_count': worksheet.row_count,
            'col_count': worksheet.col_count,
            'data_rows': len(raw_data)
        }
    }


def list_worksheets(spreadsheet_id):
    """
    Lista todas las pestañas disponibles en un Google Spreadsheet.
    
    Args:
        spreadsheet_id (str): ID del Google Spreadsheet
        
    Returns:
        list: Lista de diccionarios con información de cada pestaña:
            - 'title': Nombre de la pestaña
            - 'id': GID de la pestaña
            - 'row_count': Número de filas
            - 'col_count': Número de columnas
    """
    client = get_gsheets_client()
    spreadsheet = client.open_by_key(spreadsheet_id)
    
    worksheets_info = []
    for ws in spreadsheet.worksheets():
        worksheets_info.append({
            'title': ws.title,
            'id': ws.id,
            'row_count': ws.row_count,
            'col_count': ws.col_count
        })
    
    return worksheets_info


# Ejemplo de uso:
"""
# Leer datos de un Google Sheet
data = read_sheet_data(
    spreadsheet_id="1KVU8cOpkp4BsI_mFk1q3dvv_sfHl1PyZIFpG4odwG64",
    worksheet_gid="819722323"
)

# Acceder a los datos
headers = data['headers']
rows = data['data']  # Lista de diccionarios

# Iterar sobre las filas
for row in rows:
    print(row['Columna1'], row['Columna2'])
"""
