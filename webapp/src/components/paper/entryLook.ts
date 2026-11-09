// Вид окон первого входа (docs/design/APP_2026-11.md, раздел b06-entry): бумага и знак шапки
// EntryHead. Терапевт, пара и исходы (готово, ссылка устарела) — строки ENTITY_LOOK и OUTCOME_LOOK,
// здесь только то, чего в таблице нет: шаги согласий, выбор формы обращения, «Поддержать проект».
// Три шага — три бумаги «входа»: приветствие на персике (как вход и быстрая запись), данные и
// конфиденциальность — небо и рамка Limits (записи зашифрованы — тот же знак, что в «Доверии»
// лендинга), «не замена терапии» — шалфей и Check (понятно и сделано). Соседи — дальше 40°.
import type { EntityId, PaperHue, SheetLook } from '../../../../shared/src/theme/entityLook';
import type { InvitePreview } from '../../../../shared/src/therapy/useInvitePreview';

export type ConsentStep = 'welcome' | 'privacy' | 'not_therapy';

export const CONSENT_STEPS: readonly ConsentStep[] = ['welcome', 'privacy', 'not_therapy'];

export const CONSENT_LOOK: Record<ConsentStep, SheetLook> = {
  welcome: { hue: 45 },
  privacy: { hue: 240, sign: 'limits' },
  not_therapy: { hue: 135, sign: 'check' },
};

/** Оттенки шагов по порядку — бумажки EntrySteps. */
export const CONSENT_HUES: readonly PaperHue[] = CONSENT_STEPS.map((s) => CONSENT_LOOK[s].hue);

/** Вход в кабинет — персик (выбор формы обращения со знаком продукта); два ответа — бумага двух
 *  следующих шагов входа, шалфей и небо: плитки равного веса, ни одна не выбрана заранее. */
export const ENTRY_HUE: PaperHue = 45;
export const ADDRESS_FORM_HUE: Record<'ty' | 'vy', PaperHue> = { ty: 135, vy: 240 };

/** «Поддержать проект» — солома: просьба о самом продукте (знак продукта), не сущность кабинета. */
export const DONATE_HUE: PaperHue = 70;

/** Исходы «готово» и «устарело» — те же, что OUTCOME_LOOK (done, wait), литералами: рантайм-импорт
 *  OUTCOME_LOOK в главном потоке выносил entityLook, сцены и ExScreen в свои чанки, и CSS упражнений
 *  вставал раньше index.css (check-css-link-order; как у PaperAlert). Сверка — entryLook.test.ts. */
export const JOIN_DONE_LOOK: SheetLook = { hue: 135, sign: 'check' };
export const JOIN_STALE_LOOK: SheetLook = { hue: 70, sign: 'cup' };

/** Шапка приглашения по ссылке: пара — её вид (NeedArt attachment), терапевт — Talk на небе, в том
 *  числе «подключение уже есть» и «другой терапевт»; код не действует — исход «устарело» (Cup на
 *  соломе), а не красная строка; «Доступ открыт» — исход «готово» (Check на шалфее). */
export function joinLook(isPair: boolean, preview: InvitePreview['state'], done = false): EntityId | SheetLook {
  if (done) return JOIN_DONE_LOOK;
  if (isPair) return 'pair';
  return preview === 'invalid' ? JOIN_STALE_LOOK : 'therapist';
}

/** Сбой одной строкой с сервера («Не получилось присоединиться. Проверь ссылку…») — в PaperAlert
 *  как у остальных окон входа: первая фраза — заголовок, остальное — тише. Текст не меняется. */
export function alertParts(message: string): { title: string; text?: string } {
  const cut = message.search(/[.!?…]\s/);
  if (cut < 0) return { title: message };
  return { title: message.slice(0, cut + 1), text: message.slice(cut + 2) };
}
