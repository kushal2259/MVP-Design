'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { saveProject, generateId } from '@/lib/store';
import { generateMixedUse } from '@/lib/mixedUseEngine';
import ModuleWizardShell, { fieldLabel, fieldInput, chip } from '@/components/ModuleWizardShell';
import type { Project } from '@/types';

const ACCENT = '#0d9488';
type BHK2 = '1bhk' | '2bhk';

export default function NewMixedUseProject() {
  const router = useRouter();
  const [generating, setGenerating] = useState(false);
  const [name, setName] = useState('');
  const [width, setWidth] = useState(90);
  const [depth, setDepth] = useState(70);
  const [commercialFloors, setCommercialFloors] = useState<1 | 2>(2);
  const [residentialFloors, setResidentialFloors] = useState(4);
  const [shopsPerFloor, setShopsPerFloor] = useState(6);
  const [unitsPerFloor, setUnitsPerFloor] = useState<2 | 3>(2);
  const [unitMix, setUnitMix] = useState<BHK2[]>(['2bhk', '1bhk']);
  const [location, setLocation] = useState('Pune, Maharashtra');
  const [budget, setBudget] = useState(1500);

  const setUnits = (n: 2 | 3) => { setUnitsPerFloor(n); setUnitMix(prev => { const m = prev.slice(0, n); while (m.length < n) m.push('2bhk'); return m; }); };

  const generate = async () => {
    setGenerating(true);
    const config = { plotWidth: width, plotDepth: depth, commercialFloors, residentialFloors, shopsPerFloor, unitsPerFloor, unitMix, location, budgetLakhs: budget };
    const result = generateMixedUse(config);
    const id = generateId();
    const totalFloors = commercialFloors + residentialFloors;
    const project: Project = {
      id, name: name || `Mixed-Use — G+${totalFloors - 1} (${location.split(',')[0]})`,
      buildingType: 'mixed-use', status: 'generated', createdAt: new Date().toISOString(),
      requirements: { plotSize: Math.round(width * depth / 9), plotWidth: width, plotDepth: depth, plotShape: 'rectangular', location, floors: result.floorLabels.length, budget, style: 'modern', bhk: 2, specialRooms: [], requirements: `Mixed-use: ${commercialFloors} commercial + ${residentialFloors} residential floors` },
      plotSettings: { width, depth, location, floors: result.floorLabels.length, style: 'modern', budgetLakhs: budget, bedrooms: 2, kitchenStyle: 'large', balconyRequired: true },
      moduleData: { config, stats: result.stats, floorLabels: result.floorLabels, rooms: result.rooms },
    };
    await saveProject(project);
    router.push(`/mixed-use/${id}`);
  };

  return (
    <ModuleWizardShell title="New Mixed-Use Project" subtitle="Shops/offices below, apartments above — combined cores, separated services, full drawing set." accent={ACCENT} dashboardHref="/dashboard/mixed-use" generating={generating} canGenerate={!!width && !!depth} generateLabel="Generate Mixed-Use Design →" onGenerate={generate}>
      <div><label style={fieldLabel}>Project Name</label><input style={fieldInput} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Market Square Plaza" /></div>
      <div style={{ display: 'flex', gap: 16 }}>
        <div style={{ flex: 1 }}><label style={fieldLabel}>Plot Width (ft)</label><input type="number" style={fieldInput} value={width} onChange={e => setWidth(+e.target.value)} /></div>
        <div style={{ flex: 1 }}><label style={fieldLabel}>Plot Depth (ft)</label><input type="number" style={fieldInput} value={depth} onChange={e => setDepth(+e.target.value)} /></div>
      </div>
      <div style={{ display: 'flex', gap: 16 }}>
        <div style={{ flex: 1 }}><label style={fieldLabel}>Commercial Floors</label>
          <div style={{ display: 'flex', gap: 6 }}>{[1, 2].map(f => <button key={f} onClick={() => setCommercialFloors(f as 1 | 2)} style={chip(commercialFloors === f, ACCENT)}>{f === 1 ? 'Ground only' : 'Ground + First'}</button>)}</div>
        </div>
        <div style={{ flex: 1 }}><label style={fieldLabel}>Residential Floors</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{[2, 3, 4, 6, 8].map(f => <button key={f} onClick={() => setResidentialFloors(f)} style={chip(residentialFloors === f, ACCENT)}>{f}</button>)}</div>
        </div>
      </div>
      <div><label style={fieldLabel}>Shops per Commercial Floor: {shopsPerFloor}</label>
        <input type="range" min={4} max={10} value={shopsPerFloor} onChange={e => setShopsPerFloor(+e.target.value)} style={{ width: '100%', accentColor: ACCENT }} />
      </div>
      <div><label style={fieldLabel}>Units per Residential Floor</label>
        <div style={{ display: 'flex', gap: 6 }}>{[2, 3].map(n => <button key={n} onClick={() => setUnits(n as 2 | 3)} style={chip(unitsPerFloor === n, ACCENT)}>{n} units</button>)}</div>
      </div>
      <div><label style={fieldLabel}>Unit Mix</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {Array.from({ length: unitsPerFloor }).map((_, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 13, color: 'var(--ink)', width: 60 }}>Unit {String.fromCharCode(65 + i)}</span>
              {(['1bhk', '2bhk'] as BHK2[]).map(b => <button key={b} onClick={() => setUnitMix(prev => { const m = [...prev]; m[i] = b; return m; })} style={chip(unitMix[i] === b, ACCENT)}>{b.toUpperCase()}</button>)}
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 16 }}>
        <div style={{ flex: 2 }}><label style={fieldLabel}>Location</label><input style={fieldInput} value={location} onChange={e => setLocation(e.target.value)} /></div>
        <div style={{ flex: 1 }}><label style={fieldLabel}>Budget (₹ Lakhs)</label><input type="number" style={fieldInput} value={budget} onChange={e => setBudget(+e.target.value)} /></div>
      </div>
    </ModuleWizardShell>
  );
}
