import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Note {
  id: string;
  body: string;
  createdAt: number;
  updatedAt: number;
  /** „RRRR-MM-DD” dla notatki dnia. */
  dayKey?: string;
  /** „RRRR-MM-DD” — w tym dniu notatka pojawi się na stronie głównej i w planie. */
  showOn?: string;
}

interface NotesContextValue {
  notes: Note[];
  loaded: boolean;
  createNote: (body?: string, dayKey?: string) => Note;
  updateNote: (id: string, body: string) => void;
  deleteNote: (id: string) => void;
  setShowOn: (id: string, day: string | undefined) => void;
}

const KEY = 'notes';
const NotesContext = createContext<NotesContextValue | null>(null);

export function useNotes() {
  const ctx = useContext(NotesContext);
  if (!ctx) throw new Error('useNotes musi być użyte wewnątrz <NotesProvider>');
  return ctx;
}

export const todayKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const addDaysKey = (days: number, from = new Date()) => {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return todayKey(d);
};

const SHORT_WEEKDAYS = ['nd', 'pn', 'wt', 'śr', 'czw', 'pt', 'sb'];

export const keyToDate = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};

/** „dziś”, „jutro”, „wczoraj” albo „pn 27.10”. */
export function dayLabel(key: string) {
  if (key === todayKey()) return 'dziś';
  if (key === addDaysKey(1)) return 'jutro';
  if (key === addDaysKey(-1)) return 'wczoraj';
  const d = keyToDate(key);
  return `${SHORT_WEEKDAYS[d.getDay()]} ${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Notatki na dany dzień: ustawione do pokazania + notatka dnia. Najpierw ustawione. */
export const notesForDay = (notes: Note[], key: string) =>
  notes
    .filter(n => n.showOn === key || n.dayKey === key)
    .sort((a, b) => Number(b.showOn === key) - Number(a.showOn === key) || b.updatedAt - a.updatedAt);

const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function NotesProvider({ children }: { children: React.ReactNode }) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loaded, setLoaded] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then(raw => {
        if (raw) setNotes(JSON.parse(raw));
      })
      .catch(e => console.warn('Nie udało się wczytać notatek', e))
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    if (!loaded) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      AsyncStorage.setItem(KEY, JSON.stringify(notes)).catch(e => console.warn('Nie udało się zapisać notatek', e));
    }, 400);
  }, [notes, loaded]);

  const createNote = (body = '', dayKey?: string): Note => {
    const now = Date.now();
    const note: Note = { id: newId(), body, createdAt: now, updatedAt: now, dayKey };
    setNotes(prev => [note, ...prev]);
    return note;
  };

  const updateNote = (id: string, body: string) =>
    setNotes(prev => prev.map(n => (n.id === id && n.body !== body ? { ...n, body, updatedAt: Date.now() } : n)));

  const deleteNote = (id: string) => setNotes(prev => prev.filter(n => n.id !== id));

  const setShowOn = (id: string, day: string | undefined) =>
    setNotes(prev => prev.map(n => (n.id === id ? { ...n, showOn: day } : n)));

  return (
    <NotesContext.Provider value={{ notes, loaded, createNote, updateNote, deleteNote, setShowOn }}>
      {children}
    </NotesContext.Provider>
  );
}
