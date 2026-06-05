import React, { useState, useEffect } from 'react';
import { Award, FileText, CheckCircle2, AlertTriangle, ShieldCheck, Mail, Send } from 'lucide-react';
import api from '../services/api';
import StreamText from './StreamText';
import FlowConnector from './FlowConnector';

export const TechnicalWorkspace = ({ activeTenderId }) => {
  const [vendors, setVendors] = useState([]);
  const [selectedVendorId, setSelectedVendorId] = useState('');
  const [bidText, setBidText] = useState('');
  const [evaluating, setEvaluating] = useState(false);
  const [latestEval, setLatestEval] = useState(null);

  // Shortfall states
  const [analyzingShortfall, setAnalyzingShortfall] = useState(false);
  const [shortfallData, setShortfallData] = useState(null);
  
  // Custom checklist selections for shortfall detection
  const [submittedDocs, setSubmittedDocs] = useState([
    "Certificate of Incorporation",
    "CA Certificate with UDIN",
    "GST Registration Certificate",
    "PAN Card Copy"
  ]);
  const [submittedClauses, setSubmittedClauses] = useState([
    "Scope of Work acceptance",
    "SLA terms acceptance"
  ]);

  const DOC_OPTIONS = [
    "Certificate of Incorporation", "CA Certificate with UDIN", "Audited Financial Statements",
    "Work Order / PO for similar project", "Client Completion Certificate", "GST Registration Certificate",
    "PAN Card Copy", "Undertaking for Solution Readiness", "Self-Declaration (Non-Blacklisting)"
  ];
  
  const CLAUSE_OPTIONS = [
    "Scope of Work acceptance", "SLA terms acceptance", "Penalty clause acceptance",
    "Data security compliance", "On-premises deployment commitment"
  ];

  useEffect(() => {
    loadVendors();
  }, []);

  async function loadVendors() {
    try {
      const data = await api.listVendors();
      setVendors(data);
    } catch (err) {
      console.error("Error loading vendors:", err);
    }
  }

  async function handleEvaluate(e) {
    e.preventDefault();
    if (!activeTenderId || !selectedVendorId) {
      alert("Please ensure tender and vendor are selected.");
      return;
    }
    setEvaluating(true);
    setLatestEval(null);
    try {
      const result = await api.evaluateTechnical({
        vendor_id: parseInt(selectedVendorId),
        tender_id: activeTenderId,
        bid_text: bidText || "Submitted technical bid for evaluation."
      });
      setLatestEval(result);
    } catch (err) {
      alert(`Technical Evaluation Failed: ${err.message}`);
    } finally {
      setEvaluating(false);
    }
  }

  async function handleAnalyzeShortfall() {
    if (!activeTenderId || !selectedVendorId) return;
    setAnalyzingShortfall(true);
    setShortfallData(null);
    try {
      const result = await api.analyzeShortfall({
        vendor_id: parseInt(selectedVendorId),
        tender_id: activeTenderId,
        submitted_documents: submittedDocs,
        submitted_clauses: submittedClauses
      });
      setShortfallData(result);
    } catch (err) {
      alert(`Shortfall Analysis Failed: ${err.message}`);
    } finally {
      setAnalyzingShortfall(false);
    }
  }

  const handleDocToggle = (doc) => {
    setSubmittedDocs(prev => 
      prev.includes(doc) ? prev.filter(d => d !== doc) : [...prev, doc]
    );
  };

  const handleClauseToggle = (clause) => {
    setSubmittedClauses(prev => 
      prev.includes(clause) ? prev.filter(c => c !== clause) : [...prev, clause]
    );
  };

  return (
    <div className="panel-grid panel-grid-2">
      {/* Left Pane: Bid Input & Shortfall Toggles */}
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '20px', 
        alignItems: 'center', 
        width: '100%',
        ...(shortfallData ? {} : { justifyContent: 'center', height: '100%' })
      }}>
        {!activeTenderId ? (
          <div className="glass-card" style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', maxWidth: '540px', width: '100%' }}>
            <AlertTriangle size={24} style={{ margin: '0 auto 8px auto', color: 'var(--color-warning)' }} />
            Please select an active tender in Module 1 first.
          </div>
        ) : (
          <>
            {/* Card 1: Technical Proposal Evaluation inputs */}
            <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '540px', width: '100%', padding: '14px 16px' }}>
              <div style={{ fontSize: '16px', fontWeight: '600', borderBottom: '1px solid var(--card-border)', paddingBottom: '10px', color: 'var(--text-primary)' }}>
                Technical Proposal Evaluation inputs
              </div>
              
              <form onSubmit={handleEvaluate} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600' }}>Select Evaluated Bidder</label>
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

                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600' }}>Proposal Text Synopsis</label>
                  <textarea 
                    rows={2}
                    placeholder="Enter proposal extracts showing SLA commitment, audit plans, or deployment workflows..."
                    className="glass-input" 
                    style={{ marginTop: '6px', resize: 'none' }}
                    value={bidText}
                    onChange={e => setBidText(e.target.value)}
                  />
                </div>

                <button type="submit" className="btn-primary" style={{ justifyContent: 'center' }} disabled={evaluating}>
                  <Award size={16} />
                  {evaluating ? 'Analyzing bid compliance matrices...' : 'Run Technical Evaluation'}
                </button>
              </form>
            </div>

            {/* Card 2: Shortfall Documents Checklist */}
            <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '540px', width: '100%', padding: '14px 16px' }}>
              <div style={{ fontSize: '16px', fontWeight: '600', borderBottom: '1px solid var(--card-border)', paddingBottom: '10px', color: 'var(--text-primary)' }}>
                Shortfall Documents Checklist
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px' }}>
                {DOC_OPTIONS.map((doc, idx) => (
                  <label key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={submittedDocs.includes(doc)}
                      onChange={() => handleDocToggle(doc)}
                    />
                    {doc}
                  </label>
                ))}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600' }}>Clause Commitments Included:</span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px', marginTop: '4px' }}>
                  {CLAUSE_OPTIONS.map((clause, idx) => (
                    <label key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                      <input 
                        type="checkbox" 
                        checked={submittedClauses.includes(clause)}
                        onChange={() => handleClauseToggle(clause)}
                      />
                      {clause}
                    </label>
                  ))}
                </div>
              </div>

              <button 
                className="btn-primary" 
                style={{ gap: '8px', alignSelf: 'center', marginTop: '12px' }}
                onClick={handleAnalyzeShortfall}
                disabled={analyzingShortfall || !selectedVendorId}
              >
                <Mail size={16} />
                {analyzingShortfall ? 'Scanning submissions...' : 'Detect Shortfalls & Draft Letter'}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Right Pane: Compliance table / Shortfall request draft */}
      <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', overflow: 'hidden', alignSelf: 'center', justifySelf: 'center', maxWidth: '540px', width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--card-border)', paddingBottom: '10px' }}>
          <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)' }}>
            Evaluation Reports Pane
          </div>
          <div className="avatar-stack">
            <span style={{ fontSize: '9px', color: 'var(--text-muted)', marginRight: '6px' }}>COMMITTEE:</span>
            <div className="avatar-item" style={{ background: '#27272A', color: '#FFF' }}>CG</div>
            <div className="avatar-item" style={{ background: '#3F3F46', color: '#FFF' }}>TA</div>
            <div className="avatar-item" style={{ background: 'var(--color-success)', color: '#000' }}>AI</div>
          </div>
        </div>

        {evaluating && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '12px' }}>
            <div className="terminal-cursor" style={{ width: '12px', height: '22px' }}></div>
            <div style={{ color: 'var(--text-secondary)' }}>AI Agent is evaluating criteria demonstration parameters...</div>
          </div>
        )}

        {!evaluating && !latestEval && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', textAlign: 'center' }}>
            Submit a proposal or analyze checklist on the left<br/>to generate evaluation scorecards.
          </div>
        )}

        {/* Technical Scorecard Matrix (Aligned to user image layout) */}
        {!evaluating && latestEval && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto', flex: 1 }}>
            <div className="output-stream-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', borderRadius: '6px' }}>
              <div>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block' }}>Score: {latestEval.overall_score} / {latestEval.max_score} ({latestEval.percentage}%)</span>
                <span style={{ fontSize: '14px', fontWeight: '700' }}>Overall Technical Qualification</span>
              </div>
              <div className={`badge ${latestEval.qualification_status === 'QUALIFIED' ? 'badge-success' : 'badge-danger'}`} style={{ gap: '6px' }}>
                {latestEval.qualification_status === 'QUALIFIED' ? <ShieldCheck size={14} /> : <AlertTriangle size={14} />}
                {latestEval.qualification_status}
              </div>
            </div>

            <div className="output-stream-card" style={{ overflowX: 'auto', padding: '12px', borderRadius: '8px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--card-border)', color: 'var(--text-secondary)' }}>
                    <th style={{ padding: '8px 4px' }}>S.No</th>
                    <th style={{ padding: '8px 4px' }}>Evaluation Parameter</th>
                    <th style={{ padding: '8px 4px', textAlign: 'center' }}>Score</th>
                    <th style={{ padding: '8px 4px', textAlign: 'center' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {latestEval.compliance_matrix.map((row, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--overlay-border)' }}>
                      <td style={{ padding: '10px 4px', color: 'var(--text-muted)' }}>{idx + 1}</td>
                      <td style={{ padding: '10px 4px' }}>
                        <div style={{ fontWeight: '500' }}>{row.parameter_name}</div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>{row.remarks}</div>
                      </td>
                      <td style={{ padding: '10px 4px', textAlign: 'center', fontWeight: '600' }}>{row.scored}</td>
                      <td style={{ padding: '10px 4px', textAlign: 'center' }}>
                        <span style={{ 
                          fontSize: '10px', 
                          fontWeight: '600',
                          color: row.compliance === 'COMPLIANT' ? 'var(--color-success)' : row.compliance === 'PARTIAL' ? 'var(--color-warning)' : 'var(--color-danger)'
                        }}>
                          {row.compliance === 'COMPLIANT' ? 'Qualified' : row.compliance === 'PARTIAL' ? 'Partial' : 'Fail'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Shortfall Clarification Letter */}
      {!evaluating && shortfallData && (
        <div 
          className="glass-card" 
          style={{ 
            gridColumn: '1 / -1', 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '16px', 
            maxWidth: '1100px', 
            width: '100%', 
            alignSelf: 'center', 
            marginTop: '50px',
            marginBottom: '20px',
            padding: '24px'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--card-border)', paddingBottom: '10px' }}>
            <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)' }}>
              Shortfall Deficiency Report & Clarification Letter
            </div>
            <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => setShortfallData(null)}>
              Dismiss Report
            </button>
          </div>

          <div className="output-stream-card" style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '6px', borderRadius: '8px' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', color: '#CA8A04', fontSize: '13px', fontWeight: '700' }}>
              <Mail size={16} /> Shortfall Deficiency Analysis
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '12px', color: 'var(--text-secondary)' }}>
              <div>Missing Documents: <strong style={{ color: '#CA8A04' }}>{shortfallData.missing_documents?.length || 0}</strong></div>
              <div>Missing Clauses: <strong style={{ color: '#CA8A04' }}>{shortfallData.missing_clauses?.length || 0}</strong></div>
            </div>
          </div>

          <div>
            <span className="badge" style={{ background: 'rgba(234, 179, 8, 0.1)', color: '#CA8A04', borderColor: 'rgba(234, 179, 8, 0.25)', borderWidth: '1px', borderStyle: 'solid' }}>AI-Generated Clarification dispatch</span>
            <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
              <FlowConnector />
              <div className="output-stream-card" style={{ 
                flex: 1, 
                borderRadius: '6px', 
                padding: '14px', 
                fontFamily: 'monospace', 
                fontSize: '12px', 
                color: 'var(--text-secondary)',
                lineHeight: '1.5'
              }}>
                {(() => {
                  const text = shortfallData.clarification_request || "";
                  const lines = text.split("\n");
                  const firstLine = lines[0] ? lines[0].trim() : "";
                  if (firstLine && (firstLine.toUpperCase().includes("CLARIFICATION") || firstLine.toUpperCase().includes("REQUEST"))) {
                    const bodyText = lines.slice(1).join("\n").trim();
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ textAlign: 'center', fontWeight: '700', fontSize: '13px', borderBottom: '1px solid var(--card-border)', paddingBottom: '8px', color: 'var(--text-primary)', letterSpacing: '0.05em' }}>
                          {firstLine}
                        </div>
                        <StreamText text={bodyText} speed={8} />
                      </div>
                    );
                  }
                  return <StreamText text={text} speed={8} />;
                })()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TechnicalWorkspace;
