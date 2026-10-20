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

// JSON-LD в index.html уже указывает на kotlarewski.gr ("@id", "url",
// "serviceUrl", "image") — Person и услуга принадлежат визитке практики на
// любом домене, поэтому здесь его не переписываем.
export function applyPersonalSiteChrome(doc: Document = document): void {
  // Монограмма «ГК»: svg-иконке — svg, png 96×96 — png, значку iOS — свой квадрат.
  // getAttribute, не link.sizes: у jsdom нет DOMTokenList, ветка была бы непроверяемой.
  doc.querySelectorAll("link[rel='icon']").forEach((el) => {
    const link = el as HTMLLinkElement;
    link.href = link.getAttribute('sizes') === '96x96' ? '/favicon-personal-96.png' : '/favicon-personal.svg';
  });
  doc.querySelector("link[rel='apple-touch-icon']")?.setAttribute('href', '/apple-touch-icon-personal.png');
  doc.querySelector("link[rel='manifest']")?.remove();
  doc.title = 'Григорий Котляревский – схема-терапия онлайн';
  const canonical = doc.querySelector("link[rel='canonical']");
  if (canonical) canonical.setAttribute('href', `${PRACTICE_URL}/`);
  const ogUrl = doc.querySelector("meta[property='og:url']");
  if (ogUrl) ogUrl.setAttribute('content', `${PRACTICE_URL}/`);
}
