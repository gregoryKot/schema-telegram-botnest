// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

vi.mock('../api', () => ({ api: { trackEvent: vi.fn() } }));
vi.mock('../utils/addressForm', () => ({ useTr: () => (ty: string) => ty }));
import { api } from '../api';
import { ConsentScreen } from './ConsentScreen';

const track = (api as unknown as { trackEvent: ReturnType<typeof vi.fn> }).trackEvent;

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe('ConsentScreen', () => {
  it('принять можно только после обеих галочек, один вызов onAccept', () => {
    const onAccept = vi.fn();
    render(<ConsentScreen onAccept={onAccept} failed={false} />);
    const next = screen.getByText('Далее') as HTMLButtonElement;
    expect(next.disabled).toBe(true);
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(next);
    const start = screen.getByText('Начать') as HTMLButtonElement;
    expect(start.disabled).toBe(true);
    fireEvent.click(start);
    expect(onAccept).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(start);
    expect(onAccept).toHaveBeenCalledTimes(1);
  });

  it('аналитика: privacy, not_therapy, done, каждый шаг один раз', () => {
    render(<ConsentScreen onAccept={vi.fn()} failed={false} />);
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByText('Далее'));
    fireEvent.click(screen.getByText('Назад'));
    fireEvent.click(screen.getByText('Далее'));
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByText('Начать'));
    expect(track.mock.calls.map((c) => c[1].step)).toEqual(['privacy', 'not_therapy', 'done']);
  });

  it('закрыть без согласия нельзя: клик по фону ничего не делает', () => {
    const onAccept = vi.fn();
    render(<ConsentScreen onAccept={onAccept} failed={false} />);
    fireEvent.click(screen.getByRole('presentation'));
    expect(screen.getByText('Данные и конфиденциальность')).toBeTruthy();
    expect(onAccept).not.toHaveBeenCalled();
  });

  it('failed показывает ошибку', () => {
    render(<ConsentScreen onAccept={vi.fn()} failed />);
    expect(screen.getByRole('alert').textContent).toMatch(/Не получилось сохранить/);
  });
});
