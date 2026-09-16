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

export function applyPersonalSiteChrome(doc: Document = document): void {
  doc.querySelectorAll("link[rel='icon']").forEach((el) => {
    const link = el as HTMLLinkElement;
    if (link.sizes?.value === '96x96') {
      link.href = '/favicon-personal-32.png';
    } else {
      link.type = 'image/png';
      link.href = '/favicon-personal-32.png';
    }
  });
  doc.querySelector("link[rel='manifest']")?.remove();
  doc.title = 'Григорий Котляревский – схема-терапия онлайн';
  const canonical = doc.querySelector("link[rel='canonical']");
  if (canonical) canonical.setAttribute('href', 'https://kotlarewski.gr/');
  const ogUrl = doc.querySelector("meta[property='og:url']");
  if (ogUrl) ogUrl.setAttribute('content', 'https://kotlarewski.gr/');
}
