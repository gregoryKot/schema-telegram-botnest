// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

vi.mock('../api', () => ({
  api: { joinPair: vi.fn(), joinTherapy: vi.fn() },
}));
vi.mock('../utils/addressForm', () => ({
  useTr: () => (ty: string) => ty,
}));
import { api } from '../api';
import { JoinConfirmSheet } from './JoinConfirmSheet';

const m = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

function setup(joinKind: 'pair' | 'therapy') {
  const onClose = vi.fn();
  const onJoined = vi.fn();
  render(<JoinConfirmSheet joinKind={joinKind} joinCode="CODE1" onClose={onClose} onJoined={onJoined} />);
  return { onClose, onJoined };
}

beforeEach(() => {
  vi.clearAllMocks();
  m.joinPair.mockResolvedValue(undefined);
  m.joinTherapy.mockResolvedValue(undefined);
});
afterEach(cleanup);

describe('JoinConfirmSheet (M1: согласие до присоединения)', () => {
  it('показ экрана не зовёт сеть', () => {
    setup('pair');
    expect(m.joinPair).not.toHaveBeenCalled();
    expect(m.joinTherapy).not.toHaveBeenCalled();
  });

  it('пара: «Присоединиться» → ровно один joinPair с кодом', async () => {
    const { onJoined } = setup('pair');
    fireEvent.click(screen.getByText('Присоединиться'));
    await waitFor(() => expect(onJoined).toHaveBeenCalledWith('pair'));
    expect(m.joinPair).toHaveBeenCalledTimes(1);
    expect(m.joinPair).toHaveBeenCalledWith('CODE1');
    expect(m.joinTherapy).not.toHaveBeenCalled();
  });

  it('терапевт: «Присоединиться» → ровно один joinTherapy', async () => {
    const { onJoined } = setup('therapy');
    fireEvent.click(screen.getByText('Присоединиться'));
    await waitFor(() => expect(onJoined).toHaveBeenCalledWith('therapy'));
    expect(m.joinTherapy).toHaveBeenCalledTimes(1);
    expect(m.joinTherapy).toHaveBeenCalledWith('CODE1');
    expect(m.joinPair).not.toHaveBeenCalled();
  });

  it('«Не сейчас», фон и Escape — отказ без сетевого вызова', () => {
    const a = setup('pair');
    fireEvent.click(screen.getByText('Не сейчас'));
    expect(a.onClose).toHaveBeenCalledTimes(1);
    cleanup();
    const b = setup('therapy');
    fireEvent.click(screen.getByRole('presentation'));
    expect(b.onClose).toHaveBeenCalledTimes(1);
    expect(m.joinPair).not.toHaveBeenCalled();
    expect(m.joinTherapy).not.toHaveBeenCalled();
  });

  it('терапевт, 409 already_connected: свой текст, экран остаётся', async () => {
    m.joinTherapy.mockRejectedValue({ status: 409, reason: 'already_connected' });
    const { onJoined } = setup('therapy');
    fireEvent.click(screen.getByText('Присоединиться'));
    expect((await screen.findByRole('alert')).textContent).toMatch(/уже есть подключение к терапевту/);
    expect(onJoined).not.toHaveBeenCalled();
  });

  it('любая другая ошибка: общий текст', async () => {
    m.joinPair.mockRejectedValue(new Error('boom'));
    setup('pair');
    fireEvent.click(screen.getByText('Присоединиться'));
    expect((await screen.findByRole('alert')).textContent).toMatch(/Не получилось присоединиться/);
  });
});
