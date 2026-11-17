import type { TechniqueId } from '../../schemaTherapy/guide/types';
import type { ExId } from '../../exercises/exerciseCatalog';
import type { SessionWorkKind } from './types';

/** Поле пункта «Что делали»: ключ хранения и подпись в форме. */
export type WorkField = readonly [key: string, label: string];

// Короткие названия техник для списка выбора: полные живут в ленивом чанке
// подсказок (guide/techniques), а список нужен сразу. Набор id держит тип.
export const TECHNIQUE_WORK: Record<
  TechniqueId,
  { name: string; fields: readonly WorkField[] }
> = {
  imagery_rescripting: {
    name: 'Рескриптинг в воображении',
    fields: [
      ['trigger', 'Ситуация-триггер'],
      ['image', 'Образ: возраст и что происходило'],
      ['rewrite', 'Как переписали: кто вошёл и что сделал'],
      ['ending', 'Чем закончилось'],
    ],
  },
  future_imagery: {
    name: 'Образ будущего',
    fields: [
      ['situation', 'Предстоящая ситуация'],
      ['rehearsal', 'Что репетировали'],
      ['obstacle', 'Что мешало'],
      ['result', 'Итог'],
    ],
  },
  chairwork: {
    name: 'Работа со стульями',
    fields: [
      ['theme', 'Тема диалога'],
      ['modeVoice', 'Что говорил режим'],
      ['adultVoice', 'Что ответил Здоровый Взрослый'],
      ['ending', 'Чем закончилось'],
    ],
  },
  historical_role_play: {
    name: 'Историческая ролевая игра',
    fields: [
      ['scene', 'Сцена из прошлого'],
      ['roles', 'Кто кого играл'],
      ['insight', 'Что стало видно после смены ролей'],
      ['newScene', 'Новый вариант сцены'],
    ],
  },
  flashcards: {
    name: 'Флеш-карта',
    fields: [
      ['trigger', 'Триггер'],
      ['text', 'Текст карточки'],
      ['when', 'Когда ею пользоваться'],
    ],
  },
  cognitive_work: {
    name: 'Когнитивная работа',
    fields: [
      ['belief', 'Убеждение'],
      ['pro', 'Доводы за'],
      ['contra', 'Доводы против'],
      ['reframe', 'Новая формулировка'],
    ],
  },
  letters: {
    name: 'Письма',
    fields: [
      ['addressee', 'Кому письмо'],
      ['main', 'Главное в письме'],
      ['reading', 'Что было, когда читали'],
    ],
  },
  pattern_breaking: {
    name: 'Прорыв паттерна',
    fields: [
      ['habit', 'Привычное поведение'],
      ['instead', 'Что пробуем вместо'],
      ['obstacle', 'Что может помешать'],
      ['agreement', 'Договорённость'],
    ],
  },
  mindfulness: {
    name: 'Осознанность',
    fields: [
      ['exercise', 'Упражнение'],
      ['noticed', 'Что замечалось'],
      ['result', 'Итог'],
    ],
  },
  empathic_confrontation: {
    name: 'Эмпатическая конфронтация',
    fields: [
      ['behavior', 'О каком поведении говорили'],
      ['origin', 'Откуда оно, что признали'],
      ['cost', 'Чего оно стоит'],
      ['response', 'Как отозвалось'],
    ],
  },
  pros_cons: {
    name: '«За и против» режима',
    fields: [
      ['subject', 'Что взвешивали'],
      ['pro', 'За'],
      ['contra', 'Против'],
      ['result', 'Вывод'],
    ],
  },
  mode_interview: {
    name: 'Интервью режима',
    fields: [
      ['origin', 'Когда появился'],
      ['protects', 'От чего защищает, чего хочет'],
      ['fears', 'Чего боится, если отступит'],
      ['agreement', 'О чём договорились'],
    ],
  },
  self_compassion: {
    name: 'Самосострадание',
    fields: [
      ['situation', 'Ситуация'],
      ['critic', 'Что говорит Критик'],
      ['support', 'Слова поддержки'],
      ['response', 'Как отозвалось'],
    ],
  },
  healthy_adult_imagery: {
    name: 'Образ Здорового Взрослого',
    fields: [
      ['situation', 'Ситуация'],
      ['adult', 'Как выглядит и что делает Здоровый Взрослый'],
      ['child', 'Что услышал Уязвимый Ребёнок'],
      ['result', 'Итог'],
    ],
  },
};

/** Упражнения приложения: названия — exerciseCatalog (names.ts). */
export const EXERCISE_WORK_FIELDS: Record<ExId, readonly WorkField[]> = {
  belief: [
    ['belief', 'Убеждение'],
    ['evidence', 'Что нашли за и против'],
    ['result', 'Вывод'],
  ],
  schema: [
    ['learned', 'Что узнали: триггеры, тело, истоки'],
    ['fresh', 'Что оказалось новым'],
  ],
  mode: [
    ['learned', 'Что узнали: когда включается, что чувствуется'],
    ['fresh', 'Что оказалось новым'],
  ],
  letter: [
    ['main', 'Главное в письме'],
    ['reading', 'Что было, когда читали'],
  ],
  safe: [
    ['place', 'Какое место'],
    ['way', 'Что помогает туда попасть'],
    ['after', 'Состояние после'],
  ],
  wheel: [
    ['unmet', 'Какие потребности не закрывались'],
    ['discussed', 'Что обсудили'],
  ],
  warm: [
    ['words', 'Какие слова подошли'],
    ['response', 'Как отозвалось'],
  ],
  phrase: [
    ['phrases', 'Какие фразы разбирали'],
    ['insight', 'Что стало понятно'],
  ],
};

/** «Своё»: название — отдельное поле пункта (customName). */
export const CUSTOM_WORK_FIELDS: readonly WorkField[] = [
  ['what', 'Что делали'],
  ['result', 'Итог'],
];

const own = (o: object, k: unknown): k is string =>
  typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);

/** Поля вида; null — такого вида или id в каталоге нет. */
export function workFields(
  kind: SessionWorkKind,
  refId?: unknown,
): readonly WorkField[] | null {
  if (kind === 'custom') return CUSTOM_WORK_FIELDS;
  if (kind === 'technique')
    return own(TECHNIQUE_WORK, refId)
      ? TECHNIQUE_WORK[refId as TechniqueId].fields
      : null;
  return own(EXERCISE_WORK_FIELDS, refId)
    ? EXERCISE_WORK_FIELDS[refId as ExId]
    : null;
}
