/** Kody pogody WMO (Open-Meteo) → opis po polsku i symbol. */
interface CodeInfo {
  label: string;
  icon: string;
  nightIcon?: string;
}

const CODES: Record<number, CodeInfo> = {
  0: { label: 'Bezchmurnie', icon: '☀️', nightIcon: '🌙' },
  1: { label: 'Przeważnie słonecznie', icon: '🌤️', nightIcon: '🌙' },
  2: { label: 'Częściowe zachmurzenie', icon: '⛅' },
  3: { label: 'Pochmurno', icon: '☁️' },
  45: { label: 'Mgła', icon: '🌫️' },
  48: { label: 'Mgła osadzająca szadź', icon: '🌫️' },
  51: { label: 'Słaba mżawka', icon: '🌦️' },
  53: { label: 'Mżawka', icon: '🌦️' },
  55: { label: 'Gęsta mżawka', icon: '🌧️' },
  56: { label: 'Marznąca mżawka', icon: '🌧️' },
  57: { label: 'Gęsta marznąca mżawka', icon: '🌧️' },
  61: { label: 'Słaby deszcz', icon: '🌦️' },
  63: { label: 'Deszcz', icon: '🌧️' },
  65: { label: 'Ulewa', icon: '🌧️' },
  66: { label: 'Marznący deszcz', icon: '🌧️' },
  67: { label: 'Silny marznący deszcz', icon: '🌧️' },
  71: { label: 'Słaby śnieg', icon: '🌨️' },
  73: { label: 'Śnieg', icon: '❄️' },
  75: { label: 'Intensywny śnieg', icon: '❄️' },
  77: { label: 'Ziarna śniegu', icon: '🌨️' },
  80: { label: 'Przelotny deszcz', icon: '🌦️' },
  81: { label: 'Przelotne opady deszczu', icon: '🌧️' },
  82: { label: 'Gwałtowne ulewy', icon: '⛈️' },
  85: { label: 'Przelotny śnieg', icon: '🌨️' },
  86: { label: 'Intensywny przelotny śnieg', icon: '❄️' },
  95: { label: 'Burza', icon: '⛈️' },
  96: { label: 'Burza z gradem', icon: '⛈️' },
  99: { label: 'Silna burza z gradem', icon: '⛈️' },
};

export const codeInfo = (code: number, isDay = true) => {
  const info = CODES[code] ?? { label: 'Brak danych', icon: '·' };
  return { label: info.label, icon: !isDay && info.nightIcon ? info.nightIcon : info.icon };
};

export const isSnow = (code: number) => [71, 73, 75, 77, 85, 86].includes(code);
export const isStorm = (code: number) => code >= 95;
export const isFreezing = (code: number) => [56, 57, 66, 67].includes(code);
