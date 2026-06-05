import React, { useState, useEffect } from 'react';
import {
  Terminal,
  Search,
  AlertCircle,
  Info,
  Layers,
  Clock,
  RefreshCw
} from 'lucide-react';

interface LogsProps {
  selectedAppId: number | 'ALL';
  refreshTrigger: number;
}

interface LogRecord {
  id: number;
  trace_id: string | null;
  span_id: string | null;
  service_name: string;
  severity: string;
  message: string;
  timestamp: string;
  attributes: Record<string, any>;
  app_name: string;
}

const Logs: React.FC<LogsProps> = ({ selectedAppId, refreshTrigger }) => {
  const [logs, setLogs] = useState<LogRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filtering states
  const [severityFilter, setSeverityFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [traceIdQuery, setTraceIdQuery] = useState<string>('');

  // Proactive check for sessionStorage trace correlation from Tracing tab
  useEffect(() => {
    const correlationTraceId = sessionStorage.getItem('logs_filter_trace_id');
    if (correlationTraceId) {
      setTraceIdQuery(correlationTraceId);
      sessionStorage.removeItem('logs_filter_trace_id'); // wipe immediately
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    let url = 'http://localhost:8003/api/v1/dashboards/logs?limit=150';

    if (selectedAppId !== 'ALL') {
      url += `&app_id=${selectedAppId}`;
    }
    if (severityFilter) {
      url += `&severity=${severityFilter}`;
    }
    if (searchQuery) {
      url += `&query=${encodeURIComponent(searchQuery)}`;
    }
    if (traceIdQuery) {
      url += `&trace_id=${traceIdQuery}`;
    }

    fetch(url)
      .then(res => res.json())
      .then((data: LogRecord[]) => {
        setLogs(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to load logs:", err);
        setLoading(false);
      });
  }, [selectedAppId, refreshTrigger, severityFilter, searchQuery, traceIdQuery]);

  const handleClearFilters = () => {
    setSeverityFilter('');
    setSearchQuery('');
    setTraceIdQuery('');
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', height: 'calc(100vh - 120px)' }}>

      {/* 1. Header Filter Grid Panel */}
      <div className="glass-card" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr)) 120px', gap: '1rem', padding: '1rem', alignItems: 'center' }}>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label" style={{ fontSize: '0.7rem' }}>Textual Message Search</label>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="form-control"
              style={{ fontSize: '0.8rem', paddingLeft: '32px', width: '100%', height: '36px' }}
              placeholder="Filter log message text..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label" style={{ fontSize: '0.7rem' }}>Trace ID Correlation</label>
          <input
            type="text"
            className="form-control"
            style={{ fontSize: '0.8rem', height: '36px', fontFamily: 'var(--font-mono)' }}
            placeholder="Search exact Trace ID..."
            value={traceIdQuery}
            onChange={e => setTraceIdQuery(e.target.value)}
          />
        </div>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label" style={{ fontSize: '0.7rem' }}>Severity Level</label>
          <select
            className="form-control"
            style={{ fontSize: '0.8rem', height: '36px' }}
            value={severityFilter}
            onChange={e => setSeverityFilter(e.target.value)}
          >
            <option value="">ALL SEVERITIES</option>
            <option value="INFO">INFO</option>
            <option value="WARN">WARN</option>
            <option value="ERROR">ERROR</option>
            <option value="DEBUG">DEBUG</option>
          </select>
        </div>

        <button className="btn" style={{ alignSelf: 'flex-end', height: '36px', width: '100%' }} onClick={handleClearFilters}>
          Clear Filters
        </button>
      </div>

      {/* 2. Logs Logbook List Grid */}
      <div className="glass-card" style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', padding: '1rem', overflow: 'hidden' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Terminal size={18} style={{ color: 'var(--accent-cyan)' }} />
          Structured Application Logs
        </h3>

        {/* Scrollable logs terminal viewport */}
        <div style={{ flexGrow: 1, overflowY: 'auto', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-glass)', borderRadius: '0.75rem', padding: '1rem', fontFamily: 'var(--font-mono)', fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem', height: '100%', alignItems: 'center' }}>
              <div style={{ width: '28px', height: '28px', border: '2px solid var(--border-glass)', borderTopColor: 'var(--accent-purple)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
            </div>
          ) : logs.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              No structured telemetry logs matching filters were found.
            </div>
          ) : (
            logs.map(log => {
              // Decide log color based on severity
              const isError = log.severity === 'ERROR' || log.severity === 'FATAL';
              const isWarn = log.severity === 'WARN' || log.severity === 'WARNING';
              const sevColor = isError ? 'var(--status-error)' : isWarn ? 'var(--status-warning)' : 'var(--accent-purple)';

              return (
                <div
                  key={log.id}
                  style={{
                    padding: '0.4rem 0.5rem',
                    borderRadius: '4px',
                    backgroundColor: isError ? 'var(--status-error-bg)' : 'transparent',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.15rem',
                    transition: 'var(--transition-smooth)'
                  }}
                >
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    {/* Timestamp */}
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.725rem' }}>
                      [{new Date(log.timestamp).toLocaleTimeString()}]
                    </span>

                    {/* Severity Badge */}
                    <span style={{ color: sevColor, fontWeight: 700, width: '45px', display: 'inline-block' }}>
                      {log.severity}
                    </span>

                    {/* App & Service */}
                    <span style={{ color: 'var(--accent-cyan)' }}>
                      {log.service_name}
                    </span>

                    <span style={{ color: 'var(--text-muted)', fontSize: '0.725rem' }}>
                      (App: {log.app_name})
                    </span>

                    {/* Trace ID indicator if exists */}
                    {log.trace_id && (
                      <span
                        style={{
                          fontSize: '0.7rem',
                          backgroundColor: 'var(--bg-secondary)',
                          color: 'var(--text-secondary)',
                          padding: '0.05rem 0.35rem',
                          borderRadius: '4px',
                          border: '1px solid var(--border-glass)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '2px'
                        }}
                        onClick={() => setTraceIdQuery(log.trace_id!)}
                        title="Click to filter by this trace context"
                      >
                        <Layers size={8} />
                        trace:{log.trace_id.substring(0, 8)}...
                      </span>
                    )}
                  </div>

                  {/* Log Message content */}
                  <div style={{ color: 'var(--text-primary)', paddingLeft: '0.5rem', borderLeft: `1.5px solid ${isError ? 'var(--status-error)' : isWarn ? 'var(--status-warning)' : 'var(--border-glass)'}`, wordBreak: 'break-all' }}>
                    {log.message}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

    </div>
  );
};

export default Logs;
