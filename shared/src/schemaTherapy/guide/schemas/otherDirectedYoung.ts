import type { SchemaGuide, Tr } from '../types';
import { withYoung } from '../youngAdd';
import { buildSubjugationGuide as buildSubjugationBase } from './otherDirectedSubjugation';

/** Досбор по Янгу (гл. 1) к Покорности: здоровое ядро гиперкомпенсации. Вынесено, чтобы otherDirectedSubjugation.ts не рос. */
export const buildSubjugationGuide = (tr: Tr): SchemaGuide =>
  withYoung(buildSubjugationBase(tr), {
    more: [
      'Здоровое ядро гиперкомпенсации [Янг, гл. 1]. Взять больше контроля над своей жизнью — верное направление. Гиперкомпенсация в том, что клиент становится властным и не даёт другим вести даже там, где это полезно, и отталкивает людей.',
      'Такое поведение не гасят целиком, а соразмеряют: ситуации, чувствам других, реальной цели [Янг, гл. 1].',
    ],
    source: '[Янг, гл. 1]',
  });
