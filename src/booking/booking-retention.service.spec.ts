// Обезличивание броней по сроку (L3 аудита 2026-07-20, решение владельца
// 2026-10-08): через 12 месяцев после даты сессии имя, контакт и текст запроса
// затираются, факт записи остаётся. Здесь — что именно уходит в updateMany;
// что запись в шифрованную колонку '' читается обратно — на живой базе
// (test/booking-pii-retention.e2e-spec.ts).
import {
  anonymizeCutoff,
  anonymizeDueAt,
  BOOKING_PII_RETENTION_MONTHS,
  BookingRetentionService,
} from './booking-retention.service';

const NOW = new Date('2026-10-08T04:41:00.000Z');
const CUTOFF = new Date('2025-10-08T04:41:00.000Z');

function make(opts: { fail?: boolean; count?: number } = {}) {
  const prisma = {
    booking: {
      updateMany: jest.fn(async () => {
        if (opts.fail) throw new Error('db down');
        return { count: opts.count ?? 4 };
      }),
    },
  };
  return { prisma, service: new BookingRetentionService(prisma as never) };
}

describe('anonymizeCutoff', () => {
  it('срок — 12 месяцев (решение владельца 2026-10-08)', () => {
    expect(BOOKING_PII_RETENTION_MONTHS).toBe(12);
  });

  it('обычная дата: ровно год назад, время суток сохраняется', () => {
    expect(anonymizeCutoff(NOW).toISOString()).toBe('2025-10-08T04:41:00.000Z');
  });

  it('не мутирует переданную дату', () => {
    const now = new Date(NOW.getTime());
    anonymizeCutoff(now);
    expect(now.getTime()).toBe(NOW.getTime());
  });

  it('переход через границу года: январь → январь прошлого года', () => {
    expect(
      anonymizeCutoff(new Date('2026-01-15T04:41:00.000Z')).toISOString(),
    ).toBe('2025-01-15T04:41:00.000Z');
  });

  it('31 марта: в марте 31 день и в прошлом году — граница 31 марта', () => {
    expect(
      anonymizeCutoff(new Date('2027-03-31T04:41:00.000Z')).toISOString(),
    ).toBe('2026-03-31T04:41:00.000Z');
  });

  // Фиксируем фактическое поведение setUTCMonth, а не «красивое»: 29 февраля
  // високосного года минус 12 месяцев — это 29 февраля невисокосного, которого
  // нет, и дата переливается вперёд на 1 марта. Граница сдвигается на сутки
  // относительно «28 февраля»; для ретеншена это допустимо (обезличиваем на
  // сутки раньше, а не позже).
  it('29 февраля високосного года → 1 марта прошлого года (перелив setUTCMonth)', () => {
    expect(
      anonymizeCutoff(new Date('2028-02-29T04:41:00.000Z')).toISOString(),
    ).toBe('2027-03-01T04:41:00.000Z');
  });

  it('28 февраля невисокосного года, прошлый год високосный → 28 февраля', () => {
    expect(
      anonymizeCutoff(new Date('2029-02-28T00:00:00.000Z')).toISOString(),
    ).toBe('2028-02-28T00:00:00.000Z');
  });
});

describe('anonymizeDueAt', () => {
  it('срок брони — дата сессии плюс 12 месяцев', () => {
    expect(
      anonymizeDueAt(new Date('2025-10-08T10:00:00.000Z')).toISOString(),
    ).toBe('2026-10-08T10:00:00.000Z');
  });

  // Срок и граница согласованы: бронь берётся ровно тогда, когда «сейчас»
  // переходит её срок. Иначе /stats обещал бы одну дату, а крон работал по другой.
  it('согласован с anonymizeCutoff: на сроке бронь ещё не берётся, на секунду позже — берётся', () => {
    const startsAt = new Date('2025-10-08T10:00:00.000Z');
    const due = anonymizeDueAt(startsAt);
    const taken = (now: Date) => startsAt < anonymizeCutoff(now);
    expect(taken(due)).toBe(false);
    expect(taken(new Date(due.getTime() + 1000))).toBe(true);
  });
});

