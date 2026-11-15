// @vitest-environment jsdom
// Celebration — оверлей стрика. Конфетти выключено через reduce_motion=1 (canvas.getContext в jsdom
// нет; механика — useConfetti.test). Проверяем: сцену и веху, закрытие через запись в истории
// (фон, Escape, «Закрыть», «Назад» браузера), клик по карточке не закрывает, ты/вы в подсказке.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useEffect, useState, type ReactNode } from 'react';
import { act, render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { Celebration } from './Celebration';
import { sheetStackOf } from '../hooks/historySheetStack';
import { useHistorySheet } from '../hooks/useHistorySheet';
import { AddressFormContext } from '../utils/addressForm';
import { needDataColor } from './needDataColor';
import { CHECK_IN_GEOM, strokeLen } from './art/strokeLen';
import { PAPER } from './art/paper';
import { NEED_ORDER } from '../../../shared/src/needs/types';

beforeEach(() => {
  localStorage.setItem('reduce_motion', '1');
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// Снимок роутера: глубина стека листов в записи истории и navigate для «Назад» браузера.
const nav = { go: null as ReturnType<typeof useNavigate> | null, depth: 0 };
function Probe() {
  const navigate = useNavigate();
  const depth = sheetStackOf(useLocation().state).length;
  useEffect(() => { nav.go = navigate; nav.depth = depth; });
  return null;
}

function renderInRouter(children: ReactNode, form: 'ty' | 'vy' = 'ty') {
  return render(
    <MemoryRouter>
      <AddressFormContext.Provider value={{ form, setForm: vi.fn() }}>
        <Probe />
        {children}
      </AddressFormContext.Provider>
    </MemoryRouter>,
  );
}

function renderCelebration(props: Partial<Parameters<typeof Celebration>[0]> = {}, form: 'ty' | 'vy' = 'ty') {
  return renderInRouter(<Celebration streak={5} onDone={vi.fn()} {...props} />, form);
}

// Как в AppShell: onDone закрывает окно и открывает следующий лист со своей записью («Колесо детства»).
function Wheel({ onClose }: { onClose: () => void }) {
  useHistorySheet(onClose);
  return <p>колесо</p>;
}
function CelebrationThenWheel() {
  const [stage, setStage] = useState<'party' | 'wheel' | 'none'>('party');
  if (stage === 'party') return <Celebration streak={5} onDone={() => setStage('wheel')} />;
  return stage === 'wheel' ? <Wheel onClose={() => setStage('none')} /> : null;
}

describe('Celebration — лист серии (живая бумага, b07)', () => {
  it('сверху сцена серии: за листом сегодняшнего дня — листы прошлых дней; бумага соломы, число — наклейкой вне сцены', () => {
    const { container } = renderCelebration({ streak: 5 });
    const top = container.querySelector('.sk-celebr-top') as HTMLElement;
    expect(top.style.getPropertyValue('--h')).toBe('70');
    const band = top.querySelector('.sk-celebr-band.pp-paper')!;
    expect(band.getAttribute('aria-hidden')).toBe('true');
    expect(band.querySelectorAll('.scn-shade > rect')).toHaveLength(4); // пять дней — четыре листа позади
    expect(band.querySelector('.sk-celebr-leaf')).toBeNull();
    expect(band.contains(screen.getByText('5'))).toBe(false); // число читается, а не прячется в декоре
  });

  // Ревью g2 r3: пять полосок «сегодняшнего листа» читаются как пять потребностей — цвета и порядок те же,
  // что у столбиков «Готово» и линий «Истории» (needDataColor по NEED_ORDER), а не палитра лендинга.
  // Ревью g2 r4: высоты — сегодняшние оценки (у человека с 2,2,2,2,2 лендинг рисовал высокие столбики).
  const bars = (c: HTMLElement) => [...c.querySelectorAll('.sk-celebr-band svg > g:not(.scn-shade) rect[rx="10"]')];
  it('полоски сегодняшнего листа — цвета данных в порядке NEED_ORDER, высоты — сегодняшние оценки', () => {
    const ratings = { attachment: 2, autonomy: 9, expression: 2, play: 5, limits: 10 };
    const b = bars(renderCelebration({ streak: 5, ratings }).container);
    expect(b.map((r) => r.getAttribute('fill'))).toEqual(NEED_ORDER.map((id) => needDataColor(id)));
    expect(b.map((r) => Number(r.getAttribute('height')))).toEqual(
      NEED_ORDER.map((id) => strokeLen(ratings[id as keyof typeof ratings], CHECK_IN_GEOM)),
    );
  });

  // Ревью g2 r5: праздник открывается на первом сохранении дня — оценена одна потребность, и четыре цветных
  // «пенька» ниже оценки 1 читались очень низкими оценками. Неоценённая — пустым тоном, как на главной.
  it('первое сохранение дня — цвет данных у одной полоски, четыре пустым тоном; без оценок — все пустые', () => {
    const b = bars(renderCelebration({ streak: 3, ratings: { attachment: 7 } }).container);
    expect(b.map((r) => r.getAttribute('data-rated'))).toEqual(['yes', 'no', 'no', 'no', 'no']);
    expect(b.slice(1).every((r) => r.getAttribute('fill') === PAPER.hollow)).toBe(true);
    cleanup();
    const none = bars(renderCelebration({ streak: 3 }).container);
    expect(none.map((r) => r.getAttribute('fill'))).toEqual(Array(5).fill(PAPER.hollow));
  });

  it('веха — персик и лист роста', () => {
    const { container } = renderCelebration({ streak: 7 });
    expect((container.querySelector('.sk-celebr-top') as HTMLElement).style.getPropertyValue('--h')).toBe('45');
    expect(container.querySelector('.sk-celebr-band .sk-celebr-leaf svg')).not.toBeNull();
  });
});

describe('Celebration — контент', () => {
  it('обычный стрик — число дней и без пометки вехи', () => {
    renderCelebration({ streak: 5 });
    expect(screen.getByText('5')).toBeTruthy();
    expect(screen.getByText('5').dataset.milestone).toBe('no');
  });

  // Веху раньше отличала картинка (🏆 против 🔥). Картинок нет, но событие
  // разное, поэтому отличие обязано остаться: акцент на числе плюс своя фраза.
  it('веха (7 дней) помечена акцентом и своим текстом', () => {
    renderCelebration({ streak: 7 });
    const num = screen.getByText('7');
    expect(num.dataset.milestone).toBe('yes');
    expect(num.className).toContain('sk-celebr-num'); // акцент вехи задаёт css по data-milestone
    expect(screen.getByText('Неделя подряд. Это настоящий сдвиг')).toBeTruthy();
  });

  it('insight, если передан, рендерится отдельным блоком', () => {
    renderCelebration({ insight: 'Ты чаще заботишься о границах' });
    expect(screen.getByText('Ты чаще заботишься о границах')).toBeTruthy();
    // glue: «о» не висит в конце строки
    expect(screen.getByText('Ты чаще заботишься о границах').textContent).toContain('о\u00a0границах');
  });

  it('без insight дополнительный блок не рендерится', () => {
    renderCelebration({ insight: null });
    expect(screen.queryByText(/заботишься/)).toBeNull();
  });
});

// Окно живёт в истории браузера (useHistorySheet): закрытия идут через goBack, onDone — когда запись
// снята. Иначе лист из onDone («Колесо детства») ложился поверх брошенной записи окна.
describe('Celebration — закрытие через запись в истории', () => {
  it.each([
    ['«Закрыть»', () => fireEvent.click(screen.getByText('Закрыть'))],
    ['Escape', () => fireEvent.keyDown(document, { key: 'Escape' })],
    ['фон', () => fireEvent.click(screen.getByRole('presentation'))],
  ])('%s снимает запись окна до onDone: лист из onDone — единственная запись', (_how, close) => {
    renderInRouter(<CelebrationThenWheel />);
    expect(screen.getByRole('dialog').getAttribute('aria-modal')).toBe('true');
    expect(nav.depth).toBe(1);
    close();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByText('колесо')).toBeTruthy();
    expect(nav.depth).toBe(1);
    act(() => nav.go!(-1));
    expect(screen.queryByText('колесо')).toBeNull();
    expect(nav.depth).toBe(0);
  });

  it('«Назад» браузера закрывает окно', () => {
    const onDone = vi.fn();
    renderCelebration({ onDone });
    act(() => nav.go!(-1));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('клик внутри окна не закрывает его', () => {
    const onDone = vi.fn();
    renderCelebration({ onDone });
    fireEvent.click(screen.getByText('5'));
    expect(onDone).not.toHaveBeenCalled();
  });
});

// Регрессия 2026-11-06: «заполнил дневник — поздравление „1 день“, кнопка
// „Поделиться“, само закрылось». useConfetti по концу анимации (~2 с) звал
// onDone — окно уходило из-под пальца. Здесь анимация включена и прогоняется
// до конца синхронным requestAnimationFrame на подменённом 2d-контексте.
describe('Celebration — само не закрывается', () => {
  it('конфетти догорело — окно на месте, onDone не звался', () => {
    localStorage.removeItem('reduce_motion'); // matchMedia в jsdom нет → анимация включена
    const ctx = { clearRect: vi.fn(), save: vi.fn(), restore: vi.fn(), translate: vi.fn(), rotate: vi.fn(), fillRect: vi.fn(), fillStyle: '', globalAlpha: 1 };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
    let frames = 0;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { frames++; cb(0); return frames; });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    const onDone = vi.fn();
    renderCelebration({ streak: 1, onDone });

    expect(frames).toBeGreaterThan(60); // анимация действительно отыграла
    expect(onDone).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('Поделиться')).toBeTruthy();
  });
});

describe('Celebration — ты/вы', () => {
  it('форма «вы»: сбой копирования подсказывает на «вы», без остаточного «ты»', async () => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
    });
    renderCelebration({}, 'vy');
    // shareCanvasImage в jsdom падает (нет canvas.toBlob) → откат на копирование
    fireEvent.click(screen.getByText('Поделиться'));
    expect(await screen.findByText('Не удалось скопировать — скопируйте вручную')).toBeTruthy();
    expect(screen.queryByText('Не удалось скопировать — скопируй вручную')).toBeNull();
  });
});
