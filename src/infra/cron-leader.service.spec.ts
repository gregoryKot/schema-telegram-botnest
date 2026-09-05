// Юнит-уровень CronLeaderService: форма запроса и решение по ответу БД.
// Саму атомарность здесь проверить нельзя — она свойство Postgres, а не
// нашего кода; для неё есть test/cron-leader.e2e-spec.ts на живой базе
// (джоба `migrations`). Тут ловим то, что на живой базе выглядело бы
// «просто работает»: границу окна, порядок значений в запросе и поведение
// при недоступной БД.
import { CronLeaderService, LEASE_WINDOW } from './cron-leader.service';

function makeLeader(executeRaw: jest.Mock) {
  const prisma = { $executeRaw: executeRaw } as never;
  return { leader: new CronLeaderService(prisma), executeRaw };
}

describe('CronLeaderService.claimRun', () => {
  it('строка обновилась (1) → этот инстанс лидер', async () => {
    const { leader } = makeLeader(jest.fn().mockResolvedValue(1));

    await expect(leader.claimRun('cron', LEASE_WINDOW.hourly)).resolves.toBe(
      true,
    );
  });

  it('строк не тронуто (0) → тик уже забрал другой инстанс', async () => {
    const { leader } = makeLeader(jest.fn().mockResolvedValue(0));

    await expect(leader.claimRun('cron', LEASE_WINDOW.hourly)).resolves.toBe(
      false,
    );
  });

  it('запрос уходит с именем, временем прогона и границей окна', async () => {
    const executeRaw = jest.fn().mockResolvedValue(1);
    const { leader } = makeLeader(executeRaw);
    const now = new Date('2026-09-05T12:00:00.000Z');

    await leader.claimRun('midnightPlanner', LEASE_WINDOW.hourly, now);

    // Тег-функция: [0] — куски шаблона, дальше подставляемые значения.
    const [chunks, ...values] = executeRaw.mock.calls[0] as [
      string[],
      ...unknown[],
    ];
    const sql = chunks.join(' ');
    // Именно upsert с условием: обычный INSERT падал бы на второй прогон,
    // а UPDATE без условия забирал бы тик всегда — оба варианта бесполезны.
    expect(sql).toContain('INSERT INTO "CronLease"');
    expect(sql).toContain('ON CONFLICT');
    expect(sql).toContain('"CronLease"."runAt" <=');
    const [name, runAt, , , , notAfter] = values as [
      string,
      Date,
      string,
      Date,
      string,
      Date,
    ];
    expect(name).toBe('midnightPlanner');
    expect(runAt).toEqual(now);
    // Граница окна отсчитывается назад от «сейчас»: прогон старше её —
    // законный повод забрать тик, моложе — тот же тик, который уже отработали.
    expect(notAfter).toEqual(new Date(now.getTime() - LEASE_WINDOW.hourly));
  });

  it('БД недоступна → тик пропускается, а не дублируется, и ошибка не всплывает', async () => {
    const executeRaw = jest
      .fn()
      .mockRejectedValue(new Error('P1017 Server has closed the connection'));
    const { leader } = makeLeader(executeRaw);

    // Дубль хуже пропуска: тело крона всё равно ходит в ту же БД и упало бы
    // следом. Плюс проверяем, что до запроса реально дошли, — иначе тест
    // зеленел бы и на сервисе, который вообще ничего не делает.
    await expect(leader.claimRun('cron', LEASE_WINDOW.daily)).resolves.toBe(
      false,
    );
    expect(executeRaw).toHaveBeenCalledTimes(1);
  });
});

describe('LEASE_WINDOW', () => {
  it('каждое окно меньше своего периода — иначе законный тик не наступит', () => {
    expect(LEASE_WINDOW.everyMinute).toBeLessThan(60_000);
    expect(LEASE_WINDOW.fiveMinutes).toBeLessThan(5 * 60_000);
    expect(LEASE_WINDOW.fifteenMinutes).toBeLessThan(15 * 60_000);
    expect(LEASE_WINDOW.hourly).toBeLessThan(3_600_000);
    expect(LEASE_WINDOW.daily).toBeLessThan(24 * 3_600_000);
  });
});
