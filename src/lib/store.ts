import type { Project } from '@/types';
import { supabase } from './supabase';

// ============================================================================
//  AUTH  (backed by Supabase Auth)
// ============================================================================

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

function mapUser(u: { id: string; email?: string | null; created_at?: string; user_metadata?: Record<string, unknown> } | null): AuthUser | null {
  if (!u) return null;
  const meta = u.user_metadata || {};
  return {
    id: u.id,
    email: u.email || '',
    name: (meta.full_name as string) || (meta.name as string) || (u.email ? u.email.split('@')[0] : 'User'),
    createdAt: u.created_at || new Date().toISOString(),
  };
}

export async function signUp(name: string, email: string, password: string): Promise<{ ok: boolean; error?: string; needsConfirmation?: boolean }> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: name, name } },
  });
  if (error) return { ok: false, error: error.message };
  // If email confirmation is enabled, no session is returned yet.
  if (data.user && !data.session) {
    return { ok: true, needsConfirmation: true };
  }
  return { ok: true };
}

export async function signIn(email: string, password: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const { data } = await supabase.auth.getUser();
  return mapUser(data.user as Parameters<typeof mapUser>[0]);
}

/** Sends a password-reset email with a link back to /reset-password. */
export async function verifyEmailOtp(email: string, token: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.auth.verifyOtp({ email, token, type: 'signup' });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function sendPasswordReset(email: string): Promise<{ ok: boolean; error?: string }> {
  const redirectTo =
    typeof window !== 'undefined' ? `${window.location.origin}/reset-password` : undefined;
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Updates the password for the currently-authenticated (recovery) session. */
export async function updatePassword(newPassword: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ============================================================================
//  PROJECTS  (backed by the public.projects table, protected by RLS)
// ============================================================================

interface ProjectRow {
  id: string;
  user_id: string;
  name: string;
  status: string | null;
  data: Project;
  created_at: string;
  updated_at: string;
}

export async function getProjects(): Promise<Project[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('data')
    .order('created_at', { ascending: false });
  if (error) {
    console.error('getProjects error:', error.message);
    return [];
  }
  return (data || []).map((row: { data: Project }) => row.data);
}

export async function getProject(id: string): Promise<Project | null> {
  const { data, error } = await supabase
    .from('projects')
    .select('data')
    .eq('id', id)
    .maybeSingle();
  if (error) {
    console.error('getProject error:', error.message);
    return null;
  }
  return (data as { data: Project } | null)?.data ?? null;
}

export async function saveProject(project: Project): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) {
    console.error('saveProject: no authenticated user');
    return;
  }
  const row: Partial<ProjectRow> = {
    id: project.id,
    user_id: userId,
    name: project.name,
    status: project.status,
    data: project,
  };
  const { error } = await supabase.from('projects').upsert(row, { onConflict: 'id' });
  if (error) console.error('saveProject error:', error.message);
}

export async function deleteProject(id: string): Promise<void> {
  const { error } = await supabase.from('projects').delete().eq('id', id);
  if (error) console.error('deleteProject error:', error.message);
}

export function generateId(): string {
  return `proj_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

// ============================================================================
//  SITE VISITS  (public.project_visits — one JSONB row per project, RLS-protected)
// ============================================================================
export async function getProjectVisits<T = unknown>(projectId: string): Promise<T[]> {
  const { data, error } = await supabase
    .from('project_visits')
    .select('data')
    .eq('project_id', projectId)
    .maybeSingle();
  if (error) { console.error('getProjectVisits:', error.message); throw error; }
  return ((data as { data: T[] } | null)?.data ?? []);
}

export async function saveProjectVisits<T = unknown>(projectId: string, visits: T[]): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error('not authenticated');
  const { error } = await supabase
    .from('project_visits')
    .upsert({ project_id: projectId, user_id: userId, data: visits, updated_at: new Date().toISOString() }, { onConflict: 'project_id,user_id' });
  if (error) { console.error('saveProjectVisits:', error.message); throw error; }
}
