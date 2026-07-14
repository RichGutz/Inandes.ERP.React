import os
import graphviz
import sys

# Configurar directorio destino
output_dir = r'C:\Users\rguti\mini_erp_v2_antigravity\FLOW_CHARTS\Charts_Arquitectura_CRM'
os.makedirs(output_dir, exist_ok=True)
output_name = 'FLUJOGRAMA_ER_Relaciones_BD_CRM'
output_path = os.path.join(output_dir, output_name)

# Configuración del diagrama ER
dot = graphviz.Digraph('ER_Diagram', format='pdf')
dot.attr(rankdir='LR', size='16,10', nodesep='0.5', ranksep='1.2')
dot.attr('node', shape='none', fontname='Arial')

# --- TABLAS (Nodos HTML-like) ---

dot.node('crm_contratos', '''<
<TABLE BORDER="0" CELLBORDER="1" CELLSPACING="0" CELLPADDING="8">
  <TR><TD BGCOLOR="#3498db"><B><FONT COLOR="white">crm_contratos</FONT></B></TD></TR>
  <TR><TD PORT="id" BGCOLOR="#ebf5fb">id_contrato <FONT COLOR="gray">(PK, Texto)</FONT></TD></TR>
  <TR><TD PORT="f1">id_fondo <FONT COLOR="gray">(FK)</FONT></TD></TR>
  <TR><TD PORT="fp">id_fondo_plazo <FONT COLOR="gray">(FK)</FONT></TD></TR>
  <TR><TD PORT="i1">id_inversionista_1..4 <FONT COLOR="gray">(FK)</FONT></TD></TR>
  <TR><TD PORT="a1">id_asesor <FONT COLOR="gray">(FK)</FONT></TD></TR>
  <TR><TD>monto_inversion <FONT COLOR="gray">(NUMERIC)</FONT></TD></TR>
  <TR><TD>plazo_meses, moneda, estado...</TD></TR>
</TABLE>>''')

dot.node('crm_fondos', '''<
<TABLE BORDER="0" CELLBORDER="1" CELLSPACING="0" CELLPADDING="8">
  <TR><TD BGCOLOR="#2c3e50"><B><FONT COLOR="white">crm_fondos</FONT></B></TD></TR>
  <TR><TD PORT="id" BGCOLOR="#eaeded">id_fondo <FONT COLOR="gray">(PK)</FONT></TD></TR>
  <TR><TD PORT="fp">id_fondo_plazo <FONT COLOR="gray">(UNIQUE)</FONT></TD></TR>
  <TR><TD>nombre_fondo</TD></TR>
  <TR><TD>moneda, plazos...</TD></TR>
</TABLE>>''')

dot.node('crm_inversionistas', '''<
<TABLE BORDER="0" CELLBORDER="1" CELLSPACING="0" CELLPADDING="8">
  <TR><TD BGCOLOR="#2c3e50"><B><FONT COLOR="white">crm_inversionistas</FONT></B></TD></TR>
  <TR><TD PORT="id" BGCOLOR="#eaeded">codigo_inversionista <FONT COLOR="gray">(PK, DNI/CEX)</FONT></TD></TR>
  <TR><TD>nombre_completo</TD></TR>
  <TR><TD>documento_identidad</TD></TR>
</TABLE>>''')

dot.node('crm_asesores', '''<
<TABLE BORDER="0" CELLBORDER="1" CELLSPACING="0" CELLPADDING="8">
  <TR><TD BGCOLOR="#2c3e50"><B><FONT COLOR="white">crm_asesores</FONT></B></TD></TR>
  <TR><TD PORT="id" BGCOLOR="#eaeded">codigo <FONT COLOR="gray">(PK, AS-XXXX)</FONT></TD></TR>
  <TR><TD>nombre_completo</TD></TR>
</TABLE>>''')

