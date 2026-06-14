'use client';

import React, { useState, useRef, MouseEvent, WheelEvent, useEffect } from 'react';
import { RoomLayout, PlotSettings } from '@/lib/layoutSolver';
import {
  generateStructuralOverlay,
  generateElectricalOverlay,
  generatePlumbingOverlay,
  generateHvacOverlay,
  generateFireSafetyOverlay,
  generateColumnPlanOverlay,
  generateBeamPlanOverlay,
  generateFoundationPlanOverlay,
  ENGINEERING_DISCLAIMER
} from '@/lib/engineeringGenerator';
import { Eye, EyeOff, ZoomIn, ZoomOut, Maximize2, ShieldAlert } from 'lucide-react';
import { generateSchedule } from '@/lib/drawingGenerator';

interface DrawingViewportProps {
  rooms: RoomLayout[];
  settings: PlotSettings;
  selectedRoomId: string | null;
  onSelectRoom: (id: string | null) => void;
  onUpdateRoom: (updatedRoom: RoomLayout) => void;
  activeTab: 'ground' | 'first' | 'terrace' | 'site' | 'roof' | 'elevations' | 'sections' | 'structural' | 'electrical' | 'plumbing' | 'hvac' | 'fire' | 'schedules' | 'column-plan' | 'beam-plan' | 'foundation-plan';
  floorOverride?: number; // when set, overrides activeTab floor derivation
  elevationSide: 'front' | 'rear' | 'left' | 'right';
  sectionType: 'cross' | 'longitudinal';
  siteSvg: string;
  roofSvg: string;
  elevationSvg: string;
  sectionSvg: string;
  selectedCategory?: string;
}

