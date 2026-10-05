import { useEffect, useState } from 'react';
import { BookOpen, Cloud, FileText, Plus, Trash2, X } from 'lucide-react';
import { useDialogA11y } from '../hooks/useDialogA11y';
import { MAX_LESSON_CHARS, MAX_LESSON_TITLE_CHARS } from '../lib/limits';
import { scopeOf } from '../lib/localScope';
import { deleteCloudLesson, deleteLocalLesson, loadLocalLessons, saveCloudLesson, saveLocalLesson, syncLessons, type SavedLesson } from '../services/lessons';

interface LessonLibraryProps {
  onClose: () => void;
  initialContent?: string;
  /** Signed-in user id, or null for anonymous use. Lessons are stored separately per account. */
  userId: string | null;
}

export default function LessonLibrary({ onClose, initialContent = '', userId }: LessonLibraryProps) {
  const scope = scopeOf(userId);
  const [lessons, setLessons] = useState<SavedLesson[]>([]);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState(initialContent);
  const [notice, setNotice] = useState('');
  const dialogRef = useDialogA11y<HTMLElement>(onClose);

  useEffect(() => {
    let active = true;
    setLessons(loadLocalLessons(scope));
    syncLessons(userId)
      .then((synced) => { if (active) setLessons(synced); })
      .catch(() => { if (active) setNotice('Cloud sync is unavailable. Your lessons remain safe on this device.'); });
    return () => { active = false; };
  }, [scope, userId]);

  async function save() {
    if (!title.trim() || !content.trim()) { setNotice('Add a title and lesson content first.'); return; }
    const lesson = saveLocalLesson(scope, { title: title.trim(), content: content.trim(), source_type: 'text' });
    setLessons((current) => [lesson, ...current.filter((item) => item.id !== lesson.id)]);
    setTitle('');
    setContent('');
    if (!userId) { setNotice('Saved on this device. Log in to keep lessons across devices.'); return; }
    try {
      const cloud = await saveCloudLesson(userId, lesson);
      if (cloud) {
        saveLocalLesson(scope, { ...cloud, synced: true });
        setLessons(await syncLessons(userId));
        setNotice('Saved to your account.');
      }
    } catch {
      setNotice('Saved on this device. It will sync when your connection is available.');
    }
  }

  async function remove(lesson: SavedLesson) {
    if (lesson.id) deleteLocalLesson(scope, lesson.id);
    setLessons((current) => current.filter((item) => item !== lesson));
    if (userId && lesson.id) {
      try { await deleteCloudLesson(userId, lesson.id); } catch { setNotice('Could not delete the cloud copy yet. It may reappear after the next sync.'); }
    }
  }

  return (
    <div className="tool-modal-overlay">
      <section ref={dialogRef} tabIndex={-1} className="lessons-card" role="dialog" aria-modal="true" aria-labelledby="lessons-title">
        <header className="tool-modal-header">
          <div><span className="eyebrow"><BookOpen size={14} /> Your learning library</span><h2 id="lessons-title">Saved lessons</h2></div>
          <button className="tool-close" onClick={onClose} aria-label="Close saved lessons"><X size={18} /></button>
        </header>
        <div className="lesson-form">
          <input value={title} maxLength={MAX_LESSON_TITLE_CHARS} onChange={(event) => setTitle(event.target.value)} placeholder="Lesson title" />
          <textarea value={content} maxLength={MAX_LESSON_CHARS} onChange={(event) => setContent(event.target.value)} placeholder="Paste lesson text, notes, or a solved explanation…" rows={4} />
          <button className="primary-tool-button" onClick={() => void save()}><Plus size={15} /> Save lesson</button>
        </div>
        {notice && <p className="lesson-notice" role="status"><Cloud size={14} /> {notice}</p>}
        <div className="lesson-list">
          {lessons.length === 0 && <p className="empty-tools">No saved lessons yet. Save notes here to use them across your study sessions.</p>}
          {lessons.map((lesson, index) => (
            <article className="lesson-item" key={lesson.id || `${lesson.title}-${index}`}>
              <FileText size={18} />
              <div>
                <strong>{lesson.title}</strong>
                <p>{lesson.content.slice(0, 120)}{lesson.content.length > 120 ? '…' : ''}</p>
                <small>{lesson.synced ? 'Synced to your account' : 'Saved on this device'}</small>
              </div>
              <button onClick={() => void remove(lesson)} aria-label={`Delete ${lesson.title}`}><Trash2 size={15} /></button>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
