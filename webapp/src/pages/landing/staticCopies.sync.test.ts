// Сверка статических копий визитки с источниками (правило №4 CLAUDE.md).
//
// JSON-LD в webapp/index.html и webapp/public/llms.txt никто не импортирует:
// их читают поисковики и LLM, а не код. До 2026-11 FAQPage разметки
// разъехался с FAQ, который видит человек (FAQ_ITEMS): двух вопросов не было,
// третий («Что такое «Всё по схеме»?») визитка не показывает вовсе, а цена
// стояла 3 000 ₽ в трёх копиях при 4 000 ₽ при записи. Тест краснеет на
// любом таком расхождении.
//
// Источник цены — бэкенд: SESSION_DEFAULT_PRICE (src/booking/booking.config.ts)
// и последняя миграция, засевающая живую цену в BookingSetting. Фронт этот
// модуль импортировать не может, поэтому число читается из исходника — как
// в cancelPolicy.sync.test.ts. Правку цены в админке статика не увидит:
// поменял цену — меняй миграцией, и этот тест покажет все копии.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { FAQ_ITEMS } from './constants';
import { faqAnswer } from './faqAnswer';
import { formatPrice } from '../../../../shared/src/booking/priceRegion';

const ROOT = resolve(__dirname, '../../../..');
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');
/** Пробел и неразрывный пробел (toLocaleString ru-RU) — одно и то же. */
const norm = (s: string) => s.replace(/\s+/g, ' ').trim();

interface LdNode {
  '@type': string;
  name?: string;
  price?: string;
  offers?: LdNode[];
  mainEntity?: { name: string; acceptedAnswer: { text: string } }[];
}

function jsonLd(): LdNode[] {
  const m = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(
    read('webapp/index.html'),
  );
  if (!m) throw new Error('в webapp/index.html нет JSON-LD');
  return (JSON.parse(m[1]) as { '@graph': LdNode[] })['@graph'];
}

function sessionPriceDefault(): number {
  const src = read('src/booking/booking.config.ts');
  const m = /\[SessionType\.SESSION_50\]:\s*(\d+)/.exec(src);
  if (!m) throw new Error('SESSION_DEFAULT_PRICE.SESSION_50 не найден');
  return Number(m[1]);
}

/** Цена, которую засеяла в BookingSetting последняя миграция с ключом. */
function sessionPriceSeeded(): number | null {
  const dir = join(ROOT, 'prisma/migrations');
  let last: number | null = null;
  for (const name of readdirSync(dir).sort()) {
    let sql: string;
    try {
      sql = readFileSync(join(dir, name, 'migration.sql'), 'utf8');
    } catch {
      continue;
    }
    const m = /'price:SESSION_50',\s*'(\d+)'/.exec(sql);
    if (m) last = Number(m[1]);
  }
  return last;
}

const RUB = () => formatPrice(sessionPriceDefault(), 'RUB');

describe('статические копии визитки ↔ источники', () => {
  it('дефолт цены в коде = цена, засеянная миграцией в BookingSetting', () => {
    expect(sessionPriceSeeded()).toBe(sessionPriceDefault());
  });

  it('JSON-LD: цена онлайн-сессии — из источника', () => {
    const service = jsonLd().find((n) => n['@type'] === 'ProfessionalService');
    const offer = service?.offers?.find((o) => o.name === 'Онлайн-сессия');
    expect(offer?.price).toBe(String(sessionPriceDefault()));
  });

  it('JSON-LD: FAQPage — те же вопросы в том же порядке, что FAQ визитки', () => {
    const faq = jsonLd().find((n) => n['@type'] === 'FAQPage');
    expect(faq?.mainEntity?.map((q) => q.name)).toEqual(
      FAQ_ITEMS.map((i) => i.q),
    );
  });

  it('JSON-LD: ответы FAQPage совпадают с видимыми (рублёвая цена подставлена)', () => {
    const faq = jsonLd().find((n) => n['@type'] === 'FAQPage');
    const answers = faq?.mainEntity?.map((q) => norm(q.acceptedAnswer.text));
    expect(answers).toEqual(
      FAQ_ITEMS.map((i) => norm(faqAnswer(i.a, RUB(), true))),
    );
  });

  it('llms.txt: цена сессии — из источника', () => {
    expect(norm(read('webapp/public/llms.txt'))).toContain(
      `(50 минут, ${norm(RUB())})`,
    );
  });
});
