import type { Project } from '@/types';

const STORAGE_KEY = 'archcopilot_projects';
const AUTH_KEY = 'archcopilot_auth';
const USERS_KEY = 'archcopilot_users';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

interface StoredUser extends AuthUser {
  passwordHash: string;
}

function hashPassword(pw: string): string {
  // Simple deterministic hash (client-side only, not for production secrets)
  let h = 0;
  for (let i = 0; i < pw.length; i++) { h = (Math.imul(31, h) + pw.charCodeAt(i)) | 0; }
  return h.toString(16);
}

function getStoredUsers(): StoredUser[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(USERS_KEY) || '[]'); } catch { return []; }
}

export function signUp(name: string, email: string, password: string): { ok: boolean; error?: string } {
  const users = getStoredUsers();
  if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) return { ok: false, error: 'Email already registered' };
  const user: StoredUser = { id: `usr_${Date.now()}`, name, email: email.toLowerCase(), passwordHash: hashPassword(password), createdAt: new Date().toISOString() };
  localStorage.setItem(USERS_KEY, JSON.stringify([...users, user]));
  const { passwordHash: _, ...authUser } = user;
  localStorage.setItem(AUTH_KEY, JSON.stringify(authUser));
  return { ok: true };
}

export function signIn(email: string, password: string): { ok: boolean; error?: string } {
  const users = getStoredUsers();
  const user = users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.passwordHash === hashPassword(password));
  if (!user) return { ok: false, error: 'Invalid email or password' };
  const { passwordHash: _, ...authUser } = user;
  localStorage.setItem(AUTH_KEY, JSON.stringify(authUser));
  return { ok: true };
}

export function signOut(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(AUTH_KEY);
}

export function getCurrentUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  try { return JSON.parse(localStorage.getItem(AUTH_KEY) || 'null'); } catch { return null; }
}

export function resetPassword(email: string, newPassword: string): { ok: boolean; error?: string } {
  const users = getStoredUsers();
  const idx = users.findIndex(u => u.email.toLowerCase() === email.toLowerCase());
  if (idx < 0) return { ok: false, error: 'No account found with that email' };
  users[idx].passwordHash = hashPassword(newPassword);
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
  return { ok: true };
}

export function getProjects(): Project[] {
  if (typeof window === 'undefined') return [];
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveProject(project: Project): void {
  if (typeof window === 'undefined') return;
  const projects = getProjects();
  const idx = projects.findIndex(p => p.id === project.id);
  if (idx >= 0) {
    projects[idx] = project;
  } else {
    projects.unshift(project);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
}

export function getProject(id: string): Project | null {
  return getProjects().find(p => p.id === id) ?? null;
}

export function deleteProject(id: string): void {
  if (typeof window === 'undefined') return;
  const projects = getProjects().filter(p => p.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
}

export function generateId(): string {
  return `proj_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}
