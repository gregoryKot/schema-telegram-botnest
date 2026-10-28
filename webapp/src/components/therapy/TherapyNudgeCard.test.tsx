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
    expect(screen.getByText('Автор приложения работает в подходе схема-терапия и ведёт встречи онлайн.')).toBeTruthy();
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

  it('спокойные дни и новичок: карточки нет', async () => {
    history.mockResolvedValue(CALM);
    const { container } = renderCard();
    await waitFor(() => expect(history).toHaveBeenCalled());
    expect(container.textContent).toBe('');
    cleanup();
    history.mockResolvedValue(LOW.slice(0, 3));
    const second = renderCard();
    await waitFor(() => expect(history).toHaveBeenCalledTimes(2));
    expect(second.container.textContent).toBe('');
  });

  it('сбой сети — тихо, без карточки', async () => {
    history.mockRejectedValue(new Error('offline'));
    const { container } = renderCard();
    await waitFor(() => expect(history).toHaveBeenCalled());
    expect(container.textContent).toBe('');
  });

  it('«Не сейчас» прячет карточку, пишет событие и запоминает на 14 дней', async () => {
    history.mockResolvedValue(LOW);
    renderCard();
    // «shown» уходит из эффекта после коммита: без ожидания под нагрузкой CI он
    // приходил ПОСЛЕ клика и затирал «последний вызов» (флейк на PR #880).
    await waitFor(() => expect(track).toHaveBeenCalledWith('signal_card', 'shown', 'low_index'));
    fireEvent.click(await screen.findByRole('button', { name: 'Не сейчас' }));
    expect(track).toHaveBeenLastCalledWith('signal_card', 'dismiss', 'low_index');
    expect(screen.queryByText('Три последних заполненных дня: индекс не выше 4')).toBeNull();
    const until = Date.parse(localStorage.getItem('therapy_nudge_dismissed_until') ?? '');
    expect(until - Date.now()).toBeGreaterThan(13 * 86400000);
    cleanup();
    const again = renderCard();
    await waitFor(() => expect(history).toHaveBeenCalledTimes(2));
    expect(again.container.textContent).toBe('');
  });

  it('«Поговорить с кем-то» открывает лист с trigger', async () => {
    history.mockResolvedValue(LOW);
    renderCard();
    fireEvent.click(await screen.findByRole('button', { name: 'Поговорить с кем-то' }));
    expect(track).toHaveBeenCalledWith('signal_card', 'open', 'low_index');
    expect(screen.getByRole('dialog')).toBeTruthy();
    fireEvent.click(screen.getByRole('link', { name: 'Записаться на встречу' }));
    expect(track).toHaveBeenLastCalledWith('signal_card', 'book', 'low_index');
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
