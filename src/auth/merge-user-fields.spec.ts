/**
 * mergeUserScalarFields regression tests.
 *
 * Диагностика 2026-08-21: после слияния Google-аккаунта с Telegram-аккаунтом
 * (`merge.service.ts`) пользователь снова проходил онбординг и заново
 * выбирал форму обращения — merge переносил только recoveryEmail/
 * disclaimerAccepted/role, про addressForm и флаги первого входа
 * (onboardingV2Done и т.п. — весь FLAG_FIELDS) забыли.
 */

// ENCRYPTION_KEY — ДО импорта crypto (он читает ключ при загрузке), иначе
// encrypt() — passthrough и тест кормил бы правило plaintext-массивами, которых
// в проде в колонке нет (backend#0, аудит 2026-10-11).
process.env.ENCRYPTION_KEY = 'ab'.repeat(32);

import { Logger } from '@nestjs/common';
import { decryptJson, encryptJson } from '../utils/crypto';
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
    // Поля, которые прежний перенос терял (разбор 2026-08-29). Значения —
    // схемные дефолты, как у только что созданного User.
    firstName: null,
    mySchemaIds: [],
    myModeIds: [],
    uiPrefs: null,
    pairCardDismissed: false,
    practicesOnboardingDone: false,
    therapistShareCards: true,
    therapistShareProfile: true,
    notifyEnabled: true,
    notifyLocalHour: 21,
    notifyTimezone: 'Europe/Moscow',
    notifyReminderEnabled: true,
    notifyFrequency: 0,
    notifyQuietStart: 22,
    notifyQuietEnd: 8,
    notifyGamified: false,
    ...overrides,
  };
}

function makeTx(
  srcRow: Record<string, unknown>,
  tgtRow: Record<string, unknown>,
  // Карточки target ПОСЛЕ переноса карточек source (merge.service шаг 2).
  cards: { schemaIds?: string[]; modeIds?: string[] } = {},
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
    userSchemaNote: {
      findMany: jest.fn(() =>
        Promise.resolve(
          (cards.schemaIds ?? []).map((schemaId) => ({ schemaId })),
        ),
      ),
    },
    userModeNote: {
      findMany: jest.fn(() =>
        Promise.resolve((cards.modeIds ?? []).map((modeId) => ({ modeId }))),
      ),
    },
  } as any;
  return { tx, update };
}

const dec = (v: unknown) => decryptJson<string[]>(v as string);
const updatedData = (update: jest.Mock) =>
  (update.mock.calls[0]?.[0]?.data ?? {}) as Record<string, unknown>;

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

// Разбор 2026-08-29: слияние теряло ровно то, ради чего его затевают.
describe('mergeUserScalarFields — то, что терялось раньше', () => {
  it('легаси: plaintext-массивы в колонке объединяются и пишутся уже зашифрованными', async () => {
    const { tx, update } = makeTx(
      baseRow({
        mySchemaIds: ['abandonment'],
        myModeIds: ['vulnerable-child'],
      }),
      baseRow({ mySchemaIds: ['mistrust'], myModeIds: [] }),
    );
    await mergeUserScalarFields(tx, SRC, TGT);
    const data = update.mock.calls[0][0].data as Record<string, unknown>;
    expect(typeof data.mySchemaIds).toBe('string');
    expect(dec(data.mySchemaIds)).toEqual(['mistrust', 'abandonment']);
    expect(dec(data.myModeIds)).toEqual(['vulnerable-child']);
  });

  it('настройка времени напоминаний переезжает, если target на дефолте', async () => {
    const { tx, update } = makeTx(
      baseRow({ notifyLocalHour: 8, notifyTimezone: 'Asia/Almaty' }),
      baseRow(),
    );
    await mergeUserScalarFields(tx, SRC, TGT);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          notifyLocalHour: 8,
          notifyTimezone: 'Asia/Almaty',
        }),
      }),
    );
  });

  it('свой выбор времени у target не затирается временем source', async () => {
    const { tx, update } = makeTx(
      baseRow({ notifyLocalHour: 8 }),
      baseRow({ notifyLocalHour: 9 }),
    );
    await mergeUserScalarFields(tx, SRC, TGT);
    const data = update.mock.calls[0]?.[0]?.data ?? {};
    expect(data).not.toHaveProperty('notifyLocalHour');
  });

  it('приватность: закрытый доступ у source закрывает его и у target', async () => {
    const { tx, update } = makeTx(
      baseRow({ therapistShareCards: false }),
      baseRow({ therapistShareCards: true }),
    );
    await mergeUserScalarFields(tx, SRC, TGT);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ therapistShareCards: false }),
      }),
    );
  });

  it('приватность НЕ открывается обратно: открытый source не отменяет закрытый target', async () => {
    const { tx, update } = makeTx(
      baseRow({ therapistShareProfile: true }),
      baseRow({ therapistShareProfile: false }),
    );
    await mergeUserScalarFields(tx, SRC, TGT);
    const data = update.mock.calls[0]?.[0]?.data ?? {};
    expect(data).not.toHaveProperty('therapistShareProfile');
  });

  it('кастомизация мини-аппа и имя переезжают в пустой аккаунт', async () => {
    const { tx, update } = makeTx(
      baseRow({ uiPrefs: { accent: 'teal' }, firstName: 'Гриша' }),
      baseRow(),
    );
    await mergeUserScalarFields(tx, SRC, TGT);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          uiPrefs: { accent: 'teal' },
          firstName: 'Гриша',
        }),
      }),
    );
  });
});

