// @vitest-environment jsdom
// Точка опознавания заменила эмодзи у потребностей (волна 5) и режимов
// (волна 6). Жила по копии в каждом фронтенде, и копии уже начали расходиться
// (разный тег, aria только в одной) — поэтому переехала сюда. Тест держит
// контракт: цвет потребности из общего реестра, готовый цвет сильнее id,
// неизвестное — нейтральный токен, а сам кружок скрыт от скринридера.
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { IdentityDot } from './IdentityDot';

afterEach(() => cleanup());

function dot(el: HTMLElement): HTMLSpanElement {
  const node = el.querySelector('span');
  if (!node) throw new Error('точка не отрисовалась');
  return node;
}

describe('IdentityDot', () => {
  it('по id потребности берёт цвет из общего реестра', () => {
    const { container } = render(<IdentityDot id="attachment" />);
    expect(dot(container).style.background).toContain('rgb(255, 107, 157)');
  });

  it('готовый цвет сильнее id — режимы передают цвет своей группы', () => {
    const { container } = render(
      <IdentityDot id="attachment" color="var(--accent-blue)" />,
    );
    expect(dot(container).style.background).toBe('var(--accent-blue)');
  });

  it('без id и цвета — нейтральный токен, а не чужой цвет', () => {
    const { container } = render(<IdentityDot />);
    expect(dot(container).style.background).toBe('var(--muted)');
  });

  it('размер настраивается, по умолчанию 10', () => {
    const { container } = render(<IdentityDot id="play" />);
    expect(dot(container).style.width).toBe('10px');
    cleanup();
    const custom = render(<IdentityDot id="play" size={7} />);
    expect(dot(custom.container).style.width).toBe('7px');
  });

  it('кружок декоративный — скринридер его не читает', () => {
    const { container } = render(<IdentityDot id="limits" />);
    expect(dot(container).getAttribute('aria-hidden')).toBe('true');
  });
});
