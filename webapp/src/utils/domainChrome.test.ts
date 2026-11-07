// @vitest-environment jsdom
// Пер-доменные правки <head>: на персональном домене фавикон меняется на
// personal-вариант, манифест приложения (start_url /app/) убирается, а
// title/canonical/og:url перестают упоминать schemehappens.ru — визитка
// практики не отдаёт ни одной ссылки на продукт (правило №19).
import { describe, it, expect, beforeEach } from 'vitest';
import { applyPersonalSiteChrome, isPracticeHost } from './domainChrome';

function addLink(rel: string, href: string, sizes?: string): HTMLLinkElement {
  const link = document.createElement('link');
  link.rel = rel;
  link.href = href;
  if (sizes) link.setAttribute('sizes', sizes);
  document.head.appendChild(link);
  return link;
}

function addMeta(property: string, content: string): HTMLMetaElement {
  const meta = document.createElement('meta');
  meta.setAttribute('property', property);
  meta.setAttribute('content', content);
  document.head.appendChild(meta);
  return meta;
}

beforeEach(() => {
  document.head.innerHTML = '';
});

describe('applyPersonalSiteChrome', () => {
  it('меняет фавиконы на знак «GK»: svg-ссылка → png 192, png 96×96 → png 96', () => {
    const svg = addLink('icon', '/favicon.svg');
    svg.type = 'image/svg+xml';
    const png = addLink('icon', '/favicon-96.png', '96x96');
    applyPersonalSiteChrome(document);
    expect(svg.href).toContain('/favicon-personal-192.png');
    expect(svg.type).toBe('image/png');
    expect(png.href).toContain('/favicon-personal-96.png');
  });

  it('значок на экран iOS — свой, не значок продукта', () => {
    const touch = addLink('apple-touch-icon', '/apple-touch-icon.png', '180x180');
    applyPersonalSiteChrome(document);
    expect(touch.getAttribute('href')).toBe('/apple-touch-icon-personal.png');
  });

  it('без apple-touch-icon в документе не падает', () => {
    expect(() => applyPersonalSiteChrome(document)).not.toThrow();
  });

  it('убирает ссылку на манифест приложения', () => {
    addLink('manifest', '/manifest.webmanifest');
    applyPersonalSiteChrome(document);
    expect(document.querySelector("link[rel='manifest']")).toBeNull();
  });

  it('без манифеста в документе не падает', () => {
    expect(() => applyPersonalSiteChrome(document)).not.toThrow();
  });

  it('меняет title вкладки на персональный, без упоминания schemehappens.ru', () => {
    document.title = 'Всё по схеме | schemehappens.ru';
    applyPersonalSiteChrome(document);
    expect(document.title).toBe('Григорий Котляревский – схема-терапия онлайн');
  });

  it('меняет canonical на https://kotlarewski.gr/, если он есть', () => {
    const canonical = addLink('canonical', 'https://schemehappens.ru/');
    applyPersonalSiteChrome(document);
    expect(canonical.getAttribute('href')).toBe('https://kotlarewski.gr/');
  });

  it('без canonical в документе не падает', () => {
    expect(() => applyPersonalSiteChrome(document)).not.toThrow();
    expect(document.querySelector("link[rel='canonical']")).toBeNull();
  });

  it('меняет og:url на https://kotlarewski.gr/, если он есть', () => {
    const ogUrl = addMeta('og:url', 'https://schemehappens.ru/');
    applyPersonalSiteChrome(document);
    expect(ogUrl.getAttribute('content')).toBe('https://kotlarewski.gr/');
  });

  // Решение владельца 2026-10-24: /reviews в поиске — значит, своя страница, а не
  // копия главной (иначе поисковик склеит их по canonical).
  it('/reviews: свой canonical, og:url и заголовок; хвостовой слэш не мешает', () => {
    const canonical = addLink('canonical', 'https://schemehappens.ru/');
    const ogUrl = addMeta('og:url', 'https://schemehappens.ru/');
    applyPersonalSiteChrome(document, '/reviews/');
    expect(canonical.getAttribute('href')).toBe('https://kotlarewski.gr/reviews');
    expect(ogUrl.getAttribute('content')).toBe('https://kotlarewski.gr/reviews');
    expect(document.title).toBe('Почему здесь нет отзывов – Григорий Котляревский');
  });

  it('страница вне поиска (/book) берёт canonical и заголовок главной', () => {
    const canonical = addLink('canonical', 'https://schemehappens.ru/');
    applyPersonalSiteChrome(document, '/book');
    expect(canonical.getAttribute('href')).toBe('https://kotlarewski.gr/');
    expect(document.title).toBe('Григорий Котляревский – схема-терапия онлайн');
  });

  it('без og:url в документе не падает', () => {
    expect(() => applyPersonalSiteChrome(document)).not.toThrow();
    expect(document.querySelector("meta[property='og:url']")).toBeNull();
  });
});

describe('isPracticeHost', () => {
  it.each(['kotlarewski.gr', 'www.kotlarewski.gr', 'kotlarewski.ru'])(
    '%s — хост визитки практики',
    (hostname) => { expect(isPracticeHost(hostname)).toBe(true); },
  );

  it.each(['schemehappens.ru', 'notkotlarewski.gr'])(
    '%s — не хост визитки практики',
    (hostname) => { expect(isPracticeHost(hostname)).toBe(false); },
  );
});
