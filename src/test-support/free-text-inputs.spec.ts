// Признак свободного текста для кризисного трипваера: общий контрол
// `<LimitedInput` (поле со счётчиком предела, shared/src/components/LimitedTextarea.tsx)
// — тот же `<input>`. Поля EviList и SafePlaceEx, переведённые на него, иначе
// выпали бы из src/security/crisis-path.invariants.spec.ts молча.
import { hasFreeTextInput, inputTags } from './free-text-inputs';

describe('free-text-inputs: <LimitedInput> — поле свободного текста', () => {
  it('LimitedInput без структурных признаков — свободный текст', () => {
    const src =
      '<LimitedInput max={1900} value={text} onChange={(e) => set(e.target.value)} />';
    expect(inputTags(src)).toHaveLength(1);
    expect(hasFreeTextInput(src)).toBe(true);
  });

  it('контроль: LimitedInput со структурным признаком и чужой тег — не свободный текст', () => {
    expect(
      hasFreeTextInput('<LimitedInput inputMode="numeric" max={4} />'),
    ).toBe(false);
    expect(inputTags('<LimitedInputHint text="x" />')).toEqual([]);
  });
});
