// Аналог P-2 (аудит 2026-07) для донатов: ретраи Robokassa webhook по одному
// InvId не должны задваивать алерт админу / повторно списывать статус paid.
// Стиль — как booking.payment.spec.ts / subscription.payment.spec.ts: CAS
// эмулируется через updateMany, привязанный к текущему статусу строки.
import { DonationService, DONATION_INVID_BASE } from './donation.service';

function makeService(row: any) {
  const state = { row: { ...row } };
  const prisma: any = {
    donation: {
      findUnique: jest.fn(async ({ where }: any) =>
        where.id === state.row.id ? state.row : null,
      ),
      updateMany: jest.fn(async ({ where, data }: any) => {
        if (where.id !== state.row.id) return { count: 0 };
        if (state.row.status === 'paid') return { count: 0 };
        Object.assign(state.row, data);
        return { count: 1 };
      }),
    },
  };
  const notify = { alertAdmin: jest.fn(async () => undefined) };
  const robokassa = { enabled: true };
  const config = { get: () => undefined };
  const service = new DonationService(
    prisma,
    robokassa as any,
    notify as any,
    config as any,
  );
  return { service, prisma, notify, state };
}

const PENDING = { id: 10, amount: 300, source: 'app', status: 'pending' };

describe('DonationService.markPaidByInvId — идемпотентность (аналог P-2)', () => {
  it('первый webhook помечает paid и шлёт алерт один раз', async () => {
    const { service, notify, state } = makeService(PENDING);
    await expect(
      service.markPaidByInvId(DONATION_INVID_BASE + 10, 300),
    ).resolves.toEqual({ ok: true });
    expect(state.row.status).toBe('paid');
    expect(notify.alertAdmin).toHaveBeenCalledTimes(1);
  });

  it('повторный webhook по уже paid — ok:true БЕЗ повторного алерта', async () => {
    const { service, notify } = makeService(PENDING);
    await service.markPaidByInvId(DONATION_INVID_BASE + 10, 300);
    await expect(
      service.markPaidByInvId(DONATION_INVID_BASE + 10, 300),
    ).resolves.toEqual({ ok: true });
    expect(notify.alertAdmin).toHaveBeenCalledTimes(1); // не задвоилось
  });

  it('уже paid при первом обращении (гонка двух webhook) — no-op без алерта', async () => {
    const { service, notify } = makeService({ ...PENDING, status: 'paid' });
    await expect(
      service.markPaidByInvId(DONATION_INVID_BASE + 10, 300),
    ).resolves.toEqual({ ok: true });
    expect(notify.alertAdmin).not.toHaveBeenCalled();
  });

  it('несовпадение суммы шлёт алерт, но не блокирует зачисление (в отличие от booking.confirm)', async () => {
    const { service, notify, state } = makeService(PENDING);
    await expect(
      service.markPaidByInvId(DONATION_INVID_BASE + 10, 999),
    ).resolves.toEqual({ ok: true });
    expect(state.row.status).toBe('paid');
    // Один алерт про расхождение суммы + сообщение о самом донате.
    expect(notify.alertAdmin).toHaveBeenCalledTimes(2);
    expect(notify.alertAdmin.mock.calls[0][0]).toContain('сумма расходится');
  });

  it('несуществующий donation id — тихий ok:true, без падения', async () => {
    const { service } = makeService(PENDING);
    await expect(
      service.markPaidByInvId(DONATION_INVID_BASE + 999999, 300),
    ).resolves.toEqual({ ok: true });
  });

  // Проигранная гонка CAS: между чтением строки и записью её успел забрать
  // другой обработчик того же webhook. Тесты выше сюда не доходили вовсе
  // (mutation-прогон показал NoCoverage на `claimed.count === 0`), а это и
  // есть настоящая защита от задвоения: ранний выход по `status === 'paid'`
  // читает УСТАРЕВШИЙ снимок строки и потому спасает не всегда — на два
  // параллельных ретрая Robokassa оба увидят pending. Без этой ветки
  // благодарность за донат уходила бы дважды.
  it('строку забрал параллельный обработчик (updateMany вернул 0) — без второго алерта', async () => {
    const prisma: any = {
      donation: {
        // Читаем ещё не оплаченную строку…
        findUnique: jest.fn(async () => ({ ...PENDING })),
        // …а к моменту записи её уже забрал другой обработчик.
        updateMany: jest.fn(async () => ({ count: 0 })),
      },
    };
    const notify = { alertAdmin: jest.fn(async () => undefined) };
    const service = new DonationService(
      prisma,
      { enabled: true } as any,
      notify as any,
      { get: () => undefined } as any,
    );

    await expect(
      service.markPaidByInvId(DONATION_INVID_BASE + 10, 300),
    ).resolves.toEqual({ ok: true });

    expect(prisma.donation.updateMany).toHaveBeenCalledTimes(1);
    // Ключевое: сообщение «Донат N ₽» шлёт тот, кто реально забрал строку.
    expect(notify.alertAdmin).not.toHaveBeenCalled();
  });

  // Первая (по строке) идемпотентная защита — ДО проверки расхождения суммы.
  // mutation-прогон нашёл, что `row.status === 'paid'` можно заменить на
  // `false` незаметно: уже оплаченный донат при повторном webhook с ДРУГОЙ
  // суммой (например, Robokassa прислала копейки по-другому при ретрае) ложно
  // алертил бы «сумма расходится» на каждый повтор — без этой ветки ранний
  // выход не срабатывает вовсе.
  it('уже paid + расхождение суммы на повторном webhook — тихий ok:true БЕЗ алерта про расхождение', async () => {
    const { service, notify } = makeService({ ...PENDING, status: 'paid' });
    await expect(
      service.markPaidByInvId(DONATION_INVID_BASE + 10, 999),
    ).resolves.toEqual({ ok: true });
    expect(notify.alertAdmin).not.toHaveBeenCalled();
  });
});

// Точный текст DM-карточки доната — mutation-прогон нашёл, что ветки «нет
// email» / «нет комментария» (`plain.email ? ... : ''`) можно заменить на
// непустую строку-плейсхолдер незаметно: toContain-проверки в тестах выше
// такую подмену не ловят (искомая подстрока никуда не девалась, просто рядом
// добавился мусор). Точный toBe ловит и лишний текст, и пропажу самого
// email/comment из карточки.
describe('DonationService.markPaidByInvId — точный текст карточки при оплате', () => {
  it('без email и без comment — карточка состоит РОВНО из суммы и источника', async () => {
    const { service, notify } = makeService({
      ...PENDING,
      email: null,
      comment: null,
    });
    await service.markPaidByInvId(DONATION_INVID_BASE + 10, 300);
    expect(notify.alertAdmin).toHaveBeenCalledWith(
      '💛 <b>Донат 300 ₽</b> (app)',
    );
  });

  it('с email и comment — обе строки добавлены в заданном порядке, без лишнего текста', async () => {
    const { service, notify } = makeService({
      ...PENDING,
      email: 'a@b.ru',
      comment: 'спасибо',
    });
    await service.markPaidByInvId(DONATION_INVID_BASE + 10, 300);
    expect(notify.alertAdmin).toHaveBeenCalledWith(
      '💛 <b>Донат 300 ₽</b> (app)\n📬 a@b.ru\n💬 спасибо',
    );
  });
});
