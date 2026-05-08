//Aranav Contribution
import React, { useState, useEffect, useMemo } from 'react';

// Color codes for the three F1 sectors
// S1 = Red, S2 = Cyan, S3 = Yellow
const SECTOR_COLORS = ['#FF4757', '#26C6DA', '#FFD93D'];

export default function TrackMap({ positions, drivers, selectedDriver, onSelectDriver, year, race }) {
  // Store circuit layout data and any load errors
  const [circuit, setCircuit] = useState(null);
  const [error, setError] = useState(null);

  // Fetch circuit data when year or race changes
  useEffect(() => {
    if (!year || !race) return;
    setCircuit(null);
    fetch(`http://localhost:8000/api/historic/${year}/${race}/circuit`)
      .then(r => r.ok ? r.json() : Promise.reject(r.statusText))
      .then(j => setCircuit(j.data))
      .catch(e => setError(String(e)));
  }, [year, race]);

  // Rotate coordinates 90° clockwise to fit landscape orientation
  const rotate = (x, y) => ({ rx: y, ry: -x });

  // Compute track SVG paths, viewBox, and scaling based on circuit data
  const { sectorPaths, viewBox, mapWidth } = useMemo(() => {
    if (!circuit) return { sectorPaths: null, viewBox: '0 0 1 1', mapWidth: 1 };
    
    // Rotate all track points to landscape orientation
    const pts = circuit.points.map(p => rotate(p.x, p.y));
    const [s1, s2] = circuit.sector_breaks;

    // Helper to generate SVG path segment for a range of points
    const slice = (a, b) => pts.slice(a, b + 1).map((p, i) =>
      `${i === 0 ? 'M' : 'L'} ${p.rx} ${p.ry}`).join(' ');

    // Create path for each sector, closing the loop at the end
    const paths = [
      slice(0, s1),
      slice(s1, s2),
      slice(s2, pts.length - 1) + ` L ${pts[0].rx} ${pts[0].ry}`,
    ];

    // Calculate bounding box and add padding for viewBox
    const xs = pts.map(p => p.rx), ys = pts.map(p => p.ry);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const w = maxX - minX, h = maxY - minY;
    const padX = w * 0.08, padY = h * 0.08;
    return {
      sectorPaths: paths,
      viewBox: `${minX - padX} ${minY - padY} ${w + 2 * padX} ${h + 2 * padY}`,
      mapWidth: w,
    };
  }, [circuit]);

  // Show error or loading state
  if (error) return <Centered>Track load failed: {error}</Centered>;
  if (!circuit) return <Centered>Loading track...</Centered>;

  // Scale stroke width and car size based on track width for responsive design
  const trackStrokeW = mapWidth * 0.012;
  const carRadius = mapWidth * 0.014;

  return (
    <div style={{ flex: 1, backgroundColor: '#111', display: 'flex', overflow: 'hidden' }}>
      <svg viewBox={viewBox} preserveAspectRatio="xMidYMid meet" style={{ width: '100%', height: '100%' }}>
        {/* Render dark background track layer */}
        {sectorPaths.map((d, i) => (
          <path key={`base-${i}`} d={d} fill="none" stroke="#222" strokeWidth={trackStrokeW * 1.4}
                strokeLinejoin="round" strokeLinecap="round" />
        ))}
        
        {/* Overlay colored sector paths (red, cyan, yellow) */}
        {sectorPaths.map((d, i) => (
          <path key={`s-${i}`} d={d} fill="none" stroke={SECTOR_COLORS[i]}
                strokeWidth={trackStrokeW} strokeOpacity={0.55}
                strokeLinejoin="round" strokeLinecap="round" />
        ))}
        
        {/* Render corner labels and numbers */}
        {circuit.corners.map(c => {
          const { rx, ry } = rotate(c.x, c.y);
          return (
            <text key={c.number} x={rx} y={ry} fill="#888" fontSize={mapWidth * 0.018}
                  textAnchor="middle" dominantBaseline="middle">
              {c.number}{c.letter}
            </text>
          );
        })}
        
        {/* Render driver cars on track - clickable to select */}
        {Object.values(positions).map(pos => {
          const drv = drivers[pos.driver_number];
          const color = drv?.team_color || '#fff';
          const sel = String(selectedDriver) === String(pos.driver_number);
          const r = sel ? carRadius * 1.8 : carRadius;
          const { rx, ry } = rotate(pos.x, pos.y);
          return (
            <g key={pos.driver_number} transform={`translate(${rx}, ${ry})`}
               onClick={() => onSelectDriver(pos.driver_number)} style={{ cursor: 'pointer' }}>
              {/* Car circle with team color */}
              <circle r={r} fill={color} stroke={sel ? '#fff' : '#000'} strokeWidth={r * 0.2} />
              {/* Driver number label */}
              <text y={r * 2.4} fill={sel ? '#fff' : '#aaa'} fontSize={mapWidth * 0.025}
                    textAnchor="middle" fontWeight={sel ? 'bold' : 'normal'}>
                {pos.driver_number}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// Centered layout component for loading/error messages
const Centered = ({ children }) => (
  <div style={{ flex: 1, backgroundColor: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <p style={{ color: '#888' }}>{children}</p>
  </div>
);