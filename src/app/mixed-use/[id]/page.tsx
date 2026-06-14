'use client';
import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getProject, getCurrentUser } from '@/lib/store';
import type { Project, RoomLayout } from '@/types';
import ModuleWorkspace from '@/components/ModuleWorkspace';
import { complianceReport } from '@/lib/moduleEngineering';
import type { MixedUseConfig, MixedUseStats } from '@/lib/mixedUseEngine';

export default function MixedUseWorkspace({ params }: { params: Promise<{ id: string }> }) {
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

  const md = project.moduleData as { config: MixedUseConfig; stats: MixedUseStats; floorLabels: string[]; rooms: RoomLayout[] };
  const { config, stats, floorLabels, rooms } = md;
  const floorIds = Array.from(new Set(rooms.map(r => r.floor))).sort((a, b) => a - b);
  const totalFloors = config.commercialFloors + config.residentialFloors;
  const builtUp = stats.commercialArea + stats.residentialArea;

  return (
    <ModuleWorkspace
      project={project}
      accent="#0d9488"
      title="Mixed-Use"
      dashboardHref="/dashboard/mixed-use"
      rooms={rooms}
      floorLabels={floorLabels}
      plotWidth={config.plotWidth}
      plotDepth={config.plotDepth}
      floorHeights={floorIds.map((_, i) => (i < config.commercialFloors ? 12 : 10))}
      kind="mixed-use"
      builtUpSqft={builtUp}
      costRatePerSqft={2050}
      overviewStats={[
        { label: 'Total Shops', value: String(stats.totalShops) },
        { label: 'Total Units', value: String(stats.totalUnits) },
        { label: 'Floors', value: `G+${totalFloors - 1}` },
        { label: 'FAR / FSI', value: String(stats.far) },
        { label: 'Commercial Area', value: `${stats.commercialArea.toLocaleString('en-IN')} sf` },
        { label: 'Residential Area', value: `${stats.residentialArea.toLocaleString('en-IN')} sf` },
        { label: 'Parking (ECS)', value: String(stats.parkingSlots) },
      ]}
      complianceItems={complianceReport({
        far: stats.far, maxFar: 3.0, floors: totalFloors,
        parkingProvided: stats.parkingSlots, parkingRequired: Math.ceil(stats.totalShops * 0.5 + stats.totalUnits),
        twoExits: false, kind: 'mixed-use',
      })}
    />
  );
}

function Loading() {
  return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--paper)' }}>
    <div style={{ width: 40, height: 40, border: '2px solid #0d9488', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>;
}
function NotFound() {
  return <div style={{ padding: 40, fontFamily: 'var(--font-body)', color: 'var(--steel)' }}>Project not found or has no generated design. <a href="/dashboard/mixed-use" style={{ color: '#0d9488' }}>← Mixed-Use dashboard</a></div>;
}
