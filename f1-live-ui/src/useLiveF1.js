import { useState, useEffect, useRef } from 'react';

const API_BASE = 'http://localhost:8000/api';
const WS_BASE = 'ws://localhost:8000/api';

export function useLiveF1() {
  const [state, setState] = useState({
    session: {},
    drivers: {},
    timing: {},
    telemetry: {},
    positions: {}
  });
  
  const wsRef = useRef(null);

  useEffect(() => {
    let isMounted = true;

    // Fetch static baseline
    fetch(`${API_BASE}/snapshot`)
      .then(res => res.json())
      .then(snapshot => {
        if (!isMounted) return;
        setState(snapshot);
        
        // Upgrade to WS for diffs
        wsRef.current = new WebSocket(`${WS_BASE}/stream`);
        
        wsRef.current.onmessage = (event) => {
          const msg = JSON.parse(event.data);
          
          // Handle full state override from backend
          if (msg.topic === '_snapshot') {
            setState(msg.data);
            return;
          }

          // Merge partial updates into state tree
          setState(prev => ({
            ...prev,
            [msg.topic]: msg.data
          }));
        };
      })
      .catch(err => console.error("Snapshot fetch failed:", err));

    // Cleanup socket on unmount
    return () => {
      isMounted = false;
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  return state;
}