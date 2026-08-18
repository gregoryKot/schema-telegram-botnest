// @vitest-environment jsdom
// «Безопасное место» — свободный текст (общее впечатление + 4 органа чувств),
// но до этого теста компонент НЕ прогонял ввод через detectCrisisAny/CrisisCard
// (правило №7 CLAUDE.md) — миниапп (SafePlace.tsx, CrisisGate) это уже делал,
// вебапп отстал (правило №3 — парные файлы). Тест фиксирует починку и
// закрывает регресс. Заодно read-after-write: заполнил → сохранил → карточка
// с сохранёнными данными видна на экране «готово».
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AddressFormContext } from '../../utils/addressForm';
import { SafePlaceEx } from './SafePlaceEx';
import { CRISIS_HOTLINE_DISPLAY } from '../../utils/crisisMarkers';

vi.mock('../../api', () => ({
  api: {
    saveSafePlace: vi.fn(),
    trackEvent: vi.fn(),
  },
}));
import { api } from '../../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

function renderEx(form: 'ty' | 'vy' = 'ty') {
  return render(
    <AddressFormContext.Provider value={{ form, setForm: vi.fn() }}>
      <MemoryRouter>
        <SafePlaceEx onBack={vi.fn()} />
      </MemoryRouter>
    </AddressFormContext.Provider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockApi.saveSafePlace.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
});

describe('SafePlaceEx — кризисная детекция', () => {
  it('кризисная фраза в общем описании места показывает CrisisCard', () => {
    renderEx();
    const overview = screen.getByPlaceholderText(/полянка в лесу/);
    fireEvent.change(overview, { target: { value: 'не хочу жить, хочу исчезнуть' } });
    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.getByText(CRISIS_HOTLINE_DISPLAY)).toBeTruthy();
  });

  it('кризисная фраза в одном из органов чувств тоже показывает CrisisCard', () => {
    renderEx();
    const hear = screen.getByPlaceholderText(/шорох листьев/);
    fireEvent.change(hear, { target: { value: 'слышу тишину, хочу исчезнуть' } });
    expect(screen.getByRole('status')).toBeTruthy();
  });

  it('нейтральный текст не показывает CrisisCard', () => {
    renderEx();
    const overview = screen.getByPlaceholderText(/полянка в лесу/);
    fireEvent.change(overview, { target: { value: 'дача у бабушки, веранда' } });
    expect(screen.queryByRole('status')).toBeNull();
  });
});

describe('SafePlaceEx — сохранение и обращение ты/вы', () => {
  it('кнопка сохранить выключена, пока не заполнено общее описание и хотя бы одно чувство', () => {
    renderEx();
    const save = screen.getByRole('button', { name: /Сохранить место/ }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
  });

  it('заполнил → сохранил → на экране «готово» видно то, что ввели (read-after-write)', async () => {
    renderEx();
    fireEvent.change(screen.getByPlaceholderText(/полянка в лесу/), { target: { value: 'дача у бабушки' } });
    fireEvent.change(screen.getByPlaceholderText(/шорох листьев/), { target: { value: 'скрип половиц' } });
    const save = screen.getByRole('button', { name: /Сохранить место/ }) as HTMLButtonElement;
    expect(save.disabled).toBe(false);
    fireEvent.click(save);
    expect(await screen.findByText('«дача у бабушки»')).toBeTruthy();
    expect(screen.getByText('скрип половиц')).toBeTruthy();
    expect(mockApi.saveSafePlace).toHaveBeenCalledWith(expect.stringContaining('дача у бабушки'));
  });

  it('форма «ты» — заголовок обращается на «ты»', async () => {
    renderEx('ty');
    fireEvent.change(screen.getByPlaceholderText(/полянка в лесу/), { target: { value: 'лес' } });
    fireEvent.change(screen.getByPlaceholderText(/шорох листьев/), { target: { value: 'тишина' } });
    fireEvent.click(screen.getByRole('button', { name: /Сохранить место/ }));
    expect(await screen.findByText('Твоё')).toBeTruthy();
  });

  it('форма «вы» — заголовок обращается на «вы»', async () => {
    renderEx('vy');
    fireEvent.change(screen.getByPlaceholderText(/полянка в лесу/), { target: { value: 'лес' } });
    fireEvent.change(screen.getByPlaceholderText(/шорох листьев/), { target: { value: 'тишина' } });
    fireEvent.click(screen.getByRole('button', { name: /Сохранить место/ }));
    expect(await screen.findByText('Ваше')).toBeTruthy();
  });
});
