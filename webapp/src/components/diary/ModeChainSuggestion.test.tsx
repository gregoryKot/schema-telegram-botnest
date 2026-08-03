// @vitest-environment jsdom
// Подсказка «разобрать связанный режим» (webapp-двойник miniapp
// ModeChainSuggestion.test.tsx, правило №3). Тексты/кандидаты — общий
// shared/mode/modeChain, покрыт modeChain.test.ts там же.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ModeChainSuggestion } from './ModeChainSuggestion';

afterEach(cleanup);

describe('ModeChainSuggestion (webapp)', () => {
  it('для копинг-режима — вопрос, 3 кандидата и «Другой режим»', () => {
    render(
      <ModeChainSuggestion modeId="detached_protector" onPick={vi.fn()} />,
    );
    expect(screen.getByText(/кто прятался за ним/i)).toBeTruthy();
    expect(screen.getByText(/Уязвимый Ребёнок/)).toBeTruthy();
    expect(screen.getByText(/Сердитый Ребёнок/)).toBeTruthy();
    expect(screen.getByText(/Одинокий Ребёнок/)).toBeTruthy();
    expect(screen.getByText('Другой режим')).toBeTruthy();
  });

  it('для здорового режима (healthy_adult) — ничего не рендерит', () => {
    const { container } = render(
      <ModeChainSuggestion modeId="healthy_adult" onPick={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('тап по кандидату вызывает onPick с его modeId', () => {
    const onPick = vi.fn();
    render(
      <ModeChainSuggestion modeId="detached_protector" onPick={onPick} />,
    );
    fireEvent.click(screen.getByText(/Уязвимый Ребёнок/));
    expect(onPick).toHaveBeenCalledWith('vulnerable_child');
  });

  it('тап «Другой режим» вызывает onPick(null)', () => {
    const onPick = vi.fn();
    render(
      <ModeChainSuggestion modeId="detached_protector" onPick={onPick} />,
    );
    fireEvent.click(screen.getByText('Другой режим'));
    expect(onPick).toHaveBeenCalledWith(null);
  });
});
