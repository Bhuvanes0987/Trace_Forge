import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  Cpu,
  Database,
  Zap,
  Clock,
  Layers
} from 'lucide-react';

interface MetricsProps {
  selectedAppId: number | 'ALL';
  refreshTrigger: number;
}

interface MetricPoint {
  timestamp: string;
  value: number;
  service: string;
}

interface MetricTimelineResponse {
  metric_name: string;
  points_count: number;
  timeline: MetricPoint[];
}

// Custom High-Fidelity SVG Line Chart Component
const SimpleSVGChart: React.FC<{
  points: MetricPoint[];
  color: string;
  gradientId: string;
  labelFormat: (v: number) => string;
}> = ({ points, color, gradientId, labelFormat }) => {
  if (points.length === 0) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '220px', color: 'var(--text-muted)' }}>
        No metric reports received for this timeframe.
      </div>
    );
  }

  // Find min/max boundaries
  const values = points.map(p => p.value);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);

  // Set padded limits
  const yMin = minVal === maxVal ? minVal - 1 : minVal - (maxVal - minVal) * 0.1;
  const yMax = minVal === maxVal ? maxVal + 1 : maxVal + (maxVal - minVal) * 0.1;
  const yRange = yMax - yMin;

  // Chart dimensions
  const width = 600;
  const height = 220;
  const paddingLeft = 45;
  const paddingRight = 15;
  const paddingTop = 20;
  const paddingBottom = 30;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  // Map data points to SVG coordinates
  const svgPoints = points.map((p, idx) => {
    const x = paddingLeft + (idx / (points.length - 1 || 1)) * chartWidth;
    const relativeY = yRange === 0 ? 0.5 : (p.value - yMin) / yRange;
    const y = height - paddingBottom - relativeY * chartHeight;
    return { x, y, val: p.value, time: p.timestamp };
  });

  // Construct SVG line path string
  let pathD = '';
  if (svgPoints.length > 0) {
    pathD = `M ${svgPoints[0].x} ${svgPoints[0].y}`;
    for (let i = 1; i < svgPoints.length; i++) {
      pathD += ` L ${svgPoints[i].x} ${svgPoints[i].y}`;
    }
  }

  // Construct Area under the curve path for gradient fill
  const areaD = pathD
    ? `${pathD} L ${svgPoints[svgPoints.length - 1].x} ${height - paddingBottom} L ${svgPoints[0].x} ${height - paddingBottom} Z`
    : '';

  // Generate gridlines
  const gridLines = [];
  const gridCount = 4;
  for (let i = 0; i <= gridCount; i++) {
    const y = paddingTop + (i / gridCount) * chartHeight;
    const val = yMax - (i / gridCount) * yRange;
    gridLines.push({ y, val });
  }

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.45" />
            <stop offset="100%" stopColor={color} stopOpacity="0.00" />
          </linearGradient>
        </defs>

        {/* X Axis Line */}
        <line
          x1={paddingLeft}
          y1={height - paddingBottom}
          x2={width - paddingRight}
          y2={height - paddingBottom}
          stroke="var(--border-glass)"
          strokeWidth="1"
        />

        {/* Horizontal Gridlines & Y-Axis Labels */}
        {gridLines.map((line, idx) => (
          <g key={idx}>
            <line
              x1={paddingLeft}
              y1={line.y}
              x2={width - paddingRight}
              y2={line.y}
              stroke="var(--border-glass)"
              strokeWidth="0.5"
              strokeDasharray="4 4"
            />
            <text
              x={paddingLeft - 8}
              y={line.y + 4}
              fill="var(--text-secondary)"
              fontSize="10"
              fontWeight="600"
              textAnchor="end"
              fontFamily="var(--font-sans)"
            >
              {labelFormat(line.val)}
            </text>
          </g>
        ))}

        {/* Gradient fill area under the line */}
        {areaD && (
          <path
            d={areaD}
            fill={`url(#${gradientId})`}
          />
        )}

        {/* Dynamic smooth Bezier line */}
        {pathD && (
          <path
            d={pathD}
            fill="none"
            stroke={color}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="drop-shadow(0px 2px 4px rgba(0,0,0,0.5))"
          />
        )}

        {/* Glowing node endpoints */}
        {svgPoints.map((pt, idx) => {
          // Only render dots for small count or ends/spikes to keep clean
          const showDot = points.length < 15 || idx === 0 || idx === points.length - 1 || pt.val === maxVal || pt.val === minVal;
          if (!showDot) return null;

          return (
            <circle
              key={idx}
              cx={pt.x}
              cy={pt.y}
              r="4.5"
              fill="var(--bg-secondary)"
              stroke={color}
              strokeWidth="2.5"
              style={{ cursor: 'pointer' }}
            >
              <title>{`Value: ${pt.val}`}</title>
            </circle>
          );
        })}

        {/* X Axis Time Labels (Start, Mid, End) */}
        {svgPoints.length >= 2 && (
          <>
            <text x={paddingLeft} y={height - 12} fill="var(--text-muted)" fontSize="9" fontWeight="600">
              {new Date(svgPoints[0].time).toLocaleTimeString()}
            </text>
            <text x={paddingLeft + chartWidth / 2} y={height - 12} fill="var(--text-muted)" fontSize="9" fontWeight="600" textAnchor="middle">
              {new Date(svgPoints[Math.floor(svgPoints.length / 2)].time).toLocaleTimeString()}
            </text>
            <text x={width - paddingRight} y={height - 12} fill="var(--text-muted)" fontSize="9" fontWeight="600" textAnchor="end">
              {new Date(svgPoints[svgPoints.length - 1].time).toLocaleTimeString()}
            </text>
          </>
        )}
      </svg>
    </div>
  );
};

