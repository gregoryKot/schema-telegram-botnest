// @vitest-environment jsdom
// TherapistClientSection — «мой терапевт» в настройках клиента (0%
// покрытия). Регрессия ты/вы: подводка «введи его здесь» была жёсткой
// «ты»-формой без tr() — почищено в этом же PR, тест фиксирует обе формы.
// Основная логика: приватность двух переключателей шарит РАЗНЫЕ поля
// (therapistShareCards vs therapistShareProfile) — перепутать местами
// достаточно легко при копипасте блока, поэтому проверяем каждый отдельно.
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from '@testing-library/react';
import type { ReactElement } from 'react';
import { AddressFormContext, type AddressForm } from '../../utils/addressForm';
import { hasTyForms } from '../../../../shared/src/utils/tyFormsSweep';
import { TherapistClientSection } from './TherapistClientSection';
import type { UserSettings, TherapyRelationInfo } from '../../api';

vi.mock('../../api', () => ({
  api: {
    leaveTherapy: vi.fn(),
    joinTherapy: vi.fn(),
    getTherapyRelation: vi.fn(),
  },
}));
import { api } from '../../api';
const mockApi = api as unknown as {
  leaveTherapy: ReturnType<typeof vi.fn>;
  joinTherapy: ReturnType<typeof vi.fn>;
  getTherapyRelation: ReturnType<typeof vi.fn>;
};

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

function settings(overrides: Partial<UserSettings> = {}): UserSettings {
  return {
    notifyEnabled: false,
    notifyLocalHour: 20,
    notifyTimezone: 'Europe/Moscow',
    notifyReminderEnabled: false,
    pairCardDismissed: false,
    mySchemaIds: [],
    myModeIds: [],
    therapistShareCards: false,
    therapistShareProfile: false,
    ...overrides,
  };
}

function activeRelation(
  overrides: Partial<TherapyRelationInfo> = {},
): TherapyRelationInfo {
  return {
    role: 'client',
    status: 'active',
    partnerName: 'Мария Иванова',
    partnerId: 9,
    code: 'ABC',
    nextSession: null,
    ...overrides,
  };
}

function baseProps(
  overrides: Partial<Parameters<typeof TherapistClientSection>[0]> = {},
) {
  return {
    therapyRelation: null as TherapyRelationInfo | null | undefined,
    setTherapyRelation: vi.fn(),
    settings: settings(),
    patch: vi.fn().mockResolvedValue(undefined),
    therapyJoinCode: '',
    setTherapyJoinCode: vi.fn(),
    therapyJoinError: '',
    setTherapyJoinError: vi.fn(),
    onInfo: vi.fn(),
    ...overrides,
  };
}

describe('TherapistClientSection — загрузка', () => {
  it('therapyRelation=undefined — скелетон, не текст «Войти»', () => {
    render(
      <TherapistClientSection {...baseProps({ therapyRelation: undefined })} />,
    );
    expect(screen.queryByText('Войти')).toBeNull();
  });
});

describe('TherapistClientSection — терапевт подключён', () => {
  it('показывает имя терапевта, кнопку «Отключиться»', () => {
    render(
      <TherapistClientSection
        {...baseProps({ therapyRelation: activeRelation() })}
      />,
    );
    expect(screen.getByText(/Мария Иванова подключён/)).toBeTruthy();
    expect(screen.getByText('Отключиться')).toBeTruthy();
  });

  it('без имени партнёра — подпись «Терапевт подключён»', () => {
    render(
      <TherapistClientSection
        {...baseProps({
          therapyRelation: activeRelation({ partnerName: null }),
        })}
      />,
    );
    expect(screen.getByText(/Терапевт подключён/)).toBeTruthy();
  });

  it('переключатель «Карточки схем и режимов» патчит ТОЛЬКО therapistShareCards', () => {
    const patch = vi.fn().mockResolvedValue(undefined);
    render(
      <TherapistClientSection
        {...baseProps({
          therapyRelation: activeRelation(),
          settings: settings({
            therapistShareCards: false,
            therapistShareProfile: true,
          }),
          patch,
        })}
      />,
    );
    const switches = screen.getAllByRole('switch');
    fireEvent.click(switches[0]);
    expect(patch).toHaveBeenCalledWith({ therapistShareCards: true });
    expect(patch).not.toHaveBeenCalledWith(
      expect.objectContaining({ therapistShareProfile: expect.anything() }),
    );
  });

  it('переключатель «Профиль и схемы» патчит ТОЛЬКО therapistShareProfile', () => {
    const patch = vi.fn().mockResolvedValue(undefined);
    render(
      <TherapistClientSection
        {...baseProps({
          therapyRelation: activeRelation(),
          settings: settings({
            therapistShareCards: true,
            therapistShareProfile: false,
          }),
          patch,
        })}
      />,
    );
    const switches = screen.getAllByRole('switch');
    fireEvent.click(switches[1]);
    expect(patch).toHaveBeenCalledWith({ therapistShareProfile: true });
  });

  it('переключатели читают aria-checked из соответствующего поля settings', () => {
    render(
      <TherapistClientSection
        {...baseProps({
          therapyRelation: activeRelation(),
          settings: settings({
            therapistShareCards: true,
            therapistShareProfile: false,
          }),
        })}
      />,
    );
    const switches = screen.getAllByRole('switch');
    expect(switches[0].getAttribute('aria-checked')).toBe('true');
    expect(switches[1].getAttribute('aria-checked')).toBe('false');
  });

  it('клик «Отключиться» зовёт api.leaveTherapy и затем setTherapyRelation(null)', async () => {
    mockApi.leaveTherapy.mockResolvedValue(undefined);
    const setTherapyRelation = vi.fn();
    render(
      <TherapistClientSection
        {...baseProps({
          therapyRelation: activeRelation(),
          setTherapyRelation,
        })}
      />,
    );
    fireEvent.click(screen.getByText('Отключиться'));
    await waitFor(() => expect(setTherapyRelation).toHaveBeenCalledWith(null));
  });
});

