// Реестр таблиц по id режимов (kb/tables.ts): полные и осознанно частичные.
import { ALL_MODES } from '../schemaTherapyData';
import { buildModeGuides } from '../guide/index';
import type { Tr } from '../guide/types';
import { SESSION_SIGN_MODE_IDS } from '../guide/modes/sessionSigns';
import { SEARCH_ALIASES } from '../searchAliases';
import { MODE_CARDS } from '../../mode/modeCards';
import { MODE_DOUBT_PAIRS } from '../../mode/modeDoubts';
import { MODE_DESC, POPULAR_MODE_IDS } from '../../mode/modePickerDesc';
import { ALL_TEST_MODE_IDS } from '../../mode/modeTest';
import { FEEL_GATES } from '../../mode/modeFeelGates';
import { MODE_UNKNOWN_GROUP, SECOND_DOORS } from '../../mode/modeBodyCues';
import { buildModeChainSuggestion } from '../../mode/modeChain';
import {
  laneOfMode,
  strategyGroupOf,
} from '../../therapy/conceptGraph/modeLanes';
import { FLASHCARD_MODE_GROUP } from '../../flashcard/modeView';
import { buildModes } from '../../flashcard/modes';
import { IMPULSE_SECOND_DOOR } from '../../case/caseImpulses';
import type { KbTable } from './check';

const tr: Tr = (t) => t;
const modeIds = () => ALL_MODES.map((m) => m.id);

export const MODE_TABLES: readonly KbTable[] = [
  {
    file: 'src/therapy/kb-ids.ts',
    kind: 'mode',
    coverage: 'all',
    syncSpec: 'src/therapy/kb-ids.sync.spec.ts',
  },
  {
    file: 'shared/src/schemaTherapy/guide/modes/all.ts',
    kind: 'mode',
    coverage: 'all',
    keys: () => buildModeGuides(tr).map((g) => g.modeId),
  },
  {
    file: 'shared/src/mode/modeCards/index.ts',
    kind: 'mode',
    coverage: 'all',
    keys: () => Object.keys(MODE_CARDS),
  },
  {
    file: 'shared/src/mode/modeDoubts/index.ts',
    kind: 'mode',
    coverage: 'all',
    keys: () => MODE_DOUBT_PAIRS.flatMap((p) => [p.a, p.b]),
  },
  {
    file: 'shared/src/mode/modePickerDesc.ts',
    kind: 'mode',
    coverage: 'all',
    keys: () => Object.keys(MODE_DESC),
  },
  {
    file: 'shared/src/mode/modePickerDesc.ts',
    kind: 'mode',
    coverage: 'subset',
    why: 'POPULAR_MODE_IDS — несколько частых режимов для быстрого выбора',
    keys: () => POPULAR_MODE_IDS,
  },
  {
    file: 'shared/src/mode/modeTest.ts',
    kind: 'mode',
    coverage: 'all',
    keys: () => ALL_TEST_MODE_IDS,
  },
  {
    file: 'shared/src/mode/modeFeelGates.ts',
    kind: 'mode',
    coverage: 'all',
    keys: () => FEEL_GATES.flatMap((g) => g.leaves.map((l) => l.modeId)),
  },
  {
    file: 'shared/src/therapy/conceptGraph/modeLanes.ts',
    kind: 'mode',
    coverage: 'all',
    keys: () =>
      modeIds().filter(
        (id) => laneOfMode(id) !== null && strategyGroupOf(id) !== null,
      ),
  },
  {
    file: 'shared/src/schemaTherapy/guide/modes/sessionSigns.ts',
    kind: 'mode',
    coverage: 'subset',
    why: 'признаки на сессии из табл. 3.3 Кембриджа: книга даёт их не для всех режимов',
    keys: () => SESSION_SIGN_MODE_IDS,
  },
  {
    file: 'shared/src/schemaTherapy/searchAliases.ts',
    kind: 'mode',
    coverage: 'subset',
    why: 'синонимы для поиска есть только у режимов, которые называют иначе',
    keys: () => Object.keys(SEARCH_ALIASES.mode),
  },
  {
    file: 'shared/src/flashcard/modeView.ts',
    kind: 'mode',
    coverage: 'subset',
    why: 'группы режимов карточки «Мне плохо»: свои несколько режимов',
    keys: () => Object.keys(FLASHCARD_MODE_GROUP),
    legacy: ['critic', 'detached'],
  },
  {
    file: 'shared/src/flashcard/modes.ts',
    kind: 'mode',
    coverage: 'subset',
    why: 'плитки шага 1 карточки «Мне плохо»: свои несколько режимов',
    keys: () => buildModes(tr).map((m) => m.id),
    legacy: ['detached'],
  },
  {
    file: 'shared/src/case/caseImpulses.ts',
    kind: 'mode',
    coverage: 'subset',
    why: 'порыв → вероятная вторая дверь: эвристика для нескольких порывов',
    keys: () => Object.values(IMPULSE_SECOND_DOOR),
  },
  {
    file: 'shared/src/mode/modeBodyCues.ts',
    kind: 'mode',
    coverage: 'subset',
    why: 'вторые входы и подсказки тела — у режимов, которые ищут не в своей двери',
    keys: () => [
      ...Object.values(SECOND_DOORS).flatMap((l) => l.map((x) => x.modeId)),
      ...MODE_UNKNOWN_GROUP.leaves.map((l) => l.modeId),
    ],
  },
  {
    file: 'shared/src/mode/modeChain.ts',
    kind: 'mode',
    coverage: 'subset',
    why: 'цепочка режимов предлагает по три кандидата на семью',
    keys: () =>
      modeIds().flatMap(
        (id) => buildModeChainSuggestion(id, tr)?.candidateIds ?? [],
      ),
  },
];
