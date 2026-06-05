import React, { useState, useEffect } from 'react';
import { ShieldAlert, CheckCircle, XCircle, AlertTriangle, Play, List } from 'lucide-react';
import api from '../services/api';
import StreamText from './StreamText';
import FlowConnector from './FlowConnector';

const getPqRemarksFallback = (evalData) => {
  if (!evalData) return '';
  if (evalData.remarks && evalData.remarks.trim().length > 0) {
    return evalData.remarks;
  }
  if (evalData.overall_status === 'PASS') {
    return "Vendor meets all pre-qualification criteria. Eligible for technical evaluation stage.";
  }
  
  const fails = [];
  if (evalData.turnover_status === 'FAIL') fails.push('Annual Turnover');
  if (evalData.experience_status === 'FAIL') fails.push('Years of Operation');
  if (evalData.gst_status === 'FAIL') fails.push('GST registration copy');
  if (evalData.pan_status === 'FAIL') fails.push('PAN card validation');
  
  if (fails.length > 0) {
    return `Vendor does not meet PQ criteria for: ${fails.join(', ')}. Not eligible for further evaluation.`;
  }
  return "Vendor does not meet the mandatory pre-qualification criteria.";
};

export const PqWorkspace = ({ activeTenderId }) => {
  const [vendors, setVendors] = useState([]);
  const [selectedVendorId, setSelectedVendorId] = useState('');
  const [pqResults, setPqResults] = useState([]);
  
  const [form, setForm] = useState({
    annual_turnover: '6000000', // Default 60 Lakhs
    years_experience: '3',
    has_gst: true,
    has_pan: true,
    similar_project_value: '3000000', // Default 30 Lakhs
    certifications: 'ISO 27001, CMMI Level 3'
  });

  const [evaluating, setEvaluating] = useState(false);
  const [latestEval, setLatestEval] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadVendors();
    if (activeTenderId) {
      loadPQResults();
    }
  }, [activeTenderId]);

  async function loadVendors() {
    try {
      const data = await api.listVendors();
      setVendors(data);
    } catch (err) {
      console.error("Error loading vendors:", err);
    }
  }

  async function loadPQResults() {
    setLoading(true);
    try {
      const data = await api.getPQResults(activeTenderId);
      setPqResults(data);
    } catch (err) {
      console.error("Error loading PQ results:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleEvaluate(e) {
    e.preventDefault();
    if (!activeTenderId) {
      alert("Please select or create an active tender in Module 1 first.");
      return;
    }
    if (!selectedVendorId) {
      alert("Please select or register a vendor first.");
      return;
    }

    setEvaluating(true);
    setLatestEval(null);

    const payload = {
      vendor_id: parseInt(selectedVendorId),
      tender_id: activeTenderId,
      annual_turnover: parseFloat(form.annual_turnover),
      years_experience: parseInt(form.years_experience),
      has_gst: form.has_gst,
      has_pan: form.has_pan,
      similar_project_value: parseFloat(form.similar_project_value),
      certifications: form.certifications.split(',').map(c => c.trim()).filter(Boolean)
    };

    try {
      const result = await api.evaluatePQ(payload);
      setLatestEval(result);
      loadPQResults();
    } catch (err) {
      alert(`PQ Evaluation Failed: ${err.message}`);
    } finally {
      setEvaluating(false);
    }
  }

  return (
    <div className="panel-grid panel-grid-2">
      {/* Left: Selection & PQ Metrics Form */}
      <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto', alignSelf: 'center', justifySelf: 'center', maxWidth: '480px', width: '100%', height: '480px' }}>
        <div style={{ fontSize: '16px', fontWeight: '600', borderBottom: '1px solid var(--card-border)', paddingBottom: '10px', color: 'var(--text-primary)' }}>
          Vendor Eligibility (PQ) Inputs
        </div>

        {!activeTenderId ? (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <AlertTriangle size={24} style={{ margin: '0 auto 8px auto', color: 'var(--color-warning)' }} />
            Please select an active tender in Module 1 first.
          </div>
        ) : (
          <form onSubmit={handleEvaluate} style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
            <div>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Select Evaluated Bidder</label>
              <select 
                required
                className="glass-input" 
                style={{ marginTop: '6px' }}
                value={selectedVendorId}
                onChange={e => setSelectedVendorId(e.target.value)}
              >
                <option value="">-- Choose Vendor --</option>
                {vendors.map(v => (
                  <option key={v.id} value={v.id}>{v.vendor_name} (ID: {v.id})</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Annual Turnover (INR)</label>
                <input 
                  type="number" 
                  className="glass-input" 
                  style={{ marginTop: '6px' }}
                  value={form.annual_turnover}
                  onChange={e => setForm({...form, annual_turnover: e.target.value})}
                />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Years of Operation</label>
                <input 
                  type="number" 
                  className="glass-input" 
                  style={{ marginTop: '6px' }}
                  value={form.years_experience}
                  onChange={e => setForm({...form, years_experience: e.target.value})}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Prior Project Value (INR)</label>
                <input 
                  type="number" 
                  className="glass-input" 
                  style={{ marginTop: '6px' }}
                  value={form.similar_project_value}
                  onChange={e => setForm({...form, similar_project_value: e.target.value})}
                />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Certifications (Comma separated)</label>
                <input 
                  type="text" 
                  className="glass-input" 
                  style={{ marginTop: '6px' }}
                  value={form.certifications}
                  onChange={e => setForm({...form, certifications: e.target.value})}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '20px', marginTop: '24px', justifyContent: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                <input 
                  type="checkbox" 
                  checked={form.has_gst}
                  onChange={e => setForm({...form, has_gst: e.target.checked})}
                />
                Valid GSTIN Copy
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                <input 
                  type="checkbox" 
                  checked={form.has_pan}
                  onChange={e => setForm({...form, has_pan: e.target.checked})}
                />
                Valid PAN Card Copy
              </label>
            </div>

            <button 
              type="submit" 
              className="btn-primary" 
              style={{ marginTop: 'auto', justifyContent: 'center', marginBottom: '8px' }}
              disabled={evaluating}
            >
              <Play size={16} />
              {evaluating ? 'Running rule engine...' : 'Evaluate Bidder Eligibility'}
            </button>
          </form>
        )}
      </div>

      {/* Right: PQ Evaluation Output */}
      <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignSelf: 'center', justifySelf: 'center', maxWidth: '480px', width: '100%', height: '480px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--card-border)', paddingBottom: '10px' }}>
          <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)' }}>
            PQ Eligibility Status Report
          </div>
          <div className="avatar-stack">
            <span style={{ fontSize: '9px', color: 'var(--text-muted)', marginRight: '6px' }}>OFFICERS:</span>
            <div className="avatar-item" style={{ background: '#27272A', color: '#FFF' }}>CG</div>
            <div className="avatar-item" style={{ background: '#3F3F46', color: '#FFF' }}>TA</div>
            <div className="avatar-item" style={{ background: 'var(--color-success)', color: '#000' }}>AI</div>
          </div>
        </div>

        {evaluating && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '12px' }}>
            <div className="terminal-cursor" style={{ width: '12px', height: '22px' }}></div>
            <div style={{ color: 'var(--text-secondary)' }}>AI Agent is verifying annual turnovers against RFP_682 guidelines...</div>
          </div>
        )}

        {!evaluating && !latestEval && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', textAlign: 'center' }}>
            Run the eligibility check on the left to see<br/>detailed checklists and AI remarks.
          </div>
        )}

        {!evaluating && latestEval && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
            <div className="output-stream-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', borderRadius: '6px' }}>
              <span style={{ fontSize: '14px', fontWeight: '600' }}>Overall Qualification Status</span>
              {latestEval.overall_status === 'PASS' ? (
                <div className="badge badge-success" style={{ gap: '8px' }}>
                  <CheckCircle size={14} /> QUALIFIED (PASS)
                </div>
              ) : (
                <div className="badge badge-danger" style={{ gap: '8px' }}>
                  <XCircle size={14} /> NOT QUALIFIED (FAIL)
                </div>
              )}
            </div>

            {/* Checklist Grid */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <h3 style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)' }}>Parameters Compliance Check</h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '6px' }}>
                <div className="output-stream-card" style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', borderRadius: '4px', fontSize: '12px' }}>
                  <span>Annual Turnover (≥ 50 Lakhs)</span>
                  <strong style={{ color: latestEval.turnover_status === 'PASS' ? 'var(--color-success)' : 'var(--color-danger)' }}>{latestEval.turnover_status}</strong>
                </div>
                <div className="output-stream-card" style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', borderRadius: '4px', fontSize: '12px' }}>
                  <span>Experience Years (≥ 2 years)</span>
                  <strong style={{ color: latestEval.experience_status === 'PASS' ? 'var(--color-success)' : 'var(--color-danger)' }}>{latestEval.experience_status}</strong>
                </div>
                <div className="output-stream-card" style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', borderRadius: '4px', fontSize: '12px' }}>
                  <span>GST registration copy</span>
                  <strong style={{ color: latestEval.gst_status === 'PASS' ? 'var(--color-success)' : 'var(--color-danger)' }}>{latestEval.gst_status}</strong>
                </div>
                <div className="output-stream-card" style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', borderRadius: '4px', fontSize: '12px' }}>
                  <span>PAN card validation</span>
                  <strong style={{ color: latestEval.pan_status === 'PASS' ? 'var(--color-success)' : 'var(--color-danger)' }}>{latestEval.pan_status}</strong>
                </div>
              </div>
            </div>

            {latestEval.shortfall_report?.length > 0 && (
              <div className="glass-card glow-alert-card-danger" style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', color: 'var(--color-danger)', fontSize: '13px', fontWeight: '700' }}>
                  <ShieldAlert size={16} /> Shortfall Deficiencies Detected
                </div>
                <ul style={{ paddingLeft: '16px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  {latestEval.shortfall_report.map((item, idx) => (
                    <li key={idx} style={{ marginTop: '2px' }}>
                      {item.criterion}: <span style={{ color: 'var(--color-danger)', fontWeight: '600' }}>{item.shortfall}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div style={{ marginTop: '24px' }}>
              <span className="badge badge-info">AI Evaluator Remarks</span>
              <div style={{ display: 'flex', gap: '14px', marginTop: '14px' }}>
                <FlowConnector />
                <div className="output-stream-card" style={{ flex: 1, padding: '12px', fontSize: '13px', borderRadius: '6px', lineHeight: '1.4' }}>
                  <StreamText text={getPqRemarksFallback(latestEval)} speed={12} />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PqWorkspace;
