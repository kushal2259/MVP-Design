# MVP Design — Project Context & Handoff

> AI Architectural Copilot for India. Turns a natural-language brief into
> architect-reviewable concept packages: floor plans, CAD, 3D, elevations,
> Vastu, NBC/byelaw compliance, engineering drafts, cost/BOQ, and site-visit
> admin. **The platform assists architects; it does not replace them — every
> engineering output is marked "requires licensed professional approval".**

- **Repo:** https://github.com/kushal2259/MVP-Design
- **Stack:** Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Three.js · Supabase
- **Local app root:** `C:\Users\kusha\Downloads\arch-copilot\arch-copilot` (this *is* the git repo root)
- **Styling:** inline styles + CSS variables (no Tailwind). Theme vars: `--blueprint` (navy), `--amber`, `--paper`, `--ink`, `--steel`, `--line`.

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
| `requirementParser.ts` | LLM/regex → `ParsedRequirements`. Derives plot dims from area; detects facing (N/E/S/W), priorities, vastu, special rooms. **Only LLM-authored structure.** |
| `ruleEngine.ts` | Configurable `RoomRule`s (min/max area, min width, zone, privacy, ventilation). `setRoomRule()` to extend. |
| `constraintGenerator.ts` | Builds the `RoomProgram` (rooms per floor, target areas normalised to fill each floor), setbacks, front yard, FAR. |
| `adjacency.ts` | `generateAdjacencyMatrix()` — pattern library: foyer→living, kitchen-dining-utility triangle, bedroom+en-suite bath, toilet↮kitchen/dining (negative). |
| `strategies.ts` | 9 strategies: Family, Luxury, Privacy, Courtyard, Vastu, Open Space, Modern Villa, Future Expansion, Compact. `selectStrategies()` biases by priorities. |
| `planningEngine.ts` | Macro-zoning (public/service/circ/private) + **greedy adjacency-chain ordering** so the slicer places graph-adjacent rooms on a shared wall. Seeded RNG. |
| `geometryEngine.ts` | `buildGeometry()` (slice with min-dimension-aware cuts; **chain reversed so foyer/living lands at the front**), `vastuPlace()` (Ashtadik even-thirds grid), `ensureMainEntrance()` (entrance only on foyer/living; Vastu→NE; follows facing), `applyOverrides()` (chat/CAD door/window/rename post-pass), `makeRoom()` (doors/windows/furniture). |
| `qualityEngine.ts` | `evaluate()` — the Critic. Adjacency-satisfaction is the dominant metric. Returns per-criterion + total + accept/reject. |
| `optimizer.ts` | `optimizeDetailed()` — generates ~28 candidates/strategy, scores via critic, rejects < threshold (58), returns diverse top-3 + generated/accepted counts. |
| `revisionEngine.ts` | Partial regeneration: lock rooms, resize a target, re-normalise unlocked rooms, re-tile. (Module built; UI not yet fully wired.) |
| `projectMemory.ts` | Serialisable memory: requirements, locked rooms, revisions, approved layout. (Module built; UI not yet fully wired.) |
| `index.ts` | Orchestrator. `generatePlan(req)` + `generatePlanFromSettings(settings)` (applies `customOverrides`). |

`src/lib/layoutSolver.ts` keeps the public `generateLayouts(settings)` (delegates
to the planner; legacy Vastu-grid retained only as a fallback) and the LLM
helpers `parseRequirementsWithGemini` / `parseChatEditWithGemini` (now via the
resilient `geminiGenerate()` → server proxy → retrying direct call).

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

**Engineering disciplines** (`engineeringSuite.ts` → `getCatalog(discipline)`):
Structural (16), Electrical (13), Plumbing (10), HVAC (6), Fire (5), Site (8).
Rendered by `components/DrawingCatalogView.tsx` with Option A/B/C + floor
switchers, approval banners, and PDF/PNG/JPG/SVG export per sheet.

---

## 4. App structure (`src/`)
- `app/page.tsx` — landing (auth modal: sign in/up/forgot; hero house image).
- `app/dashboard/page.tsx` — auth-gated project list + **"Load Sample Project"**.
- `app/project/new/page.tsx` — 4-step wizard (+ Hindi/English voice input).
- `app/project/[id]/page.tsx` — the workspace (all tabs). **Largest file.**
- `app/reset-password/page.tsx` — Supabase recovery.
- `app/api/ai/route.ts` — **server-side Gemini proxy** (key off browser + cache + retry).
- `app/api/analyze/route.ts` — legacy analysis route.
- `components/` — DrawingViewport (CAD editor + door/window CRUD), ThreeDViewerV2
  (orbit/walkthrough/cinematic), InteriorRenderView (dollhouse, per-floor),
  FloorPlanV2Renderer (plan + MAIN ENTRANCE marker), DrawingCatalogView,
  SiteVisitsTab (CRUD), CopilotChat, etc.
