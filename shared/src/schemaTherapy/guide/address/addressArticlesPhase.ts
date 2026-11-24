import { getModeById } from '../../schemaTherapyData';
import { buildPhaseGuides, practiceNotes } from '../index';
import type { Tr } from '../types';
import type { GuideAddressArticle } from './addressArticles';
import { sectionsOf } from './addressSections';

/** Листы «Пути терапии» с разделами: ссылки на режимы, техники и заметки — их названиями. */
export function phaseArticles(
  tr: Tr,
  techniqueName: (id: string) => string,
): GuideAddressArticle[] {
  const notes = new Map(practiceNotes(tr).map((n) => [n.id, n.title]));
  return buildPhaseGuides(tr).map((p) => ({
    kind: 'phase' as const,
    id: p.id,
    title: p.name,
    sections: sectionsOf({
      ...p,
      modeIds: p.modeIds?.map((id) => getModeById(id)?.name ?? ''),
      techniques: p.techniques?.map(techniqueName),
      noteIds: p.noteIds?.map((id) => notes.get(id) ?? ''),
    }),
  }));
}