// backend#0 (аудит 2026-10-11): в проде User.mySchemaIds/myModeIds — шифротекст
// (FIELD_POLICY.User → enc). Правило union видело две строки вместо массивов,
// отдавало undefined, и «Привязать Telegram» стирала выбранные схемы и режимы.
describe('mergeUserScalarFields — зашифрованные «мои схемы/режимы» (backend#0)', () => {
  it('шифротекст у обоих аккаунтов: union расшифрованных списков, результат зашифрован', async () => {
    const { tx, update } = makeTx(
      baseRow({
        mySchemaIds: encryptJson(['abandonment', 'mistrust']),
        myModeIds: encryptJson(['vulnerable-child']),
      }),
      baseRow({
        mySchemaIds: encryptJson(['mistrust', 'failure']),
        myModeIds: encryptJson(['angry-child']),
      }),
    );
    await mergeUserScalarFields(tx, SRC, TGT);
    const data = updatedData(update);
    expect(typeof data.mySchemaIds).toBe('string');
    expect(typeof data.myModeIds).toBe('string');
    // Ничего не потеряно при пересечении, дубликатов нет, список target цел.
    expect(dec(data.mySchemaIds)).toEqual([
      'mistrust',
      'failure',
      'abandonment',
    ]);
    expect(dec(data.myModeIds)).toEqual(['angry-child', 'vulnerable-child']);
  });

  it('target со схемным дефолтом [] (не шифр), source — шифр: список переезжает', async () => {
    const { tx, update } = makeTx(
      baseRow({ mySchemaIds: encryptJson(['abandonment']) }),
      baseRow({ mySchemaIds: [] }),
    );
    await mergeUserScalarFields(tx, SRC, TGT);
    expect(dec(updatedData(update).mySchemaIds)).toEqual(['abandonment']);
  });

  it('список target не затирается: source пуст или входит в target → поле не пишется', async () => {
    const { tx, update } = makeTx(
      baseRow({ mySchemaIds: encryptJson(['mistrust']) }),
      baseRow({ mySchemaIds: encryptJson(['mistrust', 'failure']) }),
    );
    await mergeUserScalarFields(tx, SRC, TGT);
    expect(update.mock.calls).toEqual([]);
  });

  it('карточки — источник правды: их id попадают в список, даже если список source пуст', async () => {
    const { tx, update } = makeTx(
      baseRow({ mySchemaIds: encryptJson([]), myModeIds: encryptJson([]) }),
      baseRow({
        mySchemaIds: encryptJson(['mistrust']),
        myModeIds: encryptJson([]),
      }),
      { schemaIds: ['mistrust', 'abandonment'], modeIds: ['vulnerable-child'] },
    );
    await mergeUserScalarFields(tx, SRC, TGT);
    const data = updatedData(update);
    expect(dec(data.mySchemaIds)).toEqual(['mistrust', 'abandonment']);
    expect(dec(data.myModeIds)).toEqual(['vulnerable-child']);
  });

  it('карточки уже в списке target → лишней записи нет', async () => {
    const { tx, update } = makeTx(
      baseRow({ mySchemaIds: encryptJson([]) }),
      baseRow({ mySchemaIds: encryptJson(['mistrust']) }),
      { schemaIds: ['mistrust'] },
    );
    await mergeUserScalarFields(tx, SRC, TGT);
    expect(update.mock.calls).toEqual([]);
  });

  it('нечитаемый (чужой ключ) список target не перезаписывается', async () => {
    const err = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const garbage = Buffer.alloc(48, 7).toString('base64');
    const { tx, update } = makeTx(
      baseRow({ mySchemaIds: encryptJson(['abandonment']) }),
      baseRow({ mySchemaIds: garbage }),
    );
    await mergeUserScalarFields(tx, SRC, TGT);
    expect(update.mock.calls).toEqual([]);
    err.mockRestore();
  });

  it('нечитаемый список source не мешает перенести карточки', async () => {
    const err = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const garbage = Buffer.alloc(48, 7).toString('base64');
    const { tx, update } = makeTx(
      baseRow({ mySchemaIds: garbage }),
      baseRow({ mySchemaIds: encryptJson([]) }),
      { schemaIds: ['abandonment'] },
    );
    await mergeUserScalarFields(tx, SRC, TGT);
    expect(dec(updatedData(update).mySchemaIds)).toEqual(['abandonment']);
    err.mockRestore();
  });
});
