import type { SchemaCoping } from '../types';
import type { SCHEMA_COPING } from './coping';

// Выжимка копинга в 2–4 слова на каждый стиль: жирная строка клетки таблицы «Справочника», под ней —
// полный текст из SCHEMA_COPING. Набор схем совпадает с SCHEMA_COPING (тип ниже и copingHeadlines.test.ts).

/** id схемы из schemaDomains.ts → выжимки: капитуляция, избегание, гиперкомпенсация. */
export const SCHEMA_COPING_HEADLINES: Record<
  keyof typeof SCHEMA_COPING,
  SchemaCoping
> = {
  emotional_deprivation: {
    surrender: 'Не просит тепла',
    avoidance: 'Обходится без близости',
    overcompensation: 'Требует всё больше заботы',
  },
  abandonment: {
    surrender: 'Держится за ненадёжных',
    avoidance: 'Уходит первым',
    overcompensation: 'Цепляется и ревнует',
  },
  mistrust: {
    surrender: 'Терпит тех, кто ранит',
    avoidance: 'Ничего личного о себе',
    overcompensation: 'Нападает первым',
  },
  defectiveness: {
    surrender: 'Терпит критику, принижает себя',
    avoidance: 'Прячет настоящие чувства',
    overcompensation: 'Безупречный фасад',
  },
  social_isolation: {
    surrender: 'Держится с краю',
    avoidance: 'Не ходит в компании',
    overcompensation: 'Хамелеон или «выше всех»',
  },
  dependence: {
    surrender: 'Отдаёт решения другим',
    avoidance: 'Не берётся за новое',
    overcompensation: 'Всё тянет в одиночку',
  },
  vulnerability: {
    surrender: 'Ждёт катастрофы, проверяет',
    avoidance: 'Обходит небезопасное',
    overcompensation: 'Нарочно рискует',
  },
  enmeshment: {
    surrender: 'Живёт жизнью другого',
    avoidance: 'Сторонится близости',
    overcompensation: 'Всё назло семье',
  },
  failure: {
    surrender: 'Делает вполсилы',
    avoidance: 'Обходит оценку',
    overcompensation: 'Гонится за регалиями',
  },
  entitlement: {
    surrender: 'Требует особых условий',
    avoidance: 'Избегает быть на равных',
    overcompensation: 'Подчёркнуто скромничает',
  },
  insufficient_self_control: {
    surrender: 'Бросает, поддаётся импульсам',
    avoidance: 'Уклоняется от рутины',
    overcompensation: 'Жёсткий режим — и срыв',
  },
  subjugation: {
    surrender: 'Уступает, злость копится',
    avoidance: 'Уходит от «нет»',
    overcompensation: 'Бунтует, тихо саботирует',
  },
  self_sacrifice: {
    surrender: 'Отдаёт, ничего не просит',
    avoidance: 'Не принимает заботы',
    overcompensation: 'Резко перестаёт давать',
  },
  approval_seeking: {
    surrender: 'Старается впечатлить',
    avoidance: 'Избегает оценивающих',
    overcompensation: 'Нарочно эпатирует',
  },
  negativity: {
    surrender: 'Видит только плохое',
    avoidance: 'Не строит планов',
    overcompensation: 'Показной оптимизм',
  },
  emotion_inhibition_fear: {
    surrender: 'Гасит чувства в зародыше',
    avoidance: 'Уходит от напряжения',
    overcompensation: 'Наигранные бурные реакции',
  },
  emotional_inhibition: {
    surrender: 'Ровно, логично, без чувств',
    avoidance: 'Обходит разговоры о чувствах',
    overcompensation: 'Натянутая живость',
  },
  unrelenting_standards: {
    surrender: 'Шлифует до идеала',
    avoidance: 'Откладывает из-за оценки',
    overcompensation: '«И так сойдёт»',
  },
  punitiveness_self: {
    surrender: 'Наказывает себя',
    avoidance: 'Не рискует ошибиться',
    overcompensation: 'Не признаёт вины',
  },
  punitiveness_others: {
    surrender: 'Требует наказания',
    avoidance: 'Держит людей на дистанции',
    overcompensation: 'Всё прощает — гнев копится',
  },
};
