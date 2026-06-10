import React, { useEffect, useState } from 'react';

// ── Google-style palette (from reference images) ──────────────────────────────
const G_BLUE   = '#4285F4';
const G_AMBER  = '#FBBC04';
const G_GREEN  = '#34A853';
const G_RED    = '#EA4335';
const G_GRAY   = '#9AA0A6';
const G_LIGHT  = '#E8F0FE';
const GRID_CLR = 'rgba(0,0,0,0.07)';

// Known module colours — only used for visual mapping, not data
const MODULE_COLORS = {
  rfp:            G_BLUE,
  prebid:         G_AMBER,
  document:       G_GREEN,
  pq:             '#7B61FF',
  technical:      '#00ACC1',
  financial:      G_RED,
  shortfall:      '#FF7043',
  recommendation: '#43A047',
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}

function EmptyState({ msg }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', gap: '8px',
      padding: '32px 16px', color: G_GRAY, fontSize: '12px', textAlign: 'center',
    }}>
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={G_GRAY} strokeWidth="1.5">
        <circle cx="12" cy="12" r="9" /><path d="M12 8v4m0 4h.01" />
      </svg>
      {msg}
    </div>
  );
}

function ChartCard({ title, subtitle, children }) {
  return (
    <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ borderBottom: '1px solid var(--card-border)', paddingBottom: '10px' }}>
        <div style={{ fontSize: '14px', fontWeight: '600', color: '#3C4043' }}>{title}</div>
        {subtitle && <div style={{ fontSize: '11px', color: G_GRAY, marginTop: '2px' }}>{subtitle}</div>}
      </div>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CHART 1 — Procurement Pipeline Funnel
