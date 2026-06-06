'use client';
import type { ProjectRequirements } from '@/types';

interface Props {
  req: ProjectRequirements;
}

export default function ElevationRenderer({ req }: Props) {
  const floorH = 80;
  const totalH = req.floors * floorH;
  const w = 400;
  const pad = 40;
  const svgH = totalH + pad * 2 + 40;

  const getStyleColors = () => {
    switch (req.style) {
      case 'modern': return { wall: '#f0f4f8', accent: '#1a2744', window: '#b8d4f0' };
      case 'contemporary': return { wall: '#f5f0e8', accent: '#c8853a', window: '#d0e8f0' };
      case 'traditional': return { wall: '#f8e8d0', accent: '#8b4513', window: '#a0c8e0' };
      case 'mediterranean': return { wall: '#fff4e0', accent: '#e8654a', window: '#c0d8a0' };
      case 'minimalist': return { wall: '#f8f8f8', accent: '#333', window: '#e0f0f8' };
      default: return { wall: '#f0f4f8', accent: '#1a2744', window: '#b8d4f0' };
    }
  };

  const colors = getStyleColors();

  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
        {['Front Elevation', 'Rear Elevation', 'Left Elevation', 'Right Elevation'].map((name, ei) => (
          <div key={ei}>
            <p style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--steel)', marginBottom: 8, letterSpacing: '0.08em' }}>{name.toUpperCase()}</p>
            <svg width={w + pad * 2} height={svgH} viewBox={`0 0 ${w + pad * 2} ${svgH}`} style={{ border: '1px solid var(--line)', borderRadius: 4, backgroundColor: 'white' }}>
              {/* Sky */}
              <defs>
                <linearGradient id={`sky${ei}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#e8f4fc"/>
                  <stop offset="100%" stopColor="#f5f8fa"/>
                </linearGradient>
              </defs>
              <rect width={w + pad * 2} height={svgH} fill={`url(#sky${ei})`}/>

              {/* Ground */}
              <rect x={0} y={svgH - 20} width={w + pad * 2} height={20} fill="#8a9e7a" opacity="0.3"/>
              <line x1={0} y1={svgH - 20} x2={w + pad * 2} y2={svgH - 20} stroke="#5a7a4a" strokeWidth="1.5"/>

              {/* Building body */}
              <rect x={pad} y={pad} width={w} height={totalH} fill={colors.wall} stroke={colors.accent} strokeWidth="1.5"/>

              {/* Floor separation lines */}
              {Array.from({ length: req.floors - 1 }).map((_, fi) => (
                <line
                  key={fi}
                  x1={pad} y1={pad + (fi + 1) * floorH}
                  x2={pad + w} y2={pad + (fi + 1) * floorH}
                  stroke={colors.accent} strokeWidth="0.5" strokeDasharray="4 4" opacity="0.3"
                />
              ))}

              {/* Windows per floor */}
              {Array.from({ length: req.floors }).map((_, fi) => {
                const floorY = pad + fi * floorH;
                const isGround = fi === req.floors - 1;
                return (
                  <g key={fi}>
                    {/* Windows */}
                    {[0.15, 0.4, 0.65, 0.85].map((xp, wi) => {
                      if (isGround && wi === 2) {
                        // Main door
                        return (
                          <g key={wi}>
                            <rect x={pad + w * xp} y={floorY + 20} width={40} height={55} fill={colors.accent} opacity="0.5" rx="3" ry="3"/>
                            <rect x={pad + w * xp + 5} y={floorY + 25} width={14} height={45} fill={colors.window} opacity="0.8" rx="1" ry="1"/>
                            <rect x={pad + w * xp + 21} y={floorY + 25} width={14} height={45} fill={colors.window} opacity="0.8" rx="1" ry="1"/>
                          </g>
                        );
                      }
                      return (
                        <g key={wi}>
                          <rect x={pad + w * xp - 5} y={floorY + 15} width={36} height={28} fill={colors.window} stroke={colors.accent} strokeWidth="0.8" rx="2" ry="2"/>
                          <line x1={pad + w * xp + 13} y1={floorY + 15} x2={pad + w * xp + 13} y2={floorY + 43} stroke={colors.accent} strokeWidth="0.5"/>
                          <line x1={pad + w * xp - 5} y1={floorY + 29} x2={pad + w * xp + 31} y2={floorY + 29} stroke={colors.accent} strokeWidth="0.5"/>
                        </g>
                      );
                    })}
                  </g>
                );
              })}

              {/* Roof / Parapet */}
              {req.style === 'modern' || req.style === 'minimalist' ? (
                // Flat roof with parapet
                <>
                  <rect x={pad - 8} y={pad - 12} width={w + 16} height={12} fill={colors.accent} opacity="0.7"/>
                  <line x1={pad - 8} y1={pad} x2={pad + w + 8} y2={pad} stroke={colors.accent} strokeWidth="1.5"/>
                </>
              ) : (
                // Sloped roof
                <>
                  <polygon
                    points={`${pad - 10},${pad} ${pad + w + 10},${pad} ${pad + w / 2},${pad - 50}`}
                    fill={colors.accent} opacity="0.6"
                  />
                  <line x1={pad - 10} y1={pad} x2={pad + w + 10} y2={pad} stroke={colors.accent} strokeWidth="1.5"/>
                </>
              )}

              {/* Balcony on upper floors */}
              {req.floors > 1 && (
                <g>
                  <rect x={pad + w * 0.6} y={pad + floorH - 8} width={w * 0.35} height={8} fill={colors.accent} opacity="0.5"/>
                  {[0, 1, 2, 3, 4].map(i => (
                    <line
                      key={i}
                      x1={pad + w * 0.6 + i * (w * 0.35 / 4)} y1={pad + floorH - 8}
                      x2={pad + w * 0.6 + i * (w * 0.35 / 4)} y2={pad + floorH + 8}
                      stroke={colors.accent} strokeWidth="0.8" opacity="0.6"
                    />
                  ))}
                  <line x1={pad + w * 0.6} y1={pad + floorH} x2={pad + w * 0.95} y2={pad + floorH} stroke={colors.accent} strokeWidth="0.8" opacity="0.6"/>
                </g>
              )}

              {/* Dimension marks */}
              <line x1={pad} y1={svgH - 10} x2={pad + w} y2={svgH - 10} stroke="#c8853a" strokeWidth="0.8"/>
              <text x={pad + w / 2} y={svgH - 2} textAnchor="middle" fontSize="7" fill="#c8853a" fontFamily="monospace">
                {req.plotWidth} FT
              </text>

              {/* Height dimension */}
              <line x1={10} y1={pad} x2={10} y2={pad + totalH} stroke="#c8853a" strokeWidth="0.8"/>
              <text x={7} y={pad + totalH / 2} textAnchor="middle" fontSize="7" fill="#c8853a" fontFamily="monospace"
                transform={`rotate(-90, 7, ${pad + totalH / 2})`}>
                {(req.floors * 10).toFixed(0)} FT
              </text>

              {/* Label */}
              <text x={pad + 8} y={pad + totalH - 8} fontSize="8" fill={colors.accent} opacity="0.5" fontFamily="monospace" letterSpacing="0.05em">
                {req.style.toUpperCase()} — {req.floors === 1 ? 'G' : `G+${req.floors - 1}`}
              </text>
            </svg>
          </div>
        ))}
      </div>
    </div>
  );
}
