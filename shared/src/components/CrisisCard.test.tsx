// @vitest-environment jsdom
// Прямой тест тела карточки (правило №7 CLAUDE.md: свободный текст = кризисный
// путь + правило №8: аналитика). Обёртка сайта (webapp/CrisisCard.tsx)
// тестирует только прокидывание tr/track —
// сама механика показа/клика/двух форм обращения тестируется здесь один раз.
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { CrisisCardView, revealAboveKeyboard } from './CrisisCard';
import { CRISIS_CARD_STYLE, CRISIS_HUE } from './crisisCardStyle';
import { ENTITY_LOOK } from '../theme/entityLook';
import {
  CRISIS_HOTLINE_DISPLAY,
  CRISIS_HOTLINE_TEL,
  CRISIS_HOTLINES,
} from '../utils/crisisMarkers';

const tr = (ty: string, vy: string) => `${ty}|${vy}`;

afterEach(() => {
  cleanup();
});

describe('CrisisCardView — рендер', () => {
  it('role="status", взрослая линия (первая) и её tel-ссылка видны', () => {
    render(<CrisisCardView surface="note" tr={tr} track={vi.fn()} />);
    expect(screen.getByRole('status')).toBeTruthy();
    const link = screen.getByText(CRISIS_HOTLINE_DISPLAY);
    expect(link.getAttribute('href')).toBe(CRISIS_HOTLINE_TEL);
  });

  it('вторая линия (детская) видна с tel-ссылкой и подписью аудитории', () => {
    render(<CrisisCardView surface="note" tr={tr} track={vi.fn()} />);
    const child = CRISIS_HOTLINES[1];
    const link = screen.getByText(child.display);
    expect(link.getAttribute('href')).toBe(child.tel);
    expect(screen.getByText(child.audienceNote!)).toBeTruthy();
  });

  // Регрессия g4 r2: в контейнере шире ~510px детская линия вставала в ряд со взрослой.
  it('линии — столбиком: детская ссылка идёт после взрослой, второй строкой', () => {
    render(<CrisisCardView surface="note" tr={tr} track={vi.fn()} />);
    const adult = screen.getByText(CRISIS_HOTLINES[0].display);
    const child = screen.getByText(CRISIS_HOTLINES[1].display).closest('a')!;
    const box = adult.parentElement!;
    expect(box).toBe(child.parentElement);
    expect(box.style.flexDirection).toBe('column');
    expect(box.style.flexWrap).toBe('');
    expect(Array.from(box.children).indexOf(child)).toBe(
      Array.from(box.children).indexOf(adult) + 1,
    );
    expect(child.style.flex).toBe('');
  });

  it('обе формы обращения (ты/вы) присутствуют в тексте через tr()', () => {
    render(<CrisisCardView surface="note" tr={tr} track={vi.fn()} />);
    // tr() вызван ровно с двумя вариантами, объединёнными для проверки —
    // сама вилка ты/вы держится на месте использования (в компоненте), здесь
    // фиксируем, что оба переданных текста реально попали в разметку.
    expect(screen.getByText((content) => content.includes('|'))).toBeTruthy();
  });
});

describe('CrisisCardView — постоянный блок (standing)', () => {
  // Регрессия 2026-10-03: блок «Помощь рядом» видят все, а карточка
  // говорила «Похоже, сейчас очень тяжело» и про запись, которой нет.
  it('не угадывает состояние и не говорит о записи, линии на месте', () => {
    render(<CrisisCardView standing tr={tr} track={vi.fn()} />);
    expect(screen.getByText('Если станет совсем тяжело')).toBeTruthy();
    expect(screen.queryByText(/Похоже/)).toBeNull();
    expect(screen.queryByText(/Запись сохранится/)).toBeNull();
    for (const h of CRISIS_HOTLINES)
      expect(screen.getByText(h.display)).toBeTruthy();
  });

  it('показ по детекции — прежний текст', () => {
    render(<CrisisCardView surface="note" tr={tr} track={vi.fn()} />);
    expect(screen.getByText(/Похоже, сейчас очень тяжело/)).toBeTruthy();
    expect(screen.getByText(/Запись сохранится/)).toBeTruthy();
  });
});

describe('CrisisCardView — аналитика (правило №8)', () => {
  it('с surface: при маунте трекает crisis_card_shown с {surface}', () => {
    const track = vi.fn();
    render(<CrisisCardView surface="diary_schema" tr={tr} track={track} />);
    expect(track).toHaveBeenCalledWith('crisis_card_shown', {
      surface: 'diary_schema',
    });
  });

  it('без surface: маунт НЕ трекает (постоянная карточка помощи не засоряет метрику)', () => {
    const track = vi.fn();
    render(<CrisisCardView tr={tr} track={track} />);
    expect(track).not.toHaveBeenCalled();
  });

  it('клик по телефону доверия трекает crisis_hotline_tapped с тем же surface', () => {
    const track = vi.fn();
    render(<CrisisCardView surface="letter" tr={tr} track={track} />);
    track.mockClear();
    fireEvent.click(screen.getByText(CRISIS_HOTLINE_DISPLAY));
    expect(track).toHaveBeenCalledWith('crisis_hotline_tapped', {
      surface: 'letter',
    });
  });

  it('клик без surface ничего не трекает', () => {
    const track = vi.fn();
    render(<CrisisCardView tr={tr} track={track} />);
    fireEvent.click(screen.getByText(CRISIS_HOTLINE_DISPLAY));
    expect(track).not.toHaveBeenCalled();
  });
});

