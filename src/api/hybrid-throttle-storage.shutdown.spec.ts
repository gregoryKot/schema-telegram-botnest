// Шов «app.close() → таймеры штатного хранилища очищены» через настоящий
// Nest: первый прогон CI PR #492 повис на 47 минут в джобе migrations,
// потому что HybridThrottleStorage не пробрасывал onApplicationShutdown, и
// часовые таймеры истечения (ttl 3_600_000 на маршрутах слотов) держали
// процесс jest после закрытия тестового приложения.
import { Test } from '@nestjs/testing';
import { ThrottlerModule, ThrottlerStorage } from '@nestjs/throttler';
import { HybridThrottleStorage } from './hybrid-throttle-storage';

describe('HybridThrottleStorage — остановка приложения', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('после app.close() таймеров истечения не остаётся (хук доходит до памяти)', async () => {
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
    await fromDi.increment('mem-key', 3_600_000, 300, 3_600_000, 'long');
    expect(jest.getTimerCount()).toBeGreaterThan(0);

    await app.close();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('КОНТРОЛЬ: без вызова хука таймер остаётся — именно его и держал jest', async () => {
    const storage = new HybridThrottleStorage({} as never);
    await storage.increment('mem-key', 3_600_000, 300, 3_600_000, 'long');
    expect(jest.getTimerCount()).toBe(1);
    storage.onApplicationShutdown();
    expect(jest.getTimerCount()).toBe(0);
  });
});
