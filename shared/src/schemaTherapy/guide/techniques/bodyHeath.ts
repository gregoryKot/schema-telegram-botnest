import type { Tr } from '../../../needs/types';
import { bodyGroundingMoreAll } from './bodyGroundingGroup';
import { buildChairworkMoreAll } from './chairworkArntzJacob';
import { bodyGroundingHeathMore, chairworkHeathMore } from './bodyHeathMore';
import { rescriptingMoreHeath } from './imageryHeath';

/** «Подробнее» к body_grounding с соматической перспективой Хис (гл. 3, 17): вынесено, чтобы bodyGrounding.ts не рос. */
export const bodyGroundingMoreHeath: string[] = [
  ...bodyGroundingMoreAll,
  ...bodyGroundingHeathMore,
];

/** «Подробнее» к chairwork с телом на стульях и эмоциями Уязвимого Ребёнка [Хис, гл. 3, 17]. */
export const buildChairworkMoreHeath = (tr: Tr): string[] => [
  ...buildChairworkMoreAll(tr),
  ...chairworkHeathMore,
];

/** «Подробнее» к imagery_rescripting с телесными вопросами до и после образа [Хис, гл. 3]. */
export const rescriptingMoreBodyHeath: string[] = [
  ...rescriptingMoreHeath,
  'Тело до и после рескриптинга [Хис, гл. 3]. Перед входом в образ спросить, чувствуется ли ребёнок в теле прямо сейчас, каково это напряжение или оцепенение и что телу хочется сделать. После хорошего конца не спешить открывать глаза: побыть в новом приятном ощущении подольше, усилить его — обнять себя, как ребёнка, сцепить руки. Многие клиенты с травмой боятся хорошего, поэтому время в нём наращивают постепенно, как в экспозиции.',
];
