import streamlit as st
import requests
import json
import os
# TEMPORARY FIX: Commented out due to missing frontend/build directory
# from streamlit_google_picker import google_picker
# import streamlit_google_picker.uploaded_file as lib_upl # Import for monkeypatching
import uuid  # Para generar keys únicas por sesión
import io

# --- HELPER FUNCTION FOR SA CREDENTIALS ---
def get_sa_credentials_dict():
    """
    Get Google Service Account credentials from file or environment variables (Railway).
    Priority: 
    1. Read from sa_credentials.json file (recommended for Railway)
    2. Fallback to GOOGLE_SA_CREDENTIALS environment variable
    Returns dict with SA credentials.
    """
    import sys
    
    # Try to read from file first (Railway deployment)
    file_paths = [
        '/app/sa_credentials.json',  # Railway deployment path
        'sa_credentials.json',        # Local development path
        os.path.join(os.path.dirname(__file__), '..', '..', 'sa_credentials.json')  # Relative path
    ]
    
    for file_path in file_paths:
        if os.path.exists(file_path):
            try:
                with open(file_path, 'r') as f:
                    creds_dict = json.load(f)
                sys.stderr.write(f"✅ SA credentials loaded from file: {file_path}\n")
                sys.stderr.flush()
                return creds_dict
            except Exception as e:
                sys.stderr.write(f"⚠️ Failed to read {file_path}: {e}\n")
                sys.stderr.flush()
                continue
    
    # Fallback to environment variable (legacy method)
    sa_json = os.getenv('GOOGLE_SA_CREDENTIALS')
    if not sa_json:
        raise ValueError("❌ Service Account credentials not found. Neither sa_credentials.json file nor GOOGLE_SA_CREDENTIALS environment variable found.")
    
    sys.stderr.write("⚠️ Using environment variable (legacy method)\n")
    sys.stderr.flush()
    
    # Fix: Railway sometimes adds malformed quote wrapping
    if sa_json.startswith('"') and not sa_json.endswith('"'):
        sa_json = sa_json[1:]  # Remove leading quote
    
    # Fix: Replace literal newlines with escaped newlines in private_key
    try:
        creds_dict = json.loads(sa_json)
    except json.JSONDecodeError as e:
        # Try fixing newlines
        sa_json_fixed = sa_json.replace('\n', '\\n').replace('\r', '')
        creds_dict = json.loads(sa_json_fixed)
    
    return creds_dict

# --- CONFIGURACIÓN SHARED DRIVE ---
# ID de la carpeta raíz del repositorio en el SHARED DRIVE
# Link: https://drive.google.com/drive/u/1/folders/1Jv1r9kixL982gL-RCyPnhOY3W-qI0CLq
REPOSITORIO_FOLDER_ID = "1Jv1r9kixL982gL-RCyPnhOY3W-qI0CLq"
# -------------------------------------

# --- SHARED MONKEYPATCH ---
from contextlib import contextmanager

# TEMPORARY FIX: Commented out due to missing google_picker dependency
"""
@contextmanager
def patch_picker_flatten():
    \"\"\"
    Context manager to monkeypatch streamlit_google_picker's flatten_picker_result.
    This prevents the library from listing folder contents (which fails due to permissions)
    and handles result parsing robustly (List vs GooglePickerResult vs Dict).
    \"\"\"
    original_flatten = lib_upl.flatten_picker_result
    
    def safe_flatten_picker_result(picker_result, token, use_cache=True):
         # picker_result might be a list directly or a dict with 'docs'
         if isinstance(picker_result, list):
             raw_docs = picker_result
         else:
             raw_docs = picker_result.get("docs", [])
             
         # The library expects objects with attributes (f.id), but our code uses .get()
         # We create a hybrid class to satisfy both.
         class PickerFile:
             def __init__(self, data):
                 self.data = data
                 for k, v in data.items():
                     setattr(self, k, v)
             def get(self, key, default=None):
                 return self.data.get(key, default)
             def __getitem__(self, key):
                 return self.data[key]
                 
         return [PickerFile(d) for d in raw_docs]

    try:
        lib_upl.flatten_picker_result = safe_flatten_picker_result
        yield
    finally:
        lib_upl.flatten_picker_result = original_flatten
"""
# --------------------------

