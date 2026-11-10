// @vitest-environment jsdom
// Блок «Здесь и сейчас» раздела «Практика»: оба квадрата практик (заземление,
// «Стоп») рендерятся, реальный счётчик из getPracticeSessions встаёт в мету
// квадрата, пока он грузится — плашка-скелетон, а при упавшем запросе квадрат
// без меты — НЕ выдуманный ноль (правило CLAUDE.md «никаких хардкод-заглушек
// вместо реальных данных»). Клик по квадрату открывает лист именно той
// практики, что на нём подписана — регрессия здесь означала бы «Стоп»
// открывает заземление или наоборот. Квадрат «Мне плохо» — только с onSos.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  act,
  cleanup,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HereAndNowBlock } from './HereAndNowBlock';

vi.mock('../../api', () => ({
  api: {
    trackEvent: vi.fn(),
    getPracticeSessions: vi.fn(),
    getFlashcards: vi.fn(),
    recordPracticeSession: vi.fn(),
  },
}));
import { api } from '../../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

function renderBlock(onSos?: () => void) {
  return render(
    <MemoryRouter>
      <HereAndNowBlock onSos={onSos} />
    </MemoryRouter>,
  );
}
const square = (title: RegExp) => screen.getByText(title).closest('button')!;

describe('HereAndNowBlock', () => {
  it('рендерит обе быстрые практики: заземление и «Стоп»', () => {
    mockApi.getPracticeSessions.mockResolvedValue({
      breathing: 0,
      grounding: 0,
      stop: 0,
    });
    renderBlock();
    expect(square(/Заземление/).classList.contains('pp-paper')).toBe(true);
    expect(square(/Техника «Стоп»/).classList.contains('pp-paper')).toBe(true);
    expect(screen.queryByText('Мне плохо')).toBeNull();
    expect(mockApi.getFlashcards).not.toHaveBeenCalled();
  });

  it('пока счётчики грузятся — плашка-скелетон в мете, а не ноль', () => {
    mockApi.getPracticeSessions.mockReturnValue(new Promise(() => {}));
    const { container } = renderBlock();
    expect(container.querySelectorAll('.pp-meta--skeleton')).toHaveLength(2);
    expect(screen.queryByText(/прошли/)).toBeNull();
  });

  it('квадрат «Мне плохо» с onSos: мета — число сохранённых карточек, клик зовёт onSos', async () => {
    mockApi.getPracticeSessions.mockResolvedValue({ breathing: 0, grounding: 0, stop: 0 });
    mockApi.getFlashcards.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    const onSos = vi.fn();
    renderBlock(onSos);
    await flush();
    const sos = square(/Мне плохо/);
    expect(sos.textContent).toMatch(/прошли 2\s+раза/);
    fireEvent.click(sos);
    expect(onSos).toHaveBeenCalledTimes(1);
  });

  it('реальный счётчик из getPracticeSessions виден в мете квадрата', async () => {
    mockApi.getPracticeSessions.mockResolvedValue({
      breathing: 0,
      grounding: 3,
      stop: 0,
    });
    renderBlock();
    await flush();
    expect(screen.getByText(/3 раза/)).toBeTruthy();
  });

  it('запрос счётчиков упал — подпись остаётся статичной, без выдуманного нуля', async () => {
    mockApi.getPracticeSessions.mockRejectedValue(new Error('offline'));
    renderBlock();
    await flush();
    // Подпись квадрата заземления — на месте, меты и скелетона нет.
    expect(screen.getByText('вернуться в тело и в комнату')).toBeTruthy();
    expect(screen.queryByText(/прошли/)).toBeNull();
    expect(document.querySelector('.pp-meta--skeleton')).toBeNull();
  });

  it('клик по квадрату «Стоп» открывает именно лист «Стоп», а не заземления', () => {
    mockApi.getPracticeSessions.mockResolvedValue({
      breathing: 0,
      grounding: 0,
      stop: 0,
    });
    renderBlock();
    fireEvent.click(square(/Техника «Стоп»/));
    expect(screen.getByText('С — Стоп. Замри на секунду')).toBeTruthy();
  });

  it('клик по квадрату заземления открывает именно лист заземления', () => {
    mockApi.getPracticeSessions.mockResolvedValue({
      breathing: 0,
      grounding: 0,
      stop: 0,
    });
    renderBlock();
    fireEvent.click(square(/Заземление/));
    expect(screen.getByText('Найди 5 вещей, которые видишь')).toBeTruthy();
  });
});
