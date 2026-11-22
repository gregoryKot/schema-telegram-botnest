// Тела сохранения концептуализации на пределе DTO — для сверки с потолком
// тела запроса (src/therapy/dto/concept-save.dto.spec.ts) и e2e
// (test/concept-save-patch.e2e-spec.ts). Текст — кириллицей: 2 байта на знак
// в UTF-8, как пересчёт в src/infra/body-limit.ts; `EMOJI` — 4 байта, а
// @MaxLength (validator.js) считает пару суррогатов одним знаком.
import {
  CONCEPT_COPING_NOTE_MAX,
  CONCEPT_FIELD_TEXT_MAX,
  CONCEPT_MODE_ALIAS_MAX,
  CONCEPT_MODE_TEXT_MAX,
  CONCEPT_SCHEMA_IDS_MAX,
  CONCEPT_SCHEMA_TEXT_MAX,
  CONCEPT_TECHNIQUE_MARKS_MAX,
} from '../utils/text-limits';
import { CONCEPT_PATCH_LINKS_MAX } from '../therapy/dto/concept-save.dto';

const CYR = 'ж';
export const EMOJI = '😀';
const id = (prefix: string, i: number) => `${prefix}${i}`.padEnd(64, 'x');

/** n разных id по 64 знака (предел DTO). */
export const cyrIds = (prefix: string, n: number) =>
  Array.from({ length: n }, (_, i) => id(prefix, i));

const marks = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    techniqueId: id('t', i),
    day: '2026-11-01',
  }));

const TEXT_FIELDS = [
  'earlyExperience',
  'unmetNeeds',
  'triggers',
  'copingStyles',
  'goals',
  'currentProblems',
  'modeTransitions',
];

/** Семь текстовых полей, каждое до CONCEPT_FIELD_TEXT_MAX знаков `ch`. */
export const conceptTextFields = (ch = CYR) =>
  Object.fromEntries(
    TEXT_FIELDS.map((f) => [f, ch.repeat(CONCEPT_FIELD_TEXT_MAX)]),
  );

export const worstModeLink = (
  i: number,
  done = CONCEPT_TECHNIQUE_MARKS_MAX,
  ch = CYR,
) => ({
  modeId: id('m', i),
  alias: ch.repeat(CONCEPT_MODE_ALIAS_MAX),
  schemaIds: cyrIds('s', 20),
  needIds: cyrIds('n', 20),
  origin: ch.repeat(CONCEPT_MODE_TEXT_MAX),
  manifest: ch.repeat(CONCEPT_MODE_TEXT_MAX),
  strategy: ch.repeat(CONCEPT_MODE_TEXT_MAX),
  done: marks(done),
});

export const worstSchemaLink = (
  i: number,
  done = CONCEPT_TECHNIQUE_MARKS_MAX,
  ch = CYR,
) => ({
  schemaId: id('s', i),
  belief: ch.repeat(CONCEPT_SCHEMA_TEXT_MAX),
  origin: ch.repeat(CONCEPT_SCHEMA_TEXT_MAX),
  needIds: cyrIds('n', 5),
  done: marks(done),
  coping: ['surrender', 'avoidance', 'overcompensation'],
  copingNotes: {
    surrender: ch.repeat(CONCEPT_COPING_NOTE_MAX),
    avoidance: ch.repeat(CONCEPT_COPING_NOTE_MAX),
    overcompensation: ch.repeat(CONCEPT_COPING_NOTE_MAX),
  },
});

/** Худший патч: всё до предела знаками `ch`, по `links` связей каждого вида. */
export function worstPatchBody(links = CONCEPT_PATCH_LINKS_MAX, ch = CYR) {
  const marksMax = CONCEPT_TECHNIQUE_MARKS_MAX;
  const upsert = <L>(link: (i: number, done: number, text: string) => L) =>
    Array.from({ length: links }, (_, i) => link(i, marksMax, ch));
  return {
    baseVersion: '2026-11-08T10:00:00.000Z',
    ...conceptTextFields(ch),
    schemaIds: cyrIds('s', CONCEPT_SCHEMA_IDS_MAX),
    modeIds: cyrIds('m', 100),
    modeLinksPatch: { upsert: upsert(worstModeLink), remove: cyrIds('r', 40) },
    schemaLinksPatch: {
      upsert: upsert(worstSchemaLink),
      remove: cyrIds('r', 20),
    },
  };
}

/** Полное тело на пределе без отметок: 40 связей режимов, 20 схем. */
export function worstFullBody() {
  return {
    ...conceptTextFields(),
    modeLinks: Array.from({ length: 40 }, (_, i) => worstModeLink(i, 0)),
    schemaLinks: Array.from({ length: 20 }, (_, i) => worstSchemaLink(i, 0)),
  };
}
