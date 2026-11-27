import type { TechniqueGuideBuilder } from '../types';
import { buildBorrowedTraumaTechniques as buildBase } from './borrowedTrauma';
import { withLifeLineChild } from './creativeModeWorkChild';

/** Заимствованные из травмы техники с детской частью линии жизни [Луз, гл. 12]. */
export const buildBorrowedTraumaWithChild: TechniqueGuideBuilder = (tr) =>
  withLifeLineChild(buildBase(tr));
