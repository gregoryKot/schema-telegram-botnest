// Карточка ссылки (og:*, twitter:*) и <title>: оба хоста отдают один
// webapp/dist/index.html, краулер превью JS не исполняет. В файле — продукт
// (schemehappens.ru, правило №19), визитка kotlarewski.gr подменяет на своё на
// каждой своей странице: practiceIndexMiddleware (PRACTICE_PAGES) и
// ArticleSeoMiddleware (статьи на алиасе). Имя автора во вкладке — только у
// визитки. Description и JSON-LD не трогаем (docs/open/owner.md, «Автор описан на двух хостах»).

/** Карточка визитки. Обложка того же размера, что у продукта (1200×630):
 *  og:image:width/height в файле общие — сверка в practice-index-html.spec. */
export const PRACTICE_PREVIEW = {
  siteName: 'Григорий Котляревский',
  title: 'Григорий Котляревский – схема-терапия онлайн',
  description:
    'Онлайн-консультации в подходе схема-терапии. Работа с тем, что мешает жить: ' +
    'тревогой, самооценкой, отношениями. Первая встреча бесплатно.',
  image: 'https://kotlarewski.gr/og-cover-v4.jpg',
  imageAlt: 'Григорий Котляревский – схема-терапия онлайн',
} as const;

/** Теги карточки: [атрибут, ключ, значение визитки]. */
const PRACTICE_TAGS: readonly (readonly [string, string, string])[] = [
  ['property', 'og:site_name', PRACTICE_PREVIEW.siteName],
  ['property', 'og:title', PRACTICE_PREVIEW.title],
  ['property', 'og:description', PRACTICE_PREVIEW.description],
  ['property', 'og:image', PRACTICE_PREVIEW.image],
  ['property', 'og:image:alt', PRACTICE_PREVIEW.imageAlt],
  ['name', 'twitter:title', PRACTICE_PREVIEW.title],
  ['name', 'twitter:description', PRACTICE_PREVIEW.description],
  ['name', 'twitter:image', PRACTICE_PREVIEW.image],
];

/** index.html с карточкой визитки вместо карточки продукта. Ключ сверяется
 *  целиком (`og:image"`, не `og:image:alt`); тега нет — строка как есть,
 *  спек ловит это на настоящем index.html. */
export function practicePreviewHtml(html: string): string {
  const titled = html.replace(
    /<title>[^<]*<\/title>/,
    `<title>${PRACTICE_PREVIEW.title}</title>`,
  );
  return PRACTICE_TAGS.reduce(
    (out, [attr, key, value]) =>
      out.replace(
        new RegExp(`<meta ${attr}="${key}"(\\s+)content="[^"]*"\\s*/>`),
        (_tag, gap: string) =>
          `<meta ${attr}="${key}"${gap}content="${value}" />`,
      ),
    titled,
  );
}
