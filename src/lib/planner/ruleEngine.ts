// ============================================================================
//  ARCHITECTURAL RULE ENGINE
//  Configurable, extensible room rules (areas, widths, ventilation, zoning).
//  Values follow common Indian residential practice + NBC minimums.
//  Override via setRoomRule() to extend without touching the engine.
// ============================================================================
import type { RoomRule, RoomType } from './types';

const DEFAULT_RULES: Record<string, RoomRule> = {
  living:    { type: 'living',    label: 'Living Room',  minArea: 250, maxArea: 420, minWidth: 12, preferredAspect: 1.3, needsExterior: true,  needsVentilation: true,  zone: 'public',       privacyLevel: 0.1 },
  dining:    { type: 'dining',    label: 'Dining',       minArea: 120, maxArea: 220, minWidth: 9,  preferredAspect: 1.2, needsExterior: false, needsVentilation: true,  zone: 'public',       privacyLevel: 0.2 },
  kitchen:   { type: 'kitchen',   label: 'Kitchen',      minArea: 100, maxArea: 200, minWidth: 8,  preferredAspect: 1.4, needsExterior: true,  needsVentilation: true,  zone: 'service',      privacyLevel: 0.3 },
  bedroom:   { type: 'bedroom',   label: 'Bedroom',      minArea: 120, maxArea: 250, minWidth: 10, preferredAspect: 1.2, needsExterior: true,  needsVentilation: true,  zone: 'private',      privacyLevel: 0.9 },
  toilet:    { type: 'toilet',    label: 'Bathroom',     minArea: 40,  maxArea: 90,  minWidth: 5,  preferredAspect: 1.4, needsExterior: true,  needsVentilation: true,  zone: 'utility',      privacyLevel: 1.0 },
  lobby:     { type: 'lobby',     label: 'Lobby / Foyer',minArea: 60,  maxArea: 160, minWidth: 6,  preferredAspect: 1.0, needsExterior: false, needsVentilation: false, zone: 'circulation',  privacyLevel: 0.1 },
  corridor:  { type: 'corridor',  label: 'Corridor',     minArea: 30,  maxArea: 120, minWidth: 3,  preferredAspect: 2.5, needsExterior: false, needsVentilation: false, zone: 'circulation',  privacyLevel: 0.2 },
  staircase: { type: 'staircase', label: 'Staircase',    minArea: 60,  maxArea: 120, minWidth: 3.5,preferredAspect: 2.0, needsExterior: false, needsVentilation: false, zone: 'circulation',  privacyLevel: 0.2 },
  balcony:   { type: 'balcony',   label: 'Balcony',      minArea: 40,  maxArea: 120, minWidth: 4,  preferredAspect: 2.0, needsExterior: true,  needsVentilation: true,  zone: 'outdoor',      privacyLevel: 0.3 },
  parking:   { type: 'parking',   label: 'Parking',      minArea: 140, maxArea: 260, minWidth: 9,  preferredAspect: 1.0, needsExterior: true,  needsVentilation: false, zone: 'outdoor',      privacyLevel: 0.0 },
  garden:    { type: 'garden',    label: 'Garden / Lawn',minArea: 80,  maxArea: 400, minWidth: 6,  preferredAspect: 1.5, needsExterior: true,  needsVentilation: false, zone: 'outdoor',      privacyLevel: 0.0 },
};

// In-memory configurable copy (extensible at runtime).
const RULES: Record<string, RoomRule> = JSON.parse(JSON.stringify(DEFAULT_RULES));

export function getRoomRule(type: RoomType): RoomRule {
  return RULES[type] || RULES.living;
}

export function getAllRoomRules(): RoomRule[] {
  return Object.values(RULES);
}

/** Extend or override a rule at runtime (e.g. per-region presets). */
export function setRoomRule(type: string, patch: Partial<RoomRule>): void {
  RULES[type] = { ...(RULES[type] || DEFAULT_RULES.living), ...patch, type: type as RoomType };
}

export function resetRoomRules(): void {
  Object.keys(RULES).forEach(k => delete RULES[k]);
  Object.assign(RULES, JSON.parse(JSON.stringify(DEFAULT_RULES)));
}

/** Clamp a desired area to the rule envelope. */
export function clampArea(type: RoomType, desired: number): number {
  const r = getRoomRule(type);
  return Math.max(r.minArea, Math.min(r.maxArea, desired));
}
