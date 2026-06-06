'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';

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

export default function HomePage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <main style={{ fontFamily: 'var(--font-body)', backgroundColor: 'var(--paper)', color: 'var(--ink)', minHeight: '100vh', overflowX: 'hidden' }}>
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
          <Link href="/dashboard" style={{
            padding: '8px 20px', borderRadius: 4,
            border: '1.5px solid var(--blueprint)',
            color: 'var(--blueprint)',
            textDecoration: 'none',
            fontSize: 14, fontWeight: 500,
            transition: 'all 0.2s',
          }}
            onMouseEnter={e => { (e.target as HTMLElement).style.backgroundColor = 'var(--blueprint)'; (e.target as HTMLElement).style.color = 'white'; }}
            onMouseLeave={e => { (e.target as HTMLElement).style.backgroundColor = 'transparent'; (e.target as HTMLElement).style.color = 'var(--blueprint)'; }}
          >
            Dashboard
          </Link>
          <Link href="/project/new" style={{
            padding: '8px 20px', borderRadius: 4,
            backgroundColor: 'var(--amber)',
            color: 'white',
            textDecoration: 'none',
            fontSize: 14, fontWeight: 500,
          }}>
            New Project →
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'flex-start',
        padding: '120px 80px 80px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Blueprint grid bg */}
        <div style={{
          position: 'absolute', top: 0, right: 0, width: '55%', height: '100%',
          opacity: mounted ? 0.07 : 0,
          transition: 'opacity 1s ease',
          backgroundImage: `
            linear-gradient(var(--blueprint) 1px, transparent 1px),
            linear-gradient(90deg, var(--blueprint) 1px, transparent 1px),
            linear-gradient(var(--blueprint-light) 1px, transparent 1px),
            linear-gradient(90deg, var(--blueprint-light) 1px, transparent 1px)
          `,
          backgroundSize: '80px 80px, 80px 80px, 16px 16px, 16px 16px',
        }} />

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
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '6px 14px', borderRadius: 100,
          border: '1px solid var(--amber)',
          marginBottom: 32,
          opacity: mounted ? 1 : 0,
          transform: mounted ? 'none' : 'translateY(10px)',
          transition: 'all 0.6s ease',
          backgroundColor: 'rgba(200,133,58,0.06)',
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: 'var(--amber)', display: 'inline-block' }} />
          <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--amber)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>AI Architectural Copilot</span>
        </div>

        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(48px, 7vw, 92px)',
          fontWeight: 300,
          lineHeight: 1.05,
          letterSpacing: '-0.03em',
          maxWidth: '700px',
          marginBottom: 28,
          opacity: mounted ? 1 : 0,
          transform: mounted ? 'none' : 'translateY(20px)',
          transition: 'all 0.7s ease 0.1s',
        }}>
          Design faster.<br />
          <em style={{ fontStyle: 'italic', color: 'var(--blueprint-mid)' }}>Build smarter.</em>
        </h1>

        <p style={{
          fontSize: 18, lineHeight: 1.7,
          color: 'var(--steel)',
          maxWidth: 520,
          marginBottom: 48,
          opacity: mounted ? 1 : 0,
          transform: mounted ? 'none' : 'translateY(20px)',
          transition: 'all 0.7s ease 0.2s',
          fontWeight: 300,
        }}>
          From client brief to complete architectural package — floor plans, elevations, cost estimates, BOQ, and 3D concepts — in minutes, not days.
        </p>

        <div style={{
          display: 'flex', gap: 16, flexWrap: 'wrap',
          opacity: mounted ? 1 : 0,
          transform: mounted ? 'none' : 'translateY(20px)',
          transition: 'all 0.7s ease 0.3s',
        }}>
          <Link href="/project/new" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '14px 32px', borderRadius: 4,
            backgroundColor: 'var(--blueprint)',
            color: 'white', textDecoration: 'none',
            fontSize: 15, fontWeight: 500,
            letterSpacing: '0.01em',
            boxShadow: '0 4px 24px rgba(26,39,68,0.2)',
          }}>
            Start a Project
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </Link>
          <Link href="/dashboard" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '14px 32px', borderRadius: 4,
            border: '1.5px solid var(--line-strong)',
            color: 'var(--ink)', textDecoration: 'none',
            fontSize: 15, fontWeight: 400,
          }}>
            View Dashboard
          </Link>
        </div>

        {/* Stats bar */}
        <div style={{
          display: 'flex', gap: 0,
          marginTop: 80,
          borderTop: '1px solid var(--line)',
          paddingTop: 40,
          width: '100%', maxWidth: 600,
          opacity: mounted ? 1 : 0,
          transition: 'opacity 0.8s ease 0.5s',
        }}>
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
              Everything an architect<br />
              <em style={{ color: 'var(--blueprint-light)' }}>needs to move fast</em>
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px', backgroundColor: 'rgba(255,255,255,0.1)' }}>
            {FEATURES.map((f, i) => (
              <div key={i} style={{
                padding: '40px 36px',
                backgroundColor: 'var(--blueprint)',
                transition: 'background-color 0.2s',
              }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--blueprint-mid)')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'var(--blueprint)')}
              >
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
            { n: '01', title: 'Enter Requirements', body: 'Plot size, BHK, style, budget, and special needs in natural language. Our AI understands the way architects think.' },
            { n: '02', title: 'AI Analysis & Validation', body: 'Requirements are parsed into structured data, validated against architectural rules, and optimized for your plot.' },
            { n: '03', title: 'Design Generation', body: 'Floor plans, cost estimates, BOQ, interior concepts, MEP drafts, and compliance notes — all generated simultaneously.' },
            { n: '04', title: 'Review & Export', body: 'Edit room sizes, compare versions, and export to PDF, DXF, or share with your client directly.' },
          ].map((step, i) => (
            <div key={i} style={{
              display: 'flex', gap: 48, alignItems: 'flex-start',
              padding: '40px 0',
              borderBottom: '1px solid var(--line)',
            }}>
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
      <section style={{
        padding: '80px',
        backgroundColor: 'var(--ink)',
        color: 'white',
        textAlign: 'center',
      }}>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--amber)', marginBottom: 24 }}>— Start Today</p>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 52, fontWeight: 300, marginBottom: 24, letterSpacing: '-0.02em' }}>
          Your next project,<br /><em style={{ color: 'var(--blueprint-light)' }}>ready in minutes</em>
        </h2>
        <p style={{ color: 'var(--steel-light)', fontSize: 16, marginBottom: 40, fontWeight: 300 }}>
          No signup required. Start your first project immediately.
        </p>
        <Link href="/project/new" style={{
          display: 'inline-flex', alignItems: 'center', gap: 10,
          padding: '16px 40px', borderRadius: 4,
          backgroundColor: 'var(--amber)',
          color: 'white', textDecoration: 'none',
          fontSize: 16, fontWeight: 500,
        }}>
          Create Project →
        </Link>
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
