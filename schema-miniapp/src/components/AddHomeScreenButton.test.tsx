// @vitest-environment jsdom
// Кнопка «добавить значок»: Android — нативный вызов, iOS — НАСТОЯЩАЯ ссылка
// (регресс 21.07.2026: на iOS молчат и addToHomeScreen, и openLink — рабочим
// остался только путь через навигацию по якорю; матрица зафиксирована тестом).
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { AddHomeScreenButton } from './AddHomeScreenButton';
import { ADD_ICON_HOP_URL } from '../utils/homeScreen';

const addToHomeScreen = vi.fn();

function setPlatform(platform: string) {
  (window as never as { Telegram: unknown }).Telegram = {
    WebApp: { platform, addToHomeScreen },
  };
}

beforeEach(() => {
  cleanup();
  addToHomeScreen.mockClear();
});

describe('AddHomeScreenButton', () => {
  it('iOS — рендерит настоящую ссылку на прыжковую страницу, не кнопку', () => {
    setPlatform('ios');
    const onActivated = vi.fn();
    render(
      <AddHomeScreenButton onActivated={onActivated}>
        Добавить значок
      </AddHomeScreenButton>,
    );
    const link = screen.getByRole('link', { name: 'Добавить значок' });
    expect(link.getAttribute('href')).toBe(ADD_ICON_HOP_URL);
    expect(link.getAttribute('target')).toBe('_blank');
    fireEvent.click(link);
    expect(onActivated).toHaveBeenCalledTimes(1);
    // нативный postEvent-путь на iOS не используется вовсе
    expect(addToHomeScreen).not.toHaveBeenCalled();
  });

  it('Android — кнопка зовёт нативный addToHomeScreen, затем побочные действия', () => {
    setPlatform('android');
    const order: string[] = [];
    addToHomeScreen.mockImplementation(() => order.push('native'));
    render(
      <AddHomeScreenButton onActivated={() => order.push('side')}>
        Добавить значок
      </AddHomeScreenButton>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Добавить значок' }));
    // нативный вызов первым (в жесте), побочные действия после
    expect(order).toEqual(['native', 'side']);
  });
});
