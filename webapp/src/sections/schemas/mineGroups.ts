import type { SchemaDomain } from '../../schemaTherapyData';
import { DOMAIN_HUE } from '../../lib/tone';

export interface MineGroup { id: string; title: string; hue: number | undefined; schemaIds: string[] }

/**
 * «Мои схемы» списком по доменам (телефон): домены в порядке данных, внутри —
 * порядок профиля. Пустые домены и неизвестные id отбрасываются.
 */
export function groupMineByDomain(domains: SchemaDomain[], ids: string[]): MineGroup[] {
  return domains.flatMap(d => {
    const own = ids.filter(id => d.schemas.some(s => s.id === id));
    return own.length ? [{ id: d.id, title: d.domain, hue: DOMAIN_HUE[d.id], schemaIds: [...new Set(own)] }] : [];
  });
}