# --- HELPER: Listar Carpetas con Service Account (Backend del Browser Nativo) ---
def list_folders_with_sa(parent_id, sa_creds):
    """
    Lista las subcarpetas dentro de parent_id usando credenciales de Service Account.
    Retorna lista de dicts: [{'id': '...', 'name': '...'}]
    """
    try:
        from google.oauth2 import service_account
        from googleapiclient.discovery import build

        creds = service_account.Credentials.from_service_account_info(
            sa_creds, scopes=['https://www.googleapis.com/auth/drive']
        )
        service = build('drive', 'v3', credentials=creds)

        # Query solo carpetas y que no estén en la papelera
        query = f"'{parent_id}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false"
        
        results = service.files().list(
            q=query,
            pageSize=50,
            fields="nextPageToken, files(id, name)",
            includeItemsFromAllDrives=True, # Necesario para Shared Drives
            supportsAllDrives=True
        ).execute()
        
        return results.get('files', [])
    except Exception as e:
        st.error(f"Error listando carpetas: {e}")
        return []

# ---------------------------------------------------------

def get_service_account_token():
    """
    Genera un access_token FRESCO del Service Account para usar en el Google Picker.
    IMPORTANTE: Se genera un token nuevo en cada llamada para evitar problemas de caché.
    """
    try:
        from google.oauth2 import service_account
        import google.auth.transport.requests
        
        # Obtener credenciales del Service Account
        sa_creds_dict = get_sa_credentials_dict()
        
        # Fix de private_key si viene con \\n en lugar de \n
        if 'private_key' in sa_creds_dict:
            original_key = sa_creds_dict['private_key']
            sa_creds_dict['private_key'] = original_key.replace('\\n', '\n')
        
        # Crear credenciales con scope de Drive
        creds = service_account.Credentials.from_service_account_info(
            sa_creds_dict,
            scopes=['https://www.googleapis.com/auth/drive']
        )
        
        # FORZAR refresh para obtener token FRESCO (no en caché)
        creds.refresh(google.auth.transport.requests.Request())
        
        return creds.token
        
    except Exception as e:
        st.error(f"❌ Error generando token del Service Account: {e}")
        import traceback
        st.code(traceback.format_exc())  # Mostrar stack trace completo
        return None
# --------------------------

def upload_file_to_drive(file_data, file_name, folder_id, access_token):
    """
    Uploads a file (bytes) to a specific Google Drive folder using the Drive API v3 (REST).
    """
    try:
        metadata = {
            "name": file_name,
            "parents": [folder_id]
        }
        
        # 1. Initiate upload (multipart)
        files = {
            'data': ('metadata', json.dumps(metadata), 'application/json'),
            'file': (file_name, file_data, 'application/pdf')
        }
        
        headers = {
            "Authorization": f"Bearer {access_token}"
        }
        
        response = requests.post(
            "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
            headers=headers,
            files=files
        )
        
        if response.status_code == 200:
            return True, response.json()
        else:
            return False, f"Error {response.status_code}: {response.text}"
            
    except Exception as e:
        return False, str(e)

