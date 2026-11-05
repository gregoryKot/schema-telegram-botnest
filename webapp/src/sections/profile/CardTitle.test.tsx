// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CardTitle, type CardSign } from './CardTitle';

describe('CardTitle', () => {
  it.each(['journey', 'achievements', 'portrait', 'warm'] as CardSign[])('%s: знак и заголовок', (sign) => {
    const { container } = render(<CardTitle sign={sign}>Заголовок</CardTitle>);
    expect(container.querySelector('.pp-row-art svg.pp-art--row')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: 'Заголовок' })).toBeTruthy();
  });
  it('разным сущностям — разные знаки', () => {
    const html = (['journey', 'achievements', 'portrait', 'warm'] as CardSign[]).map((s) => {
      const { container, unmount } = render(<CardTitle sign={s}>x</CardTitle>);
      const h = container.querySelector('svg')!.innerHTML;
      unmount();
      return h;
    });
    expect(new Set(html).size).toBe(4);
  });
});
