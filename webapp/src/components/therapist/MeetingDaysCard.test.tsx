// @vitest-environment jsdom
// «Дни встреч» в кабинете терапевта на сайте — паритет с SessionCard мини-аппа:
// правка дней недели, сохранение через saveSessionInfo({ meetingDays }).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { MeetingDaysCard } from './MeetingDaysCard';
import type { ClientDetail } from './clientSheetTypes';
import type { TherapyClientSummary } from '../../api';

afterEach(cleanup);

const client = (meetingDays: number[]) => ({ telegramId: 1, meetingDays }) as unknown as TherapyClientSummary;
const detailOf = (o: { save?: ReturnType<typeof vi.fn>; saving?: boolean; error?: string } = {}) =>
  ({
    saveSessionInfo: o.save ?? vi.fn().mockResolvedValue(true),
    sessionInfoSaving: o.saving ?? false,
    sessionInfoError: o.error ?? '',
  }) as unknown as ClientDetail;

describe('MeetingDaysCard', () => {
  it('показывает сохранённые дни в порядке недели (Пн … Вс)', () => {
    render(<MeetingDaysCard selectedClient={client([0, 3, 1])} detail={detailOf()} />);
    expect(screen.getByText('Пн, Ср, Вс')).toBeTruthy();
    expect(screen.getByText('изменить')).toBeTruthy();
  });

  it('дней нет — «Не указаны» и «указать»', () => {
    render(<MeetingDaysCard selectedClient={client([])} detail={detailOf()} />);
    expect(screen.getByText('Не указаны')).toBeTruthy();
    expect(screen.getByText('указать')).toBeTruthy();
  });

  it('правка: отметить день, снять день, сохранить — уходит упорядоченный список', async () => {
    const save = vi.fn().mockResolvedValue(true);
    render(<MeetingDaysCard selectedClient={client([1, 3])} detail={detailOf({ save })} />);
    fireEvent.click(screen.getByText('изменить'));
    expect(screen.getByRole('button', { name: 'Пн' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Вт' }).getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(screen.getByRole('button', { name: 'Вс' }));
    fireEvent.click(screen.getByRole('button', { name: 'Пн' }));
    fireEvent.click(screen.getByText('Сохранить'));
    await waitFor(() => expect(save).toHaveBeenCalledWith({ meetingDays: [3, 0] }));
    await waitFor(() => expect(screen.queryByText('Сохранить')).toBeNull());
  });

  it('сохранить не удалось — форма остаётся открытой, ошибка видна', async () => {
    const save = vi.fn().mockResolvedValue(false);
    render(<MeetingDaysCard selectedClient={client([1])} detail={detailOf({ save, error: 'Не удалось сохранить дату' })} />);
    fireEvent.click(screen.getByText('изменить'));
    fireEvent.click(screen.getByText('Сохранить'));
    await waitFor(() => expect(save).toHaveBeenCalled());
    expect(screen.getByText('Сохранить')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toBe('Не удалось сохранить дату');
  });

  it('«Отмена» закрывает форму без сохранения', () => {
    const save = vi.fn();
    render(<MeetingDaysCard selectedClient={client([1])} detail={detailOf({ save })} />);
    fireEvent.click(screen.getByText('изменить'));
    fireEvent.click(screen.getByRole('button', { name: 'Ср' }));
    fireEvent.click(screen.getByText('Отмена'));
    expect(save).not.toHaveBeenCalled();
    expect(screen.getByText('Пн')).toBeTruthy();
  });
});
