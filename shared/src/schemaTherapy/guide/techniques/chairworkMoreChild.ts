import type { Tr } from '../types';
import { buildChairworkMoreRafaeli } from './chairworkRafaeli';
import { chairworkCambridgeMore } from './chairworkCambridgeB';
import { chairworkCoupleMore } from './chairworkCouple';
import { chairworkChildMore } from './chairworkChild';

/** «Подробнее» к chairwork: прежние дополнения и дети [Луз]; вынесено, чтобы запись не росла. */
export const buildChairworkMoreChild = (tr: Tr): string[] => [
  ...buildChairworkMoreRafaeli(tr),
  ...chairworkCambridgeMore,
  ...chairworkCoupleMore,
  ...chairworkChildMore,
];
