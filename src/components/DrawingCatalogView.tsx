'use client';
import { useState, useMemo, useRef } from 'react';
import type { LayoutOption, PlotSettings } from '@/types';
import { getCatalog, APPROVAL, type Discipline } from '@/lib/engineeringSuite';

interface Props {
  discipline: Discipline;
  title: string;
  layoutOptions: LayoutOption[] | null;
  selectedLayoutId: 'option-a' | 'option-b' | 'option-c';
  settings: PlotSettings;
  floors: number;
}

export default function DrawingCatalogView({ discipline, title, layoutOptions, selectedLayoutId, settings, floors }: Props) {
  const catalog = useMemo(() => getCatalog(discipline), [discipline]);
  const [optionId, setOptionId] = useState<'option-a' | 'option-b' | 'option-c'>(selectedLayoutId);
  const [floor, setFloor] = useState(0);
  const [drawingId, setDrawingId] = useState(catalog[0]?.id);
  const viewRef = useRef<HTMLDivElement>(null);

  const option = layoutOptions?.find(o => o.id === optionId) || layoutOptions?.[0];
  const floorRooms = (option?.rooms || []).filter(r => r.floor === floor);
  const drawing = catalog.find(d => d.id === drawingId) || catalog[0];
  const html = useMemo(
    () => (drawing && floorRooms.length ? drawing.render(floorRooms, settings) : '<p style="font-family:monospace;color:#64748b;padding:24px">No rooms on this floor for this option.</p>'),
    [drawing, floorRooms, settings],
  );

  const categories = useMemo(() => {
    const map = new Map<string, typeof catalog>();
    catalog.forEach(d => { if (!map.has(d.category)) map.set(d.category, []); map.get(d.category)!.push(d); });
    return [...map.entries()];
  }, [catalog]);

  const floorTabs = Array.from({ length: floors }, (_, i) => i);

  const exportRaster = (mime: 'image/png' | 'image/jpeg') => {
    const svg = viewRef.current?.querySelector('svg');
    if (!svg) { alert('This sheet is a table — use Export → PDF for tables.'); return; }
    const xml = new XMLSerializer().serializeToString(svg);
    const w = svg.viewBox.baseVal.width || svg.clientWidth || 800;
    const h = svg.viewBox.baseVal.height || svg.clientHeight || 600;
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = w * 2; c.height = h * 2;
      const ctx = c.getContext('2d')!;
      ctx.scale(2, 2);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      c.toBlob(blob => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `${title}_${optionId}_${drawing.id}.${mime === 'image/png' ? 'png' : 'jpg'}`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
      }, mime, 0.95);
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(xml)));
  };
  const exportSVG = () => {
    const svg = viewRef.current?.querySelector('svg');
    if (!svg) { alert('This sheet is a table.'); return; }
    const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `${title}_${optionId}_${drawing.id}.svg`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  const chip = (active: boolean): React.CSSProperties => ({
    padding: '5px 12px', borderRadius: 100, fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-body)',
    border: `1.5px solid ${active ? 'var(--blueprint)' : 'var(--line-strong)'}`,
    backgroundColor: active ? 'var(--blueprint)' : 'white', color: active ? 'white' : 'var(--steel)', fontWeight: active ? 600 : 400,
  });

  return (
    <div>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 300, marginBottom: 12 }}>{title}</h2>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 10, alignItems: 'center' }}>
        {layoutOptions && layoutOptions.length > 1 && (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: 'var(--steel)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>Option:</span>
            {layoutOptions.map((o, i) => (
              <button key={o.id} onClick={() => setOptionId(o.id)} style={{ ...chip(optionId === o.id), borderColor: optionId === o.id ? 'var(--amber)' : 'var(--line-strong)', backgroundColor: optionId === o.id ? 'var(--amber)' : 'white' }}>
                {String.fromCharCode(65 + i)} · {o.name}
              </button>
            ))}
          </div>
        )}
        {floors > 1 && (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--steel)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>Floor:</span>
            {floorTabs.map(f => (
              <button key={f} onClick={() => setFloor(f)} style={chip(floor === f)}>{f === 0 ? 'Ground' : f === 1 ? 'First' : 'Second'}</button>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
          <button onClick={() => exportRaster('image/png')} style={{ ...chip(false), borderColor: 'var(--blueprint)', color: 'var(--blueprint)' }}>⬇ PNG</button>
          <button onClick={() => exportRaster('image/jpeg')} style={{ ...chip(false), borderColor: 'var(--blueprint)', color: 'var(--blueprint)' }}>⬇ JPG</button>
          <button onClick={exportSVG} style={{ ...chip(false), borderColor: 'var(--blueprint)', color: 'var(--blueprint)' }}>⬇ SVG</button>
        </div>
      </div>

      {/* Approval banner */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, padding: '7px 14px', borderRadius: 6, backgroundColor: '#fef2f2', border: '1px solid #fecaca' }}>
        <span>⚠</span>
        <span style={{ fontSize: 12, color: '#b91c1c', fontWeight: 600 }}>{APPROVAL[discipline]}</span>
        <span style={{ fontSize: 11, color: '#7f1d1d' }}>— AI draft concept for {optionId.replace('option-', 'Option ').toUpperCase()}. Not for construction.</span>
      </div>

      {/* Body: sidebar list + drawing */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 220px) 1fr', gap: 16, alignItems: 'start' }}>
        <div style={{ border: '1px solid var(--line)', borderRadius: 8, backgroundColor: 'white', padding: 8, maxHeight: '70vh', overflowY: 'auto' }}>
          {categories.map(([cat, items]) => (
            <div key={cat} style={{ marginBottom: 6 }}>
              <div style={{ fontSize: 9.5, color: 'var(--steel)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '6px 8px 2px' }}>{cat}</div>
              {items.map(d => (
                <button key={d.id} onClick={() => setDrawingId(d.id)} style={{
                  display: 'block', width: '100%', textAlign: 'left', padding: '7px 10px', borderRadius: 5, border: 'none', cursor: 'pointer',
                  backgroundColor: drawingId === d.id ? 'rgba(26,39,68,0.07)' : 'transparent',
                  color: drawingId === d.id ? 'var(--blueprint)' : 'var(--ink)', fontWeight: drawingId === d.id ? 600 : 400,
                  fontSize: 12.5, fontFamily: 'var(--font-body)',
                }}>{d.name}</button>
              ))}
            </div>
          ))}
        </div>
        <div ref={viewRef} style={{ border: '1px solid var(--line)', borderRadius: 8, backgroundColor: '#fcfcfa', padding: 16, overflow: 'auto', minHeight: 360, maxHeight: '74vh' }}
          dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </div>
  );
}
