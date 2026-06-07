'use client';
import Link from 'next/link';
import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn, signUp, sendPasswordReset, getCurrentUser } from '@/lib/store';

const FEATURES = [
  { icon: '⬡', title: 'AI Requirement Analysis', desc: 'Natural language to structured architectural data in seconds' },
  { icon: '◱', title: 'Floor Plan Generation', desc: 'Multi-option layouts for all floors with room-level detail' },
  { icon: '◈', title: 'Cost Estimation', desc: 'Economy, standard & premium estimates with full BOQ' },
  { icon: '◎', title: 'Interior Concepts', desc: 'Room-by-room design narratives, materials & palettes' },
  { icon: '◐', title: 'MEP Drafts', desc: 'Electrical, plumbing & HVAC preliminary layouts' },
  { icon: '◉', title: 'Compliance Assistant', desc: 'Location-aware FSI, setbacks & approval checklists' },
];

const STATS = [
  { value: '4 min', label: 'Avg. concept generation time' },
  { value: '12+', label: 'Drawing types generated' },
  { value: '95%', label: 'Accuracy on space allocation' },
  { value: '3×', label: 'Faster than manual process' },
];

type ModalMode = 'signin' | 'signup' | 'forgot' | null;

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px', borderRadius: 6,
  border: '1.5px solid var(--line-strong)', fontSize: 14,
  fontFamily: 'var(--font-body)', outline: 'none',
  backgroundColor: 'var(--paper)', color: 'var(--ink)',
  boxSizing: 'border-box',
};

