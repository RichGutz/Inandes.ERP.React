"""
Generador de PDF para Partícipes CRM
Genera un formulario de una página por cada partícipe con todos sus datos
"""

from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import io

def generate_participants_pdf(participants_list):
    """
    Genera un PDF con una página por cada partícipe
    mostrando todos los campos de todos los tabs
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter,
                           rightMargin=0.5*inch, leftMargin=0.5*inch,
                           topMargin=0.5*inch, bottomMargin=0.5*inch)
    
    elements = []
    styles = getSampleStyleSheet()
    
    # Estilo para títulos
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=14,
        textColor=colors.HexColor('#1f4788'),
        spaceAfter=12
    )
    
    # Estilo para subtítulos
    subtitle_style = ParagraphStyle(
        'CustomSubtitle',
        parent=styles['Heading2'],
        fontSize=11,
        textColor=colors.HexColor('#2e5c8a'),
        spaceAfter=6
    )
    
    for idx, p in enumerate(participants_list):
        # Título de la página
        nombre = f"{p.get('apellido_1', '')} {p.get('apellido_2', '')} {p.get('nombre_1', '')} {p.get('nombre_2', '')}".strip()
        elements.append(Paragraph(f"<b>FICHA DE PARTÍCIPE - {nombre or 'Sin Nombre'}</b>", title_style))
        elements.append(Spacer(1, 0.1*inch))
        
        # Función helper para crear tabla de datos
        def create_data_table(title, fields_dict):
            data = [[Paragraph(f"<b>{title}</b>", subtitle_style)]]
            for label, value in fields_dict.items():
                val_str = str(value) if value not in [None, '', 'None'] else '_______________'
                data.append([f"{label}:", val_str])
            
            table = Table(data, colWidths=[2.5*inch, 4.5*inch])
            table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#e8f4f8')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.HexColor('#1f4788')),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 10),
                ('FONTNAME', (0, 1), (0, -1), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 1), (-1, -1), 8),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
                ('TOPPADDING', (0, 0), (-1, -1), 4),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
                ('SPAN', (0, 0), (-1, 0)),
            ]))
            return table
        
        # TITULAR P1
        p1_fields = {
            'DNI/CEX': f"{p.get('tipo_doc', '')} {p.get('documento_identidad', '')}",
            'Nombres': f"{p.get('nombre_1', '')} {p.get('nombre_2', '')}",
            'Apellidos': f"{p.get('apellido_1', '')} {p.get('apellido_2', '')}",
            'Email': p.get('email', ''),
            'Teléfono': p.get('telefono', ''),
            'Dirección': p.get('direccion_fiscal', ''),
            'Estado Civil': p.get('estado_civil', ''),
            'Ocupación': p.get('ocupacion', ''),
        }
        elements.append(create_data_table('👤 TITULAR', p1_fields))
        elements.append(Spacer(1, 0.15*inch))
        
        # COTITULARES (Soportando multi-participantes si existen en el dict)
        # Nota: En crm_inversionistas solo hay 1 inversionista por fila, pero
        # la lógica de contratos usa multi-inversionista.
        for prefix in ['P2', 'P3', 'P4']:
            if p.get(f'documento_identidad_{prefix}'):
                p_fields = {
                    'DNI/CEX': f"{p.get(f'tipo_doc_{prefix}', '')} {p.get(f'documento_identidad_{prefix}', '')}",
                    'Nombres': f"{p.get(f'nombre_1_{prefix}', '')} {p.get(f'nombre_2_{prefix}', '')}",
                    'Apellidos': f"{p.get(f'apellido_1_{prefix}', '')} {p.get(f'apellido_2_{prefix}', '')}",
                }
                elements.append(create_data_table(f'👥 COTITULAR ({prefix})', p_fields))
                elements.append(Spacer(1, 0.1*inch))
        
        # CUENTAS BANCARIAS
        cuenta_fields = {
            'Cuenta 1 - Moneda': p.get('moneda_cuenta_1', ''),
            'Cuenta 1 - Banco': p.get('banco_nombre_1', ''),
            'Cuenta 1 - Número': p.get('numero_cuenta_1', ''),
            'Cuenta 1 - CCI': p.get('cci_1', ''),
            'Cuenta 2 - Moneda': p.get('moneda_cuenta_2', ''),
            'Cuenta 2 - Banco': p.get('banco_nombre_2', ''),
            'Cuenta 2 - Número': p.get('numero_cuenta_2', ''),
            'Cuenta 2 - CCI': p.get('cci_2', ''),
        }
        elements.append(create_data_table('💰 CUENTAS BANCARIAS', cuenta_fields))
        elements.append(Spacer(1, 0.15*inch))
        
        # ASESOR
        asesor_fields = {
            'Nombre Asesor': p.get('asesor_nombre', ''),
            'Email Asesor': p.get('asesor_email', ''),
        }
        elements.append(create_data_table('👔 ASESOR ASIGNADO', asesor_fields))
        
        # Agregar página nueva si no es el último
        if idx < len(participants_list) - 1:
            elements.append(PageBreak())
    
    # Generar PDF
    doc.build(elements)
    return buffer.getvalue()

def _create_advisor_elements(advisor, styles):
    """Helper to create flowables for a single advisor"""
    elements = []
    
    title_style = ParagraphStyle(
        'AdvisorTitle',
        parent=styles['Heading1'],
        fontSize=16,
        textColor=colors.HexColor('#1f4788'),
        spaceAfter=12,
        alignment=1 # Center
    )
    
    subtitle_style = ParagraphStyle(
        'AdvisorSubtitle',
        parent=styles['Heading2'],
        fontSize=12,
        textColor=colors.HexColor('#2e5c8a'),
        spaceAfter=6,
        spaceBefore=12
    )

    # 1. Cabecera
    nombre = advisor.get('nombre_completo', 'SIN NOMBRE')
    codigo = advisor.get('codigo', 'PENDIENTE')
    
    elements.append(Paragraph(f"<b>FICHA DE DATOS DEL ASESOR</b>", title_style))
    elements.append(Paragraph(f"<b>{nombre}</b>", title_style))
    elements.append(Paragraph(f"Código: {codigo}", styles['Normal']))
    elements.append(Spacer(1, 0.2*inch))
    
    # Helper Table
    def create_section_table(data_dict):
        table_data = []
        for label, val in data_dict.items():
            display_val = str(val) if val and str(val).strip() not in ['None', ''] else "____________________________________"
            val_style = ParagraphStyle('Val', parent=styles['Normal'], textColor=colors.black)
            row = [
                Paragraph(f"<b>{label}:</b>", styles['Normal']),
                Paragraph(display_val, val_style)
            ]
            table_data.append(row)
            
        t = Table(table_data, colWidths=[2.5*inch, 4.5*inch])
        t.setStyle(TableStyle([
            ('GRID', (0,0), (-1,-1), 0.5, colors.lightgrey),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('PADDING', (0,0), (-1,-1), 6),
            ('BACKGROUND', (0,0), (0,-1), colors.HexColor('#f0f2f6')), 
        ]))
        return t

    # 2. Datos Personales
    elements.append(Paragraph("1. DATOS DE IDENTIDAD Y CONTACTO", subtitle_style))
    p_data = {
        "Tipo Documento": advisor.get('tipo_documento'),
        "Número Documento": advisor.get('documento_identidad'),
        "Fecha Nacimiento": advisor.get('fecha_nacimiento'),
        "Nacionalidad": advisor.get('nacionalidad'),
        "Estado Civil": advisor.get('estado_civil'),
        "Profesión": advisor.get('profesion'),
        "Email": advisor.get('email'),
        "Celular": advisor.get('telefono')
    }
    elements.append(create_section_table(p_data))
    
    # 3. Datos Domicilio
    elements.append(Paragraph("2. DOMICILIO FISCAL", subtitle_style))
    d_data = {
        "Dirección": advisor.get('direccion'),
        "Distrito": advisor.get('distrito'),
        "Provincia": advisor.get('provincia'),
        "Departamento": advisor.get('departamento'),
        "Código Postal": advisor.get('codigo_postal'),
        "País Residencia": advisor.get('pais_residencia')
    }
    elements.append(create_section_table(d_data))
    
    # 4. Datos Laborales
    elements.append(Paragraph("3. INFORMACIÓN LABORAL", subtitle_style))
    l_data = {
        "Ocupación Actual": advisor.get('ocupacion'),
        "Centro de Labores": advisor.get('centro_labores'),
        "Cargo": advisor.get('cargo_ocupado'),
        "Antigüedad (Años)": advisor.get('antiguedad_laboral_anios')
    }
    elements.append(create_section_table(l_data))

    # 5. PEP
    elements.append(Paragraph("4. PERSONA EXPUESTA POLÍTICAMENTE (PEP)", subtitle_style))
    pep_val = "SÍ" if advisor.get('es_pep') else "NO"
    pep_data = {
        "¿Es PEP?": pep_val,
        "Detalle PEP": advisor.get('pep_detalle') if advisor.get('es_pep') else "N/A"
    }
    elements.append(create_section_table(pep_data))

    elements.append(PageBreak())

    # 6. Datos Bancarios
    elements.append(Paragraph("5. CUENTAS BANCARIAS (COMISIONES)", subtitle_style))
    b_data = {
        "Banco (Soles)": advisor.get('banco_nombre_pen'),
        "Cuenta (Soles)": advisor.get('numero_cuenta_pen'),
        "CCI (Soles)": advisor.get('cci_pen'),
        "Banco (Dólares)": advisor.get('banco_nombre_usd'),
        "Cuenta (Dólares)": advisor.get('numero_cuenta_usd'),
        "CCI (Dólares)": advisor.get('cci_usd')
    }
    elements.append(create_section_table(b_data))
    
    return elements

def generate_advisor_sheet(advisor):
    """Generates a single PDF for one advisor"""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter,
                           rightMargin=0.5*inch, leftMargin=0.5*inch,
                           topMargin=0.5*inch, bottomMargin=0.5*inch)
    
    styles = getSampleStyleSheet()
    elements = _create_advisor_elements(advisor, styles)
    
    doc.build(elements)
    return buffer.getvalue()

def generate_merged_advisor_sheets(advisors_list):
    """Generates a single merged PDF for ALL advisors in the list"""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter,
                           rightMargin=0.5*inch, leftMargin=0.5*inch,
                           topMargin=0.5*inch, bottomMargin=0.5*inch)
    
    styles = getSampleStyleSheet()
    all_elements = []
    
    for idx, advisor in enumerate(advisors_list):
        advisor_elems = _create_advisor_elements(advisor, styles)
        all_elements.extend(advisor_elems)
        
        if idx < len(advisors_list) - 1:
            all_elements.append(PageBreak())
            
    doc.build(all_elements)
    return buffer.getvalue()
