import { getCurrentUser, supabase } from './supabase';

export interface SavedLesson {
  id?: string;
  title: string;
  content: string;
  source_type: 'text' | 'file' | 'image' | 'chat';
  created_at?: string;
  updated_at?: string;
  synced?: boolean;
}

const LOCAL_KEY = 'mathdesk:saved-lessons';

function readLocal(): SavedLesson[] { try { const value = JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]'); return Array.isArray(value) ? value : []; } catch { return []; } }
function writeLocal(lessons: SavedLesson[]) { try { localStorage.setItem(LOCAL_KEY, JSON.stringify(lessons)); } catch { /* Local storage is optional. */ } }

export function loadLocalLessons() { return readLocal(); }
export function saveLocalLesson(lesson: SavedLesson) { const saved = { ...lesson, updated_at: new Date().toISOString(), synced: false }; const lessons = [saved, ...readLocal().filter((item) => item.id !== saved.id)]; writeLocal(lessons); return saved; }
export function deleteLocalLesson(id: string) { writeLocal(readLocal().filter((lesson) => lesson.id !== id)); }

export async function loadCloudLessons(): Promise<SavedLesson[]> {
  const user = await getCurrentUser(); if (!supabase || !user) return [];
  const { data, error } = await supabase.from('saved_lessons').select('id,title,content,source_type,created_at,updated_at').eq('user_id', user.id).order('updated_at', { ascending: false }).limit(100);
  if (error) throw error; return (data ?? []) as SavedLesson[];
}

export async function saveCloudLesson(lesson: SavedLesson) {
  const user = await getCurrentUser(); if (!supabase || !user) return null;
  const { data, error } = await supabase.from('saved_lessons').upsert({ id: lesson.id, user_id: user.id, title: lesson.title, content: lesson.content, source_type: lesson.source_type, updated_at: new Date().toISOString() }, { onConflict: 'id' }).select('id,title,content,source_type,created_at,updated_at').single();
  if (error) throw error; return data as SavedLesson;
}

export async function deleteCloudLesson(id: string) { const user = await getCurrentUser(); if (!supabase || !user) return; const { error } = await supabase.from('saved_lessons').delete().eq('id', id).eq('user_id', user.id); if (error) throw error; }

export async function syncLessons() {
  const user = await getCurrentUser(); if (!supabase || !user) return loadLocalLessons();
  const local = loadLocalLessons(); const cloud = await loadCloudLessons(); const merged = [...cloud];
  for (const lesson of local) { const saved = await saveCloudLesson(lesson); if (saved) merged.unshift({ ...saved, synced: true }); }
  const unique = Array.from(new Map(merged.map((lesson) => [lesson.id || `${lesson.title}:${lesson.updated_at}`, lesson])).values()).sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
  writeLocal(unique.map((lesson) => ({ ...lesson, synced: true }))); return unique;
}
