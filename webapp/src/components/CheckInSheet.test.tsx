// @vitest-environment jsdom
// CheckInSheet — оверлей «отметить вчерашнюю практику». К4 дизайн-аудита
// 2026-08: панель размечена как диалог (useDialogA11y), без своего теста.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CheckInSheet } from './CheckInSheet';
import type { PracticePlan } from '../api';

vi.mock('../api', () => ({
  api: { checkinPlan: vi.fn().mockResolvedValue({}) },
}));

const PLAN: PracticePlan = {
  id: 1,
  needId: 'attachment',
  practiceText: 'Позвонить другу',
  scheduledDate: '2026-08-01',
  reminderUtcHour: null,
  done: null,
};

afterEach(cleanup);

function renderSheet() {
  return render(
    <MemoryRouter>
      <CheckInSheet
        plan={PLAN}
        needColor="#60a5fa"
        needLabel="Привязанность"
        color="#60a5fa"
        onDone={vi.fn()}
      />
    </MemoryRouter>,
  );
}

describe('CheckInSheet', () => {
  it('панель размечена как диалог', () => {
    renderSheet();
    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
  });

  it('показывает текст практики', () => {
    renderSheet();
    expect(screen.getByText('Позвонить другу')).toBeTruthy();
  });
});
