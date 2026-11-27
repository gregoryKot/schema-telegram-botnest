import { ADOLESCENTS_MODE_MODEL } from './adolescentsModes';
import { ADOLESCENTS_PSYCHOEDUCATION } from './adolescentsEducation';
import { ADOLESCENTS_SESSIONS } from './adolescentsSessions';

/** Дети и подростки: рисунки и оценка играми (карта docs/guide-sources/Дети.md, пачка 5). */
export const ADOLESCENTS_MODE_MODEL_FULL: string = [
  ADOLESCENTS_MODE_MODEL,
  'На рисунках режимов Уязвимый Ребёнок у детей может делиться на «стыд» и «страх»: переживаются как разные состояния, хотя в модели это один режим. До этих частей на первых встречах не добраться: они спрятаны за режимом «Маскировка» [Луз, гл. 12].',
  'Умный и Мудрый Ребёнок на рисунке не пропадает, когда Сердитый Ребёнок рвётся к власти, а волна возбуждения показывает, как тело готовит смену режима [Луз, гл. 12].',
].join(' ');

export const ADOLESCENTS_PSYCHOEDUCATION_FULL: string[] = [
  ...ADOLESCENTS_PSYCHOEDUCATION,
  'Слово «настроение» ребёнку понятно, но неточно: режим — скрытое состояние с мыслями, воспоминаниями и телом, не всегда видимое. «Чувство» тоже грубее. Кто может понять слово «режим», тому оно подходит лучше [Луз, гл. 12].',
];

export const ADOLESCENTS_SESSIONS_FULL: typeof ADOLESCENTS_SESSIONS = {
  ...ADOLESCENTS_SESSIONS,
  inSession: `${ADOLESCENTS_SESSIONS.inSession} Для гипотез об оценке школьника берут проективные и творческие методы: остров («кого или что взял бы с собой»), завершение предложений и рассказов, семью как животных, свободный рисунок, ролевое интервью, где ребёнок играет родителя [Луз, гл. 6].`,
};

export {
  ADOLESCENTS_MODE_IDS,
  ADOLESCENTS_SCHEMA_IDS,
} from './adolescentsModes';
