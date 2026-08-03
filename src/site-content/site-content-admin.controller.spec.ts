// Гейтинг по x-admin-key + серверная валидация тела запроса: фронт сжимает
// фото сам, но бэк — последний рубеж (правило: рантайм-валидация, не только
// DTO-типы), и то, что мусорные topics/переразмеренное фото не долетают до БД.
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { SiteContentAdminController } from './site-content-admin.controller';
import type { SiteContentService } from './site-content.service';

const ADMIN_KEY = 'test-admin-key-site-content';

function makeConfig(key: string | undefined = ADMIN_KEY) {
  return { get: jest.fn(() => key) } as any;
}

function makeContent() {
  return {
    setHeroPhoto: jest.fn().mockResolvedValue({ ok: true }),
    setMarqueeTopics: jest.fn().mockResolvedValue({ ok: true }),
  } as unknown as SiteContentService;
}

function makeController(opts: { key?: string } = {}) {
  const content = makeContent();
  const controller = new SiteContentAdminController(
    content,
    makeConfig(opts.key),
  );
  return { controller, content };
}

const validTopics = {
  group: 'A' as const,
  topics: [{ label: 'Тревога', href: '#booking' }],
};

describe('SiteContentAdminController — гейтинг по x-admin-key', () => {
  it('неверный ключ — ForbiddenException до какой-либо валидации тела', async () => {
    const { controller, content } = makeController();
    await expect(
      controller.setHeroPhoto({ dataUri: 'мусор' }, 'wrong'),
    ).rejects.toThrow(ForbiddenException);
    expect(content.setHeroPhoto).not.toHaveBeenCalled();
  });

  it('гейтинг применяется и к setMarquee', async () => {
    const { controller, content } = makeController();
    await expect(controller.setMarquee(validTopics, 'wrong')).rejects.toThrow(
      ForbiddenException,
    );
    expect(content.setMarqueeTopics).not.toHaveBeenCalled();
  });

  it('ADMIN_BOOKING_KEY не задан на сервере — закрыто даже пустым ключом клиента', async () => {
    const { controller, content } = makeController({ key: '' });
    await expect(
      controller.setHeroPhoto({ dataUri: 'data:image/png;base64,AA' }, ''),
    ).rejects.toThrow(ForbiddenException);
    expect(content.setHeroPhoto).not.toHaveBeenCalled();
  });
});

describe('SiteContentAdminController.setHeroPhoto — серверная валидация', () => {
  it('не data:image/ URI — отказ, сервис не вызывается', async () => {
    const { controller, content } = makeController();
    await expect(
      controller.setHeroPhoto(
        { dataUri: 'http://evil.example/x.png' },
        ADMIN_KEY,
      ),
    ).rejects.toThrow(BadRequestException);
    expect(content.setHeroPhoto).not.toHaveBeenCalled();
  });

  it('слишком большое фото — отказ (лимит 220KB, под глобальный body limit 256KB)', async () => {
    const { controller, content } = makeController();
    const huge = 'data:image/png;base64,' + 'A'.repeat(230 * 1024);
    await expect(
      controller.setHeroPhoto({ dataUri: huge }, ADMIN_KEY),
    ).rejects.toThrow(BadRequestException);
    expect(content.setHeroPhoto).not.toHaveBeenCalled();
  });

  it('валидная небольшая картинка доезжает до сервиса как есть', async () => {
    const { controller, content } = makeController();
    const dataUri = 'data:image/png;base64,AAAA';
    const res = await controller.setHeroPhoto({ dataUri }, ADMIN_KEY);
    expect(content.setHeroPhoto).toHaveBeenCalledWith(dataUri);
    expect(res).toEqual({ ok: true });
  });
});

describe('SiteContentAdminController.setMarquee — серверная валидация', () => {
  it('topic с пустым label — отказ', async () => {
    const { controller, content } = makeController();
    await expect(
      controller.setMarquee(
        { group: 'A', topics: [{ label: '  ', href: '#booking' }] },
        ADMIN_KEY,
      ),
    ).rejects.toThrow(BadRequestException);
    expect(content.setMarqueeTopics).not.toHaveBeenCalled();
  });

  it('topic с пустым href — отказ', async () => {
    const { controller, content } = makeController();
    await expect(
      controller.setMarquee(
        { group: 'B', topics: [{ label: 'Тревога', href: '' }] },
        ADMIN_KEY,
      ),
    ).rejects.toThrow(BadRequestException);
    expect(content.setMarqueeTopics).not.toHaveBeenCalled();
  });

  it('валидные topics передаются сервису с группой', async () => {
    const { controller, content } = makeController();
    const res = await controller.setMarquee(validTopics, ADMIN_KEY);
    expect(content.setMarqueeTopics).toHaveBeenCalledWith(
      'A',
      validTopics.topics,
    );
    expect(res).toEqual({ ok: true });
  });
});
