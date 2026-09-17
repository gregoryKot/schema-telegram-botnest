// @vitest-environment jsdom
// PatternListSkeleton — форма скелетона обязана совпадать с контентом
// (правило CLAUDE.md): столько строк, сколько реально известно локально
// (allSchemaIds/myModeIds из localStorage, доступны синхронно до ответа
// профиля — useMySelections.ts), но не меньше 3.
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { PatternListSkeleton } from './CatalogParts';

function rowCount(container: HTMLElement): number {
  return container.querySelectorAll('.card > div').length;
}

describe('PatternListSkeleton — количество строк по факту известных id', () => {
  it('rows меньше минимума — всё равно рисует минимум 3 строки', () => {
    const { container } = render(<PatternListSkeleton rows={1} />);
    expect(rowCount(container)).toBe(3);
  });

  it('rows=0 (в localStorage ничего не было) — минимум 3, не 0', () => {
    const { container } = render(<PatternListSkeleton rows={0} />);
    expect(rowCount(container)).toBe(3);
  });

  it('rows больше минимума — рисует ровно столько строк, сколько известно', () => {
    const { container } = render(<PatternListSkeleton rows={5} />);
    expect(rowCount(container)).toBe(5);
  });
});
