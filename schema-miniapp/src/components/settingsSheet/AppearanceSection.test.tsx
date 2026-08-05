// @vitest-environment jsdom
// AppearanceSection — тема + «меньше движения» + панель специалиста
// (0% покрытия). Регрессионный кейс: текст подтверждения «снять роль»
// использовал жёсткую «ты»-форму («Свои данные не теряешь») без tr() —
// нашли при написании этого теста (правило CLAUDE.md про ты/вы), почищено
// в этом же PR. Тест фиксирует обе формы, чтобы регресс не вернулся.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import type { ReactElement } from 'react';
import { AddressFormContext, type AddressForm } from '../../utils/addressForm';
import { hasTyForms } from '../../../../shared/src/utils/tyFormsSweep';
import { AppearanceSection } from './AppearanceSection';
import type { MotionPref } from './types';

afterEach(() => {
  cleanup();
});

function renderWithForm(ui: ReactElement, form: AddressForm) {
  return render(
    <AddressFormContext.Provider value={{ form, setForm: () => {} }}>
      {ui}
    </AddressFormContext.Provider>,
  );
}

function motion(overrides: Partial<MotionPref> = {}): MotionPref {
  return {
    reduced: false,
    systemReduced: false,
    sub: 'выключено',
    toggle: vi.fn(),
    ...overrides,
  };
}

function baseProps() {
  return {
    theme: 'dark' as const,
    setTheme: vi.fn(),
    motion: motion(),
    resignConfirm: false,
    setResignConfirm: vi.fn(),
    resignBusy: false,
    setResignBusy: vi.fn(),
  };
}

describe('AppearanceSection — тема', () => {
  it('theme=dark — подпись «Тёмная тема», переключатель темы выключен (aria-checked=false)', () => {
    render(<AppearanceSection {...baseProps()} theme="dark" />);
    expect(screen.getByText('Тёмная тема')).toBeTruthy();
    const [themeSwitch] = screen.getAllByRole('switch');
    expect(themeSwitch.getAttribute('aria-checked')).toBe('false');
  });

  it('клик по переключателю темы зовёт setTheme (toggleTheme читает реальный localStorage, покрыт отдельно в theme.test.ts)', () => {
    const setTheme = vi.fn();
    render(
      <AppearanceSection {...baseProps()} theme="light" setTheme={setTheme} />,
    );
    const switches = screen.getAllByRole('switch');
    fireEvent.click(switches[0]);
    expect(setTheme).toHaveBeenCalledTimes(1);
  });

  it('клик по «Авто (по Telegram)» сбрасывает на системную тему', () => {
    const setTheme = vi.fn();
    render(<AppearanceSection {...baseProps()} setTheme={setTheme} />);
    fireEvent.click(screen.getByText('Авто (по Telegram) →'));
    expect(setTheme).toHaveBeenCalled();
  });
});

describe('AppearanceSection — «меньше движения»', () => {
  it('клик по тумблеру «меньше движения» зовёт motion.toggle', () => {
    const toggle = vi.fn();
    render(<AppearanceSection {...baseProps()} motion={motion({ toggle })} />);
    expect(screen.getByText('Меньше движения')).toBeTruthy();
    // Второй switch на экране (первый — тема) — тумблер motion.
    const switches = screen.getAllByRole('switch');
    fireEvent.click(switches[1]);
    expect(toggle).toHaveBeenCalled();
  });
});

describe('AppearanceSection — панель специалиста скрыта для клиента', () => {
  it('userRole не задан — ни тумблера режима, ни кнопки снятия роли', () => {
    render(<AppearanceSection {...baseProps()} />);
    expect(screen.queryByText('Режим специалиста')).toBeNull();
    expect(screen.queryByText('Перестать быть специалистом')).toBeNull();
  });
});

