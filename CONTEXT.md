# MVP Design — Project Context & Handoff

> AI Architectural Copilot for India. Turns a natural-language brief into
> architect-reviewable concept packages: floor plans, CAD, 3D, elevations,
> Vastu, NBC/byelaw compliance, engineering drafts, cost/BOQ, and site-visit
> admin. **The platform assists architects; it does not replace them — every
> engineering output is marked "requires licensed professional approval".**

- **Repo:** https://github.com/kushal2259/MVP-Design (branch: `main`)
- **Stack:** Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Three.js 0.184 · Supabase · Nodemailer
- **Local app root:** `C:\Users\kusha\Downloads\arch-copilot\arch-copilot` (this *is* the git repo root)
- **Live site:** deployed on Vercel (`mvp-design-opal.vercel.app` or similar — check Vercel dashboard)
- **Styling:** inline styles + CSS variables (no Tailwind). Theme vars: `--blueprint` (navy), `--amber`, `--paper`, `--ink`, `--steel`, `--line`.
- **Latest commit:** `9aa6e09` — NBC architecture review fixes

---

## 1. Golden rule
**The LLM never produces geometry.** It only does intent extraction
(requirements parsing) and edit interpretation. All coordinates / walls / doors
/ windows / dimensions are computed deterministically by the planner + geometry
engines.

---

## 2. The planning pipeline (`src/lib/planner/`)
```
User prompt
  → requirementParser   (LLM or regex → ParsedRequirements)   [only LLM step]
  → ruleEngine          (configurable room rules: areas/widths/zoning/vent)
  → constraintGenerator (RoomProgram: which rooms, which floor, target areas)
  → adjacency           (weighted room-relationship graph + pattern clusters)
  → strategies          (9 design strategies = diversity seeds)
  → optimizer           (Generator+Critic: ~170 candidates, scored, rejected)
       ├ planningEngine  (macro-zoning + adjacency-chain ordering)
       ├ geometryEngine  (recursive area-slicing → rooms/doors/windows/furniture)
       └ qualityEngine   (Critic: adjacency/privacy/circulation/vent/light/space/structural/vastu)
  → LayoutOption[]      (top-3 diverse; consumed by the whole UI)
```

### Key files
| File | Responsibility |
|---|---|
| `types.ts` | Shared pipeline types (`ParsedRequirements`, `RoomProgram`, `RoomSpec`, `AdjacencyMatrix`, `DesignStrategy`, `QualityReport`, `LayoutCandidate`). |
| `requirementParser.ts` | LLM/regex → `ParsedRequirements`. Derives plot dims from area; detects facing (N/E/S/W), priorities, vastu, special rooms. Fixed floor-count regex (was NaN on "2 floors"). |
| `ruleEngine.ts` | Configurable `RoomRule`s (min/max area, min width, zone, privacy, ventilation). `setRoomRule()` to extend. |
| `constraintGenerator.ts` | Builds the `RoomProgram` (rooms per floor, target areas normalised to fill each floor), setbacks, front yard, FAR. **NBC-aware room dropping**: iteratively drops lowest-priority rooms when plot is too small to meet NBC §6 minimums. Exports `NBC_MIN_AREA` / `NBC_MIN_WIDTH` constants. |
| `adjacency.ts` | `generateAdjacencyMatrix()` — pattern library: foyer→living, kitchen-dining-utility triangle, bedroom+en-suite bath, toilet↮kitchen/dining (negative). |
| `strategies.ts` | 9 strategies: Family, Luxury, Privacy, Courtyard, Vastu, Open Space, Modern Villa, Future Expansion, Compact. `selectStrategies()` biases by priorities. |
| `planningEngine.ts` | Macro-zoning (public/service/circ/private) + greedy adjacency-chain ordering. Seeded RNG. |
| `geometryEngine.ts` | `buildGeometry()` — correct coordinate system: yard at `setbacks.front`, building above yard. `vastuPlace()` (Ashtadik even-thirds grid), `ensureMainEntrance()` (entrance only on foyer/living), `applyOverrides()`, `makeRoom()`. Exports `NBC_MIN_WIDTH_GEO`. |
| `qualityEngine.ts` | Critic. Adjacency-satisfaction is the dominant metric. Returns per-criterion + total + accept/reject. |
| `optimizer.ts` | `optimizeDetailed()` — ~28 candidates/strategy, rejects < threshold (58), returns diverse top-3. |
| `revisionEngine.ts` | Partial regeneration: lock rooms, resize, re-normalise, re-tile. (Built; UI not yet fully wired.) |
| `projectMemory.ts` | Serialisable memory: requirements, locked rooms, revisions, approved layout. (Built; UI not yet fully wired.) |
| `index.ts` | Orchestrator. `generatePlan(req)` + `generatePlanFromSettings(settings)` (applies `customOverrides`). |

