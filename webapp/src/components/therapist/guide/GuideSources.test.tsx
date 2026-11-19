// @vitest-environment jsdom
// «Источники» внизу листа: расшифровка меток по полке книг (shared/.../guide/sources.ts).
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GuideSources } from './GuideSources';

describe('GuideSources', () => {
  it('книга с автором и названием — строкой расшифровки, ссылки остаются', () => {
    render(<GuideSources text="[Кембридж, гл. 8], [Линехан, 1993]" />);
    expect(screen.getByText('[Кембридж, гл. 8], [Линехан, 1993]')).toBeTruthy();
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      expect.stringMatching(/^Кембридж — .*«The Cambridge Guide to Schema Therapy, 2023»$/),
    ]);
  });

  it('метки без расшифровки — общая подсказка вместо списка', () => {
    render(<GuideSources text="[Нет такой], [Линехан, 1993]" />);
    expect(screen.queryByRole('listitem')).toBeNull();
    expect(screen.getByText('Метки в квадратных скобках в тексте — эти книги.')).toBeTruthy();
  });

  it('пустые источники — блока нет', () => {
    const { container } = render(<GuideSources text="  " />);
    expect(container.innerHTML).toBe('');
  });
});
