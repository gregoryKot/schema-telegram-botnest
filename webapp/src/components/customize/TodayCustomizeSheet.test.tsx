// @vitest-environment jsdom
// Лист «Настроить экран» для «Сегодня» на сайте: связка действие → localStorage
// (те же ключи, что у мини-аппа) → экран, события аналитики с теми же именами,
// перестановка с клавиатуры, подсветка строки при открытии долгим нажатием.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TodayCustomizeSheet } from './TodayCustomizeSheet';
import { useTodayCustomization } from '../../sections/today/useTodayCustomization';

const isMobile = vi.hoisted(() => ({ value: true }));
vi.mock('../useIsMobile', () => ({ useIsMobile: () => isMobile.value }));
vi.mock('../../api', () => ({ api: { trackEvent: vi.fn() } }));
import { api } from '../../api';
const track = api.trackEvent as unknown as ReturnType<typeof vi.fn>;

function Host({ therapist = false, onSettings = vi.fn() }) {
  const today = useTodayCustomization();
  return (
    <>
      <button onClick={today.openByGear}>gear</button>
      <button onClick={() => today.openByHold('phrase')}>hold</button>
      <output data-testid="order">{today.orderedIds.join(',')}</output>
      {today.sheet && <TodayCustomizeSheet today={today} showTherapistBlock={therapist} onOpenSettings={onSettings} />}
    </>
  );
}

function setup(props: Parameters<typeof Host>[0] = {}, opener = 'gear') {
  render(<MemoryRouter><Host {...props} /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: opener }));
}

beforeEach(() => { localStorage.clear(); track.mockClear(); isMobile.value = true; });
afterEach(cleanup);

describe('TodayCustomizeSheet', () => {
  it('открытие шестерёнкой шлёт today_customize_open и ничего не подсвечивает', () => {
    setup();
    expect(track).toHaveBeenCalledWith('today_customize_open', { via: 'gear' });
    expect(document.querySelector('.is-hl')).toBeNull();
  });

  it('открытие долгим нажатием подсвечивает строку блока', () => {
    setup({}, 'hold');
    expect(track).toHaveBeenCalledWith('today_customize_open', { via: 'longpress' });
    expect(document.querySelectorAll('.cz-block.is-hl')).toHaveLength(1);
    expect(document.querySelector('.cz-block.is-hl')?.textContent).toContain('Фраза для себя');
  });

  it('выбор практики сохраняется под ключом мини-аппа и шлёт today_focus_change', () => {
    setup();
    fireEvent.click(screen.getByRole('radio', { name: /Дневник режимов/ }));
    expect(localStorage.getItem('today_focus_practice')).toBe('mode');
    expect(screen.getByRole('radio', { name: /Дневник режимов/ }).getAttribute('aria-checked')).toBe('true');
    expect(track).toHaveBeenCalledWith('today_focus_change', { practice: 'mode' });
  });

  it.each([
    ['Карточка серии', 'today_streak_hidden', '1', 'streak'],
    ['Фраза для себя', 'today_phrase_hidden', '1', 'phrase'],
  ])('тумблер «%s» пишет ключ %s и шлёт today_block_toggle', (name, key, value, block) => {
    setup();
    const sw = screen.getByRole('switch', { name });
    expect(sw.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(sw);
    expect(localStorage.getItem(key)).toBe(value);
    expect(screen.getByRole('switch', { name }).getAttribute('aria-checked')).toBe('false');
    expect(track).toHaveBeenCalledWith('today_block_toggle', { block, hidden: true });
  });

  it('тап по тексту строки тоже переключает (вся строка — label тумблера)', () => {
    setup();
    fireEvent.click(screen.getByText('цитата Здорового Взрослого на главном'));
    expect(localStorage.getItem('today_phrase_hidden')).toBe('1');
  });

  it('«Что ещё можно сегодня» по умолчанию свёрнуто (включено) и выключается в ключ «0»', () => {
    setup();
    const sw = screen.getByRole('switch', { name: '«Что ещё можно сегодня»' });
    expect(sw.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(sw);
    expect(localStorage.getItem('today_secondary_hidden')).toBe('0');
  });

  it('у «Фокуса дня» тумблера нет — он только переставляется', () => {
    setup();
    expect(screen.queryByRole('switch', { name: 'Фокус дня' })).toBeNull();
    expect(screen.getByText('Фокус дня')).toBeTruthy();
  });

  it('строка баннера кабинета только у специалиста', () => {
    setup();
    expect(screen.queryByRole('switch', { name: 'Кабинет терапевта' })).toBeNull();
    cleanup();
    setup({ therapist: true });
    fireEvent.click(screen.getByRole('switch', { name: 'Кабинет терапевта' }));
    expect(localStorage.getItem('today_therapist_banner_hidden')).toBe('1');
  });

  it('ручка «≡» на клавиатуре переставляет блок и пишет порядок в ключ мини-аппа', () => {
    setup();
    const handle = screen.getByRole('button', { name: 'Переставить: Фраза для себя' });
    fireEvent.keyDown(handle, { key: 'ArrowUp' });
    expect(JSON.parse(localStorage.getItem('screen_order_today') ?? '[]').indexOf('phrase')).toBe(1);
    expect(screen.getByTestId('order').textContent).toBe('streak,phrase,focus,secondary,therapist_banner');
    expect(track).toHaveBeenCalledWith('screen_block_move', { screen: 'today', block: 'phrase', dir: 'up' });
  });

  it('на десктопе ручек нет, подсказка объясняет почему', () => {
    isMobile.value = false;
    setup();
    expect(screen.queryByRole('button', { name: /Переставить/ })).toBeNull();
    expect(screen.getByText(/меняется на телефоне/)).toBeTruthy();
  });

  it('«Общие настройки приложения» зовёт onOpenSettings', () => {
    const onSettings = vi.fn();
    setup({ onSettings });
    fireEvent.click(screen.getByRole('button', { name: /Общие настройки приложения/ }));
    expect(onSettings).toHaveBeenCalledTimes(1);
  });

  it('«Готово» закрывает лист через историю (кнопка «Назад» браузера тоже)', async () => {
    setup();
    fireEvent.click(await screen.findByRole('button', { name: 'Готово' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});
