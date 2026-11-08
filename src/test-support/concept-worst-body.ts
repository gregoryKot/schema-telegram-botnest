// Тела сохранения концептуализации на пределе DTO — для сверки с потолком
// тела запроса (src/therapy/dto/concept-save.dto.spec.ts) и e2e
// (test/concept-save-patch.e2e-spec.ts). Текст — кириллицей: 2 байта на знак
// в UTF-8, как пересчёт в src/infra/body-limit.ts.
import {
  CONCEPT_FIELD_TEXT_MAX,
  CONCEPT_MODE_ALIAS_MAX,
  CONCEPT_MODE_TEXT_MAX,
  CONCEPT_SCHEMA_TEXT_MAX,
  CONCEPT_TECHNIQUE_MARKS_MAX,
} from '../utils/text-limits';
import { CONCEPT_PATCH_LINKS_MAX } from '../therapy/dto/concept-save.dto';

const cyr = (n: number) => 'ж'.repeat(n);
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

/** Семь текстовых полей, каждое до CONCEPT_FIELD_TEXT_MAX. */
export const conceptTextFields = () =>
  Object.fromEntries(TEXT_FIELDS.map((f) => [f, cyr(CONCEPT_FIELD_TEXT_MAX)]));

export const worstModeLink = (
  i: number,
  done = CONCEPT_TECHNIQUE_MARKS_MAX,
) => ({
  modeId: id('m', i),
  alias: cyr(CONCEPT_MODE_ALIAS_MAX),
  schemaIds: cyrIds('s', 20),
  needIds: cyrIds('n', 20),
  origin: cyr(CONCEPT_MODE_TEXT_MAX),
  manifest: cyr(CONCEPT_MODE_TEXT_MAX),
  strategy: cyr(CONCEPT_MODE_TEXT_MAX),
  done: marks(done),
});

export const worstSchemaLink = (
  i: number,
  done = CONCEPT_TECHNIQUE_MARKS_MAX,
) => ({
  schemaId: id('s', i),
  belief: cyr(CONCEPT_SCHEMA_TEXT_MAX),
  origin: cyr(CONCEPT_SCHEMA_TEXT_MAX),
  needIds: cyrIds('n', 5),
  done: marks(done),
});

/** Худший патч: всё до предела, по `links` связей каждого вида. */
export function worstPatchBody(links = CONCEPT_PATCH_LINKS_MAX) {
  return {
    baseVersion: '2026-11-08T10:00:00.000Z',
    ...conceptTextFields(),
    schemaIds: cyrIds('s', 40),
    modeIds: cyrIds('m', 100),
    modeLinksPatch: {
      upsert: Array.from({ length: links }, (_, i) => worstModeLink(i)),
      remove: cyrIds('r', 40),
    },
    schemaLinksPatch: {
      upsert: Array.from({ length: links }, (_, i) => worstSchemaLink(i)),
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