- `lib/store.ts` — Supabase auth + projects (CRUD, RLS).
- `lib/supabase.ts` — client (anon key; RLS protects data).
- `lib/useIsMobile.ts` — responsive hook.

### Project tabs (workspace)
Overview · Floor Plans · CAD Editor · 3D View · Elevations · Interior ·
Vastu Score · Sun & Ventilation · Structural · Electrical · Plumbing · HVAC ·
Fire Safety · Site Plans · Cost Est. · BOQ · Timeline · **Site Visits** ·
Compliance · Export.

---

## 5. Backend (Supabase)
- **Auth:** Supabase Auth (email/password, reset email). `mailer_autoconfirm` is ON.
- **Projects:** `public.projects` table (JSONB `data` = full Project), Row-Level
  Security so each user sees only their own. SQL in `supabase_setup.sql`.
- **Project URL / anon key:** in `src/lib/supabase.ts` (anon key is safe to expose;
  RLS is the protection).
- **Site visits:** currently `localStorage` per project (NOT yet a Supabase table).

### Env (`.env.local`, gitignored)
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
GEMINI_API_KEY=...          # server-only, used by /api/ai (never sent to browser)
```

---

## 6. AI / Copilot
- The **CopilotChat** floating panel edits the active plan via natural language.
- Flow: `parseChatEditWithGemini` → updated `PlotSettings` (+ `customOverrides`)
  → `generateLayouts()` regenerates → `applyOverrides()` renders door/window/rename edits.
- `geminiGenerate()` prefers `/api/ai` (server key), falls back to a direct
  retrying call (handles transient 429/503).
- Works for: BHK, floors, dimensions, style, kitchen, balcony, location, budget,
  vastu, and door/window add (geometry applied).

---

## 7. Tests & CI
- `scripts/testPlanner.ts` — geometry regression (0 overlaps, diversity,
  adjacency, entrance-room, Vastu). Exits non-zero on failure. `npm run test:planner`.
- `scripts/testCopilot.ts` — exercises the chat parser. `npm run test:copilot`.
- `.github/workflows/ci.yml` — tsc + planner regression + production build on push/PR.

**Current metrics:** 0 overlapping rooms; adjacency satisfaction up to ~82;
kitchen↔dining adjacent in most options; entry-room = living/foyer; Vastu ~84
when requested; ~170 candidates generated & critiqued per brief.

---

## 8. Known gaps / roadmap (honest)
| Item | Status |
|---|---|
| Version compare/history UI | revisionEngine + projectMemory exist; only "Regenerate" wired. |
| Vastu full geometric facing rotation | Entrance follows facing; absolute-compass placement stays (architecturally correct). |
| Site visits → Supabase + email/WhatsApp reminders | Visits are localStorage; reminders need Twilio/SendGrid. |
| Cinematic interior walkthrough / day-night render | Exterior viewer has walk+cinematic; photoreal reel needs a render pass. |
| DWG / IFC export | Path documented; needs ODA/Forge (DWG) or `web-ifc` (IFC). PDF/PNG/JPG/SVG/DXF/CSV done. |
| Gemini "off free tier" | Code ready; needs billing enabled on the Google account (user action). |
| Thin rooms on dense small plots | Reduced via min-dim cut; not fully eliminated. |

---

## 9. Conventions / gotchas
- Coordinates are in **feet**, plot-relative. Floor-plan convention: **N = top**
  (small y), S = bottom (large y), W = left, E = right. "Front" (entrance) = bottom.
- `RoomLayout` is the shared geometry contract consumed by every renderer/engine —
  keep it stable.
- The git repo root is the **inner** `arch-copilot` folder.
- Commit trailer: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- Commit/push only when asked; branch off main first if needed.

---

## 10. Run locally
```
cd arch-copilot
npm install
# create .env.local with the 3 vars above
npm run dev          # http://localhost:3000
npm run build        # production build
npm run test:planner # geometry regression
```
