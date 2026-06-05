import React from 'react';
import { 
  Activity, FileText, MessageSquare, Upload, 
  ShieldCheck, Award, DollarSign 
} from 'lucide-react';

export const Sidebar = ({ 
  activeModule, 
  setActiveModule
}) => {
  const menuItems = [
    { id: 'dashboard', label: 'Executive logs', icon: Activity },
    { id: 'rfp', label: '1. RFP Authoring', icon: FileText },
    { id: 'prebid', label: '2. Pre-Bid Queries', icon: MessageSquare },
    { id: 'ocr', label: '3. OCR Pipeline', icon: Upload },
    { id: 'pq', label: '4. Pre-Qualification', icon: ShieldCheck },
    { id: 'tech', label: '5. Tech Evaluation', icon: Award },
    { id: 'financial', label: '6. Financial Award', icon: DollarSign },
  ];

  const handleItemClick = (id) => {
    setActiveModule(id);
  };

  return (
    <div 
      className="sidebar"
      style={{
        width: '260px',
        minWidth: '260px',
        background: 'var(--bg-secondary)',
        borderRight: '1px solid var(--card-border)',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        zIndex: 10
      }}
    >
      {/* Sidebar Header */}
      <div 
        style={{ 
          height: '64px', 
          display: 'flex', 
          alignItems: 'center', 
          padding: '0 20px', 
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--card-border)'
        }}
      >
        <span style={{ fontWeight: '700', fontSize: '15px', color: 'var(--text-primary)', letterSpacing: '0.05em' }}>
          🏛️ MPSEDC GenAI
        </span>
      </div>

      {/* Navigation Buttons list */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px 10px', overflowY: 'auto' }}>
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeModule === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => handleItemClick(item.id)}
              className={`sidebar-item ${isActive ? 'active' : ''}`}
            >
              {/* Highlight active left border line */}
              {isActive && (
                <div className="sidebar-active-indicator" />
              )}
              
              <Icon size={18} style={{ flexShrink: 0 }} />
              
              <span className="sidebar-label">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Footer Branding Info */}
      <div 
        style={{ 
          padding: '16px 20px', 
          borderTop: '1px solid var(--card-border)', 
          fontSize: '10px', 
          color: 'var(--text-muted)',
          textAlign: 'center',
          whiteSpace: 'nowrap',
          overflow: 'hidden'
        }}
      >
        MPSEDC Portal v1.0.0
      </div>
    </div>
  );
};

export default Sidebar;
