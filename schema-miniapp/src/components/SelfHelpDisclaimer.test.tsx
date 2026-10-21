// @vitest-environment jsdom
// Лист «Важное о самопомощи»: текст общий с сайтом (shared/selfHelp), здесь
// проверяем сборку в мини-аппе — заголовок, форму обращения и кнопки.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import type { ReactElement } from 'react';
import { AddressFormContext, type AddressForm } from '../utils/addressForm';
import { SelfHelpSheet } from './SelfHelpDisclaimer';

vi.mock('./BottomSheet', () => ({
  BottomSheet: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

function renderWithForm(ui: ReactElement, form: AddressForm = 'ty') {
  return render(
    <AddressFormContext.Provider value={{ form, setForm: () => {} }}>
      {ui}
    </AddressFormContext.Provider>,
  );
}

afterEach(cleanup);

describe('SelfHelpSheet', () => {
  it('показывает заголовок и четыре абзаца', () => {
    const { container } = renderWithForm(<SelfHelpSheet onClose={() => {}} />);
    expect(screen.getByText('Важное о самопомощи')).toBeTruthy();
    expect(container.querySelectorAll('p')).toHaveLength(4);
  });

  it('форма «ты» и «вы» — разные формулировки ориентира', () => {
    renderWithForm(<SelfHelpSheet onClose={() => {}} />, 'ty');
    expect(screen.getByText(/замечаешь, что тянешься/)).toBeTruthy();
    cleanup();
    renderWithForm(<SelfHelpSheet onClose={() => {}} />, 'vy');
    expect(screen.getByText(/замечаете, что тянетесь/)).toBeTruthy();
    expect(screen.queryByText(/замечаешь/)).toBeNull();
  });

  it('«Контакты помощи» есть только с onOpenCrisis и зовёт его', () => {
    const onOpenCrisis = vi.fn();
    renderWithForm(<SelfHelpSheet onClose={() => {}} />);
    expect(screen.queryByText('Контакты помощи')).toBeNull();
    cleanup();
    renderWithForm(
      <SelfHelpSheet onClose={() => {}} onOpenCrisis={onOpenCrisis} />,
    );
    fireEvent.click(screen.getByText('Контакты помощи'));
    expect(onOpenCrisis).toHaveBeenCalledTimes(1);
  });

  it('«Понятно» закрывает лист', () => {
    const onClose = vi.fn();
    renderWithForm(<SelfHelpSheet onClose={onClose} />);
    fireEvent.click(screen.getByText('Понятно'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
