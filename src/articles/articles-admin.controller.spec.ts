// Гейтинг по x-admin-key (ADMIN_BOOKING_KEY) — тот же ключ, что у панели
// бронирования (правило безопасности CLAUDE.md: чужой ключ/его отсутствие не
// должны пропускать к CRUD статей). Плюс — что каждый метод делегирует в
// сервис с правильными аргументами (ParseIntPipe даёт число, не строку).
import { ForbiddenException } from '@nestjs/common';
import { ArticlesAdminController } from './articles-admin.controller';
import type { ArticlesService } from './articles.service';

const ADMIN_KEY = 'test-admin-key-articles';

function makeConfig(key: string | undefined = ADMIN_KEY) {
  return { get: jest.fn(() => key) } as any;
}

function makeArticles() {
  return {
    adminList: jest.fn().mockResolvedValue([{ id: 1, slug: 'a' }]),
    create: jest.fn().mockResolvedValue({ id: 2, slug: 'b' }),
    update: jest.fn().mockResolvedValue({ id: 1, slug: 'a', title: 'upd' }),
    remove: jest.fn().mockResolvedValue({ ok: true }),
  } as unknown as ArticlesService;
}

function makeController(opts: { key?: string } = {}) {
  const articles = makeArticles();
  const controller = new ArticlesAdminController(
    articles,
    makeConfig(opts.key),
  );
  return { controller, articles };
}

describe('ArticlesAdminController — гейтинг по x-admin-key', () => {
  it('верный ключ пропускает запрос', async () => {
    const { controller, articles } = makeController();
    await expect(controller.list(ADMIN_KEY)).resolves.toBeDefined();
    expect(articles.adminList).toHaveBeenCalledTimes(1);
  });

  it('неверный ключ — ForbiddenException, сервис не вызывается', async () => {
    const { controller, articles } = makeController();
    await expect(controller.list('wrong-key')).rejects.toThrow(
      ForbiddenException,
    );
    expect(articles.adminList).not.toHaveBeenCalled();
  });

  it('ADMIN_BOOKING_KEY не задан на сервере — эндпоинт закрыт даже пустым ключом клиента', async () => {
    const { controller, articles } = makeController({ key: '' });
    await expect(controller.list('')).rejects.toThrow(ForbiddenException);
    expect(articles.adminList).not.toHaveBeenCalled();
  });

  it('гейтинг применяется ко всем методам, не только list', async () => {
    const { controller, articles } = makeController();
    const dto = {
      slug: 'a',
      title: 'A',
      description: 'd',
      content: 'c',
      date: '2026-01-01',
      readMin: 3,
    };
    await expect(controller.create(dto, 'wrong')).rejects.toThrow(
      ForbiddenException,
    );
    await expect(controller.update(1, { title: 'x' }, 'wrong')).rejects.toThrow(
      ForbiddenException,
    );
    await expect(controller.remove(1, 'wrong')).rejects.toThrow(
      ForbiddenException,
    );
    expect(articles.create).not.toHaveBeenCalled();
    expect(articles.update).not.toHaveBeenCalled();
    expect(articles.remove).not.toHaveBeenCalled();
  });
});

describe('ArticlesAdminController — действия делегируют в сервис', () => {
  it('create передаёт DTO целиком', async () => {
    const { controller, articles } = makeController();
    const dto = {
      slug: 'b',
      title: 'B',
      description: 'd',
      content: 'c',
      date: '2026-01-02',
      readMin: 5,
    };
    const res = await controller.create(dto, ADMIN_KEY);
    expect(articles.create).toHaveBeenCalledWith(dto);
    expect(res).toEqual({ id: 2, slug: 'b' });
  });

  it('update передаёт id (число, ParseIntPipe в реальном рантайме) и патч', async () => {
    const { controller, articles } = makeController();
    await controller.update(1, { title: 'upd' }, ADMIN_KEY);
    expect(articles.update).toHaveBeenCalledWith(1, { title: 'upd' });
  });

  it('remove передаёт id и отдаёт результат сервиса', async () => {
    const { controller, articles } = makeController();
    const res = await controller.remove(1, ADMIN_KEY);
    expect(articles.remove).toHaveBeenCalledWith(1);
    expect(res).toEqual({ ok: true });
  });
});
