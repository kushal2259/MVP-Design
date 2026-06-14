'use client';
import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getProject, getCurrentUser } from '@/lib/store';
import type { Project, RoomLayout } from '@/types';
import ModuleWorkspace from '@/components/ModuleWorkspace';
import { complianceReport } from '@/lib/moduleEngineering';
import type { CommercialConfig, CommercialStats, CommercialUse } from '@/lib/commercialEngine';

export default function CommercialWorkspace({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [project, setProject] = useState<Project | null>(null);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const u = await getCurrentUser();
      if (!u) { router.replace('/?auth=signin'); return; }
      setProject(await getProject(id));
      setMounted(true);
    })();
  }, [id, router]);

  if (!mounted) return <Loading />;
  if (!project || !project.moduleData) return <NotFound />;

  const md = project.moduleData as { config: CommercialConfig; stats: CommercialStats; floorLabels: string[]; rooms: RoomLayout[]; use: CommercialUse; occFactor: number };
  const { config, stats, floorLabels, rooms, occFactor } = md;
  const floorIds = Array.from(new Set(rooms.map(r => r.floor))).sort((a, b) => a - b);
  const useName = (md.use || 'office').charAt(0).toUpperCase() + (md.use || 'office').slice(1);

  return (
    <ModuleWorkspace
      project={project}
      accent="#c2410c"
      title={`Commercial — ${useName}`}
      dashboardHref="/dashboard/commercial"
      rooms={rooms}
      floorLabels={floorLabels}
      plotWidth={config.plotWidth}
      plotDepth={config.plotDepth}
      floorHeights={floorIds.map((_, i) => (i === 0 ? 14 : 12))}
      kind="commercial"
      builtUpSqft={stats.totalBuiltUp}
      costRatePerSqft={2400}
      overviewStats={[
        { label: 'Building Use', value: useName },
        { label: 'Floors', value: `G+${config.floors}` },
        { label: 'Total Built-up', value: `${stats.totalBuiltUp.toLocaleString('en-IN')} sf` },
        { label: 'FAR / FSI', value: String(stats.far) },
        { label: 'Occupancy Load', value: `${stats.occupancyLoad} persons` },
        { label: 'Parking (ECS)', value: String(stats.parkingSlots) },
        { label: 'Rooms / Units', value: String(stats.unitsOrRooms) },
      ]}
      complianceItems={complianceReport({
        far: stats.far, maxFar: 3.5, floors: config.floors,
        parkingProvided: stats.parkingSlots, parkingRequired: stats.parkingSlots,
        twoExits: true, occupancyLoad: stats.occupancyLoad, kind: 'commercial',
      })}
      extraTab={{
        id: 'occupancy', label: 'Occupancy',
        render: () => {
          const exitWidthReq = Math.ceil((stats.occupancyLoad / 50) * 500) / 1000; // m, 5mm/person
          return (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, padding: '8px 14px', borderRadius: 6, backgroundColor: '#fef2f2', border: '1px solid #fecaca' }}>
                <span style={{ fontSize: 11.5, color: '#b91c1c', fontWeight: 600 }}>⚠ AI draft occupancy analysis — verify exit widths with a licensed fire consultant.</span>
              </div>
              <div style={{ border: '1px solid var(--line)', borderRadius: 8, backgroundColor: 'white', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr><th style={th}>Metric</th><th style={th}>Value</th><th style={th}>Basis</th></tr></thead>
                  <tbody>
                    <tr><td style={{ ...td, fontWeight: 600 }}>Occupant load factor</td><td style={td}>{occFactor} sqft / person</td><td style={{ ...td, color: 'var(--steel)' }}>NBC Part 4 — {useName} occupancy</td></tr>
                    <tr><td style={{ ...td, fontWeight: 600 }}>Total occupancy load</td><td style={td}>{stats.occupancyLoad} persons</td><td style={{ ...td, color: 'var(--steel)' }}>built-up ÷ factor</td></tr>
                    <tr><td style={{ ...td, fontWeight: 600 }}>Required exit width</td><td style={td}>{exitWidthReq.toFixed(2)} m</td><td style={{ ...td, color: 'var(--steel)' }}>5 mm / person</td></tr>
                    <tr><td style={{ ...td, fontWeight: 600 }}>Exits provided</td><td style={td}>2 staircases (fire + escape)</td><td style={{ ...td, color: 'var(--steel)' }}>two-exit rule satisfied</td></tr>
                  </tbody>
                </table>
              </div>
            </>
          );
        },
      }}
    />
  );
}

const th: React.CSSProperties = { textAlign: 'left', padding: '8px 10px', fontSize: 11, color: 'var(--steel)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', borderBottom: '2px solid var(--line-strong)' };
const td: React.CSSProperties = { padding: '7px 10px', fontSize: 12.5, color: 'var(--ink)', borderBottom: '1px solid var(--line)' };

function Loading() {
  return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--paper)' }}>
    <div style={{ width: 40, height: 40, border: '2px solid #c2410c', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>;
}
function NotFound() {
  return <div style={{ padding: 40, fontFamily: 'var(--font-body)', color: 'var(--steel)' }}>Project not found or has no generated design. <a href="/dashboard/commercial" style={{ color: '#c2410c' }}>← Commercial dashboard</a></div>;
}
