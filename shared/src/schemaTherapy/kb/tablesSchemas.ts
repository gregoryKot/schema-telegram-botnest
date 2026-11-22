// Реестр таблиц по id схем и техник (kb/tables.ts). Файлы вне shared/ — со спеком-сверкой.
import { buildSchemaGuides } from '../guide/index';
import type { Tr } from '../guide/types';
import { SCHEMA_CHILDHOOD } from '../guide/schemas/childhood';
import { SCHEMA_COPING } from '../guide/schemas/coping';
import { SCHEMA_COPING_HEADLINES } from '../guide/schemas/copingHeadlines';
import { SEARCH_ALIASES } from '../searchAliases';
import { SCHEMA_NAME_TO_ID } from '../../hooks/ysqSchemas';
import { TECHNIQUE_WORK } from '../../therapy/sessionWork/techniqueWork';
import type { KbTable } from './check';

const tr: Tr = (t) => t;

export const SCHEMA_TECHNIQUE_TABLES: readonly KbTable[] = [
  {
    file: 'src/therapy/kb-ids.ts',
    kind: 'schema',
    coverage: 'all',
    syncSpec: 'src/therapy/kb-ids.sync.spec.ts',
  },
  {
    file: 'shared/src/schemaTherapy/guide/schemas/domains.ts',
    kind: 'schema',
    coverage: 'all',
    keys: () => buildSchemaGuides(tr).map((g) => g.schemaId),
  },
  {
    file: 'shared/src/schemaTherapy/guide/schemas/childhood.ts',
    kind: 'schema',
    coverage: 'all',
    keys: () => Object.keys(SCHEMA_CHILDHOOD),
  },
  {
    file: 'shared/src/schemaTherapy/guide/schemas/coping.ts',
    kind: 'schema',
    coverage: 'all',
    keys: () => Object.keys(SCHEMA_COPING),
  },
  {
    file: 'shared/src/schemaTherapy/guide/schemas/copingHeadlines.ts',
    kind: 'schema',
    coverage: 'all',
    keys: () => Object.keys(SCHEMA_COPING_HEADLINES),
  },
  {
    file: 'shared/src/schemaTherapy/searchAliases.ts',
    kind: 'schema',
    coverage: 'subset',
    why: 'синонимы для поиска есть только у схем, которые называют иначе',
    keys: () => Object.keys(SEARCH_ALIASES.schema),
  },
  {
    file: 'shared/src/hooks/ysqSchemas.ts',
    kind: 'schema',
    coverage: 'all',
    keys: () => Object.values(SCHEMA_NAME_TO_ID),
  },
  {
    file: 'src/utils/ysq.ts',
    kind: 'schema',
    coverage: 'all',
    syncSpec: 'webapp/src/hooks/useYsqTest.test.ts',
  },
  {
    file: 'webapp/src/components/schemaSheets/schemaBeliefs.ts',
    kind: 'schema',
    coverage: 'all',
    syncSpec: 'webapp/src/components/schemaSheets/schemaBeliefs.test.ts',
  },
  {
    file: 'shared/src/therapy/sessionWork/techniqueWork.ts',
    kind: 'technique',
    coverage: 'all',
    keys: () => Object.keys(TECHNIQUE_WORK),
  },
  {
    file: 'webapp/src/components/art/techniqueSigns.ts',
    kind: 'technique',
    coverage: 'all',
    syncSpec: 'webapp/src/components/art/guideSignsModel.test.tsx',
  },
  {
    file: 'src/therapy/session-work-technique-keys.ts',
    kind: 'technique',
    coverage: 'all',
    syncSpec: 'src/therapy/session-work.sync.spec.ts',
  },
];
