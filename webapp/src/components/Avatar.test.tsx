// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Avatar } from './Avatar';

describe('Avatar', () => {
  it('буква в общем кольце .ds-avatar с классом места, без инлайн-тона, скрыта от чтеца', () => {
    const { container } = render(<Avatar initials="Е" className="tc-avatar" />);
    const el = container.firstElementChild!;
    expect(el.className).toBe('ds-avatar tc-avatar');
    expect(el.textContent).toBe('Е');
    expect(el.getAttribute('style')).toBeNull();
    expect(el.getAttribute('aria-hidden')).toBe('true');
  });
  it('нет буквы (имя не задано) — кружка нет, а не точка', () => {
    const { container } = render(<Avatar initials="" />);
    expect(container.firstChild).toBeNull();
  });
});
