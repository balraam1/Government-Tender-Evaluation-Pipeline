import React, { useState, useEffect } from 'react';
import { Award, FileText, CheckCircle2, AlertTriangle, ShieldCheck, Mail, Send, FileDown } from 'lucide-react';
import html2pdf from 'html2pdf.js';
import { marked } from 'marked';
import api from '../services/api';
import StreamText from './StreamText';
import FlowConnector from './FlowConnector';
import ActiveTenderBadge from './ActiveTenderBadge';

export const TechnicalWorkspace = ({ activeTenderId }) => {
  const [vendors, setVendors] = useState([]);
  const [selectedVendorId, setSelectedVendorId] = useState('');
  const [bidText, setBidText] = useState('');
  const [evaluating, setEvaluating] = useState(false);
  const [latestEval, setLatestEval] = useState(null);
  const [techResults, setTechResults] = useState([]);
  const [showTechHistory, setShowTechHistory] = useState(false);
  const [downloading, setDownloading] = useState(false);

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

  useEffect(() => {
    if (activeTenderId) {
      loadTechResults();
    } else {
      setTechResults([]);
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

  async function loadTechResults() {
    try {
      const data = await api.getTechnicalResults(activeTenderId);
      setTechResults(data);
    } catch (err) {
      console.error("Error loading tech results:", err);
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
      loadTechResults(); // Refresh history
    } catch (err) {
      alert(`Technical Evaluation Failed: ${err.message}`);
    } finally {
      setEvaluating(false);
    }
  }

  async function handleDownloadTechPDF(evalData) {
    if (!evalData) return;
    setDownloading(evalData.evaluation_id);
    try {
      const container = document.createElement('div');
      container.style.padding = '30px';
      container.style.fontFamily = 'system-ui, -apple-system, sans-serif';
      container.style.color = '#1e293b';

      const vendor = vendors.find(v => v.id === evalData.vendor_id);
      const vName = vendor ? vendor.vendor_name : `Vendor ID: ${evalData.vendor_id}`;
      
      const isQualified = evalData.qualification_status === 'QUALIFIED';
      const statusHtml = isQualified 
        ? `<span style="color: #10b981; font-weight: bold;">QUALIFIED</span>` 
        : `<span style="color: #ef4444; font-weight: bold;">FAILED</span>`;

      let matrixRows = (evalData.compliance_matrix || []).map((row, idx) => {
        let cColor = row.compliance === 'COMPLIANT' ? '#10b981' : row.compliance === 'PARTIAL' ? '#f59e0b' : '#ef4444';
        return `
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 8px 4px; color: #64748b;">${idx + 1}</td>
            <td style="padding: 8px 4px;">
              <div style="font-weight: 500;">${row.parameter_name}</div>
              <div style="font-size: 11px; color: #64748b; margin-top: 2px;">${row.remarks}</div>
            </td>
            <td style="padding: 8px 4px; text-align: center; font-weight: 600;">${row.scored}</td>
            <td style="padding: 8px 4px; text-align: center; color: ${cColor}; font-weight: 600;">${row.compliance}</td>
          </tr>
        `;
      }).join('');

      let shortfallHtml = '';
      if (evalData.shortfalls && evalData.shortfalls.length > 0) {
        shortfallHtml = `
          <div style="margin-top: 15px; padding: 15px; background: #fffbeb; border: 1px solid #fcd34d; border-radius: 6px;">
            <div style="color: #d97706; font-weight: bold; margin-bottom: 8px;">Shortfall Deficiencies Detected:</div>
            <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #92400e;">
              ${evalData.shortfalls.map(sf => `<li style="margin-bottom: 4px;">${sf}</li>`).join('')}
            </ul>
          </div>
        `;
      }

      let resultsHtml = `
      <div style="margin-bottom: 30px; padding-bottom: 25px; border-bottom: 1px solid #cbd5e1; break-inside: avoid;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <div style="font-weight: 600; color: #0f172a; font-size: 16px;">${vName}</div>
          <div style="font-size: 14px;">Overall Status: ${statusHtml}</div>
        </div>
        
        <div style="font-size: 13px; color: #475569; margin-bottom: 15px;">
          <strong>Score:</strong> ${evalData.score} / ${evalData.max_score} (${evalData.percentage}%)
        </div>

        <table style="width: 100%; border-collapse: collapse; font-size: 12px; text-align: left; margin-bottom: 15px;">
          <thead>
            <tr style="border-bottom: 2px solid #cbd5e1; color: #475569;">
              <th style="padding: 8px 4px; width: 5%;">S.No</th>
              <th style="padding: 8px 4px; width: 65%;">Evaluation Parameter</th>
              <th style="padding: 8px 4px; text-align: center; width: 10%;">Score</th>
              <th style="padding: 8px 4px; text-align: center; width: 20%;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${matrixRows}
          </tbody>
        </table>
        
        ${shortfallHtml}
      </div>
    `;

      container.innerHTML = `
        <div style="margin-bottom: 25px; border-bottom: 2px solid #ddd; padding-bottom: 15px;">
          <h1 style="font-size: 20px; color: #0f172a; margin-bottom: 8px;">Technical Evaluation Report</h1>
          <div style="font-size: 14px; color: #64748b;">
            <strong>Tender Reference:</strong> ${activeTenderId || 'N/A'}<br/>
            <strong>Date Evaluated:</strong> ${new Date(evalData.created_at).toLocaleString()}
          </div>
        </div>
        <div>
          ${resultsHtml}
        </div>
      `;

      const opt = {
        margin:       10,
        filename:     `${activeTenderId || 'Tender'}_${vName.replace(/\\s+/g, '_')}_Technical.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2 },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };

      await html2pdf().set(opt).from(container).save();
    } catch (err) {
      console.error("PDF generation failed:", err);
      alert("Failed to generate PDF");
    } finally {
      setDownloading(false);
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
      <ActiveTenderBadge activeTenderId={activeTenderId} />
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
                        <div style={{ color: 'var(--color-success)', fontWeight: '500' }}>
                          <StreamText text={bodyText} speed={8} />
                        </div>
                      </div>
                    );
                  }
                  return <div style={{ color: 'var(--color-success)', fontWeight: '500' }}><StreamText text={text} speed={8} /></div>;
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* History Button */}
      <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'center', marginTop: '16px', marginBottom: '32px' }}>
        <button 
          className="btn-primary" 
          onClick={() => setShowTechHistory(true)}
          disabled={!activeTenderId || techResults.length === 0}
          style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--card-border)', padding: '10px 24px' }}
        >
          <FileText size={16} style={{ marginRight: '8px' }} />
          View Technical Evaluation History
        </button>
      </div>

      {/* History Modal */}
      {showTechHistory && (
        <div 
          style={{
            position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', 
            backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 9999, 
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            backdropFilter: 'blur(5px)'
          }}
          onClick={() => setShowTechHistory(false)}
        >
          <div 
            style={{
              backgroundColor: 'var(--bg-secondary)', padding: '24px', borderRadius: '16px',
              width: '90%', maxWidth: '1100px', maxHeight: '85vh', overflowY: 'auto',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)', border: '1px solid var(--card-border)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid var(--card-border)', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <FileText size={22} style={{ color: 'var(--color-primary)' }} />
                <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--text-primary)', margin: 0 }}>Technical Evaluation & Shortfall History</h2>
              </div>
              <button onClick={() => setShowTechHistory(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <span style={{ fontSize: '24px', lineHeight: '1' }}>&times;</span>
              </button>
            </div>

            {techResults.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px' }}>No Technical history found for this tender.</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(450px, 1fr))', gap: '24px', alignItems: 'start' }}>
                {techResults.map(evalData => {
                  const vendor = vendors.find(v => v.id === evalData.vendor_id);
                  return (
                    <div key={evalData.evaluation_id} style={{ 
                      backgroundColor: 'rgba(59, 130, 246, 0.05)', // Light blue tint for Tech Eval
                      border: '1px solid rgba(59, 130, 246, 0.2)',
                      borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                    }}>
                      <div style={{ borderBottom: '1px solid rgba(59, 130, 246, 0.15)', paddingBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontSize: '11px', color: 'var(--color-primary)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                            Evaluated Vendor
                          </div>
                          <div style={{ fontWeight: 'bold', fontSize: '16px', color: 'var(--text-primary)' }}>
                            {vendor ? vendor.vendor_name : `Vendor ID: ${evalData.vendor_id}`}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                            Evaluated at: {new Date(evalData.created_at).toLocaleString()}
                          </div>
                        </div>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleDownloadTechPDF(evalData); }}
                          disabled={downloading === evalData.evaluation_id}
                          style={{ 
                            background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', 
                            color: 'var(--color-primary)', padding: '6px', borderRadius: '6px', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                          }}
                          title="Download PDF"
                        >
                          <FileDown size={16} />
                        </button>
                      </div>
                      
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', backgroundColor: 'rgba(0,0,0,0.15)', borderRadius: '8px' }}>
                        <div>
                          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block' }}>Score: {evalData.score} / {evalData.max_score} ({evalData.percentage}%)</span>
                          <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>Overall Qualification</span>
                        </div>
                        {evalData.qualification_status === 'QUALIFIED' ? (
                          <span style={{ color: 'var(--color-success)', fontWeight: 'bold', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '4px' }}><ShieldCheck size={16} /> QUALIFIED</span>
                        ) : (
                          <span style={{ color: 'var(--color-danger)', fontWeight: 'bold', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '4px' }}><AlertTriangle size={16} /> FAILED</span>
                        )}
                      </div>

                      {/* Mini Scorecard Table */}
                      <div style={{ fontSize: '12px', backgroundColor: 'rgba(0,0,0,0.1)', padding: '12px', borderRadius: '8px' }}>
                        <div style={{ fontWeight: '600', marginBottom: '8px', color: 'var(--text-secondary)' }}>Evaluation Reports Pane History</div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid var(--overlay-border)', color: 'var(--text-muted)' }}>
                              <th style={{ textAlign: 'left', paddingBottom: '4px' }}>Parameter</th>
                              <th style={{ textAlign: 'center', paddingBottom: '4px' }}>Score</th>
                              <th style={{ textAlign: 'center', paddingBottom: '4px' }}>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {evalData.compliance_matrix?.map((row, idx) => (
                              <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                <td style={{ padding: '6px 0', color: 'var(--text-primary)' }}>{row.parameter_name}</td>
                                <td style={{ padding: '6px 0', textAlign: 'center', fontWeight: '600' }}>{row.scored}</td>
                                <td style={{ padding: '6px 0', textAlign: 'center', color: row.compliance === 'COMPLIANT' ? 'var(--color-success)' : row.compliance === 'PARTIAL' ? 'var(--color-warning)' : 'var(--color-danger)' }}>
                                  {row.compliance === 'COMPLIANT' ? 'Qualified' : row.compliance === 'PARTIAL' ? 'Partial' : 'Fail'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Shortfall Clarification Letter */}
                      <div style={{ fontSize: '12px' }}>
                        <div style={{ fontWeight: '600', marginBottom: '6px', color: '#CA8A04' }}>Shortfall Deficiency Report & Clarification Letter</div>
                        <div style={{ color: 'var(--color-success)', backgroundColor: 'rgba(0,0,0,0.15)', padding: '12px', borderRadius: '8px', lineHeight: '1.5', fontFamily: 'monospace', fontSize: '11px' }}>
                          {evalData.shortfalls && evalData.shortfalls.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              <div style={{ textAlign: 'center', fontWeight: '800', color: 'var(--text-primary)', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '6px', marginBottom: '4px' }}>
                                CLARIFICATION / SHORTFALL SUBMISSION REQUEST
                              </div>
                              <span style={{ color: 'var(--text-primary)' }}>Dear Bidder,</span>
                              <span>During the technical evaluation of your proposal, the MPSEDC Evaluation Committee identified certain deficiencies/shortfalls in your submission.</span>
                              <span>You are requested to submit/clarify the following missing items within 48 hours to ensure compliance:</span>
                              <ol style={{ margin: '4px 0', paddingLeft: '24px' }}>
                                {evalData.shortfalls.map((sf, idx) => (
                                  <li key={idx}>{sf}</li>
                                ))}
                              </ol>
                              <span>Please submit the required documents through the portal or via email within 48 hours. Failure to comply may lead to rejection of your bid.</span>
                              <span style={{ color: 'var(--text-primary)', marginTop: '8px' }}>Sincerely,<br/>Evaluation Committee, MPSEDC</span>
                            </div>
                          ) : (
                            <span style={{ color: 'var(--color-success)' }}>No shortfalls detected. Bid submission is fully compliant.</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TechnicalWorkspace;
