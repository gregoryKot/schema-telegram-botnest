// @vitest-environment jsdom
// NotifySubView — четыре под-экрана настроек уведомлений (время/частота/
// тихие часы/часовой пояс), 0% покрытия. Проверяем: активный пункт отмечен
// реальным значением из settings (не хардкод), клик патчит нужное поле и
// возвращает на главный view. Каждый под-вид — своя ветка, бьём по всем.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { NotifySubView } from './NotifyViews';
import type { UserSettings } from '../../api';

afterEach(cleanup);

const SETTINGS: UserSettings = {
  notifyEnabled: true,
  notifyLocalHour: 21,
  notifyTimezone: 'Europe/Moscow',
  notifyReminderEnabled: false,
  pairCardDismissed: false,
  mySchemaIds: [],
  myModeIds: [],
  therapistShareCards: true,
  therapistShareProfile: true,
};

describe('NotifySubView — время уведомления', () => {
  it('текущий localHour отмечен галочкой (реальное значение, не 0)', () => {
    render(
      <NotifySubView
        view="time"
        settings={SETTINGS}
        localHour={21}
        patch={vi.fn()}
        setView={vi.fn()}
      />,
    );
    // Активный час — 21:00, с жирным начертанием (проверяем через fontWeight).
    const active = screen.getByText('21:00');
    expect(active.style.fontWeight).toBe('600');
  });

  it('клик по часу вызывает patch с notifyLocalHour и возвращает на main', async () => {
    const patch = vi.fn().mockResolvedValue(undefined);
    const setView = vi.fn();
    render(
      <NotifySubView
        view="time"
        settings={SETTINGS}
        localHour={21}
        patch={patch}
        setView={setView}
      />,
    );
    fireEvent.click(screen.getByText('09:00'));
    await vi.waitFor(() =>
      expect(patch).toHaveBeenCalledWith({ notifyLocalHour: 9 }),
    );
    expect(setView).toHaveBeenCalledWith('main');
  });
});

