// @vitest-environment jsdom
// SignHero — знак сущности по ключу крупно, с тенью-вырезкой. Компонент мотива на ключ
// создаётся один раз (кэш): новый на каждый рендер React перемонтировал бы SVG — проверяем,
// что повторный рендер с тем же ключом сохраняет узел, а смена ключа даёт другой знак.
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { SIGN_KEYS } from '../../../../shared/src/theme/entityLook';
import { SignHero } from './SignHero';

afterEach(cleanup);

const [first, second] = SIGN_KEYS;

describe('SignHero', () => {
  it('тот же ключ при повторном рендере — тот же узел знака (без перемонтирования)', () => {
    const { container, rerender } = render(<SignHero sign={first} />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    rerender(<SignHero sign={first} />);
    expect(container.querySelector('svg')).toBe(svg);
  });

  it('другой ключ — другой знак', () => {
    const { container, rerender } = render(<SignHero sign={first} />);
    const before = container.innerHTML;
    rerender(<SignHero sign={second} />);
    expect(container.innerHTML).not.toBe(before);
  });

  it('декор: знак скрыт от чтения с экрана, класс места передаётся', () => {
    const { container } = render(<SignHero sign={first} className="pa-test-place" />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain('pa-test-place');
    for (const svg of container.querySelectorAll('svg')) {
      expect(svg.closest('[aria-hidden="true"]') ?? svg.getAttribute('aria-hidden')).toBeTruthy();
    }
  });
});
