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
import type { DeliveryLogService } from './delivery-log.service';

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

/** Журнал отправок: по нему считается, кому досылать долг слота. */
function makeJournal(rows: unknown[] = []) {
  const slotRows = jest.fn().mockResolvedValue(rows);
  return {
    journal: { slotRows } as unknown as DeliveryLogService,
    slotRows,
  };
}

function makeService(
  result: PublishResult = okResult,
  lastPostAt: Date | null = null,
  rows: unknown[] = [],
) {
  const publish = jest.fn().mockResolvedValue(result);
  const retry = jest.fn().mockResolvedValue(okResult);
  const phrases = {
    lastPostAt: jest.fn().mockResolvedValue(lastPostAt),
  } as unknown as HealthyAdultService;
  const { journal, slotRows } = makeJournal(rows);
  const service = new ChannelScheduleService(
    { publish, retry } as unknown as ChannelPublisherService,
    phrases,
    journal,
  );
  return { service, publish, retry, phrases, slotRows };
}

/** Строка журнала: недошедшая площадка с текстом опубликованной фразы. */
const row = (platform: string, ok: boolean) => ({
  source: 'утро',
  platform,
  destination: platform === 'max' ? '-77' : '@ch',
  ok,
  reason: ok ? null : 'таймаут',
  text: 'фраза этого слота',
  createdAt: new Date(),
});

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

  describe('досылка тем, кто не принял пост', () => {
    // До 2026-08 частичный успех означал пропуск: слот закрывался, и упавшая
    // площадка теряла публикацию до следующего слота с другой фразой.
    const closedSlot = (rows: unknown[]) =>
      makeService(okResult, msk(10, 0), rows);

    it('досылает ту же фразу только должникам', async () => {
      spyLogger();
      const { service, retry, publish } = closedSlot([
        row('max', false),
        row('telegram', true),
      ]);

      await service.maybePost(msk(10, 30));

      expect(retry).toHaveBeenCalledWith('утро', 'фраза этого слота', ['max']);
      // Обычная публикация не повторяется — иначе дубль там, где пост вышел.
      expect(publish).not.toHaveBeenCalled();
    });

    it('успешная досылка закрывает историю сообщением владельцу', async () => {
      spyLogger();
      const { service } = closedSlot([row('max', false)]);
      await service.maybePost(msk(10, 30));
      expect(alertTexts()).toEqual([expect.stringContaining('досталось')]);
    });

    it('успешный повтор в журнале снимает долг площадки', async () => {
      spyLogger();
      // Новые записи сверху: повтор прошёл — досылать больше нечего.
      const { service, retry, slotRows } = closedSlot([
        { ...row('max', true), source: 'утро — повтор' },
        row('max', false),
      ]);
      await service.maybePost(msk(10, 30));
      expect(retry).not.toHaveBeenCalled();
      // Журнал всё же прочитан — решение принято по данным, а не по памяти.
      expect(slotRows).toHaveBeenCalledWith('утро', expect.any(Date));
    });

    it('не долбится бесконечно — три попытки на слот', async () => {
      spyLogger();
      const { service, retry } = makeService(okResult, msk(10, 0), [
        row('max', false),
      ]);
      (retry as jest.Mock).mockResolvedValue({
        ...okResult,
        ok: false,
        message: 'не дошло',
      });

      for (const minute of [10, 15, 20, 25, 30])
        await service.maybePost(msk(10, minute));

      expect(retry).toHaveBeenCalledTimes(3);
      // Каждая попытка — та же фраза тем же должникам.
      expect((retry as jest.Mock).mock.calls).toEqual(
        Array(3).fill(['утро', 'фраза этого слота', ['max']]),
      );
    });

    it('вне окна слота не досылает — публикация давно прошла', async () => {
      spyLogger();
      const { service, retry, slotRows } = closedSlot([row('max', false)]);
      await service.maybePost(msk(14, 0));
      expect(retry).not.toHaveBeenCalled();
      expect(slotRows).not.toHaveBeenCalled();
      // И владельца не дёргаем: вне окна досылать уже поздно.
      expect(alertTexts()).toEqual([]);
    });

    it('дошло везде — досылать нечего и в сеть не ходим', async () => {
      spyLogger();
      const { service, retry } = closedSlot([
        row('telegram', true),
        row('max', true),
      ]);
      await service.maybePost(msk(10, 30));
      expect(retry).not.toHaveBeenCalled();
      expect(alertTexts()).toEqual([]);
    });
  });

  it('tickMorning/tickEvening — обёртки крона, обе зовут maybePost без аргументов', async () => {
    // @Cron-декорированные методы — единственный вход в реальном рантайме
    // (сам maybePost тестируется напрямую выше с явным `now`). Если обёртка
    // забудет вызвать maybePost — крон тикает, а публикаций не будет никогда.
    spyLogger();
    const { service } = makeService();
    const spy = jest.spyOn(service, 'maybePost');

    await service.tickMorning();
    await service.tickEvening();

    // now не передан из крона — обёртка не подсовывает свой момент времени.
    expect(spy.mock.calls).toEqual([[], []]);
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
