// src/components/layout/Sidebar.tsx
import React, { useState } from 'react';
import {

  Users,
  Briefcase,
  Award,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  Layers,
  CheckSquare,
  BarChart2,
  Coins,
  FileText,
  MinusCircle,
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

interface MenuItem {
  id: string;
  label: string;
  icon: React.ElementType;
}

interface MenuGroup {
  id: string;
  label: string;
  icon: React.ElementType;
  items: MenuItem[];
}

const menuGroups: MenuGroup[] = [
  {
    id: 'crm',
    label: 'ERP - CRM',
    icon: Users,
    items: [
      { id: 'crm_inversionistas', label: 'Inversionistas',     icon: Users },
      { id: 'crm_fondos',         label: 'Fondos & Tasas',     icon: Coins },
      { id: 'crm_asesores',       label: 'Asesores',           icon: Briefcase },
      { id: 'crm_contratos',      label: 'Contratos',          icon: FileText },
      { id: 'crm_certificados',   label: 'Certificados',       icon: Award },
      { id: 'crm_deducciones',    label: 'Deducciones',        icon: MinusCircle },
    ],
  },
  {
    id: 'factoring',
    label: 'ERP - Factoring',
    icon: Layers,
    items: [
      { id: 'factoring_core',         label: 'Factoring', icon: Layers },
    ],
  },
  {
    id: 'confirming',
    label: 'ERP - Confirming',
    icon: CheckSquare,
    items: [
      { id: 'confirming_futuros', label: 'Próximamente',    icon: BarChart2 },
    ],
  },
];

const CRM_IDS = new Set(menuGroups[0].items.map(i => i.id));
const FACT_IDS = new Set(menuGroups[1].items.map(i => i.id));

function getActiveGroup(activeTab: string): string {
  if (CRM_IDS.has(activeTab)) return 'crm';
  if (FACT_IDS.has(activeTab)) return 'factoring';
  return 'confirming';
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    crm: getActiveGroup(activeTab) === 'crm',
    factoring: getActiveGroup(activeTab) === 'factoring',
    confirming: getActiveGroup(activeTab) === 'confirming',
  });

  const toggleGroup = (groupId: string) => {
    setOpenGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  return (
    <aside className="sidebar">
      {/* Brand Header */}
      <div className="sidebar-brand">
        <ShieldCheck className="brand-icon" />
        <div className="brand-text">
          <h2>InAndes</h2>
          <span>ERP Suite</span>
        </div>
      </div>

      <nav className="sidebar-menu">
        {menuGroups.map((group) => {
          const GroupIcon = group.icon;
          const isOpen = openGroups[group.id];
          const isGroupActive = group.items.some(i => i.id === activeTab);

          return (
            <div key={group.id} className="menu-group">
              {/* Group Header (colapsable) */}
              <button
                className={`menu-group-header ${isGroupActive ? 'group-active' : ''}`}
                onClick={() => toggleGroup(group.id)}
              >
                <GroupIcon className="menu-icon" size={16} />
                <span className="group-label">{group.label}</span>
                {isOpen
                  ? <ChevronDown size={14} className="chevron" />
                  : <ChevronRight size={14} className="chevron" />}
              </button>

              {/* Group Items */}
              {isOpen && (
                <ul className="menu-group-items">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                      <li key={item.id}>
                        <button
                          className={`menu-button menu-button-sub ${isActive ? 'active' : ''}`}
                          onClick={() => setActiveTab(item.id)}
                        >
                          <Icon className="menu-icon" size={15} />
                          <span>{item.label}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <span>v1.0.0-beta</span>
      </div>
    </aside>
  );
};
