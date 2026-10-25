import { router } from 'expo-router';
import { Note, todayKey } from './NotesProvider';

const MONTHS = [
  'stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca',
  'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia',
];

/** Otwiera notatkę dnia, a jeśli jej nie ma — tworzy ją z nagłówkiem i pustą checklistą. */
export function openTodayNote(notes: Note[], createNote: (body?: string, dayKey?: string) => Note) {
  const now = new Date();
  const key = todayKey(now);
  const existing = notes.find(n => n.dayKey === key);
  if (existing) {
    router.push(`/notes/${existing.id}`);
    return;
  }
  const note = createNote(`# Plan na ${now.getDate()} ${MONTHS[now.getMonth()]}\n\n- [ ] `, key);
  router.push(`/notes/${note.id}?edit=1`);
}
