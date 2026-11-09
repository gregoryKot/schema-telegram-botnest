// Вид окон первого входа (docs/design/APP_2026-11.md, b06-entry): бумага и знак шапки EntryHead. Терапевт,
// пара и исходы — строки ENTITY_LOOK и OUTCOME_LOOK; здесь — шаги согласий, «ты/вы», «Поддержать проект».
// Три шага — три бумаги: приветствие на персике, данные и конфиденциальность — небо и рамка Limits (знак
// «Доверия» лендинга), «не замена терапии» — шалфей и Check. Соседи — дальше 40°.
import type { EntityId, PaperHue, SheetLook } from '../../../../shared/src/theme/entityLook';
import type { InvitePreview } from '../../../../shared/src/therapy/useInvitePreview';
import { OUTCOME_LOOK_LIT } from './outcomeLook';

export type ConsentStep = 'welcome' | 'privacy' | 'not_therapy';

export const CONSENT_STEPS: readonly ConsentStep[] = ['welcome', 'privacy', 'not_therapy'];

export const CONSENT_LOOK: Record<ConsentStep, SheetLook> = {
  welcome: { hue: 45 },
  privacy: { hue: 240, sign: 'limits' },
  not_therapy: { hue: 135, sign: 'check' },
};

/** Оттенки шагов по порядку — бумажки EntrySteps. */
export const CONSENT_HUES: readonly PaperHue[] = CONSENT_STEPS.map((s) => CONSENT_LOOK[s].hue);

/** Выбор формы обращения — шапка персика; два ответа — шалфей и небо, плитки равного веса. */
export const ENTRY_HUE: PaperHue = 45;
export const ADDRESS_FORM_HUE: Record<'ty' | 'vy', PaperHue> = { ty: 135, vy: 240 };

/** «Поддержать проект» — солома: просьба о самом продукте (знак продукта), не сущность кабинета. */
export const DONATE_HUE: PaperHue = 70;

/** Исходы «готово» и «устарело» — OUTCOME_LOOK (done, wait) из литеральной таблицы (outcomeLook.ts). */
export const JOIN_DONE_LOOK: SheetLook = OUTCOME_LOOK_LIT.done;
export const JOIN_STALE_LOOK: SheetLook = OUTCOME_LOOK_LIT.wait;

/** Слово не встаёт в строку рядом со знаком на телефоне («Присоединиться» 212px при колонке 190–210 на 370–390):
 *  знак — строкой над заголовком (`ef-long`, entry-flows.css), а не перенос по слогам — тот рвал и влезающие. */
export const hasLongWord = (title: string): boolean => /\p{L}{13,}/u.test(title);

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
