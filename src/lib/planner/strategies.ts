// ============================================================================
//  DESIGN STRATEGY SYSTEM
//  Guarantees diversity: identical briefs produce different plans because the
//  optimizer explores different strategies. Each strategy biases the geometry
//  ordering, features, and the scoring weights.
// ============================================================================
import type { DesignStrategy } from './types';

export const STRATEGIES: DesignStrategy[] = [
  {
    id: 'family',
    name: 'Family Focused',
    tagline: 'Warm, connected, everyday living',
    description: 'Generous shared living/dining core with bedrooms clustered around a central circulation spine for easy family movement.',
    weights: { ventilation: 0.15, privacy: 0.15, lighting: 0.18, circulation: 0.22, spaceUtilization: 0.20, futureExpansion: 0.10 },
    costMultiplier: 1.0,
    features: { courtyard: false, openPlan: false, extraBalconies: false, centralCirculation: true, vastu: false },
    zoneOrder: ['public', 'service', 'circulation', 'private', 'utility', 'outdoor'],
    seed: 11,
  },
  {
    id: 'luxury',
    name: 'Luxury Focused',
    tagline: 'Grand proportions & suites',
    description: 'Oversized living, double-height lobby potential, en-suite master with walk-in, and premium balconies. Prioritises impression and comfort.',
    weights: { ventilation: 0.12, privacy: 0.20, lighting: 0.22, circulation: 0.14, spaceUtilization: 0.12, futureExpansion: 0.20 },
    costMultiplier: 1.35,
    features: { courtyard: false, openPlan: true, extraBalconies: true, centralCirculation: false, vastu: false },
    zoneOrder: ['public', 'circulation', 'private', 'service', 'utility', 'outdoor'],
    seed: 23,
  },
  {
    id: 'privacy',
    name: 'Privacy Focused',
    tagline: 'Clear public / private zoning',
    description: 'Strong separation of public and private zones — bedrooms tucked to the rear/upper, services buffered, minimal sightlines into private areas.',
    weights: { ventilation: 0.15, privacy: 0.30, lighting: 0.13, circulation: 0.15, spaceUtilization: 0.15, futureExpansion: 0.12 },
    costMultiplier: 1.05,
    features: { courtyard: false, openPlan: false, extraBalconies: false, centralCirculation: true, vastu: false },
    zoneOrder: ['public', 'service', 'utility', 'circulation', 'private', 'outdoor'],
    seed: 37,
  },
  {
    id: 'courtyard',
    name: 'Courtyard Focused',
    tagline: 'Light & air around a central void',
    description: 'Rooms wrap a central courtyard/light-well, maximising cross-ventilation and daylight deep into the plan — ideal for hot climates.',
    weights: { ventilation: 0.28, privacy: 0.14, lighting: 0.24, circulation: 0.12, spaceUtilization: 0.10, futureExpansion: 0.12 },
    costMultiplier: 1.15,
    features: { courtyard: true, openPlan: false, extraBalconies: false, centralCirculation: true, vastu: false },
    zoneOrder: ['public', 'private', 'service', 'circulation', 'utility', 'outdoor'],
    seed: 41,
  },
  {
    id: 'vastu',
    name: 'Vastu Focused',
    tagline: 'Directionally aligned (Ashtadik)',
    description: 'Kitchen to the South-East, master to the South-West, living/entry to the North-East, with the centre kept light per Vastu Shastra.',
    weights: { ventilation: 0.20, privacy: 0.16, lighting: 0.20, circulation: 0.14, spaceUtilization: 0.14, futureExpansion: 0.16 },
    costMultiplier: 1.1,
    features: { courtyard: false, openPlan: false, extraBalconies: false, centralCirculation: true, vastu: true },
    zoneOrder: ['public', 'service', 'circulation', 'private', 'utility', 'outdoor'],
    seed: 53,
  },
  {
    id: 'open',
    name: 'Open Space Focused',
    tagline: 'Fluid, loft-like volumes',
    description: 'Merged living-dining-kitchen with minimal partitions and large glazing for an airy, contemporary feel.',
    weights: { ventilation: 0.22, privacy: 0.10, lighting: 0.26, circulation: 0.14, spaceUtilization: 0.16, futureExpansion: 0.12 },
    costMultiplier: 1.08,
    features: { courtyard: false, openPlan: true, extraBalconies: true, centralCirculation: false, vastu: false },
    zoneOrder: ['public', 'circulation', 'service', 'private', 'utility', 'outdoor'],
    seed: 67,
  },
  {
    id: 'compact',
    name: 'Compact Efficient',
    tagline: 'Maximum usable area, minimal waste',
    description: 'Tight circulation, stacked services, and efficient room packing to extract the most usable space from a small footprint or tight budget.',
    weights: { ventilation: 0.14, privacy: 0.16, lighting: 0.14, circulation: 0.10, spaceUtilization: 0.34, futureExpansion: 0.12 },
    costMultiplier: 0.9,
    features: { courtyard: false, openPlan: true, extraBalconies: false, centralCirculation: true, vastu: false },
    zoneOrder: ['service', 'public', 'circulation', 'private', 'utility', 'outdoor'],
    seed: 79,
  },
];

export function getStrategy(id: string): DesignStrategy {
  return STRATEGIES.find(s => s.id === id) || STRATEGIES[0];
}

/** Choose a diverse set of strategies for a brief (priorities can bias picks). */
export function selectStrategies(priorities: string[], vastu: boolean, count = 4): DesignStrategy[] {
  const ranked = [...STRATEGIES];
  const boost = (id: string, by: number) => {
    const s = ranked.find(x => x.id === id);
    if (s) (s as DesignStrategy & { _b?: number })._b = ((s as DesignStrategy & { _b?: number })._b || 0) + by;
  };
  if (vastu || priorities.includes('vastu')) boost('vastu', 5);
  if (priorities.includes('privacy')) boost('privacy', 3);
  if (priorities.includes('ventilation')) { boost('courtyard', 3); boost('open', 2); }
  if (priorities.includes('lighting')) { boost('open', 2); boost('courtyard', 2); }
  if (priorities.includes('open-space')) boost('open', 3);
  ranked.sort((a, b) => (((b as DesignStrategy & { _b?: number })._b || 0) - ((a as DesignStrategy & { _b?: number })._b || 0)) || (a.seed - b.seed));
  // Always keep variety: ensure family + at least one of luxury/open are present
  const picked = ranked.slice(0, count);
  return picked;
}
