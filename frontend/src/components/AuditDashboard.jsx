import React, { useState, useEffect } from 'react';
import { Shield, FileText, Users, Activity, X } from 'lucide-react';
import api from '../services/api';
import DashboardCharts from './DashboardCharts';

export const AuditDashboard = ({ activeTenderId, onSelectTender }) => {
  const [summary, setSummary] = useState(null);
  const [health, setHealth] = useState(null);
  const [statsData, setStatsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [chartsLoading, setChartsLoading] = useState(true);

  const [activeModal, setActiveModal] = useState(null);
  const [modalData, setModalData] = useState([]);
  const [modalLoading, setModalLoading] = useState(false);

  const handleOpenTenders = async () => {
    setActiveModal('tenders');
    setModalLoading(true);
    try {
      const data = await api.listTenders();
      setModalData(data);
    } catch (err) {
      console.error('Error fetching tenders:', err);
    } finally {
      setModalLoading(false);
    }
  };

  const handleOpenVendors = async () => {
    setActiveModal('vendors');
    setModalLoading(true);
    try {
      const data = await api.listVendors();
      setModalData(data);
    } catch (err) {
      console.error('Error fetching vendors:', err);
    } finally {
      setModalLoading(false);
    }
  };

  const closeModal = () => {
    setActiveModal(null);
    setModalData([]);
  };

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setChartsLoading(true);
      try {
        const [sumData, healthData] = await Promise.all([
          api.getAuditSummary().catch(() => ({})),
          api.getHealth().catch(() => ({ status: 'unreachable' }))
        ]);
        setSummary(sumData);
        setHealth(healthData);
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
      } finally {
        setLoading(false);
      }

      // Fetch charts data independently so KPIs appear first
      try {
        const stats = await api.getDashboardStats().catch(() => null);
        setStatsData(stats);
      } catch (err) {
        console.error('Error fetching dashboard stats:', err);
      } finally {
        setChartsLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <div style={{ color: 'var(--text-secondary)' }}>Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="panel-grid">
      {/* ── Page Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <div>
          <h1 className="header-title" style={{ background: 'none', WebkitBackgroundClip: 'unset', WebkitTextFillColor: 'unset', color: '#000' }}>
            Dashboard
          </h1>
        </div>
        <div className={`badge ${health?.status === 'healthy' ? 'badge-success' : 'badge-danger'}`}
          style={{ gap: '8px', padding: '6px 14px', marginRight: '40px' }}>
          <Activity size={14} />
          SYSTEM: {health?.status?.toUpperCase() || 'OFFLINE'}
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 190px)', gap: '16px', justifyContent: 'center' }}>
        <div 
          className="glass-card kpi-card-hover" 
          style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center', padding: '14px 24px', textAlign: 'center', minWidth: '140px', alignSelf: 'start', cursor: 'pointer' }}
          onClick={handleOpenTenders}
        >
          <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(66,133,244,0.1)', color: '#4285F4' }}>
            <FileText size={22} />
          </div>
          <div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Active Tenders</div>
            <div style={{ fontSize: '20px', fontWeight: '700', marginTop: '2px' }}>{summary?.total_tenders || 0}</div>
          </div>
        </div>

        <div 
          className="glass-card kpi-card-hover" 
          style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center', padding: '14px 24px', textAlign: 'center', minWidth: '140px', alignSelf: 'start', cursor: 'pointer' }}
          onClick={handleOpenVendors}
        >
          <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(52,168,83,0.1)', color: '#34A853' }}>
            <Users size={22} />
          </div>
          <div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Registered Vendors</div>
            <div style={{ fontSize: '20px', fontWeight: '700', marginTop: '2px' }}>{summary?.total_vendors || 0}</div>
          </div>
        </div>

        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center', padding: '14px 24px', textAlign: 'center', minWidth: '140px', alignSelf: 'start' }}>
          <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(234,67,53,0.1)', color: '#EA4335' }}>
            <Shield size={22} />
          </div>
          <div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Audit Events Logged</div>
            <div style={{ fontSize: '20px', fontWeight: '700', marginTop: '2px' }}>{summary?.total_audit_events || 0}</div>
          </div>
        </div>
      </div>

      {/* ── 4 Premium Charts ── */}
      <DashboardCharts statsData={statsData} loading={chartsLoading} />

      {/* ── Platform Activity Breakdown ── */}
      {summary?.actions_summary?.length > 0 && (
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h2 style={{ fontSize: '14px', fontWeight: '600', borderBottom: '1px solid var(--card-border)', paddingBottom: '10px' }}>
            Platform Activity Breakdown
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {summary.actions_summary.map((act, idx) => (
              <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                  <span style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{act.action}</span>
                  <span style={{ fontWeight: '600' }}>{act.count} triggers</span>
                </div>
                <div style={{ height: '6px', background: 'var(--bg-tertiary)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: '#4285F4',
                    width: `${(act.count / (summary.total_audit_events || 1)) * 100}%`,
                    transition: 'width 0.6s ease-out' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Modal Overlay ── */}
      {activeModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
        }}>
          <div className="glass-card" style={{ width: '600px', maxHeight: '80vh', display: 'flex', flexDirection: 'column', padding: '0', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--card-border)' }}>
              <h2 style={{ fontSize: '16px', fontWeight: '600', margin: 0 }}>
                {activeModal === 'tenders' ? 'Active Tenders' : 'Registered Vendors'}
              </h2>
              <button onClick={closeModal} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                <X size={20} />
              </button>
            </div>
            
            <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
              {modalLoading ? (
                <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>Loading...</div>
              ) : modalData.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>No records found.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {activeModal === 'tenders' && modalData.map(tender => (
                    <div key={tender.id} className="output-stream-card" style={{ padding: '12px', borderRadius: '8px' }}>
                      <div style={{ fontWeight: '600', fontSize: '14px' }}>{tender.title}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>{tender.tender_number} • Status: {tender.status}</div>
                    </div>
                  ))}
                  {activeModal === 'vendors' && modalData.map(vendor => (
                    <div key={vendor.id} className="output-stream-card" style={{ padding: '12px', borderRadius: '8px' }}>
                      <div style={{ fontWeight: '600', fontSize: '14px' }}>{vendor.vendor_name || vendor.name}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                        GST: {vendor.gst_number || vendor.gst || 'N/A'} • PAN: {vendor.pan_number || vendor.pan || 'N/A'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditDashboard;
