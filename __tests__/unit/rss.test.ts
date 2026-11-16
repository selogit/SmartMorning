/** Testy jednostkowe: src/news/rss.ts */
import { decodeEntities, parseRssDate, parseRss } from '../../src/news/rss';

describe('decodeEntities', () => {
  it('encje nazwane', () => {
    expect(decodeEntities('a &amp; b &lt;c&gt; &quot;d&quot;')).toBe('a & b <c> "d"');
  });

  it('encje numeryczne dziesiętne i szesnastkowe', () => {
    expect(decodeEntities('&#65;&#x42;')).toBe('AB');
  });

  it('nieznana encja pozostaje bez zmian', () => {
    expect(decodeEntities('&foo;')).toBe('&foo;');
  });
});

describe('parseRssDate', () => {
  it('data GMT', () => {
    const ts = parseRssDate('Thu, 05 Nov 2026 20:13:00 GMT');
    expect(ts).toBe(Date.UTC(2026, 10, 5, 20, 13, 0));
  });

  it('offset +0100 przelicza na UTC', () => {
    const ts = parseRssDate('Thu, 05 Nov 2026 21:13:00 +0100');
    expect(ts).toBe(Date.UTC(2026, 10, 5, 20, 13, 0));
  });

  it('bez sekund', () => {
    const ts = parseRssDate('5 Nov 2026 20:13 GMT');
    expect(ts).toBe(Date.UTC(2026, 10, 5, 20, 13, 0));
  });

  it('śmieci → null', () => {
    expect(parseRssDate('wczoraj po południu')).toBeNull();
    expect(parseRssDate('')).toBeNull();
  });
});

const FEED = `<?xml version="1.0"?>
<rss version="2.0"><channel>
<item>
  <title><![CDATA[Pierwsza wiadomość z bardzo długim tytułem - Onet]]></title>
  <link>https://example.com/1</link>
  <guid>guid-1</guid>
  <pubDate>Thu, 05 Nov 2026 20:13:00 GMT</pubDate>
</item>
<item>
  <title>Druga &amp; trzecia - TVN24</title>
  <link>https://example.com/2</link>
  <source url="https://tvn24.pl">TVN24</source>
  <pubDate>zepsuta data</pubDate>
</item>
<item>
  <title>Bez linku</title>
</item>
</channel></rss>`;

describe('parseRss', () => {
  const items = parseRss(FEED);

  it('parsuje poprawne pozycje, pomija te bez linku', () => {
    expect(items).toHaveLength(2);
  });

  it('wyciąga źródło z końcówki tytułu „ - Źródło" (heurystyka: myślnik za poz. 20)', () => {
    expect(items[0].title).toBe('Pierwsza wiadomość z bardzo długim tytułem');
    expect(items[0].source).toBe('Onet');
  });

  it('jawny <source> usuwa sufiks z tytułu', () => {
    expect(items[1].title).toBe('Druga & trzecia');
    expect(items[1].source).toBe('TVN24');
  });

  it('guid staje się id, a zepsuta data daje null', () => {
    expect(items[0].id).toBe('guid-1');
    expect(items[0].publishedAt).toBe(Date.UTC(2026, 10, 5, 20, 13, 0));
    expect(items[1].publishedAt).toBeNull();
  });
});
