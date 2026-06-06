'use client';
import Link from 'next/link';
import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn, signUp, resetPassword, getCurrentUser } from '@/lib/store';

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
  const [fpNew, setFpNew] = useState('');
  const [fpMsg, setFpMsg] = useState('');

  useEffect(() => {
    setMounted(true);
    const u = getCurrentUser();
    if (u) { setUser(u); return; }
    const auth = searchParams.get('auth');
    if (auth === 'signin') setModal('signin');
    else if (auth === 'signup') setModal('signup');
  }, [searchParams]);

  const openModal = (mode: ModalMode) => {
    setSiError(''); setSuError(''); setFpMsg('');
    setModal(mode);
  };

  const handleSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    const res = signIn(siEmail, siPass);
    if (!res.ok) { setSiError(res.error || 'Error'); return; }
    const u = getCurrentUser();
    setUser(u);
    setModal(null);
    router.push('/dashboard');
  };

  const handleSignUp = (e: React.FormEvent) => {
    e.preventDefault();
    if (suPass !== suPass2) { setSuError('Passwords do not match'); return; }
    if (suPass.length < 6) { setSuError('Password must be at least 6 characters'); return; }
    const res = signUp(suName, suEmail, suPass);
    if (!res.ok) { setSuError(res.error || 'Error'); return; }
    const u = getCurrentUser();
    setUser(u);
    setModal(null);
    router.push('/dashboard');
  };

  const handleForgot = (e: React.FormEvent) => {
    e.preventDefault();
    if (fpNew.length < 6) { setFpMsg('Password must be at least 6 characters'); return; }
    const res = resetPassword(fpEmail, fpNew);
    if (!res.ok) { setFpMsg(res.error || 'Error'); return; }
    setFpMsg('✓ Password reset successfully! You can now sign in.');
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
                  {siError && <p style={{ color: '#dc2626', fontSize: 12, margin: 0 }}>{siError}</p>}
                  <button type="submit" style={{ padding: '11px', borderRadius: 6, backgroundColor: 'var(--blueprint)', color: 'white', border: 'none', fontSize: 14, fontWeight: 500, cursor: 'pointer', marginTop: 4 }}>
                    Sign In →
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
                  <button type="submit" style={{ padding: '11px', borderRadius: 6, backgroundColor: 'var(--amber)', color: 'white', border: 'none', fontSize: 14, fontWeight: 500, cursor: 'pointer', marginTop: 4 }}>
                    Create Account →
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
                <p style={{ color: 'var(--steel)', fontSize: 13, marginBottom: 28 }}>Enter your email and choose a new password</p>
                <form onSubmit={handleForgot} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--steel)', display: 'block', marginBottom: 5 }}>Email</label>
                    <input type="email" required style={inputStyle} value={fpEmail} onChange={e => setFpEmail(e.target.value)} placeholder="you@example.com" />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--steel)', display: 'block', marginBottom: 5 }}>New Password</label>
                    <input type="password" required style={inputStyle} value={fpNew} onChange={e => setFpNew(e.target.value)} placeholder="At least 6 characters" />
                  </div>
                  {fpMsg && <p style={{ color: fpMsg.startsWith('✓') ? '#16a34a' : '#dc2626', fontSize: 12, margin: 0 }}>{fpMsg}</p>}
                  <button type="submit" style={{ padding: '11px', borderRadius: 6, backgroundColor: 'var(--blueprint)', color: 'white', border: 'none', fontSize: 14, fontWeight: 500, cursor: 'pointer', marginTop: 4 }}>
                    Reset Password
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
        {/* Blueprint grid bg */}
        <div style={{ position: 'absolute', top: 0, right: 0, width: '55%', height: '100%', opacity: mounted ? 0.07 : 0, transition: 'opacity 1s ease', backgroundImage: `linear-gradient(var(--blueprint) 1px, transparent 1px),linear-gradient(90deg, var(--blueprint) 1px, transparent 1px),linear-gradient(var(--blueprint-light) 1px, transparent 1px),linear-gradient(90deg, var(--blueprint-light) 1px, transparent 1px)`, backgroundSize: '80px 80px, 80px 80px, 16px 16px, 16px 16px' }} />

        {/* Architectural lines decoration */}
        <svg style={{ position: 'absolute', top: 80, right: 80, opacity: 0.12 }} width="500" height="500" viewBox="0 0 500 500">
          <rect x="50" y="50" width="400" height="300" fill="none" stroke="var(--blueprint)" strokeWidth="1"/>
          <rect x="50" y="50" width="200" height="150" fill="none" stroke="var(--blueprint)" strokeWidth="0.5"/>
          <rect x="250" y="50" width="200" height="150" fill="none" stroke="var(--blueprint)" strokeWidth="0.5"/>
          <rect x="50" y="200" width="130" height="150" fill="none" stroke="var(--blueprint)" strokeWidth="0.5"/>
          <rect x="180" y="200" width="270" height="150" fill="none" stroke="var(--blueprint)" strokeWidth="0.5"/>
          <line x1="50" y1="50" x2="50" y2="380" stroke="var(--amber)" strokeWidth="1.5"/>
          <line x1="50" y1="380" x2="450" y2="380" stroke="var(--amber)" strokeWidth="1.5"/>
          <circle cx="50" cy="50" r="3" fill="var(--amber)"/>
          <circle cx="450" cy="380" r="3" fill="var(--amber)"/>
          <text x="60" y="45" fill="var(--blueprint)" fontSize="8" fontFamily="monospace">GROUND FLOOR — SCALE 1:100</text>
          <text x="55" y="390" fill="var(--steel)" fontSize="7" fontFamily="monospace">LIVING ROOM: 320 SQ.FT</text>
          <text x="255" y="390" fill="var(--steel)" fontSize="7" fontFamily="monospace">MASTER BED: 240 SQ.FT</text>
        </svg>

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
