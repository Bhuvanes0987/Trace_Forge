import React, { useState, useEffect } from 'react';
import { AppInfo } from '../App';
import {
  Plus,
  Terminal,
  HelpCircle,
  Copy,
  Check,
  Cpu,
  Info,
  Server,
  Lock,
  Eye,
  EyeOff,
  Trash2
} from 'lucide-react';

interface AppsRegistryProps {
  appsList: AppInfo[];
  onAppAdded: () => void;
  refreshTrigger: number;
}

interface InstrumentationSnippet {
  title: string;
  description: string;
  install?: string;
  environment?: string;
  run?: string;
  powershell?: string;
  config_yaml?: string;
  script?: string;
}

interface SnippetsResponse {
  python: InstrumentationSnippet;
  nodejs: InstrumentationSnippet;
  dotnet: InstrumentationSnippet;
  ebpf: InstrumentationSnippet;
  browser: InstrumentationSnippet;
}

const AppsRegistry: React.FC<AppsRegistryProps> = ({ appsList, onAppAdded, refreshTrigger }) => {
  // Form State
  const [name, setName] = useState('');
  const [environment, setEnvironment] = useState('PRODUCTION');
  const [techStack, setTechStack] = useState('Python/FastAPI');
  const [url, setUrl] = useState('');

  // UI states
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [selectedApp, setSelectedApp] = useState<AppInfo | null>(null);
  const [snippets, setSnippets] = useState<SnippetsResponse | null>(null);
  const [loadingSnippets, setLoadingSnippets] = useState(false);
  const [activeSnippetTab, setActiveSnippetTab] = useState<'python' | 'nodejs' | 'dotnet' | 'ebpf' | 'browser'>('python');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [revealKey, setRevealKey] = useState<number | null>(null);

  // Fetch snippets whenever selected app changes
  useEffect(() => {
    if (!selectedApp) {
      setSnippets(null);
      return;
    }

    setLoadingSnippets(true);
    fetch(`http://localhost:8003/api/v1/apps/${selectedApp.app_id}/snippets`)
      .then(res => res.json())
      .then((data: SnippetsResponse) => {
        setSnippets(data);
        setLoadingSnippets(false);
      })
      .catch(err => {
        console.error("Failed to load snippets:", err);
        setLoadingSnippets(false);
      });
  }, [selectedApp]);

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!name || !url) {
      setErrorMsg('Application Name and URL are required.');
      return;
    }

    setSubmitting(true);
    fetch('http://localhost:8003/api/v1/apps/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        environment,
        tech_stack: techStack,
        url
      })
    })
      .then(async res => {
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.detail || 'Failed to register application.');
        }
        return data;
      })
      .then((newApp: AppInfo) => {
        setSuccessMsg(`Application '${newApp.name}' successfully registered! Unique App ID: ${newApp.app_id}`);
        setName('');
        setUrl('');
        setSubmitting(false);
        onAppAdded(); // refresh global apps list
        setSelectedApp(newApp); // Auto-focus new app to show snippets
      })
      .catch(err => {
        setErrorMsg(err.message || 'Server error occurred.');
        setSubmitting(false);
      });
  };

  const handleDelete = (appId: string, name: string) => {
    if (!window.confirm(`Are you absolutely sure you want to de-register and delete '${name}'? This will wipe all its logs, traces, and metrics!`)) {
      return;
    }

    fetch(`http://localhost:8003/api/v1/apps/${appId}`, {
      method: 'DELETE'
    })
      .then(res => res.json())
      .then(() => {
        if (selectedApp?.app_id === appId) {
          setSelectedApp(null);
        }
        onAppAdded();
      })
      .catch(err => console.error("Failed to delete app:", err));
  };

  const handleCopy = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <div className="animate-fade-in" style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr', gap: '2rem' }}>

      {/* LEFT COLUMN: Registration Form and Apps List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

        {/* 1. App Registration Form */}
        <div className="glass-card">
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Server size={18} style={{ color: 'var(--accent-purple)' }} />
            Register New App
          </h3>

          <form onSubmit={handleRegister}>
            {errorMsg && (
              <div style={{ padding: '0.75rem', borderRadius: '0.75rem', backgroundColor: 'var(--status-error-bg)', color: 'var(--status-error)', fontSize: '0.8rem', fontWeight: 600, marginBottom: '1rem' }}>
                ⚠️ {errorMsg}
              </div>
            )}

            {successMsg && (
              <div style={{ padding: '0.75rem', borderRadius: '0.75rem', backgroundColor: 'var(--status-success-bg)', color: 'var(--status-success)', fontSize: '0.8rem', fontWeight: 600, marginBottom: '1rem' }}>
                🎉 {successMsg}
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Application Name</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Payment Gateway Service"
                value={name}
                onChange={e => setName(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Target Environment</label>
              <select
                className="form-control"
                value={environment}
                onChange={e => setEnvironment(e.target.value)}
              >
                <option value="PRODUCTION">Production (PROD)</option>
                <option value="STAGING">Staging (STAGE)</option>
                <option value="DEVELOPMENT">Development (DEV)</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Technology Stack</label>
              <select
                className="form-control"
                value={techStack}
                onChange={e => setTechStack(e.target.value)}
              >
                <option value="Python/FastAPI">Python (FastAPI / Flask)</option>
                <option value="Node.js/Express">Node.js (Express / NestJS)</option>
                <option value="React/Angular">Frontend Single Page App (React / Angular)</option>
                <option value=".NET Core/IIS">.NET Framework / Core on IIS</option>
                <option value="eBPF VM Host">Virtual Machine (eBPF Kernel Agent)</option>
                <option value="Legacy Stack/Log parsing">Legacy Stack (IIS Log Parser)</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Application URL</label>
              <input
                type="url"
                className="form-control"
                placeholder="https://app.example.com"
                value={url}
                onChange={e => setUrl(e.target.value)}
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem' }} disabled={submitting}>
              <Plus size={16} />
              {submitting ? 'Registering...' : 'Provision API Key'}
            </button>
          </form>
        </div>

        {/* 2. List of registered Applications */}
        <div className="glass-card" style={{ flexGrow: 1 }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1.25rem' }}>Registered Application Registry ({appsList.length})</h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '350px', overflowY: 'auto' }}>
            {appsList.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', padding: '1rem', textAlign: 'center', fontSize: '0.85rem' }}>No applications registered yet.</p>
            ) : (
              appsList.map(app => (
                <div
                  key={app.id}
                  className={`glass-card`}
                  style={{
                    padding: '0.85rem',
                    cursor: 'pointer',
                    borderColor: selectedApp?.id === app.id ? 'var(--accent-purple)' : 'var(--border-glass)',
                    backgroundColor: selectedApp?.id === app.id ? 'rgba(124,58,237,0.04)' : 'var(--bg-secondary)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.25rem',
                    position: 'relative'
                  }}
                  onClick={() => setSelectedApp(app)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.875rem' }}>{app.name}</span>
                    <span className={`badge ${app.environment === 'PRODUCTION' ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '0.6rem' }}>
                      {app.environment}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Stack: {app.tech_stack}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{app.app_id}</span>
                  </div>

                  {app.url && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{app.url}</span>
                      <a href={app.url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-cyan)', fontSize: '0.75rem' }}>Visit</a>
                    </div>
                  )}

                  {/* Delete button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(app.app_id, app.name);
                    }}
                    style={{ position: 'absolute', right: '0.75rem', bottom: '0.75rem', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', transition: 'var(--transition-smooth)' }}
                    title="Delete application registry"
                    onMouseOver={e => e.currentTarget.style.color = 'var(--status-error)'}
                    onMouseOut={e => e.currentTarget.style.color = 'var(--text-muted)'}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* RIGHT COLUMN: Auto-Instrumentation Snippet Center */}
      <div className="glass-card" style={{ display: 'flex', flexDirection: 'column' }}>
        {!selectedApp ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '1rem', color: 'var(--text-secondary)', padding: '2rem', textAlign: 'center' }}>
            <HelpCircle size={48} style={{ color: 'var(--text-muted)' }} />
            <div>
              <h4 style={{ color: 'var(--text-primary)', marginBottom: '0.25rem' }}>Zero-Touch Integration Center</h4>
              <p style={{ fontSize: '0.85rem' }}>Select any registered application on the left to obtain its unique OTel credentials and custom platform auto-instrumentation snippets.</p>
            </div>
          </div>
        ) : (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '1.25rem' }}>

            {/* Header Credentials Card */}
            <div style={{ padding: '1rem', borderRadius: '0.75rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-glass)' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Connection Credentials</div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '0.5rem' }}>{selectedApp.name}</h2>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.8rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Registered App ID:</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{selectedApp.app_id}</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Registered App URL:</span>
                  <a href={selectedApp.url || '#'} target="_blank" rel="noreferrer" style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)', textDecoration: 'none' }}>
                    {selectedApp.url || 'None provided'}
                  </a>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Ingestion OTLP Endpoint:</span>
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>http://localhost:8003</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.4rem', background: 'var(--bg-tertiary)', borderRadius: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Lock size={12} style={{ color: 'var(--text-secondary)' }} />
                    <span style={{ color: 'var(--text-secondary)' }}>OTel Ingest Header Key:</span>
                  </div>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>X-OTEL-API-KEY</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.4rem', background: 'var(--bg-tertiary)', borderRadius: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Lock size={12} style={{ color: 'var(--text-secondary)' }} />
                    <span style={{ color: 'var(--text-secondary)' }}>API Ingest Token:</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--status-warning)', fontWeight: 700 }}>
                      {revealKey === selectedApp.id ? selectedApp.api_key : '••••••••••••••••••••••••••••••••'}
                    </span>
                    <button
                      onClick={() => setRevealKey(prev => prev === selectedApp.id ? null : selectedApp.id)}
                      style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
                    >
                      {revealKey === selectedApp.id ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                    <button
                      onClick={() => handleCopy(selectedApp.api_key, 'api_key')}
                      style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
                      title="Copy Ingest key"
                    >
                      {copiedField === 'api_key' ? <Check size={14} style={{ color: 'var(--status-success)' }} /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Ingestion Guides Tab Menu */}
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Zero-Touch Setup Snippets</div>

              <div style={{ display: 'flex', gap: '0.25rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.5rem', marginBottom: '0.75rem', overflowX: 'auto' }}>
                <button className={`btn ${activeSnippetTab === 'python' ? 'btn-primary' : ''}`} style={{ padding: '0.4rem 0.85rem', fontSize: '0.75rem' }} onClick={() => setActiveSnippetTab('python')}>Python</button>
                <button className={`btn ${activeSnippetTab === 'nodejs' ? 'btn-primary' : ''}`} style={{ padding: '0.4rem 0.85rem', fontSize: '0.75rem' }} onClick={() => setActiveSnippetTab('nodejs')}>Node.js</button>
                <button className={`btn ${activeSnippetTab === 'dotnet' ? 'btn-primary' : ''}`} style={{ padding: '0.4rem 0.85rem', fontSize: '0.75rem' }} onClick={() => setActiveSnippetTab('dotnet')}>.NET / IIS</button>
                <button className={`btn ${activeSnippetTab === 'ebpf' ? 'btn-primary' : ''}`} style={{ padding: '0.4rem 0.85rem', fontSize: '0.75rem' }} onClick={() => setActiveSnippetTab('ebpf')}>eBPF Agent</button>
                <button className={`btn ${activeSnippetTab === 'browser' ? 'btn-primary' : ''}`} style={{ padding: '0.4rem 0.85rem', fontSize: '0.75rem' }} onClick={() => setActiveSnippetTab('browser')}>Web Browser</button>
              </div>

              {loadingSnippets || !snippets ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
                  <div style={{ width: '24px', height: '24px', border: '2px solid var(--border-glass)', borderTopColor: 'var(--accent-purple)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                </div>
              ) : (
                <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    <Info size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle', color: 'var(--accent-cyan)' }} />
                    {snippets[activeSnippetTab].description}
                  </p>

                  {/* Snippet Blocks dynamically matching active guide tab */}
                  {activeSnippetTab === 'python' && (
                    <>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', fontWeight: 600 }}>
                          <span>1. Install OpenTelemetry Core Loader Dependencies</span>
                          <button onClick={() => handleCopy(snippets.python.install!, 'py_install')} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}>
                            {copiedField === 'py_install' ? <Check size={12} style={{ color: 'var(--status-success)' }} /> : <Copy size={12} />}
                          </button>
                        </div>
                        <div className="code-block">{snippets.python.install}</div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', fontWeight: 600 }}>
                          <span>2. Set environment variables (In shell / Container config)</span>
                          <button onClick={() => handleCopy(snippets.python.environment!, 'py_env')} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}>
                            {copiedField === 'py_env' ? <Check size={12} style={{ color: 'var(--status-success)' }} /> : <Copy size={12} />}
                          </button>
                        </div>
                        <div className="code-block">{snippets.python.environment}</div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', fontWeight: 600 }}>
                          <span>3. Run Application with OTel wrapper (Code base remains untouched!)</span>
                          <button onClick={() => handleCopy(snippets.python.run!, 'py_run')} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}>
                            {copiedField === 'py_run' ? <Check size={12} style={{ color: 'var(--status-success)' }} /> : <Copy size={12} />}
                          </button>
                        </div>
                        <div className="code-block">{snippets.python.run}</div>
                      </div>
                    </>
                  )}

                  {activeSnippetTab === 'nodejs' && (
                    <>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', fontWeight: 600 }}>
                          <span>1. Install standard OpenTelemetry package</span>
                          <button onClick={() => handleCopy(snippets.nodejs.install!, 'js_install')} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}>
                            {copiedField === 'js_install' ? <Check size={12} style={{ color: 'var(--status-success)' }} /> : <Copy size={12} />}
                          </button>
                        </div>
                        <div className="code-block">{snippets.nodejs.install}</div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', fontWeight: 600 }}>
                          <span>2. Set environment variables (In shell / Container config)</span>
                          <button onClick={() => handleCopy(snippets.nodejs.environment!, 'js_env')} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}>
                            {copiedField === 'js_env' ? <Check size={12} style={{ color: 'var(--status-success)' }} /> : <Copy size={12} />}
                          </button>
                        </div>
                        <div className="code-block">{snippets.nodejs.environment}</div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', fontWeight: 600 }}>
                          <span>3. Startup application using Node's loader registration flag</span>
                          <button onClick={() => handleCopy(snippets.nodejs.run!, 'js_run')} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}>
                            {copiedField === 'js_run' ? <Check size={12} style={{ color: 'var(--status-success)' }} /> : <Copy size={12} />}
                          </button>
                        </div>
                        <div className="code-block">{snippets.nodejs.run}</div>
                      </div>
                    </>
                  )}

                  {activeSnippetTab === 'dotnet' && (
                    <>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', fontWeight: 600 }}>
                          <span>Host CLR Profiler Environment Setup (Administrator PowerShell)</span>
                          <button onClick={() => handleCopy(snippets.dotnet.powershell!, 'net_ps')} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}>
                            {copiedField === 'net_ps' ? <Check size={12} style={{ color: 'var(--status-success)' }} /> : <Copy size={12} />}
                          </button>
                        </div>
                        <div className="code-block">{snippets.dotnet.powershell}</div>
                      </div>
                    </>
                  )}

                  {activeSnippetTab === 'ebpf' && (
                    <>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', fontWeight: 600 }}>
                          <span>1. Save configuration variables to `config.yaml`</span>
                          <button onClick={() => handleCopy(snippets.ebpf.config_yaml!, 'ebpf_yaml')} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}>
                            {copiedField === 'ebpf_yaml' ? <Check size={12} style={{ color: 'var(--status-success)' }} /> : <Copy size={12} />}
                          </button>
                        </div>
                        <div className="code-block">{snippets.ebpf.config_yaml}</div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', fontWeight: 600 }}>
                          <span>2. Run Kernel Discovery Agent</span>
                          <button onClick={() => handleCopy(snippets.ebpf.run!, 'ebpf_run')} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}>
                            {copiedField === 'ebpf_run' ? <Check size={12} style={{ color: 'var(--status-success)' }} /> : <Copy size={12} />}
                          </button>
                        </div>
                        <div className="code-block">{snippets.ebpf.run}</div>
                      </div>
                    </>
                  )}

                  {activeSnippetTab === 'browser' && (
                    <>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', fontWeight: 600 }}>
                          <span>Inject standard HTML script header block in index.html template</span>
                          <button onClick={() => handleCopy(snippets.browser.script!, 'web_script')} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}>
                            {copiedField === 'web_script' ? <Check size={12} style={{ color: 'var(--status-success)' }} /> : <Copy size={12} />}
                          </button>
                        </div>
                        <div className="code-block" style={{ whiteSpace: 'pre-wrap' }}>{snippets.browser.script}</div>
                      </div>
                    </>
                  )}

                </div>
              )}
            </div>

          </div>
        )}
      </div>

    </div>
  );
};

export default AppsRegistry;
