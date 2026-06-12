import React, { useState, useEffect } from 'react';
import { DollarSign, FileText, CheckCircle2, TrendingDown, Award, Play, Plus, Trash2, FileDown, List, X } from 'lucide-react';
import html2pdf from 'html2pdf.js';
import { marked } from 'marked';
import api from '../services/api';
import StreamText from './StreamText';
import FlowConnector from './FlowConnector';
import ActiveTenderBadge from './ActiveTenderBadge';
function formatFinancialReport(text) {
  if (!text) return '';
  let processed = text;
  
  // 1. Bold and center align "FINANCIAL EVALUATION REPORT"
  processed = processed.replace(/<div style="text-align: center; font-weight: bold; margin-bottom: 12px;">FINANCIAL EVALUATION REPORT<\/div>/g, 'FINANCIAL EVALUATION REPORT');
  processed = processed.replace(/\*\*FINANCIAL EVALUATION REPORT\*\*/g, 'FINANCIAL EVALUATION REPORT');
  
  processed = processed.replace(
    /(?:^|\n)(FINANCIAL EVALUATION REPORT)(?:\n|$)/g,
    '\n<div style="text-align: center; font-weight: bold; margin-bottom: 12px;">FINANCIAL EVALUATION REPORT</div>\n'
  );
  
  // 2. Bold "Summary of Findings:"
  processed = processed.replace(/\*\*Summary of Findings:\*\*/g, 'Summary of Findings:');
  processed = processed.replace(
    /(Summary of Findings:)/g,
    '**Summary of Findings:**'
  );
  
  return processed;
}

