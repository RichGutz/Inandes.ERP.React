import graphviz
import os
import sys

def generate_pdf_v_integral_v18():
    # Versión 18: Feedback Loop de Capitalización (SÍ -> Aumento Capital)
    # Basado en V17, manteniendo Niveles 1, 2, 4 intactos.
    base_name = "version_flujo_crm_06.03.26_integral_v18"
    
    output_filename = base_name
    
    print(f"Generando Version Integral CRM V18 (Cap Loop): {output_filename}.pdf")
    
    # Path setup para Graphviz en Windows
    potential_paths = [
        r"C:\Program Files\Graphviz\bin",
        r"C:\Program Files (x86)\Graphviz\bin",
    ]
    for p in potential_paths:
        if os.path.exists(p) and p not in os.environ["PATH"]:
            os.environ["PATH"] += os.pathsep + p

    dot_code = """
    digraph CRMLogicIntegralV18 {
        rankdir=TB;
        splines=ortho;
        nodesep=1.0;
        ranksep=0.8;
        
        node [shape=box, style="filled,rounded", fontname="Arial", fontsize=10];
        edge [fontname="Arial", fontsize=9];

        # ==========================================
        #  NIVEL 1: FUNDAMENTOS / CATÁLOGOS (EXACTO V17)
        # ==========================================
        subgraph cluster_lvl1 {
            label = "NIVEL 1: FUNDAMENTOS / CATÁLOGOS"; style="filled"; color="#ECEFF1"; fontcolor="#455A64";
            subgraph cluster_mod1 {
                label = "MOD 1: FONDOS"; style="filled"; fillcolor="#FFF3E0"; color="#FF9800";
                Fund [label="🏦 Fondo", shape=cylinder, fillcolor="#FFE0B2"];
            }
            subgraph cluster_mod0 {
                label = "MOD 0: ASESORES"; style="filled"; fillcolor="#E0F7FA"; color="#006064";
                Advisor [label="👨‍💼 Asesor", shape=ellipse, fillcolor="#B2EBF2"];
            }
            subgraph cluster_mod2 {
                label = "MOD 2: INVERSIONISTAS"; style="filled"; fillcolor="#E1F5FE"; color="#0277BD";
                InvestorActive [label="✅ Inversionista DE ALTA", shape=ellipse, fillcolor="#B2EBF2", penwidth=2];
            }
        }

        # ==========================================
        #  NIVEL 2: MÓDULO DE CONTRATOS Y NACIMIENTO (EXACTO V17)
        # ==========================================
        subgraph cluster_mod3 {
            label = "NIVEL 2: MÓDULO DE CONTRATOS Y NACIMIENTO"; style="filled,dashed"; fillcolor="#FFF8E1"; color="#F57C00";
            TabDraft [label="📑 TAB 1: Borradores", shape=folder, fillcolor="#FFE082"];
            subgraph cluster_approve {
                label = "CRUCE DE APROBACIÓN"; style="filled"; fillcolor="#FFE0B2"; color="#FB8C00";
                VoucherIn [label="📥 Voucher Depósito\\n+ Fecha Depósito", shape=cds, fillcolor="white"];
                ContractActive [label="📜 CONTRATO VIGENTE\\n(Natural ID)", shape=record, fillcolor="#AED581", penwidth=2];
                NewbornCert [label="🐣 CERTIFICADO RECIÉN NACIDO", shape=record, fillcolor="#C8E6C9", penwidth=2];
            }
            TabDraft -> VoucherIn;
            VoucherIn -> ContractActive ;
            VoucherIn -> NewbornCert ;
        }

        # ==========================================
        #  NIVEL 3: OPERACIÓN DUAL (V18 FEEDBACK LOOP)
        # ==========================================
        subgraph cluster_lvl3 {
            label = "NIVEL 3: OPERACIÓN Y EVENTOS (LEDGER DUAL)"; style="filled,dashed"; color="#9E9E9E";
            
            CertificateEvol [label="{CERTIFICADO EVOLUTIVO|• Versión por Hito Fecha\\n(Fotos)}", shape=record, fillcolor="#A5D6A7"];
            
            subgraph cluster_events {
                label = "HISTORIAL (crm_certificados_eventos)"; style=filled; fillcolor="#C8E6C9";
                EvtAumento [label="➕ AUMENTO CAPITAL", shape=note, fillcolor="#FFF176"];
                EvtDeduccion [label="➖ CARGOS (Ledger:\\nPréstamos)", shape=note, fillcolor="#FF8A65"];
                EvtRetorno [label="📊 CORTE / RETORNO", shape=note];
            }

            CertificateEvol -> EvtAumento;
            CertificateEvol -> EvtDeduccion;
            CertificateEvol -> EvtRetorno;

            # MODULO DEDUCCIONES (Labels Finales V16+)
            subgraph cluster_mod5 {
                label = "MOD 5: DEDUCCIONES / RESCATES"; style="filled"; fillcolor="#D7CCC8"; color="#795548";
                Deductions [label="{CARGOS Y RESCATES|• Préstamos\\n• Rescates de Capital}", shape=record, fillcolor="#D7CCC8"];
            }

            subgraph cluster_dual_motors {
                label = "MOTORES DE CÁLCULO (Sincronía V25)"; style="filled"; fillcolor="#F5F5F5"; color="#424242";
                
                # MOTOR A: FONDO
                subgraph cluster_motor_fondo {
                    label = "A: MOTOR FONDO (NAV)"; style="filled"; fillcolor="#E3F2FD"; color="#1E88E5";
                    NavCalc [label="{DIARIO FONDO|1. Patrimonio Inicial\\n2. Rendimiento Bruto\\n3. (-) Comisiones\\n4. (=) VALOR CUOTA}", shape=record, fillcolor="white"];
                }

                # MOTOR B: CERTIFICADO (V18 CORRECT FEEDBACK)
                subgraph cluster_motor_cert {
                    label = "B: MOTOR CERTIFICADO (P&L)"; style="filled"; fillcolor="#F3E5F5"; color="#9C27B0";
                    Step1 [label="1. Bruto", shape=box, fillcolor="white"];
                    Step2 [label="2. Netear Tax (IRS Peru)", shape=box, fillcolor="#D1C4E9"];
                    Step3 [label="3. Restar Deds (Cargos)", shape=box, fillcolor="#FFAB91"];
                    Step4 [label="4. ¿Capitaliza?", shape=diamond, fillcolor="#CE93D8"];
                    Step5 [label="5. NETO CAJA", shape=doubleoctagon, fillcolor="#FFF59D", penwidth=2];
                    
                    Step1 -> Step2 -> Step3 -> Step4;
                    Step4 -> Step5 [label="NO"];
                }
            }
        }

        # ==========================================
        #  NIVEL 4: OUTPUTS INTEGRADOS (EXACTO V17)
        # ==========================================
        subgraph cluster_outputs {
            label = "NIVEL 4: OUTPUTS Y IA (FINAL)"; style="filled,dashed"; fillcolor="#ECEFF1"; color="#607D8B";
            Orquestador [label="⚙️ ORQUESTADOR DE REPORTES\\n(integration_nsgusd01.py)", shape=component, fillcolor="#B3E5FC", penwidth=2];
            RepoBatch [label="📧 ESTADO DE CUENTA\\nBATCH INTEGRADO", shape=note, fillcolor="#90CAF9"];
            RepoRetencion [label="📜 CERTIF. RETENCIÓN\\nRENTAS (Batch)", shape=note, fillcolor="#FFCCBC"];
            Repo2 [label="📜 Cert. Participación", shape=note, fillcolor="#A5D6A7"];
            subgraph cluster_bot {
                label = "Agente IA"; style=filled; fillcolor="#B2DFDB";
                BotNLP [label="🔍 Analista de Retornos", shape=rect, fillcolor="#80CBC4"];
            }
        }

        # --- CONEXIONES ---
        Fund -> TabDraft;
        Advisor -> TabDraft;
        InvestorActive -> TabDraft;
        NewbornCert -> CertificateEvol [label="Evolución"];
        EvtRetorno -> Step1 [label="Liquidación"];
        EvtAumento -> Step1 [label="Incremento"];
        
        # Conexión Deducciones -> Motor (Paso 3)
        EvtDeduccion -> Deductions [label="Registro"];
        Deductions -> Step3 [label="Aplica Cargos"];

        # Interdependencia
        NavCalc -> EvtAumento [label="Suscripción @ VC", color="#1E88E5", style=dashed, constraint=false];
        
        # EL FEEDBACK LOOP (Novedad V18)
        Step4 -> EvtAumento [label="SÍ (Aumenta Capital)", color="blue", constraint=false, style=dashed];

        # Flujo al Orquestador
        Step5 -> Orquestador [color="#9C27B0"];
        NavCalc -> Orquestador [color="#1E88E5"];
        Orquestador -> RepoBatch;
        Orquestador -> RepoRetencion;
        CertificateEvol -> Repo2;
        Step5 -> BotNLP [style=dotted];
        BotNLP -> RepoBatch [style=dotted];
    }
    """
    
    try:
        src = graphviz.Source(dot_code)
        output_dir = os.path.dirname(os.path.abspath(__file__))
        file_path = src.render(filename=os.path.join(output_dir, output_filename), format='pdf', view=False, cleanup=True)
        print(f"Generado exitosamente: {os.path.abspath(file_path)}")
        
    except Exception as e:
        print(f"Error generando flujograma: {e}")

if __name__ == "__main__":
    generate_pdf_v_integral_v18()