def render_drive_picker_uploader(key, file_data, file_name, label="Guardar en Google Drive"):
    """
    Renders a Google Picker to select a folder, then uploads the file_data to that folder.
    
    IMPORTANTE: El Picker Y el Upload usan el Service Account.
    - Picker muestra SOLO carpetas del Drive del SA (documentos confidenciales)
    - Usuario navega dentro del Drive del SA únicamente
    - Upload usa credenciales del SA (centralizado)
    """
    # TEMPORARY FIX: google_picker component is unavailable
    st.error("⚠️ Google Picker temporalmente deshabilitado. Usa el navegador nativo de carpetas.")
    return
    
    st.markdown("---")
    st.write(f"##### {label}")

    # Check authentication del usuario (para tracking/audit)
    if 'token' not in st.session_state or not st.session_state.token:
        st.warning("⚠️ Debes iniciar sesión con Google en el Home para usar esta función.")
        return

    # 1. Google Picker Config
    try:
        picker_secrets = st.secrets["google"]
        client_secrets = st.secrets["google_oauth"]
        api_key = picker_secrets.get("api_key") or st.secrets.get("GOOGLE_API_KEY")
        client_id = client_secrets.get("client_id") or st.secrets.get("GOOGLE_CLIENT_ID")
    except Exception:
        st.error("Error de configuración: Faltan secretos de Google.")
        return

    # 2. Obtener token del USUARIO para el Picker (navegación)
    # ESTRATEGIA HÍBRIDA WORKSPACE:
    # - Picker: Usa token del USUARIO para poder "ver" y navegar Shared Drives.
    # - Upload: Usa Service Account para escribir (autorizado en el Shared Drive).
    user_token = st.session_state.get('token')
    
    # Handle token string vs dict
    if isinstance(user_token, dict):
        user_token = user_token.get('access_token')

    if not user_token:
        st.warning("⚠️ Para ver el Repositorio Institucional, inicia sesión con Google.")
        return
        
    # --- DIAGNÓSTICO EN UI (MEJORADO) ---
    st.info("ℹ️ MODO HÍBRIDO: Picker usa TU cuenta para ver Shared Drives. Upload usa Service Account.")
    with st.expander("🔍 HERRAMIENTA DE DIAGNÓSTICO (ESTADO PIKER)", expanded=True):
        col_d1, col_d2 = st.columns(2)
        with col_d1:
            st.write("**1. Sesión de Usuario:**")
            user_info = st.session_state.get('user_info', {})
            st.code(f"Usuario: {user_info.get('email', 'N/A')}")
            st.caption("Este usuario se usa para NAVEGAR y SOLICITAR permisos de vista.")

        with col_d2:
            st.write("**2. Token en Picker:**")
            st.code(f"Tipo: User Token (Bearer)")
            if user_token:
                st.success("✅ Token Presente")
            else:
                st.error("❌ Sin Token")
        
        st.write("**3. Validación de Permisos (Scopes):**")
        if user_token:
            try:
                # Consultar scopes reales a Google
                token_info_url = f"https://www.googleapis.com/oauth2/v1/tokeninfo?access_token={user_token}"
                resp = requests.get(token_info_url)
                if resp.status_code == 200:
                    info = resp.json()
                    st.json(info) # Mostrar info cruda para transparencia
                    
                    scopes = info.get('scope', '').split(' ')
                    has_drive = 'https://www.googleapis.com/auth/drive' in scopes
                    
                    if has_drive:
                        st.success("✅ Scope '.../auth/drive' ACTIVO (Permite ver Shared Drives)")
                    else:
                        st.error("❌ FALTA Scope '.../auth/drive'. Necesitarás re-autenticar.")
                else:
                    st.error(f"❌ Token inválido (Error {resp.status_code})")
                    st.json(resp.json())
            except Exception as e:
                st.error(f"Error validando: {e}")
    # --------------------------------
    
    # Botón para forzar refresh del Picker (limpiar caché)
    col1, col2 = st.columns([3, 1])
    with col2:
        if st.button("🔄 Refrescar Picker", key=f"refresh_picker_{key}"):
            # Limpiar UUID de sesión para forzar recreación del Picker
            if 'picker_session_id' in st.session_state:
                del st.session_state.picker_session_id
            st.rerun()
    
    # 3. Render Picker (usa token del USUARIO para mostrar su Drive)
    # IMPORTANTE: Key única por sesión para evitar caché entre sesiones pero estable en la misma sesión
    if 'picker_session_id' not in st.session_state:
        st.session_state.picker_session_id = str(uuid.uuid4())
    
    picker_key = f"picker_{key}_{st.session_state.picker_session_id}"
    app_id = client_id.split('-')[0] if client_id else None
    
    selected_folder = None
    with patch_picker_flatten():
        selected_folder = google_picker(
            label="📂 Seleccionar Carpeta en Repositorio",
            token=user_token,  # ✅ Usuario navega
            apiKey=api_key,
            appId=app_id,
            view_ids=["FOLDERS"],
            allow_folders=True,
            accept_multiple_files=False,
            key=picker_key  # Key única por sesión
        )

    # 4. Handle Selection & Upload (con Service Account)
    if selected_folder:
        try:
            if len(selected_folder) > 0:
                doc = selected_folder[0]
                
                if hasattr(doc, 'get'):
                    folder_id = doc.get("id")
                    folder_name = doc.get("name")
                elif hasattr(doc, 'id'):
                     folder_id = doc.id
                     folder_name = getattr(doc, 'name', 'Carpeta')
                else:
                    return

                if folder_id:
                    st.info(f"📁 Carpeta seleccionada: **{folder_name}**")
                    if st.button(f"⬆️ Confirmar subida de: {file_name}", key=f"btn_upload_{key}", type="primary"):
                        with st.spinner("Subiendo archivo a Google Drive con Service Account..."):
                            # Obtener credenciales del Service Account
                            try:
                                sa_creds = get_sa_credentials_dict()
                            except Exception as e:
                                st.error(f"❌ Error: No se encontraron credenciales del Service Account: {e}")
                                return
                            
                            # Upload con Service Account (centralizado)
                            success, result = upload_file_with_sa(
                                file_bytes=file_data,
                                file_name=file_name,
                                folder_id=folder_id,
                                sa_credentials=sa_creds
                            )
                            
                            if success:
                                st.success(f"✅ ¡Archivo guardado exitosamente en Drive!")
                                st.caption(f"📎 File ID: {result}")
                            else:
                                st.error(f"❌ Error al subir: {result}")
            else:
                st.warning("No se seleccionó ninguna carpeta.")
        except Exception as e:
            st.error(f"Error procesando la selección del picker: {e}")

