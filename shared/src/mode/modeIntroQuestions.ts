/**
 * Семь вопросов карточки «Знакомство с режимом» — паритет с карточкой схемы
 * (SCHEMA_QUESTIONS, webapp/src/components/exercises/flashcardQuestions.ts —
 * 7 вопросов). Общий источник для обоих фронтендов (правило №3/№11
 * CLAUDE.md) — раньше вопросы дублировались (QUESTIONS в
 * schema-miniapp/src/components/ModeIntroSheet.tsx и MODE_QUESTIONS в
 * webapp/src/components/exercises/flashcardQuestions.ts, только 5 штук).
 *
 * Плейсхолдер каждого вопроса — конкретный пример ИМЕННО для этого режима, из
 * его портрета (shared/src/mode/modeCards/ — портреты режимов). Это
 * пример-ориентир, а НЕ готовый ответ и НЕ значение поля — пользователь пишет
 * своё (та же логика, что в shared/src/mode/healthyAdultHints.ts). Без
 * карточки (card === undefined) — общий плейсхолдер-фолбэк.
 *
 * Формулировки вопросов form-agnostic — безличные, без обращения ко второму
 * лицу (см. правило обращения в CLAUDE.md) — развод по форме не нужен.
 */
import type { ModeCard } from './modeCards';

/** Ключи ответов карточки режима — совпадают с колонками UserModeNote. Union,
 *  а не string: IntroSheetShell типизирован по `keyof T`, и широкий string
 *  ломает подстановку (опечатка в ключе должна падать на компиляции). */
export type ModeIntroKey =
  | 'triggers'
  | 'feelings'
  | 'thoughts'
  | 'behavior'
  | 'needs'
  | 'origins'
  | 'healthyView';

export interface ModeIntroQuestion {
  key: ModeIntroKey;
  label: string;
  hint: string;
  placeholder: string;
  optional?: boolean;
}

const FALLBACK_PLACEHOLDER: Record<ModeIntroKey, string> = {
  triggers: 'Когда меня критикуют, когда нужно выступить…',
  feelings: 'Тревога, комок в горле, напряжение в плечах…',
  thoughts: '«Я недостаточно хорош», «Лучше не рисковать»…',
  behavior: 'Замолкаю, избегаю, злюсь, переусердствую…',
  needs: 'Безопасности, признания, контакта…',
  origins: 'Может быть, когда-то это помогало справляться с трудным…',
  healthyView: '«Это тяжело, но это можно пережить — есть на что опереться»',
};

export function buildModeIntroQuestions(card?: ModeCard): ModeIntroQuestion[] {
  return [
    {
      key: 'triggers',
      label: 'Когда этот режим включается?',
      hint: 'Ситуации, люди, слова — что его запускает',
      placeholder: card?.triggers ?? FALLBACK_PLACEHOLDER.triggers,
    },
    {
      key: 'feelings',
      label: 'Что чувствуется в теле и эмоциях?',
      hint: 'Ощущения в теле и эмоции, когда режим активен',
      placeholder: card?.body ?? FALLBACK_PLACEHOLDER.feelings,
    },
    {
      key: 'thoughts',
      label: 'Что этот режим говорит внутри?',
      hint: 'Убеждения, монолог, голос этого режима',
      placeholder: card?.voice ?? FALLBACK_PLACEHOLDER.thoughts,
    },
    {
      key: 'behavior',
      label: 'Что происходит в поведении?',
      hint: 'Действия и реакции, когда режим включён',
      placeholder: card?.behavior ?? FALLBACK_PLACEHOLDER.behavior,
    },
    {
      key: 'needs',
      label: 'Чего он на самом деле хочет?',
      hint: 'Глубинная потребность за этим режимом',
      placeholder: card?.need ?? FALLBACK_PLACEHOLDER.needs,
    },
    {
      key: 'origins',
      label: 'Зачем он когда-то появился?',
      hint: 'Опыт, из которого возник этот режим — без обвинения, просто как есть',
      placeholder: card?.origin ?? FALLBACK_PLACEHOLDER.origins,
      optional: true,
    },
    {
      key: 'healthyView',
      label: 'Что Здоровый Взрослый скажет этому режиму?',
      hint: 'Голос зрелой, поддерживающей части',
      placeholder: card?.healthyAdult ?? FALLBACK_PLACEHOLDER.healthyView,
    },
  ];
}
