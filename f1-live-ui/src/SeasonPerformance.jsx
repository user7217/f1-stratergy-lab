import React, { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, Cell } from 'recharts';

const TEAM_COLORS = {
  "Red Bull Racing": "#3671C6", "Mercedes": "#27F4D2", "Ferrari": "#E80020",
  "McLaren": "#FF8000", "Aston Martin": "#229971", "Alpine": "#0093CC",
  "Williams": "#64C4FF", "RB": "#6692FF", "Haas F1 Team": "#9C9FA2",
  "Kick Sauber": "#52E252", "Racing Bulls": "#6692FF", "Audi": "#00404F",
  "Sauber": "#52E252", "Cadillac": "#C9B36C", "TGR Haas F1 Team": "#9C9FA2",
};

const CATEGORY_COLORS = {
  Power: '#FF6B35',
  Technical: '#9C27B0',
  Street: '#0093CC',
  Mixed: '#4CAF50',
};

const STAT_BOX = { background: '#111', padding: 15, borderRadius: 4, border: '1px solid #222', flex: 1 };

function StatBox({ label, value, sub, color }) {
  return (
    <div style={STAT_BOX}>
      <div style={{ color: '#888', fontSize: 11, textTransform: 'uppercase', marginBottom: 5 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 'bold', color: color || '#fff' }}>{value !== undefined && value !== null ? value : 'N/A'}</div>
      {sub && <div style={{ fontSize: 12, color: '#aaa', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function shortTeam(name) {
  return (name || '')
    .replace(' Formula 1 Team', '').replace(' F1 Team', '')
    .replace(' Racing', '').replace('Scuderia ', '')
    .replace('BWT Alpine', 'Alpine').replace('Visa Cash App ', '')
    .replace('Oracle ', '').replace('Mastercard ', '')
    .replace('TGR Haas', 'Haas').trim();
}

export default function SeasonPerformance({ year }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [category, setCategory] = useState('GLOBAL');
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    setLoading(true);
    fetch(`http://localhost:8000/api/historic/${year}/season-performance`)
      .then(res => res.json())
      .then(json => {
        if (json.error) throw new Error(json.error);
        setData(json.data);
        setLoading(false);
      })
      .catch(err => { setError(err.message); setLoading(false); });
  }, [year]);

  useEffect(() => {
    if (!data) return;
    if (category === 'GLOBAL' || category === 'TRACKS') {
      setSelectedId(null);
    } else if (category === 'TEAMS' && data.teams.length > 0) {
      setSelectedId(data.teams[0].team);
    } else if (category === 'DRIVERS' && data.drivers.length > 0) {
      setSelectedId(data.drivers[0].abbreviation);
    }
  }, [category, data]);

  if (loading) return <div style={{ padding: 30, color: '#888' }}>Aggregating Season Data...</div>;
  if (error) return <div style={{ padding: 30, color: '#E80020' }}>Error: {error}</div>;
  if (!data) return null;

  return (
    <div style={{ flex: 1, padding: 30, overflowY: 'auto', backgroundColor: '#0a0a0a', display: 'flex', flexDirection: 'column' }}>

      <div style={{ display: 'flex', gap: 10, marginBottom: 20, borderBottom: '1px solid #333', paddingBottom: 15, flexShrink: 0 }}>
        {['GLOBAL', 'TEAMS', 'DRIVERS', 'TRACKS'].map(c => (
          <button key={c} onClick={() => setCategory(c)}
            style={{ padding: '8px 16px', background: category === c ? '#E80020' : '#222', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 'bold' }}>
            {c === 'GLOBAL' ? 'GLOBAL OVERVIEW' : c === 'TRACKS' ? 'TRACK ANALYSIS' : c}
          </button>
        ))}
      </div>

      {/* TRACKS: full width, no sidebar */}
      {category === 'TRACKS' && <TrackAnalysis data={data} />}

      {/* All other views: sidebar + content */}
      {category !== 'TRACKS' && (
        <div style={{ display: 'flex', gap: 20, flex: 1, minHeight: 0 }}>

          <div style={{ width: 250, background: '#111', border: '1px solid #222', borderRadius: 4, overflowY: 'auto', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
            {category === 'GLOBAL' && (
              <button style={{ padding: 15, background: '#E80020', color: '#fff', border: 'none', textAlign: 'left', fontWeight: 'bold' }}>
                SEASON SUMMARY
              </button>
            )}
            {category === 'TEAMS' && data.teams.map((t, i) => (
              <button key={t.team} onClick={() => setSelectedId(t.team)}
                style={{ padding: 12, background: selectedId === t.team ? '#222' : 'transparent', color: '#fff', border: 'none', borderBottom: '1px solid #222', textAlign: 'left', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>P{i + 1} {t.team}</span>
                <span style={{ color: TEAM_COLORS[t.team] || '#888', fontWeight: 'bold', marginLeft: 10 }}>{t.points}</span>
              </button>
            ))}
            {category === 'DRIVERS' && data.drivers.map((drv, i) => (
              <button key={drv.abbreviation} onClick={() => setSelectedId(drv.abbreviation)}
                style={{ padding: 12, background: selectedId === drv.abbreviation ? '#222' : 'transparent', color: '#fff', border: 'none', borderBottom: '1px solid #222', textAlign: 'left', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}>
                <span>P{i + 1} {drv.abbreviation}</span>
                <span style={{ color: TEAM_COLORS[drv.team] || '#888', fontWeight: 'bold' }}>{drv.points}</span>
              </button>
            ))}
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0, overflowY: 'auto', paddingRight: 10 }}>
            {category === 'GLOBAL' && <GlobalOverview data={data} />}
            {category === 'TEAMS' && selectedId && <TeamDetail teamName={selectedId} data={data} />}
            {category === 'DRIVERS' && selectedId && <DriverDetail driver={selectedId} data={data} />}
          </div>

        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------
// TRACK ANALYSIS
// ---------------------------------------------------------
function TrackAnalysis({ data }) {
  const categories = data.categories || ['Power', 'Technical', 'Street', 'Mixed'];
  const [selectedCategory, setSelectedCategory] = useState(categories[0]);
  const [metric, setMetric] = useState('avg_points');

  const metricLabel = metric === 'avg_points' ? 'Avg Pts / Race' : 'Avg Finish Pos';

  const categoryRanking = (data.teams || [])
    .map(t => ({
      team: shortTeam(t.team),
      fullTeam: t.team,
      value: t.cat_perf?.[selectedCategory]?.[metric] ?? 0,
      races: t.cat_perf?.[selectedCategory]?.races ?? 0,
      color: TEAM_COLORS[t.team] || '#888',
    }))
    .filter(t => t.races > 0)
    .sort((a, b) => metric === 'avg_finish' ? a.value - b.value : b.value - a.value);

  const topTeams = (data.teams || []).slice(0, 6);
  const crossData = topTeams.map(t => ({
    team: shortTeam(t.team),
    ...Object.fromEntries(
      categories.map(c => [c, t.cat_perf?.[c]?.[metric] ?? 0])
    ),
  }));

  const bestPerCategory = categories.map(c => {
    const sorted = (data.teams || [])
      .filter(t => (t.cat_perf?.[c]?.races ?? 0) > 0)
      .sort((a, b) =>
        metric === 'avg_finish'
          ? (a.cat_perf[c]?.avg_finish ?? 99) - (b.cat_perf[c]?.avg_finish ?? 99)
          : (b.cat_perf[c]?.avg_points ?? 0) - (a.cat_perf[c]?.avg_points ?? 0)
      );
    return { category: c, best: sorted[0] };
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 25 }}>

      {/* insight cards */}
      <div style={{ display: 'flex', gap: 12 }}>
        {bestPerCategory.map(({ category: c, best }) => {
          if (!best) return null;
          const perf = best.cat_perf?.[c];
          return (
            <div key={c} style={{ flex: 1, background: '#111', border: `1px solid ${CATEGORY_COLORS[c]}`, borderRadius: 4, padding: '14px 16px' }}>
              <div style={{ fontSize: 11, color: CATEGORY_COLORS[c], textTransform: 'uppercase', marginBottom: 8, fontWeight: 'bold' }}>{c}</div>
              <div style={{ fontSize: 15, fontWeight: 'bold', color: TEAM_COLORS[best.team] || '#fff', marginBottom: 4 }}>
                {shortTeam(best.team)}
              </div>
              <div style={{ fontSize: 12, color: '#aaa' }}>{perf?.avg_points?.toFixed(1)} pts/race</div>
              <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>{perf?.races} races · P{perf?.avg_finish?.toFixed(1)} avg</div>
            </div>
          );
        })}
      </div>

      {/* controls */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {categories.map(c => (
            <button key={c} onClick={() => setSelectedCategory(c)}
              style={{ padding: '8px 16px', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 'bold',
                background: selectedCategory === c ? CATEGORY_COLORS[c] : '#222',
                color: selectedCategory === c ? '#fff' : '#aaa' }}>
              {c}
            </button>
          ))}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          {['avg_points', 'avg_finish'].map(m => (
            <button key={m} onClick={() => setMetric(m)}
              style={{ padding: '6px 12px', borderRadius: 4, cursor: 'pointer', fontSize: 12,
                border: metric === m ? `1px solid ${CATEGORY_COLORS[selectedCategory]}` : '1px solid #333',
                background: metric === m ? '#222' : 'transparent',
                color: metric === m ? '#fff' : '#666' }}>
              {m === 'avg_points' ? 'Pts / Race' : 'Avg Finish'}
            </button>
          ))}
        </div>
      </div>

      {/* single category ranking */}
      <div>
        <div style={{ color: '#888', fontSize: 12, textTransform: 'uppercase', marginBottom: 12 }}>
          <span style={{ color: CATEGORY_COLORS[selectedCategory] }}>■ </span>
          {selectedCategory} Circuits — {metricLabel}
        </div>
        <div style={{ height: 280, background: '#111', padding: '15px 10px', borderRadius: 4 }}>
          <ResponsiveContainer>
            <BarChart data={categoryRanking} layout="vertical" margin={{ left: 10, right: 50 }}>
              <XAxis type="number" stroke="#666" tick={{ fontSize: 11 }} />
              <YAxis dataKey="team" type="category" stroke="#fff" width={85} tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: '#0a0a0a', border: '1px solid #333', fontSize: 12 }}
                formatter={(v, _, p) => [`${typeof v === 'number' ? v.toFixed(2) : v}  (${p.payload.races} races)`, metricLabel]}
              />
              <Bar dataKey="value" radius={[0, 3, 3, 0]}>
                {categoryRanking.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* cross-category comparison */}
      <div>
        <div style={{ color: '#888', fontSize: 12, textTransform: 'uppercase', marginBottom: 12 }}>
          Top Teams — {metricLabel} Across All Track Types
        </div>
        <div style={{ height: 300, background: '#111', padding: '15px 10px', borderRadius: 4 }}>
          <ResponsiveContainer>
            <BarChart data={crossData} margin={{ left: 10, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
              <XAxis dataKey="team" stroke="#666" tick={{ fontSize: 11 }} />
              <YAxis stroke="#666" tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: '#0a0a0a', border: '1px solid #333', fontSize: 12 }}
                formatter={v => [typeof v === 'number' ? v.toFixed(2) : v, metricLabel]}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {categories.map(c => (
                <Bar key={c} dataKey={c} fill={CATEGORY_COLORS[c]} name={c} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* full breakdown table */}
      <div>
        <div style={{ color: '#888', fontSize: 12, textTransform: 'uppercase', marginBottom: 12 }}>Full Breakdown</div>
        <div style={{ border: '1px solid #222', borderRadius: 4, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', background: '#111', color: '#fff' }}>
            <thead style={{ background: '#1a1a1a' }}>
              <tr>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, color: '#888', fontWeight: 'normal' }}>Team</th>
                {categories.map(c => (
                  <th key={c} colSpan={2} style={{ padding: '10px 12px', textAlign: 'center', fontSize: 11, color: CATEGORY_COLORS[c], fontWeight: 'normal', textTransform: 'uppercase' }}>{c}</th>
                ))}
              </tr>
              <tr style={{ background: '#141414' }}>
                <th style={{ padding: '6px 12px' }} />
                {categories.map(c => (
                  <React.Fragment key={c}>
                    <th style={{ padding: '6px 8px', fontSize: 10, color: '#555', fontWeight: 'normal', textAlign: 'center' }}>Pts/R</th>
                    <th style={{ padding: '6px 8px', fontSize: 10, color: '#555', fontWeight: 'normal', textAlign: 'center' }}>AvgP</th>
                  </React.Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {(data.teams || []).map(t => (
                <tr key={t.team} style={{ borderBottom: '1px solid #1a1a1a' }}>
                  <td style={{ padding: '10px 12px', fontWeight: 'bold', color: TEAM_COLORS[t.team] || '#fff' }}>
                    {shortTeam(t.team)}
                  </td>
                  {categories.map(c => {
                    const p = t.cat_perf?.[c];
                    const has = p && p.races > 0;
                    return (
                      <React.Fragment key={c}>
                        <td style={{ padding: '10px 8px', textAlign: 'center', fontSize: 13, color: has ? '#fff' : '#333' }}>
                          {has ? p.avg_points?.toFixed(1) : '—'}
                        </td>
                        <td style={{ padding: '10px 8px', textAlign: 'center', fontSize: 13, color: has ? '#aaa' : '#333' }}>
                          {has && p.avg_finish ? `P${p.avg_finish?.toFixed(1)}` : '—'}
                        </td>
                      </React.Fragment>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}

// ---------------------------------------------------------
// GLOBAL OVERVIEW
// ---------------------------------------------------------
function GlobalOverview({ data }) {
  const wdcChartData = data.races.map((race, index) => {
    let row = { race };
    data.drivers.slice(0, 10).forEach(d => { row[d.abbreviation] = d.points_timeline[index]; });
    return row;
  });

  const wccChartData = data.races.map((race, index) => {
    let row = { race };
    data.teams.forEach(t => { row[t.team] = t.points_timeline[index]; });
    return row;
  });

  const bestGained = [...data.drivers].sort((a, b) => b.net_gained - a.net_gained)[0];
  const mostConsistentRacer = [...data.drivers].filter(d => d.race_consistency > 0).sort((a, b) => a.race_consistency - b.race_consistency)[0];
  const mostConsistentQuali = [...data.drivers].filter(d => d.quali_consistency > 0).sort((a, b) => a.quali_consistency - b.quali_consistency)[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <h2 style={{ margin: 0, color: '#fff', textTransform: 'uppercase' }}>Global Season Overview</h2>

      <div style={{ display: 'flex', gap: 15, flexWrap: 'wrap' }}>
        <StatBox label="Most Positions Gained" value={`+${bestGained?.net_gained}`} sub={bestGained?.abbreviation} color="#4CAF50" />
        <StatBox label="Best Quali Consistency" value={`±${mostConsistentQuali?.quali_consistency} pos`} sub={mostConsistentQuali?.abbreviation} color="#0093CC" />
        <StatBox label="Best Race Consistency" value={`±${mostConsistentRacer?.race_consistency} pos`} sub={mostConsistentRacer?.abbreviation} color="#9C27B0" />
      </div>

      <div style={{ ...STAT_BOX, minHeight: 350, flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
        <h3 style={{ color: '#aaa', fontSize: 13, textTransform: 'uppercase', marginBottom: 15 }}>Drivers Championship (Top 10)</h3>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={wdcChartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
            <XAxis dataKey="race" stroke="#666" tick={{ fontSize: 11 }} />
            <YAxis stroke="#666" tick={{ fontSize: 11 }} />
            <Tooltip contentStyle={{ background: '#0a0a0a', border: '1px solid #333' }} />
            {data.drivers.slice(0, 10).map(d => (
              <Line key={d.abbreviation} type="monotone" dataKey={d.abbreviation} stroke={TEAM_COLORS[d.team] || '#fff'} strokeWidth={2} dot={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div style={{ ...STAT_BOX, minHeight: 350, flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
        <h3 style={{ color: '#aaa', fontSize: 13, textTransform: 'uppercase', marginBottom: 15 }}>Constructors Championship</h3>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={wccChartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
            <XAxis dataKey="race" stroke="#666" tick={{ fontSize: 11 }} />
            <YAxis stroke="#666" tick={{ fontSize: 11 }} />
            <Tooltip contentStyle={{ background: '#0a0a0a', border: '1px solid #333' }} />
            {data.teams.map(t => (
              <Line key={t.team} type="monotone" dataKey={t.team} stroke={TEAM_COLORS[t.team] || '#fff'} strokeWidth={2} dot={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ---------------------------------------------------------
// TEAM DETAIL
// ---------------------------------------------------------
function TeamDetail({ teamName, data }) {
  const stats = data.teams.find(t => t.team === teamName);
  if (!stats) return null;

  const formGraph = data.races.map((race, index) => ({ race, points: stats.points_timeline[index] }));
  const teamDrivers = data.drivers.filter(d => d.team === teamName);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <h2 style={{ margin: 0, color: '#fff', textTransform: 'uppercase' }}>{teamName} — Constructor Report</h2>
        <h3 style={{ margin: 0, color: TEAM_COLORS[teamName] || '#fff' }}>{stats.points} PTS</h3>
      </div>

      <div style={{ display: 'flex', gap: 15, flexWrap: 'wrap' }}>
        <StatBox label="Wins / Podiums" value={`${stats.wins} / ${stats.podiums}`} color="#FFD124" />
        <StatBox label="Total Poles" value={stats.poles} color="#E80020" />
        <StatBox label="Avg Grid / Finish" value={`P${stats.avg_grid} / P${stats.avg_finish}`} />
        <StatBox label="Retirements" value={stats.dnfs} color={stats.dnfs > 5 ? '#E80020' : '#fff'} />
      </div>

      <div style={{ ...STAT_BOX, minHeight: 350, flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
        <h3 style={{ color: '#aaa', fontSize: 13, textTransform: 'uppercase', marginBottom: 15 }}>WCC Points Accumulation</h3>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={formGraph} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
            <XAxis dataKey="race" stroke="#666" tick={{ fontSize: 11 }} />
            <YAxis stroke="#666" tick={{ fontSize: 11 }} />
            <Tooltip contentStyle={{ background: '#0a0a0a', border: '1px solid #333' }} />
            <Line type="stepAfter" dataKey="points" stroke={TEAM_COLORS[teamName] || '#fff'} strokeWidth={3} dot={{ r: 2 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div style={{ ...STAT_BOX, minHeight: 350, flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
        <h3 style={{ color: '#aaa', fontSize: 13, textTransform: 'uppercase', marginBottom: 15 }}>Intra-Team Driver Points</h3>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={teamDrivers} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
            <XAxis dataKey="abbreviation" stroke="#666" tick={{ fontSize: 11 }} />
            <YAxis stroke="#666" tick={{ fontSize: 11 }} />
            <Tooltip cursor={{ fill: '#222' }} contentStyle={{ background: '#0a0a0a', border: '1px solid #333' }} />
            <Bar dataKey="points" fill={TEAM_COLORS[teamName] || '#0093CC'} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ---------------------------------------------------------
// DRIVER DETAIL
// ---------------------------------------------------------
function DriverDetail({ driver, data }) {
  const stats = data.drivers.find(d => d.abbreviation === driver);
  if (!stats) return null;

  const posTimeline = data.races.map((race, index) => ({
    race, grid: stats.grid_history[index], finish: stats.finish_history[index],
  }));

  const formGraph = data.races.map((race, index) => ({
    race, points: stats.points_timeline[index],
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <h2 style={{ margin: 0, color: '#fff', textTransform: 'uppercase' }}>{driver} — Driver Report</h2>
        <h3 style={{ margin: 0, color: TEAM_COLORS[stats.team] || '#fff' }}>{stats.points} PTS</h3>
      </div>

      <h3 style={{ color: '#aaa', textTransform: 'uppercase', fontSize: 13, margin: 0 }}>Qualifying</h3>
      <div style={{ display: 'flex', gap: 15, flexWrap: 'wrap' }}>
        <StatBox label="Avg Grid" value={`P${stats.avg_grid}`} color="#0093CC" />
        <StatBox label="Quali Consistency" value={`±${stats.quali_consistency}`} color="#0093CC" />
        <StatBox label="Poles" value={stats.poles} />
      </div>

      <h3 style={{ color: '#aaa', textTransform: 'uppercase', fontSize: 13, margin: '10px 0 0 0' }}>Race</h3>
      <div style={{ display: 'flex', gap: 15, flexWrap: 'wrap' }}>
        <StatBox label="Avg Finish" value={`P${stats.avg_finish}`} color="#4CAF50" />
        <StatBox label="Race Consistency" value={`±${stats.race_consistency}`} color="#4CAF50" />
        <StatBox label="Net Positions" value={stats.net_gained > 0 ? `+${stats.net_gained}` : stats.net_gained} color={stats.net_gained > 0 ? '#4CAF50' : '#E80020'} />
        <StatBox label="Wins / Podiums" value={`${stats.wins} / ${stats.podiums}`} color="#FFD124" />
      </div>

      <div style={{ ...STAT_BOX, minHeight: 350, flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 15 }}>
          <h3 style={{ color: '#aaa', fontSize: 13, textTransform: 'uppercase', margin: 0 }}>Grid vs Finish Timeline</h3>
          <span style={{ fontSize: 11 }}>
            <span style={{ color: '#0093CC' }}>— Grid</span> | <span style={{ color: '#4CAF50' }}>— Finish</span>
          </span>
        </div>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={posTimeline} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
            <XAxis dataKey="race" stroke="#666" tick={{ fontSize: 11 }} />
            <YAxis reversed domain={[1, 20]} stroke="#666" tickFormatter={v => `P${v}`} tick={{ fontSize: 11 }} />
            <Tooltip contentStyle={{ background: '#0a0a0a', border: '1px solid #333' }} />
            <Line type="monotone" connectNulls dataKey="grid" stroke="#0093CC" strokeWidth={2} dot={{ r: 2 }} />
            <Line type="monotone" connectNulls dataKey="finish" stroke="#4CAF50" strokeWidth={2} dot={{ r: 2 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div style={{ ...STAT_BOX, minHeight: 350, flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
        <h3 style={{ color: '#aaa', fontSize: 13, textTransform: 'uppercase', marginBottom: 15 }}>Points Accumulation</h3>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={formGraph} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
            <XAxis dataKey="race" stroke="#666" tick={{ fontSize: 11 }} />
            <YAxis stroke="#666" tick={{ fontSize: 11 }} />
            <Tooltip contentStyle={{ background: '#0a0a0a', border: '1px solid #333' }} />
            <Line type="stepAfter" dataKey="points" stroke={TEAM_COLORS[stats.team] || '#fff'} strokeWidth={3} dot={{ r: 2 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}