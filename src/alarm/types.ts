import type { ChallengeConfig } from '../challenges/challenges';

export interface Alarm {
  id: string;
  time: string;
  enabled: boolean;
  label: string;
  /** Zadania wymagane przed wyłączeniem alarmu (brak = stare alarmy, bez zadań). */
  challenge?: ChallengeConfig;
}

export interface AlarmDraft {
  time: string;
  label: string;
  challenge: ChallengeConfig;
}
