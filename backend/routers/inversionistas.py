# backend/routers/inversionistas.py
import os
import sys
import io
import datetime
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse, FileResponse
from jinja2 import Environment, FileSystemLoader
from weasyprint import HTML

# Add backend directory to sys.path
backend_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if backend_root not in sys.path:
    sys.path.insert(0, backend_root)

from supabase import create_client

SUPABASE_URL = "https://egvcinsbyropumybatdf.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVndmNpbnNieXJvcHVteWJhdGRmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDA0NDczNCwiZXhwIjoyMDk5NjIwNzM0fQ.28T_xQmSRJO1O1scio61JU0KHhEQfzSS94qYka8TrcA"

def get_supabase_client():
    return create_client(SUPABASE_URL, SUPABASE_KEY)


router = APIRouter()

templates_dir = os.path.join(backend_root, 'templates')

logo_path = "/opt/erp_inandes/backend/templates/logo_inandes.png"
firma_path = "/opt/erp_inandes/backend/templates/firma_ricardo_gallo.png"


def format_num(val):
    if val is None or val == "" or val == "-":
        return "-"
    try:
        n = float(val)
        if abs(n) < 0.0001:
            return "-"
        return f"{n:,.2f}"
    except (ValueError, TypeError):
        return str(val)

def numero_a_letras_soles(monto: float) -> str:
    monto = round(monto, 2)
    enteros = int(monto)
    centavos = int(round((monto - enteros) * 100))
    cc = f"{centavos:02d}/100"
    
    UNI = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE']
    DEC = ['', 'DIEZ', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA']
    ESP = {11: 'ONCE', 12: 'DOCE', 13: 'TRECE', 14: 'CATORCE', 15: 'QUINCE',
           16: 'DIECISEIS', 17: 'DIECISIETE', 18: 'DIECIOCHO', 19: 'DIECINUEVE',
           21: 'VEINTIUN', 22: 'VEINTIDOS', 23: 'VEINTITRES', 24: 'VEINTICUATRO',
           25: 'VEINTICINCO', 26: 'VEINTISEIS', 27: 'VEINTISIETE', 28: 'VEINTIOCHO', 29: 'VEINTINUEVE'}
    CEN = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS',
           'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS']

    def t3(n: int) -> str:
        if n == 0:
            return ''
        if n == 100:
            return 'CIEN'
        c = n // 100
        du = n % 100
        d = du // 10
        u = du % 10
        r = (CEN[c] + ' ') if c else ''
        if du in ESP:
            r += ESP[du]
        elif d > 0 and u > 0:
            r += f"{DEC[d]} Y {UNI[u]}"
        elif d > 0:
            r += DEC[d]
        elif u > 0:
            r += UNI[u]
        return r.strip()

    if enteros == 0:
        return f"CERO CON {cc}"
    
    miles = enteros // 1000
    resto = enteros % 1000
    
    txt = ''
    if miles == 1:
        txt = 'MIL '
    elif miles > 1:
        txt = f"{t3(miles)} MIL "
    
    txt += t3(resto)
    return f"{txt.strip().lower()} con {cc}"

def format_date_str(d_str: str) -> str:
    if not d_str:
        return ""
    try:
        parts = d_str.split('-')
        if len(parts) == 3:
            return f"{parts[2]}-{parts[1]}-{parts[0]}"
    except Exception:
        pass
    return d_str