const Metrics: React.FC<MetricsProps> = ({ selectedAppId, refreshTrigger }) => {
  const [timeframeMinutes, setTimeframeMinutes] = useState<number>(30);
  const [metricNames, setMetricNames] = useState<string[]>([]);
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(['', '', '', '']);
  const [pointsData, setPointsData] = useState<Record<number, MetricPoint[]>>({
    0: [],
    1: [],
    2: [],
    3: []
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingPoints, setLoadingPoints] = useState<Record<number, boolean>>({
    0: false,
    1: false,
    2: false,
    3: false
  });

  // Step 1: Fetch all metric names for this app
  useEffect(() => {
    setLoading(true);
    let url = 'http://localhost:8003/api/v1/dashboards/metrics/names';
    if (selectedAppId !== 'ALL') {
      url += `?app_id=${selectedAppId}`;
    }

    fetch(url)
      .then(res => res.json())
      .then((data: { metrics: string[] }) => {
        const names = data.metrics || [];
        setMetricNames(names);
        
        // Pick default initial metrics for the 4 slots
        const defaults = ['', '', '', ''];
        for (let i = 0; i < 4; i++) {
          if (names[i]) {
            defaults[i] = names[i];
          } else {
            // Fallback defaults in case list is short
            const baseDefaults = [
              'http.server.duration',
              'http.client.duration',
              'http.server.active_requests',
              'asyncio.process.duration'
            ];
            defaults[i] = baseDefaults[i] || '';
          }
        }
        setSelectedMetrics(defaults);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to load metric names:", err);
        setLoading(false);
      });
  }, [selectedAppId, refreshTrigger]);

  // Step 2: Fetch points for a slot when its selected metric or timeframe changes
  const fetchPointsForSlot = (slotIndex: number, metricName: string) => {
    if (!metricName) {
      setPointsData(prev => ({ ...prev, [slotIndex]: [] }));
      return;
    }

    setLoadingPoints(prev => ({ ...prev, [slotIndex]: true }));
    let url = `http://localhost:8003/api/v1/dashboards/metrics?metric_name=${metricName}&minutes_ago=${timeframeMinutes}`;
    if (selectedAppId !== 'ALL') {
      url += `&app_id=${selectedAppId}`;
    }

    fetch(url)
      .then(res => res.json())
      .then((data: MetricTimelineResponse) => {
        setPointsData(prev => ({ ...prev, [slotIndex]: data.timeline || [] }));
        setLoadingPoints(prev => ({ ...prev, [slotIndex]: false }));
      })
      .catch(err => {
        console.error(`Error loading metrics points for ${metricName}:`, err);
        setLoadingPoints(prev => ({ ...prev, [slotIndex]: false }));
      });
  };

  useEffect(() => {
    if (loading) return;
    selectedMetrics.forEach((metricName, idx) => {
      fetchPointsForSlot(idx, metricName);
    });
  }, [loading, selectedMetrics, timeframeMinutes, selectedAppId, refreshTrigger]);

  const handleMetricChange = (slotIndex: number, newMetricName: string) => {
    setSelectedMetrics(prev => {
      const updated = [...prev];
      updated[slotIndex] = newMetricName;
      return updated;
    });
  };

  const chartColors = ['#6d28d9', '#2563eb', '#0891b2', '#d97706'];
  const gradientIds = ['cpuGrad', 'memGrad', 'reqGrad', 'dbGrad'];

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* Configuration Header Area */}
      <div className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <TrendingUp size={20} style={{ color: 'var(--accent-purple)' }} />
          <div>
            <h3 style={{ fontSize: '0.925rem', fontWeight: 800 }}>Aether System Telemetry Graphs</h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Live system diagnostics compiled from infrastructure metrics.</p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>History window:</span>
          <select
            className="form-control"
            style={{ fontSize: '0.8rem', padding: '0.35rem 1rem', width: '120px' }}
            value={timeframeMinutes}
            onChange={e => setTimeframeMinutes(Number(e.target.value))}
          >
            <option value="15">Last 15m</option>
            <option value="30">Last 30m</option>
            <option value="60">Last 1 Hour</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ width: '40px', height: '40px', border: '3px solid var(--border-glass)', borderTopColor: 'var(--accent-purple)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
          <p style={{ color: 'var(--text-secondary)' }}>Compiling and rendering custom SVG metric models...</p>
        </div>
      ) : metricNames.length === 0 ? (
        <div className="glass-card" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '320px', flexDirection: 'column', gap: '1rem', border: '1px dashed var(--border-glass)', borderRadius: '1rem' }}>
          <TrendingUp size={36} style={{ color: 'var(--text-muted)' }} />
          <p style={{ fontWeight: 700, color: 'var(--text-primary)' }}>No metrics found</p>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', maxWidth: '400px', textAlign: 'center' }}>
            We couldn't detect any active time-series metrics registered for this application. Ensure your OpenTelemetry SDK exporter is running.
          </p>
        </div>
      ) : (
        /* The Graphs Panel Dashboard Grid */
        <div className="dashboard-metrics-grid animate-fade-in">
          {selectedMetrics.map((metricName, idx) => {
            const points = pointsData[idx] || [];
            const isSlotLoading = loadingPoints[idx];
            
            return (
              <div className="glass-card" key={idx} style={{ position: 'relative' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                    <Layers size={16} style={{ color: chartColors[idx] }} />
                    {metricName || 'Select Metric'}
                  </h4>
                  
                  <select
                    className="app-selector-dropdown"
                    style={{ fontSize: '0.75rem', padding: '0.25rem 0.75rem', borderRadius: '0.5rem' }}
                    value={metricName}
                    onChange={e => handleMetricChange(idx, e.target.value)}
                  >
                    <option value="">-- No Metric --</option>
                    {metricNames.map(name => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </div>
                
                {isSlotLoading ? (
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '220px' }}>
                    <div style={{ width: '24px', height: '24px', border: '2px solid var(--border-glass)', borderTopColor: chartColors[idx], borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                  </div>
                ) : (
                  <SimpleSVGChart
                    points={points}
                    color={chartColors[idx]}
                    gradientId={gradientIds[idx]}
                    labelFormat={(v) => {
                      if (metricName.includes('duration') || metricName.includes('latency')) {
                        return `${v.toFixed(1)}ms`;
                      }
                      if (metricName.includes('rate') || metricName.includes('count')) {
                        return v.toFixed(0);
                      }
                      if (metricName.includes('utilization') || metricName.includes('percent')) {
                        return `${(v * 100).toFixed(0)}%`;
                      }
                      if (v >= 1000) {
                        return (v / 1000).toFixed(1) + 'k';
                      }
                      return v.toFixed(2);
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
};

export default Metrics;
