// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EntryArt, EntryKindChip } from './EntryKindChip';
import type { EntryKind } from './entryKind';

const KINDS: EntryKind[] = ['schema', 'thought', 'mode', 'case', 'gratitude', 'tracker'];
const svgOf = (kind: EntryKind) => render(<EntryArt kind={kind} />).container.innerHTML;

describe('EntryArt: мотив по типу записи', () => {
  it('у каждого типа есть мотив', () => {
    for (const k of KINDS) expect(svgOf(k), k).toContain('<svg');
  });
  it('трекер, разбор и дневник — три разных мотива', () => {
    expect(new Set([svgOf('tracker'), svgOf('case'), svgOf('thought')]).size).toBe(3);
  });
  it('схема, мысль, режим и благодарность — один мотив дневника', () => {
    expect(new Set(['schema', 'thought', 'mode', 'gratitude'].map(k => svgOf(k as EntryKind))).size).toBe(1);
  });
  it('ярлык типа остаётся рядом с мотивом', () => {
    const { getByText } = render(<EntryKindChip kind="case" />);
    expect(getByText('Разбор')).toBeTruthy();
  });
});
