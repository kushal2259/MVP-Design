'use client';
import { useState, useEffect, useCallback } from 'react';
import type { Project } from '@/types';
import { getProjectVisits, saveProjectVisits } from '@/lib/store';

type Status = 'scheduled' | 'completed' | 'cancelled';
type Stage = 'Site Prep' | 'Excavation' | 'Foundation' | 'Plinth' | 'Superstructure' | 'Brickwork' | 'Roofing' | 'Plastering' | 'Flooring' | 'MEP' | 'Finishing' | 'Handover';

interface Comment { id: string; author: string; text: string; at: string; }
interface Photo { id: string; caption: string; url: string; }
interface Visit {
  id: string;
  date: string; time: string;
  purpose: string; assignedTo: string;
  stage: Stage; status: Status;
  progressPct: number;
  weather: string; labourCount: number;
  workDone: string; issues: string; materials: string; nextSteps: string;
  photos: Photo[];
  comments: Comment[];
  createdAt: string; updatedAt: string;
}

const STAGES: Stage[] = ['Site Prep', 'Excavation', 'Foundation', 'Plinth', 'Superstructure', 'Brickwork', 'Roofing', 'Plastering', 'Flooring', 'MEP', 'Finishing', 'Handover'];
const uid = () => Math.random().toString(36).slice(2, 10);
const today = () => new Date().toISOString().slice(0, 10);

const STATUS_COLOR: Record<Status, string> = { scheduled: '#2563eb', completed: '#16a34a', cancelled: '#dc2626' };