`src/lib/layoutSolver.ts` — public `generateLayouts(settings)` (delegates to planner) and `geminiGenerate()` (→ server proxy → retrying direct call).

---

## 3. Feature engines (India-first differentiators)
| Engine | File | UI tab |
|---|---|---|
| Vastu compliance (score, doshas, remedies) | `vastuEngine.ts` | Vastu Score |
| NBC 2016 + city byelaws (FAR, setbacks, room mins) | `byelawEngine.ts` | Compliance (per-option) |
| Cost (city rates + GST + contractor BOQ + EMI) | `costEngine.ts` | Cost Est. / BOQ (per-option) |
| Sun-path & cross-ventilation (climate-zone) | `sunPathEngine.ts` | Sun & Ventilation |
| Engineering drawing suite (58 sheets, 6 disciplines) | `engineeringSuite.ts` | Structural/Electrical/Plumbing/HVAC/Fire/Site |
| Plan-driven elevations (per option × side) | `elevationGenerator.ts` | Elevations |

**Engineering disciplines** (`engineeringSuite.ts`):
Structural (16), Electrical (13), Plumbing (10), HVAC (6), Fire (5), Site (8).
Rendered by `DrawingCatalogView.tsx` with Option A/B/C + floor switchers, approval banners, PDF/PNG/JPG/SVG export.

---

