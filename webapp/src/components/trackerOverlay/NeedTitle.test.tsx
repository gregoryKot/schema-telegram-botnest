// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { NeedTitle } from './NeedTitle';

describe('NeedTitle', () => {
  it('название — заголовок; мотив потребности рядом, но имя не заменяет', () => {
    const { container } = render(<NeedTitle name="Привязанность" needId="attachment" />);
    expect(screen.getByRole('heading', { name: 'Привязанность' })).toBeTruthy();
    expect(container.querySelector('svg')).not.toBeNull();
  });
  it('без id — только заголовок', () => {
    const { container } = render(<NeedTitle name="Что-то" />);
    expect(container.querySelector('svg')).toBeNull();
  });
});
