import React from 'react';
import { User } from 'lucide-react';

interface HeaderProps {
  activeTab: string;
}

export const Header: React.FC<HeaderProps> = ({ activeTab }) => {
  // Mapeo: tab -> { module, title }
  const tabMap: Record<string, { module: string; title: string }> = {
    dashboard:        { module: 'ERP - CRM',        title: 'Dashboard General' },
    inversionistas:   { module: 'ERP - CRM',        title: 'Inversionistas' },
    fondos:           { module: 'ERP - CRM',        title: 'Fondos & Tasas' },
    asesores:         { module: 'ERP - CRM',        title: 'Asesores & Comisiones' },
    inversiones:      { module: 'ERP - CRM',        title: 'Gestión de Contratos' },
    certificados:     { module: 'ERP - CRM',        title: 'Certificados' },
    deducciones:      { module: 'ERP - CRM',        title: 'Deducciones & Rescates' },
    fact_dashboard:   { module: 'ERP - Factoring',  title: 'Dashboard' },
    fact_operaciones: { module: 'ERP - Factoring',  title: 'Operaciones' },
    conf_dashboard:   { module: 'ERP - Confirming', title: 'Dashboard' },
  };
  const current = tabMap[activeTab] || { module: 'InAndes ERP', title: activeTab };

  return (
    <header className="header">
      <div className="header-title">
        <span className="header-module">{current.module}</span>
        <span className="header-separator"> / </span>
        <h1>{current.title}</h1>
      </div>

      <div className="header-actions">


        {/* Perfil del Operador */}
        <div className="user-profile">
          <div className="profile-info">
            <span className="profile-name">Jorge Parra</span>
            <span className="profile-role">Administrador Senior</span>
          </div>
          <div className="profile-avatar">
            <User size={18} />
          </div>
        </div>
      </div>
    </header>
  );
};
