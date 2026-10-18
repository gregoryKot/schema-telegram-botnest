// @vitest-environment jsdom
// Лист «+» на сайте: группы из общего реестра, уважает настройку видимости
// (те же ключи localStorage, что у мини-аппа), тап по строке шлёт событие,
// закрывает лист и зовёт onAction.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PlusMenuSheet } from './PlusMenuSheet';
import { PLUS_ACTIONS_HIDDEN_KEY } from '../../../../shared/src/quickActions/quickActionPrefs';
import { PLUS_ACTIONS_ORDER_KEY } from '../../../../shared/src/quickActions/quickActionOrder';

vi.mock('../../api', () => ({ api: { trackEvent: vi.fn() } }));
import { api } from '../../api';
const trackEvent = api.trackEvent as unknown as ReturnType<typeof vi.fn>;

function renderSheet() {
  const onAction = vi.fn();
  const onClose = vi.fn();
  render(
    <MemoryRouter>
      <PlusMenuSheet onAction={onAction} onClose={onClose} />
    </MemoryRouter>,
  );
  return { onAction, onClose };
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

describe('PlusMenuSheet (сайт)', () => {
  it('рисует четыре группы реестра и восемь действий', () => {
    renderSheet();
    for (const title of ['Разобраться', 'Записать момент', 'Оценить день', 'Успокоиться']) {
      expect(screen.getByText(title)).toBeTruthy();
    }
    expect(screen.getAllByRole('button').filter((b) => b.className === 'qa-row')).toHaveLength(8);
  });

  it('тап по строке: событие plus_action, закрытие, onAction с id', () => {
    const { onAction, onClose } = renderSheet();
    fireEvent.click(screen.getByRole('button', { name: /Дыхание 4-4-6/ }));
    expect(trackEvent).toHaveBeenCalledWith('plus_action', { action: 'breathing' });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onAction).toHaveBeenCalledWith('breathing');
  });

  it('скрытые в настройке пункты не показываются, пустая группа уходит', () => {
    localStorage.setItem(PLUS_ACTIONS_HIDDEN_KEY, '["tracker","case"]');
    renderSheet();
    expect(screen.queryByText(/Трекер потребностей/)).toBeNull();
    expect(screen.queryByText('Оценить день')).toBeNull();
    expect(screen.queryByText('Разобраться')).toBeNull();
  });

  it('все скрыты — подсказка, как вернуть', () => {
    localStorage.setItem(
      PLUS_ACTIONS_HIDDEN_KEY,
      JSON.stringify(['case', 'diary_schema', 'diary_mode', 'diary_gratitude', 'tracker', 'breathing', 'grounding', 'stop']),
    );
    renderSheet();
    expect(screen.getByText(/Все пункты скрыты/)).toBeTruthy();
  });

  it('порядок из настройки мини-аппа соблюдается', () => {
    localStorage.setItem(PLUS_ACTIONS_ORDER_KEY, '["stop"]');
    renderSheet();
    const labels = screen.getAllByRole('button').filter((b) => b.className === 'qa-row').map((b) => b.textContent ?? '');
    const calm = labels.filter((l) => /Стоп|Дыхание|Заземление/.test(l));
    expect(calm[0]).toMatch(/Стоп/);
  });
});

describe('PlusMenuSheet — настройка видимости', () => {
  it('«Изменить» открывает лист; тумблер скрывает пункт, сохраняет и шлёт событие', () => {
    renderSheet();
    fireEvent.click(screen.getByRole('button', { name: 'Настроить быстрые действия' }));
    const sw = screen.getByRole('switch', { name: 'Техника «Стоп»' });
    expect(sw.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(sw);
    expect(trackEvent).toHaveBeenCalledWith('quick_action_toggle', { action: 'stop', hidden: true, surface: 'plus' });
    expect(localStorage.getItem(PLUS_ACTIONS_HIDDEN_KEY)).toBe('["stop"]');
    expect(screen.getByRole('switch', { name: 'Техника «Стоп»' }).getAttribute('aria-checked')).toBe('false');
    // основной лист уже без пункта (сохранение → отображение)
    expect(screen.queryAllByRole('button', { name: /Техника «Стоп»/ })).toHaveLength(0);
  });

  it('скрытый пункт можно вернуть тем же тумблером', () => {
    localStorage.setItem(PLUS_ACTIONS_HIDDEN_KEY, '["stop"]');
    renderSheet();
    fireEvent.click(screen.getByRole('button', { name: 'Настроить быстрые действия' }));
    fireEvent.click(screen.getByRole('switch', { name: 'Техника «Стоп»' }));
    expect(trackEvent).toHaveBeenCalledWith('quick_action_toggle', { action: 'stop', hidden: false, surface: 'plus' });
    expect(localStorage.getItem(PLUS_ACTIONS_HIDDEN_KEY)).toBeNull();
  });
});
