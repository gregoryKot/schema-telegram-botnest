// Реестр таблиц базы знаний (.claude/rules/knowledge-base.md, раздел 3): каждый файл, который
// держит свою таблицу или список по id режимов, схем, техник или потребностей. Сверка — kb/*.test.ts.
import {
  ALL_MODES,
  ALL_SCHEMAS,
  MODE_GROUPS,
  SCHEMA_DOMAINS,
} from '../schemaTherapyData';
import { buildTechniqueGuides } from '../guide/index';
import type { Tr } from '../guide/types';
import { NEED_ORDER } from '../../needs/types';
import type { KbIgnore, KbKind, KbTable } from './check';
import { MODE_TABLES } from './tablesModes';
import { SCHEMA_TECHNIQUE_TABLES } from './tablesSchemas';
import { NEED_TABLES } from './tablesNeeds';

const tr: Tr = (t) => t;

/** Источник id каждого вида — один. */
export function kbIds(kind: KbKind): readonly string[] {
  switch (kind) {
    case 'mode':
      return ALL_MODES.map((m) => m.id);
    case 'schema':
      return ALL_SCHEMAS.map((s) => s.id);
    case 'technique':
      return buildTechniqueGuides(tr).map((t) => t.id);
    case 'need':
      return NEED_ORDER;
  }
}

/** id групп режимов и доменов схем: не считаются id режимов и схем. */
export const KB_GROUP_IDS: readonly string[] = [
  ...MODE_GROUPS.map((g) => g.id),
  ...SCHEMA_DOMAINS.map((d) => d.id),
];

/** Файлы-источники id: обнаружитель их не проверяет. */
export const KB_SOURCES: readonly string[] = [
  'shared/src/schemaTherapy/content/',
  'shared/src/schemaTherapy/guide/techniqueIds.ts',
  'shared/src/needs/types.ts',
  'shared/src/needs/content/',
];

export const KB_TABLES: readonly KbTable[] = [
  ...MODE_TABLES,
  ...SCHEMA_TECHNIQUE_TABLES,
  ...NEED_TABLES,
];

const LINKS_CHECKED =
  'связи раздела (modeIds, techniques) — проверка в kb/links.test.ts';
const PART = (table: string) =>
  `часть ${table}: полнота сверяется по собранной таблице`;

/** Файлы, где обнаружитель видит ≥4 id, но своей таблицы по id нет. */
export const KB_SCAN_IGNORE: readonly KbIgnore[] = [
  { file: 'shared/src/schemaTherapy/guide/modes/', why: LINKS_CHECKED },
  { file: 'shared/src/schemaTherapy/guide/schemas/', why: LINKS_CHECKED },
  { file: 'shared/src/schemaTherapy/guide/concerns/', why: LINKS_CHECKED },
  {
    file: 'shared/src/schemaTherapy/guide/concerns/',
    why: 'статья «Запросов»: modeIds, schemaIds, techniques — проверка в guide/concerns/concerns.test.ts',
  },
  {
    file: 'shared/src/schemaTherapy/guide/phases/',
    why: 'фаза «Путь терапии»: modeIds, techniques — проверка в guide/phases/phases.test.ts',
  },
  {
    file: 'shared/src/therapy/path/templates/',
    why: 'шаблон пути клиента: адреса разделов — проверка в path/templates/templates.test.ts',
  },
  {
    file: 'shared/src/mode/modeCards/',
    why: PART('MODE_CARDS (modeCards/index.ts)'),
  },
  {
    file: 'shared/src/mode/modeDoubts/',
    why: PART('MODE_DOUBT_PAIRS (modeDoubts/index.ts)'),
  },
  {
    file: 'shared/src/mode/modeTestControl.ts',
    why: PART('MODE_TEST_GROUPS (mode/modeTest.ts)'),
  },
  {
    file: 'shared/src/therapy/sessionWork/techniqueWorkArntz.ts',
    why: PART('TECHNIQUE_WORK (sessionWork/techniqueWork.ts)'),
  },
  {
    file: 'shared/src/therapy/sessionWork/techniqueWorkFarrell.ts',
    why: PART('TECHNIQUE_WORK (sessionWork/techniqueWork.ts)'),
  },
  {
    file: 'shared/src/therapy/sessionWork/techniqueWorkBorrowed.ts',
    why: PART('TECHNIQUE_WORK (sessionWork/techniqueWork.ts)'),
  },
  {
    file: 'shared/src/therapy/sessionWork/techniqueWorkCambridge.ts',
    why: PART('TECHNIQUE_WORK (sessionWork/techniqueWork.ts)'),
  },
  {
    file: 'shared/src/therapy/sessionWork/techniqueWorkSchema.ts',
    why: PART('TECHNIQUE_WORK (sessionWork/techniqueWork.ts)'),
  },
  {
    file: 'webapp/src/components/art/SignArt.tsx',
    why: 'ключи — знаки SignKey (need_*), полноту держит тип Record<SignKey, Art> (tsc)',
  },
  {
    file: 'webapp/src/pages/landing/AppPreview.tsx',
    why: 'картинка-образец экрана на лендинге: несколько потребностей для вида, не таблица',
  },
];
