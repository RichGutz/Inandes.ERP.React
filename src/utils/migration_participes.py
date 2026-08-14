import sys
import os

# Path setup to allow running from root or inside utils
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

import pandas as pd
import datetime as dt
from src.utils.gsheets_integration import get_gsheets_client
from src.data.supabase_client import get_supabase_client


# Sheet Config
SHEET_ID = '1D8tl6nmQlr8MnxbwSAPhQ0WvEhagusgtNds1sJeNJDY'

# Defines the tabs to process
# Format: Name: GID
TABS_CONFIG = {
    'PEN01': '45831439',
    'PEN02': '2008056577',
    'PEN03': '371350526',
    'USD01': '896945954',
    'USD02': '994684684',
    'CON01': '1315730129'
}

def migrate_participes_from_gsheet():
    """
    Reads ALL configured Fund Sheets and upserts into crm_participes.
    Returns: (success: bool, message: str, count: int)
    """
    print("🚀 Iniciando migración de Partícipes MULTI-FONDO...")
    
    try:
        # 1. Connect and Read Sheet
        client = get_gsheets_client()
        sheet = client.open_by_key(SHEET_ID)
        
        all_records = []
        processed_docs = set()
        total_read = 0
        
        # Iterate over each configured tab
        for fund_name, gid in TABS_CONFIG.items():
            print(f"📥 Procesando Fondo: {fund_name} (GID: {gid})...")
            
            ws = None
            for w in sheet.worksheets():
                if str(w.id) == gid:
                    ws = w
                    break
            
            if not ws:
                print(f"⚠️  No se encontró la hoja {fund_name} (GID {gid}), saltando...")
                continue
                
            # Read all values
            data = ws.get_all_values()
            if len(data) < 3:
                 print(f"⚠️  Hoja {fund_name} vacía o sin datos, saltando...")
                 continue
                 
            # Headers are in row 3 (index 2)
            # headers = data[2] # We assume headers are somewhat consistent or we map by known keys
            # Better to create DF with headers
            df = pd.DataFrame(data[3:], columns=data[2])
            
            # Verify Key Columns exist (Basic validation)
            if 'NO_DOC_P1' not in df.columns:
                print(f"⚠️  Hoja {fund_name} no tiene columna NO_DOC_P1, saltando...")
                continue
            
            # Filter valid (non-empty Doc ID)
            df = df[df['NO_DOC_P1'].str.strip() != '']
            print(f"   📊 {len(df)} filas válidas en {fund_name}.")
            total_read += len(df)
            
            for _, row in df.iterrows():
                doc_id = str(row['NO_DOC_P1']).strip()
                if not doc_id: continue
                
                # Logic: We overwrite if we find the same person again? 
                # Yes, because latest might have updated info (e.g. phone/address).
                # But since we are processing in arbitrary order, 'latest' is ambiguous.
                # However, the user said "duplicate logic is static data mixed with dynamic", 
                # so effectively data *should* be the same. 
                # We will process ALL of them and let Supabase UPSERT handle the "last write wins".
                # To minimize DB calls, we can dedup in memory first.
                
                # If we want "last valid data wins" we should probably just keep the last one found in the loop?
                # Actually, processing them in order PEN01 -> CON01 might be fine.
                
                # In-memory deduplication:
                # We store in a dict keyed by doc_id using the record as value.
                # This ensures we send unique records to Supabase.
                
                record = {
                    'tipo_doc': row.get('TIPO_DOC_P1', 'DNI').strip() or 'DNI',
                    'documento_identidad': doc_id,
                    'nombre_completo': row.get('NOMBRE_COMPLETO_P1', '').strip(),
                    
                    # Contact
                    'email': row.get('EMAIL_P1', '').strip(),
                    'telefono': row.get('TELEF_CELULAR_P1', '').strip(),
                    'direccion_fiscal': row.get('DOMICILIO_FISCAL', '').strip(),
                    'codigo_postal': row.get('CODIGO_POSTAL', '').strip(),
                    
                    # Cotitular
                    'cotitular_nombre': row.get('NOMBRE_COMPLETO_P2', '').strip() or None,
                    'cotitular_documento': row.get('NO_DOC_P2', '').strip() or None,
                    
                    # Asesor
                    'asesor_nombre': row.get('ASESOR', '').strip(),
                    'asesor_email': row.get('EMAIL_ASESOR', '').strip(),
                    
                    # Bank
                    'banco_nombre': row.get('BANCO', '').strip(),
                    'numero_cuenta': row.get('NO_CUENTA', '').strip(),
                    'cci': row.get('CCI', '').strip(),
                    'moneda_cuenta': row.get('MONEDA', 'PEN').strip(),
                    
                    'origen_datos': f'MIGRACION_{fund_name}' # Will track source of last update
                }
                
                # Upsert to dict (Last Write Wins in Memory)
                # Use doc_id as key
                # We can't use dict for the final list, but we can use an intermediate dict.
                pass # Logic moved outside loop
                
        # --- END OF TABS LOOP ---
        
        print("🔄 Consolidando registros únicos...")
        # Since I can't easily pass the dict out of the loop without restructuring, 
        # I'll restart the loop logic cleaner above or just use the list and dedupe before sending.
        
        # Let's Refactor slightly for cleaner structure inside the single function
        pass 
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return False, f"Error iniciando migración: {str(e)}", 0
        
    # --- RESTARTING LOGIC BLOCK FOR CLEAN ITERATION ---
    unique_map = {}
    
    try:
        client = get_gsheets_client()
        sheet = client.open_by_key(SHEET_ID)
        
        for fund_name, gid in TABS_CONFIG.items():
            ws = None
            for w in sheet.worksheets():
                if str(w.id) == gid: ws = w; break
            
            if not ws: continue
            
            data = ws.get_all_values()
            if len(data) < 3: continue
            
            df = pd.DataFrame(data[3:], columns=data[2])
            if 'NO_DOC_P1' not in df.columns: continue
            
            df = df[df['NO_DOC_P1'].str.strip() != '']
            
            for _, row in df.iterrows():
                doc_id = str(row['NO_DOC_P1']).strip()
                if not doc_id: continue
                
                # Build Record
                record = {
                    'tipo_doc': row.get('TIPO_DOC_P1', 'DNI').strip() or 'DNI',
                    'documento_identidad': doc_id,
                    'nombre_completo': row.get('NOMBRE_COMPLETO_P1', '').strip(),
                    'email': row.get('EMAIL_P1', '').strip(),
                    'telefono': row.get('TELEF_CELULAR_P1', '').strip(),
                    'direccion_fiscal': row.get('DOMICILIO_FISCAL', '').strip(),
                    'codigo_postal': row.get('CODIGO_POSTAL', '').strip(),
                    'cotitular_nombre': row.get('NOMBRE_COMPLETO_P2', '').strip() or None,
                    'cotitular_documento': row.get('NO_DOC_P2', '').strip() or None,
                    'asesor_nombre': row.get('ASESOR', '').strip(),
                    'asesor_email': row.get('EMAIL_ASESOR', '').strip(),
                    'banco_nombre': row.get('BANCO', '').strip(),
                    'numero_cuenta': row.get('NO_CUENTA', '').strip(),
                    'cci': row.get('CCI', '').strip(),
                    'moneda_cuenta': row.get('MONEDA', 'PEN').strip(),
                    'origen_datos': f'MIGRACION_{fund_name}' 
                }
                
                unique_map[doc_id] = record
    
        records_to_upsert = list(unique_map.values())
        
        if not records_to_upsert:
             return True, "No se encontraron registros.", 0
             
        print(f"💾 Enviando {len(records_to_upsert)} registros únicos a Supabase...")
        supabase = get_supabase_client()
        
        # Batch upsert in chunks of 100 just in case
        chunk_size = 100
        for i in range(0, len(records_to_upsert), chunk_size):
            chunk = records_to_upsert[i:i + chunk_size]
            response = supabase.table('crm_participes').upsert(chunk, on_conflict='documento_identidad').execute()
        
        return True, "Migración Multi-Fondo Completa.", len(records_to_upsert)

    except Exception as e:
        import traceback
        traceback.print_exc()
        return False, f"Error general: {str(e)}", 0

if __name__ == "__main__":
    success, msg, count = migrate_participes_from_gsheet()
    print(f"Resultado: {success} | {msg} | Registros: {count}")