export default function DrawingViewport({
  rooms,
  settings,
  selectedRoomId,
  onSelectRoom,
  onUpdateRoom,
  activeTab,
  floorOverride,
  elevationSide,
  sectionType,
  siteSvg,
  roofSvg,
  elevationSvg,
  sectionSvg,
  selectedCategory = 'interior'
}: DrawingViewportProps) {
  const [pan, setPan] = useState({ x: 50, y: 50 });
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  type DragMode = 'move' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw' | null;
  const [dragMode, setDragMode] = useState<DragMode>(null);
  const [draggingRoomId, setDraggingRoomId] = useState<string | null>(null);
  const [dragStartMouse, setDragStartMouse] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [dragStartRoom, setDragStartRoom] = useState<{ x: number; y: number; w: number; h: number }>({ x: 0, y: 0, w: 0, h: 0 });
  const dragMovedRef = useRef(false);
  const [stairDirs, setStairDirs] = useState<Record<string, 'n' | 's' | 'e' | 'w'>>({});
  const [draggingFurniture, setDraggingFurniture] = useState<{
    roomId: string; furnitureId: string;
    origFx: number; origFy: number;
    startMouseXFt: number; startMouseYFt: number;
  } | null>(null);
  const [draggingFitting, setDraggingFitting] = useState<{
    roomId: string;
    type: 'door' | 'window';
    id: string;
    side: 'front' | 'back' | 'left' | 'right';
    roomX: number;
    roomY: number;
    roomW: number;
    roomH: number;
    fittingWidth: number;
  } | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  // Selected floor for engineering drawings (defaults to Ground)
  const [engineeringFloor, setEngineeringFloor] = useState<number>(0);

  // Door/Window CRUD panel state
  const [addingDoor, setAddingDoor] = useState(false);
  const [addingWindow, setAddingWindow] = useState(false);
  const [newDoor, setNewDoor] = useState<{ side: 'front'|'back'|'left'|'right'; width: number; openDirection: 'in-left'|'in-right'|'out-left'|'out-right' }>({ side: 'front', width: 3, openDirection: 'in-left' });
  const [newWindow, setNewWindow] = useState<{ side: 'front'|'back'|'left'|'right'; width: number }>({ side: 'front', width: 4 });
  const [editingDoorId, setEditingDoorId] = useState<string | null>(null);
  const [editingWindowId, setEditingWindowId] = useState<string | null>(null);

  const selectedRoom = selectedRoomId ? rooms.find(r => r.id === selectedRoomId) ?? null : null;

  const handleAddDoor = () => {
    if (!selectedRoom) return;
    const wallLen = (newDoor.side === 'front' || newDoor.side === 'back') ? selectedRoom.w : selectedRoom.h;
    const offset = Math.max(0, (wallLen - newDoor.width) / 2);
    const updated = { ...selectedRoom, doors: [...selectedRoom.doors, { id: `d-${Date.now()}`, side: newDoor.side, offset: parseFloat(offset.toFixed(1)), width: newDoor.width, openDirection: newDoor.openDirection }] };
    onUpdateRoom(updated);
    setAddingDoor(false);
  };

  const handleDeleteDoor = (doorId: string) => {
    if (!selectedRoom) return;
    onUpdateRoom({ ...selectedRoom, doors: selectedRoom.doors.filter(d => d.id !== doorId) });
    if (editingDoorId === doorId) setEditingDoorId(null);
  };

  const handleUpdateDoor = (doorId: string, patch: Partial<{ side: 'front'|'back'|'left'|'right'; width: number; openDirection: 'in-left'|'in-right'|'out-left'|'out-right'; offset: number }>) => {
    if (!selectedRoom) return;
    onUpdateRoom({ ...selectedRoom, doors: selectedRoom.doors.map(d => d.id === doorId ? { ...d, ...patch } : d) });
  };

  const handleAddWindow = () => {
    if (!selectedRoom) return;
    const wallLen = (newWindow.side === 'front' || newWindow.side === 'back') ? selectedRoom.w : selectedRoom.h;
    const offset = Math.max(0, (wallLen - newWindow.width) / 2);
    const updated = { ...selectedRoom, windows: [...selectedRoom.windows, { id: `w-${Date.now()}`, side: newWindow.side, offset: parseFloat(offset.toFixed(1)), width: newWindow.width }] };
    onUpdateRoom(updated);
    setAddingWindow(false);
  };

  const handleDeleteWindow = (winId: string) => {
    if (!selectedRoom) return;
    onUpdateRoom({ ...selectedRoom, windows: selectedRoom.windows.filter(w => w.id !== winId) });
    if (editingWindowId === winId) setEditingWindowId(null);
  };

  const handleUpdateWindow = (winId: string, patch: Partial<{ side: 'front'|'back'|'left'|'right'; width: number; offset: number }>) => {
    if (!selectedRoom) return;
    onUpdateRoom({ ...selectedRoom, windows: selectedRoom.windows.map(w => w.id === winId ? { ...w, ...patch } : w) });
  };

  // Layers state
  const [showFurniture, setShowFurniture] = useState(true);
  const [showDimensions, setShowDimensions] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [showStructural, setShowStructural] = useState(false);
  const [showElectrical, setShowElectrical] = useState(false);
  const [showPlumbing, setShowPlumbing] = useState(false);
  const [showHvac, setShowHvac] = useState(false);
  const [showFireSafety, setShowFireSafety] = useState(false);

  // Sync activeTab to Layer toggles
  useEffect(() => {
    setShowStructural(false);
    setShowElectrical(false);
    setShowPlumbing(false);
    setShowHvac(false);
    setShowFireSafety(false);

    if (['structural', 'column-plan', 'beam-plan', 'foundation-plan'].includes(activeTab)) {
      setShowStructural(true);
      setShowFurniture(false);
    } else if (activeTab === 'electrical') {
      setShowElectrical(true);
      setShowFurniture(false);
    } else if (activeTab === 'plumbing') {
      setShowPlumbing(true);
      setShowFurniture(false);
    } else if (activeTab === 'hvac') {
      setShowHvac(true);
      setShowFurniture(false);
    } else if (activeTab === 'fire') {
      setShowFireSafety(true);
      setShowFurniture(false);
    } else {
      setShowFurniture(true);
    }
  }, [activeTab]);

  let activeFloor = -1;
  if (floorOverride !== undefined) {
    activeFloor = floorOverride;
  } else if (activeTab === 'ground') activeFloor = 0;
  else if (activeTab === 'first') activeFloor = 1;
  else if (activeTab === 'terrace') activeFloor = 2;
  else if (['structural', 'column-plan', 'beam-plan', 'foundation-plan', 'electrical', 'plumbing', 'hvac', 'fire', 'schedules'].includes(activeTab)) {
    activeFloor = engineeringFloor;
  }

  const floorRooms = rooms.filter(r => r.floor === activeFloor && r.type !== 'parking' && r.type !== 'garden');

  const scale = 14; // Pixels per foot at zoom=1

  // Handle zooming
  const handleWheel = (e: WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const zoomFactor = 1.1;
    let newZoom = zoom;
    if (e.deltaY < 0) {
      newZoom = Math.min(zoom * zoomFactor, 5);
    } else {
      newZoom = Math.max(zoom / zoomFactor, 0.4);
    }
    setZoom(newZoom);
  };

  // Handle panning start
  const startRoomDrag = (e: React.MouseEvent, room: RoomLayout, mode: DragMode) => {
    e.stopPropagation();
    if (!viewportRef.current) return;
    const rect = viewportRef.current.getBoundingClientRect();
    const mouseXInFt = (e.clientX - rect.left - pan.x) / (scale * zoom);
    const mouseYInFt = (e.clientY - rect.top - pan.y) / (scale * zoom);
    setDragMode(mode);
    setDraggingRoomId(room.id);
    setDragStartMouse({ x: mouseXInFt, y: mouseYInFt });
    setDragStartRoom({ x: room.x, y: room.y, w: room.w, h: room.h });
    dragMovedRef.current = false;
  };

  const handleRotateRoom = (e: React.MouseEvent, room: RoomLayout) => {
    e.stopPropagation();
    const cx = room.x + room.w / 2;
    const cy = room.y + room.h / 2;
    const newW = room.h;
    const newH = room.w;
    onUpdateRoom({ ...room, x: parseFloat((cx - newW / 2).toFixed(1)), y: parseFloat((cy - newH / 2).toFixed(1)), w: newW, h: newH });
  };

  const handleMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    if (dragMode) return;
    if (e.button === 0) {
      setIsPanning(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  // Handle movement
  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (isPanning) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    } else if (dragMode && draggingRoomId) {
      const room = rooms.find(r => r.id === draggingRoomId);
      if (!room || !viewportRef.current) return;
      const rect = viewportRef.current.getBoundingClientRect();
      const mouseXInFt = (e.clientX - rect.left - pan.x) / (scale * zoom);
      const mouseYInFt = (e.clientY - rect.top - pan.y) / (scale * zoom);
      const dx = mouseXInFt - dragStartMouse.x;
      const dy = mouseYInFt - dragStartMouse.y;
      dragMovedRef.current = true;
      const orig = dragStartRoom;
      const updated = { ...room };

      if (dragMode === 'move') {
        updated.x = Math.max(0, parseFloat((orig.x + dx).toFixed(1)));
        updated.y = Math.max(0, parseFloat((orig.y + dy).toFixed(1)));
      } else {
        if (dragMode === 'n' || dragMode === 'nw' || dragMode === 'ne') {
          const newH = Math.max(5, orig.h - dy);
          updated.y = parseFloat((orig.y + orig.h - newH).toFixed(1));
          updated.h = Math.round(newH);
        }
        if (dragMode === 's' || dragMode === 'sw' || dragMode === 'se') {
          updated.h = Math.max(5, Math.round(orig.h + dy));
        }
        if (dragMode === 'e' || dragMode === 'ne' || dragMode === 'se') {
          updated.w = Math.max(5, Math.round(orig.w + dx));
        }
        if (dragMode === 'w' || dragMode === 'nw' || dragMode === 'sw') {
          const newW = Math.max(5, orig.w - dx);
          updated.x = parseFloat((orig.x + orig.w - newW).toFixed(1));
          updated.w = Math.round(newW);
        }
      }
      onUpdateRoom(updated);
    } else if (draggingFurniture) {
      const room = rooms.find(r => r.id === draggingFurniture.roomId);
      if (!room || !viewportRef.current) return;
      const rect = viewportRef.current.getBoundingClientRect();
      const mouseXInFt = (e.clientX - rect.left - pan.x) / (scale * zoom);
      const mouseYInFt = (e.clientY - rect.top - pan.y) / (scale * zoom);
      const dx = mouseXInFt - draggingFurniture.startMouseXFt;
      const dy = mouseYInFt - draggingFurniture.startMouseYFt;
      const fur = room.furniture.find(f => f.id === draggingFurniture.furnitureId);
      if (!fur) return;
      const newFx = parseFloat(Math.max(0, Math.min(room.w - fur.w, draggingFurniture.origFx + dx)).toFixed(1));
      const newFy = parseFloat(Math.max(0, Math.min(room.h - fur.h, draggingFurniture.origFy + dy)).toFixed(1));
      onUpdateRoom({ ...room, furniture: room.furniture.map(f => f.id === draggingFurniture.furnitureId ? { ...f, x: newFx, y: newFy } : f) });
    } else if (draggingFitting) {
      if (!viewportRef.current) return;
      const rect = viewportRef.current.getBoundingClientRect();
      const mouseXInFt = (e.clientX - rect.left - pan.x) / (scale * zoom);
      const mouseYInFt = (e.clientY - rect.top - pan.y) / (scale * zoom);

      const { roomId, type, id, side, roomX, roomY, roomW, roomH, fittingWidth } = draggingFitting;
      
      let newOffset = 0;
      if (side === 'front' || side === 'back') {
        newOffset = mouseXInFt - roomX - fittingWidth / 2;
      } else {
        newOffset = mouseYInFt - roomY - fittingWidth / 2;
      }

      const maxOffset = (side === 'front' || side === 'back' ? roomW : roomH) - fittingWidth;
      const clampedOffset = Math.max(0, Math.min(maxOffset, Math.round(newOffset * 2) / 2)); // snap to 0.5ft

      const room = rooms.find(rm => rm.id === roomId);
      if (room) {
        const updated = { ...room };
        if (type === 'door') {
          updated.doors = updated.doors.map(dr => dr.id === id ? { ...dr, offset: clampedOffset } : dr);
        } else {
          updated.windows = updated.windows.map(wd => wd.id === id ? { ...wd, offset: clampedOffset } : wd);
        }
        onUpdateRoom(updated);
      }
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    setDragMode(null);
    setDraggingRoomId(null);
    setDraggingFurniture(null);
    setDraggingFitting(null);
  };

  const resetViewport = () => {
    setPan({ x: 80, y: 50 });
    setZoom(1.0);
  };

  const renderDoor = (r: RoomLayout, d: any) => {
    const rx = r.x * scale;
    const ry = r.y * scale;
    const rw = r.w * scale;
    const rh = r.h * scale;
    const dw = d.width * scale;

    let dx = 0, dy = 0;
    let doorPath = '';
    let arcPath = '';

    // Handle range boundaries check
    const offset = Math.max(0, Math.min(d.offset, (d.side === 'front' || d.side === 'back' ? r.w : r.h) - d.width));

    if (d.side === 'front') {
      dx = rx + offset * scale;
      dy = ry + rh;
      doorPath = `M ${dx} ${dy} L ${dx} ${dy - dw}`;
      arcPath = `M ${dx} ${dy - dw} A ${dw} ${dw} 0 0 1 ${dx + dw} ${dy}`;
    } else if (d.side === 'back') {
      dx = rx + offset * scale;
      dy = ry;
      doorPath = `M ${dx} ${dy} L ${dx} ${dy + dw}`;
      arcPath = `M ${dx} ${dy + dw} A ${dw} ${dw} 0 0 0 ${dx + dw} ${dy}`;
    } else if (d.side === 'left') {
      dx = rx;
      dy = ry + offset * scale;
      doorPath = `M ${dx} ${dy} L ${dx + dw} ${dy}`;
      arcPath = `M ${dx + dw} ${dy} A ${dw} ${dw} 0 0 1 ${dx} ${dy + dw}`;
    } else if (d.side === 'right') {
      dx = rx + rw;
      dy = ry + offset * scale;
      doorPath = `M ${dx} ${dy} L ${dx - dw} ${dy}`;
      arcPath = `M ${dx - dw} ${dy} A ${dw} ${dw} 0 0 0 ${dx} ${dy + dw}`;
    }

    return (
      <g 
        key={d.id} 
        stroke="#f59e0b" 
        strokeWidth="1.8" 
        fill="none"
        className="cursor-move"
        onMouseDown={(e) => {
          e.stopPropagation();
          e.preventDefault();
          setDraggingFitting({
            roomId: r.id,
            type: 'door',
            id: d.id,
            side: d.side,
            roomX: r.x,
            roomY: r.y,
            roomW: r.w,
            roomH: r.h,
            fittingWidth: d.width
          });
        }}
      >
        <path d={doorPath} />
        <path d={arcPath} strokeDasharray="3 3" />
        {/* Transparent hit box for easier dragging */}
        <path d={doorPath} stroke="transparent" strokeWidth="12" className="cursor-ew-resize" />
      </g>
    );
  };

  const renderWindow = (r: RoomLayout, w: any) => {
    const rx = r.x * scale;
    const ry = r.y * scale;
    const rw = r.w * scale;
    const rh = r.h * scale;
    const ww = w.width * scale;

    const offset = Math.max(0, Math.min(w.offset, (w.side === 'front' || w.side === 'back' ? r.w : r.h) - w.width));

    let wx = 0, wy = 0, width = 0, height = 0;
    if (w.side === 'front') {
      wx = rx + offset * scale; wy = ry + rh - 3; width = ww; height = 6;
    } else if (w.side === 'back') {
      wx = rx + offset * scale; wy = ry - 3; width = ww; height = 6;
    } else if (w.side === 'left') {
      wx = rx - 3; wy = ry + offset * scale; width = 6; height = ww;
    } else if (w.side === 'right') {
      wx = rx + rw - 3; wy = ry + offset * scale; width = 6; height = ww;
    }

    return (
      <g 
        key={w.id}
        className="cursor-move"
        onMouseDown={(e) => {
          e.stopPropagation();
          e.preventDefault();
          setDraggingFitting({
            roomId: r.id,
            type: 'window',
            id: w.id,
            side: w.side,
            roomX: r.x,
            roomY: r.y,
            roomW: r.w,
            roomH: r.h,
            fittingWidth: w.width
          });
        }}
      >
        <rect x={wx} y={wy} width={width} height={height} fill="#0284c7" stroke="#38bdf8" strokeWidth="1" />
        <line x1={wx} y1={wy + height / 2} x2={wx + width} y2={wy + height / 2} stroke="#ffffff" strokeWidth="0.5" />
        {/* Transparent hit box for easier dragging */}
        <rect x={wx - 2} y={wy - 2} width={width + 4} height={height + 4} fill="transparent" />
      </g>
    );
  };

  // HIGH-FIDELITY ARCHITECTURAL CAD SYMBOLS
  const renderFurniture = (r: RoomLayout, f: any) => {
    const fx = (r.x + f.x) * scale;
    const fy = (r.y + f.y) * scale;
    const fw = f.w * scale;
    const fh = f.h * scale;

    const fillStyle = "rgba(100, 116, 139, 0.12)";
    const strokeStyle = "#94a3b8";

    return (
      <g key={f.id} transform={`rotate(${f.rotation}, ${fx}, ${fy})`} stroke={strokeStyle} strokeWidth="1" fill={fillStyle}
        style={{ cursor: 'grab' }}
        onMouseDown={(e) => {
          e.stopPropagation();
          if (!viewportRef.current) return;
          const rect = viewportRef.current.getBoundingClientRect();
          const mouseXInFt = (e.clientX - rect.left - pan.x) / (scale * zoom);
          const mouseYInFt = (e.clientY - rect.top - pan.y) / (scale * zoom);
          setDraggingFurniture({ roomId: r.id, furnitureId: f.id, origFx: f.x, origFy: f.y, startMouseXFt: mouseXInFt, startMouseYFt: mouseYInFt });
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          // Double-click rotates furniture 90°
          const newW = f.h; const newH = f.w;
          const newRot = (f.rotation + 90) % 360;
          onUpdateRoom({ ...r, furniture: r.furniture.map(fi => fi.id === f.id ? { ...fi, w: newW, h: newH, rotation: newRot } : fi) });
        }}
      >
        {f.type.startsWith('bed') ? (
          // Beds (King, Queen, Double, Single)
          <g stroke="#94a3b8" fill="none" strokeWidth="1">
            {/* Main mattress */}
            <rect x={fx - fw / 2} y={fy - fh / 2} width={fw} height={fh} rx={1} fill="#1e293b" />
            {/* Headboard */}
            <rect x={fx - fw / 2} y={fy - fh / 2} width={fw} height={1.2 * scale} fill="#334155" />
            {/* Pillows */}
            {f.type === 'bed-single' ? (
              <rect x={fx - 1.2 * scale} y={fy - fh / 2 + 1.8 * scale} width={2.4 * scale} height={1.5 * scale} rx={0.5} fill="#475569" />
            ) : (
              <>
                <rect x={fx - fw / 2 + 0.8 * scale} y={fy - fh / 2 + 1.8 * scale} width={2 * scale} height={1.5 * scale} rx={0.5} fill="#475569" />
                <rect x={fx + fw / 2 - 2.8 * scale} y={fy - fh / 2 + 1.8 * scale} width={2 * scale} height={1.5 * scale} rx={0.5} fill="#475569" />
              </>
            )}
            {/* Folded blanket crease */}
            <path d={`M ${fx - fw / 2} ${fy - fh / 2 + 4.5 * scale} Q ${fx} ${fy - fh / 2 + 5 * scale} ${fx + fw / 2} ${fy - fh / 2 + 4.5 * scale}`} stroke="#64748b" strokeWidth="1.2" />
            <rect x={fx - fw / 2 + 0.2} y={fy - fh / 2 + 4.6 * scale} width={fw - 0.4} height={fh - 4.6 * scale - 0.2} fill="#0f172a" opacity="0.4" />
            {/* Nightstands / Bedside tables */}
            {f.type !== 'bed-single' && (
              <>
                <rect x={fx - fw / 2 - 2.5 * scale} y={fy - fh / 2} width={2 * scale} height={2 * scale} rx={0.5} fill="#334155" stroke="#475569" />
                <rect x={fx + fw / 2 + 0.5 * scale} y={fy - fh / 2} width={2 * scale} height={2 * scale} rx={0.5} fill="#334155" stroke="#475569" />
              </>
            )}
          </g>
        ) : f.type.startsWith('sofa') || f.type === 'armchair' ? (
          // Sofas (Standard, Sectional, 3-seater, Armchair)
          <g stroke="#60a5fa" fill="none" strokeWidth="1">
            {/* Outer Frame */}
            <rect x={fx - fw / 2} y={fy - fh / 2} width={fw} height={fh} rx={1.5} fill="#1e3b8a" />
            
            {/* Sectional L-shape logic */}
            {f.type === 'sofa-sectional' ? (
              <>
                {/* Armrest left */}
                <rect x={fx - fw / 2} y={fy - fh / 2} width={1.2 * scale} height={fh} fill="#3b82f6" />
                {/* Armrest top */}
                <rect x={fx - fw / 2} y={fy - fh / 2} width={fw} height={1.2 * scale} fill="#3b82f6" />
                {/* L-Shape cushion grid lines */}
                <line x1={fx - fw / 2 + 3 * scale} y1={fy - fh / 2} x2={fx - fw / 2 + 3 * scale} y2={fy + fh / 2} strokeWidth="0.8" />
                <line x1={fx - fw / 2} y1={fy - fh / 2 + 3 * scale} x2={fx + fw / 2} y2={fy - fh / 2 + 3 * scale} strokeWidth="0.8" />
              </>
            ) : (
              <>
                {/* Backrest cushion */}
                <rect x={fx - fw / 2} y={fy - fh / 2} width={fw} height={1.2 * scale} fill="#2563eb" />
                {/* Left armrest */}
                <rect x={fx - fw / 2} y={fy - fh / 2} width={1 * scale} height={fh} fill="#2563eb" />
                {/* Right armrest */}
                <rect x={fx + fw / 2 - 1 * scale} y={fy - fh / 2} width={1 * scale} height={fh} fill="#2563eb" />
                {/* Seat dividers */}
                {f.type === 'sofa-3seater' ? (
                  <>
                    <line x1={fx - fw / 6} y1={fy - fh / 2 + 1.2 * scale} x2={fx - fw / 6} y2={fy + fh / 2} strokeWidth="0.8" />
                    <line x1={fx + fw / 6} y1={fy - fh / 2 + 1.2 * scale} x2={fx + fw / 6} y2={fy + fh / 2} strokeWidth="0.8" />
                  </>
                ) : f.type === 'armchair' ? null : (
                  // standard 2-seater split
                  <line x1={fx} y1={fy - fh / 2 + 1.2 * scale} x2={fx} y2={fy + fh / 2} strokeWidth="0.8" />
                )}
              </>
            )}
          </g>
        ) : f.type === 'coffee-table' ? (
          // Glass top coffee table
          <g stroke="#06b6d4" fill="rgba(6, 182, 212, 0.1)" strokeWidth="1.5">
            <rect x={fx - fw / 2} y={fy - fh / 2} width={fw} height={fh} rx={1} />
            <rect x={fx - fw / 2 + 3} y={fy - fh / 2 + 3} width={fw - 6} height={fh - 6} fill="none" stroke="#0891b2" strokeWidth="0.8" strokeDasharray="3 2" />
          </g>
        ) : f.type === 'tv-unit' ? (
          // TV Console Unit
          <g stroke="#64748b" fill="none" strokeWidth="1">
            <rect x={fx - fw / 2} y={fy - fh / 2} width={fw} height={fh} rx={0.5} fill="#1e293b" />
            {/* Flat TV screen slot */}
            <rect x={fx - fw * 0.4} y={fy - 2} width={fw * 0.8} height={4} fill="#020617" stroke="#cbd5e1" strokeWidth="1.5" />
            {/* Shelf lines */}
            <line x1={fx - fw / 3} y1={fy - fh / 2} x2={fx - fw / 3} y2={fy + fh / 2} strokeWidth="0.5" />
            <line x1={fx + fw / 3} y1={fy - fh / 2} x2={fx + fw / 3} y2={fy + fh / 2} strokeWidth="0.5" />
          </g>
        ) : f.type === 'bookshelf' ? (
          // Bookshelf
          <g stroke="#b45309" fill="#78350f" strokeWidth="1">
            <rect x={fx - fw / 2} y={fy - fh / 2} width={fw} height={fh} />
            {/* Book slots */}
            {Array.from({ length: Math.floor(fw / 4) }).map((_, i) => (
              <line key={i} x1={fx - fw / 2 + i * 4 + 2} y1={fy - fh / 2 + 2} x2={fx - fw / 2 + i * 4 + 2} y2={fy + fh / 2 - 2} stroke="#f59e0b" strokeWidth="1.5" />
            ))}
          </g>
        ) : f.type === 'fireplace' ? (
          // Hearth fireplace
          <g stroke="#f97316" fill="none" strokeWidth="1">
            <rect x={fx - fw / 2} y={fy - fh / 2} width={fw} height={fh} fill="#451a03" />
            {/* Arch fireplace hearth */}
            <path d={`M ${fx - fw * 0.3} ${fy + fh / 2} Q ${fx} ${fy - fh * 0.2} ${fx + fw * 0.3} ${fy + fh / 2}`} fill="#0f172a" stroke="#ea580c" strokeWidth="1.5" />
            {/* Fire flame paths */}
            <path d={`M ${fx - 2} ${fy + fh / 2} L ${fx} ${fy + 2} L ${fx + 2} ${fy + fh / 2} Z`} fill="#ef4444" stroke="#f97316" />
          </g>
        ) : f.type === 'wc' ? (
          // Water Closet contour
          <g stroke="#94a3b8" fill="none" strokeWidth="1">
            {/* Back flush tank */}
            <rect x={fx - 4} y={fy - 5} width={8} height={3} rx={0.5} fill="#cbd5e1" />
            {/* Oval bowl */}
            <ellipse cx={fx} cy={fy + 1} rx={3} ry={4} fill="#f8fafc" />
            <ellipse cx={fx} cy={fy + 1} rx={1.8} ry={2.5} fill="#cbd5e1" />
          </g>
        ) : f.type.startsWith('basin') ? (
          // Wash basins (Single, Double)
          <g stroke="#94a3b8" fill="none" strokeWidth="1">
            {/* Counter */}
            <rect x={fx - fw / 2} y={fy - fh / 2} width={fw} height={fh} rx={1} fill="#e2e8f0" />
            {/* Double basin versus single basin */}
            {f.type === 'basin-double' ? (
              <>
                {/* Left sink */}
                <ellipse cx={fx - fw / 4} cy={fy} rx={fw / 5} ry={fh / 2 - 1.5} fill="#0f172a" />
                <circle cx={fx - fw / 4} cy={fy - fh / 2 + 1} r="0.8" fill="#e2e8f0" />
                {/* Right sink */}
                <ellipse cx={fx + fw / 4} cy={fy} rx={fw / 5} ry={fh / 2 - 1.5} fill="#0f172a" />
                <circle cx={fx + fw / 4} cy={fy - fh / 2 + 1} r="0.8" fill="#e2e8f0" />
              </>
            ) : (
              <>
                <ellipse cx={fx} cy={fy} rx={fw / 2.5} ry={fh / 2 - 1.5} fill="#0f172a" />
                <circle cx={fx} cy={fy - fh / 2 + 1} r="0.8" fill="#e2e8f0" />
              </>
            )}
          </g>
        ) : f.type.startsWith('kitchen-counter') || f.type === 'kitchen-island' ? (
          // Kitchen Counter systems
          <g stroke="#64748b" fill="none" strokeWidth="1">
            {/* Counter main */}
            {f.type === 'kitchen-counter-l' ? (
              <path d={`M ${fx - fw / 2} ${fy - fh / 2} L ${fx + fw / 2} ${fy - fh / 2} L ${fx + fw / 2} ${fy + fh / 2} L ${fx + fw / 2 - 2 * scale} ${fy + fh / 2} L ${fx + fw / 2 - 2 * scale} ${fy - fh / 2 + 2 * scale} L ${fx - fw / 2} ${fy - fh / 2 + 2 * scale} Z`} fill="#334155" />
            ) : (
              <rect x={fx - fw / 2} y={fy - fh / 2} width={fw} height={fh} fill="#334155" />
            )}
            
            {/* Hub stove circles */}
            {fw >= 4 * scale && (
              <g transform={`translate(${fx - fw / 4}, ${fy})`} stroke="#ef4444">
                <rect x="-4" y="-3" width="8" height="6" rx="0.5" strokeWidth="0.8" />
                <circle cx="-2" cy="0" r="1" />
                <circle cx="2" cy="0" r="1" />
              </g>
            )}
            {/* Sink bowl */}
            {fw >= 4 * scale && (
              <g transform={`translate(${fx + fw / 4}, ${fy})`}>
                <rect x="-4" y="-3" width="8" height="6" rx="0.5" fill="#0f172a" stroke="#cbd5e1" />
                <circle cx="0" cy="-3.5" r="0.4" fill="#cbd5e1" />
              </g>
            )}
          </g>
        ) : f.type.startsWith('dining-table') || f.type === 'dining-table' ? (
          // Dining Table sets with chairs
          <g stroke="#b45309" fill="none" strokeWidth="1">
            {/* Center Table */}
            <rect x={fx - fw * 0.35} y={fy - fh * 0.35} width={fw * 0.7} height={fh * 0.7} rx={0.5} fill="#78350f" />
            
            {/* Chairs representation */}
            {f.type === 'dining-table-4seater' ? (
              <>
                <rect x={fx - fw * 0.15} y={fy - fh / 2} width={fw * 0.3} height={1.2 * scale} fill="#451a03" />
                <rect x={fx - fw * 0.15} y={fy + fh / 2 - 1.2 * scale} width={fw * 0.3} height={1.2 * scale} fill="#451a03" />
                <rect x={fx - fw / 2} y={fy - fh * 0.15} width={1.2 * scale} height={fh * 0.3} fill="#451a03" />
                <rect x={fx + fw / 2 - 1.2 * scale} y={fy - fh * 0.15} width={1.2 * scale} height={fh * 0.3} fill="#451a03" />
              </>
            ) : (
              // 6-seater default
              <>
                <rect x={fx - fw * 0.25} y={fy - fh / 2} width={1.5 * scale} height={1.2 * scale} fill="#451a03" />
                <rect x={fx + fw * 0.05} y={fy - fh / 2} width={1.5 * scale} height={1.2 * scale} fill="#451a03" />
                <rect x={fx - fw * 0.25} y={fy + fh / 2 - 1.2 * scale} width={1.5 * scale} height={1.2 * scale} fill="#451a03" />
                <rect x={fx + fw * 0.05} y={fy + fh / 2 - 1.2 * scale} width={1.5 * scale} height={1.2 * scale} fill="#451a03" />
                <rect x={fx - fw / 2} y={fy - fh * 0.15} width={1.2 * scale} height={fh * 0.3} fill="#451a03" />
                <rect x={fx + fw / 2 - 1.2 * scale} y={fy - fh * 0.15} width={1.2 * scale} height={fh * 0.3} fill="#451a03" />
              </>
            )}
          </g>
        ) : f.type === 'bathtub' ? (
          // Bathtub outline
          <g stroke="#94a3b8" fill="none" strokeWidth="1.5">
            <rect x={fx - fw / 2} y={fy - fh / 2} width={fw} height={fh} rx={fw / 3} fill="#f1f5f9" />
            <rect x={fx - fw / 2 + 3} y={fy - fh / 2 + 3} width={fw - 6} height={fh - 6} rx={fw / 4} fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="0.8" />
            <circle cx={fx - fw / 2.5} cy={fy} r="1" fill="#64748b" />
          </g>
        ) : f.type.startsWith('shower') ? (
          // Showers
          <g stroke="#38bdf8" fill="none" strokeWidth="1">
            <rect x={fx - fw / 2} y={fy - fh / 2} width={fw} height={fh} fill="rgba(56, 189, 248, 0.05)" />
            {/* Diagonal glass enclosure lines */}
            <path d={`M ${fx - fw / 2} ${fy - fh / 2} L ${fx + fw / 2} ${fy + fh / 2}`} strokeWidth="0.5" strokeDasharray="2 2" />
            <circle cx={fx} cy={fy} r="1.5" fill="#38bdf8" />
            <circle cx={fx} cy={fy} r="0.5" fill="#0f172a" />
          </g>
        ) : f.type.startsWith('car') ? (
          // Cars (Sedan, SUV, Standard)
          <g stroke="#475569" fill="none" strokeWidth="1">
            {/* Car body */}
            <rect x={fx - fw / 2} y={fy - fh / 2} width={fw} height={fh} rx={fw / 4} fill="#1e293b" />
            {/* Windshield */}
            <rect x={fx - fw / 2.5} y={fy - fh / 4} width={fw / 1.25} height={fh * 0.45} rx={fw / 10} fill="#334155" stroke="#cbd5e1" />
            {/* Wheels */}
            <rect x={fx - fw / 2 - 1.5} y={fy - fh / 3} width="2" height={fh / 4} rx="0.5" fill="#020617" />
            <rect x={fx + fw / 2 - 0.5} y={fy - fh / 3} width="2" height={fh / 4} rx="0.5" fill="#020617" />
            <rect x={fx - fw / 2 - 1.5} y={fy + fh / 6} width="2" height={fh / 4} rx="0.5" fill="#020617" />
            <rect x={fx + fw / 2 - 0.5} y={fy + fh / 6} width="2" height={fh / 4} rx="0.5" fill="#020617" />
          </g>
        ) : f.type.startsWith('plant') ? (
          // Indoor foliage plant
          <g stroke="#10b981" fill="none" strokeWidth="1">
            {/* Pot */}
            <circle cx={fx} cy={fy} r="2.5" fill="#b45309" stroke="#78350f" />
            {/* Leaf branches */}
            <path d={`M ${fx} ${fy} L ${fx - 5} ${fy - 5}`} strokeWidth="1.5" strokeLinecap="round" />
            <path d={`M ${fx} ${fy} L ${fx + 5} ${fy - 5}`} strokeWidth="1.5" strokeLinecap="round" />
            <path d={`M ${fx} ${fy} L ${fx - 5} ${fy + 5}`} strokeWidth="1.5" strokeLinecap="round" />
            <path d={`M ${fx} ${fy} L ${fx + 5} ${fy + 5}`} strokeWidth="1.5" strokeLinecap="round" />
            <path d={`M ${fx} ${fy} L ${fx} ${fy - 7}`} strokeWidth="1.5" strokeLinecap="round" />
            {/* Foliage circle overlay */}
            <circle cx={fx} cy={fy} r="4" fill="#047857" opacity="0.3" />
          </g>
        ) : f.type === 'piano' ? (
          // Piano outline
          <g stroke="#cbd5e1" fill="none" strokeWidth="1">
            {/* Grand piano wing shape */}
            <path d={`M ${fx - fw/2} ${fy - fh/2} L ${fx + fw/2} ${fy - fh/2} L ${fx + fw/2} ${fy + fh/3} C ${fx + fw/3} ${fy + fh/2}, ${fx - fw/4} ${fy + fh/2}, ${fx - fw/2} ${fy + fh/3} Z`} fill="#0f172a" stroke="#475569" strokeWidth="1.5" />
            {/* Keys grid at the front */}
            <rect x={fx - fw/2} y={fy - fh/2} width={fw} height={1.2 * scale} fill="#ffffff" />
            {Array.from({ length: 8 }).map((_, i) => (
              <line key={i} x1={fx - fw/2 + (i * fw)/8} y1={fy - fh/2} x2={fx - fw/2 + (i * fw)/8} y2={fy - fh/2 + 1.2 * scale} stroke="#000000" strokeWidth="0.8" />
            ))}
          </g>
        ) : f.type === 'pool-table' ? (
          // Pool table
          <g stroke="#b45309" fill="none" strokeWidth="1.5">
            <rect x={fx - fw / 2} y={fy - fh / 2} width={fw} height={fh} fill="#065f46" />
            {/* Pockets */}
            <circle cx={fx - fw / 2} cy={fy - fh / 2} r="1.5" fill="#020617" />
            <circle cx={fx + fw / 2} cy={fy - fh / 2} r="1.5" fill="#020617" />
            <circle cx={fx - fw / 2} cy={fy + fh / 2} r="1.5" fill="#020617" />
            <circle cx={fx + fw / 2} cy={fy + fh / 2} r="1.5" fill="#020617" />
            <circle cx={fx} cy={fy - fh / 2} r="1" fill="#020617" />
            <circle cx={fx} cy={fy + fh / 2} r="1" fill="#020617" />
          </g>
        ) : f.type === 'gym-treadmill' ? (
          // Gym treadmill
          <g stroke="#64748b" fill="none" strokeWidth="1">
            {/* Running deck */}
            <rect x={fx - fw / 2.5} y={fy - fh / 2} width={fw * 0.8} height={fh * 0.75} fill="#0f172a" />
            {/* Console frame */}
            <path d={`M ${fx - fw / 2} ${fy + fh / 4} L ${fx - fw / 2.5} ${fy + fh / 2} L ${fx + fw / 2.5} ${fy + fh / 2} L ${fx + fw / 2} ${fy + fh / 4}`} strokeWidth="1.5" />
            <rect x={fx - fw / 4} y={fy + fh / 2 - 2} width={fw / 2} height="3" rx="0.5" fill="#334155" />
          </g>
        ) : f.type === 'washing-machine' ? (
          // Washer appliance
          <g stroke="#94a3b8" fill="none" strokeWidth="1">
            <rect x={fx - fw / 2} y={fy - fh / 2} width={fw} height={fh} rx={0.5} fill="#f1f5f9" />
            <circle cx={fx} cy={fy} r={fw * 0.32} fill="#e2e8f0" stroke="#64748b" strokeWidth="1.5" />
            <circle cx={fx} cy={fy} r={fw * 0.22} fill="#0f172a" opacity="0.3" />
          </g>
        ) : f.type === 'refrigerator' ? (
          // Fridge
          <g stroke="#475569" fill="none" strokeWidth="1">
            <rect x={fx - fw / 2} y={fy - fh / 2} width={fw} height={fh} rx={0.5} fill="#e2e8f0" />
            {/* Double door divide */}
            <line x1={fx} y1={fy - fh / 2} x2={fx} y2={fy + fh / 2} strokeWidth="1.5" stroke="#94a3b8" />
            <rect x={fx - fw / 2 + 1} y={fy - 1} width="1.5" height="4" fill="#334155" />
            <rect x={fx + fw / 2 - 2.5} y={fy - 1} width="1.5" height="4" fill="#334155" />
          </g>
        ) : (
          // Fallback box representation
          <g stroke="#94a3b8" fill="none" strokeWidth="1">
            <rect x={fx - fw / 2} y={fy - fh / 2} width={fw} height={fh} rx={0.5} fill="#1e293b" opacity="0.5" />
            <line x1={fx - fw / 2} y1={fy - fh / 2} x2={fx + fw / 2} y2={fy + fh / 2} strokeWidth="0.5" strokeOpacity="0.3" />
            <line x1={fx + fw / 2} y1={fy - fh / 2} x2={fx - fw / 2} y2={fy + fh / 2} strokeWidth="0.5" strokeOpacity="0.3" />
          </g>
        )}
      </g>
    );
  };

  return (
    <div className="flex flex-col h-full bg-[#040811] border border-slate-800 rounded-xl overflow-hidden relative shadow-2xl">
      {/* Viewport Header */}
      <div className="glass-panel px-4 py-3 flex items-center justify-between border-b border-slate-800 z-10">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="text-xs text-slate-300 font-mono font-bold">
            CAD SHEET: {activeTab === 'terrace' ? 'SECOND PLAN' : activeTab.toUpperCase()}
            {activeTab === 'elevations' && ` (${elevationSide.toUpperCase()})`}
            {activeTab === 'sections' && ` (${sectionType.toUpperCase()})`}
          </span>
        </div>

        {/* Dynamic Floor Selector */}
        {['structural', 'electrical', 'plumbing', 'hvac', 'fire'].includes(activeTab) && (
          <div className="flex bg-slate-900 border border-slate-800 rounded p-0.5 text-[10px]">
            <button
              onClick={() => setEngineeringFloor(0)}
              className={`px-2 py-0.5 rounded transition ${engineeringFloor === 0 ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'}`}
            >
              Ground Floor
            </button>
            {settings.floors >= 2 && (
              <button
                onClick={() => setEngineeringFloor(1)}
                className={`px-2 py-0.5 rounded transition ${engineeringFloor === 1 ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'}`}
              >
                First Floor
              </button>
            )}
            {settings.floors >= 3 && (
              <button
                onClick={() => setEngineeringFloor(2)}
                className={`px-2 py-0.5 rounded transition ${engineeringFloor === 2 ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'}`}
              >
                Second Floor
              </button>
            )}
          </div>
        )}

        {/* Viewport Actions */}
        <div className="flex items-center gap-2">
          <button onClick={() => setZoom(z => Math.min(z * 1.2, 5))} className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-emerald-400 transition" title="Zoom In">
            <ZoomIn size={16} />
          </button>
          <button onClick={() => setZoom(z => Math.max(z / 1.2, 0.4))} className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-emerald-400 transition" title="Zoom Out">
            <ZoomOut size={16} />
          </button>
          <button onClick={resetViewport} className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-emerald-400 transition" title="Reset Viewport">
            <Maximize2 size={16} />
          </button>
        </div>
      </div>

      {/* Layer Toggles */}
      {activeFloor !== -1 && activeTab !== 'schedules' && (
        <div className="absolute top-14 left-4 z-10 glass-panel p-2 rounded-lg flex flex-col gap-1 border border-slate-800 shadow-lg text-[10px]">
          <span className="font-bold text-slate-400 mb-1 px-1 border-b border-slate-800 pb-1">SHEET LAYERS</span>
          {selectedCategory === 'interior' && (
            <button
              onClick={() => setShowFurniture(!showFurniture)}
              className={`flex items-center gap-2 px-2 py-1 rounded transition text-left ${showFurniture ? 'text-cyan-400 bg-cyan-950/30' : 'text-slate-500'}`}
            >
              {showFurniture ? <Eye size={12} /> : <EyeOff size={12} />} Furniture
            </button>
          )}
          <button
            onClick={() => setShowDimensions(!showDimensions)}
            className={`flex items-center gap-2 px-2 py-1 rounded transition text-left ${showDimensions ? 'text-cyan-400 bg-cyan-950/30' : 'text-slate-500'}`}
          >
            {showDimensions ? <Eye size={12} /> : <EyeOff size={12} />} Dimensions
          </button>
          <button
            onClick={() => setShowGrid(!showGrid)}
            className={`flex items-center gap-2 px-2 py-1 rounded transition text-left ${showGrid ? 'text-cyan-400 bg-cyan-950/30' : 'text-slate-500'}`}
          >
            {showGrid ? <Eye size={12} /> : <EyeOff size={12} />} Grid lines
          </button>
          
          {selectedCategory !== 'interior' && (
            <>
              <span className="font-bold text-slate-400 mt-2 mb-1 px-1 border-b border-slate-800 pb-1">ENGINEERING DRAFTS</span>
              {selectedCategory === 'civil' && (
                <button
                  onClick={() => setShowStructural(!showStructural)}
                  className={`flex items-center gap-2 px-2 py-1 rounded transition text-left ${showStructural ? 'text-rose-400 bg-rose-950/30 font-bold' : 'text-slate-500'}`}
                >
                  {showStructural ? <Eye size={12} /> : <EyeOff size={12} />} Structural Columns
                </button>
              )}
              {selectedCategory === 'electrical' && (
                <button
                  onClick={() => setShowElectrical(!showElectrical)}
                  className={`flex items-center gap-2 px-2 py-1 rounded transition text-left ${showElectrical ? 'text-yellow-400 bg-yellow-950/30 font-bold' : 'text-slate-500'}`}
                >
                  {showElectrical ? <Eye size={12} /> : <EyeOff size={12} />} Electrical Plan
                </button>
              )}
              {selectedCategory === 'plumbing' && (
                <button
                  onClick={() => setShowPlumbing(!showPlumbing)}
                  className={`flex items-center gap-2 px-2 py-1 rounded transition text-left ${showPlumbing ? 'text-blue-400 bg-blue-950/30 font-bold' : 'text-slate-500'}`}
                >
                  {showPlumbing ? <Eye size={12} /> : <EyeOff size={12} />} Plumbing Plan
                </button>
              )}
              {selectedCategory === 'hvac' && (
                <button
                  onClick={() => setShowHvac(!showHvac)}
                  className={`flex items-center gap-2 px-2 py-1 rounded transition text-left ${showHvac ? 'text-emerald-400 bg-emerald-950/30 font-bold' : 'text-slate-500'}`}
                >
                  {showHvac ? <Eye size={12} /> : <EyeOff size={12} />} HVAC Ducts
                </button>
              )}
              {selectedCategory === 'fire' && (
                <button
                  onClick={() => setShowFireSafety(!showFireSafety)}
                  className={`flex items-center gap-2 px-2 py-1 rounded transition text-left ${showFireSafety ? 'text-red-400 bg-red-950/30 font-bold' : 'text-slate-500'}`}
                >
                  {showFireSafety ? <Eye size={12} /> : <EyeOff size={12} />} Fire Safety
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* Viewport Canvas */}
      <div
        ref={viewportRef}
        className="flex-1 cursor-grab active:cursor-grabbing overflow-hidden blueprint-grid relative"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {activeTab === 'schedules' ? (
          // SCHEDULE SHEET
          <div className="w-full h-full flex flex-col items-center justify-center p-8 overflow-y-auto">
            <div className="glass-panel p-6 rounded-xl border border-slate-800 w-full max-w-2xl shadow-xl">
              <h3 className="text-sm font-bold font-mono text-cyan-400 mb-4 border-b border-slate-800 pb-2">
                SCHEDULE OF DOORS AND WINDOWS
              </h3>
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-mono">
                    <th className="py-2">Code</th>
                    <th className="py-2">Fitting Type</th>
                    <th className="py-2">Width (ft)</th>
                    <th className="py-2">Height (ft)</th>
                    <th className="py-2">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {generateSchedule(rooms).rows.map((row, idx) => (
                    <tr key={idx} className="border-b border-slate-900 text-slate-300">
                      <td className="py-2.5 font-bold font-mono text-emerald-400">{row[0]}</td>
                      <td className="py-2.5">{row[1]}</td>
                      <td className="py-2.5 font-mono">{row[2]}</td>
                      <td className="py-2.5 font-mono">{row[3]}</td>
                      <td className="py-2.5 text-slate-500 text-[10px]">{row[4]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : activeFloor !== -1 ? (
          // DRAWING CANVAS
          <svg
            width="100%"
            height="100%"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: '0 0',
              transition: isPanning ? 'none' : 'transform 0.1s ease-out',
            }}
            xmlns="http://www.w3.org/2000/svg"
          >
            <style>
              {`
                .wall { fill: #0f172a; stroke: #f8fafc; stroke-width: 2.5; }
                .wall-double { fill: none; stroke: #1e293b; stroke-width: 6; }
                .room-label { font-family: monospace; font-size: 10px; font-weight: bold; fill: #e2e8f0; pointer-events: none; }
                .room-size { font-family: monospace; font-size: 8px; fill: #94a3b8; pointer-events: none; }
                .selected-room { fill: rgba(16, 185, 129, 0.08); stroke: #10b981; stroke-width: 3; }
                .dimension-line { stroke: #475569; stroke-width: 1; }
                .dimension-text { font-family: monospace; font-size: 7px; fill: #64748b; text-anchor: middle; pointer-events: none; }
              `}
            </style>

            {showGrid && (
              <g stroke="rgba(255,255,255,0.03)" strokeWidth="0.5">
                {Array.from({ length: 60 }).map((_, i) => (
                  <line key={`x-${i}`} x1={i * 20} y1={0} x2={i * 20} y2={800} />
                ))}
                {Array.from({ length: 40 }).map((_, i) => (
                  <line key={`y-${i}`} x1={0} y1={i * 20} x2={1000} y2={i * 20} />
                ))}
              </g>
            )}

            {floorRooms.map(r => {
              const isSelected = r.id === selectedRoomId;
              const rx = r.x * scale;
              const ry = r.y * scale;
              const rw = r.w * scale;
              const rh = r.h * scale;

              return (
                <g key={r.id}>
                  <rect x={rx - 3} y={ry - 3} width={rw + 6} height={rh + 6} className="wall-double" />

                  <rect
                    x={rx}
                    y={ry}
                    width={rw}
                    height={rh}
                    className={isSelected ? 'selected-room' : 'wall'}
                    style={{ cursor: isSelected ? 'move' : 'pointer' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!dragMovedRef.current) onSelectRoom(isSelected ? null : r.id);
                    }}
                    onMouseDown={(e) => {
                      dragMovedRef.current = false;
                      if (isSelected) startRoomDrag(e, r, 'move');
                    }}
                  />

                  {/* 1. Staircase Texture */}
                  {r.type === 'staircase' && (() => {
                    const dir = stairDirs[r.id] || 'n';
                    const portrait = dir === 'n' || dir === 's';
                    const treadCount = portrait
                      ? Math.floor((rh - 3 * scale) / (0.9 * scale))
                      : Math.floor((rw - 3 * scale) / (0.9 * scale));
                    const landingSize = 3 * scale;
                    return (
                      <g stroke="rgba(255, 255, 255, 0.15)" strokeWidth="1" fill="none">
                        {/* Landing */}
                        {dir === 'n' && <rect x={rx} y={ry} width={rw} height={landingSize} fill="rgba(255,255,255,0.02)" />}
                        {dir === 's' && <rect x={rx} y={ry + rh - landingSize} width={rw} height={landingSize} fill="rgba(255,255,255,0.02)" />}
                        {dir === 'e' && <rect x={rx + rw - landingSize} y={ry} width={landingSize} height={rh} fill="rgba(255,255,255,0.02)" />}
                        {dir === 'w' && <rect x={rx} y={ry} width={landingSize} height={rh} fill="rgba(255,255,255,0.02)" />}
                        {/* Landing divider line */}
                        {dir === 'n' && <line x1={rx} y1={ry + landingSize} x2={rx + rw} y2={ry + landingSize} strokeWidth="1.5" />}
                        {dir === 's' && <line x1={rx} y1={ry + rh - landingSize} x2={rx + rw} y2={ry + rh - landingSize} strokeWidth="1.5" />}
                        {dir === 'e' && <line x1={rx + rw - landingSize} y1={ry} x2={rx + rw - landingSize} y2={ry + rh} strokeWidth="1.5" />}
                        {dir === 'w' && <line x1={rx + landingSize} y1={ry} x2={rx + landingSize} y2={ry + rh} strokeWidth="1.5" />}
                        {/* Handrail */}
                        {portrait && <line x1={rx + rw / 2} y1={dir === 'n' ? ry + landingSize : ry} x2={rx + rw / 2} y2={dir === 'n' ? ry + rh : ry + rh - landingSize} strokeWidth="1.5" />}
                        {!portrait && <line x1={dir === 'e' ? rx : rx + landingSize} y1={ry + rh / 2} x2={dir === 'e' ? rx + rw - landingSize : rx + rw} y2={ry + rh / 2} strokeWidth="1.5" />}
                        {/* Treads */}
                        {portrait && Array.from({ length: treadCount }).map((_, i) => {
                          const lineY = dir === 'n'
                            ? ry + landingSize + (i + 1) * 0.9 * scale
                            : ry + (i + 1) * 0.9 * scale;
                          return (
                            <g key={`tread-${i}`}>
                              <line x1={rx} y1={lineY} x2={rx + rw / 2} y2={lineY} />
                              <line x1={rx + rw / 2} y1={lineY} x2={rx + rw} y2={lineY} />
                            </g>
                          );
                        })}
                        {!portrait && Array.from({ length: treadCount }).map((_, i) => {
                          const lineX = dir === 'w'
                            ? rx + landingSize + (i + 1) * 0.9 * scale
                            : rx + (i + 1) * 0.9 * scale;
                          return (
                            <g key={`tread-${i}`}>
                              <line x1={lineX} y1={ry} x2={lineX} y2={ry + rh / 2} />
                              <line x1={lineX} y1={ry + rh / 2} x2={lineX} y2={ry + rh} />
                            </g>
                          );
                        })}
                        {/* UP arrow */}
                        {dir === 'n' && (
                          <g>
                            <path d={`M ${rx + rw * 0.25} ${ry + rh - 15} L ${rx + rw * 0.25} ${ry + 4 * scale} A ${rw * 0.25} ${rw * 0.25} 0 0 1 ${rx + rw * 0.75} ${ry + 4 * scale} L ${rx + rw * 0.75} ${ry + rh - 25}`} stroke="#10b981" strokeWidth="1.2" strokeLinecap="round" strokeDasharray="2 2" fill="none" />
                            <path d={`M ${rx + rw * 0.75 - 3} ${ry + rh - 22} L ${rx + rw * 0.75} ${ry + rh - 27} L ${rx + rw * 0.75 + 3} ${ry + rh - 22}`} fill="#10b981" stroke="none" />
                            <text x={rx + rw * 0.25} y={ry + rh - 5} fill="#10b981" fontSize="7px" fontFamily="monospace" textAnchor="middle">UP</text>
                          </g>
                        )}
                        {dir === 's' && (
                          <g>
                            <path d={`M ${rx + rw * 0.25} ${ry + 15} L ${rx + rw * 0.25} ${ry + rh - 4 * scale} A ${rw * 0.25} ${rw * 0.25} 0 0 0 ${rx + rw * 0.75} ${ry + rh - 4 * scale} L ${rx + rw * 0.75} ${ry + 25}`} stroke="#10b981" strokeWidth="1.2" strokeLinecap="round" strokeDasharray="2 2" fill="none" />
                            <path d={`M ${rx + rw * 0.75 - 3} ${ry + 22} L ${rx + rw * 0.75} ${ry + 27} L ${rx + rw * 0.75 + 3} ${ry + 22}`} fill="#10b981" stroke="none" />
                            <text x={rx + rw * 0.25} y={ry + 12} fill="#10b981" fontSize="7px" fontFamily="monospace" textAnchor="middle">UP</text>
                          </g>
                        )}
                        {dir === 'e' && (
                          <g>
                            <path d={`M ${rx + 15} ${ry + rh * 0.25} L ${rx + rw - 4 * scale} ${ry + rh * 0.25} A ${rh * 0.25} ${rh * 0.25} 0 0 1 ${rx + rw - 4 * scale} ${ry + rh * 0.75} L ${rx + 25} ${ry + rh * 0.75}`} stroke="#10b981" strokeWidth="1.2" strokeLinecap="round" strokeDasharray="2 2" fill="none" />
                            <path d={`M ${rx + 22} ${ry + rh * 0.75 - 3} L ${rx + 27} ${ry + rh * 0.75} L ${rx + 22} ${ry + rh * 0.75 + 3}`} fill="#10b981" stroke="none" />
                            <text x={rx + 12} y={ry + rh * 0.25 - 4} fill="#10b981" fontSize="7px" fontFamily="monospace" textAnchor="middle">UP</text>
                          </g>
                        )}
                        {dir === 'w' && (
                          <g>
                            <path d={`M ${rx + rw - 15} ${ry + rh * 0.25} L ${rx + 4 * scale} ${ry + rh * 0.25} A ${rh * 0.25} ${rh * 0.25} 0 0 0 ${rx + 4 * scale} ${ry + rh * 0.75} L ${rx + rw - 25} ${ry + rh * 0.75}`} stroke="#10b981" strokeWidth="1.2" strokeLinecap="round" strokeDasharray="2 2" fill="none" />
                            <path d={`M ${rx + rw - 22} ${ry + rh * 0.75 - 3} L ${rx + rw - 27} ${ry + rh * 0.75} L ${rx + rw - 22} ${ry + rh * 0.75 + 3}`} fill="#10b981" stroke="none" />
                            <text x={rx + rw - 12} y={ry + rh * 0.25 - 4} fill="#10b981" fontSize="7px" fontFamily="monospace" textAnchor="middle">UP</text>
                          </g>
                        )}
                      </g>
                    );
                  })()}

                  {/* 2. Balcony Texture */}
                  {r.type === 'balcony' && (
                    <g stroke="rgba(245, 158, 11, 0.15)" strokeWidth="0.8" fill="none">
                      {/* Balcony deck boards */}
                      {Array.from({ length: Math.floor(rw / (0.6 * scale)) }).map((_, i) => {
                        const lineX = rx + (i + 1) * 0.6 * scale;
                        return <line key={`balc-${i}`} x1={lineX} y1={ry} x2={lineX} y2={ry + rh} />;
                      })}
                      {/* Heavy railing border on three sides (depending on exterior walls) */}
                      <rect x={rx} y={ry} width={rw} height={rh} stroke="#f59e0b" strokeWidth="2" strokeDasharray="6 3" />
                    </g>
                  )}

                  {/* 3. Garden Texture */}
                  {r.type === 'garden' && (
                    <g stroke="rgba(34, 197, 94, 0.12)" strokeWidth="0.8" fill="none">
                      {/* Diagonal grid lines representing lawn grass */}
                      {Array.from({ length: Math.floor((rw + rh) / (1.5 * scale)) }).map((_, i) => {
                        const offset = i * 1.5 * scale;
                        return (
                          <line
                            key={`gard-${i}`}
                            x1={Math.max(rx, rx + offset - rh)}
                            y1={Math.min(ry + rh, ry + offset)}
                            x2={Math.min(rx + rw, rx + offset)}
                            y2={Math.max(ry, ry + offset - rw)}
                          />
                        );
                      })}
                    </g>
                  )}

                  {r.doors.map(d => renderDoor(r, d))}
                  {r.windows.map(w => renderWindow(r, w))}

                  {showFurniture && selectedCategory === 'interior' && !['structural', 'column-plan', 'beam-plan', 'foundation-plan', 'electrical', 'plumbing', 'hvac', 'fire'].includes(activeTab) && r.furniture.map(f => renderFurniture(r, f))}

                  <text x={rx + rw / 2} y={ry + rh / 2 - 4} className="room-label" textAnchor="middle">
                    {r.name.toUpperCase()}
                  </text>
                  <text x={rx + rw / 2} y={ry + rh / 2 + 8} className="room-size" textAnchor="middle">
                    {r.w}' x {r.h}' ({r.w * r.h} sq ft)
                  </text>

                  {showDimensions && (
                    <g>
                      <line x1={rx} y1={ry - 10} x2={rx + rw} y2={ry - 10} className="dimension-line" />
                      <line x1={rx} y1={ry - 14} x2={rx} y2={ry - 6} className="dimension-line" />
                      <line x1={rx + rw} y1={ry - 14} x2={rx + rw} y2={ry - 6} className="dimension-line" />
                      <text x={rx + rw / 2} y={ry - 15} className="dimension-text">{r.w}'</text>

                      <line x1={rx - 10} y1={ry} x2={rx - 10} y2={ry + rh} className="dimension-line" />
                      <line x1={rx - 14} y1={ry} x2={rx - 6} y2={ry} className="dimension-line" />
                      <line x1={rx - 14} y1={ry + rh} x2={rx - 6} y2={ry + rh} className="dimension-line" />
                      <text x={rx - 16} y={ry + rh / 2 + 2} className="dimension-text" transform={`rotate(-90, ${rx - 16}, ${ry + rh / 2 + 2})`}>{r.h}'</text>
                    </g>
                  )}

                  {isSelected && (() => {
                    const H = 8; // handle size px
                    const H2 = H / 2;
                    const handles: Array<{ mode: DragMode; cx: number; cy: number; cursor: string }> = [
                      { mode: 'nw', cx: rx,          cy: ry,          cursor: 'nwse-resize' },
                      { mode: 'n',  cx: rx + rw / 2, cy: ry,          cursor: 'ns-resize'   },
                      { mode: 'ne', cx: rx + rw,     cy: ry,          cursor: 'nesw-resize' },
                      { mode: 'e',  cx: rx + rw,     cy: ry + rh / 2, cursor: 'ew-resize'   },
                      { mode: 'se', cx: rx + rw,     cy: ry + rh,     cursor: 'nwse-resize' },
                      { mode: 's',  cx: rx + rw / 2, cy: ry + rh,     cursor: 'ns-resize'   },
                      { mode: 'sw', cx: rx,          cy: ry + rh,     cursor: 'nesw-resize' },
                      { mode: 'w',  cx: rx,          cy: ry + rh / 2, cursor: 'ew-resize'   },
                    ];
                    const rotCx = rx + rw / 2;
                    const rotCy = ry - 18;
                    return (
                      <g>
                        {handles.map(h => (
                          <rect
                            key={h.mode}
                            x={h.cx - H2}
                            y={h.cy - H2}
                            width={H}
                            height={H}
                            fill="#10b981"
                            stroke="#064e3b"
                            strokeWidth="1"
                            style={{ cursor: h.cursor }}
                            onMouseDown={(e) => startRoomDrag(e, r, h.mode)}
                          />
                        ))}
                        {/* Rotate handle — circular button above the room */}
                        <line x1={rotCx} y1={ry - 8} x2={rotCx} y2={rotCy + 6} stroke="#10b981" strokeWidth="1" strokeDasharray="2 2" />
                        <circle
                          cx={rotCx} cy={rotCy} r={7}
                          fill="#0f172a" stroke="#10b981" strokeWidth="1.5"
                          style={{ cursor: 'grab' }}
                          onClick={(e) => handleRotateRoom(e, r)}
                        />
                        <text
                          x={rotCx} y={rotCy + 4}
                          textAnchor="middle" fontSize="10" fill="#10b981"
                          style={{ pointerEvents: 'none', userSelect: 'none' }}
                        >↻</text>
                      </g>
                    );
                  })()}
                </g>
              );
            })}

            {/* Show active drag fitting visual cue */}
            {draggingFitting && (
              (() => {
                const { roomX, roomY, side, fittingWidth, roomId } = draggingFitting;
                const room = rooms.find(r => r.id === roomId);
                if (!room) return null;
                const r = room;
                const rx = r.x * scale;
                const ry = r.y * scale;
                const rw = r.w * scale;
                const rh = r.h * scale;
                
                const fit = draggingFitting.type === 'door' 
                  ? r.doors.find(d => d.id === draggingFitting.id)
                  : r.windows.find(w => w.id === draggingFitting.id);
                if (!fit) return null;
                
                const offset = fit.offset;
                const oFt = offset.toFixed(1);
                
                let textX = 0;
                let textY = 0;
                if (side === 'front') {
                  textX = rx + offset * scale + (fittingWidth * scale) / 2;
                  textY = ry + rh + 20;
                } else if (side === 'back') {
                  textX = rx + offset * scale + (fittingWidth * scale) / 2;
                  textY = ry - 20;
                } else if (side === 'left') {
                  textX = rx - 25;
                  textY = ry + offset * scale + (fittingWidth * scale) / 2;
                } else if (side === 'right') {
                  textX = rx + rw + 25;
                  textY = ry + offset * scale + (fittingWidth * scale) / 2;
                }
                
                return (
                  <g>
                    {/* Pulsing indicator ring around the dragged fitting */}
                    {side === 'front' || side === 'back' ? (
                      <line 
                        x1={rx + offset * scale} 
                        y1={side === 'front' ? ry + rh : ry} 
                        x2={rx + offset * scale + fittingWidth * scale} 
                        y2={side === 'front' ? ry + rh : ry} 
                        stroke="#10b981" 
                        strokeWidth="4" 
                        strokeLinecap="round"
                        className="animate-pulse"
                      />
                    ) : (
                      <line 
                        x1={side === 'left' ? rx : rx + rw} 
                        y1={ry + offset * scale} 
                        x2={side === 'left' ? rx : rx + rw} 
                        y2={ry + offset * scale + fittingWidth * scale} 
                        stroke="#10b981" 
                        strokeWidth="4" 
                        strokeLinecap="round"
                        className="animate-pulse"
                      />
                    )}
                    <rect 
                      x={textX - 25} 
                      y={textY - 8} 
                      width="50" 
                      height="16" 
                      rx="4" 
                      fill="#10b981" 
                    />
                    <text 
                      x={textX} 
                      y={textY + 3} 
                      fill="#040811" 
                      fontSize="9px" 
                      fontFamily="monospace" 
                      fontWeight="bold" 
                      textAnchor="middle"
                    >
                      {oFt} ft
                    </text>
                  </g>
                );
              })()
            )}

            {/* ENGINEERING OVERLAYS */}
            {showStructural && activeTab === 'structural' && (
              <g dangerouslySetInnerHTML={{ __html: generateStructuralOverlay(floorRooms, scale) }} />
            )}
            {activeTab === 'column-plan' && (
              <g dangerouslySetInnerHTML={{ __html: generateColumnPlanOverlay(floorRooms, scale) }} />
            )}
            {activeTab === 'beam-plan' && (
              <g dangerouslySetInnerHTML={{ __html: generateBeamPlanOverlay(floorRooms, scale) }} />
            )}
            {activeTab === 'foundation-plan' && (
              <g dangerouslySetInnerHTML={{ __html: generateFoundationPlanOverlay(floorRooms, scale) }} />
            )}
            {showElectrical && (
              <g dangerouslySetInnerHTML={{ __html: generateElectricalOverlay(floorRooms, scale) }} />
            )}
            {showPlumbing && (
              <g dangerouslySetInnerHTML={{ __html: generatePlumbingOverlay(floorRooms, scale) }} />
            )}
            {showHvac && (
              <g dangerouslySetInnerHTML={{ __html: generateHvacOverlay(floorRooms, scale) }} />
            )}
            {showFireSafety && (
              <g dangerouslySetInnerHTML={{ __html: generateFireSafetyOverlay(floorRooms, scale) }} />
            )}
          </svg>
        ) : (
          // VECTOR DRAWING EMBEDS
          <div
            className="w-full h-full flex items-center justify-center p-8 select-none pointer-events-none"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: 'center center',
              transition: isPanning ? 'none' : 'transform 0.1s ease-out',
            }}
            dangerouslySetInnerHTML={{
              __html:
                activeTab === 'site'
                  ? siteSvg
                  : activeTab === 'roof'
                  ? roofSvg
                  : activeTab === 'elevations'
                  ? elevationSvg
                  : sectionSvg,
            }}
          />
        )}
      </div>

      {/* Properties Panel — shown when a room is selected */}
      {selectedRoom && activeFloor !== -1 && (
        <div
          className="absolute top-14 right-3 z-20 glass-panel rounded-xl shadow-2xl overflow-hidden"
          style={{ width: 380, maxHeight: 'calc(100% - 110px)', overflowY: 'auto', border: '2px solid #10b981', boxShadow: '0 0 0 4px rgba(16,185,129,0.12), 0 24px 60px rgba(0,0,0,0.5)' }}
          onMouseDown={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-4 py-3 bg-emerald-950/80 border-b border-emerald-500/30 flex items-center justify-between">
            <div>
              <span className="text-sm font-bold font-mono text-emerald-300 uppercase tracking-wide block">
                {selectedRoom.name}
              </span>
              <span className="text-[11px] text-emerald-600 font-mono">Room Properties</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                className="px-2 py-1 rounded bg-emerald-800/60 hover:bg-emerald-700/80 text-emerald-300 text-xs font-mono border border-emerald-600/40 transition"
                onClick={(e) => handleRotateRoom(e, selectedRoom)}
                title="Rotate 90°"
              >↻ Rotate</button>
              <button
                className="w-7 h-7 flex items-center justify-center rounded-full bg-slate-800 hover:bg-red-900 text-slate-400 hover:text-red-300 text-sm transition"
                onClick={() => onSelectRoom(null)}
                title="Close panel"
              >✕</button>
            </div>
          </div>

          {/* Room size — editable ft + in inputs */}
          {(() => {
            const toFtIn = (dec: number) => ({ ft: Math.floor(dec), inch: Math.round((dec - Math.floor(dec)) * 12) });
            const fromFtIn = (ft: number, inch: number) => parseFloat((ft + inch / 12).toFixed(4));
            const wFI = toFtIn(selectedRoom.w);
            const hFI = toFtIn(selectedRoom.h);
            const sqFt = (selectedRoom.w * selectedRoom.h).toFixed(1);
            return (
              <div className="px-4 py-3 border-b border-slate-800 bg-slate-900/60">
                <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-2">Dimensions</p>
                {/* Width row */}
                <div className="mb-2">
                  <label className="text-[10px] text-slate-400 font-mono block mb-1">Width</label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number" min={0} max={200} step={1}
                      className="w-16 bg-slate-800 text-emerald-300 font-mono font-bold text-sm rounded-md px-2 py-2 border border-slate-600 focus:border-emerald-500 focus:outline-none text-center"
                      value={wFI.ft}
                      onChange={e => {
                        const ft = Math.max(0, parseInt(e.target.value, 10) || 0);
                        const newW = fromFtIn(ft, wFI.inch);
                        if (newW >= 1) onUpdateRoom({ ...selectedRoom, w: newW });
                      }}
                    />
                    <span className="text-slate-400 text-xs font-mono">ft</span>
                    <input
                      type="number" min={0} max={11} step={1}
                      className="w-14 bg-slate-800 text-emerald-300 font-mono font-bold text-sm rounded-md px-2 py-2 border border-slate-600 focus:border-emerald-500 focus:outline-none text-center"
                      value={wFI.inch}
                      onChange={e => {
                        const inch = Math.min(11, Math.max(0, parseInt(e.target.value, 10) || 0));
                        const newW = fromFtIn(wFI.ft, inch);
                        if (newW >= 1) onUpdateRoom({ ...selectedRoom, w: newW });
                      }}
                    />
                    <span className="text-slate-400 text-xs font-mono">in</span>
                    <span className="text-slate-500 text-[10px] font-mono ml-1">= {selectedRoom.w.toFixed(2)}′</span>
                  </div>
                </div>
                {/* Height row */}
                <div className="mb-2">
                  <label className="text-[10px] text-slate-400 font-mono block mb-1">Depth</label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number" min={0} max={200} step={1}
                      className="w-16 bg-slate-800 text-emerald-300 font-mono font-bold text-sm rounded-md px-2 py-2 border border-slate-600 focus:border-emerald-500 focus:outline-none text-center"
                      value={hFI.ft}
                      onChange={e => {
                        const ft = Math.max(0, parseInt(e.target.value, 10) || 0);
                        const newH = fromFtIn(ft, hFI.inch);
                        if (newH >= 1) onUpdateRoom({ ...selectedRoom, h: newH });
                      }}
                    />
                    <span className="text-slate-400 text-xs font-mono">ft</span>
                    <input
                      type="number" min={0} max={11} step={1}
                      className="w-14 bg-slate-800 text-emerald-300 font-mono font-bold text-sm rounded-md px-2 py-2 border border-slate-600 focus:border-emerald-500 focus:outline-none text-center"
                      value={hFI.inch}
                      onChange={e => {
                        const inch = Math.min(11, Math.max(0, parseInt(e.target.value, 10) || 0));
                        const newH = fromFtIn(hFI.ft, inch);
                        if (newH >= 1) onUpdateRoom({ ...selectedRoom, h: newH });
                      }}
                    />
                    <span className="text-slate-400 text-xs font-mono">in</span>
                    <span className="text-slate-500 text-[10px] font-mono ml-1">= {selectedRoom.h.toFixed(2)}′</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-1 text-[11px] font-mono text-slate-400">
                  <span className="text-emerald-400 font-bold">{sqFt} sq ft</span>
                  <span>·</span>
                  <span>Floor {selectedRoom.floor}</span>
                  <span>·</span>
                  <span>X: {selectedRoom.x.toFixed(1)}′  Y: {selectedRoom.y.toFixed(1)}′</span>
                </div>
              </div>
            );
          })()}

          {/* ── STAIRCASE DIRECTION ── */}
          {selectedRoom.type === 'staircase' && (
            <div className="px-4 py-3 border-b border-slate-800 bg-slate-900/60">
              <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-2">Going Up Direction</p>
              <div className="grid grid-cols-3 gap-1" style={{ maxWidth: 180 }}>
                <div />
                <button
                  className={`py-1.5 rounded text-xs font-mono font-bold border transition ${(stairDirs[selectedRoom.id] || 'n') === 'n' ? 'bg-emerald-500 text-slate-900 border-emerald-400' : 'bg-slate-800 text-slate-400 border-slate-600 hover:border-emerald-500 hover:text-emerald-400'}`}
                  onClick={() => setStairDirs(d => ({ ...d, [selectedRoom.id]: 'n' }))}
                >↑ N</button>
                <div />
                <button
                  className={`py-1.5 rounded text-xs font-mono font-bold border transition ${(stairDirs[selectedRoom.id] || 'n') === 'w' ? 'bg-emerald-500 text-slate-900 border-emerald-400' : 'bg-slate-800 text-slate-400 border-slate-600 hover:border-emerald-500 hover:text-emerald-400'}`}
                  onClick={() => setStairDirs(d => ({ ...d, [selectedRoom.id]: 'w' }))}
                >← W</button>
                <div className="flex items-center justify-center text-slate-600 text-xs">✦</div>
                <button
                  className={`py-1.5 rounded text-xs font-mono font-bold border transition ${(stairDirs[selectedRoom.id] || 'n') === 'e' ? 'bg-emerald-500 text-slate-900 border-emerald-400' : 'bg-slate-800 text-slate-400 border-slate-600 hover:border-emerald-500 hover:text-emerald-400'}`}
                  onClick={() => setStairDirs(d => ({ ...d, [selectedRoom.id]: 'e' }))}
                >E →</button>
                <div />
                <button
                  className={`py-1.5 rounded text-xs font-mono font-bold border transition ${(stairDirs[selectedRoom.id] || 'n') === 's' ? 'bg-emerald-500 text-slate-900 border-emerald-400' : 'bg-slate-800 text-slate-400 border-slate-600 hover:border-emerald-500 hover:text-emerald-400'}`}
                  onClick={() => setStairDirs(d => ({ ...d, [selectedRoom.id]: 's' }))}
                >↓ S</button>
                <div />
              </div>
              <p className="text-[10px] text-slate-500 font-mono mt-2">Arrow shows which direction stairs ascend to the next floor</p>
            </div>
          )}

          {/* ── DOORS ── */}
          <div className="px-4 pt-3 pb-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold font-mono text-amber-400 uppercase tracking-wide">🚪 Doors ({selectedRoom.doors.length})</span>
              <button
                className="text-xs bg-amber-500/20 hover:bg-amber-500/40 text-amber-300 px-3 py-1 rounded-md font-semibold border border-amber-500/30 transition"
                onClick={() => { setAddingDoor(!addingDoor); setAddingWindow(false); }}
              >+ Add Door</button>
            </div>

            {/* Add Door Form */}
            {addingDoor && (
              <div className="bg-slate-900/90 border border-amber-500/30 rounded-lg p-3 mb-3 text-xs">
                <p className="text-amber-400 font-bold mb-3 text-[11px] uppercase tracking-wide">New Door</p>
                <div className="flex flex-col gap-2">
                  <div>
                    <label className="text-slate-400 block mb-1 text-[11px]">Wall Side</label>
                    <select className="w-full bg-slate-800 text-white rounded-md text-xs px-2 py-1.5 border border-slate-600" value={newDoor.side} onChange={e => setNewDoor(p => ({ ...p, side: e.target.value as typeof p.side }))}>
                      <option value="front">Front Wall</option>
                      <option value="back">Back Wall</option>
                      <option value="left">Left Wall</option>
                      <option value="right">Right Wall</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1 text-[11px]">Width (ft)</label>
                    <input type="number" min={2} max={6} step={0.5} className="w-full bg-slate-800 text-white rounded-md text-xs px-2 py-1.5 border border-slate-600" value={newDoor.width} onChange={e => setNewDoor(p => ({ ...p, width: parseFloat(e.target.value) || 3 }))} />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1 text-[11px]">Open Direction</label>
                    <select className="w-full bg-slate-800 text-white rounded-md text-xs px-2 py-1.5 border border-slate-600" value={newDoor.openDirection} onChange={e => setNewDoor(p => ({ ...p, openDirection: e.target.value as typeof p.openDirection }))}>
                      <option value="in-left">In — Left swing</option>
                      <option value="in-right">In — Right swing</option>
                      <option value="out-left">Out — Left swing</option>
                      <option value="out-right">Out — Right swing</option>
                    </select>
                  </div>
                  <div className="flex gap-2 mt-1">
                    <button onClick={handleAddDoor} className="flex-1 bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold rounded-md py-1.5 text-xs transition">✓ Add Door</button>
                    <button onClick={() => setAddingDoor(false)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white rounded-md py-1.5 text-xs transition">Cancel</button>
                  </div>
                </div>
              </div>
            )}

            {/* Existing Doors List */}
            {selectedRoom.doors.map((d, idx) => (
              <div key={d.id} className="mb-2 bg-slate-900/60 border border-slate-700 rounded-lg p-2.5">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-mono font-bold text-amber-300">D{idx + 1} — {d.side.toUpperCase()} wall</span>
                  <div className="flex gap-1">
                    <button className="w-6 h-6 flex items-center justify-center rounded bg-slate-700 hover:bg-cyan-900 text-slate-400 hover:text-cyan-300 text-xs transition" onClick={() => setEditingDoorId(editingDoorId === d.id ? null : d.id)} title="Edit">✏</button>
                    <button className="w-6 h-6 flex items-center justify-center rounded bg-slate-700 hover:bg-red-900 text-slate-400 hover:text-red-300 text-xs transition" onClick={() => handleDeleteDoor(d.id)} title="Delete">✕</button>
                  </div>
                </div>
                <div className="text-[11px] text-slate-400 font-mono flex gap-3">
                  <span>Width: <span className="text-white">{d.width}ft</span></span>
                  <span>Offset: <span className="text-white">{d.offset}ft</span></span>
                </div>
                <div className="text-[10px] text-slate-500 font-mono mt-0.5">{d.openDirection}</div>

                {/* Edit inline */}
                {editingDoorId === d.id && (
                  <div className="mt-1.5 pt-1.5 border-t border-slate-700 flex flex-col gap-1">
                    <div className="flex gap-1 items-center">
                      <label className="text-slate-500 text-[9px] w-10 shrink-0">Side</label>
                      <select
                        className="flex-1 bg-slate-800 text-white rounded text-[9px] px-1 py-0.5 border border-slate-700"
                        value={d.side}
                        onChange={e => handleUpdateDoor(d.id, { side: e.target.value as typeof d.side })}
                      >
                        <option value="front">Front</option>
                        <option value="back">Back</option>
                        <option value="left">Left</option>
                        <option value="right">Right</option>
                      </select>
                    </div>
                    <div className="flex gap-1 items-center">
                      <label className="text-slate-500 text-[9px] w-10 shrink-0">Width</label>
                      <input type="number" min={2} max={6} step={0.5}
                        className="flex-1 bg-slate-800 text-white rounded text-[9px] px-1 py-0.5 border border-slate-700"
                        value={d.width}
                        onChange={e => handleUpdateDoor(d.id, { width: parseFloat(e.target.value) || d.width })}
                      />
                    </div>
                    <div className="flex gap-1 items-center">
                      <label className="text-slate-500 text-[9px] w-10 shrink-0">Offset</label>
                      <input type="number" min={0} max={20} step={0.5}
                        className="flex-1 bg-slate-800 text-white rounded text-[9px] px-1 py-0.5 border border-slate-700"
                        value={d.offset}
                        onChange={e => handleUpdateDoor(d.id, { offset: parseFloat(e.target.value) || d.offset })}
                      />
                    </div>
                    <div className="flex gap-1 items-center">
                      <label className="text-slate-500 text-[9px] w-10 shrink-0">Opens</label>
                      <select
                        className="flex-1 bg-slate-800 text-white rounded text-[9px] px-1 py-0.5 border border-slate-700"
                        value={d.openDirection}
                        onChange={e => handleUpdateDoor(d.id, { openDirection: e.target.value as typeof d.openDirection })}
                      >
                        <option value="in-left">In Left</option>
                        <option value="in-right">In Right</option>
                        <option value="out-left">Out Left</option>
                        <option value="out-right">Out Right</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {selectedRoom.doors.length === 0 && !addingDoor && (
              <p className="text-xs text-slate-500 font-mono italic pb-1 text-center py-2">No doors yet — click &quot;+ Add Door&quot;</p>
            )}
          </div>

          {/* ── WINDOWS ── */}
          <div className="px-4 pt-2 pb-3 border-t border-slate-800">
            <div className="flex items-center justify-between mb-2 mt-2">
              <span className="text-xs font-bold font-mono text-sky-400 uppercase tracking-wide">🪟 Windows ({selectedRoom.windows.length})</span>
              <button
                className="text-xs bg-sky-500/20 hover:bg-sky-500/40 text-sky-300 px-3 py-1 rounded-md font-semibold border border-sky-500/30 transition"
                onClick={() => { setAddingWindow(!addingWindow); setAddingDoor(false); }}
              >+ Add Window</button>
            </div>

            {/* Add Window Form */}
            {addingWindow && (
              <div className="bg-slate-900/90 border border-sky-500/30 rounded-lg p-3 mb-3 text-xs">
                <p className="text-sky-400 font-bold mb-3 text-[11px] uppercase tracking-wide">New Window</p>
                <div className="flex flex-col gap-2">
                  <div>
                    <label className="text-slate-400 block mb-1 text-[11px]">Wall Side</label>
                    <select className="w-full bg-slate-800 text-white rounded-md text-xs px-2 py-1.5 border border-slate-600" value={newWindow.side} onChange={e => setNewWindow(p => ({ ...p, side: e.target.value as typeof p.side }))}>
                      <option value="front">Front Wall</option>
                      <option value="back">Back Wall</option>
                      <option value="left">Left Wall</option>
                      <option value="right">Right Wall</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1 text-[11px]">Width (ft)</label>
                    <input type="number" min={2} max={8} step={0.5} className="w-full bg-slate-800 text-white rounded-md text-xs px-2 py-1.5 border border-slate-600" value={newWindow.width} onChange={e => setNewWindow(p => ({ ...p, width: parseFloat(e.target.value) || 4 }))} />
                  </div>
                  <div className="flex gap-2 mt-1">
                    <button onClick={handleAddWindow} className="flex-1 bg-sky-500 hover:bg-sky-400 text-slate-900 font-bold rounded-md py-1.5 text-xs transition">✓ Add Window</button>
                    <button onClick={() => setAddingWindow(false)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white rounded-md py-1.5 text-xs transition">Cancel</button>
                  </div>
                </div>
              </div>
            )}

            {/* Existing Windows List */}
            {selectedRoom.windows.map((w, idx) => (
              <div key={w.id} className="mb-2 bg-slate-900/60 border border-slate-700 rounded-lg p-2.5">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-mono font-bold text-sky-300">W{idx + 1} — {w.side.toUpperCase()} wall</span>
                  <div className="flex gap-1">
                    <button className="w-6 h-6 flex items-center justify-center rounded bg-slate-700 hover:bg-cyan-900 text-slate-400 hover:text-cyan-300 text-xs transition" onClick={() => setEditingWindowId(editingWindowId === w.id ? null : w.id)} title="Edit">✏</button>
                    <button className="w-6 h-6 flex items-center justify-center rounded bg-slate-700 hover:bg-red-900 text-slate-400 hover:text-red-300 text-xs transition" onClick={() => handleDeleteWindow(w.id)} title="Delete">✕</button>
                  </div>
                </div>
                <div className="text-[11px] text-slate-400 font-mono flex gap-3">
                  <span>Width: <span className="text-white">{w.width}ft</span></span>
                  <span>Offset: <span className="text-white">{w.offset}ft</span></span>
                </div>
                <div className="text-[10px] text-slate-500 font-mono mt-0.5">drag on canvas to reposition</div>

                {/* Edit inline */}
                {editingWindowId === w.id && (
                  <div className="mt-1.5 pt-1.5 border-t border-slate-700 flex flex-col gap-1">
                    <div className="flex gap-1 items-center">
                      <label className="text-slate-500 text-[9px] w-10 shrink-0">Side</label>
                      <select
                        className="flex-1 bg-slate-800 text-white rounded text-[9px] px-1 py-0.5 border border-slate-700"
                        value={w.side}
                        onChange={e => handleUpdateWindow(w.id, { side: e.target.value as typeof w.side })}
                      >
                        <option value="front">Front</option>
                        <option value="back">Back</option>
                        <option value="left">Left</option>
                        <option value="right">Right</option>
                      </select>
                    </div>
                    <div className="flex gap-1 items-center">
                      <label className="text-slate-500 text-[9px] w-10 shrink-0">Width</label>
                      <input type="number" min={1} max={10} step={0.5}
                        className="flex-1 bg-slate-800 text-white rounded text-[9px] px-1 py-0.5 border border-slate-700"
                        value={w.width}
                        onChange={e => handleUpdateWindow(w.id, { width: parseFloat(e.target.value) || w.width })}
                      />
                    </div>
                    <div className="flex gap-1 items-center">
                      <label className="text-slate-500 text-[9px] w-10 shrink-0">Offset</label>
                      <input type="number" min={0} max={20} step={0.5}
                        className="flex-1 bg-slate-800 text-white rounded text-[9px] px-1 py-0.5 border border-slate-700"
                        value={w.offset}
                        onChange={e => handleUpdateWindow(w.id, { offset: parseFloat(e.target.value) || w.offset })}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
            {selectedRoom.windows.length === 0 && !addingWindow && (
              <p className="text-xs text-slate-500 font-mono italic pb-1 text-center py-2">No windows yet — click &quot;+ Add Window&quot;</p>
            )}
          </div>

          {/* Tip */}
          <div className="px-4 py-2.5 border-t border-slate-800 bg-slate-950/60 text-[11px] text-slate-500 font-mono flex items-center gap-2">
            <span>💡</span>
            <span>Drag doors/windows on canvas to reposition</span>
          </div>
        </div>
      )}

      {/* Legal Disclaimer */}
      <div className="glass-panel px-4 py-2 border-t border-slate-800 flex items-center gap-3 text-red-500 font-mono text-[9px] shrink-0">
        <ShieldAlert size={14} className="shrink-0 animate-pulse text-red-500" />
        <div className="leading-normal flex-1">
          <strong className="text-red-400">WARNING: PRELIMINARY AI DRAFT.</strong> Verified structural, electrical, plumbing, and fire safety systems are required from licensed professionals prior to construction.
        </div>
      </div>
    </div>
  );
}
