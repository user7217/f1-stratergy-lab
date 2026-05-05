import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, LineChart, Line } from 'recharts';

const OVERVIEW_CACHE = {};

const getTyreColor = (compound) => {
  const c = String(compound).toLowerCase();
  if (c.includes('soft')) return '#E80020';
  if (c.includes('medium')) return '#FFD124';
  if (c.includes('hard')) return '#FFFFFF';
  if (c.includes('intermediate')) return '#4CAF50';
  if (c.includes('wet')) return '#2196F3';
  return '#555';
};

const formatTime = (seconds) => {
  if (!seconds || seconds === Infinity || isNaN(seconds)) return 'N/A';
  const m = Math.floor(seconds / 60);
  const s = (seconds % 60).toFixed(3).padStart(6, '0');
  return m > 0 ? `${m}:${s}` : s;
};

const STAT_BOX = { background: '#111', padding: 15, borderRadius: 4, border: '1px solid #222', flex: 1 };

function StatBox({ label, value, sub, color }) {
  return (
    <div style={STAT_BOX}>
      <div style={{ color: '#888', fontSize: 11, textTransform: 'uppercase', marginBottom: 5 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 'bold', color: color || '#fff' }}>{value || 'N/A'}</div>
      {sub && <div style={{ fontSize: 12, color: '#aaa', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// -----------------------------------------------------------------------------
// MAIN COMPONENT
// -----------------------------------------------------------------------------
export default function RaceOverview({ year, race }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sessionType, setSessionType] = useState('R'); 

  useEffect(() => {
    const key = `${year}-${race}-${sessionType}`;
    if (OVERVIEW_CACHE[key]) { 
      setData(OVERVIEW_CACHE[key]); 
      setError(null);
      return; 
    }

    setLoading(true);
    setError(null);
    setData(null);

    fetch(`http://localhost:8000/api/historic/${year}/${race}/overview/${sessionType}`)
      .then(async res => {
        if (!res.ok) {
          const txt = await res.text();
          throw new Error(`HTTP ${res.status}: ${txt}`);
        }
        return res.json();
      })
      .then(json => { 
        if (!json || !json.data) throw new Error("Invalid response format from server.");
        if (json.data.error) throw new Error(json.data.error);
        
        OVERVIEW_CACHE[key] = json.data;
        setData(json.data); 
        setLoading(false); 
      })
      .catch(err => {
        setError(err.message || "Failed to fetch data.");
        setLoading(false);
      });
  }, [year, race, sessionType]);

  const isQuali = sessionType === 'Q' || sessionType === 'SQ';

  return (
    <div style={{ flex: 1, padding: 30, overflowY: 'auto', backgroundColor: '#0a0a0a', display: 'flex', flexDirection: 'column' }}>
      
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, borderBottom: '1px solid #333', paddingBottom: 15 }}>
        {['R', 'S', 'Q', 'SQ'].map(s => (
          <button key={s} onClick={() => setSessionType(s)} 
            style={{ padding: '8px 16px', background: sessionType === s ? '#E80020' : '#222', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 'bold' }}>
            {s === 'R' ? 'RACE' : s === 'S' ? 'SPRINT' : s === 'Q' ? 'QUALI' : 'SPRINT SHOOTOUT'}
          </button>
        ))}
      </div>

      {loading && <div style={{ color: '#888', fontSize: 16 }}>Downloading & Parsing Telemetry... (This takes ~15 seconds on the first load)</div>}
      {error && !loading && <div style={{ color: '#E80020', padding: 20, background: '#1a0505', border: '1px solid #E80020', borderRadius: 4, whiteSpace: 'pre-wrap' }}><strong>Error:</strong> {error}</div>}
      
      {data && !loading && !error && (
        isQuali ? <QualifyingDashboard data={data} /> : <RaceDashboard data={data} year={year} race={race} />
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// RACE & SPRINT DASHBOARD
// -----------------------------------------------------------------------------
function RaceDashboard({ data, year, race }) {
  const [selectedDriver, setSelectedDriver] = useState(null);
  const results = data.results || [];

  return (
    <div style={{ display: 'flex', gap: 20, height: '100%' }}>
      
      {/* Sidebar: Clickable Driver List */}
      <div style={{ width: 250, background: '#111', border: '1px solid #222', borderRadius: 4, overflowY: 'auto', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <button 
          onClick={() => setSelectedDriver(null)} 
          style={{ padding: 15, background: !selectedDriver ? '#E80020' : '#1a1a1a', color: '#fff', border: 'none', borderBottom: '1px solid #333', textAlign: 'left', cursor: 'pointer', fontWeight: 'bold' }}
        >
          SESSION OVERVIEW
        </button>
        {results.map(drv => (
          <button 
            key={drv.abbreviation}
            onClick={() => setSelectedDriver(drv.abbreviation)}
            style={{ padding: 12, background: selectedDriver === drv.abbreviation ? '#222' : 'transparent', color: '#fff', border: 'none', borderBottom: '1px solid #222', textAlign: 'left', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}
          >
            <span>P{drv.finish || '-'} {drv.abbreviation}</span>
            <span style={{ color: '#888', fontSize: 11 }}>{drv.gained > 0 ? `+${drv.gained}` : drv.gained}</span>
          </button>
        ))}
      </div>

      {/* Main Panel */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 20 }}>
        {!selectedDriver ? (
          <>
            <div style={{ display: 'flex', gap: 15 }}>
              <StatBox label="Fastest Lap" value={formatTime(data.overall_fastest?.time)} sub={data.overall_fastest?.driver} color="#9C27B0" />
              <StatBox label="Total Laps" value={data.total_laps} />
              <StatBox label="Retirements" value={data.dnfs?.length || 0} color={data.dnfs?.length > 0 ? '#E80020' : '#fff'} />
            </div>

            <div style={{ display: 'flex', gap: 20 }}>
              <div style={{ flex: 1 }}>
                <h3 style={{ color: '#aaa', textTransform: 'uppercase', fontSize: 13, marginBottom: 15 }}>Start Performance (Lap 1 Delta)</h3>
                <div style={{ height: 250, background: '#111', padding: 10, borderRadius: 4 }}>
                  <ResponsiveContainer>
                    <BarChart data={data.start_performance || []} layout="vertical" margin={{ left: 0, right: 30 }}>
                      <XAxis type="number" stroke="#666" />
                      <YAxis dataKey="abbreviation" type="category" stroke="#fff" width={50} tick={{ fontSize: 11 }} />
                      <Tooltip cursor={{ fill: '#222' }} contentStyle={{ background: '#0a0a0a', border: '1px solid #333' }} />
                      <Bar dataKey="delta" radius={2}>
                        {(data.start_performance || []).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.delta > 0 ? '#4CAF50' : entry.delta < 0 ? '#E80020' : '#888'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div style={{ flex: 1 }}>
                <h3 style={{ color: '#aaa', textTransform: 'uppercase', fontSize: 13, marginBottom: 15 }}>Pace Consistency (Variance)</h3>
                <div style={{ height: 250, background: '#111', padding: 10, borderRadius: 4 }}>
                  <ResponsiveContainer>
                    <BarChart data={data.consistency || []} layout="vertical" margin={{ left: 0, right: 30 }}>
                      <XAxis type="number" stroke="#666" />
                      <YAxis dataKey="abbreviation" type="category" stroke="#fff" width={50} tick={{ fontSize: 11 }} />
                      <Tooltip cursor={{ fill: '#222' }} contentStyle={{ background: '#0a0a0a', border: '1px solid #333' }} formatter={(val) => [`±${val.toFixed(3)}s`, 'Std Dev']} />
                      <Bar dataKey="variance" fill="#0093CC" radius={[0,2,2,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <h3 style={{ color: '#aaa', textTransform: 'uppercase', fontSize: 13, marginTop: 10, marginBottom: 0 }}>Race Control Log</h3>
            <div style={{ background: '#111', border: '1px solid #222', borderRadius: 4, padding: 15, height: 250, overflowY: 'auto' }}>
              {!data.incidents || data.incidents.length === 0 ? <div style={{ color: '#666' }}>No significant incidents.</div> : 
                data.incidents.map((inc, i) => (
                  <div key={i} style={{ borderBottom: '1px solid #222', padding: '8px 0', fontSize: 12, color: '#ddd' }}>
                    <span style={{ color: '#E80020', marginRight: 10 }}>[{formatTime(inc.time)}]</span> {inc.message}
                  </div>
                ))
              }
            </div>
          </>
        ) : (
          <DriverRaceDetail driver={selectedDriver} data={data} year={year} race={race} />
        )}
      </div>
    </div>
  );
}


function DriverRaceDetail({ driver, data, year, race }) {
  const speedStat = (data.speeds || []).find(s => s.abbreviation === driver);
  const posDelta = (data.positions_delta || []).find(p => p.abbreviation === driver);
  const startStat = (data.start_performance || []).find(s => s.abbreviation === driver);
  const consStat = (data.consistency || []).find(c => c.abbreviation === driver);
  
  const driverNum = speedStat?.driver;
  const stints = data.strategies ? data.strategies[driver] : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <h2 style={{ margin: 0, color: '#fff', textTransform: 'uppercase' }}>{driver} - Race Report</h2>

      <div style={{ display: 'flex', gap: 15, flexWrap: 'wrap' }}>
        <StatBox 
          label="Positions Gained" 
          value={`${posDelta?.gained > 0 ? '+' : ''}${posDelta?.gained || 0}`} 
          color={posDelta?.gained > 0 ? '#4CAF50' : posDelta?.gained < 0 ? '#E80020' : '#fff'} 
        />
        <StatBox 
          label="Points Scored" 
          value={posDelta?.points !== undefined ? posDelta.points : '0'} 
          color={posDelta?.points > 0 ? '#9C27B0' : '#fff'} 
        />
        <StatBox 
          label="Lap 1 Performance" 
          value={startStat ? (startStat.delta > 0 ? `+${startStat.delta}` : startStat.delta < 0 ? `${startStat.delta}` : '0') : 'N/A'} 
          color={startStat?.delta > 0 ? '#4CAF50' : startStat?.delta < 0 ? '#E80020' : '#fff'} 
        />
        <StatBox 
          label="Top Speed Trap" 
          value={speedStat?.speed ? `${speedStat.speed} km/h` : 'N/A'} 
        />
        <StatBox 
          label="Pace Variance" 
          value={consStat?.variance ? `±${consStat.variance.toFixed(3)}s` : 'N/A'} 
          color="#0093CC" 
        />
      </div>

      {stints && stints.length > 0 && (
        <div style={{ ...STAT_BOX, padding: '15px 20px', flexShrink: 0 }}>
          <div style={{ color: '#888', fontSize: 11, textTransform: 'uppercase', marginBottom: 10 }}>Tyre Strategy Timeline</div>
          <div style={{ display: 'flex', height: 24, background: '#222', borderRadius: 4, overflow: 'hidden' }}>
            {stints.map((s, i) => (
              <div key={i} style={{ 
                width: `${(s.laps / Math.max(data.total_laps || 1, 1)) * 100}%`, 
                background: getTyreColor(s.compound), 
                borderRight: '2px solid #111',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: ['#FFFFFF', '#FFD124'].includes(getTyreColor(s.compound)) ? '#000' : '#fff',
                fontSize: 11, fontWeight: 'bold'
              }}>
                {s.laps}L {s.compound?.charAt(0) || '?'}
              </div>
            ))}
          </div>
        </div>
      )}

      {driverNum && (
        <div style={{ ...STAT_BOX, minHeight: 350, display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <div style={{ color: '#888', fontSize: 11, textTransform: 'uppercase', marginBottom: 10, display: 'flex', justifyContent: 'space-between' }}>
            <span>Position Timeline & Pit Stops</span>
            <span><span style={{ color: '#0093CC' }}>— Track Position</span> | <span style={{ color: '#E80020' }}>○ Pit Stop</span></span>
          </div>
          <div style={{ flex: 1, minHeight: 0 }}>
            <DriverLapAnalyzer year={year} race={race} driverNumber={driverNum} />
          </div>
        </div>
      )}
    </div>
  );
}

// function DriverStatsGrid({ driver, data, year, race }) {
//   const speedStat = (data.speeds || []).find(s => s.abbreviation === driver);
//   const posDelta = (data.positions_delta || []).find(p => p.abbreviation === driver);
//   const startStat = (data.start_performance || []).find(s => s.abbreviation === driver);
//   const consStat = (data.consistency || []).find(c => c.abbreviation === driver);
  
//   const driverNum = speedStat?.driver;
//   const stints = data.strategies ? data.strategies[driver] : [];

//   return (
//     <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
//       <h2 style={{ margin: 0, color: '#fff', textTransform: 'uppercase' }}>{driver} - Race Report</h2>

//       <div style={{ display: 'flex', gap: 15, flexWrap: 'wrap' }}>
//         <StatBox 
//           label="Positions Gained" 
//           value={`${posDelta?.gained > 0 ? '+' : ''}${posDelta?.gained || 0}`} 
//           color={posDelta?.gained > 0 ? '#4CAF50' : posDelta?.gained < 0 ? '#E80020' : '#fff'} 
//         />
//         <StatBox 
//           label="Points Scored" 
//           value={posDelta?.points !== undefined ? posDelta.points : '0'} 
//           color={posDelta?.points > 0 ? '#9C27B0' : '#fff'} 
//         />
//         <StatBox 
//           label="Lap 1 Performance" 
//           value={startStat ? (startStat.delta > 0 ? `+${startStat.delta}` : startStat.delta < 0 ? `${startStat.delta}` : '0') : 'N/A'} 
//           color={startStat?.delta > 0 ? '#4CAF50' : startStat?.delta < 0 ? '#E80020' : '#fff'} 
//         />
//         <StatBox 
//           label="Top Speed Trap" 
//           value={speedStat?.speed ? `${speedStat.speed} km/h` : 'N/A'} 
//         />
//         <StatBox 
//           label="Pace Variance" 
//           value={consStat?.variance ? `±${consStat.variance.toFixed(3)}s` : 'N/A'} 
//           color="#0093CC" 
//         />
//       </div>

//       {stints && stints.length > 0 && (
//         <div style={{ ...STAT_BOX, padding: '15px 20px', flexShrink: 0 }}>
//           <div style={{ color: '#888', fontSize: 11, textTransform: 'uppercase', marginBottom: 10 }}>Tyre Strategy Timeline</div>
//           <div style={{ display: 'flex', height: 24, background: '#222', borderRadius: 4, overflow: 'hidden' }}>
//             {stints.map((s, i) => (
//               <div key={i} style={{ 
//                 width: `${(s.laps / Math.max(data.total_laps || 1, 1)) * 100}%`, 
//                 background: getTyreColor(s.compound), 
//                 borderRight: '2px solid #111',
//                 display: 'flex', alignItems: 'center', justifyContent: 'center',
//                 color: ['#FFFFFF', '#FFD124'].includes(getTyreColor(s.compound)) ? '#000' : '#fff',
//                 fontSize: 11, fontWeight: 'bold'
//               }}>
//                 {s.laps}L {s.compound?.charAt(0) || '?'}
//               </div>
//             ))}
//           </div>
//         </div>
//       )}

//       {driverNum && (
//         <div style={{ ...STAT_BOX, minHeight: 350, display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
//           <div style={{ color: '#888', fontSize: 11, textTransform: 'uppercase', marginBottom: 10, display: 'flex', justifyContent: 'space-between' }}>
//             <span>Pace vs Tyre Degradation</span>
//             <span><span style={{ color: '#E80020' }}>— Lap Time</span> | <span style={{ color: '#FFD124' }}>— Tyre Age</span></span>
//           </div>
//           <div style={{ flex: 1, minHeight: 0 }}>
//             <DriverLapAnalyzer year={year} race={race} driverNumber={driverNum} />
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }
function DriverLapAnalyzer({ year, race, driverNumber }) {
  const [lapData, setLapData] = useState([]);

  useEffect(() => {
    fetch(`http://localhost:8000/api/historic/${year}/${race}/driver/${driverNumber}/laps`)
      .then(res => res.json())
      .then(json => {
        if (!json.data) return;
        
        // We NO LONGER filter out slow laps, because doing so breaks 
        // the continuous position timeline and hides pit stops.
        const validPositions = json.data.filter(l => l.position !== null);
        setLapData(validPositions);
      })
      .catch(() => setLapData([]));
  }, [year, race, driverNumber]);

  if (!lapData.length) return <div style={{ color: '#555', fontSize: 12 }}>Loading position trace...</div>;

  // Custom SVG component to mark Pit Stops with a red circle and label
  const PitStopMarker = (props) => {
    const { cx, cy, payload } = props;
    if (payload.pit_in) {
      return (
        <g transform={`translate(${cx},${cy})`}>
          <circle r={5} fill="#111" stroke="#E80020" strokeWidth={2} />
          <text x={0} y={-10} textAnchor="middle" fill="#E80020" fontSize={10} fontWeight="bold">PIT</text>
        </g>
      );
    }
    // Normal lap marker
    return <circle cx={cx} cy={cy} r={2} fill="#0093CC" stroke="none" />;
  };

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={lapData} margin={{ top: 20, right: 20, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
        
        {/* X-Axis: Laps */}
        <XAxis dataKey="lap" stroke="#666" tick={{ fontSize: 11 }} />
        
        {/* Y-Axis: Position (Reversed so P1 is at the top) */}
        <YAxis 
          domain={[1, 20]} 
          reversed 
          stroke="#666" 
          tickFormatter={(v) => `P${v}`} 
          tick={{ fontSize: 11 }} 
          interval={0}
          width={40}
        />
        
        <Tooltip 
          contentStyle={{ background: '#0a0a0a', border: '1px solid #333' }} 
          labelStyle={{ color: '#888', marginBottom: 5 }}
          formatter={(v, name, p) => {
            if (name === 'position') {
                const pitLabel = p.payload.pit_in ? ' (Pit Stop)' : '';
                return [`P${v}${pitLabel} on ${p.payload.compound}`, 'Track Position'];
            }
            return [v, name];
          }} 
          labelFormatter={(label) => `Lap ${label}`}
        />
        
        {/* stepAfter connects the line cleanly from lap to lap */}
        <Line 
          type="stepAfter" 
          dataKey="position" 
          stroke="#0093CC" 
          strokeWidth={2} 
          dot={<PitStopMarker />} 
          activeDot={{ r: 6, fill: '#fff' }} 
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

// -----------------------------------------------------------------------------
// QUALIFYING & SHOOTOUT DASHBOARD
// -----------------------------------------------------------------------------
function QualifyingDashboard({ data }) {
  const [selectedDriver, setSelectedDriver] = useState(null);

  const results = data.results || [];
  const topQ1 = [...results].sort((a, b) => (a.q1 || 999) - (b.q1 || 999))[0];
  const topQ2 = [...results].sort((a, b) => (a.q2 || 999) - (b.q2 || 999))[0];
  const topQ3 = [...results].sort((a, b) => (a.q3 || 999) - (b.q3 || 999))[0];

  return (
    <div style={{ display: 'flex', gap: 20, height: '100%' }}>
      <div style={{ width: 250, background: '#111', border: '1px solid #222', borderRadius: 4, overflowY: 'auto', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <button 
          onClick={() => setSelectedDriver(null)} 
          style={{ padding: 15, background: !selectedDriver ? '#E80020' : '#1a1a1a', color: '#fff', border: 'none', borderBottom: '1px solid #333', textAlign: 'left', cursor: 'pointer', fontWeight: 'bold' }}
        >
          SESSION OVERVIEW
        </button>
        {results.map(drv => (
          <button 
            key={drv.abbreviation}
            onClick={() => setSelectedDriver(drv.abbreviation)}
            style={{ padding: 12, background: selectedDriver === drv.abbreviation ? '#222' : 'transparent', color: '#fff', border: 'none', borderBottom: '1px solid #222', textAlign: 'left', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}
          >
            <span>P{drv.position || '-'} {drv.abbreviation}</span>
            <span style={{ color: '#888', fontSize: 11 }}>{drv.q3 ? 'Q3' : drv.q2 ? 'Q2' : 'Q1'}</span>
          </button>
        ))}
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 20 }}>
        {!selectedDriver ? (
          <>
            <div style={{ display: 'flex', gap: 15 }}>
              <StatBox label="Overall Fastest" value={formatTime(data.overall_fastest?.time)} sub={data.overall_fastest?.driver} color="#E80020" />
              <StatBox label="Q1 Best" value={formatTime(topQ1?.q1)} sub={topQ1?.abbreviation} />
              <StatBox label="Q2 Best" value={formatTime(topQ2?.q2)} sub={topQ2?.abbreviation} />
              <StatBox label="Q3 Best" value={formatTime(topQ3?.q3)} sub={topQ3?.abbreviation} />
            </div>

            <h3 style={{ color: '#aaa', textTransform: 'uppercase', fontSize: 13, marginTop: 10, marginBottom: 0 }}>Absolute Fastest Sectors</h3>
            <div style={{ display: 'flex', gap: 15 }}>
              {['s1', 's2', 's3'].map((s, i) => (
                <StatBox key={s} label={`Sector ${i+1}`} value={formatTime(data.overall_sectors?.[s]?.time)} sub={data.overall_sectors?.[s]?.driver} color="#9C27B0" />
              ))}
            </div>

            <h3 style={{ color: '#aaa', textTransform: 'uppercase', fontSize: 13, marginTop: 10, marginBottom: 0 }}>Race Control Log</h3>
            <div style={{ background: '#111', border: '1px solid #222', borderRadius: 4, padding: 15, height: 250, overflowY: 'auto' }}>
              {!data.incidents || data.incidents.length === 0 ? <div style={{ color: '#666' }}>No significant incidents.</div> : 
                data.incidents.map((inc, i) => (
                  <div key={i} style={{ borderBottom: '1px solid #222', padding: '8px 0', fontSize: 12, color: '#ddd' }}>
                    <span style={{ color: '#E80020', marginRight: 10 }}>[{formatTime(inc.time)}]</span> {inc.message}
                  </div>
                ))
              }
            </div>
          </>
        ) : (
          <DriverQualiDetail driver={selectedDriver} data={data} />
        )}
      </div>
    </div>
  );
}

function DriverQualiDetail({ driver, data }) {
  const result = (data.results || []).find(r => r.abbreviation === driver) || {};
  const attempts = (data.attempts || {})[driver] || [];

  const pbS1 = Math.min(...attempts.map(a => a.s1 || 999).filter(v => v !== 999));
  const pbS2 = Math.min(...attempts.map(a => a.s2 || 999).filter(v => v !== 999));
  const pbS3 = Math.min(...attempts.map(a => a.s3 || 999).filter(v => v !== 999));

  return (
    <>
      <h2 style={{ margin: 0, color: '#fff', textTransform: 'uppercase' }}>{driver} - Qualifying Report</h2>
      
      <div style={{ display: 'flex', gap: 15 }}>
        <StatBox label="Q1 Time" value={formatTime(result.q1)} />
        <StatBox label="Q2 Time" value={formatTime(result.q2)} />
        <StatBox label="Q3 Time" value={formatTime(result.q3)} />
      </div>

      <div style={{ display: 'flex', gap: 15 }}>
        <StatBox label="Personal Best S1" value={pbS1 !== Infinity ? formatTime(pbS1) : 'N/A'} color="#0093CC" />
        <StatBox label="Personal Best S2" value={pbS2 !== Infinity ? formatTime(pbS2) : 'N/A'} color="#0093CC" />
        <StatBox label="Personal Best S3" value={pbS3 !== Infinity ? formatTime(pbS3) : 'N/A'} color="#0093CC" />
      </div>

      <h3 style={{ color: '#aaa', textTransform: 'uppercase', fontSize: 13, marginTop: 10, marginBottom: 0 }}>Lap Progression (Valid Push Laps)</h3>
      <div style={{ overflowY: 'auto', maxHeight: 300, borderRadius: 4, border: '1px solid #222' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', background: '#111' }}>
          <thead style={{ background: '#222', color: '#888', fontSize: 12, position: 'sticky', top: 0 }}>
            <tr>
              <th style={{ padding: 12, textAlign: 'left' }}>Lap</th>
              <th style={{ padding: 12, textAlign: 'left' }}>Time</th>
              <th style={{ padding: 12, textAlign: 'left' }}>S1</th>
              <th style={{ padding: 12, textAlign: 'left' }}>S2</th>
              <th style={{ padding: 12, textAlign: 'left' }}>S3</th>
              <th style={{ padding: 12, textAlign: 'left' }}>Tyre</th>
            </tr>
          </thead>
          <tbody style={{ color: '#fff', fontSize: 13 }}>
            {attempts.length === 0 ? <tr><td colSpan="6" style={{ padding: 20, textAlign: 'center', color: '#666' }}>No valid push laps logged.</td></tr> : 
              attempts.map((a, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #222' }}>
                  <td style={{ padding: 12 }}>{a.lap}</td>
                  <td style={{ padding: 12, fontWeight: 'bold' }}>{formatTime(a.time)}</td>
                  <td style={{ padding: 12, color: a.s1 === pbS1 ? '#9C27B0' : '#fff' }}>{formatTime(a.s1)}</td>
                  <td style={{ padding: 12, color: a.s2 === pbS2 ? '#9C27B0' : '#fff' }}>{formatTime(a.s2)}</td>
                  <td style={{ padding: 12, color: a.s3 === pbS3 ? '#9C27B0' : '#fff' }}>{formatTime(a.s3)}</td>
                  <td style={{ padding: 12, color: getTyreColor(a.compound), fontWeight: 'bold' }}>{a.compound?.charAt(0) || '?'}</td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>
    </>
  );
}