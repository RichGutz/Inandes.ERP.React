// src/App.tsx
import { useState, useEffect } from 'react';
import { supabase } from './services/supabaseClient';
import { MasterTemplate } from './components/layout/MasterTemplate';
import { LoginPage } from './features/auth/LoginPage';
import { getUserAccess } from './services/authService';
import type { UserModuleAccess } from './services/authService';
import { InversionistasPage } from './features/inversionistas/InversionistasPage';
import { AsesoresPage } from './features/asesores/AsesoresPage';
import { FondosPage } from './features/fondos/FondosPage';
import { InversionesPage } from './features/inversiones/InversionesPage';
import { CertificadosPage } from './features/certificados/CertificadosPage';
import { DeduccionesPage } from './features/deducciones/DeduccionesPage';
import { RolesPage } from './features/roles/RolesPage';
import { EstilosPage } from './features/mantenimiento/EstilosPage';
import { Calculator } from 'lucide-react';
import * as XLSX from 'xlsx';
import { getInversionistas } from './services/inversionistasService';
import { getAsesores } from './services/asesoresService';
import { getFondos } from './services/fondosService';
import { getContratos } from './services/contratosService';
import { FactoringPage } from './features/factoring/FactoringPage';
import { ChatWhatsAppPage } from './features/chat/ChatWhatsAppPage';

