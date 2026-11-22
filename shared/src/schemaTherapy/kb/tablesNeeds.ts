// Реестр таблиц по id потребностей (kb/tables.ts). Таблица без keys — полная, kb-тест сверяет
// её по тексту файла: каждый id встречается литералом или ключом (так же — файлы вне shared/).
import type { Tr } from '../guide/types';
import { CHILDHOOD_EXAMPLES } from '../../childhoodWheel/childhoodExamples';
import { defaultChildhoodRatings } from '../../childhoodWheel/childhoodWheel';
import { NEEDS } from '../../flashcard/modes';
import { DOMAIN_ORDER, getYsqSchemas } from '../../hooks/ysqSchemas';
import { JOURNEY_NEED_NAMES } from '../../journey/journeyMeta';
import { buildAnchorPools } from '../../needs/anchorPools';
import { NEED_COLOR_ORDER } from '../../needs/needColors';
import { buildNeedData } from '../../needs/needData';
import { CURATED } from '../../practices/curated';
import { NEED_INK_ORDER } from '../../share/kit/ink';
import { NEED_HUE } from '../../theme/entityHue';
import { NEED_SLOT } from '../../therapy/conceptGraph/diagram/diagramCircle';
import type { KbTable } from './check';

const tr: Tr = (t) => t;

const keyed = (file: string, keys: () => readonly string[]): KbTable => ({
  file,
  kind: 'need',
  coverage: 'all',
  keys,
});
const byText = (file: string): KbTable => ({
  file,
  kind: 'need',
  coverage: 'all',
});

export const NEED_TABLES: readonly KbTable[] = [
  keyed('shared/src/childhoodWheel/childhoodExamples.ts', () =>
    Object.keys(CHILDHOOD_EXAMPLES),
  ),
  keyed('shared/src/childhoodWheel/childhoodWheel.ts', () =>
    Object.keys(defaultChildhoodRatings()),
  ),
  keyed('shared/src/flashcard/modes.ts', () => NEEDS.map((n) => n.id)),
  keyed('shared/src/hooks/ysqSchemas.ts', () => DOMAIN_ORDER),
  keyed('shared/src/hooks/ysqSchemasContent.ts', () =>
    getYsqSchemas('ty').map((s) => s.needId),
  ),
  keyed('shared/src/journey/journeyMeta.ts', () =>
    Object.keys(JOURNEY_NEED_NAMES),
  ),
  keyed('shared/src/needs/anchorPools.ts', () =>
    Object.keys(buildAnchorPools(tr)),
  ),
  keyed('shared/src/needs/needColors.ts', () => NEED_COLOR_ORDER),
  keyed('shared/src/needs/needData.ts', () => Object.keys(buildNeedData(tr))),
  keyed('shared/src/practices/curated.ts', () => Object.keys(CURATED)),
  keyed('shared/src/share/kit/ink.ts', () => NEED_INK_ORDER),
  keyed('shared/src/theme/entityHue.ts', () => Object.keys(NEED_HUE)),
  keyed('shared/src/therapy/conceptGraph/diagram/diagramCircle.ts', () =>
    Object.keys(NEED_SLOT),
  ),
  byText('shared/src/utils/todayInsight.ts'),
  byText('webapp/src/components/art/NeedArt.tsx'),
  byText('webapp/src/components/exercises/childhoodWheel/needs.ts'),
  byText('webapp/src/components/history/needInk.ts'),
  byText('webapp/src/components/therapist/clientOverviewModel.ts'),
  byText('webapp/src/sections/practice/catalogCounts.ts'),
  byText('webapp/src/sections/profile/profileMeta.ts'),
  byText('src/bot/admin-stats.sections.ts'),
  byText('src/bot/bot.service.ts'),
  byText('src/quiz/quiz-battery.data.ts'),
];
