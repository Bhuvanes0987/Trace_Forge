import React, { useState, useEffect } from 'react';
import {
  Activity,
  Layers,
  Terminal,
  ShieldAlert,
  PlusSquare,
  TrendingUp,
  FileSpreadsheet,
  RefreshCw,
  WifiOff,
  Brain,
  Cpu
} from 'lucide-react';

// Import Pages
import Overview from './pages/Overview';
import AppsRegistry from './pages/AppsRegistry';
import HostedApps from './pages/HostedApps';
import Tracing from './pages/Tracing';
import Metrics from './pages/Metrics';
import Logs from './pages/Logs';
import Audit from './pages/Audit';
import Alerts from './pages/Alerts';
import LLMUsage from './pages/LLMUsage';
import { MemoryFabric } from './pages/MemoryFabric';

export interface AppInfo {
  id: number;
  app_id: string;
  name: string;
  environment: string;
  tech_stack: string;
  url?: string;
  api_key: string;
  status: string;
  created_at: string;
}

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [apps, setApps] = useState<AppInfo[]>([]);
  const [selectedAppId, setSelectedAppId] = useState<number | 'ALL'>('ALL');
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);
  const [loadingApps, setLoadingApps] = useState<boolean>(true);
  const [appsError, setAppsError] = useState<string | null>(null);

  // Fetch applications list on load and on refresh
  useEffect(() => {
    setLoadingApps(true);
    setAppsError(null);

    fetch('http://localhost:8003/api/v1/apps')   // removed trailing slash — common cause of 404
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status} — check that /api/v1/apps is registered on the backend.`);
        return res.json();
      })
      .then((data: any) => {
        // Handle both flat array and wrapped { data: [...] } responses
        const normalized: AppInfo[] = Array.isArray(data)
          ? data
          : Array.isArray(data?.data)
            ? data.data
            : [];

        setApps(normalized);
        setAppsError(null);
        setLoadingApps(false);
      })
      .catch(err => {
        console.error("Failed to load applications list:", err);
        setAppsError(err.message ?? "Could not reach backend.");
        setApps([]);
        setLoadingApps(false);
      });
  }, [refreshTrigger]);

  const handleRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="brand-section">
          <div className="brand-logo">🔭</div>
          <div className="brand-name">TraceForge</div>
        </div>

        <nav className="nav-links">
          <button
            className={`nav-item ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            <Activity />
            Overview
          </button>

          <button
            className={`nav-item ${activeTab === 'apps' ? 'active' : ''}`}
            onClick={() => setActiveTab('apps')}
          >
            <PlusSquare />
            Apps Registry
          </button>

          <button
            className={`nav-item ${activeTab === 'hosted_apps' ? 'active' : ''}`}
            onClick={() => setActiveTab('hosted_apps')}
          >
            <Cpu />
            Hosted Applications
          </button>

          <button
            className={`nav-item ${activeTab === 'tracing' ? 'active' : ''}`}
            onClick={() => setActiveTab('tracing')}
          >
            <Layers />
            Distributed Tracing
          </button>

          <button
            className={`nav-item ${activeTab === 'metrics' ? 'active' : ''}`}
            onClick={() => setActiveTab('metrics')}
          >
            <TrendingUp />
            Metrics Explorer
          </button>

          <button
            className={`nav-item ${activeTab === 'llm_usage' ? 'active' : ''}`}
            onClick={() => setActiveTab('llm_usage')}
          >
            <Brain />
            LLM Usage
          </button>

          <button
            className={`nav-item ${activeTab === 'memory_fabric' ? 'active' : ''}`}
            onClick={() => setActiveTab('memory_fabric')}
          >
            <Layers />
            Memory Fabric
          </button>

          <button
            className={`nav-item ${activeTab === 'logs' ? 'active' : ''}`}
            onClick={() => setActiveTab('logs')}
          >
            <Terminal />
            Log Explorer
          </button>

          <button
            className={`nav-item ${activeTab === 'audit' ? 'active' : ''}`}
            onClick={() => setActiveTab('audit')}
          >
            <FileSpreadsheet />
            Compliance Audit
          </button>

          <button
            className={`nav-item ${activeTab === 'alerts' ? 'active' : ''}`}
            onClick={() => setActiveTab('alerts')}
          >
            <ShieldAlert />
            Incident Alerting
          </button>
        </nav>

        {/* Backend status indicator */}
        <div style={{ marginTop: 'auto', padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '0.75rem', fontSize: '0.75rem', border: '1px solid var(--border-glass)' }}>
          <div style={{ fontWeight: 700, marginBottom: '0.25rem', color: 'var(--text-primary)' }}>OTel Aggregator Status</div>
          {appsError ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--status-error)' }}>
              <WifiOff size={12} />
              Backend unreachable
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--status-success)' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: 'var(--status-success)', display: 'inline-block' }}></span>
              Receiver Listening on port :8003
            </div>
          )}
        </div>
      </aside>

      {/* Main Panel Area */}
      <div className="main-wrapper">
        {/* Sticky Dashboard Filter Bar */}
        <header className="top-header">
          <div className="page-title-area">
            <h2 style={{ textTransform: 'capitalize' }}>
              {activeTab === 'apps' ? 'Application Governance & Snippets'
                : activeTab === 'hosted_apps' ? 'Hosted Applications'
                  : `${activeTab} Dashboard`}
            </h2>
          </div>

          <div className="header-controls">
            {/* Apps fetch error banner */}
            {appsError && (
              <span style={{ fontSize: '0.75rem', color: 'var(--status-error)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <WifiOff size={13} />
                {appsError}
              </span>
            )}

            <button className="btn" onClick={handleRefresh} title="Force Refresh Live Telemetry">
              <RefreshCw size={16} />
              Sync Data
            </button>

            {/* Application selector — disabled while loading */}
            <select
              className="app-selector-dropdown"
              value={selectedAppId}
              disabled={loadingApps}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedAppId(val === 'ALL' ? 'ALL' : Number(val));
              }}
            >
              <option value="ALL">
                {loadingApps ? '⏳ Loading apps...' : `🔍 All Applications (${apps.length})`}
              </option>
              {apps.map(app => (
                <option key={app.id} value={app.id}>
                  {app.environment === 'PRODUCTION' ? '🟢' : '🟡'} {app.name} ({app.environment})
                </option>
              ))}
            </select>
          </div>
        </header>

        {/* Dynamic Tab Body */}
        <main className="content-body">
          {activeTab === 'overview' && (
            <Overview
              selectedAppId={selectedAppId}
              appsList={apps}
              refreshTrigger={refreshTrigger}
              onNavigate={(tab) => setActiveTab(tab)}
            />
          )}
          {activeTab === 'apps' && (
            <AppsRegistry
              appsList={apps}
              onAppAdded={handleRefresh}
              refreshTrigger={refreshTrigger}
            />
          )}
          {activeTab === 'hosted_apps' && (
            <HostedApps appsList={apps} />
          )}
          {activeTab === 'tracing' && (
            <Tracing
              selectedAppId={selectedAppId}
              refreshTrigger={refreshTrigger}
              onNavigateToLogs={(traceId) => {
                setActiveTab('logs');
                sessionStorage.setItem('logs_filter_trace_id', traceId);
              }}
            />
          )}
          {activeTab === 'metrics' && (
            <Metrics
              selectedAppId={selectedAppId}
              refreshTrigger={refreshTrigger}
            />
          )}
          {activeTab === 'llm_usage' && (
            <LLMUsage
              selectedAppId={selectedAppId}
              appsList={apps}
              refreshTrigger={refreshTrigger}
            />
          )}
          {activeTab === 'memory_fabric' && (
            <MemoryFabric
              selectedAppId={selectedAppId}
              refreshTrigger={refreshTrigger}
            />
          )}
          {activeTab === 'logs' && (
            <Logs
              selectedAppId={selectedAppId}
              refreshTrigger={refreshTrigger}
            />
          )}
          {activeTab === 'audit' && (
            <Audit
              selectedAppId={selectedAppId}
              refreshTrigger={refreshTrigger}
            />
          )}
          {activeTab === 'alerts' && (
            <Alerts
              selectedAppId={selectedAppId}
              refreshTrigger={refreshTrigger}
              onIncidentResolved={handleRefresh}
            />
          )}
        </main>
      </div>
    </div>
  );
};

export default App;