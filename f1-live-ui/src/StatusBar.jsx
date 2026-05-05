import React from 'react';

const FLAG_COLORS = {
  AllClear: '#26C246', Yellow: '#FFD93D',
  SCDeployed: '#FFA500', VSCDeployed: '#FFA500',
  VSCEnding: '#FFD93D', Red: '#E80020', Unknown: '#888',
};

const FLAG_LABELS = {
  AllClear: 'GREEN', Yellow: 'YELLOW',
  SCDeployed: 'SAFETY CAR', VSCDeployed: 'VSC',
  VSCEnding: 'VSC ENDING', Red: 'RED', Unknown: '—',
};

export default function StatusBar({ session, weather, trackStatus }) {
  const flag = trackStatus?.status || 'AllClear';
  const flagColor = FLAG_COLORS[flag] || '#888';
  const lap = session?.current_lap ?? 0;
  const totalLaps = session?.total_laps ?? '-';

  const cell = { padding: '4px 12px', borderRight: '1px solid #222', fontSize: 12 };

  return (
    <div style={{ display: 'flex', alignItems: 'center', background: '#0a0a0a',
                  borderBottom: '1px solid #333', height: 36, flexShrink: 0 }}>
      <div style={{ ...cell, color: flagColor, fontWeight: 'bold', minWidth: 140 }}>
        ● {FLAG_LABELS[flag]}
      </div>
      <div style={cell}>
        LAP <strong style={{ color: '#fff' }}>{lap}</strong>
        <span style={{ color: '#666' }}> / {totalLaps}</span>
      </div>
      {weather && (
        <>
          <div style={cell}>AIR <strong style={{ color: '#fff' }}>{weather.air_temp?.toFixed(1)}°C</strong></div>
          <div style={cell}>TRACK <strong style={{ color: '#fff' }}>{weather.track_temp?.toFixed(1)}°C</strong></div>
          <div style={cell}>WIND <strong style={{ color: '#fff' }}>{weather.wind_speed?.toFixed(1)}m/s</strong></div>
          <div style={cell}>HUMIDITY <strong style={{ color: '#fff' }}>{weather.humidity?.toFixed(0)}%</strong></div>
          {weather.rainfall && <div style={{ ...cell, color: '#2196F3' }}>RAIN</div>}
        </>
      )}
      {trackStatus?.message && (
        <div style={{ ...cell, color: '#888', flex: 1, textAlign: 'right' }}>{trackStatus.message}</div>
      )}
    </div>
  );
}