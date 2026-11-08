// @vitest-environment jsdom
// «Уведомления» в настройках сайта. QA 2026-11 (З5): у веб-клиента без
// Telegram «Итоги дня» и «Напоминание» были включены, рядом — время и
// частота, а очередь снимала каждое уведомление как «доставить некому».
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { NotificationsSection } from './NotificationsSection';
import type { UserSettings } from '../../api';

afterEach(cleanup);

const settings = (over: Partial<UserSettings> = {}): UserSettings => ({
  notifyEnabled: true,
  notifyLocalHour: 21,
  notifyTimezone: 'Europe/Moscow',
  notifyReminderEnabled: true,
  pairCardDismissed: false,
  mySchemaIds: [],
  myModeIds: [],
  therapistShareCards: true,
  therapistShareProfile: true,
  ...over,
});

function renderSection(s: UserSettings, onOpenAccount = vi.fn(), patch = vi.fn()) {
  render(
    <NotificationsSection settings={s} tzLabel="Москва" patch={patch} openSubView={vi.fn()} onOpenAccount={onOpenAccount} />,
  );
  return onOpenAccount;
}

const switchOf = (name: string) => screen.getByRole('switch', { name });

describe('NotificationsSection (сайт)', () => {
  it('Telegram не привязан — без тумблеров и времени; причина и путь в «Аккаунт»', () => {
    const onOpenAccount = renderSection(settings({ notifyReachable: false }));
    expect(screen.getByRole('note').textContent).toMatch(/приходят в Telegram.*не привязан/);
    expect(screen.queryByText('Итоги дня')).toBeNull();
    expect(screen.queryByText('Напоминания')).toBeNull();
    expect(screen.queryByText('Время')).toBeNull();
    fireEvent.click(screen.getByText('Привязать Telegram'));
    expect(onOpenAccount).toHaveBeenCalledTimes(1);
  });

  it('Telegram есть — тумблеры и настройки времени на месте', () => {
    renderSection(settings({ notifyReachable: true }));
    expect(screen.getByText('Итоги дня')).toBeTruthy();
    expect(screen.getByText('Время')).toBeTruthy();
    expect(screen.queryByRole('note')).toBeNull();
  });

  // R2 (аудит 2026-11, решение Р1): «Итоги дня» висели на notifyEnabled и
  // выключали напоминания. Теперь у каждого тумблера свой флаг.
  describe('два тумблера: «Напоминания» и «Итоги дня»', () => {
    it('«Итоги дня» — свой флаг: выключение шлёт notifySummaryEnabled и не трогает напоминания', () => {
      const patch = vi.fn();
      renderSection(settings(), vi.fn(), patch);
      expect(switchOf('Итоги дня').getAttribute('aria-checked')).toBe('true');
      fireEvent.click(switchOf('Итоги дня'));
      expect(patch).toHaveBeenCalledWith({ notifySummaryEnabled: false });
    });

    it('«Напоминания» выключаются через notifyEnabled, итоги остаются', () => {
      const patch = vi.fn();
      renderSection(settings({ notifySummaryEnabled: true }), vi.fn(), patch);
      fireEvent.click(switchOf('Напоминания'));
      expect(patch).toHaveBeenCalledWith({ notifyEnabled: false });
    });

    it('напоминание выключено отдельно (старый тумблер) — «Напоминания» видны выключенными, включение поднимает оба флага', () => {
      const patch = vi.fn();
      renderSection(settings({ notifyReminderEnabled: false }), vi.fn(), patch);
      expect(switchOf('Напоминания').getAttribute('aria-checked')).toBe('false');
      fireEvent.click(switchOf('Напоминания'));
      expect(patch).toHaveBeenCalledWith({ notifyEnabled: true, notifyReminderEnabled: true });
    });

    it('включены только итоги — время и пояс на месте: сводка приходит в выбранный час', () => {
      renderSection(settings({ notifyEnabled: false, notifySummaryEnabled: true }));
      expect(switchOf('Напоминания').getAttribute('aria-checked')).toBe('false');
      expect(screen.getByText('Время')).toBeTruthy();
    });

    it('оба выключены — время, частота и пояс скрыты', () => {
      renderSection(settings({ notifyEnabled: false, notifySummaryEnabled: false }));
      expect(screen.queryByText('Время')).toBeNull();
      expect(screen.queryByText('Часовой пояс')).toBeNull();
    });
  });
});