describe('TherapistClientSection — нет терапевта, ввод кода (регрессия ты/вы)', () => {
  it('форма «ты»: подводка «введи его здесь»', () => {
    renderWithForm(<TherapistClientSection {...baseProps()} />, 'ty');
    expect(screen.getByText(/введи его здесь/)).toBeTruthy();
  });

  it('форма «вы»: подводка «введите его здесь», без остаточных «ты»-форм', () => {
    const { container } = renderWithForm(
      <TherapistClientSection {...baseProps()} />,
      'vy',
    );
    expect(screen.getByText(/введите его здесь/)).toBeTruthy();
    expect(hasTyForms(container.textContent ?? '')).toBe(false);
  });

  it('ввод кода приводится к верхнему регистру', () => {
    const setTherapyJoinCode = vi.fn();
    render(<TherapistClientSection {...baseProps({ setTherapyJoinCode })} />);
    fireEvent.change(screen.getByPlaceholderText('ABCDEF'), {
      target: { value: 'abcdef' },
    });
    expect(setTherapyJoinCode).toHaveBeenCalledWith('ABCDEF');
  });

  it('пустой код — клик «Войти» не зовёт api.joinTherapy', () => {
    render(<TherapistClientSection {...baseProps({ therapyJoinCode: '' })} />);
    fireEvent.click(screen.getByText('Войти'));
    expect(mockApi.joinTherapy).not.toHaveBeenCalled();
  });

  it('успешный код: joinTherapy → getTherapyRelation → setTherapyRelation, поле очищается', async () => {
    mockApi.joinTherapy.mockResolvedValue(undefined);
    mockApi.getTherapyRelation.mockResolvedValue(activeRelation());
    const setTherapyRelation = vi.fn();
    const setTherapyJoinCode = vi.fn();
    render(
      <TherapistClientSection
        {...baseProps({
          therapyJoinCode: 'ABCDEF',
          setTherapyRelation,
          setTherapyJoinCode,
        })}
      />,
    );
    fireEvent.click(screen.getByText('Войти'));
    await waitFor(() =>
      expect(setTherapyRelation).toHaveBeenCalledWith(activeRelation()),
    );
    expect(mockApi.joinTherapy).toHaveBeenCalledWith('ABCDEF');
    expect(setTherapyJoinCode).toHaveBeenCalledWith('');
  });

  it('неверный код: joinTherapy падает — показывает «Неверный код», не трогает relation', async () => {
    mockApi.joinTherapy.mockRejectedValue(new Error('bad code'));
    const setTherapyJoinError = vi.fn();
    const setTherapyRelation = vi.fn();
    render(
      <TherapistClientSection
        {...baseProps({
          therapyJoinCode: 'BADCODE',
          setTherapyJoinError,
          setTherapyRelation,
        })}
      />,
    );
    fireEvent.click(screen.getByText('Войти'));
    await waitFor(() =>
      expect(setTherapyJoinError).toHaveBeenCalledWith('Неверный код'),
    );
    expect(setTherapyRelation).not.toHaveBeenCalled();
  });

  it('therapyJoinError задан — текст ошибки виден под полем', () => {
    render(
      <TherapistClientSection
        {...baseProps({ therapyJoinError: 'Неверный код' })}
      />,
    );
    expect(screen.getByText('Неверный код')).toBeTruthy();
  });
});

describe('TherapistClientSection — пояснение', () => {
  it('клик по «?» зовёт onInfo', () => {
    const onInfo = vi.fn();
    render(<TherapistClientSection {...baseProps({ onInfo })} />);
    fireEvent.click(screen.getByLabelText('Пояснение'));
    expect(onInfo).toHaveBeenCalled();
  });
});
