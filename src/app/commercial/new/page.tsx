'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { saveProject, generateId } from '@/lib/store';
import { generateCommercial, type CommercialUse } from '@/lib/commercialEngine';
import ModuleWizardShell, { fieldLabel, fieldInput, chip } from '@/components/ModuleWizardShell';
import type { Project } from '@/types';

const ACCENT = '#c2410c';
const USES: { id: CommercialUse; label: string; desc: string }[] = [
  { id: 'office', label: 'Office Building', desc: 'Open offices, cabins, conference, pantry' },
  { id: 'mall', label: 'Mall / Retail', desc: 'Anchor + shops around an atrium, food court' },
  { id: 'hotel', label: 'Hotel', desc: 'Guest rooms along corridors, lobby, restaurant' },
  { id: 'hospital', label: 'Hospital', desc: 'OPD, wards, pharmacy, emergency' },
  { id: 'school', label: 'School', desc: 'Classrooms, library, admin, assembly' },
];

export default function NewCommercialProject() {
  const router = useRouter();
  const [generating, setGenerating] = useState(false);
  const [name, setName] = useState('');
  const [use, setUse] = useState<CommercialUse>('office');
  const [width, setWidth] = useState(100);
  const [depth, setDepth] = useState(80);
  const [floors, setFloors] = useState(4);
  const [location, setLocation] = useState('Pune, Maharashtra');
  const [budget, setBudget] = useState(3000);

  const generate = async () => {
    setGenerating(true);
    const config = { plotWidth: width, plotDepth: depth, floors, use, location, budgetLakhs: budget };
    const result = generateCommercial(config);
    const id = generateId();
    const useName = use.charAt(0).toUpperCase() + use.slice(1);
    const project: Project = {
      id, name: name || `${useName} — G+${floors} (${location.split(',')[0]})`,
      buildingType: 'commercial', status: 'generated', createdAt: new Date().toISOString(),
      requirements: { plotSize: Math.round(width * depth / 9), plotWidth: width, plotDepth: depth, plotShape: 'rectangular', location, floors: result.floorLabels.length, budget, style: 'modern', bhk: 0, specialRooms: [], requirements: `${useName} commercial building, G+${floors}` },
      plotSettings: { width, depth, location, floors: result.floorLabels.length, style: 'modern', budgetLakhs: budget, bedrooms: 0, kitchenStyle: 'large', balconyRequired: false },
      moduleData: { config, stats: result.stats, floorLabels: result.floorLabels, rooms: result.rooms, use: result.use, occFactor: result.occFactor },
    };
    await saveProject(project);
    router.push(`/commercial/${id}`);
  };

  return (
    <ModuleWizardShell title="New Commercial Project" subtitle="Offices, malls, hotels, hospitals & schools — core, egress, occupancy and the full drawing set." accent={ACCENT} dashboardHref="/dashboard/commercial" generating={generating} canGenerate={!!width && !!depth} generateLabel="Generate Commercial Design →" onGenerate={generate}>
      <div><label style={fieldLabel}>Project Name</label><input style={fieldInput} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Trade Tower" /></div>
      <div><label style={fieldLabel}>Building Use</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
          {USES.map(u => (
            <button key={u.id} onClick={() => setUse(u.id)} style={{
              textAlign: 'left', padding: '12px 14px', borderRadius: 8, cursor: 'pointer', fontFamily: 'var(--font-body)',
              border: `1.5px solid ${use === u.id ? ACCENT : 'var(--line-strong)'}`, backgroundColor: use === u.id ? ACCENT + '10' : 'white',
            }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: use === u.id ? ACCENT : 'var(--ink)' }}>{u.label}</div>
              <div style={{ fontSize: 11, color: 'var(--steel)', marginTop: 3, lineHeight: 1.4 }}>{u.desc}</div>
            </button>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 16 }}>
        <div style={{ flex: 1 }}><label style={fieldLabel}>Plot Width (ft)</label><input type="number" style={fieldInput} value={width} onChange={e => setWidth(+e.target.value)} /></div>
        <div style={{ flex: 1 }}><label style={fieldLabel}>Plot Depth (ft)</label><input type="number" style={fieldInput} value={depth} onChange={e => setDepth(+e.target.value)} /></div>
      </div>
      <div><label style={fieldLabel}>Floors (G+N)</label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{[2, 3, 4, 6, 8, 10].map(f => <button key={f} onClick={() => setFloors(f)} style={chip(floors === f, ACCENT)}>G+{f}</button>)}</div>
      </div>
      <div style={{ display: 'flex', gap: 16 }}>
        <div style={{ flex: 2 }}><label style={fieldLabel}>Location</label><input style={fieldInput} value={location} onChange={e => setLocation(e.target.value)} /></div>
        <div style={{ flex: 1 }}><label style={fieldLabel}>Budget (₹ Lakhs)</label><input type="number" style={fieldInput} value={budget} onChange={e => setBudget(+e.target.value)} /></div>
      </div>
    </ModuleWizardShell>
  );
}
