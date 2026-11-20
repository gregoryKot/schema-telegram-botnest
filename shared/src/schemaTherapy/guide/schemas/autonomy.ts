import type { SchemaDomainGuideBuilder } from '../types';
import { buildDependenceGuide, buildVulnerabilityGuide } from './autonomyCore';
import { buildEnmeshmentGuide, buildFailureGuide } from './autonomyMore';

// Домен «Нарушенная автономия» — справочник, разделы 6–9. Режимы справочника
// сопоставлены с modeGroups.ts: Тревожный и Незаметный ребёнок — Уязвимый
// Ребёнок, Бунтующий ребёнок — Упрямый Ребёнок, Ребёнок-неудачник —
// Униженный Ребёнок. «Искателя заверений» в modeGroups нет: он описан в
// копинге как поиск заверений. Раздела «В кабинете» у Уязвимости,
// Спутанности и Неуспешности в справочнике нет: он собран из «Интервенций»
// и «Где застревают» этих схем.

/** Домен autonomy: dependence, vulnerability, enmeshment, failure. */
export const buildAutonomyGuides: SchemaDomainGuideBuilder = (tr) => ({
  domainId: 'autonomy',
  note: 'Терапевта легко затягивает в роль того, кто решает, успокаивает и заверяет. Репарентинг здесь — поддержать попытку клиента, а не сделать за него. Шаги в жизни весят больше, чем в первом домене: встречаться со страхом без проверок, идти по лестнице самостоятельных дел от лёгкого к трудному. Расплывчатый запрос и неумение назвать цель терапии здесь чаще проявление домена, чем сопротивление: клиент нередко не знает, кто он и чего хочет [Янг, гл. 1].',
  schemas: [
    buildDependenceGuide(tr),
    buildVulnerabilityGuide(tr),
    buildEnmeshmentGuide(tr),
    buildFailureGuide(tr),
  ],
});