from googleapiclient.http import MediaIoBaseUpload
from src.utils.latency import measure_latency

@measure_latency(source="MiniERP", destination="Google Drive API", operation_name="Upload File (SA)")
def upload_file_with_sa(file_bytes, file_name, folder_id, sa_credentials):
    """
    Uploads a file to Google Drive using a Service Account.
    :param sa_credentials: Path to JSON file (str) OR dictionary with credentials (dict)
    """
    try:
        from google.oauth2 import service_account
        from googleapiclient.discovery import build
        
        # Load credentials
        # Check if it's NOT a string (path). If so, treat as dict/AttrDict.
        if not isinstance(sa_credentials, str):
            # Clonar para no modificar el original de st.secrets (que podría ser inmutable)
            info = dict(sa_credentials)
            if 'private_key' in info:
                # Fix común para Streamlit Secrets: reemplazar \\n con \n real
                info['private_key'] = info['private_key'].replace('\\n', '\n')
            
            creds = service_account.Credentials.from_service_account_info(
                info, 
                scopes=['https://www.googleapis.com/auth/drive']
            )
        else:
            creds = service_account.Credentials.from_service_account_file(
                sa_credentials, 
                scopes=['https://www.googleapis.com/auth/drive']
            )
        
        # Build Service
        service = build('drive', 'v3', credentials=creds)
        
        # File Metadata
        file_metadata = {
            'name': file_name,
            'parents': [folder_id]
        }
        
        # Media Upload
        media = MediaIoBaseUpload(io.BytesIO(file_bytes), mimetype='application/pdf')
        
        file = service.files().create(
            body=file_metadata,
            media_body=media,
            fields='id',
            supportsAllDrives=True  # ✅ Soporte para Shared Drives
        ).execute()
        
        return True, file.get('id')
        
    except Exception as e:
        # Debugging Info Propagation
        debug_msg = str(e)
        if isinstance(sa_credentials, dict) and 'private_key' in sa_credentials:
             pk = sa_credentials['private_key']
             # Mostrar si tiene saltos de linea o no
             has_real_newline = '\n' in pk
             has_escaped_newline = '\\n' in pk
             debug_msg += f" | KeyLen: {len(pk)} | HasRealNewLine: {has_real_newline} | HasEscapedNewLine: {has_escaped_newline} | Start: {pk[:10]}..."
        return False, debug_msg


