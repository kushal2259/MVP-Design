import type { RoomLayout } from '@/types';

// ============================================================================
//  VASTU SHASTRA COMPLIANCE ENGINE
//  Maps each room to its directional zone (Ashtadik) and scores the plan
//  against classical Vastu principles. Produces a score, dosha (defect) list
//  with severity, and practical remedies.
//
//  Orientation convention: plan "up" (small y) = NORTH, down = SOUTH,
//  left (small x) = WEST, right (large x) = EAST.
// ============================================================================

export type Direction = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW' | 'BRAHMASTHAN';

export const DIRECTION_NAMES: Record<Direction, string> = {
  N: 'North (Kubera)',
  NE: 'North-East (Ishanya)',
  E: 'East (Indra)',
  SE: 'South-East (Agneya)',
  S: 'South (Yama)',
  SW: 'South-West (Nairutya)',
  W: 'West (Varuna)',
  NW: 'North-West (Vayavya)',
  BRAHMASTHAN: 'Centre (Brahmasthan)',
};

export interface Dosha {
  severity: 'critical' | 'moderate' | 'minor';
  room: string;
  zone: Direction;
  issue: string;
  remedy: string;
}

export interface VastuReport {
  score: number;                 // 0–100
  grade: string;                 // Excellent / Good / Fair / Poor
  rating: string;                // one-line verdict
  zoneMap: { room: string; type: string; zone: Direction; status: 'ideal' | 'acceptable' | 'dosha' }[];
  doshas: Dosha[];
  positives: string[];
}

interface VastuRule {
  ideal: Direction[];
  acceptable: Direction[];
  // remedy used when the room lands outside ideal+acceptable
  remedy: string;
  label: string;
}

// Classical placement rules per room type
const RULES: Record<string, VastuRule> = {
  kitchen: {
    label: 'Kitchen',
    ideal: ['SE'],
    acceptable: ['NW'],
    remedy: 'Place the cooking gas/stove in the South-East corner of the room facing East while cooking. Add red/orange accents and avoid water sources next to the stove.',
  },
  living: {
    label: 'Living Room',
    ideal: ['N', 'NE', 'E'],
    acceptable: ['NW', 'W'],
    remedy: 'Keep the North-East corner of the living room light and clutter-free. Place heavy furniture toward the South/West walls.',
  },
  dining: {
    label: 'Dining',
    ideal: ['W', 'E'],
    acceptable: ['N', 'NW', 'SE'],
    remedy: 'Seat the head of the family facing East or North while eating. Avoid the dining area in the South-West.',
  },
  bedroom: {
    label: 'Bedroom',
    ideal: ['SW', 'S', 'W'],
    acceptable: ['NW'],
    remedy: 'Sleep with the head pointing South or East. Add a metal/lead pyramid remedy in the North-East if the bedroom must stay there.',
  },
  toilet: {
    label: 'Toilet / Bath',
    ideal: ['NW', 'W', 'S'],
    acceptable: ['SE'],
    remedy: 'Keep the toilet door closed, place a sea-salt bowl inside, and use a copper Vastu strip. Never locate a toilet in the North-East or centre.',
  },
  staircase: {
    label: 'Staircase',
    ideal: ['S', 'SW', 'W'],
    acceptable: ['SE', 'NW'],
    remedy: 'Staircases should rise clockwise. Keep the North-East and centre free of stairs; if unavoidable, paint the under-stair area in light tones and keep it clean.',
  },
  lobby: {
    label: 'Lobby / Entry',
    ideal: ['N', 'NE', 'E'],
    acceptable: ['NW', 'W'],
    remedy: 'Locate the main entrance in the North, North-East or East. Use a bright threshold, a nameplate and a clutter-free entry.',
  },
  corridor: {
    label: 'Corridor',
    ideal: ['N', 'E', 'NE', 'NW', 'W', 'S', 'SE', 'SW'],
    acceptable: [],
    remedy: 'Keep corridors well-lit and unobstructed.',
  },
  balcony: {
    label: 'Balcony',
    ideal: ['N', 'NE', 'E'],
    acceptable: ['NW', 'W'],
    remedy: 'Open balconies and terraces are best in the North and East for morning light. Keep the South-West heavy and enclosed.',
  },
  parking: {
    label: 'Parking',
    ideal: ['NW', 'SE'],
    acceptable: ['N', 'E'],
    remedy: 'Park vehicles in the North-West or South-East. Avoid blocking the North-East with a covered structure.',
  },
  garden: {
    label: 'Garden / Lawn',
    ideal: ['N', 'NE', 'E'],
    acceptable: ['NW'],
    remedy: 'Open lawns and water features belong in the North-East. Keep tall trees to the South and West only.',
  },
};

interface Frame { minX: number; maxX: number; minY: number; maxY: number; }