describe('BookingRetentionService.anonymizeOld', () => {
  it('updateMany: точное условие и точный набор затираемых полей', async () => {
    const { prisma, service } = make();
    await service.anonymizeOld(NOW);
    expect(prisma.booking.updateMany).toHaveBeenCalledTimes(1);
    expect(prisma.booking.updateMany).toHaveBeenCalledWith({
      where: { startsAt: { lt: CUTOFF }, anonymizedAt: null },
      data: {
        clientName: '',
        clientContact: '',
        message: null,
        anonymizedAt: NOW,
      },
    });
  });

  // Факт записи не трогается: список полей в data закрытый. Если кто-то
  // добавит туда ещё одно поле, тест краснеет и вынуждает пересмотреть
  // решение владельца, а не расширить молча.
  it('затираются только clientName, clientContact, message (+ метка anonymizedAt)', async () => {
    const { prisma, service } = make();
    await service.anonymizeOld(NOW);
    const [arg] = prisma.booking.updateMany.mock.calls[0] as unknown as [
      { data: Record<string, unknown> },
    ];
    expect(Object.keys(arg.data).sort()).toEqual(
      ['anonymizedAt', 'clientName', 'clientContact', 'message'].sort(),
    );
  });

  // Мок не вычисляет where сам; чтобы проверить границу, прогоняем переданный
  // фильтр по трём броням руками (строгое «меньше»). Тот же сценарий на живом
  // Postgres — test/booking-pii-retention.e2e-spec.ts.
  it('граница окна: бронь ровно на границе и на день свежее не берутся, на день старше — берётся', async () => {
    const { prisma, service } = make();
    await service.anonymizeOld(NOW);
    const [arg] = prisma.booking.updateMany.mock.calls[0] as unknown as [
      { where: { startsAt: { lt: Date }; anonymizedAt: null } },
    ];
    const taken = (startsAt: Date) => startsAt < arg.where.startsAt.lt;
    expect(taken(new Date(CUTOFF.getTime() - 86_400_000))).toBe(true);
    expect(taken(CUTOFF)).toBe(false);
    expect(taken(new Date(CUTOFF.getTime() + 86_400_000))).toBe(false);
  });

  it('уже обезличенные строки фильтром не берутся (anonymizedAt: null)', async () => {
    const { prisma, service } = make();
    await service.anonymizeOld(NOW);
    const [arg] = prisma.booking.updateMany.mock.calls[0] as unknown as [
      { where: { anonymizedAt: null } },
    ];
    expect(arg.where.anonymizedAt).toBeNull();
  });

  it('возвращает число обезличенных строк', async () => {
    const { service } = make({ count: 7 });
    await expect(service.anonymizeOld(NOW)).resolves.toEqual({ anonymized: 7 });
  });

  it('нечего обезличивать — {anonymized: 0}, без исключения', async () => {
    const { service } = make({ count: 0 });
    await expect(service.anonymizeOld(NOW)).resolves.toEqual({ anonymized: 0 });
  });

  it('ошибка БД не бросается наружу (крон не падает), возвращается 0', async () => {
    const { service } = make({ fail: true });
    await expect(service.anonymizeOld(NOW)).resolves.toEqual({ anonymized: 0 });
  });

  it('без аргумента берёт текущее время (так его вызывает расписание)', async () => {
    const { prisma, service } = make();
    const before = Date.now();
    await service.anonymizeOld();
    const [arg] = prisma.booking.updateMany.mock.calls[0] as unknown as [
      { data: { anonymizedAt: Date } },
    ];
    expect(arg.data.anonymizedAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(arg.data.anonymizedAt.getTime()).toBeLessThanOrEqual(Date.now());
  });
});
