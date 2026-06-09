// ============================================================================
//  ArchCopilot render worker
//  A tiny standalone service: POST a GLB → it runs headless Blender → returns
//  a cinematic MP4. Run this on your own machine / a GPU box (NOT on Vercel).
//
//  Start:  BLENDER=/path/to/blender node server.js
//  Then in the app, send the GLB (from the Interior "⬇ GLB" export) here.
// ============================================================================
const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PORT = process.env.PORT || 7878;
const BLENDER = process.env.BLENDER || 'blender';   // path to the Blender executable
const SCRIPT = path.join(__dirname, 'render.py');

function runBlender(glbPath, outPath, frames, mood) {
  return new Promise((resolve, reject) => {
    const args = ['-b', '-P', SCRIPT, '--', glbPath, outPath, String(frames), mood];
    const proc = spawn(BLENDER, args, { stdio: 'inherit' });
    proc.on('error', reject);
    proc.on('close', code => (code === 0 ? resolve() : reject(new Error('Blender exited ' + code))));
  });
}

const server = http.createServer(async (req, res) => {
  // CORS so the web app can call it from the browser if desired
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Frames, X-Mood');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  if (req.method !== 'POST' || req.url !== '/render') { res.writeHead(404); return res.end('POST a GLB to /render'); }

  const chunks = [];
  req.on('data', c => chunks.push(c));
  req.on('end', async () => {
    const id = Date.now() + '-' + Math.random().toString(36).slice(2, 7);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'render-'));
    const glb = path.join(dir, 'model.glb');
    const out = path.join(dir, 'out.mp4');
    try {
      fs.writeFileSync(glb, Buffer.concat(chunks));
      const frames = parseInt(req.headers['x-frames'] || '240', 10);
      const mood = (req.headers['x-mood'] || 'day').toString();
      console.log(`[${id}] rendering ${frames}f ${mood} …`);
      await runBlender(glb, out, frames, mood);
      const video = fs.readFileSync(out);
      res.writeHead(200, { 'Content-Type': 'video/mp4', 'Content-Length': video.length });
      res.end(video);
      console.log(`[${id}] done (${(video.length / 1e6).toFixed(1)} MB)`);
    } catch (e) {
      console.error(`[${id}] failed`, e);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: String(e) }));
    } finally {
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
    }
  });
});

server.listen(PORT, () => console.log(`Render worker on :${PORT}  (Blender: ${BLENDER})`));
