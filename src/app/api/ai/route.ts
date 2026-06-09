import { NextRequest, NextResponse } from 'next/server';

// ============================================================================
//  SERVER-SIDE AI PROXY
//  Keeps the Gemini API key OFF the browser (uses GEMINI_API_KEY from server
//  env), adds an in-memory response cache (5-min TTL) and retry/backoff for
//  transient 429/503. The client calls /api/ai with just a prompt.
// ============================================================================

const cache = new Map<string, { t: number; v: string }>();
const TTL = 5 * 60 * 1000;
const MAX_CACHE = 200;

function hash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = (Math.imul(31, h) + s.charCodeAt(i)) | 0; }
  return String(h);
}

async function callGemini(key: string, prompt: string, retries = 3): Promise<string> {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      });
      if (res.ok) {
        const data = await res.json();
        return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      }
      if (![429, 500, 502, 503].includes(res.status) || attempt === retries) {
        throw new Error(`Gemini ${res.status}`);
      }
    } catch (e) {
      if (attempt === retries) throw e;
    }
    await new Promise(r => setTimeout(r, 600 * (attempt + 1) + Math.random() * 400));
  }
  throw new Error('Gemini request failed');
}

export async function POST(req: NextRequest) {
  let prompt = '';
  try { prompt = (await req.json())?.prompt || ''; } catch { /* ignore */ }
  if (!prompt || prompt.length > 8000) {
    return NextResponse.json({ error: 'Invalid prompt' }, { status: 400 });
  }
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    // Not configured server-side — client should fall back to its own key.
    return NextResponse.json({ error: 'server-key-missing' }, { status: 501 });
  }

  const ck = hash(prompt);
  const hit = cache.get(ck);
  if (hit && Date.now() - hit.t < TTL) {
    return NextResponse.json({ text: hit.v, cached: true });
  }

  try {
    const text = await callGemini(key, prompt);
    if (cache.size > MAX_CACHE) cache.clear();
    cache.set(ck, { t: Date.now(), v: text });
    return NextResponse.json({ text });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 503 });
  }
}
