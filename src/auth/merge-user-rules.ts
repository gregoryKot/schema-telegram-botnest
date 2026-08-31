// Что делать с каждым скалярным полем User при слиянии аккаунтов.
//
// Зачем реестр. До 2026-08-29 переносились только флаги первого входа и
// addressForm — список строился как `[...FLAG_FIELDS, 'addressForm']`, то есть
// «UI-флаги плюс одно поле». Всё остальное молча пропадало вместе с
// удаляемой строкой source: «мои схемы» и «мои режимы» (ядро продукта),
// настройки уведомлений, кастомизация мини-аппа, имя. Человек сливал аккаунты
// ради синхронизации — и терял ровно то, ради чего сливал.
//
// Правило №4 CLAUDE.md: два места, обязанные совпадать, фиксируются
// тестом-сверкой. Здесь такие места — schema.prisma и этот реестр; сверку
// держит merge-user-rules.spec.ts, и новое поле без решения роняет тест.
// Именно это отличает реестр от прежнего списка: забыть поле больше нельзя.

/**
 * `flag` — булев «уже видел / уже прошёл»: true побеждает. Показывать
 *   онбординг заново тому, кто прошёл его в другом аккаунте, незачем.
 * `union` — JSON-массив: объединение без дублей. Список могли начать в одном
 *   аккаунте, продолжить в другом.
 * `fillEmpty` — переносим, только если у target пусто: чужой выбор не
 *   затираем.
 * `private` — приватность: побеждает БОЛЕЕ закрытое значение. Слияние не
 *   имеет права включить обратно то, что человек где-то выключил.
 * `preference` — не-null поле со схемным дефолтом. «Пусто» тут не выражается
 *   через null, поэтому признак «пользователь не трогал» — совпадение со
 *   схемным дефолтом; тогда берём значение source.
 * `skip` — не переносим, с причиной.
 */
export type MergeRule =
  | { kind: 'flag' }
  | { kind: 'union' }
  | { kind: 'fillEmpty' }
  | { kind: 'private' }
  | { kind: 'preference'; fallback: unknown }
  | { kind: 'skip'; reason: string };

const flag: MergeRule = { kind: 'flag' };
const union: MergeRule = { kind: 'union' };
const fillEmpty: MergeRule = { kind: 'fillEmpty' };
const priv: MergeRule = { kind: 'private' };
const pref = (fallback: unknown): MergeRule => ({
  kind: 'preference',
  fallback,
});
const skip = (reason: string): MergeRule => ({ kind: 'skip', reason });

