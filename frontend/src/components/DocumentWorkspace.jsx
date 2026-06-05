import React, { useState, useEffect } from 'react';
import { Upload, FileText, CheckCircle, Brain, Eye, List } from 'lucide-react';
import api from '../services/api';
import StreamText from './StreamText';
import FlowConnector from './FlowConnector';
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
  const [docType, setDocType] = useState('TENDER');
  const [vendorId, setVendorId] = useState('');
  
  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [uploadedDoc, setUploadedDoc] = useState(null);
  const [extractedMeta, setExtractedMeta] = useState(null);

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
      setExtractedMeta(processMetadata(data.metadata));
      setFile(null);
    } catch (err) {
      alert(`Upload/OCR Failed: ${err.message}`);
    } finally {
      setUploading(false);
    }
  }

  async function handleExtractMetadata() {
    if (!uploadedDoc?.document_id) return;
    setExtracting(true);
    try {
      const data = await api.extractDocumentMetadata(uploadedDoc.document_id);
      setExtractedMeta(processMetadata(data));
    } catch (err) {
      alert(`Metadata Extraction Failed: ${err.message}`);
    } finally {
      setExtracting(false);
    }
  }

  return (
    <div className="panel-grid panel-grid-2">
      {/* Left Pane: Upload Form & Metadata Extractor */}
      <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto', alignSelf: 'center' }}>
        <h2 style={{ fontSize: '16px', fontWeight: '600', borderBottom: '1px solid var(--card-border)', paddingBottom: '10px' }}>
          Document Upload & OCR pipeline
        </h2>

        <form onSubmit={handleUpload} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ 
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            border: '2px dashed var(--card-border)', 
            borderRadius: '8px', 
            width: '240px',
            height: '115px',
            margin: '0 auto',
            padding: '16px', 
            textAlign: 'center', 
            background: 'var(--overlay-bg)',
            cursor: 'pointer',
            transition: 'border-color 0.2s',
            boxSizing: 'border-box'
          }}
          onClick={() => document.getElementById('file-picker').click()}
          >
            <Upload size={28} style={{ color: 'var(--text-muted)', marginBottom: '8px' }} />
            <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)', lineHeight: '1.3' }}>
              {file ? file.name : 'Click to Browse Bid/Tender Document'}
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px', lineHeight: '1.2' }}>
              Supports PDF, DOC, DOCX up to 10MB
            </div>
            <input 
              id="file-picker"
              type="file" 
              accept=".pdf,.doc,.docx"
              style={{ display: 'none' }}
              onChange={handleFileChange}
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
                <option value="TENDER">Tender Document (RFP)</option>
                <option value="VENDOR_PQ">Vendor Pre-Qualification (PQ)</option>
                <option value="VENDOR_TECH">Vendor Technical Proposal</option>
                <option value="VENDOR_FINANCIAL">Vendor Commercial Quote</option>
                <option value="GENERAL">General Audit Document</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600' }}>Vendor ID (Optional)</label>
              <input 
                type="number" 
                placeholder="Leave blank if Tender" 
                className="glass-input"
                style={{ marginTop: '6px' }}
                value={vendorId}
                onChange={e => setVendorId(e.target.value)}
              />
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
              <span className="badge badge-info" style={{ fontSize: '9px' }}>{uploadedDoc.ocr_method}</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '12px', background: 'var(--overlay-bg)', border: '1px solid var(--card-border)', padding: '10px', borderRadius: '6px' }}>
              <div>Chars Extracted: <strong>{uploadedDoc.total_chars_extracted}</strong></div>
              <div>Accuracy: <strong>{(uploadedDoc.accuracy_estimate * 100).toFixed(0)}%</strong></div>
            </div>

            {uploadedDoc.document_type === 'TENDER' && (
              <button 
                className="btn-secondary" 
                style={{ alignSelf: 'flex-start', gap: '8px', background: 'rgba(139, 92, 246, 0.15)', borderColor: 'rgba(139, 92, 246, 0.3)' }}
                onClick={handleExtractMetadata}
                disabled={extracting}
              >
                <Brain size={16} color="var(--accent-violet)" />
                {extracting ? 'Gemma3 Extracting...' : 'Extract Tender Metadata'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Right Pane: OCR Output / Extracted Metadata */}
      <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', overflow: 'hidden' }}>
        <h2 style={{ fontSize: '16px', fontWeight: '600', borderBottom: '1px solid var(--card-border)', paddingBottom: '10px' }}>
          Extracted structured Metadata & Text
        </h2>

        {extracting && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '12px' }}>
            <div className="terminal-cursor" style={{ width: '12px', height: '22px' }}></div>
            <div style={{ color: 'var(--text-secondary)' }}>AI Agent is parsing dates, budgets, and criteria clauses...</div>
          </div>
        )}

        {!extracting && !uploadedDoc && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', textAlign: 'center' }}>
            Upload a document on the left to see the OCR<br/>transcription and structural AI parsing.
          </div>
        )}

        {!extracting && uploadedDoc && (() => {
          const keysToExclude = [
            'document_id', 'file_name', 'extracted_at', 'processed_at', 
            'file_size_bytes', 'ocr_method', 'accuracy_estimate', 
            'total_chars_extracted', 'vector_stored', 'raw_extraction', 
            'extraction_status'
          ];
          
          const hasVisibleKeys = extractedMeta && Object.entries(extractedMeta).some(([key, value]) => {
            if (keysToExclude.includes(key)) return false;
            if (value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) return false;
            return true;
          });
          
          const displayMeta = hasVisibleKeys ? extractedMeta : {
            document_text_summary: uploadedDoc?.ocr_text_preview ? 
              uploadedDoc.ocr_text_preview : 
              'No text could be extracted.'
          };

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto', flex: 1, paddingRight: '4px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {Object.entries(displayMeta).map(([key, value]) => {
                  if (keysToExclude.includes(key)) return null;
                  if (value === null || value === undefined || value === '') return null;

                  const formatKey = (str) => {
                    return str
                      .split('_')
                      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                      .join(' ');
                  };

                  let renderedVal = null;
                  if (Array.isArray(value)) {
                    renderedVal = (
                      <ul style={{ margin: '4px 0 0 0', paddingLeft: '20px', listStyleType: 'disc' }}>
                        {value.map((item, idx) => (
                          <li key={idx} style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px', lineHeight: '1.4' }}>
                            <StreamText text={item} speed={8} simulate={uploadedDoc?.isNew} />
                          </li>
                        ))}
                      </ul>
                    );
                  } else if (typeof value === 'object') {
                    renderedVal = (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px', marginTop: '6px' }}>
                        {Object.entries(value).map(([subKey, subVal]) => (
                          <div key={subKey} style={{ background: 'var(--overlay-bg)', padding: '6px 10px', borderRadius: '4px', border: '1px solid var(--card-border)' }}>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>{formatKey(subKey)}</div>
                            <div style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-primary)', marginTop: '2px' }}>
                              <StreamText text={String(subVal)} speed={8} simulate={uploadedDoc?.isNew} />
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  } else {
                    const isTextSummary = key === 'document_text_summary';
                    renderedVal = (
                      <div 
                        className={isTextSummary ? "output-stream-card" : ""} 
                        style={{ 
                          fontSize: '13px', 
                          color: 'var(--text-secondary)', 
                          marginTop: '4px', 
                          lineHeight: '1.4',
                          padding: isTextSummary ? '18px' : undefined,
                          borderRadius: isTextSummary ? '8px' : undefined
                        }}
                      >
                        <StreamText text={formatOcrText(String(value))} speed={8} simulate={uploadedDoc?.isNew} markdown={true} />
                      </div>
                    );
                  }

                  const isTextSummary = key === 'document_text_summary';

                  return (
                    <div key={key} style={{ borderBottom: isTextSummary ? 'none' : '1px solid var(--card-border)', paddingBottom: '12px' }}>
                      {!isTextSummary && (
                        <div style={{ fontSize: '13px', color: 'var(--text-primary)' }}>
                          <strong>{formatKey(key)}</strong>:
                        </div>
                      )}
                      {renderedVal}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}</div>
    </div>
  );
};

export default DocumentWorkspace;
