import type { SchemaDomainGuideBuilder } from '../types';
import { buildApprovalSeekingGuide } from './otherDirectedApproval';
import { buildSelfSacrificeGuide } from './otherDirectedSacrifice';
import { buildSubjugationGuide } from './otherDirectedSubjugation';

// Домен «Направленность на других» — справочник, разделы 12–14. Режимы
// справочника сопоставлены с modeGroups.ts: Запуганный, Парентифицированный
// и Невидимый ребёнок — Уязвимый Ребёнок, Разгневанный и Обиженный ребёнок —
// Сердитый Ребёнок, Бунтующий ребёнок — Упрямый Ребёнок, Задира — Агрессор,
// Покорный капитулянт — Послушный Капитулянт. Раздела «В кабинете» у схем
// домена в справочнике нет: он собран из «Общего для домена» и «Где
// застревают».

/** Домен other_directed: subjugation, self_sacrifice, approval_seeking. */
export const buildOtherDirectedGuides: SchemaDomainGuideBuilder = (tr) => ({
  domainId: 'other_directed',
  note: 'Чужие потребности стоят выше своих, злость и собственные желания подавлены. В терапии такие клиенты удобны: соглашаются, делают задания, заботятся о терапевте. Это и есть схема в действии, и замечать её надо прямо на сессии.',
  schemas: [
    buildSubjugationGuide(tr),
    buildSelfSacrificeGuide(tr),
    buildApprovalSeekingGuide(tr),
  ],
});
