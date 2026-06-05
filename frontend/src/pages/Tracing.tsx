import React, { useState, useEffect } from 'react';
import {
  Layers,
  Search,
  Clock,
  AlertCircle,
  CheckCircle2,
  FileText,
  HelpCircle,
  Code
} from 'lucide-react';

interface TracingProps {
  selectedAppId: number | 'ALL';
  refreshTrigger: number;
  onNavigateToLogs: (traceId: string) => void;
}

interface TraceListItem {
  trace_id: string;
  root_name: string;
  service_name: string;
  start_time: string;
  duration_ms: number;
  status_code: string;
  app_name: string;
  spans_count: number;
}

interface SpanDetails {
  span_id: string;
  parent_span_id: string | null;
  name: string;
  service_name: string;
  start_time: string;
  end_time: string;
  duration_ms: number;
  relative_start_ms: number;
  status_code: string;
  status_message: string | null;
  attributes: Record<string, any>;
  events: any[];
}

interface CorrelatedLog {
  id: number;
  span_id: string | null;
  service_name: string;
  severity: string;
  message: string;
  timestamp: string;
}

interface TraceWaterfallResponse {
  trace_id: string;
  spans_count: number;
  total_duration_ms: number;
  spans: SpanDetails[];
  correlated_logs: CorrelatedLog[];
}

