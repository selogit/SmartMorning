import type { TileKind } from './tileKinds';

/**
 * Co otwiera kafelek Notatnik w planie:
 * today = notatki ustawione na dziś + notatka dnia, pick = konkretna notatka, new = nowa pusta notatka.
 */
export type NoteMode = 'today' | 'pick' | 'new';

/** Rozmiar kafelka na planszy (siatka 4 kolumn): mały 1×1, średni 2×2, duży 4×2. */
export type TileSize = 'small' | 'medium' | 'large';

export interface RoutineTile {
  id: string;
  kind: TileKind;
  title: string;
  /** Brak = średni. */
  size?: TileSize;
  /** „HH:MM”. */
  time?: string;
  /** Minutnik kroku w minutach (opcjonalny) — wyznacza też godziny kolejnych kroków. */
  durationMin?: number;
  timerAutoNext?: boolean;
  /** Tylko Przed wyjściem. */
  checklist?: string[];
  /** Tylko Przed wyjściem; brak = włączone. */
  weatherHints?: boolean;
  /** Link dla kafelków aplikacji (nadpisuje domyślny). */
  url?: string;
  /** Tylko Notatnik — patrz NoteMode (domyślnie 'today'). */
  noteMode?: NoteMode;
  /** Tylko Notatnik w trybie 'pick'. */
  noteId?: string;
  /** Tylko Budzik — połączony alarm (godzina i nazwa są synchronizowane). */
  alarmId?: string;
  /** Tylko Muzyka — zapisana playlista (brak = domyślna ★). */
  musicId?: string;
  /** Tylko Muzyka — otwórz playlistę od razu po wejściu w krok. */
  autoOpen?: boolean;
}

export interface Routine {
  id: string;
  name: string;
  /** 0 = nd … 6 = sb; dzień należy do co najwyżej jednego planu. */
  days: number[];
  tiles: RoutineTile[];
  /** Po wyłączeniu budzika plan startuje sam (jeśli zaczyna się od budzika). */
  startAfterAlarm: boolean;
}
