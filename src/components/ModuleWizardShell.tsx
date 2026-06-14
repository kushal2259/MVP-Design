'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getCurrentUser } from '@/lib/store';

export const fieldLabel: React.CSSProperties = { display: 'block', fontSize: 12, color: 'var(--steel)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 };
export const fieldInput: React.CSSProperties = { width: '100%', padding: '9px 12px', borderRadius: 6, border: '1px solid var(--line-strong)', fontSize: 14, fontFamily: 'var(--font-body)', backgroundColor: 'white', color: 'var(--ink)' };

export function chip(active: boolean, accent: string): React.CSSProperties {
  return {
    padding: '8px 16px', borderRadius: 6, fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-body)',
    border: `1.5px solid ${active ? accent : 'var(--line-strong)'}`, backgroundColor: active ? accent : 'white',
    color: active ? 'white' : 'var(--steel)', fontWeight: active ? 600 : 400,
  };
}

export default function ModuleWizardShell({ title, subtitle, accent, dashboardHref, generating, canGenerate, generateLabel, onGenerate, children }: {
  title: string; subtitle: string; accent: string; dashboardHref: string;
  generating: boolean; canGenerate: boolean; generateLabel: string;
  onGenerate: () => void; children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  useEffect(() => {
    (async () => {
      const u = await getCurrentUser();
      if (!u) { router.replace('/?auth=signin'); return; }
      setMounted(true);
    })();
  }, [router]);

  if (!mounted) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--paper)' }}>
      <div style={{ width: 40, height: 40, border: `2px solid ${accent}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--paper)', fontFamily: 'var(--font-body)' }}>
      <div style={{ borderBottom: '1px solid var(--line)', padding: '0 32px', height: 60, display: 'flex', alignItems: 'center', gap: 16, backgroundColor: 'var(--paper)' }}>
        <Link href={dashboardHref} style={{ color: 'var(--steel)', textDecoration: 'none', fontSize: 13 }}>← Dashboard</Link>
        <span style={{ color: 'var(--line-strong)' }}>|</span>
        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>{title}</span>
      </div>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 24px' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 300, color: 'var(--ink)', marginBottom: 8 }}>{title}</h1>
        <p style={{ color: 'var(--steel)', fontSize: 14, fontWeight: 300, marginBottom: 32 }}>{subtitle}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>{children}</div>
        <button onClick={onGenerate} disabled={generating || !canGenerate} style={{
          marginTop: 32, padding: '14px 28px', borderRadius: 6, border: 'none', width: '100%',
          backgroundColor: generating || !canGenerate ? 'var(--line-strong)' : accent, color: 'white',
          fontSize: 15, fontWeight: 600, cursor: generating || !canGenerate ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-body)',
        }}>{generating ? 'Generating design…' : generateLabel}</button>
      </div>
    </div>
  );
}
