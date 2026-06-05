import React, { useState, useEffect } from 'react';
import { Send, FileText, Download, List, Server } from 'lucide-react';
import api from '../services/api';
import StreamText from './StreamText';
import FlowConnector from './FlowConnector';

export const RfpWorkspace = ({ activeTenderId, onSelectTender }) => {
  const [tenders, setTenders] = useState([]);
  const [selectedTender, setSelectedTender] = useState(null);
  const [form, setForm] = useState({
    title: '',
    category: 'Services',
    department: 'COE GenAI',
    description: '',
    budget: '',
    additional_requirements: '',
  });
  
  const [generating, setGenerating] = useState(false);
  const [generatedDoc, setGeneratedDoc] = useState(null);
  const [activeTab, setActiveTab] = useState('split');

  useEffect(() => {
    loadTenders();
  }, []);

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
      const result = await api.generateRFP({
        ...form,
        budget: form.budget ? parseFloat(form.budget) * 100000 : null // Convert Lakhs to raw INR
      });
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

  return (
    <div className="panel-grid" style={{ display: 'grid', gridTemplateRows: 'auto 1fr', height: '100%' }}>
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

      {/* Main Workspace split panel */}
      <div style={{ display: 'grid', gap: '20px', overflow: 'hidden' }} className="panel-grid-2">
        {/* Left Side: Creation Form / Tender Info */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: selectedTender ? '10px' : '16px', overflowY: 'auto', alignSelf: selectedTender ? 'center' : 'start', padding: selectedTender ? '18px' : undefined }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--card-border)', paddingBottom: selectedTender ? '8px' : '10px', height: '38px' }}>
            <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)' }}>
              {selectedTender ? 'Tender Metadata' : 'AI-Assisted RFP Parameter Configuration'}
            </div>
          </div>
          
          {selectedTender ? (
            <div className="output-stream-card" style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '16px', borderRadius: '8px' }}>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Tender Title</label>
                <div style={{ fontSize: '15px', fontWeight: '600', marginTop: '4px', color: 'var(--text-primary)' }}>{selectedTender.title}</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Category</label>
                  <div style={{ fontSize: '14px', marginTop: '4px', color: 'var(--text-primary)', fontWeight: '600' }}>{selectedTender.category}</div>
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Department</label>
                  <div style={{ fontSize: '14px', marginTop: '4px', color: 'var(--text-primary)', fontWeight: '600' }}>{selectedTender.department}</div>
                </div>
              </div>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Description</label>
                <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', marginTop: '4px', lineHeight: '1.4' }}>{selectedTender.description}</div>
              </div>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Estimated Budget</label>
                <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--color-success)', marginTop: '4px' }}>
                  {selectedTender.budget ? `INR ${(selectedTender.budget / 100000).toFixed(2)} Lakhs` : 'To be quoted'}
                </div>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
                  rows={4}
                  placeholder="Provide details on the technology deliverables, hosting environments, and training requirements..."
                  className="glass-input" 
                  style={{ marginTop: '6px', resize: 'none' }}
                  value={form.description}
                  onChange={e => setForm({...form, description: e.target.value})}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600' }}>Estimated Budget (in Lakhs INR)</label>
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
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600' }}>Additional Compliance Criteria (Optional)</label>
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
                {generating ? 'Drafting RFP via Gemma3...' : 'Generate AI-Assisted RFP'}
              </button>
            </form>
          )}
        </div>

        {/* Right Side: Generated Output & Streaming Pane */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--card-border)', paddingBottom: '10px', height: '38px' }}>
            <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)' }}>Output Stream</div>
            
            {currentDisplay && (
              <div className="sliding-tabs-container">
                <button 
                  className={`sliding-tab-btn ${activeTab === 'full' ? 'active' : ''}`}
                  onClick={() => setActiveTab('full')}
                >
                  Full Document
                </button>
                <button 
                  className={`sliding-tab-btn ${activeTab === 'split' ? 'active' : ''}`}
                  onClick={() => setActiveTab('split')}
                >
                  Structured Sections
                </button>
              </div>
            )}
          </div>

          <div style={{ flex: 1, overflowY: 'auto', paddingRight: '28px', fontSize: '13px' }}>
            {generating && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '12px' }}>
                <div className="terminal-cursor" style={{ width: '12px', height: '22px' }}></div>
                <div style={{ color: 'var(--text-secondary)' }}>AI Agent is drafting compliant eligibility matrices and SLAs...</div>
              </div>
            )}

            {!generating && !currentDisplay && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', textAlign: 'center' }}>
                Configure parameters on the left and submit<br/>to watch AI stream the RFP text.
              </div>
            )}

            {!generating && currentDisplay && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {activeTab === 'full' ? (
                  <div className="output-stream-card" style={{ padding: '16px', borderRadius: '8px', lineHeight: '1.6' }}>
                    <StreamText text={currentDisplay.full_rfp_document || currentDisplay.generated_rfp} simulate={!!generatedDoc} speed={5} markdown={true} />
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {/* Section 1: Scope */}
                    <div>
                      <div className="badge badge-info" style={{ marginBottom: '6px' }}>Scope of Work</div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <FlowConnector />
                        <div className="glass-card output-stream-card" style={{ flex: 1, padding: '16px' }}>
                          <StreamText text={currentDisplay.scope_of_work} simulate={!!generatedDoc} speed={10} markdown={true} />
                        </div>
                      </div>
                    </div>

                    {/* Section 2: Eligibility */}
                    <div>
                      <div className="badge badge-info" style={{ marginBottom: '6px' }}>Eligibility / Pre-Qualification</div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <FlowConnector />
                        <div className="glass-card output-stream-card" style={{ flex: 1, padding: '16px' }}>
                          <StreamText text={currentDisplay.eligibility_criteria} simulate={!!generatedDoc} speed={10} markdown={true} />
                        </div>
                      </div>
                    </div>

                    {/* Section 3: SLAs */}
                    <div>
                      <div className="badge badge-info" style={{ marginBottom: '6px' }}>SLAs & Penalty Structures</div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <FlowConnector />
                        <div className="glass-card output-stream-card" style={{ flex: 1, padding: '16px' }}>
                          <StreamText text={currentDisplay.sla_terms} simulate={!!generatedDoc} speed={10} markdown={true} />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RfpWorkspace;
