// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

let hostId = 'web';
vi.mock('../../../../shared/src/host', () => ({ getHost: () => ({ id: hostId }) }));
let ty = true;
vi.mock('../../utils/addressForm', () => ({ useTr: () => (a: string, b: string) => (ty ? a : b) }));
const toggle = vi.fn();
let pushState = 'off';
vi.mock('../../push/usePushDevice', () => ({ usePushDevice: () => ({ state: pushState, busy: false, notice: null, toggle }) }));
import { ReminderHint } from './ReminderHint';
import { hasReminderHintSeen } from './reminderHintSeen';
import { renderHook } from '@testing-library/react';
import { useAnySheetOpen } from '../../hooks/openSheets';

const settings = { notifyLocalHour: 21, notifyChannel: null } as never;

beforeEach(() => { localStorage.clear(); hostId = 'web'; ty = true; pushState = 'off'; toggle.mockClear(); });
afterEach(cleanup);

describe('ReminderHint', () => {
  it('показывает реальный час', () => {
    render(<ReminderHint settings={{ notifyLocalHour: 9, notifyChannel: 'telegram' } as never} onClose={vi.fn()} />);
    expect(screen.getByText(/Вечером в 09:00 напомню о дне/)).toBeTruthy();
  });

  it('пока видна, слой отмечен открытым — баннер куки не встаёт на то же место', () => {
    const { result, rerender } = renderHook(() => useAnySheetOpen());
    const view = render(<ReminderHint settings={settings} onClose={vi.fn()} />);
    rerender();
    expect(result.current).toBe(true);
    view.unmount();
    rerender();
    expect(result.current).toBe(false);
  });

  it('«Хорошо» ставит флаг и закрывает', () => {
    const onClose = vi.fn();
    render(<ReminderHint settings={settings} onClose={onClose} />);
    fireEvent.click(screen.getByText('Хорошо'));
    expect(hasReminderHintSeen()).toBe(true);
    expect(onClose).toHaveBeenCalled();
  });

  it('web без push: кнопка зовёт toggle, обращение по форме', () => {
    render(<ReminderHint settings={settings} onClose={vi.fn()} />);
    expect(screen.getByText(/включи уведомления/)).toBeTruthy();
    fireEvent.click(screen.getByText('Включить push'));
    expect(toggle).toHaveBeenCalled();
    cleanup();
    ty = false;
    render(<ReminderHint settings={settings} onClose={vi.fn()} />);
    expect(screen.getByText(/включите уведомления/)).toBeTruthy();
  });

  it('кнопки push нет: не web, канал push, браузер без push, denied', () => {
    const noBtn = (s: unknown) => {
      render(<ReminderHint settings={s as never} onClose={vi.fn()} />);
      expect(screen.queryByText('Включить push')).toBeNull();
      cleanup();
    };
    hostId = 'telegram'; noBtn(settings);
    hostId = 'web'; noBtn({ notifyLocalHour: 21, notifyChannel: 'push' });
    pushState = 'unsupported'; noBtn(settings);
    pushState = 'denied'; noBtn(settings);
    pushState = 'ios-install'; noBtn(settings);
  });
});
