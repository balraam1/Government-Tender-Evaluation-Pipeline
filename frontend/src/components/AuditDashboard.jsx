import React, { useState, useEffect } from 'react';
import { Shield, FileText, Users, Activity, CheckCircle, AlertTriangle } from 'lucide-react';
import api from '../services/api';

export const AuditDashboard = ({ activeTenderId, onSelectTender }) => {
  const [summary, setSummary] = useState(null);
  const [logs, setLogs] = useState([]);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const [sumData, logData, healthData] = await Promise.all([
          api.getAuditSummary().catch(() => ({})),
          api.getAuditLogs().catch(() => []),
          api.getHealth().catch(() => ({ status: 'unreachable' }))
        ]);
        setSummary(sumData);
        setLogs(logData);
        setHealth(healthData);
      } catch (err) {
        console.error("Error fetching dashboard data:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <div style={{ color: 'var(--text-secondary)' }}>Loading executive logs dashboard...</div>
      </div>
    );
  }

  return (
    <div className="panel-grid">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <div>
          <h1 className="header-title" style={{ background: 'none', WebkitBackgroundClip: 'unset', WebkitTextFillColor: 'unset', color: '#000' }}>Executive Logs & Health</h1>
        </div>
        
        {/* Health status badge */}
        <div className={`badge ${health?.status === 'healthy' ? 'badge-success' : 'badge-danger'}`} style={{ gap: '8px', padding: '6px 14px', marginRight: '40px' }}>
          <Activity size={14} />
          SYSTEM: {health?.status?.toUpperCase() || 'OFFLINE'}
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 190px)', gap: '16px', justifyContent: 'center' }}>
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center', padding: '14px 24px', textAlign: 'center', minWidth: '140px' }}>
          <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(59, 130, 246, 0.1)', color: 'var(--accent-blue)' }}>
            <FileText size={22} />
          </div>
          <div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Active Tenders</div>
            <div style={{ fontSize: '20px', fontWeight: '700', marginTop: '2px' }}>{summary?.total_tenders || 0}</div>
          </div>
        </div>

        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center', padding: '14px 24px', textAlign: 'center', minWidth: '140px' }}>
          <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(139, 92, 246, 0.1)', color: 'var(--accent-violet)' }}>
            <Users size={22} />
          </div>
          <div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Registered Vendors</div>
            <div style={{ fontSize: '20px', fontWeight: '700', marginTop: '2px' }}>{summary?.total_vendors || 0}</div>
          </div>
        </div>

        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center', padding: '14px 24px', textAlign: 'center', minWidth: '140px' }}>
          <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--color-success)' }}>
            <Shield size={22} />
          </div>
          <div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Audit Events logged</div>
            <div style={{ fontSize: '20px', fontWeight: '700', marginTop: '2px' }}>{summary?.total_audit_events || 0}</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gap: '20px', marginTop: '10px' }} className="panel-grid-2">
        {/* Actions Summary Chart list */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignSelf: 'start' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '600', borderBottom: '1px solid var(--card-border)', paddingBottom: '10px' }}>Platform Activity breakdown</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, justifyContent: 'flex-start' }}>
            {summary?.actions_summary?.map((act, idx) => (
              <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                  <span style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{act.action}</span>
                  <span style={{ fontWeight: '600' }}>{act.count} triggers</span>
                </div>
                <div style={{ height: '6px', background: 'var(--bg-tertiary)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div 
                    style={{ 
                      height: '100%', 
                      background: '#3B82F6',
                      width: `${(act.count / (summary.total_audit_events || 1)) * 100}%`
                    }}
                  />
                </div>
              </div>
            )) || (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No actions recorded yet. Run a module to log events.</div>
            )}
          </div>
        </div>

        {/* Live Timeline logs */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '600', borderBottom: '1px solid var(--card-border)', paddingBottom: '10px' }}>Live Security Audit Trail</h2>
          <div style={{ overflowY: 'auto', maxH: '260px', display: 'flex', flexDirection: 'column', gap: '12px', paddingRight: '4px' }}>
            {logs.length > 0 ? logs.map((log) => (
              <div 
                key={log.id} 
                style={{ 
                  display: 'flex', 
                  gap: '12px', 
                  fontSize: '13px', 
                  borderBottom: '1px solid var(--card-border)',
                  paddingBottom: '8px'
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-blue)', marginTop: '5px' }}></div>
                  <div style={{ flex: 1, width: '1px', background: 'var(--card-border)' }}></div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <strong style={{ color: 'var(--text-primary)' }}>{log.action}</strong>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{new Date(log.created_at).toLocaleTimeString()}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', margin: '4px 0', alignItems: 'center' }}>
                    <span className="badge badge-info" style={{ fontSize: '9px', padding: '1px 6px' }}>{log.module}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>User: {log.user_id}</span>
                  </div>
                  {log.details && (
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', background: 'var(--overlay-bg)', border: '1px solid var(--card-border)', padding: '6px', borderRadius: '4px', fontFamily: 'monospace' }}>
                      {JSON.stringify(log.details)}
                    </div>
                  )}
                </div>
              </div>
            )) : (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>No audit events found. Run evaluations or OCR pipelines to generate logs.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuditDashboard;
