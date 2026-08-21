// @vitest-environment jsdom
// PatternHelpSection — блок «Что поможет» экрана паттерна: голос Здорового
// Взрослого/совет по схеме (с фолбэком), потребность и чипы быстрых практик,
// которые открывают тот же QuickPracticeSheet, что и «Помощь»/плюс-меню.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { PatternHelpSection } from './PatternHelpSection';
import { AddressFormContext } from '../../utils/addressForm';
import { DEFAULT_HINT } from '../../../../shared/src/mode/healthyAdultHints';
import type { AddressForm } from '../../../../shared/src/utils/addressForm';

vi.mock('../QuickPracticeSheet', () => ({
  QuickPracticeSheet: ({
    id,
    onClose,
  }: {
    id: string;
    onClose: () => void;
  }) => (
    <div data-testid="quick-practice">
      {id}
      <button onClick={onClose}>close-practice</button>
    </div>
  ),
}));

afterEach(cleanup);

function renderWithForm(
  kind: 'schema' | 'mode',
  id: string,
  form: AddressForm = 'ty',
) {
  return render(
    <AddressFormContext.Provider value={{ form, setForm: vi.fn() }}>
      <PatternHelpSection kind={kind} id={id} />
    </AddressFormContext.Provider>,
  );
}

describe('PatternHelpSection — режим', () => {
  it('карточка режима есть → голос Здорового Взрослого и потребность из карточки', () => {
    renderWithForm('mode', 'demanding_critic');
    expect(
      screen.getByText(
        '«Сделанного уже достаточно. Планку можно отодвинуть и не подгонять себя новой»',
      ),
    ).toBeTruthy();
    expect(screen.getByText('Здоровый Взрослый отвечает')).toBeTruthy();
    expect(
      screen.getByText(
        'Право на паузу и признание того, что уже сделано, без новых условий.',
      ),
    ).toBeTruthy();
  });

  it('карточки режима нет → фолбэк через healthyAdultHint (не «нет данных»)', () => {
    renderWithForm('mode', 'nonexistent_mode_id_xyz');
    expect(screen.getByText(DEFAULT_HINT)).toBeTruthy();
    // Без карточки — нет «нужно», ряд не рисуется вовсе (не пустая строка).
    expect(screen.queryByText('Что на самом деле нужно')).toBeNull();
  });
});

describe('PatternHelpSection — схема', () => {
  it('форма «ты» — совет и потребность на «ты»', () => {
    renderWithForm('schema', 'abandonment', 'ty');
    expect(
      screen.getByText(
        'Замечай, когда партнёр рядом – это реальный факт, а не случайность.',
      ),
    ).toBeTruthy();
    expect(
      screen.getByText(
        'Привязанность — Рядом есть надёжные люди. Чувствую безопасность, принятие и связь.',
      ),
    ).toBeTruthy();
  });

  it('форма «вы» — тот же совет во множественном числе', () => {
    renderWithForm('schema', 'abandonment', 'vy');
    expect(
      screen.getByText(
        'Замечайте, когда партнёр рядом – это реальный факт, а не случайность.',
      ),
    ).toBeTruthy();
    expect(
      screen.queryByText(
        'Замечай, когда партнёр рядом – это реальный факт, а не случайность.',
      ),
    ).toBeNull();
  });
});

describe('PatternHelpSection — чипы быстрых практик', () => {
  it('рендерит 3 чипа (дыхание/заземление/стоп)', () => {
    renderWithForm('mode', 'demanding_critic');
    expect(screen.getByText('Дыхание 4-4-6')).toBeTruthy();
    expect(screen.getByText('Заземление 5-4-3-2-1')).toBeTruthy();
    expect(screen.getByText('Техника «Стоп»')).toBeTruthy();
  });

  it('тап по чипу открывает QuickPracticeSheet с нужным id — тот же плеер, что и везде', () => {
    renderWithForm('mode', 'demanding_critic');
    expect(screen.queryByTestId('quick-practice')).toBeNull();
    fireEvent.click(screen.getByText('Заземление 5-4-3-2-1'));
    expect(screen.getByTestId('quick-practice').textContent).toContain(
      'grounding',
    );
  });

  it('закрытие практики возвращает к блоку «Что поможет»', () => {
    renderWithForm('mode', 'demanding_critic');
    fireEvent.click(screen.getByText('Техника «Стоп»'));
    fireEvent.click(screen.getByText('close-practice'));
    expect(screen.getByText('Что поможет')).toBeTruthy();
  });
});
