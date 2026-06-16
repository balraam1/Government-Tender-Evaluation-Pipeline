import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Upload, FileText, CheckCircle, XCircle, ShieldCheck, Award, DollarSign,
  Play, ChevronDown, ChevronRight, AlertTriangle, Brain, Eye, Download,
  FileDown, UserPlus, X, Plus, Trash2, Clock, Users, CheckCircle2,
  TrendingDown, Mail, Send, List, Database, RefreshCw, AlertCircle
} from 'lucide-react';
import html2pdf from 'html2pdf.js';
import { marked } from 'marked';
import api from '../services/api';
import ActiveTenderBadge from './ActiveTenderBadge';
import StreamText from './StreamText';
import FlowConnector from './FlowConnector';

// ─── Constants ───────────────────────────────────────────────────
const DOC_CATEGORIES = [
  { key: 'PQ_LEGAL_FINANCIAL', label: 'PQ — Legal & Financial Profile' },
  { key: 'PQ_EXPERIENCE_CERTS', label: 'PQ — Experience & Certifications' },
  { key: 'VENDOR_TECH', label: 'Technical Proposal' },
  { key: 'VENDOR_FINANCIAL', label: 'Commercial Quote' },
  { key: 'GENERAL', label: 'General Audit Document' },
];

const DOC_OPTIONS = [
  "Certificate of Incorporation", "CA Certificate with UDIN", "Audited Financial Statements",
  "Work Order / PO for similar project", "Client Completion Certificate", "GST Registration Certificate",
  "PAN Card Copy", "Undertaking for Solution Readiness", "Self-Declaration (Non-Blacklisting)"
];

const CLAUSE_OPTIONS = [
  "Scope of Work acceptance", "SLA terms acceptance", "Penalty clause acceptance",
  "Data security compliance", "On-premises deployment commitment"
];

const PIPELINE_STEPS = [
  { id: 'docs', label: 'Documents' },
  { id: 'pq', label: 'Pre-Qualification' },
  { id: 'tech', label: 'Tech Evaluation' },
  { id: 'financial', label: 'Financial Award' },
  { id: 'final', label: 'Recommendation' },
];

// ─── Helpers ─────────────────────────────────────────────────────
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
  processed = processed.replace(/(Summary of Findings:)/g, '**Summary of Findings:**');
  return processed;
}

