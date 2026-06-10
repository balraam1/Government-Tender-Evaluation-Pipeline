import React, { useState, useEffect, useRef } from 'react';
import api from '../services/api';

/**
 * ActiveTenderBadge
 * 
 * Styled exactly like the RFP Authoring oval selector (badge-info pill).
 * - No toggle/select — just a static "ACTIVE TENDER: XXXX" pill
 * - Click on it → expands a detail card below showing all tender fields
 * - Click anywhere outside → card dismisses
 */
export const ActiveTenderBadge = ({ activeTenderId }) => {
  const [tender, setTender] = useState(null);
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  // Fetch tender details from DB when ID changes
  useEffect(() => {
    if (!activeTenderId) {
      setTender(null);
      setOpen(false);
      return;
    }
    api.getTender(activeTenderId)
      .then(data => setTender(data))
      .catch(() => setTender({ tender_number: `Tender #${activeTenderId}` }));
  }, [activeTenderId]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  if (!activeTenderId || !tender) return null;

  const rows = [
    { label: 'Tender Number',   value: tender.tender_number },
    { label: 'Title',           value: tender.title },
    { label: 'Category',        value: tender.category },
    { label: 'Department',      value: tender.department },
    { label: 'Status',          value: tender.status },
    { label: 'Estimated Budget',value: tender.budget ? `INR ${(tender.budget / 100000).toFixed(2)} Lakhs` : 'To be quoted' },
    { label: 'Description',     value: tender.description },
    { label: 'Created At',      value: tender.created_at ? new Date(tender.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : null },
  ].filter(r => r.value);

  return (
    <div
      ref={containerRef}
      style={{
        gridColumn: '1 / -1',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        marginBottom: '18px',
        position: 'relative',
        zIndex: 50,
      }}
    >
      {/* ── The oval pill — exactly matching RFP Authoring style ── */}
      <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
        <button
          onClick={() => setOpen(prev => !prev)}
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
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0',
            /* reset button defaults */
            fontFamily: 'inherit',
          }}
        >
          ACTIVE TENDER: {tender.tender_number}
        </button>

        {/* Matching down-arrow from RFP Authoring */}
        <span style={{
          position: 'absolute',
          right: '12px',
          pointerEvents: 'none',
          color: 'var(--color-info)',
          display: 'flex',
          alignItems: 'center',
          fontSize: '9px',
        }}>
          {open ? '▲' : '▼'}
        </span>
      </div>

      {/* ── Expandable detail card ── */}
      {open && (
        <div
          style={{
            marginTop: '8px',
            width: '100%',
            maxWidth: '520px',
            background: 'var(--bg-secondary, #ffffff)',
            border: '1px solid var(--card-border)',
            borderRadius: '12px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
            overflow: 'hidden',
            animation: 'slideDownFade 0.18s ease',
          }}
        >
          {/* Card header */}
          <div style={{
            padding: '10px 16px',
            background: 'rgba(3, 105, 161, 0.07)',
            borderBottom: '1px solid rgba(3, 105, 161, 0.12)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <span style={{
              fontSize: '9px',
              fontWeight: '700',
              color: 'var(--color-info)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}>
              Tender Details
            </span>
            <span style={{
              fontSize: '9px',
              color: 'var(--text-muted)',
              fontFamily: 'monospace',
            }}>
              #{activeTenderId}
            </span>
          </div>

          {/* Detail rows */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {rows.map((row, idx) => (
              <div
                key={idx}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '140px 1fr',
                  gap: '8px',
                  padding: '9px 16px',
                  borderBottom: idx < rows.length - 1 ? '1px solid var(--card-border)' : 'none',
                  background: idx % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.015)',
                  alignItems: 'start',
                }}
              >
                <span style={{
                  fontSize: '10px',
                  fontWeight: '700',
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  paddingTop: '1px',
                }}>
                  {row.label}
                </span>
                <span style={{
                  fontSize: '12px',
                  color: 'var(--text-primary)',
                  fontWeight: row.label === 'Tender Number' ? '700' : '500',
                  lineHeight: '1.4',
                  fontFamily: row.label === 'Tender Number' ? 'monospace' : 'inherit',
                  color: row.label === 'Estimated Budget'
                    ? 'var(--color-success)'
                    : row.label === 'Status'
                      ? 'var(--color-info)'
                      : 'var(--text-primary)',
                  fontWeight: row.label === 'Tender Number' || row.label === 'Status' ? '700' : '500',
                }}>
                  {row.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideDownFade {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default ActiveTenderBadge;
