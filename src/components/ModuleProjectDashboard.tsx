'use client';
// Real project dashboard for a building-type module: auth gate, project grid
// filtered to this buildingType, "+ New" CTA, delete, plus a collapsible
// deliverables catalog (the long-term spec for the typology).
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getProjects, deleteProject, getCurrentUser, signOut } from '@/lib/store';
import { useIsMobile } from '@/lib/useIsMobile';
import type { Project, BuildingType } from '@/types';
import type { DrawingGroup } from './ModuleDashboard';

export interface ModuleProjectDashboardProps {
  buildingType: BuildingType;
  title: string;
  accent: string;
  newHref: string;
  workspaceBase: string;       // e.g. '/apartment'
  examples: string[];
  groups: DrawingGroup[];
  reports: string[];
}

export default function ModuleProjectDashboard(p: ModuleProjectDashboardProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);
  const [mounted, setMounted] = useState(false);
  const [showCatalog, setShowCatalog] = useState(false);
  const router = useRouter();
  const isMobile = useIsMobile();

  const reload = async () => { const all = await getProjects(); setProjects(all.filter(x => x.buildingType === p.buildingType)); };

  useEffect(() => {
    (async () => {
      const u = await getCurrentUser();
      if (!u) { router.replace('/?auth=signin'); return; }
      setUser(u);
      await reload();
      setMounted(true);
    })();
  }, [router]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (confirm('Delete this project?')) { await deleteProject(id); await reload(); }
  };

  if (!mounted) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--paper)' }}>
      <div style={{ width: 40, height: 40, border: `2px solid ${p.accent}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--paper)', fontFamily: 'var(--font-body)' }}>
      <div style={{ borderBottom: '1px solid var(--line)', padding: isMobile ? '0 16px' : '0 48px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'var(--paper)', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 10 : 20 }}>
          <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="24" height="24" viewBox="0 0 28 28" fill="none"><rect x="2" y="2" width="24" height="24" rx="2" stroke="var(--blueprint)" strokeWidth="1.5"/><path d="M7 21L21 7M7 7h14M7 7v14" stroke="var(--amber)" strokeWidth="1.5" strokeLinecap="round"/></svg>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, color: 'var(--ink)' }}>ArchCopilot</span>
          </Link>
          {!isMobile && <span style={{ color: 'var(--line-strong)' }}>|</span>}
          {!isMobile && <span style={{ fontSize: 14, color: 'var(--steel)', fontWeight: 300 }}>{p.title}</span>}
          <Link href="/dashboard" style={{ fontSize: 12, color: p.accent, textDecoration: 'none', whiteSpace: 'nowrap' }}>← All Building Types</Link>
        </div>
        <div style={{ display: 'flex', gap: isMobile ? 8 : 12, alignItems: 'center' }}>
          {user && <div style={{ width: 32, height: 32, borderRadius: '50%', backgroundColor: p.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 13, fontWeight: 600 }}>{user.name.charAt(0).toUpperCase()}</div>}
          <Link href={p.newHref} style={{ padding: isMobile ? '8px 12px' : '8px 20px', borderRadius: 4, backgroundColor: p.accent, color: 'white', textDecoration: 'none', fontSize: 14, fontWeight: 500, whiteSpace: 'nowrap' }}>{isMobile ? '+ New' : '+ New Project'}</Link>
          <button onClick={async () => { await signOut(); router.push('/'); }} style={{ padding: '8px 12px', borderRadius: 4, border: '1px solid var(--line-strong)', background: 'transparent', color: 'var(--steel)', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>{isMobile ? 'Out' : 'Sign Out'}</button>
        </div>
      </div>

      <div style={{ padding: isMobile ? '24px 16px' : '48px', maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 24 }}>
          {p.examples.map(e => <span key={e} style={{ padding: '3px 12px', borderRadius: 100, fontSize: 12, backgroundColor: 'white', border: `1px solid ${p.accent}44`, color: p.accent, fontWeight: 500 }}>{e}</span>)}
        </div>

        {projects.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '90px 40px', border: '2px dashed var(--line-strong)', borderRadius: 8, marginBottom: 40 }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 300, marginBottom: 12, color: 'var(--ink)' }}>No {p.title.split('—')[0].trim().toLowerCase()} projects yet</h2>
            <p style={{ color: 'var(--steel)', marginBottom: 26, fontSize: 15, fontWeight: 300 }}>Generate your first design — plans, elevations, MEP, compliance and cost in one pass.</p>
            <Link href={p.newHref} style={{ display: 'inline-flex', padding: '12px 28px', borderRadius: 4, backgroundColor: p.accent, color: 'white', textDecoration: 'none', fontSize: 15, fontWeight: 500 }}>Create Your First Project →</Link>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 320px), 1fr))', gap: isMobile ? 16 : 24, marginBottom: 40 }}>
            {projects.map(project => (
              <Link key={project.id} href={`${p.workspaceBase}/${project.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                <div style={{ border: '1px solid var(--line)', borderRadius: 6, overflow: 'hidden', backgroundColor: 'white', cursor: 'pointer', transition: 'all 0.2s' }}
                  onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'translateY(-2px)'; el.style.boxShadow = '0 8px 32px rgba(0,0,0,0.08)'; el.style.borderColor = p.accent; }}
                  onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'none'; el.style.boxShadow = 'none'; el.style.borderColor = 'var(--line)'; }}>
                  <div style={{ height: 90, backgroundColor: p.accent, position: 'relative', overflow: 'hidden' }}>
                    <svg width="100%" height="100%" viewBox="0 0 280 90" opacity="0.5"><rect x="20" y="14" width="80" height="60" fill="none" stroke="white" strokeWidth="1"/><rect x="110" y="14" width="70" height="28" fill="none" stroke="white" strokeWidth="1"/><rect x="110" y="46" width="70" height="28" fill="none" stroke="white" strokeWidth="1"/><rect x="190" y="14" width="60" height="60" fill="none" stroke="white" strokeWidth="1"/></svg>
                  </div>
                  <div style={{ padding: '18px 22px' }}>
                    <h3 style={{ fontSize: 16, fontWeight: 500, color: 'var(--ink)', marginBottom: 10 }}>{project.name}</h3>
                    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 14 }}>
                      <span style={{ fontSize: 12, color: 'var(--steel)' }}>◱ {project.requirements.plotWidth}×{project.requirements.plotDepth} ft</span>
                      <span style={{ fontSize: 12, color: 'var(--steel)' }}>≡ {project.requirements.floors} levels</span>
                      <span style={{ fontSize: 12, color: 'var(--steel)' }}>₹{project.requirements.budget}L</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTop: '1px solid var(--line)' }}>
                      <span style={{ fontSize: 11, color: 'var(--steel)', fontFamily: 'var(--font-mono)' }}>{new Date(project.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        <span style={{ fontSize: 12, color: p.accent, fontWeight: 500 }}>Open →</span>
                        <button onClick={e => handleDelete(project.id, e)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--steel)', fontSize: 12 }} title="Delete">✕</button>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Deliverables catalog (collapsible) */}
        <button onClick={() => setShowCatalog(s => !s)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 8, border: '1px solid var(--line)', backgroundColor: 'white', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 600, color: 'var(--ink)', width: '100%', justifyContent: 'space-between' }}>
          <span>📋 Deliverables Catalog — every sheet this module produces</span>
          <span style={{ color: p.accent }}>{showCatalog ? '−' : '+'}</span>
        </button>
        {showCatalog && (
          <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: 16 }}>
            {p.groups.map(g => (
              <div key={g.discipline} style={{ border: '1px solid var(--line)', borderRadius: 8, backgroundColor: 'white', padding: 18 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', marginBottom: 10 }}>{g.icon} {g.discipline}</div>
                {g.sheets.map(s => <div key={s} style={{ fontSize: 12.5, color: 'var(--steel)', padding: '3px 0', display: 'flex', gap: 7, alignItems: 'center' }}><span style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: p.accent }} />{s}</div>)}
              </div>
            ))}
            <div style={{ border: '1px solid var(--line)', borderRadius: 8, backgroundColor: 'white', padding: 18 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', marginBottom: 10 }}>📑 Reports</div>
              {p.reports.map(s => <div key={s} style={{ fontSize: 12.5, color: 'var(--steel)', padding: '3px 0', display: 'flex', gap: 7, alignItems: 'center' }}><span style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: p.accent }} />{s}</div>)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
