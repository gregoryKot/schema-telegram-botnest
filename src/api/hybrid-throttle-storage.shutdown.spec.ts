// Шов «app.close() → ничто не держит процесс» через настоящий Nest: первый
// прогон CI PR #492 повис на 47 минут в джобе migrations, потому что часовые
// таймеры истечения штатного хранилища (ttl 3_600_000 на маршрутах слотов)
// держали процесс jest после закрытия тестового приложения. Прод теперь на
// MemoryThrottleStorage без таймеров; пин — «таймеров 0 и до, и после».
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

  it('хит на часовом ttl не оставляет таймеров, app.close() их тоже не создаёт', async () => {
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
    expect(jest.getTimerCount()).toBe(0);

    await app.close();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('КОНТРОЛЬ: голое штатное хранилище оставляет таймер — именно его и держал jest', async () => {
    // Покраснеет, если библиотека перестанет ставить таймер на хит.
    const lib = new ThrottlerStorageService();
    await lib.increment('mem-key', 3_600_000, 300, 3_600_000, 'long');
    expect(jest.getTimerCount()).toBe(1);
    lib.onApplicationShutdown();
    expect(jest.getTimerCount()).toBe(0);
  });
});
