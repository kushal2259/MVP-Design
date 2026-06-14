'use client';
// Generic workspace shared by Apartment, Mixed-Use and Commercial modules.
// Renders the full tab set (MVP → V2 → V3) from a normalized config so each
// module's [id] page is a thin wrapper. NO LLM — every drawing/report is
// deterministic (moduleEngineering.ts + the module engine output).
import { useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import type { Project, RoomLayout, PlotSettings } from '@/types';
import FloorPlanV2Renderer from './FloorPlanV2Renderer';
import SiteVisitsTab from './SiteVisitsTab';
import { generateElevation } from '@/lib/elevationGenerator';
import {
  renderDiscipline, renderSection, doorSchedule, windowSchedule,
  complianceReport, costEstimate, boq, type ComplianceItem, type Discipline,
} from '@/lib/moduleEngineering';

const ThreeDViewer = dynamic(() => import('./ThreeDViewerV2'), { ssr: false });

export interface ModuleWorkspaceConfig {
  project: Project;
  accent: string;
  title: string;
  dashboardHref: string;
  rooms: RoomLayout[];
  floorLabels: string[];
  plotWidth: number;
  plotDepth: number;
  floorHeights: number[];
  overviewStats: { label: string; value: string }[];
  complianceItems: ComplianceItem[];
  builtUpSqft: number;
  costRatePerSqft: number;
  kind: 'apartment' | 'mixed-use' | 'commercial';
  /** Optional extra tab (Unit Mix / Occupancy) */
  extraTab?: { id: string; label: string; render: () => React.ReactNode };
}

type TabId = 'overview' | 'floor-plans' | 'elevations' | 'section' | 'structural'
  | 'plumbing' | 'electrical' | 'hvac' | 'fire' | 'schedules' | 'compliance'
  | 'cost' | 'boq' | '3d' | 'site-visits' | 'extra';

const DISC_OF: Partial<Record<TabId, Discipline>> = {
  'floor-plans': 'plan', structural: 'structural', plumbing: 'plumbing',
  electrical: 'electrical', hvac: 'hvac', fire: 'fire',
};
const APPROVAL: Partial<Record<TabId, string>> = {
  structural: 'Requires Licensed Structural Engineer Approval',
  plumbing: 'Requires Licensed Plumbing Engineer Approval',
  electrical: 'Requires Licensed Electrical Engineer Approval',
  hvac: 'Requires Licensed HVAC Consultant Approval',
  fire: 'Requires Licensed Fire Safety Consultant Approval + NOC',
  elevations: 'AI concept elevation — final façade requires an architect',
};

export default function ModuleWorkspace(cfg: ModuleWorkspaceConfig) {
  const [tab, setTab] = useState<TabId>('overview');
  const [floorIdx, setFloorIdx] = useState(0);
  const [elevSide, setElevSide] = useState<'front' | 'rear' | 'left' | 'right'>('front');
  const { rooms, floorLabels, plotWidth, plotDepth, accent } = cfg;

  const floorIds = Array.from(new Set(rooms.map(r => r.floor))).sort((a, b) => a - b);
  const activeFloor = floorIds[Math.min(floorIdx, floorIds.length - 1)] ?? 0;
  const floorRooms = rooms.filter(r => r.floor === activeFloor);

  const ps: PlotSettings = cfg.project.plotSettings || {
    width: plotWidth, depth: plotDepth, location: cfg.project.requirements?.location || '',
    floors: floorIds.length, style: 'modern', budgetLakhs: cfg.project.requirements?.budget || 0,
    bedrooms: cfg.project.requirements?.bhk || 0, kitchenStyle: 'large', balconyRequired: true,
  };

  const TABS: { id: TabId; label: string; group: string }[] = [
    { id: 'overview', label: 'Overview', group: 'MVP' },
    { id: 'floor-plans', label: 'Floor Plans', group: 'MVP' },
    ...(cfg.extraTab ? [{ id: 'extra' as TabId, label: cfg.extraTab.label, group: 'MVP' }] : []),
    { id: 'elevations', label: 'Elevations', group: 'MVP' },
    { id: 'section', label: 'Section', group: 'MVP' },
    { id: 'schedules', label: 'Schedules', group: 'MVP' },
    { id: 'structural', label: 'Structural', group: 'V2' },
    { id: 'plumbing', label: 'Plumbing', group: 'V2' },
    { id: 'electrical', label: 'Electrical', group: 'V2' },
    { id: 'hvac', label: 'HVAC', group: 'V3' },
    { id: 'fire', label: 'Fire Safety', group: 'V3' },
    { id: 'compliance', label: 'Compliance', group: 'V3' },
    { id: 'cost', label: 'Cost Est.', group: 'V3' },
    { id: 'boq', label: 'BOQ', group: 'V3' },
    { id: '3d', label: '3D View', group: 'V3' },
    { id: 'site-visits', label: 'Site Visits', group: 'V3' },
  ];

  const floorButtons = (
    <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
      {floorIds.map((fl, i) => (
        <button key={fl} onClick={() => setFloorIdx(i)} style={{
          padding: '6px 14px', borderRadius: 4, fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-body)',
          border: `1.5px solid ${i === floorIdx ? accent : 'var(--line-strong)'}`,
          backgroundColor: i === floorIdx ? accent : 'white', color: i === floorIdx ? 'white' : 'var(--steel)',
          fontWeight: i === floorIdx ? 600 : 400,
        }}>{floorLabels[i] ?? `Floor ${fl}`}</button>
      ))}
    </div>
  );

  const banner = (text?: string) => text ? (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, padding: '8px 14px', borderRadius: 6, backgroundColor: '#fef2f2', border: '1px solid #fecaca' }}>
      <span style={{ fontSize: 13 }}>⚠</span>
      <span style={{ fontSize: 11.5, color: '#b91c1c', fontWeight: 600 }}>{text}</span>
      <span style={{ fontSize: 11, color: '#7f1d1d' }}>— AI draft. Not for construction.</span>
    </div>
  ) : null;

  const sectionTitle = (t: string) => (
    <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 400, color: 'var(--ink)', marginBottom: 14 }}>{t}</h2>
  );

  const roomSchedule = (
    <div style={{ border: '1px solid var(--line)', borderRadius: 6, backgroundColor: 'white', padding: 16, height: 'fit-content' }}>
      <div style={{ fontSize: 11, color: 'var(--steel)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 10 }}>Room Schedule — {floorLabels[floorIdx]}</div>
      {floorRooms.map(r => (
        <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--line)' }}>
          <span style={{ fontSize: 12.5, color: 'var(--ink)' }}>{r.name}</span>
          <span style={{ fontSize: 11, color: 'var(--steel)', fontFamily: 'var(--font-mono)' }}>{r.w}×{r.h}′ · {Math.round(r.w * r.h)} sf</span>
        </div>
      ))}
    </div>
  );

  const svgBox = (html: string) => (
    <div style={{ border: '1px solid var(--line)', borderRadius: 8, backgroundColor: 'white', padding: 14, overflow: 'auto' }} dangerouslySetInnerHTML={{ __html: html }} />
  );

  const cost = costEstimate(cfg.builtUpSqft, cfg.costRatePerSqft, cfg.kind);
  const boqRows = boq(cfg.builtUpSqft);
  const inr = (n: number) => '₹' + n.toLocaleString('en-IN');

  const th: React.CSSProperties = { textAlign: 'left', padding: '8px 10px', fontSize: 11, color: 'var(--steel)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', borderBottom: '2px solid var(--line-strong)' };
  const td: React.CSSProperties = { padding: '7px 10px', fontSize: 12.5, color: 'var(--ink)', borderBottom: '1px solid var(--line)' };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--paper)', fontFamily: 'var(--font-body)' }}>
      {/* Header */}
      <div style={{ borderBottom: '1px solid var(--line)', padding: '0 32px', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'var(--paper)', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Link href={cfg.dashboardHref} style={{ color: 'var(--steel)', textDecoration: 'none', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>← Dashboard</Link>
          <span style={{ color: 'var(--line-strong)' }}>|</span>
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>{cfg.project.name}</span>
          <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 100, backgroundColor: accent + '18', color: accent, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{cfg.title}</span>
        </div>
      </div>

      <div style={{ display: 'flex' }}>
        {/* Sidebar tabs */}
        <div style={{ width: 190, flexShrink: 0, borderRight: '1px solid var(--line)', padding: '16px 10px', minHeight: 'calc(100vh - 60px)', backgroundColor: 'white' }}>
          {['MVP', 'V2', 'V3'].map(group => (
            <div key={group} style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 9.5, color: 'var(--steel)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.1em', padding: '0 8px 6px' }}>{group}</div>
              {TABS.filter(t => t.group === group).map(t => (
                <button key={t.id} onClick={() => setTab(t.id)} style={{
                  display: 'block', width: '100%', textAlign: 'left', padding: '7px 10px', borderRadius: 5, marginBottom: 2,
                  border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: 12.5,
                  backgroundColor: tab === t.id ? accent : 'transparent', color: tab === t.id ? 'white' : 'var(--ink)',
                  fontWeight: tab === t.id ? 600 : 400,
                }}>{t.label}</button>
              ))}
            </div>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, padding: '28px 36px', minWidth: 0 }}>
          {tab === 'overview' && (
            <>
              {sectionTitle('Project Overview')}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16, marginBottom: 28 }}>
                {cfg.overviewStats.map((s, i) => (
                  <div key={i} style={{ padding: 20, borderRadius: 6, border: '1px solid var(--line)', backgroundColor: 'white' }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 600, color: accent, lineHeight: 1 }}>{s.value}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--steel)', marginTop: 8 }}>{s.label}</div>
                  </div>
                ))}
              </div>
              <div style={{ border: '1px solid var(--line)', borderRadius: 8, backgroundColor: 'white', padding: 20 }}>
                <div style={{ fontSize: 11, color: 'var(--steel)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', marginBottom: 12 }}>Floors in this design</div>
                {floorLabels.map((l, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
                    <span style={{ fontSize: 13, color: 'var(--ink)' }}>{l}</span>
                    <span style={{ fontSize: 11, color: 'var(--steel)', fontFamily: 'var(--font-mono)' }}>{rooms.filter(r => r.floor === floorIds[i]).length} spaces</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {tab === 'extra' && cfg.extraTab && (<>{sectionTitle(cfg.extraTab.label)}{cfg.extraTab.render()}</>)}

          {DISC_OF[tab] && (
            <>
              {sectionTitle(TABS.find(t => t.id === tab)!.label + (tab === 'floor-plans' ? '' : ' Layout'))}
              {banner(APPROVAL[tab])}
              {floorButtons}
              {tab === 'floor-plans' ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))', gap: 20 }}>
                  <div style={{ border: '1px solid var(--line)', borderRadius: 8, backgroundColor: 'white', padding: 14 }}>
                    <FloorPlanV2Renderer rooms={floorRooms} plotWidth={plotWidth} plotDepth={plotDepth} />
                  </div>
                  {roomSchedule}
                </div>
              ) : svgBox(renderDiscipline(DISC_OF[tab]!, floorRooms, plotWidth, plotDepth))}
            </>
          )}

          {tab === 'elevations' && (
            <>
              {sectionTitle('Building Elevations')}
              {banner(APPROVAL.elevations)}
              <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
                {(['front', 'rear', 'left', 'right'] as const).map(s => (
                  <button key={s} onClick={() => setElevSide(s)} style={{
                    padding: '6px 14px', borderRadius: 4, fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-body)', textTransform: 'capitalize',
                    border: `1.5px solid ${elevSide === s ? accent : 'var(--line-strong)'}`, backgroundColor: elevSide === s ? accent : 'white', color: elevSide === s ? 'white' : 'var(--steel)',
                  }}>{s}</button>
                ))}
              </div>
              {svgBox(generateElevation(rooms, ps, elevSide, 'modern', floorIds.length))}
            </>
          )}

          {tab === 'section' && (<>{sectionTitle('Building Section')}{svgBox(renderSection(floorLabels, plotWidth, cfg.floorHeights))}</>)}

          {tab === 'schedules' && (
            <>
              {sectionTitle('Door & Window Schedules')}
              {floorButtons}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: 20 }}>
                {([['Door Schedule', doorSchedule(floorRooms)], ['Window Schedule', windowSchedule(floorRooms)]] as const).map(([title, rows]) => (
                  <div key={title} style={{ border: '1px solid var(--line)', borderRadius: 8, backgroundColor: 'white', overflow: 'hidden' }}>
                    <div style={{ padding: '10px 14px', fontSize: 13, fontWeight: 600, color: 'var(--ink)', borderBottom: '1px solid var(--line)' }}>{title}</div>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead><tr><th style={th}>Mark</th><th style={th}>Type</th><th style={th}>Size</th><th style={th}>Qty</th></tr></thead>
                      <tbody>{rows.map(r => (<tr key={r.mark}><td style={td}>{r.mark}</td><td style={td}>{r.type}</td><td style={td}>{r.size}</td><td style={td}>{r.count}</td></tr>))}</tbody>
                    </table>
                  </div>
                ))}
              </div>
            </>
          )}

          {tab === 'compliance' && (
            <>
              {sectionTitle('Compliance Report')}
              {banner('Indicative compliance — verify against local DCR / NBC with a licensed professional')}
              <div style={{ border: '1px solid var(--line)', borderRadius: 8, backgroundColor: 'white', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr><th style={th}>Check</th><th style={th}>Value</th><th style={th}>Status</th><th style={th}>Note</th></tr></thead>
                  <tbody>{cfg.complianceItems.map((c, i) => (
                    <tr key={i}>
                      <td style={{ ...td, fontWeight: 600 }}>{c.check}</td>
                      <td style={td}>{c.value}</td>
                      <td style={td}><span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 100, backgroundColor: c.status === 'pass' ? '#f0fdf4' : c.status === 'review' ? '#fefce8' : '#f3f4f6', color: c.status === 'pass' ? '#16a34a' : c.status === 'review' ? '#a16207' : '#6b7280' }}>{c.status === 'pass' ? '✓ PASS' : c.status === 'review' ? '◐ REVIEW' : 'N/A'}</span></td>
                      <td style={{ ...td, color: 'var(--steel)', fontSize: 11.5 }}>{c.note}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </>
          )}

          {tab === 'cost' && (
            <>
              {sectionTitle('Cost Estimate')}
              {banner('Order-of-magnitude estimate at module rates — not a tender BOQ')}
              <div style={{ border: '1px solid var(--line)', borderRadius: 8, backgroundColor: 'white', overflow: 'hidden', marginBottom: 16 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr><th style={th}>Head</th><th style={th}>Basis</th><th style={{ ...th, textAlign: 'right' }}>Amount</th></tr></thead>
                  <tbody>
                    {cost.lines.map((l, i) => (<tr key={i}><td style={{ ...td, fontWeight: 600 }}>{l.head}</td><td style={{ ...td, color: 'var(--steel)' }}>{l.basis}</td><td style={{ ...td, textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{inr(l.amount)}</td></tr>))}
                    <tr style={{ backgroundColor: accent + '0d' }}><td style={{ ...td, fontWeight: 700 }} colSpan={2}>Total (incl. GST)</td><td style={{ ...td, textAlign: 'right', fontWeight: 700, fontFamily: 'var(--font-mono)', color: accent }}>{inr(cost.total)}</td></tr>
                  </tbody>
                </table>
              </div>
              <div style={{ fontSize: 13, color: 'var(--steel)' }}>≈ <strong style={{ color: accent }}>{inr(cost.perSqft)}/sqft</strong> over {cfg.builtUpSqft.toLocaleString('en-IN')} sqft built-up.</div>
            </>
          )}

          {tab === 'boq' && (
            <>
              {sectionTitle('Bill of Quantities')}
              {banner('Approximate quantities from built-up area coefficients — verify with detailed take-off')}
              <div style={{ border: '1px solid var(--line)', borderRadius: 8, backgroundColor: 'white', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr><th style={th}>Item</th><th style={th}>Unit</th><th style={{ ...th, textAlign: 'right' }}>Qty</th><th style={{ ...th, textAlign: 'right' }}>Rate</th><th style={{ ...th, textAlign: 'right' }}>Amount</th></tr></thead>
                  <tbody>
                    {boqRows.map((r, i) => (<tr key={i}><td style={td}>{r.item}</td><td style={{ ...td, color: 'var(--steel)' }}>{r.unit}</td><td style={{ ...td, textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{r.qty.toLocaleString('en-IN')}</td><td style={{ ...td, textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{inr(r.rate)}</td><td style={{ ...td, textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{inr(r.amount)}</td></tr>))}
                    <tr style={{ backgroundColor: accent + '0d' }}><td style={{ ...td, fontWeight: 700 }} colSpan={4}>Subtotal</td><td style={{ ...td, textAlign: 'right', fontWeight: 700, fontFamily: 'var(--font-mono)', color: accent }}>{inr(boqRows.reduce((a, r) => a + r.amount, 0))}</td></tr>
                  </tbody>
                </table>
              </div>
            </>
          )}

          {tab === '3d' && (
            <>
              {sectionTitle('3D View')}
              <div style={{ height: 600, border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden' }}>
                <ThreeDViewer rooms={rooms} settings={ps} />
              </div>
            </>
          )}

          {tab === 'site-visits' && <SiteVisitsTab project={cfg.project} />}
        </div>
      </div>
    </div>
  );
}
