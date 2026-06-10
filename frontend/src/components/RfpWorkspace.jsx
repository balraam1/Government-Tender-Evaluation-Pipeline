import React, { useState, useEffect, useRef } from 'react';
import { Send, FileText, Download, List, Server, X, Save } from 'lucide-react';
import api from '../services/api';
import StreamText from './StreamText';
import FlowConnector from './FlowConnector';
import html2pdf from 'html2pdf.js';
import { marked } from 'marked';

export const RfpWorkspace = ({ activeTenderId, onSelectTender }) => {
  const [tenders, setTenders] = useState([]);
  const [selectedTender, setSelectedTender] = useState(null);
  const [form, setForm] = useState({
    title: '',
    category: 'Services',
    department: 'COE GenAI',
    description: '',
    budget: '',
    selection_method: 'QCBS',
    contract_type: 'Fixed Price',
    emd_amount: '',
    pbg_percentage: '',
    contract_duration: '12 Months',
    min_turnover: '',
    min_experience: '',
    submission_deadline: '',
    pre_bid_date: '',
    additional_requirements: '',
  });
  
  const [generating, setGenerating] = useState(false);
  const [generatedDoc, setGeneratedDoc] = useState(null);
  const [activeTab, setActiveTab] = useState('split');
  const [downloading, setDownloading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editableContent, setEditableContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const contentRef = useRef(null);

  useEffect(() => {
    loadTenders();
  }, []);

  // Sync selectedTender whenever activeTenderId changes externally (e.g. from another module)
  useEffect(() => {
    if (activeTenderId && tenders.length > 0) {
      const active = tenders.find(t => t.id === activeTenderId);
      if (active && active.id !== selectedTender?.id) setSelectedTender(active);
    }
  }, [activeTenderId, tenders]);

  async function loadTenders() {
    try {
      const data = await api.listTenders();
      setTenders(data);
      if (activeTenderId) {
        const active = data.find(t => t.id === activeTenderId);
        if (active) setSelectedTender(active);
      }
    } catch (err) {
      console.error("Error loading tenders:", err);
    }
  }

  async function handleSelectTender(t) {
    setSelectedTender(t);
    onSelectTender(t ? t.id : null);
    setGeneratedDoc(null); // Clear generator preview if inspecting existing
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setGenerating(true);
    setGeneratedDoc(null);
    try {
      const payload = {
        ...form,
        budget: form.budget ? parseFloat(form.budget) * 100000 : null,
        emd_amount: form.emd_amount ? parseFloat(form.emd_amount) : 0,
        pbg_percentage: form.pbg_percentage ? parseFloat(form.pbg_percentage) : 0,
        min_turnover: form.min_turnover ? parseFloat(form.min_turnover) * 100000 : 0,
        min_experience: form.min_experience ? parseInt(form.min_experience, 10) : 0,
        submission_deadline: form.submission_deadline ? new Date(form.submission_deadline).toISOString() : null,
        pre_bid_date: form.pre_bid_date ? new Date(form.pre_bid_date).toISOString() : null,
      };
      const result = await api.generateRFP(payload);
      setGeneratedDoc(result);
      loadTenders(); // Refresh list
      onSelectTender(result.tender_id);
    } catch (err) {
      alert(`RFP Generation Failed: ${err.message}`);
    } finally {
      setGenerating(false);
    }
  }

  const currentDisplay = generatedDoc || selectedTender;

  const handleOpenModal = () => {
    const text = currentDisplay?.full_rfp_document || currentDisplay?.generated_rfp || 
        `${currentDisplay?.scope_of_work}\n\n${currentDisplay?.eligibility_criteria}\n\n${currentDisplay?.sla_terms}`;
    setEditableContent(text);
    setIsModalOpen(true);
  };

  const handleSaveDocument = async () => {
    if (!currentDisplay) return;
    setSaving(true);
    try {
      const finalContent = isEditMode && contentRef.current ? contentRef.current.innerHTML : editableContent;
      const id = currentDisplay.tender_id || currentDisplay.id;
      await api.updateRFP(id, { full_rfp_document: finalContent });
      if (generatedDoc) {
        setGeneratedDoc({...generatedDoc, full_rfp_document: finalContent});
      } else if (selectedTender) {
        setSelectedTender({...selectedTender, generated_rfp: finalContent});
      }
      setIsModalOpen(false);
    } catch (err) {
      alert(`Failed to save RFP: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!currentDisplay) return;
    setDownloading(true);

    try {
      const container = document.createElement('div');
      container.style.padding = '40px';
      container.style.fontFamily = 'Inter, sans-serif';
      container.style.color = '#333';

      const mdContent = currentDisplay.full_rfp_document || currentDisplay.generated_rfp || 
        `${currentDisplay.scope_of_work}\n\n${currentDisplay.eligibility_criteria}\n\n${currentDisplay.sla_terms}`;

      const htmlContent = marked.parse(mdContent);

      const tTitle = selectedTender?.title || form.title || 'Tender Document';
      const tCategory = selectedTender?.category || form.category;
      const tDept = selectedTender?.department || form.department;
      const tDesc = selectedTender?.description || form.description || '';
      const tBudget = selectedTender?.budget 
        ? `INR ${(selectedTender.budget / 100000).toFixed(2)} Lakhs` 
        : (form.budget ? `INR ${form.budget} Lakhs` : 'To be quoted');

      container.innerHTML = `
        <style>
          .pdf-content h1, .pdf-content h2, .pdf-content h3 { color: #0f172a; margin-top: 1.5em; margin-bottom: 0.5em; }
          .pdf-content h2 { border-bottom: 1px solid #e2e8f0; padding-bottom: 0.3em; font-size: 18px; }
          .pdf-content h3 { font-size: 16px; }
          .pdf-content p { margin-bottom: 1em; }
          .pdf-content ul { margin-bottom: 1em; padding-left: 24px; list-style-type: disc; }
          .pdf-content ol { margin-bottom: 1em; padding-left: 24px; list-style-type: decimal; }
          .pdf-content li { margin-bottom: 0.4em; padding-left: 4px; }
          .pdf-content table { width: 100%; border-collapse: collapse; margin-top: 1em; margin-bottom: 1em; }
          .pdf-content th, .pdf-content td { border: 1px solid #cbd5e1; padding: 10px; text-align: left; font-size: 13px; }
          .pdf-content th { background-color: #f8fafc; font-weight: 600; color: #0f172a; }
          .pdf-content strong { color: #0f172a; font-weight: 600; }
          .pdf-content blockquote { border-left: 4px solid #e2e8f0; padding-left: 16px; color: #64748b; font-style: italic; margin-left: 0; }
          .pdf-content code { background-color: #f1f5f9; padding: 2px 4px; border-radius: 4px; font-family: monospace; font-size: 13px; }
        </style>
        <div style="margin-bottom: 30px; border-bottom: 2px solid #ddd; padding-bottom: 15px;">
          <h1 style="font-size: 24px; color: #0f172a; margin-bottom: 10px;">${tTitle}</h1>
          <div style="display: flex; gap: 40px; font-size: 14px; color: #64748b;">
            <div><strong>Category:</strong> ${tCategory}</div>
            <div><strong>Department:</strong> ${tDept}</div>
          </div>
          <div style="margin-top: 10px; font-size: 14px; color: #64748b;">
            <strong>Description:</strong> ${tDesc}
          </div>
          <div style="margin-top: 10px; font-size: 14px; color: #64748b;">
            <strong>Budget:</strong> ${tBudget}
          </div>
        </div>
        <div class="pdf-content" style="font-size: 14px; line-height: 1.6; color: #334155;">
          ${htmlContent}
        </div>
      `;

      const opt = {
        margin:       10,
        filename:     `${selectedTender?.tender_number || 'Tender'}_Document.pdf`,
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
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Top Selector Bar */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '12px 20px', justifySelf: 'center' }}>
        <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
          <select 
            className="badge badge-info"
            style={{ 
              padding: '6px 28px 6px 16px',
              borderRadius: '9999px',
              border: '1px solid rgba(3, 105, 161, 0.25)',
              background: 'rgba(3, 105, 161, 0.1)',
              color: 'var(--color-info)',
              fontWeight: '600',
              fontSize: '11px',
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              outline: 'none',
              cursor: 'pointer',
              appearance: 'none',
              textAlign: 'center',
            }}
            value={selectedTender?.id || ''}
            onChange={(e) => {
              const val = e.target.value;
              if (val === '') {
                handleSelectTender(null);
              } else {
                const t = tenders.find(item => item.id === parseInt(val));
                if (t) handleSelectTender(t);
              }
            }}
          >
            <option value="" style={{ background: '#FFFFFF', color: 'var(--text-primary)' }}>
              -- Start New RFP Authoring --
            </option>
            {tenders.map(t => (
              <option key={t.id} value={t.id} style={{ background: '#FFFFFF', color: 'var(--text-primary)' }}>
                ACTIVE TENDER: {t.tender_number}
              </option>
            ))}
          </select>
          <span style={{ position: 'absolute', right: '12px', pointerEvents: 'none', color: 'var(--color-info)', display: 'flex', alignItems: 'center', fontSize: '9px' }}>
            ▼
          </span>
        </div>
      </div>

      {/* Main Workspace centered panel */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
        <div className="glass-card" style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: selectedTender ? '10px' : '16px', padding: selectedTender ? '18px' : '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--card-border)', paddingBottom: currentDisplay ? '8px' : '10px', height: '38px' }}>
            <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)' }}>
              {currentDisplay ? 'Tender Metadata' : 'AI-Assisted RFP Parameter Configuration'}
            </div>
          </div>
          
          {currentDisplay ? (
            <div className="output-stream-card" style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '16px', borderRadius: '8px' }}>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Tender Title</label>
                <div style={{ fontSize: '15px', fontWeight: '600', marginTop: '4px', color: 'var(--text-primary)' }}>{currentDisplay.title}</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Category</label>
                  <div style={{ fontSize: '14px', marginTop: '4px', color: 'var(--text-primary)', fontWeight: '600' }}>{currentDisplay.category || 'Services'}</div>
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Department</label>
                  <div style={{ fontSize: '14px', marginTop: '4px', color: 'var(--text-primary)', fontWeight: '600' }}>{currentDisplay.department}</div>
                </div>
              </div>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Description</label>
                <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', marginTop: '4px', lineHeight: '1.4' }}>{currentDisplay.description || 'Generated AI RFP Document'}</div>
              </div>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Estimated Budget</label>
                <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--color-success)', marginTop: '4px' }}>
                  {currentDisplay.budget ? `INR ${(currentDisplay.budget / 100000).toFixed(2)} Lakhs` : 'To be quoted'}
                </div>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Section 1: General Details */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em', paddingLeft: '4px' }}>1. General Details</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: '#fefce8', padding: '16px', borderRadius: '8px', border: '1px solid #fef08a' }}>
                
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600' }}>Tender / RFP Title</label>
                  <input 
                    type="text" 
                    required
                    placeholder="e.g. Setting up local Generative AI Data Lake"
                    className="glass-input" 
                    style={{ marginTop: '6px' }}
                    value={form.title}
                    onChange={e => setForm({...form, title: e.target.value})}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600' }}>Category</label>
                    <select 
                      className="glass-input"
                      style={{ marginTop: '6px' }}
                      value={form.category}
                      onChange={e => setForm({...form, category: e.target.value})}
                    >
                      <option value="Services">Services</option>
                      <option value="Goods">Goods</option>
                      <option value="Works">Works</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600' }}>Department</label>
                    <input 
                      type="text" 
                      className="glass-input" 
                      style={{ marginTop: '6px' }}
                      value={form.department}
                      onChange={e => setForm({...form, department: e.target.value})}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600' }}>Scope Description</label>
                  <textarea 
                    required
                    rows={3}
                    placeholder="Provide details on the deliverables..."
                    className="glass-input" 
                    style={{ marginTop: '6px', resize: 'none' }}
                    value={form.description}
                    onChange={e => setForm({...form, description: e.target.value})}
                  />
                </div>
                </div>
              </div>

              {/* Section 2: Financials & Security */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em', paddingLeft: '4px' }}>2. Financials & Security</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: '#fefce8', padding: '16px', borderRadius: '8px', border: '1px solid #fef08a' }}>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600' }}>Est. Budget (Lakhs INR)</label>
                    <input 
                      type="number" 
                      placeholder="e.g. 50"
                      className="glass-input" 
                      style={{ marginTop: '6px' }}
                      value={form.budget}
                      onChange={e => setForm({...form, budget: e.target.value})}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600' }}>PBG Percentage (%)</label>
                    <input 
                      type="number" 
                      placeholder="e.g. 5"
                      className="glass-input" 
                      style={{ marginTop: '6px' }}
                      value={form.pbg_percentage}
                      onChange={e => setForm({...form, pbg_percentage: e.target.value})}
                    />
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600' }}>EMD Amount (Raw INR)</label>
                  <input 
                    type="number" 
                    placeholder="e.g. 50000"
                    className="glass-input" 
                    style={{ marginTop: '6px' }}
                    value={form.emd_amount}
                    onChange={e => setForm({...form, emd_amount: e.target.value})}
                  />
                </div>
                </div>
              </div>

              {/* Section 3: Evaluation Strategy & PQ */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em', paddingLeft: '4px' }}>3. Evaluation Strategy & Pre-Qualification</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: '#fefce8', padding: '16px', borderRadius: '8px', border: '1px solid #fef08a' }}>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600' }}>Selection Method</label>
                    <select 
                      className="glass-input"
                      style={{ marginTop: '6px' }}
                      value={form.selection_method}
                      onChange={e => setForm({...form, selection_method: e.target.value})}
                    >
                      <option value="QCBS">QCBS (Quality & Cost)</option>
                      <option value="LCS">LCS (Least Cost)</option>
                      <option value="Fixed Budget">Fixed Budget</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600' }}>Contract Type</label>
                    <select 
                      className="glass-input"
                      style={{ marginTop: '6px' }}
                      value={form.contract_type}
                      onChange={e => setForm({...form, contract_type: e.target.value})}
                    >
                      <option value="Fixed Price">Fixed Price</option>
                      <option value="Time & Materials">Time & Materials</option>
                      <option value="Rate Contract">Rate Contract</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600' }}>Min. Turnover (Lakhs INR)</label>
                    <input 
                      type="number" 
                      placeholder="e.g. 50"
                      className="glass-input" 
                      style={{ marginTop: '6px' }}
                      value={form.min_turnover}
                      onChange={e => setForm({...form, min_turnover: e.target.value})}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600' }}>Min. Experience (Years)</label>
                    <input 
                      type="number" 
                      placeholder="e.g. 3"
                      className="glass-input" 
                      style={{ marginTop: '6px' }}
                      value={form.min_experience}
                      onChange={e => setForm({...form, min_experience: e.target.value})}
                    />
                  </div>
                </div>
                </div>
              </div>

              {/* Section 4: Timeline */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em', paddingLeft: '4px' }}>4. Timeline & Milestones</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: '#fefce8', padding: '16px', borderRadius: '8px', border: '1px solid #fef08a' }}>
                
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600' }}>Contract Duration</label>
                  <input 
                    type="text" 
                    placeholder="e.g. 12 Months, 3 Years"
                    className="glass-input" 
                    style={{ marginTop: '6px' }}
                    value={form.contract_duration}
                    onChange={e => setForm({...form, contract_duration: e.target.value})}
                  />
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600' }}>Pre-Bid Date</label>
                    <input 
                      type="datetime-local" 
                      className="glass-input" 
                      style={{ marginTop: '6px' }}
                      value={form.pre_bid_date}
                      onChange={e => setForm({...form, pre_bid_date: e.target.value})}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600' }}>Submission Deadline</label>
                    <input 
                      type="datetime-local" 
                      className="glass-input" 
                      style={{ marginTop: '6px' }}
                      value={form.submission_deadline}
                      onChange={e => setForm({...form, submission_deadline: e.target.value})}
                    />
                  </div>
                </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: '#fefce8', padding: '16px', borderRadius: '8px', border: '1px solid #fef08a' }}>
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600', textAlign: 'center', display: 'block' }}>Additional Compliance Criteria (Optional)</label>
                <input 
                  type="text" 
                  placeholder="e.g. Must support air-gapped on-premise installation"
                  className="glass-input" 
                  style={{ marginTop: '6px' }}
                  value={form.additional_requirements}
                  onChange={e => setForm({...form, additional_requirements: e.target.value})}
                />
              </div>

              <button 
                type="submit" 
                className="btn-primary" 
                style={{ marginTop: '10px', justifyContent: 'center' }}
                disabled={generating}
              >
                <Send size={16} />
                {generating ? 'Drafting RFP...' : 'Generate AI-Assisted RFP'}
              </button>
            </form>
          )}

          {generating && (
            <div className="glass-card" style={{ marginTop: '10px', padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
              <div className="terminal-cursor" style={{ width: '12px', height: '22px' }}></div>
              <div style={{ color: 'var(--text-secondary)' }}>AI Agent is drafting compliant eligibility matrices and SLAs...</div>
            </div>
          )}

          {!generating && currentDisplay && (
             <div className="glass-card" style={{ marginTop: '10px', padding: '20px', display: 'flex', justifyContent: 'center', gap: '16px', background: '#fefce8', border: '1px solid #fef08a' }}>
               <button type="button" className="btn-primary" onClick={handleOpenModal}>
                 <FileText size={16} style={{ marginRight: '8px' }} />
                 Show Document
               </button>
               <button type="button" className="btn-secondary" onClick={handleDownloadPDF} disabled={downloading}>
                 <Download size={16} style={{ marginRight: '8px' }} />
                 {downloading ? 'Downloading...' : 'Download Document'}
               </button>
             </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="glass-card" style={{ width: '90%', height: '90%', display: 'flex', flexDirection: 'column', background: 'white' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid var(--card-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: '600', margin: 0, color: 'var(--text-primary)' }}>RFP Document</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#f1f5f9', padding: '4px 12px', borderRadius: '20px', border: '1px solid var(--card-border)' }}>
                  <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input type="checkbox" checked={isEditMode} onChange={(e) => {
                      if (!e.target.checked && contentRef.current) {
                        setEditableContent(contentRef.current.innerHTML);
                      }
                      setIsEditMode(e.target.checked);
                    }} style={{ cursor: 'pointer', width: '16px', height: '16px' }} />
                    Edit Mode
                  </label>
                </div>
              </div>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={24} /></button>
            </div>
            
            <div style={{ display: 'flex', flex: 1, overflow: 'hidden', padding: '20px', background: '#f8fafc' }}>
              <div className="output-stream-card" style={{ flex: 1, background: 'white', borderRadius: '8px', overflowY: 'auto', display: 'flex', flexDirection: 'column', padding: isEditMode ? '0' : '24px', lineHeight: '1.6', border: '1px solid var(--card-border)' }}>
                {isEditMode ? (
                  <div
                    ref={contentRef}
                    className="markdown-content"
                    contentEditable={true}
                    suppressContentEditableWarning={true}
                    dangerouslySetInnerHTML={{ __html: marked.parse(editableContent) }}
                    style={{ flex: 1, outline: 'none', padding: '24px', minHeight: '100%', cursor: 'text' }}
                    onBlur={(e) => setEditableContent(e.currentTarget.innerHTML)}
                  />
                ) : (
                  <StreamText text={editableContent} simulate={false} markdown={true} />
                )}
              </div>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '16px 24px', borderTop: '1px solid var(--card-border)', gap: '12px' }}>
              <button className="btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleSaveDocument} disabled={saving}>
                <Save size={16} style={{ marginRight: '8px' }} />
                {saving ? 'Saving...' : 'Save Document'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RfpWorkspace;