export function zoneOfFrame(room: RoomLayout, f: Frame): Direction {
  const cx = room.x + room.w / 2;
  const cy = room.y + room.h / 2;
  const spanX = Math.max(1, f.maxX - f.minX);
  const spanY = Math.max(1, f.maxY - f.minY);
  const fx = Math.min(0.999, Math.max(0, (cx - f.minX) / spanX));
  const fy = Math.min(0.999, Math.max(0, (cy - f.minY) / spanY));
  const col = fx < 1 / 3 ? 'W' : fx > 2 / 3 ? 'E' : 'C';
  const row = fy < 1 / 3 ? 'N' : fy > 2 / 3 ? 'S' : 'C';
  if (row === 'N' && col === 'W') return 'NW';
  if (row === 'N' && col === 'C') return 'N';
  if (row === 'N' && col === 'E') return 'NE';
  if (row === 'C' && col === 'W') return 'W';
  if (row === 'C' && col === 'C') return 'BRAHMASTHAN';
  if (row === 'C' && col === 'E') return 'E';
  if (row === 'S' && col === 'W') return 'SW';
  if (row === 'S' && col === 'C') return 'S';
  return 'SE';
}

export function analyzeVastu(rooms: RoomLayout[], plotWidth: number, plotDepth: number): VastuReport {
  // Only analyse ground floor for primary Vastu (most weight is on the ground floor)
  const groundRooms = rooms.filter(r => r.floor === 0);
  const checkRooms = groundRooms.length ? groundRooms : rooms;

  // Zones are measured relative to the BUILDING FOOTPRINT (interior rooms),
  // not the full plot — the structure is what Vastu evaluates. Exterior
  // elements (lawn/parking) sit outside this frame and are clamped to edges.
  const interior = checkRooms.filter(r => r.type !== 'garden' && r.type !== 'parking');
  const frameRooms = interior.length ? interior : checkRooms;
  const frame: Frame = {
    minX: Math.min(...frameRooms.map(r => r.x)),
    maxX: Math.max(...frameRooms.map(r => r.x + r.w)),
    minY: Math.min(...frameRooms.map(r => r.y)),
    maxY: Math.max(...frameRooms.map(r => r.y + r.h)),
  };

  const zoneMap: VastuReport['zoneMap'] = [];
  const doshas: Dosha[] = [];
  const positives: string[] = [];
  let earned = 0;
  let possible = 0;

  for (const room of checkRooms) {
    // Exterior landscape elements sit outside the building frame — skip them
    // so they don't produce misleading interior-zone doshas.
    if (room.type === 'parking' || room.type === 'garden') continue;
    const rule = RULES[room.type];
    if (!rule) continue;
    const zone = zoneOfFrame(room, frame);
    possible += 10;

    let status: 'ideal' | 'acceptable' | 'dosha';
    if (rule.ideal.includes(zone)) {
      earned += 10;
      status = 'ideal';
      positives.push(`${rule.label} is perfectly placed in the ${DIRECTION_NAMES[zone]}.`);
    } else if (rule.acceptable.includes(zone)) {
      earned += 6;
      status = 'acceptable';
    } else {
      status = 'dosha';
      // severity by how serious the violation is
      const critical =
        (room.type === 'toilet' && (zone === 'NE' || zone === 'BRAHMASTHAN')) ||
        (room.type === 'kitchen' && (zone === 'NE' || zone === 'SW')) ||
        (room.type === 'bedroom' && zone === 'NE' && /master|parent/i.test(room.name)) ||
        (room.type === 'staircase' && (zone === 'NE' || zone === 'BRAHMASTHAN'));
      const severity: Dosha['severity'] = critical ? 'critical' : zone === 'BRAHMASTHAN' ? 'moderate' : 'moderate';
      earned += critical ? 0 : 2;
      doshas.push({
        severity,
        room: room.name,
        zone,
        issue: `${rule.label} located in the ${DIRECTION_NAMES[zone]} — ideal is ${rule.ideal.map(d => DIRECTION_NAMES[d]).join(' or ')}.`,
        remedy: rule.remedy,
      });
    }
    zoneMap.push({ room: room.name, type: room.type, zone, status });
  }

  // Brahmasthan check — centre should be open/light
  const centreOccupied = checkRooms.find(r => {
    const z = zoneOfFrame(r, frame);
    return z === 'BRAHMASTHAN' && (r.type === 'toilet' || r.type === 'staircase' || r.type === 'kitchen');
  });
  if (centreOccupied) {
    doshas.push({
      severity: 'critical',
      room: centreOccupied.name,
      zone: 'BRAHMASTHAN',
      issue: 'A heavy/wet utility occupies the Brahmasthan (centre of the home), which should remain open and light.',
      remedy: 'Keep the centre of the home free of toilets, staircases and heavy fixtures. If unavoidable, use a Vastu pyramid and keep the area exceptionally clean and well-lit.',
    });
  } else {
    positives.push('The Brahmasthan (centre) is kept open — excellent for positive energy flow.');
  }

  const score = possible > 0 ? Math.round((earned / possible) * 100) : 0;
  const grade = score >= 85 ? 'Excellent' : score >= 70 ? 'Good' : score >= 55 ? 'Fair' : 'Needs Improvement';
  const rating =
    score >= 85 ? 'Highly Vastu-compliant — auspicious across all key zones.'
    : score >= 70 ? 'Largely Vastu-compliant with a few easily-remedied placements.'
    : score >= 55 ? 'Moderately compliant — address the listed doshas with the suggested remedies.'
    : 'Several Vastu doshas detected — review placements or apply the remedies below.';

  return { score, grade, rating, zoneMap, doshas, positives: positives.slice(0, 6) };
}
