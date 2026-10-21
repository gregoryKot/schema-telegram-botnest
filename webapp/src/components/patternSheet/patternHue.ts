// Оттенок паттерна для сайта: домен схемы / группа режима → hue из lib/tone.
// patternMeta (shared) отдаёт цвет для канваса карточки шаринга; для вёрстки
// сайта нужен не цвет, а число для `--h` (правило «цвет живёт в палитре»).
import { SCHEMA_DOMAINS, MODE_GROUPS } from '../../schemaTherapyData';
import { DOMAIN_HUE, MODE_GROUP_HUE } from '../../lib/tone';
import type { MyCardsKind } from '../../../../shared/src/pattern/useMyCards';

export function patternHue(kind: MyCardsKind, id: string): number | undefined {
  if (kind === 'schema') {
    const d = SCHEMA_DOMAINS.find((x) => x.schemas.some((s) => s.id === id));
    return d ? DOMAIN_HUE[d.id] : undefined;
  }
  const g = MODE_GROUPS.find((x) => x.items.some((m) => m.id === id));
  return g ? MODE_GROUP_HUE[g.id] : undefined;
}
