// @vitest-environment jsdom
// GroundingStep — экран заземления (дыхание) во флэшкарте. Проверяет обе
// формы обращения через проп tr (правило «ты/вы» CLAUDE.md), кнопки
// «продолжить»/«история»/«закрыть» и что «История» скрыта на пустой БД.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { GroundingStep } from './GroundingStep';

afterEach(() => {
  cleanup();
});

const trTy = (ty: string) => ty;
const trVy = (_ty: string, vy: string) => vy;

describe('GroundingStep — обращение ты/вы', () => {
  it('форма «ты»: местоимение 2 л. ед.ч.', () => {
    render(
      <GroundingStep
        allCardsCount={0}
        tr={trTy}
        onClose={() => {}}
        onContinue={() => {}}
        onShowHistory={() => {}}
      />,
    );
    expect(screen.getByText('Ты сделал правильно')).toBeTruthy();
  });

  it('форма «вы»: согласованное множественное число', () => {
    render(
      <GroundingStep
        allCardsCount={0}
        tr={trVy}
        onClose={() => {}}
        onContinue={() => {}}
        onShowHistory={() => {}}
      />,
    );
    expect(screen.getByText('Вы сделали правильно')).toBeTruthy();
  });
});

describe('GroundingStep — навигация', () => {
  it('без карточек кнопка «История карточек» не отображается', () => {
    render(
      <GroundingStep
        allCardsCount={0}
        tr={trTy}
        onClose={() => {}}
        onContinue={() => {}}
        onShowHistory={() => {}}
      />,
    );
    expect(screen.queryByText(/История карточек/)).toBeNull();
  });

  it('с карточками кнопка «История» вызывает onShowHistory', () => {
    const onShowHistory = vi.fn();
    render(
      <GroundingStep
        allCardsCount={4}
        tr={trTy}
        onClose={() => {}}
        onContinue={() => {}}
        onShowHistory={onShowHistory}
      />,
    );
    fireEvent.click(screen.getByText('История карточек (4)'));
    expect(onShowHistory).toHaveBeenCalled();
  });

  it('«Стало чуть лучше» вызывает onContinue', () => {
    const onContinue = vi.fn();
    render(
      <GroundingStep
        allCardsCount={0}
        tr={trTy}
        onClose={() => {}}
        onContinue={onContinue}
        onShowHistory={() => {}}
      />,
    );
    fireEvent.click(screen.getByText('Стало чуть лучше — разобраться →'));
    expect(onContinue).toHaveBeenCalled();
  });

  it('«Просто закрыть» вызывает onClose', () => {
    const onClose = vi.fn();
    render(
      <GroundingStep
        allCardsCount={0}
        tr={trTy}
        onClose={onClose}
        onContinue={() => {}}
        onShowHistory={() => {}}
      />,
    );
    fireEvent.click(screen.getByText('Просто закрыть'));
    expect(onClose).toHaveBeenCalled();
  });
});
