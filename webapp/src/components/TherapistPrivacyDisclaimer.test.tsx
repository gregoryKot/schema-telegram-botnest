// @vitest-environment jsdom
// TherapistPrivacyDisclaimer — одноразовый экран про псевдонимы клиентов
// (0% покрытия). Проверяем: контент рендерится, подтверждение ставит флаг
// в localStorage (не показываем повторно) и зовёт onDone.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TherapistPrivacyDisclaimer, THERAPIST_DISCLAIMER_KEY } from './TherapistPrivacyDisclaimer';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

function renderDisclaimer(onDone = vi.fn()) {
  return render(
    <MemoryRouter>
      <TherapistPrivacyDisclaimer onDone={onDone} />
    </MemoryRouter>,
  );
}

describe('TherapistPrivacyDisclaimer', () => {
  it('рендерит объяснение про псевдонимы и гарантии шифрования', () => {
    renderDisclaimer();
    expect(screen.getByText('Немного о заботе о клиентах')).toBeTruthy();
    expect(screen.getByText(/не вносить настоящие имена/)).toBeTruthy();
    expect(screen.getByText('Шифрование')).toBeTruthy();
  });

  it('«Спасибо, буду иметь в виду» ставит флаг «показано» и зовёт onDone', () => {
    const onDone = vi.fn();
    renderDisclaimer(onDone);
    fireEvent.click(screen.getByText('Спасибо, буду иметь в виду'));
    expect(localStorage.getItem(THERAPIST_DISCLAIMER_KEY)).toBe('1');
    expect(onDone).toHaveBeenCalled();
  });
});
