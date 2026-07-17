// articles.service.ts — публичный список статей блога + slug-lookup +
// админ-CRUD. Логика сида/рефреша встроенного контента (onModuleInit) — в
// articles.service.seed.spec.ts (разнесено из-за жёсткого потолка 300 строк,
// CLAUDE.md). Фейковая Prisma — таблицы в памяти (паттерн notes.service.spec.ts),
// findMany с реальной select-проекцией, чтобы поймать утечку `content` в
// публичный список.
import { NotFoundException } from '@nestjs/common';
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

function makeDb(seedArticles: ArticleRow[] = []) {
  const articles: ArticleRow[] = [...seedArticles];
  let nextId = articles.reduce((m, a) => Math.max(m, a.id), 0) + 1;

  const db = {
    article: {
      findMany: jest.fn(({ orderBy, select }: any) => {
        let rows = [...articles];
        if (orderBy?.date === 'desc') {
          rows = rows.sort((a, b) => b.date.getTime() - a.date.getTime());
        }
        if (!select) return rows.map((r) => ({ ...r }));
        return rows.map((r) => {
          const projected: any = {};
          for (const key of Object.keys(select)) {
            if (select[key]) projected[key] = (r as any)[key];
          }
          return projected;
        });
      }),
      findUnique: jest.fn(({ where }: any) =>
        where.slug !== undefined
          ? (articles.find((a) => a.slug === where.slug) ?? null)
          : (articles.find((a) => a.id === where.id) ?? null),
      ),
      create: jest.fn(({ data }: any) => {
        const row = {
          id: nextId++,
          heroImage: null,
          diagramKey: null,
          ...data,
        } as ArticleRow;
        articles.push(row);
        return { ...row };
      }),
      update: jest.fn(({ where, data }: any) => {
        const target = articles.find((a) => a.id === where.id);
        if (!target) throw new Error('not found');
        Object.assign(target, data);
        return { ...target };
      }),
      delete: jest.fn(({ where }: any) => {
        const idx = articles.findIndex((a) => a.id === where.id);
        if (idx === -1) throw new Error('not found');
        articles.splice(idx, 1);
      }),
    },
    _articles: articles,
  };
  return db;
}

function row(id: number, slug: string, dateStr: string): ArticleRow {
  return {
    id,
    slug,
    title: `title-${slug}`,
    description: 'd',
    content: 'c',
    date: new Date(dateStr),
    readMin: 1,
    heroImage: null,
    diagramKey: null,
  };
}

describe('ArticlesService.list — публичный список', () => {
  it('не отдаёт поле content (тяжёлое, не нужно списку)', async () => {
    const db = makeDb([
      {
        id: 1,
        slug: 'x',
        title: 'T',
        description: 'D',
        content: '<p>СЕКРЕТНЫЙ ПОЛНЫЙ HTML</p>',
        date: new Date('2026-01-01'),
        readMin: 5,
        heroImage: null,
        diagramKey: null,
      },
    ]);
    const svc = new ArticlesService(db as any);

    const list = await svc.list();

    expect(list).toHaveLength(1);
    expect(list[0]).not.toHaveProperty('content');
    expect(JSON.stringify(list)).not.toContain('СЕКРЕТНЫЙ');
  });

  it('сортирует по дате по убыванию (новые сверху)', async () => {
    const db = makeDb([
      row(1, 'old', '2025-01-01'),
      row(2, 'new', '2026-01-01'),
      row(3, 'mid', '2025-06-01'),
    ]);
    const svc = new ArticlesService(db as any);

    const list = await svc.list();

    expect(list.map((a) => a.slug)).toEqual(['new', 'mid', 'old']);
  });
});

describe('ArticlesService.findBySlug', () => {
  it('находит статью по slug (полный контент, без проекции)', async () => {
    const db = makeDb([row(1, 'found-me', '2026-01-01')]);
    const svc = new ArticlesService(db as any);

    const article = await svc.findBySlug('found-me');

    expect(article.slug).toBe('found-me');
    expect(article).toHaveProperty('content');
  });

  it('slug не найден → NotFoundException', async () => {
    const db = makeDb([]);
    const svc = new ArticlesService(db as any);

    await expect(svc.findBySlug('missing')).rejects.toThrow(NotFoundException);
  });
});

describe('ArticlesService.adminList', () => {
  it('возвращает все статьи целиком (без проекции), включая content', async () => {
    const db = makeDb([row(1, 'x', '2026-01-01')]);
    const svc = new ArticlesService(db as any);

    const list = await svc.adminList();

    expect(list[0]).toHaveProperty('content');
  });
});

describe('ArticlesService admin-мутации', () => {
  it('create: сохраняет статью, date конвертируется в Date', async () => {
    const db = makeDb([]);
    const svc = new ArticlesService(db as any);

    const created = await svc.create({
      slug: 'new-article',
      title: 'T',
      description: 'D',
      content: 'C',
      date: '2026-05-01',
      readMin: 4,
    });

    expect(created.date).toBeInstanceOf(Date);
    expect(db._articles.some((a) => a.slug === 'new-article')).toBe(true);
  });

  it('update: несуществующий id → NotFoundException, БД не тронута', async () => {
    const db = makeDb([row(1, 'x', '2026-01-01')]);
    const svc = new ArticlesService(db as any);

    await expect(svc.update(999, { title: 'x' })).rejects.toThrow(
      NotFoundException,
    );
    expect(db.article.update).not.toHaveBeenCalled();
  });

  it('update: частичное обновление меняет только переданные поля', async () => {
    const db = makeDb([row(1, 'x', '2026-01-01')]);
    const svc = new ArticlesService(db as any);

    const updated = await svc.update(1, { title: 'Новый заголовок' });

    expect(updated.title).toBe('Новый заголовок');
    expect(updated.slug).toBe('x'); // не изменился
  });

  it('remove: несуществующий id → NotFoundException, ничего не удаляется', async () => {
    const db = makeDb([row(1, 'x', '2026-01-01')]);
    const svc = new ArticlesService(db as any);

    await expect(svc.remove(999)).rejects.toThrow(NotFoundException);
    expect(db._articles).toHaveLength(1);
  });

  it('remove: существующая статья удаляется, возвращает {ok:true}', async () => {
    const db = makeDb([row(1, 'x', '2026-01-01')]);
    const svc = new ArticlesService(db as any);

    const res = await svc.remove(1);

    expect(res).toEqual({ ok: true });
    expect(db._articles).toHaveLength(0);
  });
});
