import type { RoomLayout } from '@/types';

// ============================================================================
//  SUN-PATH & CROSS-VENTILATION ANALYSIS (India)
//  Northern-hemisphere solar geometry: sun rises E, transits S, sets W;
//  North light is soft & diffuse. Window orientation drives heat gain &
//  daylight. Cross-ventilation needs openings on opposite/adjacent walls.
//  Convention: plan "up" (small y) = NORTH.
// ============================================================================

export type ClimateZone = 'Hot & Dry' | 'Warm & Humid' | 'Composite' | 'Temperate' | 'Cold';

const CITY_CLIMATE: Record<string, ClimateZone> = {
  ahmedabad: 'Hot & Dry', jaipur: 'Hot & Dry', jodhpur: 'Hot & Dry', nagpur: 'Hot & Dry',
  mumbai: 'Warm & Humid', chennai: 'Warm & Humid', kolkata: 'Warm & Humid', kochi: 'Warm & Humid', goa: 'Warm & Humid',
  delhi: 'Composite', lucknow: 'Composite', bhopal: 'Composite', hyderabad: 'Composite', pune: 'Composite',
  bangalore: 'Temperate', bengaluru: 'Temperate',
  shimla: 'Cold', srinagar: 'Cold', manali: 'Cold', gangtok: 'Cold',
};

export function getClimateZone(location: string): ClimateZone {
  const key = (location || '').toLowerCase();
  for (const k of Object.keys(CITY_CLIMATE)) {
    if (key.includes(k)) return CITY_CLIMATE[k];
  }
  return 'Composite';
}

const SIDE_TO_DIR: Record<string, 'N' | 'S' | 'E' | 'W'> = {
  front: 'N', back: 'S', left: 'W', right: 'E',
};

export interface RoomSolar {
  room: string;
  type: string;
  exposures: string[];        // e.g. ['East (morning sun)', 'North (soft light)']
  daylight: 'excellent' | 'good' | 'fair' | 'poor';
  ventilation: 'cross' | 'single' | 'none';
  heatRisk: 'low' | 'medium' | 'high';
}

export interface SunVentReport {
  climate: ClimateZone;
  daylightScore: number;       // 0–100
  ventilationScore: number;    // 0–100
  rooms: RoomSolar[];
  recommendations: string[];
}

const DIR_LABEL: Record<string, string> = {
  N: 'North (soft diffuse light)',
  S: 'South (strong midday sun)',
  E: 'East (gentle morning sun)',
  W: 'West (harsh afternoon heat)',
};

export function analyzeSunVent(rooms: RoomLayout[], location: string): SunVentReport {
  const climate = getClimateZone(location);
  const ground = rooms.filter(r => r.floor === 0 && r.type !== 'parking' && r.type !== 'garden');
  const list: RoomSolar[] = [];
  let daySum = 0, ventSum = 0, n = 0;

  for (const r of ground) {
    const dirs = new Set<'N' | 'S' | 'E' | 'W'>();
    r.windows.forEach(w => dirs.add(SIDE_TO_DIR[w.side]));
    const openingSides = new Set<string>();
    r.windows.forEach(w => openingSides.add(w.side));
    r.doors.forEach(d => openingSides.add(d.side));

    const exposures = [...dirs].map(d => DIR_LABEL[d]);

    // Daylight rating
    let daylight: RoomSolar['daylight'];
    const winCount = r.windows.length;
    if (winCount === 0) daylight = 'poor';
    else if (dirs.has('N') || dirs.has('E')) daylight = winCount >= 2 ? 'excellent' : 'good';
    else daylight = 'fair';

    // Cross-ventilation: openings on opposite (front/back or left/right) or 2+ different sides
    const sides = [...openingSides];
    const hasOpposite =
      (openingSides.has('front') && openingSides.has('back')) ||
      (openingSides.has('left') && openingSides.has('right'));
    let ventilation: RoomSolar['ventilation'];
    if (hasOpposite || sides.length >= 3) ventilation = 'cross';
    else if (sides.length >= 1) ventilation = 'single';
    else ventilation = 'none';

    // Heat risk — West exposure is worst in hot climates
    let heatRisk: RoomSolar['heatRisk'] = 'low';
    if (dirs.has('W')) heatRisk = (climate === 'Hot & Dry' || climate === 'Composite' || climate === 'Warm & Humid') ? 'high' : 'medium';
    else if (dirs.has('S') && (climate === 'Hot & Dry' || climate === 'Composite')) heatRisk = 'medium';

    list.push({ room: r.name, type: r.type, exposures, daylight, ventilation, heatRisk });

    daySum += daylight === 'excellent' ? 100 : daylight === 'good' ? 80 : daylight === 'fair' ? 55 : 25;
    ventSum += ventilation === 'cross' ? 100 : ventilation === 'single' ? 55 : 15;
    n++;
  }

  const daylightScore = n ? Math.round(daySum / n) : 0;
  const ventilationScore = n ? Math.round(ventSum / n) : 0;

  // Climate-specific recommendations
  const recs: string[] = [];
  const westHeat = list.filter(r => r.heatRisk === 'high').map(r => r.room);
  if (westHeat.length) {
    recs.push(`West-facing heat gain in ${westHeat.slice(0, 3).join(', ')} — add deep shading/chajja, pergolas or trees, and minimise West glazing.`);
  }
  const noVent = list.filter(r => r.ventilation !== 'cross').map(r => r.room);
  if (noVent.length) {
    recs.push(`Improve cross-ventilation in ${noVent.slice(0, 3).join(', ')} by adding an opening on the opposite wall (stack/cross airflow).`);
  }
  switch (climate) {
    case 'Hot & Dry':
      recs.push('Hot & Dry zone: use thick walls/insulation, small West & South windows, courtyards, and light-coloured roofs to cut heat gain.');
      break;
    case 'Warm & Humid':
      recs.push('Warm & Humid zone: maximise cross-ventilation, large shaded openings, raised floors and wide overhangs for the monsoon.');
      break;
    case 'Composite':
      recs.push('Composite zone: balance — shade West/South in summer, allow South sun in winter, prioritise North-East daylight.');
      break;
    case 'Temperate':
      recs.push('Temperate zone (e.g. Bengaluru): comfortable year-round — generous North/East glazing for even daylight works well.');
      break;
    case 'Cold':
      recs.push('Cold zone: maximise South-facing glazing for winter solar gain, insulate heavily, and minimise North openings.');
      break;
  }
  recs.push('Place living/bedrooms on the North & East for soft morning light; keep utilities (toilets, stores, stairs) on the hot West & South.');

  return { climate, daylightScore, ventilationScore, rooms: list, recommendations: recs };
}
