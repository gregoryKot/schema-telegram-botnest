// Шов «app.close() → ничто не держит процесс» через настоящий Nest: первый
// прогон CI PR #492 повис на 47 минут в джобе migrations, потому что часовые
// таймеры истечения штатного хранилища 6.5.0 (по таймеру на КАЖДЫЙ хит, ttl
// 3_600_000 на маршрутах слотов) держали процесс jest после закрытия тестового
// приложения. С 6.7.1 у штатного хранилища один таймер выметания на всё
// хранилище (unref), и снимает его onApplicationShutdown — пин ниже: таймеров
// не больше одного при любом числе хитов и ноль после app.close().
import { Test } from '@nestjs/testing';
import {
  ThrottlerModule,
  ThrottlerStorage,
  ThrottlerStorageService,
} from '@nestjs/throttler';
import { HybridThrottleStorage } from './hybrid-throttle-storage';

describe('HybridThrottleStorage — остановка приложения', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('хиты на часовом ttl ставят один таймер выметания, app.close() его снимает', async () => {
    const storage = new HybridThrottleStorage({} as never);
    const moduleRef = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot({
          throttlers: [{ name: 'long', ttl: 3_600_000, limit: 300 }],
          storage,
        }),
      ],
    }).compile();
    const app = moduleRef.createNestApplication();
    await app.init();

    const fromDi = app.get<ThrottlerStorage>(ThrottlerStorage);
    expect(fromDi).toBe(storage);
    for (let i = 0; i < 20; i++)
      await fromDi.increment(`mem-${i}`, 3_600_000, 300, 3_600_000, 'long');
    expect(jest.getTimerCount()).toBe(1);

    await app.close();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('КОНТРОЛЬ: штатное хранилище не ставит таймер на хит — иначе вернулся класс PR #492', async () => {
    const lib = new ThrottlerStorageService();
    for (let i = 0; i < 20; i++)
      await lib.increment(`mem-${i}`, 3_600_000, 300, 3_600_000, 'long');
    expect(jest.getTimerCount()).toBe(1);
    lib.onApplicationShutdown();
    expect(jest.getTimerCount()).toBe(0);
  });
});
