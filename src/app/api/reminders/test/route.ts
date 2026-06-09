import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendMail, reminderEmailHtml } from '@/lib/email';

// Sends a one-off TEST reminder. Requires a valid Supabase session (so it can't
// be abused as an open mail relay).
export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const sb = createClient(url, anon);
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data.user) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });

  let body: Record<string, string> = {};
  try { body = await req.json(); } catch { /* ignore */ }
  const { to, projectName, purpose, date, time, stage, assignedTo } = body;
  if (!to) return NextResponse.json({ error: 'Missing recipient' }, { status: 400 });

  const r = await sendMail({
    to,
    subject: `🏗 [TEST] Site visit reminder — ${projectName || 'Project'}`,
    html: reminderEmailHtml({
      projectName: projectName || 'Project', purpose: purpose || '—', date: date || '', time: time || '',
      stage: stage || '—', assignedTo: assignedTo || '—', when: 'This is a TEST reminder',
    }),
  });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 503 });
  return NextResponse.json({ ok: true });
}
