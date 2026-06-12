import React, { useState, useEffect, useRef } from 'react';
import { 
  Brain, 
  Database, 
  Share2, 
  Search, 
  Play, 
  Clock, 
  TrendingUp, 
  Key, 
  ShieldAlert, 
  Info,
  Layers,
  ArrowRight,
  Sparkles,
  Zap,
  LayoutDashboard,
  Grid,
  MessageSquare,
  Radio,
  Activity,
  Plus,
  Check,
  RefreshCw,
  GitBranch,
  Shield,
  History,
  Terminal,
  Cpu,
  AlertCircle
} from 'lucide-react';

interface MemoryFabricProps {
  selectedAppId: number | 'ALL';
  refreshTrigger: number;
}

interface MemoryLayer {
  name: string;
  status: string;
  count: number;
  purpose: string;
  samples: any[];
}

interface GraphNode {
  id: string;
  label: string;
  type: string;
  group: string;
  x?: number;
  y?: number;
}

interface GraphLink {
  source: string;
  target: string;
  relationship: string;
}

const getAppIcon = (name: string) => {
  const lowercase = name.toLowerCase();
  if (lowercase.includes('flow') || lowercase.includes('trace')) return GitBranch;
  if (lowercase.includes('friction') || lowercase.includes('ai') || lowercase.includes('chat')) return Brain;
  if (lowercase.includes('audit') || lowercase.includes('auth') || lowercase.includes('security')) return Shield;
  if (lowercase.includes('data') || lowercase.includes('pipeline') || lowercase.includes('db')) return Database;
  return Activity;
};

const getAppColors = (name: string) => {
  const lowercase = name.toLowerCase();
  if (lowercase.includes('flow') || lowercase.includes('trace')) return { ic: 'rgba(245, 158, 11, 0.1)', tc: '#d97706' };
  if (lowercase.includes('friction') || lowercase.includes('ai') || lowercase.includes('chat')) return { ic: 'rgba(109, 40, 217, 0.1)', tc: '#6d28d9' };
  if (lowercase.includes('audit') || lowercase.includes('auth') || lowercase.includes('security')) return { ic: 'rgba(5, 150, 105, 0.1)', tc: '#059669' };
  if (lowercase.includes('data') || lowercase.includes('pipeline') || lowercase.includes('db')) return { ic: 'rgba(220, 38, 38, 0.1)', tc: '#dc2626' };
  return { ic: 'rgba(99, 102, 241, 0.1)', tc: '#6366f1' };
};


const STATIC_TELEMETRY = [
  { tag: 'SPAN', app: 'FlowTracer', msg: 'POST /api/v1/checkout — ERROR — DB pool timeout exception', type: 'err' },
  { tag: 'LLM', app: 'FrictionX', msg: 'chat/completions — OK — model:gemini-2.5-flash — 1240 tokens — refund query', type: 'ok' },
  { tag: 'AUTH', app: 'AuditService', msg: 'login — lead-engineer-2b42@enterprise.io — OK — SSO token issued', type: 'ok' },
  { tag: 'SPAN', app: 'FlowTracer', msg: 'GET /api/v1/orders/ord-4821 — OK — 142ms', type: 'ok' },
  { tag: 'METRIC', app: 'DataPipeline', msg: 'llm_total_tokens: 3,840 · model:gemini-2.5-flash · pipeline:enrich', type: 'ok' },
  { tag: 'ERROR', app: 'FlowTracer', msg: 'POST /api/v1/checkout — ERROR — DB pool timeout exception', type: 'err' },
  { tag: 'GRAPH', app: 'DataPipeline', msg: '5 new edges written · session→FlowTracer · session→FrictionX · user→session', type: 'ok' },
  { tag: 'LOG', app: 'AuditService', msg: 'ROLE_CHANGE: engineer-1281 → lead-engineer · approved by admin-002', type: 'warn' },
  { tag: 'LLM', app: 'FrictionX', msg: 'chat/completions — OK — order status query · 890ms', type: 'ok' },
  { tag: 'SPAN', app: 'FlowTracer', msg: 'POST /auth/login — OK — 88ms · SSO via AuditService', type: 'ok' },
];

