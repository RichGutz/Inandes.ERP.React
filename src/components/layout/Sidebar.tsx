// src/components/layout/Sidebar.tsx
import React from 'react';
import { 
  LayoutDashboard, 
  Users, 
  TrendingUp, 
  Coins, 
  Briefcase, 
  Calculator,
  ShieldCheck
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'inversionistas', label: 'Inversionistas', icon: Users },
    { id: 'inversiones', label: 'Inversiones', icon: TrendingUp },
    { id: 'fondos', label: 'Fondos & Tasas', icon: Coins },
    { id: 'asesores', label: 'Asesores & Comisiones', icon: Briefcase },
    { id: 'calculadora', label: 'Calculadora', icon: Calculator },
  ];

  return (
    <aside className="sidebar">
      {/* Brand Header */}
      <div className="sidebar-brand">
        <ShieldCheck className="brand-icon" />
        <div className="brand-text">
          <h2>InAndes</h2>
          <span>Inversionistas CRM</span>
        </div>
      </div>

      <nav className="sidebar-menu">
        <ul>
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            
            return (
              <li key={item.id}>
                <button
                  className={`menu-button ${isActive ? 'active' : ''}`}
                  onClick={() => setActiveTab(item.id)}
                >
                  <Icon className="menu-icon" />
                  <span>{item.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
      
      {/* Sidebar Footer */}
      <div className="sidebar-footer">
        <span>v1.0.0-beta</span>
      </div>
    </aside>
  );
};
