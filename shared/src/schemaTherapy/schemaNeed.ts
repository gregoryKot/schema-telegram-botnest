// Каноническая связка схема → домен → потребность (Young, Klosko & Weishaar 2003, табл. 1.1;
// .claude/rules/theory.md, п. 1): у каждого домена одна потребность, у каждой потребности один домен.
// Экраны, которым нужны «схемы этой потребности», берут их отсюда, а не держат свой список.
import { NEED_ORDER, type NeedId } from '../needs/types';
import { DOMAIN_HUE, NEED_HUE } from '../theme/entityHue';
import { SCHEMA_DOMAINS } from './content/schemaDomains';
import type { SchemaDomain } from './types';

/**
 * Потребность домена схем: домен 1 «Нарушение связи» — привязанность 28, 2 — автономия 70, 3 — границы 135,
 * 4 — выражение 240, 5 — спонтанность 310 (DOMAIN_HUE и NEED_HUE — одна бумага).
 */
export function domainNeedId(domainId: string | null): NeedId | null {
  const hue = domainId ? DOMAIN_HUE[domainId] : undefined;
  return hue == null
    ? null
    : (NEED_ORDER.find((n) => NEED_HUE[n] === hue) ?? null);
}

/** Домен схем, который складывается, когда потребность не закрыта. */
export function needDomain(needId: string): SchemaDomain | undefined {
  return SCHEMA_DOMAINS.find((d) => domainNeedId(d.id) === needId);
}