def render_simple_folder_selector(key, label="Seleccionar Carpeta Destino"):
    """
    Navegador Nativo de Carpetas Institucional.
    Reemplaza al Google Picker para garantizar restricción de vista.
    Usa el Service Account para listar carpetas.
    """
    st.markdown(f"**{label}**")
    
    # 1. Configuración de Session State para navegación
    nav_key_id = f"nav_folder_id_{key}"
    nav_key_name = f"nav_folder_name_{key}"
    nav_key_history = f"nav_history_{key}" # Lista de tuplas (id, name)
    sel_key = f"selected_folder_{key}"

    # Inicialización
    if nav_key_id not in st.session_state:
        st.session_state[nav_key_id] = REPOSITORIO_FOLDER_ID
        st.session_state[nav_key_name] = "📁 REPOSITORIO_INANDES (Raíz)"
        st.session_state[nav_key_history] = []
    
    # Si ya se seleccionó una carpeta definitiva
    if sel_key in st.session_state:
        curr = st.session_state[sel_key]
        col_info, col_change = st.columns([4, 1])
        with col_info:
            st.success(f"✅ Destino Seleccionado: **{curr['name']}**")
        with col_change:
            if st.button("🔄 Cambiar", key=f"change_{key}"):
                del st.session_state[sel_key]
                st.rerun()
        return curr

    # 2. UI del Navegador
    current_id = st.session_state[nav_key_id]
    current_name = st.session_state[nav_key_name]
    
    # Header de Navegación
    st.info(f"📍 Estás en: **{current_name}**")
    
    # Botones de Acción (Atrás / Seleccionar Actual)
    col_back, col_select = st.columns([1, 3])
    with col_back:
        if st.session_state[nav_key_history]:
            if st.button("⬅️ Subir Nivel", key=f"btn_back_{key}"):
                # Pop del historial
                last_id, last_name = st.session_state[nav_key_history].pop()
                st.session_state[nav_key_id] = last_id
                st.session_state[nav_key_name] = last_name
                st.rerun()
        else:
            st.button("⬅️ Atrás", disabled=True, key=f"btn_back_disabled_{key}")

    with col_select:
        if st.button(f"✅ Seleccionar esta carpeta", key=f"btn_sel_curr_{key}", type="primary", use_container_width=True):
            st.session_state[sel_key] = {'id': current_id, 'name': current_name}
            st.rerun()

    st.markdown("---")
    st.markdown("📂 **Subcarpetas Disponibles:**")

    # 3. Listar Contenido (Backend SA)
    try:
        sa_creds = get_sa_credentials_dict()
        subfolders = list_folders_with_sa(current_id, sa_creds)
    except Exception as e:
        st.error(f"Error accediendo al repositorio: {e}")
        subfolders = []

    if not subfolders:
        st.caption("*(Carpeta vacía o sin subcarpetas)*")
    else:
        # Grid de carpetas: Usamos columnas para que sea más compacto
        for folder in subfolders:
            f_name = folder['name']
            f_id = folder['id']
            
            if st.button(f"📁 {f_name}", key=f"nav_to_{f_id}_{key}", use_container_width=True):
                # Navegar hacia dentro
                st.session_state[nav_key_history].append((current_id, current_name))
                st.session_state[nav_key_id] = f_id
                st.session_state[nav_key_name] = f_name
                st.rerun()

    return None