// ─── Main Component ──────────────────────────────────────────────
const StartEvaluationWorkspace = ({ activeTenderId }) => {
  // ── Pipeline state ──
  const [pipelineStage, setPipelineStage] = useState('docs'); // docs | pq | tech | financial | final
  
  // ── Vendors ──
  const [allVendors, setAllVendors] = useState([]);
  const [participatingVendors, setParticipatingVendors] = useState([]); // vendors with docs uploaded
  const [pqPassedVendors, setPqPassedVendors] = useState([]);
  const [techQualifiedVendors, setTechQualifiedVendors] = useState([]);

  // ── History ──
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [evaluationHistory, setEvaluationHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // ── Card 1: Document Upload ──
  const [docVendorId, setDocVendorId] = useState('');
  const [docType, setDocType] = useState('PQ_LEGAL_FINANCIAL');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const [vendorDocs, setVendorDocs] = useState({}); // { vendorId: { category: docData } }
  const [docHistory, setDocHistory] = useState([]);
  const [uploadError, setUploadError] = useState(null);

  // ── Card 2: Pre-Qualification ──
  const [pqSelectedVendor, setPqSelectedVendor] = useState(null);
  const [pqForms, setPqForms] = useState({}); // { vendorId: formData }
  const [pqEvaluating, setPqEvaluating] = useState(false);
  const [pqResults, setPqResults] = useState({}); // { vendorId: result }
  const [pqAllDone, setPqAllDone] = useState(false);

  // ── Card 3: Technical Eval ──
  const [techSelectedVendor, setTechSelectedVendor] = useState(null);
  const [techForms, setTechForms] = useState({}); // { vendorId: formData }
  const [techEvaluating, setTechEvaluating] = useState(false);
  const [techResults, setTechResults] = useState({}); // { vendorId: result }
  const [techAllDone, setTechAllDone] = useState(false);

  // ── Card 4: Financial ──
  const [finBids, setFinBids] = useState({}); // { vendorId: { total_amount, base_price, tax_amount, ... } }
  const [finSelectedVendor, setFinSelectedVendor] = useState(null);
  const [finEvaluating, setFinEvaluating] = useState(false);
  const [finData, setFinData] = useState(null);
  const [finDone, setFinDone] = useState(false);

  // ── Card 5: Final Recommendation ──
  const [recommending, setRecommending] = useState(false);
  const [recommendation, setRecommendation] = useState(null);
  const [downloading, setDownloading] = useState(false);

  // ── Refs for scroll-into-view ──
  const pqCardRef = useRef(null);
  const techCardRef = useRef(null);
  const finCardRef = useRef(null);
  const finalCardRef = useRef(null);
  // ── Session timestamp: only show docs uploaded THIS session ──
  const sessionStartTime = useRef(new Date().toISOString());

  // ─── Load vendors ───
  useEffect(() => {
    loadVendors();
    if (activeTenderId) {
      loadEvaluationHistory();
      // NOTE: We do NOT auto-load doc history on mount.
      // Docs are session-only — user must re-upload each session.
      // This ensures OCR+metadata is always fresh when Proceed to Evaluation is clicked.
    }
  }, [activeTenderId]);

  async function loadVendors() {
    try {
      const data = await api.listVendors();
      setAllVendors(data);
    } catch (err) {
      console.error("Error loading vendors:", err);
    }
  }

  async function loadDocHistory() {
    try {
      const data = await api.getDocumentHistory(activeTenderId);
      // ─── Session filter: only show docs uploaded during THIS browser session ───
      // This prevents previously uploaded documents from bleeding into a fresh session.
      const sessionDocs = (data || []).filter(doc => {
        if (!doc.created_at) return true; // keep if no timestamp
        return new Date(doc.created_at) >= new Date(sessionStartTime.current);
      });
      setDocHistory(sessionDocs);
      // Build vendorDocs map from session-only history
      const vDocs = {};
      sessionDocs.forEach(doc => {
        if (!doc.vendor_id) return;
        if (!vDocs[doc.vendor_id]) vDocs[doc.vendor_id] = {};
        vDocs[doc.vendor_id][doc.document_type] = doc;
      });
      setVendorDocs(vDocs);
      // Determine participating vendors (those with at least one doc this session)
      const vendorIds = Object.keys(vDocs).map(Number);
      setParticipatingVendors(vendorIds);
    } catch (err) {
      console.error("Error loading doc history:", err);
    }
  }

  async function loadEvaluationHistory() {
    setHistoryLoading(true);
    try {
      const [pqRes, techRes, finRes, recHist] = await Promise.all([
        api.getPQResults(activeTenderId).catch(() => []),
        api.getTechnicalResults(activeTenderId).catch(() => []),
        api.getFinancialResults(activeTenderId).catch(() => []),
        api.getRecommendationHistory(activeTenderId).catch(() => [])
      ]);
      
      const history = [];
      recHist.forEach(rec => {
        history.push({
          id: rec.id,
          date: rec.created_at,
          vendors: rec.bidders_summary.map(b => b.vendor_name),
          pqCount: rec.bidders_summary.filter(b => b.pq_status && b.pq_status !== 'NOT_EVALUATED').length,
          pqPassed: rec.bidders_summary.filter(b => b.pq_status === 'PASS').length,
          techCount: rec.bidders_summary.filter(b => b.tech_status && b.tech_status !== 'NOT_EVALUATED').length,
          techQualified: rec.bidders_summary.filter(b => b.tech_status === 'QUALIFIED').length,
          finCount: rec.bidders_summary.filter(b => b.fin_rank && b.fin_rank !== 'N/A').length,
          award_report: rec.award_report,
          bidders_summary: rec.bidders_summary,
          risk_assessment: rec.risk_assessment,
          recommended_vendor_name: rec.recommended_vendor_name,
          rawPq: pqRes,
          rawTech: techRes,
          rawFin: finRes
        });
      });
      setEvaluationHistory(history);
    } catch (err) {
      console.error("Error loading evaluation history:", err);
    } finally {
      setHistoryLoading(false);
    }
  }

  function handleDownloadHistoryBER(h) {
    if (!h.award_report && !h.bidders_summary) {
      alert("This historical run does not have a saved final recommendation (it might only be PQ/Tech/Fin steps). Please generate a final BER to save it.");
      return;
    }
    const container = document.createElement('div');
    container.style.padding = '40px';
    container.style.fontFamily = 'system-ui, -apple-system, sans-serif';
    container.style.color = '#1e293b';

    const t = { tender_number: activeTenderId, title: 'Procurement Evaluation' };
    
    let biddersHtml = (h.bidders_summary || []).map(b => `
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
          <tr><td style="padding: 6px 0; width: 30%;"><strong>Tender Reference:</strong></td><td>${t.tender_number || 'N/A'}</td></tr>
          <tr><td style="padding: 6px 0;"><strong>Tender Title:</strong></td><td>${t.title || 'N/A'}</td></tr>
          <tr><td style="padding: 6px 0;"><strong>Department:</strong></td><td>${t.department || 'N/A'}</td></tr>
          <tr><td style="padding: 6px 0;"><strong>Estimated Budget:</strong></td><td>INR ${t.budget?.toLocaleString() || 'N/A'}</td></tr>
          <tr><td style="padding: 6px 0;"><strong>Recommended Vendor:</strong></td><td><strong style="color: #0f766e;">${h.recommended_vendor_name || 'N/A'}</strong></td></tr>
        </table>
      </div>
      <div style="margin-bottom: 30px;">
        <h2 style="font-size: 16px; font-weight: bold; background: #f8fafc; padding: 8px 12px; border-left: 4px solid #3b82f6; margin-bottom: 15px;">2. EVALUATION MATRIX SUMMARY</h2>
        <table style="width: 100%; font-size: 12px; border-collapse: collapse; text-align: left;">
          <thead><tr style="background: #e2e8f0;"><th style="padding: 10px;">Bidder Name</th><th style="padding: 10px;">PQ Status</th><th style="padding: 10px;">Tech Score</th><th style="padding: 10px;">Fin. Rank</th><th style="padding: 10px;">Quoted Price</th></tr></thead>
          <tbody>${biddersHtml}</tbody>
        </table>
      </div>
      <div style="margin-bottom: 30px; page-break-inside: avoid;">
        <h2 style="font-size: 16px; font-weight: bold; background: #f8fafc; padding: 8px 12px; border-left: 4px solid #eab308; margin-bottom: 15px;">3. AI JUSTIFICATION & RISK ASSESSMENT</h2>
        <div style="background: #fefce8; border: 1px solid #fef08a; padding: 15px; border-radius: 6px; font-size: 13px; line-height: 1.6; margin-bottom: 15px;">
          <strong>AI Recommendation Narrative:</strong><br/>${marked.parse(h.award_report || '')}
        </div>
        <div style="background: #fefce8; border: 1px solid #fef08a; padding: 15px; border-radius: 6px; font-size: 13px; line-height: 1.6;">
          <strong>Compliance & Risk Check:</strong><br/>${marked.parse(h.risk_assessment || 'No significant risks identified.')}
        </div>
      </div>
      <div style="margin-top: 50px; page-break-inside: avoid;">
        <h2 style="font-size: 16px; font-weight: bold; border-bottom: 1px solid #cbd5e1; padding-bottom: 10px; margin-bottom: 40px;">4. COMMITTEE APPROVAL</h2>
        <div style="display: flex; justify-content: space-between; text-align: center; margin-top: 60px;">
          <div style="width: 30%;"><div style="border-top: 1px solid #000; padding-top: 8px;">Prepared By<br/><span style="font-size: 11px; color: #64748b;">(Procurement Officer)</span></div></div>
          <div style="width: 30%;"><div style="border-top: 1px solid #000; padding-top: 8px;">Reviewed By<br/><span style="font-size: 11px; color: #64748b;">(Technical Committee)</span></div></div>
          <div style="width: 30%;"><div style="border-top: 1px solid #000; padding-top: 8px;">Approved By<br/><span style="font-size: 11px; color: #64748b;">(Chief General Manager)</span></div></div>
        </div>
      </div>
    `;

    const opt = {
      margin: 15,
      filename: `BER_${t.tender_number || 'Tender'}_Historical.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(container).save();
  }

  function handleDownloadEvalDetails(h) {
    const container = document.createElement('div');
    container.style.padding = '40px';
    container.style.fontFamily = 'system-ui, -apple-system, sans-serif';
    container.style.color = '#1e293b';

    const t = { tender_number: activeTenderId, title: 'Procurement Evaluation' };
    
    // PQ details
    let pqHtml = (h.rawPq || []).map(p => {
      const v = allVendors.find(vend => vend.id === p.vendor_id);
      return `<tr>
        <td style="padding:8px; border:1px solid #cbd5e1;">${v ? v.vendor_name : 'Vendor ' + p.vendor_id}</td>
        <td style="padding:8px; border:1px solid #cbd5e1;">${p.overall_status}</td>
        <td style="padding:8px; border:1px solid #cbd5e1;">${p.evaluator_override ? 'Manual Override: ' + p.evaluator_override : 'System'}</td>
        <td style="padding:8px; border:1px solid #cbd5e1;">${p.remarks || 'None'}</td>
      </tr>`;
    }).join('');

    // Tech details
    let techHtml = (h.rawTech || []).map(tch => {
      const v = allVendors.find(vend => vend.id === tch.vendor_id);
      return `<tr>
        <td style="padding:8px; border:1px solid #cbd5e1;">${v ? v.vendor_name : 'Vendor ' + tch.vendor_id}</td>
        <td style="padding:8px; border:1px solid #cbd5e1;">${tch.score} / 100</td>
        <td style="padding:8px; border:1px solid #cbd5e1;">${tch.qualification_status}</td>
        <td style="padding:8px; border:1px solid #cbd5e1;">${tch.remarks || 'None'}</td>
      </tr>`;
    }).join('');

    // Fin details
    let finHtml = (h.rawFin || []).map(f => {
      const v = allVendors.find(vend => vend.id === f.vendor_id);
      return `<tr>
        <td style="padding:8px; border:1px solid #cbd5e1;">${v ? v.vendor_name : 'Vendor ' + f.vendor_id}</td>
        <td style="padding:8px; border:1px solid #cbd5e1;">${f.ranking_label}</td>
        <td style="padding:8px; border:1px solid #cbd5e1;">INR ${f.quoted_price?.toLocaleString()}</td>
        <td style="padding:8px; border:1px solid #cbd5e1;">${f.remarks || 'None'}</td>
      </tr>`;
    }).join('');

    container.innerHTML = `
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="font-size: 24px; font-weight: bold; color: #0f172a;">DETAILED EVALUATION REPORT</h1>
        <div style="font-size: 14px; color: #475569;">Tender: ${t.tender_number || 'N/A'} | Run Date: ${new Date(h.date).toLocaleString()}</div>
      </div>
      
      <h2 style="font-size: 16px; font-weight: bold; background: #f8fafc; padding: 8px 12px; border-left: 4px solid #3b82f6;">1. PRE-QUALIFICATION DETAILS</h2>
      <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 20px;">
        <thead><tr style="background:#e2e8f0;"><th style="padding:8px; border:1px solid #cbd5e1;">Vendor</th><th style="padding:8px; border:1px solid #cbd5e1;">Status</th><th style="padding:8px; border:1px solid #cbd5e1;">Method</th><th style="padding:8px; border:1px solid #cbd5e1;">Remarks</th></tr></thead>
        <tbody>${pqHtml || '<tr><td colspan="4" style="padding:8px; text-align:center;">No PQ data</td></tr>'}</tbody>
      </table>

      <h2 style="font-size: 16px; font-weight: bold; background: #f8fafc; padding: 8px 12px; border-left: 4px solid #3b82f6;">2. TECHNICAL EVALUATION DETAILS</h2>
      <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 20px;">
        <thead><tr style="background:#e2e8f0;"><th style="padding:8px; border:1px solid #cbd5e1;">Vendor</th><th style="padding:8px; border:1px solid #cbd5e1;">Score</th><th style="padding:8px; border:1px solid #cbd5e1;">Status</th><th style="padding:8px; border:1px solid #cbd5e1;">Remarks</th></tr></thead>
        <tbody>${techHtml || '<tr><td colspan="4" style="padding:8px; text-align:center;">No Tech data</td></tr>'}</tbody>
      </table>

      <h2 style="font-size: 16px; font-weight: bold; background: #f8fafc; padding: 8px 12px; border-left: 4px solid #3b82f6;">3. FINANCIAL EVALUATION DETAILS</h2>
      <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 20px;">
        <thead><tr style="background:#e2e8f0;"><th style="padding:8px; border:1px solid #cbd5e1;">Vendor</th><th style="padding:8px; border:1px solid #cbd5e1;">Rank</th><th style="padding:8px; border:1px solid #cbd5e1;">Quoted Price</th><th style="padding:8px; border:1px solid #cbd5e1;">Remarks</th></tr></thead>
        <tbody>${finHtml || '<tr><td colspan="4" style="padding:8px; text-align:center;">No Fin data</td></tr>'}</tbody>
      </table>
    `;

    const opt = {
      margin: 15,
      filename: 'Evaluation_Details_Final.pdf',
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(container).save();
  }

  // ─── Document Upload Helpers ───
  const getVendorDocStatus = (vendorId) => {
    const docs = vendorDocs[vendorId] || {};
    return DOC_CATEGORIES.map(cat => ({
      ...cat,
      uploaded: !!docs[cat.key],
      doc: docs[cat.key] || null,
    }));
  };

  const isVendorDocsComplete = (vendorId) => {
    const docs = vendorDocs[vendorId] || {};
    return DOC_CATEGORIES.every(cat => !!docs[cat.key]);
  };

  const canProceedToEval = () => {
    return participatingVendors.some(vid => isVendorDocsComplete(vid));
  };

  async function handleUpload(e) {
    e.preventDefault();
    if (!file || !docVendorId) return;

    // --- Strict Validation Rule ---
    // Extract first word of vendor name (e.g. "Apex" from "Apex Hardware")
    const vendor = allVendors.find(v => v.id === parseInt(docVendorId));
    const vendorFirstName = vendor ? vendor.vendor_name.split(' ')[0].toLowerCase() : '';

    const CAT_KEYWORDS = {
      'PQ_LEGAL_FINANCIAL': ['legal', 'financial'],
      'PQ_EXPERIENCE_CERTS': ['experience', 'cert'],
      'VENDOR_TECH': ['tech'],
      'VENDOR_FINANCIAL': ['commercial', 'quote', 'financial'],
      'GENERAL': ['general', 'audit']
    };

    const fileName = file.name.toLowerCase();
    const keywords = CAT_KEYWORDS[docType] || [];
    
    const hasVendorMatch = vendorFirstName && fileName.includes(vendorFirstName);
    const hasCatMatch = keywords.some(kw => fileName.includes(kw));

    if (!hasVendorMatch || !hasCatMatch) {
      setUploadError(`Upload valid document: File name must match vendor ("${vendorFirstName}") and category type.`);
      setTimeout(() => setUploadError(null), 5000);
      return;
    }
    // --- End Validation ---

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('document_type', docType);
      if (activeTenderId) formData.append('tender_id', activeTenderId);
      formData.append('vendor_id', docVendorId);
      await api.uploadDocument(formData);
      setFile(null);
      // Reload doc history
      await loadDocHistory();
    } catch (err) {
      alert(`Upload Failed: ${err.message}`);
    } finally {
      setUploading(false);
    }
  }

  async function handleProceedToEval() {
    const completeVendors = participatingVendors.filter(vid => isVendorDocsComplete(vid));
    setPipelineStage('pq');
    // Auto-fill PQ forms for all complete vendors — properly await all
    await Promise.all(completeVendors.map(vid => autoFillPQForm(vid)));
    if (completeVendors.length > 0) {
      setPqSelectedVendor(completeVendors[0]);
    }
    setTimeout(() => pqCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300);
  }

  // Helper: clean a metadata value that might be null, "null", "N/A", "INR 8,10,00,000", etc.
  const cleanMetaValue = (val) => {
    if (val === null || val === undefined) return '';
    const str = String(val).trim();
    if (['null', 'n/a', 'none', 'not found', 'not available', '-'].includes(str.toLowerCase())) return '';
    return str;
  };

  // Helper: extract a numeric value from metadata (handles "INR 8,10,00,000" / "₹80,00,000" / "80 Lakhs" etc.)
  const cleanNumericValue = (val) => {
    const str = cleanMetaValue(val);
    if (!str) return '';
    // Remove currency symbols, commas, spaces
    let cleaned = str.replace(/[₹$,\s]/g, '').replace(/INR/gi, '').trim();
    // Handle "X Lakhs" / "X Lacs" / "X Cr" patterns
    const lakhMatch = cleaned.match(/([\d.]+)\s*(?:lakh|lac|lacs)/i);
    if (lakhMatch) return String(parseFloat(lakhMatch[1]) * 100000);
    const crMatch = cleaned.match(/([\d.]+)\s*(?:cr|crore)/i);
    if (crMatch) return String(parseFloat(crMatch[1]) * 10000000);
    // Strip all non-numeric except dots
    cleaned = cleaned.replace(/[^\d.]/g, '');
    return cleaned || '';
  };

  // ─── PQ Form Auto-fill ───
  async function autoFillPQForm(vendorId) {
    try {
      const docs = vendorDocs[vendorId] || {};
      // Default to false — only set true if doc extraction actually found values
      const form = {
        annual_turnover: '',
        years_experience: '',
        has_gst: false,
        has_pan: false,
        similar_project_value: '',
        certifications: '',
        gst_number: '',
        pan_number: '',
        ca_registration_number: '',
        business_type: '',
        state: '',
      };

      // From PQ_LEGAL_FINANCIAL
      if (docs.PQ_LEGAL_FINANCIAL) {
        try {
          const fullDoc = await api.getDocument(docs.PQ_LEGAL_FINANCIAL.id);
          const meta = fullDoc.metadata || {};
          console.log(`[PQ AutoFill] Vendor ${vendorId} PQ_LEGAL_FINANCIAL metadata:`, JSON.stringify(meta, null, 2));

          // Turnover: try average first, then yr3, yr2, yr1
          const turnoverStr = cleanNumericValue(meta.average_turnover) || cleanNumericValue(meta.annual_turnover_yr3) || cleanNumericValue(meta.annual_turnover_yr2) || cleanNumericValue(meta.annual_turnover_yr1);
          if (turnoverStr) form.annual_turnover = turnoverStr;

          // GST — only mark true if we actually extracted a GSTIN
          const gst = cleanMetaValue(meta.gstin_number);
          if (gst && gst.length >= 10) {
            form.has_gst = true;
            form.gst_number = gst;
          }
          // PAN — only mark true if we actually extracted a PAN
          const pan = cleanMetaValue(meta.pan_number);
          if (pan && pan.length >= 8) {
            form.has_pan = true;
            form.pan_number = pan;
          }
          const caReg = cleanMetaValue(meta.ca_registration_number);
          if (caReg) form.ca_registration_number = caReg;
          const bizType = cleanMetaValue(meta.business_type);
          if (bizType) form.business_type = bizType;
          const state = cleanMetaValue(meta.state);
          if (state) form.state = state;
          const dob = cleanMetaValue(meta.date_of_birth_incorporation);
          if (dob) {
            const yearMatch = dob.match(/\d{4}/);
            if (yearMatch) {
              const year = parseInt(yearMatch[0]);
              const years = new Date().getFullYear() - year;
              if (years > 0 && years < 200) form.years_experience = years.toString();
            }
          }
          const vendorName = cleanMetaValue(meta.vendor_name);
          if (vendorName) form.vendor_name = vendorName;
        } catch (err) {
          console.error(`[PQ AutoFill] Failed to fetch PQ_LEGAL_FINANCIAL for vendor ${vendorId}:`, err);
        }
      }

      // From PQ_EXPERIENCE_CERTS
      if (docs.PQ_EXPERIENCE_CERTS) {
        try {
          const fullDoc = await api.getDocument(docs.PQ_EXPERIENCE_CERTS.id);
          const meta = fullDoc.metadata || {};
          console.log(`[PQ AutoFill] Vendor ${vendorId} PQ_EXPERIENCE_CERTS metadata:`, JSON.stringify(meta, null, 2));

          const projVal = cleanNumericValue(meta.contract_value);
          if (projVal) form.similar_project_value = projVal;
          const certType = cleanMetaValue(meta.certificate_type);
          if (certType) form.certifications = certType;
          const clientName = cleanMetaValue(meta.client_name);
          if (clientName) form.client_name = clientName;
          const projectName = cleanMetaValue(meta.project_name);
          if (projectName) form.project_name = projectName;
        } catch (err) {
          console.error(`[PQ AutoFill] Failed to fetch PQ_EXPERIENCE_CERTS for vendor ${vendorId}:`, err);
        }
      }

      console.log(`[PQ AutoFill] Vendor ${vendorId} final form:`, JSON.stringify(form, null, 2));
      setPqForms(prev => ({ ...prev, [vendorId]: form }));
    } catch (err) {
      console.error("Error auto-filling PQ form:", err);
    }
  }

  async function handlePQEvaluate() {
    const vendorsToEval = participatingVendors.filter(vid => isVendorDocsComplete(vid));
    if (vendorsToEval.length === 0) return;

    setPqEvaluating(true);
    const results = {};

    for (const vendorId of vendorsToEval) {
      const form = pqForms[vendorId] || {};
      try {
        const result = await api.evaluatePQ({
          vendor_id: vendorId,
          tender_id: activeTenderId,
          annual_turnover: parseFloat(form.annual_turnover) || 0,
          years_experience: parseInt(form.years_experience) || 0,
          has_gst: form.has_gst !== false,
          has_pan: form.has_pan !== false,
          similar_project_value: parseFloat(form.similar_project_value) || 0,
          certifications: (form.certifications || '').split(',').map(c => c.trim()).filter(Boolean),
        });
        results[vendorId] = result;
      } catch (err) {
        results[vendorId] = { error: err.message, overall_status: 'ERROR' };
      }
    }

    setPqResults(results);
    setPqEvaluating(false);
    setPqAllDone(true);

    // Determine PQ-passed vendors
    const passed = Object.entries(results)
      .filter(([_, r]) => r.overall_status === 'PASS')
      .map(([vid]) => parseInt(vid));
    setPqPassedVendors(passed);

    if (passed.length > 0) {
      setPipelineStage('tech');
      // Auto-fill tech forms — properly await all
      await Promise.all(passed.map(vid => autoFillTechForm(vid)));
      setTechSelectedVendor(passed[0]);
      setTimeout(() => techCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300);
    }
  }

  // ─── Tech Form Auto-fill ───
  async function autoFillTechForm(vendorId) {
    try {
      const docs = vendorDocs[vendorId] || {};
      const form = {
        bidText: '',
        submittedDocs: ["Certificate of Incorporation", "CA Certificate with UDIN", "GST Registration Certificate", "PAN Card Copy"],
        submittedClauses: ["Scope of Work acceptance", "SLA terms acceptance"],
        solutionSummary: '',
        slaLevel: 'Standard',
        deploymentModel: 'On-Premise',
        teamSize: '',
        timeline: '',
        keyPersonnel: '',
      };

      if (docs.VENDOR_TECH) {
        try {
          const fullDoc = await api.getDocument(docs.VENDOR_TECH.id);
          console.log(`[Tech AutoFill] Vendor ${vendorId} VENDOR_TECH status: ${fullDoc?.status}, has OCR: ${!!(fullDoc?.ocr_text_preview)}, metadata keys:`, Object.keys(fullDoc?.metadata || {}));
          if (fullDoc && fullDoc.ocr_text_preview) {
            form.bidText = fullDoc.ocr_text_preview;
          }
          // Try to extract structured metadata from technical doc
          const meta = fullDoc?.metadata || {};
          const solSummary = cleanMetaValue(meta.solution_summary) || cleanMetaValue(meta.architecture_summary);
          if (solSummary) form.solutionSummary = solSummary;
          const teamSize = cleanMetaValue(meta.team_size);
          if (teamSize) form.teamSize = teamSize.replace(/[^\d]/g, '');
          const timeline = cleanMetaValue(meta.timeline) || cleanMetaValue(meta.implementation_timeline);
          if (timeline) form.timeline = timeline.replace(/[^\d]/g, '');
          const keyPersonnel = cleanMetaValue(meta.key_personnel);
          if (keyPersonnel) form.keyPersonnel = keyPersonnel;
          const slaLevel = cleanMetaValue(meta.sla_level);
          if (slaLevel) form.slaLevel = slaLevel;
          const deployModel = cleanMetaValue(meta.deployment_model);
          if (deployModel) form.deploymentModel = deployModel;
        } catch (err) {
          console.error(`[Tech AutoFill] Failed to fetch VENDOR_TECH for vendor ${vendorId}:`, err);
        }
      }

      // Also try to auto-detect submitted docs from uploaded document types
      const uploadedTypes = Object.keys(docs);
      if (uploadedTypes.includes('PQ_LEGAL_FINANCIAL')) {
        if (!form.submittedDocs.includes('Audited Financial Statements')) form.submittedDocs.push('Audited Financial Statements');
      }
      if (uploadedTypes.includes('PQ_EXPERIENCE_CERTS')) {
        if (!form.submittedDocs.includes('Client Completion Certificate')) form.submittedDocs.push('Client Completion Certificate');
        if (!form.submittedDocs.includes('Work Order / PO for similar project')) form.submittedDocs.push('Work Order / PO for similar project');
      }
      if (uploadedTypes.includes('GENERAL')) {
        if (!form.submittedDocs.includes('Undertaking for Solution Readiness')) form.submittedDocs.push('Undertaking for Solution Readiness');
        if (!form.submittedDocs.includes('Self-Declaration (Non-Blacklisting)')) form.submittedDocs.push('Self-Declaration (Non-Blacklisting)');
      }

      setTechForms(prev => ({ ...prev, [vendorId]: form }));
    } catch (err) {
      console.error("Error auto-filling tech form:", err);
    }
  }

  async function handleTechEvaluate() {
    if (pqPassedVendors.length === 0) return;
    setTechEvaluating(true);
    const results = {};

    for (const vendorId of pqPassedVendors) {
      const form = techForms[vendorId] || {};
      try {
        // Build enriched bid text with all human-in-the-loop fields
        const enrichedParts = [form.bidText || ''];
        const meta = [];
        if (form.solutionSummary) meta.push(`Solution Architecture: ${form.solutionSummary}`);
        if (form.slaLevel) meta.push(`SLA Commitment Level: ${form.slaLevel}`);
        if (form.deploymentModel) meta.push(`Deployment Model: ${form.deploymentModel}`);
        if (form.teamSize) meta.push(`Team Size: ${form.teamSize} members`);
        if (form.timeline) meta.push(`Implementation Timeline: ${form.timeline} months`);
        if (form.keyPersonnel) meta.push(`Key Personnel: ${form.keyPersonnel}`);
        if (form.submittedDocs?.length > 0) meta.push(`Submitted Documents: ${form.submittedDocs.join(', ')}`);
        if (form.submittedClauses?.length > 0) meta.push(`Clause Commitments: ${form.submittedClauses.join(', ')}`);
        if (meta.length > 0) {
          enrichedParts.push('\n\n--- HUMAN-VERIFIED METADATA ---');
          enrichedParts.push(...meta);
        }
        const finalBidText = enrichedParts.join('\n') || 'Submitted technical bid for evaluation.';

        const result = await api.evaluateTechnical({
          vendor_id: vendorId,
          tender_id: activeTenderId,
          bid_text: finalBidText,
        });
        results[vendorId] = result;
      } catch (err) {
        results[vendorId] = { error: err.message, qualification_status: 'ERROR' };
      }
    }

    setTechResults(results);
    setTechEvaluating(false);
    setTechAllDone(true);

    // Determine tech-qualified vendors
    const qualified = Object.entries(results)
      .filter(([_, r]) => r.qualification_status === 'QUALIFIED')
      .map(([vid]) => parseInt(vid));
    setTechQualifiedVendors(qualified);

    if (qualified.length > 0) {
      setPipelineStage('financial');
      // Auto-fill financial bids — properly await all
      await Promise.all(qualified.map(vid => autoFillFinBid(vid)));
      setFinSelectedVendor(qualified[0]);
      setTimeout(() => finCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300);
    }
  }

  // ─── Financial Auto-fill ───
  async function autoFillFinBid(vendorId) {
    try {
      const docs = vendorDocs[vendorId] || {};
      const bid = { total_amount: 0, base_price: 0, tax_amount: 0, payment_terms: '', warranty_months: '', amc_cost: '' };

      if (docs.VENDOR_FINANCIAL) {
        try {
          const fullDoc = await api.getDocument(docs.VENDOR_FINANCIAL.id);
          const meta = fullDoc?.metadata || {};
          console.log(`[Fin AutoFill] Vendor ${vendorId} VENDOR_FINANCIAL metadata:`, JSON.stringify(meta, null, 2));

          // Try multiple field names the AI might extract — use cleanNumericValue for robustness
          const totalStr = cleanNumericValue(meta.quoted_price) || cleanNumericValue(meta.total_amount) || cleanNumericValue(meta.total_price) || cleanNumericValue(meta.grand_total);
          const baseStr = cleanNumericValue(meta.base_price) || cleanNumericValue(meta.base_amount) || cleanNumericValue(meta.subtotal);
          const taxStr = cleanNumericValue(meta.tax_amount) || cleanNumericValue(meta.gst_amount) || cleanNumericValue(meta.tax);
          bid.total_amount = parseFloat(totalStr) || 0;
          bid.base_price = parseFloat(baseStr) || 0;
          bid.tax_amount = parseFloat(taxStr) || 0;
          // If we got total but no base, calculate base = total / 1.18
          if (bid.total_amount > 0 && bid.base_price === 0) {
            bid.base_price = Math.round(bid.total_amount / 1.18);
            bid.tax_amount = bid.total_amount - bid.base_price;
          }
          const payTerms = cleanMetaValue(meta.payment_terms);
          if (payTerms) bid.payment_terms = payTerms;
          const warranty = cleanMetaValue(meta.warranty_period) || cleanMetaValue(meta.warranty);
          if (warranty) bid.warranty_months = warranty.replace(/[^\d]/g, '');
          const amc = cleanNumericValue(meta.amc_cost);
          if (amc) bid.amc_cost = parseFloat(amc);
        } catch (err) {
          console.error(`[Fin AutoFill] Failed to fetch VENDOR_FINANCIAL for vendor ${vendorId}:`, err);
        }
      }

      console.log(`[Fin AutoFill] Vendor ${vendorId} final bid:`, JSON.stringify(bid, null, 2));
      setFinBids(prev => ({ ...prev, [vendorId]: bid }));
    } catch (err) {
      console.error("Error auto-filling financial bid:", err);
    }
  }

  async function handleFinancialEvaluate() {
    if (techQualifiedVendors.length === 0) return;
    setFinEvaluating(true);
    setFinData(null);

    const bidsArray = techQualifiedVendors.map(vid => {
      const vendor = allVendors.find(v => v.id === vid);
      const bid = finBids[vid] || {};
      return {
        vendor_id: vid,
        vendor_name: vendor?.vendor_name || `Vendor ${vid}`,
        total_amount: bid.total_amount || 0,
      };
    });

    try {
      const result = await api.evaluateFinancial({ tender_id: activeTenderId, bids: bidsArray });
      setFinData(result);
      setFinDone(true);
      setPipelineStage('final');
      setTimeout(() => finalCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300);
    } catch (err) {
      alert(`Financial Evaluation Failed: ${err.message}`);
    } finally {
      setFinEvaluating(false);
    }
  }

  async function handleGenerateRecommendation() {
    if (!activeTenderId) return;
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
    setDownloading(true);
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
            <thead><tr style="background: #e2e8f0;"><th style="padding: 10px;">Bidder Name</th><th style="padding: 10px;">PQ Status</th><th style="padding: 10px;">Tech Score</th><th style="padding: 10px;">Fin. Rank</th><th style="padding: 10px;">Quoted Price</th></tr></thead>
            <tbody>${biddersHtml}</tbody>
          </table>
        </div>
        <div style="margin-bottom: 30px; page-break-inside: avoid;">
          <h2 style="font-size: 16px; font-weight: bold; background: #f8fafc; padding: 8px 12px; border-left: 4px solid #eab308; margin-bottom: 15px;">3. AI JUSTIFICATION & RISK ASSESSMENT</h2>
          <div style="background: #fefce8; border: 1px solid #fef08a; padding: 15px; border-radius: 6px; font-size: 13px; line-height: 1.6; margin-bottom: 15px;">
            <strong>AI Recommendation Narrative:</strong><br/>${marked.parse(award_report || '')}
          </div>
          <div style="background: #fefce8; border: 1px solid #fef08a; padding: 15px; border-radius: 6px; font-size: 13px; line-height: 1.6;">
            <strong>Compliance & Risk Check:</strong><br/>${marked.parse(risk_assessment || 'No significant risks identified.')}
          </div>
        </div>
        <div style="margin-top: 50px; page-break-inside: avoid;">
          <h2 style="font-size: 16px; font-weight: bold; border-bottom: 1px solid #cbd5e1; padding-bottom: 10px; margin-bottom: 40px;">4. COMMITTEE APPROVAL</h2>
          <div style="display: flex; justify-content: space-between; text-align: center; margin-top: 60px;">
            <div style="width: 30%;"><div style="border-top: 1px solid #000; padding-top: 8px;">Prepared By<br/><span style="font-size: 11px; color: #64748b;">(Procurement Officer)</span></div></div>
            <div style="width: 30%;"><div style="border-top: 1px solid #000; padding-top: 8px;">Reviewed By<br/><span style="font-size: 11px; color: #64748b;">(Technical Committee)</span></div></div>
            <div style="width: 30%;"><div style="border-top: 1px solid #000; padding-top: 8px;">Approved By<br/><span style="font-size: 11px; color: #64748b;">(Chief General Manager)</span></div></div>
          </div>
        </div>
      `;
      const opt = {
        margin: 15,
        filename: `BER_${tender_details?.tender_number || 'Tender'}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };
      await html2pdf().set(opt).from(container).save();
    } catch (err) {
      console.error("BER PDF generation failed:", err);
      alert("Failed to generate BER PDF");
    } finally {
      setDownloading(false);
    }
  }

  // ─── Helper: Get vendor name ───
  const getVendorName = (vendorId) => {
    const v = allVendors.find(v => v.id === parseInt(vendorId));
    return v ? v.vendor_name : `Vendor ${vendorId}`;
  };

  // ─── Helper: PQ form change ───
  const updatePqForm = (vendorId, field, value) => {
    setPqForms(prev => ({
      ...prev,
      [vendorId]: { ...(prev[vendorId] || {}), [field]: value }
    }));
  };

  // ─── Helper: Tech form change ───
  const updateTechForm = (vendorId, field, value) => {
    setTechForms(prev => ({
      ...prev,
      [vendorId]: { ...(prev[vendorId] || {}), [field]: value }
    }));
  };

  // ─── Helper: Fin bid change ───
  const updateFinBid = (vendorId, field, value) => {
    setFinBids(prev => ({
      ...prev,
      [vendorId]: { ...(prev[vendorId] || {}), [field]: value }
    }));
  };

  // Drag handlers
  const handleDragOver = (e) => { e.preventDefault(); setIsDragActive(true); };
  const handleDragLeave = (e) => { e.preventDefault(); setIsDragActive(false); };
  const handleDrop = (e) => {
    e.preventDefault(); setIsDragActive(false);
    if (e.dataTransfer.files?.[0]) setFile(e.dataTransfer.files[0]);
  };

  // ─── Determine pipeline step states ───
  const getStepState = (stepId) => {
    const order = ['docs', 'pq', 'tech', 'financial', 'final'];
    const currentIdx = order.indexOf(pipelineStage);
    const stepIdx = order.indexOf(stepId);
    if (stepIdx < currentIdx) return 'completed';
    if (stepIdx === currentIdx) return 'active';
    return 'pending';
  };

  if (!activeTenderId) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '16px' }}>
        <AlertTriangle size={48} style={{ color: 'var(--color-warning)' }} />
        <div style={{ fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)' }}>No Active Tender Selected</div>
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', maxWidth: '400px' }}>
          Please create or select an active tender in the RFP Authoring module to begin the evaluation pipeline.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0', width: '100%', height: '100%', overflowY: 'auto', paddingBottom: '60px' }}>
      <ActiveTenderBadge activeTenderId={activeTenderId} />

      {/* ═══ Pipeline Progress Stepper ═══ */}
      <div className="pipeline-stepper" style={{ marginTop: '12px' }}>
        {PIPELINE_STEPS.map((step, idx) => (
          <div key={step.id} className={`pipeline-stepper-step ${getStepState(step.id)}`}>
            {getStepState(step.id) === 'completed' ? <CheckCircle size={14} /> : getStepState(step.id) === 'active' ? <Play size={14} /> : <span style={{ width: '14px', height: '14px', borderRadius: '50%', border: '2px solid var(--text-muted)', display: 'inline-block' }} />}
            {step.label}
          </div>
        ))}
      </div>

      {/* ═══ Evaluation History (Top) ═══ */}
      {evaluationHistory.length > 0 && (
        <div className="glass-card" style={{ margin: '0 0 20px 0', padding: '16px 20px' }}>
          <div
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
            onClick={() => setHistoryExpanded(!historyExpanded)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Clock size={18} style={{ color: 'var(--accent-violet)' }} />
              <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>Previous Evaluations</span>
              <span className="badge badge-info" style={{ fontSize: '10px' }}>{evaluationHistory.length} run{evaluationHistory.length !== 1 ? 's' : ''}</span>
            </div>
            {historyExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
          </div>
          {historyExpanded && (
            <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {evaluationHistory.map((h, idx) => (
                <div key={idx} className="eval-history-row" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {/* Top Row: Badges (Left) & Buttons (Right) */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {h.vendors.map((name, i) => (
                        <span key={i} className="badge badge-info" style={{ fontSize: '10px' }}>{name}</span>
                      ))}
                    </div>
                    
                    <div style={{ display: 'flex', gap: '8px', flexShrink: 0, marginLeft: 'auto', paddingLeft: '16px' }}>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleDownloadHistoryBER(h); }}
                        style={{ fontSize: '11px', padding: '4px 10px', background: 'var(--bg-card)', border: '1px solid var(--card-border)', borderRadius: '4px', cursor: 'pointer', color: 'var(--text-primary)' }}>
                        <FileDown size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'text-bottom' }}/> 
                        Download BER Report
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleDownloadEvalDetails(h); }}
                        style={{ fontSize: '11px', padding: '4px 10px', background: 'var(--bg-card)', border: '1px solid var(--card-border)', borderRadius: '4px', cursor: 'pointer', color: 'var(--text-primary)' }}>
                        <Database size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'text-bottom' }}/> 
                        Download Evaluation Details
                      </button>
                    </div>
                  </div>

                  {/* Bottom Row: Date and Stats (Center) */}
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>
                    {h.date ? new Date(h.date).toLocaleString() : 'Unknown date'} · PQ: {h.pqPassed}/{h.pqCount} passed · Tech: {h.techQualified}/{h.techCount} qualified · Financial: {h.finCount} evaluated
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════
           CARD 1: Document Upload & OCR Pipeline
         ═══════════════════════════════════════════════ */}
      <div className="pipeline-card stage-docs" style={{ animationDelay: '0.1s', marginBottom: '0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--card-border)', paddingBottom: '14px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Upload size={20} style={{ color: '#3B82F6' }} />
            <h2 style={{ fontSize: '17px', fontWeight: '700', color: 'var(--text-primary)', margin: 0, borderBottom: 'none' }}>Step 1 — Document Upload & OCR Pipeline</h2>
          </div>
          <span className={`pipeline-step-badge ${getStepState('docs')}`}>
            {getStepState('docs') === 'completed' ? '✓ Complete' : 'In Progress'}
          </span>
        </div>

        {/* Upload Form */}
        <form onSubmit={handleUpload} style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxWidth: '700px', margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600' }}>Select Vendor</label>
              <select required className="glass-input" style={{ marginTop: '6px' }} value={docVendorId} onChange={e => setDocVendorId(e.target.value)}>
                <option value="">-- Select Vendor --</option>
                {allVendors.map(v => (
                  <option key={v.id} value={v.id}>{v.vendor_name} (ID: {v.id})</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600' }}>Document Category</label>
              <select className="glass-input" style={{ marginTop: '6px' }} value={docType} onChange={e => setDocType(e.target.value)}>
                {DOC_CATEGORIES.map(cat => (
                  <option key={cat.key} value={cat.key}>{cat.label}</option>
                ))}
              </select>
            </div>
          </div>

          {uploadError && (
            <div style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-danger)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', fontSize: '12px', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '8px', animation: 'fadeSlideUp 0.3s ease-out forwards' }}>
              <AlertCircle size={16} />
              {uploadError}
            </div>
          )}

          <div
            className={`drop-zone ${isDragActive ? 'drop-active' : ''}`}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100px', padding: '20px', textAlign: 'center', cursor: 'pointer' }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => document.getElementById('eval-file-picker').click()}
          >
            {uploading ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div className="scan-laser-container"><div className="scan-laser"></div><FileText size={28} style={{ color: 'var(--text-muted)', margin: '16px auto' }} /></div>
                <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--accent-violet)', marginTop: '6px' }}>Processing OCR...</div>
              </div>
            ) : (
              <>
                <Upload size={28} style={{ color: isDragActive ? 'var(--accent-violet)' : 'var(--text-muted)', marginBottom: '8px' }} />
                <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>{file ? file.name : 'Drag & Drop or Click to Browse'}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>PDF, DOC, DOCX up to 10MB</div>
              </>
            )}
            <input id="eval-file-picker" type="file" accept=".pdf,.doc,.docx" style={{ display: 'none' }} onChange={e => { if (e.target.files?.[0]) setFile(e.target.files[0]); }} disabled={uploading} />
          </div>

          <button type="submit" className="btn-primary" style={{ justifyContent: 'center', maxWidth: '280px', alignSelf: 'center' }} disabled={uploading || !file || !docVendorId}>
            <Upload size={16} />
            {uploading ? 'Processing...' : 'Upload & Process OCR'}
          </button>
        </form>

        {/* Per-vendor document checklist */}
        {participatingVendors.length > 0 && (
          <div style={{ marginTop: '24px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '14px' }}>
              Vendor Document Status
            </h3>
            {participatingVendors.map(vid => {
              const statuses = getVendorDocStatus(vid);
              const complete = isVendorDocsComplete(vid);
              return (
                <div key={vid} style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>{getVendorName(vid)}</span>
                    {complete ? (
                      <span className="badge badge-success" style={{ fontSize: '10px' }}><CheckCircle size={12} /> All Uploaded</span>
                    ) : (
                      <span className="badge badge-warning" style={{ fontSize: '10px' }}><AlertTriangle size={12} /> Incomplete</span>
                    )}
                  </div>
                  <div className="doc-checklist-grid">
                    {statuses.map(s => (
                      <div key={s.key} className={`doc-checklist-item ${s.uploaded ? 'uploaded' : 'missing'}`}>
                        {s.uploaded ? <CheckCircle size={14} /> : <XCircle size={14} />}
                        <span>{s.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Proceed Button */}
        <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center' }}>
          <button
            className="btn-primary"
            style={{ padding: '12px 28px', fontSize: '14px', background: canProceedToEval() ? undefined : 'var(--text-muted)' }}
            disabled={!canProceedToEval()}
            onClick={handleProceedToEval}
          >
            <Play size={16} />
            Proceed to Evaluation ({participatingVendors.filter(vid => isVendorDocsComplete(vid)).length} vendor{participatingVendors.filter(vid => isVendorDocsComplete(vid)).length !== 1 ? 's' : ''})
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════
           CARD 2: Pre-Qualification (Human-in-the-Loop)
         ═══════════════════════════════════════════════ */}
      {(pipelineStage === 'pq' || pipelineStage === 'tech' || pipelineStage === 'financial' || pipelineStage === 'final') && (
        <>
          <div className="pipeline-connector"><div className="pipeline-connector-line" /></div>
          <div className="pipeline-card stage-pq fade-slide-up" ref={pqCardRef}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--card-border)', paddingBottom: '14px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <ShieldCheck size={20} style={{ color: '#8B5CF6' }} />
                <h2 style={{ fontSize: '17px', fontWeight: '700', color: 'var(--text-primary)', margin: 0, borderBottom: 'none' }}>Step 2 — Pre-Qualification Evaluation</h2>
              </div>
              <span className={`pipeline-step-badge ${getStepState('pq')}`}>
                {getStepState('pq') === 'completed' ? `✓ ${pqPassedVendors.length} Passed` : 'Human Review'}
              </span>
            </div>

            {/* Vendor Buttons */}
            <div className="vendor-buttons-row">
              {participatingVendors.filter(vid => isVendorDocsComplete(vid)).map(vid => {
                const result = pqResults[vid];
                const statusClass = result ? (result.overall_status === 'PASS' ? 'pass' : 'fail') : '';
                return (
                  <button
                    key={vid}
                    className={`vendor-btn ${statusClass} ${pqSelectedVendor === vid ? 'active' : ''}`}
                    onClick={() => setPqSelectedVendor(vid)}
                  >
                    <Users size={14} />
                    {getVendorName(vid)}
                    {result && (result.overall_status === 'PASS' ? <CheckCircle size={14} /> : <XCircle size={14} />)}
                  </button>
                );
              })}
            </div>

            {/* PQ Form for selected vendor */}
            {pqSelectedVendor && (
              <div style={{ marginTop: '16px' }}>
                <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                  Eligibility Data for <span style={{ color: 'var(--accent-violet)' }}>{getVendorName(pqSelectedVendor)}</span>
                </div>
                {(() => {
                  const form = pqForms[pqSelectedVendor] || {};
                  return (
                    <div className="pipeline-form-grid">
                      <div>
                        <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Annual Turnover (INR)</label>
                        <input type="number" className="glass-input" style={{ marginTop: '4px' }} value={form.annual_turnover || ''} onChange={e => updatePqForm(pqSelectedVendor, 'annual_turnover', e.target.value)} />
                      </div>
                      <div>
                        <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Years of Operation</label>
                        <input type="number" className="glass-input" style={{ marginTop: '4px' }} value={form.years_experience || ''} onChange={e => updatePqForm(pqSelectedVendor, 'years_experience', e.target.value)} />
                      </div>
                      <div>
                        <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Prior Project Value (INR)</label>
                        <input type="number" className="glass-input" style={{ marginTop: '4px' }} value={form.similar_project_value || ''} onChange={e => updatePqForm(pqSelectedVendor, 'similar_project_value', e.target.value)} />
                      </div>
                      <div>
                        <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Certifications</label>
                        <input type="text" className="glass-input" style={{ marginTop: '4px' }} value={form.certifications || ''} onChange={e => updatePqForm(pqSelectedVendor, 'certifications', e.target.value)} />
                      </div>
                      <div>
                        <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>GST Number</label>
                        <input type="text" className="glass-input" style={{ marginTop: '4px' }} value={form.gst_number || ''} onChange={e => updatePqForm(pqSelectedVendor, 'gst_number', e.target.value)} />
                      </div>
                      <div>
                        <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>PAN Number</label>
                        <input type="text" className="glass-input" style={{ marginTop: '4px' }} value={form.pan_number || ''} onChange={e => updatePqForm(pqSelectedVendor, 'pan_number', e.target.value)} />
                      </div>
                      <div>
                        <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>CA Registration Number</label>
                        <input type="text" className="glass-input" style={{ marginTop: '4px' }} value={form.ca_registration_number || ''} onChange={e => updatePqForm(pqSelectedVendor, 'ca_registration_number', e.target.value)} />
                      </div>
                      <div>
                        <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Business Type</label>
                        <input type="text" className="glass-input" style={{ marginTop: '4px' }} value={form.business_type || ''} onChange={e => updatePqForm(pqSelectedVendor, 'business_type', e.target.value)} />
                      </div>
                      <div>
                        <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>State / Jurisdiction</label>
                        <input type="text" className="glass-input" style={{ marginTop: '4px' }} value={form.state || ''} onChange={e => updatePqForm(pqSelectedVendor, 'state', e.target.value)} />
                      </div>
                      <div style={{ display: 'flex', gap: '24px', alignItems: 'center', marginTop: '8px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                          <input type="checkbox" checked={form.has_gst !== false} onChange={e => updatePqForm(pqSelectedVendor, 'has_gst', e.target.checked)} />
                          Valid GSTIN Copy
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                          <input type="checkbox" checked={form.has_pan !== false} onChange={e => updatePqForm(pqSelectedVendor, 'has_pan', e.target.checked)} />
                          Valid PAN Card
                        </label>
                      </div>
                    </div>
                  );
                })()}

                {/* PQ Result for selected vendor */}
                {pqResults[pqSelectedVendor] && (() => {
                  const res = pqResults[pqSelectedVendor];
                  const isPass = res.overall_status === 'PASS';

                  // Build a unified check list from the shortfall_report (contains ALL criteria with required/submitted)
                  // Plus supplement with named _status fields for any checks not in shortfall_report
                  const checksFromReport = res.shortfall_report || [];

                  // Named status fields that ARE in the API response
                  const namedStatuses = [
                    { key: 'turnover_status', label: 'Annual Turnover' },
                    { key: 'experience_status', label: 'Years of Operation' },
                    { key: 'gst_status', label: 'GST Registration' },
                    { key: 'pan_status', label: 'PAN Registration' },
                    { key: 'certifications_status', label: 'Certifications' },
                  ];

                  // Derive similar_project_status from shortfall_report
                  // The shortfall_report only contains FAIL items, so if not in it → PASS
                  const allCheckCriteria = checksFromReport.map(c => c.criterion);
                  const projectFailed = allCheckCriteria.includes('Similar Project Experience');
                  const project_status = projectFailed ? 'FAIL' : 'PASS';

                  // All 6 check results to display
                  const allChecks = [
                    ...namedStatuses.map(({ key, label }) => ({ label, status: res[key] || 'N/A' })),
                    { label: 'Similar Project Value', status: project_status },
                  ];

                  return (
                    <div style={{ marginTop: '20px', padding: '16px', borderRadius: '10px', background: isPass ? 'rgba(15, 118, 110, 0.05)' : 'rgba(190, 18, 60, 0.05)', border: `1.5px solid ${isPass ? 'rgba(15, 118, 110, 0.25)' : 'rgba(190, 18, 60, 0.25)'}` }}>
                      {/* Header */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                        <span style={{ fontSize: '14px', fontWeight: '700' }}>PQ Result</span>
                        <span className={`badge ${isPass ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '13px', padding: '5px 12px' }}>
                          {isPass ? <><CheckCircle size={14} /> QUALIFIED</> : <><XCircle size={14} /> NOT QUALIFIED</>}
                        </span>
                      </div>

                      {/* All 6 criteria grid */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '12px', marginBottom: '14px' }}>
                        {allChecks.map(({ label, status }) => (
                          <div key={label} className="output-stream-card" style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', borderRadius: '6px', borderLeft: `3px solid ${status === 'PASS' ? 'var(--color-success)' : status === 'FAIL' ? 'var(--color-danger)' : 'var(--card-border)'}` }}>
                            <span style={{ fontWeight: '500' }}>{label}</span>
                            <strong style={{ color: status === 'PASS' ? 'var(--color-success)' : status === 'FAIL' ? 'var(--color-danger)' : 'var(--text-muted)' }}>
                              {status}
                            </strong>
                          </div>
                        ))}
                      </div>

                      {/* Shortfall detail table — only when FAIL */}
                      {!isPass && checksFromReport.length > 0 && (
                        <div style={{ marginBottom: '14px' }}>
                          <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-danger)', marginBottom: '8px' }}>
                            ⚠ Shortfall Details
                          </div>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                            <thead>
                              <tr style={{ background: 'rgba(190, 18, 60, 0.06)' }}>
                                <th style={{ padding: '7px 10px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: '600', borderBottom: '1px solid rgba(190,18,60,0.15)' }}>Criterion</th>
                                <th style={{ padding: '7px 10px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: '600', borderBottom: '1px solid rgba(190,18,60,0.15)' }}>Required</th>
                                <th style={{ padding: '7px 10px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: '600', borderBottom: '1px solid rgba(190,18,60,0.15)' }}>Submitted</th>
                                <th style={{ padding: '7px 10px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: '600', borderBottom: '1px solid rgba(190,18,60,0.15)' }}>Shortfall</th>
                              </tr>
                            </thead>
                            <tbody>
                              {checksFromReport.map((c, i) => (
                                <tr key={i} style={{ borderBottom: '1px solid var(--overlay-border)' }}>
                                  <td style={{ padding: '7px 10px', fontWeight: '500', color: 'var(--color-danger)' }}>{c.criterion}</td>
                                  <td style={{ padding: '7px 10px', color: 'var(--text-secondary)' }}>{c.required}</td>
                                  <td style={{ padding: '7px 10px', color: 'var(--text-secondary)' }}>{c.submitted}</td>
                                  <td style={{ padding: '7px 10px', color: 'var(--color-danger)', fontStyle: 'italic', fontSize: '11px' }}>{c.shortfall || '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {/* AI Remarks — full text, no streaming */}
                      {res.remarks && (
                        <div style={{ padding: '12px 14px', background: 'var(--overlay-bg)', borderRadius: '8px', borderLeft: `3px solid ${isPass ? 'var(--color-success)' : 'var(--color-danger)'}` }}>
                          <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '6px' }}>
                            AI Evaluation Remarks
                          </div>
                          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.7', margin: 0, whiteSpace: 'pre-wrap' }}>
                            {res.remarks}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Evaluate All Button */}
            {!pqAllDone && (
              <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center' }}>
                <button className="btn-primary" style={{ padding: '12px 32px', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }} onClick={handlePQEvaluate} disabled={pqEvaluating}>
                  {pqEvaluating ? <RefreshCw size={16} className="spin-icon" /> : <Play size={16} />}
                  {pqEvaluating ? 'Evaluating all vendors...' : 'Evaluate All Vendors (PQ)'}
                </button>
              </div>
            )}

            {pqAllDone && pqPassedVendors.length === 0 && (
              <div style={{ marginTop: '16px', padding: '16px', background: 'rgba(190, 18, 60, 0.06)', borderRadius: '8px', border: '1px solid rgba(190, 18, 60, 0.2)', textAlign: 'center', color: 'var(--color-danger)', fontWeight: '600' }}>
                <XCircle size={20} style={{ margin: '0 auto 8px' }} />
                No vendors passed Pre-Qualification. The evaluation pipeline ends here.
              </div>
            )}
          </div>
        </>
      )}

      {/* ═══════════════════════════════════════════════
           CARD 3: Technical Evaluation (Human-in-the-Loop)
         ═══════════════════════════════════════════════ */}
      {(pipelineStage === 'tech' || pipelineStage === 'financial' || pipelineStage === 'final') && (
        <>
          <div className="pipeline-connector"><div className="pipeline-connector-line" /></div>
          <div className="pipeline-card stage-tech fade-slide-up" ref={techCardRef}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--card-border)', paddingBottom: '14px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Award size={20} style={{ color: '#F59E0B' }} />
                <h2 style={{ fontSize: '17px', fontWeight: '700', color: 'var(--text-primary)', margin: 0, borderBottom: 'none' }}>Step 3 — Technical Evaluation</h2>
              </div>
              <span className={`pipeline-step-badge ${getStepState('tech')}`}>
                {getStepState('tech') === 'completed' ? `✓ ${techQualifiedVendors.length} Qualified` : `${pqPassedVendors.length} PQ-Passed Vendors`}
              </span>
            </div>

            {/* Vendor Buttons */}
            <div className="vendor-buttons-row">
              {pqPassedVendors.map(vid => {
                const result = techResults[vid];
                const statusClass = result ? (result.qualification_status === 'QUALIFIED' ? 'pass' : 'fail') : '';
                return (
                  <button
                    key={vid}
                    className={`vendor-btn ${statusClass} ${techSelectedVendor === vid ? 'active' : ''}`}
                    onClick={() => setTechSelectedVendor(vid)}
                  >
                    <Users size={14} />
                    {getVendorName(vid)}
                    {result && (result.qualification_status === 'QUALIFIED' ? <CheckCircle size={14} /> : <XCircle size={14} />)}
                  </button>
                );
              })}
            </div>

            {/* Tech Form for selected vendor */}
            {techSelectedVendor && (
              <div style={{ marginTop: '16px' }}>
                <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                  Technical Data for <span style={{ color: '#F59E0B' }}>{getVendorName(techSelectedVendor)}</span>
                </div>
                {(() => {
                  const form = techForms[techSelectedVendor] || {};
                  
                  const formatBidText = (text) => {
                    if (!text) return '';
                    const lines = text.split('\n');
                    const processedLines = [];
                    let inTable = false;

                    for (let i = 0; i < lines.length; i++) {
                      let line = lines[i].trim();
                      
                      if (line.includes('|')) {
                        let tableLine = line;
                        if (!tableLine.startsWith('|')) tableLine = '| ' + tableLine;
                        if (!tableLine.endsWith('|')) tableLine = tableLine + ' |';

                        if (!inTable) {
                          inTable = true;
                          processedLines.push(''); // Spacing before table
                          processedLines.push(tableLine);
                          
                          const nextLine = lines[i+1] || '';
                          if (!nextLine.match(/\|[-\s]+\|/)) {
                            const pipeCount = (tableLine.match(/\|/g) || []).length;
                            const separator = '|' + Array(Math.max(1, pipeCount - 1)).fill('---').join('|') + '|';
                            processedLines.push(separator);
                          }
                        } else {
                          processedLines.push(tableLine);
                        }
                      } else {
                        if (inTable) {
                          inTable = false;
                          processedLines.push(''); // Spacing after table
                        }
                        
                        if (line.length > 0 && !line.includes('**') && !line.startsWith('#') && !line.startsWith('- ') && !line.startsWith('* ')) {
                          const colonIdx = line.indexOf(':');
                          if (colonIdx > 0 && colonIdx < 60) {
                            line = `**${line.substring(0, colonIdx + 1)}**${line.substring(colonIdx + 1)}`;
                          } else if (colonIdx === -1 && line.length < 80 && (line === line.toUpperCase() || line.match(/^\d+\.\s/))) {
                            line = `**${line}**`;
                          }
                        }
                        
                        processedLines.push(line);
                        if (line.length > 0) {
                          processedLines.push(''); // Paragraph spacing
                        }
                      }
                    }
                    return processedLines.join('\n');
                  };

                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      <div>
                        <label style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600' }}>Proposal Text Synopsis</label>
                        {form.bidText ? (
                          <div 
                            className="markdown-body compact-markdown"
                            style={{ marginTop: '4px', padding: '12px 16px', background: 'var(--overlay-bg)', border: '1px solid var(--card-border)', borderRadius: '8px', maxHeight: '300px', overflowY: 'auto', fontSize: '13px', lineHeight: '1.6', color: 'var(--text-secondary)', wordBreak: 'break-word' }}
                            dangerouslySetInnerHTML={{ __html: marked.parse(formatBidText(form.bidText), { breaks: true }) }}
                          />
                        ) : (
                          <textarea rows={3} className="glass-input" style={{ marginTop: '4px', resize: 'vertical' }} value={form.bidText || ''} onChange={e => updateTechForm(techSelectedVendor, 'bidText', e.target.value)} placeholder="Enter proposal extracts..." />
                        )}
                      </div>

                      <div className="pipeline-form-grid">
                        <div>
                          <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Solution Architecture Summary</label>
                          <textarea rows={2} className="glass-input" style={{ marginTop: '4px', resize: 'vertical' }} value={form.solutionSummary || ''} onChange={e => updateTechForm(techSelectedVendor, 'solutionSummary', e.target.value)} />
                        </div>
                        <div>
                          <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Key Personnel Qualifications</label>
                          <textarea rows={2} className="glass-input" style={{ marginTop: '4px', resize: 'vertical' }} value={form.keyPersonnel || ''} onChange={e => updateTechForm(techSelectedVendor, 'keyPersonnel', e.target.value)} />
                        </div>
                        <div>
                          <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>SLA Commitment Level</label>
                          <select className="glass-input" style={{ marginTop: '4px' }} value={form.slaLevel || 'Standard'} onChange={e => updateTechForm(techSelectedVendor, 'slaLevel', e.target.value)}>
                            <option value="Basic">Basic</option>
                            <option value="Standard">Standard</option>
                            <option value="Premium">Premium</option>
                          </select>
                        </div>
                        <div>
                          <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Deployment Model</label>
                          <select className="glass-input" style={{ marginTop: '4px' }} value={form.deploymentModel || 'On-Premise'} onChange={e => updateTechForm(techSelectedVendor, 'deploymentModel', e.target.value)}>
                            <option value="On-Premise">On-Premise</option>
                            <option value="Hybrid">Hybrid</option>
                            <option value="Cloud">Cloud</option>
                          </select>
                        </div>
                        <div>
                          <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Team Size Proposed</label>
                          <input type="number" className="glass-input" style={{ marginTop: '4px' }} value={form.teamSize || ''} onChange={e => updateTechForm(techSelectedVendor, 'teamSize', e.target.value)} />
                        </div>
                        <div>
                          <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Implementation Timeline (months)</label>
                          <input type="number" className="glass-input" style={{ marginTop: '4px' }} value={form.timeline || ''} onChange={e => updateTechForm(techSelectedVendor, 'timeline', e.target.value)} />
                        </div>
                      </div>

                      {/* Document Checklist */}
                      <div style={{ marginTop: '8px' }}>
                        <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>Submitted Documents</span>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginTop: '6px' }}>
                          {DOC_OPTIONS.map((doc, idx) => (
                            <label key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                              <input type="checkbox" checked={(form.submittedDocs || []).includes(doc)} onChange={() => {
                                const current = form.submittedDocs || [];
                                const updated = current.includes(doc) ? current.filter(d => d !== doc) : [...current, doc];
                                updateTechForm(techSelectedVendor, 'submittedDocs', updated);
                              }} />
                              {doc}
                            </label>
                          ))}
                        </div>
                      </div>

                      {/* Clause Checklist */}
                      <div>
                        <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>Clause Commitments</span>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginTop: '6px' }}>
                          {CLAUSE_OPTIONS.map((clause, idx) => (
                            <label key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                              <input type="checkbox" checked={(form.submittedClauses || []).includes(clause)} onChange={() => {
                                const current = form.submittedClauses || [];
                                const updated = current.includes(clause) ? current.filter(c => c !== clause) : [...current, clause];
                                updateTechForm(techSelectedVendor, 'submittedClauses', updated);
                              }} />
                              {clause}
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Tech Result for selected vendor */}
                {techResults[techSelectedVendor] && (
                  <div style={{ marginTop: '20px', padding: '16px', borderRadius: '8px', background: techResults[techSelectedVendor].qualification_status === 'QUALIFIED' ? 'rgba(15, 118, 110, 0.05)' : 'rgba(190, 18, 60, 0.05)', border: `1px solid ${techResults[techSelectedVendor].qualification_status === 'QUALIFIED' ? 'rgba(15, 118, 110, 0.2)' : 'rgba(190, 18, 60, 0.2)'}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <div>
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block' }}>
                          Score: {techResults[techSelectedVendor].overall_score} / {techResults[techSelectedVendor].max_score} ({techResults[techSelectedVendor].percentage}%)
                        </span>
                        <span style={{ fontSize: '14px', fontWeight: '600' }}>Technical Qualification</span>
                      </div>
                      <span className={`badge ${techResults[techSelectedVendor].qualification_status === 'QUALIFIED' ? 'badge-success' : 'badge-danger'}`}>
                        {techResults[techSelectedVendor].qualification_status === 'QUALIFIED' ? <><ShieldCheck size={14} /> QUALIFIED</> : <><AlertTriangle size={14} /> FAILED</>}
                      </span>
                    </div>
                    {/* Compliance Matrix */}
                    {techResults[techSelectedVendor].compliance_matrix && (
                      <div className="output-stream-card" style={{ overflowX: 'auto', padding: '12px', borderRadius: '8px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid var(--card-border)', color: 'var(--text-secondary)' }}>
                              <th style={{ padding: '8px 4px' }}>S.No</th>
                              <th style={{ padding: '8px 4px' }}>Parameter</th>
                              <th style={{ padding: '8px 4px', textAlign: 'center' }}>Score</th>
                              <th style={{ padding: '8px 4px', textAlign: 'center' }}>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {techResults[techSelectedVendor].compliance_matrix.map((row, idx) => (
                              <tr key={idx} style={{ borderBottom: '1px solid var(--overlay-border)' }}>
                                <td style={{ padding: '8px 4px', color: 'var(--text-muted)' }}>{idx + 1}</td>
                                <td style={{ padding: '8px 4px' }}>
                                  <div style={{ fontWeight: '500' }}>{row.parameter_name}</div>
                                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>{row.remarks}</div>
                                </td>
                                <td style={{ padding: '8px 4px', textAlign: 'center', fontWeight: '600' }}>{row.scored}</td>
                                <td style={{ padding: '8px 4px', textAlign: 'center', fontSize: '10px', fontWeight: '600', color: row.compliance === 'COMPLIANT' ? 'var(--color-success)' : row.compliance === 'PARTIAL' ? 'var(--color-warning)' : 'var(--color-danger)' }}>
                                  {row.compliance === 'COMPLIANT' ? 'Qualified' : row.compliance === 'PARTIAL' ? 'Partial' : 'Fail'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Evaluate All Button */}
            {!techAllDone && (
              <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center' }}>
                <button className="btn-primary" style={{ padding: '12px 32px', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }} onClick={handleTechEvaluate} disabled={techEvaluating}>
                  {techEvaluating ? <RefreshCw size={16} className="spin-icon" /> : <Award size={16} />}
                  {techEvaluating ? 'Evaluating technical bids...' : 'Evaluate All Vendors (Technical)'}
                </button>
              </div>
            )}

            {techAllDone && techQualifiedVendors.length === 0 && (
              <div style={{ marginTop: '16px', padding: '16px', background: 'rgba(190, 18, 60, 0.06)', borderRadius: '8px', border: '1px solid rgba(190, 18, 60, 0.2)', textAlign: 'center', color: 'var(--color-danger)', fontWeight: '600' }}>
                <XCircle size={20} style={{ margin: '0 auto 8px' }} />
                No vendors qualified in Technical Evaluation. The evaluation pipeline ends here.
              </div>
            )}
          </div>
        </>
      )}

      {/* ═══════════════════════════════════════════════
           CARD 4: Financial Award (Human-in-the-Loop)
         ═══════════════════════════════════════════════ */}
      {(pipelineStage === 'financial' || pipelineStage === 'final') && (
        <>
          <div className="pipeline-connector"><div className="pipeline-connector-line" /></div>
          <div className="pipeline-card stage-financial fade-slide-up" ref={finCardRef}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--card-border)', paddingBottom: '14px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <DollarSign size={20} style={{ color: '#10B981' }} />
                <h2 style={{ fontSize: '17px', fontWeight: '700', color: 'var(--text-primary)', margin: 0, borderBottom: 'none' }}>Step 4 — Financial Award</h2>
              </div>
              <span className={`pipeline-step-badge ${getStepState('financial')}`}>
                {getStepState('financial') === 'completed' ? '✓ Ranked' : `${techQualifiedVendors.length} Tech-Qualified`}
              </span>
            </div>

            {/* Vendor Buttons */}
            <div className="vendor-buttons-row">
              {techQualifiedVendors.map(vid => (
                <button
                  key={vid}
                  className={`vendor-btn pass ${finSelectedVendor === vid ? 'active' : ''}`}
                  onClick={() => setFinSelectedVendor(vid)}
                >
                  <DollarSign size={14} />
                  {getVendorName(vid)}
                </button>
              ))}
            </div>

            {/* Financial Form for selected vendor */}
            {finSelectedVendor && (
              <div style={{ marginTop: '16px' }}>
                <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                  Commercial Data for <span style={{ color: '#10B981' }}>{getVendorName(finSelectedVendor)}</span>
                </div>
                {(() => {
                  const bid = finBids[finSelectedVendor] || {};
                  const priceSum = (parseFloat(bid.base_price) || 0) + (parseFloat(bid.tax_amount) || 0);
                  const total = parseFloat(bid.total_amount) || 0;
                  const priceMismatch = total > 0 && priceSum > 0 && Math.abs(priceSum - total) > 1;
                  return (
                    <>
                      <div className="pipeline-form-grid">
                        <div>
                          <label style={{ fontSize: '12px', color: 'var(--color-success)', fontWeight: '700' }}>
                            Quoted Price (INR)
                            <span style={{ fontSize: '10px', fontWeight: '500', marginLeft: '6px', color: 'var(--color-success)', opacity: 0.8 }}>— determines L1 ranking</span>
                          </label>
                          <input type="number" className="glass-input" style={{ marginTop: '4px', borderColor: 'rgba(16, 185, 129, 0.4)' }} value={bid.total_amount || ''} onChange={e => updateFinBid(finSelectedVendor, 'total_amount', parseFloat(e.target.value) || 0)} />
                        </div>
                        <div>
                          <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                            Base Price (INR)
                            <span style={{ fontSize: '10px', fontWeight: '400', marginLeft: '4px', opacity: 0.6 }}>Reference</span>
                          </label>
                          <input type="number" className="glass-input" style={{ marginTop: '4px' }} value={bid.base_price || ''} onChange={e => updateFinBid(finSelectedVendor, 'base_price', parseFloat(e.target.value) || 0)} />
                        </div>
                        <div>
                          <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                            Tax Amount (INR)
                            <span style={{ fontSize: '10px', fontWeight: '400', marginLeft: '4px', opacity: 0.6 }}>Reference</span>
                          </label>
                          <input type="number" className="glass-input" style={{ marginTop: '4px' }} value={bid.tax_amount || ''} onChange={e => updateFinBid(finSelectedVendor, 'tax_amount', parseFloat(e.target.value) || 0)} />
                        </div>
                        <div>
                          <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                            Payment Terms
                            <span style={{ fontSize: '10px', fontWeight: '400', marginLeft: '4px', opacity: 0.6 }}>Reference</span>
                          </label>
                          <input type="text" className="glass-input" style={{ marginTop: '4px' }} value={bid.payment_terms || ''} onChange={e => updateFinBid(finSelectedVendor, 'payment_terms', e.target.value)} />
                        </div>
                        <div>
                          <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                            Warranty Period (months)
                            <span style={{ fontSize: '10px', fontWeight: '400', marginLeft: '4px', opacity: 0.6 }}>Reference</span>
                          </label>
                          <input type="number" className="glass-input" style={{ marginTop: '4px' }} value={bid.warranty_months || ''} onChange={e => updateFinBid(finSelectedVendor, 'warranty_months', e.target.value)} />
                        </div>
                        <div>
                          <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                            AMC Cost (Annual, INR)
                            <span style={{ fontSize: '10px', fontWeight: '400', marginLeft: '4px', opacity: 0.6 }}>Reference</span>
                          </label>
                          <input type="number" className="glass-input" style={{ marginTop: '4px' }} value={bid.amc_cost || ''} onChange={e => updateFinBid(finSelectedVendor, 'amc_cost', e.target.value)} />
                        </div>
                      </div>
                      {priceMismatch && (
                        <div style={{ marginTop: '10px', padding: '8px 12px', borderRadius: '6px', background: 'rgba(234, 179, 8, 0.08)', border: '1px solid rgba(234, 179, 8, 0.25)', fontSize: '12px', color: 'var(--color-warning)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <AlertTriangle size={14} />
                          Price mismatch: Base ({(parseFloat(bid.base_price) || 0).toLocaleString()}) + Tax ({(parseFloat(bid.tax_amount) || 0).toLocaleString()}) = {priceSum.toLocaleString()} ≠ Quoted Price ({total.toLocaleString()})
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            )}

            {/* Financial Results */}
            {finData && (
              <div style={{ marginTop: '24px', padding: '16px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.04)', border: '1px solid rgba(16, 185, 129, 0.15)' }}>
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%', padding: '20px 0' }}>
                  <div className="output-stream-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 30px', borderRadius: '12px', width: '100%', maxWidth: '600px', boxShadow: '0 8px 30px rgba(0,0,0,0.08)' }}>
                    <div>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Winning L1 Bidder</span>
                      <span style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)' }}>{finData.l1_vendor}</span>
                    </div>
                    <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--color-success)' }}>INR {finData.l1_amount?.toLocaleString()}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Evaluate Button */}
            {!finDone && (
              <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center' }}>
                <button className="btn-primary" style={{ padding: '12px 32px', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }} onClick={handleFinancialEvaluate} disabled={finEvaluating}>
                  {finEvaluating ? <RefreshCw size={16} className="spin-icon" /> : <DollarSign size={16} />}
                  {finEvaluating ? 'Ranking bids...' : 'Run Financial Ranker'}
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* ═══════════════════════════════════════════════
           CARD 5: Final Recommendation & BER
         ═══════════════════════════════════════════════ */}
      {pipelineStage === 'final' && (
        <>
          <div className="pipeline-connector"><div className="pipeline-connector-line" /></div>
          <div className="pipeline-card stage-final fade-slide-up" ref={finalCardRef}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--card-border)', paddingBottom: '14px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Award size={20} style={{ color: '#EF4444' }} />
                <h2 style={{ fontSize: '17px', fontWeight: '700', color: 'var(--text-primary)', margin: 0, borderBottom: 'none' }}>Step 5 — Final Award Recommendation</h2>
              </div>
              {recommendation && (
                <span className="pipeline-step-badge completed">✓ BER Generated</span>
              )}
            </div>

            {!recommendation && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '30px 0', textAlign: 'center' }}>
                <Award size={40} style={{ color: 'var(--accent-violet)' }} />
                <div>
                  <p style={{ color: 'var(--text-muted)', maxWidth: '500px', margin: '0 auto' }}>
                    Aggregate all data from Pre-Qualification, Technical Evaluation, and Financial Ranking to produce a comprehensive Bid Evaluation Report (BER).
                  </p>
                </div>
                <button className="btn-primary" onClick={handleGenerateRecommendation} disabled={recommending} style={{ padding: '12px 32px', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {recommending ? <RefreshCw size={16} className="spin-icon" /> : <Award size={16} />}
                  {recommending ? 'Compiling multi-stage scores...' : 'Generate Final BER'}
                </button>
              </div>
            )}

            {recommendation && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* Executive Summary */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', background: 'var(--bg-primary)', padding: '16px', borderRadius: '8px', border: '1px solid var(--card-border)' }}>
                    <div style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>Executive Summary</div>
                    <div style={{ fontSize: '14px', display: 'grid', gridTemplateColumns: '130px 1fr', gap: '6px' }}>
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

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', background: 'var(--bg-primary)', padding: '16px', borderRadius: '8px', border: '1px solid var(--card-border)' }}>
                    <div style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>Vendor Funnel Summary</div>
                    <div style={{ fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div>Total Participating: <strong>{participatingVendors.length}</strong></div>
                      <div>PQ Passed: <strong style={{ color: 'var(--color-success)' }}>{pqPassedVendors.length}</strong></div>
                      <div>Tech Qualified: <strong style={{ color: 'var(--color-success)' }}>{techQualifiedVendors.length}</strong></div>
                      <div>Financial Ranked: <strong>{finData?.rankings?.length || 0}</strong></div>
                    </div>
                  </div>
                </div>

                {/* Full Evaluation Matrix — ALL vendors */}
                <div style={{ background: 'var(--bg-primary)', padding: '16px', borderRadius: '8px', border: '1px solid var(--card-border)' }}>
                  <div style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em', marginBottom: '12px' }}>Complete Evaluation Matrix</div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', fontSize: '13px' }}>
                      <thead>
                        <tr>
                          <th style={{ padding: '8px 12px', borderBottom: '1px solid var(--card-border)', color: 'var(--text-secondary)', fontWeight: '600' }}>Bidder Name</th>
                          <th style={{ padding: '8px 12px', borderBottom: '1px solid var(--card-border)', color: 'var(--text-secondary)', fontWeight: '600' }}>PQ Status</th>
                          <th style={{ padding: '8px 12px', borderBottom: '1px solid var(--card-border)', color: 'var(--text-secondary)', fontWeight: '600' }}>Tech Score</th>
                          <th style={{ padding: '8px 12px', borderBottom: '1px solid var(--card-border)', color: 'var(--text-secondary)', fontWeight: '600' }}>Fin. Rank</th>
                          <th style={{ padding: '8px 12px', borderBottom: '1px solid var(--card-border)', color: 'var(--text-secondary)', fontWeight: '600' }}>Quoted Price</th>
                          <th style={{ padding: '8px 12px', borderBottom: '1px solid var(--card-border)', color: 'var(--text-secondary)', fontWeight: '600' }}>Outcome</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(recommendation.bidders_summary || []).map((b, i) => {
                          const isWinner = b.vendor_id === recommendation.recommended_vendor_id;
                          let outcome = '';
                          let outcomeColor = 'var(--text-muted)';
                          if (isWinner) {
                            outcome = '✓ AWARDED';
                            outcomeColor = 'var(--color-success)';
                          } else if (b.pq_status === 'FAIL') {
                            outcome = 'Failed Pre-Qualification';
                            outcomeColor = 'var(--color-danger)';
                          } else if (b.tech_score <= 0 && b.fin_rank === 'N/A') {
                            outcome = 'Failed Technical Evaluation';
                            outcomeColor = 'var(--color-danger)';
                          } else if (b.fin_rank && b.fin_rank !== 'N/A' && b.fin_rank !== 'L1') {
                            outcome = `Runner-up (${b.fin_rank})`;
                            outcomeColor = 'var(--text-secondary)';
                          } else if (b.fin_rank === 'L1' && !isWinner) {
                            outcome = 'L1 but not recommended';
                            outcomeColor = 'var(--color-warning)';
                          } else {
                            outcome = 'Not selected';
                            outcomeColor = 'var(--text-muted)';
                          }
                          return (
                            <tr key={i} style={{ borderBottom: '1px solid var(--overlay-border)', background: isWinner ? 'rgba(15, 118, 110, 0.08)' : 'transparent' }}>
                              <td style={{ padding: '10px 12px', fontWeight: isWinner ? '700' : '400' }}>
                                {b.vendor_name}
                                {isWinner && <Award size={14} style={{ marginLeft: '6px', color: 'var(--color-success)', verticalAlign: 'middle' }} />}
                              </td>
                              <td style={{ padding: '10px 12px' }}><span className={b.pq_status === 'PASS' ? 'badge badge-success' : 'badge badge-danger'}>{b.pq_status}</span></td>
                              <td style={{ padding: '10px 12px' }}>{b.tech_score > 0 ? `${b.tech_score}/100` : '-'}</td>
                              <td style={{ padding: '10px 12px', fontWeight: '600' }}>{b.fin_rank}</td>
                              <td style={{ padding: '10px 12px' }}>{b.quoted_price ? `INR ${b.quoted_price.toLocaleString()}` : '-'}</td>
                              <td style={{ padding: '10px 12px', fontSize: '12px', fontWeight: isWinner ? '700' : '500', color: outcomeColor }}>
                                {outcome}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* AI Reports */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <span className="badge" style={{ background: 'rgba(234, 179, 8, 0.1)', color: 'var(--text-primary)', borderColor: 'rgba(234, 179, 8, 0.25)', borderWidth: '1px', borderStyle: 'solid', fontWeight: '700' }}>AI Award Recommendation Narrative</span>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                      <FlowConnector />
                      <div className="output-stream-card" style={{ flex: 1, borderRadius: '6px', padding: '14px', fontSize: '13px', lineHeight: '1.7' }}>
                        <StreamText text={recommendation.award_report || ''} speed={4} markdown={true} />
                      </div>
                    </div>
                  </div>

                  <div>
                    <span className="badge" style={{ background: 'rgba(234, 179, 8, 0.1)', color: 'var(--text-primary)', borderColor: 'rgba(234, 179, 8, 0.25)', borderWidth: '1px', borderStyle: 'solid', fontWeight: '700' }}>AI Compliance & Risk Assessment</span>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                      <FlowConnector />
                      <div className="output-stream-card" style={{ flex: 1, borderRadius: '6px', padding: '14px', fontSize: '13px', lineHeight: '1.7' }}>
                        <StreamText text={recommendation.risk_assessment || 'No significant risks identified.'} speed={4} markdown={true} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Download BER */}
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: '8px' }}>
                  <button className="btn-primary" onClick={handleDownloadBER} disabled={downloading} style={{ background: 'var(--text-primary)', color: '#fff', border: 'none', padding: '12px 28px' }}>
                    <FileDown size={16} />
                    {downloading ? 'Generating...' : 'Download Full BER PDF'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ═══ Finish Pipeline ═══ */}
      {pipelineStage === 'final' && recommendation && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '40px', marginBottom: '20px' }}>
          <button 
            className="btn-primary"
            onClick={() => window.location.reload()} 
            style={{ 
              padding: '16px 48px', 
              fontSize: '16px', 
              fontWeight: 'bold', 
              background: 'var(--color-success)', 
              color: '#fff', 
              border: 'none', 
              borderRadius: '8px', 
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)'
            }}
          >
            <CheckCircle2 size={20} />
            Finish & Start New Evaluation
          </button>
        </div>
      )}
    </div>
  );
};

export default StartEvaluationWorkspace;
