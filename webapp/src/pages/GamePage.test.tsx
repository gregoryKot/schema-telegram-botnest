// @vitest-environment jsdom
// GamePage — обёртка над встроенной Phaser-игрой (0% покрытия). Тривиальный
// компонент, но регрессия на src игры (опечатка в пути) сломала бы игру
// молча — рендер-тест фиксирует контракт iframe.
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { GamePage } from './GamePage';

afterEach(() => {
  cleanup();
});

describe('GamePage', () => {
  it('рендерит iframe с игрой по правильному пути и подписью для доступности', () => {
    const { container } = render(<GamePage />);
    const iframe = container.querySelector('iframe') as HTMLIFrameElement;
    expect(iframe).toBeTruthy();
    expect(iframe.getAttribute('src')).toBe('/phaser-game/index.html');
    expect(iframe.getAttribute('title')).toBe('Игра «Всё по схеме»');
  });
});