## 4. App structure (`src/`)
- `app/page.tsx` — landing (auth modal: sign in/up/forgot; **detects `type=recovery` in URL and forwards to `/reset-password`**).
- `app/dashboard/page.tsx` — auth-gated project list.
- `app/project/new/page.tsx` — 4-step wizard (+ voice input).
- `app/project/[id]/page.tsx` — workspace (all tabs). Largest file.
- `app/reset-password/page.tsx` — Supabase recovery (listens for `PASSWORD_RECOVERY` event).
- `app/api/ai/route.ts` — server-side Gemini proxy (key off browser, 5-min cache, retry).
- `app/api/reminders/test/route.ts` — authenticated (Bearer token) SMTP test endpoint.
- `app/api/reminders/run/route.ts` — cron target; IST-aware, sends three windows per visit (day-before / 9am / hour-before), tracks in `visit.remindersSent`. Requires `SUPABASE_SERVICE_ROLE_KEY`.
- `components/` — DrawingViewport (CAD editor), ThreeDViewerV2 (orbit/walkthrough/cinematic), InteriorRenderView (dollhouse + doors + first-person + bloom + day-night + GLB export + Record Reel), FloorPlanV2Renderer, DrawingCatalogView, **SiteVisitsTab** (full CRUD, Supabase sync, reminder email field, ✉ Test button), CopilotChat.
- `lib/store.ts` — Supabase auth + projects CRUD + `getProjectVisits` / `saveProjectVisits`.
- `lib/supabase.ts` — client. **Exports `SUPABASE_URL` and `SUPABASE_ANON_KEY`** (hardcoded fallbacks so server routes don't get `undefined` when env vars not set on Vercel).
- `lib/email.ts` — Nodemailer Gmail SMTP (server-only). Explicit `smtp.gmail.com:465` with fast timeouts so it fails cleanly instead of hanging to an empty 500.
- `render-worker/` — **Blender headless render worker** (standalone, not on Vercel). `render.py` (CLI: GLB → MP4 orbit render, day/night, EEVEE), `server.js` (HTTP: POST GLB → return MP4), `README.md` (setup + LLM role explained).

### Project tabs (workspace)
Overview · Floor Plans · CAD Editor · 3D View · Elevations · Interior ·
Vastu Score · Sun & Ventilation · Structural · Electrical · Plumbing · HVAC ·
Fire Safety · Site Plans · Cost Est. · BOQ · Timeline · **Site Visits** ·
Compliance · Export.

---

## 5. Backend (Supabase)
- **Auth:** email/password + password reset. `mailer_autoconfirm` ON (no email confirmation required for signup).
- **Projects:** `public.projects` table (JSONB `data`), RLS — each user sees only their own.
- **Site Visits:** `public.project_visits` table (project_id, user_id PK, data JSONB `[]`, updated_at). RLS. SQL in `supabase_setup.sql` section 4.
- **Forgot password:** `sendPasswordReset` → Supabase sends email → `/reset-password`. Homepage catches recovery tokens to avoid "Safari can't connect" on phone (Supabase falls back to Site URL). Set **Site URL + Redirect URLs** in Supabase → Auth → URL Configuration to the live Vercel domain.

### Env (`.env.local`, gitignored — never commit)
```
NEXT_PUBLIC_SUPABASE_URL=https://rorzdrwngbixncqzuzue.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
GEMINI_API_KEY=...              # server-only (/api/ai), never to browser
EMAIL_HOST_USER=scholartechai@gmail.com
EMAIL_HOST_PASSWORD=...         # Gmail App Password
CRON_SECRET=mvp-reminders-7f3a9c
SUPABASE_SERVICE_ROLE_KEY=...   # required for /api/reminders/run cron
```

All of these must also be added in **Vercel → Settings → Environment Variables** — `.env.local` is local-only.

### Site-visit reminders
Three windows per scheduled visit (IST-aware):
1. **1 day before** the visit time
2. **9:00 AM on the day** of the visit
3. **1 hour before** the visit time

Each window sent once (tracked in `visit.remindersSent`). Triggered by an external cron (see `REMINDERS.md`) hitting `/api/reminders/run?secret=CRON_SECRET` every 15 min — **not** `vercel.json` (Hobby plan only allows daily crons; `vercel.json` was removed). Use cron-job.org (free) to set this up.

**✉ Test button** in Site Visits sends a real email instantly to verify SMTP. Visible on all scheduled visits (greyed until Reminder Email is set).

---

## 6. AI / Copilot
- **CopilotChat** floating panel edits the active plan via natural language.
- Flow: `parseChatEditWithGemini` → updated `PlotSettings` (+ `customOverrides`) → `generateLayouts()` → `applyOverrides()`.
- `geminiGenerate()` → `/api/ai` server proxy (key off browser) → direct retrying fallback (handles 429/503).
- Works for: BHK, floors, dimensions, style, kitchen, balcony, location, budget, vastu, door/window add, room rename.
- **Quota note:** Gemini free tier has daily limits. If copilot returns "AI busy" → Google account needs billing enabled.

---

## 7. Interior 3D (`InteriorRenderView.tsx`)
- **Dollhouse** view with all rooms, walls, doors, windows, furniture.
- **Doors visible:** walls built as segments with cut openings + ajar hinged panels + handles.
- **Double-click** any room → first-person inside that room (look around with OrbitControls).
- **Cinematic mode:** Catmull-Rom spline orbit, 10-point ellipse path.
- **Day/Night slider:** animates ambient/sun/point lights, bloom, background colour.
- **Record Reel:** MediaRecorder → WebM download.
- **Export GLB:** GLTFExporter → `.glb` (feed to the Blender render worker for photoreal MP4).
- **Floor selector:** view any floor of a multi-floor plan.
- **Option selector:** all 3 proposed options (A/B/C) selectable in the interior view.
- Composer: EffectComposer + UnrealBloomPass(0.55, 0.6, 0.85) + OutputPass.

---

## 8. Blender render worker (`render-worker/`)
Standalone — not on Vercel. Runs on your PC or a GPU box.
```
blender -b -P render.py -- model.glb out.mp4 240 day
# or as HTTP: node server.js  →  POST GLB → returns MP4
```
- EEVEE (fast, seconds–minutes). Switch to CYCLES for path-traced photoreal.
- `render.py` sets up pivot/camera/orbit/lights/world, renders to FFMPEG H264.
- `server.js` wraps it in a tiny HTTP endpoint (port 7878).
- See `render-worker/README.md` for full setup.

---

## 9. Tests & CI
- `scripts/testPlanner.ts` — geometry regression (0 overlaps, diversity, adjacency, entry-room, Vastu). `npm run test:planner`.
- `scripts/testCopilot.ts` — chat parser. `npm run test:copilot`.
- `.github/workflows/ci.yml` — tsc + planner + build on push/PR.
- `tsx` is in `devDependencies` (was missing, caused all CI checks to fail until fixed).
- `vercel.json` removed (cron was breaking Hobby deploys).

**Current metrics:** 0 overlapping rooms across all test plans; adjacency up to ~82; kitchen↔dining adjacent in most options; entry-room = living/foyer always; Vastu ~94 when requested; ~170 candidates per brief.

---

## 10. Architectural / Engineering review findings (NBC 2016)
Five test plans run. Six critical/major issues found and fixed (commit `9aa6e09`):

| # | Issue | Fix |
|---|---|---|
| 1 | `"2 floors"` parsed as NaN → empty plans | New floor-count regex in `requirementParser.ts` |
| 2 | Parking/garden overflowed setback envelope on every plan | Fixed coordinate origin in `geometryEngine.ts` |
| 3 | Rooms absurdly small on tiny plots (1.2ft baths) | NBC-aware room-dropping in `constraintGenerator.ts` |
| 4 | `specialRooms.includes()` crash when field undefined | Null guard (`req.specialRooms \|\| []`) |
| 5 | Room targets not scaled to plot size | `fpScale` proportioning before NBC-min clamping |
| 6 | `servant` / `gym` special rooms silently ignored | Wired in constraint generator |

**Remaining known limitations (physical constraints, not bugs):**
- 5BHK on 180sqyd (43×38ft) cannot meet all NBC §6 minimums — engine now drops excess rooms gracefully.
- Vastu kitchen (SE) vs dining adjacency (W) are geometrically opposed on small plots — both constraints can't both be 100% satisfied simultaneously.
- No structural grid / column positions computed (requires separate structural module).
- Staircase aspect ratio can be non-ideal (slicer doesn't reserve a fixed stair slot).

---

## 11. Known gaps / roadmap
| Item | Status |
|---|---|
| Version compare/history UI | `revisionEngine` + `projectMemory` exist; only "Regenerate" wired in UI. |
| DWG / IFC export | Path documented; needs ODA/Forge (DWG) or `web-ifc` (IFC). PDF/PNG/JPG/SVG/DXF/CSV done. |
| Staircase geometry (fixed slot) | Slicer assigns arbitrary aspect; should reserve ~10×8ft. |
| Vastu full geometric facing rotation | Entrance follows facing; absolute-compass placement stays (architecturally correct). |
| Photoreal render in-app | GLB export + Blender worker exists; in-app trigger UI not yet built. |
| Gemini billing | Code ready; user must enable billing on Google account. |

---

## 12. Conventions / gotchas
- Coordinates are in **feet**, plot-relative. `(0,0)` = front-left corner of plot. Y increases toward the rear. Layout order: `0..setbacks.front` = front setback → yard strip → building footprint → rear setback.
- `RoomLayout` uses `x, y, w, h` (NOT `width`/`depth`/`height`). Keep it stable — it's the shared contract for all renderers and engines.
- `lib/supabase.ts` exports `SUPABASE_URL` and `SUPABASE_ANON_KEY` as named exports. Server routes must import from here (not `process.env`) because `NEXT_PUBLIC_*` vars may not be set on Vercel.
- Git repo root is the **inner** `arch-copilot` folder (not the Downloads parent).
- Commit trailer: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- The Supabase anon key is intentionally hardcoded (safe; RLS is the protection). Service-role key must NEVER be in client code or committed.
- `.env.local` is gitignored. Verified: no secrets in tracked source files.

---

## 13. Run locally
```powershell
cd arch-copilot
npm install
# create .env.local with vars from section 5
npm run dev          # http://localhost:3000
npm run build        # production build check
npm run test:planner # geometry regression (should print PASS)
```

### Blender worker (separate process, on any machine with Blender 4.x)
```powershell
$env:BLENDER="C:\Program Files\Blender Foundation\Blender 4.x\blender.exe"
node render-worker/server.js   # runs on :7878
# or one-off:
blender -b -P render-worker/render.py -- model.glb out.mp4 240 day
```
