'use client';
import { useState } from 'react';
import type { FloorPlan, FurnitureItem } from '@/types';

interface CatalogProduct {
  id: string;
  name: string;
  category: string;
  width: number;   // grid units (5ft each)
  height: number;
  color: string;
  svgShape: 'rect' | 'circle' | 'l-shape' | 'u-shape';
  description: string;
  price: string;
}

const CATALOG: CatalogProduct[] = [
  // Living Room
  { id: 'sofa-3s', name: '3-Seat Sofa', category: 'Living Room', width: 2, height: 1, color: '#94a3b8', svgShape: 'rect', description: 'Contemporary fabric sofa, 7ft wide', price: '₹45K–₹1.2L' },
  { id: 'sofa-2s', name: '2-Seat Sofa', category: 'Living Room', width: 1, height: 1, color: '#94a3b8', svgShape: 'rect', description: 'Compact loveseat, 5ft wide', price: '₹25K–₹70K' },
  { id: 'armchair', name: 'Armchair', category: 'Living Room', width: 1, height: 1, color: '#b0c4de', svgShape: 'rect', description: 'Single accent chair', price: '₹12K–₹40K' },
  { id: 'coffee-table', name: 'Coffee Table', category: 'Living Room', width: 1, height: 1, color: '#c4a882', svgShape: 'rect', description: 'Center table, 3×2ft', price: '₹8K–₹25K' },
  { id: 'tv-unit', name: 'TV Unit', category: 'Living Room', width: 2, height: 1, color: '#8b6f5c', svgShape: 'rect', description: 'Wall-mounted TV console, 6ft', price: '₹18K–₹60K' },
  { id: 'bookshelf', name: 'Bookshelf', category: 'Living Room', width: 1, height: 1, color: '#a0856d', svgShape: 'rect', description: 'Freestanding bookcase, 3×6ft', price: '₹10K–₹35K' },
  // Dining
  { id: 'dining-6', name: 'Dining Table (6)', category: 'Dining', width: 2, height: 1, color: '#c4a882', svgShape: 'rect', description: '6-seater dining table', price: '₹20K–₹80K' },
  { id: 'dining-4', name: 'Dining Table (4)', category: 'Dining', width: 1, height: 1, color: '#c4a882', svgShape: 'rect', description: '4-seater dining table', price: '₹12K–₹45K' },
  { id: 'dining-chair', name: 'Dining Chair', category: 'Dining', width: 1, height: 1, color: '#8b7355', svgShape: 'rect', description: 'Upholstered dining chair', price: '₹3K–₹12K' },
  { id: 'sideboard', name: 'Sideboard', category: 'Dining', width: 2, height: 1, color: '#9a7b5c', svgShape: 'rect', description: 'Dining room storage, 5ft', price: '₹15K–₹50K' },
  // Bedroom
  { id: 'bed-king', name: 'King Bed', category: 'Bedroom', width: 2, height: 2, color: '#c4b0e0', svgShape: 'rect', description: 'King size bed 6×6.5ft', price: '₹30K–₹1.5L' },
  { id: 'bed-queen', name: 'Queen Bed', category: 'Bedroom', width: 2, height: 2, color: '#c4b0e0', svgShape: 'rect', description: 'Queen size bed 5×6.5ft', price: '₹20K–₹90K' },
  { id: 'bed-single', name: 'Single Bed', category: 'Bedroom', width: 1, height: 2, color: '#d4c0f0', svgShape: 'rect', description: 'Single bed 3×6ft', price: '₹8K–₹40K' },
  { id: 'wardrobe-2d', name: 'Wardrobe (2-door)', category: 'Bedroom', width: 1, height: 1, color: '#a08060', svgShape: 'rect', description: '2-door sliding wardrobe', price: '₹25K–₹80K' },
  { id: 'wardrobe-3d', name: 'Wardrobe (3-door)', category: 'Bedroom', width: 2, height: 1, color: '#a08060', svgShape: 'rect', description: '3-door full-height wardrobe', price: '₹40K–₹1.2L' },
  { id: 'side-table', name: 'Bedside Table', category: 'Bedroom', width: 1, height: 1, color: '#b89878', svgShape: 'rect', description: 'Nightstand with drawer', price: '₹3K–₹15K' },
  { id: 'study-desk', name: 'Study Desk', category: 'Bedroom', width: 1, height: 1, color: '#9a8870', svgShape: 'rect', description: 'Writing desk 4×2ft', price: '₹6K–₹25K' },
  { id: 'dressing', name: 'Dressing Table', category: 'Bedroom', width: 1, height: 1, color: '#b8a890', svgShape: 'rect', description: 'Dressing table with mirror', price: '₹8K–₹30K' },
  // Kitchen
  { id: 'kitchen-l', name: 'L-Kitchen Counter', category: 'Kitchen', width: 2, height: 2, color: '#f0d080', svgShape: 'l-shape', description: 'L-shaped modular kitchen', price: '₹1.5L–₹4L' },
  { id: 'kitchen-straight', name: 'Straight Counter', category: 'Kitchen', width: 2, height: 1, color: '#f0d080', svgShape: 'rect', description: 'Straight modular kitchen', price: '₹80K–₹2L' },
  { id: 'fridge', name: 'Refrigerator', category: 'Kitchen', width: 1, height: 1, color: '#c0d0e0', svgShape: 'rect', description: 'Double-door fridge', price: '₹25K–₹80K' },
  { id: 'island', name: 'Kitchen Island', category: 'Kitchen', width: 1, height: 1, color: '#e8c870', svgShape: 'rect', description: 'Center island with storage', price: '₹40K–₹1.5L' },
  // Bathroom
  { id: 'toilet', name: 'WC (Toilet)', category: 'Bathroom', width: 1, height: 1, color: '#c8f0d8', svgShape: 'rect', description: 'Wall-mounted WC', price: '₹8K–₹30K' },
  { id: 'bathtub', name: 'Bathtub', category: 'Bathroom', width: 1, height: 2, color: '#a0e8f0', svgShape: 'rect', description: 'Freestanding bathtub', price: '₹30K–₹1.5L' },
  { id: 'shower', name: 'Shower Enclosure', category: 'Bathroom', width: 1, height: 1, color: '#b8e8f8', svgShape: 'rect', description: 'Frameless glass shower', price: '₹15K–₹60K' },
  { id: 'vanity', name: 'Vanity Unit', category: 'Bathroom', width: 1, height: 1, color: '#d8e8f0', svgShape: 'rect', description: 'Double-sink vanity', price: '₹20K–₹80K' },
  // Outdoor
  { id: 'planter', name: 'Planter Box', category: 'Balcony', width: 1, height: 1, color: '#88cc88', svgShape: 'rect', description: 'Outdoor planter 3×2ft', price: '₹2K–₹8K' },
  { id: 'outdoor-chair', name: 'Outdoor Chair', category: 'Balcony', width: 1, height: 1, color: '#a0b890', svgShape: 'rect', description: 'Weather-proof lounge chair', price: '₹5K–₹20K' },
  { id: 'swing', name: 'Balcony Swing', category: 'Balcony', width: 1, height: 1, color: '#b8d8a0', svgShape: 'rect', description: 'Hanging swing chair', price: '₹8K–₹30K' },
];

