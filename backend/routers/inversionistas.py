# backend/routers/inversionistas.py
import os
import sys
import io
import datetime
import base64
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse, FileResponse, Response
from pydantic import BaseModel
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
logo_path = os.path.join(templates_dir, "logo_inandes.png")
firma_path = os.path.join(templates_dir, "firma_ricardo_gallo.png")

def _load_b64(file_p: str) -> str:
    if os.path.exists(file_p):
        with open(file_p, 'rb') as f:
            return "data:image/png;base64," + base64.b64encode(f.read()).decode('utf-8')
    return ""

LOGO_B64 = _load_b64(logo_path)
FIRMA_B64 = _load_b64(firma_path)


class PdfGenerateRequest(BaseModel):
    html: str
    filename: str = "documento_inandes.pdf"


import time
import re
import hashlib

@router.get("/valor-cuota-pdf/{id_fondo}")
def get_valor_cuota_pdf(
    id_fondo: str,
    year: int = 2026,
    tipo: str = "Bimestre",
    num: int = 1
):
    """
    Clonación literal 1:1 del motor legacy generate_cuotas_v25.py / v26.
    Genera el PDF del Valor Cuota en Python con Jinja2 (reporte_cuotas_transpuesto_v26.html)
    y lo sirve inline para el visor nativo de Chrome.
    """
    try:
        if tipo == 'Bimestre':
            start_month = (num - 1) * 2 + 1
            end_month = start_month + 1
        else:
            start_month = (num - 1) * 3 + 1
            end_month = start_month + 2

        import calendar
        _, last_day = calendar.monthrange(year, end_month)
        fecha_inicio_per = datetime.date(year, start_month, 1)
        fecha_fin_per = datetime.date(year, end_month, last_day)

        target_fondo = None if id_fondo == 'TODOS' else id_fondo
        filename = f"Reporte_NAV_V26_{id_fondo}_{year}_P{num}.pdf"

        cache_dir = os.path.join(backend_root, 'cache_reports')
        os.makedirs(cache_dir, exist_ok=True)
        cache_file = os.path.join(cache_dir, filename)

        if os.path.exists(cache_file):
            return FileResponse(
                cache_file,
                media_type="application/pdf",
                headers={"Content-Disposition": f'inline; filename="{filename}"'}
            )

        supabase = get_supabase_client()
        query_fondos = supabase.table('crm_fondos').select('*')
        if target_fondo:
            query_fondos = query_fondos.eq('id_fondo', target_fondo)
        
        res_fondos = query_fondos.order('vigencia_tasa', desc=True).order('nombre_fondo').execute()
        fondos = res_fondos.data or []

        if not fondos:
            raise HTTPException(status_code=404, detail="No se encontraron fondos para el reporte")

        cert_res = supabase.table('crm_contratos').select(
            'id_contrato, fecha_inicio, monto_inversion, id_fondo, tasa_pactada, moneda'
        ).eq('estado', 'emitido').execute()
        all_certs = cert_res.data or []

        cert_ids = [c['id_contrato'] for c in all_certs]
        aum_map = defaultdict(list)
        if cert_ids:
            aum_res = supabase.table('crm_certificados_eventos').select('*').in_('id_certificado', cert_ids).eq('tipo_evento', 'aumento_capital').execute()
            for a in (aum_res.data or []):
                f_ing = datetime.date.fromisoformat(a['fecha_periodo_origen'].split('T')[0])
                monto = float(a.get('capital_final_saldo') or 0) - float(a.get('capital_base') or 0)
                aum_map[a['id_certificado']].append({"fecha": f_ing, "monto": monto})

        dias_periodo = [fecha_inicio_per + datetime.timedelta(days=i) for i in range((fecha_fin_per - fecha_inicio_per).days + 1)]

        fondos_reportes = []
        month_names = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]

        for fondo in fondos:
            fid = fondo['id_fondo']
            t_activa = float(fondo.get('tasa_activa') or 0) / 100
            p_admin  = float(fondo.get('comision_administracion_fondo') or 0) / 100
            p_cap    = float(fondo.get('comision_captacion_fondo') or 0) / 100
            p_misc   = float(fondo.get('comision_miscelaneos_fondo') or 0) / 100

            certs_fondo = [c for c in all_certs if c['id_fondo'] == fid]
            if not certs_fondo:
                continue

            def get_sort_key(cid):
                if not cid: return 999
                m = re.search(r'[.-](\d+)', cid)
                return int(m.group(1)) if m else 999
            
            certs_fondo.sort(key=lambda x: get_sort_key(x['id_contrato']))

            cert_rows = [] 
            for c in certs_fondo:
                v_ini = 1.0
                cid = c['id_contrato']
                birth_events = [a for a in aum_map.get(cid, []) if a["fecha"] == fecha_inicio_per]
                capital_inicial = sum(a["monto"] for a in birth_events) or float(c['monto_inversion'])
                
                row = {
                    "tipo": "CERT", "id": cid, "capital": capital_inicial,
                    "cuotas": capital_inicial / v_ini, "emision": datetime.date.fromisoformat(c['fecha_inicio']),
                    "interes_acum": 0.0, "valores_dia": [], "hijos": []
                }
                cert_rows.append(row)

            def create_total_row(label, is_summary=True, is_comision=False, is_vc=False):
                return {"tipo": "TOTAL", "id": label, "capital": None, "cuotas": None, "valores_dia": [], "interes_acum": None, "is_summary": is_summary, "is_comision": is_comision, "is_vc": is_vc}

            r_tot_cap = create_total_row("TOTAL CAPITAL")
            r_tot_cap["capital"] = sum(c["capital"] for c in cert_rows)

            summary_rows = [
                r_tot_cap, {"tipo": "SPACER"},
                create_total_row("INVERSIONES ORIGINALES"), create_total_row("INV. ORIGINALES ACUMULADAS"), 
                create_total_row("CUOTAS ORIGINALES"), create_total_row("CUOTAS ORIGINALES ACUMULADAS"), 
                create_total_row("VAL CUOTA INICIAL", is_vc=True), {"tipo": "SPACER"},
                create_total_row("GANANCIA TOTAL BRUTA"), create_total_row("GANANCIA TOTAL ACUMULADA"), 
                create_total_row("PATRIMONO TOTAL"), {"tipo": "SPACER"},
                create_total_row("COM. ADMIN (-)", is_comision=True), create_total_row("COM. ADMIN ACUM. (-)", is_comision=True), 
                create_total_row("COM. CAPT. (-)", is_comision=True), create_total_row("COM. CAPT. ACUM. (-)", is_comision=True), 
                create_total_row("COM. MISC. (-)", is_comision=True), create_total_row("COM. MISC. ACUM. (-)", is_comision=True), {"tipo": "SPACER"},
                create_total_row("GANANCIA OPERATIVA"), create_total_row("GANANCIA OPERATIVA ACUMULADA"), {"tipo": "SPACER"},
                create_total_row("PATRIMONIO TOTAL CIERRE"), create_total_row("CUOTA TOTAL CIERRE"), create_total_row("VAL CUOTA FINAL", is_vc=True)
            ]

            patrimonio_ayer = sum(c["capital"] for c in cert_rows)
            cuotas_ayer = sum(c["cuotas"] for c in cert_rows)
            f_acum_utilidad = 0.0
            f_acum_admin, f_acum_cap, f_acum_misc = 0.0, 0.0, 0.0
            f_total_inv_orig_acum = patrimonio_ayer 
            val_cuota_ayer = 1.0 

            for d in dias_periodo:
                ingreso_bruto_dia = patrimonio_ayer * (t_activa / 360)
                gasto_admin = patrimonio_ayer * (p_admin / 365)
                gasto_cap   = patrimonio_ayer * (p_cap / 365)
                gasto_misc  = patrimonio_ayer * (p_misc / 365)
                utilidad_neta_dia = ingreso_bruto_dia - (gasto_admin + gasto_cap + gasto_misc)
                
                f_acum_utilidad += ingreso_bruto_dia 
                f_acum_admin    += gasto_admin
                f_acum_cap      += gasto_cap
                f_acum_misc     += gasto_misc
                
                pat_pre = patrimonio_ayer + utilidad_neta_dia
                v_cuota_hoy = pat_pre / cuotas_ayer if cuotas_ayer > 0 else 1.0
                
                for row in cert_rows:
                    int_dia = (row["capital"] * (t_activa / 360)) if d >= row["emision"] else 0.0
                    row["valores_dia"].append(int_dia)
                    for h in row["hijos"]: h["valores_dia"].append((h["monto"] * (t_activa / 360)) if d >= h["fecha_ingreso"] else 0.0)

                aportes_dia = 0.0
                for row in cert_rows:
                    for a in aum_map.get(row["id"], []):
                        if a["fecha"] == d and d > fecha_inicio_per:
                            monto_aum = a["monto"]
                            nuevas_cuotas = monto_aum / v_cuota_hoy
                            row["hijos"].append({"tipo": "AUMENTO", "id": f"Aumento ({a['fecha'].strftime('%d/%m')})", "monto": monto_aum, "fecha_ingreso": a["fecha"], "valores_dia": [0.0]*len(row["valores_dia"])})
                            row["capital"] += monto_aum
                            row["cuotas"] += nuevas_cuotas
                            aportes_dia += monto_aum

                def get_s_row(label): return next(r for r in summary_rows if r.get("id") == label)
                
                get_s_row("INVERSIONES ORIGINALES")["valores_dia"].append(aportes_dia)
                f_total_inv_orig_acum += aportes_dia
                get_s_row("INV. ORIGINALES ACUMULADAS")["valores_dia"].append(f_total_inv_orig_acum)
                get_s_row("VAL CUOTA INICIAL")["valores_dia"].append(val_cuota_ayer)
                get_s_row("GANANCIA TOTAL BRUTA")["valores_dia"].append(ingreso_bruto_dia)
                get_s_row("GANANCIA TOTAL ACUMULADA")["valores_dia"].append(f_acum_utilidad)
                get_s_row("PATRIMONO TOTAL")["valores_dia"].append(f_total_inv_orig_acum + f_acum_utilidad)
                get_s_row("COM. ADMIN (-)")["valores_dia"].append(gasto_admin)
                get_s_row("COM. ADMIN ACUM. (-)")["valores_dia"].append(f_acum_admin)
                get_s_row("COM. CAPT. (-)")["valores_dia"].append(gasto_cap)
                get_s_row("COM. CAPT. ACUM. (-)")["valores_dia"].append(f_acum_cap)
                get_s_row("COM. MISC. (-)")["valores_dia"].append(gasto_misc)
                get_s_row("COM. MISC. ACUM. (-)")["valores_dia"].append(f_acum_misc)
                get_s_row("GANANCIA OPERATIVA")["valores_dia"].append(utilidad_neta_dia)
                get_s_row("GANANCIA OPERATIVA ACUMULADA")["valores_dia"].append(f_acum_utilidad - f_acum_admin - f_acum_cap - f_acum_misc)
                
                pat_total_cierre = pat_pre + aportes_dia
                get_s_row("PATRIMONIO TOTAL CIERRE")["valores_dia"].append(pat_total_cierre)
                get_s_row("VAL CUOTA FINAL")["valores_dia"].append(v_cuota_hoy)

                patrimonio_ayer, val_cuota_ayer = pat_total_cierre, v_cuota_hoy

            block_rows_meta = []
            for idx_c, r in enumerate(cert_rows, 1):
                r["num"] = idx_c ; block_rows_meta.append(r)
                for h in r["hijos"]: block_rows_meta.append(h)
            block_rows_meta.extend(summary_rows)

            blocks = []
            months = defaultdict(list)
            for i_d, d in enumerate(dias_periodo): months[(d.year, d.month)].append(i_d)
            block_idx = 1
            for (y, m), idxs in sorted(months.items()):
                s, e = idxs[0], idxs[-1]+1
                block_data = {
                    "idx": block_idx,
                    "month_name": f"{month_names[m - 1]} {y}",
                    "days": [dias_periodo[i].strftime('%d/%m') for i in idxs],
                    "rows": []
                }
                block_idx += 1
                for r in block_rows_meta:
                    if r["tipo"] == "SPACER": block_data["rows"].append({"tipo": "SPACER"}) ; continue
                    block_data["rows"].append({
                        "tipo": r["tipo"], "id": r["id"], "num": r.get("num", ""),
                        "is_summary": r.get("is_summary", False), "is_comision": r.get("is_comision", False), "is_vc": r.get("is_vc", False),
                        "capital": r.get("capital") if r["tipo"] == "CERT" else r.get("monto"),
                        "cuotas": r.get("cuotas"),
                        "valores": r["valores_dia"][s:e]
                    })
                blocks.append(block_data)

            fondos_reportes.append({"fondo": fondo, "blocks": blocks, "vars": {"activa": f"{t_activa*100:.2f}", "admin": f"{p_admin*100:.2f}"}})

        env = Environment(loader=FileSystemLoader(templates_dir))
        env.globals['format_num'] = format_num
        template = env.get_template('reporte_cuotas_transpuesto_v26.html')

        html_out = template.render({
            'fondos': fondos_reportes,
            'print_date': datetime.date.today().strftime('%d/%m/%Y'),
            'version': 'v26'
        })

        HTML(string=html_out, base_url=backend_root).write_pdf(target=cache_file)

        return FileResponse(
            cache_file,
            media_type="application/pdf",
            headers={"Content-Disposition": f'inline; filename="{filename}"'}
        )

    except Exception as err:
        raise HTTPException(status_code=500, detail=f"Error generando PDF Valor Cuota: {str(err)}")

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

