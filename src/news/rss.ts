export interface NewsItem {
  id: string;
  title: string;
  link: string;
  source: string;
  /** Czas publikacji (ms) albo null, gdy nie da się odczytać. */
  publishedAt: number | null;
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

export function decodeEntities(s: string) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, code: string) => {
    if (code[0] === '#') {
      const n = code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return ENTITIES[code.toLowerCase()] ?? m;
  });
}

const stripCdata = (s: string) => s.replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, '$1');

function tag(xml: string, name: string) {
  const m = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i').exec(xml);
  return m ? decodeEntities(stripCdata(m[1])).trim() : '';
}

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

/** Data w formacie RSS (RFC 822), np. „Thu, 05 Nov 2026 20:13:00 GMT” lub „+0100”. */
export function parseRssDate(s: string): number | null {
  const m = /(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(GMT|UTC|Z|[+-]\d{4})?/.exec(s);
  if (!m) return null;
  const month = MONTHS[m[2].toLowerCase()];
  if (month === undefined) return null;
  let ts = Date.UTC(+m[3], month, +m[1], +m[4], +m[5], m[6] ? +m[6] : 0);
  const tz = m[7];
  if (tz && /^[+-]\d{4}$/.test(tz)) {
    const sign = tz[0] === '+' ? 1 : -1;
    ts -= sign * (+tz.slice(1, 3) * 60 + +tz.slice(3, 5)) * 60000;
  }
  return ts;
}

/** Prosty parser RSS 2.0 (bez zależności) — wystarcza dla Google News i typowych kanałów redakcji. */
export function parseRss(xml: string): NewsItem[] {
  const items: NewsItem[] = [];
  const re = /<item[\s>][\s\S]*?<\/item>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const block = m[0];
    let title = tag(block, 'title');
    const link = tag(block, 'link');
    const guid = tag(block, 'guid');
    let source = tag(block, 'source');
    // Google News: tytuł kończy się „ - Źródło”.
    if (source && title.endsWith(` - ${source}`)) title = title.slice(0, -(source.length + 3));
    else if (!source) {
      const dash = title.lastIndexOf(' - ');
      if (dash > 20) {
        source = title.slice(dash + 3);
        title = title.slice(0, dash);
      }
    }
    if (!title || !link) continue;
    items.push({
      id: guid || link,
      title,
      link,
      source: source || '',
      publishedAt: parseRssDate(tag(block, 'pubDate')),
    });
  }
  return items;
}

/** „5 min temu”, „3 h temu”, „wczoraj”, „4 dni temu”. */
export function timeAgo(ts: number | null, now = Date.now()) {
  if (!ts) return '';
  const min = Math.max(0, Math.round((now - ts) / 60000));
  if (min < 1) return 'teraz';
  if (min < 60) return `${min} min temu`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h temu`;
  const d = Math.round(h / 24);
  return d === 1 ? 'wczoraj' : `${d} dni temu`;
}