const CATEGORIES = [...new Set(CATALOG.map(p => p.category))];

function ProductSVG({ product, size = 40 }: { product: CatalogProduct; size?: number }) {
  const s = size;
  const c = product.color;
  if (product.svgShape === 'l-shape') {
    return (
      <svg width={s} height={s} viewBox="0 0 40 40">
        <rect x="2" y="2" width="24" height="10" fill={c} stroke="#555" strokeWidth="1.5" rx="2"/>
        <rect x="2" y="12" width="10" height="26" fill={c} stroke="#555" strokeWidth="1.5" rx="2"/>
      </svg>
    );
  }
  return (
    <svg width={s} height={s} viewBox="0 0 40 40">
      <rect x="3" y="3" width="34" height="34" fill={c} stroke="#555" strokeWidth="1.5" rx="3"/>
      {product.category === 'Bedroom' && product.id.includes('bed') && (
        <>
          <rect x="3" y="3" width="34" height="10" fill={c} stroke="#555" strokeWidth="1" opacity="0.7"/>
          <line x1="3" y1="13" x2="37" y2="13" stroke="#555" strokeWidth="0.8"/>
        </>
      )}
      {product.category === 'Living Room' && product.id.includes('sofa') && (
        <>
          <rect x="3" y="3" width="34" height="8" fill="rgba(255,255,255,0.3)" stroke="#555" strokeWidth="0.5"/>
          <rect x="3" y="3" width="6" height="34" fill="rgba(255,255,255,0.3)" stroke="#555" strokeWidth="0.5"/>
          <rect x="31" y="3" width="6" height="34" fill="rgba(255,255,255,0.3)" stroke="#555" strokeWidth="0.5"/>
        </>
      )}
    </svg>
  );
}

