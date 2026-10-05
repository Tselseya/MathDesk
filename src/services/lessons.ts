import { currentUserId, supabase } from './supabase';
import { newId } from '../lib/ids';
import { MAX_LESSON_CHARS, MAX_LESSON_TITLE_CHARS } from '../lib/limits';
import { ANON_SCOPE, lessonsKey, type Scope } from '../lib/localScope';

export interface SavedLesson {
  id?: string;
  title: string;
  content: string;
  source_type: 'text' | 'file' | 'image' | 'chat';
  created_at?: string;
  updated_at?: string;
  synced?: boolean;
}

function readLocal(scope: Scope): SavedLesson[] {
  try {
    const value = JSON.parse(localStorage.getItem(lessonsKey(scope)) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function writeLocal(scope: Scope, lessons: SavedLesson[]) {
  try {
    localStorage.setItem(lessonsKey(scope), JSON.stringify(lessons));
  } catch {
    /* Local storage is optional. */
  }
}

export function loadLocalLessons(scope: Scope = ANON_SCOPE) {
  return readLocal(scope);
}

export function saveLocalLesson(scope: Scope, lesson: SavedLesson) {
  const saved: SavedLesson = {
    ...lesson,
    id: lesson.id ?? newId(),
    title: lesson.title.slice(0, MAX_LESSON_TITLE_CHARS),
    content: lesson.content.slice(0, MAX_LESSON_CHARS),
    updated_at: new Date().toISOString(),
    synced: false,
  };
  writeLocal(scope, [saved, ...readLocal(scope).filter((item) => item.id !== saved.id)]);
  return saved;
}

export function deleteLocalLesson(scope: Scope, id: string) {
  writeLocal(scope, readLocal(scope).filter((lesson) => lesson.id !== id));
}

async function requireUser(expectedUserId: string) {
  const userId = await currentUserId();
  return supabase && userId && userId === expectedUserId ? userId : null;
}

export async function loadCloudLessons(expectedUserId: string): Promise<SavedLesson[]> {
  const userId = await requireUser(expectedUserId);
  if (!supabase || !userId) return [];
  const { data, error } = await supabase
    .from('saved_lessons')
    .select('id,title,content,source_type,created_at,updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as SavedLesson[];
}

export async function saveCloudLesson(expectedUserId: string, lesson: SavedLesson) {
  const userId = await requireUser(expectedUserId);
  if (!supabase || !userId) return null;
  const { data, error } = await supabase
    .from('saved_lessons')
    .upsert(
      {
        id: lesson.id ?? newId(),
        user_id: userId,
        title: lesson.title.slice(0, MAX_LESSON_TITLE_CHARS),
        content: lesson.content.slice(0, MAX_LESSON_CHARS),
        source_type: lesson.source_type,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    )
    .select('id,title,content,source_type,created_at,updated_at')
    .single();
  if (error) throw error;
  return data as SavedLesson;
}

export async function deleteCloudLesson(expectedUserId: string, id: string) {
  const userId = await requireUser(expectedUserId);
  if (!supabase || !userId) return;
  const { error } = await supabase.from('saved_lessons').delete().eq('id', id).eq('user_id', userId);
  if (error) throw error;
}

/**
 * Anonymous: just returns the device lessons.
 * Signed in: uploads only lessons created while signed in as THIS account and not yet synced, then treats the cloud as the
 * source of truth. Lessons saved while signed out are never uploaded into an account automatically.
 */
export async function syncLessons(userId: string | null): Promise<SavedLesson[]> {
  if (!userId || !supabase) return loadLocalLessons(ANON_SCOPE);
  const pending = loadLocalLessons(userId).filter((lesson) => !lesson.synced);
  for (const lesson of pending) await saveCloudLesson(userId, lesson);
  const cloud = (await loadCloudLessons(userId)).map((lesson) => ({ ...lesson, synced: true }));
  writeLocal(userId, cloud);
  return cloud;
}
