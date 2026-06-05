import React, { useState, useEffect, useCallback } from 'react';
import {
  Brain, RefreshCw, DollarSign, Hash, Zap, Info, X, TrendingUp,
  Calendar, Filter, BarChart2
} from 'lucide-react';
import { AppInfo } from '../App';

// ─── Types ───────────────────────────────────────────────────────────────────
interface LLMUsageProps {
  selectedAppId: number | 'ALL';
  appsList: AppInfo[];
  refreshTrigger: number;
  onClearFilter?: () => void;
}

interface MetricPoint {
  timestamp: string;
  value: number;
  service: string;
  app_name?: string;
}

interface MetricRow {
  id?: number;
  timestamp: string;
  value: number;
  service: string;
  metric_name: string;
  app_name?: string;
}

type FilterMode = 'window' | 'daterange' | 'month' | 'custom';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function toISOLocal(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function startOfMonth(year: number, month: number) {
  return new Date(year, month, 1);
}
function endOfMonth(year: number, month: number) {
  return new Date(year, month + 1, 0, 23, 59, 59, 999);
}

// ─── Tiny SVG Sparkline ───────────────────────────────────────────────────────
const Sparkline: React.FC<{ points: number[]; color: string; width?: number; height?: number }> = ({
  points, color, width = 120, height = 36,
}) => {
  if (points.length < 2) return <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>—</span>;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const pts = points.map((v, i) => {
    const x = (i / (points.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

// ─── Full Line Chart ──────────────────────────────────────────────────────────
const LineChart: React.FC<{ points: MetricPoint[]; metricName: string }> = ({ points, metricName }) => {
  if (points.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: '#94a3b8', fontSize: '0.85rem', border: '1px dashed #e2e8f0', borderRadius: 8 }}>
        No data points for selected timeframe
      </div>
    );
  }

  const values = points.map(p => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const W = 680, H = 200, PL = 55, PR = 16, PT = 12, PB = 28;
  const cW = W - PL - PR, cH = H - PT - PB;

  const svgPts = points.map((p, i) => ({
    x: PL + (i / (points.length - 1 || 1)) * cW,
    y: H - PB - ((p.value - min) / range) * cH,
    val: p.value,
    ts: p.timestamp,
  }));

  const path = svgPts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const area = `${path} L ${svgPts[svgPts.length - 1].x} ${H - PB} L ${svgPts[0].x} ${H - PB} Z`;

  const gridVals = Array.from({ length: 5 }, (_, i) => ({
    y: PT + (i / 4) * cH,
    v: max - (i / 4) * range,
  }));

  const fmt = (v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(0);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      <defs>
        <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6d28d9" stopOpacity="0.10" />
          <stop offset="100%" stopColor="#6d28d9" stopOpacity="0.00" />
        </linearGradient>
      </defs>
      {gridVals.map((g, i) => (
        <g key={i}>
          <line x1={PL} y1={g.y} x2={W - PR} y2={g.y} stroke="#f1f5f9" strokeWidth="1" />
          <text x={PL - 6} y={g.y + 4} fontSize="10" fill="#94a3b8" textAnchor="end">{fmt(g.v)}</text>
        </g>
      ))}
      <line x1={PL} y1={H - PB} x2={W - PR} y2={H - PB} stroke="#e2e8f0" strokeWidth="1" />
      <path d={area} fill="url(#lineGrad)" />
      <path d={path} fill="none" stroke="#6d28d9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {svgPts.map((p, i) => (
        (i === 0 || i === svgPts.length - 1 || p.val === max || p.val === min) && (
          <circle key={i} cx={p.x} cy={p.y} r="3.5" fill="#fff" stroke="#6d28d9" strokeWidth="2">
            <title>{`${new Date(p.ts).toLocaleString()} — ${p.val}`}</title>
          </circle>
        )
      ))}
      {svgPts.length >= 2 && (
        <>
          <text x={PL} y={H - 8} fontSize="9" fill="#94a3b8">{new Date(svgPts[0].ts).toLocaleString()}</text>
          <text x={W - PR} y={H - 8} fontSize="9" fill="#94a3b8" textAnchor="end">{new Date(svgPts[svgPts.length - 1].ts).toLocaleString()}</text>
        </>
      )}
    </svg>
  );
};

// ─── Cost Modal ───────────────────────────────────────────────────────────────
const CostModal: React.FC<{ tokens: number; usd: number; inr: number; onClose: () => void }> = ({ tokens, usd, inr, onClose }) => (
  <div
    style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(15,23,42,0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    onClick={onClose}
  >
    <div
      style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: '1.75rem', width: 440, maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.12)' }}
      onClick={e => e.stopPropagation()}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <DollarSign size={18} style={{ color: '#d97706' }} />
          <span style={{ fontWeight: 700, fontSize: '1rem', color: '#0f172a' }}>Cost Breakdown</span>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 4 }}><X size={18} /></button>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
        <tbody>
          {[
            { label: 'Total Tokens', value: tokens.toLocaleString() },
            { label: 'Rate', value: '$0.75 per 1,000,000 tokens' },
            { label: 'Cost (USD)', value: `$${usd.toFixed(6)}` },
            { label: 'Exchange Rate', value: '1 USD = ₹ 95.34' },
            { label: 'Cost (INR)', value: `₹ ${inr.toFixed(4)}` },
          ].map((row, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '0.65rem 0', color: '#64748b', fontWeight: 500 }}>{row.label}</td>
              <td style={{ padding: '0.65rem 0', color: '#0f172a', fontWeight: 700, textAlign: 'right' }}>{row.value}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', background: '#fefce8', border: '1px solid #fde68a', borderRadius: 8 }}>
        <p style={{ margin: 0, fontSize: '0.78rem', color: '#92400e' }}>
          <strong>Formula:</strong> (total_tokens ÷ 1,000,000) × $0.75 × 95.34
        </p>
      </div>
    </div>
  </div>
);