dot.node('crm_certificados', '''<
<TABLE BORDER="0" CELLBORDER="1" CELLSPACING="0" CELLPADDING="8">
  <TR><TD BGCOLOR="#27ae60"><B><FONT COLOR="white">crm_certificados</FONT></B></TD></TR>
  <TR><TD PORT="id" BGCOLOR="#e9f7ef">id_certificado <FONT COLOR="gray">(PK)</FONT></TD></TR>
  <TR><TD PORT="c1">id_contrato <FONT COLOR="gray">(FK)</FONT></TD></TR>
  <TR><TD>monto_inversion</TD></TR>
</TABLE>>''')

dot.node('crm_cronograma', '''<
<TABLE BORDER="0" CELLBORDER="1" CELLSPACING="0" CELLPADDING="8">
  <TR><TD BGCOLOR="#f39c12"><B><FONT COLOR="white">crm_cronograma_deducciones_rescates</FONT></B></TD></TR>
  <TR><TD PORT="id" BGCOLOR="#fef5e7">id_cuota <FONT COLOR="gray">(PK)</FONT></TD></TR>
  <TR><TD PORT="c1">id_contrato <FONT COLOR="gray">(FK)</FONT></TD></TR>
  <TR><TD PORT="cert">id_certificado <FONT COLOR="gray">(FK)</FONT></TD></TR>
  <TR><TD>monto_cobrar</TD></TR>
  <TR><TD>fecha_proyectada_cobro</TD></TR>
</TABLE>>''')

dot.node('crm_certificados_eventos', '''<
<TABLE BORDER="0" CELLBORDER="1" CELLSPACING="0" CELLPADDING="8">
  <TR><TD BGCOLOR="#e74c3c"><B><FONT COLOR="white">crm_certificados_eventos</FONT></B></TD></TR>
  <TR><TD PORT="id" BGCOLOR="#fdedec">id <FONT COLOR="gray">(PK, UUID)</FONT></TD></TR>
  <TR><TD PORT="cert">id_certificado <FONT COLOR="gray">(FK)</FONT></TD></TR>
  <TR><TD>fecha_evento, tipo_evento</TD></TR>
  <TR><TD>monto_variacion, cuotas_variacion</TD></TR>
  <TR><TD>monto_resultante, cuotas_resultantes</TD></TR>
</TABLE>>''')

# --- CONFIGURACIÓN DE LÍNEAS (EDGES) ---
dot.attr('edge', arrowhead='vee', arrowtail='crow', dir='both', fontname='Arial', fontsize='10', color='dimgray')

# Relaciones Familiares
dot.edge('crm_fondos:id', 'crm_contratos:f1', label=' Posee (1:N)', tailport='e', headport='w')
dot.edge('crm_fondos:fp', 'crm_contratos:fp', label=' Producto (1:N)', tailport='e', headport='w')
dot.edge('crm_inversionistas:id', 'crm_contratos:i1', label=' Firma (1:N)', tailport='e', headport='w')
dot.edge('crm_asesores:id', 'crm_contratos:a1', label=' Gestiona (1:N)', tailport='e', headport='w')

dot.edge('crm_contratos:id', 'crm_certificados:c1', label=' Emite (1:N)', tailport='e', headport='w')
dot.edge('crm_contratos:id', 'crm_cronograma:c1', label=' Genera Pagos (1:N)', tailport='e', headport='w')
dot.edge('crm_certificados:id', 'crm_cronograma:cert', label=' Cuotas Válidas (1:N)', tailport='s', headport='n')
dot.edge('crm_certificados:id', 'crm_certificados_eventos:cert', label=' Historial Eventos (1:N)', tailport='s', headport='n', color='#e74c3c')

# Path setup para Graphviz en Windows
potential_paths = [
    r"C:\Program Files\Graphviz\bin",
    r"C:\Program Files (x86)\Graphviz\bin",
]
for p in potential_paths:
    if os.path.exists(p) and p not in os.environ["PATH"]:
        os.environ["PATH"] += os.pathsep + p

# Generar Archivo PDF (usa la instalación local de Graphviz)
try:
    print(f"Generando diagrama PDF en: {output_dir}")
    built_path = dot.render(output_path, view=False, cleanup=True)
    print(f"Éxito: {built_path}")
except Exception as e:
    print(f"Error crítico al compilar graphviz: {e}")
