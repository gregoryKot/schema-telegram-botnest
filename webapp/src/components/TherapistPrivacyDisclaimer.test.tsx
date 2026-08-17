// @vitest-environment jsdom
// TherapistPrivacyDisclaimer — одноразовый экран про псевдонимы клиентов
// (0% покрытия). Проверяем: контент рендерится, подтверждение ставит флаг
// в localStorage (не показываем повторно) и зовёт onDone.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TherapistPrivacyDisclaimer, THERAPIST_DISCLAIMER_KEY } from './TherapistPrivacyDisclaimer';
import { AddressFormContext } from '../utils/addressForm';

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

  it('ты/вы: терапевт с формой «ты» не видит «вы»-обращения (правило CLAUDE.md)', () => {
    render(
      <MemoryRouter>
        <AddressFormContext.Provider value={{ form: 'ty', setForm: vi.fn() }}>
          <TherapistPrivacyDisclaimer onDone={vi.fn()} />
        </AddressFormContext.Provider>
      </MemoryRouter>,
    );
    expect(screen.getByText(/твоя работа с людьми, которые тебе доверились/)).toBeTruthy();
    expect(screen.getByText(/старайся/)).toBeTruthy();
    expect(screen.getByText('Только твой доступ')).toBeTruthy();
    expect(screen.getByText(/Если решишь удалить аккаунт/)).toBeTruthy();
    expect(screen.queryByText(/старайтесь/)).toBeNull();
  });

  it('ты/вы: терапевт с формой «вы» не видит «ты»-обращения', () => {
    render(
      <MemoryRouter>
        <AddressFormContext.Provider value={{ form: 'vy', setForm: vi.fn() }}>
          <TherapistPrivacyDisclaimer onDone={vi.fn()} />
        </AddressFormContext.Provider>
      </MemoryRouter>,
    );
    expect(screen.getByText(/ваша работа с людьми, которые вам доверились/)).toBeTruthy();
    expect(screen.getByText(/старайтесь/)).toBeTruthy();
    expect(screen.getByText('Только ваш доступ')).toBeTruthy();
    expect(screen.getByText(/Если решите удалить аккаунт/)).toBeTruthy();
    expect(screen.queryByText(/старайся не вносить/)).toBeNull();
  });
});
