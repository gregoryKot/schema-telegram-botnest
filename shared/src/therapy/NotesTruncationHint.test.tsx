// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { NotesTruncationHint } from './NotesTruncationHint';
import type { TherapistNote } from '../apiTypes';

const rows = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: i + 1 }) as TherapistNote);

afterEach(cleanup);

describe('NotesTruncationHint', () => {
  it('показывает строку о срезе, когда заметок на сервере больше', () => {
    render(<NotesTruncationHint page={{ notes: rows(100), total: 105 }} />);
    expect(screen.getByRole('note').textContent).toContain(
      'Показаны последние 100 из 105',
    );
  });

  it('молчит, когда показано всё', () => {
    const { container } = render(
      <NotesTruncationHint page={{ notes: rows(4), total: 4 }} />,
    );
    expect(container.textContent).toBe('');
  });
});