const Tracing: React.FC<TracingProps> = ({ selectedAppId, refreshTrigger, onNavigateToLogs }) => {
  const [traces, setTraces] = useState<TraceListItem[]>([]);
  const [loadingTraces, setLoadingTraces] = useState<boolean>(true);
  const [activeTraceId, setActiveTraceId] = useState<string | null>(null);

  // Trace detail states
  const [waterfall, setWaterfall] = useState<TraceWaterfallResponse | null>(null);
  const [loadingWaterfall, setLoadingWaterfall] = useState<boolean>(false);
  const [selectedSpanId, setSelectedSpanId] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [serviceQuery, setServiceQuery] = useState<string>('');
  const [minDuration, setMinDuration] = useState<string>('');

  // Fetch list of traces
  useEffect(() => {
    setLoadingTraces(true);
    let url = 'http://localhost:8003/api/v1/dashboards/traces?limit=40';
    if (selectedAppId !== 'ALL') {
      url += `&app_id=${selectedAppId}`;
    }
    if (statusFilter) {
      url += `&status_code=${statusFilter}`;
    }
    if (serviceQuery) {
      url += `&service_name=${serviceQuery}`;
    }
    if (minDuration) {
      url += `&min_duration=${minDuration}`;
    }

    fetch(url)
      .then(res => res.json())
      .then((data: TraceListItem[]) => {
        setTraces(data);
        setLoadingTraces(false);

        // Auto-select first trace if list not empty and no trace selected
        if (data.length > 0 && !activeTraceId) {
          setActiveTraceId(data[0].trace_id);
        }
      })
      .catch(err => {
        console.error("Failed to load traces:", err);
        setLoadingTraces(false);
      });
  }, [selectedAppId, refreshTrigger, statusFilter, serviceQuery, minDuration]);

  // Fetch trace waterfall when activeTraceId changes
  useEffect(() => {
    if (!activeTraceId) {
      setWaterfall(null);
      return;
    }

    setLoadingWaterfall(true);
    fetch(`http://localhost:8003/api/v1/dashboards/traces/${activeTraceId}`)
      .then(res => res.json())
      .then((data: TraceWaterfallResponse) => {
        setWaterfall(data);
        setLoadingWaterfall(false);

        // Auto-select root span (typically first)
        if (data.spans.length > 0) {
          setSelectedSpanId(data.spans[0].span_id);
        }
      })
      .catch(err => {
        console.error("Failed to load waterfall:", err);
        setLoadingWaterfall(false);
      });
  }, [activeTraceId]);

  const activeSpan = waterfall?.spans.find(s => s.span_id === selectedSpanId);

  return (
    <div className="animate-fade-in" style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem', height: 'calc(100vh - 120px)' }}>

      {/* LEFT COLUMN: Trace Listings & Search Filters */}
      <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', padding: '1rem', height: '100%' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Layers size={18} style={{ color: 'var(--accent-purple)' }} />
          Trace Triggers
        </h3>

        {/* Search filter drawer */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-glass)', borderRadius: '0.75rem', padding: '0.75rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              className="form-control"
              placeholder="Filter Service..."
              style={{ fontSize: '0.75rem', padding: '0.4rem', flexGrow: 1 }}
              value={serviceQuery}
              onChange={e => setServiceQuery(e.target.value)}
            />
            <select
              className="form-control"
              style={{ fontSize: '0.75rem', padding: '0.4rem', width: '100px' }}
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
            >
              <option value="">All Codes</option>
              <option value="OK">OK</option>
              <option value="ERROR">ERROR</option>
              <option value="UNSET">UNSET</option>
            </select>
          </div>
          <input
            type="number"
            className="form-control"
            placeholder="Min Duration (ms)..."
            style={{ fontSize: '0.75rem', padding: '0.4rem' }}
            value={minDuration}
            onChange={e => setMinDuration(e.target.value)}
          />
        </div>

        {/* Scrollable list of distinct traces */}
        <div style={{ flexGrow: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {loadingTraces ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
              <div style={{ width: '24px', height: '24px', border: '2px solid var(--border-glass)', borderTopColor: 'var(--accent-purple)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
            </div>
          ) : traces.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', padding: '1rem', textAlign: 'center', fontSize: '0.85rem' }}>No traces match filters.</p>
          ) : (
            traces.map(t => (
              <div
                key={t.trace_id}
                className="glass-card"
                style={{
                  padding: '0.75rem',
                  cursor: 'pointer',
                  borderColor: activeTraceId === t.trace_id ? 'var(--accent-purple)' : 'var(--border-glass)',
                  backgroundColor: activeTraceId === t.trace_id ? 'rgba(124,58,237,0.04)' : 'var(--bg-secondary)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.25rem'
                }}
                onClick={() => setActiveTraceId(t.trace_id)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '160px' }}>{t.root_name}</span>
                  <span className={`badge ${t.status_code === 'ERROR' ? 'badge-danger' : 'badge-success'}`} style={{ fontSize: '0.55rem', padding: '0.1rem 0.35rem' }}>{t.status_code}</span>
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--accent-cyan)' }}>{t.service_name}</span>
                  <span style={{ fontWeight: 600 }}>{t.duration_ms} ms</span>
                </div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', marginTop: '0.15rem' }}>
                  <span>App: {t.app_name}</span>
                  <span>{t.spans_count} spans</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: Gantt Waterfall Timeline & Correlated Log viewer */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', height: '100%', overflowY: 'auto' }}>

        {/* Waterfall Card */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', minHeight: '380px' }}>
          {!activeTraceId ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '1rem', color: 'var(--text-secondary)' }}>
              <HelpCircle size={40} style={{ color: 'var(--text-muted)' }} />
              <div>Select a trace on the left to analyze execution.</div>
            </div>
          ) : loadingWaterfall || !waterfall ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ width: '32px', height: '32px', border: '3px solid var(--border-glass)', borderTopColor: 'var(--accent-purple)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
              <span style={{ color: 'var(--text-secondary)' }}>Assembling traces waterfall hierarchy...</span>
            </div>
          ) : (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

              {/* Header Stats */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.75rem' }}>
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>TRACE: {waterfall.trace_id}</div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800 }}>Distributed Trace Execution</h3>
                </div>
                <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem' }}>
                  <div style={{ padding: '0.4rem 0.75rem', background: 'var(--bg-tertiary)', borderRadius: '6px' }}>
                    Spans: <strong style={{ color: 'var(--accent-cyan)' }}>{waterfall.spans_count}</strong>
                  </div>
                  <div style={{ padding: '0.4rem 0.75rem', background: 'var(--bg-tertiary)', borderRadius: '6px' }}>
                    Total Time: <strong style={{ color: 'var(--status-warning)' }}>{waterfall.total_duration_ms} ms</strong>
                  </div>
                </div>
              </div>

              {/* Waterfall visualizer */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '280px', overflowY: 'auto', paddingRight: '0.25rem' }}>
                {waterfall.spans.map((span) => {
                  // Calculate width percentage relative to total trace duration
                  const totalTraceTime = Math.max(1, waterfall.total_duration_ms);
                  const spanWidthPct = Math.max(1.5, (span.duration_ms / totalTraceTime) * 100);
                  const spanStartPct = (span.relative_start_ms / totalTraceTime) * 100;

                  return (
                    <div
                      key={span.span_id}
                      className="trace-span-row"
                      style={{
                        border: '1px solid var(--border-glass)',
                        borderRadius: '0.5rem',
                        backgroundColor: selectedSpanId === span.span_id ? 'rgba(255,255,255,0.02)' : 'transparent',
                        borderColor: selectedSpanId === span.span_id ? 'var(--accent-cyan)' : 'var(--border-glass)'
                      }}
                      onClick={() => setSelectedSpanId(span.span_id)}
                    >
                      <div className="trace-span-header">
                        <div className="span-meta-title">
                          <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>{span.name}</span>
                          <span className="span-service-tag">{span.service_name}</span>
                        </div>
                        <span style={{ fontSize: '0.725rem', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{span.duration_ms} ms</span>
                      </div>

                      <div className="span-timeline-bar-wrapper">
                        <div
                          className={`span-timeline-bar ${span.status_code === 'ERROR' ? 'error-bar' : ''}`}
                          style={{
                            left: `${spanStartPct}%`,
                            width: `${spanWidthPct}%`
                          }}
                        >
                          {span.duration_ms > 20 && `${span.duration_ms}ms`}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Collapsible details for active selected span attributes */}
              {activeSpan && (
                <div style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-glass)', borderRadius: '0.75rem', padding: '0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.25rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Code size={12} />
                      Span Metadata Attributes
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem' }}>ID: {activeSpan.span_id}</span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.725rem' }}>
                    {Object.keys(activeSpan.attributes).length === 0 ? (
                      <span style={{ color: 'var(--text-muted)' }}>No tags recorded.</span>
                    ) : (
                      Object.entries(activeSpan.attributes).map(([k, v]) => (
                        <div key={k} style={{ display: 'flex', gap: '0.5rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{k}:</span>
                          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{String(v)}</span>
                        </div>
                      ))
                    )}
                  </div>

                  {activeSpan.status_code === 'ERROR' && activeSpan.status_message && (
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.5rem', padding: '0.4rem', borderRadius: '4px', backgroundColor: 'var(--status-error-bg)', color: 'var(--status-error)', fontSize: '0.725rem' }}>
                      <AlertCircle size={12} />
                      <strong>Error Traceback:</strong>
                      <span>{activeSpan.status_message}</span>
                    </div>
                  )}
                </div>
              )}

            </div>
          )}
        </div>

        {/* CORRELATED LOGS PANEL */}
        {activeTraceId && waterfall && (
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.5rem' }}>
              <h3 style={{ fontSize: '0.925rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FileText size={16} style={{ color: 'var(--accent-cyan)' }} />
                Correlated Telemetry Logs ({waterfall.correlated_logs.length})
              </h3>
              <button
                className="btn"
                style={{ padding: '0.25rem 0.6rem', fontSize: '0.65rem' }}
                onClick={() => onNavigateToLogs(activeTraceId)}
              >
                Logs Viewer
              </button>
            </div>

            <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {waterfall.correlated_logs.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)', padding: '1rem', textAlign: 'center', fontSize: '0.75rem' }}>No explicit system logs tied to this trace ID.</p>
              ) : (
                waterfall.correlated_logs.map(log => (
                  <div
                    key={log.id}
                    style={{
                      padding: '0.5rem',
                      borderRadius: '6px',
                      backgroundColor: 'var(--bg-tertiary)',
                      borderLeft: `3px solid ${log.severity === 'ERROR' ? 'var(--status-error)' :
                        log.severity === 'WARN' ? 'var(--status-warning)' : 'var(--text-muted)'
                        }`,
                      fontSize: '0.75rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.15rem'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>{log.service_name}</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>{new Date(log.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', wordBreak: 'break-all' }}>{log.message}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

      </div>

    </div>
  );
};

export default Tracing;
