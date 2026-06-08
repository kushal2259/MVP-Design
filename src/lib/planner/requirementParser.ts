// ============================================================================
//  AI REQUIREMENT PARSER
//  The ONLY LLM-authored step. Converts a natural-language brief into a
//  structured ParsedRequirements object. The LLM never sees or emits geometry.
//  Falls back to a deterministic regex parser when no key / offline.
// ============================================================================
import type { ParsedRequirements } from './types';
import type { PlotSettings } from '@/types';

const UNIT_TO_SQFT: Record<string, number> = { sq_ft: 1, sq_yd: 9, sq_m: 10.7639 };

function deriveDimsFromArea(areaSqft: number, ratio = 1.15): { width: number; depth: number } {
  // width:depth ~ ratio; width = sqrt(area*ratio), depth = area/width
  const width = Math.round(Math.sqrt(areaSqft * ratio));
  const depth = Math.round(areaSqft / width);
  return { width, depth };
}

/** Deterministic fallback parser (no LLM). */
export function parseRequirementsLocal(text: string): ParsedRequirements {
  const t = text.toLowerCase();

  // unit + area
  let unit: ParsedRequirements['unit'] = 'sq_ft';
  if (/sq\s?yd|square\s?yard|gaj/.test(t)) unit = 'sq_yd';
  else if (/sq\s?m|square\s?met/.test(t)) unit = 'sq_m';
  const areaMatch = t.match(/(\d{2,5})\s*(sq|square|gaj|yd|m)/);
  const explicitDims = t.match(/(\d{1,3})\s*[x×by*]\s*(\d{1,3})/);

  let plotWidth = 50, plotDepth = 45;
  let plotArea = 250, areaSqft = 2250;
  if (explicitDims) {
    plotWidth = +explicitDims[1];
    plotDepth = +explicitDims[2];
    areaSqft = plotWidth * plotDepth;
    plotArea = areaSqft;
    unit = 'sq_ft';
  } else if (areaMatch) {
    plotArea = +areaMatch[1];
    areaSqft = plotArea * (UNIT_TO_SQFT[unit] || 1);
    const d = deriveDimsFromArea(areaSqft);
    plotWidth = d.width; plotDepth = d.depth;
  }

  const bhk = t.match(/(\d)\s*(bhk|bedroom|bed)/);
  const bedrooms = bhk ? Math.max(1, Math.min(8, +bhk[1])) : 3;

  const floorMatch = t.match(/(\d)\s*(floor|storey|story)/) || (/(g\s*\+\s*(\d))/.exec(t));
  let floors = 2;
  if (floorMatch) floors = floorMatch[2] ? Math.min(4, +floorMatch[2] + (/(g\s*\+)/.test(t) ? 1 : 0)) : Math.min(4, +floorMatch[1]);
  if (/single\s*(floor|storey)|ground\s*floor only|bungalow/.test(t)) floors = 1;

  const style: ParsedRequirements['style'] =
    /luxur|premium|villa/.test(t) ? 'luxury'
    : /tradition|classic|heritage/.test(t) ? 'traditional'
    : /contemporary/.test(t) ? 'contemporary' : 'modern';

  const budgetMatch = t.match(/(\d{1,4})\s*(lakh|lac|l\b|cr|crore)/);
  let budgetLakhs = 60;
  if (budgetMatch) budgetLakhs = /cr|crore/.test(budgetMatch[2]) ? +budgetMatch[1] * 100 : +budgetMatch[1];

  const kitchen: ParsedRequirements['kitchen'] =
    /open\s*kitchen|open\s*plan/.test(t) ? 'open' : /large|big|spacious/.test(t) && /kitchen/.test(t) ? 'large' : /compact|small/.test(t) && /kitchen/.test(t) ? 'compact' : 'large';
  const livingRoom: ParsedRequirements['livingRoom'] =
    /large|big|spacious|grand/.test(t) && /living|hall|drawing/.test(t) ? 'large' : /compact|small/.test(t) && /living/.test(t) ? 'compact' : 'standard';

  const specialRooms: string[] = [];
  [['pooja', /pooja|puja|prayer|mandir/], ['study', /study|office|work\s*room/], ['store', /store|storage|utility/], ['guest', /guest/], ['gym', /gym|fitness/], ['servant', /servant|maid/], ['theatre', /theatre|theater|cinema/]]
    .forEach(([k, re]) => { if ((re as RegExp).test(t)) specialRooms.push(k as string); });

  const priorities: string[] = [];
  if (/vastu/.test(t)) priorities.push('vastu');
  if (/privacy|private/.test(t)) priorities.push('privacy');
  if (/ventilat|airy|cross\s*vent/.test(t)) priorities.push('ventilation');
  if (/light|sunlight|natural\s*light|bright/.test(t)) priorities.push('lighting');
  if (/open|spacious/.test(t)) priorities.push('open-space');

  return {
    plotArea, unit, plotWidth, plotDepth, floors, bedrooms,
    bathrooms: Math.max(2, Math.ceil(bedrooms * 0.75)),
    style, budgetLakhs, location: '',
    kitchen, livingRoom,
    balconyRequired: !/no balcon/.test(t),
    specialRooms, priorities, vastu: /vastu/.test(t), raw: text,
  };
}

