import React, { useState } from 'react';
import { Award, FileDown, CheckCircle2 } from 'lucide-react';
import html2pdf from 'html2pdf.js';
import { marked } from 'marked';
import api from '../services/api';
import StreamText from './StreamText';
import FlowConnector from './FlowConnector';
import ActiveTenderBadge from './ActiveTenderBadge';

function formatFinancialReport(text) {
  if (!text) return '';
  let processed = text;
  
  processed = processed.replace(/<div style="text-align: center; font-weight: bold; margin-bottom: 12px;">FINANCIAL EVALUATION REPORT<\/div>/g, 'FINANCIAL EVALUATION REPORT');
  processed = processed.replace(/\*\*FINANCIAL EVALUATION REPORT\*\*/g, 'FINANCIAL EVALUATION REPORT');
  
  processed = processed.replace(
    /(?:^|\n)(FINANCIAL EVALUATION REPORT)(?:\n|$)/g,
    '\n<div style="text-align: center; font-weight: bold; margin-bottom: 12px;">FINANCIAL EVALUATION REPORT</div>\n'
  );
  
  processed = processed.replace(/\*\*Summary of Findings:\*\*/g, 'Summary of Findings:');
  processed = processed.replace(
    /(Summary of Findings:)/g,
    '**Summary of Findings:**'
  );
  
  return processed;
}

export const RecommendationWorkspace = ({ activeTenderId }) => {
  const [recommending, setRecommending] = useState(false);
  const [recommendation, setRecommendation] = useState(null);
  const [downloading, setDownloading] = useState(false);

  async function handleGenerateRecommendation() {
    if (!activeTenderId) {
      alert("Select an active tender in Module 1 first.");
      return;
    }
    setRecommending(true);
    setRecommendation(null);
    try {
      const result = await api.generateRecommendation(activeTenderId);
      setRecommendation(result);
    } catch (err) {
      alert(`Award Recommendation Failed: ${err.message}`);
    } finally {
      setRecommending(false);
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

  return (
    <div className="panel-grid" style={{ gridAutoRows: 'max-content' }}>
      <ActiveTenderBadge activeTenderId={activeTenderId} />
      
      {!recommendation ? (
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', textAlign: 'center', maxWidth: '600px', margin: '40px auto' }}>
          <Award size={48} style={{ color: 'var(--accent-violet)' }} />
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '8px', borderBottom: 'none' }}>Generate Final Award Recommendation</h2>
            <p style={{ color: 'var(--text-muted)' }}>
              This will aggregate all data from Pre-Qualification, Technical Evaluation, and Financial Ranking to produce a comprehensive Bid Evaluation Report (BER) ready for committee sign-off.
            </p>
          </div>
          <button 
            className="btn-primary" 
            onClick={handleGenerateRecommendation}
            disabled={recommending || !activeTenderId}
            style={{ padding: '12px 24px', fontSize: '15px' }}
          >
            {recommending ? 'Compiling Multi-stage scores...' : 'Generate Full BER Document'}
          </button>
        </div>
      ) : (
        <div className="glass-card" style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '24px', 
          overflow: 'hidden', 
          maxWidth: '1100px', 
          width: '100%', 
          padding: '28px', 
          margin: '20px auto' 
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
            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                className="btn-secondary" 
                onClick={() => setRecommendation(null)}
              >
                Reset
              </button>
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
          </div>
        </div>
      )}
    </div>
  );
};

export default RecommendationWorkspace;
