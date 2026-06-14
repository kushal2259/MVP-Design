'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { saveProject, generateId } from '@/lib/store';
import { generateApartment, type BHK } from '@/lib/apartmentEngine';
import ModuleWizardShell, { fieldLabel, fieldInput, chip } from '@/components/ModuleWizardShell';
import type { Project } from '@/types';

const ACCENT = '#7c3aed';

export default function NewApartmentProject() {
  const router = useRouter();
  const [generating, setGenerating] = useState(false);
  const [name, setName] = useState('');
  const [width, setWidth] = useState(80);
  const [depth, setDepth] = useState(60);
  const [floors, setFloors] = useState(6);
  const [unitsPerFloor, setUnitsPerFloor] = useState<2 | 3 | 4>(2);
  const [unitMix, setUnitMix] = useState<BHK[]>(['2bhk', '1bhk']);
  const [location, setLocation] = useState('Pune, Maharashtra');
  const [budget, setBudget] = useState(1200);

  const setUnits = (n: 2 | 3 | 4) => {
    setUnitsPerFloor(n);
    setUnitMix(prev => { const m = prev.slice(0, n); while (m.length < n) m.push('2bhk'); return m; });
  };

  const generate = async () => {
    setGenerating(true);
    const config = { plotWidth: width, plotDepth: depth, floors, unitsPerFloor, unitMix, location, budgetLakhs: budget };
    const result = generateApartment(config);
    const id = generateId();
    const project: Project = {
      id, name: name || `Apartment — G+${floors} (${location.split(',')[0]})`,
      buildingType: 'apartment', status: 'generated', createdAt: new Date().toISOString(),
      requirements: { plotSize: Math.round(width * depth / 9), plotWidth: width, plotDepth: depth, plotShape: 'rectangular', location, floors: result.floorLabels.length, budget, style: 'modern', bhk: Math.max(...unitMix.map(m => m === '3bhk' ? 3 : m === '2bhk' ? 2 : 1)), specialRooms: [], requirements: `${floors}-floor apartment, ${unitsPerFloor} units/floor` },
      plotSettings: { width, depth, location, floors: result.floorLabels.length, style: 'modern', budgetLakhs: budget, bedrooms: 2, kitchenStyle: 'large', balconyRequired: true },
      moduleData: { config, stats: result.stats, floorLabels: result.floorLabels, rooms: result.rooms },
    };
    await saveProject(project);
    router.push(`/apartment/${id}`);
  };

  return (
    <ModuleWizardShell title="New Apartment Project" subtitle="Generate a residential apartment building — unit layouts, cores, parking and the full drawing set." accent={ACCENT} dashboardHref="/dashboard/apartment" generating={generating} canGenerate={!!width && !!depth} generateLabel="Generate Apartment Design →" onGenerate={generate}>
      <div><label style={fieldLabel}>Project Name</label><input style={fieldInput} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Skyline Residency" /></div>
      <div style={{ display: 'flex', gap: 16 }}>
        <div style={{ flex: 1 }}><label style={fieldLabel}>Plot Width (ft)</label><input type="number" style={fieldInput} value={width} onChange={e => setWidth(+e.target.value)} /></div>
        <div style={{ flex: 1 }}><label style={fieldLabel}>Plot Depth (ft)</label><input type="number" style={fieldInput} value={depth} onChange={e => setDepth(+e.target.value)} /></div>
      </div>
      <div><label style={fieldLabel}>Floors (G+N)</label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{[4, 6, 8, 10, 12].map(f => <button key={f} onClick={() => setFloors(f)} style={chip(floors === f, ACCENT)}>G+{f}</button>)}</div>
      </div>
      <div><label style={fieldLabel}>Units per Floor</label>
        <div style={{ display: 'flex', gap: 6 }}>{[2, 3, 4].map(n => <button key={n} onClick={() => setUnits(n as 2 | 3 | 4)} style={chip(unitsPerFloor === n, ACCENT)}>{n} units</button>)}</div>
      </div>
      <div><label style={fieldLabel}>Unit Mix</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {Array.from({ length: unitsPerFloor }).map((_, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 13, color: 'var(--ink)', width: 60 }}>Unit {String.fromCharCode(65 + i)}</span>
              {(['1bhk', '2bhk', '3bhk'] as BHK[]).map(b => (
                <button key={b} onClick={() => setUnitMix(prev => { const m = [...prev]; m[i] = b; return m; })} style={chip(unitMix[i] === b, ACCENT)}>{b.toUpperCase()}</button>
              ))}
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
