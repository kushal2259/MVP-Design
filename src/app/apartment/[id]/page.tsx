'use client';
import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getProject, getCurrentUser } from '@/lib/store';
import type { Project, RoomLayout } from '@/types';
import ModuleWorkspace from '@/components/ModuleWorkspace';
import { complianceReport } from '@/lib/moduleEngineering';
import type { ApartmentConfig, ApartmentStats } from '@/lib/apartmentEngine';

export default function ApartmentWorkspace({ params }: { params: Promise<{ id: string }> }) {
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

  const md = project.moduleData as { config: ApartmentConfig; stats: ApartmentStats; floorLabels: string[]; rooms: RoomLayout[] };
  const { config, stats, floorLabels, rooms } = md;
  const floorIds = Array.from(new Set(rooms.map(r => r.floor))).sort((a, b) => a - b);

  return (
    <ModuleWorkspace
      project={project}
      accent="#7c3aed"
      title="Apartment"
      dashboardHref="/dashboard/apartment"
      rooms={rooms}
      floorLabels={floorLabels}
      plotWidth={config.plotWidth}
      plotDepth={config.plotDepth}
      floorHeights={floorIds.map((_, i) => (i === 0 ? 11 : 10))}
      kind="apartment"
      builtUpSqft={stats.builtUpPerFloor * config.floors}
      costRatePerSqft={1950}
      overviewStats={[
        { label: 'Total Units', value: String(stats.totalUnits) },
        { label: 'Floors', value: `G+${config.floors}` },
        { label: 'Units / Floor', value: String(config.unitsPerFloor) },
        { label: 'FAR / FSI', value: String(stats.far) },
        { label: 'Built-up / Floor', value: `${stats.builtUpPerFloor.toLocaleString('en-IN')} sf` },
        { label: 'Parking (ECS)', value: String(stats.parkingSlots) },
      ]}
      complianceItems={complianceReport({
        far: stats.far, maxFar: 2.75, floors: config.floors,
        parkingProvided: stats.parkingSlots, parkingRequired: stats.totalUnits,
        hasRefuge: config.floors > 7, twoExits: false, kind: 'apartment',
      })}
      extraTab={{
        id: 'unit-mix', label: 'Unit Mix',
        render: () => (
          <div style={{ border: '1px solid var(--line)', borderRadius: 8, backgroundColor: 'white', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                <th style={th}>Unit</th><th style={th}>Type</th><th style={{ ...th, textAlign: 'right' }}>Carpet (typical floor)</th><th style={{ ...th, textAlign: 'right' }}>× Floors</th>
              </tr></thead>
              <tbody>
                {Object.entries(stats.carpetByBhk).map(([name, carpet]) => (
                  <tr key={name}>
                    <td style={td}>{name.split(' (')[0]}</td>
                    <td style={td}>{name.match(/\(([^)]+)\)/)?.[1]}</td>
                    <td style={{ ...td, textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{carpet.toLocaleString('en-IN')} sf</td>
                    <td style={{ ...td, textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{config.floors}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ),
      }}
    />
  );
}

const th: React.CSSProperties = { textAlign: 'left', padding: '8px 10px', fontSize: 11, color: 'var(--steel)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', borderBottom: '2px solid var(--line-strong)' };
const td: React.CSSProperties = { padding: '7px 10px', fontSize: 12.5, color: 'var(--ink)', borderBottom: '1px solid var(--line)' };

function Loading() {
  return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--paper)' }}>
    <div style={{ width: 40, height: 40, border: '2px solid #7c3aed', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>;
}
function NotFound() {
  return <div style={{ padding: 40, fontFamily: 'var(--font-body)', color: 'var(--steel)' }}>Project not found or has no generated design. <a href="/dashboard/apartment" style={{ color: '#7c3aed' }}>← Apartment dashboard</a></div>;
}
