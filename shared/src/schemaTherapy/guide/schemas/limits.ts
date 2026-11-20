import type { SchemaDomainGuideBuilder } from '../types';
import { buildEntitlementGuide } from './limitsCore';
import { buildInsufficientSelfControlGuide } from './limitsMore';

// Домен «Нарушенные границы»: справочник, разделы 10–11. «Избалованный
// ребёнок» справочника отдельного id не имеет — это сторона Импульсивного
// Ребёнка; «Обиженный ребёнок» сопоставлен с Сердитым.

/** Домен limits: entitlement, insufficient_self_control. */
export const buildLimitsGuides: SchemaDomainGuideBuilder = (tr) => ({
  domainId: 'limits',
  note: 'Здесь не закрыта потребность в границах, и репарентинг в том, чтобы их ставить. Тепло без границ этим схемам вредит. Границу объясняют от первого лица («мне трудно работать, когда…»), а не ссылкой на правила [Арнтц, 6.1; Кембридж, табл. 6.2]. В семье этих клиентов не требовали соблюдать правила и считаться с другими, и в терапии это видно по сорванным заданиям и договорённостям. Их читают как проявление домена и отвечают границей, а не уговорами [Янг, гл. 1].',
  schemas: [buildEntitlementGuide(tr), buildInsufficientSelfControlGuide(tr)],
});
