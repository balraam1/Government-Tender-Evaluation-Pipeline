import React, { useState } from 'react';
import Layout from './components/Layout';
import AuditDashboard from './components/AuditDashboard';
import RfpWorkspace from './components/RfpWorkspace';
import PreBidWorkspace from './components/PreBidWorkspace';
import StartEvaluationWorkspace from './components/StartEvaluationWorkspace';
import SecurityAuditPage from './components/SecurityAuditPage';

function App() {
  const [activeModule, setActiveModule] = useState('dashboard');
  const [activeTenderId, setActiveTenderId] = useState(null);
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <Layout 
      activeModule={activeModule} 
      setActiveModule={setActiveModule}
      isCollapsed={isCollapsed}
      setIsCollapsed={setIsCollapsed}
    >
      <div style={{ display: activeModule === 'dashboard' ? 'block' : 'none', height: '100%' }}>
        <AuditDashboard 
          activeTenderId={activeTenderId} 
          onSelectTender={setActiveTenderId} 
        />
      </div>
      <div style={{ display: activeModule === 'rfp' ? 'block' : 'none', height: '100%' }}>
        <RfpWorkspace 
          activeTenderId={activeTenderId} 
          onSelectTender={setActiveTenderId} 
        />
      </div>
      <div style={{ display: activeModule === 'prebid' ? 'block' : 'none', height: '100%' }}>
        <PreBidWorkspace 
          activeTenderId={activeTenderId} 
        />
      </div>
      <div style={{ display: activeModule === 'evaluation' ? 'block' : 'none', height: '100%' }}>
        <StartEvaluationWorkspace 
          activeTenderId={activeTenderId} 
        />
      </div>
      <div style={{ display: activeModule === 'security-audit' ? 'block' : 'none', height: '100%' }}>
        <SecurityAuditPage />
      </div>
    </Layout>
  );
}

export default App;
