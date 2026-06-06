'use client';
import { useState, useCallback, useRef } from 'react';
import type { FloorPlan, Room } from '@/types';
import { ROOM_COLORS } from '@/lib/generator';

const UNIT_PX = 44;
const WALL = 2.5;

const ROOM_TYPES: Room['type'][] = [
  'living', 'dining', 'bedroom', 'bathroom', 'kitchen',
  'balcony', 'study', 'garage', 'utility', 'pooja',
  'staircase', 'corridor', 'store',
];

const TYPE_LABELS: Record<string, string> = {
  living: 'Living Room', dining: 'Dining Room', bedroom: 'Bedroom',
  bathroom: 'Bathroom', kitchen: 'Kitchen', balcony: 'Balcony',
  study: 'Study', garage: 'Garage', utility: 'Utility', pooja: 'Pooja Room',
  staircase: 'Staircase', corridor: 'Corridor', store: 'Store',
};

interface DragState {
  roomId: string;
  mode: 'move' | 'resize-se' | 'resize-e' | 'resize-s';
  startClientX: number;
  startClientY: number;
  origX: number;
  origY: number;
  origW: number;
  origH: number;
}

interface Props {
  plan: FloorPlan;
  onPlanChange: (plan: FloorPlan) => void;
}

export default function CADEditor({ plan, onPlanChange }: Props) {
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [addMode, setAddMode] = useState(false);
  const [newRoomType, setNewRoomType] = useState<Room['type']>('bedroom');
  const [editName, setEditName] = useState('');
  const svgRef = useRef<SVGSVGElement>(null);

  const allRooms = plan.rooms;
  const maxX = Math.max(...allRooms.map(r => r.x + r.width), 8) + 2;
  const maxY = Math.max(...allRooms.map(r => r.y + r.height), 8) + 2;
  const BORDER = UNIT_PX;
  const svgW = maxX * UNIT_PX;
  const svgH = maxY * UNIT_PX;

  const getSVGPoint = useCallback((e: React.MouseEvent) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const rect = svgRef.current.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);

  const toGrid = (px: number) => Math.round(px / UNIT_PX);

  const handleRoomMouseDown = useCallback((e: React.MouseEvent, room: Room, mode: DragState['mode']) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedRoom(room.id);
    setEditName(room.name);
    setDrag({
      roomId: room.id,
      mode,
      startClientX: e.clientX,
      startClientY: e.clientY,
      origX: room.x, origY: room.y,
      origW: room.width, origH: room.height,
    });
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!drag) return;
    const dGridX = toGrid(e.clientX - drag.startClientX);
    const dGridY = toGrid(e.clientY - drag.startClientY);

    const updatedRooms = plan.rooms.map(r => {
      if (r.id !== drag.roomId) return r;
      if (drag.mode === 'move') {
        return { ...r, x: Math.max(0, drag.origX + dGridX), y: Math.max(0, drag.origY + dGridY) };
      }
      if (drag.mode === 'resize-se') {
        return { ...r, width: Math.max(1, drag.origW + dGridX), height: Math.max(1, drag.origH + dGridY) };
      }
      if (drag.mode === 'resize-e') {
        return { ...r, width: Math.max(1, drag.origW + dGridX) };
      }
      if (drag.mode === 'resize-s') {
        return { ...r, height: Math.max(1, drag.origH + dGridY) };
      }
      return r;
    });
    onPlanChange({ ...plan, rooms: updatedRooms });
  }, [drag, plan, onPlanChange]);

  const handleMouseUp = useCallback(() => setDrag(null), []);

  const handleSVGClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!addMode) return;
    const pt = getSVGPoint(e);
    const gx = Math.max(0, toGrid(pt.x - BORDER));
    const gy = Math.max(0, toGrid(pt.y - BORDER));
    const newRoom: Room = {
      id: `f${plan.floor}_r${Date.now()}`,
      name: TYPE_LABELS[newRoomType] || newRoomType,
      type: newRoomType,
      floor: plan.floor,
      x: gx, y: gy, width: 3, height: 3,
      area: 3 * 3 * 25,
      color: ROOM_COLORS[newRoomType] || '#f5f5f5',
      windows: ['staircase', 'corridor', 'garage', 'utility', 'store'].includes(newRoomType) ? 0 : 2,
      doors: 1,
    };
    onPlanChange({ ...plan, rooms: [...plan.rooms, newRoom] });
    setAddMode(false);
    setSelectedRoom(newRoom.id);
    setEditName(newRoom.name);
  }, [addMode, plan, onPlanChange, newRoomType, getSVGPoint, BORDER]);

  const deleteSelected = () => {
    if (!selectedRoom) return;
    onPlanChange({ ...plan, rooms: plan.rooms.filter(r => r.id !== selectedRoom) });
    setSelectedRoom(null);
  };

  const renameSelected = () => {
    if (!selectedRoom || !editName.trim()) return;
    onPlanChange({
      ...plan,
      rooms: plan.rooms.map(r => r.id === selectedRoom ? { ...r, name: editName.trim() } : r),
    });
  };

  const selectedRoomData = plan.rooms.find(r => r.id === selectedRoom);

  return (
    <div style={{ display: 'flex', gap: 16 }}>
      {/* Left: SVG canvas */}
      <div style={{ flex: 1, overflow: 'auto', border: '1px solid var(--line)', borderRadius: 8, backgroundColor: 'white' }}>
        <svg
          ref={svgRef}
          width={svgW + BORDER * 2}
          height={svgH + BORDER * 2}
          viewBox={`0 0 ${svgW + BORDER * 2} ${svgH + BORDER * 2}`}
          style={{ display: 'block', cursor: addMode ? 'crosshair' : drag ? 'grabbing' : 'default' }}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onClick={handleSVGClick}
        >
          <rect width={svgW + BORDER * 2} height={svgH + BORDER * 2} fill="#fafaf8" />

          {/* Grid dots */}
          {Array.from({ length: maxX + 2 }).map((_, xi) =>
            Array.from({ length: maxY + 2 }).map((_, yi) => (
              <circle key={`d${xi}-${yi}`}
                cx={BORDER + xi * UNIT_PX} cy={BORDER + yi * UNIT_PX}
                r="1.5" fill="rgba(74,114,196,0.18)" />
            ))
          )}

          {/* Plot boundary */}
          <rect x={BORDER} y={BORDER} width={svgW} height={svgH}
            fill="rgba(245,243,238,0.5)" stroke="#1a2744" strokeWidth="2.5" strokeDasharray="6,3" />

          {/* Rooms */}
          {allRooms.map(room => {
            const rx = BORDER + room.x * UNIT_PX;
            const ry = BORDER + room.y * UNIT_PX;
            const rw = room.width * UNIT_PX;
            const rh = room.height * UNIT_PX;
            const isSel = selectedRoom === room.id;

            return (
              <g key={room.id}>
                <rect x={rx + WALL / 2} y={ry + WALL / 2} width={rw - WALL} height={rh - WALL}
                  fill={room.color} opacity={isSel ? 1 : 0.88} />
                <rect x={rx} y={ry} width={rw} height={rh}
                  fill="none" stroke={isSel ? '#c8853a' : '#1a2744'}
                  strokeWidth={isSel ? 3 : WALL}
                  style={{ cursor: 'move', userSelect: 'none' }}
                  onMouseDown={(e) => handleRoomMouseDown(e, room, 'move')}
                />

                {/* Label */}
                {rw > 55 && rh > 35 && (
                  <>
                    <text x={rx + rw / 2} y={ry + rh / 2 - 6}
                      textAnchor="middle" dominantBaseline="middle"
                      fontSize={Math.min(11, Math.max(7, rw / (room.name.length * 0.7)))}
                      fill="#1a2744" fontWeight="600" fontFamily="'Outfit', sans-serif"
                      style={{ pointerEvents: 'none', userSelect: 'none' }}>
                      {room.name}
                    </text>
                    <text x={rx + rw / 2} y={ry + rh / 2 + 8}
                      textAnchor="middle" dominantBaseline="middle"
                      fontSize="8" fill="#7a8a9a" fontFamily="monospace"
                      style={{ pointerEvents: 'none', userSelect: 'none' }}>
                      {room.width * 5}×{room.height * 5}ft
                    </text>
                  </>
                )}

                {/* Selection handles */}
                {isSel && (
                  <>
                    {/* SE resize */}
                    <rect x={rx + rw - 6} y={ry + rh - 6} width={12} height={12}
                      fill="#c8853a" stroke="white" strokeWidth="1.5" rx="2"
                      style={{ cursor: 'se-resize' }}
                      onMouseDown={(e) => handleRoomMouseDown(e, room, 'resize-se')} />
                    {/* E resize */}
                    <rect x={rx + rw - 6} y={ry + rh / 2 - 6} width={12} height={12}
                      fill="#c8853a" stroke="white" strokeWidth="1.5" rx="2"
                      style={{ cursor: 'e-resize' }}
                      onMouseDown={(e) => handleRoomMouseDown(e, room, 'resize-e')} />
                    {/* S resize */}
                    <rect x={rx + rw / 2 - 6} y={ry + rh - 6} width={12} height={12}
                      fill="#c8853a" stroke="white" strokeWidth="1.5" rx="2"
                      style={{ cursor: 's-resize' }}
                      onMouseDown={(e) => handleRoomMouseDown(e, room, 'resize-s')} />
                    {/* Corner TL */}
                    <rect x={rx - 5} y={ry - 5} width={10} height={10}
                      fill="white" stroke="#c8853a" strokeWidth="2" rx="2" style={{ pointerEvents: 'none' }} />
                    {/* Corner TR */}
                    <rect x={rx + rw - 5} y={ry - 5} width={10} height={10}
                      fill="white" stroke="#c8853a" strokeWidth="2" rx="2" style={{ pointerEvents: 'none' }} />
                  </>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Right: Controls panel */}
      <div style={{ width: 220, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Add Room */}
        <div style={{ border: '1px solid var(--line)', borderRadius: 8, backgroundColor: 'white', padding: 16 }}>
          <div style={{ fontSize: 11, color: 'var(--steel)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Add Room</div>
          <select
            value={newRoomType}
            onChange={e => setNewRoomType(e.target.value as Room['type'])}
            style={{ width: '100%', padding: '6px 8px', borderRadius: 4, border: '1px solid var(--line)', fontSize: 12, marginBottom: 8, fontFamily: 'var(--font-body)', backgroundColor: 'white' }}
          >
            {ROOM_TYPES.map(t => (
              <option key={t} value={t}>{TYPE_LABELS[t] || t}</option>
            ))}
          </select>
          <button
            onClick={() => setAddMode(!addMode)}
            style={{
              width: '100%', padding: '8px', borderRadius: 4, border: 'none',
              backgroundColor: addMode ? '#c8853a' : 'var(--blueprint)',
              color: 'white', fontSize: 12, cursor: 'pointer',
              fontFamily: 'var(--font-body)',
            }}
          >
            {addMode ? '✕ Click plan to place' : '+ Add to plan'}
          </button>
        </div>

        {/* Selected room controls */}
        {selectedRoomData && (
          <div style={{ border: '1px solid #fed7aa', borderRadius: 8, backgroundColor: 'white', padding: 16 }}>
            <div style={{ fontSize: 11, color: '#92400e', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
              Selected: {selectedRoomData.name}
            </div>

            <div style={{ fontSize: 11, color: 'var(--steel)', marginBottom: 4 }}>Rename</div>
            <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
              <input
                value={editName}
                onChange={e => setEditName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && renameSelected()}
                style={{ flex: 1, padding: '5px 7px', border: '1px solid var(--line)', borderRadius: 4, fontSize: 12, fontFamily: 'var(--font-body)' }}
              />
              <button onClick={renameSelected}
                style={{ padding: '5px 8px', borderRadius: 4, border: 'none', backgroundColor: 'var(--blueprint)', color: 'white', fontSize: 11, cursor: 'pointer' }}>
                ✓
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 12, fontSize: 11, color: 'var(--steel)' }}>
              <div>Width: <strong style={{ color: 'var(--ink)' }}>{selectedRoomData.width * 5}ft</strong></div>
              <div>Depth: <strong style={{ color: 'var(--ink)' }}>{selectedRoomData.height * 5}ft</strong></div>
              <div>Area: <strong style={{ color: 'var(--ink)' }}>{selectedRoomData.area} sqft</strong></div>
              <div>Pos: <strong style={{ color: 'var(--ink)' }}>{selectedRoomData.x},{selectedRoomData.y}</strong></div>
            </div>

            <button onClick={deleteSelected}
              style={{ width: '100%', padding: '7px', borderRadius: 4, border: '1px solid #fca5a5', backgroundColor: '#fee2e2', color: '#dc2626', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
              🗑 Delete Room
            </button>
          </div>
        )}

        {/* Help */}
        <div style={{ border: '1px solid var(--line)', borderRadius: 8, backgroundColor: '#f8fafc', padding: 14, fontSize: 11, color: 'var(--steel)', lineHeight: 1.7 }}>
          <strong style={{ color: 'var(--ink)', display: 'block', marginBottom: 4 }}>How to edit</strong>
          Drag rooms to reposition<br />
          Orange handles to resize<br />
          Add new rooms with selector<br />
          Select + Delete to remove
        </div>
      </div>
    </div>
  );
}