// Значения `pref(...)` обязаны совпадать с `@default(...)` в schema.prisma —
// сверку держит merge-user-rules.spec.ts, чтобы правило не разошлось со схемой.
export const USER_MERGE_RULES: Record<string, MergeRule> = {
  id: skip('первичный ключ'),
  createdAt: skip('когда завели ЭТУ строку; у target своя дата'),
  firstName: fillEmpty,
  role: skip('переносится отдельной веткой: THERAPIST побеждает'),
  therapistMode: skip('идёт вместе с role, той же веткой'),
  disclaimerAccepted: skip('переносится отдельной веткой: true побеждает'),
  recoveryEmail: skip('@unique — отдельная ветка со снятием слота у source'),
  recoveryEmailVerifiedAt: skip('идёт вместе с recoveryEmail'),

  // ── Уведомления ──────────────────────────────────────────────────────────
  // Выбор человека переносим: иначе после слияния напоминания начинают
  // приходить в 21:00 по Москве вместо настроенного времени, и это читается
  // как «настройки слетели».
  notifyEnabled: pref(true),
  notifyLocalHour: pref(21),
  notifyTimezone: pref('Europe/Moscow'),
  notifyReminderEnabled: pref(true),
  notifyFrequency: pref(0),
  notifyQuietStart: pref(22),
  notifyQuietEnd: pref(8),
  notifyGamified: pref(false),
  // Состояние движка расписания, а не выбор человека: переносить его к другому
  // аккаунту бессмысленно (счётчики считают ЕГО отправки) и вредно
  // (чужая дата последнего прогона ломает идемпотентность catch-up).
  notifyAdaptiveLevel: skip('состояние движка адаптации, не выбор человека'),
  notifyIgnoredCount: skip('счётчик движка адаптации'),
  notifyNextRemindDate: skip('расписание конкретного аккаунта'),
  notifySkipAckDate: skip('расписание конкретного аккаунта'),
  notifyLastEvalDate: skip('идемпотентность catch-up конкретного аккаунта'),
  notifyPausedUntil: skip('пауза, поставленная в конкретном аккаунте'),
  notifyReminderSeq: skip('счётчик отправленных напоминаний'),

  // ── Данные и настройки продукта ──────────────────────────────────────────
  addressForm: fillEmpty,
  mySchemaIds: union,
  myModeIds: union,
  uiPrefs: fillEmpty,
  themePref: fillEmpty,
  defaultSection: fillEmpty,
  pairCardDismissed: flag,
  // Приватность: если человек закрыл терапевту доступ в одном из аккаунтов,
  // слияние не имеет права открыть его снова.
  therapistShareCards: priv,
  therapistShareProfile: priv,

  // ── Онбординг и подсказки ────────────────────────────────────────────────
  onboardingV1Done: flag,
  onboardingV2Done: flag,
  onboardingSkipped: union,
  practicesOnboardingDone: flag,
  childhoodWheelDone: flag,
  ysqBannerDismissed: flag,
  hintSheetCloseShown: flag,
  hintHistoryDismissed: flag,
  trackerOnboardingDone: flag,
  lastCelebrationDate: fillEmpty,
  lastYesterdayBannerDate: fillEmpty,
  lastWeeklyQuestionWeek: fillEmpty,
  schemaIntrosShown: union,
  modeIntrosShown: union,

  // ── Безопасность и служебное ─────────────────────────────────────────────
  // Второй фактор принадлежит аккаунту, а не человеку: перенести чужой секрет
  // значило бы отдать target доступ, настроенный для source.
  totpSecret: skip('второй фактор принадлежит аккаунту, не переносится'),
  totpEnabledAt: skip('идёт вместе с totpSecret'),
  totpRecoveryCodes: skip('идёт вместе с totpSecret'),
  totpLastStep: skip('анти-replay счётчик конкретного секрета'),
  botBlockedAt: skip(
    'флаг про конкретный чат, а не про аккаунт: после слияния адрес переезжает ' +
      'вместе с AuthProvider, и целевой аккаунт начинает писаться заново — ' +
      'перенос старого флага выключил бы ему уведомления без причины',
  ),
  deletedAt: skip('состояние удаления конкретной строки'),
};

/** Поля, которые применяет mergeUserScalarFields (всё, кроме `skip`). */
export const MERGED_USER_FIELDS = Object.entries(USER_MERGE_RULES)
  .filter(([, rule]) => rule.kind !== 'skip')
  .map(([field]) => field);

/**
 * Новое значение поля или `undefined`, если менять нечего. Чистая функция —
 * без Prisma, поэтому каждое правило проверяется тестом по отдельности.
 */
export function mergedValue(
  rule: MergeRule,
  source: unknown,
  target: unknown,
): unknown {
  switch (rule.kind) {
    case 'flag':
      return source === true && target === false ? true : undefined;
    case 'union': {
      const tArr: unknown[] = Array.isArray(target)
        ? (target as unknown[])
        : [];
      const sArr: unknown[] = Array.isArray(source)
        ? (source as unknown[])
        : [];
      const merged = Array.from(new Set([...tArr, ...sArr]));
      return merged.length === tArr.length ? undefined : merged;
    }
    case 'fillEmpty':
      return target == null && source != null ? source : undefined;
    case 'private':
      return source === false && target !== false ? false : undefined;
    case 'preference':
      return target === rule.fallback && source !== rule.fallback
        ? source
        : undefined;
    case 'skip':
      return undefined;
  }
}
