// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { CatalogsBlock } from './CatalogsBlock';
import type { PracticeEntity } from './practiceLook';

afterEach(cleanup);
const row = (id: string, look: PracticeEntity) => ({ id, look, label: id, sub: '', onClick: () => {} });

describe('CatalogsBlock', () => {
  it('у каждой строки знак её сущности слева; «Что питает», «Планы» и «Карта режимов» — разные', () => {
    const { container } = render(<CatalogsBlock rows={[row('practices', 'nourish'), row('plans', 'plan'), row('modes_map', 'modes')]} />);
    const arts = Array.from(container.querySelectorAll('.pp-row-art svg')).map(a => a.innerHTML);
    expect(arts).toHaveLength(3);
    expect(new Set(arts).size).toBe(3);
  });
  it('без строк ничего не рисует', () => {
    const { container } = render(<CatalogsBlock rows={[]} />);
    expect(container.firstChild).toBeNull();
  });
});
