import React, { useState } from 'react';
import { TabView } from '../../components/ui/TabView';
import { RegistroTab } from './components/RegistroTab';
import { DashboardTab } from './components/DashboardTab';
import { OriginacionTab } from './components/OriginacionTab';
import { AprobacionesTab } from './components/AprobacionesTab';
import { DesembolsosTab } from './components/DesembolsosTab';
import { LiquidacionesTab } from './components/LiquidacionesTab';
import { RepositorioTab } from './components/RepositorioTab';

export const FactoringPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('registro');

  const tabs = [
    { id: 'registro',      label: '📋 Registro',     content: <RegistroTab /> },
    { id: 'originacion',   label: '📝 Originación',   content: <OriginacionTab /> },
    { id: 'aprobaciones',  label: '✅ Aprobaciones',  content: <AprobacionesTab /> },
    { id: 'desembolsos',   label: '💸 Desembolsos',   content: <DesembolsosTab /> },
    { id: 'liquidaciones', label: '🧾 Liquidaciones', content: <LiquidacionesTab /> },
    { id: 'repositorio',   label: '🗄️ Repositorio',  content: <RepositorioTab /> },
    { id: 'dashboard',     label: '📊 Dashboard',     content: <DashboardTab /> },
  ];

  return (
    <div className="bg-card rounded-lg shadow-sm border border-border p-6 h-[calc(100vh-140px)] overflow-hidden flex flex-col">
      <div className="flex-1 overflow-auto -mx-6 px-6 pb-6">
        <TabView 
          tabs={tabs} 
          activeTab={activeTab} 
          onTabChange={setActiveTab} 
        />
      </div>
    </div>
  );
};