export default function SiteVisitsTab({ project }: { project: Project }) {
  const key = `mvp_visits_${project.id}`;
  const [visits, setVisits] = useState<Visit[]>([]);
  const [filter, setFilter] = useState<'all' | Status>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState({ date: today(), time: '10:00', purpose: '', assignedTo: '', stage: 'Foundation' as Stage });
  const [commentText, setCommentText] = useState('');
  const [commentAuthor, setCommentAuthor] = useState('Architect');

  const [synced, setSynced] = useState<'cloud' | 'local'>('local');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cloud = await getProjectVisits<Visit>(project.id);
        if (cancelled) return;
        setSynced('cloud');
        if (cloud.length) { setVisits(cloud); return; }
        // migrate any local-only visits to the cloud on first load
        const raw = localStorage.getItem(key);
        if (raw) { const local = JSON.parse(raw) as Visit[]; if (local.length) { setVisits(local); saveProjectVisits(project.id, local).catch(() => {}); } }
      } catch {
        // Supabase table missing / offline → fall back to localStorage
        try { const raw = localStorage.getItem(key); if (raw && !cancelled) setVisits(JSON.parse(raw)); } catch { /* ignore */ }
        if (!cancelled) setSynced('local');
      }
    })();
    return () => { cancelled = true; };
  }, [key, project.id]);

  const persist = useCallback((next: Visit[]) => {
    setVisits(next);
    localStorage.setItem(key, JSON.stringify(next));           // always cache locally
    saveProjectVisits(project.id, next).catch(() => {});       // sync to Supabase (best-effort)
  }, [key, project.id]);

  // ── CRUD ──
  const addVisit = () => {
    if (!draft.purpose.trim()) { alert('Add a purpose for the visit.'); return; }
    const v: Visit = {
      id: uid(), date: draft.date, time: draft.time, purpose: draft.purpose.trim(), assignedTo: draft.assignedTo.trim() || '—',
      stage: draft.stage, status: 'scheduled', progressPct: 0, weather: '', labourCount: 0,
      workDone: '', issues: '', materials: '', nextSteps: '', photos: [], comments: [],
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    persist([v, ...visits]);
    setShowForm(false);
    setDraft({ date: today(), time: '10:00', purpose: '', assignedTo: '', stage: 'Foundation' });
  };
  const updateVisit = (id: string, patch: Partial<Visit>) =>
    persist(visits.map(v => v.id === id ? { ...v, ...patch, updatedAt: new Date().toISOString() } : v));
  const deleteVisit = (id: string) => { if (confirm('Delete this visit and its report?')) persist(visits.filter(v => v.id !== id)); };
  const addComment = (id: string) => {
    if (!commentText.trim()) return;
    const c: Comment = { id: uid(), author: commentAuthor || 'Architect', text: commentText.trim(), at: new Date().toISOString() };
    updateVisit(id, { comments: [...(visits.find(v => v.id === id)?.comments || []), c] });
    setCommentText('');
  };
  const removeComment = (id: string, cid: string) =>
    updateVisit(id, { comments: (visits.find(v => v.id === id)?.comments || []).filter(c => c.id !== cid) });
  const addPhoto = (id: string) => {
    const caption = prompt('Photo caption / note (e.g. "East wall brickwork")'); if (!caption) return;
    const url = prompt('Image URL (optional)') || '';
    updateVisit(id, { photos: [...(visits.find(v => v.id === id)?.photos || []), { id: uid(), caption, url }] });
  };
  const removePhoto = (id: string, pid: string) =>
    updateVisit(id, { photos: (visits.find(v => v.id === id)?.photos || []).filter(p => p.id !== pid) });

  const shown = visits.filter(v => filter === 'all' || v.status === filter)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  const stats = {
    total: visits.length,
    scheduled: visits.filter(v => v.status === 'scheduled').length,
    completed: visits.filter(v => v.status === 'completed').length,
    avgProgress: visits.filter(v => v.status === 'completed').length
      ? Math.round(visits.filter(v => v.status === 'completed').reduce((s, v) => s + v.progressPct, 0) / visits.filter(v => v.status === 'completed').length) : 0,
  };

  const inputS: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 6, border: '1.5px solid var(--line-strong)', fontSize: 13, fontFamily: 'var(--font-body)', boxSizing: 'border-box', color: 'var(--ink)', backgroundColor: 'white' };
  const labelS: React.CSSProperties = { fontSize: 11, color: 'var(--steel)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', marginBottom: 4, display: 'block' };
  const chip = (active: boolean): React.CSSProperties => ({ padding: '6px 14px', borderRadius: 100, fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-body)', textTransform: 'capitalize', border: `1.5px solid ${active ? 'var(--blueprint)' : 'var(--line-strong)'}`, backgroundColor: active ? 'var(--blueprint)' : 'white', color: active ? 'white' : 'var(--steel)' });

  return (
    <div>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 300, marginBottom: 6 }}>Site Visits &amp; Reports</h2>
      <p style={{ color: 'var(--steel)', marginBottom: 20, fontWeight: 300 }}>
        Schedule visits, log progress, raise issues and keep a dated report trail for <strong>{project.name}</strong> — full create / edit / delete.
      </p>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%,150px), 1fr))', gap: 14, marginBottom: 24 }}>
        {[
          { l: 'Total Visits', v: stats.total, c: 'var(--blueprint)' },
          { l: 'Scheduled', v: stats.scheduled, c: '#2563eb' },
          { l: 'Completed', v: stats.completed, c: '#16a34a' },
          { l: 'Avg Progress', v: `${stats.avgProgress}%`, c: 'var(--amber)' },
        ].map((s, i) => (
          <div key={i} style={{ border: '1px solid var(--line)', borderRadius: 8, backgroundColor: 'white', padding: 18 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 700, color: s.c, lineHeight: 1 }}>{s.v}</div>
            <div style={{ fontSize: 12, color: 'var(--steel)', marginTop: 6 }}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 18, alignItems: 'center', flexWrap: 'wrap' }}>
        {(['all', 'scheduled', 'completed', 'cancelled'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={chip(filter === f)}>{f}</button>
        ))}
        <button onClick={() => setShowForm(s => !s)} style={{ marginLeft: 'auto', padding: '8px 18px', borderRadius: 6, border: 'none', backgroundColor: 'var(--amber)', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
          {showForm ? '✕ Close' : '+ Schedule Visit'}
        </button>
      </div>

      {/* Schedule form */}
      {showForm && (
        <div style={{ border: '1.5px solid var(--amber)', borderRadius: 10, backgroundColor: '#fffdf8', padding: 20, marginBottom: 24 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, color: 'var(--blueprint)' }}>Schedule a Site Visit</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%,180px), 1fr))', gap: 14 }}>
            <div><label style={labelS}>Date</label><input type="date" style={inputS} value={draft.date} onChange={e => setDraft(d => ({ ...d, date: e.target.value }))} /></div>
            <div><label style={labelS}>Time</label><input type="time" style={inputS} value={draft.time} onChange={e => setDraft(d => ({ ...d, time: e.target.value }))} /></div>
            <div><label style={labelS}>Stage</label><select style={inputS} value={draft.stage} onChange={e => setDraft(d => ({ ...d, stage: e.target.value as Stage }))}>{STAGES.map(s => <option key={s}>{s}</option>)}</select></div>
            <div><label style={labelS}>Assigned To</label><input style={inputS} placeholder="Architect / Engineer name" value={draft.assignedTo} onChange={e => setDraft(d => ({ ...d, assignedTo: e.target.value }))} /></div>
            <div style={{ gridColumn: '1 / -1' }}><label style={labelS}>Purpose</label><input style={inputS} placeholder="e.g. Inspect footing reinforcement before pour" value={draft.purpose} onChange={e => setDraft(d => ({ ...d, purpose: e.target.value }))} /></div>
          </div>
          <button onClick={addVisit} style={{ marginTop: 16, padding: '9px 22px', borderRadius: 6, border: 'none', backgroundColor: 'var(--blueprint)', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>✓ Add Visit</button>
        </div>
      )}

      {/* Visits list */}
      {shown.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', border: '2px dashed var(--line-strong)', borderRadius: 10, color: 'var(--steel)' }}>
          No {filter === 'all' ? '' : filter} visits yet. Click <strong>+ Schedule Visit</strong> to add one.
        </div>
      ) : shown.map(v => {
        const open = editingId === v.id;
        return (
          <div key={v.id} style={{ border: '1px solid var(--line)', borderRadius: 10, backgroundColor: 'white', marginBottom: 14, overflow: 'hidden' }}>
            {/* Header row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', flexWrap: 'wrap' }}>
              <div style={{ textAlign: 'center', minWidth: 56 }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--blueprint)', fontFamily: 'var(--font-display)' }}>{new Date(v.date).getDate()}</div>
                <div style={{ fontSize: 10, color: 'var(--steel)', textTransform: 'uppercase' }}>{new Date(v.date).toLocaleDateString('en-IN', { month: 'short' })} · {v.time}</div>
              </div>
              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>{v.purpose}</div>
                <div style={{ fontSize: 12, color: 'var(--steel)' }}>{v.stage} · {v.assignedTo}{v.status === 'completed' ? ` · ${v.progressPct}% progress` : ''}</div>
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 100, color: 'white', backgroundColor: STATUS_COLOR[v.status], textTransform: 'uppercase' }}>{v.status}</span>
              <div style={{ display: 'flex', gap: 6 }}>
                {v.status === 'scheduled' && <button onClick={() => updateVisit(v.id, { status: 'completed' })} style={{ padding: '5px 10px', borderRadius: 5, border: '1px solid #16a34a', background: 'white', color: '#16a34a', fontSize: 11, cursor: 'pointer' }}>✓ Complete</button>}
                <button onClick={() => setEditingId(open ? null : v.id)} style={{ padding: '5px 10px', borderRadius: 5, border: '1px solid var(--line-strong)', background: 'white', color: 'var(--steel)', fontSize: 11, cursor: 'pointer' }}>{open ? 'Close' : 'Report ✎'}</button>
                {v.status !== 'cancelled' && <button onClick={() => updateVisit(v.id, { status: 'cancelled' })} style={{ padding: '5px 10px', borderRadius: 5, border: '1px solid #d97706', background: 'white', color: '#d97706', fontSize: 11, cursor: 'pointer' }}>Cancel</button>}
                <button onClick={() => deleteVisit(v.id)} style={{ padding: '5px 10px', borderRadius: 5, border: '1px solid #dc2626', background: 'white', color: '#dc2626', fontSize: 11, cursor: 'pointer' }}>🗑</button>
              </div>
            </div>

            {/* Report editor */}
            {open && (
              <div style={{ borderTop: '1px solid var(--line)', padding: 18, backgroundColor: '#fafbfc' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%,160px), 1fr))', gap: 14, marginBottom: 14 }}>
                  <div><label style={labelS}>Progress %</label><input type="number" min={0} max={100} style={inputS} value={v.progressPct} onChange={e => updateVisit(v.id, { progressPct: Math.max(0, Math.min(100, +e.target.value)) })} /></div>
                  <div><label style={labelS}>Stage</label><select style={inputS} value={v.stage} onChange={e => updateVisit(v.id, { stage: e.target.value as Stage })}>{STAGES.map(s => <option key={s}>{s}</option>)}</select></div>
                  <div><label style={labelS}>Weather</label><input style={inputS} placeholder="Sunny / Rain" value={v.weather} onChange={e => updateVisit(v.id, { weather: e.target.value })} /></div>
                  <div><label style={labelS}>Labour on site</label><input type="number" min={0} style={inputS} value={v.labourCount} onChange={e => updateVisit(v.id, { labourCount: +e.target.value })} /></div>
                </div>
                {([['workDone', 'Work Done Today'], ['issues', 'Issues / Observations'], ['materials', 'Materials on Site'], ['nextSteps', 'Next Steps']] as const).map(([f, lbl]) => (
                  <div key={f} style={{ marginBottom: 12 }}>
                    <label style={labelS}>{lbl}</label>
                    <textarea style={{ ...inputS, resize: 'vertical', minHeight: 48, lineHeight: 1.5 }} value={v[f]} onChange={e => updateVisit(v.id, { [f]: e.target.value } as Partial<Visit>)} />
                  </div>
                ))}

                {/* Photos */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <label style={{ ...labelS, marginBottom: 0 }}>Site Photos / Notes ({v.photos.length})</label>
                    <button onClick={() => addPhoto(v.id)} style={{ padding: '4px 12px', borderRadius: 5, border: '1px solid var(--blueprint)', background: 'white', color: 'var(--blueprint)', fontSize: 11, cursor: 'pointer' }}>+ Add Photo</button>
                  </div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {v.photos.map(p => (
                      <div key={p.id} style={{ width: 130, border: '1px solid var(--line)', borderRadius: 6, overflow: 'hidden', backgroundColor: 'white' }}>
                        {p.url ? <img src={p.url} alt={p.caption} style={{ width: '100%', height: 80, objectFit: 'cover', display: 'block' }} onError={e => { (e.currentTarget.style.display = 'none'); }} /> : <div style={{ height: 80, background: 'var(--paper)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>📷</div>}
                        <div style={{ padding: '6px 8px', fontSize: 11, color: 'var(--ink)' }}>{p.caption}<button onClick={() => removePhoto(v.id, p.id)} style={{ float: 'right', border: 'none', background: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 11 }}>✕</button></div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Comments */}
                <div style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}>
                  <label style={labelS}>Comments / Remarks ({v.comments.length})</label>
                  {v.comments.map(c => (
                    <div key={c.id} style={{ display: 'flex', gap: 8, padding: '8px 10px', borderRadius: 6, backgroundColor: 'white', border: '1px solid var(--line)', marginBottom: 6 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, color: 'var(--ink)' }}>{c.text}</div>
                        <div style={{ fontSize: 10, color: 'var(--steel)', marginTop: 2 }}>{c.author} · {new Date(c.at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
                      </div>
                      <button onClick={() => removeComment(v.id, c.id)} style={{ border: 'none', background: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 12 }}>🗑</button>
                    </div>
                  ))}
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <input style={{ ...inputS, width: 120, flex: '0 0 120px' }} value={commentAuthor} onChange={e => setCommentAuthor(e.target.value)} placeholder="Author" />
                    <input style={inputS} value={commentText} onChange={e => setCommentText(e.target.value)} placeholder="Add a comment / remark…" onKeyDown={e => { if (e.key === 'Enter') addComment(v.id); }} />
                    <button onClick={() => addComment(v.id)} style={{ padding: '8px 16px', borderRadius: 6, border: 'none', backgroundColor: 'var(--blueprint)', color: 'white', fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>Post</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}

      <p style={{ fontSize: 11, color: 'var(--steel)', marginTop: 16, fontStyle: 'italic' }}>
        {synced === 'cloud'
          ? '☁ Synced to Supabase — visible to your team on any device.'
          : '💾 Saved to this browser. (Run the project_visits table SQL in Supabase to enable team/multi-device sync.)'}
      </p>
    </div>
  );
}
