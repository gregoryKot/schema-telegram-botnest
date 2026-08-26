// @vitest-environment jsdom
// Строка диагностики «Сборка от … · офлайн-кеш: …» (см. комментарий в
// BuildInfoLine.tsx): неделя отладки скорости PWA прошла вслепую — владелец
// и стенд смотрели на разные версии без способа это заметить.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { BuildInfoLine } from './BuildInfoLine';

const getRegistrationsMock = vi.fn();

beforeEach(() => {
  cleanup();
  getRegistrationsMock.mockReset();
  Object.defineProperty(navigator, 'serviceWorker', {
    value: { getRegistrations: getRegistrationsMock },
    configurable: true,
  });
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

  it('метка сборки всегда есть: дата dd.mm hh:mm из vite define или «дев-режим»', () => {
    // vitest берёт define из vite.config — тогда рендерится реальная дата;
    // без define (чистый jsdom) компонент пишет «дев-режим», а не падает.
    getRegistrationsMock.mockResolvedValue([]);
    render(<BuildInfoLine />);
    expect(
      screen.getByText(/Сборка от (дев-режим|\d{2}\.\d{2} \d{2}:\d{2})/),
    ).toBeTruthy();
  });
});
