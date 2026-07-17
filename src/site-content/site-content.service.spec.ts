// site-content.service.ts — редактируемый из админки контент сайта (фото
// хиро-блока, бегущие строки тем). Хранится денормализованно в общей
// key-value таблице bookingSetting. Ключевой инвариант правила CLAUDE.md
// «никаких хардкод-заглушек вместо реальных данных»: DEFAULT_TOPICS_A/B —
// это НЕ пользовательские данные (никакой юзер их не «ввёл»), это дефолт
// контент сайта, специально документированный в коде как замена того, что
// раньше было хардкожено прямо в LandingPage.tsx — легитимный сценарий
// «нет сохранённого значения → показать редакционный дефолт», а не подмена
// чужих данных.
import { SiteContentService } from './site-content.service';

function makeDb(seedSettings: Record<string, string> = {}) {
  const settings: Record<string, string> = { ...seedSettings };
  const db = {
    bookingSetting: {
      findUnique: jest.fn(({ where }: any) => {
        const value = settings[where.key];
        return value === undefined ? null : { key: where.key, value };
      }),
      upsert: jest.fn(({ where, create, update }: any) => {
        settings[where.key] =
          settings[where.key] !== undefined ? update.value : create.value;
        return { key: where.key, value: settings[where.key] };
      }),
    },
    _settings: settings,
  };
  return db;
}

describe('SiteContentService.getPublicContent — дефолты для отсутствующих ключей', () => {
  it('пустая БД (чистый инстанс) → heroPhoto null, топики — редакционные дефолты, а не пусто', async () => {
    const db = makeDb();
    const svc = new SiteContentService(db as any);

    const content = await svc.getPublicContent();

    expect(content.heroPhoto).toBeNull();
    expect(content.marqueeTopicsA.length).toBeGreaterThan(0);
    expect(content.marqueeTopicsB.length).toBeGreaterThan(0);
    expect(content.marqueeTopicsA[0]).toEqual({
      label: 'Схема-терапия',
      href: '#approach',
    });
  });

  it('сохранённые значения перекрывают дефолты', async () => {
    const custom = [{ label: 'Кастом', href: '#custom' }];
    const db = makeDb({
      heroPhoto: 'data:image/png;base64,xyz',
      marqueeTopicsA: JSON.stringify(custom),
    });
    const svc = new SiteContentService(db as any);

    const content = await svc.getPublicContent();

    expect(content.heroPhoto).toBe('data:image/png;base64,xyz');
    expect(content.marqueeTopicsA).toEqual(custom);
    // group B не задан — остаётся дефолтом
    expect(content.marqueeTopicsB.length).toBeGreaterThan(0);
  });

  it('битый JSON в сохранённом значении → тихий откат на дефолт (не бросает и не отдаёт мусор)', async () => {
    const db = makeDb({ marqueeTopicsA: '{не json' });
    const svc = new SiteContentService(db as any);

    const content = await svc.getPublicContent();

    expect(content.marqueeTopicsA[0]).toEqual({
      label: 'Схема-терапия',
      href: '#approach',
    });
  });

  it('валидный JSON, но не массив топиков (например объект) → откат на дефолт', async () => {
    const db = makeDb({ marqueeTopicsA: JSON.stringify({ not: 'an array' }) });
    const svc = new SiteContentService(db as any);

    const content = await svc.getPublicContent();

    expect(content.marqueeTopicsA[0]).toEqual({
      label: 'Схема-терапия',
      href: '#approach',
    });
  });

  it('массив с элементом без обязательных полей (нет href) → откат на дефолт целиком', async () => {
    const db = makeDb({
      marqueeTopicsB: JSON.stringify([{ label: 'Без href' }]),
    });
    const svc = new SiteContentService(db as any);

    const content = await svc.getPublicContent();

    expect(content.marqueeTopicsB.length).toBeGreaterThan(0);
    expect(
      content.marqueeTopicsB.every((t) => typeof t.href === 'string'),
    ).toBe(true);
  });

  it('сохранённая пустая строка возвращается как есть (не как null) — get() отличает "нет записи" от "записана пустая строка"', async () => {
    // heroPhoto не проходит через parseTopics с фолбэком — `get()` подставляет
    // null только когда строки в bookingSetting вовсе нет (row отсутствует).
    // Если строка есть и равна '', она возвращается как ''.
    const db = makeDb({ heroPhoto: '' });
    const svc = new SiteContentService(db as any);

    const content = await svc.getPublicContent();
    expect(content.heroPhoto).toBe('');
  });
});

describe('SiteContentService — сохранение (set) и read-after-write', () => {
  it('setHeroPhoto → следующий getPublicContent видит новое значение', async () => {
    const db = makeDb();
    const svc = new SiteContentService(db as any);

    await svc.setHeroPhoto('data:image/png;base64,new-photo');
    const content = await svc.getPublicContent();

    expect(content.heroPhoto).toBe('data:image/png;base64,new-photo');
  });

  it('setHeroPhoto дважды — обновляет значение (upsert.update), не создаёт вторую запись', async () => {
    const db = makeDb();
    const svc = new SiteContentService(db as any);

    await svc.setHeroPhoto('first');
    await svc.setHeroPhoto('second');

    expect(db._settings['heroPhoto']).toBe('second');
    expect(db.bookingSetting.upsert).toHaveBeenCalledTimes(2);
  });

  it('setMarqueeTopics(A) не задевает group B — независимые ключи', async () => {
    const db = makeDb();
    const svc = new SiteContentService(db as any);
    const topicsA = [{ label: 'A1', href: '#a1' }];

    await svc.setMarqueeTopics('A', topicsA);
    const content = await svc.getPublicContent();

    expect(content.marqueeTopicsA).toEqual(topicsA);
    expect(content.marqueeTopicsB[0]).toEqual({
      label: 'Безопасная среда',
      href: '#about',
    }); // дефолт B не тронут
  });

  it('setMarqueeTopics(B) — read-after-write возвращает ровно сохранённый список', async () => {
    const db = makeDb();
    const svc = new SiteContentService(db as any);
    const topicsB = [
      { label: 'Первая', href: '#one' },
      { label: 'Вторая', href: '#two' },
    ];

    const res = await svc.setMarqueeTopics('B', topicsB);
    expect(res).toEqual({ ok: true });

    const content = await svc.getPublicContent();
    expect(content.marqueeTopicsB).toEqual(topicsB);
  });

  it('пустой массив топиков — валиден и сохраняется как пустой список (не как «нет значения»)', async () => {
    const db = makeDb();
    const svc = new SiteContentService(db as any);

    await svc.setMarqueeTopics('A', []);
    const content = await svc.getPublicContent();

    // '[]' — truthy строка, parseTopics не откатывается на дефолт.
    expect(content.marqueeTopicsA).toEqual([]);
  });
});
