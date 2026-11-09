// Таблица исходов OUTCOME_LOOK (shared/src/theme/entityLook.ts) литералами — одна копия на главный поток
// сайта: лист исхода (PaperOutcome), исходы приглашения (entryLook) и бумага «Готово» карточки дня в меню
// (sidebarDay). Рантайм-импорт entityLook в главный поток перекраивал чанки: CSS упражнений вставал
// раньше index.css (check-css-link-order). Партиям, которые берут PaperOutcome, — не возвращать импорт
// entityLook. Сверка с shared — outcomeLook.test.ts.
import type { Look, OutcomeId } from '../../../../shared/src/theme/entityLook';

export const OUTCOME_LOOK_LIT: Readonly<Record<OutcomeId, Look>> = {
  done: { hue: 135, sign: 'check' }, limit: { hue: 240, sign: 'limits' }, wait: { hue: 70, sign: 'cup' },
  our_side: { hue: 45, sign: 'breath' }, updated: { hue: 135, sign: 'leaf' },
};
