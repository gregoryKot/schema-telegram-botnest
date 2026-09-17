// @vitest-environment jsdom
// InfoOverlays — три статичных объясняющих листа настроек (уведомления,
// пара, терапевт) — правило онбординга «откуда это и зачем». Смоук: каждый
// отвечает на «зачем», закрывается через onClose. Плюс обе формы обращения
// (ты/вы) для Pair/Therapist — раньше были литеральным «ты» без useTr().
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import type { ReactElement } from 'react';
import { AddressFormContext, type AddressForm } from '../../utils/addressForm';
import { hasTyForms } from '../../../../shared/src/utils/tyFormsSweep';
import {
  NotifyInfoOverlay,
  PairInfoOverlay,
  TherapistInfoOverlay,
} from './InfoOverlays';

function renderWithForm(ui: ReactElement, form: AddressForm) {
  return render(
    <AddressFormContext.Provider value={{ form, setForm: () => {} }}>
      {ui}
    </AddressFormContext.Provider>,
  );
}

afterEach(() => {
  cleanup();
});

describe('NotifyInfoOverlay', () => {
  it('объясняет, зачем нужны уведомления', () => {
    render(<NotifyInfoOverlay onClose={() => {}} />);
    expect(screen.getByText('Зачем уведомления')).toBeTruthy();
  });

  it('Escape закрывает лист (через BottomSheet onClose)', () => {
    const onClose = vi.fn();
    render(<NotifyInfoOverlay onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});

describe('PairInfoOverlay', () => {
  it('объясняет, что виден только индекс дня, без деталей дневника', () => {
    render(<PairInfoOverlay onClose={() => {}} />);
    expect(screen.getByText('Зачем привязывать друга')).toBeTruthy();
    expect(screen.getByText(/индексы дня/)).toBeTruthy();
  });

  it('форма «ты»', () => {
    renderWithForm(<PairInfoOverlay onClose={() => {}} />, 'ty');
    expect(screen.getByText(/Ты и друг/)).toBeTruthy();
  });

  it('форма «вы» — без остаточных «ты»-форм', () => {
    const { container } = renderWithForm(
      <PairInfoOverlay onClose={() => {}} />,
      'vy',
    );
    expect(screen.getByText(/Вы и друг/)).toBeTruthy();
    expect(hasTyForms(container.textContent ?? '')).toBe(false);
  });
});

describe('TherapistInfoOverlay', () => {
  it('объясняет, что терапевту видно, а что остаётся под контролем пользователя', () => {
    render(<TherapistInfoOverlay onClose={() => {}} />);
    expect(screen.getByText('Зачем подключать терапевта')).toBeTruthy();
    expect(screen.getByText(/трекер потребностей и задания/)).toBeTruthy();
  });

  it('форма «ты»', () => {
    renderWithForm(<TherapistInfoOverlay onClose={() => {}} />, 'ty');
    expect(screen.getByText(/Если ты работаешь/)).toBeTruthy();
  });

  it('форма «вы» — без остаточных «ты»-форм', () => {
    const { container } = renderWithForm(
      <TherapistInfoOverlay onClose={() => {}} />,
      'vy',
    );
    expect(screen.getByText(/Если вы работаете/)).toBeTruthy();
    expect(hasTyForms(container.textContent ?? '')).toBe(false);
  });
});
