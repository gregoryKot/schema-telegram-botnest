// Цена визитки в статике (JSON-LD index.html, llms.txt) — из админки, а не из
// файла: подстановка, шов с настоящими файлами и кэш с TTL (правило №4).
import { readFileSync } from 'fs';
import { join } from 'path';
import { landingPriceText, LandingPrices } from './landing-price';
import { LANDING_PRICE_TTL_MS, LandingPriceCache } from './landing-price-cache';

const WEBAPP = join(__dirname, '..', '..', 'webapp');
const read = (rel: string) => readFileSync(join(WEBAPP, rel), 'utf8');

const ALL = { RUB: 4500, ILS: 250, EUR: 80, USD: 90 };

describe('landingPriceText', () => {
  const LD = `"offers": [{ "price": "0" }, { "name": "Онлайн-сессия", "price":"4000" }]`;

  it('JSON-LD: число оффера сессии — новая цена, бесплатная встреча не тронута', () => {
    const out = landingPriceText(LD, { RUB: 4500 });
    expect(out).toContain('"price":"4500"');
    expect(out).toContain('"price": "0"');
    expect(out).not.toContain('4000');
  });

  it('текст: «4 000 ₽» с любым пробелом → новая цена обычными пробелами', () => {
    const text = 'Сессия – 4 000 ₽. Ещё раз: 4 000 ₽.';
    expect(landingPriceText(text, { RUB: 12500 })).toBe(
      'Сессия – 12 500 ₽. Ещё раз: 12 500 ₽.',
    );
  });

  it('чужая сумма с тем же хвостом и цена без знака рубля не трогаются', () => {
    const text = 'Курс 14 000 ₽, 4000 руб., "price": "14000"';
    expect(landingPriceText(text, { RUB: 4500 })).toBe(text);
  });

  it('цена равна дефолту (строки в БД нет) — текст как в файле', () => {
    const text = `${LD} (50 минут, 4 000 ₽ / 200 ₪ / 65 € / 70 $)`;
    expect(
      landingPriceText(text, { RUB: 4000, ILS: 200, EUR: 65, USD: 70 }),
    ).toBe(text);
  });
});

// Шов с настоящими файлами: правка вёрстки, после которой подстановка молча
// перестала бы находить цену, краснеет здесь, а не в поисковой выдаче.
describe('landingPriceText на настоящих webapp/index.html и llms.txt', () => {
  interface LdNode {
    '@type': string;
    name?: string;
    price?: string;
    priceCurrency?: string;
    offers?: LdNode[];
    mainEntity?: { name: string; acceptedAnswer: { text: string } }[];
  }
  const graph = (html: string): LdNode[] => {
    const m = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(
      html,
    );
    return (JSON.parse(m?.[1] ?? '{}') as { '@graph': LdNode[] })['@graph'];
  };

  it('index.html: оффер «Онлайн-сессия» и ответ FAQPage — с новой ценой', () => {
    const out = landingPriceText(read('index.html'), ALL);
    const nodes = graph(out);
    const service = nodes.find((n) => n['@type'] === 'ProfessionalService');
    const offer = service?.offers?.find((o) => o.name === 'Онлайн-сессия');
    expect(offer?.price).toBe('4500');
    const by = (c: string) =>
      service?.offers?.find((o) => o.priceCurrency === c)?.price;
    expect([by('ILS'), by('EUR'), by('USD')]).toEqual(['250', '80', '90']);
    const faq = nodes.find((n) => n['@type'] === 'FAQPage');
    const answers = faq?.mainEntity?.map((q) => q.acceptedAnswer.text) ?? [];
    expect(answers.filter((a) => a.includes('₽'))).toEqual([
      expect.stringContaining('(50 минут) – 4 500 ₽.'),
    ]);
    expect(out).not.toMatch(/4\s000\s₽|"price":\s*"4000"/);
  });

  it('llms.txt: услуга — с новой ценой', () => {
    const out = landingPriceText(read('public/llms.txt'), ALL);
    expect(out).toContain('(50 минут, 4 500 ₽ / 250 ₪ / 80 € / 90 $)');
    expect(out).not.toMatch(/4\s000\s₽/);
  });
  it('валюты без цены нет — её нет ни в JSON-LD, ни в тексте (курс не считаем)', () => {
    const html = landingPriceText(read('index.html'), { RUB: 4500, EUR: 80 });
    const service = graph(html).find(
      (n) => n['@type'] === 'ProfessionalService',
    );
    expect(service?.offers?.map((o) => o.priceCurrency)).toEqual([
      'RUB',
      'RUB',
      'EUR',
    ]);
    const txt = landingPriceText(read('public/llms.txt'), {
      RUB: 4500,
      EUR: 80,
    });
    expect(txt).toContain('(50 минут, 4 500 ₽ / 80 €)');
    expect(txt).not.toMatch(/₪|\$/);
  });
});

const P = (RUB: number): LandingPrices => ({ RUB });

describe('LandingPriceCache', () => {
  const make = (read: () => Promise<LandingPrices>) => {
    const errors: unknown[] = [];
    const cache = new LandingPriceCache(read, (e) => errors.push(e));
    return { cache, errors };
  };

  it('в пределах TTL — одно чтение, параллельные запросы ждут его же', async () => {
    const read = jest.fn().mockResolvedValue(P(4500));
    const { cache } = make(read);
    const [a, b] = await Promise.all([cache.get(0), cache.get(10)]);
    expect([a, b, await cache.get(LANDING_PRICE_TTL_MS - 1)]).toEqual([
      P(4500),
      P(4500),
      P(4500),
    ]);
    expect(read).toHaveBeenCalledTimes(1);
  });

  it('TTL истёк — читает заново (цену сменили на другом инстансе)', async () => {
    const read = jest
      .fn()
      .mockResolvedValueOnce(P(4500))
      .mockResolvedValueOnce(P(5000));
    const { cache } = make(read);
    expect(await cache.get(0)).toEqual(P(4500));
    expect(await cache.get(LANDING_PRICE_TTL_MS)).toEqual(P(5000));
  });

  it('reset — следующий запрос читает заново, не дожидаясь TTL', async () => {
    const read = jest
      .fn()
      .mockResolvedValueOnce(P(4500))
      .mockResolvedValueOnce(P(5000));
    const { cache } = make(read);
    expect(await cache.get(0)).toEqual(P(4500));
    cache.reset();
    expect(await cache.get(1)).toEqual(P(5000));
  });

  it('сбой чтения — последняя известная цена, ошибка в лог, база до TTL не дёргается', async () => {
    const boom = new Error('db down');
    const read = jest
      .fn()
      .mockResolvedValueOnce(P(4500))
      .mockRejectedValue(boom);
    const { cache, errors } = make(read);
    expect(await cache.get(0)).toEqual(P(4500));
    expect(await cache.get(LANDING_PRICE_TTL_MS)).toEqual(P(4500));
    expect(await cache.get(LANDING_PRICE_TTL_MS + 1)).toEqual(P(4500));
    expect(errors).toEqual([boom]);
    expect(read).toHaveBeenCalledTimes(2);
  });

  it('сбой на первом чтении — дефолт кода, как в файлах статики', async () => {
    const { cache } = make(() => Promise.reject(new Error('db down')));
    expect(await cache.get(0)).toEqual({
      RUB: 4000,
      ILS: 200,
      EUR: 65,
      USD: 70,
    });
  });
});
