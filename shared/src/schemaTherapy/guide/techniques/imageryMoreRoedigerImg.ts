import type { TechniqueGuideBuilder } from '../types';
import { buildFarewellImageryTechniques } from './farewellImageryRoedigerImg';
import { buildImageryMoreTechniques as buildImageryMoreBase } from './imageryMore';

/** Воображение: diagnostic_imagery, safe_place_imagery и farewell_imagery (Рёдигер, гл. 9). */
export const buildImageryMoreTechniques: TechniqueGuideBuilder = (tr) => [
  ...buildImageryMoreBase(tr),
  ...buildFarewellImageryTechniques(tr),
];
