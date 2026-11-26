import { buildNeedData } from '../../../needs/needData';
import { needDomain } from '../../schemaNeed';
import { buildSchemaDomainGuides, needGuides } from '../index';
import type { Tr } from '../types';
import type { GuideAddressArticle } from './addressArticles';
import { sectionsOf } from './addressSections';

/** Листы вкладки «Потребности»; «Общее для домена» лист показывает так же, как лист схемы. */
export function needArticles(tr: Tr): GuideAddressArticle[] {
  const needs = buildNeedData(tr);
  const notes = new Map(
    buildSchemaDomainGuides(tr).map((d) => [d.domainId, d.note]),
  );
  return needGuides().map((n) => ({
    kind: 'need' as const,
    id: n.id,
    title: needs[n.id].name,
    sections: sectionsOf({
      ...n,
      domainNote: notes.get(needDomain(n.id)?.id ?? '') ?? '',
    }),
  }));
}