/** LLM-backed parser. Intent only — produces ParsedRequirements, never geometry. */
export async function parseRequirements(text: string, apiKey?: string): Promise<ParsedRequirements> {
  if (!apiKey) return parseRequirementsLocal(text);
  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const instructions = `You are an architectural requirement parser. Extract design INTENT only — never produce coordinates, geometry, or layouts.
Return ONLY raw JSON (no markdown) matching:
{"plotArea":number,"unit":"sq_ft"|"sq_yd"|"sq_m","floors":number,"bedrooms":number,"bathrooms":number,"style":"modern"|"contemporary"|"traditional"|"luxury","budgetLakhs":number,"location":string,"kitchen":"large"|"compact"|"open","livingRoom":"large"|"standard"|"compact","balconyRequired":boolean,"specialRooms":string[],"priorities":string[],"vastu":boolean}
User brief: "${text}"`;
    const res = await fetch(endpoint, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: instructions }] }] }),
    });
    if (!res.ok) throw new Error(`API ${res.status}`);
    const data = await res.json();
    const raw = (data?.candidates?.[0]?.content?.parts?.[0]?.text || '').replace(/```json/gi, '').replace(/```/g, '').trim();
    const llm = JSON.parse(raw);
    // Merge LLM intent over deterministic baseline (LLM wins where present).
    const base = parseRequirementsLocal(text);
    const merged: ParsedRequirements = { ...base, ...llm, raw: text };
    // Geometry is derived deterministically from area — never trust LLM dims.
    const areaSqft = (merged.plotArea || base.plotArea) * (UNIT_TO_SQFT[merged.unit] || 1);
    const dims = deriveDimsFromArea(areaSqft);
    merged.plotWidth = dims.width;
    merged.plotDepth = dims.depth;
    merged.vastu = !!merged.vastu || (merged.priorities || []).includes('vastu');
    return merged;
  } catch (err) {
    console.error('parseRequirements: LLM failed, using local parser', err);
    return parseRequirementsLocal(text);
  }
}

/** Adapter: existing PlotSettings → ParsedRequirements (so legacy callers work). */
export function fromPlotSettings(s: PlotSettings): ParsedRequirements {
  const areaSqft = s.width * s.depth;
  return {
    plotArea: areaSqft, unit: 'sq_ft', plotWidth: s.width, plotDepth: s.depth,
    floors: s.floors, bedrooms: s.bedrooms,
    bathrooms: Math.max(2, Math.ceil(s.bedrooms * 0.75)),
    style: (['modern', 'contemporary', 'traditional', 'luxury'].includes(s.style) ? s.style : 'modern') as ParsedRequirements['style'],
    budgetLakhs: s.budgetLakhs, location: s.location,
    kitchen: s.kitchenStyle,
    livingRoom: 'standard',
    balconyRequired: s.balconyRequired,
    specialRooms: [], priorities: [], vastu: false, raw: '',
  };
}
