import type { TileKind } from './tileKinds';

/**
 * Co otwiera kafelek Notatnik w planie:
 * today = notatki ustawione na dziś + notatka dnia, pick = konkretna notatka, new = nowa pusta notatka.
 */
export type NoteMode = 'today' | 'pick' | 'new';

export interface RoutineTile {
  id: string;
  kind: TileKind;
  title: string;
  /** Pozycja na planszy znormalizowana do 0..1 — niezależna od rozmiaru ekranu. */
  x: number;
  y: number;
  /** Planowana godzina rozpoczęcia „HH:MM” (opcjonalna). */
  time?: string;
  /** Czas trwania w minutach (opcjonalny). */
  durationMin?: number;
  /** Link dla kafelków aplikacji (nadpisuje domyślny). */
  url?: string;
  /** Tylko Notatnik — patrz NoteMode (domyślnie 'today'). */
  noteMode?: NoteMode;
  /** Tylko Notatnik w trybie 'pick'. */
  noteId?: string;
}

export interface RoutineLink {
  from: string;
  to: string;
}

export interface Routine {
  tiles: RoutineTile[];
  links: RoutineLink[];
  /** Po wyłączeniu budzika plan startuje sam (jeśli zaczyna się od budzika). */
  startAfterAlarm: boolean;
}
