import type { TechniqueGuideBuilder } from '../types';
import { coupleModeCycleSteps } from './coupleModeCycleSteps';
import { coupleModeCycleMore } from './coupleModeCycleMore';
import { cycleWhen, cycleCautions, valuesMore } from './coupleModeCycleFrame';

/** Ценности и пара: values_overview, couple_mode_cycle. */
export const buildBodyValuesTechniques: TechniqueGuideBuilder = (tr) => [
  {
    id: 'values_overview',
    group: 'cognitive',
    name: 'Ценности и «взгляд сверху»',
    summary:
      'Клиент выясняет, что для него важно, и учится смотреть на столкновение своих режимов со стороны — чтобы выбирать шаг по ценностям, а не по схеме.',
    when: 'Поздняя фаза терапии: режимы знакомы, и нужно строить жизнь, а не только останавливать схему. И в момент, когда режим у руля и клиенту нужно на шаг отойти [Рёдигер и соавт., 2018].',
    steps: [
      'Расспросить о ценностях по сферам: отношения, работа, здоровье, отдых. Вопрос — как хочется жить, а не чего достичь.',
      'Взять недавнюю ситуацию и посмотреть на неё со стороны: какие режимы там были, что каждый говорил и чего хотел.',
      'Спросить из позиции Здорового Взрослого: что здесь важно мне, а не схеме? Какой шаг был бы в эту сторону?',
      'Выбрать один небольшой шаг на неделю и заранее назвать, какой режим будет мешать.',
      'На следующей сессии разобрать, получилось ли отойти и посмотреть: что помогло, что сбило.',
    ],
    voice: [
      tr(
        'Давай на минуту отойдём и посмотрим на эту ссору сверху. Кто там сейчас говорит — и чего хочется тебе, когда оба голоса замолкают?',
        'Давайте на минуту отойдём и посмотрим на эту ссору сверху. Кто там сейчас говорит — и чего хочется вам, когда оба голоса замолкают?',
      ),
    ],
    cautions:
      'Требовательный Критик легко выдаёт свои «надо» за ценности: ценность выбирают, от правила устают. «Взгляд сверху» — не способ отключиться: клиент смотрит со стороны и ничего не чувствует — это Отстранённый Защитник, а не Здоровый Взрослый.',
    more: valuesMore,
    sources:
      'Roediger E., Stevens B. A., Brockman R. Contextual Schema Therapy: An Integrative Approach to Personality Disorders, Emotional Dysregulation, and Interpersonal Functioning. Context Press / New Harbinger, 2018; [Пары, гл. 12].',
  },
  {
    id: 'couple_mode_cycle',
    group: 'formulation',
    name: 'Цикл столкновения режимов в паре',
    summary:
      'Терапевт и пара рисуют круг ссоры: режим одного запускает режим другого, тот отвечает — и так по кругу. Противником становится цикл, а не партнёр.',
    when: cycleWhen,
    steps: coupleModeCycleSteps,
    voice: [
      tr(
        'Когда ты замолкаешь, партнёр слышит «мне всё равно» и повышает голос. Когда голос повышается, ты слышишь «со мной что-то не так» и замолкаешь ещё сильнее. Это круг, и запускает его не кто-то один.',
        'Когда вы замолкаете, партнёр слышит «мне всё равно» и повышает голос. Когда голос повышается, вы слышите «со мной что-то не так» и замолкаете ещё сильнее. Это круг, и запускает его не кто-то один.',
      ),
    ],
    more: coupleModeCycleMore,
    cautions: cycleCautions,
    sources:
      'Simeone-DiFrancesco C., Roediger E., Stevens B. A. Schema Therapy with Couples: A Practitioner’s Guide to Healing Relationships. Wiley-Blackwell, 2015, гл. 8 «Mode Mapping and Mode Cycle Clash-cards»; [Янг, гл. 7]; [Арнтц ПРЛ, гл. 10]; [Хис, гл. 13]; [Пары, гл. 2, 6–12].'
  },
];
