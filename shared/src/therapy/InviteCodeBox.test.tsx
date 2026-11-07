// @vitest-environment jsdom
// Код приглашения рядом со ссылкой (инцидент 2026-10-26): терапевт видел
// только ссылку t.me, клиенту на сайте код приходилось вырезать из адреса.
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from '@testing-library/react';
import { InviteCodeBox } from './InviteCodeBox';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('InviteCodeBox', () => {
  it('код виден отдельной строкой, рядом подсказка, куда его вводят', () => {
    render(<InviteCodeBox code="7F3A9C21B04E" />);
    expect(screen.getByText('7F3A9C21B04E')).toBeTruthy();
    expect(
      screen.getByText(/Профиль → Настройки → «Мой терапевт»/),
    ).toBeTruthy();
  });

  it('«Скопировать код» кладёт в буфер именно код, не ссылку', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    render(<InviteCodeBox code="7F3A9C21B04E" />);
    fireEvent.click(screen.getByText('Скопировать код'));
    await waitFor(() =>
      expect(screen.getByText('✓ Код скопирован')).toBeTruthy(),
    );
    expect(writeText).toHaveBeenCalledWith('7F3A9C21B04E');
  });

  it('буфер недоступен — видна подсказка скопировать вручную', async () => {
    vi.stubGlobal('navigator', {});
    render(<InviteCodeBox code="7F3A9C21B04E" />);
    fireEvent.click(screen.getByText('Скопировать код'));
    expect(await screen.findByText(/Не удалось скопировать/)).toBeTruthy();
  });
});
