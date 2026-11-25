import { EATING_ARNTZ_MODES } from './eatingModesArntz';
import { ARNTZ_CASES } from './personalityCasesArntz';

/** Случаи гл. 2.3 и 2.3.9 Арнтц и Якоб по id режима; подключается в arntzModeMore.ts. */
export const ARNTZ_CASES_ALL: Record<string, string[]> = Object.fromEntries(
  [
    ...new Set([
      ...Object.keys(ARNTZ_CASES),
      ...Object.keys(EATING_ARNTZ_MODES),
    ]),
  ].map((id) => [
    id,
    [...(ARNTZ_CASES[id] ?? []), ...(EATING_ARNTZ_MODES[id] ?? [])],
  ]),
);
