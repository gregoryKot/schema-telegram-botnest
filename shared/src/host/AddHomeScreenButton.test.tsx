// @vitest-environment jsdom
// Общая кнопка «установить приложение»: Android в мессенджере — openLink первым,
// iOS — настоящая ссылка (регресс 21.07.2026), класс и стиль приходят от фронтенда.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { AddHomeScreenButton } from './AddHomeScreenButton';
import { setHost } from './index';

const openLink = vi.fn();
const HREF = 'https://schemehappens.ru/install#h=abc';

function setPlatform(platform: string) {
  (globalThis as { Telegram?: unknown }).Telegram = {
    WebApp: {
      platform,
      initData: 'query_id=1',
      openLink,
      onEvent: () => {},
      offEvent: () => {},
    },
  };
  setHost(null);
}

beforeEach(() => openLink.mockClear());
afterEach(() => {
  cleanup();
  delete (globalThis as { Telegram?: unknown }).Telegram;
  setHost(null);
});

describe('AddHomeScreenButton (shared)', () => {
  it('Android: кнопка с классом фронтенда, openLink с адресом первым, потом побочные действия', () => {
    setPlatform('android');
    const order: string[] = [];
    openLink.mockImplementation((url: string) => order.push(`open:${url}`));
    render(
      <AddHomeScreenButton
        href={HREF}
        className="ds-btn"
        onActivated={() => order.push('side')}
      >
        Установить
      </AddHomeScreenButton>,
    );
    const btn = screen.getByRole('button', { name: 'Установить' });
    expect(btn.className).toBe('ds-btn');
    fireEvent.click(btn);
    expect(order).toEqual([`open:${HREF}`, 'side']);
  });

  it('iOS: настоящая ссылка на страницу установки, openLink не используется', () => {
    setPlatform('ios');
    const onActivated = vi.fn();
    render(
      <AddHomeScreenButton
        href={HREF}
        className="ds-btn"
        linkStyle={{ display: 'block' }}
        onActivated={onActivated}
      >
        Установить
      </AddHomeScreenButton>,
    );
    const a = screen.getByRole('link', { name: 'Установить' });
    expect(a.getAttribute('href')).toBe(HREF);
    expect(a.getAttribute('target')).toBe('_blank');
    expect(a.style.display).toBe('block');
    fireEvent.click(a);
    expect(onActivated).toHaveBeenCalledTimes(1);
    expect(openLink).not.toHaveBeenCalled();
  });

  it('style перекрывает linkStyle', () => {
    setPlatform('ios');
    render(
      <AddHomeScreenButton
        href={HREF}
        linkStyle={{ display: 'block' }}
        style={{ display: 'flex' }}
      >
        Установить
      </AddHomeScreenButton>,
    );
    expect(screen.getByRole('link').style.display).toBe('flex');
  });
});
