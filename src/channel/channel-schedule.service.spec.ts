// Расписание канала: когда пора говорить, когда пора перестать пробовать и как
// владелец об этом узнаёт.
//
// Инцидент 2026-07-29: отправка падала, пост не записывался — и тик крона (раз
// в 5 минут, окно два часа) пробовал снова 24 раза за утро, каждый раз отправляя
// владельцу отдельный DM.
//
// Инцидент 2026-07-31: пост вышел не на все площадки, а сообщения владельцу не
// пришло вовсе. Алерт шёл через logger.error → AlertLogger, у которого свой
// троттлинг и молчаливое проглатывание ошибок. Теперь расписание зовёт
// notifyAdminWithFallback напрямую — это и проверяется здесь.
import { Logger } from '@nestjs/common';
import { ChannelScheduleService } from './channel-schedule.service';
import type { ChannelPublisherService } from './channel-publisher.service';
import type { PublishResult } from './channel-target';
import type { HealthyAdultService } from '../bot/healthy-adult.service';
import { notifyAdminWithFallback } from '../utils/admin-alert';

jest.mock('../utils/admin-alert', () => ({
  notifyAdminWithFallback: jest.fn().mockResolvedValue(undefined),
}));
const alerts = notifyAdminWithFallback as jest.Mock;
/** Тексты DM владельцу — то, ради чего расписание вообще говорит. */
const alertTexts = () => alerts.mock.calls.map((c) => String(c[0]));

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
  silent: [],
};

const failResult: PublishResult = {
  ok: false,
  posted: false,
  message: '❌ Не дошло: Telegram (@ch) — ETIMEDOUT',
  delivered: [],
  failed: [{ ...delivered(), reason: 'ETIMEDOUT' }],
  silent: [],
};

const partialResult: PublishResult = {
  ok: false,
  posted: true,
  message: '⚠️ Опубликовано: Telegram (@ch)',
  delivered: [delivered()],
  failed: [{ ...delivered('vk'), reason: '403: нет доступа' }],
  silent: [],
};

const silentResult: PublishResult = {
  ...okResult,
  silent: [{ title: 'Threads', envKey: 'HEALTHY_ADULT_THREADS_USER' }],
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

/** Логи расписания: тихий тик не пишет ничего. */
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
  beforeEach(() => alerts.mockClear());
  afterEach(() => jest.restoreAllMocks());

  it('вне окна (день) — тик молчит и не тревожит владельца', async () => {
    const { errors, warns, texts } = spyLogger();
    const { service, publish } = makeService();
    await service.maybePost(msk(13, 0));
    expect(publish).not.toHaveBeenCalled();
    expect([...texts(errors), ...texts(warns)]).toEqual([]);
    expect(alerts).not.toHaveBeenCalled();
  });

  it('в конце утреннего окна публикует, если сегодня ещё не постили', async () => {
    // 10:55 МСК — offset 115 ≥ любой planned (<116), lastPostAt=null.
    const { errors, warns, texts } = spyLogger();
    const { service, publish } = makeService();
    await service.maybePost(msk(10, 55));
    expect(publish).toHaveBeenCalledTimes(1);
    // Слот попадает в журнал именем, понятным владельцу.
    expect(publish).toHaveBeenCalledWith('утро');
    // Удачная публикация проходит молча — DM владельцу только при сбое.
    expect([...texts(errors), ...texts(warns)]).toEqual([]);
    expect(alerts).not.toHaveBeenCalled();
  });

  it('вечерний слот подписан вечером — журнал не путает утро с вечером', async () => {
    spyLogger();
    const { service, publish } = makeService();
    await service.maybePost(msk(19, 55));
    expect(publish).toHaveBeenCalledWith('вечер');
  });

  it('не постит второй раз в тот же слот (lastPostAt в окне)', async () => {
    const { errors, warns, texts } = spyLogger();
    const { service, publish } = makeService(okResult, msk(10, 0));
    await service.maybePost(msk(10, 55));
    expect(publish).not.toHaveBeenCalled();
    expect([...texts(errors), ...texts(warns)]).toEqual([]);
    expect(alerts).not.toHaveBeenCalled();
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
      // Первые две попытки — тихие warn, третья будит владельца (см. ниже).
      expect(texts(warns).filter((t) => t.includes('попытка'))).toEqual([
        expect.stringContaining('попытка 1'),
        expect.stringContaining('попытка 2'),
      ]);
    });

    it('владельца будим ровно один раз — на исчерпании попыток', async () => {
      const { service } = failingTicks();
      for (const minute of [55, 56, 57, 58, 59]) {
        await service.maybePost(msk(10, minute));
      }
      expect(alerts).toHaveBeenCalledTimes(1);
      expect(alertTexts()[0]).toContain('ETIMEDOUT');
      expect(alertTexts()[0]).toContain('не вышло ничего');
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
      expect(texts(warns).filter((t) => t.includes('попытка'))).toEqual([]);
    });

    it('владелец узнаёт, какая площадка не приняла пост', async () => {
      const { service } = partialTicks();
      await service.maybePost(msk(10, 55));
      expect(alerts).toHaveBeenCalledTimes(1);
      expect(alertTexts()[0]).toContain('vk');
      expect(alertTexts()[0]).toContain('403: нет доступа');
    });

    it('DM уходит напрямую, а не через logger.error', async () => {
      // Инцидент 2026-07-31: единственный путь сообщения шёл через AlertLogger,
      // и когда оно не дошло, у владельца не осталось ничего.
      const { service, errors } = partialTicks();
      await service.maybePost(msk(10, 55));
      expect(alertTexts()).toEqual([expect.stringContaining('дошло не везде')]);
      expect(errors).not.toHaveBeenCalled();
    });
  });

  it('выключенная площадка названа в отчёте, а не пропущена молча', async () => {
    // Молчание площадки без env раньше было неотличимо от успеха.
    spyLogger();
    const { service } = makeService(silentResult);
    await service.maybePost(msk(10, 55));
    expect(alerts).toHaveBeenCalledTimes(1);
    expect(alertTexts()[0]).toContain('Threads');
    expect(alertTexts()[0]).toContain('HEALTHY_ADULT_THREADS_USER');
  });
});
