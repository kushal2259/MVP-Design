'use client';
import { useState } from 'react';
import type { FloorPlan, Room, FurnitureItem } from '@/types';

const UNIT_PX = 40;
const WALL = 3; // wall stroke width

const FLOOR_NAMES = ['GROUND FLOOR', 'FIRST FLOOR', 'SECOND FLOOR', 'THIRD FLOOR', 'TERRACE FLOOR'];

interface Props {
  plan: FloorPlan;
  scale?: number;
  showFurniture?: boolean;
}

function DoorArc({ rx, ry, rw, rh }: { rx: number; ry: number; rw: number; rh: number }) {
  const size = Math.min(22, rw * 0.35, rh * 0.35);
  return (
    <g>
      <line x1={rx + 6} y1={ry + rh - WALL} x2={rx + 6} y2={ry + rh - WALL - size} stroke="#1a2744" strokeWidth="1.2" />
      <path
        d={`M ${rx + 6},${ry + rh - WALL - size} A ${size},${size} 0 0,1 ${rx + 6 + size},${ry + rh - WALL}`}
        fill="rgba(26,39,68,0.06)" stroke="#1a2744" strokeWidth="0.8"
      />
    </g>
  );
}

function WindowMark({ rx, ry, rw }: { rx: number; ry: number; rw: number }) {
  const wStart = rx + rw * 0.28;
  const wEnd = rx + rw * 0.72;
  return (
    <g>
      <rect x={wStart} y={ry - 2} width={wEnd - wStart} height={6} fill="white" stroke="#4a72c4" strokeWidth="0.5" />
      <line x1={wStart} y1={ry + 1} x2={wEnd} y2={ry + 1} stroke="#4a72c4" strokeWidth="1.5" />
    </g>
  );
}

function FurnitureOverlay({ items, scale }: { items: FurnitureItem[]; scale: number }) {
  return (
    <>
      {items.map(item => {
        const x = item.x * UNIT_PX * scale;
        const y = item.y * UNIT_PX * scale;
        const w = item.width * UNIT_PX * scale;
        const h = item.height * UNIT_PX * scale;
        return (
          <g key={item.id} transform={item.rotation ? `rotate(${item.rotation}, ${x + w / 2}, ${y + h / 2})` : undefined}>
            <rect x={x} y={y} width={w} height={h}
              fill={item.color || '#e2e8f0'} stroke="#64748b" strokeWidth="0.8"
              rx="2" opacity="0.85" />
            {w > 24 && h > 16 && (
              <text x={x + w / 2} y={y + h / 2} textAnchor="middle" dominantBaseline="middle"
                fontSize={Math.min(8, w / item.name.length * 1.4)} fill="#1e293b" fontFamily="sans-serif">
                {item.name}
              </text>
            )}
          </g>
        );
      })}
    </>
  );
}

