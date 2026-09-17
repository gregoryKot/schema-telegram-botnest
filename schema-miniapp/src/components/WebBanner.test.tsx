// @vitest-environment jsdom
// WebBanner — скрываемый баннер «полная версия — на сайте» (0% покрытия).
// Read-after-write: dismiss пишет в localStorage через dismissWebBanner, а
// видимость при следующем маунте читается через isWebBannerDismissed —
// тестируем связку «скрыл → не показывается снова», а не только запись.
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { setHost, type HostBridge } from '../../../shared/src/host';
import { WebBanner } from './WebBanner';
import { api } from '../api';

vi.mock('../api', () => ({ api: { trackEvent: vi.fn() } }));

let openLink: ReturnType<typeof vi.fn>;

beforeEach(() => {
  localStorage.clear();
  openLink = vi.fn();
  setHost({ id: 'web', openLink } as unknown as HostBridge);
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
  setHost(null);
});

const props = {
  id: 'cabinet_full' as const,
  emoji: '💻',
  title: 'Полный кабинет — на сайте',
  text: 'Больше графиков и инструментов в браузерной версии',
  url: 'https://schemehappens.ru/cabinet',
};

describe('WebBanner — показ', () => {
  it('первый раз (не скрыт) — виден с заголовком и текстом', () => {
    render(<WebBanner {...props} />);
    expect(screen.getByText('Полный кабинет — на сайте')).toBeTruthy();
    expect(
      screen.getByText('Больше графиков и инструментов в браузерной версии'),
    ).toBeTruthy();
  });

  it('уже скрыт этот id ранее — не рендерится вовсе', () => {
    localStorage.setItem('web_banner_dismissed:cabinet_full', '1');
    const { container } = render(<WebBanner {...props} />);
    expect(container.textContent).toBe('');
  });

  it('скрыт другой id — этот баннер всё равно виден (ключ per-баннер)', () => {
    localStorage.setItem('web_banner_dismissed:mode_map', '1');
    render(<WebBanner {...props} />);
    expect(screen.getByText('Полный кабинет — на сайте')).toBeTruthy();
  });
});

describe('WebBanner — «Открыть на сайте»', () => {
  it('открывает переданный url через host.openLink и трекает web_banner_open', () => {
    render(<WebBanner {...props} />);
    fireEvent.click(screen.getByText('Открыть на сайте ↗'));
    expect(openLink).toHaveBeenCalledWith(props.url);
    expect(api.trackEvent).toHaveBeenCalledWith('web_banner_open', {
      banner: 'cabinet_full',
    });
  });
});

describe('WebBanner — крестик (read-after-write: скрыл → не видно снова)', () => {
  it('клик по крестику скрывает баннер немедленно и трекает web_banner_dismiss', () => {
    render(<WebBanner {...props} />);
    fireEvent.click(screen.getByLabelText('Скрыть баннер'));
    expect(screen.queryByText('Полный кабинет — на сайте')).toBeNull();
    expect(api.trackEvent).toHaveBeenCalledWith('web_banner_dismiss', {
      banner: 'cabinet_full',
    });
  });

  it('после скрытия — новый маунт компонента тоже не показывает баннер', () => {
    const { unmount } = render(<WebBanner {...props} />);
    fireEvent.click(screen.getByLabelText('Скрыть баннер'));
    unmount();
    const { container } = render(<WebBanner {...props} />);
    expect(container.textContent).toBe('');
  });
});