@router.get("/eecc/{id_fondo}/{fecha_fin}")
def get_eecc_pdf(id_fondo: str, fecha_fin: str):
    """
    Genera y sirve el PDF de Estado de Cuenta (EECC) para el periodo cerrado especificado.
    """
    try:
        supabase = get_supabase_client()
        query = supabase.table('crm_certificados_eventos').select('*').eq('fecha_periodo_fin', fecha_fin)
        res = query.execute()
        
        events = res.data or []
        if id_fondo != 'TODOS':
            events = [e for e in events if e.get('id_certificado', '').startswith(id_fondo) or e.get('id_contrato', '').startswith(id_fondo)]
        
        events = [e for e in events if e.get('tipo_evento') in ['cierre_fin_ciclo', 'cierre_fin_contrato', 'emision_inicial', 'aumento_capital']]
        
        if not events:
            raise HTTPException(status_code=404, detail=f"No se encontraron registros contables para {id_fondo} en la fecha {fecha_fin}")

        res_fondos = supabase.table('crm_fondos').select('*').execute()
        fondos_map = {f['id_fondo']: f for f in (res_fondos.data or [])}

        certs = []
        for e in events:
            payload = e.get('payload_asiento') or {}
            f_code = e.get('id_contrato', '').split('-')[0]
            fondo_info = fondos_map.get(f_code, {})
            nombre_fondo = fondo_info.get('nombre_fondo', f_code)
            moneda = payload.get('moneda') or fondo_info.get('moneda') or 'PEN'
            valor_cuota = float(fondo_info.get('valor_cuota_inicial', 1.0))
            
            inversionista = payload.get('inversionista') or e.get('notas') or 'Inversionista'

            cert_data = {
                'fondo_nombre': nombre_fondo,
                'fecha_inicio_str': format_date_str(e.get('fecha_periodo_origen', '')),
                'fecha_fin_str': format_date_str(e.get('fecha_periodo_fin', '')),
                'inversionista_nombre': inversionista,
                'id_certificado': e.get('id_contrato', e.get('id_certificado')),
                'moneda': moneda,
                'capital_inicial': e.get('capital_base', 0.0),
                'bruto_total': e.get('interes_generado_bruto', 0.0),
                'impuesto': e.get('impuestos_renta', 0.0),
                'deducciones': e.get('monto_deduccion', 0.0),
                'neto_disponible': e.get('interes_neto_disponible', 0.0),
                'capitalizacion': e.get('monto_capitalizacion', 0.0),
                'rescates': e.get('monto_rescate', 0.0),
                'monto_transferido': float(e.get('monto_reparto', 0.0) or 0.0) + float(e.get('monto_rescate', 0.0) or 0.0),
                'capital_final': e.get('capital_final_saldo', 0.0),
                'valor_cuota': valor_cuota,
            }
            certs.append(cert_data)

        cache_dir = os.path.join(backend_root, 'cache_reports')
        os.makedirs(cache_dir, exist_ok=True)
        cache_file = os.path.join(cache_dir, f"EECC_{id_fondo}_{fecha_fin}.pdf")
        filename = f"EECC_{id_fondo}_{fecha_fin}.pdf"

        if os.path.exists(cache_file):
            return FileResponse(
                cache_file,
                media_type="application/pdf",
                headers={"Content-Disposition": f"inline; filename={filename}"}
            )

        env = Environment(loader=FileSystemLoader(templates_dir))
        env.globals['format_num'] = format_num
        template = env.get_template('estado_cuenta_inversionista_v2.html')

        html_out = template.render({
            'certs': certs,
            'logo_path': logo_path
        })

        HTML(string=html_out, base_url=backend_root).write_pdf(target=cache_file)

        return FileResponse(
            cache_file,
            media_type="application/pdf",
            headers={"Content-Disposition": f"inline; filename={filename}"}
        )

    except HTTPException:
        raise
    except Exception as err:
        raise HTTPException(status_code=500, detail=f"Error al generar EECC PDF: {str(err)}")


