import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle,
  HelpCircle,
  Clock,
  ChevronRight,
  Sparkles
} from 'lucide-react';

interface AlertsProps {
  selectedAppId: number | 'ALL';
  refreshTrigger: number;
  onIncidentResolved: () => void;
}

interface IncidentRecord {
  id: number;
  app_id: number;
  app_name: string;
  rule_name: string;
  service_name: string;
  metric_name: string;
  threshold: number;
  current_value: number;
  severity: string;
  status: string;
  created_at: string;
  resolved_at: string | null;
}

const Alerts: React.FC<AlertsProps> = ({ selectedAppId, refreshTrigger, onIncidentResolved }) => {
  const [incidents, setIncidents] = useState<IncidentRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [statusTab, setStatusTab] = useState<'TRIGGERED' | 'RESOLVED'>('TRIGGERED');
  const [resolvingId, setResolvingId] = useState<number | null>(null);

  useEffect(() => {
    setLoading(true);
    let url = `http://localhost:8003/api/v1/alerts/incidents?status=${statusTab}`;
    if (selectedAppId !== 'ALL') {
      url += `&app_id=${selectedAppId}`;
    }

    fetch(url)
      .then(res => res.json())
      .then((data: IncidentRecord[]) => {
        setIncidents(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to load incidents:", err);
        setLoading(false);
      });
  }, [selectedAppId, refreshTrigger, statusTab]);

  const handleResolve = (id: number) => {
    setResolvingId(id);
    fetch(`http://localhost:8003/api/v1/alerts/incidents/${id}/resolve`, {
      method: 'POST'
    })
      .then(res => res.json())
      .then(() => {
        setResolvingId(null);
        onIncidentResolved(); // refresh overview and App stats
      })
      .catch(err => {
        console.error("Failed to resolve incident:", err);
        setResolvingId(null);
      });
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* 1. Static Alerting Config Box */}
      <div className="glass-card" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem', padding: '1.5rem', borderLeft: '3px solid var(--accent-purple)' }}>
        <div>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Sparkles size={20} style={{ color: 'var(--status-warning)' }} />
            Operational Alert Threshold Engine
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Aether includes an automated background rules inspector that evaluates incoming OpenTelemetry system metrics in real-time. Outages trigger alerts instantly, cataloging events into our system logs, provisioning compliance audit records, and firing notifications.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', fontSize: '0.725rem', background: 'var(--bg-tertiary)', border: '1px solid var(--border-glass)', borderRadius: '0.75rem', padding: '0.75rem' }}>
          <strong style={{ color: 'var(--text-primary)', marginBottom: '0.15rem' }}>Configured Rule Limits:</strong>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>High CPU Rule:</span>
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--status-error)', fontWeight: 600 }}>&gt; 85% utilization</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Memory Slack:</span>
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--status-warning)', fontWeight: 600 }}>&gt; 90% footprint</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>DB Connections:</span>
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--status-warning)', fontWeight: 600 }}>&gt; 90 active pool</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>AI Inference:</span>
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--status-error)', fontWeight: 600 }}>&gt; 2000 ms latency</span>
          </div>
        </div>
      </div>

      {/* 2. Incidents Status Filter Tab menu */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.5rem' }}>
        <button
          className={`btn ${statusTab === 'TRIGGERED' ? 'btn-primary' : ''}`}
          style={{ padding: '0.45rem 1.25rem', fontSize: '0.8rem' }}
          onClick={() => setStatusTab('TRIGGERED')}
        >
          Firing Incidents ({statusTab === 'TRIGGERED' ? incidents.length : 'Active'})
        </button>
        <button
          className={`btn ${statusTab === 'RESOLVED' ? 'btn-primary' : ''}`}
          style={{ padding: '0.45rem 1.25rem', fontSize: '0.8rem' }}
          onClick={() => setStatusTab('RESOLVED')}
        >
          Historical Resolved Logs ({statusTab === 'RESOLVED' ? incidents.length : 'Archived'})
        </button>
      </div>

      {/* 3. Incidents Grid Grid */}
      <div className="glass-card">
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
            <div style={{ width: '28px', height: '28px', border: '2px solid var(--border-glass)', borderTopColor: 'var(--accent-purple)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
          </div>
        ) : incidents.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem', gap: '0.85rem', color: 'var(--text-secondary)' }}>
            {statusTab === 'TRIGGERED' ? (
              <>
                <CheckCircle size={40} style={{ color: 'var(--status-success)' }} />
                <div>
                  <h4 style={{ color: 'var(--text-primary)', marginBottom: '0.15rem' }}>No firing incidents detected!</h4>
                  <p style={{ fontSize: '0.8rem' }}>Infrastructure telemetry reporting nominal performance across registered environments.</p>
                </div>
              </>
            ) : (
              <>
                <HelpCircle size={40} style={{ color: 'var(--text-muted)' }} />
                <div>
                  <h4 style={{ color: 'var(--text-primary)', marginBottom: '0.15rem' }}>Archive Log is empty</h4>
                  <p style={{ fontSize: '0.8rem' }}>No historical incidents resolved in database logs yet.</p>
                </div>
              </>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {incidents.map((inc) => (
              <div
                key={inc.id}
                style={{
                  padding: '1.25rem',
                  borderRadius: '1rem',
                  border: '1px solid var(--border-glass)',
                  backgroundColor: 'var(--bg-secondary)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '1rem',
                  transition: 'var(--transition-smooth)'
                }}
              >
                <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center' }}>
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: inc.severity === 'CRITICAL' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                      color: inc.severity === 'CRITICAL' ? 'var(--status-error)' : 'var(--status-warning)'
                    }}
                  >
                    {statusTab === 'TRIGGERED' ? <ShieldAlert size={20} /> : <CheckCircle size={20} />}
                  </div>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <h4 style={{ fontSize: '0.925rem', fontWeight: 800, color: 'var(--text-primary)' }}>{inc.rule_name}</h4>
                      <span className={`badge ${inc.severity === 'CRITICAL' ? 'badge-danger' : 'badge-warning'}`} style={{ fontSize: '0.55rem', padding: '0.1rem 0.45rem' }}>
                        {inc.severity}
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                      <span>App: <strong style={{ color: 'var(--text-primary)' }}>{inc.app_name}</strong></span>
                      <span>Service: <strong style={{ color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>{inc.service_name}</strong></span>
                      <span>Metric: <strong style={{ fontFamily: 'var(--font-mono)' }}>{inc.metric_name}</strong></span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
                  <div style={{ textAlign: 'right', fontSize: '0.8rem' }}>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.725rem' }}>Value Spike / SLA Threshold:</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--status-error)' }}>
                      {inc.metric_name.includes('utilization') ? `${(inc.current_value * 100).toFixed(0)}%` : inc.current_value.toFixed(1)}
                      <span style={{ color: 'var(--text-muted)', fontWeight: 400, marginLeft: '0.25rem' }}>
                        (SLA Limit: {inc.metric_name.includes('utilization') ? `${(inc.threshold * 100).toFixed(0)}%` : inc.threshold})
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--text-muted)', fontSize: '0.675rem', marginTop: '0.15rem', justifyContent: 'flex-end' }}>
                      <Clock size={10} />
                      {statusTab === 'TRIGGERED'
                        ? `Firing since ${new Date(inc.created_at).toLocaleTimeString()}`
                        : `Resolved at ${new Date(inc.resolved_at!).toLocaleTimeString()}`
                      }
                    </div>
                  </div>

                  {statusTab === 'TRIGGERED' && (
                    <button
                      className="btn btn-primary"
                      style={{ height: '36px', minWidth: '110px' }}
                      onClick={() => handleResolve(inc.id)}
                      disabled={resolvingId === inc.id}
                    >
                      {resolvingId === inc.id ? 'Resolving...' : 'Acknowledge'}
                    </button>
                  )}
                </div>

              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
};

export default Alerts;
