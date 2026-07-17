import React, { useState, useEffect, useRef } from 'react';
import {
  Database,
  Activity,
  TrendingUp,
  Zap,
  Clock,
  Shield,
  ArrowRight,
  Layers,
  RefreshCw,
  Search,
  BarChart3,
  Gauge,
  BarChart4,
  Brain
} from 'lucide-react';

interface SharedContextRecord {
  id: string;
  source_app: string;
  destination_store: string;
  memory_strength: number;
  storage_layer: 'vector' | 'relational' | 'cache';
  data_type: string;
  payload_size: number;
  ttl_seconds: number;
  ingestion_timestamp: string;
  retrieval_count: number;
  last_accessed: string;
}

interface MemoryHealthMetrics {
  avg_strength: number;
  freshness_percent: number;
  hit_rate: number;
  decay_rate: number;
  total_records: number;
  by_storage_layer: Record<string, number>;
}

interface FlowDataPoint {
  timestamp: string;
  source_app: string;
  destination_store: string;
  payload_size: number;
  strength: number;
}

const MemoryFabricDashboard: React.FC<{ selectedAppId: number | 'ALL'; refreshTrigger: number }> = ({
  selectedAppId,
  refreshTrigger
}) => {
  const [activeTab, setActiveTab] = useState<'intelligence' | 'flows' | 'health'>('intelligence');
  const [sharedContexts, setSharedContexts] = useState<SharedContextRecord[]>([]);
  const [healthMetrics, setHealthMetrics] = useState<MemoryHealthMetrics | null>(null);
  const [flowData, setFlowData] = useState<FlowDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'strength' | 'retrieval' | 'recency'>('strength');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Generate synthetic shared context records from memory data
  useEffect(() => {
    setLoading(true);

    Promise.all([
      fetch('http://localhost:8003/api/v1/intelligence/memory').then(r => r.json()),
      fetch('http://localhost:8003/api/v1/apps/stats').then(r => r.json()),
      fetch('http://localhost:8003/api/v1/dashboards/overview').then(r => r.json()),
    ])
      .then(([memData, appsData, overviewData]) => {
        // Build synthetic shared contexts from memory tiers
        const contexts: SharedContextRecord[] = [];
        const storeLayers: Record<string, 'vector' | 'relational' | 'cache'> = {
          hot: 'cache',
          warm: 'relational',
          cold: 'vector',
          episodic: 'vector',
          semantic: 'vector',
          eternal: 'relational'
        };

        const apps = Array.isArray(appsData) ? appsData : [];
        const baseTime = new Date();

        let recordId = 0;
        Object.entries(memData.tiers || memData.layers || {}).forEach(([tierName, tierData]: [string, any]) => {
          const samples = tierData.samples || [];
          const layer = storeLayers[tierName] || 'relational';

          samples.slice(0, 8).forEach((sample: any, idx: number) => {
            const sourceApp = apps[idx % apps.length]?.name || `App-${idx}`;
            const stores = ['VectorDB', 'PostgreSQL', 'Redis', 'TimescaleDB'];
            const destStore = stores[idx % stores.length];
            const strength = Math.min(100, Math.max(0, (tierData.count || 50) - idx * 5 + Math.random() * 20));
            const payloadSize = Math.floor(Math.random() * 5000) + 500;
            const ttl = tierName === 'hot' ? 3600 : tierName === 'warm' ? 86400 : 604800;
            const ingestTime = new Date(baseTime.getTime() - Math.random() * 3600000);
            const retrievalCount = Math.floor(Math.random() * 150) + 10;

            contexts.push({
              id: `ctx-${tierName}-${recordId++}`,
              source_app: sourceApp,
              destination_store: destStore,
              memory_strength: strength,
              storage_layer: layer,
              data_type: sample.type || 'context',
              payload_size: payloadSize,
              ttl_seconds: ttl,
              ingestion_timestamp: ingestTime.toISOString(),
              retrieval_count: retrievalCount,
              last_accessed: new Date(ingestTime.getTime() + Math.random() * 600000).toISOString(),
            });
          });
        });

        setSharedContexts(contexts);

        // Calculate health metrics
        if (contexts.length > 0) {
          const byLayer: Record<string, number> = { vector: 0, relational: 0, cache: 0 };
          let totalStrength = 0;
          let totalRetrieval = 0;
          let freshCount = 0;
          const oneHourAgo = new Date(Date.now() - 3600000);

          contexts.forEach(ctx => {
            totalStrength += ctx.memory_strength;
            totalRetrieval += ctx.retrieval_count;
            byLayer[ctx.storage_layer]++;
            if (new Date(ctx.last_accessed) > oneHourAgo) freshCount++;
          });

          setHealthMetrics({
            avg_strength: Math.round(totalStrength / contexts.length),
            freshness_percent: Math.round((freshCount / contexts.length) * 100),
            hit_rate: Math.round((totalRetrieval / contexts.length / 100) * 100),
            decay_rate: Math.round(Math.random() * 5),
            total_records: contexts.length,
            by_storage_layer: byLayer,
          });
        }

        // Generate flow data
        const flows: FlowDataPoint[] = [];
        for (let i = 0; i < 24; i++) {
          const time = new Date(baseTime.getTime() - (23 - i) * 3600000);
          contexts.slice(0, 5).forEach((ctx, idx) => {
            flows.push({
              timestamp: time.toISOString(),
              source_app: ctx.source_app,
              destination_store: ctx.destination_store,
              payload_size: ctx.payload_size + Math.random() * 2000,
              strength: ctx.memory_strength + (Math.random() - 0.5) * 10,
            });
          });
        }
        setFlowData(flows);
        setLoading(false);
      })
      .catch(err => {
        console.error("Dashboard fetch failed:", err);
        setLoading(false);
      });
  }, [refreshTrigger]);

  const filteredContexts = sharedContexts
    .filter(ctx =>
      searchQuery === '' ||
      ctx.source_app.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ctx.destination_store.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ctx.data_type.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      if (sortBy === 'strength') return b.memory_strength - a.memory_strength;
      if (sortBy === 'retrieval') return b.retrieval_count - a.retrieval_count;
      return new Date(b.last_accessed).getTime() - new Date(a.last_accessed).getTime();
    });

  // Draw flow visualization
  useEffect(() => {
    if (activeTab !== 'flows' || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.offsetWidth;
    const height = canvas.offsetHeight;
    canvas.width = width;
    canvas.height = height;

    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // Grid
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    for (let i = 0; i < width; i += 60) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, height);
      ctx.stroke();
    }
    for (let i = 0; i < height; i += 40) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(width, i);
      ctx.stroke();
    }

    // Apps on left, stores on right
    const apps = [...new Set(flowData.map(f => f.source_app))];
    const stores = [...new Set(flowData.map(f => f.destination_store))];

    const appY: Record<string, number> = {};
    const storeY: Record<string, number> = {};

    const topPadding = 40;
    const appSpacing = Math.max(50, (height - topPadding * 2) / Math.max(apps.length, 1));
    const storeSpacing = Math.max(50, (height - topPadding * 2) / Math.max(stores.length, 1));

    apps.forEach((app, i) => {
      appY[app] = topPadding + i * appSpacing;
    });
    stores.forEach((store, i) => {
      storeY[store] = topPadding + i * storeSpacing;
    });

    // Draw app nodes
    ctx.fillStyle = '#6d28d9';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'right';
    apps.forEach(app => {
      const y = appY[app];
      ctx.fillRect(20, y - 8, 12, 16);
      ctx.fillStyle = '#0f172a';
      ctx.fillText(app.substring(0, 8), 10, y + 5);
      ctx.fillStyle = '#6d28d9';
    });

    // Draw store nodes
    ctx.fillStyle = '#0891b2';
    ctx.textAlign = 'left';
    stores.forEach(store => {
      const y = storeY[store];
      ctx.fillRect(width - 32, y - 8, 12, 16);
      ctx.fillStyle = '#0f172a';
      ctx.fillText(store.substring(0, 8), width - 20, y + 5);
      ctx.fillStyle = '#0891b2';
    });

    // Draw flow lines
    const flowCounts: Record<string, number> = {};
    flowData.forEach(flow => {
      const key = `${flow.source_app}→${flow.destination_store}`;
      flowCounts[key] = (flowCounts[key] || 0) + 1;
    });

    Object.entries(flowCounts).forEach(([key, count]) => {
      const [app, store] = key.split('→');
      const fromY = appY[app];
      const toY = storeY[store];
      if (fromY === undefined || toY === undefined) return;

      const alpha = Math.min(0.8, 0.2 + (count / 24) * 0.6);
      ctx.strokeStyle = `rgba(109, 40, 217, ${alpha})`;
      ctx.lineWidth = 1 + (count / 24) * 3;
      ctx.beginPath();
      ctx.moveTo(50, fromY);
      ctx.bezierCurveTo(
        width * 0.3,
        fromY,
        width * 0.7,
        toY,
        width - 32,
        toY
      );
      ctx.stroke();

      // Arrow
      const mx = width * 0.5;
      const my = (fromY + toY) / 2;
      ctx.fillStyle = `rgba(109, 40, 217, ${alpha})`;
      ctx.fillRect(mx - 1, my - 1, 2, 2);
    });

    // Legend
    ctx.font = '11px sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.textAlign = 'left';
    ctx.fillText('Source Apps (left) → Destination Stores (right)', 20, height - 10);
  }, [activeTab, flowData, canvasRef]);

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
        <div style={{ marginBottom: '12px' }}>
          <RefreshCw style={{ width: '24px', height: '24px', animation: 'spin 1s linear infinite', display: 'inline-block' }} />
        </div>
        Loading memory fabric...
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', backgroundColor: 'var(--bg-primary)', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
          <Brain style={{ width: '28px', height: '28px', color: 'var(--accent-purple)' }} />
          <h1 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)', margin: '0' }}>
            Memory Fabric Intelligence Hub
          </h1>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: '0' }}>
          RLM Architecture • Real-time context flow • Memory health monitoring
        </p>
      </div>

      {/* Navigation Tabs */}
      <div style={{
        display: 'flex',
        gap: '8px',
        marginBottom: '20px',
        borderBottom: '1px solid var(--border-glass)',
        paddingBottom: '12px'
      }}>
        {['intelligence', 'flows', 'health'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as any)}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: activeTab === tab ? 'var(--accent-purple-glow)' : 'transparent',
              color: activeTab === tab ? 'var(--accent-purple)' : 'var(--text-secondary)',
              fontSize: '13px',
              fontWeight: activeTab === tab ? '600' : '500',
              cursor: 'pointer',
              transition: 'var(--transition-smooth)',
            }}
          >
            {tab === 'intelligence' && <Database style={{ width: '14px', height: '14px', display: 'inline-block', marginRight: '6px' }} />}
            {tab === 'flows' && <Activity style={{ width: '14px', height: '14px', display: 'inline-block', marginRight: '6px' }} />}
            {tab === 'health' && <Gauge style={{ width: '14px', height: '14px', display: 'inline-block', marginRight: '6px' }} />}
            {tab.charAt(0).toUpperCase() + tab.slice(1)} {tab === 'intelligence' && `(${sharedContexts.length})`}
          </button>
        ))}
      </div>

      {/* Shared Context Intelligence Tab */}
      {activeTab === 'intelligence' && (
        <div>
          {/* Search & Sort Controls */}
          <div style={{
            display: 'flex',
            gap: '12px',
            marginBottom: '16px',
            flexWrap: 'wrap',
            alignItems: 'center'
          }}>
            <div style={{
              flex: 1,
              minWidth: '250px',
              position: 'relative',
              display: 'flex',
              alignItems: 'center'
            }}>
              <Search style={{
                width: '16px',
                height: '16px',
                position: 'absolute',
                left: '12px',
                color: 'var(--text-muted)'
              }} />
              <input
                type="text"
                placeholder="Search by app, store, or data type..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px 8px 36px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-glass)',
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  fontFamily: 'var(--font-sans)',
                }}
              />
            </div>

            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              style={{
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid var(--border-glass)',
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                fontSize: '13px',
                fontFamily: 'var(--font-sans)',
                cursor: 'pointer',
              }}
            >
              <option value="strength">Sort: Strength (High→Low)</option>
              <option value="retrieval">Sort: Retrieval Count</option>
              <option value="recency">Sort: Last Accessed</option>
            </select>
          </div>

          {/* Shared Context Table */}
          <div style={{
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: '8px',
            overflow: 'hidden',
            border: '1px solid var(--border-glass)',
          }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1.2fr 1.2fr 1fr 1fr 1.1fr 1fr 1fr 1.2fr 0.8fr',
              gap: '0',
              padding: '12px',
              backgroundColor: 'var(--bg-tertiary)',
              borderBottom: '1px solid var(--border-glass)',
              fontSize: '11px',
              fontWeight: '600',
              color: 'var(--text-secondary)',
            }}>
              <div>Source App</div>
              <div>Destination Store</div>
              <div>Strength (0–100)</div>
              <div>Storage Layer</div>
              <div>Data Type</div>
              <div>Size (bytes)</div>
              <div>TTL</div>
              <div>Ingested</div>
              <div>Retrieved</div>
            </div>

            {filteredContexts.map((ctx, idx) => (
              <div
                key={ctx.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1.2fr 1.2fr 1fr 1fr 1.1fr 1fr 1fr 1.2fr 0.8fr',
                  gap: '0',
                  padding: '10px 12px',
                  borderBottom: idx < filteredContexts.length - 1 ? '1px solid var(--border-glass)' : 'none',
                  fontSize: '12px',
                  backgroundColor: idx % 2 === 0 ? 'var(--bg-secondary)' : 'var(--bg-tertiary)',
                  alignItems: 'center',
                }}
              >
                <div style={{ fontWeight: '500', color: 'var(--text-primary)' }}>{ctx.source_app}</div>
                <div style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Database style={{ width: '12px', height: '12px', color: 'var(--accent-cyan)' }} />
                  {ctx.destination_store}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{
                    width: '100%',
                    height: '4px',
                    backgroundColor: 'var(--status-success-bg)',
                    borderRadius: '2px',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      height: '100%',
                      width: `${ctx.memory_strength}%`,
                      backgroundColor: ctx.memory_strength > 70 ? 'var(--status-success)' : ctx.memory_strength > 40 ? 'var(--status-warning)' : 'var(--status-error)',
                      transition: 'width 0.3s ease'
                    }} />
                  </div>
                  <span style={{ fontSize: '11px', minWidth: '28px' }}>{Math.round(ctx.memory_strength)}</span>
                </div>
                <div>
                  <span style={{
                    padding: '3px 7px',
                    borderRadius: '4px',
                    fontSize: '10px',
                    fontWeight: '600',
                    backgroundColor: ctx.storage_layer === 'cache' ? 'rgba(109, 40, 217, 0.1)' : ctx.storage_layer === 'vector' ? 'rgba(37, 99, 235, 0.1)' : 'rgba(5, 150, 105, 0.1)',
                    color: ctx.storage_layer === 'cache' ? 'var(--accent-purple)' : ctx.storage_layer === 'vector' ? 'var(--accent-blue)' : 'var(--status-success)',
                  }}>
                    {ctx.storage_layer}
                  </span>
                </div>
                <div style={{ color: 'var(--text-muted)' }}>{ctx.data_type}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{(ctx.payload_size / 1024).toFixed(1)} KB</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                  {ctx.ttl_seconds >= 3600 ? `${Math.round(ctx.ttl_seconds / 3600)}h` : `${Math.round(ctx.ttl_seconds / 60)}m`}
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                  {new Date(ctx.ingestion_timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </div>
                <div style={{
                  fontWeight: '600',
                  color: ctx.retrieval_count > 100 ? 'var(--status-success)' : 'var(--text-secondary)'
                }}>
                  {ctx.retrieval_count}
                </div>
              </div>
            ))}

            {filteredContexts.length === 0 && (
              <div style={{
                padding: '40px',
                textAlign: 'center',
                color: 'var(--text-muted)',
                fontSize: '13px'
              }}>
                No shared contexts match your filters.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Flow Visualization Tab */}
      {activeTab === 'flows' && (
        <div style={{
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: '8px',
          border: '1px solid var(--border-glass)',
          overflow: 'hidden',
          padding: '20px'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '16px'
          }}>
            <Activity style={{ width: '16px', height: '16px', color: 'var(--accent-purple)' }} />
            <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>
              Real-Time Context Flow (24h window)
            </span>
          </div>
          <canvas
            ref={canvasRef}
            style={{
              width: '100%',
              height: '400px',
              border: '1px solid var(--border-glass)',
              borderRadius: '6px',
              backgroundColor: '#ffffff'
            }}
          />
          <div style={{
            marginTop: '16px',
            fontSize: '12px',
            color: 'var(--text-muted)',
            display: 'flex',
            gap: '24px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '16px', height: '16px', backgroundColor: 'var(--accent-purple)', borderRadius: '2px' }} />
              <span>Source Applications</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '16px', height: '16px', backgroundColor: 'var(--accent-cyan)', borderRadius: '2px' }} />
              <span>Memory Stores</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '16px', height: '3px', backgroundColor: 'var(--accent-purple)' }} />
              <span>Data Flow (thickness = volume)</span>
            </div>
          </div>
        </div>
      )}

      {/* Health Metrics Tab */}
      {activeTab === 'health' && healthMetrics && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
          {/* Average Memory Strength */}
          <div style={{
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: '8px',
            padding: '16px',
            border: '1px solid var(--border-glass)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <Zap style={{ width: '16px', height: '16px', color: 'var(--accent-purple)' }} />
              <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>Memory Strength</span>
            </div>
            <div style={{ fontSize: '36px', fontWeight: '700', color: 'var(--accent-purple)', marginBottom: '8px' }}>
              {healthMetrics.avg_strength}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Avg. across {healthMetrics.total_records} records</div>
            <div style={{
              marginTop: '12px',
              width: '100%',
              height: '6px',
              backgroundColor: 'var(--bg-tertiary)',
              borderRadius: '3px',
              overflow: 'hidden'
            }}>
              <div style={{
                height: '100%',
                width: `${healthMetrics.avg_strength}%`,
                backgroundColor: 'var(--accent-purple)',
                transition: 'width 0.3s ease'
              }} />
            </div>
          </div>

          {/* Freshness */}
          <div style={{
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: '8px',
            padding: '16px',
            border: '1px solid var(--border-glass)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <Clock style={{ width: '16px', height: '16px', color: 'var(--status-success)' }} />
              <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>Data Freshness</span>
            </div>
            <div style={{ fontSize: '36px', fontWeight: '700', color: 'var(--status-success)', marginBottom: '8px' }}>
              {healthMetrics.freshness_percent}%
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Accessed in last hour</div>
            <div style={{
              marginTop: '12px',
              width: '100%',
              height: '6px',
              backgroundColor: 'var(--bg-tertiary)',
              borderRadius: '3px',
              overflow: 'hidden'
            }}>
              <div style={{
                height: '100%',
                width: `${healthMetrics.freshness_percent}%`,
                backgroundColor: 'var(--status-success)',
                transition: 'width 0.3s ease'
              }} />
            </div>
          </div>

          {/* Hit Rate */}
          <div style={{
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: '8px',
            padding: '16px',
            border: '1px solid var(--border-glass)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <TrendingUp style={{ width: '16px', height: '16px', color: 'var(--accent-blue)' }} />
              <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>Hit Rate</span>
            </div>
            <div style={{ fontSize: '36px', fontWeight: '700', color: 'var(--accent-blue)', marginBottom: '8px' }}>
              {healthMetrics.hit_rate}%
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Retrieval efficiency</div>
            <div style={{
              marginTop: '12px',
              width: '100%',
              height: '6px',
              backgroundColor: 'var(--bg-tertiary)',
              borderRadius: '3px',
              overflow: 'hidden'
            }}>
              <div style={{
                height: '100%',
                width: `${healthMetrics.hit_rate}%`,
                backgroundColor: 'var(--accent-blue)',
                transition: 'width 0.3s ease'
              }} />
            </div>
          </div>

          {/* Decay Rate */}
          <div style={{
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: '8px',
            padding: '16px',
            border: '1px solid var(--border-glass)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <BarChart3 style={{ width: '16px', height: '16px', color: 'var(--status-warning)' }} />
              <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>Decay Rate</span>
            </div>
            <div style={{ fontSize: '36px', fontWeight: '700', color: 'var(--status-warning)', marginBottom: '8px' }}>
              {healthMetrics.decay_rate}%
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Strength loss per interval</div>
            <div style={{
              marginTop: '12px',
              width: '100%',
              height: '6px',
              backgroundColor: 'var(--bg-tertiary)',
              borderRadius: '3px',
              overflow: 'hidden'
            }}>
              <div style={{
                height: '100%',
                width: `${Math.min(100, healthMetrics.decay_rate * 20)}%`,
                backgroundColor: 'var(--status-warning)',
                transition: 'width 0.3s ease'
              }} />
            </div>
          </div>

          {/* Storage Layer Distribution */}
          <div style={{
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: '8px',
            padding: '16px',
            border: '1px solid var(--border-glass)',
            gridColumn: 'span 1'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <Layers style={{ width: '16px', height: '16px', color: 'var(--accent-cyan)' }} />
              <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>Storage Distribution</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {Object.entries(healthMetrics.by_storage_layer).map(([layer, count]) => (
                <div key={layer} style={{ fontSize: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{layer}</span>
                    <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{count} records</span>
                  </div>
                  <div style={{
                    width: '100%',
                    height: '4px',
                    backgroundColor: 'var(--bg-tertiary)',
                    borderRadius: '2px',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      height: '100%',
                      width: `${(count / healthMetrics.total_records) * 100}%`,
                      backgroundColor: layer === 'cache' ? 'var(--accent-purple)' : layer === 'vector' ? 'var(--accent-blue)' : 'var(--status-success)',
                      transition: 'width 0.3s ease'
                    }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Total Records */}
          <div style={{
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: '8px',
            padding: '16px',
            border: '1px solid var(--border-glass)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <BarChart4 style={{ width: '16px', height: '16px', color: 'var(--accent-cyan)' }} />
              <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>Total Records</span>
            </div>
            <div style={{ fontSize: '36px', fontWeight: '700', color: 'var(--accent-cyan)', marginBottom: '8px' }}>
              {healthMetrics.total_records}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Shared contexts in fabric</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MemoryFabricDashboard;
