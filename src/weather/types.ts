export interface WeatherPlace {
  id?: number;
  name: string;
  admin1?: string;
  country?: string;
  latitude: number;
  longitude: number;
  timezone?: string;
}

export interface HourPoint {
  /** Czas lokalny miejsca, „RRRR-MM-DDTHH:MM”. */
  time: string;
  temp: number;
  precipProb: number | null;
  code: number;
}

export interface DayPoint {
  date: string;
  min: number;
  max: number;
  sunrise: string | null;
  sunset: string | null;
  precipProbMax: number | null;
  code: number;
}

export interface Forecast {
  current: {
    time: string;
    temp: number;
    feels: number;
    code: number;
    wind: number;
    isDay: boolean;
    precipitation: number;
  };
  hourly: HourPoint[];
  daily: DayPoint[];
  timezone: string;
}
