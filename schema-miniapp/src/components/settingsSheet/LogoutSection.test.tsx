// @vitest-environment jsdom
// «Выйти» показывается ТОЛЬКО на веб-хосте (ярлык/вкладка). Внутри Telegram/MAX
// выхода нет — вход по initData при каждом запуске (см. logout.ts).
// vi.hoisted — фабрики vi.mock поднимаются выше объявлений.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

const h = vi.hoisted(() => ({ logout: vi.fn(), hostId: 'web' }));
vi.mock('../../logout', () => ({ logout: h.logout }));
vi.mock('../../../../shared/src/host', () => ({
  getHost: () => ({ id: h.hostId }),
}));

import { LogoutSection } from './LogoutSection';

beforeEach(() => {
  vi.clearAllMocks();
  h.logout.mockResolvedValue(undefined);
  h.hostId = 'web';
  cleanup();
});

describe('LogoutSection', () => {
  it('веб-хост: кнопка «Выйти» есть, клик вызывает logout', () => {
    h.hostId = 'web';
    render(<LogoutSection />);
    fireEvent.click(screen.getByText('Выйти'));
    expect(h.logout).toHaveBeenCalledTimes(1);
  });

  it('внутри Telegram кнопки выхода нет (вход по initData каждый запуск)', () => {
    h.hostId = 'telegram';
    const { container } = render(<LogoutSection />);
    expect(container.firstChild).toBeNull();
    expect(screen.queryByText('Выйти')).toBeNull();
  });

  it('в MAX тоже нет', () => {
    h.hostId = 'max';
    const { container } = render(<LogoutSection />);
    expect(container.firstChild).toBeNull();
  });
});