describe('CrisisCardView — compact (C-К1)', () => {
  it('только заголовок и обе линии: без лида и сноски', () => {
    render(<CrisisCardView standing compact tr={tr} track={vi.fn()} />);
    for (const h of CRISIS_HOTLINES)
      expect(screen.getByText(h.display)).toBeTruthy();
    expect(screen.queryByText(/Круглосуточно/)).toBeNull();
    expect(screen.queryByText(/выслушают/)).toBeNull();
  });
});

describe('CrisisCardView — прокрутка над клавиатурой (C-З7)', () => {
  const scroll = vi.fn();
  beforeEach(() => {
    scroll.mockClear();
    Element.prototype.scrollIntoView = scroll;
  });
  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(window, 'visualViewport', {
      value: undefined,
      configurable: true,
    });
  });
  const setVv = (height: number) =>
    Object.defineProperty(window, 'visualViewport', {
      value: { offsetTop: 0, height },
      configurable: true,
    });
  const rectBottom = (bottom: number) =>
    vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockReturnValue({ top: bottom - 200, bottom } as DOMRect);

  it('карточка по детекции ниже видимой высоты visualViewport прокручивается в видимую область', () => {
    setVv(400);
    rectBottom(700);
    render(<CrisisCardView surface="diary" tr={tr} track={vi.fn()} />);
    expect(scroll).toHaveBeenCalledTimes(1);
  });

  it('карточка уже на виду: прокрутки нет', () => {
    setVv(400);
    rectBottom(380);
    render(<CrisisCardView surface="diary" tr={tr} track={vi.fn()} />);
    expect(scroll).not.toHaveBeenCalled();
  });

  it('постоянный блок «Помощь рядом» сам не прокручивается', () => {
    setVv(400);
    rectBottom(700);
    render(<CrisisCardView standing tr={tr} track={vi.fn()} />);
    expect(scroll).not.toHaveBeenCalled();
  });

  it('revealAboveKeyboard(null) безопасен', () => {
    expect(() => revealAboveKeyboard(null)).not.toThrow();
  });
});

// Бумага кризисного пути литералом (CRISIS_HUE: карточка, лист «Мне плохо», строки телефонной
// «Практики») — тот же оттенок, что ENTITY_LOOK.sos: правка таблицы без этой строки краснеет (№4).
describe('бумага кризисного пути', () => {
  it('CRISIS_HUE — оттенок «Мне плохо» из ENTITY_LOOK', () => {
    expect(CRISIS_HUE).toBe(ENTITY_LOOK.sos.hue);
  });

  // Регрессия g4 r3: на визитке в тёмной теме светлые --text/--text-sub ложились на светлую
  // розовую бумагу. Своя бумага карточки держит светлые токены сама (.light-lock).
  it('своя бумага — светлая при любой теме (light-lock); flat — без своей бумаги и замка', () => {
    const { container, unmount } = render(
      <CrisisCardView tr={tr} track={vi.fn()} />,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toBe('light-lock pp-paper');
    expect(root.style.getPropertyValue('--h')).toBe(String(CRISIS_HUE));
    unmount();
    const flat = render(<CrisisCardView flat tr={tr} track={vi.fn()} />);
    expect((flat.container.firstElementChild as HTMLElement).className).toBe(
      '',
    );
  });

  // Ревью g4 r7: знак берёт display: var(--crisis-card-art) без запасного значения, а переменную ставила только
  // не-flat ветка — у flat-карточки со знаком значение было невалидно. Переменная задана в обеих ветках.
  it.each([
    ['своя бумага', false],
    ['flat', true],
  ])('%s + art: у знака задана --crisis-card-art', (_, flat) => {
    const { container } = render(
      <CrisisCardView
        flat={flat}
        art={<svg data-sign="" />}
        tr={tr}
        track={vi.fn()}
      />,
    );
    const sign = container.querySelector('[data-sign]')!.parentElement!;
    expect(sign.style.display).toBe('var(--crisis-card-art)');
    let el: HTMLElement | null = sign;
    while (el && !el.style.getPropertyValue('--crisis-card-art'))
      el = el.parentElement;
    expect(el?.style.getPropertyValue('--crisis-card-art')).toBe('inline-flex');
  });
});

// Ревью g3 (2026-11-09): подпись детской линии и сноска «Круглосуточно, бесплатно, анонимно…» шли --text-faint —
// 4.42:1 на бумаге карточки, ниже AA. b12 перевёл мелкий текст на --text-sub; сверка держит, что faint не вернётся.
describe('CrisisCardView — мелкий текст читается (AA)', () => {
  it('подпись линии и сноска — --text-sub; --text-faint в стилях карточки нет', () => {
    expect(CRISIS_CARD_STYLE.note.color).toBe('var(--text-sub)');
    expect(CRISIS_CARD_STYLE.foot.color).toBe('var(--text-sub)');
    expect(JSON.stringify(CRISIS_CARD_STYLE)).not.toContain('--text-faint');
  });
});
