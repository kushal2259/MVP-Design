// ============================================================================
//  SERVER-SIDE EMAIL (Nodemailer + Gmail SMTP)
//  Reads EMAIL_HOST_USER / EMAIL_HOST_PASSWORD (a Gmail App Password) from env.
//  Used by the site-visit reminder system. Never import this in client code.
// ============================================================================
import nodemailer from 'nodemailer';

let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  const user = process.env.EMAIL_HOST_USER;
  const pass = process.env.EMAIL_HOST_PASSWORD;
  if (!user || !pass) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass },
    });
  }
  return transporter;
}

export async function sendMail(opts: { to: string; subject: string; html: string; text?: string }): Promise<{ ok: boolean; error?: string }> {
  const t = getTransporter();
  if (!t) return { ok: false, error: 'SMTP not configured (EMAIL_HOST_USER / EMAIL_HOST_PASSWORD missing).' };
  try {
    await t.sendMail({
      from: `"ArchCopilot Site Visits" <${process.env.EMAIL_HOST_USER}>`,
      to: opts.to,
      subject: opts.subject,
      text: opts.text || opts.html.replace(/<[^>]+>/g, ' '),
      html: opts.html,
    });
    return { ok: true };
  } catch (e) {
    console.error('sendMail error:', e);
    return { ok: false, error: String(e) };
  }
}

/** Branded reminder email body. */
export function reminderEmailHtml(v: {
  projectName: string; purpose: string; date: string; time: string; stage: string; assignedTo: string; when: string;
}): string {
  return `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden">
    <div style="background:#1a2744;color:#fff;padding:18px 22px">
      <div style="font-size:18px;font-weight:700">🏗 Site Visit Reminder</div>
      <div style="font-size:13px;opacity:.8">${v.when}</div>
    </div>
    <div style="padding:22px;color:#1a2744">
      <p style="margin:0 0 14px">This is a reminder for an upcoming site visit:</p>
      <table style="width:100%;font-size:14px;border-collapse:collapse">
        <tr><td style="padding:6px 0;color:#64748b;width:120px">Project</td><td><b>${v.projectName}</b></td></tr>
        <tr><td style="padding:6px 0;color:#64748b">Purpose</td><td>${v.purpose}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b">Date / Time</td><td><b>${v.date} at ${v.time}</b></td></tr>
        <tr><td style="padding:6px 0;color:#64748b">Stage</td><td>${v.stage}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b">Assigned to</td><td>${v.assignedTo}</td></tr>
      </table>
      <p style="margin:18px 0 0;font-size:12px;color:#94a3b8">Sent automatically by ArchCopilot.</p>
    </div>
  </div>`;
}
