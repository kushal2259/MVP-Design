'use client';
import type { RoomLayout, DoorConfig, WindowConfig } from '@/types';

const SCALE = 9; // px per foot

const ROOM_COLORS: Record<string, string> = {
  living: '#dbeafe',
  dining: '#fce7f3',
  kitchen: '#dcfce7',
  bedroom: '#fef9c3',
  toilet: '#e0e7ff',
  bathroom: '#e0e7ff',
  balcony: '#d1fae5',
  staircase: '#f3f4f6',
  corridor: '#f9fafb',
  lobby: '#fef3c7',
  parking: '#e5e7eb',
  garden: '#bbf7d0',
};

const ROOM_LABELS: Record<string, string> = {
  living: 'Living Room',
  dining: 'Dining Room',
  kitchen: 'Kitchen',
  bedroom: 'Bedroom',
  toilet: 'Bathroom',
  balcony: 'Balcony',
  staircase: 'Staircase',
  corridor: 'Corridor',
  lobby: 'Lobby',
  parking: 'Parking',
  garden: 'Garden',
};

interface Props {
  rooms: RoomLayout[];
  plotWidth: number;
  plotDepth: number;
  showFurniture?: boolean;
  scale?: number;
}

function DoorArc({ door, rx, ry, rw, rh, sc }: { door: DoorConfig; rx: number; ry: number; rw: number; rh: number; sc: number }) {
  const dw = door.width * sc;
  const off = door.offset * sc;
  let x1 = 0, y1 = 0, pivotX = 0, pivotY = 0, sweepX = 0, sweepY = 0;

  if (door.side === 'front') {
    pivotX = rx + off;
    pivotY = ry + rh;
    x1 = pivotX;
    y1 = pivotY;
    sweepX = door.openDirection.includes('right') ? pivotX + dw : pivotX - dw;
    sweepY = pivotY - dw;
  } else if (door.side === 'back') {
    pivotX = rx + off;
    pivotY = ry;
    sweepX = door.openDirection.includes('right') ? pivotX + dw : pivotX - dw;
    sweepY = pivotY + dw;
  } else if (door.side === 'left') {
    pivotX = rx;
    pivotY = ry + off;
    sweepX = pivotX + dw;
    sweepY = door.openDirection.includes('right') ? pivotY - dw : pivotY + dw;
  } else {
    pivotX = rx + rw;
    pivotY = ry + off;
    sweepX = pivotX - dw;
    sweepY = door.openDirection.includes('right') ? pivotY - dw : pivotY + dw;
  }

  return (
    <g>
      <line x1={pivotX} y1={pivotY} x2={sweepX} y2={sweepY} stroke="#c8853a" strokeWidth="1.5" />
      <path
        d={`M ${pivotX} ${pivotY} A ${dw} ${dw} 0 0 ${door.openDirection.includes('right') ? 1 : 0} ${sweepX} ${sweepY}`}
        fill="none" stroke="#c8853a" strokeWidth="1" strokeDasharray="3,2"
      />
    </g>
  );
}

function WindowMark({ win, rx, ry, rw, rh, sc }: { win: WindowConfig; rx: number; ry: number; rw: number; rh: number; sc: number }) {
  const ww = win.width * sc;
  const off = win.offset * sc;
  let x1 = 0, y1 = 0, x2 = 0, y2 = 0, mx1 = 0, my1 = 0, mx2 = 0, my2 = 0;

  if (win.side === 'front') {
    x1 = rx + off; y1 = ry + rh - 1; x2 = rx + off + ww; y2 = y1;
    mx1 = x1; my1 = ry + rh - 4; mx2 = x2; my2 = my1;
  } else if (win.side === 'back') {
    x1 = rx + off; y1 = ry + 1; x2 = rx + off + ww; y2 = y1;
    mx1 = x1; my1 = ry + 4; mx2 = x2; my2 = my1;
  } else if (win.side === 'left') {
    x1 = rx + 1; y1 = ry + off; x2 = x1; y2 = ry + off + ww;
    mx1 = rx + 4; my1 = y1; mx2 = mx1; my2 = y2;
  } else {
    x1 = rx + rw - 1; y1 = ry + off; x2 = x1; y2 = ry + off + ww;
    mx1 = rx + rw - 4; my1 = y1; mx2 = mx1; my2 = y2;
  }

  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#1a2744" strokeWidth="3" />
      <line x1={mx1} y1={my1} x2={mx2} y2={my2} stroke="#7caef5" strokeWidth="2" />
    </g>
  );
}

