// Отчёт о публикации — единственное, что владелец о канале читает (/zv,
// кнопка в админке, алерт при сбое). Проверяем все исходы, включая пустые
// состояния: ни одной площадки и пустой пул должны читаться как разные беды.
import {
  allDisabled,
  emptyPool,
  failedSummary,
  fanoutResult,
} from './publish-report';
import type { Delivery, DeliveryFailure } from './channel-target';

const tg: Delivery = {
  platform: 'telegram',
  title: 'Telegram',
  destination: '@ch',
};
const vk: Delivery = {
  platform: 'vk',
  title: 'ВКонтакте',
  destination: 'club1',
};
const failedVk: DeliveryFailure = { ...vk, reason: '403: нет доступа' };

describe('publish-report', () => {
  describe('allDisabled', () => {
    it('называет env каждой площадки — чинить надо настройку, а не отправку', () => {
      const res = allDisabled([
        { title: 'Telegram', envKey: 'HEALTHY_ADULT_CHANNEL' },
        { title: 'ВКонтакте', envKey: 'HEALTHY_ADULT_VK' },
      ]);
      expect(res.posted).toBe(false);
      expect(res.ok).toBe(false);
      expect(res.message).toContain('HEALTHY_ADULT_CHANNEL');
      expect(res.message).toContain('HEALTHY_ADULT_VK');
    });

    it('без единой площадки не показывает мусорный хвост', () => {
      const res = allDisabled([]);
      expect(res.message).toBe(
        '⚠️ Постинг выключен: ни одна площадка не настроена.',
      );
      expect(res.delivered).toEqual([]);
      expect(res.failed).toEqual([]);
    });
  });

  it('emptyPool отправляет за фразами в админку', () => {
    const res = emptyPool();
    expect(res.posted).toBe(false);
    expect(res.message).toContain('админке');
  });

  describe('fanoutResult', () => {
    it('дошло везде — галка, площадки и сам текст', () => {
      const res = fanoutResult('текст', [tg, vk], []);
      expect(res.ok).toBe(true);
      expect(res.posted).toBe(true);
      expect(res.message).toContain('✅');
      expect(res.message).toContain('Telegram (@ch)');
      expect(res.message).toContain('ВКонтакте (club1)');
      expect(res.message).toContain('текст');
    });

    it('дошло не везде — пост состоялся, но упавшая площадка названа', () => {
      const res = fanoutResult('текст', [tg], [failedVk]);
      expect(res.posted).toBe(true);
      expect(res.ok).toBe(false);
      expect(res.message).toContain('⚠️');
      expect(res.message).toContain('Telegram (@ch)');
      expect(res.message).toContain('ВКонтакте (club1) — 403: нет доступа');
    });

    it('не дошло никуда — только причины, без текста поста', () => {
      const res = fanoutResult('текст', [], [{ ...tg, reason: 'ETIMEDOUT' }]);
      expect(res.posted).toBe(false);
      expect(res.ok).toBe(false);
      expect(res.message).toContain('❌');
      expect(res.message).toContain('ETIMEDOUT');
      expect(res.message).not.toContain('текст');
    });
  });

  it('failedSummary — по строке на площадку', () => {
    expect(failedSummary([failedVk, { ...tg, reason: 'chat not found' }])).toBe(
      'ВКонтакте (club1) — 403: нет доступа\nTelegram (@ch) — chat not found',
    );
  });
});
