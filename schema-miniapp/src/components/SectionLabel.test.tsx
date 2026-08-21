// @vitest-environment jsdom
// В8 дизайн-аудита 2026-08: SectionLabel рендерит подзаголовки блоков (h3 —
// дефолт, большинство мест) и, где под ней нет другого титульного элемента,
// единственный заголовок шита (h2, через явный `as`). Стили не зависят от тега.
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { SectionLabel } from './SectionLabel';

afterEach(cleanup);

describe('SectionLabel', () => {
  it('по умолчанию — h3 (подзаголовок блока)', () => {
    render(<SectionLabel>Мои практики</SectionLabel>);
    expect(
      screen.getByRole('heading', { level: 3, name: 'Мои практики' }),
    ).toBeTruthy();
  });

  it('as="h2" — заголовок самого шита', () => {
    render(
      <SectionLabel purple as="h2">
        Заметка к дню
      </SectionLabel>,
    );
    expect(
      screen.getByRole('heading', { level: 2, name: 'Заметка к дню' }),
    ).toBeTruthy();
  });

  it('стиль не зависит от тега (purple меняет цвет/вес одинаково для h2 и h3)', () => {
    const { unmount } = render(
      <SectionLabel purple as="h2">
        А
      </SectionLabel>,
    );
    const h2 = screen.getByRole('heading', { level: 2 });
    const h2Weight = h2.style.fontWeight;
    unmount();

    render(<SectionLabel purple>Б</SectionLabel>);
    const h3 = screen.getByRole('heading', { level: 3 });
    expect(h3.style.fontWeight).toBe(h2Weight);
  });
});
