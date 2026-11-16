import type { ChallengeConfig } from '../challenges/challenges';

export interface Alarm {
  id: string;
  time: string;
  enabled: boolean;
  label: string;
  /** Brak = stary alarm bez zadań. */
  challenge?: ChallengeConfig;
  /** Dni tygodnia (0 = nd … 6 = sb). Brak = codziennie, [] = jednorazowo. */
  days?: number[];
}

export interface AlarmDraft {
  time: string;
  label: string;
  challenge: ChallengeConfig;
  /** Dni tygodnia (0 = nd … 6 = sb); [] = jednorazowo. */
  days: number[];
}
