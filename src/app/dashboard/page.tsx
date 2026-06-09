'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getProjects, deleteProject, getCurrentUser, signOut, saveProject, generateId } from '@/lib/store';
import { generateLayouts } from '@/lib/layoutSolver';
import { generateFloorPlans, calculateSpaceAllocation, generateCostEstimate, generateBOQ, generateTimeline } from '@/lib/generator';
import { useIsMobile } from '@/lib/useIsMobile';
import type { Project, ProjectRequirements, PlotSettings } from '@/types';

function StatusBadge({ status }: { status: Project['status'] }) {
  const cfg: Record<string, { bg: string; color: string; label: string }> = {
    requirements: { bg: '#f5f3ee', color: '#7a8a9a', label: 'Draft' },
    analyzing: { bg: '#fff7ed', color: '#c8853a', label: 'Analyzing' },
    planning: { bg: '#eff6ff', color: '#3b6bd6', label: 'Planning' },
    generated: { bg: '#f0fdf4', color: '#16a34a', label: 'Generated' },
    reviewing: { bg: '#fdf4ff', color: '#9333ea', label: 'In Review' },
  };
  const c = cfg[status] || cfg.requirements;
  return (
    <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 100, backgroundColor: c.bg, color: c.color, fontSize: 11, fontWeight: 500, letterSpacing: '0.04em' }}>{c.label}</span>
  );
}

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);
  const router = useRouter();
  const isMobile = useIsMobile();

  useEffect(() => {
    (async () => {
      const u = await getCurrentUser();
      if (!u) {
        router.replace('/?auth=signin');
        return;
      }
      setUser(u);
      setProjects(await getProjects());
      setMounted(true);
    })();
  }, [router]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirm('Delete this project?')) {
      await deleteProject(id);
      setProjects(await getProjects());
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  const [loadingSample, setLoadingSample] = useState(false);
  const loadSample = async () => {
    setLoadingSample(true);
    const req: ProjectRequirements = {
      plotSize: 250, plotWidth: 50, plotDepth: 45, plotShape: 'rectangular',
      location: 'Pune, Maharashtra', floors: 2, budget: 75, style: 'modern', bhk: 4,
      specialRooms: ['Pooja Room', 'Home Office'],
      requirements: 'Modern 4 BHK family home — large living & kitchen, vastu-aware, good cross-ventilation.',
    };
    const plotSettings: PlotSettings = {
      width: 50, depth: 45, location: 'Pune, Maharashtra', floors: 2, style: 'modern',
      budgetLakhs: 75, bedrooms: 4, kitchenStyle: 'large', balconyRequired: true,
    };
    const layoutOptions = generateLayouts(plotSettings);
    const floorPlans = generateFloorPlans(req);
    const costResult = generateCostEstimate(req, floorPlans);
    const project: Project = {
      id: generateId(), name: 'Sample — Modern 4 BHK Villa (Pune)', requirements: req,
      status: 'generated', createdAt: new Date().toISOString(),
      floorPlans, layoutOptions, selectedLayoutId: 'option-a', plotSettings,
      costEstimate: costResult, boq: generateBOQ(costResult.builtUp || 1800), timeline: generateTimeline(req.floors),
      analysis: { parsedRequirements: {}, validationNotes: [], spaceAllocation: calculateSpaceAllocation(floorPlans) },
    };
    await saveProject(project);
    router.push(`/project/${project.id}`);
  };

  if (!mounted) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--paper)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, border: '2px solid var(--blueprint)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ color: 'var(--steel)', fontSize: 14 }}>Checking authentication…</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--paper)', fontFamily: 'var(--font-body)' }}>
      {/* Header */}
      <div style={{ borderBottom: '1px solid var(--line)', padding: isMobile ? '0 16px' : '0 48px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'var(--paper)', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 10 : 24 }}>
          <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="24" height="24" viewBox="0 0 28 28" fill="none">
              <rect x="2" y="2" width="24" height="24" rx="2" stroke="var(--blueprint)" strokeWidth="1.5"/>
              <path d="M7 21L21 7M7 7h14M7 7v14" stroke="var(--amber)" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, color: 'var(--ink)' }}>ArchCopilot</span>
          </Link>
          {!isMobile && <span style={{ color: 'var(--line-strong)', fontSize: 18 }}>|</span>}
          {!isMobile && <span style={{ fontSize: 14, color: 'var(--steel)', fontWeight: 300 }}>My Projects</span>}
        </div>
        <div style={{ display: 'flex', gap: isMobile ? 8 : 12, alignItems: 'center' }}>
          {user && !isMobile && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', backgroundColor: 'var(--blueprint)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 13, fontWeight: 600 }}>
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)', lineHeight: 1.2 }}>{user.name}</div>
                <div style={{ fontSize: 11, color: 'var(--steel)' }}>{user.email}</div>
              </div>
            </div>
          )}
          {user && isMobile && (
            <div style={{ width: 32, height: 32, borderRadius: '50%', backgroundColor: 'var(--blueprint)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 13, fontWeight: 600 }}>
              {user.name.charAt(0).toUpperCase()}
            </div>
          )}
          <Link href="/project/new" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: isMobile ? '8px 12px' : '8px 20px', borderRadius: 4, backgroundColor: 'var(--blueprint)', color: 'white', textDecoration: 'none', fontSize: 14, fontWeight: 500, whiteSpace: 'nowrap' }}>
            {isMobile ? '+ New' : '+ New Project'}
          </Link>
          <button onClick={handleSignOut} style={{ padding: '8px 12px', borderRadius: 4, border: '1px solid var(--line-strong)', backgroundColor: 'transparent', color: 'var(--steel)', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-body)', whiteSpace: 'nowrap' }}>
            {isMobile ? 'Out' : 'Sign Out'}
          </button>
        </div>
      </div>

      <div style={{ padding: isMobile ? '24px 16px' : '48px', maxWidth: 1200, margin: '0 auto' }}>
        {/* Summary bar */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: isMobile ? 12 : 24, marginBottom: isMobile ? 28 : 48 }}>
          {[
            { label: 'Total Projects', value: projects.length },
            { label: 'Generated', value: projects.filter(p => p.status === 'generated' || p.status === 'reviewing').length },
            { label: 'In Progress', value: projects.filter(p => p.status === 'analyzing' || p.status === 'planning').length },
            { label: 'Drafts', value: projects.filter(p => p.status === 'requirements').length },
          ].map((s, i) => (
            <div key={i} style={{ flex: isMobile ? '1 1 40%' : 1, minWidth: isMobile ? 130 : 'auto', padding: isMobile ? '18px' : '24px', borderRadius: 6, border: '1px solid var(--line)', backgroundColor: 'white' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: isMobile ? 28 : 36, fontWeight: 600, color: 'var(--blueprint)', lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 13, color: 'var(--steel)', marginTop: 8, fontWeight: 300 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Projects grid */}
        {projects.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '120px 40px', border: '2px dashed var(--line-strong)', borderRadius: 8 }}>
            <svg width="64" height="64" viewBox="0 0 28 28" fill="none" style={{ margin: '0 auto 24px', display: 'block', opacity: 0.3 }}>
              <rect x="2" y="2" width="24" height="24" rx="2" stroke="var(--blueprint)" strokeWidth="1.5"/>
              <path d="M7 21L21 7M7 7h14M7 7v14" stroke="var(--amber)" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 300, marginBottom: 16, color: 'var(--ink)' }}>No projects yet</h2>
            <p style={{ color: 'var(--steel)', marginBottom: 32, fontSize: 16, fontWeight: 300 }}>Create your first architectural project — or load a ready-made sample to explore everything instantly.</p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link href="/project/new" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 28px', borderRadius: 4, backgroundColor: 'var(--blueprint)', color: 'white', textDecoration: 'none', fontSize: 15, fontWeight: 500 }}>
                Create Your First Project →
              </Link>
              <button onClick={loadSample} disabled={loadingSample} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 28px', borderRadius: 4, border: '1.5px solid var(--amber)', backgroundColor: 'white', color: 'var(--amber)', fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)', opacity: loadingSample ? 0.6 : 1 }}>
                {loadingSample ? 'Loading…' : '✨ Load Sample Project'}
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 320px), 1fr))', gap: isMobile ? 16 : 24 }}>
            {projects.map((project) => (
              <Link key={project.id} href={`/project/${project.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                <div
                  style={{ border: '1px solid var(--line)', borderRadius: 6, overflow: 'hidden', backgroundColor: 'white', transition: 'all 0.2s', cursor: 'pointer' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 32px rgba(0,0,0,0.08)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--blueprint-light)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'none'; (e.currentTarget as HTMLElement).style.boxShadow = 'none'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--line)'; }}
                >
                  {/* Mini floor plan preview */}
                  <div style={{ height: 140, backgroundColor: 'var(--blueprint)', position: 'relative', overflow: 'hidden' }} className="blueprint-grid">
                    <svg width="100%" height="100%" viewBox="0 0 280 140" opacity="0.6">
                      <rect x="30" y="20" width="100" height="70" fill="none" stroke="rgba(74,114,196,0.8)" strokeWidth="1"/>
                      <rect x="130" y="20" width="70" height="40" fill="none" stroke="rgba(74,114,196,0.8)" strokeWidth="1"/>
                      <rect x="130" y="60" width="70" height="30" fill="none" stroke="rgba(74,114,196,0.8)" strokeWidth="1"/>
                      <rect x="30" y="90" width="50" height="30" fill="none" stroke="rgba(74,114,196,0.8)" strokeWidth="1"/>
                      <rect x="80" y="90" width="50" height="30" fill="none" stroke="rgba(74,114,196,0.8)" strokeWidth="1"/>
                      <rect x="200" y="20" width="50" height="70" fill="none" stroke="rgba(74,114,196,0.8)" strokeWidth="1"/>
                      <line x1="30" y1="10" x2="30" y2="130" stroke="rgba(200,133,58,0.5)" strokeWidth="0.5"/>
                      <line x1="250" y1="10" x2="250" y2="130" stroke="rgba(200,133,58,0.5)" strokeWidth="0.5"/>
                    </svg>
                    <div style={{ position: 'absolute', bottom: 12, left: 16, fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(200,133,58,0.9)', letterSpacing: '0.1em' }}>
                      {project.requirements.plotWidth}×{project.requirements.plotDepth} FT · {project.requirements.floors} FLOOR{project.requirements.floors > 1 ? 'S' : ''}
                    </div>
                  </div>

                  <div style={{ padding: '20px 24px 24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                      <h3 style={{ fontSize: 16, fontWeight: 500, color: 'var(--ink)', lineHeight: 1.3 }}>{project.name}</h3>
                      <StatusBadge status={project.status} />
                    </div>
                    <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
                      {[
                        { label: project.requirements.bhk + ' BHK', icon: '🏠' },
                        { label: project.requirements.plotSize + ' sq yd', icon: '◱' },
                        { label: '₹' + project.requirements.budget + 'L', icon: '◎' },
                      ].map((tag, ti) => (
                        <span key={ti} style={{ fontSize: 12, color: 'var(--steel)', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span>{tag.icon}</span> {tag.label}
                        </span>
                      ))}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 16, borderTop: '1px solid var(--line)' }}>
                      <span style={{ fontSize: 11, color: 'var(--steel)', fontFamily: 'var(--font-mono)' }}>
                        {new Date(project.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        <span style={{ fontSize: 12, color: 'var(--blueprint)', fontWeight: 500 }}>
                          {project.status === 'generated' || project.status === 'reviewing' ? 'View Design →' : 'Continue →'}
                        </span>
                        <button onClick={e => handleDelete(project.id, e)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--steel)', fontSize: 12, padding: '2px 6px', borderRadius: 4 }} title="Delete project">✕</button>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
