// @vitest-environment jsdom
// Экран «Готово» трекера: строка моста к терапевту подбирается по индексу дня.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CompletionScreen } from './CompletionScreen';
import type { Need } from '../../types';

vi.mock('../../api', () => ({ api: { trackEvent: vi.fn() } }));
vi.mock('../../share/DayShareButton', () => ({ DayShareButton: () => null }));

afterEach(cleanup);

const IDS = ['attachment', 'autonomy', 'expression', 'play', 'limits'];
const NEEDS: Need[] = IDS.map((id) => ({ id, emoji: '', title: id, chartLabel: id }));

function renderDone(value: number | null) {
  const ratings = value === null ? { attachment: 5 } : Object.fromEntries(IDS.map((id) => [id, value]));
  render(
    <MemoryRouter>
      <CompletionScreen needs={NEEDS} effectiveRatings={ratings} isBackfill={false} goBack={vi.fn()} onReview={vi.fn()} />
    </MemoryRouter>,
  );
}

describe('CompletionScreen — мост к терапевту', () => {
  it('индекс дня ≤ 4: «Когда низко день за днём…»', () => {
    renderDone(4);
    expect(screen.getByText(/Когда низко день за днём, есть с кем поговорить/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Поговорить →' })).toBeTruthy();
  });

  it('индекс выше 4: «Если нужна терапия…»', () => {
    renderDone(7);
    expect(screen.getByText(/Трекер — самопомощь, не замена терапии\. Если нужна терапия/)).toBeTruthy();
  });

  it('оценены не все: индекса нет — общая формулировка', () => {
    renderDone(null);
    expect(screen.getByText(/Если нужна терапия, есть с кем поговорить/)).toBeTruthy();
  });
});
