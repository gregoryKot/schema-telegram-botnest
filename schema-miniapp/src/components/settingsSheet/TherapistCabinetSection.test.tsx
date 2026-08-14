// @vitest-environment jsdom
// TherapistCabinetSection — вход в кабинет терапевта + создание ссылки-
// приглашения. Read-after-write: показанный (обрезанный) URL — это URL ИЗ
// ОТВЕТА сервера, а не выдуманный. Открытие кабинета — отдельный клик, не
// путается с кнопкой приглашения.
import { useState } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  act,
} from '@testing-library/react';
import { TherapistCabinetSection } from './TherapistCabinetSection';

vi.mock('../../api', () => ({
  api: { createTherapyInvite: vi.fn() },
}));
import { api } from '../../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(navigator, { clipboard: { writeText: vi.fn() } });
});

afterEach(() => {
  cleanup();
});

describe('TherapistCabinetSection — открытие кабинета', () => {
  it('клик по строке зовёт onOpenTherapistCabinet', () => {
    const onOpen = vi.fn();
    render(
      <TherapistCabinetSection
        onOpenTherapistCabinet={onOpen}
        therapyInviteUrl=""
        setTherapyInviteUrl={() => {}}
      />,
    );
    fireEvent.click(screen.getByText('Открыть кабинет'));
    expect(onOpen).toHaveBeenCalled();
  });
});

describe('TherapistCabinetSection — приглашение клиента', () => {
  it('без сохранённого url подсказка «Скопировано» не показывается', () => {
    render(
      <TherapistCabinetSection
        therapyInviteUrl=""
        setTherapyInviteUrl={() => {}}
      />,
    );
    expect(screen.queryByText(/Скопировано/)).toBeNull();
  });

  it('успешный запрос кладёт URL ИЗ ОТВЕТА сервера (read-after-write)', async () => {
    mockApi.createTherapyInvite.mockResolvedValue({
      url: 'https://t.me/schema_bot?start=invite_abc123',
    });
    const setTherapyInviteUrl = vi.fn();
    render(
      <TherapistCabinetSection
        therapyInviteUrl=""
        setTherapyInviteUrl={setTherapyInviteUrl}
      />,
    );
    await act(async () => {
      fireEvent.click(screen.getByText('+ Создать приглашение клиенту'));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(setTherapyInviteUrl).toHaveBeenCalledWith(
      'https://t.me/schema_bot?start=invite_abc123',
    );
  });

  it('провал createTherapyInvite виден на кнопке, а не молчит (regression: check-silent-catch)', async () => {
    mockApi.createTherapyInvite.mockRejectedValue(new Error('network'));
    render(
      <TherapistCabinetSection
        therapyInviteUrl=""
        setTherapyInviteUrl={() => {}}
      />,
    );
    await act(async () => {
      fireEvent.click(screen.getByText('+ Создать приглашение клиенту'));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByText('Не получилось')).toBeTruthy();
  });

  it('клипборд падает — URL создан, но подпись «Не скопировалось» (был: молча проглочен)', async () => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
    });
    mockApi.createTherapyInvite.mockResolvedValue({
      url: 'https://t.me/schema_bot?start=invite_denied',
    });

    function Host() {
      const [url, setUrl] = useState('');
      return (
        <TherapistCabinetSection
          therapyInviteUrl={url}
          setTherapyInviteUrl={setUrl}
        />
      );
    }
    render(<Host />);
    await act(async () => {
      fireEvent.click(screen.getByText('+ Создать приглашение клиенту'));
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByText(/Не скопировалось:/)).toBeTruthy();
  });

  it('уже сохранённый url показывается обрезанным', () => {
    const longUrl = 'https://t.me/schema_bot?start=' + 'x'.repeat(60);
    render(
      <TherapistCabinetSection
        therapyInviteUrl={longUrl}
        setTherapyInviteUrl={() => {}}
      />,
    );
    expect(
      screen.getByText(`Скопировано: ${longUrl.slice(0, 50)}...`),
    ).toBeTruthy();
  });
});
