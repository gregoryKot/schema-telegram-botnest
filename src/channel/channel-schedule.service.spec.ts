// Расписание канала: когда пора говорить и когда пора перестать пробовать.
// Инцидент 2026-07-29: отправка падала, пост не записывался — и тик крона
// (раз в 5 минут, окно два часа) пробовал снова 24 раза за утро, каждый раз
// логируя error, то есть отправляя владельцу отдельный DM.
import { Logger } from '@nestjs/common';
import { ChannelScheduleService } from './channel-schedule.service';
import type { ChannelPublisherService } from './channel-publisher.service';
import type { PublishResult } from './channel-target';
import type { HealthyAdultService } from '../bot/healthy-adult.service';

const delivered = (platform = 'telegram') => ({
  platform,
  title: platform,
  destination: '@ch',
});

const okResult: PublishResult = {
  ok: true,
  posted: true,
  message: '✅ Опубликовано',
  delivered: [delivered()],
  failed: [],
};

const failResult: PublishResult = {
  ok: false,
  posted: false,
  message: '❌ Не дошло: Telegram (@ch) — ETIMEDOUT',
  delivered: [],
  failed: [{ ...delivered(), reason: 'ETIMEDOUT' }],
};

const partialResult: PublishResult = {
  ok: false,
  posted: true,
  message: '⚠️ Опубликовано: Telegram (@ch)',
  delivered: [delivered()],
  failed: [{ ...delivered('vk'), reason: '403: нет доступа' }],
};

function makeService(
  result: PublishResult = okResult,
  lastPostAt: Date | null = null,
) {
  const publish = jest.fn().mockResolvedValue(result);
  const phrases = {
    lastPostAt: jest.fn().mockResolvedValue(lastPostAt),
  } as unknown as HealthyAdultService;
  const service = new ChannelScheduleService(
    { publish } as unknown as ChannelPublisherService,
    phrases,
  );
  return { service, publish, phrases };
}

/** Логи расписания = то, что увидит владелец: тихий тик не пишет ничего. */
function spyLogger() {
  const errors = jest
    .spyOn(Logger.prototype, 'error')
    .mockImplementation(() => undefined);
  const warns = jest
    .spyOn(Logger.prototype, 'warn')
    .mockImplementation(() => undefined);
  const texts = (spy: jest.SpyInstance) =>
    spy.mock.calls.map((c) => String(c[0]));
  return { errors, warns, texts };
}

// Момент по МСК → UTC (МСК = UTC+3).
const msk = (hour: number, minute = 0): Date =>
  new Date(Date.UTC(2026, 6, 20, hour - 3, minute));

describe('ChannelScheduleService', () => {
  afterEach(() => jest.restoreAllMocks());

  it('вне окна (день) — тик молчит и не тревожит владельца', async () => {
    const { errors, warns, texts } = spyLogger();
    const { service, publish } = makeService();
    await service.maybePost(msk(13, 0));
    expect(publish).not.toHaveBeenCalled();
    expect([...texts(errors), ...texts(warns)]).toEqual([]);
  });

  it('в конце утреннего окна публикует, если сегодня ещё не постили', async () => {
    // 10:55 МСК — offset 115 ≥ любой planned (<116), lastPostAt=null.
    const { errors, warns, texts } = spyLogger();
    const { service, publish } = makeService();
    await service.maybePost(msk(10, 55));
    expect(publish).toHaveBeenCalledTimes(1);
    // Удачная публикация проходит молча — DM владельцу только при сбое.
    expect([...texts(errors), ...texts(warns)]).toEqual([]);
  });

  it('не постит второй раз в тот же слот (lastPostAt в окне)', async () => {
    const { errors, warns, texts } = spyLogger();
    const { service, publish } = makeService(okResult, msk(10, 0));
    await service.maybePost(msk(10, 55));
    expect(publish).not.toHaveBeenCalled();
    expect([...texts(errors), ...texts(warns)]).toEqual([]);
  });

  it('сбой чтения последнего поста не роняет тик', async () => {
    const { service, phrases } = makeService();
    (phrases.lastPostAt as jest.Mock).mockRejectedValue(new Error('db down'));
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    await expect(service.maybePost(msk(10, 55))).resolves.toBeUndefined();
  });

  describe('повторы при полном сбое отправки', () => {
    const failingTicks = () => ({ ...spyLogger(), ...makeService(failResult) });

    it('пробует не больше трёх раз за слот, а не весь два часа', async () => {
      const { service, publish, warns, texts } = failingTicks();
      for (const minute of [55, 56, 57, 58, 59]) {
        await service.maybePost(msk(10, minute));
      }
      expect(publish).toHaveBeenCalledTimes(3);
      // Первые две попытки — тихие warn, третья уходит в error (см. ниже).
      expect(texts(warns)).toEqual([
        expect.stringContaining('попытка 1'),
        expect.stringContaining('попытка 2'),
      ]);
    });

    it('владельца будим ровно один раз — на исчерпании попыток', async () => {
      const { service, errors } = failingTicks();
      for (const minute of [55, 56, 57, 58, 59]) {
        await service.maybePost(msk(10, minute));
      }
      expect(errors).toHaveBeenCalledTimes(1);
      expect(String(errors.mock.calls[0][0])).toContain('ETIMEDOUT');
      expect(String(errors.mock.calls[0][0])).toContain('попытка 3');
    });

    it('вечерний слот не наказан за утренние неудачи', async () => {
      const { service, publish, warns, texts } = failingTicks();
      for (const minute of [55, 56, 57])
        await service.maybePost(msk(10, minute));
      publish.mockClear();
      await service.maybePost(msk(19, 55));
      expect(publish).toHaveBeenCalledTimes(1);
      // Счёт попыток у вечера свой — начинается с первой, а не с четвёртой.
      expect(texts(warns).at(-1)).toContain('evening: попытка 1');
    });
  });

  describe('частичный успех', () => {
    const partialTicks = () => ({
      ...spyLogger(),
      ...makeService(partialResult),
    });

    it('не считается неудачей — попытки слота не сгорают', async () => {
      // В бою повтора не будет: пост записан, и dueSlot закроет слот. Здесь
      // фейковый lastPostAt не двигается, поэтому видно главное — частичный
      // успех не копит счётчик неудач и не упирается в лимит трёх попыток.
      const { service, publish, warns, texts } = partialTicks();
      for (const minute of [55, 56, 57, 58]) {
        await service.maybePost(msk(10, minute));
      }
      expect(publish).toHaveBeenCalledTimes(4);
      expect(texts(warns)).toEqual([]);
    });

    it('владелец узнаёт, какая площадка не приняла пост', async () => {
      const { service, errors } = partialTicks();
      await service.maybePost(msk(10, 55));
      expect(errors).toHaveBeenCalledTimes(1);
      expect(String(errors.mock.calls[0][0])).toContain('vk');
      expect(String(errors.mock.calls[0][0])).toContain('403: нет доступа');
    });
  });
});
