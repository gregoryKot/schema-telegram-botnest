// Фикстура подсказок терапевту (#995) для тестов плашки и листов сайта: свой
// раздел и своя библиотека, чтобы тесты не зависели от текстов
// shared/src/schemaTherapy/guide/modes|techniques.
import type { ModeGuide, TechniqueGuide } from '../../schemaTherapy/guide';
import type { ModeGuideView } from './conceptGuide';

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
