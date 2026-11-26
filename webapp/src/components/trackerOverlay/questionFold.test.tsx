// @vitest-environment jsdom
// Ответы трекера на первом экране телефона (QA мобильной версии 2026-11, З5).
// На 390×664 и 360×640 у новичка ни один из пяти ответов не попадал в экран:
// примеры «Например» были раскрыты на каждом вопросе, а следующий вопрос
// открывался на прокрутке прошлого — без названия потребности.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { TrackerOverlay } from '../TrackerOverlay';
import { AUTO_ADVANCE_MS } from './trackerFlow';
import type { Need } from '../../types';

vi.mock('../../api', () => ({
  api: { ratings: vi.fn(), saveRating: vi.fn(), trackEvent: vi.fn() },
  reportClientError: vi.fn(),
}));
import { api } from '../../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

const NEEDS: Need[] = [
  { id: 'attachment', emoji: '🤝', title: 'Привязанность', chartLabel: 'Привяз.' },
  { id: 'autonomy', emoji: '🧭', title: 'Автономия', chartLabel: 'Автон.' },
];

function Harness() {
  const [ratings, setRatings] = useState<Record<string, number>>({});
  return (
    <TrackerOverlay
      needs={NEEDS}
      ratings={ratings}
      onChange={(id: string, v: number) => setRatings((r) => ({ ...r, [id]: v }))}
      onSaved={vi.fn()}
      onClose={vi.fn()}
    />
  );
}

const renderOverlay = () => render(<MemoryRouter><Harness /></MemoryRouter>);
const body = (c: HTMLElement) => c.querySelector('.tq-body') as HTMLElement;

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  localStorage.clear();
  mockApi.saveRating.mockResolvedValue({ ok: true, allDone: false });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('TrackerOverlay — ответы на первом экране', () => {
  it('у новичка (ни сегодня, ни вчера оценок нет) примеры свёрнуты, описание потребности на месте', () => {
    const { container } = renderOverlay();
    expect(container.querySelector('details.tq-examples')?.hasAttribute('open')).toBe(false);
    expect(screen.getByText('Например')).toBeTruthy();
    expect(container.querySelector('.tq-desc')?.textContent).toBeTruthy();
  });

  it('следующий вопрос открывается сверху, а не на прокрутке прошлого', async () => {
    const { container } = renderOverlay();
    body(container).scrollTop = 300;
    fireEvent.click(screen.getByRole('button', { name: /^Полностью/ }));
    await act(async () => { await vi.advanceTimersByTimeAsync(AUTO_ADVANCE_MS + 50); });
    expect(screen.getByRole('heading', { level: 1, name: 'Автономия' })).toBeTruthy();
    expect(body(container).scrollTop).toBe(0);
  });
});
