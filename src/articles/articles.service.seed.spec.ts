// articles.service.ts — onModuleInit: сид/рефреш встроенных статей.
// Вынесено из articles.service.spec.ts (жёсткий потолок 300 строк, CLAUDE.md;
// фейк Prisma продублирован, а не вынесен в общий модуль — общий helper
// пришлось бы называть *spec.ts, чтобы tsconfig.build.json не утащил
// jest.fn() в прод-сборку, а тогда jest подхватил бы его как тестовый файл
// без единого it()).
//
// ARTICLE_SEED и ARTICLE_DIAGRAM_KEYS замоканы маленькой фикстурой — реальный
// сид (10 статей с полноразмерным HTML) не важен для проверки логики
// сидирования/рефреша, а раздувать тест реальным контентом незачем.
jest.mock('./articles.seed', () => ({
  ARTICLE_SEED: [
    {
      slug: 'a-1',
      title: 'Статья 1 (сид v1)',
      description: 'Описание 1',
      date: '2026-01-01',
      readMin: 5,
      content: '<p>Контент 1</p>',
    },
    {
      slug: 'a-2',
      title: 'Статья 2 (сид v1)',
      description: 'Описание 2',
      date: '2026-01-02',
      readMin: 3,
      content: '<p>Контент 2</p>',
    },
  ],
}));
jest.mock('./article-diagrams', () => ({
  ARTICLE_DIAGRAM_KEYS: { 'a-1': 'duration' },
}));

import { ArticlesService } from './articles.service';

type ArticleRow = {
  id: number;
  slug: string;
  title: string;
  description: string;
  content: string;
  date: Date;
  readMin: number;
  heroImage: string | null;
  diagramKey: string | null;
};

function makeDb(
  seedArticles: ArticleRow[] = [],
  seedSettings: Record<string, string> = {},
) {
  const articles: ArticleRow[] = [...seedArticles];
  const settings: Record<string, string> = { ...seedSettings };

  const db = {
    article: {
      findUnique: jest.fn(
        ({ where }: any) => articles.find((a) => a.slug === where.slug) ?? null,
      ),
      create: jest.fn(({ data }: any) => {
        const row = { id: articles.length + 1, ...data } as ArticleRow;
        articles.push(row);
        return { ...row };
      }),
      update: jest.fn(({ where, data }: any) => {
        const target = articles.find((a) => a.slug === where.slug);
        if (!target) throw new Error('not found');
        Object.assign(target, data);
        return { ...target };
      }),
    },
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
    _articles: articles,
    _settings: settings,
  };
  return db;
}

describe('ArticlesService.onModuleInit — сид и рефреш встроенных статей', () => {
  it('пустая таблица → сидирует все статьи из ARTICLE_SEED с diagramKey и версией', async () => {
    const db = makeDb();
    const svc = new ArticlesService(db as any);

    await svc.onModuleInit();

    expect(db._articles).toHaveLength(2);
    const a1 = db._articles.find((a) => a.slug === 'a-1')!;
    expect(a1.title).toBe('Статья 1 (сид v1)');
    expect(a1.diagramKey).toBe('duration'); // из ARTICLE_DIAGRAM_KEYS
    const a2 = db._articles.find((a) => a.slug === 'a-2')!;
    expect(a2.diagramKey).toBeNull(); // нет в ARTICLE_DIAGRAM_KEYS — null, не undefined

    const storedVersion = db._settings['articlesSeedVersion'];
    expect(typeof storedVersion).toBe('string');
    expect(storedVersion.length).toBeGreaterThan(0);
  });

  it('повторный вызов с той же версией — идемпотентен, ничего не пишет', async () => {
    const db = makeDb();
    const svc = new ArticlesService(db as any);
    await svc.onModuleInit();
    (db.article.create as jest.Mock).mockClear();
    (db.article.update as jest.Mock).mockClear();

    await svc.onModuleInit();

    expect(db.article.create).not.toHaveBeenCalled();
    expect(db.article.update).not.toHaveBeenCalled();
  });

  it('версия устарела → рефреш текста встроенных статей, heroImage админа сохраняется, чужие статьи не трогаются', async () => {
    const existingBuiltin: ArticleRow = {
      id: 1,
      slug: 'a-1',
      title: 'Устаревший заголовок',
      description: 'Устаревшее описание',
      content: '<p>Старый контент</p>',
      date: new Date('2025-01-01'),
      readMin: 1,
      heroImage: 'data:image/png;base64,admin-uploaded',
      diagramKey: 'duration',
    };
    const adminArticle: ArticleRow = {
      id: 2,
      slug: 'admin-only-article',
      title: 'Статья админа',
      description: 'd',
      content: 'c',
      date: new Date('2025-06-01'),
      readMin: 2,
      heroImage: null,
      diagramKey: null,
    };
    const db = makeDb([existingBuiltin, adminArticle], {
      articlesSeedVersion: 'ancient-version-marker',
    });
    const svc = new ArticlesService(db as any);

    await svc.onModuleInit();

    const refreshed = db._articles.find((a) => a.slug === 'a-1')!;
    expect(refreshed.title).toBe('Статья 1 (сид v1)'); // текст обновлён
    expect(refreshed.heroImage).toBe('data:image/png;base64,admin-uploaded'); // картинка сохранена

    // a-2 отсутствовал в таблице — должен быть создан (create, не update)
    expect(db._articles.some((a) => a.slug === 'a-2')).toBe(true);

    // Статья, созданная админом (не входит в ARTICLE_SEED), не тронута.
    const untouched = db._articles.find(
      (a) => a.slug === 'admin-only-article',
    )!;
    expect(untouched.title).toBe('Статья админа');
    expect(untouched.content).toBe('c');

    expect(db._settings['articlesSeedVersion']).not.toBe(
      'ancient-version-marker',
    );
  });
});
