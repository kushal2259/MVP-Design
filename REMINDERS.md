# Site-visit reminders — setup

Reminders e-mail the assigned person **1 day before**, at **9 AM on the day**, and
**1 hour before** each scheduled site visit. The logic lives in
`/api/reminders/run`; something just needs to call that endpoint regularly.

> ⚠️ We do **not** use Vercel's built-in cron (`vercel.json`). Vercel's free
> (Hobby) plan only allows cron jobs **once per day**, and an every-15-min
> schedule makes the whole deployment fail. So we trigger it externally instead.

## 1. Prerequisites (one-time)
1. Run the `project_visits` table SQL in Supabase (see `supabase_setup.sql`, section 4).
2. Add two env vars in **Vercel → Settings → Environment Variables** (and in `.env.local` for local):
   - `SUPABASE_SERVICE_ROLE_KEY` — from Supabase → Settings → API → `service_role` (secret)
   - `CRON_SECRET` — any random string, e.g. `mvp-reminders-7f3a9c`

## 2. Schedule the trigger (free, every 15 min)
Use any free cron pinger — e.g. **https://cron-job.org**:
1. Create a free account → **Create cronjob**
2. **URL:**
   ```
   https://YOUR-SITE.vercel.app/api/reminders/run?secret=YOUR_CRON_SECRET
   ```
3. **Schedule:** every 15 minutes
4. **Method:** GET → Save

That's it. Each run scans all scheduled visits and sends any reminder that's now
due (each window is sent only once, tracked per visit).

## 3. Test it
- **Instant SMTP test:** in the app, open a scheduled visit, add a Reminder Email,
  and click **✉ Test** — a real email should arrive.
- **Manual cron test:** open the trigger URL above in a browser. It returns
  `{ "ok": true, "scanned": N, "sent": N }`.

## On a paid Vercel plan?
If you upgrade to Vercel Pro you *can* use the built-in cron instead. Re-create
`vercel.json` with:
```json
{ "crons": [{ "path": "/api/reminders/run", "schedule": "*/15 * * * *" }] }
```
and skip the external pinger.
