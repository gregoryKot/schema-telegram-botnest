// @vitest-environment jsdom
// Блок «Здесь и сейчас» раздела «Практика»: обе строки-практики (заземление,
// «Стоп») рендерятся, реальный счётчик из getPracticeSessions подставляется в
// подпись строки, а при упавшем запросе остаётся статичная подпись — НЕ
// выдуманный ноль (правило CLAUDE.md «никаких хардкод-заглушек вместо
// реальных данных»). Клик по строке открывает лист именно той практики, что
// подписана на строке — регрессия здесь означала бы «Стоп» открывает
// заземление или наоборот.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  act,
  cleanup,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HereAndNowBlock } from './HereAndNowBlock';

vi.mock('../../api', () => ({
  api: {
    trackEvent: vi.fn(),
    getPracticeSessions: vi.fn(),
    recordPracticeSession: vi.fn(),
  },
}));
import { api } from '../../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

function renderBlock() {
  return render(
    <MemoryRouter>
      <HereAndNowBlock />
    </MemoryRouter>,
  );
}

describe('HereAndNowBlock', () => {
  it('рендерит обе быстрые практики: заземление и «Стоп»', () => {
    mockApi.getPracticeSessions.mockResolvedValue({
      breathing: 0,
      grounding: 0,
      stop: 0,
    });
    renderBlock();
    expect(screen.getByText('Заземление 5-4-3-2-1')).toBeTruthy();
    expect(screen.getByText('Техника «Стоп»')).toBeTruthy();
  });

  it('реальный счётчик из getPracticeSessions виден в подписи строки', async () => {
    mockApi.getPracticeSessions.mockResolvedValue({
      breathing: 0,
      grounding: 3,
      stop: 0,
    });
    renderBlock();
    await flush();
    expect(screen.getByText(/3 раза/)).toBeTruthy();
  });

  it('запрос счётчиков упал — подпись остаётся статичной, без выдуманного нуля', async () => {
    mockApi.getPracticeSessions.mockRejectedValue(new Error('offline'));
    renderBlock();
    await flush();
    // Статичная подпись строки заземления (ROWS[0].sub) — на месте.
    expect(screen.getByText('вернуться в тело и в комнату')).toBeTruthy();
    expect(screen.queryByText(/прошли/)).toBeNull();
  });

  it('клик по строке «Стоп» открывает именно лист «Стоп», а не заземления', () => {
    mockApi.getPracticeSessions.mockResolvedValue({
      breathing: 0,
      grounding: 0,
      stop: 0,
    });
    renderBlock();
    fireEvent.click(screen.getByText('Техника «Стоп»').closest('[role="button"]')!);
    expect(screen.getByText('С — Стоп. Замри на секунду')).toBeTruthy();
  });

  it('клик по строке заземления открывает именно лист заземления', () => {
    mockApi.getPracticeSessions.mockResolvedValue({
      breathing: 0,
      grounding: 0,
      stop: 0,
    });
    renderBlock();
    fireEvent.click(
      screen.getByText('Заземление 5-4-3-2-1').closest('[role="button"]')!,
    );
    expect(screen.getByText('Найди 5 вещей, которые видишь')).toBeTruthy();
  });
});
