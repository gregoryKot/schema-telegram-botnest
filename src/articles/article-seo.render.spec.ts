import {
  buildArticleBody,
  buildArticleJsonLd,
  buildArticlesListBody,
  injectSeo,
  lastModified,
} from './article-seo.render';

const ARTICLE = {
  slug: 'a-b',
  title: 'Заголовок',
  description: 'Описание',
  content: '<p>Текст</p><script>alert(1)</script>',
  date: new Date('2025-05-10T00:00:00.000Z'),
};

describe('lastModified / buildArticleJsonLd', () => {
  it('берёт более позднюю дату: updatedAt после date', () => {
    const updatedAt = new Date('2026-09-01T00:00:00.000Z');
    expect(lastModified({ ...ARTICLE, updatedAt })).toEqual(updatedAt);
    const ld = buildArticleJsonLd({ ...ARTICLE, updatedAt }, 'https://x/y');
    expect(ld.datePublished).toBe('2025-05-10T00:00:00.000Z');
    expect(ld.dateModified).toBe('2026-09-01T00:00:00.000Z');
  });

  it('updatedAt раньше date → остаётся date', () => {
    const updatedAt = new Date('2024-01-01T00:00:00.000Z');
    expect(lastModified({ ...ARTICLE, updatedAt })).toEqual(ARTICLE.date);
  });

  it('без updatedAt или с null → дата публикации', () => {
    expect(lastModified(ARTICLE)).toEqual(ARTICLE.date);
    expect(lastModified({ ...ARTICLE, updatedAt: null })).toEqual(ARTICLE.date);
    expect(buildArticleJsonLd(ARTICLE, 'https://x/y').dateModified).toBe(
      '2025-05-10T00:00:00.000Z',
    );
  });

  it('date строкой тоже работает', () => {
    expect(lastModified({ date: '2025-05-10T00:00:00.000Z' })).toEqual(
      ARTICLE.date,
    );
  });
});

describe('buildArticleBody', () => {
  it('заголовок, лид, текст; <script> вырезан', () => {
    const html = buildArticleBody(ARTICLE);
    expect(html).toContain('<h1>Заголовок</h1>');
    expect(html).toContain('<p>Текст</p>');
    expect(html).not.toContain('alert(1)');
  });
});

describe('buildArticlesListBody', () => {
  it('ссылка на статью и описание через тире', () => {
    expect(buildArticlesListBody([ARTICLE])).toBe(
      '<section><h1>Статьи о схема-терапии</h1><ul>' +
        '<li><a href="/articles/a-b">Заголовок</a> – Описание</li>' +
        '</ul></section>',
    );
  });

  it('экранирует < и & в названии и описании', () => {
    const html = buildArticlesListBody([
      { ...ARTICLE, title: 'КПТ & <схемы>', description: 'a < b & c' },
    ]);
    expect(html).toContain('КПТ &amp; &lt;схемы&gt;');
    expect(html).toContain('a &lt; b &amp; c');
    expect(html).not.toContain('<схемы>');
  });

  it('пустой список — заголовок и пустой ul', () => {
    expect(buildArticlesListBody([])).toBe(
      '<section><h1>Статьи о схема-терапии</h1><ul></ul></section>',
    );
  });
});

describe('injectSeo', () => {
  const BASE = `<head>
<title>old</title>
<meta name="description" content="old" />
<link rel="canonical" href="https://schemehappens.ru/" />
<meta property="og:url"         content="old" />
<meta property="og:title"       content="old" />
<meta property="og:description" content="old" />
<meta property="og:type"        content="website" />
</head><body><div id="root"></div></body>`;

  it('заменяет каждый тег и тело, JSON-LD добавляет после #root', () => {
    const out = injectSeo(BASE, {
      title: 'T & "q"',
      description: 'D <d>',
      canonicalUrl: 'https://schemehappens.ru/articles/x',
      ogType: 'article',
      bodyHtml: '<p>тело $& </p>',
      jsonLd: { headline: '</script><b>' },
    });
    expect(out).toContain('<title>T &amp; &quot;q&quot;</title>');
    expect(out).toContain('<meta name="description" content="D &lt;d&gt;" />');
    expect(out).toContain(
      '<link rel="canonical" href="https://schemehappens.ru/articles/x" />',
    );
    expect(out).toContain(
      '<meta property="og:url" content="https://schemehappens.ru/articles/x" />',
    );
    expect(out).toContain(
      '<meta property="og:title" content="T &amp; &quot;q&quot;" />',
    );
    expect(out).toContain(
      '<meta property="og:description" content="D &lt;d&gt;" />',
    );
    expect(out).toContain('<meta property="og:type" content="article" />');
    expect(out).toContain('<div id="root"><p>тело $& </p></div>');
    expect(out).toContain('<script type="application/ld+json">');
    expect(out).not.toContain('</script><b>');
    expect(out).not.toContain('old');
  });

  it('ogTitle отдельно от title; без jsonLd скрипта нет', () => {
    const out = injectSeo(BASE, {
      title: 'Т – Автор',
      ogTitle: 'Т',
      description: 'd',
      canonicalUrl: 'https://schemehappens.ru/articles',
      ogType: 'website',
      bodyHtml: '',
    });
    expect(out).toContain('<meta property="og:title" content="Т" />');
    expect(out).not.toContain('ld+json');
  });
});