interface Props {
  floorPlans: FloorPlan[];
  onPlansChange: (plans: FloorPlan[]) => void;
  activeFloor: number;
}

export default function InteriorProductsCatalog({ floorPlans, onPlansChange, activeFloor }: Props) {
  const [activeCategory, setActiveCategory] = useState(CATEGORIES[0]);
  const [placedItems, setPlacedItems] = useState<FurnitureItem[]>(() =>
    floorPlans.flatMap(p => p.furniture || [])
  );
  const [selectedFloor, setSelectedFloor] = useState(activeFloor);
  const [dragProduct, setDragProduct] = useState<CatalogProduct | null>(null);
  const [movingItem, setMovingItem] = useState<{
    id: string; origX: number; origY: number; startMX: number; startMY: number;
  } | null>(null);
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);

  const currentPlan = floorPlans[selectedFloor];
  const maxX = Math.max(...(currentPlan?.rooms.map(r => r.x + r.width) || [8])) + 2;
  const maxY = Math.max(...(currentPlan?.rooms.map(r => r.y + r.height) || [8])) + 2;
  const CELL = 36;

  const addFurniture = (product: CatalogProduct, gx: number, gy: number) => {
    const item: FurnitureItem = {
      id: `furn_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      catalogId: product.id,
      name: product.name,
      category: product.category,
      x: gx, y: gy,
      width: product.width, height: product.height,
      floor: selectedFloor,
      color: product.color,
    };
    const newItems = [...placedItems, item];
    setPlacedItems(newItems);
    const updatedPlans = floorPlans.map((p, i) =>
      i === selectedFloor ? { ...p, furniture: newItems.filter(f => f.floor === i) } : p
    );
    onPlansChange(updatedPlans);
  };

  const removeItem = (itemId: string) => {
    const newItems = placedItems.filter(f => f.id !== itemId);
    setPlacedItems(newItems);
    const updatedPlans = floorPlans.map((p, i) => ({
      ...p, furniture: newItems.filter(f => f.floor === i),
    }));
    onPlansChange(updatedPlans);
  };

  const updateItemPos = (itemId: string, x: number, y: number) => {
    const newItems = placedItems.map(f => f.id === itemId ? { ...f, x, y } : f);
    setPlacedItems(newItems);
    const updatedPlans = floorPlans.map((p, i) => ({
      ...p, furniture: newItems.filter(f => f.floor === i),
    }));
    onPlansChange(updatedPlans);
  };

  const handleSvgMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!movingItem) return;
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const dx = Math.round((e.clientX - movingItem.startMX) / CELL);
    const dy = Math.round((e.clientY - movingItem.startMY) / CELL);
    const newX = Math.max(0, movingItem.origX + dx);
    const newY = Math.max(0, movingItem.origY + dy);
    updateItemPos(movingItem.id, newX, newY);
  };

  const handleSvgMouseUp = () => setMovingItem(null);

  const handleFloorDrop = (e: React.DragEvent<SVGSVGElement>) => {
    e.preventDefault();
    if (!dragProduct) return;
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const BORDER = CELL;
    const gx = Math.max(0, Math.floor((e.clientX - rect.left - BORDER) / CELL));
    const gy = Math.max(0, Math.floor((e.clientY - rect.top - BORDER) / CELL));
    addFurniture(dragProduct, gx, gy);
    setDragProduct(null);
  };

  const floorItems = placedItems.filter(f => f.floor === selectedFloor);
  const BORDER = CELL;

  return (
    <div style={{ display: 'flex', gap: 20 }}>
      {/* Left: Catalog */}
      <div style={{ width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 0, border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden', backgroundColor: 'white' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--line)', backgroundColor: '#f8f9fa' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>Furniture & Fixtures Catalog</div>
          <div style={{ fontSize: 11, color: 'var(--steel)' }}>Drag items onto the floor plan</div>
        </div>

        {/* Category tabs */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: '10px 12px', borderBottom: '1px solid var(--line)' }}>
          {CATEGORIES.map(cat => (
            <button key={cat} onClick={() => setActiveCategory(cat)} style={{
              padding: '3px 10px', borderRadius: 12, fontSize: 10, fontWeight: 500,
              border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)',
              backgroundColor: activeCategory === cat ? 'var(--blueprint)' : 'rgba(26,39,68,0.07)',
              color: activeCategory === cat ? 'white' : 'var(--steel)',
            }}>
              {cat}
            </button>
          ))}
        </div>

        {/* Products */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {CATALOG.filter(p => p.category === activeCategory).map(product => (
            <div
              key={product.id}
              draggable
              onDragStart={() => setDragProduct(product)}
              onDragEnd={() => setDragProduct(null)}
              style={{
                display: 'flex', gap: 10, padding: '8px 14px', cursor: 'grab',
                borderBottom: '1px solid rgba(0,0,0,0.04)',
                transition: 'background 0.1s',
                userSelect: 'none',
              }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(74,114,196,0.06)')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <div style={{ flexShrink: 0, width: 40, height: 40, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fafafa' }}>
                <ProductSVG product={product} size={36} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink)', marginBottom: 1 }}>{product.name}</div>
                <div style={{ fontSize: 10, color: 'var(--steel)', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{product.description}</div>
                <div style={{ fontSize: 10, color: '#16a34a', fontFamily: 'var(--font-mono)' }}>{product.price}</div>
              </div>
              <button
                onClick={() => addFurniture(product, 1, 1)}
                style={{ flexShrink: 0, padding: '3px 8px', borderRadius: 4, border: '1px solid var(--blueprint)', backgroundColor: 'white', color: 'var(--blueprint)', fontSize: 11, cursor: 'pointer' }}
              >
                +
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Right: Floor plan + placed items */}
      <div style={{ flex: 1 }}>
        {/* Floor selector */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: 'var(--steel)' }}>Floor:</span>
          {floorPlans.map((_, i) => (
            <button key={i} onClick={() => setSelectedFloor(i)} style={{
              padding: '5px 14px', borderRadius: 4, fontSize: 12,
              border: `1.5px solid ${selectedFloor === i ? 'var(--blueprint)' : 'var(--line-strong)'}`,
              backgroundColor: selectedFloor === i ? 'var(--blueprint)' : 'white',
              color: selectedFloor === i ? 'white' : 'var(--steel)',
              cursor: 'pointer', fontFamily: 'var(--font-body)',
            }}>
              {i === 0 ? 'Ground' : i === 1 ? '1st' : i === 2 ? '2nd' : `${i}th`} Floor
            </button>
          ))}
          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--steel)' }}>
            {floorItems.length} item{floorItems.length !== 1 ? 's' : ''} placed
          </span>
        </div>

        {/* SVG Floor plan with furniture */}
        <div style={{ border: '1px solid var(--line)', borderRadius: 8, overflow: 'auto', backgroundColor: 'white', marginBottom: 16 }}>
          <svg
            width={maxX * CELL + BORDER * 2}
            height={maxY * CELL + BORDER * 2}
            viewBox={`0 0 ${maxX * CELL + BORDER * 2} ${maxY * CELL + BORDER * 2}`}
            style={{ display: 'block', cursor: movingItem ? 'grabbing' : 'default' }}
            onDragOver={e => e.preventDefault()}
            onDrop={handleFloorDrop}
            onMouseMove={handleSvgMouseMove}
            onMouseUp={handleSvgMouseUp}
            onMouseLeave={handleSvgMouseUp}
          >
            <rect width={maxX * CELL + BORDER * 2} height={maxY * CELL + BORDER * 2} fill="white" />

            {/* Light grid */}
            {Array.from({ length: maxX + 2 }).map((_, i) => (
              <line key={`vg${i}`} x1={BORDER + i * CELL} y1={0} x2={BORDER + i * CELL} y2={maxY * CELL + BORDER * 2}
                stroke="rgba(74,114,196,0.06)" strokeWidth="0.5" />
            ))}
            {Array.from({ length: maxY + 2 }).map((_, i) => (
              <line key={`hg${i}`} x1={0} y1={BORDER + i * CELL} x2={maxX * CELL + BORDER * 2} y2={BORDER + i * CELL}
                stroke="rgba(74,114,196,0.06)" strokeWidth="0.5" />
            ))}

            {/* Plot */}
            <rect x={BORDER} y={BORDER} width={maxX * CELL} height={maxY * CELL}
              fill="rgba(245,243,238,0.3)" stroke="#1a2744" strokeWidth="2" />

            {/* Rooms */}
            {currentPlan?.rooms.map(room => {
              const rx = BORDER + room.x * CELL;
              const ry = BORDER + room.y * CELL;
              const rw = room.width * CELL;
              const rh = room.height * CELL;
              return (
                <g key={room.id}>
                  <rect x={rx + 1.5} y={ry + 1.5} width={rw - 3} height={rh - 3}
                    fill={room.color} opacity="0.85" />
                  <rect x={rx} y={ry} width={rw} height={rh}
                    fill="none" stroke="#1a2744" strokeWidth="2" />
                  {rw > 60 && rh > 40 && (
                    <text x={rx + rw / 2} y={ry + rh / 2} textAnchor="middle" dominantBaseline="middle"
                      fontSize={Math.min(9, rw / room.name.length * 1.3)} fill="#1a2744" fontWeight="500"
                      fontFamily="sans-serif" style={{ pointerEvents: 'none' }}>
                      {room.name}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Placed furniture */}
            {floorItems.map(item => {
              const ix = BORDER + item.x * CELL;
              const iy = BORDER + item.y * CELL;
              const iw = item.width * CELL;
              const ih = item.height * CELL;
              const isHovered = hoveredItemId === item.id;
              const isMoving = movingItem?.id === item.id;
              return (
                <g key={item.id}
                  style={{ cursor: isMoving ? 'grabbing' : 'grab' }}
                  onMouseEnter={() => setHoveredItemId(item.id)}
                  onMouseLeave={() => setHoveredItemId(null)}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    setMovingItem({ id: item.id, origX: item.x, origY: item.y, startMX: e.clientX, startMY: e.clientY });
                  }}
                >
                  <rect x={ix + 1} y={iy + 1} width={iw - 2} height={ih - 2}
                    fill={item.color || '#94a3b8'} stroke={isHovered ? '#2563eb' : '#334155'}
                    strokeWidth={isHovered ? 2 : 1.2} rx="2" opacity="0.85" />
                  {iw > 30 && ih > 20 && (
                    <text x={ix + iw / 2} y={iy + ih / 2} textAnchor="middle" dominantBaseline="middle"
                      fontSize={Math.min(8, iw / item.name.length * 1.3)} fill="#1e293b"
                      fontFamily="sans-serif" style={{ pointerEvents: 'none' }}>
                      {item.name}
                    </text>
                  )}
                  {/* Delete button — only visible on hover */}
                  {isHovered && (
                    <g onClick={(e) => { e.stopPropagation(); removeItem(item.id); }} style={{ cursor: 'pointer' }}>
                      <circle cx={ix + iw - 6} cy={iy + 6} r={6} fill="#dc2626" />
                      <text x={ix + iw - 6} y={iy + 9.5} textAnchor="middle" fontSize="8"
                        fill="white" fontWeight="700" style={{ pointerEvents: 'none' }}>✕</text>
                    </g>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {/* Placed items list */}
        {floorItems.length > 0 && (
          <div style={{ border: '1px solid var(--line)', borderRadius: 8, backgroundColor: 'white', overflow: 'hidden' }}>
            <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--line)', fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>
              Placed Items — Floor {selectedFloor === 0 ? 'G' : selectedFloor}
            </div>
            <div style={{ maxHeight: 180, overflowY: 'auto' }}>
              {floorItems.map(item => (
                <div key={item.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '7px 16px', borderBottom: '1px solid rgba(0,0,0,0.04)',
                }}>
                  <div style={{ width: 12, height: 12, borderRadius: 2, backgroundColor: item.color || '#94a3b8', flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 12, color: 'var(--ink)' }}>{item.name}</span>
                  <span style={{ fontSize: 10, color: 'var(--steel)', fontFamily: 'var(--font-mono)' }}>
                    {item.width * 5}×{item.height * 5}ft
                  </span>
                  <button onClick={() => removeItem(item.id)}
                    style={{ padding: '2px 8px', borderRadius: 3, border: '1px solid #fca5a5', backgroundColor: '#fee2e2', color: '#dc2626', fontSize: 10, cursor: 'pointer' }}>
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
