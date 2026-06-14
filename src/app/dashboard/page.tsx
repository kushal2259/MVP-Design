'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getCurrentUser, signOut } from '@/lib/store';
import { useIsMobile } from '@/lib/useIsMobile';

interface BuildingType {
  id: string;
  href: string;
  title: string;
  examples: string;
  description: string;
  status: 'live' | 'beta';
  accent: string;
  icon: React.ReactNode;
}

const TYPES: BuildingType[] = [
  {
    id: 'bungalow',
    href: '/dashboard/bungalow',
    title: 'Bungalow / Houses',
    examples: 'Villas · Row houses · G+1 to G+3 independent homes',
    description: 'Floor plans, CAD editor, 3D walkthrough, elevations, Vastu, NBC compliance, engineering drafts, cost & BOQ — the full residential package.',
    status: 'live',
    accent: 'var(--blueprint)',
    icon: (
      <svg width="44" height="44" viewBox="0 0 48 48" fill="none">
        <path d="M8 22L24 8l16 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M12 20v18h24V20" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        <rect x="20" y="28" width="8" height="10" stroke="currentColor" strokeWidth="1.5"/>
      </svg>
    ),
  },
  {
    id: 'apartment',
    href: '/dashboard/apartment',
    title: 'Apartment',
    examples: 'G+4 · G+10 · High-rise residential towers',
    description: 'Unit mix & typical floor plans, lift/stair cores, refuge areas, parking, STP & fire layouts, FAR/FSI and NBC compliance reports.',
    status: 'beta',
    accent: '#7c3aed',
    icon: (
      <svg width="44" height="44" viewBox="0 0 48 48" fill="none">
        <rect x="12" y="6" width="24" height="36" stroke="currentColor" strokeWidth="2"/>
        {[12, 19, 26, 33].map(y => (
          <g key={y}>
            <rect x="16" y={y} width="5" height="4" stroke="currentColor" strokeWidth="1.2"/>
            <rect x="27" y={y} width="5" height="4" stroke="currentColor" strokeWidth="1.2"/>
          </g>
        ))}
      </svg>
    ),
  },
  {
    id: 'mixed-use',
    href: '/dashboard/mixed-use',
    title: 'Apartment + Commercial',
    examples: 'Shops on ground · Offices · Apartments above',
    description: 'Mixed-use buildings — commercial floors below, residential above. Combined cores, separate services, mixed-use compliance & parking reports.',
    status: 'beta',
    accent: '#0d9488',
    icon: (
      <svg width="44" height="44" viewBox="0 0 48 48" fill="none">
        <rect x="10" y="20" width="28" height="22" stroke="currentColor" strokeWidth="2"/>
        <rect x="10" y="30" width="28" height="12" stroke="currentColor" strokeWidth="1.2"/>
        <path d="M8 20l4-8h24l4 8" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
        <rect x="15" y="24" width="6" height="4" stroke="currentColor" strokeWidth="1.2"/>
        <rect x="27" y="24" width="6" height="4" stroke="currentColor" strokeWidth="1.2"/>
        <rect x="14" y="33" width="20" height="9" stroke="currentColor" strokeWidth="1.2"/>
      </svg>
    ),
  },
  {
    id: 'commercial',
    href: '/dashboard/commercial',
    title: 'Commercial',
    examples: 'Offices · Malls · Hospitals · Schools · Hotels',
    description: 'Commercial floor & shop layouts, HVAC with smoke management, vertical transportation, occupancy-load and energy-efficiency reports.',
    status: 'beta',
    accent: '#c2410c',
    icon: (
      <svg width="44" height="44" viewBox="0 0 48 48" fill="none">
        <rect x="6" y="14" width="20" height="28" stroke="currentColor" strokeWidth="2"/>
        <rect x="26" y="22" width="16" height="20" stroke="currentColor" strokeWidth="2"/>
        <path d="M6 14l10-6 10 6" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
        <rect x="11" y="20" width="4" height="4" stroke="currentColor" strokeWidth="1.2"/>
        <rect x="11" y="28" width="4" height="4" stroke="currentColor" strokeWidth="1.2"/>
        <rect x="31" y="27" width="6" height="4" stroke="currentColor" strokeWidth="1.2"/>
      </svg>
    ),
  },
];

export default function BuildingTypeDashboard() {
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
          {!isMobile && <span style={{ fontSize: 14, color: 'var(--steel)', fontWeight: 300 }}>Choose Building Type</span>}
        </div>
        <div style={{ display: 'flex', gap: isMobile ? 8 : 12, alignItems: 'center' }}>
          {user && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', backgroundColor: 'var(--blueprint)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 13, fontWeight: 600 }}>
                {user.name.charAt(0).toUpperCase()}
              </div>
              {!isMobile && (
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)', lineHeight: 1.2 }}>{user.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--steel)' }}>{user.email}</div>
                </div>
              )}
            </div>
          )}
          <button onClick={handleSignOut} style={{ padding: '8px 12px', borderRadius: 4, border: '1px solid var(--line-strong)', backgroundColor: 'transparent', color: 'var(--steel)', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-body)', whiteSpace: 'nowrap' }}>
            {isMobile ? 'Out' : 'Sign Out'}
          </button>
        </div>
      </div>

      <div style={{ padding: isMobile ? '32px 16px' : '64px 48px', maxWidth: 1100, margin: '0 auto' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: isMobile ? 30 : 42, fontWeight: 300, color: 'var(--ink)', marginBottom: 12, lineHeight: 1.15 }}>
          What are you designing today?
        </h1>
        <p style={{ color: 'var(--steel)', fontSize: 15, fontWeight: 300, marginBottom: isMobile ? 28 : 48, maxWidth: 640 }}>
          Each building type has its own AI design pipeline — drawings, compliance checks and engineering
          packages tailored to that typology.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: isMobile ? 16 : 24 }}>
          {TYPES.map(t => (
            <Link key={t.id} href={t.href} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div
                style={{
                  border: '1px solid var(--line)', borderRadius: 8, backgroundColor: 'white',
                  padding: isMobile ? '24px 20px' : '32px 28px', height: '100%',
                  transition: 'all 0.2s', cursor: 'pointer', position: 'relative', overflow: 'hidden',
                }}
                onMouseEnter={e => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.transform = 'translateY(-3px)';
                  el.style.boxShadow = '0 12px 40px rgba(0,0,0,0.09)';
                  el.style.borderColor = t.accent;
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.transform = 'none';
                  el.style.boxShadow = 'none';
                  el.style.borderColor = 'var(--line)';
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
                  <div style={{ color: t.accent }}>{t.icon}</div>
                  <span style={{
                    fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
                    padding: '4px 10px', borderRadius: 100,
                    backgroundColor: t.status === 'live' ? '#f0fdf4' : '#fefce8',
                    color: t.status === 'live' ? '#16a34a' : '#a16207',
                    border: `1px solid ${t.status === 'live' ? '#bbf7d0' : '#fde68a'}`,
                  }}>
                    {t.status === 'live' ? '● Live' : '◐ Early Access'}
                  </span>
                </div>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 500, color: 'var(--ink)', marginBottom: 6 }}>{t.title}</h2>
                <div style={{ fontSize: 12, color: t.accent, fontWeight: 500, marginBottom: 12, fontFamily: 'var(--font-mono)' }}>{t.examples}</div>
                <p style={{ fontSize: 13.5, color: 'var(--steel)', lineHeight: 1.65, fontWeight: 300, marginBottom: 18 }}>{t.description}</p>
                <span style={{ fontSize: 13, color: t.accent, fontWeight: 600 }}>Open workspace →</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
