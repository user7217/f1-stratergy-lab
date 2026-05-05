import React, { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';

const TEAM_COLORS = {
  "Red Bull Racing": "#3671C6", "Mercedes": "#27F4D2", "Ferrari": "#E80020",
  "McLaren": "#FF8000", "Aston Martin": "#229971", "Alpine": "#0093CC",
  "Williams": "#64C4FF", "RB": "#6692FF", "Haas F1 Team": "#9C9FA2", "Kick Sauber": "#52E252",
  "Racing Bulls": "#6692FF", "Audi": "#00404F", "Sauber": "#52E252"
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

export default function SeasonPerformance({ year }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedView, setSelectedView] = useState({ type: 'OVERVIEW', id: null });

  useEffect(() => {
    setLoading(true);
    fetch(`http://localhost:8000/api/historic/${year}/season-performance`)
      .then(res => res.json())
      .then(json => {
        if (json.error) throw new Error(json.error);
        setData(json.data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [year]);

  if (loading) return <div style={{ padding: 30, color: '#888' }}>Aggregating Season Data...</div>;
  if (error) return <div style={{ padding: 30, color: '#E80020' }}>Error: {error}</div>;
  if (!data) return null;

  return (
    <div style={{ display: 'flex', gap: 20, height: '100%', padding: 30, backgroundColor: '#0a0a0a', overflowY: 'auto' }}>
      <div style={{ width: 250, background: '#111', border: '1px solid #222', borderRadius: 4, overflowY: 'auto', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        
        <button 
          onClick={() => setSelectedView({ type: 'OVERVIEW', id: null })} 
          style={{ padding: 15, background: selectedView.type === 'OVERVIEW' ? '#E80020' : '#1a1a1a', color: '#fff', border: 'none', borderBottom: '1px solid #333', textAlign: 'left', cursor: 'pointer', fontWeight: 'bold' }}
        >
          GLOBAL OVERVIEW
        </button>

        <div style={{ padding: '10px 15px', color: '#888', fontSize: 11, fontWeight: 'bold', background: '#0a0a0a', borderBottom: '1px solid #222' }}>TEAMS</div>
        {data.teams.map((t, i) => (
          <button 
            key={t.team}
            onClick={() => setSelectedView({ type: 'TEAM', id: t.team })}
            style={{ padding: 12, background: selectedView.id === t.team ? '#222' : 'transparent', color: '#fff', border: 'none', borderBottom: '1px solid #222', textAlign: 'left', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i + 1}. {t.team}</span>
            <span style={{ color: TEAM_COLORS[t.team] || '#888', fontWeight: 'bold', marginLeft: 10 }}>{t.points}</span>
          </button>
        ))}

        <div style={{ padding: '10px 15px', color: '#888', fontSize: 11, fontWeight: 'bold', background: '#0a0a0a', borderBottom: '1px solid #222' }}>DRIVERS</div>
        {data.drivers.map((drv, i) => (
          <button 
            key={drv.abbreviation}
            onClick={() => setSelectedView({ type: 'DRIVER', id: drv.abbreviation })}
            style={{ padding: 12, background: selectedView.id === drv.abbreviation ? '#222' : 'transparent', color: '#fff', border: 'none', borderBottom: '1px solid #222', textAlign: 'left', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}
          >
            <span>{i + 1}. {drv.abbreviation}</span>
            <span style={{ color: TEAM_COLORS[drv.team] || '#888', fontWeight: 'bold' }}>{drv.points}</span>
          </button>
        ))}
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
        {selectedView.type === 'OVERVIEW' && <GlobalOverview data={data} />}
        {selectedView.type === 'TEAM' && <TeamDetail teamName={selectedView.id} data={data} />}
        {selectedView.type === 'DRIVER' && <DriverDetail driver={selectedView.id} data={data} />}
      </div>
    </div>
  );
}

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
      
      <div style={{ display: 'flex', gap: 15 }}>
        <StatBox label="Total Positions Gained" value={`+${bestGained?.net_gained}`} sub={bestGained?.abbreviation} color="#4CAF50" />
        <StatBox label="Highest Quali Consistency" value={`±${mostConsistentQuali?.quali_consistency} pos`} sub={mostConsistentQuali?.abbreviation} color="#0093CC" />
        <StatBox label="Highest Race Consistency" value={`±${mostConsistentRacer?.race_consistency} pos`} sub={mostConsistentRacer?.abbreviation} color="#9C27B0" />
      </div>

      <div style={{ display: 'flex', gap: 20 }}>
        <div style={{ ...STAT_BOX, height: 350, display: 'flex', flexDirection: 'column' }}>
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

        <div style={{ ...STAT_BOX, height: 350, display: 'flex', flexDirection: 'column' }}>
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
    </div>
  );
}

function TeamDetail({ teamName, data }) {
  const stats = data.teams.find(t => t.team === teamName);
  if (!stats) return null;

  const formGraph = data.races.map((race, index) => ({
    race, points: stats.points_timeline[index]
  }));

  const teamDrivers = data.drivers.filter(d => d.team === teamName);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <h2 style={{ margin: 0, color: '#fff', textTransform: 'uppercase' }}>{teamName} - Season Report</h2>
        <h3 style={{ margin: 0, color: TEAM_COLORS[teamName] || '#fff' }}>{stats.points} PTS</h3>
      </div>

      <div style={{ display: 'flex', gap: 15, flexWrap: 'wrap' }}>
        <StatBox label="Wins / Podiums" value={`${stats.wins} / ${stats.podiums}`} color="#FFD124" />
        <StatBox label="Total Poles" value={stats.poles} color="#E80020" />
        <StatBox label="Avg Grid / Avg Finish" value={`P${stats.avg_grid} / P${stats.avg_finish}`} />
        <StatBox label="Total Retirements" value={stats.dnfs} color={stats.dnfs > 5 ? '#E80020' : '#fff'} />
      </div>

      <div style={{ display: 'flex', gap: 20 }}>
        <div style={{ ...STAT_BOX, height: 300, flex: 2, display: 'flex', flexDirection: 'column' }}>
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

        <div style={{ ...STAT_BOX, height: 300, flex: 1, display: 'flex', flexDirection: 'column' }}>
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
    </div>
  );
}

function DriverDetail({ driver, data }) {
  const stats = data.drivers.find(d => d.abbreviation === driver);
  if (!stats) return null;

  const posTimeline = data.races.map((race, index) => ({
    race, grid: stats.grid_history[index], finish: stats.finish_history[index]
  }));

  const formGraph = data.races.map((race, index) => ({
    race, points: stats.points_timeline[index]
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <h2 style={{ margin: 0, color: '#fff', textTransform: 'uppercase' }}>{driver} - Season Report</h2>
        <h3 style={{ margin: 0, color: TEAM_COLORS[stats.team] || '#fff' }}>{stats.points} PTS</h3>
      </div>

      <h3 style={{ color: '#aaa', textTransform: 'uppercase', fontSize: 13, margin: 0 }}>Qualifying Analytics</h3>
      <div style={{ display: 'flex', gap: 15, flexWrap: 'wrap' }}>
        <StatBox label="Avg Grid Position" value={`P${stats.avg_grid}`} color="#0093CC" />
        <StatBox label="Quali Consistency (Std Dev)" value={`±${stats.quali_consistency}`} color="#0093CC" />
        <StatBox label="Total Poles" value={stats.poles} />
      </div>

      <h3 style={{ color: '#aaa', textTransform: 'uppercase', fontSize: 13, margin: 0, marginTop: 10 }}>Race Analytics</h3>
      <div style={{ display: 'flex', gap: 15, flexWrap: 'wrap' }}>
        <StatBox label="Avg Finish Position" value={`P${stats.avg_finish}`} color="#4CAF50" />
        <StatBox label="Race Consistency (Std Dev)" value={`±${stats.race_consistency}`} color="#4CAF50" />
        <StatBox label="Net Positions Gained" value={stats.net_gained > 0 ? `+${stats.net_gained}` : stats.net_gained} color={stats.net_gained > 0 ? '#4CAF50' : '#E80020'} />
        <StatBox label="Wins / Podiums" value={`${stats.wins} / ${stats.podiums}`} color="#FFD124" />
      </div>

      <div style={{ display: 'flex', gap: 20 }}>
        <div style={{ ...STAT_BOX, height: 300, flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 15 }}>
            <h3 style={{ color: '#aaa', fontSize: 13, textTransform: 'uppercase', margin: 0 }}>Grid vs Finish Timeline</h3>
            <span style={{ fontSize: 11 }}><span style={{ color: '#0093CC' }}>— Grid</span> | <span style={{ color: '#4CAF50' }}>— Finish</span></span>
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

        <div style={{ ...STAT_BOX, height: 300, flex: 1, display: 'flex', flexDirection: 'column' }}>
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
    </div>
  );
}