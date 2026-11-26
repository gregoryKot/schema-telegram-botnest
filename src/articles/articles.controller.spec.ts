// Публичная выдача статей: список — всегда 200, а несуществующий slug — 404,
// а не 500. Контроллер тонкий (делегирует в ArticlesService), но именно этот
// маршрут читает пользователь сайта напрямую — 500 на несуществующей статье
// выглядел бы как «сайт сломан», а не «статьи нет».
import { NotFoundException } from '@nestjs/common';
import { ArticlesController } from './articles.controller';
import type { ArticlesService } from './articles.service';

function makeArticles(overrides: Partial<ArticlesService> = {}) {
  return {
    list: jest.fn().mockResolvedValue([{ id: 1, slug: 'a', title: 'A' }]),
    findBySlug: jest.fn().mockResolvedValue({ id: 1, slug: 'a', title: 'A' }),
    ...overrides,
  } as unknown as ArticlesService;
}

describe('ArticlesController', () => {
  it('list() отдаёт то, что вернул сервис', async () => {
    const articles = makeArticles();
    const controller = new ArticlesController(articles);
    await expect(controller.list()).resolves.toEqual([
      { id: 1, slug: 'a', title: 'A' },
    ]);
    expect(articles.list).toHaveBeenCalledTimes(1);
  });

  it('get(slug) передаёт slug из URL сервису и отдаёт статью', async () => {
    const articles = makeArticles();
    const controller = new ArticlesController(articles);
    await expect(controller.get('a')).resolves.toEqual({
      id: 1,
      slug: 'a',
      title: 'A',
    });
    expect(articles.findBySlug).toHaveBeenCalledWith('a');
  });

  it('несуществующий slug отдаёт 404, а не падает 500-кой', async () => {
    const articles = makeArticles({
      findBySlug: jest
        .fn()
        .mockRejectedValue(new NotFoundException('Article not found')),
    });
    const controller = new ArticlesController(articles);
    await expect(controller.get('nope')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
