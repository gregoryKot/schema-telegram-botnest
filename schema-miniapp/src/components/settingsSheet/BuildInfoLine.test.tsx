// @vitest-environment jsdom
// Строка диагностики «Версия от … · офлайн-кеш: …» (см. комментарий в
// BuildInfoLine.tsx): неделя отладки скорости PWA прошла вслепую — владелец
// и стенд смотрели на разные версии без способа это заметить. Дата — из
// document.lastModified (заголовок Last-Modified), не из времени сборки:
// зашитый в бандл new Date() ронял сверку dist в CI (PR #431).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  render,
  screen,
  waitFor,
  cleanup,
  fireEvent,
} from '@testing-library/react';
import { BuildInfoLine } from './BuildInfoLine';

const getRegistrationsMock = vi.fn();

beforeEach(() => {
  cleanup();
  localStorage.clear();
  getRegistrationsMock.mockReset();
  Object.defineProperty(navigator, 'serviceWorker', {
    value: { getRegistrations: getRegistrationsMock },
    configurable: true,
  });
});

const setLastModified = (value: string) =>
  Object.defineProperty(document, 'lastModified', {
    value,
    configurable: true,
  });

describe('BuildInfoLine', () => {
  it('SW снят — так и пишет (наш штатный случай после эксперимента 2026-08-25)', async () => {
    getRegistrationsMock.mockResolvedValue([]);
    render(<BuildInfoLine />);
    await waitFor(() =>
      expect(screen.getByText(/офлайн-кеш:\s*снят/)).toBeTruthy(),
    );
  });

  it('SW стоит — видно, что чистка ещё не прошла', async () => {
    getRegistrationsMock.mockResolvedValue([{}]);
    render(<BuildInfoLine />);
    await waitFor(() =>
      expect(screen.getByText(/офлайн-кеш:\s*стоит/)).toBeTruthy(),
    );
  });

  it('дата версии — dd.mm hh:mm из document.lastModified', () => {
    getRegistrationsMock.mockResolvedValue([]);
    // Формат document.lastModified — MM/DD/YYYY hh:mm:ss (спека HTML).
    setLastModified('08/25/2026 21:07:00');
    render(<BuildInfoLine />);
    expect(screen.getByText(/Версия от 25\.08 21:07/)).toBeTruthy();
  });

  it('нечитаемый lastModified — честное «неизвестно», не NaN', () => {
    getRegistrationsMock.mockResolvedValue([]);
    setLastModified('');
    render(<BuildInfoLine />);
    expect(screen.getByText(/Версия от неизвестно/)).toBeTruthy();
  });

  it('пять тапов по строке включают панель замеров, ещё пять — выключают', () => {
    getRegistrationsMock.mockResolvedValue([]);
    render(<BuildInfoLine />);
    const line = screen.getByText(/Версия от/);
    for (let i = 0; i < 5; i++) fireEvent.click(line);
    expect(localStorage.getItem('perf_hud_on')).toBe('1');
    expect(screen.getByText(/замеры: вкл/)).toBeTruthy();
    for (let i = 0; i < 5; i++) fireEvent.click(line);
    expect(localStorage.getItem('perf_hud_on')).toBe('0');
    expect(screen.queryByText(/замеры: вкл/)).toBeNull();
  });

  it('четыре тапа — недостаточно: случайные касания панель не включают', () => {
    getRegistrationsMock.mockResolvedValue([]);
    render(<BuildInfoLine />);
    const line = screen.getByText(/Версия от/);
    for (let i = 0; i < 4; i++) fireEvent.click(line);
    expect(localStorage.getItem('perf_hud_on')).toBeNull();
  });
});
