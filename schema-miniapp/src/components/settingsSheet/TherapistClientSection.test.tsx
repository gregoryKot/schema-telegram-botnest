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
    getFormerTherapist: vi.fn(() => Promise.resolve(null)),
  },
}));
import { api } from '../../api';
const mockApi = api as unknown as {
  leaveTherapy: ReturnType<typeof vi.fn>;
  joinTherapy: ReturnType<typeof vi.fn>;
  getTherapyRelation: ReturnType<typeof vi.fn>;
  getFormerTherapist: ReturnType<typeof vi.fn>;
};

afterEach(() => {
  cleanup();
  mockApi.getFormerTherapist.mockReset();
  mockApi.getFormerTherapist.mockResolvedValue(null);
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
    onInfo: vi.fn(),
    ...overrides,
  };
}

describe('TherapistClientSection — загрузка', () => {
  it('therapyRelation=undefined — скелетон, не кнопка «Подключиться»', () => {
    render(
      <TherapistClientSection {...baseProps({ therapyRelation: undefined })} />,
    );
    expect(screen.queryByText('Подключиться')).toBeNull();
  });
});

describe('TherapistClientSection — терапевт подключён', () => {
  // Инцидент 2026-10-26: «Мария Иванова подключён» — мужской род при любом имени.
  it('показывает имя терапевта без рода, кнопку «Отключиться от терапевта»', () => {
    render(
      <TherapistClientSection
        {...baseProps({ therapyRelation: activeRelation() })}
      />,
    );
    expect(screen.getByText('Терапевт: Мария Иванова')).toBeTruthy();
    expect(screen.queryByText(/подключён/)).toBeNull();
    expect(screen.getByText('Отключиться от терапевта')).toBeTruthy();
  });

  it('без имени партнёра — нейтральная подпись, имя не выдумывается', () => {
    render(
      <TherapistClientSection
        {...baseProps({
          therapyRelation: activeRelation({ partnerName: null }),
        })}
      />,
    );
    expect(screen.getByText('Подключение к терапевту активно')).toBeTruthy();
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

  // Инцидент 2026-10-26: связь удалялась одним тапом, без вопроса.
  it('«Отключиться от терапевта» сначала спрашивает; подтверждение — leaveTherapy и setTherapyRelation(null)', async () => {
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
    fireEvent.click(screen.getByText('Отключиться от терапевта'));
    expect(mockApi.leaveTherapy).not.toHaveBeenCalled();
    expect(screen.getByText('Отключиться от терапевта?')).toBeTruthy();
    fireEvent.click(screen.getByText('Отключиться'));
    await waitFor(() => expect(setTherapyRelation).toHaveBeenCalledWith(null));
    expect(mockApi.leaveTherapy).toHaveBeenCalledTimes(1);
  });

  it('«Остаться» — связь не трогаем; отказ сервера виден в подтверждении (форма «вы»)', async () => {
    mockApi.leaveTherapy.mockRejectedValue(new Error('net'));
    const setTherapyRelation = vi.fn();
    renderWithForm(
      <TherapistClientSection
        {...baseProps({
          therapyRelation: activeRelation(),
          setTherapyRelation,
        })}
      />,
      'vy',
    );
    fireEvent.click(screen.getByText('Отключиться от терапевта'));
    fireEvent.click(screen.getByText('Остаться'));
    expect(mockApi.leaveTherapy).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Отключиться от терапевта'));
    expect(screen.getByText(/ваш трекер/)).toBeTruthy();
    fireEvent.click(screen.getByText('Отключиться'));
    expect((await screen.findByRole('alert')).textContent).toMatch(
      /Проверьте связь/,
    );
    expect(setTherapyRelation).not.toHaveBeenCalled();
  });
});

describe('TherapistClientSection — нет терапевта, ввод кода (регрессия ты/вы)', () => {
  it('форма «ты»: подводка «вставь сюда»', () => {
    renderWithForm(<TherapistClientSection {...baseProps()} />, 'ty');
    expect(screen.getByText(/вставь сюда/)).toBeTruthy();
  });

  it('форма «вы»: подводка «вставьте сюда», без остаточных «ты»-форм', () => {
    const { container } = renderWithForm(
      <TherapistClientSection {...baseProps()} />,
      'vy',
    );
    expect(screen.getByText(/вставьте сюда/)).toBeTruthy();
    expect(hasTyForms(container.textContent ?? '')).toBe(false);
  });

  // Инцидент 2026-10-26: maxLength={8} при коде из 12 — вставка обрезалась.
  it('код из 12 знаков строчными с пробелами и ссылка целиком — в поле код целиком', () => {
    render(<TherapistClientSection {...baseProps()} />);
    const input = screen.getByLabelText<HTMLInputElement>('Код от терапевта');
    expect(input.placeholder).toHaveLength(12);
    fireEvent.change(input, { target: { value: ' 7f3a9c21b04e ' } });
    expect(input.value).toBe('7F3A9C21B04E');
    fireEvent.change(input, {
      target: { value: 'https://t.me/b/diary?startapp=therapy_7f3a9c21b04e' },
    });
    expect(input.value).toBe('7F3A9C21B04E');
  });

  it('пустой код — клик «Подключиться» не зовёт api.joinTherapy', () => {
    render(<TherapistClientSection {...baseProps()} />);
    fireEvent.click(screen.getByText('Подключиться'));
    expect(mockApi.joinTherapy).not.toHaveBeenCalled();
  });

  it('успешный код: joinTherapy → getTherapyRelation → setTherapyRelation, поле очищается', async () => {
    mockApi.joinTherapy.mockResolvedValue(undefined);
    mockApi.getTherapyRelation.mockResolvedValue(activeRelation());
    const setTherapyRelation = vi.fn();
    render(<TherapistClientSection {...baseProps({ setTherapyRelation })} />);
    const input = screen.getByLabelText<HTMLInputElement>('Код от терапевта');
    fireEvent.change(input, { target: { value: '7F3A9C21B04E' } });
    fireEvent.click(screen.getByText('Подключиться'));
    await waitFor(() =>
      expect(setTherapyRelation).toHaveBeenCalledWith(activeRelation()),
    );
    expect(mockApi.joinTherapy).toHaveBeenCalledWith('7F3A9C21B04E');
    expect(input.value).toBe('');
  });

  it('неверный код: «Код не подошёл» под полем, relation не трогается', async () => {
    mockApi.joinTherapy.mockRejectedValue(new Error('bad code'));
    const setTherapyRelation = vi.fn();
    render(<TherapistClientSection {...baseProps({ setTherapyRelation })} />);
    fireEvent.change(screen.getByLabelText('Код от терапевта'), {
      target: { value: 'BADC0DE' },
    });
    fireEvent.click(screen.getByText('Подключиться'));
    expect(await screen.findByText(/Код не подошёл/)).toBeTruthy();
    expect(setTherapyRelation).not.toHaveBeenCalled();
  });

  // Раньше мини-апп на 409 писал «Неверный код» (сайт — свой текст).
  it('409 already_connected — текст про действующее подключение, как на сайте', async () => {
    mockApi.joinTherapy.mockRejectedValue({
      status: 409,
      reason: 'already_connected',
    });
    render(<TherapistClientSection {...baseProps()} />);
    fireEvent.change(screen.getByLabelText('Код от терапевта'), {
      target: { value: '7F3A9C21B04E' },
    });
    fireEvent.click(screen.getByText('Подключиться'));
    expect(
      await screen.findByText(/уже есть подключение к терапевту/),
    ).toBeTruthy();
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

// Решение владельца 2026-10-22: терапевт отказался от роли — над формой кода
// сообщение о нём (GET /api/therapy/former-therapist), а не пустота.
describe('TherapistClientSection — бывший терапевт', () => {
  const FORMER = { name: 'Мария', endedAt: '2026-10-22T10:00:00.000Z' };

  it('связи нет, сервер отдал бывшего — сообщение с именем над формой кода', async () => {
    mockApi.getFormerTherapist.mockResolvedValue(FORMER);
    renderWithForm(<TherapistClientSection {...baseProps()} />, 'vy');
    expect(
      await screen.findByText(
        'Мария больше не работает в приложении как терапевт',
      ),
    ).toBeTruthy();
    expect(screen.getByRole('note').textContent).toContain('остаётся у вас');
    expect(screen.getByText('Подключиться')).toBeTruthy();
  });

  it('сервер отдал null — сообщения нет, форма кода на месте', async () => {
    render(<TherapistClientSection {...baseProps()} />);
    await waitFor(() =>
      expect(mockApi.getFormerTherapist).toHaveBeenCalledTimes(1),
    );
    expect(screen.queryByRole('note')).toBeNull();
    expect(screen.getByText('Подключиться')).toBeTruthy();
  });

  it('терапевт подключён — бывшего не спрашиваем и не показываем', () => {
    mockApi.getFormerTherapist.mockResolvedValue(FORMER);
    render(
      <TherapistClientSection
        {...baseProps({ therapyRelation: activeRelation() })}
      />,
    );
    expect(mockApi.getFormerTherapist).not.toHaveBeenCalled();
    expect(screen.queryByRole('note')).toBeNull();
  });

  it('связь ещё грузится — бывшего не спрашиваем', () => {
    render(
      <TherapistClientSection {...baseProps({ therapyRelation: undefined })} />,
    );
    expect(mockApi.getFormerTherapist).not.toHaveBeenCalled();
  });
});
