// ============================================================================
//  ARCHITECTURAL RULE ENGINE
//  Configurable, extensible room rules (areas, widths, ventilation, zoning).
//  Values follow common Indian residential practice + NBC minimums.
//  Override via setRoomRule() to extend without touching the engine.
// ============================================================================
import type { RoomRule, RoomType } from './types';
import { ARCHITECTURAL_STANDARDS } from './architecturalStandards';

const std = ARCHITECTURAL_STANDARDS.rooms;

const DEFAULT_RULES: Record<string, RoomRule> = {
  living:    { type: 'living',    label: 'Living Room',  minArea: std.living_room.minArea, maxArea: std.living_room.maxArea, minWidth: std.living_room.minWidth, preferredAspect: 1.3, needsExterior: std.living_room.requiresExternalWall,  needsVentilation: std.living_room.minWindowAreaFraction > 0,  zone: 'public',       privacyLevel: 0.1 },
  dining:    { type: 'dining',    label: 'Dining',       minArea: std.dining_room.minArea, maxArea: std.dining_room.maxArea, minWidth: std.dining_room.minWidth, preferredAspect: 1.2, needsExterior: std.dining_room.requiresExternalWall, needsVentilation: std.dining_room.minWindowAreaFraction > 0,  zone: 'public',       privacyLevel: 0.2 },
  kitchen:   { type: 'kitchen',   label: 'Kitchen',      minArea: std.kitchen.minArea, maxArea: std.kitchen.maxArea, minWidth: std.kitchen.minWidth, preferredAspect: 1.4, needsExterior: std.kitchen.requiresExternalWall,  needsVentilation: std.kitchen.minWindowAreaFraction > 0,  zone: 'service',      privacyLevel: 0.3 },
  bedroom:   { type: 'bedroom',   label: 'Bedroom',      minArea: std.guest_bedroom.minArea, maxArea: std.guest_bedroom.maxArea, minWidth: std.guest_bedroom.minWidth, preferredAspect: 1.2, needsExterior: std.guest_bedroom.requiresExternalWall,  needsVentilation: std.guest_bedroom.minWindowAreaFraction > 0,  zone: 'private',      privacyLevel: 0.9 },
  toilet:    { type: 'toilet',    label: 'Bathroom',     minArea: std.common_bathroom.minArea,  maxArea: std.common_bathroom.maxArea,  minWidth: std.common_bathroom.minWidth,  preferredAspect: 1.4, needsExterior: std.common_bathroom.requiresExternalWall,  needsVentilation: std.common_bathroom.minWindowAreaFraction > 0,  zone: 'utility',      privacyLevel: 1.0 },
  lobby:     { type: 'lobby',     label: 'Lobby / Foyer',minArea: std.corridor.minArea,  maxArea: std.corridor.maxArea, minWidth: std.corridor.minWidth,  preferredAspect: 1.0, needsExterior: std.corridor.requiresExternalWall, needsVentilation: false, zone: 'circulation',  privacyLevel: 0.1 },
  corridor:  { type: 'corridor',  label: 'Corridor',     minArea: std.corridor.minArea,  maxArea: std.corridor.maxArea, minWidth: std.corridor.minWidth,  preferredAspect: 2.5, needsExterior: std.corridor.requiresExternalWall, needsVentilation: false, zone: 'circulation',  privacyLevel: 0.2 },
  staircase: { type: 'staircase', label: 'Staircase',    minArea: std.staircase.minArea,  maxArea: std.staircase.maxArea, minWidth: std.staircase.minWidth,preferredAspect: 2.0, needsExterior: std.staircase.requiresExternalWall, needsVentilation: false, zone: 'circulation',  privacyLevel: 0.2 },
  balcony:   { type: 'balcony',   label: 'Balcony',      minArea: std.balcony.minArea,  maxArea: std.balcony.maxArea, minWidth: std.balcony.minWidth,  preferredAspect: 2.0, needsExterior: std.balcony.requiresExternalWall,  needsVentilation: std.balcony.minWindowAreaFraction > 0,  zone: 'outdoor',      privacyLevel: 0.3 },
  parking:   { type: 'parking',   label: 'Parking',      minArea: std.parking_space.minArea, maxArea: std.parking_space.maxArea, minWidth: std.parking_space.minWidth,  preferredAspect: 1.0, needsExterior: std.parking_space.requiresExternalWall,  needsVentilation: false, zone: 'outdoor',      privacyLevel: 0.0 },
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
