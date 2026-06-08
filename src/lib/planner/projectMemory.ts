// ============================================================================
//  PROJECT MEMORY
//  A serialisable record of everything the planner needs to remember between
//  sessions/revisions: plot, requirements, preferences, revisions, approvals.
//  Persisted by the caller inside the Project object (project.planMemory).
// ============================================================================
import type { ParsedRequirements, LayoutCandidate } from './types';

export interface Revision {
  id: string;
  at: string;                  // ISO timestamp
  summary: string;             // human description of the change
  intent: string;             // raw user instruction
  optionId?: string;           // which option it applied to
  lockedRoomIds: string[];
}

export interface ProjectMemory {
  version: 1;
  requirements: ParsedRequirements;
  preferences: {
    favouriteStrategyIds: string[];
    lockedRoomIds: string[];   // rooms the architect has locked
  };
  revisions: Revision[];
  approvedOptionId?: string;   // architect-approved layout
  approvedCandidate?: LayoutCandidate;
}

export function createMemory(requirements: ParsedRequirements): ProjectMemory {
  return {
    version: 1,
    requirements,
    preferences: { favouriteStrategyIds: [], lockedRoomIds: [] },
    revisions: [],
  };
}

export function recordRevision(mem: ProjectMemory, rev: Omit<Revision, 'id' | 'at'>): ProjectMemory {
  return {
    ...mem,
    revisions: [
      { ...rev, id: `rev_${Date.now()}`, at: new Date().toISOString() },
      ...mem.revisions,
    ].slice(0, 50),
  };
}

export function lockRoom(mem: ProjectMemory, roomId: string): ProjectMemory {
  if (mem.preferences.lockedRoomIds.includes(roomId)) return mem;
  return { ...mem, preferences: { ...mem.preferences, lockedRoomIds: [...mem.preferences.lockedRoomIds, roomId] } };
}

export function unlockRoom(mem: ProjectMemory, roomId: string): ProjectMemory {
  return { ...mem, preferences: { ...mem.preferences, lockedRoomIds: mem.preferences.lockedRoomIds.filter(id => id !== roomId) } };
}

export function approveLayout(mem: ProjectMemory, candidate: LayoutCandidate, optionId: string): ProjectMemory {
  return { ...mem, approvedOptionId: optionId, approvedCandidate: candidate };
}