// Data shape: [{ stage: string, count: number }]
// ─────────────────────────────────────────────────────────────────────────────
function PipelineFunnel({ data }) {
  const [animated, setAnimated] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 80);
    return () => clearTimeout(t);
  }, []);

  // All stages empty → nothing to show
  const hasData = data.some(s => s.count > 0);
  if (!hasData) return <EmptyState msg="No vendors have been processed through any evaluation stage yet." />;

  const W    = 520;
  const H    = 240;
  const max  = data[0]?.count || 1;
  const rowH = H / data.length;
  const STAGE_COLORS = [G_BLUE, '#5E97F6', G_GREEN, G_AMBER, G_RED];

  return (
    <div style={{ width: '100%', overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        {data.map((d, i) => {
          const frac   = d.count / max;
          const nextFrac = i < data.length - 1 ? data[i + 1].count / max : frac * 0.7;
          const topW   = W * frac;
          const botW   = W * nextFrac;
          const topX   = (W - topW) / 2;
          const botX   = (W - botW) / 2;
          const y      = i * rowH;
          const gap    = 3;
          const path   = `M${topX},${y + gap} L${topX + topW},${y + gap} L${botX + botW},${y + rowH - gap} L${botX},${y + rowH - gap} Z`;
          const animTopW = animated ? topW : 0;
          const animTopX = animated ? topX : W / 2;
          const animPath = `M${animTopX},${y + gap} L${animTopX + animTopW},${y + gap} L${botX + botW},${y + rowH - gap} L${botX},${y + rowH - gap} Z`;
          const col    = STAGE_COLORS[i % STAGE_COLORS.length];

          return (
            <g key={i}>
              <path d={animated ? path : animPath} fill={col}
                opacity={0.88 - i * 0.03}
                style={{ transition: `d 0.65s cubic-bezier(.4,0,.2,1) ${i * 0.1}s` }}
              />
              <text x={W / 2} y={y + rowH / 2 + 5} textAnchor="middle"
                fill="white" fontSize={11} fontWeight="600" fontFamily="Inter,sans-serif">
                {d.stage}
              </text>
              <text x={W - 8} y={y + rowH / 2 + 5} textAnchor="end"
                fill="#3C4043" fontSize={13} fontWeight="700" fontFamily="Inter,sans-serif">
                {d.count}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Stage-to-stage drop-off */}
      <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: '8px' }}>
        {data.slice(1).map((d, i) => {
          const prev     = data[i].count;
          const dropPct  = prev > 0 ? Math.round(((prev - d.count) / prev) * 100) : 0;
          return (
            <div key={i} style={{ textAlign: 'center', fontSize: '10px', color: G_GRAY }}>
              ↓ {dropPct}% drop
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CHART 2 — Budget vs. Quoted Price
// Data shape: [{ title, tender_number, budget: number, quoted: number }]
// ─────────────────────────────────────────────────────────────────────────────
function BudgetChart({ data }) {
  const [animated, setAnimated] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 120);
    return () => clearTimeout(t);
  }, []);

  // Only show rows that have at least a budget figure
  const rows = data.filter(d => d.budget > 0 || d.quoted > 0);
  if (!rows.length) return <EmptyState msg="No tenders with budget data found. Generate a tender with a budget to see this chart." />;

  const maxVal  = Math.max(...rows.flatMap(d => [d.budget, d.quoted]), 1);
  const formatINR = v =>
    v >= 1e7 ? `₹${(v / 1e7).toFixed(1)}Cr`
    : v >= 1e5 ? `₹${(v / 1e5).toFixed(0)}L`
    : `₹${Math.round(v)}`;

  const barH    = 10;
  const rowH    = 48;
  const labelW  = 120;
  const chartW  = 320;
  const H       = rows.length * rowH + 24;
  const gridSteps = 4;
  const gridVals  = Array.from({ length: gridSteps + 1 }, (_, i) => (maxVal / gridSteps) * i);

  return (
    <div style={{ width: '100%', overflowX: 'auto' }}>
      {/* Legend */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '10px', paddingLeft: `${labelW}px` }}>
        {[{ color: G_BLUE, label: 'Budget' }, { color: G_AMBER, label: 'Quoted (L1)' }].map(({ color, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: G_GRAY }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: color }} />
            {label}
          </div>
        ))}
      </div>

      <svg viewBox={`0 0 ${labelW + chartW + 70} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        {/* Vertical grid lines + axis labels */}
        {gridVals.map((v, i) => {
          const x = labelW + (v / maxVal) * chartW;
          return (
            <g key={i}>
              <line x1={x} y1={0} x2={x} y2={H - 20} stroke={GRID_CLR} strokeWidth={1} />
              <text x={x} y={H - 6} textAnchor="middle" fontSize={8} fill={G_GRAY} fontFamily="Inter,sans-serif">
                {formatINR(v)}
              </text>
            </g>
          );
        })}

        {rows.map((d, i) => {
          const y          = i * rowH + 4;
          const budgetW    = animated ? (d.budget / maxVal) * chartW : 0;
          const quotedW    = animated ? (d.quoted  / maxVal) * chartW : 0;
          const overBudget = d.quoted > 0 && d.budget > 0 && d.quoted > d.budget;
          const label      = d.title || d.tender_number || `Tender ${i + 1}`;
          const displayLabel = label.length > 18 ? label.substring(0, 16) + '...' : label;

          return (
            <g key={i}>
              <title>{label}</title>
              <text x={labelW - 6} y={y + barH + 2} textAnchor="end" fontSize={10}
                fill="#3C4043" fontFamily="Inter,sans-serif" dominantBaseline="middle">
                {displayLabel}
              </text>

              {/* Budget bar */}
              {d.budget > 0 && (
                <rect x={labelW} y={y} width={budgetW} height={barH} rx={3} fill={G_BLUE}
                  style={{ transition: `width 0.7s cubic-bezier(.4,0,.2,1) ${i * 0.08}s` }} />
              )}

              {/* Quoted bar — only if a financial evaluation exists */}
              {d.quoted > 0 && (
                <rect x={labelW} y={y + barH + 4} width={quotedW} height={barH} rx={3}
                  fill={overBudget ? G_RED : G_AMBER}
                  style={{ transition: `width 0.7s cubic-bezier(.4,0,.2,1) ${i * 0.08 + 0.05}s` }} />
              )}

              {/* Quoted value label */}
              {d.quoted > 0 && animated && (
                <text x={labelW + quotedW + 4} y={y + barH + 9} fontSize={8.5}
                  fill={overBudget ? G_RED : G_GRAY} fontFamily="Inter,sans-serif" dominantBaseline="middle">
                  {formatINR(d.quoted)}
                </text>
              )}

              {/* "No quote yet" indicator */}
              {d.quoted === 0 && (
                <text x={labelW + 6} y={y + barH + 9} fontSize={8.5}
                  fill={G_GRAY} fontFamily="Inter,sans-serif" dominantBaseline="middle" fontStyle="italic">
                  no L1 quote yet
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CHART 3 — Vendor Leaderboard with Circular Score Rings
// Data shape: [{ vendor_id, vendor_name, pq_status, tech_score, fin_rank }]
// ─────────────────────────────────────────────────────────────────────────────
function ScoreRing({ score, size = 46, color = G_BLUE }) {
  const [animated, setAnimated] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 200);
    return () => clearTimeout(t);
  }, []);

  const r     = (size - 6) / 2;
  const cx    = size / 2;
  const cy    = size / 2;
  const circ  = 2 * Math.PI * r;
  // Only fill the ring if score is a real number from DB
  const fill  = (animated && typeof score === 'number') ? (score / 100) * circ : 0;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#F1F3F4" strokeWidth={5} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={5}
        strokeLinecap="round"
        strokeDasharray={`${fill} ${circ}`}
        strokeDashoffset={circ / 4}
        style={{ transition: 'stroke-dasharray 0.9s cubic-bezier(.4,0,.2,1) 0.1s' }}
      />
      <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle"
        fontSize={typeof score === 'number' ? 11 : 9}
        fontWeight="700" fill="#3C4043" fontFamily="Inter,sans-serif">
        {typeof score === 'number' ? Math.round(score) : '—'}
      </text>
    </svg>
  );
}

function VendorLeaderboard({ data }) {
  if (!data.length) return <EmptyState msg="No vendors registered yet. Register vendors and run evaluations to populate this chart." />;

  const rankColor = { L1: G_GREEN, L2: G_BLUE, L3: G_AMBER };
  const pqColor   = { PASS: G_GREEN, FAIL: G_RED, NOT_EVALUATED: G_GRAY };
  const ringColors = [G_BLUE, G_GREEN, G_AMBER, G_RED, '#7B61FF', '#00ACC1'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {/* Header */}
      <div style={{ display: 'grid', gridTemplateColumns: '24px 1fr 56px 60px 44px',
        gap: '8px', padding: '0 4px' }}>
        {['#', 'Vendor', 'Tech', 'PQ', 'Rank'].map(h => (
          <span key={h} style={{ fontSize: '10px', color: G_GRAY, fontWeight: 600,
            textAlign: h === 'Vendor' ? 'left' : 'center' }}>{h}</span>
        ))}
      </div>

      {data.map((v, i) => (
        <div key={v.vendor_id}
          style={{ display: 'grid', gridTemplateColumns: '24px 1fr 56px 60px 44px',
            gap: '8px', padding: '8px 4px', alignItems: 'center', borderRadius: '8px',
            background: i === 0 ? G_LIGHT : 'transparent',
            border: `1px solid ${i === 0 ? G_BLUE + '22' : 'transparent'}`,
            transition: 'background 0.2s' }}>

          {/* Position badge */}
          <div style={{ width: 22, height: 22, borderRadius: '50%', display: 'flex',
            alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: '700',
            background: i < 3 ? [G_BLUE, G_AMBER, G_GREEN][i] : '#E8EAED',
            color: i < 3 ? 'white' : G_GRAY }}>
            {i + 1}
          </div>

          {/* Vendor name */}
          <div style={{ fontSize: '12px', fontWeight: i === 0 ? '600' : '400', color: '#3C4043',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {v.vendor_name}
          </div>

          {/* Technical score ring — real DB value or empty */}
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <ScoreRing score={v.tech_score} size={46} color={ringColors[i % ringColors.length]} />
          </div>

          {/* PQ status */}
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <span style={{ fontSize: '9px', fontWeight: '700', padding: '3px 6px', borderRadius: '4px',
              background: `${pqColor[v.pq_status] || G_GRAY}18`,
              color: pqColor[v.pq_status] || G_GRAY,
              border: `1px solid ${pqColor[v.pq_status] || G_GRAY}33` }}>
              {v.pq_status === 'NOT_EVALUATED' ? 'N/E' : v.pq_status}
            </span>
          </div>

          {/* Financial rank */}
          <div style={{ textAlign: 'center' }}>
            {v.fin_rank
              ? <span style={{ fontSize: '11px', fontWeight: '700', color: rankColor[v.fin_rank] || G_GRAY }}>{v.fin_rank}</span>
              : <span style={{ fontSize: '11px', color: G_GRAY }}>—</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CHART 4 — Module Activity Heatmap (last 30 days, DB data only)
// Data shape: [{ module: string, day: "YYYY-MM-DD", count: number }]
// ─────────────────────────────────────────────────────────────────────────────
function ActivityHeatmap({ data }) {
  // Build the last-30-day date axis
  const today = new Date();
  const days  = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (29 - i));
    return d.toISOString().split('T')[0];
  });

  // Derive module list purely from what the DB returned (+ known list as fallback for row labels)
  const dbModules = [...new Set(data.map(d => d.module))];
  // Show all known modules as rows so the grid is consistent even on sparse data
  const modules = Object.keys(MODULE_COLORS).filter(
    m => dbModules.includes(m) || true   // always show all rows; empty rows just show grey
  );

  // Build lookup index from DB data
  const lookup = {};
  data.forEach(({ module, day, count }) => {
    lookup[`${module}|${day}`] = count;
  });

  const maxCount = data.length > 0 ? Math.max(...data.map(d => d.count), 1) : 1;
  const hasAnyActivity = data.length > 0;

  const cellW      = 14;
  const cellH      = 14;
  const cellGap    = 3;
  const rowLabelW  = 82;

  return (
    <div style={{ width: '100%', overflowX: 'auto' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: `${cellGap}px` }}>

        {/* Day-of-month labels */}
        <div style={{ display: 'flex', paddingLeft: `${rowLabelW}px`, gap: `${cellGap}px`, marginBottom: '2px' }}>
          {days.map((day, i) => (
            <div key={day} style={{ width: cellW, flexShrink: 0, textAlign: 'center',
              fontSize: '8px', color: G_GRAY, opacity: i % 5 === 0 ? 1 : 0 }}>
              {i % 5 === 0 ? new Date(day).getDate() : ''}
            </div>
          ))}
        </div>

        {/* Module rows */}
        {modules.map(mod => (
          <div key={mod} style={{ display: 'flex', alignItems: 'center', gap: `${cellGap}px` }}>
            <div style={{ width: rowLabelW, flexShrink: 0, fontSize: '10px', color: '#3C4043',
              fontWeight: '500', textAlign: 'right', paddingRight: '8px', whiteSpace: 'nowrap' }}>
              {mod}
            </div>

            {days.map(day => {
              const count     = lookup[`${mod}|${day}`] || 0;
              const intensity = count === 0 ? 0 : 0.15 + (count / maxCount) * 0.85;
              const bg        = count === 0
                ? '#F1F3F4'
                : `rgba(${hexToRgb(MODULE_COLORS[mod] || G_BLUE)}, ${intensity})`;

              return (
                <div key={day}
                  title={count > 0 ? `${mod} · ${day} · ${count} event${count !== 1 ? 's' : ''}` : `${mod} · ${day} · no activity`}
                  style={{ width: cellW, height: cellH, borderRadius: '3px', background: bg,
                    flexShrink: 0, cursor: count > 0 ? 'pointer' : 'default' }} />
              );
            })}
          </div>
        ))}
      </div>

      {/* No-data notice inside heatmap (shown inline, grid still renders) */}
      {!hasAnyActivity && (
        <div style={{ marginTop: '10px', textAlign: 'center', fontSize: '11px', color: G_GRAY, fontStyle: 'italic' }}>
          No module activity in the last 30 days. Run any module to populate the heatmap.
        </div>
      )}

      {/* Intensity scale legend */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px',
        marginTop: '10px', justifyContent: 'flex-end' }}>
        <span style={{ fontSize: '9px', color: G_GRAY }}>Less</span>
        {[0.1, 0.3, 0.55, 0.75, 1].map((op, i) => (
          <div key={i} style={{ width: 10, height: 10, borderRadius: 2,
            background: `rgba(${hexToRgb(G_BLUE)}, ${op})` }} />
        ))}
        <span style={{ fontSize: '9px', color: G_GRAY }}>More</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Export
// ─────────────────────────────────────────────────────────────────────────────
export const DashboardCharts = ({ statsData, loading }) => {
  if (loading) {
    return (
      <>
        <style>{`
          @keyframes shimmer {
            0%   { background-position: -200% 0; }
            100% { background-position:  200% 0; }
          }
        `}</style>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="glass-card"
              style={{ height: '260px',
                background: 'linear-gradient(90deg, #F1F3F4 25%, #E8EAED 50%, #F1F3F4 75%)',
                backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite' }} />
          ))}
        </div>
      </>
    );
  }

  // statsData is null when the API call failed or returned nothing
  if (!statsData) {
    return (
      <div className="glass-card" style={{ padding: '32px', textAlign: 'center', color: G_GRAY }}>
        Could not load chart data. Make sure the backend is running and the database is reachable.
      </div>
    );
  }

  const { pipeline_funnel = [], budget_vs_quoted = [], leaderboard = [], heatmap = [] } = statsData;

  return (
    <>
      <style>{`
        @keyframes shimmer {
          0%   { background-position: -200% 0; }
          100% { background-position:  200% 0; }
        }
      `}</style>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <ChartCard
          title="Procurement Pipeline Funnel"
          subtitle="Vendor attrition across evaluation stages">
          <PipelineFunnel data={pipeline_funnel} />
        </ChartCard>

        <ChartCard
          title="Budget vs. Quoted Price"
          subtitle="Blue = sanctioned budget · Orange/Red = L1 quoted price">
          <BudgetChart data={budget_vs_quoted} />
        </ChartCard>

        <ChartCard
          title="Vendor Leaderboard"
          subtitle="Ranked by technical score · ring = score / 100">
          <VendorLeaderboard data={leaderboard} />
        </ChartCard>

        <ChartCard
          title="Module Activity Heatmap"
          subtitle="Last 30 days · cell colour intensity = event count">
          <ActivityHeatmap data={heatmap} />
        </ChartCard>
      </div>
    </>
  );
};

export default DashboardCharts;
