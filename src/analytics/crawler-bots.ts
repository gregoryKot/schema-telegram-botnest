// Роботы нейросетей и поисковиков, чьи заходы считает crawler-hits.ts
// (GEO.md, «Заходы ботов невидимы»). Метка — для отчёта /stats, простыми
// словами; id — подстрока заголовка User-Agent, по которой робот узнаётся.
//
// Сверено с webapp/public/robots.txt (группы роботов) и документацией площадок:
//   • Google-Extended и Applebot-Extended — НЕ роботы, а токены robots.txt:
//     такого User-Agent не бывает. Google и для поиска, и для ИИ-ответов ходит
//     как Googlebot, Apple — как Applebot; их и считаем.
//   • bingbot в robots.txt своей группы не имеет (читает `*`), но из индекса
//     Bing отвечают поиск ChatGPT и Copilot — заход важен для GEO.
//
// Подпись в User-Agent может поставить кто угодно, обратный DNS не
// проверяется: это счётчик «кто представился роботом», а не доказательство.
// Отчёт говорит это вслух.

export const CRAWLER_BOTS = [
  { id: 'OAI-SearchBot', label: 'ChatGPT: поиск' },
  { id: 'ChatGPT-User', label: 'ChatGPT: открыл по просьбе человека' },
  { id: 'GPTBot', label: 'ChatGPT: сбор текстов для обучения' },
  { id: 'Claude-SearchBot', label: 'Claude: поиск' },
  { id: 'Claude-User', label: 'Claude: открыл по просьбе человека' },
  { id: 'ClaudeBot', label: 'Claude: сбор текстов для обучения' },
  { id: 'PerplexityBot', label: 'Perplexity: поиск' },
  { id: 'Perplexity-User', label: 'Perplexity: открыл по просьбе человека' },
  { id: 'Googlebot', label: 'Google: поиск и ИИ-ответы' },
  { id: 'bingbot', label: 'Bing: поиск, из него отвечают ChatGPT и Copilot' },
  { id: 'Applebot', label: 'Apple: поиск Siri и Spotlight' },
  { id: 'YandexBot', label: 'Яндекс: поиск и Алиса' },
  { id: 'YandexAdditional', label: 'Яндекс: быстрые ответы нейросети' },
] as const;

export type CrawlerBotId = (typeof CRAWLER_BOTS)[number]['id'];

export const CRAWLER_BOT_IDS: readonly CrawlerBotId[] = CRAWLER_BOTS.map(
  (b) => b.id,
);

const LABEL = new Map<string, string>(CRAWLER_BOTS.map((b) => [b.id, b.label]));

export function crawlerLabel(id: CrawlerBotId): string {
  return LABEL.get(id) ?? id;
}

// Подпись робота стоит в начале заголовка (Googlebot — на ~60-м символе);
// длиннее не смотрим: заголовок присылает клиент, и проход по мегабайту
// мусора на каждом запросе не нужен.
const UA_SCAN_LIMIT = 512;

// Одна скомпилированная заранее альтернатива из литералов: один проход по
// строке, а не тринадцать. Ни один id не содержит другой, поэтому порядок
// альтернатив не влияет на ответ.
const BY_TOKEN = new Map<string, CrawlerBotId>(
  CRAWLER_BOTS.map((b) => [b.id.toLowerCase(), b.id]),
);
const TOKEN_RE = new RegExp(
  CRAWLER_BOTS.map((b) => b.id.replace(/[-]/g, '\\-')).join('|'),
  'i',
);

/** Какой робот представился в User-Agent; null — человек или чужой робот. */
export function detectCrawler(ua: string | undefined): CrawlerBotId | null {
  if (!ua) return null;
  const head = ua.length > UA_SCAN_LIMIT ? ua.slice(0, UA_SCAN_LIMIT) : ua;
  const m = TOKEN_RE.exec(head);
  return m ? (BY_TOKEN.get(m[0].toLowerCase()) ?? null) : null;
}
