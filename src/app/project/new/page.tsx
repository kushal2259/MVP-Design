'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { saveProject, generateId } from '@/lib/store';
import type { ProjectRequirements, Project } from '@/types';

const STYLES = ['modern', 'contemporary', 'traditional', 'mediterranean', 'minimalist'] as const;
const SPECIAL_ROOMS = ['Home Office', 'Home Theatre', 'Gym / Fitness Room', 'Pooja Room', 'Guest Suite', 'Library', 'Wine Cellar', 'Multipurpose Hall', 'Servant Quarters', 'Laundry Room'];

type Step = 1 | 2 | 3 | 4;

export default function NewProjectPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [name, setName] = useState('');
  const [req, setReq] = useState<ProjectRequirements>({
    plotSize: 250,
    plotWidth: 50,
    plotDepth: 45,
    plotShape: 'rectangular',
    location: '',
    floors: 2,
    budget: 60,
    style: 'modern',
    bhk: 4,
    specialRooms: [],
    requirements: '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof ProjectRequirements | 'name', string>>>({});

  // Auto-calculate plot size from dimensions
  useEffect(() => {
    const sqFt = req.plotWidth * req.plotDepth;
    const sqYd = Math.round(sqFt / 9);
    setReq(r => ({ ...r, plotSize: sqYd }));
  }, [req.plotWidth, req.plotDepth]);

  const update = (key: keyof ProjectRequirements, val: ProjectRequirements[typeof key]) => {
    setReq(r => ({ ...r, [key]: val }));
    setErrors(e => ({ ...e, [key]: '' }));
  };

  const validate = (): boolean => {
    const newErrors: typeof errors = {};
    if (step === 1) {
      if (!name.trim()) newErrors.name = 'Project name is required';
      if (!req.location.trim()) newErrors.location = 'Location is required';
      if (req.plotWidth < 15 || req.plotWidth > 300) newErrors.plotWidth = 'Width must be 15–300 ft';
      if (req.plotDepth < 15 || req.plotDepth > 300) newErrors.plotDepth = 'Depth must be 15–300 ft';
    }
    if (step === 2) {
      if (req.budget < 5) newErrors.budget = 'Minimum budget is ₹5 lakhs';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const next = () => {
    if (validate()) setStep(s => Math.min(s + 1, 4) as Step);
  };

  const handleSubmit = () => {
    const project: Project = {
      id: generateId(),
      name: name || `${req.bhk} BHK at ${req.location}`,
      requirements: req,
      status: 'requirements',
      createdAt: new Date().toISOString(),
    };
    saveProject(project);
    router.push(`/project/${project.id}`);
  };

  const inputStyle = (hasError?: string): React.CSSProperties => ({
    width: '100%',
    padding: '11px 14px',
    borderRadius: 4,
    border: `1.5px solid ${hasError ? '#ef4444' : 'var(--line-strong)'}`,
    backgroundColor: 'white',
    fontSize: 15,
    color: 'var(--ink)',
    outline: 'none',
    fontFamily: 'var(--font-body)',
    transition: 'border-color 0.2s',
  });

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 12,
    fontWeight: 500,
    color: 'var(--steel)',
    marginBottom: 6,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    fontFamily: 'var(--font-mono)',
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--paper)', fontFamily: 'var(--font-body)', display: 'flex', flexDirection: 'column' }}>
      {/* Nav */}
      <div style={{
        borderBottom: '1px solid var(--line)', padding: '0 48px', height: 64,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        backgroundColor: 'var(--paper)',
      }}>
        <Link href="/dashboard" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="24" height="24" viewBox="0 0 28 28" fill="none">
            <rect x="2" y="2" width="24" height="24" rx="2" stroke="var(--blueprint)" strokeWidth="1.5"/>
            <path d="M7 21L21 7M7 7h14M7 7v14" stroke="var(--amber)" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, color: 'var(--ink)' }}>ArchCopilot</span>
        </Link>
        <span style={{ fontSize: 13, color: 'var(--steel)', fontFamily: 'var(--font-mono)' }}>New Project — Step {step} of 4</span>
      </div>

      <div style={{ flex: 1, display: 'flex' }}>
        {/* Left sidebar: steps */}
        <div style={{
          width: 280, borderRight: '1px solid var(--line)',
          padding: '48px 32px',
          backgroundColor: 'white',
          display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          {[
            { n: 1, title: 'Plot & Location', desc: 'Site dimensions and address' },
            { n: 2, title: 'Design Brief', desc: 'BHK, style, and budget' },
            { n: 3, title: 'Special Requirements', desc: 'Additional rooms and needs' },
            { n: 4, title: 'Review & Create', desc: 'Confirm and generate' },
          ].map(s => (
            <div key={s.n} style={{
              padding: '16px 20px', borderRadius: 6,
              border: `1.5px solid ${step === s.n ? 'var(--blueprint)' : step > s.n ? 'var(--blueprint-light)' : 'transparent'}`,
              backgroundColor: step === s.n ? 'rgba(26,39,68,0.04)' : 'transparent',
              cursor: step > s.n ? 'pointer' : 'default',
            }}
              onClick={() => step > s.n && setStep(s.n as Step)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  backgroundColor: step > s.n ? 'var(--blueprint)' : step === s.n ? 'var(--blueprint)' : 'var(--paper-dark)',
                  color: step >= s.n ? 'white' : 'var(--steel)',
                  fontSize: 12, fontWeight: 600, flexShrink: 0,
                }}>
                  {step > s.n ? '✓' : s.n}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: step === s.n ? 'var(--blueprint)' : step > s.n ? 'var(--ink)' : 'var(--steel)' }}>{s.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--steel)', marginTop: 2 }}>{s.desc}</div>
                </div>
              </div>
            </div>
          ))}

          {/* Architecture illustration */}
          <div style={{ marginTop: 'auto', paddingTop: 32 }}>
            <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', opacity: 0.15 }}>
              <rect x="20" y="60" width="160" height="120" stroke="var(--blueprint)" strokeWidth="1.5"/>
              <rect x="40" y="80" width="50" height="40" stroke="var(--blueprint)" strokeWidth="1"/>
              <rect x="110" y="80" width="50" height="40" stroke="var(--blueprint)" strokeWidth="1"/>
              <rect x="80" y="130" width="40" height="50" stroke="var(--blueprint)" strokeWidth="1"/>
              <path d="M20 60L100 20L180 60" stroke="var(--amber)" strokeWidth="1.5"/>
              <line x1="100" y1="20" x2="100" y2="60" stroke="var(--amber)" strokeWidth="0.5" strokeDasharray="4 4"/>
            </svg>
          </div>
        </div>

        {/* Main form area */}
        <div style={{ flex: 1, padding: '48px 64px', overflowY: 'auto', maxWidth: 720 }}>
          {/* Step 1 */}
          {step === 1 && (
            <div style={{ animation: 'fadeUp 0.4s ease' }}>
              <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 40, fontWeight: 300, marginBottom: 8, letterSpacing: '-0.02em' }}>Plot & Location</h1>
              <p style={{ color: 'var(--steel)', marginBottom: 40, fontWeight: 300 }}>Tell us about the site where you'll be building</p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div>
                  <label style={labelStyle}>Project Name</label>
                  <input
                    style={inputStyle(errors.name)}
                    value={name}
                    onChange={e => { setName(e.target.value); setErrors(er => ({ ...er, name: '' })); }}
                    placeholder="e.g. Sharma Residence, Ahmedabad"
                    onFocus={e => (e.target.style.borderColor = 'var(--blueprint)')}
                    onBlur={e => (e.target.style.borderColor = errors.name ? '#ef4444' : 'var(--line-strong)')}
                  />
                  {errors.name && <p style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>{errors.name}</p>}
                </div>

                <div>
                  <label style={labelStyle}>Location / City</label>
                  <input
                    style={inputStyle(errors.location)}
                    value={req.location}
                    onChange={e => update('location', e.target.value)}
                    placeholder="e.g. Ahmedabad, Gujarat"
                    onFocus={e => (e.target.style.borderColor = 'var(--blueprint)')}
                    onBlur={e => (e.target.style.borderColor = errors.location ? '#ef4444' : 'var(--line-strong)')}
                  />
                  {errors.location && <p style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>{errors.location}</p>}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                  <div>
                    <label style={labelStyle}>Plot Width (ft)</label>
                    <input type="number" style={inputStyle(errors.plotWidth)} value={req.plotWidth}
                      onChange={e => update('plotWidth', +e.target.value)}
                      onFocus={e => (e.target.style.borderColor = 'var(--blueprint)')}
                      onBlur={e => (e.target.style.borderColor = 'var(--line-strong)')}
                    />
                    {errors.plotWidth && <p style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>{errors.plotWidth}</p>}
                  </div>
                  <div>
                    <label style={labelStyle}>Plot Depth (ft)</label>
                    <input type="number" style={inputStyle()} value={req.plotDepth}
                      onChange={e => update('plotDepth', +e.target.value)}
                      onFocus={e => (e.target.style.borderColor = 'var(--blueprint)')}
                      onBlur={e => (e.target.style.borderColor = 'var(--line-strong)')}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Area (auto)</label>
                    <div style={{
                      ...inputStyle(), backgroundColor: 'var(--paper-dark)', color: 'var(--steel)',
                      display: 'flex', alignItems: 'center',
                    }}>
                      {req.plotSize} sq yd
                    </div>
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>Plot Shape</label>
                  <div style={{ display: 'flex', gap: 10 }}>
                    {(['rectangular', 'square', 'corner', 'irregular'] as const).map(s => (
                      <button key={s} onClick={() => update('plotShape', s)} style={{
                        flex: 1, padding: '10px 0', borderRadius: 4,
                        border: `1.5px solid ${req.plotShape === s ? 'var(--blueprint)' : 'var(--line-strong)'}`,
                        backgroundColor: req.plotShape === s ? 'rgba(26,39,68,0.06)' : 'white',
                        color: req.plotShape === s ? 'var(--blueprint)' : 'var(--steel)',
                        fontSize: 13, fontWeight: req.plotShape === s ? 500 : 400,
                        cursor: 'pointer', textTransform: 'capitalize',
                        fontFamily: 'var(--font-body)',
                      }}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>Number of Floors</label>
                  <div style={{ display: 'flex', gap: 10 }}>
                    {[1, 2, 3, 4].map(f => (
                      <button key={f} onClick={() => update('floors', f)} style={{
                        width: 60, height: 48, borderRadius: 4,
                        border: `1.5px solid ${req.floors === f ? 'var(--blueprint)' : 'var(--line-strong)'}`,
                        backgroundColor: req.floors === f ? 'var(--blueprint)' : 'white',
                        color: req.floors === f ? 'white' : 'var(--steel)',
                        fontSize: 16, fontWeight: 500,
                        cursor: 'pointer', fontFamily: 'var(--font-display)',
                      }}>
                        {f === 1 ? 'G' : f === 2 ? 'G+1' : f === 3 ? 'G+2' : 'G+3'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2 */}
          {step === 2 && (
            <div style={{ animation: 'fadeUp 0.4s ease' }}>
              <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 40, fontWeight: 300, marginBottom: 8, letterSpacing: '-0.02em' }}>Design Brief</h1>
              <p style={{ color: 'var(--steel)', marginBottom: 40, fontWeight: 300 }}>Configuration, aesthetic style, and budget</p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
                <div>
                  <label style={labelStyle}>BHK Configuration</label>
                  <div style={{ display: 'flex', gap: 10 }}>
                    {[1, 2, 3, 4, 5, 6].map(b => (
                      <button key={b} onClick={() => update('bhk', b)} style={{
                        width: 56, height: 48, borderRadius: 4,
                        border: `1.5px solid ${req.bhk === b ? 'var(--amber)' : 'var(--line-strong)'}`,
                        backgroundColor: req.bhk === b ? 'var(--amber)' : 'white',
                        color: req.bhk === b ? 'white' : 'var(--steel)',
                        fontSize: 15, fontWeight: 500,
                        cursor: 'pointer', fontFamily: 'var(--font-display)',
                      }}>
                        {b}
                      </button>
                    ))}
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--steel)', marginTop: 8 }}>{req.bhk} Bedrooms · {req.bhk} Bathrooms (estimated)</p>
                </div>

                <div>
                  <label style={labelStyle}>Architectural Style</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                    {STYLES.map(s => (
                      <button key={s} onClick={() => update('style', s)} style={{
                        padding: '14px', borderRadius: 4,
                        border: `1.5px solid ${req.style === s ? 'var(--blueprint)' : 'var(--line)'}`,
                        backgroundColor: req.style === s ? 'rgba(26,39,68,0.06)' : 'white',
                        color: req.style === s ? 'var(--blueprint)' : 'var(--ink)',
                        fontSize: 13, fontWeight: req.style === s ? 500 : 400,
                        cursor: 'pointer', textTransform: 'capitalize',
                        fontFamily: 'var(--font-body)',
                        transition: 'all 0.15s',
                      }}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>Budget (₹ in Lakhs)</label>
                  <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                    <input
                      type="range" min="10" max="500" step="5"
                      value={req.budget}
                      onChange={e => update('budget', +e.target.value)}
                      style={{ flex: 1, accentColor: 'var(--amber)' }}
                    />
                    <div style={{
                      minWidth: 100, padding: '8px 16px', borderRadius: 4,
                      border: '1.5px solid var(--amber)',
                      fontFamily: 'var(--font-display)', fontSize: 20,
                      color: 'var(--amber)', textAlign: 'center',
                    }}>
                      ₹{req.budget}L
                    </div>
                  </div>
                  {errors.budget && <p style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>{errors.budget}</p>}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                    <span style={{ fontSize: 11, color: 'var(--steel)' }}>Economy: ₹{Math.round(req.budget * 0.8)}L</span>
                    <span style={{ fontSize: 11, color: 'var(--steel)' }}>Premium: ₹{Math.round(req.budget * 1.4)}L</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 3 */}
          {step === 3 && (
            <div style={{ animation: 'fadeUp 0.4s ease' }}>
              <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 40, fontWeight: 300, marginBottom: 8, letterSpacing: '-0.02em' }}>Special Requirements</h1>
              <p style={{ color: 'var(--steel)', marginBottom: 40, fontWeight: 300 }}>Additional spaces and specific needs</p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
                <div>
                  <label style={labelStyle}>Additional Spaces</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {SPECIAL_ROOMS.map(room => {
                      const selected = req.specialRooms.includes(room);
                      return (
                        <button key={room} onClick={() => {
                          const rooms = selected
                            ? req.specialRooms.filter(r => r !== room)
                            : [...req.specialRooms, room];
                          update('specialRooms', rooms);
                        }} style={{
                          padding: '8px 16px', borderRadius: 100,
                          border: `1.5px solid ${selected ? 'var(--blueprint)' : 'var(--line-strong)'}`,
                          backgroundColor: selected ? 'var(--blueprint)' : 'white',
                          color: selected ? 'white' : 'var(--ink)',
                          fontSize: 13, cursor: 'pointer',
                          fontFamily: 'var(--font-body)',
                          transition: 'all 0.15s',
                        }}>
                          {room}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>Any Other Requirements</label>
                  <textarea
                    value={req.requirements}
                    onChange={e => update('requirements', e.target.value)}
                    placeholder="e.g. Large kitchen with island, south-facing master bedroom, vastu compliance, home automation, solar panels..."
                    rows={5}
                    style={{
                      ...inputStyle(),
                      resize: 'vertical',
                      lineHeight: 1.6,
                    }}
                    onFocus={e => (e.target.style.borderColor = 'var(--blueprint)')}
                    onBlur={e => (e.target.style.borderColor = 'var(--line-strong)')}
                  />
                  <p style={{ fontSize: 12, color: 'var(--steel)', marginTop: 6 }}>
                    Describe anything specific — our AI understands natural language
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Review */}
          {step === 4 && (
            <div style={{ animation: 'fadeUp 0.4s ease' }}>
              <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 40, fontWeight: 300, marginBottom: 8, letterSpacing: '-0.02em' }}>Review & Create</h1>
              <p style={{ color: 'var(--steel)', marginBottom: 40, fontWeight: 300 }}>Confirm your requirements and generate the design</p>

              <div style={{
                border: '1px solid var(--line)',
                borderRadius: 8, overflow: 'hidden',
                marginBottom: 32,
              }}>
                <div style={{ backgroundColor: 'var(--blueprint)', color: 'white', padding: '20px 28px' }}>
                  <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 500 }}>{name || `${req.bhk} BHK at ${req.location}`}</h2>
                  <p style={{ fontSize: 13, opacity: 0.7, marginTop: 4 }}>{req.location} · {req.style} style</p>
                </div>
                <div style={{ padding: '24px 28px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 40px' }}>
                    {[
                      { label: 'Plot Dimensions', value: `${req.plotWidth}×${req.plotDepth} ft (${req.plotSize} sq yd)` },
                      { label: 'Plot Shape', value: req.plotShape.charAt(0).toUpperCase() + req.plotShape.slice(1) },
                      { label: 'Floors', value: req.floors === 1 ? 'Ground only' : `G+${req.floors - 1}` },
                      { label: 'BHK', value: `${req.bhk} Bedroom, ${req.bhk} Bath` },
                      { label: 'Style', value: req.style.charAt(0).toUpperCase() + req.style.slice(1) },
                      { label: 'Budget', value: `₹${req.budget} Lakhs` },
                      { label: 'Special Rooms', value: req.specialRooms.length > 0 ? req.specialRooms.join(', ') : 'None' },
                    ].map((item, i) => (
                      <div key={i}>
                        <div style={{ fontSize: 11, color: 'var(--steel)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>{item.label}</div>
                        <div style={{ fontSize: 14, color: 'var(--ink)', fontWeight: 400 }}>{item.value}</div>
                      </div>
                    ))}
                  </div>
                  {req.requirements && (
                    <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid var(--line)' }}>
                      <div style={{ fontSize: 11, color: 'var(--steel)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>Special Notes</div>
                      <div style={{ fontSize: 14, color: 'var(--ink)', lineHeight: 1.6 }}>{req.requirements}</div>
                    </div>
                  )}
                </div>
              </div>

              {/* What will be generated */}
              <div style={{
                backgroundColor: 'rgba(26,39,68,0.04)',
                border: '1px solid rgba(26,39,68,0.08)',
                borderRadius: 8, padding: '20px 24px', marginBottom: 32,
              }}>
                <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--blueprint)', marginBottom: 12 }}>What will be generated:</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 24px' }}>
                  {[
                    'Floor plans for all floors',
                    'Space allocation analysis',
                    'Cost estimation (3 tiers)',
                    'Bill of Quantities (BOQ)',
                    'Interior design concepts',
                    'Construction timeline',
                    'Compliance checklist',
                    'MEP draft layouts',
                  ].map((item, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: 'var(--ink)' }}>
                      <span style={{ color: 'var(--blueprint)', fontSize: 10 }}>●</span>
                      {item}
                    </div>
                  ))}
                </div>
              </div>

              <div style={{
                padding: '16px 20px',
                backgroundColor: '#fff7ed',
                border: '1px solid #fed7aa',
                borderRadius: 6,
                fontSize: 12, color: '#92400e',
                lineHeight: 1.6,
              }}>
                ⚠ <strong>Professional Review Required:</strong> All AI-generated drawings are preliminary drafts for architect review. Structural, electrical, plumbing, HVAC, fire safety, and municipal compliance must be verified by licensed professionals before construction.
              </div>
            </div>
          )}

          {/* Navigation buttons */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 48, paddingTop: 32, borderTop: '1px solid var(--line)' }}>
            {step > 1 ? (
              <button onClick={() => setStep(s => Math.max(s - 1, 1) as Step)} style={{
                padding: '12px 28px', borderRadius: 4,
                border: '1.5px solid var(--line-strong)',
                background: 'white', color: 'var(--ink)',
                fontSize: 14, cursor: 'pointer',
                fontFamily: 'var(--font-body)',
              }}>
                ← Back
              </button>
            ) : (
              <Link href="/dashboard" style={{
                padding: '12px 28px', borderRadius: 4,
                border: '1.5px solid var(--line-strong)',
                color: 'var(--ink)', textDecoration: 'none',
                fontSize: 14,
              }}>
                ← Cancel
              </Link>
            )}

            {step < 4 ? (
              <button onClick={next} style={{
                padding: '12px 32px', borderRadius: 4,
                backgroundColor: 'var(--blueprint)', color: 'white',
                border: 'none', fontSize: 14, cursor: 'pointer',
                fontFamily: 'var(--font-body)', fontWeight: 500,
              }}>
                Continue →
              </button>
            ) : (
              <button onClick={handleSubmit} style={{
                padding: '12px 40px', borderRadius: 4,
                backgroundColor: 'var(--amber)', color: 'white',
                border: 'none', fontSize: 15, cursor: 'pointer',
                fontFamily: 'var(--font-body)', fontWeight: 500,
                boxShadow: '0 4px 20px rgba(200,133,58,0.3)',
              }}>
                Generate Design Package →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