function HomePageInner() {
  const [mounted, setMounted] = useState(false);
  const [modal, setModal] = useState<ModalMode>(null);
  const [user, setUser] = useState<{ name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  // Sign in form
  const [siEmail, setSiEmail] = useState('');
  const [siPass, setSiPass] = useState('');
  const [siError, setSiError] = useState('');

  // Sign up form
  const [suName, setSuName] = useState('');
  const [suEmail, setSuEmail] = useState('');
  const [suPass, setSuPass] = useState('');
  const [suPass2, setSuPass2] = useState('');
  const [suError, setSuError] = useState('');

  // Forgot password form
  const [fpEmail, setFpEmail] = useState('');
  const [fpMsg, setFpMsg] = useState('');

  useEffect(() => {
    setMounted(true);
    (async () => {
      const u = await getCurrentUser();
      if (u) { setUser(u); return; }
      const auth = searchParams.get('auth');
      if (auth === 'signin') setModal('signin');
      else if (auth === 'signup') setModal('signup');
    })();
  }, [searchParams]);

  const openModal = (mode: ModalMode) => {
    setSiError(''); setSuError(''); setFpMsg('');
    setModal(mode);
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const res = await signIn(siEmail, siPass);
    setBusy(false);
    if (!res.ok) { setSiError(res.error || 'Error'); return; }
    const u = await getCurrentUser();
    setUser(u);
    setModal(null);
    router.push('/dashboard');
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (suPass !== suPass2) { setSuError('Passwords do not match'); return; }
    if (suPass.length < 6) { setSuError('Password must be at least 6 characters'); return; }
    setBusy(true);
    const res = await signUp(suName, suEmail, suPass);
    setBusy(false);
    if (!res.ok) { setSuError(res.error || 'Error'); return; }
    if (res.needsConfirmation) {
      setSuError('');
      setModal('signin');
      setSiError('✓ Account created! Please check your email to confirm, then sign in.');
      return;
    }
    const u = await getCurrentUser();
    setUser(u);
    setModal(null);
    router.push('/dashboard');
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const res = await sendPasswordReset(fpEmail);
    setBusy(false);
    if (!res.ok) { setFpMsg(res.error || 'Error'); return; }
    setFpMsg('✓ Password reset link sent! Check your email inbox.');
  };

  return (
    <main style={{ fontFamily: 'var(--font-body)', backgroundColor: 'var(--paper)', color: 'var(--ink)', minHeight: '100vh', overflowX: 'hidden' }}>

      {/* ── Auth Modal ── */}
      {modal && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 1000, backgroundColor: 'rgba(10,15,28,0.6)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setModal(null)}
        >
          <div
            style={{ backgroundColor: 'var(--paper)', borderRadius: 12, padding: '40px 44px', width: 420, maxWidth: '95vw', border: '1px solid var(--line-strong)', boxShadow: '0 32px 80px rgba(0,0,0,0.2)', position: 'relative' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Close */}
            <button onClick={() => setModal(null)} style={{ position: 'absolute', top: 16, right: 18, background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--steel)', lineHeight: 1 }}>×</button>

            {/* Logo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 28 }}>
              <svg width="24" height="24" viewBox="0 0 28 28" fill="none">
                <rect x="2" y="2" width="24" height="24" rx="2" stroke="var(--blueprint)" strokeWidth="1.5"/>
                <path d="M7 21L21 7M7 7h14M7 7v14" stroke="var(--amber)" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600 }}>ArchCopilot</span>
            </div>

            {/* ── Sign In ── */}
            {modal === 'signin' && (
              <>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 400, marginBottom: 6 }}>Welcome back</h2>
                <p style={{ color: 'var(--steel)', fontSize: 13, marginBottom: 28 }}>Sign in to access your projects</p>
                <form onSubmit={handleSignIn} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--steel)', display: 'block', marginBottom: 5 }}>Email</label>
                    <input type="email" required style={inputStyle} value={siEmail} onChange={e => setSiEmail(e.target.value)} placeholder="you@example.com" />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--steel)', display: 'block', marginBottom: 5 }}>Password</label>
                    <input type="password" required style={inputStyle} value={siPass} onChange={e => setSiPass(e.target.value)} placeholder="••••••••" />
                  </div>
                  {siError && <p style={{ color: siError.startsWith('✓') ? '#16a34a' : '#dc2626', fontSize: 12, margin: 0 }}>{siError}</p>}
                  <button type="submit" disabled={busy} style={{ padding: '11px', borderRadius: 6, backgroundColor: 'var(--blueprint)', color: 'white', border: 'none', fontSize: 14, fontWeight: 500, cursor: 'pointer', marginTop: 4, opacity: busy ? 0.7 : 1 }}>
                    {busy ? 'Signing in…' : 'Sign In →'}
                  </button>
                </form>
                <div style={{ marginTop: 20, display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <button onClick={() => openModal('forgot')} style={{ background: 'none', border: 'none', color: 'var(--blueprint)', cursor: 'pointer', fontSize: 13, padding: 0 }}>Forgot password?</button>
                  <button onClick={() => openModal('signup')} style={{ background: 'none', border: 'none', color: 'var(--steel)', cursor: 'pointer', fontSize: 13, padding: 0 }}>
                    No account? <span style={{ color: 'var(--blueprint)', fontWeight: 500 }}>Sign up</span>
                  </button>
                </div>
              </>
            )}

            {/* ── Sign Up ── */}
            {modal === 'signup' && (
              <>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 400, marginBottom: 6 }}>Create account</h2>
                <p style={{ color: 'var(--steel)', fontSize: 13, marginBottom: 28 }}>Start designing in minutes — no credit card needed</p>
                <form onSubmit={handleSignUp} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--steel)', display: 'block', marginBottom: 5 }}>Full Name</label>
                    <input type="text" required style={inputStyle} value={suName} onChange={e => setSuName(e.target.value)} placeholder="Rahul Sharma" />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--steel)', display: 'block', marginBottom: 5 }}>Email</label>
                    <input type="email" required style={inputStyle} value={suEmail} onChange={e => setSuEmail(e.target.value)} placeholder="you@example.com" />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--steel)', display: 'block', marginBottom: 5 }}>Password</label>
                    <input type="password" required style={inputStyle} value={suPass} onChange={e => setSuPass(e.target.value)} placeholder="At least 6 characters" />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--steel)', display: 'block', marginBottom: 5 }}>Confirm Password</label>
                    <input type="password" required style={inputStyle} value={suPass2} onChange={e => setSuPass2(e.target.value)} placeholder="••••••••" />
                  </div>
                  {suError && <p style={{ color: '#dc2626', fontSize: 12, margin: 0 }}>{suError}</p>}
                  <button type="submit" disabled={busy} style={{ padding: '11px', borderRadius: 6, backgroundColor: 'var(--amber)', color: 'white', border: 'none', fontSize: 14, fontWeight: 500, cursor: 'pointer', marginTop: 4, opacity: busy ? 0.7 : 1 }}>
                    {busy ? 'Creating…' : 'Create Account →'}
                  </button>
                </form>
                <p style={{ marginTop: 20, textAlign: 'center', fontSize: 13, color: 'var(--steel)' }}>
                  Already have an account?{' '}
                  <button onClick={() => openModal('signin')} style={{ background: 'none', border: 'none', color: 'var(--blueprint)', cursor: 'pointer', fontSize: 13, fontWeight: 500, padding: 0 }}>Sign in</button>
                </p>
              </>
            )}

            {/* ── Forgot Password ── */}
            {modal === 'forgot' && (
              <>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 400, marginBottom: 6 }}>Reset Password</h2>
                <p style={{ color: 'var(--steel)', fontSize: 13, marginBottom: 28 }}>Enter your email — we&apos;ll send you a secure reset link</p>
                <form onSubmit={handleForgot} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--steel)', display: 'block', marginBottom: 5 }}>Email</label>
                    <input type="email" required style={inputStyle} value={fpEmail} onChange={e => setFpEmail(e.target.value)} placeholder="you@example.com" />
                  </div>
                  {fpMsg && <p style={{ color: fpMsg.startsWith('✓') ? '#16a34a' : '#dc2626', fontSize: 12, margin: 0 }}>{fpMsg}</p>}
                  <button type="submit" disabled={busy} style={{ padding: '11px', borderRadius: 6, backgroundColor: 'var(--blueprint)', color: 'white', border: 'none', fontSize: 14, fontWeight: 500, cursor: 'pointer', marginTop: 4, opacity: busy ? 0.7 : 1 }}>
                    {busy ? 'Sending…' : 'Send Reset Link'}
                  </button>
                </form>
                <p style={{ marginTop: 20, textAlign: 'center', fontSize: 13, color: 'var(--steel)' }}>
                  <button onClick={() => openModal('signin')} style={{ background: 'none', border: 'none', color: 'var(--blueprint)', cursor: 'pointer', fontSize: 13, fontWeight: 500, padding: 0 }}>← Back to sign in</button>
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Nav */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 48px', height: 64,
        borderBottom: '1px solid var(--line)',
        backgroundColor: 'rgba(245,243,238,0.92)',
        backdropFilter: 'blur(16px)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <rect x="2" y="2" width="24" height="24" rx="2" stroke="var(--blueprint)" strokeWidth="1.5"/>
            <path d="M7 21L21 7M7 7h14M7 7v14" stroke="var(--amber)" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em' }}>ArchCopilot</span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {user ? (
            <>
              <span style={{ fontSize: 13, color: 'var(--steel)', marginRight: 4 }}>Hi, {user.name.split(' ')[0]}</span>
              <Link href="/dashboard" style={{ padding: '8px 20px', borderRadius: 4, border: '1.5px solid var(--blueprint)', color: 'var(--blueprint)', textDecoration: 'none', fontSize: 14, fontWeight: 500 }}>
                Dashboard
              </Link>
            </>
          ) : (
            <>
              <button onClick={() => openModal('signin')} style={{ padding: '8px 20px', borderRadius: 4, border: '1.5px solid var(--blueprint)', color: 'var(--blueprint)', backgroundColor: 'transparent', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
                Sign In
              </button>
              <button onClick={() => openModal('signup')} style={{ padding: '8px 20px', borderRadius: 4, backgroundColor: 'var(--amber)', color: 'white', border: 'none', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
                Sign Up →
              </button>
            </>
          )}
        </div>
      </nav>

      {/* Hero */}
      <section style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-start', padding: '120px 80px 80px', position: 'relative', overflow: 'hidden' }}>
        {/* Hero house photo */}
        <style>{`@keyframes floaty { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-12px); } }`}</style>
        <div style={{
          position: 'absolute', top: 0, bottom: 0, right: '3%', width: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none',
          opacity: mounted ? 1 : 0, transform: mounted ? 'none' : 'translateY(24px)',
          transition: 'opacity 1.1s ease 0.3s, transform 1.1s ease 0.3s',
        }}>
          {/* soft glow behind */}
          <div style={{
            position: 'absolute', width: '92%', height: '78%', borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(200,133,58,0.18), rgba(74,114,196,0.07) 55%, transparent 72%)',
            filter: 'blur(12px)',
          }} />
          <div style={{ position: 'relative', animation: 'floaty 8s ease-in-out infinite', display: 'inline-block' }}>
            <img
              src="/hero-house.jpg"
              alt="Modern architectural villa designed with ArchCopilot"
              style={{
                display: 'block',
                width: 'auto', height: 'auto',
                maxHeight: '80vh', maxWidth: '100%',
                mixBlendMode: 'multiply',
              }}
            />
            {/* floating spec chip */}
            <div style={{
              position: 'absolute', bottom: 24, left: 0,
              backgroundColor: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(8px)',
              borderRadius: 10, padding: '10px 16px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.14)',
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: 'var(--amber)' }} />
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.2 }}>Modern Villa Concept</div>
                <div style={{ fontSize: 10, color: 'var(--steel)', fontFamily: 'var(--font-mono)' }}>AI-generated 3D model</div>
              </div>
            </div>
          </div>
        </div>

        {/* Tag */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 100, border: '1px solid var(--amber)', marginBottom: 32, opacity: mounted ? 1 : 0, transform: mounted ? 'none' : 'translateY(10px)', transition: 'all 0.6s ease', backgroundColor: 'rgba(200,133,58,0.06)' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: 'var(--amber)', display: 'inline-block' }} />
          <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--amber)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>AI Architectural Copilot</span>
        </div>

        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(48px, 7vw, 92px)', fontWeight: 300, lineHeight: 1.05, letterSpacing: '-0.03em', maxWidth: '700px', marginBottom: 28, opacity: mounted ? 1 : 0, transform: mounted ? 'none' : 'translateY(20px)', transition: 'all 0.7s ease 0.1s' }}>
          Design faster.<br />
          <em style={{ fontStyle: 'italic', color: 'var(--blueprint-mid)' }}>Build smarter.</em>
        </h1>

        <p style={{ fontSize: 18, lineHeight: 1.7, color: 'var(--steel)', maxWidth: 520, marginBottom: 48, opacity: mounted ? 1 : 0, transform: mounted ? 'none' : 'translateY(20px)', transition: 'all 0.7s ease 0.2s', fontWeight: 300 }}>
          From client brief to complete architectural package — floor plans, elevations, cost estimates, BOQ, and 3D concepts — in minutes, not days.
        </p>

        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', opacity: mounted ? 1 : 0, transform: mounted ? 'none' : 'translateY(20px)', transition: 'all 0.7s ease 0.3s' }}>
          <button onClick={() => openModal('signup')} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '14px 32px', borderRadius: 4, backgroundColor: 'var(--blueprint)', color: 'white', border: 'none', fontSize: 15, fontWeight: 500, letterSpacing: '0.01em', boxShadow: '0 4px 24px rgba(26,39,68,0.2)', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
            Get Started Free
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </button>
          <button onClick={() => openModal('signin')} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '14px 32px', borderRadius: 4, border: '1.5px solid var(--line-strong)', color: 'var(--ink)', backgroundColor: 'transparent', fontSize: 15, fontWeight: 400, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
            Sign In to Dashboard
          </button>
        </div>

        {/* Stats bar */}
        <div style={{ display: 'flex', gap: 0, marginTop: 80, borderTop: '1px solid var(--line)', paddingTop: 40, width: '100%', maxWidth: 600, opacity: mounted ? 1 : 0, transition: 'opacity 0.8s ease 0.5s' }}>
          {STATS.map((s, i) => (
            <div key={i} style={{ flex: 1, paddingRight: 32 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 36, fontWeight: 600, color: 'var(--blueprint)', lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 12, color: 'var(--steel)', marginTop: 6, lineHeight: 1.4, fontWeight: 300 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section style={{ padding: '100px 80px', backgroundColor: 'var(--blueprint)', color: 'white' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ marginBottom: 64 }}>
            <p style={{ fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--amber-light)', marginBottom: 16, fontFamily: 'var(--font-mono)' }}>— Capabilities</p>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 52, fontWeight: 300, lineHeight: 1.1, letterSpacing: '-0.02em' }}>
              Everything an architect<br /><em style={{ color: 'var(--blueprint-light)' }}>needs to move fast</em>
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px', backgroundColor: 'rgba(255,255,255,0.1)' }}>
            {FEATURES.map((f, i) => (
              <div key={i} style={{ padding: '40px 36px', backgroundColor: 'var(--blueprint)', transition: 'background-color 0.2s' }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--blueprint-mid)')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'var(--blueprint)')}>
                <div style={{ fontSize: 28, marginBottom: 16, opacity: 0.7 }}>{f.icon}</div>
                <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 10, letterSpacing: '-0.01em' }}>{f.title}</div>
                <div style={{ fontSize: 14, color: 'var(--steel-light)', lineHeight: 1.6, fontWeight: 300 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section style={{ padding: '100px 80px' }} className="paper-grid">
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <p style={{ fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--amber)', marginBottom: 16, fontFamily: 'var(--font-mono)' }}>— Workflow</p>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 52, fontWeight: 300, marginBottom: 64, lineHeight: 1.1, letterSpacing: '-0.02em' }}>Four steps<br />to a complete design</h2>
          {[
            { n: '01', title: 'Create Account', body: 'Sign up in seconds. Your projects are saved to your account and accessible from any device.' },
            { n: '02', title: 'Enter Requirements', body: 'Plot size, BHK, style, budget, and special needs in natural language. Our AI understands the way architects think.' },
            { n: '03', title: 'Design Generation', body: 'Floor plans, cost estimates, BOQ, interior concepts, MEP drafts, and compliance notes — all generated simultaneously.' },
            { n: '04', title: 'Review & Export', body: 'Edit room sizes, compare layout options, and export to PDF, DXF, SVG or share with your client directly.' },
          ].map((step, i) => (
            <div key={i} style={{ display: 'flex', gap: 48, alignItems: 'flex-start', padding: '40px 0', borderBottom: '1px solid var(--line)' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--steel)', paddingTop: 6, minWidth: 32 }}>{step.n}</div>
              <div>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 500, marginBottom: 12, letterSpacing: '-0.01em' }}>{step.title}</h3>
                <p style={{ fontSize: 16, color: 'var(--steel)', lineHeight: 1.7, fontWeight: 300, maxWidth: 520 }}>{step.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: '80px', backgroundColor: 'var(--ink)', color: 'white', textAlign: 'center' }}>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--amber)', marginBottom: 24 }}>— Start Today</p>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 52, fontWeight: 300, marginBottom: 24, letterSpacing: '-0.02em' }}>
          Your next project,<br /><em style={{ color: 'var(--blueprint-light)' }}>ready in minutes</em>
        </h2>
        <p style={{ color: 'var(--steel-light)', fontSize: 16, marginBottom: 40, fontWeight: 300 }}>Free to use. No credit card required.</p>
        <button onClick={() => openModal('signup')} style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '16px 40px', borderRadius: 4, backgroundColor: 'var(--amber)', color: 'white', border: 'none', fontSize: 16, fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
          Create Free Account →
        </button>
      </section>

      {/* Footer */}
      <footer style={{ padding: '32px 80px', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="20" height="20" viewBox="0 0 28 28" fill="none">
            <rect x="2" y="2" width="24" height="24" rx="2" stroke="var(--blueprint)" strokeWidth="1.5"/>
            <path d="M7 21L21 7M7 7h14M7 7v14" stroke="var(--amber)" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 500 }}>ArchCopilot</span>
        </div>
        <p style={{ fontSize: 12, color: 'var(--steel)', fontFamily: 'var(--font-mono)' }}>
          ⚠ All AI-generated drawings require licensed professional review before construction.
        </p>
      </footer>
    </main>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <HomePageInner />
    </Suspense>
  );
}
