// @vitest-environment jsdom
// Общая кнопка «добавить значок»: Android — нативный вызов первым, iOS — настоящая
// ссылка (регресс 21.07.2026), класс и стиль приходят от фронтенда.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { AddHomeScreenButton } from './AddHomeScreenButton';
import { ADD_ICON_HOP_URL } from './homeScreen';
import { setHost } from './index';

const addToHomeScreen = vi.fn();

function setPlatform(platform: string) {
  (globalThis as { Telegram?: unknown }).Telegram = {
    WebApp: {
      platform,
      initData: 'query_id=1',
      addToHomeScreen,
      onEvent: () => {},
      offEvent: () => {},
    },
  };
  setHost(null);
}

beforeEach(() => addToHomeScreen.mockClear());
afterEach(() => {
  cleanup();
  delete (globalThis as { Telegram?: unknown }).Telegram;
  setHost(null);
});

describe('AddHomeScreenButton (shared)', () => {
  it('Android: кнопка с классом фронтенда, нативный вызов первым, потом побочные действия', () => {
    setPlatform('android');
    const order: string[] = [];
    addToHomeScreen.mockImplementation(() => order.push('native'));
    render(
      <AddHomeScreenButton
        className="ds-btn"
        onActivated={() => order.push('side')}
      >
        Добавить
      </AddHomeScreenButton>,
    );
    const btn = screen.getByRole('button', { name: 'Добавить' });
    expect(btn.className).toBe('ds-btn');
    fireEvent.click(btn);
    expect(order).toEqual(['native', 'side']);
  });

  it('iOS: настоящая ссылка на прыжковую страницу, нативный вызов не используется', () => {
    setPlatform('ios');
    const onActivated = vi.fn();
    render(
      <AddHomeScreenButton
        className="ds-btn"
        linkStyle={{ display: 'block' }}
        onActivated={onActivated}
      >
        Добавить
      </AddHomeScreenButton>,
    );
    const a = screen.getByRole('link', { name: 'Добавить' });
    expect(a.getAttribute('href')).toBe(ADD_ICON_HOP_URL);
    expect(a.getAttribute('target')).toBe('_blank');
    expect(a.style.display).toBe('block');
    fireEvent.click(a);
    expect(onActivated).toHaveBeenCalledTimes(1);
    expect(addToHomeScreen).not.toHaveBeenCalled();
  });

  it('style перекрывает linkStyle', () => {
    setPlatform('ios');
    render(
      <AddHomeScreenButton
        linkStyle={{ display: 'block' }}
        style={{ display: 'flex' }}
      >
        Добавить
      </AddHomeScreenButton>,
    );
    expect(screen.getByRole('link').style.display).toBe('flex');
  });
});