export const FinancialWorkspace = ({ activeTenderId }) => {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [finData, setFinData] = useState(null);
  
  // Award recommendation states
  const [recommending, setRecommending] = useState(false);
  const [recommendation, setRecommendation] = useState(null);

  // Dynamic bid list
  const [bids, setBids] = useState([]);
  const [selectedVendorId, setSelectedVendorId] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [finResults, setFinResults] = useState([]);
  const [showFinHistory, setShowFinHistory] = useState(false);

  useEffect(() => {
    loadVendors();
  }, [activeTenderId]);

  useEffect(() => {
    if (activeTenderId) {
      loadFinancialHistory();
    } else {
      setFinResults([]);
    }
  }, [activeTenderId]);

  async function loadFinancialHistory() {
    try {
      const data = await api.getFinancialResults(activeTenderId);
      setFinResults(data || []);
    } catch (err) {
      console.error("Error loading financial history:", err);
    }
  }

  async function loadVendors() {
    try {
      const allVendors = await api.listVendors();
      if (!activeTenderId) {
        setVendors([]);
        return;
      }
      
      // Strict Funnel Logic: Fetch Tech results and only allow QUALIFIED
      const techResults = await api.getTechnicalResults(activeTenderId).catch(() => []);
      const qualifiedVendorIds = techResults
        .filter(r => r.qualification_status === 'QUALIFIED')
        .map(r => r.vendor_id);
        
      const qualifiedVendors = allVendors.filter(v => qualifiedVendorIds.includes(v.id));
      setVendors(qualifiedVendors);
    } catch (err) {
      console.error("Error loading vendors:", err);
    }
  }

  const handleAddVendorBid = async () => {
    if (!selectedVendorId) return;
    const vendor = vendors.find(v => v.id.toString() === selectedVendorId);
    if (!vendor) return;
    
    // Check if already added
    if (bids.some(b => b.vendor_id === vendor.id)) return;

    let autoPrice = 0;
    try {
      const docs = await api.getDocumentHistory(activeTenderId).catch(() => []);
      const finDoc = docs.find(d => d.vendor_id === vendor.id && d.document_type === 'VENDOR_FINANCIAL');
      if (finDoc) {
        const fullDoc = await api.getDocument(finDoc.id);
        if (fullDoc && fullDoc.metadata && fullDoc.metadata.quoted_price) {
          autoPrice = parseFloat(fullDoc.metadata.quoted_price.toString().replace(/[^\d.]/g, '')) || 0;
        }
      }
    } catch (err) {
      console.error("Error auto-fetching financial price:", err);
    }

    setBids(prev => [...prev, {
      vendor_id: vendor.id,
      vendor_name: vendor.vendor_name,
      total_amount: autoPrice
    }]);
    setSelectedVendorId('');
  };

  const handleRemoveBid = (index) => {
    setBids(prev => prev.filter((_, i) => i !== index));
  };

  async function handleFinancialEval() {
    if (!activeTenderId) {
      alert("Select active tender in Module 1 first.");
      return;
    }
    setEvaluating(true);
    setFinData(null);
    setRecommendation(null);
    try {
      const result = await api.evaluateFinancial({
        tender_id: activeTenderId,
        bids: bids
      });
      setFinData(result);
      loadFinancialHistory();
    } catch (err) {
      alert(`Financial Evaluation Failed: ${err.message}`);
    } finally {
      setEvaluating(false);
    }
  }

  async function handleGenerateRecommendation() {
    if (!activeTenderId) return;
    setRecommending(true);
    setRecommendation(null);
    try {
      // Simulate calling final award recommendation endpoint
      const result = await api.generateRecommendation(activeTenderId);
      setRecommendation(result);
    } catch (err) {
      alert(`Award Recommendation Failed: ${err.message}`);
    } finally {
      setRecommending(false);
    }
  }

  async function handleDownloadRunPDF(runTimestamp, runData) {
    if (!runData || runData.length === 0) return;
    setDownloading(runTimestamp);
    try {
      const container = document.createElement('div');
      container.style.padding = '30px';
      container.style.fontFamily = 'system-ui, -apple-system, sans-serif';
      container.style.color = '#1e293b';

      let rankingsHtml = runData.map(evalData => {
        const vendor = vendors.find(v => v.id === evalData.vendor_id);
        const vName = vendor ? vendor.vendor_name : `Vendor ID: ${evalData.vendor_id}`;
        return `
          <div style="margin-bottom: 12px; padding: 12px; border: 1px solid #e2e8f0; border-radius: 6px; background: #f8fafc; break-inside: avoid;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <div style="display: flex; gap: 10px; align-items: center;">
                <span style="background: #1e293b; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: bold;">${evalData.ranking_label}</span>
                <span style="font-weight: 600; font-size: 14px;">${vName}</span>
              </div>
              <span style="font-weight: 600; font-size: 14px;">INR ${parseFloat(evalData.quoted_price).toLocaleString()}</span>
            </div>
            <div style="font-size: 12px; color: #475569; margin-top: 4px; border-top: 1px dashed #cbd5e1; padding-top: 4px;">
              ${evalData.remarks}
            </div>
          </div>
        `;
      }).join('');

      const sortedBids = runData.slice().sort((a, b) => a.ranking - b.ranking);
      const l1Data = sortedBids[0];
      const l1Name = vendors.find(v => v.id === l1Data.vendor_id)?.vendor_name || `Vendor ID: ${l1Data.vendor_id}`;

      let dynamicReport = `
<div style="text-align: center; font-weight: bold; margin-bottom: 12px;">FINANCIAL EVALUATION REPORT</div>

Tender: ${activeTenderId || 'N/A'}

Total bids received: ${sortedBids.length}

**Financial Ranking Summary:**
${sortedBids.map(r => {
  const vName = vendors.find(v => v.id === r.vendor_id)?.vendor_name || `Vendor ID: ${r.vendor_id}`;
  return `  ${r.ranking_label}: ${vName} - INR ${parseFloat(r.quoted_price).toLocaleString()}`;
}).join('\n')}

The lowest (L1) bid is from ${l1Name} at INR ${parseFloat(l1Data.quoted_price).toLocaleString()}.

The Evaluation Committee recommends award to ${l1Name} being the L1 bidder, subject to compliance with all other terms and conditions.
      `.trim();
      
      container.innerHTML = `
        <div style="margin-bottom: 25px; border-bottom: 2px solid #ddd; padding-bottom: 15px;">
          <h1 style="font-size: 20px; color: #0f172a; margin-bottom: 8px;">Financial Evaluation Run Report</h1>
          <div style="font-size: 14px; color: #64748b;">
            <strong>Tender Reference:</strong> ${activeTenderId || 'N/A'}<br/>
            <strong>Run Date:</strong> ${new Date(runTimestamp).toLocaleString()}
          </div>
        </div>
        
        <div style="margin-bottom: 25px;">
          <h3 style="font-size: 15px; font-weight: 600; color: #0f172a; margin-bottom: 12px;">Bidder Rankings</h3>
          ${rankingsHtml}
        </div>

        <div style="margin-bottom: 20px; break-inside: avoid;">
          <h3 style="font-size: 15px; font-weight: 600; color: #0f172a; margin-bottom: 10px;">Evaluation Summary Report</h3>
          <div style="font-size: 13px; color: #334155; padding: 15px; background: #f8fafc; border-left: 3px solid #eab308; line-height: 1.6; font-family: monospace;">
            ${marked.parse(formatFinancialReport(dynamicReport))}
          </div>
        </div>
      `;

      const opt = {
        margin:       10,
        filename:     `${activeTenderId || 'Tender'}_Financial_Run_${new Date(runTimestamp).getTime()}.pdf`,
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

  async function handleDownloadBER() {
    if (!recommendation) return;
    setDownloading('ber');
    try {
      const container = document.createElement('div');
      container.style.padding = '40px';
      container.style.fontFamily = 'system-ui, -apple-system, sans-serif';
      container.style.color = '#1e293b';
      
      const { tender_details, bidders_summary, risk_assessment, award_report, recommended_vendor_name } = recommendation;
      
      let biddersHtml = (bidders_summary || []).map(b => `
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 10px;">${b.vendor_name}</td>
          <td style="padding: 10px;">${b.pq_status}</td>
          <td style="padding: 10px;">${b.tech_score > 0 ? b.tech_score + ' / 100' : 'N/A'}</td>
          <td style="padding: 10px;">${b.fin_rank}</td>
          <td style="padding: 10px;">${b.quoted_price ? 'INR ' + b.quoted_price.toLocaleString() : 'N/A'}</td>
        </tr>
      `).join('');

      container.innerHTML = `
        <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid #1e293b; padding-bottom: 20px;">
          <h1 style="font-size: 24px; font-weight: bold; margin: 0 0 10px 0; color: #0f172a;">BID EVALUATION REPORT (BER)</h1>
          <div style="font-size: 14px; color: #475569;">Government of Madhya Pradesh - MPSEDC</div>
        </div>
        
        <div style="margin-bottom: 30px;">
          <h2 style="font-size: 16px; font-weight: bold; background: #f8fafc; padding: 8px 12px; border-left: 4px solid #3b82f6; margin-bottom: 15px;">1. EXECUTIVE SUMMARY</h2>
          <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
            <tr><td style="padding: 6px 0; width: 30%;"><strong>Tender Reference:</strong></td><td>${tender_details?.tender_number || 'N/A'}</td></tr>
            <tr><td style="padding: 6px 0;"><strong>Tender Title:</strong></td><td>${tender_details?.title || 'N/A'}</td></tr>
            <tr><td style="padding: 6px 0;"><strong>Department:</strong></td><td>${tender_details?.department || 'N/A'}</td></tr>
            <tr><td style="padding: 6px 0;"><strong>Estimated Budget:</strong></td><td>INR ${tender_details?.budget?.toLocaleString() || 'N/A'}</td></tr>
            <tr><td style="padding: 6px 0;"><strong>Recommended Vendor:</strong></td><td><strong style="color: #0f766e;">${recommended_vendor_name}</strong></td></tr>
          </table>
        </div>

        <div style="margin-bottom: 30px;">
          <h2 style="font-size: 16px; font-weight: bold; background: #f8fafc; padding: 8px 12px; border-left: 4px solid #3b82f6; margin-bottom: 15px;">2. EVALUATION MATRIX SUMMARY</h2>
          <table style="width: 100%; font-size: 12px; border-collapse: collapse; text-align: left;">
            <thead>
              <tr style="background: #e2e8f0;">
                <th style="padding: 10px;">Bidder Name</th>
                <th style="padding: 10px;">PQ Status</th>
                <th style="padding: 10px;">Tech Score</th>
                <th style="padding: 10px;">Fin. Rank</th>
                <th style="padding: 10px;">Quoted Price</th>
              </tr>
            </thead>
            <tbody>
              ${biddersHtml}
            </tbody>
          </table>
        </div>

        <div style="margin-bottom: 30px; page-break-inside: avoid;">
          <h2 style="font-size: 16px; font-weight: bold; background: #f8fafc; padding: 8px 12px; border-left: 4px solid #eab308; margin-bottom: 15px;">3. AI JUSTIFICATION & RISK ASSESSMENT</h2>
          <div style="background: #fefce8; border: 1px solid #fef08a; padding: 15px; border-radius: 6px; font-size: 13px; line-height: 1.6; margin-bottom: 15px;">
            <strong>AI Recommendation Narrative:</strong><br/>
            ${marked.parse(award_report || '')}
          </div>
          <div style="background: #fefce8; border: 1px solid #fef08a; padding: 15px; border-radius: 6px; font-size: 13px; line-height: 1.6;">
            <strong>Compliance & Risk Check:</strong><br/>
            ${marked.parse(risk_assessment || 'No significant risks identified.')}
          </div>
        </div>

        <div style="margin-top: 50px; page-break-inside: avoid;">
          <h2 style="font-size: 16px; font-weight: bold; border-bottom: 1px solid #cbd5e1; padding-bottom: 10px; margin-bottom: 40px;">4. COMMITTEE APPROVAL</h2>
          <div style="display: flex; justify-content: space-between; text-align: center; margin-top: 60px;">
            <div style="width: 30%;">
              <div style="border-top: 1px solid #000; padding-top: 8px;">Prepared By<br/><span style="font-size: 11px; color: #64748b;">(Procurement Officer)</span></div>
            </div>
            <div style="width: 30%;">
              <div style="border-top: 1px solid #000; padding-top: 8px;">Reviewed By<br/><span style="font-size: 11px; color: #64748b;">(Technical Committee)</span></div>
            </div>
            <div style="width: 30%;">
              <div style="border-top: 1px solid #000; padding-top: 8px;">Approved By<br/><span style="font-size: 11px; color: #64748b;">(Chief General Manager)</span></div>
            </div>
          </div>
        </div>
      `;

      const opt = {
        margin:       15,
        filename:     `BER_${tender_details?.tender_number || 'Tender'}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2 },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };

      await html2pdf().set(opt).from(container).save();
    } catch (err) {
      console.error("BER PDF generation failed:", err);
      alert("Failed to generate BER PDF");
    } finally {
      setDownloading(false);
    }
  }

  const handleBidPriceChange = (index, value) => {
    setBids(prev => {
      const copy = [...prev];
      copy[index].total_amount = parseFloat(value) || 0;
      return copy;
    });
  };

  return (
    <div className="panel-grid panel-grid-2" style={{ gridAutoRows: 'max-content' }}>
      <ActiveTenderBadge activeTenderId={activeTenderId} />
      {/* Left Pane: Commercial Bid Entry Form */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center', justifyContent: 'center', height: '640px', width: '100%' }}>
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '540px', width: '100%', padding: '20px 24px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '600', borderBottom: '1px solid var(--card-border)', paddingBottom: '10px' }}>
            Commercial Bid Quotations Registry
          </h2>

          {!activeTenderId ? (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <TrendingDown size={24} style={{ margin: '0 auto 8px auto', color: 'var(--color-warning)' }} />
              Please select an active tender in Module 1 first.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <select 
                  className="glass-input" 
                  style={{ flex: 1, padding: '8px 12px' }}
                  value={selectedVendorId}
                  onChange={(e) => setSelectedVendorId(e.target.value)}
                >
                  <option value="">-- Select Vendor to Add --</option>
                  {vendors.filter(v => !bids.some(b => b.vendor_id === v.id)).map(v => (
                    <option key={v.id} value={v.id}>{v.vendor_name}</option>
                  ))}
                </select>
                <button 
                  className="btn-secondary" 
                  onClick={handleAddVendorBid}
                  disabled={!selectedVendorId}
                  style={{ padding: '8px 16px', display: 'flex', gap: '6px', alignItems: 'center' }}
                >
                  <Plus size={16} /> Add
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '700' }}>
                  {bids.length > 0 ? "Enter Bid prices (in INR):" : "No vendors added to evaluation."}
                </span>
                
                {bids.map((bid, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <div style={{ flex: 1, fontSize: '13px' }}>{bid.vendor_name}</div>
                    <input 
                      type="number" 
                      className="glass-input" 
                      style={{ width: '130px', padding: '6px 10px' }}
                      value={bid.total_amount || ''}
                      onChange={(e) => handleBidPriceChange(idx, e.target.value)}
                      placeholder="0"
                    />
                    <button 
                      onClick={() => handleRemoveBid(idx)}
                      style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', padding: '4px' }}
                      title="Remove Vendor"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>

              <button 
                className="btn-primary" 
                style={{ justifyContent: 'center' }} 
                disabled={evaluating || bids.length === 0}
                onClick={handleFinancialEval}
              >
                <Play size={16} />
                {evaluating ? 'Ranking bids and L1 normalization...' : 'Run Financial Ranker'}
              </button>

              {finData && (
                <button 
                  className="btn-primary" 
                  style={{ justifyContent: 'center' }} 
                  disabled={recommending}
                  onClick={handleGenerateRecommendation}
                >
                  <Award size={16} />
                  {recommending ? 'Compiling Multi-stage scores...' : 'Generate Award Recommendation'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right Pane: Ranks and award reports */}
      <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', overflow: 'hidden', alignSelf: 'center', justifySelf: 'center', maxWidth: '540px', width: '100%', height: '640px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: '600', borderBottom: '1px solid var(--card-border)', paddingBottom: '10px' }}>
          Commercial Rankings & Final Award
        </h2>

        {evaluating && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '12px' }}>
            <div className="terminal-cursor" style={{ width: '12px', height: '22px' }}></div>
            <div style={{ color: 'var(--text-secondary)' }}>AI Agent is normalizing prices and extracting L1 ranking...</div>
          </div>
        )}

        {!evaluating && !finData && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', textAlign: 'center' }}>
            Compare commercial bids on the left to see the L1 rankings<br/>and generate the final award recommendations.
          </div>
        )}

        {/* Financial Rankings Grid */}
        {!evaluating && finData && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto', flex: 1 }}>
            <div className="output-stream-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px', borderRadius: '8px' }}>
              <div>
                <span style={{ fontSize: '11px', color: '#000000', fontWeight: '400', display: 'block' }}>Lowest Bidder (L1)</span>
                <span style={{ fontSize: '15px', fontWeight: '400', color: '#000000' }}>{finData.l1_vendor}</span>
              </div>
              <div style={{ fontSize: '16px', fontWeight: '400', color: '#000000' }}>
                INR {finData.l1_amount.toLocaleString()}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <h3 style={{ fontSize: '13px', fontWeight: '500', color: '#000000' }}>Normalized Bid List</h3>
              
              {finData.rankings.map((rank, idx) => {
                const maxAmount = Math.max(...finData.rankings.map(r => parseFloat(r.total_amount)));
                const barWidth = (parseFloat(rank.total_amount) / maxAmount) * 100;
                return (
                  <div key={idx} className="output-stream-card" style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <span className="badge" style={{ minWidth: '40px', justifyContent: 'center', background: '#111111', color: '#ffffff', fontSize: '10px', fontWeight: '500' }}>{rank.label}</span>
                        <span style={{ fontWeight: '400', fontSize: '13px', color: '#000000' }}>{rank.vendor_name}</span>
                      </div>
                      <span style={{ color: '#000000', fontSize: '13px', fontWeight: '400' }}>
                        INR {parseFloat(rank.total_amount).toLocaleString()}
                      </span>
                    </div>
                    {/* Cost normalization progress bar */}
                    <div className="comparison-row">
                      <div className="comparison-bar-container" style={{ background: 'rgba(0, 0, 0, 0.08)' }}>
                        <div 
                          className="comparison-bar" 
                          style={{ width: `${barWidth}%`, background: '#111111' }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ borderTop: '1px solid var(--card-border)', paddingTop: '10px' }}>
              <span className="badge" style={{ background: 'rgba(234, 179, 8, 0.1)', color: '#000000', borderColor: 'rgba(234, 179, 8, 0.25)', borderWidth: '1px', borderStyle: 'solid', fontWeight: '700' }}>AI Financial normalization remarks</span>
              <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                <FlowConnector />
                <div className="output-stream-card" style={{ flex: 1, padding: '12px', borderRadius: '6px', fontSize: '12px', color: '#000000', lineHeight: '1.5', fontWeight: '400' }}>
                  <StreamText text={formatFinancialReport(finData.evaluation_report)} speed={10} markdown={true} />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Final Award Recommendation Report */}
      {!evaluating && recommendation && (
        <div className="glass-card" style={{ 
          gridColumn: 'span 2', 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '24px', 
          overflow: 'hidden', 
          alignSelf: 'center', 
          justifySelf: 'center', 
          maxWidth: '1100px', 
          width: '100%', 
          padding: '28px', 
          marginTop: '20px' 
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--card-border)', paddingBottom: '16px' }}>
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)', margin: 0, borderBottom: 'none' }}>
                Bid Evaluation Report (BER)
              </h2>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Comprehensive multi-stage tender evaluation summary.
              </div>
            </div>
            <button 
              className="btn-primary" 
              onClick={handleDownloadBER}
              disabled={downloading === 'ber'}
              style={{ background: 'var(--text-primary)', color: '#fff', border: 'none' }}
            >
              <FileDown size={16} />
              {downloading === 'ber' ? 'Generating...' : 'Download Full BER PDF'}
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
            {/* Executive Summary */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: 'var(--bg-primary)', padding: '16px', borderRadius: '8px', border: '1px solid var(--card-border)' }}>
              <div style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>Executive Summary</div>
              <div style={{ fontSize: '14px', display: 'grid', gridTemplateColumns: '120px 1fr', gap: '8px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Tender Ref:</span>
                <span style={{ fontWeight: '600' }}>{recommendation.tender_details?.tender_number || 'N/A'}</span>
                
                <span style={{ color: 'var(--text-secondary)' }}>Budget:</span>
                <span style={{ fontWeight: '600' }}>INR {recommendation.tender_details?.budget?.toLocaleString() || 'N/A'}</span>
                
                <span style={{ color: 'var(--text-secondary)' }}>Awarded To:</span>
                <span style={{ fontWeight: '700', color: 'var(--color-success)' }}>{recommendation.recommended_vendor_name}</span>
                
                <span style={{ color: 'var(--text-secondary)' }}>Winning Bid:</span>
                <span style={{ fontWeight: '600' }}>INR {recommendation.bidders_summary?.find(b => b.fin_rank === 'L1')?.quoted_price?.toLocaleString() || 'N/A'}</span>
              </div>
            </div>

            {/* Participation Matrix */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: 'var(--bg-primary)', padding: '16px', borderRadius: '8px', border: '1px solid var(--card-border)', gridColumn: '1 / -1' }}>
               <div style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>Evaluation Matrix</div>
               <div style={{ overflowX: 'auto' }}>
                 <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', fontSize: '13px' }}>
                   <thead>
                     <tr>
                       <th style={{ padding: '8px 12px', borderBottom: '1px solid var(--card-border)', color: 'var(--text-secondary)', fontWeight: '600' }}>Bidder Name</th>
                       <th style={{ padding: '8px 12px', borderBottom: '1px solid var(--card-border)', color: 'var(--text-secondary)', fontWeight: '600' }}>PQ Status</th>
                       <th style={{ padding: '8px 12px', borderBottom: '1px solid var(--card-border)', color: 'var(--text-secondary)', fontWeight: '600' }}>Tech Score</th>
                       <th style={{ padding: '8px 12px', borderBottom: '1px solid var(--card-border)', color: 'var(--text-secondary)', fontWeight: '600' }}>Fin. Rank</th>
                       <th style={{ padding: '8px 12px', borderBottom: '1px solid var(--card-border)', color: 'var(--text-secondary)', fontWeight: '600' }}>Quoted Price</th>
                     </tr>
                   </thead>
                   <tbody>
                     {(recommendation.bidders_summary || []).map((b, i) => (
                       <tr key={i} style={{ borderBottom: '1px solid var(--overlay-border)', background: b.fin_rank === 'L1' ? 'rgba(15, 118, 110, 0.05)' : 'transparent' }}>
                         <td style={{ padding: '10px 12px', fontWeight: b.fin_rank === 'L1' ? '600' : '400' }}>{b.vendor_name}</td>
                         <td style={{ padding: '10px 12px' }}>
                           <span className={b.pq_status === 'PASS' ? 'badge badge-success' : 'badge badge-danger'}>{b.pq_status}</span>
                         </td>
                         <td style={{ padding: '10px 12px' }}>{b.tech_score > 0 ? `${b.tech_score}/100` : '-'}</td>
                         <td style={{ padding: '10px 12px', fontWeight: '600' }}>{b.fin_rank}</td>
                         <td style={{ padding: '10px 12px' }}>{b.quoted_price ? `INR ${b.quoted_price.toLocaleString()}` : '-'}</td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
            </div>

            {/* AI Reports */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', gridColumn: '1 / -1' }}>
              <div>
                <span className="badge" style={{ background: 'rgba(234, 179, 8, 0.1)', color: '#000000', borderColor: 'rgba(234, 179, 8, 0.25)', borderWidth: '1px', borderStyle: 'solid', fontWeight: '700' }}>AI Award Recommendation Narrative</span>
                <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                  <FlowConnector />
                  <div className="output-stream-card" style={{ flex: 1, borderRadius: '6px', padding: '14px', fontFamily: 'monospace', fontSize: '13px', color: '#000000', lineHeight: '1.6', fontWeight: '400' }}>
                    <StreamText text={formatFinancialReport(recommendation.award_report)} speed={6} markdown={true} />
                  </div>
                </div>
              </div>

              <div>
                <span className="badge" style={{ background: 'rgba(234, 179, 8, 0.1)', color: '#000000', borderColor: 'rgba(234, 179, 8, 0.25)', borderWidth: '1px', borderStyle: 'solid', fontWeight: '700' }}>AI Compliance & Risk Assessment</span>
                <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                  <FlowConnector />
                  <div className="output-stream-card" style={{ flex: 1, borderRadius: '6px', padding: '14px', fontFamily: 'monospace', fontSize: '13px', color: '#000000', lineHeight: '1.6', fontWeight: '400' }}>
                    <StreamText text={recommendation.risk_assessment || 'No significant risks identified.'} speed={6} markdown={true} />
                  </div>
                </div>
              </div>
            </div>

            <button className="btn-secondary" style={{ alignSelf: 'flex-start', marginTop: '10px' }} onClick={() => setRecommendation(null)}>
              Close Report
            </button>
          </div>
        </div>
      )}

      {/* History Button */}
      <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'center', marginTop: '16px', marginBottom: '32px' }}>
        <button 
          className="btn-primary" 
          onClick={() => setShowFinHistory(true)}
          disabled={!activeTenderId || finResults.length === 0}
          style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--card-border)', padding: '10px 24px' }}
        >
          <List size={16} style={{ marginRight: '8px' }} />
          View Financial Evaluation History
        </button>
      </div>

      {/* History Modal */}
      {showFinHistory && (() => {
        // Group history by created_at timestamp to form "Runs"
        const historyRuns = finResults.reduce((acc, curr) => {
          const key = curr.created_at || 'unknown';
          if (!acc[key]) acc[key] = [];
          acc[key].push(curr);
          return acc;
        }, {});
        
        // Sort runs from newest to oldest
        const sortedRuns = Object.entries(historyRuns).sort((a, b) => new Date(b[0]) - new Date(a[0]));

        return (
          <div 
            style={{
              position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', 
              backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 9999, 
              display: 'flex', justifyContent: 'center', alignItems: 'center',
              backdropFilter: 'blur(5px)'
            }}
            onClick={() => setShowFinHistory(false)}
          >
            <div 
              style={{
                backgroundColor: 'var(--bg-secondary)', padding: '24px', borderRadius: '16px',
                width: '90%', maxWidth: '1000px', maxHeight: '85vh', overflowY: 'auto',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)', border: '1px solid var(--card-border)'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid var(--card-border)', paddingBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <DollarSign size={22} style={{ color: 'var(--color-primary)' }} />
                  <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--text-primary)', margin: 0 }}>Financial Evaluation History</h2>
                </div>
                <button onClick={() => setShowFinHistory(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                  <X size={24} />
                </button>
              </div>

              {sortedRuns.length === 0 ? (
                <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px' }}>No Financial history found for this tender.</p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '20px' }}>
                  {sortedRuns.map(([timestamp, runData]) => {
                    return (
                      <div key={timestamp} style={{ 
                        backgroundColor: 'rgba(16, 185, 129, 0.05)', // Green tint
                        border: '1px solid rgba(16, 185, 129, 0.2)',
                        borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                        maxHeight: '400px',
                        overflowY: 'auto'
                      }}>
                        <div style={{ borderBottom: '1px solid rgba(16, 185, 129, 0.15)', paddingBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <div style={{ fontSize: '11px', color: 'var(--color-success)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                              Evaluation Run
                            </div>
                            <div style={{ fontWeight: 'bold', fontSize: '14px', color: 'var(--text-primary)' }}>
                              {timestamp !== 'unknown' ? new Date(timestamp).toLocaleString() : 'Unknown Date'}
                            </div>
                          </div>
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleDownloadRunPDF(timestamp, runData); }}
                            disabled={downloading === timestamp}
                            style={{ 
                              background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', 
                              color: 'var(--color-success)', padding: '6px', borderRadius: '6px', cursor: 'pointer',
                              display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}
                            title="Download PDF"
                          >
                            <FileDown size={16} />
                          </button>
                        </div>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {runData.sort((a, b) => a.ranking - b.ranking).map(evalData => {
                            const vendor = vendors.find(v => v.id === evalData.vendor_id);
                            return (
                              <div key={evalData.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', backgroundColor: 'rgba(0,0,0,0.15)', borderRadius: '8px' }}>
                                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                  <span style={{ color: '#fff', fontWeight: 'bold', fontSize: '12px', background: '#111', padding: '2px 6px', borderRadius: '4px' }}>
                                    {evalData.ranking_label}
                                  </span>
                                  <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>
                                    {vendor ? vendor.vendor_name : `Vendor ID: ${evalData.vendor_id}`}
                                  </span>
                                </div>
                                <div style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                                  INR {parseFloat(evalData.quoted_price).toLocaleString()}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default FinancialWorkspace;
