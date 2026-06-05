import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  Search,
  Download,
  User,
  Layers,
  ShieldAlert,
  Info,
  Calendar
} from 'lucide-react';

interface AuditProps {
  selectedAppId: number | 'ALL';
  refreshTrigger: number;
}

interface AuditRecord {
  id: number;
  app_id: number;
  app_name: string;
  user_id: string;
  user_email: string;
  action: string;
  resource: string;
  status: string;
  ip_address: string;
  timestamp: string;
  details: Record<string, any>;
}

const Audit: React.FC<AuditProps> = ({ selectedAppId, refreshTrigger }) => {
  const [audits, setAudits] = useState<AuditRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Detail modal/inspector
  const [selectedAuditId, setSelectedAuditId] = useState<number | null>(null);

  // Filters
  const [emailFilter, setEmailFilter] = useState<string>('');
  const [actionFilter, setActionFilter] = useState<string>('');
  const [resourceFilter, setResourceFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  useEffect(() => {
    setLoading(true);
    let url = 'http://localhost:8003/api/v1/audit/?limit=100';

    if (selectedAppId !== 'ALL') {
      url += `&app_id=${selectedAppId}`;
    }
    if (emailFilter) {
      url += `&user_email=${encodeURIComponent(emailFilter)}`;
    }
    if (actionFilter) {
      url += `&action=${actionFilter}`;
    }
    if (resourceFilter) {
      url += `&resource=${resourceFilter}`;
    }
    if (statusFilter) {
      url += `&status=${statusFilter}`;
    }

    fetch(url)
      .then(res => res.json())
      .then((data: AuditRecord[]) => {
        setAudits(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to load audit records:", err);
        setLoading(false);
      });
  }, [selectedAppId, refreshTrigger, emailFilter, actionFilter, resourceFilter, statusFilter]);

  // Export current records to CSV
  const handleExportCSV = () => {
    if (audits.length === 0) return;

    // Construct CSV Header
    const headers = ['ID', 'App Name', 'User Email', 'Action Code', 'Resource', 'Status', 'IP Address', 'Timestamp', 'Audit Details'];
    const rows = audits.map(r => [
      r.id,
      `"${r.app_name.replace(/"/g, '""')}"`,
      `"${r.user_email.replace(/"/g, '""')}"`,
      r.action,
      `"${r.resource.replace(/"/g, '""')}"`,
      r.status,
      r.ip_address || 'N/A',
      r.timestamp,
      `"${JSON.stringify(r.details).replace(/"/g, '""')}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8,"
      + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Enterprise_Audit_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleClearFilters = () => {
    setEmailFilter('');
    setActionFilter('');
    setResourceFilter('');
    setStatusFilter('');
  };

  const activeAudit = audits.find(a => a.id === selectedAuditId);

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* 1. Audit Filtering Engine panel */}
      <div className="glass-card" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr)) 120px 140px', gap: '1rem', padding: '1rem', alignItems: 'center' }}>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label" style={{ fontSize: '0.7rem' }}>User Email Address</label>
          <input
            type="text"
            className="form-control"
            style={{ fontSize: '0.8rem', height: '36px' }}
            placeholder="Search by operator..."
            value={emailFilter}
            onChange={e => setEmailFilter(e.target.value)}
          />
        </div>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label" style={{ fontSize: '0.7rem' }}>Action Code</label>
          <select
            className="form-control"
            style={{ fontSize: '0.8rem', height: '36px' }}
            value={actionFilter}
            onChange={e => setActionFilter(e.target.value)}
          >
            <option value="">ALL ACTIONS</option>
            <option value="USER_LOGIN">USER_LOGIN</option>
            <option value="CHARGE_PURCHASE">CHARGE_PURCHASE</option>
            <option value="EXECUTE_ANOMALY_RUN">EXECUTE_ANOMALY_RUN</option>
            <option value="ALERT_TRIGGER">ALERT_TRIGGER</option>
            <option value="ALERT_RESOLVE_MANUAL">ALERT_RESOLVE_MANUAL</option>
          </select>
        </div>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label" style={{ fontSize: '0.7rem' }}>Target Resource</label>
          <input
            type="text"
            className="form-control"
            style={{ fontSize: '0.8rem', height: '36px' }}
            placeholder="Resource type..."
            value={resourceFilter}
            onChange={e => setResourceFilter(e.target.value)}
          />
        </div>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label" style={{ fontSize: '0.7rem' }}>Audit Status</label>
          <select
            className="form-control"
            style={{ fontSize: '0.8rem', height: '36px' }}
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="">ALL STATUSES</option>
            <option value="SUCCESS">SUCCESS</option>
            <option value="FAILURE">FAILURE</option>
            <option value="WARNING">WARNING</option>
          </select>
        </div>

        <button className="btn" style={{ alignSelf: 'flex-end', height: '36px', width: '100%' }} onClick={handleClearFilters}>
          Clear
        </button>

        <button className="btn btn-primary" style={{ alignSelf: 'flex-end', height: '36px', width: '100%' }} onClick={handleExportCSV} disabled={audits.length === 0}>
          <Download size={14} />
          Export CSV
        </button>
      </div>

      {/* 2. Main Grid View & Collapsible Details Drawer */}
      <div style={{ display: 'grid', gridTemplateColumns: selectedAuditId ? '2fr 1fr' : '1fr', gap: '1.5rem', transition: 'var(--transition-smooth)' }}>

        {/* Audit Grid Table */}
        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FileSpreadsheet size={18} style={{ color: 'var(--accent-purple)' }} />
              Operational Governance Compliance Trail ({audits.length})
            </h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Click any row to inspect security metadata.</span>
          </div>

          <div className="table-container">
            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
                <div style={{ width: '28px', height: '28px', border: '2px solid var(--border-glass)', borderTopColor: 'var(--accent-purple)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
              </div>
            ) : audits.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', padding: '2rem', textAlign: 'center' }}>No audit records match search filters.</p>
            ) : (
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>App Name</th>
                    <th>User Operator</th>
                    <th>Action</th>
                    <th>Resource</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {audits.map(aud => (
                    <tr
                      key={aud.id}
                      style={{
                        cursor: 'pointer',
                        backgroundColor: selectedAuditId === aud.id ? 'rgba(255,255,255,0.02)' : 'transparent'
                      }}
                      onClick={() => setSelectedAuditId(prev => prev === aud.id ? null : aud.id)}
                    >
                      <td style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                        {new Date(aud.timestamp).toLocaleString()}
                      </td>
                      <td style={{ fontWeight: 600 }}>{aud.app_name}</td>
                      <td style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', borderBottom: 'none' }}>
                        <User size={12} style={{ color: 'var(--text-muted)' }} />
                        {aud.user_email}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--accent-cyan)' }}>
                        {aud.action}
                      </td>
                      <td>{aud.resource}</td>
                      <td>
                        <span className={`badge ${aud.status === 'SUCCESS' ? 'badge-success' :
                          aud.status === 'FAILURE' ? 'badge-danger' : 'badge-warning'
                          }`}>
                          {aud.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Dynamic Detail JSON Inspector Panel */}
        {selectedAuditId && activeAudit && (
          <div className="glass-card animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', borderLeft: '3px solid var(--accent-purple)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.5rem' }}>
              <h3 style={{ fontSize: '0.925rem', fontWeight: 800 }}>Audit Details Inspector</h3>
              <button
                onClick={() => setSelectedAuditId(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700 }}
              >
                Close ×
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.75rem' }}>
              <div>
                <span style={{ color: 'var(--text-secondary)' }}>Security Event ID:</span>
                <span style={{ fontFamily: 'var(--font-mono)', float: 'right' }}>AUD-{activeAudit.id}</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-secondary)' }}>Operator User ID:</span>
                <span style={{ fontFamily: 'var(--font-mono)', float: 'right' }}>{activeAudit.user_id}</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-secondary)' }}>Origin IP Address:</span>
                <span style={{ fontFamily: 'var(--font-mono)', float: 'right', color: 'var(--accent-cyan)' }}>{activeAudit.ip_address || 'N/A'}</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-secondary)' }}>Date Recorded:</span>
                <span style={{ float: 'right' }}>{new Date(activeAudit.timestamp).toLocaleTimeString()}</span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', flexGrow: 1 }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--status-warning)' }}>Payload Transaction details</span>
              <div
                className="code-block"
                style={{
                  whiteSpace: 'pre-wrap',
                  flexGrow: 1,
                  fontSize: '0.7rem',
                  color: '#67e8f9',
                  maxHeight: '300px',
                  overflowY: 'auto'
                }}
              >
                {JSON.stringify(activeAudit.details, null, 2)}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', padding: '0.5rem', borderRadius: '6px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-glass)', fontSize: '0.7rem' }}>
              <ShieldAlert size={14} style={{ color: 'var(--status-success)' }} />
              <span style={{ color: 'var(--text-secondary)' }}>Cryptographically sealed in platform compliance logs.</span>
            </div>
          </div>
        )}

      </div>

    </div>
  );
};

export default Audit;
