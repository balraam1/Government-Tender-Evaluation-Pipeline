import React, { useState, useEffect } from 'react';
import { Shield, Activity, Download } from 'lucide-react';
import api from '../services/api';

export const SecurityAuditPage = () => {
  const [logs, setLogs] = useState([]);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const [logData, healthData] = await Promise.all([
          api.getAuditLogs().catch(() => []),
          api.getHealth().catch(() => ({ status: 'unreachable' }))
        ]);
        setLogs(logData);
        setHealth(healthData);
      } catch (err) {
        console.error('Error fetching audit logs:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <div style={{ color: 'var(--text-secondary)' }}>Loading security audit trail...</div>
      </div>
    );
  }

  return (
    <div className="panel-grid">
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ padding: '10px', borderRadius: '10px', background: 'rgba(59, 130, 246, 0.1)', color: 'var(--accent-blue)' }}>
            <Shield size={24} />
          </div>
          <div>
            <h1 className="header-title" style={{ background: 'none', WebkitBackgroundClip: 'unset', WebkitTextFillColor: 'unset', color: '#000', marginBottom: '2px' }}>
              Live Security Audit Trail
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
              Real-time log of all security-relevant events across all modules
            </p>
          </div>
        </div>

        {/* Export + System health */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginRight: '40px' }}>
          <button
            className="btn-primary"
            style={{ padding: '8px 16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
            disabled={logs.length === 0}
            onClick={() => {
              const headers = ['ID', 'Timestamp', 'Action', 'Module', 'User', 'Tender ID', 'Details'];
              const rows = logs.map(l => [
                l.id,
                new Date(l.created_at).toLocaleString(),
                l.action,
                l.module,
                l.user_id,
                l.tender_id ?? '',
                l.details ? JSON.stringify(l.details).replace(/,/g, ';') : ''
              ]);
              const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
              const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `audit_logs_${new Date().toISOString().slice(0, 10)}.csv`;
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            <Download size={14} />
            Export All Logs
          </button>
          <div
            className={`badge ${health?.status === 'healthy' ? 'badge-success' : 'badge-danger'}`}
            style={{ gap: '8px', padding: '6px 14px' }}
          >
            <Activity size={14} />
            SYSTEM: {health?.status?.toUpperCase() || 'OFFLINE'}
          </div>
        </div>
      </div>

      {/* Summary strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 190px)', gap: '16px', justifyContent: 'center', marginBottom: '6px' }}>
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center', padding: '14px 24px', textAlign: 'center', minWidth: '140px', alignSelf: 'start' }}>
          <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(59, 130, 246, 0.1)', color: 'var(--accent-blue)' }}>
            <Shield size={22} />
          </div>
          <div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Total Events</div>
            <div style={{ fontSize: '20px', fontWeight: '700', marginTop: '2px' }}>{logs.length}</div>
          </div>
        </div>
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center', padding: '14px 24px', textAlign: 'center', minWidth: '140px', alignSelf: 'start' }}>
          <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--color-success)' }}>
            <Activity size={22} />
          </div>
          <div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Unique Modules</div>
            <div style={{ fontSize: '20px', fontWeight: '700', marginTop: '2px' }}>{new Set(logs.map(l => l.module)).size}</div>
          </div>
        </div>
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center', padding: '14px 24px', textAlign: 'center', minWidth: '140px', alignSelf: 'start' }}>
          <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(139, 92, 246, 0.1)', color: 'var(--accent-violet)' }}>
            <Shield size={22} />
          </div>
          <div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Unique Users</div>
            <div style={{ fontSize: '20px', fontWeight: '700', marginTop: '2px' }}>{new Set(logs.map(l => l.user_id)).size}</div>
          </div>
        </div>
      </div>

      {/* Full Audit Log Timeline */}
      <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1, minHeight: 0 }}>
        <h2 style={{ fontSize: '16px', fontWeight: '600', borderBottom: '1px solid var(--card-border)', paddingBottom: '10px', margin: 0 }}>
          Audit Event Timeline
        </h2>
        <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', paddingRight: '4px', flex: 1 }}>
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
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                    {new Date(log.created_at).toLocaleString()}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '6px', margin: '4px 0', alignItems: 'center' }}>
                  <span className="badge badge-info" style={{ fontSize: '9px', padding: '1px 6px' }}>{log.module}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>User: {log.user_id}</span>
                </div>
                {log.details && (
                  <div style={{
                    fontSize: '11px',
                    color: 'var(--text-secondary)',
                    background: 'var(--overlay-bg)',
                    border: '1px solid var(--card-border)',
                    padding: '6px',
                    borderRadius: '4px',
                    fontFamily: 'monospace'
                  }}>
                    {JSON.stringify(log.details)}
                  </div>
                )}
              </div>
            </div>
          )) : (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 20px' }}>
              No audit events found. Run evaluations or OCR pipelines to generate logs.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SecurityAuditPage;
