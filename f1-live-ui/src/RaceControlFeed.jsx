import React, { useEffect, useRef } from 'react';

const FLAG_DOT = {
  YELLOW: '#FFD93D', RED: '#E80020', GREEN: '#26C246',
  BLUE: '#2196F3', CHEQUERED: '#fff', CLEAR: '#26C246',
};

export default function RaceControlFeed({ messages = [] }) {
  const ref = useRef(null);

  // newest first
  const sorted = [...messages].reverse().slice(0, 30);

  return (
    <div style={{ borderTop: '1px solid #333', padding: 15 }}>
      <h2 style={{ marginBottom: 10, color: '#aaa', fontSize: 14, textTransform: 'uppercase', letterSpacing: 1 }}>
        Race Control
      </h2>
      <div ref={ref} style={{ maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {sorted.length === 0 && <p style={{ color: '#555', fontSize: 12 }}>No messages yet.</p>}
        {sorted.map((m, i) => {
          const dot = m.flag ? FLAG_DOT[m.flag.toUpperCase()] : '#444';
          const mins = Math.floor((m.timestamp || 0) / 60);
          const secs = Math.floor((m.timestamp || 0) % 60).toString().padStart(2, '0');
          return (
            <div key={i} style={{ display: 'flex', gap: 8, fontSize: 11, padding: '4px 0', borderBottom: '1px solid #1a1a1a' }}>
              <span style={{ color: '#666', minWidth: 38 }}>{mins}:{secs}</span>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: dot, marginTop: 4, flexShrink: 0 }} />
              <span style={{ color: '#ddd', lineHeight: 1.3 }}>{m.message}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}