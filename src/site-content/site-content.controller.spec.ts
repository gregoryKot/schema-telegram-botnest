// Публичное чтение hero-фото и marquee-тем: тонкий контроллер, но именно им
// открывается лендинг — падение здесь роняет главную страницу сайта.
import { SiteContentController } from './site-content.controller';
import type { SiteContentService } from './site-content.service';

describe('SiteContentController', () => {
  it('get() отдаёт то, что вернул сервис — без искажений', async () => {
    const content = {
      getPublicContent: jest.fn().mockResolvedValue({
        heroPhoto: null,
        marqueeTopicsA: [{ label: 'Тревога', href: '#booking' }],
        marqueeTopicsB: [],
      }),
    } as unknown as SiteContentService;
    const controller = new SiteContentController(content);

    await expect(controller.get()).resolves.toEqual({
      heroPhoto: null,
      marqueeTopicsA: [{ label: 'Тревога', href: '#booking' }],
      marqueeTopicsB: [],
    });
    expect(content.getPublicContent).toHaveBeenCalledTimes(1);
  });
});
