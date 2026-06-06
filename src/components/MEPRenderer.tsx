'use client';
import type { FloorPlan } from '@/types';

type MEPType = 'electrical' | 'plumbing' | 'structural';

interface Props {
  plan: FloorPlan;
  type: MEPType;
}

const UNIT_PX = 28;

export default function MEPRenderer({ plan, type }: Props) {
  const maxX = Math.max(...plan.rooms.map(r => r.x + r.width)) + 2;
  const maxY = Math.max(...plan.rooms.map(r => r.y + r.height)) + 2;
  const BORDER = 40;
  const svgW = maxX * UNIT_PX;
  const svgH = maxY * UNIT_PX;

  const getTypeConfig = () => {
    switch (type) {
      case 'electrical':
        return { bg: '#eff6ff', lineColor: '#2563eb', symbolColor: '#1d4ed8', label: 'ELECTRICAL PLAN', warning: 'For Electrical Engineer Review Only' };
      case 'plumbing':
        return { bg: '#f0fdf4', lineColor: '#16a34a', symbolColor: '#15803d', label: 'PLUMBING PLAN', warning: 'For Plumbing Engineer Review Only' };
      case 'structural':
        return { bg: '#fff7ed', lineColor: '#ea580c', symbolColor: '#c2410c', label: 'STRUCTURAL PLAN', warning: 'For Structural Engineer Review Only' };
    }
  };

  const cfg = getTypeConfig();

  return (
    <div>
      <div style={{
        display: 'inline-block',
        padding: '6px 14px', marginBottom: 16,
        backgroundColor: '#fef3c7', borderRadius: 4,
        fontSize: 12, color: '#92400e',
        border: '1px solid #fde68a',
      }}>
        ⚠ {cfg.warning}
      </div>

      <div style={{ overflowX: 'auto' }}>
        <svg
          width={svgW + BORDER * 2}
          height={svgH + BORDER * 2 + 20}
          viewBox={`0 0 ${svgW + BORDER * 2} ${svgH + BORDER * 2 + 20}`}
          style={{ display: 'block', border: '1px solid var(--line)', borderRadius: 4 }}
        >
          <rect width={svgW + BORDER * 2} height={svgH + BORDER * 2 + 20} fill={cfg.bg}/>

          {/* Grid */}
          {Array.from({ length: maxX + 2 }).map((_, i) => (
            <line key={`vg${i}`} x1={BORDER + i * UNIT_PX} y1={BORDER / 2} x2={BORDER + i * UNIT_PX} y2={svgH + BORDER * 1.5} stroke="rgba(0,0,0,0.05)" strokeWidth="0.5"/>
          ))}
          {Array.from({ length: maxY + 2 }).map((_, i) => (
            <line key={`hg${i}`} x1={BORDER / 2} y1={BORDER + i * UNIT_PX} x2={svgW + BORDER * 1.5} y2={BORDER + i * UNIT_PX} stroke="rgba(0,0,0,0.05)" strokeWidth="0.5"/>
          ))}

          {/* Room outlines */}
          {plan.rooms.map(room => {
            const rx = BORDER + room.x * UNIT_PX;
            const ry = BORDER + room.y * UNIT_PX;
            const rw = room.width * UNIT_PX;
            const rh = room.height * UNIT_PX;
            return (
              <g key={room.id}>
                <rect x={rx} y={ry} width={rw} height={rh} fill="white" stroke="rgba(0,0,0,0.2)" strokeWidth="1" opacity="0.6"/>
                {rw > 30 && rh > 20 && (
                  <text x={rx + rw / 2} y={ry + 10} textAnchor="middle" fontSize="6" fill="rgba(0,0,0,0.35)" fontFamily="monospace">
                    {room.name.toUpperCase()}
                  </text>
                )}

                {/* MEP symbols */}
                {type === 'electrical' && (
                  <>
                    {/* Light fixture */}
                    <circle cx={rx + rw / 2} cy={ry + rh / 2} r="5" fill="none" stroke={cfg.symbolColor} strokeWidth="1.5"/>
                    <line x1={rx + rw / 2 - 5} y1={ry + rh / 2} x2={rx + rw / 2 + 5} y2={ry + rh / 2} stroke={cfg.symbolColor} strokeWidth="1"/>
                    <line x1={rx + rw / 2} y1={ry + rh / 2 - 5} x2={rx + rw / 2} y2={ry + rh / 2 + 5} stroke={cfg.symbolColor} strokeWidth="1"/>

                    {/* Switch */}
                    {rw > 30 && (
                      <g transform={`translate(${rx + 8}, ${ry + rh - 12})`}>
                        <line x1="0" y1="0" x2="0" y2="-8" stroke={cfg.symbolColor} strokeWidth="1.5"/>
                        <line x1="-4" y1="-8" x2="4" y2="-8" stroke={cfg.symbolColor} strokeWidth="1"/>
                        <text x="6" y="0" fontSize="5" fill={cfg.symbolColor} fontFamily="monospace">SW</text>
                      </g>
                    )}

                    {/* Socket */}
                    {rw > 50 && (
                      <g transform={`translate(${rx + rw - 12}, ${ry + rh / 2})`}>
                        <circle cx="0" cy="0" r="5" fill="none" stroke={cfg.symbolColor} strokeWidth="1"/>
                        <circle cx="-2" cy="-2" r="1" fill={cfg.symbolColor}/>
                        <circle cx="2" cy="-2" r="1" fill={cfg.symbolColor}/>
                      </g>
                    )}

                    {/* Wiring lines */}
                    <line
                      x1={rx + rw / 2} y1={ry + rh / 2}
                      x2={rx + 8} y2={ry + rh - 12}
                      stroke={cfg.lineColor} strokeWidth="0.7" strokeDasharray="4 3" opacity="0.5"
                    />
                  </>
                )}

                {type === 'plumbing' && (room.type === 'kitchen' || room.type === 'bathroom') && (
                  <>
                    {/* Water inlet */}
                    <circle cx={rx + 10} cy={ry + 10} r="4" fill={cfg.symbolColor} opacity="0.6"/>
                    <text x={rx + 10} y={ry + 10} textAnchor="middle" dominantBaseline="middle" fontSize="5" fill="white" fontFamily="monospace">W</text>
                    {/* Drain */}
                    <circle cx={rx + rw - 10} cy={ry + rh - 10} r="4" fill="none" stroke={cfg.symbolColor} strokeWidth="1.5"/>
                    <circle cx={rx + rw - 10} cy={ry + rh - 10} r="2" fill={cfg.symbolColor} opacity="0.5"/>
                    {/* Supply line */}
                    <line x1={rx + 10} y1={ry + 10} x2={rx + rw - 10} y2={ry + rh - 10} stroke={cfg.lineColor} strokeWidth="1" strokeDasharray="3 3" opacity="0.5"/>
                  </>
                )}

                {type === 'structural' && (room.type !== 'corridor' && room.type !== 'staircase') && (
                  <>
                    {/* Column marks at corners */}
                    {[[rx, ry], [rx + rw, ry], [rx, ry + rh], [rx + rw, ry + rh]].map(([cx, cy], ci) => (
                      <rect key={ci} x={cx - 5} y={cy - 5} width={10} height={10} fill={cfg.symbolColor} opacity="0.6"/>
                    ))}
                    {/* Beam lines */}
                    <line x1={rx} y1={ry + rh / 2} x2={rx + rw} y2={ry + rh / 2} stroke={cfg.lineColor} strokeWidth="1" opacity="0.3"/>
                    <line x1={rx + rw / 2} y1={ry} x2={rx + rw / 2} y2={ry + rh} stroke={cfg.lineColor} strokeWidth="1" opacity="0.3"/>
                  </>
                )}
              </g>
            );
          })}

          {/* Legend */}
          <g transform={`translate(${BORDER}, ${svgH + BORDER * 1.6})`}>
            {type === 'electrical' && (
              <>
                <circle cx="0" cy="0" r="4" fill="none" stroke={cfg.symbolColor} strokeWidth="1.5"/>
                <line x1="-4" y1="0" x2="4" y2="0" stroke={cfg.symbolColor} strokeWidth="1"/>
                <line x1="0" y1="-4" x2="0" y2="4" stroke={cfg.symbolColor} strokeWidth="1"/>
                <text x="10" y="4" fontSize="7" fill={cfg.symbolColor} fontFamily="monospace">Light</text>
                <circle cx="60" cy="0" r="4" fill="none" stroke={cfg.symbolColor} strokeWidth="1"/>
                <circle cx="58" cy="-2" r="1" fill={cfg.symbolColor}/>
                <circle cx="62" cy="-2" r="1" fill={cfg.symbolColor}/>
                <text x="70" y="4" fontSize="7" fill={cfg.symbolColor} fontFamily="monospace">Socket</text>
              </>
            )}
            {type === 'plumbing' && (
              <>
                <circle cx="0" cy="0" r="4" fill={cfg.symbolColor} opacity="0.6"/>
                <text x="8" y="4" fontSize="7" fill={cfg.symbolColor} fontFamily="monospace">Water Inlet</text>
                <circle cx="80" cy="0" r="4" fill="none" stroke={cfg.symbolColor} strokeWidth="1.5"/>
                <circle cx="80" cy="0" r="2" fill={cfg.symbolColor} opacity="0.5"/>
                <text x="88" y="4" fontSize="7" fill={cfg.symbolColor} fontFamily="monospace">Drain</text>
              </>
            )}
            {type === 'structural' && (
              <>
                <rect x="-5" y="-5" width="10" height="10" fill={cfg.symbolColor} opacity="0.6"/>
                <text x="10" y="4" fontSize="7" fill={cfg.symbolColor} fontFamily="monospace">Column (RCC)</text>
                <line x1="80" y1="0" x2="120" y2="0" stroke={cfg.lineColor} strokeWidth="1"/>
                <text x="125" y="4" fontSize="7" fill={cfg.symbolColor} fontFamily="monospace">Beam</text>
              </>
            )}
          </g>

          {/* Title block */}
          <text x={svgW + BORDER} y={BORDER} textAnchor="end" fontSize="8" fill="rgba(0,0,0,0.3)" fontFamily="monospace" letterSpacing="0.05em">
            {cfg.label} — FLOOR {plan.floor === 0 ? 'GF' : `F${plan.floor}`}
          </text>
        </svg>
      </div>
    </div>
  );
}
