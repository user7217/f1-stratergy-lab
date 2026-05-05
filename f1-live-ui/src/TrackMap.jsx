import React, { useState, useEffect, useRef } from 'react';

export default function TrackMap({ positions, drivers, selectedDriver, onSelectDriver }) {
  const [bounds, setBounds] = useState({ 
    minX: Infinity, maxX: -Infinity, 
    minY: Infinity, maxY: -Infinity 
  });
  
  const [trackPath, setTrackPath] = useState("");
  const tracerCarId = useRef(null);
  const lastPoint = useRef({ x: null, y: null });

  // 1. The Matrix Transformation
  // This physically rotates the coordinates 90 degrees to fit landscape monitors
  // and natively handles the SVG Y-axis inversion without CSS hacks.
  const transformCoords = (x, y) => {
    return {
      rx: y,    // Swap X and Y to rotate sideways
      ry: -x    // Invert the new Y to match standard SVG top-down drawing
    };
  };

  useEffect(() => {
    const coords = Object.values(positions);
    if (coords.length === 0) return;

    let changed = false;
    let newBounds = { ...bounds };

    coords.forEach(p => {
      // Calculate bounds using the rotated coordinates
      const { rx, ry } = transformCoords(p.x, p.y);
      if (rx < newBounds.minX) { newBounds.minX = rx; changed = true; }
      if (rx > newBounds.maxX) { newBounds.maxX = rx; changed = true; }
      if (ry < newBounds.minY) { newBounds.minY = ry; changed = true; }
      if (ry > newBounds.maxY) { newBounds.maxY = ry; changed = true; }
    });

    if (changed) setBounds(newBounds);

    if (!tracerCarId.current) {
      tracerCarId.current = coords[0].driver_number;
    }

    const tracer = positions[tracerCarId.current];
    if (tracer && tracer.x !== undefined && tracer.y !== undefined) {
      if (lastPoint.current.x !== tracer.x || lastPoint.current.y !== tracer.y) {
        const { rx, ry } = transformCoords(tracer.x, tracer.y);
        setTrackPath(prev => prev ? `${prev} L ${rx},${ry}` : `M ${rx},${ry}`);
        lastPoint.current = { x: tracer.x, y: tracer.y };
      }
    }

  }, [positions]);

  let width = bounds.maxX - bounds.minX;
  let height = bounds.maxY - bounds.minY;
  
  if (width === 0 || width === -Infinity) width = 10000;
  if (height === 0 || height === -Infinity) height = 10000;

  // 2. Padding increased to 15% to guarantee no clipping near the canvas edges
  const padX = width * 0.15;
  const padY = height * 0.15;
  
  // Standard viewBox. No negative mathematical hacks required.
  const viewBox = `${bounds.minX - padX} ${bounds.minY - padY} ${width + padX * 2} ${height + padY * 2}`;
  const mapWidth = width;

  if (bounds.minX === Infinity) {
    return (
      <div style={{ flex: 1, backgroundColor: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#888', fontSize: '18px', letterSpacing: '1px' }}>Waiting for Telemetry...</p>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, backgroundColor: '#111', display: 'flex', overflow: 'hidden' }}>
      {/* 3. Removed the transform: scaleY(-1) CSS hack */}
      <svg viewBox={viewBox} preserveAspectRatio="xMidYMid meet" style={{ width: '100%', height: '100%' }}>
        
        <path 
          d={trackPath} 
          fill="none" 
          stroke="#444" 
          strokeWidth={mapWidth * 0.003} 
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {Object.values(positions).map(pos => {
          const driverInfo = drivers[pos.driver_number];
          const color = driverInfo?.team_color || '#FFF';
          const isSelected = String(selectedDriver) === String(pos.driver_number);

          const radius = isSelected ? mapWidth * 0.025 : mapWidth * 0.012;
          const fontSize = isSelected ? mapWidth * 0.035 : mapWidth * 0.025;
          
          const { rx, ry } = transformCoords(pos.x, pos.y);

          return (
            <g key={pos.driver_number} transform={`translate(${rx}, ${ry})`} onClick={() => onSelectDriver(pos.driver_number)} style={{ cursor: 'pointer' }}>
              <circle r={radius} fill={color} stroke={isSelected ? '#FFF' : '#000'} strokeWidth={radius * 0.2} />
              
              {/* 4. Removed the scale(1, -1) hack from the text. Texts will now render right-side up natively */}
              <text y={radius * 2.5} fill={isSelected ? '#FFF' : '#AAA'} fontSize={fontSize} textAnchor="middle" fontWeight={isSelected ? 'bold' : 'normal'}>
                {pos.driver_number}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}