export default function FloorPlanV2Renderer({ rooms, plotWidth, plotDepth, showFurniture = true, scale = SCALE }: Props) {
  const BORDER = 40;
  const svgW = plotWidth * scale + BORDER * 2;
  const svgH = plotDepth * scale + BORDER * 2;

  return (
    <svg
      width={svgW}
      height={svgH}
      viewBox={`0 0 ${svgW} ${svgH}`}
      style={{ display: 'block', maxWidth: '100%' }}
    >
      {/* Background */}
      <rect width={svgW} height={svgH} fill="#fafaf8" />

      {/* Grid lines */}
      {Array.from({ length: Math.floor(plotWidth / 5) + 1 }).map((_, i) => (
        <line key={`vg${i}`}
          x1={BORDER + i * 5 * scale} y1={BORDER}
          x2={BORDER + i * 5 * scale} y2={BORDER + plotDepth * scale}
          stroke="rgba(74,114,196,0.08)" strokeWidth="0.5"
        />
      ))}
      {Array.from({ length: Math.floor(plotDepth / 5) + 1 }).map((_, i) => (
        <line key={`hg${i}`}
          x1={BORDER} y1={BORDER + i * 5 * scale}
          x2={BORDER + plotWidth * scale} y2={BORDER + i * 5 * scale}
          stroke="rgba(74,114,196,0.08)" strokeWidth="0.5"
        />
      ))}

      {/* Plot boundary */}
      <rect x={BORDER} y={BORDER} width={plotWidth * scale} height={plotDepth * scale}
        fill="none" stroke="#1a2744" strokeWidth="2.5" strokeDasharray="8,4" />

      {/* Dimension labels */}
      <text x={BORDER + plotWidth * scale / 2} y={BORDER - 10}
        textAnchor="middle" fontSize="11" fill="#1a2744" fontFamily="monospace" fontWeight="600">
        {plotWidth} ft
      </text>
      <text x={BORDER - 10} y={BORDER + plotDepth * scale / 2}
        textAnchor="middle" fontSize="11" fill="#1a2744" fontFamily="monospace" fontWeight="600"
        transform={`rotate(-90, ${BORDER - 10}, ${BORDER + plotDepth * scale / 2})`}>
        {plotDepth} ft
      </text>

      {/* Rooms */}
      {rooms.map(room => {
        const rx = BORDER + room.x * scale;
        const ry = BORDER + room.y * scale;
        const rw = room.w * scale;
        const rh = room.h * scale;
        const color = room.color || ROOM_COLORS[room.type] || '#f5f5f5';
        const label = room.name || ROOM_LABELS[room.type] || room.type;

        return (
          <g key={room.id}>
            {/* Room fill */}
            <rect x={rx} y={ry} width={rw} height={rh}
              fill={color} stroke="#1a2744" strokeWidth="2" />

            {/* Room label */}
            {rw > 40 && rh > 30 && (
              <text
                x={rx + rw / 2} y={ry + rh / 2 - 6}
                textAnchor="middle" dominantBaseline="middle"
                fontSize={Math.min(11, Math.max(7, rw / (label.length * 0.75)))}
                fill="#1a2744" fontWeight="600" fontFamily="'Outfit', sans-serif"
                style={{ pointerEvents: 'none', userSelect: 'none' }}
              >
                {label}
              </text>
            )}
            {rw > 40 && rh > 44 && (
              <text
                x={rx + rw / 2} y={ry + rh / 2 + 9}
                textAnchor="middle" dominantBaseline="middle"
                fontSize="8" fill="#7a8a9a" fontFamily="monospace"
                style={{ pointerEvents: 'none', userSelect: 'none' }}
              >
                {room.w}×{room.h}ft
              </text>
            )}

            {/* Doors */}
            {room.doors.map(door => (
              <DoorArc key={door.id} door={door} rx={rx} ry={ry} rw={rw} rh={rh} sc={scale} />
            ))}

            {/* Windows */}
            {room.windows.map(win => (
              <WindowMark key={win.id} win={win} rx={rx} ry={ry} rw={rw} rh={rh} sc={scale} />
            ))}
          </g>
        );
      })}

      {/* Compass rose */}
      <g transform={`translate(${svgW - 32}, ${BORDER + 24})`}>
        <circle r="16" fill="white" stroke="#1a2744" strokeWidth="1" opacity="0.9" />
        <text x="0" y="-5" textAnchor="middle" fontSize="8" fontWeight="700" fill="#1a2744" fontFamily="monospace">N</text>
        <path d="M0,-14 L2,-4 L0,-7 L-2,-4 Z" fill="#1a2744" />
        <path d="M0,14 L2,4 L0,7 L-2,4 Z" fill="#aaa" />
      </g>
    </svg>
  );
}
