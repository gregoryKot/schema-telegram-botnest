import { angerExpressionHeath } from './angerExpressionHeath';
import { angerExpressionFarrell } from './angerExpressionFarrell';
import { angerExpressionCoupleMore } from './angerExpressionCouple';

export const angerExpressionMore: string[] = [
  'Цель сочувствия — перевести клиента из Сердитого Ребёнка в Покинутого: ему уже можно дать заботу [Янг, гл. 9].',
  'В проверке реальностью терапевт извиняется за справедливое и говорит от себя, что с ним делают преувеличенные обвинения и крик [Янг, гл. 9].',
  ...angerExpressionHeath, ...angerExpressionFarrell,
  ...angerExpressionCoupleMore,
];
