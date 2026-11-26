export type IntroStep = 'schemas' | 'modes' | 'diary';

/** Какой вводной карточке быть: сначала схемы, потом режимы, потом дневник. */
export function introStep(hasSchemas: boolean, hasModes: boolean): IntroStep {
  return !hasSchemas ? 'schemas' : !hasModes ? 'modes' : 'diary';
}
