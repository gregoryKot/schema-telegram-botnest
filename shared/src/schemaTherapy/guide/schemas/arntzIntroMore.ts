import type { SchemaDomainGuide, TechniqueId } from '../types';
import { withChildhood } from './childhood';
import { deprivationYoung2 } from './deprivationDefectivenessYoung';
import { abandonmentYoung2 } from './rejectionMoreYoung2';
import { selfSacrificeYoungMore } from './sacrificeYoung';
import { dependenceYoungMore, failureYoungMore } from './autonomyYoung';
import { selfControlYoungMore } from './limitsYoung';
import { subjugationYoung2 } from './subjugationYoung2';
import { approvalSeekingYoungMore } from './approvalYoung';

/** «Подробнее» к схемам из клинических случаев и разбора домена: Арнтц и Якоб, гл. 1.1. */
const SCHEMA_ARNTZ_INTRO: Record<string, string[]> = {
  abandonment: [...abandonmentYoung2],
  emotional_deprivation: [...deprivationYoung2],
  dependence: [...dependenceYoungMore],
  failure: [...failureYoungMore],
  entitlement: [
    'Как приходит клиент [Арнтц, 1.1.3]: обращается, потому что кажется, что на работе его травят; цель терапии — «заставить подчинённых вести себя как следует», то есть изменить других. С терапевтом держится начальственно и контролирующе, а о высокомерии к подчинённым говорит с гордостью: кто хочет с ним работать, должен хорошо подготовиться.',
  ],
  insufficient_self_control: [...selfControlYoungMore],
  subjugation: [...subjugationYoung2],
  self_sacrifice: [...selfSacrificeYoungMore],
  approval_seeking: [...approvalSeekingYoungMore],
  negativity: [
    'Спор вместо согласия [Арнтц, 1.1.5]: клиент признаёт, что «заряжен отрицательно», но отстаивает право так видеть: жизнь для него «юдоль печалей», а позитивный взгляд говорит о душевной слепоте. О работе рассказывает списком проблем, хотя партнёр напоминает, что дело любимое, а карьера идёт хорошо. Часто его приводит партнёр, чьи попытки наладить жизнь упираются в его отношение ко всему.',
  ],
  punitiveness_others: [
    'Откуда и как проявляется [Арнтц, 1.1.5]: родители были раздражительными и озлобленными, не научили радоваться жизни и не позволяли этого; обвинять и требовать наказания клиент перенял у них. Терапии он не ищет: его направляет врач из-за постоянных жалоб на соседей. Он выискивает нарушения правил, шумно конфликтует по пустякам, виноватыми считает других, а отношения вокруг в основном враждебные.',
  ],
};

/** Связи схем с техниками из разбора Арнтц и Якоб, гл. 1.1. */
const SCHEMA_ARNTZ_TECHNIQUES: Record<string, TechniqueId[]> = {
  subjugation: ['empathic_confrontation'],
};

/** Добавляет схемам домена случаи и пояснения из гл. 1.1, затем вопросы о детстве: они остаются последним пунктом. */
export function withChildhoodAndArntzIntro(
  domain: SchemaDomainGuide,
): SchemaDomainGuide {
  const schemas = domain.schemas.map((s) => {
    const extra = SCHEMA_ARNTZ_INTRO[s.schemaId];
    const link = SCHEMA_ARNTZ_TECHNIQUES[s.schemaId];
    const withMore = extra ? { ...s, more: [...(s.more ?? []), ...extra] } : s;
    return link
      ? {
          ...withMore,
          moreTechniques: [...(withMore.moreTechniques ?? []), ...link],
        }
      : withMore;
  });
  return withChildhood({ ...domain, schemas });
}
