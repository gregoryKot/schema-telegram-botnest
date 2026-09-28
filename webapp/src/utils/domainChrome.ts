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

const PRODUCT_HOST = 'https://schemehappens.ru';
const PRACTICE_URL = 'https://kotlarewski.gr';

// JSON-LD в index.html статичен и общий для обоих доменов — "url" полей
// Person/ProfessionalService/availableChannel указывает на schemehappens.ru,
// что для визитки практики неверно (домен страницы и canonical в разметке
// расходятся). "@id" и "image" не трогаем — это идентификаторы/ассет, не
// canonical-адрес страницы, и jobTitle под отдельным пином (правило №12).
function rewritePersonalStructuredData(doc: Document): void {
  const script = doc.querySelector("script[type='application/ld+json']");
  if (!script?.textContent) return;
  let data: unknown;
  try {
    data = JSON.parse(script.textContent);
  } catch {
    return;
  }
  const replaceUrl = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;
    const obj = node as Record<string, unknown>;
    if (obj.url === PRODUCT_HOST) obj.url = PRACTICE_URL;
    if (
      obj.availableChannel &&
      typeof obj.availableChannel === 'object' &&
      (obj.availableChannel as Record<string, unknown>).serviceUrl === PRODUCT_HOST
    ) {
      (obj.availableChannel as Record<string, unknown>).serviceUrl = PRACTICE_URL;
    }
  };
  const graph = (data as Record<string, unknown>)?.['@graph'];
  if (Array.isArray(graph)) graph.forEach(replaceUrl);
  else replaceUrl(data);
  script.textContent = JSON.stringify(data);
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
  if (canonical) canonical.setAttribute('href', `${PRACTICE_URL}/`);
  const ogUrl = doc.querySelector("meta[property='og:url']");
  if (ogUrl) ogUrl.setAttribute('content', `${PRACTICE_URL}/`);
  rewritePersonalStructuredData(doc);
}
