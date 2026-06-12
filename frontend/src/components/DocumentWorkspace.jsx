import React, { useState, useEffect } from 'react';
import { Upload, FileText, CheckCircle, Brain, Eye, List, Download, FileDown } from 'lucide-react';
import html2pdf from 'html2pdf.js';
import { marked } from 'marked';
import api from '../services/api';
import StreamText from './StreamText';
import FlowConnector from './FlowConnector';
import ActiveTenderBadge from './ActiveTenderBadge';
function repairJson(jsonStr) {
  let inString = false;
  let escape = false;
  const stack = [];
  const repaired = [];
  
  for (let i = 0; i < jsonStr.length; i++) {
    const char = jsonStr[i];
    if (escape) {
      repaired.push(char);
      escape = false;
      continue;
    }
    if (char === '\\' && inString) {
      repaired.push(char);
      escape = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      repaired.push(char);
      continue;
    }
    if (!inString) {
      if (char === '{' || char === '[') {
        stack.push(char);
      } else if (char === '}') {
        if (stack.length > 0 && stack[stack.length - 1] === '{') {
          stack.pop();
        }
      } else if (char === ']') {
        if (stack.length > 0 && stack[stack.length - 1] === '[') {
          stack.pop();
        }
      }
    }
    repaired.push(char);
  }
  
  if (inString) {
    repaired.push('"');
  }
  
  while (stack.length > 0) {
    const openChar = stack.pop();
    if (openChar === '{') {
      repaired.push('}');
    } else if (openChar === '[') {
      repaired.push(']');
    }
  }
  
  return repaired.join('');
}

function tryParseAndRepair(jsonStr) {
  if (!jsonStr) return null;
  const start = jsonStr.indexOf('{');
  if (start === -1) return null;
  const cleanStr = jsonStr.substring(start);
  
  for (let i = cleanStr.length; i > 0; i--) {
    const candidate = cleanStr.substring(0, i);
    const repaired = repairJson(candidate);
    try {
      return JSON.parse(repaired);
    } catch (e) {
      // continue backtracking
    }
  }
  return null;
}

const processMetadata = (meta) => {
  if (!meta) return null;
  if (meta.raw_extraction && typeof meta.raw_extraction === 'string') {
    const repaired = tryParseAndRepair(meta.raw_extraction);
    if (repaired && Object.keys(repaired).length > 0) {
      return { ...meta, ...repaired };
    }
  }
  return meta;
};

function formatOcrText(text) {
  if (!text) return '';
  
  // Fix spacing between sentences (period followed by capital letter)
  let processed = text.replace(/([.!?])([A-Z])/g, '$1 $2');
  
  // Split by lines
  const lines = processed.split('\n');
  const formattedLines = lines.map(line => {
    const trimmed = line.trim();
    if (!trimmed) return '';
    
    // Check if it's one of the header lines to bold and add space
    const upperTrimmed = trimmed.toUpperCase();
    if (
      upperTrimmed.length < 100 && (
        upperTrimmed.includes("MADHYA PRADESH STATE ELECTRONICS DEVELOPMENT") ||
        upperTrimmed.includes("STATE IT CENTRE, 47-A") ||
        upperTrimmed.includes("TENDER DOCUMENT / NOTICE INVIT")
      )
    ) {
      if (upperTrimmed.includes("TENDER DOCUMENT / NOTICE INVIT")) {
        // Center align the document type and add margins around it
        // We add a newline after the div to separate it from the next paragraph in Markdown
        return `<div style="text-align: center; font-weight: bold; margin: 12px 0;">${trimmed}</div>\n`;
      }
      
      let boldLine = `**${trimmed}**`;
      if (upperTrimmed.includes("STATE IT CENTRE, 47-A")) {
        boldLine += `\n`; // Add space between address and document type
      }
      return boldLine;
    }
    
    // Check if line looks like a section header (e.g. starts with digit followed by dot, like "1. BRIEF SCOPE OF WORK")
    if (/^\d+\.\s+[A-Z\s\/\&,-]+$/.test(trimmed)) {
      return `\n### ${trimmed}`;
    }
    
    // Check if line matches a bullet point
    const bulletMatch = trimmed.match(/^([-\*\+•]|\d+\.)\s*(.*)$/);
    let content = trimmed;
    let prefix = '';
    if (bulletMatch) {
      prefix = bulletMatch[1] + ' ';
      content = bulletMatch[2];
    }
    
    // Check if it contains a key-value pattern (contains ':' but is not part of a URL or time)
    const timeMatch = content.match(/\b\d{1,2}:\d{2}\b/);
    const hasTime = timeMatch && content.indexOf(':') === content.indexOf(timeMatch[0]) + timeMatch[0].indexOf(':');
    
    const colonIdx = content.indexOf(':');
    if (colonIdx > 0 && colonIdx < 50 && !content.startsWith('http') && !content.startsWith('https') && !hasTime) {
      const key = content.substring(0, colonIdx).trim();
      const val = content.substring(colonIdx + 1).trim();
      
      // Check if the key is a valid key
      if (key.length > 0 && !/^\d+$/.test(key) && !/[.!?]/.test(key)) {
        return `${prefix}**${key}**: ${val}`;
      }
    }
    
    return trimmed;
  });
  
  return formattedLines.join('\n');
}

