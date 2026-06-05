import React, { useState, useEffect } from 'react';
import { DollarSign, FileText, CheckCircle2, TrendingDown, Award, Play } from 'lucide-react';
import api from '../services/api';
import StreamText from './StreamText';
import FlowConnector from './FlowConnector';
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

  // Default bid list to submit for financial evaluation
  const [bids, setBids] = useState([
    { vendor_id: 1, vendor_name: 'Tata Consultancy Services', total_amount: 4500000 },
    { vendor_id: 2, vendor_name: 'Infosys Limited', total_amount: 4800000 },
    { vendor_id: 3, vendor_name: 'Wipro Limited', total_amount: 4200000 }
  ]);

  useEffect(() => {
    loadVendors();
  }, []);

  async function loadVendors() {
    try {
      const data = await api.listVendors();
      setVendors(data);
      if (data.length >= 3) {
        // Map vendor names to bid entries if available
        setBids([
          { vendor_id: data[0].id, vendor_name: data[0].vendor_name, total_amount: 4500000 },
          { vendor_id: data[1].id, vendor_name: data[1].vendor_name, total_amount: 4800000 },
          { vendor_id: data[2].id, vendor_name: data[2].vendor_name, total_amount: 4200000 }
        ]);
      }
    } catch (err) {
      console.error("Error loading vendors:", err);
    }
  }

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

  const handleBidPriceChange = (index, value) => {
    setBids(prev => {
      const copy = [...prev];
      copy[index].total_amount = parseFloat(value) || 0;
      return copy;
    });
  };

  return (
    <div className="panel-grid panel-grid-2" style={{ gridAutoRows: 'max-content' }}>
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '700' }}>Modify Bid prices (in INR):</span>
                
                {bids.map((bid, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <div style={{ flex: 1, fontSize: '13px' }}>{bid.vendor_name}</div>
                    <input 
                      type="number" 
                      className="glass-input" 
                      style={{ width: '130px', padding: '6px 10px' }}
                      value={bid.total_amount}
                      onChange={(e) => handleBidPriceChange(idx, e.target.value)}
                    />
                  </div>
                ))}
              </div>

              <button 
                className="btn-primary" 
                style={{ justifyContent: 'center' }} 
                disabled={evaluating}
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
          gap: '16px', 
          overflow: 'hidden', 
          alignSelf: 'center', 
          justifySelf: 'center', 
          maxWidth: '1100px', 
          width: '100%', 
          padding: '20px 24px', 
          marginTop: '20px' 
        }}>
          <h2 style={{ fontSize: '16px', fontWeight: '600', borderBottom: '1px solid var(--card-border)', paddingBottom: '10px' }}>
            Final Award Recommendation Report
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="output-stream-card" style={{ padding: '12px', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '11px', color: '#000000', display: 'block', fontWeight: '700' }}>CGM Final Award Recommendation :</span>
                <span style={{ fontSize: '14px', fontWeight: '400', color: '#000000' }}>{recommendation.recommended_vendor_name}</span>
              </div>
              <span className="badge" style={{ gap: '6px', background: '#ffffff', color: '#000000', border: '1px solid rgba(0,0,0,0.15)', fontSize: '10px', fontWeight: '500' }}>
                Technical Score: {recommendation.technical_score}/100
              </span>
            </div>

            <div>
              <span className="badge" style={{ background: 'rgba(234, 179, 8, 0.1)', color: '#000000', borderColor: 'rgba(234, 179, 8, 0.25)', borderWidth: '1px', borderStyle: 'solid', fontWeight: '700' }}>AI CGM Award Report draft</span>
              <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                <FlowConnector />
                <div className="output-stream-card" style={{ 
                  flex: 1, 
                  borderRadius: '6px', 
                  padding: '14px', 
                  fontFamily: 'monospace', 
                  fontSize: '12px', 
                  color: '#000000',
                  lineHeight: '1.5',
                  fontWeight: '400'
                }}>
                  <StreamText text={formatFinancialReport(recommendation.award_report)} speed={6} markdown={true} />
                </div>
              </div>
            </div>

            <button className="btn-secondary" style={{ alignSelf: 'flex-start' }} onClick={() => setRecommendation(null)}>
              Close Recommendation Report
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default FinancialWorkspace;
