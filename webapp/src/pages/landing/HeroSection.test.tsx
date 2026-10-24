// @vitest-environment jsdom
// HeroSection — первый экран визитки практики. Логики мало, но три вещи
// завязаны на поведение: фото автора лежит в figure.hero-person (от него
// зависит вёрстка: десктоп — портрет справа от текста, телефон — портрета
// нет совсем), кнопки зовут переданные колбэки, а подпись под фото не
// теряется. Скрытие портрета на телефоне — решение владельца 2026-10-01
// (фото дважды на первом экране — аватар в навигации и портрет — это
// слишком): оно живёт в CSS LandingStyles, поэтому закреплено тестом на
// текст стилей, jsdom медиазапросов не считает.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { HeroSection } from './HeroSection';
import { LandingStyles } from './LandingStyles';

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

  it('под фото — имя и строка «Схема-терапия и КПТ · онлайн», без «под супервизией»', () => {
    const { container } = renderHero();
    const caption = container.querySelector('figure.hero-person figcaption') as HTMLElement;
    expect(caption).toBeTruthy();
    expect(caption.textContent).toContain('Григорий Котляревский');
    expect(screen.getByText('Схема-терапия и КПТ · онлайн')).toBeTruthy();
    // Владелец убрал хвост: подпись под фото выглядела «ужасно».
    expect(caption.textContent).not.toContain('супервизией');
  });

  it('если фото не загрузилось, картинка скрывается, а подпись остаётся', () => {
    const { container } = renderHero();
    const img = container.querySelector('img.hero-person-photo') as HTMLImageElement;
    fireEvent.error(img);
    expect(img.style.display).toBe('none');
    expect(screen.getByText('Схема-терапия и КПТ · онлайн')).toBeTruthy();
  });

  it('в .hero-below две колонки — текст и портрет; аватар в навигации есть отдельно', () => {
    const { container } = renderHero();
    const below = container.querySelector('.hero-below') as HTMLElement;
    expect(below).toBeTruthy();
    expect(below.querySelectorAll(':scope > .hero-text').length).toBe(1);
    expect(below.querySelectorAll(':scope > figure.hero-person').length).toBe(1);
    // Аватар в навигации — единственное фото, которое остаётся на телефоне.
    const navAvatar = container.querySelector('a[href="#about"] img') as HTMLImageElement | null;
    expect(navAvatar).toBeTruthy();
    expect(navAvatar!.getAttribute('src')).toBe('/gregory.jpg');
  });

  it('текстовая колонка сохраняет ширину 460 и абзац с обещанием', () => {
    const { container } = renderHero();
    const text = container.querySelector('.hero-text') as HTMLElement;
    expect(text.style.maxWidth).toBe('460px');
    expect(text.textContent).toContain('Первая встреча бесплатно · 15 минут · без обязательств');
  });
});

describe('HeroSection — на телефоне портрет скрыт (стили LandingStyles)', () => {
  function css(): string {
    const { container } = render(<LandingStyles />);
    return container.querySelector('style')!.textContent ?? '';
  }
  // Тело медиаблока «@media (max-width:900px)»: правила в нём однострочные,
  // поэтому блок кончается первой закрывающей скобкой в начале строки.
  function mobileBlock(styles: string): string {
    const m = styles.match(/@media \(max-width:900px\) \{([\s\S]*?)\n\s*\}/);
    expect(m).toBeTruthy();
    return m![1];
  }

  it('в max-width:900px .hero-person получает display:none, колонка одна', () => {
    const block = mobileBlock(css());
    expect(block).toMatch(/\.hero-person\s*\{\s*display:none;\s*\}/);
    expect(block).toMatch(/\.hero-below\s*\{\s*grid-template-columns:1fr;/);
  });

  it('в мобильном блоке не осталось раскладки «строкой»: круглое фото 56px и порядок', () => {
    const block = mobileBlock(css());
    expect(block).not.toContain('.hero-person-photo');
    expect(block).not.toContain('order:');
  });

  it('на десктопе портрет не переупорядочивается (order не нужен — фигура в DOM после текста)', () => {
    const styles = css();
    const desktop = styles.match(/\.hero-person\s*\{([^}]*)\}/);
    expect(desktop).toBeTruthy();
    expect(desktop![1]).not.toContain('order');
    expect(desktop![1]).toContain('display:flex');
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
