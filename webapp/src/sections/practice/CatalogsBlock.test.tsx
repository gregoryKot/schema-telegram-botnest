// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { CatalogsBlock } from './CatalogsBlock';

afterEach(cleanup);
const row = (id: string) => ({ id, label: id, sub: '', onClick: () => {} });

describe('CatalogsBlock', () => {
  it('у каждой строки знак слева; «Планы» и «Практики» — разные', () => {
    const { container } = render(<CatalogsBlock rows={[row('practices'), row('plans')]} />);
    const arts = container.querySelectorAll('.pp-row-art svg');
    expect(arts.length).toBe(2);
    expect(arts[0].innerHTML).not.toBe(arts[1].innerHTML);
  });
  it('без строк ничего не рисует', () => {
    const { container } = render(<CatalogsBlock rows={[]} />);
    expect(container.firstChild).toBeNull();
  });
});
