import { describe, it, expect } from 'vitest';
import { runStarts } from './runStarts';

describe('runStarts — начало серии одинаковых ключей', () => {
  it('первый элемент серии — true, повтор подряд — false; тот же ключ после другого — снова начало', () => {
    expect(runStarts(['a', 'a', 'b', 'a', 'a', 'a'])).toEqual([
      true,
      false,
      true,
      true,
      false,
      false,
    ]);
  });

  it('пустой список и одиночки', () => {
    expect(runStarts([])).toEqual([]);
    expect(runStarts(['x', 'y', 'z'])).toEqual([true, true, true]);
  });
});
