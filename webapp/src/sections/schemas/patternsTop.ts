// Верх «Паттернов» и лист сразу под героем (ревью g5 r3): «Дефективность» розы над группой «Нарушение связи» той же
// бумаги, «Уязвимый Ребёнок» над «Детскими режимами» читались одним листом. Если под героем без белого листа между
// (строка или плитка теста, «Выраженные схемы») стоит первая группа «Моих схем / режимов» ближе 40° (hueTooNear),
// герой берёт белый лист с тенью-слоем своего оттенка (pa-sheet--white), как вход в тест рядом с ним.
import { SCHEMA_DOMAINS, MODE_GROUPS } from '../../schemaTherapyData';
import type { WeekPatternKind, WeekTopSummary } from '../../../../shared/src/pattern/patternsSummary';
import type { ScreenBlockId } from '../../../../shared/src/screens/screenBlocks';
import { hueTooNear } from '../../../../shared/src/theme/hueGap';
import { groupMineByDomain, groupMineByModeGroup, mineGroupLook } from './mineGroups';
import { rankExpressed, type YsqScore } from './schemasModel';
import { topPair, weekLook, type PatternsHero, type YsqEntryLook } from './patternsHero';

/** Оттенок первой группы «Моих схем / режимов» — листа, что встанет под героем; null — групп нет. */
export function firstGroupHue(kind: WeekPatternKind, ids: string[]): number | null {
  const groups = kind === 'schema' ? groupMineByDomain(SCHEMA_DOMAINS, ids) : groupMineByModeGroup(MODE_GROUPS, ids);
  return groups.length ? mineGroupLook(kind, groups[0].id).hue : null;
}

interface TopInput {
  mobile: boolean;
  hero: PatternsHero;
  ysqEntry: YsqEntryLook;
  blocks: { isHidden: (id: ScreenBlockId) => boolean; orderedIds: readonly ScreenBlockId[] };
  d: { loading: boolean; ysqSchemaIds: string[]; ysqScores: Record<string, YsqScore>; myModeIds: string[] };
  schemaIds: string[];
  /** Режим недели по дневнику — герой вкладки «Режимы» на телефоне (ModesTopCards). */
  modeTop: WeekTopSummary | null;
}

export interface PatternsTop {
  /** Пара «Выраженные + Тест» (topPair): «Выраженные» — с данными или пока грузятся, на любой ширине. */
  pair: { expressed: boolean; tile: boolean };
  /** Герой вкладки «Схемы» (и верха компьютера) — на белом листе. */
  heroWhite: boolean;
  /** «Чаще всего включается» вкладки «Режимы» — на белом листе. */
  modesHeroWhite: boolean;
}

export function patternsTop({ mobile, hero, ysqEntry, blocks, d, schemaIds, modeTop }: TopInput): PatternsTop {
  const expressedCount = rankExpressed(SCHEMA_DOMAINS, d.ysqSchemaIds, d.ysqScores).length;
  const pair = topPair(ysqEntry !== 'hidden' && !blocks.isHidden('ysq_status'), d.loading, expressedCount);
  // Строку теста на телефоне можно поставить выше героя («Настроить экран») — тогда она не между ним и группами.
  const testAbove = mobile && blocks.orderedIds.indexOf('ysq_status') < blocks.orderedIds.indexOf('heroes');
  const whiteBetween = (pair.tile && !testAbove) || pair.expressed;
  const heroHue = hero.kind === 'week' || hero.kind === 'intro' ? hero.look.hue : null;
  return {
    pair,
    heroWhite: !whiteBetween && hueTooNear(heroHue, firstGroupHue('schema', schemaIds)),
    modesHeroWhite: hueTooNear(modeTop && weekLook({ kind: 'mode', id: modeTop.id }).hue, firstGroupHue('mode', d.myModeIds)),
  };
}
