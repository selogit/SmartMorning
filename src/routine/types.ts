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
  /** Rozmiar na planszy (brak = średni). Kolejność kroków = kolejność kafelków w planie. */
  size?: TileSize;
  /** Planowana godzina rozpoczęcia „HH:MM” (opcjonalna). */
  time?: string;
  /** Minutnik kroku w minutach (opcjonalny) — wyznacza też godziny kolejnych kroków. */
  durationMin?: number;
  /** Po końcu minutnika przejdź sam do następnego kroku. */
  timerAutoNext?: boolean;
  /** Tylko Przed wyjściem — rzeczy do odhaczenia. */
  checklist?: string[];
  /** Tylko Przed wyjściem — dopisuj rzeczy wg prognozy (parasol, czapka). Brak = włączone. */
  weatherHints?: boolean;
  /** Link dla kafelków aplikacji (nadpisuje domyślny). */
  url?: string;
  /** Tylko Notatnik — patrz NoteMode (domyślnie 'today'). */
  noteMode?: NoteMode;
  /** Tylko Notatnik w trybie 'pick'. */
  noteId?: string;
  /** Tylko Budzik — alarm, którym steruje kafelek (godzina i nazwa kafelka są z nim synchronizowane). */
  alarmId?: string;
  /** Tylko Muzyka — zapisana playlista (brak = domyślna ★). */
  musicId?: string;
  /** Tylko Muzyka — otwórz playlistę od razu po wejściu w krok. */
  autoOpen?: boolean;
}

export interface Routine {
  id: string;
  /** Np. „Dni robocze”, „Weekend”. */
  name: string;
  /** Dni tygodnia, w które obowiązuje plan (0 = nd … 6 = sb). Dzień należy do co najwyżej jednego planu. */
  days: number[];
  /** Kafelki w kolejności wykonania. */
  tiles: RoutineTile[];
  /** Po wyłączeniu budzika plan startuje sam (jeśli zaczyna się od budzika). */
  startAfterAlarm: boolean;
}
