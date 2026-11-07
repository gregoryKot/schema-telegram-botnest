// Пер-доменные правки <head>: index.html один на оба домена (продуктовый
// schemehappens и персональный kotlarewski*), различия наводятся уже из JS.
// Персональному сайту — свой фавикон, свой title/canonical/og:url и никакого
// манифеста приложения: визитка практики отдаёт только себя (правило №19) и
// не упоминает продукт «Всё по схеме» / schemehappens.ru — ни в ярлыке, ни в
// заголовке вкладки, ни в canonical для поисковиков.
export function isPracticeHost(hostname: string = window.location.hostname): boolean {
  return /(^|\.)kotlarewski\./.test(hostname);
}

// Суффикс заголовка вкладки — единый источник для всех `document.title = …`.
export function siteTitleSuffix(): string {
  return isPracticeHost() ? 'kotlarewski.gr' : 'schemehappens.ru';
}

const PRACTICE_URL = 'https://kotlarewski.gr';

// Страницы визитки в поиске — зеркало PRACTICE_INDEXED_PAGES (src/practice-domain.seo.ts,
// сверка в practice-domain.seo.spec.ts): у каждой свой canonical и заголовок, иначе
// поисковик склеивает /reviews с главной. Прочие закрыты в robots.txt и берут главную.
export const PRACTICE_INDEXED_TITLES: Record<string, string> = {
  '/': 'Григорий Котляревский – схема-терапия онлайн',
  '/reviews': 'Почему здесь нет отзывов – Григорий Котляревский',
};

// JSON-LD в index.html уже указывает на kotlarewski.gr ("@id", "url",
// "serviceUrl", "image") — Person и услуга принадлежат визитке практики на
// любом домене, поэтому здесь его не переписываем.
export function applyPersonalSiteChrome(doc: Document = document, path: string = window.location.pathname): void {
  const trimmed = path.length > 1 ? path.replace(/\/+$/, '') : path;
  const page = trimmed in PRACTICE_INDEXED_TITLES ? trimmed : '/';
  // Знак «GK» кистью (растр, вектора нет): обе icon-ссылки — png, iOS — свой квадрат; getAttribute, не link.sizes (jsdom).
  doc.querySelectorAll("link[rel='icon']").forEach((el) => {
    const link = el as HTMLLinkElement;
    link.type = 'image/png';
    link.href = link.getAttribute('sizes') === '96x96' ? '/favicon-personal-96.png' : '/favicon-personal-192.png';
  });
  doc.querySelector("link[rel='apple-touch-icon']")?.setAttribute('href', '/apple-touch-icon-personal.png');
  doc.querySelector("link[rel='manifest']")?.remove();
  doc.title = PRACTICE_INDEXED_TITLES[page];
  const canonical = doc.querySelector("link[rel='canonical']");
  if (canonical) canonical.setAttribute('href', `${PRACTICE_URL}${page}`);
  const ogUrl = doc.querySelector("meta[property='og:url']");
  if (ogUrl) ogUrl.setAttribute('content', `${PRACTICE_URL}${page}`);
}
