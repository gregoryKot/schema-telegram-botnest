// Фикстура подсказок терапевту (#995) для тестов плашки и листов сайта: свои
// разделы режима и схемы, своя библиотека и раздел «Для терапевта», чтобы тесты
// не зависели от текстов shared/src/schemaTherapy/guide/modes|schemas|techniques|practice.
import type {
  ModeGuide,
  PracticeNote,
  SchemaGuide,
  TechniqueGuide,
} from '../../schemaTherapy/guide';
import type { ModeGuideView, SchemaGuideView } from './conceptGuide';

export const FIXTURE_TECHNIQUES: TechniqueGuide[] = [
  {
    id: 'imagery_rescripting',
    name: 'Рескриптинг образов',
    summary: 'Возвращаемся в детскую сцену и меняем её конец.',
    when: 'Когда Ребёнок отзывается на воспоминание',
    steps: ['Найти сцену', 'Войти в образ', 'Дать заботу'],
    cautions: 'Не в остром кризисе',
    evidence: 'Несколько рандомизированных исследований',
    sources: '[Арнтц, 6.2]',
  },
  {
    id: 'chairwork',
    name: 'Работа со стульями',
    summary: 'Режимы говорят друг с другом с разных стульев.',
    steps: ['Расставить стулья', 'Дать слово каждому'],
    sources: '[Кембридж, гл. 8]',
  },
];

export const FIXTURE_GUIDE: ModeGuide = {
  modeId: 'vulnerable_child',
  goal: 'Дать Ребёнку опыт заботы, которого не хватало',
  what: 'Детская часть с болью и страхом.',
  relationship: 'Тёплый тон и ограниченный репарентинг',
  cognitive: 'Связать чувства с потребностями',
  experiential: 'Рескриптинг детских сцен',
  techniques: ['imagery_rescripting', 'chairwork'],
  betweenSessions: [
    {
      kind: 'task',
      type: 'letter_to_self',
      title: 'Письмо себе',
      note: 'от Здорового Взрослого',
    },
    {
      kind: 'custom',
      title: 'Встреча со своим маленьким Я',
      text: 'Пять минут в день побыть рядом с детским образом',
    },
  ],
  stuck: 'Клиент уходит в Отстранённого Защитника',
  sources: '[Арнтц, 4.1], [Якоб, 3]',
};

export const FIXTURE_VIEW: ModeGuideView = {
  guide: FIXTURE_GUIDE,
  techniques: FIXTURE_TECHNIQUES,
};

export const FIXTURE_SCHEMA_GUIDE: SchemaGuide = {
  schemaId: 'abandonment',
  goal: 'Опыт надёжной связи, которая выдерживает разлуку',
  essence: 'Близкие уйдут или будут непредсказуемы.',
  need: 'Надёжная, предсказуемая связь',
  coping: {
    surrender: 'Выбирает недоступных партнёров',
    avoidance: 'Не подпускает близко, уходит первым',
    overcompensation: 'Цепляется и контролирует',
  },
  modeIds: ['abandoned_child', 'angry_child', 'нет_такого_режима'],
  inSession: 'Перерыв в терапии ощущается как уход',
  reparenting: 'Я здесь и никуда не денусь',
  interventions: ['Рескриптинг сцен ухода', 'Заранее объявлять перерывы'],
  techniques: ['chairwork', 'imagery_rescripting'],
  betweenSessions: [
    {
      kind: 'task',
      type: 'schema_intro',
      title: 'Карточка схемы',
      note: 'узнать схему в моменте',
    },
    {
      kind: 'custom',
      title: 'Дневник разлук',
      text: 'Записывать, что происходит, когда близкий долго не отвечает',
    },
  ],
  stuck: 'Клиент проверяет терапевта пропусками',
  sources: '[Арнтц, 1.1.2], [Касьяник]',
};

export const FIXTURE_DOMAIN_NOTE = 'В основе нарушенная привязанность.';

export const FIXTURE_SCHEMA_VIEW: SchemaGuideView = {
  guide: FIXTURE_SCHEMA_GUIDE,
  domainNote: FIXTURE_DOMAIN_NOTE,
  techniques: [FIXTURE_TECHNIQUES[1], FIXTURE_TECHNIQUES[0]],
};

/** Раздел «Для терапевта» новой формы: суть, пункты, реплика, «Подробнее». */
export const FIXTURE_PRACTICE_NOTE: PracticeNote = {
  id: 'group_therapy',
  title: 'Групповой формат',
  summary: 'В группе режимы видны в отношениях с другими участниками.',
  points: [
    'Объявить правила группы в начале.',
    'Замечать режим, когда он включился в группе.',
    'Давать ограниченное родительство вдвоём.',
  ],
  voice: [
    'Похоже, сейчас включился Отстранённый Защитник. Что было прямо перед этим?',
  ],
  more: ['Программа идёт блоками по 12 сессий.'],
  sources: '[Фаррелл, гл. 2]',
};
