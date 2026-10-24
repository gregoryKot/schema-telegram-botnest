// @vitest-environment jsdom
// AnchorCard — карточка-якорь шкалы потребности (0% покрытия). Проверяем:
// активное/неактивное состояние передаёт заголовок и текст без искажений.
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { AnchorCard } from './AnchorCard';

afterEach(cleanup);

describe('AnchorCard', () => {
  it('в неактивном состоянии показывает заголовок и текст', () => {
    render(
      <AnchorCard
        active={false}
        color="var(--accent-red)"
        title="0 — дефицит"
        text="Часто чувствовал себя лишним"
      />,
    );
    expect(screen.getByText('0 — дефицит')).toBeTruthy();
    expect(screen.getByText('Часто чувствовал себя лишним')).toBeTruthy();
  });

  it('в активном состоянии подсвечивает карточку цветом якоря', () => {
    render(
      <AnchorCard
        active
        color="var(--accent-green)"
        title="10 — насыщение"
        text="Всегда знал, что меня любят"
      />,
    );
    const node = screen.getByText('Всегда знал, что меня любят');
    expect(node.getAttribute('style')).toContain(
      'color-mix(in srgb, var(--accent-green) 10%, transparent)',
    );
  });
});