// ─── Active Filter Badge ───────────────────────────────────────────────────────
const FilterBadge: React.FC<{ label: string; onClear: () => void }> = ({ label, onClear }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
    background: '#ede9fe', border: '1px solid #c4b5fd', borderRadius: 999,
    padding: '0.2rem 0.65rem', fontSize: '0.75rem', fontWeight: 600, color: '#5b21b6'
  }}>
    <Filter size={11} />
    {label}
    <button
      onClick={onClear}
      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7c3aed', padding: 0, display: 'flex', alignItems: 'center' }}
    >
      <X size={12} />
    </button>
  </span>
);

// ─── Main Component ───────────────────────────────────────────────────────────
const LLMUsage: React.FC<LLMUsageProps> = ({ selectedAppId, appsList, refreshTrigger, onClearFilter }) => {
  // Local app selector — starts from global selector but can be custom filtered
  const [localAppId, setLocalAppId] = useState<number | 'ALL'>(selectedAppId);

  // Filter Mode
  const [filterMode, setFilterMode] = useState<FilterMode>('window');
  const [windowMinutes, setWindowMinutes] = useState(1440); // default 24h

  // Date Range
  const now = new Date();
  const defaultStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const [rangeStart, setRangeStart] = useState(toISOLocal(defaultStart));
  const [rangeEnd, setRangeEnd] = useState(toISOLocal(now));

  // Month Filter
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());

  // Custom period Filter
  const [customStart, setCustomStart] = useState(toISOLocal(defaultStart));
  const [customEnd, setCustomEnd] = useState(toISOLocal(now));

  // Metric states
  const [metricNames, setMetricNames] = useState<string[]>([]);
  const [selectedMetric, setSelectedMetric] = useState('');
  const [chartPoints, setChartPoints] = useState<MetricPoint[]>([]);
  const [tableRows, setTableRows] = useState<MetricRow[]>([]);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [showCostModal, setShowCostModal] = useState(false);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  // Sync state when global filter changes
  useEffect(() => {
    setLocalAppId(selectedAppId);
  }, [selectedAppId]);

  // Build Time API Parameters
  const buildTimeParams = useCallback((): string => {
    if (filterMode === 'window') {
      return `minutes_ago=${windowMinutes}`;
    }
    if (filterMode === 'daterange') {
      return `start_date=${encodeURIComponent(rangeStart)}&end_date=${encodeURIComponent(rangeEnd)}`;
    }
    if (filterMode === 'month') {
      const ms = startOfMonth(selectedYear, selectedMonth);
      const me = endOfMonth(selectedYear, selectedMonth);
      return `start_date=${encodeURIComponent(ms.toISOString())}&end_date=${encodeURIComponent(me.toISOString())}`;
    }
    if (filterMode === 'custom') {
      return `start_date=${encodeURIComponent(customStart)}&end_date=${encodeURIComponent(customEnd)}`;
    }
    return `minutes_ago=1440`;
  }, [filterMode, windowMinutes, rangeStart, rangeEnd, selectedYear, selectedMonth, customStart, customEnd]);

  // Fetch metric names
  const fetchMetricNames = useCallback(() => {
    setLoadingMeta(true);
    let url = 'http://localhost:8003/api/v1/dashboards/metrics/names';
    if (localAppId !== 'ALL') url += `?app_id=${localAppId}`;
    fetch(url)
      .then(r => r.json())
      .then((data: { metrics: string[] }) => {
        const all = data.metrics || [];
        const llm = all.filter(n =>
          n.toLowerCase().includes('llm') ||
          n.toLowerCase().includes('token') ||
          n.toLowerCase().includes('ai') ||
          n.toLowerCase().includes('model')
        );
        // Prioritize/sort common metrics so they show up first
        llm.sort((a, b) => {
          const priority = ['llm_total_tokens', 'llm_cost_usd', 'llm_total_tokens_24h'];
          const idxA = priority.indexOf(a);
          const idxB = priority.indexOf(b);
          if (idxA !== -1 && idxB !== -1) return idxA - idxB;
          if (idxA !== -1) return -1;
          if (idxB !== -1) return 1;
          return a.localeCompare(b);
        });

        setMetricNames(llm);
        setSelectedMetric(prev => (llm.includes(prev) ? prev : llm[0] || ''));
        setLoadingMeta(false);
      })
      .catch(() => setLoadingMeta(false));
  }, [localAppId, refreshTrigger]);

  useEffect(() => { fetchMetricNames(); }, [fetchMetricNames]);

  // Fetch metric data
  const fetchMetricData = useCallback(() => {
    if (!selectedMetric) { setChartPoints([]); setTableRows([]); return; }
    setLoadingData(true);
    const timeParams = buildTimeParams();
    let url = `http://localhost:8003/api/v1/dashboards/metrics?metric_name=${encodeURIComponent(selectedMetric)}&${timeParams}`;
    if (localAppId !== 'ALL') url += `&app_id=${localAppId}`;

    fetch(url)
      .then(r => r.json())
      .then((data: { timeline: MetricPoint[]; metric_name: string }) => {
        const pts = data.timeline || [];
        setChartPoints(pts);
        setTableRows(pts.map((p, i) => ({
          id: i + 1,
          timestamp: p.timestamp,
          value: p.value,
          service: p.service,
          metric_name: data.metric_name,
          app_name: p.app_name,
        })));
        setLastFetched(new Date());
        setLoadingData(false);
      })
      .catch(() => setLoadingData(false));
  }, [selectedMetric, localAppId, buildTimeParams]);

  useEffect(() => { fetchMetricData(); }, [fetchMetricData, refreshTrigger]);

  // Clear all filters
  const clearAllFilters = () => {
    setLocalAppId('ALL');
    setFilterMode('window');
    setWindowMinutes(1440);
    if (onClearFilter) {
      onClearFilter();
    }
  };

  const hasAppFilter = localAppId !== 'ALL';
  const hasTimeFilter = filterMode !== 'window' || windowMinutes !== 1440;

  // Compute stats
  const totalTokens = tableRows.reduce((s, r) => s + r.value, 0);
  const maxValue = tableRows.length ? Math.max(...tableRows.map(r => r.value)) : 0;
  const avgValue = tableRows.length ? totalTokens / tableRows.length : 0;
  const uniqueServices = [...new Set(tableRows.map(r => r.service))];
  const uniqueApps = [...new Set(tableRows.map(r => r.app_name).filter(Boolean))];

  const RATE = 0.75, FX = 95.34;
  const costUSD = (totalTokens / 1_000_000) * RATE;
  const costINR = costUSD * FX;

  const selectedAppName = localAppId === 'ALL'
    ? `All Applications (${appsList.length})`
    : appsList.find(a => a.id === localAppId)?.name ?? `App ${localAppId}`;

  const timeRangeLabel = (() => {
    if (filterMode === 'window') {
      const labels: Record<number, string> = { 15: '15 min', 60: '1 hour', 360: '6 hours', 1440: '24 hours' };
      return labels[windowMinutes] || `${windowMinutes} min`;
    }
    if (filterMode === 'daterange') return `${rangeStart.replace('T', ' ')} → ${rangeEnd.replace('T', ' ')}`;
    if (filterMode === 'month') {
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      return `${months[selectedMonth]} ${selectedYear}`;
    }
    if (filterMode === 'custom') return `${customStart.replace('T', ' ')} → ${customEnd.replace('T', ' ')}`;
    return '';
  })();

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);
  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  const showAllApps = localAppId === 'ALL';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {showCostModal && (
        <CostModal tokens={totalTokens} usd={costUSD} inr={costINR} onClose={() => setShowCostModal(false)} />
      )}

      {/* ── FILTER CONTROLS PANEL ── */}
      <div style={{
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: 14,
        padding: '1.1rem 1.4rem',
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      }}>
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Brain size={18} style={{ color: '#6d28d9' }} />
            <span style={{ fontWeight: 700, fontSize: '1rem', color: '#0f172a' }}>LLM Usage Filters</span>
          </div>
          {lastFetched && (
            <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Updated {lastFetched.toLocaleTimeString()}</span>
          )}

          {/* Filter badges */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginLeft: '0.5rem' }}>
            {hasAppFilter && (
              <FilterBadge
                label={appsList.find(a => a.id === localAppId)?.name ?? `App ${localAppId}`}
                onClear={() => setLocalAppId('ALL')}
              />
            )}
            {hasTimeFilter && (
              <FilterBadge
                label={timeRangeLabel}
                onClear={() => { setFilterMode('window'); setWindowMinutes(1440); }}
              />
            )}
          </div>

          {/* Clear Filters */}
          {(hasAppFilter || hasTimeFilter) && (
            <button
              onClick={clearAllFilters}
              style={{
                marginLeft: 'auto',
                display: 'flex', alignItems: 'center', gap: '0.3rem',
                background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8,
                padding: '0.4rem 0.75rem', fontSize: '0.78rem', fontWeight: 600,
                color: '#dc2626', cursor: 'pointer',
              }}
            >
              <X size={13} /> Clear Filters
            </button>
          )}
        </div>

        {/* Controls Grid */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          {/* Application Selection */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Application</label>
            <select
              className="app-selector-dropdown"
              value={localAppId}
              style={{ fontSize: '0.82rem', minWidth: 200 }}
              onChange={e => {
                const val = e.target.value;
                setLocalAppId(val === 'ALL' ? 'ALL' : Number(val));
              }}
            >
              <option value="ALL">🔍 All Applications ({appsList.length})</option>
              {appsList.map(app => (
                <option key={app.id} value={app.id}>
                  {app.environment === 'PRODUCTION' ? '🟢' : '🟡'} {app.name}
                </option>
              ))}
            </select>
          </div>

          {/* Metric Selector */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Metric</label>
            <select
              className="app-selector-dropdown"
              value={selectedMetric}
              style={{ fontSize: '0.82rem', minWidth: 220 }}
              disabled={loadingMeta || metricNames.length === 0}
              onChange={e => setSelectedMetric(e.target.value)}
            >
              {loadingMeta && <option>Loading…</option>}
              {!loadingMeta && metricNames.length === 0 && <option>No LLM metrics found</option>}
              {metricNames.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>

          {/* Time Filter Mode Tabs */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Timeframe Type</label>
            <div style={{ display: 'flex', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
              {(['window', 'daterange', 'month', 'custom'] as FilterMode[]).map(mode => (
                <button
                  key={mode}
                  onClick={() => setFilterMode(mode)}
                  style={{
                    padding: '0.42rem 0.8rem',
                    fontSize: '0.78rem', fontWeight: 600,
                    border: 'none', cursor: 'pointer',
                    background: filterMode === mode ? '#6d28d9' : 'transparent',
                    color: filterMode === mode ? '#fff' : '#64748b',
                    borderRight: '1px solid #e2e8f0',
                  }}
                >
                  {mode === 'window' ? 'Window' : mode === 'daterange' ? 'Date Range' : mode === 'month' ? 'Month' : 'Custom'}
                </button>
              ))}
            </div>
          </div>

          {/* Window minutes */}
          {filterMode === 'window' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Window Size</label>
              <select
                className="app-selector-dropdown"
                value={windowMinutes}
                style={{ fontSize: '0.82rem' }}
                onChange={e => setWindowMinutes(Number(e.target.value))}
              >
                <option value={15}>15 minutes</option>
                <option value={60}>1 hour</option>
                <option value={360}>6 hours</option>
                <option value={1440}>24 hours</option>
                <option value={4320}>3 days</option>
                <option value={10080}>7 days</option>
              </select>
            </div>
          )}

          {/* Date range inputs */}
          {filterMode === 'daterange' && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>From</label>
                <input
                  type="datetime-local"
                  value={rangeStart}
                  onChange={e => setRangeStart(e.target.value)}
                  style={{ fontSize: '0.82rem', padding: '0.42rem 0.65rem', border: '1px solid #e2e8f0', borderRadius: 8 }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>To</label>
                <input
                  type="datetime-local"
                  value={rangeEnd}
                  onChange={e => setRangeEnd(e.target.value)}
                  style={{ fontSize: '0.82rem', padding: '0.42rem 0.65rem', border: '1px solid #e2e8f0', borderRadius: 8 }}
                />
              </div>
            </>
          )}

          {/* Month selector */}
          {filterMode === 'month' && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Month</label>
                <select
                  className="app-selector-dropdown"
                  value={selectedMonth}
                  style={{ fontSize: '0.82rem' }}
                  onChange={e => setSelectedMonth(Number(e.target.value))}
                >
                  {monthNames.map((m, i) => <option key={i} value={i}>{m}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Year</label>
                <select
                  className="app-selector-dropdown"
                  value={selectedYear}
                  style={{ fontSize: '0.82rem' }}
                  onChange={e => setSelectedYear(Number(e.target.value))}
                >
                  {years.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </>
          )}

          {/* Custom period inputs */}
          {filterMode === 'custom' && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Start</label>
                <input
                  type="datetime-local"
                  value={customStart}
                  onChange={e => setCustomStart(e.target.value)}
                  style={{ fontSize: '0.82rem', padding: '0.42rem 0.65rem', border: '1px solid #e2e8f0', borderRadius: 8 }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>End</label>
                <input
                  type="datetime-local"
                  value={customEnd}
                  onChange={e => setCustomEnd(e.target.value)}
                  style={{ fontSize: '0.82rem', padding: '0.42rem 0.65rem', border: '1px solid #e2e8f0', borderRadius: 8 }}
                />
              </div>
            </>
          )}

          {/* Apply button */}
          <button
            onClick={fetchMetricData}
            disabled={loadingData}
            style={{
              background: '#6d28d9', border: 'none', borderRadius: 8,
              padding: '0.5rem 1rem', fontSize: '0.82rem', fontWeight: 600,
              color: '#fff', cursor: loadingData ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: '0.4rem',
            }}
          >
            <RefreshCw size={14} style={{ animation: loadingData ? 'spin 1s linear infinite' : 'none' }} />
            Apply
          </button>
        </div>
      </div>

      {/* ── COST + ESTIMATE KPI BARNER ── */}
      <div style={{
        background: 'linear-gradient(135deg, #fdf4ff 0%, #ede9fe 50%, #dbeafe 100%)',
        border: '1px solid #e2e8f0',
        borderRadius: 14,
        padding: '1.25rem 1.5rem',
        display: 'flex',
        alignItems: 'center',
        gap: '1.5rem',
        flexWrap: 'wrap',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: '0 0 auto' }}>
          <div style={{ width: 46, height: 46, background: 'rgba(255,255,255,0.8)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(109,40,217,0.15)' }}>
            <DollarSign size={22} style={{ color: '#d97706' }} />
          </div>
          <div>
            <p style={{ margin: 0, fontSize: '0.7rem', fontWeight: 700, color: '#5b21b6', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Live Cost Estimate</p>
            <p style={{ margin: 0, fontSize: '0.75rem', color: '#7c3aed', fontWeight: 500 }}>{selectedAppName} · {timeRangeLabel}</p>
          </div>
        </div>

        <div style={{ width: 1, height: 44, background: 'rgba(109,40,217,0.15)', flexShrink: 0 }} />

        <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', flex: 1 }}>
          {[
            { label: 'Total Tokens', value: totalTokens > 0 ? totalTokens.toLocaleString() : '—', color: '#0f172a' },
            { label: 'USD Cost', value: totalTokens > 0 ? `$${costUSD.toFixed(4)}` : '—', color: '#0891b2' },
            { label: 'INR Cost', value: totalTokens > 0 ? `₹ ${costINR.toFixed(2)}` : '—', color: '#d97706' },
          ].map((item, i) => (
            <div key={i}>
              <p style={{ margin: 0, fontSize: '0.68rem', color: '#7c3aed', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{item.label}</p>
              <p style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: item.color, letterSpacing: '-0.02em' }}>{item.value}</p>
            </div>
          ))}
        </div>

        <button
          onClick={() => setShowCostModal(true)}
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(255,255,255,0.7)', border: '1px solid #c4b5fd', borderRadius: 8, padding: '0.5rem 0.9rem', fontSize: '0.8rem', fontWeight: 600, color: '#5b21b6', cursor: 'pointer' }}
        >
          <Info size={14} />
          Breakdown
        </button>
      </div>

      {/* ── SUMMARY KPI CARDS ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.875rem' }}>
        {[
          { icon: <Hash size={16} style={{ color: '#6d28d9' }} />, label: 'Data Points', value: tableRows.length.toLocaleString(), bg: '#f5f3ff' },
          { icon: <TrendingUp size={16} style={{ color: '#0891b2' }} />, label: 'Total Tokens', value: totalTokens > 0 ? totalTokens.toLocaleString() : '—', bg: '#f0f9ff' },
          { icon: <Zap size={16} style={{ color: '#059669' }} />, label: 'Avg per Point', value: avgValue > 0 ? avgValue.toFixed(0) : '—', bg: '#f0fdf4' },
          { icon: <TrendingUp size={16} style={{ color: '#dc2626' }} />, label: 'Peak Value', value: maxValue > 0 ? maxValue.toLocaleString() : '—', bg: '#fef2f2' },
          { icon: <Brain size={16} style={{ color: '#d97706' }} />, label: 'Services', value: uniqueServices.length > 0 ? uniqueServices.length.toString() : '—', bg: '#fffbeb' },
          ...(showAllApps ? [{ icon: <BarChart2 size={16} style={{ color: '#7c3aed' }} />, label: 'Apps with Data', value: uniqueApps.length > 0 ? uniqueApps.length.toString() : '—', bg: '#f5f3ff' }] : []),
        ].map((card, i) => (
          <div key={i} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '1rem 1.1rem', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
              <div style={{ width: 28, height: 28, background: card.bg, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{card.icon}</div>
              <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{card.label}</span>
            </div>
            <p style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* ── LINE CHART ── */}
      {selectedMetric && (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '1.25rem 1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <p style={{ margin: 0, fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Metric Timeline</p>
              <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: '#0f172a' }}>{selectedMetric}</p>
            </div>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
              {showAllApps && uniqueApps.map(app => (
                <span key={app} style={{ fontSize: '0.72rem', background: '#ede9fe', border: '1px solid #c4b5fd', borderRadius: 999, padding: '0.15rem 0.55rem', color: '#5b21b6', fontWeight: 600 }}>{app}</span>
              ))}
              {uniqueServices.map(s => (
                <span key={s} style={{ fontSize: '0.72rem', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 999, padding: '0.15rem 0.55rem', color: '#475569', fontWeight: 600 }}>{s}</span>
              ))}
            </div>
          </div>

          {loadingData ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, gap: '0.75rem', color: '#94a3b8' }}>
              <div style={{ width: 20, height: 20, border: '2px solid #e2e8f0', borderTopColor: '#6d28d9', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              Loading data…
            </div>
          ) : (
            <LineChart points={chartPoints} metricName={selectedMetric} />
          )}
        </div>
      )}

      {/* ── RAW DATA TABLE ── */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: '#0f172a' }}>Raw Metric Records</p>
            <p style={{ margin: 0, fontSize: '0.72rem', color: '#94a3b8' }}>
              {tableRows.length} record{tableRows.length !== 1 ? 's' : ''} · {selectedMetric || 'No metric selected'} · {selectedAppName} · {timeRangeLabel}
            </p>
          </div>
          {tableRows.length > 0 && (
            <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#059669', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 999, padding: '0.2rem 0.6rem' }}>
              ● Live
            </span>
          )}
        </div>

        {!selectedMetric && (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.875rem' }}>
            <Brain size={36} style={{ color: '#e2e8f0', display: 'block', margin: '0 auto 0.75rem' }} />
            Select a metric above to view data
          </div>
        )}

        {selectedMetric && loadingData && (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.875rem' }}>
            <div style={{ width: 24, height: 24, border: '2px solid #e2e8f0', borderTopColor: '#6d28d9', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 0.75rem' }} />
            Fetching records…
          </div>
        )}

        {selectedMetric && !loadingData && tableRows.length === 0 && (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.875rem' }}>
            <Brain size={36} style={{ color: '#e2e8f0', display: 'block', margin: '0 auto 0.75rem' }} />
            No records found for <strong style={{ color: '#475569' }}>{selectedMetric}</strong> in {selectedAppName} for {timeRangeLabel}
          </div>
        )}

        {selectedMetric && !loadingData && tableRows.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  {(showAllApps
                    ? ['#', 'Timestamp', 'Application', 'Service', 'Metric', 'Value', 'Trend']
                    : ['#', 'Timestamp', 'Service', 'Metric', 'Value', 'Trend']
                  ).map(h => (
                    <th key={h} style={{ padding: '0.7rem 1.25rem', fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: h === 'Value' ? 'right' : 'left', borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableRows.slice().reverse().map((row, i, arr) => {
                  const prev = arr[i + 1];
                  const delta = prev ? row.value - prev.value : 0;
                  const isLast = i === arr.length - 1;
                  return (
                    <tr key={i} style={{ borderBottom: isLast ? 'none' : '1px solid #f8fafc' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#fafafa')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={{ padding: '0.65rem 1.25rem', fontSize: '0.78rem', color: '#94a3b8', fontWeight: 500 }}>
                        {tableRows.length - i}
                      </td>
                      <td style={{ padding: '0.65rem 1.25rem', fontSize: '0.8rem', color: '#475569', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
                        {new Date(row.timestamp).toLocaleString()}
                      </td>
                      {showAllApps && (
                        <td style={{ padding: '0.65rem 1.25rem', fontSize: '0.78rem' }}>
                          <span style={{ background: '#ede9fe', border: '1px solid #c4b5fd', borderRadius: 999, padding: '0.15rem 0.55rem', color: '#5b21b6', fontWeight: 600, fontSize: '0.75rem' }}>
                            {row.app_name || '—'}
                          </span>
                        </td>
                      )}
                      <td style={{ padding: '0.65rem 1.25rem' }}>
                        <span style={{ fontSize: '0.75rem', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 999, padding: '0.15rem 0.55rem', color: '#475569', fontWeight: 600 }}>
                          {row.service}
                        </span>
                      </td>
                      <td style={{ padding: '0.65rem 1.25rem', fontSize: '0.78rem', color: '#6d28d9', fontFamily: 'var(--font-mono)' }}>
                        {row.metric_name}
                      </td>
                      <td style={{ padding: '0.65rem 1.25rem', fontSize: '0.875rem', fontWeight: 700, color: '#0f172a', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                        {row.value.toLocaleString()}
                        {delta !== 0 && (
                          <span style={{ marginLeft: 6, fontSize: '0.7rem', fontWeight: 600, color: delta > 0 ? '#059669' : '#dc2626' }}>
                            {delta > 0 ? '↑' : '↓'}{Math.abs(delta).toFixed(0)}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '0.65rem 1.25rem' }}>
                        <Sparkline
                          points={tableRows.slice(Math.max(0, tableRows.length - i - 8), tableRows.length - i).map(r => r.value)}
                          color="#6d28d9"
                          width={80}
                          height={28}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '2px solid #f1f5f9', background: '#f8fafc' }}>
                  <td colSpan={showAllApps ? 5 : 4} style={{ padding: '0.7rem 1.25rem', fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>
                    Total ({tableRows.length} records)
                  </td>
                  <td style={{ padding: '0.7rem 1.25rem', fontSize: '0.875rem', fontWeight: 800, color: '#0f172a', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                    {totalTokens.toLocaleString()}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {!loadingMeta && metricNames.length === 0 && (
        <div style={{ background: '#fff', border: '1.5px dashed #e2e8f0', borderRadius: 12, padding: '3rem', textAlign: 'center' }}>
          <Brain size={42} style={{ color: '#e2e8f0', display: 'block', margin: '0 auto 1rem' }} />
          <p style={{ margin: '0 0 0.4rem', fontWeight: 700, fontSize: '1rem', color: '#0f172a' }}>No LLM Metrics Detected</p>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b', maxWidth: 400, marginLeft: 'auto', marginRight: 'auto' }}>
            No metrics matching <code style={{ background: '#f1f5f9', padding: '0.1rem 0.4rem', borderRadius: 4, fontSize: '0.8rem' }}>llm / token / ai</code> were found for{' '}
            <strong>{selectedAppName}</strong>. Push data via OTLP or run{' '}
            <code style={{ background: '#f1f5f9', padding: '0.1rem 0.4rem', borderRadius: 4, fontSize: '0.8rem' }}>python test_otlp.py</code>.
          </p>
        </div>
      )}
    </div>
  );
};

export default LLMUsage;
