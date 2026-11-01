// @vitest-environment jsdom
// TherapistCabinetSection — вход в кабинет терапевта + создание ссылки-
// приглашения. Read-after-write: показанные ссылка и код — ИЗ ОТВЕТА сервера,
// а не выдуманные. Открытие кабинета — отдельный клик, не путается с кнопкой
// приглашения. Инцидент 2026-10-26: код виден отдельно от ссылки; каждый тап —
// новое приглашение.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  act,
  waitFor,
} from '@testing-library/react';
import { TherapistCabinetSection } from './TherapistCabinetSection';

vi.mock('../../api', () => ({
  api: { createTherapyInvite: vi.fn() },
}));
import { api } from '../../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(navigator, {
    clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
  });
});

afterEach(() => {
  cleanup();
});

async function tapInvite() {
  await act(async () => {
    fireEvent.click(screen.getByText('+ Создать приглашение клиенту'));
  });
}

describe('TherapistCabinetSection — открытие кабинета', () => {
  it('клик по строке зовёт onOpenTherapistCabinet', () => {
    const onOpen = vi.fn();
    render(<TherapistCabinetSection onOpenTherapistCabinet={onOpen} />);
    fireEvent.click(screen.getByText('Открыть кабинет'));
    expect(onOpen).toHaveBeenCalled();
  });
});

describe('TherapistCabinetSection — приглашение клиента', () => {
  it('до тапа ни ссылки, ни кода нет', () => {
    render(<TherapistCabinetSection />);
    expect(screen.queryByText(/Ссылка/)).toBeNull();
    expect(screen.queryByText('Скопировать код')).toBeNull();
  });

  it('ссылка и код — ИЗ ОТВЕТА сервера (read-after-write); код отдельно с подсказкой', async () => {
    mockApi.createTherapyInvite.mockResolvedValue({
      url: 'https://t.me/schema_bot?startapp=therapy_7F3A9C21B04E',
      code: '7F3A9C21B04E',
    });
    render(<TherapistCabinetSection />);
    await tapInvite();
    await waitFor(() =>
      expect(screen.getByText(/Ссылка скопирована:/)).toBeTruthy(),
    );
    expect(
      screen.getByText(/therapy_7F3A9C21B04E$/, { selector: 'div' }),
    ).toBeTruthy();
    expect(screen.getByText('7F3A9C21B04E')).toBeTruthy();
    expect(screen.getByText(/«Мой терапевт»/)).toBeTruthy();
  });

  it('каждый тап — новый запрос и новый код на экране', async () => {
    mockApi.createTherapyInvite
      .mockResolvedValueOnce({ url: 'u1', code: 'AAAAAAAAAAAA' })
      .mockResolvedValueOnce({ url: 'u2', code: 'BBBBBBBBBBBB' });
    render(<TherapistCabinetSection />);
    await tapInvite();
    expect(screen.getByText('AAAAAAAAAAAA')).toBeTruthy();
    await tapInvite();
    expect(screen.getByText('BBBBBBBBBBBB')).toBeTruthy();
    expect(mockApi.createTherapyInvite).toHaveBeenCalledTimes(2);
  });

  it('провал createTherapyInvite виден, а не молчит (regression: check-silent-catch)', async () => {
    mockApi.createTherapyInvite.mockRejectedValue(new Error('network'));
    render(<TherapistCabinetSection />);
    await tapInvite();
    expect(screen.getByRole('alert').textContent).toMatch(
      /Не удалось создать приглашение/,
    );
  });

  it('предел живых приглашений — текст с выходом', async () => {
    mockApi.createTherapyInvite.mockRejectedValue({
      status: 409,
      reason: 'too_many_invites',
    });
    render(<TherapistCabinetSection />);
    await tapInvite();
    expect(screen.getByRole('alert').textContent).toMatch(/Отзови ненужные/);
  });

  it('клипборд падает — ссылка видна целиком с подписью «Ссылка не скопировалась» (был: молча проглочен)', async () => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
    });
    mockApi.createTherapyInvite.mockResolvedValue({
      url: 'https://t.me/schema_bot?startapp=therapy_DENIED000000',
      code: 'DENIED000000',
    });
    render(<TherapistCabinetSection />);
    await tapInvite();
    await waitFor(() =>
      expect(screen.getByText(/Ссылка не скопировалась:/)).toBeTruthy(),
    );
  });
});
