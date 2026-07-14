// src/components/layout/Header.tsx
import React, { useEffect, useState } from 'react';
import { supabase } from '../../services/supabaseClient';
import { Shield, ShieldAlert, User, Lock } from 'lucide-react';

interface HeaderProps {
  activeTab: string;
}

export const Header: React.FC<HeaderProps> = ({ activeTab }) => {
  const [dbConnected, setDbConnected] = useState<boolean | null>(null);

  // Mapeo de títulos legibles
  const titles: Record<string, string> = {
    dashboard: 'Dashboard General',
    inversionistas: 'Gestión de Inversionistas',
    inversiones: 'Portafolio de Inversiones',
    fondos: 'Fondos de Inversión',
    asesores: 'Liquidación de Asesores',
    calculadora: 'Calculadora Financiera',
  };

  useEffect(() => {
    // Probar conexión rápida a Supabase al montar
    const testConnection = async () => {
      try {
        const { error } = await supabase.from('crm_fondos').select('count', { count: 'exact', head: true });
        if (error) throw error;
        setDbConnected(true);
      } catch (err) {
        console.warn('Fallo de conexión o consulta de Supabase:', err);
        setDbConnected(false);
      }
    };
    testConnection();
  }, []);

  return (
    <header className="header">
      <div className="header-title">
        <h1>{titles[activeTab] || 'InAndes CRM'}</h1>
      </div>

      <div className="header-actions">
        {/* Indicador de conexión SSL segura */}
        <div className="ssl-status-pill">
          {dbConnected === true ? (
            <>
              <Shield className="status-icon success" />
              <span className="status-text success">SSL Conectado</span>
            </>
          ) : dbConnected === false ? (
            <>
              <ShieldAlert className="status-icon danger" />
              <span className="status-text danger">Modo Offline</span>
            </>
          ) : (
            <>
              <Lock className="status-icon warning" />
              <span className="status-text warning">Cifrando...</span>
            </>
          )}
        </div>

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
