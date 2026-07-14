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
});
