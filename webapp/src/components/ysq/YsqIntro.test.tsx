// @vitest-environment jsdom
// Интро теста YSQ: мост к терапевту виден клиенту и пуст терапевту.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { YsqIntro } from './YsqIntro';

vi.mock('../therapy/trackTherapyNudge', () => ({ trackTherapyNudge: vi.fn() }));

const CAUTION = 'Это самопомощь, не замена терапии.';

function renderIntro() {
  return render(
    <MemoryRouter>
      <YsqIntro tr={(ty) => ty} hasProgress={false} progressAnswered={0}
        onContinue={vi.fn()} onStartFresh={vi.fn()} onCancel={vi.fn()} />
    </MemoryRouter>,
  );
}

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe('YsqIntro: мост к терапевту', () => {
  it('клиенту показано предупреждение', () => {
    renderIntro();
    expect(screen.getByText(CAUTION)).toBeTruthy();
  });

  it('терапевту предупреждения нет', () => {
    localStorage.setItem('therapy_contact_url', 'tg://user?id=1');
    localStorage.setItem('therapy_contact_name', 'вам');
    localStorage.setItem('therapy_is_therapist', '1');
    renderIntro();
    expect(screen.queryByText(CAUTION)).toBeNull();
  });
});
