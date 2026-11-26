// @vitest-environment jsdom
// Вступление «Колеса детства»: мост к терапевту виден клиенту и пуст терапевту.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ChildhoodIntro } from './ChildhoodIntro';

vi.mock('../../therapy/trackTherapyNudge', () => ({ trackTherapyNudge: vi.fn() }));

const CAUTION = 'Это самопомощь, не замена терапии.';

const renderIntro = () => render(
  <MemoryRouter>
    <ChildhoodIntro title="Колесо детства" onBack={vi.fn()} onStart={vi.fn()} />
  </MemoryRouter>,
);

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe('ChildhoodIntro: мост к терапевту', () => {
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
