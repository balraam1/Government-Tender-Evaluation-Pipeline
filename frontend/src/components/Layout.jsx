import React from 'react';
import Sidebar from './Sidebar';

export const Layout = ({ 
  activeModule, 
  setActiveModule, 
  isCollapsed, 
  setIsCollapsed,
  children 
}) => {
  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden', background: 'var(--bg-primary)' }}>
      {/* Sidebar navigation */}
      <Sidebar 
        activeModule={activeModule} 
        setActiveModule={setActiveModule}
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
      />
      
      {/* Main workspace container */}
      <main 
        style={{ 
          flex: 1, 
          height: '100%', 
          overflow: 'hidden', 
          display: 'flex', 
          flexDirection: 'column',
          padding: '24px 32px'
        }}
      >
        <div style={{ flex: 1, overflow: 'hidden' }}>
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
