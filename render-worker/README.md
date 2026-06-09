# ArchCopilot — Blender Render Worker

Turns the **GLB export** from the app's Interior 3D view into a **cinematic MP4
fly-around** using headless Blender. This runs **outside** the Next.js app (on
your PC or a GPU box) because Blender is heavy and Vercel can't run it.

## Pipeline
```
App → Interior 3D → "⬇ GLB"  →  this worker (headless Blender)  →  cinematic .mp4
```

## 1. Install Blender
Download Blender 4.x from https://www.blender.org/download/ and note the
executable path (e.g. `C:\Program Files\Blender Foundation\Blender 4.x\blender.exe`
or `/Applications/Blender.app/Contents/MacOS/Blender`).

## 2. Render a single file from the CLI (quickest test)
```bash
blender -b -P render.py -- interior-model.glb out.mp4 240 day
#                          ^input          ^output ^frames ^day|night
```
Output: `out.mp4` — a 240-frame (8s @ 30fps) 1280×720 orbit render.

## 3. Run as a service (optional)
A tiny HTTP server that accepts a GLB and returns the MP4:
```bash
# Windows (PowerShell)
$env:BLENDER="C:\Program Files\Blender Foundation\Blender 4.x\blender.exe"; node server.js
# macOS / Linux
BLENDER=/Applications/Blender.app/Contents/MacOS/Blender node server.js
```
Then POST a GLB:
```bash
curl -X POST http://localhost:7878/render \
  -H "X-Frames: 240" -H "X-Mood: night" \
  --data-binary @interior-model.glb -o reel.mp4
```

## How AI fits in (your question)
- **An LLM cannot render 3D.** The photoreal video comes from **Blender (EEVEE/Cycles)**.
- Where an LLM *can* help: generating the **Blender Python** (camera paths, sun
  angle, material tweaks) from the room data, or writing per-room shot lists.
  `render.py` is that script — it can be extended/auto-tuned by an LLM later.
- For a fully automated cloud pipeline, host this worker on a GPU instance
  (Modal / Replicate / a cheap GPU VM) and have the app POST the GLB to it.

## Notes
- EEVEE is used for speed (seconds–minutes). Switch the engine to `CYCLES` in
  `render.py` for path-traced photoreal stills/video (much slower).
- Drop an HDRI into the world node setup in `render.py` for studio-grade lighting.
