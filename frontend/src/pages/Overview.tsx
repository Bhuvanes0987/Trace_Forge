import React, { useState, useEffect } from 'react';
import { AppInfo } from '../App';
import {
  Server,
  Activity,
  AlertTriangle,
  Clock,
  TrendingUp,
  CheckCircle,
  ArrowRight,
  WifiOff
} from 'lucide-react';

interface OverviewProps {
  selectedAppId: number | 'ALL';
  appsList: AppInfo[];
  refreshTrigger: number;
  onNavigate: (tab: string) => void;
}

interface SummaryStats {
  registered_applications: number;
  active_incidents: number;
  total_traces: number;
  avg_latency_ms: number;
  error_rate_pct: number;
}

interface ServiceStatus {
  service_name: string;
  requests_count: number;
  avg_latency_ms: number;
  error_rate: number;
  status: 'HEALTHY' | 'WARNING' | 'CRITICAL';
}

interface RecentIncident {
  id: number;
  rule_name: string;
  service_name: string;
  severity: string;
  current_value: number;
  created_at: string;
  app_name: string;
}

interface OverviewData {
  summary: SummaryStats;
  services: ServiceStatus[];
  recent_incidents: RecentIncident[];
}

const Overview: React.FC<OverviewProps> = ({ selectedAppId, appsList, refreshTrigger, onNavigate }) => {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    let url = 'http://localhost:8003/api/v1/dashboards/overview';
    if (selectedAppId !== 'ALL') {
      url += `?app_id=${selectedAppId}`;
    }

    fetch(url)
      .then(res => {
        if (!res.ok) throw new Error(`Server returned ${res.status} — check your backend route.`);
        return res.json();
      })
      .then((resData: any) => {
        // Handle wrapped responses e.g. { data: { summary, services, ... } }
        const normalized: OverviewData = resData?.data ?? resData;

        if (!normalized?.summary) {
          console.warn("Overview API response missing 'summary' field:", resData);
          setError("API response is missing expected fields. Check backend /dashboards/overview.");
          setData(null);
        } else {
          setData(normalized);
          setError(null);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to load overview data:", err);
        setError(err.message ?? "Failed to connect to backend.");
        setData(null);
        setLoading(false);
      });
  }, [selectedAppId, refreshTrigger]);

  // Loading state
  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid var(--border-glass)', borderTopColor: 'var(--accent-purple)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        <p style={{ color: 'var(--text-secondary)' }}>Aggregating time-series data & traces...</p>
      </div>
    );
  }

  // Error state
  if (error || !data || !data.summary) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px', flexDirection: 'column', gap: '1rem' }}>
        <WifiOff size={36} style={{ color: 'var(--status-error)' }} />
        <p style={{ color: 'var(--status-error)', fontWeight: 600 }}>Failed to load overview</p>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.825rem', maxWidth: '400px', textAlign: 'center' }}>
          {error ?? "Unexpected response from server. Open the console for details."}
        </p>
      </div>
    );
  }

  // Safe to destructure — all fields are verified above
  const { summary, services, recent_incidents } = data;

  return (
    <div className="animate-fade-in">
      {/* 1. Primary Metrics Row */}
      <div className="stats-grid">
        <div className="glass-card stat-widget">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stat-label">Registered Stacks</span>
            <Server size={18} style={{ color: 'var(--accent-cyan)' }} />
          </div>
          <span className="stat-value">{summary.registered_applications}</span>
          <div className="stat-indicator" style={{ color: 'var(--text-secondary)' }}>
            17+ Scope Goal
          </div>
        </div>

        <div
          className="glass-card stat-widget"
          style={{ borderLeft: summary.active_incidents > 0 ? '3px solid var(--status-error)' : '1px solid var(--border-glass)' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stat-label">Active Incidents</span>
            <AlertTriangle size={18} style={{ color: summary.active_incidents > 0 ? 'var(--status-error)' : 'var(--text-muted)' }} />
          </div>
          <span className={`stat-value ${summary.active_incidents > 0 ? 'value-error' : ''}`}>
            {summary.active_incidents}
          </span>
          <div className="stat-indicator" style={{ color: summary.active_incidents > 0 ? 'var(--status-error)' : 'var(--status-success)' }}>
            {summary.active_incidents > 0 ? 'Action Required' : 'All systems operating'}
          </div>
        </div>

        <div className="glass-card stat-widget">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stat-label">Distributed Traces</span>
            <Activity size={18} style={{ color: 'var(--accent-purple)' }} />
          </div>
          <span className="stat-value">{summary.total_traces.toLocaleString()}</span>
          <div className="stat-indicator" style={{ color: 'var(--status-success)' }}>
            +100% telemetry ingest
          </div>
        </div>

        <div className="glass-card stat-widget">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stat-label">P95 Latency</span>
            <Clock size={18} style={{ color: 'var(--accent-blue)' }} />
          </div>
          <span className="stat-value">{summary.avg_latency_ms} ms</span>
          <div className="stat-indicator" style={{ color: summary.avg_latency_ms > 800 ? 'var(--status-warning)' : 'var(--status-success)' }}>
            {summary.avg_latency_ms > 800 ? 'Slow Response' : 'Within normal SLA'}
          </div>
        </div>

        <div className="glass-card stat-widget">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stat-label">Error Ratio</span>
            <TrendingUp size={18} style={{ color: 'var(--status-error)' }} />
          </div>
          <span className="stat-value">{summary.error_rate_pct}%</span>
          <div className="stat-indicator" style={{ color: summary.error_rate_pct > 5 ? 'var(--status-error)' : 'var(--status-success)' }}>
            {summary.error_rate_pct > 5 ? 'High Rate Warning' : 'Target SLA met (< 1%)'}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem', marginTop: '2rem' }}>
        {/* 2. Microservices Status Table */}
        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Microservices Telemetry & Status</h3>
            <button className="btn" onClick={() => onNavigate('tracing')}>
              Trace Flows
              <ArrowRight size={14} />
            </button>
          </div>

          <div className="table-container">
            {services.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', padding: '1rem', textAlign: 'center' }}>
                No service spans received yet. Boot the simulator to stream data!
              </p>
            ) : (
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Service Name</th>
                    <th>Requests Count</th>
                    <th>Avg Latency</th>
                    <th>Error Rate</th>
                    <th>Status Badge</th>
                  </tr>
                </thead>
                <tbody>
                  {services.map((svc) => (
                    <tr key={svc.service_name}>
                      <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{svc.service_name}</td>
                      <td>{svc.requests_count}</td>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>{svc.avg_latency_ms} ms</td>
                      <td style={{ color: svc.error_rate > 5 ? 'var(--status-error)' : 'var(--text-primary)' }}>
                        {svc.error_rate}%
                      </td>
                      <td>
                        <span className={`badge ${svc.status === 'HEALTHY' ? 'badge-success' :
                          svc.status === 'WARNING' ? 'badge-warning' : 'badge-danger'
                          }`}>
                          {svc.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* 3. Incidents Feed */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Active Outages & Alerts</h3>
            <span className="badge badge-danger">{recent_incidents.length}</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', flexGrow: 1 }}>
            {recent_incidents.length === 0 ? (
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                height: '100%', gap: '0.5rem', color: 'var(--text-secondary)', textAlign: 'center',
                border: '1px dashed var(--border-glass)', borderRadius: '0.75rem', padding: '1.5rem'
              }}>
                <CheckCircle size={32} style={{ color: 'var(--status-success)' }} />
                <div>No active alerts!</div>
                <div style={{ fontSize: '0.75rem' }}>All systems operating under normal parameters.</div>
              </div>
            ) : (
              recent_incidents.map(inc => (
                <div
                  key={inc.id}
                  onClick={() => onNavigate('alerts')}
                  style={{
                    padding: '0.85rem',
                    borderRadius: '0.75rem',
                    backgroundColor: 'rgba(239, 68, 68, 0.05)',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.25rem',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.825rem', fontWeight: 700, color: 'var(--text-primary)' }}>{inc.rule_name}</span>
                    <span className="badge badge-danger" style={{ fontSize: '0.6rem', padding: '0.1rem 0.35rem' }}>{inc.severity}</span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    Service: <span style={{ color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>{inc.service_name}</span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    App: <span style={{ color: 'var(--text-primary)' }}>{inc.app_name}</span>
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem', textAlign: 'right' }}>
                    {new Date(inc.created_at).toLocaleTimeString()}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Overview;