# --- NATIVE BROWSER V4 (Dynamic Height & Clean Path) ---
def render_folder_navigator_v2(key, label="Navegador del Repositorio"):
    """
    Renderiza un navegador de carpetas nativo (Streamlit puro) usando list_folders_with_sa.
    Mejoras V4: 
    - Layout: Grid de Ladrillos Dinámico (sin altura fija).
    - Visual: Zero Icons. Solo texto.
    - Lógica 1-Click: Si nombre contiene 'Anexo' -> Selecciona. Si no -> Navega.
    """
    
    # 1. Configuración de Session State
    nav_key_id = f"nav_folder_id_{key}"
    nav_key_name = f"nav_folder_name_{key}"
    nav_key_history = f"nav_history_{key}" # Lista de tuplas (id, name)
    sel_key = f"selected_folder_{key}"

    # Inicialización
    if nav_key_id not in st.session_state:
        st.session_state[nav_key_id] = REPOSITORIO_FOLDER_ID
        st.session_state[nav_key_name] = "Inicio"
        st.session_state[nav_key_history] = []
    
    current_id = st.session_state[nav_key_id]
    current_name = st.session_state[nav_key_name]
    selected_data = st.session_state.get(sel_key)
    
    # --- A. HEADER & PATH DISPLAY ---
    # Logic: If Selected, show Selection Path. If not, show Navigation Path.
    st.markdown(f"**{label}**")
    
    if selected_data:
        # Show FINAL Selection Path
        sel_path_str = " > ".join([h[1] for h in selected_data.get('full_path', [])])
        st.info(f"Ruta: {sel_path_str}") # Info box for selection is acceptable/clearer than plain text? user wanted "clean path". 
        # User complained about "box verde". Let's use clean marking.
        # st.markdown(f"Ruta: `{sel_path_str}`") # Clean code style
    else:
        # Show Current Navigation Path
        full_history = st.session_state.get(nav_key_history, []) + [(current_id, current_name)]
        path_names = [h[1] for h in full_history]
        path_str = " > ".join(path_names)
        st.text(f"Ruta: {path_str}")

    # Back Button (Only if not at root AND not selected? No, allowing back is good for browsing)
    # If selected, we might want to clear selection to browse again? 
    # Yes, typically if I select "Anexo 1", I am done.
    
    if selected_data:
        # Show "Clear Selection" to re-open browser
        if st.button("Cambiar Selección", key=f"clear_sel_{key}"):
            del st.session_state[sel_key]
            st.rerun()
        # Return immediately if selected? 
        # User wants to see the bricks? Probably not if selected.
        # "Est que si llega hasta donde debe muevelo para arriba en lugar del que no funciona."
        return selected_data
    
    # If NOT selected, show Browser:

    if st.session_state[nav_key_history]:
        if st.button("Subir Nivel", key=f"btn_up_{key}", type="secondary"):
            last_id, last_name = st.session_state[nav_key_history].pop()
            st.session_state[nav_key_id] = last_id
            st.session_state[nav_key_name] = last_name
            st.rerun()

    # --- B. CONTENT (Dynamic Grid) ---
    st.markdown("---")
    
    # Dynamic Container (Natural flow)
    with st.container(border=True):
        
        # Load content
        with st.spinner("Cargando..."):
            try:
                sa_creds = get_sa_credentials_dict()
                subfolders = list_folders_with_sa(current_id, sa_creds)
            except Exception as e:
                st.error(f"Error: {e}")
                subfolders = []
        
        if not subfolders:
            st.write("(Carpeta vacía)")
        else:
            # Sort alpha
            subfolders = sorted(subfolders, key=lambda x: x['name'])
            
        if not subfolders:
            st.write("(Carpeta vacía)")
        else:
            # Sort alpha
            subfolders = sorted(subfolders, key=lambda x: x['name'])
            
            # --- LOGIC SPLIT: ROOT vs SUBFOLDER ---
            # Root (Inicio) -> Show Alphabet Tabs
            # Subfolder -> Show Standard Grid (No Tabs)
            
            is_root = (current_id == REPOSITORIO_FOLDER_ID)
            
            if is_root:
                # --- ROOT LEVEL: ALPHABET TABS ---
                st.markdown("""
                <style>
                button[data-baseweb="tab"] {
                    font-size: 1.2rem !important;
                    font-weight: 600 !important;
                    padding: 10px 20px !important;
                }
                </style>
                """, unsafe_allow_html=True)
                
                # Group by First Letter
                groups = {}
                for folder in subfolders:
                    name = folder['name'].upper()
                    first_letter = name[0] if name else '#'
                    if not first_letter.isalpha():
                        first_letter = '#'
                    if first_letter not in groups:
                        groups[first_letter] = []
                    groups[first_letter].append(folder)
                
                # Define Tabs A-Z + #
                import string
                all_letters = list(string.ascii_uppercase)
                if '#' in groups:
                    all_letters.append('#')
                
                tabs = st.tabs(all_letters)
                
                for tab, letter in zip(tabs, all_letters):
                    with tab:
                        group_folders = groups.get(letter, [])
                        if not group_folders:
                            st.caption(f"(No hay carpetas con la letra {letter})")
                        else:
                            # 4-Col Grid for Root
                            cols_per_row = 4
                            rows = [group_folders[i:i + cols_per_row] for i in range(0, len(group_folders), cols_per_row)]
                            for row in rows:
                                cols = st.columns(cols_per_row)
                                for i, folder in enumerate(row):
                                    with cols[i]:
                                        _render_folder_brick(folder, key, nav_key_history, nav_key_id, nav_key_name, sel_key, current_id, current_name)
            
            else:
                # --- SUBFOLDER LEVEL: STANDARD GRID (NO TABS) ---
                # 4-Col Grid for Subfolders
                cols_per_row = 4
                rows = [subfolders[i:i + cols_per_row] for i in range(0, len(subfolders), cols_per_row)]
                
                for row in rows:
                    cols = st.columns(cols_per_row)
                    for i, folder in enumerate(row):
                        with cols[i]:
                            _render_folder_brick(folder, key, nav_key_history, nav_key_id, nav_key_name, sel_key, current_id, current_name)

def _render_folder_brick(folder, key, nav_key_history, nav_key_id, nav_key_name, sel_key, current_id, current_name):
    """Auxiliary function to render a single folder brick"""
    f_name = folder['name']
    f_id = folder['id']
    
    # Smart Logic
    is_leaf_target = "anexo" in f_name.lower()
    
    btn_label = f_name 
    btn_key = f"brick_{f_id}_{key}"
    btn_type = "primary" if is_leaf_target else "secondary"
    
    if st.button(btn_label, key=btn_key, type=btn_type, use_container_width=True):
        if is_leaf_target:
            # SELECT ACTION
            full_hist = st.session_state[nav_key_history] + [(current_id, current_name)]
            child_path = full_hist + [(f_id, f_name)]
            
            st.session_state[sel_key] = {
                'id': f_id, 
                'name': f_name, 
                'full_path': child_path
            }
            st.rerun()
        else:
            # NAVIGATE ACTION
            st.session_state[nav_key_history].append((current_id, current_name))
            st.session_state[nav_key_id] = f_id
            st.session_state[nav_key_name] = f_name
            st.rerun()

    return None

