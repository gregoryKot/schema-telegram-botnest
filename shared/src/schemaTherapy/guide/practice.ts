import type { PracticeNotesBuilder } from './types';
import { buildPracticeAssessment } from './practiceAssessment';
import { buildPracticeConceptualization } from './practiceConceptualization';
import { buildPracticeCourse } from './practiceCourse';
import { buildPracticeChange } from './practiceChange';
import { buildPracticeEmdr } from './practiceEmdr';
import { buildPracticeEnding } from './practiceEnding';
import { buildPracticeOnline } from './practiceOnline';
import { buildPracticeSituations } from './practiceSituations';
import { buildPracticeTherapist } from './practiceTherapist';
import { buildPracticeStuck } from './practiceStuck';
import { buildPracticeYoungSession } from './practiceYoungSession';
import { buildPracticeYoungStart } from './practiceYoungStart';

/**
 * «Для терапевта»: что добавляют к рамке другие книги, три источника
 * тупиков, «болтовня» вместо терапии, ошибки в методе; схемы терапевта,
 * супервизия и выгорание — в practiceTherapist.ts. Трудные ситуации в сессии, групповой формат и намеренная
 * практика — в practiceSituations.ts, порядок разделов на листе — этот.
 * Источник — разделы справочника (версия на 65 страниц) «Что добавляют к рамке другие книги»,
 * «Частые ошибки терапевта», «Трудные ситуации в сессии», «Групповая схема-терапия», «Намеренная практика».
 * Форма листа: суть, 3–5 пунктов, «Как это звучит» и «Подробнее» — как у режимов и схем.
 */
export const buildPracticeNotes: PracticeNotesBuilder = (tr) => [
  {
    id: 'frame_additions',
    group: 'method',
    title: 'Что добавляют к рамке метода другие книги',
    summary:
      'Основа метода остаётся прежней. Другие книги добавляют к ней мерило заботы, работу с телом, тонкости диагностики и карту режимов на стульях.',
    points: [
      'Сверять заботу с семью паттернами. Локвуд и Сэмсон описали, как выглядит хорошая родительская забота, и по ним удобно решать, какая техника нужна сейчас [Хис, гл. 4].',
      'Смотреть на тело. Схема живёт и как телесная привычка: поза, дыхание, напряжение. По телу узнают режим, а в телесных экспериментах складываются новые привычки [Хис, гл. 3].',
      'Не спешить с выводами. В диагностике через чувства и образы контакт важнее сбора фактов, а функцию режима не присваивают по умолчанию [Хис, гл. 2].',
      'Разложить режимы на стульях. Копинговый режим — на «главной сцене», Критик и ребёнок — в «закулисье». Клиент видит, что за привычными мыслями есть что-то ещё, и его не захлёстывает [Рёдигер, гл. 6].',
      'Держать в уме Уязвимого Ребёнка. Большинство схем живёт в нём, поэтому его считают базовым режимом [Рафаэли, гл. 9].',
    ],
    more: [
      'Семь паттернов Локвуд и Сэмсон. Эмоциональная забота: глубокая привязанность, любовь, доступность в оговорённых рамках, открытость. Безусловная любовь: терпимость к ошибкам, уважительные границы, готовность признать свои ошибки. И ещё сила и наставничество. Паттерны держат и близость, и самостоятельность [Хис, гл. 4, Локвуд и Сэмсон].',
      'С телом работать безопасно, пока клиент в окне толерантности, то есть волнение ему по силам [Хис, гл. 3, Бридис и Стартап].',
      'Отдельно ищут смешанные режимы: самокритика, например, может работать как копинг, который держит самооценку [Хис, гл. 2, Бокинг и Лавендер].',
      'Исключения из правила про Уязвимого Ребёнка — Привилегированность и Недостаточность самоконтроля: они теснее связаны с Импульсивным Ребёнком [Рафаэли, гл. 9].',
      'Карта режимов на стульях подробно — в технике «Работа со стульями».',
    ],
    sources: '[Хис, гл. 2–4], [Рёдигер, гл. 6], [Рафаэли, гл. 9]',
  },
  ...buildPracticeStuck(tr),
  ...buildPracticeTherapist(tr),
  ...buildPracticeSituations(tr),
  ...buildPracticeOnline(tr),
  ...buildPracticeAssessment(tr),
  ...buildPracticeConceptualization(tr),
  ...buildPracticeCourse(tr),
  ...buildPracticeChange(tr),
  ...buildPracticeEnding(tr),
  ...buildPracticeEmdr(tr),
  ...buildPracticeYoungStart(tr),
  ...buildPracticeYoungSession(tr),
];
