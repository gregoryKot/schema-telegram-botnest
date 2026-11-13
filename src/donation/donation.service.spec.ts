// Аналог P-2 (аудит 2026-07) для донатов: ретраи Robokassa webhook по одному
// InvId не должны задваивать алерт админу / повторно списывать статус paid.
// Стиль — как booking.payment.spec.ts / subscription.payment.spec.ts: CAS
// эмулируется через updateMany, привязанный к текущему статусу строки.
import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { DonationService, DONATION_INVID_BASE } from './donation.service';
import { PII, expectNoMarkers } from '../test-support/pii-markers';
import type { OwnerNotice } from '../utils/owner-card';

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
  const notify = {
    alertAdmin: jest.fn(async () => undefined),
    notifyAdminBoth: jest.fn(async (_h: OwnerNotice, _s: string) => undefined),
  };
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
    expect(notify.notifyAdminBoth).toHaveBeenCalledTimes(1);
  });

  it('повторный webhook по уже paid — ok:true БЕЗ повторного алерта', async () => {
    const { service, notify } = makeService(PENDING);
    await service.markPaidByInvId(DONATION_INVID_BASE + 10, 300);
    await expect(
      service.markPaidByInvId(DONATION_INVID_BASE + 10, 300),
    ).resolves.toEqual({ ok: true });
    expect(notify.notifyAdminBoth).toHaveBeenCalledTimes(1); // не задвоилось
  });

  it('уже paid при первом обращении (гонка двух webhook) — no-op без алерта', async () => {
    const { service, notify } = makeService({ ...PENDING, status: 'paid' });
    await expect(
      service.markPaidByInvId(DONATION_INVID_BASE + 10, 300),
    ).resolves.toEqual({ ok: true });
    expect(notify.alertAdmin).not.toHaveBeenCalled();
    expect(notify.notifyAdminBoth).not.toHaveBeenCalled();
  });

  it('несовпадение суммы шлёт алерт, но не блокирует зачисление (в отличие от booking.confirm)', async () => {
    const { service, notify, state } = makeService(PENDING);
    await expect(
      service.markPaidByInvId(DONATION_INVID_BASE + 10, 999),
    ).resolves.toEqual({ ok: true });
    expect(state.row.status).toBe('paid');
    // Один алерт про расхождение суммы + сообщение о самом донате.
    expect(notify.alertAdmin).toHaveBeenCalledTimes(1);
    expect(notify.alertAdmin.mock.calls[0][0]).toContain('сумма расходится');
    expect(notify.notifyAdminBoth).toHaveBeenCalledTimes(1);
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
    const notify = {
      alertAdmin: jest.fn(async () => undefined),
      notifyAdminBoth: jest.fn(async () => undefined),
    };
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
    expect(notify.notifyAdminBoth).not.toHaveBeenCalled();
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

// Точный текст карточки доната в обоих каналах — mutation-прогон нашёл, что
// ветки «нет email» / «нет комментария» можно заменить на непустую строку
// незаметно для toContain. Telegram — без email и комментария донора (152-ФЗ),
// письмо — с ними.
describe('DonationService.markPaidByInvId — точный текст карточки при оплате', () => {
  const sent = (notify: ReturnType<typeof makeService>['notify']) => {
    expect(notify.notifyAdminBoth).toHaveBeenCalledTimes(1);
    return notify.notifyAdminBoth.mock.calls[0];
  };

  it('без email и без comment — одна строка: номер, сумма, источник, статус', async () => {
    const { service, notify } = makeService({
      ...PENDING,
      email: null,
      comment: null,
    });
    await service.markPaidByInvId(DONATION_INVID_BASE + 10, 300);
    const [html, subject] = sent(notify);
    const head = '💛 <b>Донат #10: 300 ₽</b> (app) — оплачен';
    expect(html).toEqual({ telegram: head, email: head });
    expect(subject).toBe('Донат #10: 300 ₽ (app) — оплачен');
  });

  it('с email и comment — в Telegram только указание на письмо, в письме обе строки по порядку', async () => {
    const { service, notify } = makeService({
      ...PENDING,
      email: 'a@b.ru',
      comment: 'спасибо',
    });
    await service.markPaidByInvId(DONATION_INVID_BASE + 10, 300);
    const [html] = sent(notify);
    const head = '💛 <b>Донат #10: 300 ₽</b> (app) — оплачен';
    expect(html.telegram).toBe(
      `${head}\n📧 Email и комментарий донора — в письме на почте.`,
    );
    expect(html.email).toBe(`${head}\n📬 a@b.ru\n💬 спасибо`);
  });

  it('email и комментарий из маркеров в Telegram не попадают, в письме — есть', async () => {
    const { service, notify } = makeService({
      ...PENDING,
      email: PII.email,
      comment: PII.comment,
    });
    await service.markPaidByInvId(DONATION_INVID_BASE + 10, 300);
    const [html] = sent(notify);
    expectNoMarkers(html.telegram);
    expect(html.email).toContain(PII.email);
    expect(html.email).toContain(PII.comment);
  });
});

// M1 (аудит 2026-10): email/comment донора в письме экранированы, как в DM.
describe('DonationService.markPaidByInvId — экранирование HTML в письме (M1)', () => {
  it('email и comment с разметкой не доходят до письма сырыми', async () => {
    const evil = '<a href="https://evil/">x</a>';
    const { service, notify } = makeService({
      ...PENDING,
      email: evil,
      comment: evil,
    });
    await service.markPaidByInvId(DONATION_INVID_BASE + 10, 300);
    const { email } = notify.notifyAdminBoth.mock.calls[0][0];
    expect(email).not.toContain('<a href');
    expect(email).toContain('&lt;a href="https://evil/"&gt;x&lt;/a&gt;');
    expect(email).toContain('<b>Донат #10: 300 ₽</b>');
  });
});

describe('DonationService.create — Robokassa не настроена', () => {
  const was = process.env.NODE_ENV;
  function make(robokassaEnabled: boolean) {
    const rows: any[] = [];
    const prisma: any = {
      donation: {
        create: jest.fn(async ({ data }: any) => {
          const row = { id: 77, ...data };
          rows.push(row);
          return row;
        }),
        findUnique: jest.fn(
          async ({ where }: any) => rows.find((r) => r.id === where.id) ?? null,
        ),
        updateMany: jest.fn(async ({ data }: any) => {
          Object.assign(rows[0], data);
          return { count: 1 };
        }),
      },
    };
    const notify = {
      alertAdmin: jest.fn(async () => undefined),
      notifyAdminBoth: jest.fn(async () => undefined),
    };
    const robokassa = {
      enabled: robokassaEnabled,
      buildPaymentUrl: jest.fn(() => 'https://robokassa.test/pay'),
    };
    const service = new DonationService(
      prisma,
      robokassa as any,
      notify as any,
      { get: () => undefined } as any,
    );
    return { service, prisma, notify, rows };
  }
  afterEach(() => {
    process.env.NODE_ENV = was;
    jest.restoreAllMocks();
  });

  it('прод: 503 до INSERT, строки pending нет, «💛 Донат» владельцу не уходит', async () => {
    process.env.NODE_ENV = 'production';
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const { service, prisma, notify, rows } = make(false);
    await expect(service.create({ amount: 500 })).rejects.toThrow(
      ServiceUnavailableException,
    );
    expect(prisma.donation.create).not.toHaveBeenCalled();
    expect(rows).toHaveLength(0);
    expect(notify.alertAdmin).not.toHaveBeenCalled();
    expect(notify.notifyAdminBoth).not.toHaveBeenCalled();
  });

  it('контроль, не прод: донат помечается оплаченным сразу (dev-режим)', async () => {
    process.env.NODE_ENV = 'test';
    const { service, rows, notify } = make(false);
    await expect(service.create({ amount: 500 })).resolves.toEqual({
      id: 77,
      paymentUrl: null,
    });
    expect(rows[0].status).toBe('paid');
    expect(notify.notifyAdminBoth).toHaveBeenCalledTimes(1);
  });

  it('контроль, прод с настроенной Robokassa: ссылка на оплату, донат pending', async () => {
    process.env.NODE_ENV = 'production';
    const { service, rows } = make(true);
    await expect(service.create({ amount: 500 })).resolves.toEqual({
      id: 77,
      paymentUrl: 'https://robokassa.test/pay',
    });
    expect(rows[0].status).toBe('pending');
  });
});
