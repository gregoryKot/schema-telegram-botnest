// @vitest-environment jsdom
// Карточка по сигналу на главной: показ по каждому сигналу, «Не сейчас», терапевт ничего не видит.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { DayHistory, ModeDiaryEntry } from '../../../../shared/src/types';
import { TherapyNudgeCard } from './TherapyNudgeCard';

const history = vi.hoisted(() => vi.fn());
vi.mock('../../api', () => ({ api: { history } }));
const track = vi.hoisted(() => vi.fn());
vi.mock('./trackTherapyNudge', () => ({ trackTherapyNudge: track }));

const NEEDS = ['attachment', 'autonomy', 'expression', 'play', 'limits'];
function days(values: number[]): DayHistory[] {
  return values.map((v, i) => ({
    date: `2026-10-${String(26 - i).padStart(2, '0')}`,
    ratings: Object.fromEntries(NEEDS.map((n) => [n, v])),
  }));
}
const CALM = days([7, 7, 7, 7, 7]);
const LOW = days([3, 3, 3, 7, 7]);
const modes = (n: number): ModeDiaryEntry[] =>
  Array.from({ length: n }, (_, i) => ({
    id: i, modeId: 'punitive_critic', situation: 'x',
    createdAt: new Date(Date.now() - (i + 1) * 86400000).toISOString(),
  }));

const renderCard = (entries: ModeDiaryEntry[] = []) =>
  render(<MemoryRouter><TherapyNudgeCard refreshKey={0} modeEntries={entries} /></MemoryRouter>);

beforeEach(() => { localStorage.clear(); track.mockClear(); history.mockReset(); });
afterEach(cleanup);

