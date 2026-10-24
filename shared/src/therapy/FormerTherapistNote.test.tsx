// @vitest-environment jsdom
// Сообщение о бывшем терапевте (решение владельца 2026-10-22): видно, только
// когда текущего терапевта нет и сервер отдал бывшего; при null, сбое и живой
// связи — ничего (данные только реальные, спиннера нет).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, act } from '@testing-library/react';
import { AddressFormContext } from '../utils/addressForm';
import { FormerTherapistNote } from './FormerTherapistNote';

afterEach(() => cleanup());

const anna = { name: 'Анна', endedAt: '2026-10-22T10:00:00.000Z' };

describe('FormerTherapistNote', () => {
  it('сервер отдал бывшего терапевта — имя и текст', async () => {
    render(
      <FormerTherapistNote load={() => Promise.resolve(anna)} enabled={true} />,
    );
    expect(
      await screen.findByText('Анна больше не работает в приложении как терапевт'),
    ).toBeTruthy();
    expect(screen.getByRole('note').textContent).toContain('остаётся у тебя');
  });

  it('форма «вы» из контекста', async () => {
    render(
      <AddressFormContext.Provider value={{ form: 'vy', setForm: () => {} }}>
        <FormerTherapistNote load={() => Promise.resolve(anna)} enabled={true} />
      </AddressFormContext.Provider>,
    );
    expect((await screen.findByRole('note')).textContent).toContain(
      'остаётся у вас',
    );
  });

  it('null с сервера, пустое тело, сбой и синхронный сбой — ничего не рисуется', async () => {
    for (const load of [
      () => Promise.resolve(null),
      () => Promise.resolve({} as never),
      () => Promise.reject(new Error('net')),
      (): Promise<null> => {
        throw new Error('sync');
      },
    ]) {
      const spy = vi.fn(load);
      const { container } = render(
        <FormerTherapistNote load={spy} enabled={true} />,
      );
      await waitFor(() => expect(spy).toHaveBeenCalledTimes(1));
      await act(async () => {});
      expect(container.textContent).toBe('');
      cleanup();
    }
  });

  it('текущий терапевт есть (enabled=false) — без запроса и без сообщения', () => {
    const load = vi.fn(() => Promise.resolve(anna));
    const { container } = render(
      <FormerTherapistNote load={load} enabled={false} />,
    );
    expect(load).not.toHaveBeenCalled();
    expect(container.textContent).toBe('');
  });

  it('подключился к новому терапевту — сообщение пропадает сразу', async () => {
    const load = vi.fn(() => Promise.resolve(anna));
    const { rerender, container } = render(
      <FormerTherapistNote load={load} enabled={true} />,
    );
    await screen.findByRole('note');
    rerender(<FormerTherapistNote load={load} enabled={false} />);
    expect(container.textContent).toBe('');
  });

  it('пустое имя — заголовок без имени', async () => {
    render(
      <FormerTherapistNote
        load={() => Promise.resolve({ name: '', endedAt: null })}
        enabled={true}
      />,
    );
    expect(
      await screen.findByText('Терапевт больше не работает в приложении'),
    ).toBeTruthy();
  });
});
