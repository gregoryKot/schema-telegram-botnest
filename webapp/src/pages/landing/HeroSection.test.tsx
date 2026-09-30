// @vitest-environment jsdom
// HeroSection — первый экран визитки практики. Логики мало, но три вещи
// завязаны на поведение: фото автора лежит в figure.hero-person (от него
// зависит вёрстка: десктоп — портрет справа, телефон — строка над текстом),
// кнопки зовут переданные колбэки, а подпись под фото не теряется.
// Порядок в DOM (фигура ПЕРЕД текстом) закреплён отдельным тестом: на нём
// держится mobile-раскладка — там у обоих order:0, и наверх фигуру ставит
// только порядок в разметке.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { HeroSection } from './HeroSection';

afterEach(() => cleanup());

function renderHero(overrides: Partial<React.ComponentProps<typeof HeroSection>> = {}) {
  const props = {
    photo: '/gregory.jpg',
    activeSection: '',
    theme: 'light' as const,
    onToggleTheme: vi.fn(),
    onBook: vi.fn(),
    onOpenMenu: vi.fn(),
    ...overrides,
  };
  const utils = render(<HeroSection {...props} />);
  return { ...utils, props };
}

describe('HeroSection — фото и подпись автора', () => {
  it('фото лежит в figure.hero-person с переданным src и alt', () => {
    const { container } = renderHero({ photo: '/uploads/custom-photo.jpg' });
    const img = container.querySelector('figure.hero-person img.hero-person-photo') as HTMLImageElement | null;
    expect(img).toBeTruthy();
    expect(img!.getAttribute('src')).toBe('/uploads/custom-photo.jpg');
    expect(img!.getAttribute('alt')).toBe('Григорий Котляревский');
    expect(img!.getAttribute('width')).toBe('200');
    expect(img!.getAttribute('height')).toBe('250');
  });

  it('под фото — имя и строка «Схема-терапия и КПТ · онлайн · под супервизией»', () => {
    const { container } = renderHero();
    const caption = container.querySelector('figure.hero-person figcaption') as HTMLElement;
    expect(caption).toBeTruthy();
    expect(caption.textContent).toContain('Григорий Котляревский');
    expect(screen.getByText('Схема-терапия и КПТ · онлайн · под супервизией')).toBeTruthy();
  });

  it('если фото не загрузилось, картинка скрывается, а подпись остаётся', () => {
    const { container } = renderHero();
    const img = container.querySelector('img.hero-person-photo') as HTMLImageElement;
    fireEvent.error(img);
    expect(img.style.display).toBe('none');
    expect(screen.getByText('Схема-терапия и КПТ · онлайн · под супервизией')).toBeTruthy();
  });

  it('фигура стоит в DOM перед текстовой колонкой (на этом держится мобильная раскладка)', () => {
    const { container } = renderHero();
    const below = container.querySelector('.hero-below') as HTMLElement;
    expect(below).toBeTruthy();
    const [first, second] = Array.from(below.children);
    expect(first.tagName).toBe('FIGURE');
    expect(first.classList.contains('hero-person')).toBe(true);
    expect(second.classList.contains('hero-text')).toBe(true);
  });

  it('текстовая колонка сохраняет ширину 460 и абзац с обещанием', () => {
    const { container } = renderHero();
    const text = container.querySelector('.hero-text') as HTMLElement;
    expect(text.style.maxWidth).toBe('460px');
    expect(text.textContent).toContain('Первая встреча бесплатно · 15 минут · без обязательств');
  });
});

describe('HeroSection — кнопки', () => {
  it('«Записаться на знакомство →» вызывает onBook', () => {
    const { props } = renderHero();
    fireEvent.click(screen.getByText('Записаться на знакомство →'));
    expect(props.onBook).toHaveBeenCalledTimes(1);
  });

  it('бургер вызывает onOpenMenu', () => {
    const { props } = renderHero();
    fireEvent.click(screen.getByLabelText('Открыть меню'));
    expect(props.onOpenMenu).toHaveBeenCalledTimes(1);
  });

  it('переключатель темы вызывает onToggleTheme, подпись зависит от темы', () => {
    const light = renderHero({ theme: 'light' });
    expect(screen.getByLabelText('Тёмная тема')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Тёмная тема'));
    expect(light.props.onToggleTheme).toHaveBeenCalledTimes(1);
    cleanup();

    renderHero({ theme: 'dark' });
    expect(screen.getByLabelText('Светлая тема')).toBeTruthy();
  });

  it('ссылка «Написать ↗» ведёт в Telegram автора', () => {
    renderHero();
    const link = screen.getByText('Написать ↗') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('https://t.me/kotlarewski');
  });
});

describe('HeroSection — навигация', () => {
  it('активный раздел подсвечивает пункт навигации', () => {
    renderHero({ activeSection: 'prices' });
    expect(screen.getByText('Цены').style.color).toBe('var(--accent)');
    expect(screen.getByText('Обо мне').style.color).not.toBe('var(--accent)');
  });
});
