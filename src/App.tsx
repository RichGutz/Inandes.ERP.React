// src/App.tsx
import { useState } from 'react';
import { MasterTemplate } from './components/layout/MasterTemplate';
import { InversionistasPage } from './features/inversionistas/InversionistasPage';
import { AsesoresPage } from './features/asesores/AsesoresPage';
import { FondosPage } from './features/fondos/FondosPage';
import { InversionesPage } from './features/inversiones/InversionesPage';
import { CertificadosPage } from './features/certificados/CertificadosPage';
import { DeduccionesPage } from './features/deducciones/DeduccionesPage';
import { LayoutDashboard, Calculator } from 'lucide-react';

function App() {
  const [activeTab, setActiveTab] = useState<string>('crm_inversionistas');

  // Metadatos dinámicos por cada módulo de InAndes
  const tabMetadata: Record<string, { title: string; subtitle: string }> = {
    dashboard: { title: 'Inicio', subtitle: 'Patrimonio y KPIs Globales' },
    
    // Factoring
    factoring_registro: { title: 'Registro (Factoring)', subtitle: 'Ingreso de Solicitudes de Descuento' },
    factoring_originacion: { title: 'Originación (Factoring)', subtitle: 'Análisis y Evaluación Crediticia' },
    factoring_aprobacion: { title: 'Aprobación (Factoring)', subtitle: 'Comité de Riesgos y Líneas' },
    factoring_desembolso: { title: 'Desembolso (Factoring)', subtitle: 'Firma de Contratos y Transferencias' },
    factoring_liquidacion: { title: 'Liquidación (Factoring)', subtitle: 'Cobranzas y Compensación de Facturas' },
    factoring_reportes: { title: 'Reportes (Factoring)', subtitle: 'Estadísticas del Portafolio y Ledger' },
    factoring_repositorio: { title: 'Repositorio (Factoring)', subtitle: 'Bóveda Digital de Expedientes' },
    
    // Confirming
    confirming_futuros: { title: 'Confirming', subtitle: 'Futuros Módulos Corporativos' },
    
    // CRM
    crm_asesores: { title: 'Gestión de Asesores', subtitle: 'Liquidación de Comisiones v2' },
    crm_fondos: { title: 'Gestión de Fondos', subtitle: 'Tasas Pasivas y Simulación v26' },
    crm_inversionistas: { title: 'Gestión de Inversionistas', subtitle: 'Fichas de Partícipes y Compliance' },
    crm_contratos: { title: 'Gestión de Contratos', subtitle: 'Tickets e Inversiones Permanentes' },
    crm_certificados: { title: 'Gestión de Certificados', subtitle: 'Emisión de Certificados de Participación' },
    crm_deducciones: { title: 'Gestión de Deducciones / Rescates', subtitle: 'Retiros y Compensaciones' },
    crm_chat: { title: 'Chat WhatsApp', subtitle: 'Notificaciones e Inteligencia CRM' },
    
    // Herramientas
    herramientas_calculadora: { title: 'Calculadora', subtitle: 'Simulador Financiero Local' },
    herramientas_agentes: { title: 'Agentes IA', subtitle: 'Copilotos de Procesamiento de Información' },
    
    // Mantenimiento
    mantenimiento_limpieza: { title: 'Limpieza BD', subtitle: 'Mantenimiento del Sandbox Contable' },
    mantenimiento_roles: { title: 'Admin Roles', subtitle: 'Privilegios y Permisos de Usuarios' }
  };

  const currentMetadata = tabMetadata[activeTab] || { title: 'InAndes CRM', subtitle: '' };

  const handleExportExcel = () => {
    alert('Exportando listado de inversionistas a Excel (Simulación)...');
  };

  const handleExportPDF = () => {
    alert('Exportando listado de inversionistas a PDF (Simulación)...');
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
          <span className="text-blue-650 dark:text-blue-400 break-all">{streamlitFile}</span>
        </div>
      </div>
    );
  };

  // Renderizado condicional de vistas según la pestaña seleccionada
  const renderContent = () => {
    switch (activeTab) {
      // Inicio
      case 'dashboard':
        return (
          <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
            <LayoutDashboard size={48} className="text-emerald-600/70 dark:text-emerald-450/70" />
            <h2 className="text-lg font-black tracking-tight text-slate-800 dark:text-slate-100 uppercase">Dashboard General</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm leading-relaxed">Módulo de analítica en construcción. Presentará gráficos interactivos de AUM de fondos y resumen del ledger.</p>
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

      // Factoring Placeholders
      case 'factoring_registro':
        return renderMigrationPlaceholder('Registro', 'modules/01_Registro.py');
      case 'factoring_originacion':
        return renderMigrationPlaceholder('Originación', 'modules/02_Originacion.py');
      case 'factoring_aprobacion':
        return renderMigrationPlaceholder('Aprobación', 'modules/03_Aprobacion.py');
      case 'factoring_desembolso':
        return renderMigrationPlaceholder('Desembolso', 'modules/04_Desembolso.py');
      case 'factoring_liquidacion':
        return renderMigrationPlaceholder('Liquidación', 'modules/05_Liquidacion.py');
      case 'factoring_reportes':
        return renderMigrationPlaceholder('Reportes', 'modules/06_Reporte.py');
      case 'factoring_repositorio':
        return renderMigrationPlaceholder('Repositorio', 'modules/07_Repositorio.py');

      // Confirming Placeholder
      case 'confirming_futuros':
        return renderMigrationPlaceholder('Futuros Módulos', 'modules/08_Confirming_Placeholder.py');

      // CRM
      case 'crm_certificados':
        return <CertificadosPage />;
      case 'crm_deducciones':
        return <DeduccionesPage />;
      case 'crm_chat':
        return renderMigrationPlaceholder('Chat WhatsApp', 'modules/15_CRM_Chat.py');

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
      case 'mantenimiento_limpieza':
        return renderMigrationPlaceholder('Limpieza BD', 'modules/30_Limpieza_BD.py');
      case 'mantenimiento_roles':
        return renderMigrationPlaceholder('Admin Roles', 'modules/31_Admin_Roles.py');

      default:
        return <InversionistasPage />;
    }
  };

  return (
    <MasterTemplate 
      title={currentMetadata.title} 
      subtitle={currentMetadata.subtitle} 
      activeTab={activeTab} 
      setActiveTab={setActiveTab}
      onExportExcel={activeTab === 'crm_inversionistas' ? handleExportExcel : undefined}
      onExportPDF={activeTab === 'crm_inversionistas' ? handleExportPDF : undefined}
    >
      {renderContent()}
    </MasterTemplate>
  );
}

export default App;
