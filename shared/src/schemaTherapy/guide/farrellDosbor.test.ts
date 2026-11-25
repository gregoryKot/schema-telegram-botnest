// Досбор Фаррелл: пункты из файлов-продолжений дошли до собранных записей справочника (в обеих формах).
import { describe, it, expect } from 'vitest';
import { buildModeGuides, buildTechniqueGuides, practiceNotes } from './index';
import type { Tr } from './types';
import { vulnerableChildFarrell } from './modes/vulnerableChildFarrell';
import { happyChildFarrell, healthyAdultFarrell } from './modes/healthyFarrell';
import {
  punitiveCriticFarrell,
  demandingCriticFarrell,
} from './modes/criticFarrell';
import {
  copingFarrellAvoid,
  copingFarrellSurrender,
  copingFarrellAggr,
} from './modes/copingFarrell';
import { angerFarrell } from './modes/angryFarrell';
import { transitionalFarrell } from './techniques/transitionalObjectsFarrell';
import {
  imageryFarrellSafe,
  imageryFarrellRescript,
} from './techniques/imageryFarrellMore';
import { bubbleFarrell } from './techniques/safetyBubbleFarrell';
import { planFarrell } from './techniques/farrellPlansMore';
import { modeMapFarrell } from './techniques/modeMapFarrellMore';
import { schemaDiaryFarrell } from './techniques/schemaDiaryFarrell';
import { guessModeFarrell } from './techniques/guessModeFarrell';
import { empathicFarrell } from './techniques/empathicFarrell';
import { historicalRoleFarrell } from './techniques/historicalRoleFarrell';
import { futureFarrell } from './techniques/futureFarrell';
import { angerExpressionFarrell } from './techniques/angerExpressionFarrell';
import {
  groupFrameFarrell,
  groupLeadFarrell,
  groupPlanFarrell,
} from './practiceGroupFarrell';
import {
  groupPlayFarrell,
  groupRoleplayFarrell,
} from './practiceGroupPlayFarrell';

const ty: Tr = (t) => t;
const vy: Tr = (_t, v) => v;

const MODES: [string, string[]][] = [
  ['vulnerable_child', vulnerableChildFarrell],
  ['happy_child', happyChildFarrell],
  ['healthy_adult', healthyAdultFarrell],
  ['punitive_critic', punitiveCriticFarrell],
  ['demanding_critic', demandingCriticFarrell],
  ['avoidant_protector', copingFarrellAvoid],
  ['compliant_surrenderer', copingFarrellSurrender],
  ['self_aggrandiser', copingFarrellAggr],
  ['angry_child', angerFarrell],
];
const TECHNIQUES: [string, string[]][] = [
  ['transitional_objects', transitionalFarrell],
  ['safe_place_imagery', imageryFarrellSafe],
  ['imagery_rescripting', imageryFarrellRescript],
  ['safety_bubble', bubbleFarrell],
  ['mode_management_plan', planFarrell],
  ['mode_map', modeMapFarrell],
  ['schema_diary', schemaDiaryFarrell],
  ['guess_the_mode', guessModeFarrell],
  ['empathic_confrontation', empathicFarrell],
  ['historical_role_play', historicalRoleFarrell],
  ['healthy_adult_imagery', futureFarrell],
  ['anger_expression', angerExpressionFarrell],
];
const PRACTICE: [string, string[]][] = [
  ['group_therapy', [...groupFrameFarrell, ...groupLeadFarrell]],
  ['group_plan_vs_mode', groupPlanFarrell],
  ['group_techniques', groupPlayFarrell],
  ['group_mode_roleplay', groupRoleplayFarrell],
];

describe.each([
  ['ты', ty],
  ['вы', vy],
])('досбор Фаррелл в справочнике, форма «%s»', (_name, tr) => {
  it.each(MODES)('режим %s', (id, items) => {
    const g = buildModeGuides(tr).find((m) => m.modeId === id);
    expect(g?.more).toEqual(expect.arrayContaining(items));
  });

  it.each(TECHNIQUES)('техника %s', (id, items) => {
    const g = buildTechniqueGuides(tr).find((t) => t.id === id);
    expect(g?.more).toEqual(expect.arrayContaining(items));
  });

  it.each(PRACTICE)('раздел «Для терапевта» %s', (id, items) => {
    const g = practiceNotes(tr).find((n) => n.id === id);
    expect(g?.more).toEqual(expect.arrayContaining(items));
  });

  it('первые пункты historical_role_play стоят на прежних местах', () => {
    const more =
      buildTechniqueGuides(tr).find((t) => t.id === 'historical_role_play')
        ?.more ?? [];
    expect(more[0]).toMatch(/^В начале терапии, когда корни паттерна/);
    expect(more[1]).toMatch(/^Разбор после каждого этапа \[Кембридж/);
  });
});
