// @vitest-environment jsdom
// Занятая контурная кнопка (идёт её собственное действие: «Загружаю…», «Готовлю картинку…») несёт
// aria-busy="true" — по нему cabinet.css рисует её статусом (плашка, --text-faint), а простаивающую
// неактивную (концепта нет, первый шаг, «Отмена» пока сохраняется форма) — утопленной в страницу
// (ревью волны 0, круг 3; вид — styles/paperPrimitives.test.ts). Здесь — что признак ставит разметка:
// у занятой есть, у простаивающей и у активной нет.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { DiaryMore } from '../sections/diary/DiaryMore';
import { PaperAlert } from './paper/PaperAlert';
import { ConceptLoadFailed } from './therapist/concept/ConceptLoadFailed';
import { ConceptGraphToolbar } from './therapist/ConceptGraphToolbar';
import { YsqQuestion } from './ysq/YsqQuestion';

afterEach(cleanup);

const button = (name: RegExp) => screen.getByRole('button', { name });

describe('aria-busy у занятой контурной кнопки', () => {
  it('«Показать ещё»: загрузка — занята и неактивна; покой и повтор — без признака', () => {
    const { rerender } = render(<DiaryMore state="loading" onMore={vi.fn()} />);
    expect(button(/Загружаю/).getAttribute('aria-busy')).toBe('true');
    expect((button(/Загружаю/) as HTMLButtonElement).disabled).toBe(true);
    rerender(<DiaryMore state="idle" onMore={vi.fn()} />);
    expect(button(/Показать ещё/).hasAttribute('aria-busy')).toBe(false);
    rerender(<DiaryMore state="failed" onMore={vi.fn()} />);
    expect(button(/Повторить/).hasAttribute('aria-busy')).toBe(false);
  });

  it('повтор в PaperAlert и в сбое концептуализации — занят, пока идёт повтор', () => {
    const { rerender } = render(<PaperAlert title="Не сохранилось" onRetry={vi.fn()} retrying />);
    expect(button(/Повторить/).getAttribute('aria-busy')).toBe('true');
    rerender(<PaperAlert title="Не сохранилось" onRetry={vi.fn()} />);
    expect(button(/Повторить/).hasAttribute('aria-busy')).toBe(false);
    cleanup();
    render(<ConceptLoadFailed load={{ failed: true, reloading: true }} onRetry={vi.fn()} />);
    expect(button(/Загружаю/).getAttribute('aria-busy')).toBe('true');
  });

  it('панель схемы: занята только та кнопка, чьё действие идёт', () => {
    const idle = { busy: false, failed: false };
    render(<ConceptGraphToolbar image={{ ...idle, busy: true, download: vi.fn() }} canvas={{ ...idle, open: vi.fn() }} />);
    expect(button(/Готовлю картинку/).getAttribute('aria-busy')).toBe('true');
    expect(button(/Открыть на холсте/).hasAttribute('aria-busy')).toBe(false);
  });

  it('контрольный образец: неактивная «← Назад» на первом вопросе простаивает — признака нет', () => {
    render(<YsqQuestion {...ysqProps()} />);
    const back = button(/Назад/) as HTMLButtonElement;
    expect(back.disabled).toBe(true);
    expect(back.hasAttribute('aria-busy')).toBe(false);
  });
});

function ysqProps(): Parameters<typeof YsqQuestion>[0] {
  return { page: 0, slideKey: 0, slideDir: 'forward', answer: 0, onSelect: vi.fn(), onBack: vi.fn(), onClose: vi.fn() };
}
