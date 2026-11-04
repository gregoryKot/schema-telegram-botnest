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

function renderSection(s: UserSettings, onOpenAccount = vi.fn()) {
  render(
    <NotificationsSection settings={s} tzLabel="Москва" patch={vi.fn()} openSubView={vi.fn()} onOpenAccount={onOpenAccount} />,
  );
  return onOpenAccount;
}

describe('NotificationsSection (сайт)', () => {
  it('Telegram не привязан — без тумблеров и времени; причина и путь в «Аккаунт»', () => {
    const onOpenAccount = renderSection(settings({ notifyReachable: false }));
    expect(screen.getByRole('note').textContent).toMatch(/приходят в Telegram.*не привязан/);
    expect(screen.queryByText('Итоги дня')).toBeNull();
    expect(screen.queryByText('Напоминание')).toBeNull();
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
});