export default function FloorPlanRenderer({ plan, scale = 1, showFurniture = true }: Props) {
  const [hoveredRoom, setHoveredRoom] = useState<Room | null>(null);

  const allRooms = plan.rooms;
  const maxX = Math.max(...allRooms.map(r => r.x + r.width)) + 1;
  const maxY = Math.max(...allRooms.map(r => r.y + r.height)) + 1;
  const svgW = maxX * UNIT_PX * scale;
  const svgH = maxY * UNIT_PX * scale;
  const BORDER = UNIT_PX * scale * 1.5;

  return (
    <div style={{ position: 'relative' }}>
      <svg
        width={svgW + BORDER * 2}
        height={svgH + BORDER * 2}
        viewBox={`0 0 ${svgW + BORDER * 2} ${svgH + BORDER * 2}`}
        style={{ display: 'block', maxWidth: '100%' }}
      >
        {/* White background */}
        <rect width={svgW + BORDER * 2} height={svgH + BORDER * 2} fill="white" />

        {/* Fine grid */}
        {Array.from({ length: maxX + 2 }).map((_, i) => (
          <line key={`vg${i}`}
            x1={BORDER + i * UNIT_PX * scale} y1={BORDER * 0.4}
            x2={BORDER + i * UNIT_PX * scale} y2={svgH + BORDER * 1.6}
            stroke="rgba(74,114,196,0.07)" strokeWidth="0.5" />
        ))}
        {Array.from({ length: maxY + 2 }).map((_, i) => (
          <line key={`hg${i}`}
            x1={BORDER * 0.4} y1={BORDER + i * UNIT_PX * scale}
            x2={svgW + BORDER * 1.6} y2={BORDER + i * UNIT_PX * scale}
            stroke="rgba(74,114,196,0.07)" strokeWidth="0.5" />
        ))}

        {/* Plot boundary shadow */}
        <rect x={BORDER + 3} y={BORDER + 3} width={svgW} height={svgH}
          fill="rgba(0,0,0,0.04)" rx="1" />

        {/* Plot boundary */}
        <rect x={BORDER} y={BORDER} width={svgW} height={svgH}
          fill="rgba(245,243,238,0.3)" stroke="#1a2744" strokeWidth="3" />

        {/* Room fills + walls */}
        {allRooms.map(room => {
          const rx = BORDER + room.x * UNIT_PX * scale;
          const ry = BORDER + room.y * UNIT_PX * scale;
          const rw = room.width * UNIT_PX * scale;
          const rh = room.height * UNIT_PX * scale;
          const isHovered = hoveredRoom?.id === room.id;

          return (
            <g key={room.id}>
              {/* Room fill */}
              <rect
                x={rx + WALL / 2} y={ry + WALL / 2}
                width={rw - WALL} height={rh - WALL}
                fill={room.color}
                opacity={isHovered ? 1 : 0.88}
              />

              {/* Room walls */}
              <rect
                x={rx} y={ry} width={rw} height={rh}
                fill="none"
                stroke="#1a2744"
                strokeWidth={isHovered ? WALL + 1 : WALL}
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => setHoveredRoom(room)}
                onMouseLeave={() => setHoveredRoom(null)}
              />

              {/* Door swing */}
              {rw > 45 && rh > 45 && room.type !== 'balcony' && room.type !== 'terrace' && (
                <DoorArc rx={rx} ry={ry} rw={rw} rh={rh} />
              )}

              {/* Windows */}
              {room.windows > 0 && rw > 50 && (
                <WindowMark rx={rx} ry={ry} rw={rw} />
              )}
              {room.windows > 1 && rh > 60 && (
                <g transform={`translate(${rx}, ${ry}) rotate(90, ${rw / 2}, ${rh / 2})`}>
                  <WindowMark rx={0} ry={0} rw={rh} />
                </g>
              )}

              {/* Room label */}
              {rw > 55 && rh > 35 && (
                <text
                  x={rx + rw / 2} y={ry + rh / 2 - (rh > 50 ? 7 : 0)}
                  textAnchor="middle" dominantBaseline="middle"
                  fontSize={Math.min(11, Math.max(7, rw / (room.name.length * 0.65)))}
                  fill="#1a2744" fontWeight="600"
                  fontFamily="'Outfit', sans-serif"
                  style={{ pointerEvents: 'none' }}
                >
                  {room.name}
                </text>
              )}
              {rw > 55 && rh > 55 && (
                <text
                  x={rx + rw / 2} y={ry + rh / 2 + 10}
                  textAnchor="middle" dominantBaseline="middle"
                  fontSize="8"
                  fill="#7a8a9a"
                  fontFamily="'DM Mono', monospace"
                  style={{ pointerEvents: 'none' }}
                >
                  {room.area} sq.ft
                </text>
              )}
            </g>
          );
        })}

        {/* Furniture overlay */}
        {showFurniture && plan.furniture && plan.furniture.length > 0 && (
          <g transform={`translate(${BORDER}, ${BORDER})`}>
            <FurnitureOverlay items={plan.furniture} scale={scale} />
          </g>
        )}

        {/* Compass rose */}
        <g transform={`translate(${svgW + BORDER * 1.6 - 28}, ${BORDER * 0.7})`}>
          <circle cx="0" cy="0" r="16" fill="white" stroke="#1a2744" strokeWidth="1.2" />
          <path d="M0 -13 L3.5 0 L0 4 L-3.5 0 Z" fill="#1a2744" />
          <path d="M0 -13 L-3.5 0 L0 4 L3.5 0 Z" fill="rgba(26,39,68,0.3)" />
          <text x="0" y="-17" textAnchor="middle" fontSize="8" fill="#1a2744" fontFamily="monospace" fontWeight="700">N</text>
        </g>

        {/* Dimension — width */}
        <line x1={BORDER} y1={BORDER * 0.45} x2={svgW + BORDER} y2={BORDER * 0.45} stroke="#c8853a" strokeWidth="1" />
        <line x1={BORDER} y1={BORDER * 0.32} x2={BORDER} y2={BORDER * 0.58} stroke="#c8853a" strokeWidth="1.2" />
        <line x1={svgW + BORDER} y1={BORDER * 0.32} x2={svgW + BORDER} y2={BORDER * 0.58} stroke="#c8853a" strokeWidth="1.2" />
        <text x={(svgW / 2) + BORDER} y={BORDER * 0.32}
          textAnchor="middle" fontSize="9" fill="#c8853a" fontFamily="monospace">
          {maxX * 5} ft
        </text>

        {/* Dimension — depth */}
        <line x1={BORDER * 0.45} y1={BORDER} x2={BORDER * 0.45} y2={svgH + BORDER} stroke="#c8853a" strokeWidth="1" />
        <text x={BORDER * 0.35} y={svgH / 2 + BORDER}
          textAnchor="middle" fontSize="9" fill="#c8853a" fontFamily="monospace"
          transform={`rotate(-90, ${BORDER * 0.35}, ${svgH / 2 + BORDER})`}>
          {maxY * 5} ft
        </text>

        {/* Floor label */}
        <text x={BORDER} y={svgH + BORDER * 1.72}
          fontSize="9" fill="#7a8a9a" fontFamily="monospace" letterSpacing="0.08em">
          {FLOOR_NAMES[plan.floor] || `FLOOR ${plan.floor}`}
          {' '}— SCALE 1:100 — AREA: {plan.totalArea.toLocaleString()} SQ.FT
        </text>
      </svg>

      {/* Hover tooltip */}
      {hoveredRoom && (
        <div style={{
          position: 'absolute', bottom: 48, right: 20,
          backgroundColor: 'var(--blueprint)', color: 'white',
          padding: '12px 16px', borderRadius: 6,
          fontSize: 13, boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
          pointerEvents: 'none', minWidth: 170,
          border: '1px solid rgba(255,255,255,0.1)',
        }}>
          <div style={{ fontWeight: 600, marginBottom: 6, fontSize: 14 }}>{hoveredRoom.name}</div>
          <div style={{ opacity: 0.85, fontSize: 12 }}>Area: {hoveredRoom.area} sq.ft</div>
          <div style={{ opacity: 0.85, fontSize: 12 }}>
            {hoveredRoom.width * 5}ft × {hoveredRoom.height * 5}ft
          </div>
          <div style={{ opacity: 0.7, fontSize: 11, marginTop: 4 }}>
            Windows: {hoveredRoom.windows} · Doors: {hoveredRoom.doors}
          </div>
        </div>
      )}
    </div>
  );
}
