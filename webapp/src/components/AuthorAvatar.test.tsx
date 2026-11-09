// @vitest-environment jsdom
// AuthorAvatar — круглый аватар автора: один компонент на навигацию первого
// экрана (HeroSection, 34px) и липкую панель (LandingPage, 30px). Раньше это
// были две копии разметки; тест держит то, что у них общее и что различается
// только размерами: адрес фото, диаметр, кегль буквы-запаски, скрытие
// сломанной картинки (буква «Г» остаётся под ней).
// AuthorPhoto — фотокарточка с наклейкой Talk: одна на «Кто это делает» лендинга и листы
// «Поговорить» без терапевта (перенос из pages/landing, редизайн 2026-11).
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { AuthorAvatar, AuthorPhoto } from './AuthorAvatar';

afterEach(() => cleanup());

describe('AuthorAvatar', () => {
  it('рисует фото с переданным адресом, alt и размером круга', () => {
    const { container } = render(<AuthorAvatar photo="/uploads/me.jpg" size={34} letterSize={14} />);
    const img = screen.getByAltText('Григорий Котляревский') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('/uploads/me.jpg');
    expect(img.getAttribute('width')).toBe('34');
    expect(img.getAttribute('height')).toBe('34');
    expect(img.style.objectPosition).toBe('center 18%');
    const circle = container.firstElementChild as HTMLElement;
    expect(circle.style.width).toBe('34px');
    expect(circle.style.height).toBe('34px');
    expect(circle.style.borderRadius).toBe('50%');
  });

  it('другой размер и кегль: 30px круг и буква «Г» 13px', () => {
    const { container } = render(<AuthorAvatar photo="/gregory.jpg" size={30} letterSize={13} />);
    const circle = container.firstElementChild as HTMLElement;
    expect(circle.style.width).toBe('30px');
    expect(circle.style.height).toBe('30px');
    const letter = screen.getByText('Г');
    expect(letter.style.fontSize).toBe('13px');
  });

  it('если фото не загрузилось, картинка скрывается, а буква «Г» остаётся', () => {
    render(<AuthorAvatar photo="/missing.jpg" size={30} letterSize={13} />);
    const img = screen.getByAltText('Григорий Котляревский') as HTMLImageElement;
    expect(img.style.display).not.toBe('none');
    fireEvent.error(img);
    expect(img.style.display).toBe('none');
    expect(screen.getByText('Г')).toBeTruthy();
  });
});

describe('AuthorPhoto', () => {
  it('фото в рамке и наклейка Talk-декором; класс места доезжает до рамки', () => {
    const { container } = render(<AuthorPhoto className="pl2-author-frame" />);
    const frame = container.firstElementChild as HTMLElement;
    expect(frame.className).toBe('author-photo pl2-author-frame');
    const img = screen.getByAltText('Григорий Котляревский') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('/gregory.jpg');
    expect(img.getAttribute('loading')).toBe('lazy');
    const sticker = frame.querySelector('.author-photo-sticker .scn-sign');
    expect(sticker?.getAttribute('aria-hidden')).toBe('true');
    expect(sticker?.querySelectorAll('svg.pp-art').length).toBe(2);
  });

  it('свой адрес фото; сломанное фото прячет карточку целиком, а не оставляет пустую рамку', () => {
    const { container } = render(<AuthorPhoto photo="/uploads/me.jpg" />);
    const frame = container.firstElementChild as HTMLElement;
    expect(frame.className).toBe('author-photo');
    const img = screen.getByAltText('Григорий Котляревский');
    expect(img.getAttribute('src')).toBe('/uploads/me.jpg');
    fireEvent.error(img);
    expect(frame.style.display).toBe('none');
  });
});