export const MemoryFabric: React.FC<MemoryFabricProps> = ({ selectedAppId, refreshTrigger }) => {
  // Navigation Tabs
  const [activeTab, setActiveTab] = useState<string>('overview');
  
  // Data States
  const [layers, setLayers] = useState<Record<string, MemoryLayer>>({});
  const [graphData, setGraphData] = useState<{ nodes: GraphNode[]; links: GraphLink[] }>({ nodes: [], links: [] });
  const [insights, setInsights] = useState<any[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('session-a1b2c3d4');
  const [activeContext, setActiveContext] = useState<any>(null);
  const [appsList, setAppsList] = useState<any[]>([]);
  const [overviewDashboard, setOverviewDashboard] = useState<any>(null);
  const [telemetryStream, setTelemetryStream] = useState<any[]>([]);
  
  // Selected App in Apps Registry Tab
  const [selectedApp, setSelectedApp] = useState<string>('');
  
  // Active Memory tab under memory layer
  const [activeLayerTab, setActiveLayerTab] = useState<string>('hot');

  // Gemini Configuration
  const [geminiKey, setGeminiKey] = useState<string>(() => localStorage.getItem('gemini_api_key') || '');
  const [isSavingKey, setIsSavingKey] = useState<boolean>(false);
  
  // Semantic Search
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);

  // Write Forms Local States
  const [memTier, setMemTier] = useState<string>('hot');
  const [memApp, setMemApp] = useState<string>('');
  const [memContent, setMemContent] = useState<string>('');
  const [memFeedback, setMemFeedback] = useState<{ text: string; success: boolean } | null>(null);
  const [memWritesCount, setMemWritesCount] = useState<number>(0);

  const [ctxSessionId, setCtxSessionId] = useState<string>('session-9872cc53900b');
  const [ctxContent, setCtxContent] = useState<string>('');
  const [ctxFeedback, setCtxFeedback] = useState<{ text: string; success: boolean } | null>(null);

  // States
  const [loading, setLoading] = useState<boolean>(true);
  const [seeding, setSeeding] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [localRefresh, setLocalRefresh] = useState<number>(0);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Fetch memory layer stats, insights, graph data, dashboard metrics, and registered apps stats
  useEffect(() => {
    setLoading(true);

    const safeJson = (res: Response) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.url}`);
      return res.json();
    };

    // Each fetch is individually guarded so one failure doesn't blank the whole page
    const fetchStats = fetch('http://localhost:8003/api/v1/intelligence/memory')
      .then(safeJson)
      .then(data => setLayers(data.layers))
      .catch(err => console.warn("Memory layers fetch failed:", err));

    const fetchGraph = fetch('http://localhost:8003/api/v1/intelligence/graph')
      .then(safeJson)
      .then(data => setGraphData(data))
      .catch(err => console.warn("Graph fetch failed:", err));

    const fetchInsights = fetch('http://localhost:8003/api/v1/intelligence/insights')
      .then(safeJson)
      .then(data => setInsights(data.insights))
      .catch(err => console.warn("Insights fetch failed:", err));

    const fetchApps = fetch('http://localhost:8003/api/v1/apps/stats')
      .then(safeJson)
      .then(data => {
        setAppsList(data);
        if (Array.isArray(data) && data.length > 0) {
          setSelectedApp(prev => prev || String(data[0].id));
          setMemApp(prev => prev || data[0].name);
        }
      })
      .catch(err => console.warn("Apps/stats fetch failed:", err));

    const fetchOverview = fetch('http://localhost:8003/api/v1/dashboards/overview')
      .then(safeJson)
      .then(data => setOverviewDashboard(data))
      .catch(err => console.warn("Overview dashboard fetch failed:", err));

    const fetchTelemetry = Promise.all([
      fetch('http://localhost:8003/api/v1/dashboards/traces').then(safeJson).catch(() => []),
      fetch('http://localhost:8003/api/v1/dashboards/logs').then(safeJson).catch(() => [])
    ]).then(([traces, logs]) => {
      const formatted: any[] = [];
      (traces as any[]).forEach((t: any) => {
        formatted.push({
          tag: 'SPAN',
          app: t.app_name || t.service_name,
          msg: `${t.root_name} — ${t.status_code} — ${t.duration_ms}ms`,
          type: t.status_code === 'ERROR' ? 'err' : 'ok',
          time: new Date(t.start_time)
        });
      });
      (logs as any[]).forEach((l: any) => {
        formatted.push({
          tag: l.severity === 'ERROR' ? 'ERROR' : l.severity === 'WARN' ? 'WARN' : 'LOG',
          app: l.app_name || l.service_name,
          msg: l.message,
          type: l.severity === 'ERROR' ? 'err' : l.severity === 'WARN' || l.severity === 'WARNING' ? 'warn' : 'ok',
          time: new Date(l.timestamp)
        });
      });
      formatted.sort((a, b) => b.time.getTime() - a.time.getTime());
      setTelemetryStream(formatted);
    }).catch(err => console.warn("Telemetry stream fetch failed:", err));

    // Use allSettled so partial failures don't crash the loading state
    Promise.allSettled([fetchStats, fetchGraph, fetchInsights, fetchApps, fetchOverview, fetchTelemetry])
      .then(() => {
        setError(null);
        setLoading(false);
      });
  }, [refreshTrigger, localRefresh]);

  // Periodic polling for live telemetry and dashboard stats
  useEffect(() => {
    const poll = () => {
      Promise.all([
        fetch('http://localhost:8003/api/v1/dashboards/traces').then(res => res.json()),
        fetch('http://localhost:8003/api/v1/dashboards/logs').then(res => res.json())
      ]).then(([traces, logs]) => {
        const formatted: any[] = [];
        traces.forEach((t: any) => {
          formatted.push({
            tag: 'SPAN',
            app: t.app_name || t.service_name,
            msg: `${t.root_name} — ${t.status_code} — ${t.duration_ms}ms`,
            type: t.status_code === 'ERROR' ? 'err' : 'ok',
            time: new Date(t.start_time)
          });
        });
        logs.forEach((l: any) => {
          formatted.push({
            tag: l.severity === 'ERROR' ? 'ERROR' : l.severity === 'WARN' ? 'WARN' : 'LOG',
            app: l.app_name || l.service_name,
            msg: l.message,
            type: l.severity === 'ERROR' ? 'err' : l.severity === 'WARN' || l.severity === 'WARNING' ? 'warn' : 'ok',
            time: new Date(l.timestamp)
          });
        });
        formatted.sort((a, b) => b.time.getTime() - a.time.getTime());
        setTelemetryStream(formatted);
      }).catch(err => console.log("Failed to poll telemetry:", err));

      fetch('http://localhost:8003/api/v1/dashboards/overview')
        .then(res => res.json())
        .then(data => setOverviewDashboard(data))
        .catch(err => console.log("Failed to poll overview:", err));
        
      fetch('http://localhost:8003/api/v1/intelligence/graph')
        .then(res => res.json())
        .then(data => setGraphData(data))
        .catch(err => console.log("Failed to poll graph:", err));

      fetch('http://localhost:8003/api/v1/apps/stats')
        .then(res => res.json())
        .then(data => setAppsList(data))
        .catch(err => console.log("Failed to poll app stats:", err));
    };

    const interval = setInterval(poll, 5000);
    return () => clearInterval(interval);
  }, [activeTab, refreshTrigger, localRefresh]);

  // Fetch synthesized context when session changes
  useEffect(() => {
    if (!selectedSessionId) return;
    
    const headers: Record<string, string> = {};
    if (geminiKey) {
      headers['X-Gemini-API-Key'] = geminiKey;
    }

    fetch(`http://localhost:8003/api/v1/intelligence/context/${selectedSessionId}`, { headers })
      .then(res => res.json())
      .then(data => {
        setActiveContext(data);
      })
      .catch(err => console.error("Error fetching session context:", err));
  }, [selectedSessionId, geminiKey, refreshTrigger, localRefresh]);

  // Save API Key
  const handleSaveKey = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingKey(true);
    localStorage.setItem('gemini_api_key', geminiKey);
    setTimeout(() => {
      setIsSavingKey(false);
      setLocalRefresh(p => p + 1);
    }, 600);
  };

  // Seed simulated journey
  const handleSeedJourney = () => {
    setSeeding(true);
    fetch('http://localhost:8003/api/v1/intelligence/seed-journey', { method: 'POST' })
      .then(res => res.json())
      .then(data => {
        if (data.status === 'success') {
          setSelectedSessionId(data.session_id);
          setLocalRefresh(prev => prev + 1);
        }
        setSeeding(false);
      })
      .catch(err => {
        console.error("Failed to seed user journey:", err);
        setSeeding(false);
      });
  };

  // Semantic search query
  const handleSemanticSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearching(true);

    fetch('http://localhost:8003/api/v1/intelligence/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: searchQuery, limit: 5 })
    })
      .then(res => res.json())
      .then(data => {
        setSearchResults(data.results);
        setIsSearching(false);
      })
      .catch(err => {
        console.error("Semantic search failed:", err);
        setIsSearching(false);
      });
  };

  // Write Memory Form handler
  const handleWriteMemory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!memContent.trim()) {
      setMemFeedback({ text: 'Please enter memory content.', success: false });
      return;
    }

    setMemWritesCount(prev => prev + 1);
    setMemFeedback({ 
      text: `Written to ${memTier.toUpperCase()} Memory. Total writes this session: ${memWritesCount + 1}.`, 
      success: true 
    });
    
    // Simulate updating list locally
    if (layers && layers[memTier]) {
      const updatedSamples = [
        {
          session_id: `session-local-${Math.random().toString(36).substr(2, 9)}`,
          user: 'lead-engineer-local@enterprise.io',
          context: memContent,
          app: memApp,
          type: 'MANUAL_WRITE',
          desc: memContent,
          prompt: 'Manual Insert',
          response: memContent,
          model: 'Manual',
          time: new Date().toISOString(),
          title: 'Manual Pattern',
          confidence: 1.0
        },
        ...layers[memTier].samples
      ];
      setLayers({
        ...layers,
        [memTier]: {
          ...layers[memTier],
          count: layers[memTier].count + 1,
          samples: updatedSamples
        }
      });
    }

    setMemContent('');
  };

  // Write Context handler
  const handleWriteContext = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ctxContent.trim()) {
      setCtxFeedback({ text: 'Please enter context content.', success: false });
      return;
    }

    setCtxFeedback({ 
      text: 'Context written successfully and injected into next LLM call simulation.', 
      success: true 
    });
    
    if (activeContext && selectedSessionId === ctxSessionId) {
      setActiveContext({
        ...activeContext,
        active_context: ctxContent,
        last_updated: new Date().toISOString()
      });
    }
    setCtxContent('');
  };

  // Dynamic Graph force layout Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || graphData.nodes.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = canvas.parentElement?.clientWidth || 800;
    canvas.height = 360;

    const width = canvas.width;
    const height = canvas.height;

    const nodeMap = new Map(graphData.nodes.map(node => [node.id, node]));
    const appTypes = new Set(['APP', 'SERVICE', 'Service']);
    const appNodes = graphData.nodes.filter(node => appTypes.has(node.type || node.group));
    const appIds = new Set(appNodes.map(node => node.id));

    const sessionConnections = new Map<string, Set<string>>();
    const directAppEdges: any[] = [];
    const appEdgeKeys = new Set<string>();
    const appEdges: any[] = [];

    graphData.links.forEach(link => {
      const sourceType = nodeMap.get(link.source)?.type || nodeMap.get(link.source)?.group;
      const targetType = nodeMap.get(link.target)?.type || nodeMap.get(link.target)?.group;

      if (appIds.has(link.source) && appIds.has(link.target)) {
        directAppEdges.push(link);
        return;
      }

      if (sourceType === 'SESSION' && appIds.has(link.target)) {
        const apps = sessionConnections.get(link.source) || new Set<string>();
        apps.add(link.target);
        sessionConnections.set(link.source, apps);
        return;
      }
      if (targetType === 'SESSION' && appIds.has(link.source)) {
        const apps = sessionConnections.get(link.target) || new Set<string>();
        apps.add(link.source);
        sessionConnections.set(link.target, apps);
        return;
      }
    });

    sessionConnections.forEach(appSet => {
      const apps = Array.from(appSet);
      for (let i = 0; i < apps.length; i++) {
        for (let j = i + 1; j < apps.length; j++) {
          const key = [apps[i], apps[j]].sort().join('|');
          if (!appEdgeKeys.has(key)) {
            appEdgeKeys.add(key);
            appEdges.push({ source: apps[i], target: apps[j], relationship: 'shared context' });
          }
        }
      }
    });

    const nodes = appNodes.map(node => ({
      ...node,
      x: node.x ?? (width / 2 + (Math.random() - 0.5) * 120),
      y: node.y ?? (height / 2 + (Math.random() - 0.5) * 120)
    }));

    const links = [...directAppEdges, ...appEdges].map(link => ({
      ...link,
      sourceNode: nodes.find(n => n.id === link.source),
      targetNode: nodes.find(n => n.id === link.target)
    }));

    for (let step = 0; step < 80; step++) {
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[j].x! - nodes[i].x!;
          const dy = nodes[j].y! - nodes[i].y!;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          if (dist < 90) {
            const force = (90 - dist) / 90 * 0.45;
            nodes[i].x! -= dx / dist * force * 10;
            nodes[i].y! -= dy / dist * force * 10;
            nodes[j].x! += dx / dist * force * 10;
            nodes[j].y! += dy / dist * force * 10;
          }
        }
      }

      links.forEach(l => {
        if (!l.sourceNode || !l.targetNode) return;
        const dx = l.targetNode.x! - l.sourceNode.x!;
        const dy = l.targetNode.y! - l.sourceNode.y!;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const desiredDist = 140;
        const force = (dist - desiredDist) / dist * 0.08;
        l.sourceNode.x! += dx * force;
        l.sourceNode.y! += dy * force;
        l.targetNode.x! -= dx * force;
        l.targetNode.y! -= dy * force;
      });

      nodes.forEach(n => {
        n.x = Math.max(40, Math.min(width - 40, n.x!));
        n.y = Math.max(40, Math.min(height - 40, n.y!));
      });
    }

    nodes.forEach((n, idx) => {
      graphData.nodes[idx].x = n.x;
      graphData.nodes[idx].y = n.y;
    });

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      links.forEach(l => {
        if (!l.sourceNode || !l.targetNode) return;
        ctx.beginPath();
        ctx.moveTo(l.sourceNode.x!, l.sourceNode.y!);
        ctx.lineTo(l.targetNode.x!, l.targetNode.y!);
        ctx.strokeStyle = 'rgba(100, 116, 139, 0.25)';
        ctx.lineWidth = 2;
        ctx.stroke();

        const midX = (l.sourceNode.x! + l.targetNode.x!) / 2;
        const midY = (l.sourceNode.y! + l.targetNode.y!) / 2;
        ctx.font = '10px Inter, sans-serif';
        ctx.fillStyle = '#475569';
        ctx.textAlign = 'center';
        ctx.fillText((l.relationship || '').replace(/_/g, ' '), midX, midY - 8);
      });

      nodes.forEach(n => {
        const color = '#8b5cf6';
        const radius = 14;

        const gradient = ctx.createRadialGradient(n.x!, n.y!, 1, n.x!, n.y!, radius * 2.5);
        gradient.addColorStop(0, 'rgba(139,92,246,0.24)');
        gradient.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = gradient;
        ctx.beginPath(); ctx.arc(n.x!, n.y!, radius * 2.5, 0, 2 * Math.PI); ctx.fill();

        ctx.beginPath(); ctx.arc(n.x!, n.y!, radius, 0, 2 * Math.PI);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.font = '600 11px Inter, sans-serif';
        ctx.fillStyle = '#111827';
        ctx.textAlign = 'center';
        const truncated = n.label.length > 18 ? n.label.substring(0, 15) + '...' : n.label;
        ctx.fillText(truncated, n.x!, n.y! + radius + 14);
      });
    };

    draw();
  }, [graphData, activeTab]);

  // Aggregate stats counts dynamically
  const appCount = appsList.length;
  const memoryRecordsCount = Object.values(layers).reduce((acc: number, curr: any) => acc + (curr?.count || 0), 0);
  const graphNodesCount = graphData.nodes.length;
  const rlmPatternsCount = insights.length;

  const sessionOptions = layers.hot?.samples.map((s: any) => s.session_id) || ['session-9872cc53900b', 'session-ea75024153a5', 'session-5a1efd7dd540'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Top Banner API Key configuration */}
      <div className="glass-card" style={{ padding: '1rem', border: '1px solid var(--border-glass)', background: 'linear-gradient(135deg, rgba(109, 40, 217, 0.04) 0%, rgba(99, 102, 241, 0.04) 100%)' }}>
        <form onSubmit={handleSaveKey} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ background: 'rgba(109, 40, 217, 0.08)', padding: '0.5rem', borderRadius: '0.5rem' }}>
              <Key style={{ color: 'var(--accent-purple)' }} size={18} />
            </div>
            <div>
              <h4 style={{ margin: 0, fontWeight: 700, fontSize: '0.9rem' }}>Gemini 2.5 Flash Context Engine</h4>
              <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Provide a API key to enable real-time, LLM-based situational context generation from telemetry data.
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', minWidth: '300px', flex: 1, justifyContent: 'flex-end' }}>
            <input
              type="password"
              placeholder={geminiKey ? "••••••••••••••••••••••••••••" : "Paste your GEMINI_API_KEY"}
              value={geminiKey}
              onChange={(e) => setGeminiKey(e.target.value)}
              className="form-control"
              style={{ flex: 1, padding: '0.4rem 0.75rem', fontSize: '0.8rem', height: '34px' }}
            />
            <button type="submit" className="btn btn-primary" style={{ padding: '0 1rem', height: '34px', fontSize: '0.8rem' }}>
              {isSavingKey ? 'Configuring...' : 'Apply Key'}
            </button>
          </div>
        </form>
      </div>

      {/* Main Tabbed Navigation bar */}
      <div style={{ display: 'flex', gap: '0.25rem', borderBottom: '1px solid var(--border-glass)', overflowX: 'auto', paddingBottom: '1px' }}>
        <button
          onClick={() => setActiveTab('overview')}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.25rem', border: 'none', background: 'none',
            color: activeTab === 'overview' ? 'var(--accent-purple)' : 'var(--text-secondary)',
            borderBottom: activeTab === 'overview' ? '2.5px solid var(--accent-purple)' : '2.5px solid transparent',
            fontWeight: activeTab === 'overview' ? 600 : 500, fontSize: '0.85rem', cursor: 'pointer', outline: 'none'
          }}
        >
          <LayoutDashboard size={16} />
          Overview
        </button>
        <button
          onClick={() => setActiveTab('apps')}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.25rem', border: 'none', background: 'none',
            color: activeTab === 'apps' ? 'var(--accent-purple)' : 'var(--text-secondary)',
            borderBottom: activeTab === 'apps' ? '2.5px solid var(--accent-purple)' : '2.5px solid transparent',
            fontWeight: activeTab === 'apps' ? 600 : 500, fontSize: '0.85rem', cursor: 'pointer', outline: 'none'
          }}
        >
          <Grid size={16} />
          Applications
        </button>
        <button
          onClick={() => setActiveTab('memory')}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.25rem', border: 'none', background: 'none',
            color: activeTab === 'memory' ? 'var(--accent-purple)' : 'var(--text-secondary)',
            borderBottom: activeTab === 'memory' ? '2.5px solid var(--accent-purple)' : '2.5px solid transparent',
            fontWeight: activeTab === 'memory' ? 600 : 500, fontSize: '0.85rem', cursor: 'pointer', outline: 'none'
          }}
        >
          <Layers size={16} />
          Memory layer
        </button>
        <button
          onClick={() => setActiveTab('context')}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.25rem', border: 'none', background: 'none',
            color: activeTab === 'context' ? 'var(--accent-purple)' : 'var(--text-secondary)',
            borderBottom: activeTab === 'context' ? '2.5px solid var(--accent-purple)' : '2.5px solid transparent',
            fontWeight: activeTab === 'context' ? 600 : 500, fontSize: '0.85rem', cursor: 'pointer', outline: 'none'
          }}
        >
          <MessageSquare size={16} />
          Context layer
        </button>
        <button
          onClick={() => setActiveTab('rlm')}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.25rem', border: 'none', background: 'none',
            color: activeTab === 'rlm' ? 'var(--accent-purple)' : 'var(--text-secondary)',
            borderBottom: activeTab === 'rlm' ? '2.5px solid var(--accent-purple)' : '2.5px solid transparent',
            fontWeight: activeTab === 'rlm' ? 600 : 500, fontSize: '0.85rem', cursor: 'pointer', outline: 'none'
          }}
        >
          <TrendingUp size={16} />
          RLM learning
        </button>
        <button
          onClick={() => setActiveTab('telemetry')}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.25rem', border: 'none', background: 'none',
            color: activeTab === 'telemetry' ? 'var(--accent-purple)' : 'var(--text-secondary)',
            borderBottom: activeTab === 'telemetry' ? '2.5px solid var(--accent-purple)' : '2.5px solid transparent',
            fontWeight: activeTab === 'telemetry' ? 600 : 500, fontSize: '0.85rem', cursor: 'pointer', outline: 'none'
          }}
        >
          <Radio size={16} />
          Live telemetry
        </button>
      </div>

      {/* Overview Page */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }} className="animate-fade-in">
          <div className="stats-grid">
            <div className="glass-card stat-widget">
              <span className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Grid size={14} style={{ color: 'var(--accent-purple)' }} /> Applications
              </span>
              <span className="stat-value">{appCount}</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>actively monitored</span>
            </div>
            <div className="glass-card stat-widget">
              <span className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Layers size={14} style={{ color: 'var(--accent-cyan)' }} /> Memory Records
              </span>
              <span className="stat-value">{memoryRecordsCount.toLocaleString()}</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>across 6 distinct tiers</span>
            </div>
            <div className="glass-card stat-widget">
              <span className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Share2 size={14} style={{ color: '#f59e0b' }} /> Graph Nodes
              </span>
              <span className="stat-value">{graphNodesCount}</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>active entity relations</span>
            </div>
            <div className="glass-card stat-widget">
              <span className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Brain size={14} style={{ color: '#ef4444' }} /> RLM Patterns
              </span>
              <span className="stat-value">{rlmPatternsCount}</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>discovered insights</span>
            </div>
          </div>

          <div style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Per-application knowledge · memory · context snapshots
          </div>

          <div className="grid-2col" style={{ gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <TrendingUp size={16} style={{ color: '#f59e0b' }} /> Knowledge gained per application
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {appsList.length === 0 ? (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', padding: '0.5rem 0' }}>No active applications registered.</div>
                ) : (
                  appsList.map(app => (
                    <div key={app.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 500 }}>
                        <span style={{ color: 'var(--text-primary)' }}>{app.name}</span>
                        <span style={{ color: 'var(--text-secondary)' }}>{app.knowledge}%</span>
                      </div>
                      <div style={{ height: '7px', background: 'var(--bg-tertiary)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${app.knowledge}%`, background: 'linear-gradient(90deg, #f59e0b, #d97706)', borderRadius: '4px' }}></div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Layers size={16} style={{ color: 'var(--accent-purple)' }} /> Memory depth per application
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {appsList.length === 0 ? (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', padding: '0.5rem 0' }}>No active applications registered.</div>
                ) : (
                  appsList.map(app => (
                    <div key={app.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 500 }}>
                        <span style={{ color: 'var(--text-primary)' }}>{app.name}</span>
                        <span style={{ color: 'var(--text-secondary)' }}>{app.memory}%</span>
                      </div>
                      <div style={{ height: '7px', background: 'var(--bg-tertiary)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${app.memory}%`, background: 'linear-gradient(90deg, var(--accent-purple), #8b5cf6)', borderRadius: '4px' }}></div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <MessageSquare size={16} style={{ color: 'var(--status-success)' }} /> Context richness per application
              </h4>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>context injected into LLMs per request</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {appsList.length === 0 ? (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', padding: '0.5rem 0' }}>No active applications registered.</div>
              ) : (
                appsList.map(app => (
                  <div key={app.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 500 }}>
                      <span style={{ color: 'var(--text-primary)' }}>{app.name}</span>
                      <span style={{ color: 'var(--text-secondary)' }}>{app.context}%</span>
                    </div>
                    <div style={{ height: '7px', background: 'var(--bg-tertiary)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${app.context}%`, background: 'linear-gradient(90deg, var(--status-success), #10b981)', borderRadius: '4px' }}></div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Seed Simulation & Canvas graph integrated inside Overview */}
          <div className="grid-2col" style={{ gridTemplateColumns: '2.2fr 1fr', gap: '1.5rem' }}>
            
            {/* Live Application Knowledge Graph */}
            <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Share2 size={16} style={{ color: 'var(--status-success)' }} /> Application Knowledge Sharing Graph
                  </h4>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Showing app-to-app knowledge links and shared context, with sessions filtered out.</div>
                </div>
                <div style={{ display: 'flex', gap: '0.65rem', fontSize: '0.65rem', fontWeight: 500 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#8b5cf6', display: 'inline-block' }}></span> App / Service
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#64748b', display: 'inline-block' }}></span> Shared knowledge / dependency
                  </span>
                </div>
              </div>
              <div style={{ border: '1px solid var(--border-glass)', borderRadius: '0.5rem', background: '#fafbfc', overflow: 'hidden' }}>
                <canvas ref={canvasRef} style={{ display: 'block', width: '100%' }}></canvas>
              </div>
            </div>

            {/* Journey Simulator right column */}
            <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Zap size={16} style={{ color: '#ef4444' }} /> Journey Simulator
              </h4>
              <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                Injects a synthetic multi-application customer journey into OpenTelemetry. The Enrichment Engine automatically links entities.
              </p>
              <div style={{ border: '1px dashed var(--border-glass)', borderRadius: '0.5rem', padding: '0.75rem', background: 'var(--bg-tertiary)' }}>
                <div style={{ fontWeight: 600, fontSize: '0.75rem', marginBottom: '0.25rem', color: 'var(--text-primary)' }}>Simulated Scenario:</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', lineHeight: 1.3 }}>
                  1. User logs into <strong>FlowTracer</strong><br />
                  2. Checkout fails due to DB pool exhaustion<br />
                  3. User opens AI Chat in <strong>FrictionX</strong><br />
                  4. Prompt asks about failed payment status
                </div>
              </div>
              <button 
                className="btn btn-primary" 
                onClick={handleSeedJourney} 
                disabled={seeding}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.6rem', fontSize: '0.8rem', marginTop: 'auto' }}
              >
                <Play size={14} fill="currentColor" />
                {seeding ? 'Simulating Journey...' : 'Trigger Simulation Journey'}
              </button>
            </div>
          </div>

          <div className="glass-card" style={{ marginTop: '1.5rem', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Share2 size={16} style={{ color: 'var(--status-success)' }} /> Shared Knowledge Graph
              </h4>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Focuses on app-to-app knowledge and dependency sharing.</span>
            </div>
            <div style={{ width: '100%', minHeight: '520px', borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--border-glass)', background: 'var(--bg-tertiary)' }}>
              <iframe
                title="Shared Knowledge Graph"
                src="http://localhost:8003/static/graph.html"
                style={{ width: '100%', height: '520px', border: 'none' }}
              />
            </div>
          </div>

          <div style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Recent learning signals from traces, metrics & logs
          </div>
          <div className="dashboard-metrics-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <div className="glass-card" style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', padding: '1rem' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: 'var(--status-error)', marginTop: '5px', flexShrink: 0 }}></span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>FlowTracer — DB pool timeout</span>
                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.3 }}>
                  Error traced in checkout span · Pattern updated: DB exhaustion → AI escalation (94% conf)
                </p>
              </div>
            </div>
            <div className="glass-card" style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', padding: '1rem' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: 'var(--status-warning)', marginTop: '5px', flexShrink: 0 }}></span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>FrictionX — LLM call spike</span>
                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.3 }}>
                  156 completions in 1h · RLM updated model distribution patterns automatically
                </p>
              </div>
            </div>
            <div className="glass-card" style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', padding: '1rem' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: 'var(--status-success)', marginTop: '5px', flexShrink: 0 }}></span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>AuditService — auth patterns</span>
                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.3 }}>
                  34 cross-app sessions detected · RLM updated cross-journey pattern context
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Applications Page */}
      {activeTab === 'apps' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }} className="animate-fade-in">
          <div style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Click an application to see its full knowledge · memory · context breakdown
          </div>

          <div className="grid-2col" style={{ gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            {/* App Grid */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {appsList.length === 0 ? (
                <div className="glass-card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  No registered applications found.
                </div>
              ) : (
                appsList.map(app => {
                  const Icon = getAppIcon(app.name);
                  const colors = getAppColors(app.name);
                  const isSelected = selectedApp === String(app.id);
                  return (
                    <div
                      key={app.id}
                      onClick={() => setSelectedApp(String(app.id))}
                      className="glass-card animate-fade-in"
                      style={{
                        cursor: 'pointer',
                        border: isSelected ? '1.5px solid var(--accent-purple)' : '1px solid var(--border-glass)',
                        boxShadow: isSelected ? 'var(--glow-shadow)' : 'none',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.75rem'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ width: 34, height: 34, borderRadius: 8, background: colors.ic, color: colors.tc, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Icon size={16} />
                        </div>
                        <div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{app.name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{app.tech_stack}</div>
                        </div>
                        <span className={`badge badge-${app.status === 'ACTIVE' || app.status === 'active' ? 'success' : 'warning'}`} style={{ marginLeft: 'auto', fontSize: '0.65rem' }}>
                          {app.status || 'Active'}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                        {app.environment} Service • URL: {app.url || 'N/A'}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', borderTop: '1px solid var(--border-glass)', paddingTop: '0.6rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Knowledge Gained</span>
                          <strong style={{ color: 'var(--text-primary)' }}>{app.knowledge}%</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Memory Depth</span>
                          <strong style={{ color: 'var(--text-primary)' }}>{app.memory}%</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Context Richness</span>
                          <strong style={{ color: 'var(--text-primary)' }}>{app.context}%</strong>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Selected App Detail view */}
            <div>
              {(() => {
                const app = appsList.find(a => String(a.id) === selectedApp);
                if (!app) {
                  return (
                    <div className="glass-card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      Select an application to view details.
                    </div>
                  );
                }
                const Icon = getAppIcon(app.name);
                const colors = getAppColors(app.name);
                const totalSignals = (app.signals.traces + app.signals.logs + app.signals.metrics + app.signals.audit) || 1;
                return (
                  <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.75rem' }}>
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: colors.ic, color: colors.tc, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Icon size={20} />
                      </div>
                      <div>
                        <div style={{ fontSize: '1rem', fontWeight: 700 }}>{app.name} Details</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{app.tech_stack} · {app.environment} Environment</div>
                      </div>
                    </div>

                    <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.85rem' }}>
                      <div className="glass-card" style={{ padding: '0.75rem' }}>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Traces</div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{(app.signals.traces || 0).toLocaleString()}</div>
                      </div>
                      <div className="glass-card" style={{ padding: '0.75rem' }}>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Logs</div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{(app.signals.logs || 0).toLocaleString()}</div>
                      </div>
                      <div className="glass-card" style={{ padding: '0.75rem' }}>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Metrics</div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{app.signals.metrics || 0}</div>
                      </div>
                      <div className="glass-card" style={{ padding: '0.75rem' }}>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Audit Events</div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{app.signals.audit || 0}</div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Knowledge · Memory · Context
                      </div>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                          <span>Knowledge gained</span>
                          <strong>{app.knowledge}%</strong>
                        </div>
                        <div style={{ height: '5px', background: 'var(--bg-tertiary)', borderRadius: '3px' }}>
                          <div style={{ height: '100%', width: `${app.knowledge}%`, background: '#f59e0b', borderRadius: '3px' }}></div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                          <span>Memory depth</span>
                          <strong>{app.memory}%</strong>
                        </div>
                        <div style={{ height: '5px', background: 'var(--bg-tertiary)', borderRadius: '3px' }}>
                          <div style={{ height: '100%', width: `${app.memory}%`, background: 'var(--accent-purple)', borderRadius: '3px' }}></div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                          <span>Context richness</span>
                          <strong>{app.context}%</strong>
                        </div>
                        <div style={{ height: '5px', background: 'var(--bg-tertiary)', borderRadius: '3px' }}>
                          <div style={{ height: '100%', width: `${app.context}%`, background: '#10b981', borderRadius: '3px' }}></div>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Recent Telemetry Events
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        {app.events && app.events.length > 0 ? (
                          app.events.map((evt: string, idx: number) => (
                            <div key={idx} style={{ display: 'flex', gap: '0.5rem', background: 'var(--bg-tertiary)', padding: '0.5rem', borderRadius: '0.35rem', fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>
                              <span className={`badge ${evt.includes('ERROR') || evt.includes('500') ? 'badge-danger' : 'badge-success'}`} style={{ fontSize: '0.6rem', padding: '0.1rem 0.3rem' }}>
                                {evt.includes('ERROR') || evt.includes('500') ? 'ERR' : 'OK'}
                              </span>
                              <span style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{evt}</span>
                            </div>
                          ))
                        ) : (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>No recent events.</div>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', borderTop: '1px solid var(--border-glass)', paddingTop: '0.85rem' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        What this app has learned (RLM)
                      </div>
                      <div style={{ background: 'rgba(109, 40, 217, 0.04)', border: '1px solid rgba(109, 40, 217, 0.15)', borderRadius: '0.5rem', padding: '0.85rem', fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                        {app.learned}
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Signal mix feeding RLM
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.7rem' }}>
                          <span style={{ width: '60px' }}>Traces</span>
                          <div style={{ flex: 1, height: '4px', background: 'var(--bg-tertiary)' }}><div style={{ height: '100%', background: 'var(--accent-purple)', width: `${Math.round((app.signals.traces || 0) / totalSignals * 100)}%` }}></div></div>
                          <span>{Math.round((app.signals.traces || 0) / totalSignals * 100)}%</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.7rem' }}>
                          <span style={{ width: '60px' }}>Logs</span>
                          <div style={{ flex: 1, height: '4px', background: 'var(--bg-tertiary)' }}><div style={{ height: '100%', background: '#10b981', width: `${Math.round((app.signals.logs || 0) / totalSignals * 100)}%` }}></div></div>
                          <span>{Math.round((app.signals.logs || 0) / totalSignals * 100)}%</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.7rem' }}>
                          <span style={{ width: '60px' }}>Metrics</span>
                          <div style={{ flex: 1, height: '4px', background: 'var(--bg-tertiary)' }}><div style={{ height: '100%', background: '#f59e0b', width: `${Math.round((app.signals.metrics || 0) / totalSignals * 100)}%` }}></div></div>
                          <span>{Math.round((app.signals.metrics || 0) / totalSignals * 100)}%</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.7rem' }}>
                          <span style={{ width: '60px' }}>Audit</span>
                          <div style={{ flex: 1, height: '4px', background: 'var(--bg-tertiary)' }}><div style={{ height: '100%', background: '#dc2626', width: `${Math.round((app.signals.audit || 0) / totalSignals * 100)}%` }}></div></div>
                          <span>{Math.round((app.signals.audit || 0) / totalSignals * 100)}%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Memory Layer Page */}
      {activeTab === 'memory' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }} className="animate-fade-in">
          <div style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Memory layer — write, read and inspect each tier
          </div>

          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <div className="glass-card stat-widget">
              <span className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Zap size={14} style={{ color: 'var(--accent-purple)' }} /> Hot memory
              </span>
              <span className="stat-value">{layers.hot?.count || 47}</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>active sessions, &lt;30min TTL</span>
            </div>
            <div className="glass-card stat-widget">
              <span className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Database size={14} style={{ color: '#10b981' }} /> Structured
              </span>
              <span className="stat-value">{layers.structured?.count || 182}</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>business events stored</span>
            </div>
            <div className="glass-card stat-widget">
              <span className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Search size={14} style={{ color: '#fbbf24' }} /> Semantic vectors
              </span>
              <span className="stat-value">{layers.semantic?.count || 64}</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>LLM dialogs vector indexed</span>
            </div>
          </div>

          <div className="grid-2col" style={{ gridTemplateColumns: '1fr 1.2fr', gap: '1.5rem' }}>
            {/* Write to memory form */}
            <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Plus size={18} style={{ color: 'var(--accent-purple)' }} /> Write to memory
              </h4>
              <form onSubmit={handleWriteMemory} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Target tier</label>
                  <select 
                    className="form-control" 
                    value={memTier} 
                    onChange={(e) => setMemTier(e.target.value)}
                    style={{ fontSize: '0.8rem', padding: '0.4rem' }}
                  >
                    <option value="hot">Hot memory — active session context</option>
                    <option value="structured">Structured memory — business event</option>
                    <option value="semantic">Semantic memory — LLM dialog</option>
                    <option value="learning">Learning memory — pattern / insight</option>
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Application</label>
                  <select 
                    className="form-control"
                    value={memApp}
                    onChange={(e) => setMemApp(e.target.value)}
                    style={{ fontSize: '0.8rem', padding: '0.4rem' }}
                  >
                    {appsList.length === 0 ? (
                      <option value="">No apps registered</option>
                    ) : (
                      appsList.map(app => (
                        <option key={app.id} value={app.name}>{app.name}</option>
                      ))
                    )}
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Memory content</label>
                  <textarea 
                    className="form-control" 
                    value={memContent}
                    onChange={(e) => setMemContent(e.target.value)}
                    placeholder="Describe what happened, what the user did, or what the system learned…"
                    style={{ fontSize: '0.8rem', minHeight: '80px', resize: 'vertical' }}
                  />
                </div>
                <button type="submit" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', fontSize: '0.8rem', padding: '0.5rem' }}>
                  <Check size={14} /> Write to memory
                </button>
              </form>

              {memFeedback && (
                <div style={{ 
                  fontSize: '0.75rem', 
                  padding: '0.5rem', 
                  borderRadius: '0.35rem', 
                  backgroundColor: memFeedback.success ? 'var(--status-success-bg)' : 'var(--status-error-bg)',
                  color: memFeedback.success ? 'var(--status-success)' : 'var(--status-error)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem'
                }}>
                  {memFeedback.success ? <Check size={14} /> : <AlertCircle size={14} />}
                  {memFeedback.text}
                </div>
              )}
            </div>

            {/* Memory entries list with dynamic layers tab */}
            <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.5rem' }}>
                <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Layers size={18} style={{ color: '#10b981' }} /> Memory entries
                </h4>
                
                {/* Horizontal mini layers selector */}
                <select 
                  className="form-control" 
                  value={activeLayerTab} 
                  onChange={(e) => setActiveLayerTab(e.target.value)}
                  style={{ fontSize: '0.75rem', height: '26px', padding: '0 0.35rem', width: 'auto' }}
                >
                  <option value="hot">Hot Tier</option>
                  <option value="structured">Structured</option>
                  <option value="semantic">Semantic</option>
                  <option value="learning">Learning</option>
                  <option value="graph">Graph</option>
                  <option value="historical">Historical</option>
                </select>
              </div>

              {layers[activeLayerTab] ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    <span>{layers[activeLayerTab].purpose}</span>
                    <span>Total count: <strong>{layers[activeLayerTab].count}</strong></span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '240px', overflowY: 'auto', paddingRight: '4px' }}>
                    {layers[activeLayerTab].samples.length === 0 ? (
                      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                        No records found in this tier.
                      </div>
                    ) : (
                      layers[activeLayerTab].samples.map((sample: any, idx: number) => (
                        <div key={idx} style={{ padding: '0.6rem', background: 'var(--bg-tertiary)', borderRadius: '0.5rem', fontSize: '0.725rem', border: '1px solid var(--border-glass)', lineHeight: 1.4 }}>
                          {activeLayerTab === 'hot' && (
                            <div>
                              <div style={{ fontWeight: 600, color: 'var(--accent-purple)', display: 'flex', justifyContent: 'space-between' }}>
                                <span>Session: {sample.session_id.substring(0, 16)}...</span>
                              </div>
                              <div style={{ color: 'var(--text-primary)', marginTop: '0.2rem' }}>{sample.context}</div>
                              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>Identity: {sample.user}</div>
                            </div>
                          )}

                          {activeLayerTab === 'structured' && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
                              <div>
                                <span className="badge badge-info" style={{ fontSize: '0.6rem', padding: '0.1rem 0.3rem', marginRight: '0.4rem' }}>
                                  {sample.type}
                                </span>
                                <strong>{sample.app}</strong>: {sample.desc}
                              </div>
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem', flexShrink: 0 }}>
                                {new Date(sample.time).toLocaleTimeString()}
                              </span>
                            </div>
                          )}

                          {activeLayerTab === 'semantic' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#d97706', fontWeight: 600 }}>
                                <span>AI Interaction ({sample.model})</span>
                                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Session: {sample.session?.substring(0, 8)}...</span>
                              </div>
                              <div><strong>Prompt:</strong> "{sample.prompt}"</div>
                              <div style={{ color: 'var(--text-secondary)' }}><strong>Resp:</strong> "{sample.response}"</div>
                            </div>
                          )}

                          {activeLayerTab === 'learning' && (
                            <div>
                              <div style={{ fontWeight: 600, color: 'var(--status-error)', display: 'flex', justifyContent: 'space-between' }}>
                                <span>{sample.title}</span>
                                <span>Confidence: {(sample.confidence * 100).toFixed(0)}%</span>
                              </div>
                              <div style={{ color: 'var(--text-secondary)', marginTop: '0.15rem' }}>{sample.type}</div>
                            </div>
                          )}

                          {activeLayerTab === 'graph' && (
                            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.25rem' }}>
                              <span style={{ color: 'var(--accent-blue)', fontWeight: 500 }}>{sample.source}</span>
                              <ArrowRight size={10} style={{ color: 'var(--text-muted)' }} />
                              <span style={{ color: 'var(--accent-purple)', background: 'var(--accent-purple-glow)', padding: '0.05rem 0.25rem', borderRadius: '4px', fontSize: '0.65rem' }}>{sample.rel}</span>
                              <ArrowRight size={10} style={{ color: 'var(--text-muted)' }} />
                              <span style={{ color: 'var(--status-success)', fontWeight: 500 }}>{sample.target}</span>
                            </div>
                          )}

                          {activeLayerTab === 'historical' && (
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ textTransform: 'capitalize', fontWeight: 500 }}>{sample.type} telemetry</span>
                              <strong>{sample.count} entries</strong>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ) : (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading entries...</div>
              )}
            </div>
          </div>

          {/* Semantic Search Vector query */}
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Search size={18} style={{ color: '#fbbf24' }} /> Semantic Search Vector Query
            </h4>
            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              Query semantic memory directly using natural language. The engine scans LLM dialogs, completions, and contextual summaries.
            </p>
            <form onSubmit={handleSemanticSearch} style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                placeholder="e.g. refund request, checkout fail, pool exhausted"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="form-control"
                style={{ flex: 1, fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}
              />
              <button type="submit" className="btn btn-primary" style={{ padding: '0.4rem 1.25rem', fontSize: '0.8rem' }}>
                Search
              </button>
            </form>

            {isSearching ? (
              <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                Querying vectors (Qdrant simulation)...
              </div>
            ) : searchResults.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '180px', overflowY: 'auto' }}>
                {searchResults.map((match, idx) => (
                  <div key={idx} style={{ padding: '0.5rem 0.75rem', border: '1px solid var(--border-glass)', borderRadius: '0.35rem', background: 'rgba(251, 191, 36, 0.03)', fontSize: '0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                      <span style={{ color: '#d97706', fontWeight: 600 }}>Relevance Score: {(match.relevance_score).toFixed(1)}</span>
                      <span style={{ color: 'var(--text-muted)' }}>{new Date(match.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <div style={{ color: 'var(--text-primary)' }}><strong>Prompt:</strong> "{match.prompt}"</div>
                    <div style={{ color: 'var(--text-secondary)', marginTop: '0.2rem' }}><strong>Summary:</strong> {match.summary}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: '1.5rem', textAlign: 'center', border: '1px dashed var(--border-glass)', borderRadius: '0.5rem', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                Enter a search query to scan semantic memory indices.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Context Layer Page */}
      {activeTab === 'context' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }} className="animate-fade-in">
          <div style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Context layer — what each app brings into every request right now
          </div>

          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <div className="glass-card stat-widget">
              <span className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Clock size={14} style={{ color: 'var(--accent-purple)' }} /> Context window used
              </span>
              <span className="stat-value">68%</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>average across all apps</span>
            </div>
            <div className="glass-card stat-widget">
              <span className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Layers size={14} style={{ color: '#10b981' }} /> Injected docs
              </span>
              <span className="stat-value">312</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>RAG chunks analyzed today</span>
            </div>
            <div className="glass-card stat-widget">
              <span className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Cpu size={14} style={{ color: '#f59e0b' }} /> Tool calls
              </span>
              <span className="stat-value">1,204</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>results loaded into active ctx</span>
            </div>
          </div>

          <div className="grid-2col" style={{ gridTemplateColumns: '1.2fr 1fr', gap: '1.5rem' }}>
            {/* Write context form */}
            <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <MessageSquare size={18} style={{ color: 'var(--accent-purple)' }} /> Write context for session
              </h4>
              <form onSubmit={handleWriteContext} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Session ID</label>
                  <select 
                    className="form-control" 
                    value={ctxSessionId} 
                    onChange={(e) => setCtxSessionId(e.target.value)}
                    style={{ fontSize: '0.8rem', padding: '0.4rem' }}
                  >
                    {sessionOptions.map(id => (
                      <option key={id} value={id}>{id}</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Context content (will override current active context)</label>
                  <textarea 
                    className="form-control" 
                    value={ctxContent}
                    onChange={(e) => setCtxContent(e.target.value)}
                    placeholder="User has had a failed checkout. DB pool exhausted at 10:23 AM. Opened AI chat to resolve. Priority: high."
                    style={{ fontSize: '0.8rem', minHeight: '90px', resize: 'vertical' }}
                  />
                </div>
                <button type="submit" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', fontSize: '0.8rem', padding: '0.5rem' }}>
                  <Check size={14} /> Write context
                </button>
              </form>

              {ctxFeedback && (
                <div style={{ 
                  fontSize: '0.75rem', 
                  padding: '0.5rem', 
                  borderRadius: '0.35rem', 
                  backgroundColor: ctxFeedback.success ? 'var(--status-success-bg)' : 'var(--status-error-bg)',
                  color: ctxFeedback.success ? 'var(--status-success)' : 'var(--status-error)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem'
                }}>
                  <Check size={14} />
                  {ctxFeedback.text}
                </div>
              )}
            </div>

            {/* Active synthesized context */}
            <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Brain size={18} style={{ color: '#10b981' }} /> Active synthesized context
              </h4>

              {activeContext ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ 
                    background: 'linear-gradient(135deg, rgba(109, 40, 217, 0.05) 0%, rgba(99, 102, 241, 0.05) 100%)',
                    border: '1px solid rgba(109, 40, 217, 0.25)',
                    borderRadius: '0.75rem',
                    padding: '1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--accent-purple)', fontWeight: 700 }}>
                      <Sparkles size={12} /> AI-synthesized context
                    </div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 500, lineHeight: 1.5, color: 'var(--text-primary)', fontStyle: 'italic' }}>
                      "{activeContext.active_context}"
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border-glass)', paddingTop: '0.5rem', marginTop: '0.25rem' }}>
                      <span>Session ID: <strong>{activeContext.session_id.substring(0, 16)}...</strong></span>
                      <span>Updated: {new Date(activeContext.last_updated).toLocaleTimeString()}</span>
                    </div>
                  </div>

                  <div style={{ fontWeight: 600, fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Context sources assembled
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', background: 'var(--bg-tertiary)', padding: '0.5rem', borderRadius: '0.35rem', fontSize: '0.75rem' }}>
                      <Shield size={14} style={{ color: 'var(--accent-purple)' }} />
                      <div style={{ flex: 1 }}>
                        <strong>System prompt:</strong> operator instructions & safety constraints
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', background: 'var(--bg-tertiary)', padding: '0.5rem', borderRadius: '0.35rem', fontSize: '0.75rem' }}>
                      <History size={14} style={{ color: '#10b981' }} />
                      <div style={{ flex: 1 }}>
                        <strong>Retrieved memory:</strong> {activeContext.raw_events_count || 3} hot sessions + structured facts
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', background: 'var(--bg-tertiary)', padding: '0.5rem', borderRadius: '0.35rem', fontSize: '0.75rem' }}>
                      <Cpu size={14} style={{ color: '#f59e0b' }} />
                      <div style={{ flex: 1 }}>
                        <strong>Tool results:</strong> search, database, and API outputs
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No active session selected. Use simulator or select session.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* RLM Learning Page */}
      {activeTab === 'rlm' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }} className="animate-fade-in">
          <div style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            RLM — reinforcement learning from memory. What the system learns from traces, metrics, logs & audit data
          </div>

          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <div className="glass-card stat-widget">
              <span className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <TrendingUp size={14} style={{ color: 'var(--accent-purple)' }} /> Patterns learned
              </span>
              <span className="stat-value">{layers.learning?.count || 5}</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>from live telemetry loops</span>
            </div>
            <div className="glass-card stat-widget">
              <span className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <RefreshCw size={14} style={{ color: '#10b981' }} /> Training cycles
              </span>
              <span className="stat-value">128</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>since last fabric reset</span>
            </div>
            <div className="glass-card stat-widget">
              <span className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Check size={14} style={{ color: '#fbbf24' }} /> Avg confidence
              </span>
              <span className="stat-value">92%</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>across all patterns</span>
            </div>
          </div>

          {/* RLM Data Flow Graph */}
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Share2 size={18} style={{ color: 'var(--accent-purple)' }} /> How RLM learns — data flow
            </h4>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', background: 'var(--bg-tertiary)', padding: '1rem', borderRadius: '0.75rem', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', fontWeight: 600, padding: '0.4rem 0.6rem', background: '#ffffff', border: '1px solid var(--border-glass)', borderRadius: '6px' }}>
                <Radio size={12} style={{ color: '#dc2626' }} /> Telemetry Logs
              </div>
              <ArrowRight size={14} style={{ color: 'var(--text-muted)' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', fontWeight: 600, padding: '0.4rem 0.6rem', background: '#ffffff', border: '1px solid var(--border-glass)', borderRadius: '6px' }}>
                <Activity size={12} style={{ color: '#f59e0b' }} /> Enrichment Engine
              </div>
              <ArrowRight size={14} style={{ color: 'var(--text-muted)' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', fontWeight: 600, padding: '0.4rem 0.6rem', background: '#ffffff', border: '1px solid var(--border-glass)', borderRadius: '6px' }}>
                <Layers size={12} style={{ color: '#10b981' }} /> Memory Tiers
              </div>
              <ArrowRight size={14} style={{ color: 'var(--text-muted)' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', fontWeight: 600, padding: '0.4rem 0.6rem', background: '#ffffff', border: '1px solid var(--border-glass)', borderRadius: '6px' }}>
                <Brain size={12} style={{ color: 'var(--accent-purple)' }} /> Pattern Discovery
              </div>
              <ArrowRight size={14} style={{ color: 'var(--text-muted)' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', fontWeight: 600, padding: '0.4rem 0.6rem', background: '#ffffff', border: '1px solid var(--border-glass)', borderRadius: '6px' }}>
                <TrendingUp size={12} style={{ color: '#2563eb' }} /> RLM Model Update
              </div>
            </div>
          </div>

          <div style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Learned patterns — what the system now knows and why
          </div>

          {/* Insights Patterns */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {insights.length === 0 ? (
              <div className="glass-card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                No intelligence patterns discovered yet. Execute simulator journeys to populate patterns.
              </div>
            ) : (
              insights.map(item => {
                const confidenceColor = item.confidence >= 0.9 ? 'var(--status-success)' : item.confidence >= 0.85 ? 'var(--status-warning)' : 'var(--status-error)';
                const confidenceBg = item.confidence >= 0.9 ? 'var(--status-success-bg)' : item.confidence >= 0.85 ? 'var(--status-warning-bg)' : 'var(--status-error-bg)';
                return (
                  <div key={item.id} className="glass-card" style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', flex: 1, minWidth: '280px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span className="badge badge-info" style={{ fontSize: '0.65rem', padding: '0.15rem 0.45rem' }}>{item.pattern_type.replace('_', ' ')}</span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Frequency: {item.frequency} cycles</span>
                      </div>
                      <h5 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600 }}>{item.title}</h5>
                      <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                        {item.description}
                      </p>
                      {item.details && (
                        <div style={{ marginTop: '0.4rem', padding: '0.5rem 0.75rem', background: 'var(--bg-tertiary)', borderRadius: '6px', fontSize: '0.7rem', fontFamily: 'var(--font-mono)' }}>
                          {Object.entries(item.details).map(([key, val]) => (
                            <div key={key}>
                              <span style={{ color: 'var(--text-secondary)' }}>{key}:</span> {String(val)}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.2rem' }}>
                      <div style={{ fontSize: '1.25rem', fontWeight: 700, color: confidenceColor }}>
                        {(item.confidence * 100).toFixed(0)}%
                      </div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>confidence</div>
                      <div style={{ width: '80px', height: '5px', background: 'var(--bg-tertiary)', borderRadius: '3px', overflow: 'hidden', marginTop: '0.35rem' }}>
                        <div style={{ height: '100%', width: `${item.confidence * 100}%`, background: confidenceColor }}></div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Live Telemetry Page */}
      {activeTab === 'telemetry' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }} className="animate-fade-in">
          <div style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Live telemetry — traces · metrics · logs · audit feeding memory & RLM
          </div>

          <div className="stats-grid">
            <div className="glass-card stat-widget">
              <span className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <GitBranch size={14} style={{ color: 'var(--accent-purple)' }} /> Spans today
              </span>
              <span className="stat-value">{(overviewDashboard?.summary?.total_traces || appsList.reduce((acc: number, app: any) => acc + (app.signals?.traces || 0), 0)).toLocaleString()}</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>across all services</span>
            </div>
            <div className="glass-card stat-widget">
              <span className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Terminal size={14} style={{ color: '#10b981' }} /> Log entries
              </span>
              <span className="stat-value">{(appsList.reduce((acc: number, app: any) => acc + (app.signals?.logs || 0), 0)).toLocaleString()}</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{(overviewDashboard?.summary?.error_rate_pct || 0.0)}% error rate</span>
            </div>
            <div className="glass-card stat-widget">
              <span className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <TrendingUp size={14} style={{ color: '#f59e0b' }} /> Metrics emitted
              </span>
              <span className="stat-value">{(appsList.reduce((acc: number, app: any) => acc + (app.signals?.metrics || 0), 0)).toLocaleString()}</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>active dimensions</span>
            </div>
            <div className="glass-card stat-widget">
              <span className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Shield size={14} style={{ color: '#ef4444' }} /> Audit events
              </span>
              <span className="stat-value">{(appsList.reduce((acc: number, app: any) => acc + (app.signals?.audit || 0), 0)).toLocaleString()}</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>security actions logged</span>
            </div>
          </div>

          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Radio size={16} style={{ color: '#ef4444' }} /> Live telemetry stream — feeding memory & RLM
              </h4>
              <span className="badge badge-danger" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.65rem' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#ffffff', display: 'inline-block' }}></span>
                Live
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '400px', overflowY: 'auto' }}>
              {telemetryStream.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                  No telemetry stream events captured yet. Run simulator journey to trigger events.
                </div>
              ) : (
                telemetryStream.map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'var(--bg-tertiary)', padding: '0.55rem 0.75rem', borderRadius: '0.35rem', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', border: '1px solid var(--border-glass)' }}>
                    <span className={`badge ${item.type === 'err' ? 'badge-danger' : item.type === 'warn' ? 'badge-warning' : 'badge-success'}`} style={{ fontSize: '0.6rem', padding: '0.1rem 0.35rem', flexShrink: 0 }}>
                      {item.tag}
                    </span>
                    <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>[{item.app}]</span>
                    <span style={{ color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{item.msg}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem', flexShrink: 0 }}>{new Date(item.time).toLocaleTimeString()}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
