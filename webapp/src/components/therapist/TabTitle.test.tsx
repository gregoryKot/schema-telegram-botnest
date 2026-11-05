// @vitest-environment jsdom
// Заголовок вкладки карточки клиента: без мотива — просто h2, с мотивом — картинка-знак рядом.
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { TabTitle } from './TabTitle';

describe('TabTitle', () => {
  it('без motif — h2 и нет картинки', () => {
    const { container } = render(<TabTitle title="Записи клиента" />);
    expect(container.querySelector('h2')?.textContent).toBe('Записи клиента');
    expect(container.querySelector('.pp-art')).toBeNull();
    expect(container.querySelector('.tb-tab-title--art')).toBeNull();
  });
  it('с motif — картинка-знак (aria-hidden) рядом с h2', () => {
    const { container } = render(<TabTitle title="Задания" motif="check" />);
    expect(container.querySelector('.tb-tab-title--art')).toBeTruthy();
    const art = container.querySelector('svg.pp-art--row');
    expect(art?.getAttribute('aria-hidden')).toBe('true');
  });
});
