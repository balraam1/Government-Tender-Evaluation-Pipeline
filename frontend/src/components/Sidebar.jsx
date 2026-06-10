import React from 'react';
import { 
  Activity, FileText, MessageSquare, Upload, 
  ShieldCheck, Award, DollarSign, Lock
} from 'lucide-react';

export const Sidebar = ({ 
  activeModule, 
  setActiveModule
}) => {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Activity },
    { id: 'rfp', label: 'RFP Authoring', icon: FileText },
    { id: 'prebid', label: 'Pre-Bid Queries', icon: MessageSquare },
    { id: 'ocr', label: 'OCR Pipeline', icon: Upload },
    { id: 'pq', label: 'Pre-Qualification', icon: ShieldCheck },
    { id: 'tech', label: 'Tech Evaluation', icon: Award },
    { id: 'financial', label: 'Financial Award', icon: DollarSign },
    { id: 'recommendation', label: 'Final Recommendation', icon: FileText },
    { id: 'security-audit', label: 'Security Audit Trail', icon: Lock },
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
