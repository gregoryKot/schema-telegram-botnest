// @vitest-environment jsdom
// NotificationsSection — настройки уведомлений (0% покрытия). Ключевая
// логика: детальные строки (время/частота/тихие часы/пояс) показываются,
// ТОЛЬКО когда включён хотя бы один из двух тумблеров (итоги/напоминание) —
// иначе выключенные уведомления всё равно предлагали бы настроить время,
// что сбивает с толку. Плюс предупреждение «время попадает в тихие часы».
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { NotificationsSection } from './NotificationsSection';
import type { UserSettings } from '../../api';

afterEach(() => {
  cleanup();
});

function baseSettings(overrides: Partial<UserSettings> = {}): UserSettings {
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

describe('NotificationsSection — оба тумблера выключены', () => {
  it('детальные строки (время/частота/тихие часы/пояс) скрыты', () => {
    render(
      <NotificationsSection
        settings={baseSettings()}
        patch={vi.fn()}
        setView={vi.fn()}
        onInfo={vi.fn()}
      />,
    );
    expect(screen.queryByText('Время')).toBeNull();
    expect(screen.queryByText('Частота')).toBeNull();
    expect(screen.queryByText('Тихие часы')).toBeNull();
    expect(screen.queryByText('Часовой пояс')).toBeNull();
  });

  it('строка «Приходят через @бота» тоже скрыта', () => {
    render(
      <NotificationsSection
        settings={baseSettings()}
        patch={vi.fn()}
        setView={vi.fn()}
        onInfo={vi.fn()}
      />,
    );
    expect(screen.queryByText('Приходят через')).toBeNull();
  });
});

describe('NotificationsSection — «Итоги дня» включены', () => {
  it('детальные строки видны, клик по «Время» зовёт setView("time")', () => {
    const setView = vi.fn();
    render(
      <NotificationsSection
        settings={baseSettings({ notifyEnabled: true })}
        patch={vi.fn()}
        setView={setView}
        onInfo={vi.fn()}
      />,
    );
    expect(screen.getByText('Время')).toBeTruthy();
    fireEvent.click(screen.getByText('Время'));
    expect(setView).toHaveBeenCalledWith('time');
  });

  it('клик по «Частота» зовёт setView("freq"), метка берётся из FREQ_LABELS', () => {
    const setView = vi.fn();
    render(
      <NotificationsSection
        settings={baseSettings({ notifyEnabled: true, notifyFrequency: 1 })}
        patch={vi.fn()}
        setView={setView}
        onInfo={vi.fn()}
      />,
    );
    expect(screen.getByText('Через день')).toBeTruthy();
    fireEvent.click(screen.getByText('Частота'));
    expect(setView).toHaveBeenCalledWith('freq');
  });

  it('клик по «Тихие часы» зовёт setView("quiet")', () => {
    const setView = vi.fn();
    render(
      <NotificationsSection
        settings={baseSettings({ notifyEnabled: true })}
        patch={vi.fn()}
        setView={setView}
        onInfo={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText('Тихие часы'));
    expect(setView).toHaveBeenCalledWith('quiet');
  });

  it('клик по «Часовой пояс» зовёт setView("tz"), известный IANA переведён в подпись', () => {
    const setView = vi.fn();
    render(
      <NotificationsSection
        settings={baseSettings({
          notifyEnabled: true,
          notifyTimezone: 'Europe/Moscow',
        })}
        patch={vi.fn()}
        setView={setView}
        onInfo={vi.fn()}
      />,
    );
    expect(screen.getByText('Москва (UTC+3)')).toBeTruthy();
    fireEvent.click(screen.getByText('Часовой пояс'));
    expect(setView).toHaveBeenCalledWith('tz');
  });

  it('неизвестный IANA-пояс — подпись падает обратно на сырую строку', () => {
    render(
      <NotificationsSection
        settings={baseSettings({
          notifyEnabled: true,
          notifyTimezone: 'Antarctica/Vostok',
        })}
        patch={vi.fn()}
        setView={vi.fn()}
        onInfo={vi.fn()}
      />,
    );
    expect(screen.getByText('Antarctica/Vostok')).toBeTruthy();
  });

  it('переключатель «Итоги дня» зовёт patch с инвертированным notifyEnabled', () => {
    const patch = vi.fn();
    render(
      <NotificationsSection
        settings={baseSettings({ notifyEnabled: true })}
        patch={patch}
        setView={vi.fn()}
        onInfo={vi.fn()}
      />,
    );
    fireEvent.click(screen.getAllByRole('switch')[0]);
    expect(patch).toHaveBeenCalledWith({ notifyEnabled: false });
  });

  it('переключатель «Игровой режим» зовёт patch с инвертированным notifyGamified', () => {
    const patch = vi.fn();
    render(
      <NotificationsSection
        settings={baseSettings({ notifyEnabled: true, notifyGamified: false })}
        patch={patch}
        setView={vi.fn()}
        onInfo={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText('Игровой режим'));
    const switches = screen.getAllByRole('switch');
    // 0=Итоги дня, 1=Напоминание, 2=Игровой режим
    fireEvent.click(switches[2]);
    expect(patch).toHaveBeenCalledWith({ notifyGamified: true });
  });

  it('строка «Приходят через @бота» видна с рабочей ссылкой', () => {
    render(
      <NotificationsSection
        settings={baseSettings({ notifyEnabled: true })}
        patch={vi.fn()}
        setView={vi.fn()}
        onInfo={vi.fn()}
      />,
    );
    expect(screen.getByText('Приходят через')).toBeTruthy();
  });
});

describe('NotificationsSection — предупреждение про тихие часы', () => {
  it('час уведомления попадает в тихие часы — показывает предупреждение', () => {
    render(
      <NotificationsSection
        settings={baseSettings({
          notifyEnabled: true,
          notifyLocalHour: 23,
          notifyQuietStart: 22,
          notifyQuietEnd: 8,
        })}
        patch={vi.fn()}
        setView={vi.fn()}
        onInfo={vi.fn()}
      />,
    );
    expect(screen.getByText(/попадает в тихие часы/)).toBeTruthy();
  });

  it('час уведомления вне тихих часов — предупреждения нет', () => {
    render(
      <NotificationsSection
        settings={baseSettings({
          notifyEnabled: true,
          notifyLocalHour: 12,
          notifyQuietStart: 22,
          notifyQuietEnd: 8,
        })}
        patch={vi.fn()}
        setView={vi.fn()}
        onInfo={vi.fn()}
      />,
    );
    expect(screen.queryByText(/попадает в тихие часы/)).toBeNull();
  });
});

describe('NotificationsSection — уведомления на паузе', () => {
  it('notifyPausedUntil в будущем — показывает баннер паузы с датой и кнопкой «Возобновить»', () => {
    const future = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    render(
      <NotificationsSection
        settings={baseSettings({ notifyPausedUntil: future })}
        patch={vi.fn()}
        setView={vi.fn()}
        onInfo={vi.fn()}
      />,
    );
    expect(screen.getByText(/на паузе до/)).toBeTruthy();
  });

  it('клик «Возобновить» зовёт patch с notifyPausedUntil: null', () => {
    const patch = vi.fn();
    const future = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    render(
      <NotificationsSection
        settings={baseSettings({ notifyPausedUntil: future })}
        patch={patch}
        setView={vi.fn()}
        onInfo={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText('Возобновить'));
    expect(patch).toHaveBeenCalledWith({ notifyPausedUntil: null });
  });

  it('notifyPausedUntil в прошлом — баннер паузы не показывается (пауза истекла)', () => {
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    render(
      <NotificationsSection
        settings={baseSettings({ notifyPausedUntil: past })}
        patch={vi.fn()}
        setView={vi.fn()}
        onInfo={vi.fn()}
      />,
    );
    expect(screen.queryByText(/на паузе до/)).toBeNull();
  });
});

describe('NotificationsSection — кнопка пояснения', () => {
  it('клик по кнопке «?» зовёт onInfo', () => {
    const onInfo = vi.fn();
    render(
      <NotificationsSection
        settings={baseSettings()}
        patch={vi.fn()}
        setView={vi.fn()}
        onInfo={onInfo}
      />,
    );
    fireEvent.click(screen.getByLabelText('Пояснение'));
    expect(onInfo).toHaveBeenCalled();
  });
});
