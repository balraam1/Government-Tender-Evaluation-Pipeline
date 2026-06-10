import React, { useState, useEffect } from 'react';
import { Send, MessageSquare, AlertCircle, Eye, X, Plus, FileDown } from 'lucide-react';
import html2pdf from 'html2pdf.js';
import { marked } from 'marked';
import api from '../services/api';
import StreamText from './StreamText';
import FlowConnector from './FlowConnector';
import ActiveTenderBadge from './ActiveTenderBadge';

export const PreBidWorkspace = ({ activeTenderId }) => {
  const [queries, setQueries] = useState([]);
  const [vendorName, setVendorName] = useState('');
  const [queryText, setQueryText] = useState('');
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [selectedQuery, setSelectedQuery] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [vendors, setVendors] = useState([]);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (activeTenderId) {
      loadQueries();
    }
    loadVendors();
  }, [activeTenderId]);

  async function loadVendors() {
    try {
      const data = await api.listVendors();
      setVendors(data);
      if (data && data.length > 0 && !vendorName) {
        setVendorName(data[0].vendor_name || data[0].name);
      }
    } catch (err) {
      console.error("Error loading vendors:", err);
    }
  }

  async function loadQueries() {
    setLoading(true);
    try {
      const data = await api.getPreBidQueries(activeTenderId);
      setQueries(data);
    } catch (err) {
      console.error("Error loading prebid queries:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!activeTenderId) {
      alert("Please select or create an active tender in Module 1 first.");
      return;
    }
    setAnalyzing(true);
    setSelectedQuery(null);
    setDrawerOpen(true); // Open drawer to show analyzing state
    try {
      const result = await api.analyzePreBidQuery({
        tender_id: activeTenderId,
        vendor_name: vendorName,
        query_text: queryText
      });
      // Map result keys to fit selected query rendering
      setSelectedQuery({
        vendor_name: vendorName,
        query_text: result.query_text,
        relevant_clause: result.relevant_clause,
        draft_response: result.draft_response,
        corrigendum_draft: result.corrigendum_draft,
        isNew: true
      });
      setQueryText('');
      // setVendorName(''); // Do not reset vendorName to empty string since it is a dropdown
      loadQueries();
    } catch (err) {
      alert(`Query Analysis Failed: ${err.message}`);
      setDrawerOpen(false);
    } finally {
      setAnalyzing(false);
    }
  }

  const handleOpenQueryDetails = (q) => {
    setSelectedQuery(q);
    setDrawerOpen(true);
  };

  async function handleDownloadQueryPDF() {
    if (!queries || queries.length === 0) return;
    setDownloading(true);
    try {
      const container = document.createElement('div');
      container.style.padding = '30px';
      container.style.fontFamily = 'system-ui, -apple-system, sans-serif';
      container.style.color = '#1e293b';

      let queriesHtml = queries.map((q, i) => `
        <div style="margin-bottom: 25px; padding-bottom: 20px; border-bottom: 1px solid #e2e8f0; break-inside: avoid;">
          <div style="font-weight: 600; color: #0f172a; margin-bottom: 8px;">
            Q${i + 1}: ${q.vendor_name || 'Vendor'}
            <span style="color: #64748b; font-weight: normal; font-size: 12px; margin-left: 10px;">
              ${new Date(q.created_at || Date.now()).toLocaleDateString()}
            </span>
          </div>
          <div style="font-size: 14px; color: #334155; margin-bottom: 15px; padding: 12px; background: #f8fafc; border-radius: 6px; border: 1px solid #e2e8f0;">
            <strong>Query:</strong> ${q.query_text}
          </div>
          <div style="font-size: 14px; color: #334155;">
            <strong>AI Analysis:</strong>
            <div style="margin-top: 8px; line-height: 1.5;">
              ${marked.parse(q.ai_analysis || 'No analysis available.')}
            </div>
          </div>
        </div>
      `).join('');

      container.innerHTML = `
        <div style="margin-bottom: 25px; border-bottom: 2px solid #ddd; padding-bottom: 15px;">
          <h1 style="font-size: 20px; color: #0f172a; margin-bottom: 8px;">Pre-Bid Query Registry & Analysis</h1>
          <div style="font-size: 14px; color: #64748b;">
            <strong>Tender Reference:</strong> ${activeTenderId || 'N/A'}<br/>
            <strong>Total Queries:</strong> ${queries.length}
          </div>
        </div>
        <div>
          ${queriesHtml}
        </div>
      `;

      const opt = {
        margin:       10,
        filename:     `${activeTenderId || 'Tender'}_PreBid_Queries.pdf`,
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

  return (
    <div className="panel-grid" style={{ overflow: 'hidden', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Wrapper starts from top — no spacer */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, paddingTop: '20px' }}>
      <ActiveTenderBadge activeTenderId={activeTenderId} />
      <div style={{ display: 'grid', gap: '20px', flex: 1 }} className="panel-grid-2">
        {/* Left Card: Input Form */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignSelf: 'center' }}>
          <h2 style={{ fontSize: '15px', fontWeight: '700', borderBottom: '1px solid var(--card-border)', paddingBottom: '10px' }}>
            Submit Vendor Clarification Request
          </h2>

          {!activeTenderId ? (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <AlertCircle size={24} style={{ margin: '0 auto 8px auto', color: 'var(--color-warning)' }} />
              Select an active tender in Module 1 to register queries.
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600' }}>Vendor / Bidder Name</label>
                <select 
                  required
                  className="glass-input" 
                  style={{ marginTop: '6px' }}
                  value={vendorName}
                  onChange={e => setVendorName(e.target.value)}
                >
                  <option value="" disabled>Select a vendor...</option>
                  {vendors.map(v => (
                    <option key={v.id} value={v.vendor_name || v.name}>
                      {v.vendor_name || v.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600' }}>Query Description</label>
                <textarea 
                  required
                  rows={4}
                  placeholder="e.g. Requesting relaxation in the annual turnover criteria from 50 Lakhs to 40 Lakhs..."
                  className="glass-input" 
                  style={{ marginTop: '6px', resize: 'none' }}
                  value={queryText}
                  onChange={e => setQueryText(e.target.value)}
                />
              </div>

              <button 
                type="submit" 
                className="btn-primary" 
                style={{ justifyContent: 'center' }}
                disabled={analyzing}
              >
                <Send size={16} />
                {analyzing ? 'Analyzing against RFP...' : 'Analyze Query'}
              </button>
            </form>
          )}
        </div>

        {/* Right Card: Table Registry List */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--card-border)', paddingBottom: '10px' }}>
            <h2 style={{ fontSize: '15px', fontWeight: '700' }}>
              Query Registry Logs
            </h2>
            {queries.length > 0 && activeTenderId && (
              <button 
                className="btn-secondary" 
                style={{ padding: '6px 12px', fontSize: '12px' }}
                onClick={handleDownloadQueryPDF}
                disabled={downloading}
              >
                <FileDown size={14} style={{ marginRight: '6px' }} />
                {downloading ? 'Generating PDF...' : 'Download PDF'}
              </button>
            )}
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {queries.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {queries.map(q => (
                  <div 
                    key={q.id} 
                    className="output-stream-card" 
                    style={{ 
                      padding: '14px', 
                      borderRadius: '8px',
                      display: 'flex', 
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      cursor: 'pointer'
                    }}
                    onClick={() => handleOpenQueryDetails(q)}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, paddingRight: '12px' }}>
                      <div style={{ display: 'flex', gap: '8px', fontSize: '11px' }}>
                        <strong style={{ color: 'var(--text-primary)' }}>{q.vendor_name}</strong>
                        <span style={{ color: 'var(--text-muted)' }}>•</span>
                        <span style={{ color: 'var(--text-muted)' }}>{new Date(q.created_at || Date.now()).toLocaleDateString()}</span>
                      </div>
                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '300px' }}>
                        "{q.query_text}"
                      </p>
                    </div>
                    <button className="btn-secondary" style={{ padding: '6px 10px', fontSize: '11px', gap: '4px' }}>
                      <Eye size={12} /> View AI Draft
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
                No pre-bid queries filed for this tender yet.
              </div>
            )}
          </div>
        </div>
      </div>
      </div>

      {/* Drawer Overlay */}
      <div 
        className={`drawer-overlay ${drawerOpen ? 'open' : ''}`}
        onClick={() => setDrawerOpen(false)}
      />

      {/* Slide-out Drawer Panel */}
      <div className={`side-drawer ${drawerOpen ? 'open' : ''}`}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--card-border)', paddingBottom: '14px' }}>
          <div style={{ flex: 1 }}>
            <span className="badge badge-info" style={{ fontSize: '9px' }}>Vendor / Bidder Name</span>
            <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
              <FlowConnector />
              <div className="output-stream-card" style={{ flex: 1, padding: '10px', borderRadius: '6px', fontSize: '13px', fontWeight: '700' }}>
                {analyzing ? 'Processing...' : selectedQuery?.vendor_name}
              </div>
            </div>
          </div>
          <button 
            onClick={() => setDrawerOpen(false)}
            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', alignSelf: 'flex-start' }}
          >
            <X size={20} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px', paddingRight: '4px' }}>
          {analyzing ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '12px' }}>
              <div className="terminal-cursor" style={{ width: '10px', height: '18px' }}></div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Consulting database indexes for matching clauses...</div>
            </div>
          ) : (
            selectedQuery && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <span className="badge badge-info" style={{ fontSize: '9px' }}>Vendor Query</span>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                    <FlowConnector />
                    <div className="output-stream-card" style={{ flex: 1, padding: '10px', borderRadius: '6px', fontSize: '12px', fontStyle: 'italic', fontWeight: '700', lineHeight: '1.5' }}>
                      "{selectedQuery.query_text}"
                    </div>
                  </div>
                </div>

                <div>
                  <span className="badge badge-info" style={{ fontSize: '9px' }}>Relevant RFP Clause</span>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                    <FlowConnector />
                    <div className="output-stream-card" style={{ padding: '10px', borderRadius: '6px', flex: 1, fontSize: '12px', lineHeight: '1.4' }}>
                      <StreamText text={selectedQuery.relevant_clause} speed={10} simulate={selectedQuery.isNew} />
                    </div>
                  </div>
                </div>

                <div>
                  <span className="badge badge-success" style={{ fontSize: '9px' }}>AI Official Response</span>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                    <FlowConnector />
                    <div className="output-stream-card" style={{ flex: 1, padding: '12px', fontSize: '12px', borderRadius: '6px', lineHeight: '1.4' }}>
                      <StreamText text={selectedQuery.draft_response} speed={6} simulate={selectedQuery.isNew} />
                    </div>
                  </div>
                </div>

                {selectedQuery.corrigendum_draft && (
                  <div>
                    <span className="badge badge-warning" style={{ fontSize: '9px' }}>Draft Corrigendum</span>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                      <FlowConnector />
                      <div className="glass-card" style={{ flex: 1, padding: '10px', fontSize: '11px', background: 'rgba(180, 83, 9, 0.02)', border: '1px dashed rgba(180, 83, 9, 0.25)', fontFamily: 'monospace' }}>
                        <StreamText text={selectedQuery.corrigendum_draft} speed={5} simulate={selectedQuery.isNew} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
};

export default PreBidWorkspace;
