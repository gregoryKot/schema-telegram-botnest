import type { ConceptSkin } from '../../../../../shared/src/therapy/conceptGraph/conceptSkin';

// Вид концептуализации на сайте: общие компоненты shared берут классы отсюда через ConceptSkinContext.
export const CONCEPT_SITE_SKIN: ConceptSkin = {
  tabs: { group: 'lt-quiet', btn: 'lt-q', sep: 'lt-sep' },
  label: 'ds-label',
  link: 'ds-link',
  card: 'pp-paper tcp-digest',
  digest: { title: 'tcp-dg-title', list: 'tcp-dg-list', row: 'tcp-dg-row', term: 'tcp-dg-term', value: 'tcp-dg-value' },
};