# -----------------------------------------------------------------------------
# --- EXTENSION FOR REPOSITORIO (BROWSER + FILES + CREATE FOLDER) ---
# -----------------------------------------------------------------------------

def list_all_files_with_sa(parent_id, sa_creds):
    """
    Lista TODO (Carpetas + Archivos) dentro de parent_id.
    Retorna lista de dicts: [{'id', 'name', 'mimeType', 'size', 'webViewLink', 'hasThumbnail', 'thumbnailLink'}]
    """
    try:
        from google.oauth2 import service_account
        from googleapiclient.discovery import build

        creds = service_account.Credentials.from_service_account_info(
            sa_creds, scopes=['https://www.googleapis.com/auth/drive']
        )
        service = build('drive', 'v3', credentials=creds)

        # Query: Todo lo que no esté en la basura
        query = f"'{parent_id}' in parents and trashed = false"
        
        results = service.files().list(
            q=query,
            pageSize=100,
            fields="nextPageToken, files(id, name, mimeType, size, webViewLink, thumbnailLink, iconLink)",
            includeItemsFromAllDrives=True,
            supportsAllDrives=True
        ).execute()
        
        return results.get('files', [])
    except Exception as e:
        st.error(f"Error listando archivos: {e}")
        return []

def create_folder_with_sa(parent_id, folder_name, sa_creds):
    """Crea una subcarpeta."""
    try:
        from google.oauth2 import service_account
        from googleapiclient.discovery import build
        
        info = dict(sa_creds)
        if 'private_key' in info:
             info['private_key'] = info['private_key'].replace('\\n', '\n')

        creds = service_account.Credentials.from_service_account_info(
            info, scopes=['https://www.googleapis.com/auth/drive']
        )
        service = build('drive', 'v3', credentials=creds)
        
        metadata = {
            'name': folder_name,
            'mimeType': 'application/vnd.google-apps.folder',
            'parents': [parent_id]
        }
        
        file = service.files().create(
            body=metadata,
            fields='id',
            supportsAllDrives=True
        ).execute()
        
        return True, file.get('id')
    except Exception as e:
        return False, str(e)