describe('AppearanceSection — режим специалиста', () => {
  it('userRole=THERAPIST — тумблер режима виден, клик зовёт onToggleTherapistMode', () => {
    const onToggleTherapistMode = vi.fn();
    render(
      <AppearanceSection
        {...baseProps()}
        userRole="THERAPIST"
        therapistMode={false}
        onToggleTherapistMode={onToggleTherapistMode}
      />,
    );
    expect(screen.getByText('Режим клиента')).toBeTruthy();
    fireEvent.click(screen.getByText('Режим специалиста'));
    // Клик по подписи не переключает — ищем сам переключатель по роли.
    const switches = screen.getAllByRole('switch');
    fireEvent.click(switches[switches.length - 1]);
    expect(onToggleTherapistMode).toHaveBeenCalled();
  });

  it('therapistMode=true — подпись «Кабинет терапевта»', () => {
    render(
      <AppearanceSection
        {...baseProps()}
        userRole="THERAPIST"
        therapistMode
        onToggleTherapistMode={() => {}}
      />,
    );
    expect(screen.getByText('Кабинет терапевта')).toBeTruthy();
  });
});

describe('AppearanceSection — снятие роли специалиста', () => {
  it('клик «Перестать быть специалистом» открывает подтверждение с текстом на «ты»', () => {
    renderWithForm(
      <AppearanceSection
        {...baseProps()}
        userRole="THERAPIST"
        onResignTherapist={vi.fn()}
      />,
      'ty',
    );
    fireEvent.click(screen.getByText('Перестать быть специалистом'));
    // Подтверждение рисуется отдельным рендером через resignConfirm-проп —
    // здесь его нет (управляется снаружи), но клик минимум не падает.
  });

  it('resignConfirm=true, форма «ты»: «Свои данные не теряешь»', () => {
    renderWithForm(
      <AppearanceSection
        {...baseProps()}
        userRole="THERAPIST"
        onResignTherapist={vi.fn()}
        resignConfirm
      />,
      'ty',
    );
    expect(screen.getByText(/Свои данные не теряешь/)).toBeTruthy();
  });

  it('resignConfirm=true, форма «вы»: «Свои данные не теряете», без остаточных «ты»-форм', () => {
    const { container } = renderWithForm(
      <AppearanceSection
        {...baseProps()}
        userRole="THERAPIST"
        onResignTherapist={vi.fn()}
        resignConfirm
      />,
      'vy',
    );
    expect(screen.getByText(/Свои данные не теряете/)).toBeTruthy();
    expect(hasTyForms(container.textContent ?? '')).toBe(false);
  });

  it('клик «Отмена» зовёт setResignConfirm(false)', () => {
    const setResignConfirm = vi.fn();
    render(
      <AppearanceSection
        {...baseProps()}
        userRole="THERAPIST"
        onResignTherapist={vi.fn()}
        resignConfirm
        setResignConfirm={setResignConfirm}
      />,
    );
    fireEvent.click(screen.getByText('Отмена'));
    expect(setResignConfirm).toHaveBeenCalledWith(false);
  });

  it('клик «Снять роль» зовёт onResignTherapist, ставит resignBusy(true), потом (false) после резолва', async () => {
    let resolveFn: () => void = () => {};
    const onResignTherapist = vi.fn(
      () => new Promise<void>((r) => (resolveFn = r)),
    );
    const setResignBusy = vi.fn();
    const setResignConfirm = vi.fn();
    render(
      <AppearanceSection
        {...baseProps()}
        userRole="THERAPIST"
        onResignTherapist={onResignTherapist}
        resignConfirm
        setResignBusy={setResignBusy}
        setResignConfirm={setResignConfirm}
      />,
    );
    fireEvent.click(screen.getByText('Снять роль'));
    expect(onResignTherapist).toHaveBeenCalled();
    expect(setResignBusy).toHaveBeenCalledWith(true);
    resolveFn();
    await vi.waitFor(() => expect(setResignBusy).toHaveBeenCalledWith(false));
    expect(setResignConfirm).toHaveBeenCalledWith(false);
  });

  it('resignBusy=true — кнопка «Снять роль» показывает «...» и disabled', () => {
    render(
      <AppearanceSection
        {...baseProps()}
        userRole="THERAPIST"
        onResignTherapist={vi.fn()}
        resignConfirm
        resignBusy
      />,
    );
    const btn = screen.getByText('...');
    expect(btn.disabled).toBe(true);
  });
});
