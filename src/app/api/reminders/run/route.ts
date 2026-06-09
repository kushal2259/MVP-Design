import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL } from '@/lib/supabase';
import { sendMail, reminderEmailHtml } from '@/lib/email';

// ============================================================================
//  REMINDER CRON  (hit this every ~15 min via Vercel Cron or an external cron)
//  Scans every project's site visits and sends reminders at:
//    • 1 day before the visit time
//    • 9:00 AM on the day of the visit
//    • 1 hour before the visit time
//  Each window is sent once (tracked in visit.remindersSent). Times are IST.
//
//  Auth: ?secret=CRON_SECRET  OR  the Vercel-Cron header.
//  Requires SUPABASE_SERVICE_ROLE_KEY to read all users' visits (bypasses RLS).
// ============================================================================

export const runtime = 'nodejs';
export const maxDuration = 60;

const WINDOWS = ['day-before', '9am', 'hour-before'] as const;
type Win = typeof WINDOWS[number];

interface Visit {
  id: string; date: string; time: string; purpose: string; assignedTo: string;
  reminderEmail?: string; remindersSent?: string[]; stage: string; status: string;
}

// Parse date/time as IST so reminders fire at the right local moment.
const ist = (date: string, time: string) => new Date(`${date}T${time}:00+05:30`);
const istAt9 = (date: string) => new Date(`${date}T09:00:00+05:30`);

function triggerTime(v: Visit, w: Win): Date {
  const dt = ist(v.date, v.time);
  if (w === 'day-before') return new Date(dt.getTime() - 24 * 3600 * 1000);
  if (w === 'hour-before') return new Date(dt.getTime() - 3600 * 1000);
  return istAt9(v.date);
}
const label: Record<Win, string> = {
  'day-before': 'Tomorrow', '9am': 'Today', 'hour-before': 'In about 1 hour',
};

export async function GET(req: NextRequest) { return run(req); }
export async function POST(req: NextRequest) { return run(req); }

async function run(req: NextRequest) {
  const secret = new URL(req.url).searchParams.get('secret');
  const isVercelCron = !!req.headers.get('x-vercel-cron');
  if (!isVercelCron && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!service) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY not configured (needed to read all visits).' }, { status: 501 });
  }
  const admin = createClient(SUPABASE_URL, service, { auth: { persistSession: false } });

  const { data: rows, error } = await admin.from('project_visits').select('project_id, user_id, data');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const now = Date.now();
  let sent = 0, scanned = 0;

  for (const row of rows || []) {
    const visits = (row.data as Visit[]) || [];
    let changed = false;
    for (const v of visits) {
      if (v.status !== 'scheduled' || !v.reminderEmail) continue;
      scanned++;
      const dt = ist(v.date, v.time).getTime();
      if (now >= dt) continue;                      // visit already passed
      v.remindersSent = v.remindersSent || [];
      for (const w of WINDOWS) {
        if (v.remindersSent.includes(w)) continue;
        if (now >= triggerTime(v, w).getTime()) {
          const r = await sendMail({
            to: v.reminderEmail,
            subject: `🏗 Site visit ${label[w].toLowerCase()} — ${v.purpose}`,
            html: reminderEmailHtml({
              projectName: 'Your project', purpose: v.purpose, date: v.date, time: v.time,
              stage: v.stage, assignedTo: v.assignedTo, when: `${label[w]} — ${v.date} at ${v.time} IST`,
            }),
          });
          if (r.ok) { v.remindersSent.push(w); sent++; changed = true; }
        }
      }
    }
    if (changed) {
      await admin.from('project_visits').update({ data: visits, updated_at: new Date().toISOString() })
        .eq('project_id', row.project_id).eq('user_id', row.user_id);
    }
  }
  return NextResponse.json({ ok: true, scanned, sent });
}