def render_repository_browser(key, root_id=REPOSITORIO_FOLDER_ID, label="Explorador de Archivos"):
    """
    Navegador COMPLETO para el módulo de Repositorio.
    Funciones:
    1. Listar Carpetas Y Archivos.
    2. Navegar folders (clic).
    3. Descargar archivos (clic abre link).
    4. Crear Nueva Carpeta.
    
    Updated: 2025-12-19 12:28 - Tabs alfabéticos implementados
    """
    
    # Session State
    nav_key_id = f"repo_nav_id_{key}"
    nav_key_name = f"repo_nav_name_{key}"
    nav_key_history = f"repo_nav_hist_{key}" 
    
    if nav_key_id not in st.session_state:
        st.session_state[nav_key_id] = root_id
        st.session_state[nav_key_name] = "Inicio"
        st.session_state[nav_key_history] = []
        
    current_id = st.session_state[nav_key_id]
    current_name = st.session_state[nav_key_name]
    
    # --- UI HEADER ---
    c_path, c_actions = st.columns([3, 1])
    
    with c_path:
        # Breadcrumb simple
        hist = st.session_state[nav_key_history]
        path_str = " > ".join([h[1] for h in hist] + [current_name])
        st.markdown(f"📍 **Ruta:** `{path_str}`")
        
        # Botón Subir Nivel
        if hist:
            if st.button("⬅️ Subir Nivel", key=f"repo_up_{key}"):
                last_id, last_name = st.session_state[nav_key_history].pop()
                st.session_state[nav_key_id] = last_id
                st.session_state[nav_key_name] = last_name
                st.rerun()

    with c_actions:
        # Create Folder UI
        with st.popover("➕ Nueva Carpeta"):
            new_folder_name = st.text_input("Nombre", key=f"new_fold_name_{key}")
            if st.button("Crear", key=f"do_create_{key}", type="primary"):
                 if new_folder_name:
                     with st.spinner("Creando..."):
                         sa_creds = get_sa_credentials_dict()
                         ok, res = create_folder_with_sa(current_id, new_folder_name, sa_creds)
                         if ok:
                             st.toast(f"✅ Carpeta '{new_folder_name}' creada.")
                             st.rerun() # Refresh to show new folder
                         else:
                             st.error(f"Error: {res}")

    st.divider()
    
    # --- CONTENT FETCH ---
    with st.spinner("Cargando contenidos..."):
        try:
            sa_creds = get_sa_credentials_dict()
            items = list_all_files_with_sa(current_id, sa_creds)
        except Exception as e:
            st.error(f"Error de conexión: {e}")
            items = []
            
    if not items:
        st.info("📂 Carpeta vacía.")
        return

    # --- RENDER GRID ---
    # Separate Folders vs Files
    folders = [i for i in items if i['mimeType'] == 'application/vnd.google-apps.folder']
    files = [i for i in items if i['mimeType'] != 'application/vnd.google-apps.folder']
    
    # Sort A-Z
    folders.sort(key=lambda x: x['name'].lower())
    files.sort(key=lambda x: x['name'].lower())
    
    # 1. FOLDERS section con TABS ALFABÉTICOS
    if folders:
        st.markdown("### 📁 Carpetas")
        
        # Agrupar carpetas por rangos alfabéticos
        def get_alpha_group(name):
            """Retorna el grupo alfabético de una carpeta"""
            first_letter = name[0].upper() if name else 'Z'
            if first_letter < 'E':
                return 'A-D'
            elif first_letter < 'I':
                return 'E-H'
            elif first_letter < 'M':
                return 'I-L'
            elif first_letter < 'Q':
                return 'M-P'
            elif first_letter < 'U':
                return 'Q-T'
            else:
                return 'U-Z'
        
        # Agrupar carpetas
        groups = {
            'A-D': [],
            'E-H': [],
            'I-L': [],
            'M-P': [],
            'Q-T': [],
            'U-Z': []
        }
        
        for folder in folders:
            group = get_alpha_group(folder['name'])
            groups[group].append(folder)
        
        # Filtrar grupos vacíos
        active_groups = {k: v for k, v in groups.items() if v}
        
        if active_groups:
            # Crear tabs solo para grupos con carpetas
            tab_names = list(active_groups.keys())
            tabs = st.tabs(tab_names)
            
            for tab, group_name in zip(tabs, tab_names):
                with tab:
                    group_folders = active_groups[group_name]
                    
                    # Grid de 4 columnas
                    cols_f = 4
                    rows_f = [group_folders[i:i + cols_f] for i in range(0, len(group_folders), cols_f)]
                    
                    for row in rows_f:
                        cols = st.columns(cols_f)
                        for i, f in enumerate(row):
                            with cols[i]:
                                # Folder Brick
                                if st.button(f"📁 {f['name']}", key=f"nav_to_{f['id']}_{key}", use_container_width=True):
                                    st.session_state[nav_key_history].append((current_id, current_name))
                                    st.session_state[nav_key_id] = f['id']
                                    st.session_state[nav_key_name] = f['name']
                                    st.rerun()
        else:
            # Fallback: Si no hay active_groups, mostrar todas las carpetas sin tabs
            st.warning("⚠️ No se pudieron agrupar las carpetas. Mostrando todas:")
            cols_f = 4
            rows_f = [folders[i:i + cols_f] for i in range(0, len(folders), cols_f)]
            
            for row in rows_f:
                cols = st.columns(cols_f)
                for i, f in enumerate(row):
                    with cols[i]:
                        if st.button(f"📁 {f['name']}", key=f"nav_to_{f['id']}_{key}_fallback", use_container_width=True):
                            st.session_state[nav_key_history].append((current_id, current_name))
                            st.session_state[nav_key_id] = f['id']
                            st.session_state[nav_key_name] = f['name']
                            st.rerun()
        st.markdown("")



    # 2. FILES section
    if files:
        st.markdown("### 📄 Archivos")
        # Layout: Table-like using columns for better data display (Name | Type | Link)
        
        for f in files:
            c1, c2, c3 = st.columns([0.6, 0.2, 0.2])
            with c1:
                # Icon based on mime
                icon = "📄"
                if "pdf" in f.get('mimeType', ''): icon = "📕"
                elif "image" in f.get('mimeType', ''): icon = "🖼️"
                elif "sheet" in f.get('mimeType', '') or "excel" in f.get('mimeType', ''): icon = "📊"
                
                st.markdown(f"**{icon} {f['name']}**")
            
            with c2:
                # Size approximation
                size_bytes = int(f.get('size', 0))
                size_mb = size_bytes / (1024 * 1024)
                st.caption(f"{size_mb:.2f} MB")
                
            with c3:
                # Direct Link
                link = f.get('webViewLink', '#')
                st.link_button("⬇️ Abrir/Bajar", link, use_container_width=True)
            
            st.divider()
