'use client';
// Shared dashboard for the new building-type modules (Apartment, Mixed-Use,
// Commercial). Shows the full deliverables catalog for the typology and the
// rollout roadmap while the generation engine for that typology is built out.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getCurrentUser, signOut } from '@/lib/store';
import { useIsMobile } from '@/lib/useIsMobile';

export interface DrawingGroup {
  discipline: string;
  icon: string;
  sheets: string[];
}

export interface ModuleConfig {
  title: string;
  accent: string;
  examples: string[];
  intro: string;
  groups: DrawingGroup[];
  reports: string[];
  extras: string[]; // 3D model, site visit, etc.
}

export default function ModuleDashboard({ config }: { config: ModuleConfig }) {
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);
  const [openGroup, setOpenGroup] = useState<string | null>(config.groups[0]?.discipline ?? null);
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
      setMounted(true);
    })();
  }, [router]);

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
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

  const totalSheets = config.groups.reduce((s, g) => s + g.sheets.length, 0) + config.reports.length;

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
          {!isMobile && <span style={{ fontSize: 14, color: 'var(--steel)', fontWeight: 300 }}>{config.title}</span>}
          <Link href="/dashboard" style={{ fontSize: 12, color: 'var(--blueprint)', textDecoration: 'none', whiteSpace: 'nowrap' }}>← All Building Types</Link>
        </div>
        <div style={{ display: 'flex', gap: isMobile ? 8 : 12, alignItems: 'center' }}>
          {user && (
            <div style={{ width: 32, height: 32, borderRadius: '50%', backgroundColor: 'var(--blueprint)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 13, fontWeight: 600 }}>
              {user.name.charAt(0).toUpperCase()}
            </div>
          )}
          <button onClick={handleSignOut} style={{ padding: '8px 12px', borderRadius: 4, border: '1px solid var(--line-strong)', backgroundColor: 'transparent', color: 'var(--steel)', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-body)', whiteSpace: 'nowrap' }}>
            {isMobile ? 'Out' : 'Sign Out'}
          </button>
        </div>
      </div>

      <div style={{ padding: isMobile ? '28px 16px' : '56px 48px', maxWidth: 1100, margin: '0 auto' }}>
        {/* Hero */}
        <div style={{ marginBottom: isMobile ? 28 : 44 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 14, padding: '5px 14px', borderRadius: 100, backgroundColor: '#fefce8', border: '1px solid #fde68a' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#a16207', letterSpacing: '0.08em', textTransform: 'uppercase' }}>◐ Early Access — generation engine in development</span>
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: isMobile ? 28 : 40, fontWeight: 300, color: 'var(--ink)', marginBottom: 10, lineHeight: 1.15 }}>
            {config.title}
          </h1>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
            {config.examples.map(e => (
              <span key={e} style={{ padding: '3px 12px', borderRadius: 100, fontSize: 12, backgroundColor: 'white', border: `1px solid ${config.accent}44`, color: config.accent, fontWeight: 500 }}>{e}</span>
            ))}
          </div>
          <p style={{ color: 'var(--steel)', fontSize: 15, fontWeight: 300, maxWidth: 700, lineHeight: 1.7 }}>{config.intro}</p>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: isMobile ? 12 : 20, marginBottom: isMobile ? 28 : 40 }}>
          {[
            { label: 'Drawing Sheets Planned', value: totalSheets },
            { label: 'Disciplines', value: config.groups.length },
            { label: 'Compliance Reports', value: config.reports.length },
          ].map((s, i) => (
            <div key={i} style={{ flex: 1, minWidth: 140, padding: isMobile ? 16 : 22, borderRadius: 6, border: '1px solid var(--line)', backgroundColor: 'white' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: isMobile ? 26 : 34, fontWeight: 600, color: config.accent, lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 12.5, color: 'var(--steel)', marginTop: 8, fontWeight: 300 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Deliverables catalog */}
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 400, color: 'var(--ink)', marginBottom: 6 }}>Deliverables Catalog</h2>
        <p style={{ fontSize: 13, color: 'var(--steel)', marginBottom: 20, fontWeight: 300 }}>
          Every sheet the AI pipeline will produce for this building type. Click a discipline to expand.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 40 }}>
          {config.groups.map(g => {
            const open = openGroup === g.discipline;
            return (
              <div key={g.discipline} style={{ border: '1px solid var(--line)', borderRadius: 8, backgroundColor: 'white', overflow: 'hidden' }}>
                <button
                  onClick={() => setOpenGroup(open ? null : g.discipline)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '16px 20px', border: 'none', backgroundColor: open ? `${config.accent}0d` : 'white',
                    cursor: 'pointer', fontFamily: 'var(--font-body)',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 18 }}>{g.icon}</span>
                    <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>{g.discipline}</span>
                    <span style={{ fontSize: 11, color: 'var(--steel)', fontFamily: 'var(--font-mono)' }}>{g.sheets.length} sheets</span>
                  </span>
                  <span style={{ color: config.accent, fontSize: 14 }}>{open ? '−' : '+'}</span>
                </button>
                {open && (
                  <div style={{ padding: '4px 20px 18px', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(260px, 1fr))', gap: 6 }}>
                    {g.sheets.map(s => (
                      <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--ink)', padding: '5px 0' }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: config.accent, flexShrink: 0 }} />
                        {s}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Reports + extras */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 20, marginBottom: 44 }}>
          <div style={{ border: '1px solid var(--line)', borderRadius: 8, backgroundColor: 'white', padding: 22 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)', marginBottom: 14 }}>📑 Reports</h3>
            {config.reports.map(r => (
              <div key={r} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--ink)', padding: '5px 0', borderBottom: '1px solid var(--line)' }}>
                <span style={{ color: config.accent }}>▸</span> {r}
              </div>
            ))}
          </div>
          <div style={{ border: '1px solid var(--line)', borderRadius: 8, backgroundColor: 'white', padding: 22 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)', marginBottom: 14 }}>🧰 Also Included</h3>
            {config.extras.map(r => (
              <div key={r} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--ink)', padding: '5px 0', borderBottom: '1px solid var(--line)' }}>
                <span style={{ color: config.accent }}>▸</span> {r}
              </div>
            ))}
            <div style={{ marginTop: 18, padding: '12px 14px', borderRadius: 6, backgroundColor: '#fef2f2', border: '1px solid #fecaca', fontSize: 11.5, color: '#b91c1c' }}>
              ⚠ All engineering outputs require licensed professional approval — the platform assists architects, it does not replace them.
            </div>
          </div>
        </div>

        {/* Roadmap */}
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 400, color: 'var(--ink)', marginBottom: 18 }}>Rollout Roadmap</h2>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 16, marginBottom: 44 }}>
          {[
            { phase: 'MVP', items: ['Site Plan', 'Floor Plans', 'Elevations', 'Sections', 'Door/Window Schedules'], state: 'In development' },
            { phase: 'V2', items: ['Structural Plans', 'Plumbing Plans', 'Electrical Plans'], state: 'Planned' },
            { phase: 'V3 — Professional', items: ['HVAC', 'Fire Safety', 'Compliance Reports', 'Cost Estimation & BOQ', '3D Model', 'Site Visit Management'], state: 'Planned' },
          ].map((p, i) => (
            <div key={p.phase} style={{ border: `1px solid ${i === 0 ? config.accent : 'var(--line)'}`, borderRadius: 8, backgroundColor: 'white', padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, color: i === 0 ? config.accent : 'var(--ink)' }}>{p.phase}</span>
                <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: i === 0 ? '#a16207' : 'var(--steel)' }}>{p.state}</span>
              </div>
              {p.items.map(it => (
                <div key={it} style={{ fontSize: 12.5, color: 'var(--ink)', padding: '4px 0', display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: i === 0 ? config.accent : 'var(--line-strong)' }} /> {it}
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* CTA */}
        <div style={{ textAlign: 'center', padding: '40px 24px', border: '2px dashed var(--line-strong)', borderRadius: 8 }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 300, color: 'var(--ink)', marginBottom: 10 }}>
            This module is being built on the same engine as Bungalow / Houses
          </h3>
          <p style={{ color: 'var(--steel)', fontSize: 14, fontWeight: 300, marginBottom: 22, maxWidth: 560, margin: '0 auto 22px' }}>
            The deterministic planner (LLM never draws geometry), NBC compliance core, and drawing
            pipeline are shared. Try the live residential module while this one is in early access.
          </p>
          <Link href="/dashboard/bungalow" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 28px', borderRadius: 4, backgroundColor: 'var(--blueprint)', color: 'white', textDecoration: 'none', fontSize: 15, fontWeight: 500 }}>
            Open Bungalow / Houses →
          </Link>
        </div>
      </div>
    </div>
  );
}