export const DocumentWorkspace = ({ activeTenderId }) => {
  const [file, setFile] = useState(null);
  const [docType, setDocType] = useState('PQ_LEGAL_FINANCIAL');
  const [vendorId, setVendorId] = useState('');
  const [vendors, setVendors] = useState([]);
  
  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [uploadedDoc, setUploadedDoc] = useState(null);
  const [extractedMeta, setExtractedMeta] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  
  const [editedMeta, setEditedMeta] = useState({});
  const [saving, setSaving] = useState(false);
  const [committing, setCommitting] = useState(false);

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

  useEffect(() => {
    let interval;
    if (uploadedDoc && uploadedDoc.status === 'PROCESSING') {
      interval = setInterval(async () => {
        try {
          const res = await api.getDocumentStatus(uploadedDoc.document_id || uploadedDoc.id);
          if (res.status !== 'PROCESSING') {
            clearInterval(interval);
            handleViewDocument(uploadedDoc.document_id || uploadedDoc.id);
            loadHistory();
          }
        } catch (err) {
          console.error("Polling error:", err);
        }
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [uploadedDoc]);

  useEffect(() => {
    if (extractedMeta) {
      setEditedMeta(extractedMeta);
    } else {
      setEditedMeta({});
    }
  }, [extractedMeta]);

  async function handleSaveDraft() {
    if (!uploadedDoc) return;
    setSaving(true);
    try {
      await api.updateDocumentMetadata(uploadedDoc.document_id || uploadedDoc.id, { metadata: editedMeta });
      alert("Draft saved successfully.");
      handleViewDocument(uploadedDoc.document_id || uploadedDoc.id);
    } catch(err) {
      alert(`Save failed: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleCommit() {
    if (!uploadedDoc) return;
    setCommitting(true);
    try {
      const res = await api.commitDocument(uploadedDoc.document_id || uploadedDoc.id);
      alert(res.message);
      handleViewDocument(uploadedDoc.document_id || uploadedDoc.id);
      loadHistory();
    } catch(err) {
      alert(`Commit failed: ${err.message}`);
    } finally {
      setCommitting(false);
    }
  }

  function handleMetaChange(key, val) {
    setEditedMeta(prev => ({ ...prev, [key]: val }));
  }

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragActive(true);
  };
  
  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragActive(false);
  };
  
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  // Reload history whenever the active tender changes
  useEffect(() => {
    loadHistory();
    // Clear current view when tenant switches
    setUploadedDoc(null);
    setExtractedMeta(null);
  }, [activeTenderId]);

  async function loadHistory() {
    setHistoryLoading(true);
    try {
      const data = await api.getDocumentHistory(activeTenderId);
      setHistory(data);
    } catch (err) {
      console.error('Error loading OCR history:', err);
    } finally {
      setHistoryLoading(false);
    }
  }

  async function handleFileChange(e) {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  }

  async function handleUpload(e) {
    e.preventDefault();
    if (!file) return;

    setUploading(true);
    setUploadedDoc(null);
    setExtractedMeta(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('document_type', docType);
    if (activeTenderId) formData.append('tender_id', activeTenderId);
    if (vendorId) formData.append('vendor_id', vendorId);

    try {
      const data = await api.uploadDocument(formData);
      setUploadedDoc({ ...data, isNew: true });
      setExtractedMeta(null);
      setFile(null);
    } catch (err) {
      alert(`Upload/OCR Failed: ${err.message}`);
    } finally {
      setUploading(false);
    }
  }



  async function handleViewDocument(docId) {
    setExtracting(true);
    try {
      const doc = await api.getDocument(docId);
      // Ensure accuracy_estimate is set for the stats display
      const normalised = {
        ...doc,
        document_id: doc.id,
        accuracy_estimate: doc.accuracy_estimate ?? doc.ocr_accuracy ?? 0,
        isNew: false,
      };
      setUploadedDoc(normalised);
      // Try to parse stored metadata; fall back to null (right pane will show OCR text)
      const parsed = processMetadata(doc.metadata);
      setExtractedMeta(parsed || null);
    } catch (err) {
      alert(`Failed to load document: ${err.message}`);
    } finally {
      setExtracting(false);
    }
  }

  function handleDownloadDocument(docId) {
    // Opens the download endpoint directly – FileResponse on the backend serves the file
    window.open(api.getDocumentDownloadUrl(docId), '_blank');
  }

  async function handleDownloadMetadataPDF() {
    if (!uploadedDoc) return;
    setDownloading(true);
    try {
      const container = document.createElement('div');
      container.style.padding = '30px';
      container.style.fontFamily = 'system-ui, -apple-system, sans-serif';
      container.style.color = '#1e293b';

      const keysToExclude = [
        'document_id', 'file_name', 'extracted_at', 'processed_at', 
        'file_size_bytes', 'ocr_method', 'accuracy_estimate', 
        'total_chars_extracted', 'vector_stored', 'raw_extraction', 
        'extraction_status', 'document_text_summary'
      ];
      
      const formatKey = (str) => {
        return str.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
      };

      let metaHtml = '';
      if (extractedMeta) {
        Object.entries(extractedMeta).forEach(([key, value]) => {
          if (keysToExclude.includes(key)) return;
          if (value === null || value === undefined || value === '') return;

          let valHtml = '';
          if (Array.isArray(value)) {
            valHtml = `<ul style="margin: 5px 0 15px 20px; padding: 0;">${value.map(v => `<li style="margin-bottom: 4px;">${v}</li>`).join('')}</ul>`;
          } else if (typeof value === 'object') {
            valHtml = `<div style="margin: 5px 0 15px 0; padding: 10px; background: #f8fafc; border-radius: 4px; border: 1px solid #e2e8f0;">`;
            Object.entries(value).forEach(([subKey, subVal]) => {
              valHtml += `<div style="margin-bottom: 6px;"><strong>${formatKey(subKey)}:</strong> ${subVal}</div>`;
            });
            valHtml += `</div>`;
          } else {
            valHtml = `<div style="margin: 5px 0 15px 0;">${marked.parse(String(value))}</div>`;
          }

          metaHtml += `
            <div style="margin-bottom: 10px;">
              <div style="font-weight: bold; color: #0f172a; font-size: 14px;">${formatKey(key)}:</div>
              <div style="font-size: 13px; color: #334155;">${valHtml}</div>
            </div>
          `;
        });
      }

      const textSummary = extractedMeta?.document_text_summary || uploadedDoc.ocr_text_preview || '';
      const textHtml = marked.parse(formatOcrText(textSummary));

      container.innerHTML = `
        <div style="margin-bottom: 20px; border-bottom: 2px solid #ddd; padding-bottom: 15px;">
          <h1 style="font-size: 20px; color: #0f172a; margin-bottom: 10px;">Document Metadata Extract</h1>
          <div style="font-size: 14px; color: #64748b;">
            <div><strong>File:</strong> ${uploadedDoc.file_name || 'N/A'}</div>
            <div><strong>Category:</strong> ${uploadedDoc.document_type || 'N/A'}</div>
            <div><strong>Accuracy Estimate:</strong> ${((uploadedDoc.accuracy_estimate || uploadedDoc.ocr_accuracy || 0) * (uploadedDoc.accuracy_estimate <= 1 ? 100 : 1)).toFixed(0)}%</div>
          </div>
        </div>
        <div style="margin-bottom: 20px;">
          <h2 style="font-size: 16px; color: #0f172a; margin-bottom: 12px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">Structured Metadata</h2>
          ${metaHtml || '<div style="color: #64748b; font-size: 13px;">No structured metadata extracted.</div>'}
        </div>
        <div>
          <h2 style="font-size: 16px; color: #0f172a; margin-bottom: 12px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">Extracted Text Content</h2>
          <div style="font-size: 13px; line-height: 1.5; color: #334155;">
            ${textHtml || '<div style="color: #64748b; font-size: 13px;">No text content available.</div>'}
          </div>
        </div>
      `;

      const opt = {
        margin:       10,
        filename:     `${uploadedDoc.file_name || 'Document'}_Metadata.pdf`,
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%', height: '100%', maxWidth: '700px', margin: '0 auto' }}>
      <ActiveTenderBadge activeTenderId={activeTenderId} />
      {/* Upload Form & Metadata Extractor */}
      <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
        <h2 style={{ fontSize: '16px', fontWeight: '600', borderBottom: '1px solid var(--card-border)', paddingBottom: '10px' }}>
          Document Upload & OCR pipeline
        </h2>

        <form onSubmit={handleUpload} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div 
            className={`drop-zone ${isDragActive ? 'drop-active' : ''}`}
            style={{ 
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              minHeight: '140px',
              padding: '24px', 
              textAlign: 'center', 
              cursor: 'pointer',
              boxSizing: 'border-box'
            }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => document.getElementById('file-picker').click()}
          >
            {(uploading || extracting) ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div className="scan-laser-container">
                  <div className="scan-laser"></div>
                  <FileText size={32} style={{ color: 'var(--text-muted)', margin: '18px auto' }} />
                </div>
                <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--accent-violet)', marginTop: '8px' }}>
                  {uploading ? 'Scanning Document...' : 'Extracting Data...'}
                </div>
              </div>
            ) : (
              <>
                <Upload size={32} style={{ color: isDragActive ? 'var(--accent-violet)' : 'var(--text-muted)', marginBottom: '12px', transition: 'color 0.2s' }} />
                <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', lineHeight: '1.3' }}>
                  {file ? file.name : 'Drag & Drop or Click to Browse'}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px', lineHeight: '1.4' }}>
                  Supports PDF, DOC, DOCX up to 10MB
                </div>
              </>
            )}
            <input 
              id="file-picker"
              type="file" 
              accept=".pdf,.doc,.docx"
              style={{ display: 'none' }}
              onChange={handleFileChange}
              disabled={uploading || extracting}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600' }}>Document Category</label>
              <select 
                className="glass-input" 
                style={{ marginTop: '6px' }}
                value={docType}
                onChange={e => setDocType(e.target.value)}
              >

                <option value="PQ_LEGAL_FINANCIAL">Vendor PQ - Legal & Financial Profile</option>
                <option value="PQ_EXPERIENCE_CERTS">Vendor PQ - Experience & Certifications</option>
                <option value="VENDOR_TECH">Vendor Technical Proposal</option>
                <option value="VENDOR_FINANCIAL">Vendor Commercial Quote</option>
                <option value="GENERAL">General Audit Document</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600' }}>Vendor</label>
              <select 
                required
                className="glass-input"
                style={{ marginTop: '6px' }}
                value={vendorId}
                onChange={e => setVendorId(e.target.value)}
              >
                <option value="">-- Select Vendor --</option>
                {vendors.map(v => (
                  <option key={v.id} value={v.id}>{v.vendor_name} (ID: {v.id})</option>
                ))}
              </select>
            </div>
          </div>

          <button 
            type="submit" 
            className="btn-primary" 
            style={{ justifyContent: 'center' }}
            disabled={uploading || !file}
          >
            <Upload size={16} />
            {uploading ? 'Processing OCR & Embeddings...' : 'Upload & Process OCR'}
          </button>
        </form>

        {uploadedDoc && (
          <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px solid var(--card-border)', paddingTop: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <CheckCircle size={16} color="var(--color-success)" />
                <span style={{ fontSize: '13px', fontWeight: '600' }}>OCR Processing Complete</span>
              </div>
              
              {uploadedDoc && uploadedDoc.status !== 'COMMITTED' && (
                <div style={{ display: 'flex', gap: '12px', marginTop: '20px', borderTop: '1px solid var(--card-border)', paddingTop: '16px' }}>
                  <button 
                    className="btn-secondary" 
                    style={{ flex: 1, justifyContent: 'center', borderColor: 'var(--color-success)', color: 'var(--color-success)' }}
                    onClick={handleSaveDraft}
                    disabled={saving || committing}
                  >
                    {saving ? 'Saving...' : 'Save Draft'}
                  </button>
                  <button 
                    className="btn-primary" 
                    style={{ flex: 1, justifyContent: 'center', background: 'var(--color-success)' }}
                    onClick={handleCommit}
                    disabled={saving || committing}
                  >
                    <CheckCircle size={16} style={{ marginRight: '6px' }} />
                    {committing ? 'Committing...' : 'Lock & Commit to Vector DB'}
                  </button>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', fontSize: '12px', background: 'var(--overlay-bg)', border: '1px solid var(--card-border)', padding: '10px', borderRadius: '6px' }}>
              <div>Accuracy: <strong>{(uploadedDoc.accuracy_estimate * 100).toFixed(0)}%</strong></div>
            </div>


          </div>
        )}
      </div>



      {/* ── OCR Processing History — full-width row ── */}
      <div
        className="glass-card"
        style={{
          gridColumn: '1 / -1',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          marginTop: '4px',
          maxHeight: '260px',
          overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--card-border)', paddingBottom: '10px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: '700' }}>OCR Processing History</h2>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{history.length} document{history.length !== 1 ? 's' : ''} processed</span>
        </div>

        {historyLoading && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80px', color: 'var(--text-muted)', fontSize: '12px' }}>
            Loading history...
          </div>
        )}

        {!historyLoading && history.length === 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80px', color: 'var(--text-muted)', fontSize: '12px' }}>
            No documents processed yet. Upload a document above to begin.
          </div>
        )}

        {!historyLoading && history.length > 0 && (
          <div style={{ overflowY: 'auto', flex: 1 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--card-border)', color: 'var(--text-muted)', textAlign: 'left' }}>
                  <th style={{ padding: '6px 10px', fontWeight: '600', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>#</th>
                  <th style={{ padding: '6px 10px', fontWeight: '600', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Document</th>
                  <th style={{ padding: '6px 10px', fontWeight: '600', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Category</th>
                  <th style={{ padding: '6px 10px', fontWeight: '600', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Vendor ID</th>

                  <th style={{ padding: '6px 10px', fontWeight: '600', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'center' }}>Accuracy</th>
                  <th style={{ padding: '6px 10px', fontWeight: '600', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'center' }}>Vector</th>
                  <th style={{ padding: '6px 10px', fontWeight: '600', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Processed At</th>
                  <th style={{ padding: '6px 10px', fontWeight: '600', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {history.map((doc, idx) => (
                  <tr
                    key={doc.id}
                    style={{
                      borderBottom: '1px solid var(--card-border)',
                      background: idx % 2 === 0 ? 'transparent' : 'var(--overlay-bg)',
                      transition: 'background 0.15s',
                    }}
                  >
                    <td style={{ padding: '8px 10px', color: 'var(--text-muted)' }}>{doc.id}</td>
                    <td style={{ padding: '8px 10px', fontWeight: '600', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {doc.file_name}
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      <span className="badge badge-info badge-pill">{doc.document_type}</span>
                    </td>
                    <td style={{ padding: '8px 10px', color: doc.vendor_id ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: doc.vendor_id ? '600' : 'normal' }}>
                      {doc.vendor_id ?? '—'}
                    </td>

                    <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                      <span className={`badge badge-pill ${doc.ocr_accuracy >= 90 ? 'badge-success' : doc.ocr_accuracy >= 70 ? 'badge-warning' : 'badge-danger'}`}>
                        {doc.ocr_accuracy}%
                      </span>
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                      {doc.vector_stored
                        ? <span className="badge badge-success badge-pill">✓ Yes</span>
                        : <span className="badge badge-danger badge-pill">✗ No</span>
                      }
                    </td>
                    <td style={{ padding: '8px 10px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {doc.created_at ? new Date(doc.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                        <button 
                          onClick={() => handleViewDocument(doc.id)}
                          style={{ background: 'none', border: '1px solid var(--card-border)', borderRadius: '4px', padding: '4px 6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: 'var(--text-secondary)' }}
                          title="View OCR & Metadata"
                        >
                          <Eye size={12} /> View
                        </button>
                        <button 
                          onClick={() => handleDownloadDocument(doc.id)}
                          style={{ background: 'none', border: '1px solid var(--card-border)', borderRadius: '4px', padding: '4px 6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: 'var(--text-secondary)' }}
                          title="Download Document File"
                        >
                          <Download size={12} /> DL
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default DocumentWorkspace;
