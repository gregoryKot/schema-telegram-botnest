// @vitest-environment jsdom
// Celebration — оверлей стрика (0% покрытия). Отключаем конфетти через
// reduce_motion=1, чтобы не трогать canvas.getContext (не реализован в
// jsdom) — сама механика confetti уже покрыта отдельно в useConfetti.test.
// Проверяем: milestone-иконка, дни склоняются верно, клик по фону закрывает,
// клик по карточке — нет (stopPropagation), обе формы ты/вы в подсказке.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { Celebration } from './Celebration';
import { AddressFormContext } from '../utils/addressForm';
import { needDataColor } from './needDataColor';
import { checkInBarH } from './art/checkInBars';
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

function renderCelebration(props: Partial<Parameters<typeof Celebration>[0]> = {}, form: 'ty' | 'vy' = 'ty') {
  return render(
    <AddressFormContext.Provider value={{ form, setForm: vi.fn() }}>
      <Celebration streak={5} onDone={vi.fn()} {...props} />
    </AddressFormContext.Provider>,
  );
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
  it('полоски сегодняшнего листа — цвета данных потребностей в порядке NEED_ORDER', () => {
    const { container } = renderCelebration({ streak: 5 });
    const bars = [...container.querySelectorAll('.sk-celebr-band .scn-shade g rect[rx="10"]')];
    expect(bars.map((b) => b.getAttribute('fill'))).toEqual(NEED_ORDER.map((id) => needDataColor(id)));
  });

  // Ревью g2 r4: высоты полосок были лендинговыми (100/124/70/112/88) — у человека с сегодняшними 2,2,2,2,2
  // сцена показывала высокие столбики. Высоты — сегодняшние оценки в порядке NEED_ORDER; оценок нет — ровно.
  it('высоты полосок — сегодняшние оценки в порядке NEED_ORDER; без оценок — одной высоты', () => {
    const heights = (c: HTMLElement) =>
      [...c.querySelectorAll('.sk-celebr-band .scn-shade g rect[rx="10"]')].map((b) => Number(b.getAttribute('height')));
    const ratings = { attachment: 2, autonomy: 9, expression: 2, play: 5, limits: 10 };
    const low = heights(renderCelebration({ streak: 5, ratings }).container);
    expect(low).toEqual(NEED_ORDER.map((id) => checkInBarH(ratings[id as keyof typeof ratings])));
    expect(low[0]).toBeLessThan(low[1]);
    cleanup();
    const flat = heights(renderCelebration({ streak: 5 }).container);
    expect(new Set(flat).size).toBe(1);
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
  });

  it('без insight дополнительный блок не рендерится', () => {
    renderCelebration({ insight: null });
    expect(screen.queryByText(/заботишься/)).toBeNull();
  });
});

describe('Celebration — закрытие', () => {
  it('клик по фону вызывает onDone', () => {
    const onDone = vi.fn();
    renderCelebration({ onDone });
    fireEvent.click(screen.getByRole('presentation'));
    expect(onDone).toHaveBeenCalled();
  });
});

describe('Celebration — диалог', () => {
  it('размечен как диалог и закрывается явной кнопкой «Закрыть»', () => {
    const onDone = vi.fn();
    renderCelebration({ onDone });
    expect(screen.getByRole('dialog').getAttribute('aria-modal')).toBe('true');
    fireEvent.click(screen.getByText('Закрыть'));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('Escape закрывает', () => {
    const onDone = vi.fn();
    renderCelebration({ onDone });
    fireEvent.keyDown(document, { key: 'Escape' });
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
