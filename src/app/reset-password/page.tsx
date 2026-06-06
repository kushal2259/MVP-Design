'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { updatePassword } from '@/lib/store';

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '11px 14px', borderRadius: 6,
  border: '1.5px solid var(--line-strong)', fontSize: 14,
  fontFamily: 'var(--font-body)', outline: 'none',
  backgroundColor: 'white', color: 'var(--ink)', boxSizing: 'border-box',
};

export default function ResetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // When the user lands here from the email link, Supabase parses the recovery
    // token from the URL and emits a PASSWORD_RECOVERY / SIGNED_IN event.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) setHasSession(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setHasSession(true);
      setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pass.length < 6) { setMsg('Password must be at least 6 characters'); return; }
    if (pass !== pass2) { setMsg('Passwords do not match'); return; }
    setBusy(true);
    const res = await updatePassword(pass);
    setBusy(false);
    if (!res.ok) { setMsg(res.error || 'Error'); return; }
    setDone(true);
    setTimeout(() => router.push('/dashboard'), 1800);
  };

  return (
    <main style={{ minHeight: '100vh', backgroundColor: 'var(--paper)', fontFamily: 'var(--font-body)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: 420, maxWidth: '95vw', backgroundColor: 'white', borderRadius: 12, padding: '40px 44px', border: '1px solid var(--line-strong)', boxShadow: '0 24px 60px rgba(0,0,0,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 28 }}>
          <svg width="24" height="24" viewBox="0 0 28 28" fill="none">
            <rect x="2" y="2" width="24" height="24" rx="2" stroke="var(--blueprint)" strokeWidth="1.5"/>
            <path d="M7 21L21 7M7 7h14M7 7v14" stroke="var(--amber)" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600 }}>ArchCopilot</span>
        </div>

        {!ready ? (
          <p style={{ color: 'var(--steel)', fontSize: 14 }}>Loading…</p>
        ) : done ? (
          <>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 400, marginBottom: 6, color: '#16a34a' }}>✓ Password updated</h2>
            <p style={{ color: 'var(--steel)', fontSize: 13 }}>Redirecting you to your dashboard…</p>
          </>
        ) : !hasSession ? (
          <>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 400, marginBottom: 6 }}>Link expired</h2>
            <p style={{ color: 'var(--steel)', fontSize: 13, marginBottom: 24 }}>
              This password reset link is invalid or has expired. Please request a new one from the sign-in page.
            </p>
            <Link href="/?auth=forgot" style={{ display: 'inline-block', padding: '11px 24px', borderRadius: 6, backgroundColor: 'var(--blueprint)', color: 'white', textDecoration: 'none', fontSize: 14, fontWeight: 500 }}>
              ← Back to sign in
            </Link>
          </>
        ) : (
          <>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 400, marginBottom: 6 }}>Set a new password</h2>
            <p style={{ color: 'var(--steel)', fontSize: 13, marginBottom: 28 }}>Choose a strong password for your account</p>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--steel)', display: 'block', marginBottom: 5 }}>New Password</label>
                <input type="password" required style={inputStyle} value={pass} onChange={e => setPass(e.target.value)} placeholder="At least 6 characters" />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--steel)', display: 'block', marginBottom: 5 }}>Confirm Password</label>
                <input type="password" required style={inputStyle} value={pass2} onChange={e => setPass2(e.target.value)} placeholder="••••••••" />
              </div>
              {msg && <p style={{ color: '#dc2626', fontSize: 12, margin: 0 }}>{msg}</p>}
              <button type="submit" disabled={busy} style={{ padding: '11px', borderRadius: 6, backgroundColor: 'var(--blueprint)', color: 'white', border: 'none', fontSize: 14, fontWeight: 500, cursor: 'pointer', marginTop: 4, opacity: busy ? 0.7 : 1 }}>
                {busy ? 'Updating…' : 'Update Password'}
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
