// src/components/ui/TabView.tsx
import React from 'react';

export interface Tab {
  id: string;
  label: string;
  sublabel?: string;
  badge?: string;
  content: React.ReactNode;
}

interface TabViewProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (id: string) => void;
}

export const TabView: React.FC<TabViewProps> = ({ tabs, activeTab, onTabChange }) => {
  return (
    <div className="flex flex-col h-full">
      {/* Tabs Header Ribbon Estilo APEFAC NavigationRibbon */}
      <div className="flex overflow-x-auto border-b border-[#e2e8f0] dark:border-[#334155] bg-white dark:bg-[#111827] px-4 pt-1 shrink-0 hide-scrollbar gap-1">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`
                flex items-center gap-2.5 px-4 py-3 text-xs font-extrabold transition-all whitespace-nowrap cursor-pointer border-b-[3px]
                ${isActive 
                  ? 'border-[#0284c7] text-[#0284c7] dark:text-[#38bdf8] bg-[#f0f9ff] dark:bg-[#0284c7]/15 rounded-t-lg' 
                  : 'border-transparent text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-[#f8fafc] hover:bg-[#f8fafc] dark:hover:bg-[#1e293b]/50 rounded-t-lg'}
              `}
            >
              <span>{tab.label}</span>
              {tab.badge && (
                <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-[#ecfdf5] dark:bg-[#059669]/20 text-[#059669] dark:text-[#34d399] border border-[#a7f3d0] dark:border-[#059669]/30">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tabs Content */}
      <div className="flex-1 overflow-auto bg-[var(--bg-app)] p-4 relative">
        {tabs.find(tab => tab.id === activeTab)?.content}
      </div>
    </div>
  );
};
