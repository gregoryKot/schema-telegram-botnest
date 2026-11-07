import type { ConceptSkin } from '../../../../../shared/src/therapy/conceptGraph/conceptSkin';

// Вид концептуализации на сайте: общие компоненты shared берут классы отсюда
// через ConceptSkinContext (мини-апп контекст не ставит и рисуется инлайн).
export const CONCEPT_SITE_SKIN: ConceptSkin = {
  seg: { group: 'ds-seg', btn: 'ds-seg-btn' },
  chip: 'ds-chip ds-chip--toggle',
  tag: 'ds-chip tone-tint',
  dot: 'ds-dot tone-fill',
  label: 'ds-label',
  link: 'ds-link',
  card: 'ds-card ds-card--row tcp-digest',
  fold: { root: 'ds-fold', btn: 'ds-fold-btn', chev: 'ds-fold-chev', body: 'ds-fold-body' },
};
