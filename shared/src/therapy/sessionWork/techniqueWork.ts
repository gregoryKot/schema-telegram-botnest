import type {
  CoreTechniqueId,
  TechniqueId,
} from '../../schemaTherapy/guide/techniqueIds';
import type { WorkField } from './fields';
import { SCHEMA_TECHNIQUE_WORK } from './techniqueWorkSchema';
import { BORROWED_TECHNIQUE_WORK } from './techniqueWorkBorrowed';
import { CAMBRIDGE_TECHNIQUE_WORK } from './techniqueWorkCambridge';
import { YOUNG_TECHNIQUE_WORK } from './techniqueWorkYoung';
import { ARNTZ_TECHNIQUE_WORK } from './techniqueWorkArntz';
import { FARRELL_TECHNIQUE_WORK } from './techniqueWorkFarrell';

export type TechniqueWorkDef = { name: string; fields: readonly WorkField[] };

// Короткие названия техник для списка выбора: полные живут в ленивом чанке
// подсказок (guide/techniques), а список нужен сразу. Набор id держит тип.
const CORE_TECHNIQUE_WORK: Record<CoreTechniqueId, TechniqueWorkDef> = {
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

export const TECHNIQUE_WORK: Record<TechniqueId, TechniqueWorkDef> = {
  ...CORE_TECHNIQUE_WORK,
  ...SCHEMA_TECHNIQUE_WORK,
  ...CAMBRIDGE_TECHNIQUE_WORK,
  ...YOUNG_TECHNIQUE_WORK,
  ...ARNTZ_TECHNIQUE_WORK,
  ...FARRELL_TECHNIQUE_WORK,
  ...BORROWED_TECHNIQUE_WORK,
};
