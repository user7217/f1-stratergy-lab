//Aranav Contribution
import React from 'react';

// Maps flag statuses to their corresponding colors
// Green = all clear, Yellow = caution, Orange = safety car/VSC, Red = stop
const FLAG_COLORS = {
  AllClear: '#26C246', Yellow: '#FFD93D',
  SCDeployed: '#FFA500', VSCDeployed: '#FFA500',
  VSCEnding: '#FFD93D', Red: '#E80020', Unknown: '#888',
};

// Text labels that display for each flag status
const FLAG_LABELS = {
  AllClear: 'GREEN', Yellow: 'YELLOW',
  SCDeployed: 'SAFETY CAR', VSCDeployed: 'VSC',
  VSCEnding: 'VSC ENDING', Red: 'RED', Unknown: '—',
};

export default function StatusBar({ session, weather, trackStatus }) {
  // Get current flag status, defaults to AllClear
  const flag = trackStatus?.status || 'AllClear';
  const flagColor = FLAG_COLORS[flag] || '#888';
  
  // Track current lap number and total laps in session
  const lap = session?.current_lap ?? 0;
  const totalLaps = session?.total_laps ?? '-';

  // Cell styling for status bar items
  const cell = { padding: '4px 12px', borderRight: '1px solid #222', fontSize: 12 };

  return (
    // Top status bar displaying race info
    <div style={{ display: 'flex', alignItems: 'center', background: '#0a0a0a',
                  borderBottom: '1px solid #333', height: 36, flexShrink: 0 }}>
      {/* Flag status indicator with color and label */}
      <div style={{ ...cell, color: flagColor, fontWeight: 'bold', minWidth: 140 }}>
        ● {FLAG_LABELS[flag]}
      </div>
      
      {/* Display lap counter */}
      <div style={cell}>
        LAP <strong style={{ color: '#fff' }}>{lap}</strong>
        <span style={{ color: '#666' }}> / {totalLaps}</span>
      </div>
      
      {/* Weather information display */}
      {weather && (
        <>
          <div style={cell}>AIR <strong style={{ color: '#fff' }}>{weather.air_temp?.toFixed(1)}°C</strong></div>
          <div style={cell}>TRACK <strong style={{ color: '#fff' }}>{weather.track_temp?.toFixed(1)}°C</strong></div>
          <div style={cell}>WIND <strong style={{ color: '#fff' }}>{weather.wind_speed?.toFixed(1)}m/s</strong></div>
          <div style={cell}>HUMIDITY <strong style={{ color: '#fff' }}>{weather.humidity?.toFixed(0)}%</strong></div>
          {/* Show rain indicator if rainfall is present */}
          {weather.rainfall && <div style={{ ...cell, color: '#2196F3' }}>RAIN</div>}
        </>
      )}
      
      {/* Additional track status message */}
      {trackStatus?.message && (
        <div style={{ ...cell, color: '#888', flex: 1, textAlign: 'right' }}>{trackStatus.message}</div>
      )}
    </div>
  );
}