// Helpers globales para formato legible (human-chewable)
const formatCurrency = (val: number | null | undefined, currency: string) => {
  if (val === null || val === undefined) return '-';
  const prefix = currency === 'USD' ? '$' : 'S/';
  return `${prefix} ${val.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatDate = (dateStr: string | null | undefined) => {
  if (!dateStr) return '-';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
};

const translateContractState = (state: string) => {
  const map: Record<string, string> = {
    borrador: 'Borrador',
    propuesto: 'Propuesto',
    pendiente_aprobacion: 'Pendiente Aprobación',
    emitido: 'Vigente',
    cerrado_fin_contrato: 'Cerrado por Fin',
    cerrado_por_rescate: 'Cerrado por Rescate'
  };
  return map[state] || state;
};

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [userEmail, setUserEmail] = useState<string>('');
  const [userFullName, setUserFullName] = useState<string>('');
  const [userRoles, setUserRoles] = useState<UserModuleAccess[]>([]);
  const [activeTab, setActiveTab] = useState<string>('home');
  const [authChecking, setAuthChecking] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const isDevLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && sessionStorage.getItem('dev_local_login') === 'true';

    if (isDevLocal) {
      const email = 'rgutil@gmail.com';
      setIsAuthenticated(true);
      setUserEmail(email);
      setUserFullName('Richard Gutierrez (Dev Local)');
      setUserRoles([
        { modulo: 'CRM', rol: 'ADMIN', nombre_completo: 'Richard Gutierrez' },
        { modulo: 'FACTORING', rol: 'ADMIN', nombre_completo: 'Richard Gutierrez' }
      ]);
      setAuthChecking(false);
      return;
    }

    const checkUser = async (session: any) => {
      if (session?.user?.email) {
        const email = session.user.email;
        const roles = await getUserAccess(email);
        if (roles && roles.length > 0) {
          setIsAuthenticated(true);
          setUserEmail(email);
          setUserRoles(roles);
          setUserFullName(roles[0]?.nombre_completo || email);
          
          if (!roles.some(r => r.modulo === 'CRM') && roles.some(r => r.modulo === 'FACTORING')) {
            // Se mantiene 'home' por defecto para mostrar los logos.
          }
        } else {
          // El usuario de Google no tiene acceso
          setIsAuthenticated(false);
          setAuthError(`El correo ${email} no tiene permisos asignados en el sistema.`);
        }
      } else {
        setIsAuthenticated(false);
      }
      setAuthChecking(false);
    };

    // Revisar sesión inicial
    supabase.auth.getSession().then(({ data: { session } }) => {
      checkUser(session);
    });

    // Escuchar cambios
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthChecking(true);
      checkUser(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Metadatos dinámicos por cada módulo de InAndes
  const tabMetadata: Record<string, { title: string; subtitle: string }> = {
    // Home
    home: { title: 'INANDES ERP', subtitle: 'Bienvenido al Sistema de Gestión' },
    
    // Factoring
    factoring_core: { title: 'Centro de Control de Factoring', subtitle: 'Gestión integral de operaciones de Factoring: desde la originación hasta la cobranza.' },
    
    // Confirming
    confirming_futuros: { title: 'Confirming', subtitle: 'Futuros Módulos Corporativos' },
    
    // CRM
    crm_asesores: { title: 'Gestión de Asesores', subtitle: 'Liquidación de Comisiones v2' },
    crm_fondos: { title: 'Gestión de Fondos', subtitle: 'Tasas Pasivas y Simulación v27' },
    crm_inversionistas: { title: 'Gestión de Inversionistas', subtitle: 'Fichas de Partícipes y Compliance' },
    crm_contratos: { title: 'Gestión de Contratos', subtitle: 'Tickets e Inversiones Permanentes' },
    crm_certificados: { title: 'Gestión de Certificados', subtitle: 'Emisión de Certificados de Participación' },
    crm_deducciones: { title: 'Gestión de Deducciones / Rescates', subtitle: 'Retiros y Compensaciones' },
    crm_chat: { title: 'Chat WhatsApp', subtitle: 'Notificaciones e Inteligencia CRM' },
    
    // Herramientas
    herramientas_calculadora: { title: 'Calculadora', subtitle: 'Simulador Financiero Local' },
    herramientas_agentes: { title: 'Agentes IA', subtitle: 'Copilotos de Procesamiento de Información' },
    
    // Mantenimiento
    mantenimiento_estilos: { title: 'Configuración de Estilos & Design System', subtitle: 'Personalización de Tema, Dark Mode, Colores de Acento y Tipografía' },
    mantenimiento_limpieza: { title: 'Limpieza BD', subtitle: 'Mantenimiento del Sandbox Contable' },
    mantenimiento_roles: { title: 'Admin Roles', subtitle: 'Privilegios y Permisos de Usuarios' }
  };

  const currentMetadata = tabMetadata[activeTab] || { title: 'InAndes CRM', subtitle: '' };

  const handleExportExcel = async () => {
    try {
      if (activeTab === 'crm_inversionistas') {
        const data = await getInversionistas();

        // Fila 1: Encabezados Temáticos Agrupados (Cards de la UI)
        const groupHeader = [
          '1. IDENTIDAD Y DATOS PERSONALES DEL PARTÍCIPE', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '',
          '2. DATOS DEL CÓNYUGE', '', '', '',
          '3. DATOS LABORALES', '', '', '',
          '4. CUENTAS BANCARIAS (PEN / USD)', '', '', '', '', '',
          '5. COMPLIANCE & RIESGO', '', '', '', '', ''
        ];

        // Fila 2: Títulos de Columnas Individuales
        const colHeader = [
          // 1. Identidad
          'Código Partícipe', 'Tipo Doc', 'Nº Documento', 'Primer Nombre', 'Segundo Nombre', 
          'Primer Apellido', 'Segundo Apellido', 'Nombre Completo', 'F. Nacimiento', 'Estado Civil', 
          'Nacionalidad', 'Residente Perú', 'Correo Electrónico', 'Teléfono / Celular', 'Dirección Fiscal', 'Código Postal',
          // 2. Cónyuge
          'Tipo Doc Cónyuge', 'Nº Doc Cónyuge', 'Nombres Cónyuge', 'Apellidos Cónyuge',
          // 3. Laboral
          'Ocupación / Profesión', 'Centro de Labores', 'Cargo Ocupado', 'Antigüedad (Años)',
          // 4. Bancario
          'Banco PEN', 'Nº Cuenta PEN', 'CCI PEN', 'Banco USD', 'Nº Cuenta USD', 'CCI USD',
          // 5. Compliance
          'Es PEP', 'Detalle PEP', 'Perfil de Riesgo', 'Estado Compliance', 'Fecha Solicitud Compliance', 'Fecha Registro'
        ];

        // Filas de Datos
        const rows = data.map(inv => [
          // 1. Identidad
          inv.codigo_inversionista || '-',
          inv.tipo_doc || '-',
          inv.documento_identidad || '-',
          inv.nombre_1 || '-',
          inv.nombre_2 || '',
          inv.apellido_1 || '-',
          inv.apellido_2 || '',
          inv.nombre_completo || `${inv.nombre_1 || ''} ${inv.apellido_1 || ''}`.trim(),
          formatDate(inv.fecha_nacimiento),
          inv.estado_civil || '-',
          inv.nacionalidad || '-',
          inv.residente_peru ? 'SÍ' : 'NO',
          inv.email || '-',
          inv.telefono || '-',
          inv.direccion_fiscal || '-',
          inv.codigo_postal || '-',

          // 2. Cónyuge
          inv.conyuge_tipo_documento || '-',
          inv.conyuge_num_documento || '-',
          `${inv.conyuge_nombre_1 || ''} ${inv.conyuge_nombre_2 || ''}`.trim() || '-',
          `${inv.conyuge_apellido_1 || ''} ${inv.conyuge_apellido_2 || ''}`.trim() || '-',

          // 3. Laboral
          inv.ocupacion || '-',
          inv.centro_labores || '-',
          inv.cargo_ocupado || '-',
          inv.antiguedad_laboral_anios ?? '-',

          // 4. Bancario
          inv.banco_nombre_pen || '-',
          inv.numero_cuenta_pen || '-',
          inv.cci_pen || '-',
          inv.banco_nombre_usd || '-',
          inv.numero_cuenta_usd || '-',
          inv.cci_usd || '-',

          // 5. Compliance
          inv.es_pep ? 'SÍ' : 'NO',
          inv.pep_detalle || '-',
          inv.perfil_riesgo || '-',
          inv.estado_compliance ? inv.estado_compliance.toUpperCase() : '-',
          formatDate(inv.fecha_solicitud_compliance),
          formatDate(inv.created_at)
        ]);

        const aoaData = [groupHeader, colHeader, ...rows];
        const ws = XLSX.utils.aoa_to_sheet(aoaData);

        // Definir fusiones de celdas superiores (Merges)
        ws['!merges'] = [
          { s: { r: 0, c: 0 }, e: { r: 0, c: 15 } },  // 1. Identidad (A1:P1)
          { s: { r: 0, c: 16 }, e: { r: 0, c: 19 } }, // 2. Cónyuge (Q1:T1)
          { s: { r: 0, c: 20 }, e: { r: 0, c: 23 } }, // 3. Laboral (U1:X1)
          { s: { r: 0, c: 24 }, e: { r: 0, c: 29 } }, // 4. Bancario (Y1:AD1)
          { s: { r: 0, c: 30 }, e: { r: 0, c: 35 } }  // 5. Compliance (AE1:AJ1)
        ];

        // Anchos de columnas automáticos
        ws['!cols'] = colHeader.map(h => ({ wch: Math.max(h.length + 3, 16) }));

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Directorio Inversionistas');
        XLSX.writeFile(wb, `Inversionistas_InAndes_${new Date().toISOString().split('T')[0]}.xlsx`);
      } 
      else if (activeTab === 'crm_asesores') {
        const data = await getAsesores();
        const formatted = data.map(ase => ({
          'Código': ase.codigo || '-',
          'Nombre Completo': ase.nombre_completo,
          'Tipo Doc': ase.tipo_documento || '-',
          'Documento': ase.documento_identidad,
          'Email': ase.email || '-',
          'Teléfono': ase.telefono || '-',
          'Nacionalidad': ase.nacionalidad || '-',
          'Dirección': ase.direccion || '-',
          'Banco PEN': ase.banco_nombre_pen || '-',
          'CCI PEN': ase.cci_pen || '-',
          'Banco USD': ase.banco_nombre_usd || '-',
          'CCI USD': ase.cci_usd || '-'
        }));
        const ws = XLSX.utils.json_to_sheet(formatted);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Asesores');
        XLSX.writeFile(wb, 'crm_asesores.xlsx');
      } 
      else if (activeTab === 'crm_fondos') {
        const data = await getFondos();
        const formatted = data.map(fon => ({
          'Código Fondo': fon.id_fondo,
          'Nombre Fondo': fon.nombre_fondo,
          'Moneda': fon.moneda,
          'Plazo (Meses)': fon.plazo_inversion,
          'TEA Pasiva %': fon.tasa ? `${fon.tasa}%` : '-',
          'TEA Activa %': fon.tasa_activa ? `${fon.tasa_activa}%` : '-',
          'Frecuencia Cupones (Meses)': fon.frecuencia_cupones_meses || '-',
          'Monto Mínimo': formatCurrency(fon.monto_minimo_inversion, fon.moneda),
          'Penalidad Rescate %': fon.penalidad_rescate ? `${fon.penalidad_rescate}%` : '-',
          'Estado': fon.activo ? 'Activo' : 'Inactivo'
        }));
        const ws = XLSX.utils.json_to_sheet(formatted);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Fondos');
        XLSX.writeFile(wb, 'crm_fondos.xlsx');
      } 
      else if (activeTab === 'crm_contratos') {
        const data = await getContratos();
        const formatted = data.map(con => ({
          'Código Contrato': con.id_contrato,
          'Inversionista': con.titular?.nombre_completo || '-',
          'Fondo': con.crm_fondos?.nombre_fondo || '-',
          'Asesor': con.asesor?.nombre_completo || '-',
          'Monto Inversión': formatCurrency(con.monto_inversion, con.moneda),
          'Moneda': con.moneda,
          'TEA Pactada %': con.tasa_pactada ? `${con.tasa_pactada}%` : '-',
          'Plazo (Meses)': con.plazo_meses,
          '% Reparto': con.porcentaje_reparto ? `${con.porcentaje_reparto}%` : '0%',
          'F. Inicio': formatDate(con.fecha_inicio),
          'F. Fin': formatDate(con.fecha_fin),
          'Estado': translateContractState(con.estado)
        }));
        const ws = XLSX.utils.json_to_sheet(formatted);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Contratos');
        XLSX.writeFile(wb, 'crm_contratos.xlsx');
      }
    } catch (error: any) {
      alert(`Error al exportar a Excel: ${error.message}`);
    }
  };

  const handleExportPDF = async () => {
    try {
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        alert('Habilita las ventanas emergentes para ver el reporte PDF.');
        return;
      }

      let titleReport = '';
      let tableHeaders = '';
      let tableRows = '';

      if (activeTab === 'crm_inversionistas') {
        const data = await getInversionistas();
        titleReport = 'REPORTE GENERAL DE INVERSIONISTAS';
        tableHeaders = `
          <tr>
            <th>Código</th>
            <th>Nombre Completo</th>
            <th>Documento</th>
            <th>Email</th>
            <th>Teléfono</th>
            <th>Nacionalidad</th>
            <th>Cuentas Principales</th>
          </tr>
        `;
        tableRows = data.map(inv => `
          <tr>
            <td>${inv.codigo_inversionista || '-'}</td>
            <td><b>${inv.nombre_completo || `${inv.nombre_1} ${inv.apellido_1}`}</b></td>
            <td>${inv.tipo_doc}: ${inv.documento_identidad}</td>
            <td>${inv.email || '-'}</td>
            <td>${inv.telefono || '-'}</td>
            <td>${inv.nacionalidad || '-'}</td>
            <td>
              PEN: ${inv.banco_nombre_pen || '-'}<br/>
              USD: ${inv.banco_nombre_usd || '-'}
            </td>
          </tr>
        `).join('');
      } 
      else if (activeTab === 'crm_asesores') {
        const data = await getAsesores();
        titleReport = 'REPORTE GENERAL DE ASESORES';
        tableHeaders = `
          <tr>
            <th>Código</th>
            <th>Nombre Completo</th>
            <th>Documento</th>
            <th>Email</th>
            <th>Teléfono</th>
            <th>Dirección</th>
          </tr>
        `;
        tableRows = data.map(ase => `
          <tr>
            <td>${ase.codigo || '-'}</td>
            <td><b>${ase.nombre_completo}</b></td>
            <td>${ase.tipo_documento || 'DOC'}: ${ase.documento_identidad}</td>
            <td>${ase.email || '-'}</td>
            <td>${ase.telefono || '-'}</td>
            <td>${ase.direccion || '-'}, ${ase.distrito || '-'}</td>
          </tr>
        `).join('');
      } 
      else if (activeTab === 'crm_fondos') {
        const data = await getFondos();
        titleReport = 'REPORTE GENERAL DE FONDOS DE INVERSIÓN';
        tableHeaders = `
          <tr>
            <th>Código</th>
            <th>Nombre del Fondo</th>
            <th>Moneda</th>
            <th>Plazo</th>
            <th>Tasa Pasiva</th>
            <th>Tasa Activa</th>
            <th>Monto Min.</th>
            <th>Estado</th>
          </tr>
        `;
        tableRows = data.map(fon => `
          <tr>
            <td>${fon.id_fondo}</td>
            <td><b>${fon.nombre_fondo}</b></td>
            <td>${fon.moneda}</td>
            <td>${fon.plazo_inversion} Meses</td>
            <td>${fon.tasa ? `${fon.tasa}%` : '-'}</td>
            <td>${fon.tasa_activa ? `${fon.tasa_activa}%` : '-'}</td>
            <td>${formatCurrency(fon.monto_minimo_inversion, fon.moneda)}</td>
            <td><span class="badge ${fon.activo ? 'bg-active' : 'bg-inactive'}">${fon.activo ? 'Activo' : 'Inactivo'}</span></td>
          </tr>
        `).join('');
      } 
      else if (activeTab === 'crm_contratos') {
        const data = await getContratos();
        titleReport = 'REPORTE GENERAL DE CONTRATOS VIGENTES';
        tableHeaders = `
          <tr>
            <th>Código</th>
            <th>Inversionista</th>
            <th>Fondo</th>
            <th>Monto</th>
            <th>Tasa Pactada</th>
            <th>F. Inicio / Fin</th>
            <th>Estado</th>
          </tr>
        `;
        tableRows = data.map(con => `
          <tr>
            <td>${con.id_contrato}</td>
            <td><b>${con.titular?.nombre_completo || '-'}</b></td>
            <td>${con.crm_fondos?.nombre_fondo || '-'}</td>
            <td>${formatCurrency(con.monto_inversion, con.moneda)}</td>
            <td>${con.tasa_pactada ? `${con.tasa_pactada}%` : '-'} (Reparto: ${con.porcentaje_reparto || 0}%)</td>
            <td>${formatDate(con.fecha_inicio)} a ${formatDate(con.fecha_fin)}</td>
            <td><span class="badge bg-active">${translateContractState(con.estado)}</span></td>
          </tr>
        `).join('');
      }

      const htmlContent = `
        <html>
          <head>
            <title>${titleReport}</title>
            <style>
              body { font-family: 'Inter', sans-serif; color: #0f172a; margin: 30px; font-size: 11px; }
              .header-table { width: 100%; border-bottom: 2px solid #059669; padding-bottom: 10px; margin-bottom: 20px; }
              .header-title { font-size: 16px; font-weight: bold; color: #064e3b; margin: 0; }
              .header-meta { font-size: 9px; color: #64748b; margin-top: 5px; }
              table { width: 100%; border-collapse: collapse; margin-top: 10px; }
              th { background-color: #0f172a; color: #ffffff; font-weight: bold; text-transform: uppercase; font-size: 9px; padding: 8px 6px; text-align: left; }
              td { border-bottom: 1px solid #e2e8f0; padding: 8px 6px; vertical-align: top; }
              .text-right { text-align: right; }
              .badge { padding: 2px 6px; border-radius: 4px; font-size: 8px; font-weight: bold; color: white; display: inline-block; }
              .bg-active { background-color: #10b981; }
              .bg-inactive { background-color: #64748b; }
              @media print {
                body { margin: 15px; }
              }
            </style>
          </head>
          <body>
            <table class="header-table">
              <tr>
                <td>
                  <h1 class="header-title">${titleReport}</h1>
                  <div class="header-meta">Generado el: ${new Date().toLocaleString()} | InAndes ERP</div>
                </td>
              </tr>
            </table>
            <table>
              <thead>
                ${tableHeaders}
              </thead>
              <tbody>
                ${tableRows}
              </tbody>
            </table>
            <script>
              window.onload = function() {
                window.print();
              }
            </script>
          </body>
        </html>
      `;

      printWindow.document.write(htmlContent);
      printWindow.document.close();
    } catch (error: any) {
      alert(`Error al exportar a PDF: ${error.message}`);
    }
  };

  // Helper para renderizar pantallas en migración
  const renderMigrationPlaceholder = (moduleName: string, streamlitFile: string) => {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center gap-4 max-w-md mx-auto animate-fadeIn">
        <div className="h-16 w-16 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-full flex items-center justify-center text-amber-600 mb-2">
          <Calculator size={32} className="animate-pulse" />
        </div>
        <h2 className="text-sm font-black tracking-tight text-slate-800 dark:text-slate-100 uppercase">
          Módulo en Migración: {moduleName}
        </h2>
        <p className="text-xs text-slate-505 dark:text-slate-400 leading-relaxed">
          Este módulo se encuentra en proceso de portabilidad desde la versión original de Streamlit. Puedes operar el CRM migrado en las opciones del menú lateral.
        </p>
        <div className="p-3.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-lg text-left w-full text-[10px] font-mono">
          <span className="text-slate-400 font-bold block mb-1">SCRIPT ORIGINAL:</span>
          <span className="text-blue-600 dark:text-blue-400 break-all">{streamlitFile}</span>
        </div>
      </div>
    );
  };

  // Renderizado condicional de vistas según la pestaña seleccionada
  const renderContent = () => {
    switch (activeTab) {
      // Home (Logos)
      case 'home':
        return (
          <div className="flex flex-col items-center justify-center h-full min-h-[500px] gap-8 animate-fadeIn">
            <div className="flex items-center gap-12">
              <img src="/Logo.Geeksoft.png" alt="Geeksoft" className="h-16 object-contain opacity-50 hover:opacity-100 transition-opacity" />
              <div className="w-px h-16 bg-slate-200 dark:bg-slate-700"></div>
              <img src="/assets/Logo.Inandes.MODERNO.png" alt="InAndes" className="h-20 object-contain" />
            </div>
            <h2 className="text-slate-400 dark:text-slate-500 font-bold tracking-widest text-sm uppercase">Seleccione un módulo en el menú lateral para comenzar</h2>
          </div>
        );

      // CRM Migrados
      case 'crm_asesores':
        return <AsesoresPage />;
      case 'crm_fondos':
        return <FondosPage />;
      case 'crm_inversionistas':
        return <InversionistasPage />;
      case 'crm_contratos':
        return <InversionesPage />;

      // Factoring
      case 'factoring_core':
        return <FactoringPage />;

      // Confirming Placeholder
      case 'confirming_futuros':
        return renderMigrationPlaceholder('Futuros Módulos', 'modules/08_Confirming_Placeholder.py');

      // CRM
      case 'crm_certificados':
        return <CertificadosPage />;
      case 'crm_deducciones':
        return <DeduccionesPage />;
      case 'crm_chat':
        return <ChatWhatsAppPage />;

      // Herramientas
      case 'herramientas_calculadora':
        return (
          <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
            <Calculator size={48} className="text-emerald-600/70 dark:text-emerald-450/70" />
            <h2 className="text-lg font-black tracking-tight text-slate-800 dark:text-slate-100 uppercase">Calculadora Financiera</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm leading-relaxed">Módulo en construcción. Simulador local de retenciones, cuotas y rendimientos.</p>
          </div>
        );
      case 'herramientas_agentes':
        return renderMigrationPlaceholder('Agentes IA', 'modules/21_Agentes_IA.py');

      // Mantenimiento
      case 'mantenimiento_estilos':
        return <EstilosPage />;
      case 'mantenimiento_limpieza':
        return renderMigrationPlaceholder('Limpieza BD', 'modules/30_Limpieza_BD.py');
      case 'mantenimiento_roles':
        return <RolesPage />;

      default:
        return <InversionistasPage />;
    }
  };

  const exportTabs = ['crm_inversionistas', 'crm_asesores', 'crm_fondos', 'crm_contratos'];
  const enableExport = exportTabs.includes(activeTab);

  if (authChecking) {
    return (
      <div className="min-h-screen bg-[#0e1117] flex items-center justify-center font-sans text-white">
        <div className="animate-pulse">Cargando sistema...</div>
      </div>
    );
  }

  if (authError && !isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#0e1117] flex items-center justify-center font-sans text-white p-4">
        <div className="max-w-[500px] w-full bg-[#1b2a26] border border-[#ff4b4b] p-6 rounded-lg flex flex-col gap-4 text-center">
          <h2 className="text-2xl font-bold text-[#ff4b4b]">Acceso Denegado</h2>
          <p className="text-sm text-[#a3a8b8]">{authError}</p>
          <button 
            onClick={() => {
              setAuthError(null);
              supabase.auth.signOut();
            }}
            className="mt-4 bg-[#262730] hover:bg-[#31333f] text-white border border-[#4a4d5e] py-2 px-4 rounded-md transition-colors"
          >
            Cerrar Sesión e Intentar con Otra Cuenta
          </button>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <MasterTemplate 
      title={currentMetadata.title} 
      subtitle={currentMetadata.subtitle} 
      activeTab={activeTab} 
      setActiveTab={setActiveTab}
      onExportExcel={enableExport ? handleExportExcel : undefined}
      onExportPDF={enableExport ? handleExportPDF : undefined}
      userEmail={userEmail}
      userFullName={userFullName}
      userRoles={userRoles}
    >
      {renderContent()}
    </MasterTemplate>
  );
}

export default App;
