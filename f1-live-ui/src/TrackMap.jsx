import React, { useState, useEffect, useMemo } from 'react';

const SECTOR_COLORS = ['#FF4757', '#26C6DA', '#FFD93D'];  // S1 / S2 / S3

export default function TrackMap({ positions, drivers, selectedDriver, onSelectDriver, year, race }) {
  const [circuit, setCircuit] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!year || !race) return;
    setCircuit(null);
    fetch(`http://localhost:8000/api/historic/${year}/${race}/circuit`)
      .then(r => r.ok ? r.json() : Promise.reject(r.statusText))
      .then(j => setCircuit(j.data))
      .catch(e => setError(String(e)));
  }, [year, race]);

  // rotate 90° to fit landscape — same swap-and-negate trick as before
  const rotate = (x, y) => ({ rx: y, ry: -x });

  const { sectorPaths, viewBox, mapWidth } = useMemo(() => {
    if (!circuit) return { sectorPaths: null, viewBox: '0 0 1 1', mapWidth: 1 };
    const pts = circuit.points.map(p => rotate(p.x, p.y));
    const [s1, s2] = circuit.sector_breaks;

    const slice = (a, b) => pts.slice(a, b + 1).map((p, i) =>
      `${i === 0 ? 'M' : 'L'} ${p.rx} ${p.ry}`).join(' ');

    const paths = [
      slice(0, s1),
      slice(s1, s2),
      slice(s2, pts.length - 1) + ` L ${pts[0].rx} ${pts[0].ry}`,  // close loop
    ];

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

  if (error) return <Centered>Track load failed: {error}</Centered>;
  if (!circuit) return <Centered>Loading track...</Centered>;

  const trackStrokeW = mapWidth * 0.012;
  const carRadius = mapWidth * 0.014;

  return (
    <div style={{ flex: 1, backgroundColor: '#111', display: 'flex', overflow: 'hidden' }}>
      <svg viewBox={viewBox} preserveAspectRatio="xMidYMid meet" style={{ width: '100%', height: '100%' }}>
        {/* dim base */}
        {sectorPaths.map((d, i) => (
          <path key={`base-${i}`} d={d} fill="none" stroke="#222" strokeWidth={trackStrokeW * 1.4}
                strokeLinejoin="round" strokeLinecap="round" />
        ))}
        {/* sector colored overlay */}
        {sectorPaths.map((d, i) => (
          <path key={`s-${i}`} d={d} fill="none" stroke={SECTOR_COLORS[i]}
                strokeWidth={trackStrokeW} strokeOpacity={0.55}
                strokeLinejoin="round" strokeLinecap="round" />
        ))}
        {/* corner numbers */}
        {circuit.corners.map(c => {
          const { rx, ry } = rotate(c.x, c.y);
          return (
            <text key={c.number} x={rx} y={ry} fill="#888" fontSize={mapWidth * 0.018}
                  textAnchor="middle" dominantBaseline="middle">
              {c.number}{c.letter}
            </text>
          );
        })}
        {/* cars */}
        {Object.values(positions).map(pos => {
          const drv = drivers[pos.driver_number];
          const color = drv?.team_color || '#fff';
          const sel = String(selectedDriver) === String(pos.driver_number);
          const r = sel ? carRadius * 1.8 : carRadius;
          const { rx, ry } = rotate(pos.x, pos.y);
          return (
            <g key={pos.driver_number} transform={`translate(${rx}, ${ry})`}
               onClick={() => onSelectDriver(pos.driver_number)} style={{ cursor: 'pointer' }}>
              <circle r={r} fill={color} stroke={sel ? '#fff' : '#000'} strokeWidth={r * 0.2} />
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

const Centered = ({ children }) => (
  <div style={{ flex: 1, backgroundColor: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <p style={{ color: '#888' }}>{children}</p>
  </div>
);