describe('NotifySubView — частота напоминаний', () => {
  it('по умолчанию (notifyFrequency не задан) активен «Каждый день»', () => {
    render(
      <NotifySubView
        view="freq"
        settings={SETTINGS}
        localHour={21}
        patch={vi.fn()}
        setView={vi.fn()}
      />,
    );
    expect(screen.getByText('✓').parentElement?.textContent).toContain(
      'Каждый день',
    );
  });

  it('реально сохранённая частота (2) отмечена, а не дефолтная', () => {
    render(
      <NotifySubView
        view="freq"
        settings={{ ...SETTINGS, notifyFrequency: 2 }}
        localHour={21}
        patch={vi.fn()}
        setView={vi.fn()}
      />,
    );
    expect(screen.getByText('✓').parentElement?.textContent).toContain(
      'Пару раз в неделю',
    );
  });

  it('клик патчит выбранную частоту', async () => {
    const patch = vi.fn().mockResolvedValue(undefined);
    render(
      <NotifySubView
        view="freq"
        settings={SETTINGS}
        localHour={21}
        patch={patch}
        setView={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText('Раз в неделю'));
    await vi.waitFor(() =>
      expect(patch).toHaveBeenCalledWith({ notifyFrequency: 3 }),
    );
  });
});

describe('NotifySubView — тихие часы', () => {
  it('без сохранённых тихих часов активен серверный дефолт (22:00–08:00), а не «Выключены»', () => {
    // Дефолт в коде — 22/8 (settings.notifyQuietStart ?? 22), не 0/0.
    render(
      <NotifySubView
        view="quiet"
        settings={SETTINGS}
        localHour={21}
        patch={vi.fn()}
        setView={vi.fn()}
      />,
    );
    expect(screen.getByText('✓').parentElement?.textContent).toContain(
      '22:00 – 08:00',
    );
  });

  it('явно сохранённые тихие часы (выключены, 0/0) отмечают правильный пресет', () => {
    render(
      <NotifySubView
        view="quiet"
        settings={{ ...SETTINGS, notifyQuietStart: 0, notifyQuietEnd: 0 }}
        localHour={21}
        patch={vi.fn()}
        setView={vi.fn()}
      />,
    );
    expect(screen.getByText('✓').parentElement?.textContent).toContain(
      'Выключены',
    );
  });

  it('клик по пресету патчит и start, и end одним вызовом', async () => {
    const patch = vi.fn().mockResolvedValue(undefined);
    render(
      <NotifySubView
        view="quiet"
        settings={SETTINGS}
        localHour={21}
        patch={patch}
        setView={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText('22:00 – 08:00'));
    await vi.waitFor(() =>
      expect(patch).toHaveBeenCalledWith({
        notifyQuietStart: 22,
        notifyQuietEnd: 8,
      }),
    );
  });
});

describe('NotifySubView — часовой пояс', () => {
  it('реальный сохранённый пояс отмечен галочкой', () => {
    render(
      <NotifySubView
        view="tz"
        settings={SETTINGS}
        localHour={21}
        patch={vi.fn()}
        setView={vi.fn()}
      />,
    );
    expect(screen.getByText('✓').parentElement?.textContent).toContain(
      'Москва',
    );
  });

  it('клик по другому поясу патчит notifyTimezone', async () => {
    const patch = vi.fn().mockResolvedValue(undefined);
    render(
      <NotifySubView
        view="tz"
        settings={SETTINGS}
        localHour={21}
        patch={patch}
        setView={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText('Лондон (UTC+0)'));
    await vi.waitFor(() =>
      expect(patch).toHaveBeenCalledWith({ notifyTimezone: 'Europe/London' }),
    );
  });
});

describe('NotifySubView — клавиатурная активация (Enter/пробел) работает так же, как клик', () => {
  it('время: Enter на часе патчит notifyLocalHour и возвращает на main', async () => {
    const patch = vi.fn().mockResolvedValue(undefined);
    const setView = vi.fn();
    render(
      <NotifySubView
        view="time"
        settings={SETTINGS}
        localHour={21}
        patch={patch}
        setView={setView}
      />,
    );
    fireEvent.keyDown(screen.getByText('09:00'), { key: 'Enter' });
    await vi.waitFor(() =>
      expect(patch).toHaveBeenCalledWith({ notifyLocalHour: 9 }),
    );
    expect(setView).toHaveBeenCalledWith('main');
  });

  it('время: произвольная клавиша (не Enter/пробел) ничего не патчит', () => {
    const patch = vi.fn();
    render(
      <NotifySubView
        view="time"
        settings={SETTINGS}
        localHour={21}
        patch={patch}
        setView={vi.fn()}
      />,
    );
    fireEvent.keyDown(screen.getByText('09:00'), { key: 'Tab' });
    expect(patch).not.toHaveBeenCalled();
  });

  it('частота: пробел патчит notifyFrequency', async () => {
    const patch = vi.fn().mockResolvedValue(undefined);
    render(
      <NotifySubView
        view="freq"
        settings={SETTINGS}
        localHour={21}
        patch={patch}
        setView={vi.fn()}
      />,
    );
    fireEvent.keyDown(screen.getByText('Раз в неделю'), { key: ' ' });
    await vi.waitFor(() =>
      expect(patch).toHaveBeenCalledWith({ notifyFrequency: 3 }),
    );
  });

  it('тихие часы: Enter патчит start и end одним вызовом', async () => {
    const patch = vi.fn().mockResolvedValue(undefined);
    render(
      <NotifySubView
        view="quiet"
        settings={SETTINGS}
        localHour={21}
        patch={patch}
        setView={vi.fn()}
      />,
    );
    fireEvent.keyDown(screen.getByText('22:00 – 08:00'), { key: 'Enter' });
    await vi.waitFor(() =>
      expect(patch).toHaveBeenCalledWith({
        notifyQuietStart: 22,
        notifyQuietEnd: 8,
      }),
    );
  });

  it('часовой пояс: Enter патчит notifyTimezone', async () => {
    const patch = vi.fn().mockResolvedValue(undefined);
    render(
      <NotifySubView
        view="tz"
        settings={SETTINGS}
        localHour={21}
        patch={patch}
        setView={vi.fn()}
      />,
    );
    fireEvent.keyDown(screen.getByText('Лондон (UTC+0)'), { key: 'Enter' });
    await vi.waitFor(() =>
      expect(patch).toHaveBeenCalledWith({ notifyTimezone: 'Europe/London' }),
    );
  });
});

describe('NotifySubView — вне активного под-вида (main) ничего не рендерит', () => {
  it('view="main" — компонент рендерит пустой fragment', () => {
    const { container } = render(
      <NotifySubView
        view="main"
        settings={SETTINGS}
        localHour={21}
        patch={vi.fn()}
        setView={vi.fn()}
      />,
    );
    expect(container.textContent).toBe('');
  });
});
