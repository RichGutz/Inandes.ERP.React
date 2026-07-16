import React from 'react';

export interface Tab {
  id: string;
  label: string;
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
      {/* Tabs Header */}
      <div className="flex overflow-x-auto border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-4 pt-2 shrink-0 hide-scrollbar">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`
                px-5 py-3 text-sm font-semibold transition-all whitespace-nowrap border-b-2 
                ${isActive 
                  ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400' 
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'}
              `}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tabs Content */}
      <div className="flex-1 overflow-auto bg-slate-50 dark:bg-[#0e1117] p-4">
        {tabs.find(tab => tab.id === activeTab)?.content}
      </div>
    </div>
  );
};