@router.get("/retenciones/{id_fondo}/{fecha_fin}")
def get_retenciones_pdf(id_fondo: str, fecha_fin: str):
    """
    Genera y sirve el PDF de Certificado de Retención de 2da Categoría para el periodo especificado.
    Utiliza persistencia en disco (Cache-First) para respuesta instantánea idéntica a Forecast.
    """
    try:
        cache_dir = os.path.join(backend_root, 'cache_reports')
        os.makedirs(cache_dir, exist_ok=True)
        cache_file = os.path.join(cache_dir, f"RETENCIONES_{id_fondo}_{fecha_fin}.pdf")
        filename = f"RETENCIONES_{id_fondo}_{fecha_fin}.pdf"

        if os.path.exists(cache_file):
            return FileResponse(
                cache_file,
                media_type="application/pdf",
                headers={"Content-Disposition": f"inline; filename={filename}"}
            )

        supabase = get_supabase_client()
        query = supabase.table('crm_certificados_eventos').select('*').eq('fecha_periodo_fin', fecha_fin)
        res = query.execute()
        
        events = res.data or []
        if id_fondo != 'TODOS':
            events = [e for e in events if e.get('id_certificado', '').startswith(id_fondo) or e.get('id_contrato', '').startswith(id_fondo)]
        
        events = [e for e in events if (e.get('impuestos_renta') or 0.0) > 0]

        if not events:
            raise HTTPException(status_code=404, detail=f"No se encontraron certificados de retencion con monto > 0 para {id_fondo} en la fecha {fecha_fin}")

        res_fondos = supabase.table('crm_fondos').select('*').execute()
        fondos_map = {f['id_fondo']: f for f in (res_fondos.data or [])}

        res_inv = supabase.table('crm_inversionistas').select('*').execute()
        inv_list = res_inv.data or []
        
        def find_inv_details(nombre_inv: str):
            if not nombre_inv:
                return {"dni": "", "direccion": "Domicilio no registrado"}
            n_clean = nombre_inv.upper().strip()
            for inv in inv_list:
                comp = inv.get('nombre_completo', '').upper().strip()
                if n_clean in comp or comp in n_clean:
                    return {
                        "dni": inv.get('documento_identidad', ''),
                        "direccion": inv.get('direccion_fiscal') or "Domicilio no registrado"
                    }
                n1 = inv.get('nombre_1', '').upper()
                a1 = inv.get('apellido_1', '').upper()
                if n1 and a1 and (n1 in n_clean and a1 in n_clean):
                    return {
                        "dni": inv.get('documento_identidad', ''),
                        "direccion": inv.get('direccion_fiscal') or "Domicilio no registrado"
                    }
            return {"dni": "", "direccion": "Domicilio no registrado"}

        TC_USD_PEN = 3.662
        hoy = datetime.date.today()
        meses_es = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
                    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
        dia_hoy = str(hoy.day)
        mes_hoy = meses_es[hoy.month - 1]
        anio_hoy = str(hoy.year)

        certificados = []
        for e in events:
            payload = e.get('payload_asiento') or {}
            f_code = e.get('id_contrato', '').split('-')[0]
            fondo_info = fondos_map.get(f_code, {})
            nombre_fondo = fondo_info.get('nombre_fondo', f_code)
            moneda = payload.get('moneda') or fondo_info.get('moneda') or 'PEN'
            
            inversionista = payload.get('inversionista') or 'Inversionista'
            inv_details = find_inv_details(inversionista)

            impuesto_raw = float(e.get('impuestos_renta', 0.0))
            if moneda == 'USD':
                ir_pen = round(impuesto_raw * TC_USD_PEN, 2)
            else:
                ir_pen = round(impuesto_raw, 2)

            cert_item = {
                'num_certificado': e.get('id_contrato', e.get('id_certificado')),
                'nombre_fondo': nombre_fondo,
                'nombres_participes': inversionista,
                'dni_participes': inv_details['dni'],
                'direccion_fiscal': inv_details['direccion'],
                'monto_ir_pen_num': f"{ir_pen:,.2f}",
                'monto_ir_pen_letras': numero_a_letras_soles(ir_pen),
                'f_inicio': format_date_str(e.get('fecha_periodo_origen', '')),
                'f_fin': format_date_str(e.get('fecha_periodo_fin', '')),
                'moneda': moneda,
                'base_retencion': f"{float(e.get('interes_generado_bruto', 0.0)):,.2f}",
                'fecha_operacion': format_date_str(e.get('fecha_periodo_fin', '')),
                'tipo_cambio_display': f"PEN {TC_USD_PEN:.3f}",
                'dia_hoy': dia_hoy,
                'mes_hoy': mes_hoy,
                'anio_hoy': anio_hoy
            }
            certificados.append(cert_item)

        env = Environment(loader=FileSystemLoader(templates_dir))
        template = env.get_template('retencion_renta_v2.html')

        html_out = template.render({
            'certificados': certificados,
            'logo_path': logo_path,
            'firma_path': firma_path
        })

        HTML(string=html_out, base_url=backend_root).write_pdf(target=cache_file)

        return FileResponse(
            cache_file,
            media_type="application/pdf",
            headers={"Content-Disposition": f"inline; filename={filename}"}
        )

    except HTTPException:
        raise
    except Exception as err:
        raise HTTPException(status_code=500, detail=f"Error al generar Retenciones PDF: {str(err)}")

