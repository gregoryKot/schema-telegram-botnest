/**
 * mergeUserScalarFields regression tests.
 *
 * Диагностика 2026-08-21: после слияния Google-аккаунта с Telegram-аккаунтом
 * (`merge.service.ts`) пользователь снова проходил онбординг и заново
 * выбирал форму обращения — merge переносил только recoveryEmail/
 * disclaimerAccepted/role, про addressForm и флаги первого входа
 * (onboardingV2Done и т.п. — весь FLAG_FIELDS) забыли.
 */

import { mergeUserScalarFields } from './merge-user-fields';

const SRC = BigInt(1001);
const TGT = BigInt(2002);

// «Пустой» набор — как у только что созданного User (схема-дефолты).
function baseRow(overrides: Record<string, unknown> = {}) {
  return {
    themePref: null,
    onboardingV1Done: false,
    onboardingV2Done: false,
    onboardingSkipped: [],
    childhoodWheelDone: false,
    ysqBannerDismissed: false,
    hintSheetCloseShown: false,
    hintHistoryDismissed: false,
    trackerOnboardingDone: false,
    lastCelebrationDate: null,
    lastYesterdayBannerDate: null,
    lastWeeklyQuestionWeek: null,
    schemaIntrosShown: [],
    modeIntrosShown: [],
    defaultSection: null,
    addressForm: null,
    ...overrides,
  };
}

function makeTx(
  srcRow: Record<string, unknown>,
  tgtRow: Record<string, unknown>,
) {
  const rows: Record<string, Record<string, unknown>> = {
    [SRC.toString()]: srcRow,
    [TGT.toString()]: tgtRow,
  };
  const update = jest.fn(
    ({
      where,
      data,
    }: {
      where: { id: bigint };
      data: Record<string, unknown>;
    }) => {
      Object.assign(rows[where.id.toString()], data);
      return Promise.resolve(rows[where.id.toString()]);
    },
  );
  const findUnique = jest.fn(({ where }: { where: { id: bigint } }) =>
    Promise.resolve(rows[where.id.toString()] ?? null),
  );
  const tx = {
    // recoveryEmail lookup — не в фокусе этих тестов, source без email.
    $queryRaw: jest.fn().mockResolvedValue([{ re: null, rev: null }]),
    $executeRaw: jest.fn().mockResolvedValue(0),
    user: { findUnique, update },
  } as any;
  return { tx, update };
}

describe('mergeUserScalarFields — флаги первого входа и addressForm', () => {
  it('boolean-флаг: true у source побеждает false у target', async () => {
    const { tx, update } = makeTx(
      baseRow({ onboardingV2Done: true }),
      baseRow({ onboardingV2Done: false }),
    );
    await mergeUserScalarFields(tx, SRC, TGT);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: TGT },
        data: expect.objectContaining({ onboardingV2Done: true }),
      }),
    );
  });

  it("addressForm: 'vy' у source, null у target → переносится 'vy'", async () => {
    const { tx, update } = makeTx(
      baseRow({ addressForm: 'vy' }),
      baseRow({ addressForm: null }),
    );
    await mergeUserScalarFields(tx, SRC, TGT);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ addressForm: 'vy' }),
      }),
    );
  });

  it('заполненное у target значение НЕ перезатирается значением source', async () => {
    const { tx, update } = makeTx(
      baseRow({ addressForm: 'vy', defaultSection: 'today' }),
      baseRow({ addressForm: 'ty', defaultSection: 'practices' }),
    );
    await mergeUserScalarFields(tx, SRC, TGT);
    // Ни один вызов update не должен трогать addressForm/defaultSection.
    for (const call of update.mock.calls) {
      const data = call[0].data as Record<string, unknown>;
      expect(data).not.toHaveProperty('addressForm');
      expect(data).not.toHaveProperty('defaultSection');
    }
  });

  it('JSON-массивы (schemaIntrosShown) объединяются без дублей', async () => {
    const { tx, update } = makeTx(
      baseRow({ schemaIntrosShown: ['a', 'b'] }),
      baseRow({ schemaIntrosShown: ['b', 'c'] }),
    );
    await mergeUserScalarFields(tx, SRC, TGT);
    const call = update.mock.calls.find(
      (c) => 'schemaIntrosShown' in (c[0].data as Record<string, unknown>),
    );
    expect(call).toBeDefined();
    const merged = (call![0].data as Record<string, unknown>)
      .schemaIntrosShown as string[];
    expect(new Set(merged)).toEqual(new Set(['a', 'b', 'c']));
    expect(merged).toHaveLength(3);
  });

  it('оба аккаунта «пустые» (дефолты) → update флагов вообще не вызывается', async () => {
    const { tx, update } = makeTx(baseRow(), baseRow());
    await mergeUserScalarFields(tx, SRC, TGT);
    // Пустой список вызовов, а не просто «не звали»: так видно, что именно
    // ушло бы в БД, если бы диф посчитался неверно.
    expect(update.mock.calls).toEqual([]);
  });

  it('если у обоих аккаунтов пропал User (гонка/уже удалён) — не падает', async () => {
    const { tx, update } = makeTx(baseRow(), baseRow());
    tx.user.findUnique.mockResolvedValue(null);
    await expect(mergeUserScalarFields(tx, SRC, TGT)).resolves.toBeUndefined();
    expect(update.mock.calls).toEqual([]);
  });
});
