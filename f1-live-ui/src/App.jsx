import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { useLiveF1 } from './useLiveF1';
import TrackMap from './TrackMap';
import RaceOverview from './RaceOverview';
import SeasonPerformance from './SeasonPerformance';
import StatusBar from './StatusBar';
import RaceControlFeed from './RaceControlFeed';

const inputStyle = {
  width: '100%', background: '#1a1a1a', color: '#fff',
  border: '1px solid #333', padding: '6px', fontFamily: 'inherit',
};

const getTyreColor = (compound) => {
  if (!compound) return '#555';
  const c = compound.toLowerCase();
  if (c.includes('soft')) return '#E80020';
  if (c.includes('medium')) return '#FFD124';
  if (c.includes('hard')) return '#FFFFFF';
  if (c.includes('intermediate')) return '#4CAF50';
  if (c.includes('wet')) return '#2196F3';
  return '#888';
};

const YEARS = Array.from({ length: 2026 - 2018 + 1 }, (_, i) => 2026 - i);

export default function App() {
  const state = useLiveF1();
  const [selectedDriver, setSelectedDriver] = useState(null);

  // Router hooks
  const navigate = useNavigate();
  const location = useLocation();
  const isLive = location.pathname === '/';
  const isOverview = location.pathname === '/overview';
  const isSeason = location.pathname === '/season';

  const [replayYear, setReplayYear] = useState(2024);
  const [replayRace, setReplayRace] = useState('Bahrain');
  const [replaySession, setReplaySession] = useState('R');
  const [replaySpeed, setReplaySpeed] = useState(10);

  const [races, setRaces] = useState([]);
  const [racesLoading, setRacesLoading] = useState(false);

  useEffect(() => {
    if (!replayYear) return;
    setRacesLoading(true);
    fetch(`http://localhost:8000/api/historic/seasons/${replayYear}/races`)
      .then(r => r.json())
      .then(j => {
        const list = j.data || [];
        setRaces(list);
        if (list.length && !list.find(r => r.name === replayRace)) {
          setReplayRace(list[0].name);
        }
        setRacesLoading(false);
      })
      .catch(() => setRacesLoading(false));
  }, [replayYear]);

  const handleStartSimulation = async () => {
    try {
      await fetch('http://localhost:8000/api/replay/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          year: Number(replayYear),
          race: replayRace,
          session: replaySession,
          speed: Number(replaySpeed),
          start_at: 0,
        }),
      });
      navigate('/'); // Force navigate to Live View when starting
    } catch (err) {
      console.error('Failed to start replay:', err);
    }
  };

  const handleStopSimulation = async () => {
    try {
      await fetch('http://localhost:8000/api/replay/stop', { method: 'POST' });
    } catch (err) {
      console.error('Failed to stop replay:', err);
    }
  };

  const handleNavigate = (path) => {
    navigate(path);
    if (path === '/overview' || path === '/season') {
      handleStopSimulation();
    }
  };

  const selectedKey = selectedDriver !== null ? String(selectedDriver) : null;
  const activeTelemetry = selectedKey && state.telemetry ? state.telemetry[selectedKey] : null;
  const activeTiming = selectedKey && state.timing ? state.timing[selectedKey] : null;

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', fontFamily: 'monospace', backgroundColor: '#000', color: '#EEE' }}>

      {/* LEFT SIDEBAR (Always Visible) */}
      <div style={{ width: 300, borderRight: '1px solid #333', overflowY: 'auto', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        
        {/* Navigation Tabs */}
        <div style={{ display: 'flex', padding: 10, gap: 5, borderBottom: '1px solid #333', background: '#0a0a0a' }}>
          <button onClick={() => handleNavigate('/')}
            style={{ flex: 1, padding: 8, background: isLive ? '#E80020' : '#222', color: '#fff', border: 'none', cursor: 'pointer', borderRadius: 4, fontWeight: 'bold', fontSize: 11 }}>
            LIVE
          </button>
          <button onClick={() => handleNavigate('/overview')}
            style={{ flex: 1, padding: 8, background: isOverview ? '#E80020' : '#222', color: '#fff', border: 'none', cursor: 'pointer', borderRadius: 4, fontWeight: 'bold', fontSize: 11 }}>
            OVERVIEW
          </button>
          <button onClick={() => handleNavigate('/season')}
            style={{ flex: 1, padding: 8, background: isSeason ? '#E80020' : '#222', color: '#fff', border: 'none', cursor: 'pointer', borderRadius: 4, fontWeight: 'bold', fontSize: 11 }}>
            SEASON
          </button>
        </div>

        {/* Global Settings */}
        <div style={{ padding: 15, borderBottom: '1px solid #333', background: '#0a0a0a' }}>
          <h2 style={{ marginBottom: 15, color: '#aaa', fontSize: 14, textTransform: 'uppercase', letterSpacing: 1 }}>Settings</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 15 }}>
            <div>
              <label style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 4 }}>Year</label>
              <select value={replayYear} onChange={e => setReplayYear(Number(e.target.value))} style={inputStyle}>
                {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>

            {!isSeason && (
              <>
                <div>
                  <label style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 4 }}>Race</label>
                  <select value={replayRace} onChange={e => setReplayRace(e.target.value)} disabled={racesLoading || !races.length} style={inputStyle}>
                    {racesLoading && <option>loading...</option>}
                    {!racesLoading && !races.length && <option>no races</option>}
                    {races.map(r => <option key={r.round} value={r.name}>R{r.round} - {r.name}</option>)}
                  </select>
                </div>

                {isLive && (
                  <>
                    <div>
                      <label style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 4 }}>Session</label>
                      <select value={replaySession} onChange={e => setReplaySession(e.target.value)} style={inputStyle}>
                        <option value="R">Race</option>
                        <option value="Q">Qualifying</option>
                        <option value="S">Sprint</option>
                        <option value="SQ">Sprint Shootout</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 4 }}>Speed Multiplier</label>
                      <input type="number" step="0.5" value={replaySpeed} onChange={e => setReplaySpeed(e.target.value)} style={inputStyle} />
                    </div>
                  </>
                )}
              </>
            )}
          </div>

          <button
            onClick={isLive ? handleStartSimulation : undefined}
            style={{ width: '100%', padding: 10, background: isLive ? '#E80020' : '#444', color: '#fff', border: 'none', cursor: isLive ? 'pointer' : 'default', fontWeight: 'bold', letterSpacing: 1, borderRadius: 2 }}>
            {isLive ? 'LOAD & START LIVE' : 'SYNCED TO VIEW'}
          </button>
        </div>

        {/* Live Grid & Race Control (Only show when on Live page) */}
        {isLive && (
          <>
            <h2 style={{ padding: '15px 15px 5px 15px', color: '#aaa', fontSize: 14, textTransform: 'uppercase', letterSpacing: 1 }}>Grid</h2>
            {Object.values(state.drivers).map(driver => {
              const timingInfo = state.timing && state.timing[String(driver.number)];
              const pos = timingInfo ? timingInfo.position : '-';
              const inPit = timingInfo?.in_pit;

              return (
                <div key={driver.number} onClick={() => setSelectedDriver(driver.number)}
                  style={{
                    padding: '10px 15px', cursor: 'pointer',
                    borderLeft: selectedDriver === driver.number ? `4px solid ${driver.team_color}` : '4px solid transparent',
                    backgroundColor: selectedDriver === driver.number ? '#1a1a1a' : 'transparent',
                    display: 'flex', alignItems: 'center', gap: 12,
                    opacity: inPit ? 0.55 : 1, transition: 'background-color 0.2s',
                  }}>
                  <span style={{ width: 24, color: '#666', fontSize: 12 }}>P{pos}</span>
                  <span style={{ width: 24, color: driver.team_color, fontWeight: 'bold', textAlign: 'right' }}>{driver.number}</span>
                  <span style={{ flex: 1 }}>{driver.abbreviation}</span>
                  {inPit && <span style={{ fontSize: 10, color: '#000', background: '#FFD93D', padding: '2px 5px', borderRadius: 2, fontWeight: 'bold' }}>PIT</span>}
                </div>
              );
            })}
            <RaceControlFeed messages={state.race_control || []} />
          </>
        )}
      </div>

      {/* CENTER CONTENT (React Router Routes) */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Routes>
          <Route path="/" element={
            <>
              <StatusBar session={state.session} weather={state.weather} trackStatus={state.track_status} />
              <TrackMap positions={state.positions} drivers={state.drivers} selectedDriver={selectedDriver} onSelectDriver={setSelectedDriver} year={replayYear} race={replayRace} />
            </>
          } />
          <Route path="/overview" element={<RaceOverview year={replayYear} race={replayRace} />} />
          <Route path="/season" element={<SeasonPerformance year={replayYear} />} />
        </Routes>
      </div>

      {/* RIGHT SIDEBAR (Only visible on Live View) */}
      {isLive && (
        <div style={{ width: 320, borderLeft: '1px solid #333', padding: 20, background: '#0a0a0a', flexShrink: 0, overflowY: 'auto' }}>
          {activeTiming && (
            <div style={{ marginBottom: 30 }}>
              <h2 style={{ marginBottom: 15, color: '#aaa', fontSize: 14, textTransform: 'uppercase', letterSpacing: 1 }}>Timing & Tyres</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ background: '#111', padding: 12, border: `1px solid ${getTyreColor(activeTiming.compound)}`, borderRadius: 4, borderLeftWidth: 4 }}>
                  <div style={{ fontSize: 12, color: '#666', marginBottom: 6, textTransform: 'uppercase' }}>Compound & Age</div>
                  <div style={{ fontSize: 20, fontWeight: 'bold', color: '#fff', display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: getTyreColor(activeTiming.compound) }}>{activeTiming.compound || 'Unknown'}</span>
                    <span>{activeTiming.tyre_age !== null ? `${activeTiming.tyre_age} Laps` : '-'}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <MetricBox label="Last Lap" value={activeTiming.last_lap_time || '-'} flex={1} />
                  <MetricBox label="Gap" value={activeTiming.interval || '-'} flex={1} />
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <MetricBox label="S1" value={activeTiming.sector_1 || '-'} flex={1} />
                  <MetricBox label="S2" value={activeTiming.sector_2 || '-'} flex={1} />
                  <MetricBox label="S3" value={activeTiming.sector_3 || '-'} flex={1} />
                </div>
              </div>
            </div>
          )}

          <h2 style={{ marginBottom: 15, color: '#aaa', fontSize: 14, textTransform: 'uppercase', letterSpacing: 1 }}>Telemetry</h2>
          {activeTelemetry ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
              <div style={{ display: 'flex', gap: 10 }}>
                <MetricBox label="Speed" value={`${activeTelemetry.speed} km/h`} flex={1} />
                <MetricBox label="Gear" value={activeTelemetry.gear} flex={1} />
              </div>
              <MetricBox label="RPM" value={activeTelemetry.rpm} />
              <BarGauge label="Throttle" value={activeTelemetry.throttle} color="#4caf50" />
              <BarGauge label="Brake" value={activeTelemetry.brake} color="#f44336" />
              <MetricBox label="DRS" value={activeTelemetry.drs >= 10 ? 'OPEN' : 'CLOSED'} />
            </div>
          ) : selectedDriver ? (
            <div style={{ marginTop: 10, padding: 15, background: '#332b00', border: '1px solid #ffcc00', borderRadius: 4 }}>
              <p style={{ fontWeight: 'bold', color: '#ffcc00', margin: 0 }}>No Telemetry Signal</p>
              <p style={{ fontSize: 13, color: '#fff', marginTop: 10, lineHeight: 1.5 }}>Car {selectedDriver} is currently not transmitting telemetry.</p>
            </div>
          ) : (
            <p style={{ color: '#666', marginTop: 20, fontSize: 14 }}>Select a driver on the track or grid.</p>
          )}
        </div>
      )}
    </div>
  );
}

function MetricBox({ label, value, flex }) {
  return (
    <div style={{ flex, background: '#111', padding: 12, border: '1px solid #222', borderRadius: 4 }}>
      <div style={{ fontSize: 12, color: '#666', marginBottom: 6, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 'bold', color: '#fff' }}>{value}</div>
    </div>
  );
}

function BarGauge({ label, value, color }) {
  return (
    <div style={{ background: '#111', padding: 12, border: '1px solid #222', borderRadius: 4 }}>
      <div style={{ fontSize: 12, color: '#666', marginBottom: 8, textTransform: 'uppercase', display: 'flex', justifyContent: 'space-between' }}>
        <span>{label}</span><span>{value}%</span>
      </div>
      <div style={{ height: 8, background: '#222', width: '100%', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ height: '100%', background: color, width: `${value}%`, transition: 'width 0.1s linear' }} />
      </div>
    </div>
  );
}
// ```</Routes></BrowserRouter>