describe('TherapyNudgeCard', () => {
  it('низкий индекс три дня: карточка с подписью и событием shown с trigger', async () => {
    history.mockResolvedValue(LOW);
    renderCard();
    expect(await screen.findByText('Три последних заполненных дня: индекс не выше 4')).toBeTruthy();
    expect(screen.getByText('Самопомощь помогает держаться. Нести это в одиночку не обязательно.')).toBeTruthy();
    // Владелец 2026-11-08: под заголовком без «автора приложения» — только кнопка.
    expect(document.body.textContent).not.toMatch(/[Аа]втор/);
    expect(screen.getByRole('button', { name: 'Поговорить с кем-то' })).toBeTruthy();
    // Событие уходит из useEffect после коммита — ждём, а не читаем мок сразу.
    await waitFor(() => expect(track).toHaveBeenCalledWith('signal_card', 'shown', 'low_index'));
  });

  it('повторяющийся режим', async () => {
    history.mockResolvedValue(CALM);
    renderCard(modes(3));
    expect(await screen.findByText(/3 раза за две недели/)).toBeTruthy();
    // Событие уходит из useEffect после коммита — ждём, а не читаем мок сразу.
    await waitFor(() => expect(track).toHaveBeenCalledWith('signal_card', 'shown', 'repeat_mode'));
  });

  it('кризисный след', async () => {
    history.mockResolvedValue(CALM);
    localStorage.setItem('therapy_crisis_seen_at', new Date().toISOString());
    renderCard();
    expect(await screen.findByText('После тяжёлого дня')).toBeTruthy();
    // Событие уходит из useEffect после коммита — ждём, а не читаем мок сразу.
    await waitFor(() => expect(track).toHaveBeenCalledWith('signal_card', 'shown', 'crisis'));
  });

  it('спокойные дни и новичок: спокойная карточка моста со «Скрыть», без «Не сейчас»', async () => {
    history.mockResolvedValue(CALM);
    renderCard();
    await waitFor(() => expect(history).toHaveBeenCalled());
    expect(await screen.findByText(/Разобраться глубже — на встречах с терапевтом/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Не сейчас' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Скрыть' })).toBeTruthy();
    await waitFor(() => expect(track).toHaveBeenCalledWith('home_card', 'shown'));
    cleanup();
    history.mockResolvedValue(LOW.slice(0, 3));
    renderCard();
    expect(await screen.findByText(/Разобраться глубже — на встречах с терапевтом/)).toBeTruthy();
  });

  it('пока история грузится — скелетон, спокойная карточка не мигает и показ не считается', async () => {
    let resolve!: (h: DayHistory[]) => void;
    history.mockReturnValue(new Promise<DayHistory[]>((r) => { resolve = r; }));
    const { container } = renderCard();
    expect(container.querySelector('[aria-hidden]')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Скрыть' })).toBeNull(); // в силуэте текст невидим, кнопок нет
    expect(track).not.toHaveBeenCalled();
    resolve(CALM);
    expect(await screen.findByRole('button', { name: 'Скрыть' })).toBeTruthy();
    await waitFor(() => expect(track).toHaveBeenCalledWith('home_card', 'shown'));
    expect(track).toHaveBeenCalledTimes(1);
  });

  it('сбой сети — тихо, спокойная карточка', async () => {
    history.mockRejectedValue(new Error('offline'));
    renderCard();
    expect(await screen.findByText(/Разобраться глубже/)).toBeTruthy();
  });

  it('«Не сейчас» прячет карточку, пишет событие и запоминает на 14 дней', async () => {
    history.mockResolvedValue(LOW);
    renderCard();
    // «shown» уходит из эффекта после коммита: без ожидания под нагрузкой CI он
    // приходил ПОСЛЕ клика и затирал «последний вызов» (флейк на PR #880).
    await waitFor(() => expect(track).toHaveBeenCalledWith('signal_card', 'shown', 'low_index'));
    fireEvent.click(await screen.findByRole('button', { name: 'Не сейчас' }));
    expect(track).toHaveBeenCalledWith('signal_card', 'dismiss', 'low_index');
    expect(screen.queryByText('Три последних заполненных дня: индекс не выше 4')).toBeNull();
    const until = Date.parse(localStorage.getItem('therapy_nudge_dismissed_until') ?? '');
    expect(until - Date.now()).toBeGreaterThan(13 * 86400000);
    cleanup();
    renderCard();
    await waitFor(() => expect(history).toHaveBeenCalledTimes(2));
    expect(screen.queryByText('Три последних заполненных дня: индекс не выше 4')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Не сейчас' })).toBeNull();
  });

  it('«Поговорить с кем-то» открывает лист с trigger', async () => {
    history.mockResolvedValue(LOW);
    renderCard();
    await screen.findByText('Три последних заполненных дня: индекс не выше 4');
    fireEvent.click(screen.getByRole('button', { name: 'Поговорить с кем-то' }));
    expect(track).toHaveBeenCalledWith('signal_card', 'open', 'low_index');
    expect(screen.getByRole('dialog')).toBeTruthy();
    fireEvent.click(screen.getByRole('link', { name: 'Выбрать время на сайте' }));
    expect(track).toHaveBeenLastCalledWith('signal_card', 'book', 'low_index');
  });

  // Владелец 2026-11-08: карточка вверху «Ещё» видна всегда — её можно скрыть, вход остаётся строкой в списке.
  it('«Скрыть» убирает спокойную карточку насовсем, а карточку по сигналу — нет', async () => {
    history.mockResolvedValue(CALM);
    renderCard();
    await waitFor(() => expect(track).toHaveBeenCalledWith('home_card', 'shown'));
    fireEvent.click(screen.getByRole('button', { name: 'Скрыть' }));
    expect(track).toHaveBeenLastCalledWith('home_card', 'dismiss');
    expect(screen.queryByText(/Разобраться глубже/)).toBeNull();
    cleanup();
    track.mockClear();
    const { container } = renderCard();
    await waitFor(() => expect(history).toHaveBeenCalledTimes(2));
    expect(container.textContent).toBe('');
    expect(track).not.toHaveBeenCalled();
    cleanup();
    history.mockResolvedValue(LOW);
    renderCard();
    expect(await screen.findByText('Три последних заполненных дня: индекс не выше 4')).toBeTruthy();
  });

  it('карточка скрыта: пока история грузится, скелетона нет', () => {
    localStorage.setItem('therapy_bridge_card_hidden', '1');
    history.mockReturnValue(new Promise<DayHistory[]>(() => {}));
    const { container } = renderCard();
    expect(container.innerHTML).toBe('');
  });

  it('терапевт подключён: «Написать терапевту» и подпись про повод написать', async () => {
    localStorage.setItem('therapy_contact_url', 'tg://user?id=42');
    localStorage.setItem('therapy_contact_name', 'терапевту');
    history.mockResolvedValue(LOW);
    renderCard();
    expect(await screen.findByText('Терапевт рядом — это как раз повод написать.')).toBeTruthy();
    const link = screen.getByRole('link', { name: 'Написать терапевту' });
    expect(link.getAttribute('href')).toBe('tg://user?id=42');
    fireEvent.click(link);
    expect(track).toHaveBeenLastCalledWith('signal_card', 'write', 'low_index');
  });

  it('силуэт загрузки у клиента с терапевтом несёт строку-подпись: высота та же, что у карточки', () => {
    localStorage.setItem('therapy_contact_url', 'tg://user?id=42');
    localStorage.setItem('therapy_contact_name', 'терапевту');
    history.mockReturnValue(new Promise<DayHistory[]>(() => {}));
    renderCard();
    const skel = screen.getByTestId('therapy-card-skeleton');
    expect(skel.querySelector('.th-card-sub')?.textContent).toMatch(/повод написать/);
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('пользователь-терапевт ничего не видит и история не запрашивается', async () => {
    localStorage.setItem('therapy_contact_url', 'tg://user?id=1');
    localStorage.setItem('therapy_contact_name', 'вам');
    localStorage.setItem('therapy_is_therapist', '1');
    history.mockResolvedValue(LOW);
    const { container } = renderCard(modes(4));
    await Promise.resolve();
    expect(container.textContent).toBe('');
    expect(history).not.toHaveBeenCalled();
    expect(track).not.toHaveBeenCalled();
  });
});
