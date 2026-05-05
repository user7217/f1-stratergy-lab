import React, { useState } from 'react';
import { useLiveF1 } from './useLiveF1';
import TrackMap from './TrackMap';

// Helper to assign official Pirelli colors to tyre compounds
const getTyreColor = (compound) => {
  if (!compound) return '#555';
  const c = compound.toLowerCase();
  if (c.includes('soft')) return '#ff3333'; // Red
  if (c.includes('medium')) return '#ffeb3b'; // Yellow
  if (c.includes('hard')) return '#ffffff'; // White
  if (c.includes('intermediate')) return '#4caf50'; // Green
  if (c.includes('wet')) return '#2196f3'; // Blue
  return '#888';
};

export default function App() {
  const state = useLiveF1();
  const [selectedDriver, setSelectedDriver] = useState(null);

  const [replayYear, setReplayYear] = useState(2024);
  const [replayRace, setReplayRace] = useState('Bahrain');
  const [replaySession, setReplaySession] = useState('R');
  const [replaySpeed, setReplaySpeed] = useState(10); 

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
          start_at: 0 
        })
      });
    } catch (err) {
      console.error("Failed to start replay:", err);
    }
  };

  const selectedKey = selectedDriver !== null ? String(selectedDriver) : null;
  const activeTelemetry = selectedKey && state.telemetry ? state.telemetry[selectedKey] : null;
  // Pull timing data for tyres and lap times
  const activeTiming = selectedKey && state.timing ? state.timing[selectedKey] : null;

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', fontFamily: 'monospace', backgroundColor: '#000', color: '#EEE' }}>
      
      {/* LEFT SIDEBAR: Controls & Grid */}
      <div style={{ width: '280px', borderRight: '1px solid #333', overflowY: 'auto', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        
        {/* Configuration Panel */}
        <div style={{ padding: '15px', borderBottom: '1px solid #333', background: '#0a0a0a' }}>
          <h2 style={{ marginBottom: '15px', color: '#aaa', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px' }}>Session Config</h2>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '15px' }}>
            <div>
              <label style={{ fontSize: '12px', color: '#888', display: 'block', marginBottom: '4px' }}>Year</label>
              <input type="number" value={replayYear} onChange={(e) => setReplayYear(e.target.value)} style={{ width: '100%', background: '#1a1a1a', color: '#fff', border: '1px solid #333', padding: '6px', fontFamily: 'inherit' }} />
            </div>
            <div>
              <label style={{ fontSize: '12px', color: '#888', display: 'block', marginBottom: '4px' }}>Race</label>
              <input type="text" value={replayRace} onChange={(e) => setReplayRace(e.target.value)} style={{ width: '100%', background: '#1a1a1a', color: '#fff', border: '1px solid #333', padding: '6px', fontFamily: 'inherit' }} />
            </div>
            <div>
              <label style={{ fontSize: '12px', color: '#888', display: 'block', marginBottom: '4px' }}>Session</label>
              <select value={replaySession} onChange={(e) => setReplaySession(e.target.value)} style={{ width: '100%', background: '#1a1a1a', color: '#fff', border: '1px solid #333', padding: '6px', fontFamily: 'inherit' }}>
                <option value="R">Race (R)</option>
                <option value="Q">Qualifying (Q)</option>
                <option value="S">Sprint (S)</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '12px', color: '#888', display: 'block', marginBottom: '4px' }}>Speed Multiplier</label>
              <input type="number" step="0.5" value={replaySpeed} onChange={(e) => setReplaySpeed(e.target.value)} style={{ width: '100%', background: '#1a1a1a', color: '#fff', border: '1px solid #333', padding: '6px', fontFamily: 'inherit' }} />
            </div>
          </div>

          <button onClick={handleStartSimulation} style={{ width: '100%', padding: '10px', background: '#E80020', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 'bold', letterSpacing: '1px', borderRadius: '2px' }}>
            LOAD & START
          </button>
        </div>

        {/* Driver Grid List */}
        <h2 style={{ padding: '15px 15px 5px 15px', color: '#aaa', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px' }}>Grid</h2>
        {Object.values(state.drivers).map(driver => {
          // Find their position if timing data exists
          const timingInfo = state.timing && state.timing[String(driver.number)];
          const pos = timingInfo ? timingInfo.position : '-';

          return (
            <div 
              key={driver.number}
              onClick={() => setSelectedDriver(driver.number)}
              style={{ 
                padding: '10px 15px', cursor: 'pointer',
                borderLeft: selectedDriver === driver.number ? `4px solid ${driver.team_color}` : '4px solid transparent',
                backgroundColor: selectedDriver === driver.number ? '#1a1a1a' : 'transparent',
                display: 'flex', alignItems: 'center', gap: '12px', transition: 'background-color 0.2s'
              }}
            >
              <span style={{ width: '20px', color: '#666', fontSize: '12px' }}>P{pos}</span>
              <span style={{ width: '24px', color: driver.team_color, fontWeight: 'bold', textAlign: 'right' }}>{driver.number}</span>
              <span>{driver.abbreviation}</span>
            </div>
          );
        })}
      </div>

      {/* CENTER: Track Map Canvas */}
      <TrackMap 
        positions={state.positions} 
        drivers={state.drivers}
        selectedDriver={selectedDriver}
        onSelectDriver={setSelectedDriver}
      />

      {/* RIGHT SIDEBAR: Telemetry & Timing Panel */}
      <div style={{ width: '300px', borderLeft: '1px solid #333', padding: '20px', background: '#0a0a0a', flexShrink: 0, overflowY: 'auto' }}>
        
        {/* TIMING & TYRE BLOCK */}
        {activeTiming && (
          <div style={{ marginBottom: '30px' }}>
            <h2 style={{ marginBottom: '15px', color: '#aaa', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px' }}>Timing & Tyres</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              
              <div style={{ background: '#111', padding: '12px', border: `1px solid ${getTyreColor(activeTiming.compound)}`, borderRadius: '4px', borderLeftWidth: '4px' }}>
                <div style={{ fontSize: '12px', color: '#666', marginBottom: '6px', textTransform: 'uppercase' }}>Compound & Age</div>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#fff', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: getTyreColor(activeTiming.compound) }}>{activeTiming.compound || 'Unknown'}</span>
                  <span>{activeTiming.tyre_age !== null ? `${activeTiming.tyre_age} Laps` : '-'}</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <MetricBox label="Last Lap" value={activeTiming.last_lap_time || '-'} flex={1} />
                <MetricBox label="Gap" value={activeTiming.interval || '-'} flex={1} />
              </div>

            </div>
          </div>
        )}

        {/* TELEMETRY BLOCK */}
        <h2 style={{ marginBottom: '15px', color: '#aaa', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px' }}>Telemetry</h2>
        {activeTelemetry ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div style={{ display: 'flex', gap: '10px' }}>
              <MetricBox label="Speed" value={`${activeTelemetry.speed} km/h`} flex={1} />
              <MetricBox label="Gear" value={activeTelemetry.gear} flex={1} />
            </div>
            
            <MetricBox label="RPM" value={activeTelemetry.rpm} />
            
            <BarGauge label="Throttle" value={activeTelemetry.throttle} color="#4caf50" />
            <BarGauge label="Brake" value={activeTelemetry.brake} color="#f44336" />
            
            <MetricBox label="DRS" value={activeTelemetry.drs >= 10 ? 'OPEN' : 'CLOSED'} />
          </div>
        ) : selectedDriver ? (
          <div style={{ marginTop: '10px', padding: '15px', background: '#332b00', border: '1px solid #ffcc00', borderRadius: '4px' }}>
            <p style={{ fontWeight: 'bold', color: '#ffcc00', margin: 0 }}>⚠️ No Telemetry Signal</p>
            <p style={{ fontSize: '13px', color: '#fff', marginTop: '10px', lineHeight: '1.5', margin: '10px 0 0 0' }}>
              Car {selectedDriver} is currently not transmitting telemetry.
            </p>
          </div>
        ) : (
          <p style={{ color: '#666', marginTop: '20px', fontSize: '14px' }}>Select a driver on the track or grid.</p>
        )}
      </div>
    </div>
  );
}

// Subcomponents
function MetricBox({ label, value, flex }) {
  return (
    <div style={{ flex: flex, background: '#111', padding: '12px', border: '1px solid #222', borderRadius: '4px' }}>
      <div style={{ fontSize: '12px', color: '#666', marginBottom: '6px', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#fff' }}>{value}</div>
    </div>
  );
}

function BarGauge({ label, value, color }) {
  return (
    <div style={{ background: '#111', padding: '12px', border: '1px solid #222', borderRadius: '4px' }}>
      <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px', textTransform: 'uppercase', display: 'flex', justifyContent: 'space-between' }}>
        <span>{label}</span>
        <span>{value}%</span>
      </div>
      <div style={{ height: '8px', background: '#222', width: '100%', borderRadius: '4px', overflow: 'hidden' }}>
        <div style={{ height: '100%', background: color, width: `${value}%`, transition: 'width 0.1s linear' }} />
      </div>
    </div>
  );
}