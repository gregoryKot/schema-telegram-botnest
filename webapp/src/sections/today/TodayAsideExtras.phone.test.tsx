// @vitest-environment jsdom
// Серия на телефоне: компактная строка как в мини-аппе; скрывается в листе «Настроить экран».
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { AddressFormContext } from '../../utils/addressForm';
import { StreakSlot } from './TodayAsideExtras';
import { streakDaysLabel } from './streakLabel';

vi.mock('../../components/useIsMobile', () => ({ useIsMobile: () => true }));
vi.mock('../../api', () => ({ api: { trackEvent: vi.fn() } }));

beforeEach(() => localStorage.clear());
afterEach(cleanup);

const onToggle = vi.fn();
const renderSlot = (streak: number, form: 'ty' | 'vy' = 'ty', hidden = false) =>
  render(
    <AddressFormContext.Provider value={{ form, setForm: vi.fn() }}>
      <StreakSlot streak={streak} hidden={hidden} onToggle={onToggle} />
    </AddressFormContext.Provider>,
  );

describe('streakDaysLabel', () => {
  it('согласует слово с числом', () => {
    expect(streakDaysLabel(1)).toBe('1 день подряд');
    expect(streakDaysLabel(3)).toBe('3 дня подряд');
    expect(streakDaysLabel(5)).toBe('5 дней подряд');
    expect(streakDaysLabel(11)).toBe('11 дней подряд');
    expect(streakDaysLabel(21)).toBe('21 день подряд');
  });
});

describe('StreakSlot на телефоне', () => {
  it('«N дней подряд» и подпись на «ты»', () => {
    renderSlot(5);
    expect(screen.getByText('5 дней подряд')).toBeTruthy();
    expect(screen.getByText('сбиться — не страшно, просто продолжай')).toBeTruthy();
  });

  it('подпись на «вы»', () => {
    renderSlot(5, 'vy');
    expect(screen.getByText('сбиться — не страшно, просто продолжайте')).toBeTruthy();
  });

  it('нулевая серия: подсказка вместо подписи', () => {
    renderSlot(0);
    expect(screen.getByText('Оцени потребности – начнётся стрик')).toBeTruthy();
    expect(screen.queryByText(/сбиться/)).toBeNull();
  });

  it('скрытая серия исчезает целиком, ссылок «скрыть/показать» на экране нет — они в листе настройки', () => {
    renderSlot(5, 'ty', true);
    expect(screen.queryByText('5 дней подряд')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
    cleanup();
    renderSlot(5);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
