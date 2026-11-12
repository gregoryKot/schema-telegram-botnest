// Данные карточек схемы и режима для экранов упражнения (FlashcardEx): выбранная схема или режим
// с видом из ENTITY_LOOK (домен схемы — domainLook, группа режима — modeLook), группы списка
// выбора и «диалог двух голосов» — голос схемы или режима и ответ Здорового Взрослого вынесены
// из общего списка (портрет режима, итог карточки), остальное — по порядку.
import { SCHEMA_DOMAINS, MODE_GROUPS } from '../../../schemaTherapyData';
import { ENTITY_LOOK, domainLook, modeGroupLook, modeLook, type SheetLook } from '../../../../../shared/src/theme/entityLook';
import type { PickGroup } from '../PickGroups';

export interface CardSubject {
  id: string;
  name: string;
  desc: string;
  /** Надпись героя: домен схемы или группа режима. */
  group: string;
  look: SheetLook;
}

/** Домен без своего знака (неизвестный id) — бумага схем вообще, без выдуманного знака. */
const schemaLook = (domainId: string): SheetLook => domainLook(domainId) ?? { hue: ENTITY_LOOK.schemas.hue };

export function findSchema(id: string | undefined): CardSubject | null {
  for (const d of SCHEMA_DOMAINS) {
    const s = d.schemas.find((x) => x.id === id);
    if (s) return { id: s.id, name: s.name, desc: s.libraryDesc, group: d.domain, look: schemaLook(d.id) };
  }
  return null;
}

export function findMode(id: string | undefined): CardSubject | null {
  for (const g of MODE_GROUPS) {
    const m = g.items.find((x) => x.id === id);
    if (m) return { id: m.id, name: m.name, desc: m.short, group: g.group, look: modeLook(m.id, g.id) };
  }
  return null;
}

export const SCHEMA_PICK_GROUPS: PickGroup[] = SCHEMA_DOMAINS.map((d) => ({
  id: d.id, label: d.domain, look: schemaLook(d.id),
  items: d.schemas.map((s) => ({ id: s.id, name: s.name, desc: s.libraryDesc })),
}));

export const MODE_PICK_GROUPS: PickGroup[] = MODE_GROUPS.map((g) => ({
  id: g.id, label: g.group, look: modeGroupLook(g.id),
  items: g.items.map((m) => ({ id: m.id, name: m.name, desc: m.short })),
}));

/** Ключ голоса и ответа Здорового Взрослого: у вопросов карточки — thoughts/healthyView, у портрета — voice/healthyAdult. */
export const VOICE_KEYS = ['thoughts', 'voice'];
export const HEALTHY_KEYS = ['healthyView', 'healthyAdult'];

/** Голос и ответ — отдельно (только непустые), остальные — по порядку с исходным номером (01 · …). */
export function splitDialogue<T extends { key: string; text: string }>(items: T[]) {
  const filled = items.map((it, i) => ({ ...it, n: i + 1 })).filter((it) => it.text.trim());
  return {
    voice: filled.find((it) => VOICE_KEYS.includes(it.key)),
    healthy: filled.find((it) => HEALTHY_KEYS.includes(it.key)),
    rest: filled.filter((it) => !VOICE_KEYS.includes(it.key) && !HEALTHY_KEYS.includes(it.key)),
  };
}
