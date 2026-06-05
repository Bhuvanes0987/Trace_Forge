import React from 'react';
import { AppInfo } from '../App';
import { Cpu, ExternalLink, Globe, Layers, CheckCircle2 } from 'lucide-react';

interface HostedAppsProps {
  appsList: AppInfo[];
}

const HostedApps: React.FC<HostedAppsProps> = ({ appsList }) => {
  return (
    <div style={{ display: 'grid', gap: '1.5rem' }}>
      <div className="glass-card" style={{ padding: '1.5rem', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '1.25rem', alignItems: 'center' }}>
        <div style={{ width: '84px', height: '84px', borderRadius: '28px', background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(34,197,94,0.08))', display: 'grid', placeItems: 'center' }}>
          <Cpu size={42} style={{ color: 'var(--accent-purple)' }} />
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <Layers size={18} style={{ color: 'var(--accent-cyan)' }} />
            <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800 }}>Hosted Applications</h2>
          </div>
          <p style={{ margin: 0, color: 'var(--text-secondary)', maxWidth: '640px', lineHeight: 1.75 }}>
            Browse all registered applications and launch the hosted service directly from this console. Each entry includes the service URL, environment tag, and deployment stack for fast access.
          </p>
        </div>
      </div>

      <div className="glass-card" style={{ padding: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>Live Application Directory</div>
            <div style={{ fontSize: '1rem', fontWeight: 700 }}>{appsList.length} applications registered</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-success)' }}>
            <CheckCircle2 size={18} />
            <span style={{ fontWeight: 600 }}>Instant launch ready</span>
          </div>
        </div>

        {appsList.length === 0 ? (
          <div style={{ padding: '2rem', borderRadius: '1rem', background: 'rgba(255,255,255,0.04)', color: 'var(--text-secondary)', textAlign: 'center' }}>
            No hosted applications have been registered yet. Head over to the Apps Registry to add one.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '1rem' }}>
            {appsList.map(app => (
              <div key={app.id} className="glass-card" style={{ padding: '1rem', display: 'grid', gridTemplateColumns: '1fr auto', gap: '1rem', alignItems: 'center' }}>
                <div style={{ display: 'grid', gap: '0.55rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontSize: '0.95rem', fontWeight: 700 }}>{app.name}</span>
                    <span className={`badge ${app.environment === 'PRODUCTION' ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '0.7rem', padding: '0.2rem 0.55rem' }}>{app.environment}</span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}><Globe size={14} />{app.url || 'URL not configured'}</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}><span style={{ fontFamily: 'var(--font-mono)' }}>{app.tech_stack}</span></span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>ID: <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{app.app_id}</span></span>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'space-between', gap: '0.75rem' }}>
                  <a
                    href={app.url || '#'}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-secondary"
                    style={{ pointerEvents: app.url ? 'auto' : 'none', opacity: app.url ? 1 : 0.5, display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}
                  >
                    <ExternalLink size={14} />
                    Open app
                  </a>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                    {app.url ? 'Hosted URL available' : 'Tracking only — URL missing'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default HostedApps;
