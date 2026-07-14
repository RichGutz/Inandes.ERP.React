// src/components/layout/Layout.tsx
import React from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

interface LayoutProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ activeTab, setActiveTab, children }) => {
  return (
    <div className="layout-container">
      {/* Sidebar Lateral */}
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      
      {/* Sección de Contenido Principal (Header + Main viewport) */}
      <div className="layout-content-wrapper">
        <Header activeTab={activeTab} />
        <main className="layout-main-content">
          <div className="content-container">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
