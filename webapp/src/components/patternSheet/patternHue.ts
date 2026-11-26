// Оттенок и вид паттерна для сайта: домен схемы / группа режима → hue из lib/tone.
// patternMeta (shared) отдаёт цвет для канваса карточки шаринга; для вёрстки
// сайта нужен не цвет, а число для `--h` (правило «цвет живёт в палитре»).
// patternLook — вид листа-героя (бумага + знак) по ENTITY_LOOK: схема — бумага и
// знак домена (domainLook), режим — бумага группы и знак режима (modeLook: свой
// знак у «Сердитого Ребёнка», иначе знак группы). Один вход на героя «Паттерна
// недели», экран паттерна и «О режиме» — вид не выбирается на месте.
import { SCHEMA_DOMAINS, MODE_GROUPS } from '../../schemaTherapyData';
import { DOMAIN_HUE, MODE_GROUP_HUE } from '../../lib/tone';
import { domainLook, modeLook, type Look } from '../../../../shared/src/theme/entityLook';
import type { MyCardsKind } from '../../../../shared/src/pattern/useMyCards';

const domainOf = (id: string) => SCHEMA_DOMAINS.find((x) => x.schemas.some((s) => s.id === id));
const groupOf = (id: string) => MODE_GROUPS.find((x) => x.items.some((m) => m.id === id));

export function patternHue(kind: MyCardsKind, id: string): number | undefined {
  if (kind === 'schema') {
    const d = domainOf(id);
    return d ? DOMAIN_HUE[d.id] : undefined;
  }
  const g = groupOf(id);
  return g ? MODE_GROUP_HUE[g.id] : undefined;
}

/** Вид паттерна; неизвестный id — null (без выдуманного знака). */
export function patternLook(kind: MyCardsKind, id: string): Look | null {
  if (kind === 'schema') {
    const d = domainOf(id);
    return d ? domainLook(d.id) : null;
  }
  const g = groupOf(id);
  return g ? modeLook(id, g.id) : null;
}
