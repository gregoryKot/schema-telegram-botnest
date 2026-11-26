// @vitest-environment jsdom
// Тест верхней панели результатов теста схем
// (shared/src/components/YsqResultTopBar): раскрытие объяснения, трекинг
// первого открытия (правило №8 — ysq_help_open навешивают фронтенды),
// кнопка «Поделиться», ты/вы-формы.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { YsqResultTopBar } from '../../../shared/src/components/YsqResultTopBar';

const trVy = (_ty: string, vy: string) => vy;
const noop = () => {};

afterEach(() => cleanup());

describe('YsqResultTopBar', () => {
  it('объяснение скрыто до клика, раскрывается кнопкой «Как понимать»', () => {
    render(<YsqResultTopBar tr={trVy} onShare={noop} onHelpOpen={noop} />);
    expect(screen.queryByText('Что это такое')).toBeNull();
    fireEvent.click(screen.getByText(/Как понимать/));
    expect(screen.getByText('Что это такое')).toBeTruthy();
    expect(screen.getByText(/внутренний защитник/)).toBeTruthy();
    expect(screen.getByText(/вместе с терапевтом/)).toBeTruthy();
  });

  it('onHelpOpen зовётся только при раскрытии, не при сворачивании', () => {
    const onHelpOpen = vi.fn();
    render(<YsqResultTopBar tr={trVy} onShare={noop} onHelpOpen={onHelpOpen} />);
    const btn = screen.getByText(/Как понимать/);
    fireEvent.click(btn); // раскрыли
    fireEvent.click(btn); // свернули
    fireEvent.click(btn); // раскрыли снова
    expect(onHelpOpen).toHaveBeenCalledTimes(2);
  });

  it('кнопка «Поделиться» зовёт onShare', () => {
    const onShare = vi.fn();
    render(<YsqResultTopBar tr={trVy} onShare={onShare} onHelpOpen={noop} />);
    fireEvent.click(screen.getByText(/Поделиться/));
    expect(onShare).toHaveBeenCalledTimes(1);
  });

  it('вы-форма: обращение звучит на «вы»', () => {
    render(<YsqResultTopBar tr={trVy} onShare={noop} onHelpOpen={noop} />);
    fireEvent.click(screen.getByText(/Как понимать/));
    expect(screen.getByText(/про вас/)).toBeTruthy();
    expect(screen.getByText(/вас бережёт/)).toBeTruthy();
  });

  it('ты-форма: обращение звучит на «ты»', () => {
    const trTy = (ty: string) => ty;
    render(<YsqResultTopBar tr={trTy} onShare={noop} onHelpOpen={noop} />);
    fireEvent.click(screen.getByText(/Как понимать/));
    expect(screen.getByText(/про тебя/)).toBeTruthy();
    expect(screen.getByText(/тебя бережёт/)).toBeTruthy();
  });
});
