// Регрессии на находки аудита 2026-07 (recurring-платежи):
//   P-3 — chargeDue не проверял существующий pending-charge: краш между
//         chargeRecurring и update nextChargeAt приводил ко ВТОРОМУ
//         реальному списанию на следующем hourly-тике.
//   P-2 — markChargePaid был check-then-act: параллельные ретраи webhook
//         задваивали активацию и алерты. Теперь CAS.
import {
  SubscriptionService,
  SUBSCRIPTION_INVID_BASE,
} from './subscription.service';

const SUB = {
  id: 1,
  status: 'active',
  period: 'month',
  amount: 300,
  failedAttempts: 0,
  firstInvId: 900001,
  telegramId: null,
  nextChargeAt: new Date(Date.now() - 1000),
};

function makeService(opts: { pendingCharge?: any; chargeRow?: any }) {
  const calls: Record<string, any[]> = { recurring: [], alerts: [] };
  const chargeState = opts.chargeRow ? { ...opts.chargeRow } : null;
  const prisma: any = {
    subscription: {
      findMany: jest.fn(async () => [SUB]),
      findUnique: jest.fn(async () => SUB),
      update: jest.fn(async () => SUB),
    },
    // 1 = подписку захватил этот обработчик (атомарный UPDATE
    // nextChargeAt). 0 вернул бы «уже забрал другой инстанс».
    $executeRaw: jest.fn(async () => 1),
    subscriptionCharge: {
      findFirst: jest.fn(async () => opts.pendingCharge ?? null),
      findUnique: jest.fn(async () => chargeState),
      create: jest.fn(async () => ({ id: 55, subscriptionId: 1, amount: 300 })),
      updateMany: jest.fn(async () => {
        if (!chargeState || chargeState.status === 'paid') return { count: 0 };
        chargeState.status = 'paid';
        return { count: 1 };
      }),
      update: jest.fn(async () => ({})),
    },
    $transaction: jest.fn(async (ops: any) =>
      Array.isArray(ops) ? Promise.all(ops) : ops(prisma),
    ),
  };
  const robokassa = {
    enabled: true,
    chargeRecurring: jest.fn(async (args: any) => {
      calls.recurring.push(args);
      return { ok: true, body: '' };
    }),
  };
  const notify = {
    alertAdmin: jest.fn(async (msg: string) => {
      calls.alerts.push(msg);
    }),
  };
  const config = {
    get: (k: string) => (k === 'SUBSCRIPTION_ENABLED' ? 'true' : undefined),
  };
  const service = new SubscriptionService(
    prisma,
    robokassa as any,
    notify as any,
    config as any,
  );
  return { service, prisma, robokassa, calls };
}

describe('SubscriptionService.chargeDue — защита от двойного списания (P-3)', () => {
  it('при свежем pending-charge НЕ списывает второй раз и алертит', async () => {
    const { service, robokassa, calls } = makeService({
      pendingCharge: { id: 44, status: 'pending', createdAt: new Date() },
    });
    await service.chargeDue();
    expect(robokassa.chargeRecurring).not.toHaveBeenCalled();
    expect(calls.alerts.length).toBe(1);
  });

  it('без pending-charge списание уходит и nextChargeAt сдвигается', async () => {
    const { service, robokassa, prisma } = makeService({});
    const before = Date.now();
    await service.chargeDue();
    expect(robokassa.chargeRecurring).toHaveBeenCalledTimes(1);
    // Списание уходит с правильным InvId нового платежа и previousInvId
    // подписки (Robokassa требует ссылку на первый платёж для рекуррента).
    expect(robokassa.chargeRecurring).toHaveBeenCalledWith(
      expect.objectContaining({
        invId: SUBSCRIPTION_INVID_BASE + 55, // id созданного charge из мока
        previousInvId: SUB.firstInvId,
        amount: SUB.amount,
      }),
    );
    // Сдвиг nextChargeAt теперь делает атомарный захват ПЕРЕД списанием
    // (UPDATE … WHERE nextChargeAt <= now()) — он же сериализует два
    // инстанса. Проверяем то же самое свойство: дата уехала вперёд, а не
    // осталась в прошлом (SUB.nextChargeAt — уже просроченная).
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
    // Тег-функция: [0] — шаблон запроса, дальше подставляемые значения.
    const claimCall = (prisma.$executeRaw as jest.Mock).mock.calls[0];
    const claimText = (claimCall[0] as string[]).join(' ');
    expect(claimText).toContain('UPDATE "Subscription"');
    expect(claimText).toContain('nextChargeAt');
    const [nextAt, id] = claimCall.slice(1) as [Date, number, Date];
    expect(id).toBe(SUB.id);
    expect(nextAt.getTime()).toBeGreaterThan(before);
  });
});

describe('SubscriptionService.markChargePaidByInvId — идемпотентность (P-2)', () => {
  it('первый webhook активирует, повторный — no-op без второго алерта', async () => {
    const { service, prisma, calls } = makeService({
      chargeRow: {
        id: 55,
        subscriptionId: 1,
        amount: 300,
        status: 'pending',
        isFirst: true,
      },
    });
    await service.markChargePaidByInvId(SUBSCRIPTION_INVID_BASE + 55, 300);
    const alertsAfterFirst = calls.alerts.length;
    expect(prisma.subscription.update).toHaveBeenCalledTimes(1);

    await service.markChargePaidByInvId(SUBSCRIPTION_INVID_BASE + 55, 300);
    expect(prisma.subscription.update).toHaveBeenCalledTimes(1); // не задвоилось
    expect(calls.alerts.length).toBe(alertsAfterFirst);
  });
});

// Второй инстанс приложения (масштабирование, перекатывающийся деплой)
// запускает тот же hourly-крон. Проверка pending-charge выше от этого не
// спасает: оба процесса читают findMany одновременно, оба видят «pending
// нет». Сериализует именно атомарный захват — UPDATE с условием
// `nextChargeAt <= now()`: строку получает ровно один.
describe('SubscriptionService.chargeDue — параллельный инстанс не списывает второй раз', () => {
  it('захват не удался (0 строк) → ни charge, ни обращения в Robokassa', async () => {
    const { service, robokassa, prisma } = makeService({});
    // Подписку уже забрал другой обработчик между findMany и UPDATE.
    (prisma.$executeRaw as jest.Mock).mockResolvedValue(0);

    await service.chargeDue();

    expect(robokassa.chargeRecurring).not.toHaveBeenCalled();
    expect(prisma.subscriptionCharge.create).not.toHaveBeenCalled();
    // Не просто «ничего не произошло»: попытка захвата БЫЛА и вернула 0 —
    // значит остановились именно на ней, а не упали шагом раньше (тогда
    // счётчик был бы нулевым, и тест зеленел бы по ложной причине).
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
    expect((prisma.$executeRaw as jest.Mock).mock.calls[0].slice(1)).toEqual([
      expect.any(Date),
      SUB.id,
      expect.any(Date),
    ]);
  });

  it('захват идёт ДО обращения в Robokassa, а не после', async () => {
    const order: string[] = [];
    const { service, prisma, robokassa } = makeService({});
    (prisma.$executeRaw as jest.Mock).mockImplementation(async () => {
      order.push('claim');
      return 1;
    });
    (robokassa.chargeRecurring as jest.Mock).mockImplementation(async () => {
      order.push('charge');
      return { ok: true, body: '' };
    });

    await service.chargeDue();

    // Обратный порядок вернул бы окно, ради закрытия которого всё и делалось.
    expect(order).toEqual(['claim', 'charge']);
  });
});
