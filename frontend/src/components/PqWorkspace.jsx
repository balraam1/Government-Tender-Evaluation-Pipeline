import React, { useState, useEffect } from 'react';
import { ShieldAlert, CheckCircle, XCircle, AlertTriangle, Play, List, UserPlus, X, FileDown } from 'lucide-react';
import html2pdf from 'html2pdf.js';
import { marked } from 'marked';
import ActiveTenderBadge from './ActiveTenderBadge';
import api from '../services/api';
import StreamText from './StreamText';
import FlowConnector from './FlowConnector';

export const VendorRegistrationForm = ({ onVendorRegistered, wrapperStyle }) => {
  const [formData, setFormData] = useState({
    vendor_name: '', gst_number: '', pan_number: '', email: '', phone: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await api.registerVendor({
        ...formData,
        annual_turnover: 0,
        years_of_experience: 0,
        certifications: []
      });
      setFormData({ vendor_name: '', gst_number: '', pan_number: '', email: '', phone: '' });
      setSuccessMsg('New vendor details saved!');
      if (onVendorRegistered) onVendorRegistered();
      
      setTimeout(() => {
        setIsExpanded(false);
        setSuccessMsg('');
      }, 2500);
    } catch (err) {
      alert('Failed to register vendor: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isExpanded) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '60px', marginBottom: '16px', ...wrapperStyle }}>
        <button className="btn-primary" onClick={() => setIsExpanded(true)} style={{ gap: '8px', padding: '10px 20px', borderRadius: '8px', boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)' }}>
          <UserPlus size={16} />
          <span>Register New Vendor</span>
        </button>
      </div>
    );
  }

  return (
    <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '600px', margin: '60px auto 16px auto', width: '100%', animation: 'fadeIn 0.3s ease-out', ...wrapperStyle }}>
      <div style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)', borderBottom: '1px solid var(--card-border)', paddingBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <UserPlus size={18} style={{ color: 'var(--color-primary)' }} />
          Register New Vendor
        </div>
        <button type="button" onClick={() => setIsExpanded(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', padding: '4px' }}>
          <X size={16} />
        </button>
      </div>
      <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Vendor Name *</label>
          <input required type="text" className="glass-input" style={{ marginTop: '6px' }} value={formData.vendor_name} onChange={e => setFormData({...formData, vendor_name: e.target.value})} />
        </div>
        <div>
          <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>GST Number *</label>
          <input required type="text" className="glass-input" style={{ marginTop: '6px' }} value={formData.gst_number} onChange={e => setFormData({...formData, gst_number: e.target.value})} />
        </div>
        <div>
          <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>PAN Number *</label>
          <input required type="text" className="glass-input" style={{ marginTop: '6px' }} value={formData.pan_number} onChange={e => setFormData({...formData, pan_number: e.target.value})} />
        </div>
        <div>
          <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Email</label>
          <input type="email" className="glass-input" style={{ marginTop: '6px' }} value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
        </div>
        <div>
          <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Phone</label>
          <input type="text" className="glass-input" style={{ marginTop: '6px' }} value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
        </div>
        <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', marginTop: '12px', alignItems: 'center', gap: '16px' }}>
          {successMsg && (
            <span style={{ color: 'var(--color-success, #10b981)', fontSize: '14px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px', animation: 'fadeIn 0.3s ease-out' }}>
              <CheckCircle size={16} /> {successMsg}
            </span>
          )}
          <button type="submit" className="btn-primary" disabled={isSubmitting || !!successMsg} style={{ padding: '8px 24px' }}>
            {isSubmitting ? 'Registering...' : (successMsg ? 'Saved!' : 'Save & Register')}
          </button>
        </div>
      </form>
    </div>
  );
};

const getPqRemarksFallback = (evalData) => {
  if (!evalData) return null;
  if (evalData.remarks && evalData.remarks.trim().length > 0) {
    // Parse basic markdown bold and explicitly bold requested phrases
    const parts = evalData.remarks.split('\n').map((line, i) => {
      let processedLine = line;
      
      // Explicitly bolden specific phrases if they aren't already wrapped in **
      if (processedLine.includes('CLARIFICATION / SHORTFALL SUBMISSION REQUEST') && !processedLine.includes('**CLARIFICATION')) {
        processedLine = processedLine.replace('CLARIFICATION / SHORTFALL SUBMISSION REQUEST', '**CLARIFICATION / SHORTFALL SUBMISSION REQUEST**');
      }
      if (processedLine.includes('Reference') && !processedLine.includes('**Reference')) {
        // Handle "Reference" or "Reference:"
        processedLine = processedLine.replace('Reference', '**Reference**');
      }

      // Split by ** and wrap odd indices in <strong>
      const boldParts = processedLine.split('**').map((part, index) => {
        return index % 2 === 1 ? <strong key={index} style={{ fontWeight: '800' }}>{part}</strong> : part;
      });

      const isHeader = processedLine.includes('CLARIFICATION / SHORTFALL SUBMISSION REQUEST');
      return (
        <span key={i} style={{ display: 'block', marginBottom: '4px', textAlign: isHeader ? 'center' : 'left' }}>
          {boldParts}
        </span>
      );
    });
    return <div style={{ whiteSpace: 'pre-wrap' }}>{parts}</div>;
  }
  
  if (evalData.overall_status === 'PASS') {
    return <div style={{ color: 'var(--color-success)', fontWeight: '500' }}>Vendor meets all pre-qualification criteria. Eligible for technical evaluation stage.</div>;
  }
  
  const fails = [];
  if (evalData.turnover_status === 'FAIL') fails.push('Annual Turnover requirement (≥ 50 Lakhs) not met.');
  if (evalData.experience_status === 'FAIL') fails.push('Years of Operation requirement (≥ 2 years) not met.');
  if (evalData.gst_status === 'FAIL') fails.push('Missing valid GST registration copy.');
  if (evalData.pan_status === 'FAIL') fails.push('Missing valid PAN card validation.');
  
  if (fails.length > 0) {
    return (
      <div style={{ color: 'var(--color-danger)' }}>
        <div style={{ fontWeight: '600', marginBottom: '6px' }}>Vendor does not meet PQ criteria due to the following shortfalls:</div>
        <ul style={{ margin: 0, paddingLeft: '20px' }}>
          {fails.map((f, idx) => (
            <li key={idx} style={{ marginBottom: '4px' }}>{f}</li>
          ))}
        </ul>
        <div style={{ marginTop: '8px', fontWeight: '500' }}>Not eligible for further evaluation.</div>
      </div>
    );
  }
  return <div style={{ color: 'var(--color-danger)' }}>Vendor does not meet the mandatory pre-qualification criteria.</div>;
};

export const PqWorkspace = ({ activeTenderId }) => {
  const [vendors, setVendors] = useState([]);
  const [selectedVendorId, setSelectedVendorId] = useState('');
  const [pqResults, setPqResults] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  
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
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    loadVendors();
    if (activeTenderId) {
      loadPQResults();
    }
  }, [activeTenderId]);

  useEffect(() => {
    if (selectedVendorId && activeTenderId) {
      autoFillPQForm();
    }
  }, [selectedVendorId, activeTenderId]);

  async function loadVendors() {
    try {
      const data = await api.listVendors();
      setVendors(data);
    } catch (err) {
      console.error("Error loading vendors:", err);
    }
  }

  async function autoFillPQForm() {
    try {
      const docs = await api.getDocumentHistory(activeTenderId).catch(() => []);
      const vendorDocs = docs.filter(d => 
        d.vendor_id === parseInt(selectedVendorId) && 
        (d.document_type === 'PQ_LEGAL_FINANCIAL' || d.document_type === 'PQ_EXPERIENCE_CERTS')
      );

      if (vendorDocs.length === 0) return;

      let newForm = { ...form };
      
      for (const doc of vendorDocs) {
        if (!doc.has_metadata) continue;
        const fullDoc = await api.getDocument(doc.id);
        const meta = fullDoc.metadata || {};
        
        if (doc.document_type === 'PQ_LEGAL_FINANCIAL') {
          let turnoverStr = meta.average_turnover || meta.annual_turnover_yr3 || '';
          turnoverStr = turnoverStr.toString().replace(/[^\d.]/g, '');
          if (turnoverStr) newForm.annual_turnover = turnoverStr;

          if (meta.gstin_number) newForm.has_gst = true;
          if (meta.pan_number) newForm.has_pan = true;
          
          if (meta.date_of_birth_incorporation) {
             const yearMatch = meta.date_of_birth_incorporation.match(/\d{4}/);
             if (yearMatch) {
                const year = parseInt(yearMatch[0]);
                const currentYear = new Date().getFullYear();
                newForm.years_experience = (currentYear - year).toString();
             }
          }
        } else if (doc.document_type === 'PQ_EXPERIENCE_CERTS') {
          let projectValStr = meta.contract_value || '';
          projectValStr = projectValStr.toString().replace(/[^\d.]/g, '');
          if (projectValStr) newForm.similar_project_value = projectValStr;
          
          if (meta.certificate_type) {
            newForm.certifications = meta.certificate_type;
          }
        }
      }
      setForm(newForm);
    } catch (err) {
      console.error("Error auto-filling PQ form:", err);
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

  async function handleDownloadPQPDF(evalData) {
    if (!evalData) return;
    setDownloading(evalData.evaluation_id);
    try {
      const container = document.createElement('div');
      container.style.padding = '30px';
      container.style.fontFamily = 'system-ui, -apple-system, sans-serif';
      container.style.color = '#1e293b';

      const vendor = vendors.find(v => v.id === evalData.vendor_id);
      const vName = vendor ? vendor.vendor_name : `Vendor ID: ${evalData.vendor_id}`;
      const passStyle = 'color: #10b981; font-weight: bold;';
      const failStyle = 'color: #ef4444; font-weight: bold;';
      const statusHtml = evalData.overall_status === 'PASS' 
        ? `<span style="${passStyle}">PASS</span>` 
        : `<span style="${failStyle}">FAIL</span>`;

      let resultsHtml = `
        <div style="margin-bottom: 25px; padding-bottom: 20px; border-bottom: 1px solid #e2e8f0; break-inside: avoid;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <div style="font-weight: 600; color: #0f172a; font-size: 16px;">${vName}</div>
            <div style="font-size: 14px;">Overall Status: ${statusHtml}</div>
          </div>
          
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 15px; font-size: 13px; background: #f8fafc; padding: 12px; border-radius: 6px; border: 1px solid #e2e8f0;">
            <div><strong>Annual Turnover:</strong> <span style="${evalData.turnover_status === 'PASS' ? passStyle : failStyle}">${evalData.turnover_status}</span></div>
            <div><strong>Experience Years:</strong> <span style="${evalData.experience_status === 'PASS' ? passStyle : failStyle}">${evalData.experience_status}</span></div>
            <div><strong>GST Registration:</strong> <span style="${evalData.gst_status === 'PASS' ? passStyle : failStyle}">${evalData.gst_status}</span></div>
            <div><strong>PAN Validation:</strong> <span style="${evalData.pan_status === 'PASS' ? passStyle : failStyle}">${evalData.pan_status}</span></div>
          </div>

          <div style="font-size: 13px; color: #334155;">
            <strong>AI Evaluator Remarks:</strong>
            <div style="margin-top: 6px; padding: 10px; background: #f1f5f9; border-left: 3px solid #3b82f6; line-height: 1.5;">
              ${evalData.remarks ? marked.parse(evalData.remarks) : (evalData.overall_status === 'PASS' ? 'Vendor meets all pre-qualification criteria.' : 'Vendor failed mandatory criteria.')}
            </div>
          </div>
        </div>
      `;

      container.innerHTML = `
        <div style="margin-bottom: 25px; border-bottom: 2px solid #ddd; padding-bottom: 15px;">
          <h1 style="font-size: 20px; color: #0f172a; margin-bottom: 8px;">Pre-Qualification Evaluation Report</h1>
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
        filename:     `${activeTenderId || 'Tender'}_${vName.replace(/\\s+/g, '_')}_PQ.pdf`,
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%', height: '100%' }}>
      <ActiveTenderBadge activeTenderId={activeTenderId} />
      <VendorRegistrationForm onVendorRegistered={loadVendors} />
      
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
    
      {/* History Button */}
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '16px', marginBottom: '32px' }}>
        <button 
          className="btn-primary" 
          onClick={() => setShowHistory(true)}
          disabled={!activeTenderId || pqResults.length === 0}
          style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--card-border)' }}
        >
          <List size={16} style={{ marginRight: '8px' }} />
          View PQ History for Active Tender
        </button>
      </div>

      {/* History Modal */}
      {showHistory && (
        <div 
          style={{
            position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', 
            backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 9999, 
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            backdropFilter: 'blur(5px)'
          }}
          onClick={() => setShowHistory(false)}
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
                <List size={22} style={{ color: 'var(--color-primary)' }} />
                <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--text-primary)', margin: 0 }}>PQ Evaluation History</h2>
              </div>
              <button onClick={() => setShowHistory(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={24} />
              </button>
            </div>

            {pqResults.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px' }}>No PQ history found for this tender.</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
                {pqResults.map(evalData => {
                  const vendor = vendors.find(v => v.id === evalData.vendor_id);
                  return (
                    <div key={evalData.evaluation_id} style={{ 
                      backgroundColor: 'rgba(234, 179, 8, 0.1)', // Squarish yellow background
                      border: '1px solid rgba(234, 179, 8, 0.3)',
                      borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                      aspectRatio: '1 / 1', // make it squarish
                      overflowY: 'auto'
                    }}>
                      <div style={{ borderBottom: '1px solid rgba(234, 179, 8, 0.2)', paddingBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontSize: '11px', color: 'var(--color-warning)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                            Vendor Eligibility Inputs
                          </div>
                          <div style={{ fontWeight: 'bold', fontSize: '16px', color: 'var(--text-primary)' }}>
                            {vendor ? vendor.vendor_name : `Vendor ID: ${evalData.vendor_id}`}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                            Evaluated at: {new Date(evalData.created_at).toLocaleString()}
                          </div>
                        </div>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleDownloadPQPDF(evalData); }}
                          disabled={downloading === evalData.evaluation_id}
                          style={{ 
                            background: 'rgba(234, 179, 8, 0.15)', border: '1px solid rgba(234, 179, 8, 0.3)', 
                            color: 'var(--color-warning)', padding: '6px', borderRadius: '6px', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                          }}
                          title="Download PDF"
                        >
                          <FileDown size={16} />
                        </button>
                      </div>
                      
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
                        <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>Overall Status</span>
                        {evalData.overall_status === 'PASS' ? (
                          <span style={{ color: 'var(--color-success)', fontWeight: 'bold', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '4px' }}><CheckCircle size={16} /> PASS</span>
                        ) : (
                          <span style={{ color: 'var(--color-danger)', fontWeight: 'bold', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '4px' }}><XCircle size={16} /> FAIL</span>
                        )}
                      </div>

                      <div style={{ fontSize: '13px', backgroundColor: 'rgba(0,0,0,0.1)', padding: '12px', borderRadius: '8px' }}>
                        <div style={{ fontWeight: '600', marginBottom: '8px', color: 'var(--text-secondary)' }}>Parameters Compliance Check</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '6px' }}>
                          <span>Annual Turnover:</span> <strong style={{ color: evalData.turnover_status === 'PASS' ? 'var(--color-success)' : 'var(--color-danger)' }}>{evalData.turnover_status}</strong>
                          <span>Experience Years:</span> <strong style={{ color: evalData.experience_status === 'PASS' ? 'var(--color-success)' : 'var(--color-danger)' }}>{evalData.experience_status}</strong>
                          <span>GST Registration:</span> <strong style={{ color: evalData.gst_status === 'PASS' ? 'var(--color-success)' : 'var(--color-danger)' }}>{evalData.gst_status}</strong>
                          <span>PAN Validation:</span> <strong style={{ color: evalData.pan_status === 'PASS' ? 'var(--color-success)' : 'var(--color-danger)' }}>{evalData.pan_status}</strong>
                        </div>
                      </div>

                      <div style={{ fontSize: '13px', marginTop: 'auto' }}>
                        <div style={{ fontWeight: '600', marginBottom: '6px', color: 'var(--text-secondary)' }}>AI Evaluator Remarks</div>
                        <div style={{ fontStyle: 'italic', color: 'var(--text-primary)', backgroundColor: 'rgba(0,0,0,0.15)', padding: '10px', borderRadius: '8px', lineHeight: '1.5' }}>
                          {getPqRemarksFallback(evalData)}
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

export default PqWorkspace;
