// Главная kotlarewski.gr глазами Telegram/Директа/поисковика: что реально
// уходит в <head> после practiceIndexHtml. До 2026-10 обложка шла с jsdelivr
// и несла «схема-терапевт», цену и schemehappens.ru, а JSON-LD (@id, url,
// image) указывал на продуктовый домен — визитка представлялась чужим адресом.
import { readFileSync } from 'fs';
import { join } from 'path';
import { practiceIndexHtml } from './practice-index-html';

const WEBAPP = join(__dirname, '..', 'webapp');
const source = readFileSync(join(WEBAPP, 'index.html'), 'utf8');
const html = practiceIndexHtml(source, 'kotlarewski.gr');

const meta = (attr: 'property' | 'name', key: string): string | undefined =>
  new RegExp(`<meta ${attr}="${key}"\\s+content="([^"]*)"`).exec(html)?.[1];

// Размеры JPEG из маркера SOF (FFC0..FFC3) — без зависимостей.
function jpegSize(buf: Buffer): { width: number; height: number } {
  let i = 2;
  while (i < buf.length) {
    const marker = buf[i + 1];
    const len = buf.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xc3) {
      return {
        height: buf.readUInt16BE(i + 5),
        width: buf.readUInt16BE(i + 7),
      };
    }
    i += 2 + len;
  }
  throw new Error('SOF не найден');
}

interface LdNode {
  '@id': string;
  url?: string;
  image?: string;
  sameAs?: string[];
  provider?: { '@id': string };
  availableChannel?: { serviceUrl: string };
}

describe('главная визитки kotlarewski.gr', () => {
  it('canonical и og:url — на визитку', () => {
    expect(html).toContain(
      '<link rel="canonical" href="https://kotlarewski.gr/" />',
    );
    expect(meta('property', 'og:url')).toBe('https://kotlarewski.gr/');
  });

  it('og:image и twitter:image — с собственного домена, не с CDN', () => {
    expect(meta('property', 'og:image')).toBe(
      'https://kotlarewski.gr/og-cover-v3.jpg',
    );
    expect(meta('name', 'twitter:image')).toBe(
      'https://kotlarewski.gr/og-cover-v3.jpg',
    );
    expect(html).not.toContain('jsdelivr');
  });

  it('файл обложки лежит в public и его размер совпадает с og:image:width/height', () => {
    const size = jpegSize(
      readFileSync(join(WEBAPP, 'public', 'og-cover-v3.jpg')),
    );
    expect(size).toEqual({ width: 1200, height: 630 });
    expect(meta('property', 'og:image:width')).toBe(String(size.width));
    expect(meta('property', 'og:image:height')).toBe(String(size.height));
    expect(meta('property', 'og:image:alt')).toBeTruthy();
  });

  it('JSON-LD: @id, url, serviceUrl и image — на kotlarewski.gr', () => {
    const ld = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(
      html,
    );
    const graph = (JSON.parse(ld![1]) as { '@graph': LdNode[] })['@graph'];
    const [person, service, faq] = graph;
    expect(person['@id']).toBe('https://kotlarewski.gr/#person');
    expect(person.url).toBe('https://kotlarewski.gr');
    expect(person.image).toBe('https://kotlarewski.gr/gregory.jpg');
    expect(person.sameAs).toContain('https://t.me/SchemeHappens');
    expect(service['@id']).toBe('https://kotlarewski.gr/#service');
    expect(service.url).toBe('https://kotlarewski.gr');
    expect(service.provider?.['@id']).toBe('https://kotlarewski.gr/#person');
    expect(service.availableChannel?.serviceUrl).toBe('https://kotlarewski.gr');
    expect(faq['@id']).toBe('https://kotlarewski.gr/#faq');
  });

  it('schemehappens — только канал в sameAs и приложение в FAQ', () => {
    const hits = html.match(/\S*schemehappens\S*/gi) ?? [];
    expect(hits).toEqual([
      '"https://t.me/SchemeHappens"',
      'schemehappens.ru."',
    ]);
    expect(html).toContain('Доступно на schemehappens.ru.');
  });

  it('нет самоназвания «психолог»/«терапевт» (правило №12)', () => {
    expect(html).not.toMatch(/терапевт/i);
    expect(html).not.toMatch(/психолог(?!ическ)/i);
    // Контроль: законная формула услуги по-прежнему на месте.
    expect(html).toMatch(/Психологическое консультирование/);
  });
});
