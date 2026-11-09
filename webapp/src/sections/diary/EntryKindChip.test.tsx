// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EntryKindChip, FeedSign } from './EntryKindChip';
import { kindLook } from './feedLook';
import type { EntryKind } from './entryKind';

const KINDS: EntryKind[] = ['schema', 'thought', 'mode', 'case', 'gratitude', 'tracker'];
const svgOf = (kind: EntryKind) => render(<FeedSign look={kindLook(kind)} />).container.innerHTML;

describe('FeedSign: знак по типу записи (b11 — у схемы, режима и разбора свои знаки)', () => {
  it('у каждого типа есть знак, и он скрыт от чтения — тип читает ярлык', () => {
    for (const k of KINDS) {
      const html = svgOf(k);
      expect(html, k).toContain('<svg');
      expect(html, k).toContain('aria-hidden="true"');
    }
  });
  it('схема, мысль, режим, разбор и трекер — пять разных знаков', () => {
    expect(new Set(['schema', 'thought', 'mode', 'case', 'tracker'].map((k) => svgOf(k as EntryKind))).size).toBe(5);
  });
  it('благодарность — камешки с данными: окрашено столько, сколько «спасибо»', () => {
    const { container } = render(<FeedSign look={{ ...kindLook('gratitude'), filled: 2 }} />);
    expect(container.querySelectorAll('[data-laid="yes"]')).toHaveLength(2);
    expect(container.querySelectorAll('[data-laid="no"]')).toHaveLength(1);
  });
  it('ярлык типа — общий с главной', () => {
    const { getByText } = render(<EntryKindChip kind="case" />);
    expect(getByText('Разбор')).toBeTruthy();
  });
});
